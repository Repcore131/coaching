// Remboursements, rétrofacturations et litiges PayPal, sur une base en
// mémoire et un faux PayPal.   node cloudflare/test/remboursements.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { creerBase } from '../src/base.js';
import { creerMetier } from '../src/metier.js';
import { recevoirWebhook, creerPaypal } from '../src/paypal.js';
import { fausseBase, appareil } from './fausse-base.mjs';
import { BUDGET_REQUETE } from '../src/index.js';
import { minute, travaux } from '../src/planif.js';
import { paris } from '../src/metier.js';
import ATT from '../../functions/attribution-calcul.js';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const T0 = Date.parse('2026-10-05T12:00:00+02:00');
const MOIS = 30 * 864e5, J = 864e5;
const ESS = 'P-95N51603RD882780YNJKS2QA';
const ABO = 'I-ABC12345678';
const KEV = 'guellec,coachingpro@gmail,com';
const iso = (t) => new Date(t).toISOString();
const JOUR = ATT.jourParis(T0);

function monde(initial, o) {
  const opt = o || {};
  const F = fausseBase(initial);
  const w = { F, t: T0, abos: opt.abonnements || { [ABO]: { status: 'ACTIVE', plan_id: ESS, billing_info: { next_billing_time: iso(T0 + 20 * J) } } },
    ventes: opt.ventes || {}, captures: opt.captures || {}, commandes: opt.commandes || {} };
  w.req = 0; w.max = 0;
  // CHAQUE sous-requête compte (base, PayPal, push) : c'est ce que Cloudflare plafonne à 50.
  const fetchImpl = async (url, init) => {
    w.req++;
    const u = String(url);
    if (u.endsWith('/v1/oauth2/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'tok', expires_in: 32400 }) };
    if (u.endsWith('/v1/notifications/verify-webhook-signature')) return { ok: true, status: 200, json: async () => ({ verification_status: 'SUCCESS' }) };
    for (const [re, src] of [[/\/v1\/billing\/subscriptions\/(I-[A-Z0-9]+)$/, w.abos], [/\/v2\/checkout\/orders\/([A-Z0-9]+)$/, w.commandes],
      [/\/v1\/payments\/sale\/([A-Z0-9]+)$/, w.ventes], [/\/v2\/payments\/captures\/([A-Z0-9]+)$/, w.captures]]) {
      const m = u.match(re);
      if (m) { const s = src[m[1]]; return s ? { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(s)) } : { ok: false, status: 404, json: async () => ({}) }; }
    }
    return F.fetchImpl(url, init);
  };
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl });
  w.M = creerMetier({ db, vapid: VAPID, fetchImpl, maintenant: () => w.t });
  w.ctx = { db, M: w.M, env: { PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'sec', PAYPAL_WEBHOOK_ID: 'wh' }, fetchImpl, maintenant: () => w.t };
  // COMME index.js : un compteur par webhook, le budget fixé à 44 ; jamais plus de 46.
  w.envoyer = async (type, ress) => {
    const e = { id: 'WH-' + (++n), event_type: type, resource: ress, create_time: iso(w.t) };
    w.req = 0;
    w.M.fixerBudget(() => BUDGET_REQUETE - w.req);
    try {
      const r = await recevoirWebhook(new Request('https://s.t/paypal', { method: 'POST', body: JSON.stringify(e) }), w.ctx);
      const sortie = { status: r.status, texte: await r.text() };
      w.max = Math.max(w.max, w.req); MAX_WEBHOOK = Math.max(MAX_WEBHOOK, w.req);
      assert.ok(w.req <= 46, type + ' : ' + w.req + ' sous-requêtes dans un seul webhook');
      // PUIS les minutes qui rejouent ce que le webhook a différé (à la même
      // heure : les dates attendues ne bougent pas). Chacune a son propre plafond.
      w.M.fixerBudget();
      await w.vider();
      return sortie;
    } finally { w.M.fixerBudget(); }
  };
  w.M.paypal = creerPaypal(w.ctx);
  // Une minute du Worker, avec SON compteur (plafond Cloudflare : 50).
  w.minute = async () => {
    w.F.ecrire('worker/jobs', jobsFaits(w.t));
    w.req = 0;
    const b = await minute({ db, M: w.M, compteur: () => w.req, maintenant: () => w.t });
    assert.ok(b.requetes <= 50, 'minute : ' + b.requetes + ' sous-requêtes');
    w.M.fixerBudget();
    return b;
  };
  // Vider la file : ce que les minutes suivantes rejoueraient.
  w.vider = async () => { for (let i = 0; i < 10 && w.F.lire('evenements'); i++) await w.minute(); };
  w.journal = () => Object.values(w.F.lire('paypal_journal') || {});
  w.com = () => Object.values((w.F.lire('ambassadeurs/LEAFIT/commissions') || {})[Object.keys(w.F.lire('ambassadeurs/LEAFIT/commissions') || {})[0]] || {})[0];
  return w;
}
let n = 0;
let MAX_WEBHOOK = 0;   // le plus gros webhook de tout le fichier
const vente = (id, montant) => ({ id, billing_agreement_id: ABO, amount: { total: montant || '9.50', currency: 'EUR' }, create_time: iso(T0) });
const rembourse = (id, montant, rid) => ({ id: rid || ('R' + (++n) + 'XXXXXXX'), sale_id: id, amount: { total: montant || '9.50', currency: 'EUR' }, reason: 'geste commercial' });
const litige = (id, o) => Object.assign({ dispute_id: 'PP-D-1', reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  dispute_amount: { value: '9.50', currency_code: 'EUR' }, disputed_transactions: [{ seller_transaction_id: id }] }, o);

