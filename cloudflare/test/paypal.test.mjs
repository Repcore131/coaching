// PayPal écouté par le serveur léger, sur une base en mémoire et un faux PayPal.
//   node cloudflare/test/paypal.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { creerBase } from '../src/base.js';
import { creerMetier } from '../src/metier.js';
import { creerPaypal, recevoirWebhook } from '../src/paypal.js';
import { fausseBase } from './fausse-base.mjs';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const T0 = Date.parse('2026-10-05T12:00:00+02:00');
const MOIS = 30 * 864e5;

function monde(initial, o) {
  const F = fausseBase(initial);
  const opt = o || {};
  const verifs = [];
  const fetchImpl = async (url, init) => {
    const u = String(url);
    if (u.endsWith('/v1/oauth2/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'tok' }) };
    if (u.endsWith('/v1/notifications/verify-webhook-signature')) {
      verifs.push(init.body);
      return { ok: true, status: 200, json: async () => ({ verification_status: opt.signature === false ? 'FAILURE' : 'SUCCESS' }) };
    }
    const m = u.match(/\/v1\/billing\/subscriptions\/(I-[A-Z0-9]+)$/);
    if (m) {
      const s = (opt.abonnements || {})[m[1]];
      return s ? { ok: true, status: 200, json: async () => s } : { ok: false, status: 404, json: async () => ({}) };
    }
    return F.fetchImpl(url, init);
  };
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl });
  const M = creerMetier({ db, vapid: VAPID, fetchImpl, maintenant: () => T0 });
  const env = { PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'sec', PAYPAL_WEBHOOK_ID: 'wh' };
  const ctx = { db, M, env, fetchImpl, maintenant: () => T0 };
  return { F, db, M, ctx, PP: creerPaypal(ctx), verifs };
}
const evt = (type, ress, id) => ({ id: id || ('WH-' + Math.random().toString(36).slice(2)), event_type: type, resource: ress });
const post = (e, h) => new Request('https://s.t/paypal', { method: 'POST', headers: Object.assign({ 'paypal-transmission-id': 't1' }, h), body: JSON.stringify(e) });

