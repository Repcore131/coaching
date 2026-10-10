// Les formules de coaching de Kevin : prix de tarifs.json, contrôle du montant,
// lien au coach, attribution et commission.   node --test cloudflare/test/coaching.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { creerBase } from '../src/base.js';
import { creerMetier } from '../src/metier.js';
import { creerPaypal, recevoirWebhook } from '../src/paypal.js';
import * as CK from '../src/coaching.js';
import T from '../../tarifs.json' with { type: 'json' };
import { fausseBase } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const T0 = Date.parse('2026-10-12T12:00:00+02:00');
const J = 864e5;
const KEV = 'guellec,coachingpro@gmail,com', LEA = 'lea@t,fr', AUTRE = 'autre@t,fr';

// Un faux PayPal Orders v2. `alterer` change le montant d'une commande après
// sa création (une commande forgée ou modifiée ailleurs que par le serveur).
function monde(initial, o) {
  const F = fausseBase(initial);
  const opt = o || {};
  const w = { F, commandes: {}, crees: [], t: T0, n: 0, captures: {} };
  const rep = (status, j) => ({ ok: status < 400, status, json: async () => JSON.parse(JSON.stringify(j)) });
  const fetchImpl = async (url, init) => {
    const u = String(url);
    if (u.endsWith('/v1/oauth2/token')) return rep(200, { access_token: 'tok', expires_in: 32400 });
    if (u.endsWith('/v1/notifications/verify-webhook-signature')) return rep(200, { verification_status: 'SUCCESS' });
    if (u.endsWith('/v2/checkout/orders') && init.method === 'POST') {
      const b = JSON.parse(init.body);
      w.crees.push(b);
      const id = 'ORD' + String(++w.n).padStart(6, '0');
      w.commandes[id] = { id, status: 'CREATED', purchase_units: [JSON.parse(JSON.stringify(b.purchase_units[0]))],
        links: [{ rel: 'payer-action', href: 'https://www.paypal.com/checkoutnow?token=' + id }] };
      if (opt.alterer) w.commandes[id].purchase_units[0].amount.value = opt.alterer;
      return rep(201, w.commandes[id]);
    }
    let m = u.match(/\/v2\/checkout\/orders\/([A-Z0-9]+)\/capture$/);
    if (m) {
      const c = w.commandes[m[1]];
      if (!c) return rep(404, {});
      const pu = c.purchase_units[0];
      const cap = { id: 'CAP' + m[1], status: 'COMPLETED', amount: Object.assign({}, pu.amount),
        supplementary_data: { related_ids: { order_id: m[1] } }, create_time: new Date(w.t).toISOString() };
      pu.payments = { captures: [cap] };
      w.captures[cap.id] = cap;
      c.status = 'COMPLETED';
      return rep(201, { id: c.id, status: 'COMPLETED' });
    }
    m = u.match(/\/v2\/checkout\/orders\/([A-Z0-9]+)$/);
    if (m) return w.commandes[m[1]] ? rep(200, w.commandes[m[1]]) : rep(404, {});
    m = u.match(/\/v2\/payments\/captures\/([A-Z0-9]+)$/);
    if (m) return w.captures[m[1]] ? rep(200, w.captures[m[1]]) : rep(404, {});
    return F.fetchImpl(url, init);
  };
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl });
  const M = creerMetier({ db, vapid: VAPID, fetchImpl, maintenant: () => w.t });
  const env = { PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'sec', PAYPAL_WEBHOOK_ID: 'wh', COACHING_VENTE: opt.ferme ? 'non' : '' };
  w.ctx = { db, M, env, fetchImpl, maintenant: () => w.t };
  M.paypal = creerPaypal(w.ctx);
  w.appel = (email, data) => M.paypal.appelCoaching({ auth: { email: email.replace(/,/g, '.') }, data });
  w.acheter = async (formule, extra) => {
    const r = await w.appel(LEA, Object.assign({ formule, executionImmediate: true, entree: 'carte' }, extra || {}));
    return { r, c: await w.appel(LEA, { action: 'capturer', commande: r.commande }) };
  };
  let nwh = 0;
  w.webhook = async (type, ress) => {
    const e = { id: 'WH-' + (++nwh), event_type: type, resource: ress, create_time: new Date(w.t).toISOString() };
    const r = await recevoirWebhook(new Request('https://s.t/paypal', { method: 'POST', body: JSON.stringify(e) }), w.ctx);
    return { status: r.status, texte: await r.text() };
  };
  return w;
}
const BASE = () => ({
  users: { [KEV]: { role: 'coach', id: 'u_kev', fname: 'Kevin', lname: 'Guellec' },
    [LEA]: { role: 'athlete', id: 'u_lea', fname: 'Léa', origine: { src: 'tiktok', inscritLe: T0 - 40 * J } },
    [AUTRE]: { role: 'coach', id: 'u_aut' } },
});
const AMB = () => Object.assign(BASE(), {
  ambassadeurs_liens: { [LEA]: { code: 'LEAFIT', id: 'fx', le: T0 - 40 * J } },
  ambassadeurs: { LEAFIT: { nom: 'Léa Fit', actif: true, filleuls: { fx: { inscritLe: T0 - 40 * J } } } },
});
const coms = (w) => Object.values(w.F.lire('ambassadeurs/LEAFIT/commissions') || {}).flatMap((m) => Object.values(m));