// Léa : abonnée Essentielle, filleule de Kev (parrain), rattachée aussi à
// l'ambassadrice LEAFIT, arrivée par un lien « story ».
function base(parrain) {
  const kev = Object.assign({ role: 'athlete' }, parrain || { status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active' });
  return {
    users: { 'lea@t,fr': { role: 'athlete', status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active', paypalSubscriptionId: ABO, fname: 'Léa', origine: { src: 'story' },
      sessions: [12, 8, 4, 1].map((k) => ({ date: T0 - k * 864e5, data: { Squat: { sets: [{ done: true }] } } })) },
      'kev@t,fr': kev },
    paypal_abonnes: { [ABO]: 'lea@t,fr' },
    parrainage: { verifies: { 'lea@t,fr': 1 }, liens: { 'lea@t,fr': { parrain: 'kev@t,fr', id: 'f1' } }, comptes: { 'kev@t,fr': { filleuls: { f1: { statut: 'inscrit', prenom: 'Léa' } } } } },
    ambassadeurs: { LEAFIT: { nom: 'Léa Fit', actif: true, commissionPct: 20, secret: 'a'.repeat(24), filleuls: { fx: { inscritLe: 1 } } } },
    ambassadeurs_liens: { 'lea@t,fr': { code: 'LEAFIT', id: 'fx', le: 1 } },
    push: { [KEV]: { x: null } },
  };
}
async function premierPaiement(w, id) {
  const r = await w.envoyer('PAYMENT.SALE.COMPLETED', vente(id || 'SALE0000001'));
  assert.equal(r.texte, 'premier_paiement');
}
// LA MINUTE SUIVANTE (planif.js) : elle rejoue ce qu'un webhook à court de
// budget a différé (suites d'un premier paiement, orphelins, push). Les
// travaux du jour sont marqués faits : seule la file compte ici.
function jobsFaits(t) {
  const p = paris(t);
  return Object.fromEntries(travaux({ planifies: {}, abonnes: () => [] }).map((x) => [x.nom, { jour: x.heure ? p.jour + 'h' + p.heure : p.jour, fini: true }]));
}


await test('remboursement total d’un premier paiement : tout est repris, et le journal le dit', async () => {
  const w = monde(base());
  await premierPaiement(w);
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/moisEnReserve'), 1, 'le parrain abonné a gagné un mois en réserve');
  assert.equal(w.F.lire('attribution/jours/' + JOUR + '/src/story/payant'), 1);
  assert.equal(w.com().commission, 1.9);
  w.t = T0 + 3 * J;
  assert.equal((await w.envoyer('PAYMENT.SALE.REFUNDED', rembourse('SALE0000001'))).texte, 'remboursement');
  // Le parrain : mois retiré de la réserve, filleul plus « payant ».
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/moisEnReserve'), 0);
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/filleuls/f1/statut'), 'rembourse');
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/moisGagnes'), 0);
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/dette'), null);
  // L'ambassadrice : commission annulée.
  assert.equal(w.com().statut, 'annulee');
  // L'attribution : plus « payant ».
  assert.equal(w.F.lire('users/lea@t,fr/origine/payeLe'), null);
  assert.equal(w.F.lire('attribution/jours/' + JOUR + '/src/story/payant'), null);
  assert.equal(w.F.lire('attribution/jours/' + JOUR + '/amb/LEAFIT/payant'), null);
  // Le remboursé : accès fermé à la date du remboursement.
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), T0 + 3 * J);
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/statutPaypal'), 'REMBOURSE');
  assert.equal(w.F.lire('paypal_premiers/lea@t,fr'), null);
  // Le journal : qui, quoi, pourquoi, et ce qui a été fait.
  const j = w.journal();
  assert.equal(j.length, 1);
  assert.equal(j[0].quoi, 'remboursement');
  assert.equal(j[0].qui, 'lea@t.fr');
  assert.equal(j[0].pourquoi, 'geste commercial');
  assert.equal(j[0].premier, true);
  assert.ok(j[0].actions.some((a) => /commission LEAFIT annulée/.test(a)));
  assert.ok(j[0].actions.some((a) => /retiré de la réserve de kev@t\.fr/.test(a)));
  assert.ok(j[0].actions.some((a) => /attribution/.test(a)));
  assert.ok(j[0].actions.some((a) => /accès fermé/.test(a)));
});