await test('signature refusée par PayPal : 401, rien n’est écrit', async () => {
  const w = monde({ users: { 'lea@t,fr': { role: 'athlete', status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active' } }, paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' } },
    { signature: false });
  const r = await recevoirWebhook(post(evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-ABC12345678' })), w.ctx);
  assert.equal(r.status, 401);
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), null);
});

await test('la vérification envoie le corps BRUT reçu, pas une copie re-sérialisée', async () => {
  const w = monde({});
  const brut = '{"id":"WH-1","event_type":"X",  "resource":{"montant":"12.50"}}';
  await recevoirWebhook(new Request('https://s.t/paypal', { method: 'POST', body: brut }), w.ctx);
  assert.ok(w.verifs[0].endsWith(',"webhook_event":' + brut + '}'));
});

await test('résiliation d’un abonné : l’accès court jusqu’à la fin payée, plus la réserve, sans couper', async () => {
  const w = monde({ users: { 'lea@t,fr': { role: 'athlete', status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active' } },
    paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' }, parrainage: { comptes: { 'lea@t,fr': { moisEnReserve: 2 } } } },
    { abonnements: { 'I-ABC12345678': { billing_info: { next_billing_time: new Date(T0 + 10 * 864e5).toISOString() } } } });
  const r = await recevoirWebhook(post(evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-ABC12345678' })), w.ctx);
  assert.equal(await r.text(), 'fin_posee');
  assert.equal(w.F.lire('users/lea@t,fr/paymentStatus'), 'active', 'jamais coupé le jour même');
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), T0 + 10 * 864e5 + 2 * MOIS);
  assert.equal(w.F.lire('parrainage/comptes/lea@t,fr/moisEnReserve'), 0);
});

await test('un paiement après un impayé rouvre l’accès', async () => {
  const w = monde({ users: { 'lea@t,fr': { role: 'athlete', status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active', accessExpiry: T0 + 864e5,
    abonnement: { finAccesPaypal: T0 + 864e5 } } }, paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' }, paypal_premiers: { 'lea@t,fr': { le: 1 } } });
  const r = await recevoirWebhook(post(evt('PAYMENT.SALE.COMPLETED', { id: 'S1', billing_agreement_id: 'I-ABC12345678', amount: { total: '24.90' } })), w.ctx);
  assert.equal(await r.text(), 'paiement');
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), null);
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/finAccesPaypal'), null);
});

await test('premier paiement d’un filleul : le parrain sans accès reçoit un mois d’Essentielle', async () => {
  const w = monde({ users: { 'jul@t,fr': { role: 'athlete', fname: 'Julie' }, 'kev@t,fr': { role: 'athlete', status: 'FREE' } },
    paypal_abonnes: { 'I-ABC12345678': 'jul@t,fr' },
    parrainage: { liens: { 'jul@t,fr': { parrain: 'kev@t,fr', id: 'f1' } }, comptes: { 'kev@t,fr': { filleuls: { f1: { statut: 'inscrit', prenom: 'Julie' } } } } } });
  const r = await recevoirWebhook(post(evt('PAYMENT.SALE.COMPLETED', { id: 'S1', billing_agreement_id: 'I-ABC12345678', amount: { total: '24.90' } })), w.ctx);
  assert.equal(await r.text(), 'premier_paiement');
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/filleuls/f1/statut'), 'payant');
  assert.equal(w.F.lire('users/kev@t,fr/status'), 'AUTONOMIE_PREMIUM');
  assert.equal(w.F.lire('users/kev@t,fr/accessExpiry'), T0 + MOIS);
  assert.equal(w.F.lire('droits'), null, 'toujours rien dans droits/');
  // Un second paiement ne recrédite rien.
  await recevoirWebhook(post(evt('PAYMENT.SALE.COMPLETED', { id: 'S2', billing_agreement_id: 'I-ABC12345678', amount: { total: '24.90' } })), w.ctx);
  assert.equal(w.F.lire('users/kev@t,fr/accessExpiry'), T0 + MOIS);
});

await test('parrain abonné ou avec un programme Ultime : le mois va en réserve, rien ne descend', async () => {
  for (const u of [{ status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active' }, { status: 'FREE', programmesAchetes: { p: { ouvertJusqu: T0 + 90 * 864e5 } } },
    { status: 'COACHING_SUIVI' }]) {
    const w = monde({ users: { 'kev@t,fr': Object.assign({ role: 'athlete' }, u) } });
    assert.equal(await w.M.crediterMoisOffert('kev@t,fr', T0), 'reserve');
    assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/moisEnReserve'), 1);
    assert.equal(w.F.lire('users/kev@t,fr/status'), u.status);
  }
  // Un abonné qui a résilié : sa fin recule d'un mois.
  const w = monde({ users: { 'kev@t,fr': { role: 'athlete', status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active', accessExpiry: T0 + 5 * 864e5 } } });
  assert.equal(await w.M.crediterMoisOffert('kev@t,fr', T0), 'fin_reculee');
  assert.equal(w.F.lire('users/kev@t,fr/accessExpiry'), T0 + 5 * 864e5 + MOIS);
});

await test('coach qui résilie : noté, puis son palier se referme à la date', async () => {
  const fin = T0 + 3 * 864e5;
  const w = monde({ users: { 'co@t,fr': { role: 'coach', coachPlan: 'pro', coachSubActive: true } }, paypal_abonnes: { 'I-COA12345678': 'co@t,fr' } },
    { abonnements: { 'I-COA12345678': { billing_info: { next_billing_time: new Date(fin).toISOString() } } } });
  await recevoirWebhook(post(evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-COA12345678' })), w.ctx);
  assert.equal(w.F.lire('paypal_fins/co@t,fr').fin, fin);
  assert.equal(w.F.lire('users/co@t,fr/coachSubActive'), true, 'pas avant la date');
  await w.PP.finsCoachs();
  assert.equal(w.F.lire('users/co@t,fr/coachSubActive'), true);
  const w2 = monde(w.F.arbre); w2.ctx.maintenant = () => fin + 1;
  await creerPaypal(Object.assign({}, w2.ctx, { maintenant: () => fin + 1 })).finsCoachs();
  assert.equal(w2.F.lire('users/co@t,fr/coachSubActive'), false);
  assert.equal(w2.F.lire('users/co@t,fr/coachPlan'), 'libre');
});

await test('un événement renvoyé par PayPal n’est traité qu’une fois', async () => {
  const w = monde({ users: { 'lea@t,fr': { role: 'athlete', status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active' } }, paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' } },
    { abonnements: { 'I-ABC12345678': { billing_info: { next_billing_time: new Date(T0 + 864e5).toISOString() } } } });
  const e = evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-ABC12345678' }, 'WH-UNIQUE');
  assert.equal(await (await recevoirWebhook(post(e), w.ctx)).text(), 'fin_posee');
  assert.equal(await (await recevoirWebhook(post(e), w.ctx)).text(), 'déjà traité');
});

await test('l’index abonnement → compte : vérifié chez PayPal, jamais volé à un autre', async () => {
  const w = monde({ paypal_abonnes: { 'I-PRIS1234567': 'autre@t,fr' } }, { abonnements: { 'I-ABC12345678': { status: 'ACTIVE' } } });
  assert.equal(await w.PP.indexer('lea@t,fr', 'I-ABC12345678'), 'indexe');
  assert.equal(w.F.lire('paypal_abonnes/I-ABC12345678'), 'lea@t,fr');
  assert.equal(await w.PP.indexer('lea@t,fr', 'I-PRIS1234567'), 'deja_a_un_autre');
  assert.equal(await w.PP.indexer('lea@t,fr', 'I-INCONNU1234'), 'introuvable');
});

await test('un achat ponctuel (programme) récompense le parrain sans toucher à l’abonnement', async () => {
  const w = monde({ users: { 'jul@t,fr': { role: 'athlete' }, 'kev@t,fr': { role: 'athlete', status: 'FREE' } },
    parrainage: { liens: { 'jul@t,fr': { parrain: 'kev@t,fr', id: 'f1' } }, comptes: { 'kev@t,fr': { filleuls: { f1: { statut: 'inscrit' } } } } } });
  const r = await recevoirWebhook(post(evt('PAYMENT.CAPTURE.COMPLETED', { id: 'C1', amount: { value: '14.90' }, payer: { email_address: 'jul@t.fr' } })), w.ctx);
  assert.equal(await r.text(), 'premier_paiement');
  assert.equal(w.F.lire('users/jul@t,fr/abonnement'), null, 'aucun abonnement inventé');
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/filleuls/f1/statut'), 'payant');
});

console.log(ok + ' tests passés');