// ── PURES ─────────────────────────────────────────────────────────────────
test('les cinq formules, leur famille et leur prix viennent de tarifs.json', () => {
  for (const f of CK.FORMULES_KEVIN) assert.equal(CK.prixCoaching(f), Math.round(T.coaching[f].prix * 100), f);
  assert.deepEqual([...CK.FAMILLES.suivi], ['coaching_essentiel', 'coaching_transfo', 'coaching_evolution']);
  assert.deepEqual([...CK.FAMILLES.sans_suivi], ['programme_perso', 'revision_prog']);
  assert.equal(CK.prixCoaching('coaching_essentiel'), 15000);
  assert.equal(CK.prixCoaching('coaching_evolution'), 60000);
  assert.equal(CK.prixCoaching('revision_prog'), 4000);
  assert.equal(CK.prixCoaching('boutique_prog'), null, 'la boutique ne passe pas ici');
  assert.equal(CK.prixCoaching('essentielle'), null);
});

test('la commande : aucun bénéficiaire, le prix de tarifs.json, un custom_id à quatre segments', () => {
  const c = CK.corpsCommandeCoaching({ athlete: LEA, formule: 'coaching_transfo', entree: 'carte', retour: 'r', annulation: 'a' });
  const pu = c.purchase_units[0];
  assert.equal(pu.payee, undefined);
  assert.deepEqual(pu.amount, { currency_code: 'EUR', value: '350.00' });
  assert.equal(pu.custom_id, 'ck|' + LEA + '|coaching_transfo|carte');
  assert.deepEqual(CK.lireCustomIdCoaching(pu.custom_id), { athlete: LEA, formule: 'coaching_transfo', entree: 'carte' });
  // Un custom_id d'abonnement, de programme ou de paiement au coach n'est pas lu ici.
  for (const x of [LEA, LEA + '|prog1', KEV + '|' + LEA + '|coaching_transfo', 'ck|' + LEA + '|boutique_prog|carte', 'ck|a/b|coaching_transfo|carte', 'xx|' + LEA + '|revision_prog|carte'])
    assert.equal(CK.lireCustomIdCoaching(x), null, x);
  assert.equal(CK.lireCustomIdCoaching('ck|' + LEA + '|revision_prog|<script>').entree, 'ecran', 'une entrée inconnue devient « ecran »');
});