await test('mois offert déjà consommé : une dette, soldée sur le prochain mois gagné', async () => {
  // Kev sans accès : son mois d'Essentielle s'ouvre au paiement de Léa, et court déjà.
  const w = monde(base({ status: 'FREE' }));
  await premierPaiement(w);
  assert.equal(w.F.lire('users/kev@t,fr/accessExpiry'), T0 + MOIS);
  w.t = T0 + 5 * J;
  await w.envoyer('PAYMENT.SALE.REFUNDED', rembourse('SALE0000001'));
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/dette'), 1);
  assert.equal(w.F.lire('users/kev@t,fr/accessExpiry'), T0 + MOIS, 'on ne coupe pas un mois déjà entamé');
  assert.ok(w.journal()[0].actions.some((a) => /dette d’un mois pour kev@t\.fr/.test(a)));
  // Son prochain mois gagné paie la dette.
  assert.equal(await w.M.crediterMoisOffert('kev@t,fr', w.t), 'dette_soldee');
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/dette'), null);
  assert.equal(w.F.lire('users/kev@t,fr/accessExpiry'), T0 + MOIS);
  assert.equal(await w.M.crediterMoisOffert('kev@t,fr', w.t), 'acces_prolonge', 'le suivant compte de nouveau');
});

await test('mois ajouté au bout d’un accès encore loin : retiré, sans dette', async () => {
  const w = monde(base({ status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active', accessExpiry: T0 + 50 * J, abonnement: { finAccesPaypal: T0 + 50 * J } }));
  await premierPaiement(w);
  assert.equal(w.F.lire('users/kev@t,fr/accessExpiry'), T0 + 50 * J + MOIS);
  await w.envoyer('PAYMENT.SALE.REFUNDED', rembourse('SALE0000001'));
  assert.equal(w.F.lire('users/kev@t,fr/accessExpiry'), T0 + 50 * J);
  assert.equal(w.F.lire('users/kev@t,fr/abonnement/finAccesPaypal'), T0 + 50 * J);
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/dette'), null);
});

await test('rétrofacturation : comme un remboursement total', async () => {
  const w = monde(base());
  await premierPaiement(w);
  w.t = T0 + 40 * J;
  assert.equal((await w.envoyer('PAYMENT.SALE.REVERSED', { id: 'SALE0000001', amount: { total: '-9.50', currency: 'EUR' }, reason_code: 'CHARGEBACK' })).texte, 'retrofacturation');
  assert.equal(w.com().statut, 'annulee');
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), T0 + 40 * J);
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/moisEnReserve'), 0);
  assert.equal(w.journal()[0].quoi, 'retrofacturation');
  assert.equal(w.journal()[0].pourquoi, 'CHARGEBACK');
});

await test('remboursement partiel : la commission seule, au prorata ; le solde remboursé ensuite annule le reste', async () => {
  const w = monde(base());
  await premierPaiement(w);
  assert.equal((await w.envoyer('PAYMENT.SALE.REFUNDED', rembourse('SALE0000001', '4.75', 'RPART000001'))).texte, 'remboursement_partiel');
  const c = w.com();
  assert.equal(c.montant, 4.75);
  assert.equal(c.commission, 0.95, 'la moitié de 1,90');
  assert.equal(c.commissionInitiale, 1.9);
  assert.equal(c.statut, undefined);
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), null, 'accès intact');
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/moisEnReserve'), 1, 'parrain intact');
  assert.ok(w.F.lire('users/lea@t,fr/origine/payeLe'), 'attribution intacte');
  assert.equal(w.F.lire('ambassadeurs/LEAFIT/stats/ca'), 4.75);
  // Le même remboursement renvoyé ne réduit pas deux fois.
  await w.envoyer('PAYMENT.SALE.REFUNDED', rembourse('SALE0000001', '4.75', 'RPART000001'));
  assert.equal(w.com().commission, 0.95);
  // Le reste : c'est devenu un remboursement total.
  assert.equal((await w.envoyer('PAYMENT.SALE.REFUNDED', rembourse('SALE0000001', '4.75', 'RPART000002'))).texte, 'remboursement');
  assert.equal(w.com().statut, 'annulee');
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/moisEnReserve'), 0);
  assert.deepEqual(w.journal().map((x) => x.quoi).sort(), ['remboursement', 'remboursement_partiel', 'remboursement_partiel']);
});

