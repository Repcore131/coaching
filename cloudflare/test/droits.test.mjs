// droits/ porté par le serveur léger, et le rattrapage des anciens payeurs.
//   node cloudflare/test/droits.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { creerBase } from '../src/base.js';
import { creerMetier } from '../src/metier.js';
import { recevoirWebhook, creerPaypal } from '../src/paypal.js';
import { creerEssai, ESSAI_JOURS, joursEssai } from '../src/essai.js';
import { ErreurAppel } from '../src/appels.js';
import { planifierMigration } from '../src/migration.js';
import { fausseBase } from './fausse-base.mjs';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const T0 = Date.parse('2026-10-05T12:00:00+02:00');
const J = 864e5, MOIS = 30 * J;
const ESS = 'P-95N51603RD882780YNJKS2QA', ULT = 'P-2W777608239063532NK2LZXA';
const ABO = 'I-ABC12345678';
const iso = (t) => new Date(t).toISOString();
let n = 0;

function monde(initial, o) {
  const opt = o || {};
  const F = fausseBase(initial);
  const w = { F, t: T0, abos: opt.abonnements || { [ABO]: { status: 'ACTIVE', plan_id: ULT, custom_id: 'lea@t,fr', billing_info: { next_billing_time: iso(T0 + 20 * J) } } },
    commandes: opt.commandes || {} };
  const fetchImpl = async (url, init) => {
    const u = String(url);
    if (u.endsWith('/v1/oauth2/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'tok', expires_in: 32400 }) };
    if (u.endsWith('/v1/notifications/verify-webhook-signature')) return { ok: true, status: 200, json: async () => ({ verification_status: 'SUCCESS' }) };
    for (const [re, src] of [[/\/v1\/billing\/subscriptions\/(I-[A-Z0-9]+)$/, w.abos], [/\/v2\/checkout\/orders\/([A-Z0-9]+)$/, w.commandes]]) {
      const m = u.match(re);
      if (m) { const s = src[m[1]]; return s ? { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(s)) } : { ok: false, status: 404, json: async () => ({}) }; }
    }
    return F.fetchImpl(url, init);
  };
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl });
  w.db = db;
  w.M = creerMetier({ db, vapid: VAPID, fetchImpl, maintenant: () => w.t });
  w.env = { PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'sec', PAYPAL_WEBHOOK_ID: 'wh' };
  w.ctx = { db, M: w.M, env: w.env, fetchImpl, maintenant: () => w.t };
  w.fetchImpl = fetchImpl;
  w.envoyer = async (type, ress) => {
    const e = { id: 'WH-' + (++n), event_type: type, resource: ress, create_time: iso(w.t) };
    const r = await recevoirWebhook(new Request('https://s.t/paypal', { method: 'POST', body: JSON.stringify(e) }), w.ctx);
    return r.text();
  };
  w.droits = (k) => { const d = w.F.lire('droits/' + (k || 'lea@t,fr')); if (d) delete d.maj; return d; };
  return w;
}
const LEA = (u) => ({ 'lea@t,fr': Object.assign({ role: 'athlete', status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active', paypalSubscriptionId: ABO }, u) });
const vente = (id, m) => ({ id: id || 'SALE0000001', billing_agreement_id: ABO, amount: { total: m || '24.90', currency: 'EUR' } });

await test('paiement : droits/ = {palier du plan, sans échéance, source paypal, abo}, en plus du dossier', async () => {
  const w = monde({ users: LEA(), paypal_abonnes: { [ABO]: 'lea@t,fr' } });
  await w.envoyer('PAYMENT.SALE.COMPLETED', vente());
  assert.deepEqual(w.droits(), { palier: 'ultime', echeance: 0, source: 'paypal', abo: ABO });
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/formule'), 'ultime', 'le dossier suit toujours');
});

await test('activation : l’accès s’ouvre dans droits/ sans attendre le paiement', async () => {
  const w = monde({ users: LEA(), paypal_abonnes: { [ABO]: 'lea@t,fr' } });
  await w.envoyer('BILLING.SUBSCRIPTION.ACTIVATED', { id: ABO, status: 'ACTIVE', plan_id: ESS, custom_id: 'lea@t,fr' });
  assert.equal(w.droits().palier, 'essentielle');
  assert.equal(w.droits().echeance, 0);
});

await test('annulation puis fin : droits/ porte la fin payée ; un client qui efface accessExpiry reste fermé à la date', async () => {
  const w = monde({ users: LEA(), paypal_abonnes: { [ABO]: 'lea@t,fr' } });
  await w.envoyer('PAYMENT.SALE.COMPLETED', vente());
  w.abos[ABO].status = 'CANCELLED';
  await w.envoyer('BILLING.SUBSCRIPTION.CANCELLED', { id: ABO });
  assert.deepEqual(w.droits(), { palier: 'ultime', echeance: T0 + 20 * J, source: 'paypal', abo: ABO });
  // Le titulaire efface sa date de fin et se redéclare actif dans SON dossier…
  w.F.ecrire('users/lea@t,fr/accessExpiry', null);
  w.F.ecrire('users/lea@t,fr/abonnement/finAccesPaypal', null);
  // … droits/, qu'il ne peut pas écrire, garde la fin : c'est ce que l'app lit
  // d'abord (palierDe) et ce que la règle du catalogue lit (exercices).
  assert.equal(w.droits().echeance, T0 + 20 * J);
  assert.equal(w.M.palierDroits(w.F.lire('droits/lea@t,fr'), T0 + 21 * J), 'aucun');
});

await test('remboursement : droits/ se ferme à la date du remboursement', async () => {
  const w = monde({ users: LEA(), paypal_abonnes: { [ABO]: 'lea@t,fr' } });
  await w.envoyer('PAYMENT.SALE.COMPLETED', vente());
  w.t = T0 + 3 * J;
  await w.envoyer('PAYMENT.SALE.REFUNDED', { id: 'RFD00000001', sale_id: 'SALE0000001', amount: { total: '24.90', currency: 'EUR' } });
  assert.equal(w.droits().echeance, T0 + 3 * J);
  assert.equal(w.M.palierDroits(w.F.lire('droits/lea@t,fr'), T0 + 3 * J), 'aucun');
});

await test('programme acheté : Ultime trois mois par-dessus l’abonnement (ultimeJusqu), refermé s’il est remboursé', async () => {
  const w = monde({ users: LEA({ paypalSubscriptionId: null }), boutique: { p1: { prixCts: 1490 } } },
    { commandes: { ORD00000001: { status: 'COMPLETED', purchase_units: [{ custom_id: 'lea@t,fr|p1', amount: { currency_code: 'EUR', value: '14.90' } }] } } });
  await w.envoyer('PAYMENT.CAPTURE.COMPLETED', { id: 'CAP00000001', amount: { value: '14.90', currency_code: 'EUR' },
    supplementary_data: { related_ids: { order_id: 'ORD00000001' } } });
  // La preuve d'achat qui ouvre boutique_contenu/p1 (01/10/2026).
  assert.deepEqual(w.droits(), { palier: 'aucun', echeance: 0, source: 'paypal', ultimeJusqu: T0 + 3 * MOIS, programmes: { p1: T0 } });
  w.t = T0 + J;
  await w.envoyer('PAYMENT.CAPTURE.REFUNDED', { id: 'RC000000001', amount: { value: '14.90', currency_code: 'EUR' },
    links: [{ rel: 'up', href: 'https://x/v2/payments/captures/CAP00000001' }] });
  assert.equal(w.droits().ultimeJusqu, T0 + J);
  assert.equal(w.droits().programmes, undefined, 'remboursé : le contenu se referme');
});

await test('un accès posé à la main par le créateur n’est pas réécrit par PayPal', async () => {
  for (const source of ['main', 'suspension']) {
    const pose = { palier: source === 'main' ? 'ultime' : 'aucun', echeance: 0, source, maj: 1 };
    const w = monde({ users: LEA(), paypal_abonnes: { [ABO]: 'lea@t,fr' }, droits: { 'lea@t,fr': pose } });
    await w.envoyer('PAYMENT.SALE.COMPLETED', vente('S' + source.toUpperCase() + '001', '24.90'));
    await w.envoyer('BILLING.SUBSCRIPTION.CANCELLED', { id: ABO });
    assert.deepEqual(w.F.lire('droits/lea@t,fr'), pose, source);
  }
});

await test('les coachs n’ont pas de droits/ : leur palier reste coachPlan', async () => {
  const w = monde({ users: { 'co@t,fr': { role: 'coach', paypalSubscriptionId: 'I-COA12345678' } }, paypal_abonnes: { 'I-COA12345678': 'co@t,fr' } },
    { abonnements: { 'I-COA12345678': { status: 'ACTIVE', plan_id: 'P-1WS20264K4576284KNK2RF5Y' } } });
  await w.envoyer('PAYMENT.SALE.COMPLETED', { id: 'SCO00000001', billing_agreement_id: 'I-COA12345678', amount: { total: '39.00', currency: 'EUR' } });
  assert.equal(w.F.lire('users/co@t,fr/coachPlan'), 'pro');
  assert.equal(w.F.lire('droits/co@t,fr'), null);
});

await test('parrainage : le mois offert s’écrit aussi dans droits/ (source parrainage)', async () => {
  const w = monde({ users: { 'kev@t,fr': { role: 'athlete', status: 'FREE' } } });
  assert.equal(await w.M.crediterMoisOffert('kev@t,fr', T0), 'mois_ouvert');
  assert.deepEqual(w.droits('kev@t,fr'), { palier: 'essentielle', echeance: T0 + MOIS, source: 'parrainage' });
  // Et un second recule la date, dans droits/ comme dans le dossier.
  assert.equal(await w.M.crediterMoisOffert('kev@t,fr', T0 + J), 'acces_prolonge');
  assert.equal(w.droits('kev@t,fr').echeance, T0 + 2 * MOIS);
  assert.equal(w.F.lire('users/kev@t,fr/accessExpiry'), T0 + 2 * MOIS);
});

// ── dejaPaye, et l'ancien payeur ─────────────────────────────────────────
const CODE = 'KEVIN2K9';
function parrainageBase(lea) {
  return { users: { 'kev@t,fr': { role: 'athlete', status: 'FREE' }, 'lea@t,fr': Object.assign({ role: 'athlete', createdAt: T0 - J }, lea) },
    parrainage: { codes: { [CODE]: 'kev@t,fr' }, comptes: { 'kev@t,fr': { code: CODE } } } };
}
const demande = (w) => w.M.parrainageDemande('lea@t,fr', { code: CODE, appareil: 'appareil00000001', le: T0 });

await test('dejaPaye : paypal_premiers, un abonnement dans le dossier, ou droits/ PayPal — pas createdAt', async () => {
  // Compte tout neuf (createdAt d'hier) mais déjà payeur : refusé.
  for (const [nom, init] of [
    ['paypal_premiers', Object.assign(parrainageBase(), { paypal_premiers: { 'lea@t,fr': { le: 1, abo: ABO } } })],
    ['paypalSubscriptionId', parrainageBase({ paypalSubscriptionId: ABO })],
    ['droits paypal', Object.assign(parrainageBase(), { droits: { 'lea@t,fr': { palier: 'aucun', echeance: 1, source: 'paypal', abo: ABO } } })]]) {
    const w = monde(init);
    const r = await demande(w);
    assert.deepEqual(r, { ok: false, raison: 'deja_client' }, nom);
  }
  // Jamais payé : accepté.
  const w = monde(parrainageBase());
  assert.deepEqual(await demande(w), { ok: true });
});

await test('un ancien payeur, rattrapé par le script, ne déclenche pas de mois parrain', async () => {
  // Léa a payé AVANT le serveur léger : aucune trace serveur, seulement PayPal.
  const init = parrainageBase({ paypalSubscriptionId: ABO });
  const w = monde(init, { abonnements: { [ABO]: { status: 'ACTIVE', plan_id: ESS, subscriber: { email_address: 'Lea@t.fr' },
    start_time: iso(T0 - 200 * J), billing_info: { last_payment: { time: iso(T0 - 10 * J) }, cycle_executions: [{ cycles_completed: 6 }] } } } });
  const { maj, rapport } = await planifierMigration({ db: w.db, env: w.env, fetchImpl: w.fetchImpl, maintenant: () => w.t });
  assert.deepEqual(maj['paypal_premiers/lea@t,fr'], { le: T0 - 10 * J, abo: ABO, source: 'migration' });
  assert.deepEqual(Object.assign({}, maj['droits/lea@t,fr'], { maj: 0 }), { palier: 'essentielle', echeance: 0, source: 'paypal', abo: ABO, maj: 0 });
  assert.equal(maj['paypal_abonnes/' + ABO], 'lea@t,fr');
  assert.equal(rapport.premiers, 1);
  await w.db.ref().update(maj);
  // Elle efface son abonnement du dossier et tente un code parrain : refusé.
  w.F.ecrire('users/lea@t,fr/paypalSubscriptionId', null);
  assert.deepEqual(await demande(w), { ok: false, raison: 'deja_client' });
  // Et même rattachée (lien posé avant le rattrapage), son paiement ne crédite rien.
  w.F.ecrire('parrainage/liens/lea@t,fr', { parrain: 'kev@t,fr', id: 'f1' });
  w.F.ecrire('parrainage/comptes/kev@t,fr/filleuls/f1', { statut: 'inscrit' });
  w.F.ecrire('users/lea@t,fr/paypalSubscriptionId', ABO);
  assert.equal(await w.envoyer('PAYMENT.SALE.COMPLETED', vente('SALE0000009', '9.50')), 'paiement');
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/filleuls/f1/statut'), 'inscrit');
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/moisEnReserve'), null);
  assert.equal(w.F.lire('droits/kev@t,fr'), null, 'aucun mois ouvert au parrain');
});

await test('le rattrapage ne croit pas le dossier : abonnement d’un autre, commande non vérifiée, droits/ existants', async () => {
  const init = { users: {
    'pirate@t,fr': { role: 'athlete', paypalSubscriptionId: ABO, programmesAchetes: { p1: { le: T0, prixCts: 1490, ordre: 'ORDVOLE0001', ouvertJusqu: T0 + 90 * J } } },
    'lea@t,fr': { role: 'athlete', paypalSubscriptionId: 'I-LEA12345678' } },
    droits: { 'lea@t,fr': { palier: 'ultime', echeance: 0, source: 'main', maj: 1 } } };
  const w = monde(init, { abonnements: {
    [ABO]: { status: 'ACTIVE', plan_id: ESS, custom_id: 'lea@t,fr', billing_info: { last_payment: { time: iso(T0) } } },
    'I-LEA12345678': { status: 'ACTIVE', plan_id: ESS, custom_id: 'lea@t,fr', billing_info: { last_payment: { time: iso(T0) } } } },
    commandes: { ORDVOLE0001: { status: 'COMPLETED', payer: { email_address: 'lea@t.fr' }, purchase_units: [{ custom_id: 'p1' }] } } });
  const { maj, rapport } = await planifierMigration({ db: w.db, env: w.env, fetchImpl: w.fetchImpl, maintenant: () => w.t });
  assert.equal(maj['droits/pirate@t,fr'], undefined);
  assert.equal(maj['paypal_premiers/pirate@t,fr'], undefined);
  assert.equal(rapport.refuses.length, 2);
  assert.equal(maj['droits/lea@t,fr'], undefined, 'un accès posé à la main n’est pas remplacé');
  assert.ok(maj['paypal_premiers/lea@t,fr']);
});

// ══ PORTÉS DE functions/index.js (01/10/2026) : ouvrirEssai, verifierAchatProgramme ══
const refuse = (statut) => (e) => e instanceof ErreurAppel && e.statut === statut;

await test('ouvrirEssai : ouvert une fois (Ultime, source essai, ESSAI_JOURS au plus), puis idempotent', async () => {
  const w = monde({ users: { 'zoe@t,fr': { role: 'athlete' } } });
  const E = creerEssai(w.ctx);
  assert.equal(ESSAI_JOURS, 30);
  assert.equal(joursEssai(400), 30); assert.equal(joursEssai(7), 7); assert.equal(joursEssai('x'), 30); assert.equal(joursEssai(-3), 30);
  const r = await E.ouvrirEssai({ auth: { email: 'Zoe@t.fr' }, data: { jours: 400 } });
  assert.equal(r.deja, false); assert.equal(r.echeance, T0 + 30 * J);
  const d = w.droits('zoe@t,fr');
  assert.equal(d.palier, 'ultime'); assert.equal(d.source, 'essai');
  assert.equal(d.echeance, T0 + 30 * J); assert.equal(d.essaiFinit, T0 + 30 * J); assert.equal(d.essaiOuvertLe, T0);
  // Un second appel, plus tard : l'échéance existante, rien de réécrit.
  w.t = T0 + 40 * J;
  const avant = JSON.stringify(w.F.lire('droits/zoe@t,fr'));
  const r2 = await E.ouvrirEssai({ auth: { email: 'zoe@t.fr' }, data: {} });
  assert.equal(r2.deja, true); assert.equal(r2.echeance, T0 + 30 * J);
  assert.equal(JSON.stringify(w.F.lire('droits/zoe@t,fr')), avant, 'idempotent : rien de réécrit');
});

await test('ouvrirEssai : refusé à qui a déjà payé (premier paiement, abonnement, droits PayPal), et à un coach', async () => {
  const w = monde({ users: { 'pay@t,fr': { role: 'athlete' }, 'abo@t,fr': { role: 'athlete', paypalSubscriptionId: 'I-ABC12345678' },
    'dro@t,fr': { role: 'athlete' }, 'kev@t,fr': { role: 'coach' } },
    paypal_premiers: { 'pay@t,fr': { le: 1 } }, droits: { 'dro@t,fr': { palier: 'aucun', echeance: 1, source: 'paypal' } },
    coachs_registre: { 'kev@t,fr': { plan: 'libre' } } });
  const E = creerEssai(w.ctx);
  for (const m of ['pay@t.fr', 'abo@t.fr', 'dro@t.fr'])
    await assert.rejects(() => E.ouvrirEssai({ auth: { email: m }, data: {} }), refuse(409), m);
  await assert.rejects(() => E.ouvrirEssai({ auth: { email: 'kev@t.fr' }, data: {} }), refuse(400));
  assert.equal(w.F.lire('droits/pay@t,fr'), null, 'rien d’écrit pour un payant');
  assert.equal(w.F.lire('droits/abo@t,fr'), null);
  assert.equal(w.F.lire('droits/dro@t,fr/essaiOuvertLe'), null);
});

// Une commande capturée, telle que PayPal la rend sur /v2/checkout/orders/<id>.
const commandeProg = (custom, v, statut) => ({ id: 'ORD00000009', status: statut || 'COMPLETED', purchase_units: [{ custom_id: custom,
  amount: { currency_code: 'EUR', value: v || '14.90' },
  payments: { captures: [{ id: 'CAP00000009', status: 'COMPLETED', amount: { currency_code: 'EUR', value: v || '14.90' } }] } }] });

await test('verifierAchatProgramme : commande relue chez PayPal → droits/<clé>/programmes/<id>, Ultime 3 mois ; le webhook ne rouvre pas', async () => {
  const w = monde({ users: LEA({ paypalSubscriptionId: null }), boutique: { p1: { prixCts: 1490 } } },
    { commandes: { ORD00000009: commandeProg('lea@t,fr|p1') } });
  const P = creerPaypal(w.ctx);
  const r = await P.verifierAchat('lea@t,fr', 'ORD00000009', 'p1');
  assert.equal(r.ouvert, true); assert.equal(r.jusqua, T0 + 3 * MOIS);
  // LE MÊME RÉSULTAT QUE LE WEBHOOK (même chemin) : preuve d'achat, ultimeJusqu, trace, registre, premier paiement.
  assert.deepEqual(w.droits(), { palier: 'aucun', echeance: 0, source: 'paypal', ultimeJusqu: T0 + 3 * MOIS, programmes: { p1: T0 } });
  assert.equal(w.F.lire('users/lea@t,fr/programmesAchetes/p1/ouvertJusqu'), T0 + 3 * MOIS);
  assert.equal(w.F.lire('paypal_transactions/CAP00000009/prog'), 'p1');
  assert.ok(w.F.lire('paypal_premiers/lea@t,fr'));
  // Un second appel, puis le webhook de la même capture : rien ne s'ajoute.
  w.t = T0 + J;
  const r2 = await P.verifierAchat('lea@t,fr', 'ORD00000009', 'p1');
  assert.equal(r2.ouvert, false); assert.equal(r2.deja, true); assert.equal(r2.jusqua, T0 + 3 * MOIS);
  assert.equal(await w.envoyer('PAYMENT.CAPTURE.COMPLETED', { id: 'CAP00000009', status: 'COMPLETED', amount: { value: '14.90', currency_code: 'EUR' },
    supplementary_data: { related_ids: { order_id: 'ORD00000009' } } }), 'deja_ouvert');
  assert.equal(w.droits().ultimeJusqu, T0 + 3 * MOIS, 'trois mois, pas six');
});

await test('verifierAchatProgramme : montant faux, commande d’un autre compte, non capturée, introuvable → refusés, rien d’ouvert', async () => {
  const w = monde({ users: Object.assign(LEA({ paypalSubscriptionId: null }), { 'zoe@t,fr': { role: 'athlete' } }), boutique: { p1: { prixCts: 1490 } } },
    { commandes: { ORD0000FAUX: commandeProg('lea@t,fr|p1', '1.00'), ORD000AUTRE: commandeProg('zoe@t,fr|p1'),
      ORD0000PROG: commandeProg('lea@t,fr|p2'), ORD000ATTEN: commandeProg('lea@t,fr|p1', null, 'APPROVED') } });
  const P = creerPaypal(w.ctx);
  await assert.rejects(() => P.verifierAchat('lea@t,fr', 'ORD0000FAUX', 'p1'), refuse(403), 'montant');
  await assert.rejects(() => P.verifierAchat('lea@t,fr', 'ORD000AUTRE', 'p1'), refuse(403), 'autre compte');
  await assert.rejects(() => P.verifierAchat('lea@t,fr', 'ORD0000PROG', 'p1'), refuse(403), 'autre programme');
  await assert.rejects(() => P.verifierAchat('lea@t,fr', 'ORD000ATTEN', 'p1'), refuse(409), 'pas encore capturée');
  await assert.rejects(() => P.verifierAchat('lea@t,fr', 'ORD000ABSEN', 'p1'), refuse(404), 'introuvable');
  await assert.rejects(() => P.verifierAchat('lea@t,fr', 'x', 'p1'), refuse(400), 'mal formée');
  assert.equal(w.droits(), null, 'aucun droit ouvert');
  assert.equal(w.F.lire('droits/zoe@t,fr'), null, 'la commande de Zoé n’ouvre rien chez Zoé non plus');
  assert.equal(w.F.lire('paypal_premiers'), null);
  assert.equal(w.F.lire('paypal_transactions/CAP00000009/ouvert'), null, 'un achat non compté ne pose pas la garde');
});

await test('verifierAchatProgramme : une panne après la garde la relâche — le renvoi du webhook ouvre bien l’achat', async () => {
  const w = monde({ users: LEA({ paypalSubscriptionId: null }), boutique: { p1: { prixCts: 1490 } } },
    { commandes: { ORD00000009: commandeProg('lea@t,fr|p1') } });
  const P = creerPaypal(w.ctx);
  const maj = w.M.majDroits;
  w.M.majDroits = async () => { throw new Error('base injoignable'); };
  await assert.rejects(() => P.verifierAchat('lea@t,fr', 'ORD00000009', 'p1'));
  assert.equal(w.F.lire('paypal_transactions/CAP00000009/ouvert'), null, 'garde relâchée');
  w.M.majDroits = maj;
  const r = await P.verifierAchat('lea@t,fr', 'ORD00000009', 'p1');
  assert.equal(r.ouvert, true); assert.equal(w.droits().ultimeJusqu, T0 + 3 * MOIS);
});

console.log(ok + ' tests passés');