test('LE CONTRÔLE DU MONTANT : au centime, en euros, sur la commande ET la capture, sans autre bénéficiaire', () => {
  const pu = (v, cur) => ({ amount: { currency_code: cur || 'EUR', value: v } });
  const cap = (v, cur) => ({ amount: { currency_code: cur || 'EUR', value: v } });
  assert.equal(CK.montantConforme(pu('150.00'), cap('150.00'), 'coaching_essentiel'), true);
  assert.equal(CK.montantConforme(pu('150'), cap('150.0'), 'coaching_essentiel'), true);
  assert.equal(CK.montantConforme(pu('1.50'), cap('1.50'), 'coaching_essentiel'), false, 'montant changé partout');
  assert.equal(CK.montantConforme(pu('150.00'), cap('149.99'), 'coaching_essentiel'), false, 'capture inférieure');
  assert.equal(CK.montantConforme(pu('150.00'), cap('150.00', 'USD'), 'coaching_essentiel'), false, 'devise');
  assert.equal(CK.montantConforme(pu('350.00'), cap('350.00'), 'coaching_essentiel'), false, 'le prix d’une autre formule');
  assert.equal(CK.montantConforme(Object.assign(pu('150.00'), { payee: { merchant_id: 'ABCDEFGH12345' } }), cap('150.00'), 'coaching_essentiel'), false, 'payé à un autre');
  assert.equal(CK.montantConforme(pu('40.00'), cap('40.00'), 'boutique_prog'), false);
});

test('l’attribution : la source d’arrivée et le code ambassadeur du lien serveur', () => {
  assert.deepEqual(CK.attributionAchat({ src: 'tiktok' }, null), { src: 'tiktok', amb: null });
  assert.deepEqual(CK.attributionAchat({ src: 'tiktok', amb: 'AUTRE1' }, { code: 'LEAFIT' }), { src: 'tiktok', amb: 'LEAFIT' });
  assert.deepEqual(CK.attributionAchat({}, { code: 'LEAFIT' }), { src: 'amb', amb: 'LEAFIT' });
  assert.deepEqual(CK.attributionAchat(null, null), { src: 'direct', amb: null });
  assert.deepEqual(CK.attributionAchat({ src: 'x/../y', amb: 'pas un code!' }, null).amb, null);
});

test('le lien à Kevin : jamais par-dessus un autre coach ; le statut de suivi pour la famille « avec suivi »', () => {
  const k = { id: 'u_kev', fname: 'Kevin', lname: 'Guellec' };
  assert.deepEqual(CK.lienCoachMaj(LEA, { coachEmailKey: AUTRE }, k, 'coaching_essentiel', T0), { refus: 'autre_coach' });
  const s = CK.lienCoachMaj(LEA, {}, k, 'coaching_essentiel', T0).maj;
  assert.equal(s['users/' + LEA + '/coachEmailKey'], KEV);
  assert.equal(s['users/' + LEA + '/coachId'], 'u_kev');
  assert.equal(s['users/' + LEA + '/coachName'], 'Kevin Guellec');
  assert.equal(s['users/' + LEA + '/status'], 'COACHING_SUIVI');
  assert.equal(s['coachs/' + KEV + '/clients/' + LEA], true);
  assert.deepEqual(s['annuaire_coach/' + KEV + '/' + LEA], { email: 'lea@t.fr', maj: T0 });
  const p = CK.lienCoachMaj(LEA, { coachEmailKey: KEV }, k, 'programme_perso', T0).maj;
  assert.equal(p['users/' + LEA + '/status'], undefined, 'sans suivi : le statut ne change pas');
  assert.equal(p['users/' + LEA + '/coachEmailKey'], KEV);
});

// ── LE PARCOURS ───────────────────────────────────────────────────────────
test('la commande est refusée sans la case de démarrage immédiat, pour un coach, ou un athlète d’un autre coach', async () => {
  const b = BASE();
  b.users['suivi@t,fr'] = { role: 'athlete', coachEmailKey: AUTRE };
  const w = monde(b);
  await assert.rejects(w.appel(LEA, { formule: 'coaching_essentiel' }), /démarrage immédiat/);
  await assert.rejects(w.appel(LEA, { formule: 'boutique_prog', executionImmediate: true }), /n’existe pas/);
  await assert.rejects(w.appel(AUTRE, { formule: 'coaching_essentiel', executionImmediate: true }), /compte coach/);
  await assert.rejects(w.appel('suivi@t,fr', { formule: 'coaching_essentiel', executionImmediate: true }), /autre coach/);
  await assert.rejects(w.appel(KEV, { formule: 'coaching_essentiel', executionImmediate: true }), /ta propre formule/);
  assert.equal(w.crees.length, 0, 'aucune commande créée chez PayPal');
  const f = monde(BASE(), { ferme: true });
  await assert.rejects(f.appel(LEA, { formule: 'coaching_essentiel', executionImmediate: true }), /fermé/);
});