await test('litige ouvert : commission suspendue, journal, push à Kevin ; gagné : rétablie, rien d’autre', async () => {
  const kev = appareil('https://push.t/kev');
  const init = base(); init.push = { [KEV]: { x: kev.abonnement } };
  const w = monde(init);
  await premierPaiement(w);
  w.t = Date.parse('2026-10-06T23:30:00+02:00');     // en pleine nuit : le push part quand même
  assert.equal((await w.envoyer('CUSTOMER.DISPUTE.CREATED', litige('SALE0000001'))).texte, 'litige_ouvert');
  assert.equal(w.com().statut, 'suspendue');
  let j = w.journal();
  assert.equal(j[0].quoi, 'litige_ouvert');
  assert.equal(j[0].qui, 'lea@t.fr');
  assert.equal(j[0].pourquoi, 'merchandise or service not received');
  assert.equal(w.F.recus.length, 1, 'un push pour l’ouverture');
  const m = kev.lire(w.F.recus[0].init.body);
  assert.match(m.title, /Litige PayPal ouvert : 9,50 €/);
  assert.equal(m.url, './?paiements=1');
  // Une commission suspendue n'est ni due, ni exportée.
  const vue = w.F.lire('ambassadeurs_vue/' + 'a'.repeat(24));
  assert.equal(vue.suspendue, 1.9);
  assert.equal(vue.due + vue.attente, 0);
  // Gagné.
  w.t += J;
  assert.equal((await w.envoyer('CUSTOMER.DISPUTE.RESOLVED', litige('SALE0000001', { dispute_outcome: { outcome_code: 'RESOLVED_SELLER_FAVOUR' } }))).texte, 'litige_gagne');
  assert.equal(w.com().statut, undefined, 'commission rétablie dans son état d’avant');
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), null);
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/moisEnReserve'), 1);
  j = w.journal().map((x) => x.quoi).sort();
  assert.deepEqual(j, ['litige_gagne', 'litige_ouvert']);
  assert.equal(w.F.recus.length, 2, 'un push pour la clôture');
});

await test('litige perdu : comme un remboursement ; la rétrofacturation qui suit ne refait rien', async () => {
  const w = monde(base());
  await premierPaiement(w);
  await w.envoyer('CUSTOMER.DISPUTE.CREATED', litige('SALE0000001'));
  w.t = T0 + 10 * J;
  assert.equal((await w.envoyer('CUSTOMER.DISPUTE.RESOLVED', litige('SALE0000001', { dispute_outcome: { outcome_code: 'RESOLVED_BUYER_FAVOUR' } }))).texte, 'litige_perdu');
  assert.equal(w.com().statut, 'annulee');
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), T0 + 10 * J);
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/moisEnReserve'), 0);
  assert.equal(w.F.lire('users/lea@t,fr/origine/payeLe'), null);
  const avant = w.journal().length;
  assert.equal((await w.envoyer('PAYMENT.SALE.REVERSED', { id: 'SALE0000001', amount: { total: '-9.50', currency: 'EUR' } })).texte, 'deja_annule');
  assert.equal(w.journal().length, avant, 'pas de seconde ligne pour la même perte');
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/dette'), null, 'et pas de seconde reprise au parrain');
});

await test('litige perdu pour une partie : la commission au prorata, une seule fois même si la rétrofacturation partielle suit', async () => {
  const w = monde(base());
  await premierPaiement(w);
  await w.envoyer('CUSTOMER.DISPUTE.CREATED', litige('SALE0000001'));
  assert.equal((await w.envoyer('CUSTOMER.DISPUTE.RESOLVED', litige('SALE0000001', { dispute_outcome: { outcome_code: 'RESOLVED_BUYER_FAVOUR',
    amount_refunded: { value: '4.75', currency_code: 'EUR' } } }))).texte, 'litige_perdu');
  assert.equal(w.com().commission, 0.95);
  assert.equal(w.com().statut, undefined, 'plus suspendue, réduite');
  await w.envoyer('PAYMENT.SALE.REVERSED', { id: 'SALE0000001', amount: { total: '-4.75', currency: 'EUR' } });
  assert.equal(w.com().commission, 0.95, 'le même argent n’est pas déduit deux fois');
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), null);
});

await test('remboursement total d’un paiement qui n’était pas le premier : ni accès, ni parrain, ni attribution', async () => {
  const w = monde(base());
  await premierPaiement(w);
  w.t = T0 + 31 * J;
  assert.equal((await w.envoyer('PAYMENT.SALE.COMPLETED', vente('SALE0000002'))).texte, 'paiement');
  await w.envoyer('PAYMENT.SALE.REFUNDED', rembourse('SALE0000002'));
  const coms = Object.values(w.F.lire('ambassadeurs/LEAFIT/commissions')).flatMap((m) => Object.values(m));
  // Le serveur léger ne commissionne que le premier paiement : celui-ci n'a
  // pas de commission, et celle du premier reste intacte.
  assert.deepEqual(coms.map((c) => c.statut || 'ok'), ['ok']);
  assert.deepEqual(w.journal()[0].actions, ['rien à reprendre']);
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), null);
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/moisEnReserve'), 1);
  assert.equal(w.journal()[0].premier, false);
});

await test('paiement d’avant le registre : retrouvé chez PayPal (vente, abonnement, date du premier)', async () => {
  const init = base();
  init.paypal_premiers = { 'lea@t,fr': { le: T0, abo: ABO } };
  init.users['lea@t,fr'].origine.payeLe = T0;
  init.parrainage.credits = { 'lea@t,fr': { parrain: 'kev@t,fr', id: 'f1', mode: 'reserve', le: T0 } };
  init.parrainage.comptes['kev@t,fr'] = { moisEnReserve: 1, moisGagnes: 1, filleuls: { f1: { statut: 'payant' } } };
  const w = monde(init, { ventes: { SALEOLD0001: { id: 'SALEOLD0001', billing_agreement_id: ABO, amount: { total: '9.50', currency: 'EUR' }, create_time: iso(T0 + 3600e3) } } });
  assert.equal((await w.envoyer('PAYMENT.SALE.REFUNDED', rembourse('SALEOLD0001'))).texte, 'remboursement');
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/moisEnReserve'), 0);
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), T0);
  assert.equal(w.F.lire('paypal_transactions/SALEOLD0001/premier'), true);
  // Inconnue chez PayPal comme au registre : notée, rien de repris.
  assert.equal((await w.envoyer('PAYMENT.SALE.REFUNDED', rembourse('INCONNUE0001'))).texte, 'remboursement_inconnu');
  assert.equal(w.journal().filter((x) => x.quoi === 'remboursement_inconnu').length, 1);
});

await test('achat d’un programme remboursé : le programme se ferme à la date du remboursement', async () => {
  const init = base();
  init.boutique = { p1: { prixCts: 1490 } };
  init.users['lea@t,fr'].programmesAchetes = { p1: { le: T0, ouvertJusqu: T0 + 90 * J } };
  const w = monde(init, { commandes: { ORD00000001: { status: 'COMPLETED', purchase_units: [{ custom_id: 'lea@t,fr|p1', amount: { currency_code: 'EUR', value: '14.90' } }] } } });
  const cap = { id: 'CAP00000001', amount: { value: '14.90', currency_code: 'EUR' }, supplementary_data: { related_ids: { order_id: 'ORD00000001' } } };
  assert.equal((await w.envoyer('PAYMENT.CAPTURE.COMPLETED', cap)).texte, 'premier_paiement');
  w.t = T0 + 2 * J;
  const r = await w.envoyer('PAYMENT.CAPTURE.REFUNDED', { id: 'RCAP0000001', amount: { value: '14.90', currency_code: 'EUR' },
    links: [{ rel: 'up', href: 'https://api-m.paypal.com/v2/payments/captures/CAP00000001' }] });
  assert.equal(r.texte, 'remboursement');
  assert.equal(w.F.lire('users/lea@t,fr/programmesAchetes/p1/ouvertJusqu'), T0 + 2 * J);
  assert.equal(w.F.lire('users/lea@t,fr/abonnement'), null, 'l’abonnement n’est pas touché');
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/moisEnReserve'), 0);
});

console.log(ok + ' tests passés — au plus ' + MAX_WEBHOOK + ' sous-requêtes dans un webhook (plafond Cloudflare : 50, exigé : 46)');