test('le montant envoyé par l’app est ignoré : la commande porte le prix de tarifs.json', async () => {
  const w = monde(BASE());
  const r = await w.appel(LEA, { formule: 'coaching_evolution', executionImmediate: true, montant: 1, prix: '1.00', entree: 'accueil' });
  assert.match(r.lien, /checkoutnow\?token=ORD/);
  assert.deepEqual(w.crees[0].purchase_units[0].amount, { currency_code: 'EUR', value: '600.00' });
  const a = w.F.lire('coaching_achats/' + r.commande);
  assert.equal(a.statut, 'en_attente');
  assert.equal(a.montant, 60000);
  assert.equal(a.entree, 'accueil');
  assert.equal(a.executionImmediate, T0);
});

test('payé : le suivi s’ouvre pour la durée de la formule, Léa est reliée à Kevin, l’achat est attribué', async () => {
  const w = monde(BASE());
  const { r, c } = await w.acheter('coaching_transfo');
  assert.equal(c.statut, 'recu');
  assert.equal(c.lien, 'kevin');
  assert.deepEqual(c.coach, { coachEmailKey: KEV, coachId: 'u_kev', coachName: 'Kevin Guellec' });
  assert.equal(w.F.lire('droits/' + LEA + '/suiviJusqu'), T0 + 3 * 30 * J);
  const u = w.F.lire('users/' + LEA);
  assert.equal(u.coachEmailKey, KEV);
  assert.equal(u.coachId, 'u_kev');
  assert.equal(u.status, 'COACHING_SUIVI');
  assert.deepEqual(u.coachingAchat, { formule: 'coaching_transfo', commande: r.commande, le: T0, famille: 'suivi' });
  assert.equal(u.updatedAt, T0, 'updatedAt : l’app redescend le dossier');
  assert.equal(w.F.lire('coachs/' + KEV + '/clients/' + LEA), true);
  const a = w.F.lire('coaching_achats/' + r.commande);
  assert.equal(a.statut, 'recu');
  assert.equal(a.src, 'tiktok');
  assert.equal(a.entree, 'carte');
  assert.ok(a.amb == null, 'pas d’ambassadeur');
  const s = w.F.lire('stats/coaching/2026-10');
  assert.deepEqual(s, { ventes: { coaching_transfo: 1 }, ca: 35000, src: { tiktok: 1 }, entree: { carte: 1 } });
  assert.equal(w.F.lire('paypal_transactions/CAP' + r.commande).type, 'coaching');
});

test('capturé deux fois (l’app puis le webhook) : rien n’est ouvert ni compté deux fois', async () => {
  const w = monde(BASE());
  const { r } = await w.acheter('coaching_essentiel');
  assert.equal((await w.appel(LEA, { action: 'capturer', commande: r.commande })).statut, 'deja');
  const wh = await w.webhook('PAYMENT.CAPTURE.COMPLETED', w.captures['CAP' + r.commande]);
  assert.equal(wh.status, 200);
  assert.equal(wh.texte, 'coaching_deja');
  assert.equal(w.F.lire('droits/' + LEA + '/suiviJusqu'), T0 + 30 * J);
  assert.equal(w.F.lire('stats/coaching/2026-10/ventes/coaching_essentiel'), 1);
});

test('le webhook seul suffit, si l’athlète ne revient pas dans l’app', async () => {
  const w = monde(BASE());
  const r = await w.appel(LEA, { formule: 'programme_perso', executionImmediate: true });
  // La capture faite par PayPal, sans passer par l'app :
  const cmd = w.commandes[r.commande];
  const cap = { id: 'CAPX' + r.commande, status: 'COMPLETED', amount: Object.assign({}, cmd.purchase_units[0].amount),
    supplementary_data: { related_ids: { order_id: r.commande } } };
  cmd.purchase_units[0].payments = { captures: [cap] };
  const wh = await w.webhook('PAYMENT.CAPTURE.COMPLETED', cap);
  assert.equal(wh.texte, 'coaching');
  assert.equal(w.F.lire('droits/' + LEA + '/ultimeJusqu'), T0 + 3 * 30 * J, 'sans suivi : Ultime pour les mois inclus');
  assert.equal(w.F.lire('droits/' + LEA + '/suiviJusqu'), null);
  assert.equal(w.F.lire('users/' + LEA + '/status'), null, 'pas de statut de suivi');
  assert.equal(w.F.lire('users/' + LEA + '/coachEmailKey'), KEV);
});

test('UN MONTANT ALTÉRÉ chez PayPal est refusé : aucun droit, aucun lien, Kevin est prévenu', async () => {
  const w = monde(BASE(), { alterer: '1.50' });
  const { r, c } = await w.acheter('coaching_essentiel');
  assert.equal(c.statut, 'refuse');
  assert.equal(w.F.lire('coaching_achats/' + r.commande).statut, 'annule');
  assert.equal(w.F.lire('coaching_achats/' + r.commande).raison, 'controle');
  assert.equal(w.F.lire('droits/' + LEA), null);
  assert.ok(w.F.lire('users/' + LEA + '/coachEmailKey') == null);
  assert.equal(w.F.lire('stats/coaching'), null);
});

test('la commande d’un autre compte ne se capture pas', async () => {
  const b = BASE(); b.users['bob@t,fr'] = { role: 'athlete' };
  const w = monde(b);
  const r = await w.appel(LEA, { formule: 'coaching_essentiel', executionImmediate: true });
  await assert.rejects(w.appel('bob@t,fr', { action: 'capturer', commande: r.commande }), /pas la tienne/);
});

test('ATTRIBUTION ET COMMISSION : le code ambassadeur est sur l’achat ; 20 % sur chaque achat des 12 mois', async () => {
  const w = monde(AMB());
  const { r } = await w.acheter('coaching_transfo');
  const a = w.F.lire('coaching_achats/' + r.commande);
  assert.equal(a.amb, 'LEAFIT');
  assert.equal(a.src, 'tiktok');
  assert.equal(w.F.lire('stats/coaching/2026-10/amb/LEAFIT'), 1);
  let l = coms(w);
  assert.equal(l.length, 1);
  assert.equal(l[0].pct, 20);
  assert.equal(l[0].commission, 70, '20 % de 350 €');
  // Un second achat (pas le premier paiement du compte) : sa propre commission.
  w.t = T0 + 40 * J;
  await w.acheter('revision_prog');
  l = coms(w);
  assert.equal(l.length, 2);
  assert.deepEqual(l.map((x) => x.commission).sort((x, y) => x - y), [8, 70]);
  // Au-delà de 12 mois après le premier paiement : plus de commission.
  w.t = T0 + 400 * J;
  await w.acheter('revision_prog');
  assert.equal(coms(w).length, 2);
});

test('REMBOURSÉ : la durée payée est retirée, la commission annulée, l’achat marqué', async () => {
  const w = monde(AMB());
  const { r } = await w.acheter('coaching_transfo');
  w.t = T0 + 5 * J;
  const cap = 'CAP' + r.commande;
  const wh = await w.webhook('PAYMENT.CAPTURE.REFUNDED', { id: 'REFUND00001', amount: { value: '350.00', currency_code: 'EUR' },
    links: [{ rel: 'up', href: 'https://api-m.paypal.com/v2/payments/captures/' + cap }] });
  assert.equal(wh.status, 200);
  assert.equal(w.F.lire('coaching_achats/' + r.commande).statut, 'rembourse');
  assert.equal(w.F.lire('droits/' + LEA + '/suiviJusqu'), T0 + 5 * J, 'ramené à maintenant');
  assert.equal(coms(w)[0].statut, 'annulee');
  const j = Object.values(w.F.lire('paypal_journal'))[0];
  assert.ok(j.actions.some((x) => /coaching coaching_transfo/.test(x)), JSON.stringify(j.actions));
  assert.ok(w.F.lire('users/' + LEA + '/abonnement') == null, 'aucun abonnement touché');
});
