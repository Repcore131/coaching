// PayPal écouté par le serveur léger, sur une base en mémoire et un faux PayPal.
//   node cloudflare/test/paypal.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { creerBase } from '../src/base.js';
import { creerMetier } from '../src/metier.js';
import { creerPaypal, recevoirWebhook, jetonPaypal, oublierJetonPaypal, OFFRES_PAYPAL, PLANS_ANNUELS_SANS_ENGAGEMENT } from '../src/paypal.js';
import { fausseBase } from './fausse-base.mjs';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const T0 = Date.parse('2026-10-05T12:00:00+02:00');
const MOIS = 30 * 864e5;
const J = 864e5;
const ESS = 'P-95N51603RD882780YNJKS2QA', ULT = 'P-2W777608239063532NK2LZXA', PRO = 'P-1WS20264K4576284KNK2RF5Y';
const iso = (t) => new Date(t).toISOString();

// Un faux PayPal : abonnements et commandes modifiables en cours de test,
// pannes à la demande (`w.panne = n` : les n prochaines lectures rendent 500).
function monde(initial, o) {
  const F = fausseBase(initial);
  const opt = o || {};
  const w = { F, verifs: [], oauth: 0, panne: 0, abos: opt.abonnements || {}, commandes: opt.commandes || {}, t: T0 };
  const fetchImpl = async (url, init) => {
    const u = String(url);
    if (u.endsWith('/v1/oauth2/token')) { w.oauth++; return { ok: true, status: 200, json: async () => ({ access_token: 'tok', expires_in: 32400 }) }; }
    if (u.endsWith('/v1/notifications/verify-webhook-signature')) {
      w.verifs.push(init.body);
      return { ok: true, status: 200, json: async () => ({ verification_status: opt.signature === false ? 'FAILURE' : 'SUCCESS' }) };
    }
    const m = u.match(/\/v1\/billing\/subscriptions\/(I-[A-Z0-9]+)$/) || u.match(/\/v2\/checkout\/orders\/([A-Z0-9]+)$/);
    if (m) {
      if (w.panne > 0) { w.panne--; return { ok: false, status: 500, json: async () => ({}) }; }
      const s = (u.indexOf('/orders/') > 0 ? w.commandes : w.abos)[m[1]];
      return s ? { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(s)) } : { ok: false, status: 404, json: async () => ({}) };
    }
    return F.fetchImpl(url, init);
  };
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl });
  const M = creerMetier({ db, vapid: VAPID, fetchImpl, maintenant: () => w.t });
  const env = { PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'sec', PAYPAL_WEBHOOK_ID: 'wh' };
  w.M = M;
  w.ctx = { db, M, env, fetchImpl, maintenant: () => w.t };
  w.PP = creerPaypal(w.ctx);
  w.envoyer = async (e) => { const r = await recevoirWebhook(post(e), w.ctx); return { status: r.status, texte: await r.text() }; };
  return w;
}
let n = 0;
const evt = (type, ress, id) => ({ id: id || ('WH-' + (++n)), event_type: type, resource: ress, create_time: iso(T0 + n * 1000) });
const post = (e) => new Request('https://s.t/paypal', { method: 'POST', headers: { 'paypal-transmission-id': 't1' }, body: JSON.stringify(e) });
const vente = (abo, montant, id) => ({ id: id || 'S' + (++n), billing_agreement_id: abo, amount: { total: montant, currency: 'EUR' } });
const abo = (o) => Object.assign({ status: 'ACTIVE', plan_id: ESS, billing_info: { next_billing_time: iso(T0 + 10 * J) } }, o);
const LEA = (u) => ({ 'lea@t,fr': Object.assign({ role: 'athlete', status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active', paypalSubscriptionId: 'I-ABC12345678' }, u) });

await test('signature refusée par PayPal : 401, rien n’est écrit', async () => {
  const w = monde({ users: LEA(), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' } }, { signature: false });
  assert.equal((await w.envoyer(evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-ABC12345678' }))).status, 401);
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), null);
  assert.equal(w.F.lire('paypal_evenements'), null);
});

await test('la vérification envoie le corps BRUT reçu, pas une copie re-sérialisée', async () => {
  const w = monde({});
  const brut = '{"id":"WH-1","event_type":"X",  "resource":{"montant":"12.50"}}';
  await recevoirWebhook(new Request('https://s.t/paypal', { method: 'POST', body: brut }), w.ctx);
  assert.ok(w.verifs[0].endsWith(',"webhook_event":' + brut + '}'));
});

await test('double envoi : traité une fois, noté « fait » seulement après le succès', async () => {
  const w = monde({ users: LEA(), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' } }, { abonnements: { 'I-ABC12345678': abo() } });
  const e = evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-ABC12345678' }, 'WH-UNIQUE');
  assert.deepEqual(await w.envoyer(e), { status: 200, texte: 'fin_posee' });
  assert.equal(w.F.lire('paypal_evenements/WH-UNIQUE/etat'), 'fait');
  assert.deepEqual(await w.envoyer(e), { status: 200, texte: 'déjà traité' });
  // L'ancien format ({le, type}, sans état) vaut « fait ».
  w.F.ecrire('paypal_evenements/WH-VIEUX', { le: 1, type: 'X' });
  assert.equal((await w.envoyer(evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-ABC12345678' }, 'WH-VIEUX'))).texte, 'déjà traité');
});

await test('erreur puis renvoi : 500, état « erreur », puis le renvoi de PayPal est traité', async () => {
  const w = monde({ users: LEA(), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' } }, { abonnements: { 'I-ABC12345678': abo() } });
  const e = evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-ABC12345678' }, 'WH-PANNE');
  w.panne = 1;                                   // PayPal ne répond pas à la lecture de l'abonnement
  assert.equal((await w.envoyer(e)).status, 500);
  assert.equal(w.F.lire('paypal_evenements/WH-PANNE/etat'), 'erreur');
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/finAccesPaypal'), null, 'rien d’écrit à moitié');
  assert.deepEqual(await w.envoyer(e), { status: 200, texte: 'fin_posee' });
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/finAccesPaypal'), T0 + 10 * J);
});

await test('« en_cours » : un renvoi pendant le traitement attend (503) ; au-delà de dix minutes, il est repris', async () => {
  const w = monde({ users: LEA(), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' },
    paypal_evenements: { 'WH-EC': { etat: 'en_cours', at: T0 - 60e3 } } }, { abonnements: { 'I-ABC12345678': abo() } });
  const e = evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-ABC12345678' }, 'WH-EC');
  assert.equal((await w.envoyer(e)).status, 503);
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/finAccesPaypal'), null);
  w.t = T0 + 11 * 60e3;                          // le worker est mort en route il y a onze minutes
  assert.deepEqual(await w.envoyer(e), { status: 200, texte: 'fin_posee' });
  assert.equal(w.F.lire('paypal_evenements/WH-EC/etat'), 'fait');
});

await test('orphelin rangé puis rejoué par indexer() : rien n’est perdu', async () => {
  // Un abonnement d'avant custom_id, pas encore signalé par l'app.
  const w = monde({ users: LEA({ status: 'FREE', paymentStatus: null }) },
    { abonnements: { 'I-ABC12345678': abo({ subscriber: { email_address: 'Lea@t.fr' } }) } });
  const r = await w.envoyer(evt('PAYMENT.SALE.COMPLETED', vente('I-ABC12345678', '9.50', 'S-ORPH')));
  assert.deepEqual(r, { status: 200, texte: 'orphelin' });
  assert.ok(w.F.lire('paypal_orphelins/I-ABC12345678'), 'rangé sous son abonnement');
  assert.equal(w.F.lire('paypal_premiers/lea@t,fr'), null);
  // L'app signale l'abonnement : le lien se fait, l'orphelin est rejoué.
  assert.equal(await w.PP.indexer('lea@t,fr', 'I-ABC12345678'), 'indexe');
  assert.equal(w.F.lire('paypal_orphelins'), null, 'la file des orphelins est vidée');
  assert.ok(w.F.lire('paypal_premiers/lea@t,fr'), 'le premier paiement est compté');
  assert.equal(w.F.lire('users/lea@t,fr/status'), 'AUTONOMIE_PREMIUM');
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/formule'), 'essentielle');
});

await test('orphelins rejoués DANS L’ORDRE quand un événement suivant fait le lien par custom_id', async () => {
  // Le dossier n'existe pas encore sur le serveur au premier paiement.
  const w = monde({}, { abonnements: { 'I-ABC12345678': abo({ custom_id: 'lea@t,fr' }) } });
  assert.equal((await w.envoyer(evt('PAYMENT.SALE.COMPLETED', vente('I-ABC12345678', '9.50')))).texte, 'orphelin');
  w.F.ecrire('users', LEA({ status: 'FREE' }));
  w.abos['I-ABC12345678'].status = 'CANCELLED';
  // L'annulation arrive : le paiement rangé passe d'abord, l'annulation ensuite.
  assert.equal((await w.envoyer(evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-ABC12345678' }))).texte, 'fin_posee');
  assert.equal(w.F.lire('paypal_abonnes/I-ABC12345678'), 'lea@t,fr');
  assert.equal(w.F.lire('paypal_orphelins'), null);
  assert.ok(w.F.lire('paypal_premiers/lea@t,fr'), 'le paiement rejoué compte');
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/finAccesPaypal'), T0 + 10 * J, 'et l’annulation, venue après, reste');
});

await test('liaison sûre : indexer() exige custom_id === compte, ou l’adresse de l’abonné pour les anciens', async () => {
  const w = monde({ paypal_abonnes: { 'I-PRIS1234567': 'autre@t,fr' } }, { abonnements: {
    'I-ABC12345678': abo({ custom_id: 'lea@t,fr' }), 'I-VOL12345678': abo({ custom_id: 'autre@t,fr' }),
    'I-OLD12345678': abo({ subscriber: { email_address: 'pirate@t.fr' } }) } });
  assert.equal(await w.PP.indexer('lea@t,fr', 'I-ABC12345678'), 'indexe');
  assert.equal(w.F.lire('paypal_abonnes/I-ABC12345678'), 'lea@t,fr');
  assert.equal(await w.PP.indexer('lea@t,fr', 'I-VOL12345678'), 'autre_compte');
  assert.equal(await w.PP.indexer('lea@t,fr', 'I-OLD12345678'), 'non_verifie');
  assert.equal(await w.PP.indexer('lea@t,fr', 'I-PRIS1234567'), 'deja_a_un_autre');
  assert.equal(await w.PP.indexer('lea@t,fr', 'I-INCONNU1234'), 'introuvable');
  assert.equal(w.F.lire('paypal_abonnes/I-VOL12345678'), null);
});

await test('l’adresse du payeur ne relie plus rien', async () => {
  const w = monde({ users: LEA({ paypalSubscriptionId: null }) }, { abonnements: { 'I-XYZ12345678': abo() } });
  const r = await w.envoyer(evt('PAYMENT.SALE.COMPLETED', Object.assign(vente('I-XYZ12345678', '9.50'), { payer: { email_address: 'lea@t.fr' } })));
  assert.equal(r.texte, 'orphelin');
  assert.equal(w.F.lire('paypal_abonnes/I-XYZ12345678'), null);
});

await test('résiliation : l’accès court jusqu’à la fin payée plus la réserve ; la réserve n’est consommée qu’à la fin', async () => {
  const w = monde({ users: LEA(), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' }, parrainage: { comptes: { 'lea@t,fr': { moisEnReserve: 2 } } } },
    { abonnements: { 'I-ABC12345678': abo() } });
  assert.equal((await w.envoyer(evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-ABC12345678' }))).texte, 'fin_posee');
  const fin = T0 + 10 * J + 2 * MOIS;
  assert.equal(w.F.lire('users/lea@t,fr/paymentStatus'), 'active', 'jamais coupé le jour même');
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), fin);
  assert.equal(w.F.lire('parrainage/comptes/lea@t,fr/moisEnReserve'), 2, 'gardée jusqu’à la fin effective');
  await w.PP.fins();
  assert.equal(w.F.lire('parrainage/comptes/lea@t,fr/moisEnReserve'), 2);
  w.t = fin + 1;
  await w.PP.fins();
  assert.equal(w.F.lire('parrainage/comptes/lea@t,fr/moisEnReserve'), 0);
  assert.equal(w.F.lire('paypal_fins/lea@t,fr'), null);
});

await test('suspension puis annulation avec mois en réserve : la fin ne recule pas, la réserve n’est comptée qu’une fois', async () => {
  const w = monde({ users: LEA(), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' }, parrainage: { comptes: { 'lea@t,fr': { moisEnReserve: 2 } } } },
    { abonnements: { 'I-ABC12345678': abo() } });
  await w.envoyer(evt('BILLING.SUBSCRIPTION.SUSPENDED', { id: 'I-ABC12345678' }));
  const fin = T0 + 10 * J + 2 * MOIS;
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), fin);
  // Suspendu puis annulé : PayPal ne donne plus de prochaine échéance.
  w.abos['I-ABC12345678'] = abo({ status: 'CANCELLED', billing_info: { last_payment: { time: iso(T0 - 20 * J) } } });
  w.t = T0 + J;
  await w.envoyer(evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-ABC12345678' }));
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), fin, 'la fin ne recule jamais');
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/statutPaypal'), 'CANCELLED');
  assert.equal(w.F.lire('paypal_fins/lea@t,fr/reserve'), 2);
  // Un mois gagné entre-temps s'ajoute à la fin ; seul ce qui était compté est consommé.
  assert.equal(await w.M.crediterMoisOffert('lea@t,fr', w.t), 'fin_reculee');
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), fin + MOIS);
  w.F.ecrire('parrainage/comptes/lea@t,fr/moisEnReserve', 3);
  w.t = fin + MOIS + 1;
  await w.PP.fins();
  assert.equal(w.F.lire('parrainage/comptes/lea@t,fr/moisEnReserve'), 1);
});

await test('suspension puis reprise : la réserve et le mois reculé restent acquis', async () => {
  const w = monde({ users: LEA(), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' }, paypal_premiers: { 'lea@t,fr': { le: 1 } },
    parrainage: { comptes: { 'lea@t,fr': { moisEnReserve: 2 } } } }, { abonnements: { 'I-ABC12345678': abo() } });
  await w.envoyer(evt('BILLING.SUBSCRIPTION.SUSPENDED', { id: 'I-ABC12345678' }));
  assert.equal(await w.M.crediterMoisOffert('lea@t,fr', T0), 'fin_reculee');
  assert.equal((await w.envoyer(evt('PAYMENT.SALE.COMPLETED', vente('I-ABC12345678', '9.50')))).texte, 'paiement');
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), null);
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/finAccesPaypal'), null);
  assert.equal(w.F.lire('paypal_fins/lea@t,fr'), null);
  assert.equal(w.F.lire('parrainage/comptes/lea@t,fr/moisEnReserve'), 3, 'deux en réserve, plus le mois qui avait reculé la fin');
});

await test('paiement après annulation : l’abonnement relu n’est plus ACTIVE, rien ne rouvre', async () => {
  const fin = T0 + 5 * J;
  const w = monde({ users: LEA({ accessExpiry: fin, abonnement: { finAccesPaypal: fin, statutPaypal: 'CANCELLED' } }),
    paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' }, paypal_premiers: { 'lea@t,fr': { le: 1 } } },
    { abonnements: { 'I-ABC12345678': abo({ status: 'CANCELLED' }) } });
  assert.equal((await w.envoyer(evt('PAYMENT.SALE.COMPLETED', vente('I-ABC12345678', '9.50')))).texte, 'paiement_sans_ouverture');
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), fin);
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/finAccesPaypal'), fin);
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/statutPaypal'), 'CANCELLED');
});

await test('un paiement sur un abonnement actif et courant rouvre l’accès après un impayé', async () => {
  const w = monde({ users: LEA({ accessExpiry: T0 + J, abonnement: { finAccesPaypal: T0 + J } }),
    paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' }, paypal_premiers: { 'lea@t,fr': { le: 1 } } }, { abonnements: { 'I-ABC12345678': abo() } });
  assert.equal((await w.envoyer(evt('PAYMENT.SALE.COMPLETED', vente('I-ABC12345678', '9.50')))).texte, 'paiement');
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), null);
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/finAccesPaypal'), null);
});

await test('le 1er mois d’Ultime à moitié prix : payé, il est marqué utilisé (une seule fois par compte)', async () => {
  const DEMI = 'P-57P40267XP026613FNK2LZXQ';
  assert.equal(OFFRES_PAYPAL[DEMI].demi, true);
  const w = monde({ users: LEA({}), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' } }, { abonnements: { 'I-ABC12345678': abo({ plan_id: DEMI }) } });
  assert.equal((await w.envoyer(evt('PAYMENT.SALE.COMPLETED', vente('I-ABC12345678', '12.45')))).texte, 'premier_paiement');
  assert.equal(w.F.lire('droits/lea@t,fr/demiPackUtilise'), true);
  assert.equal(w.F.lire('droits/lea@t,fr/palier'), 'ultime');
});

await test('ancien abonnement annulé : ignoré, l’accès du nouveau reste ouvert', async () => {
  const w = monde({ users: LEA({ paypalSubscriptionId: 'I-NEW12345678' }),
    paypal_abonnes: { 'I-OLD12345678': 'lea@t,fr', 'I-NEW12345678': 'lea@t,fr' }, paypal_premiers: { 'lea@t,fr': { le: 1 } } },
    { abonnements: { 'I-OLD12345678': abo({ status: 'CANCELLED' }), 'I-NEW12345678': abo() } });
  assert.equal((await w.envoyer(evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-OLD12345678' }))).texte, 'ancien_abonnement');
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), null);
  assert.equal(w.F.lire('users/lea@t,fr/abonnement'), null);
  assert.equal(w.F.lire('paypal_fins'), null);
  // Et un paiement tardif de l'ancien ne touche à rien non plus.
  w.abos['I-OLD12345678'].status = 'ACTIVE';
  assert.equal((await w.envoyer(evt('PAYMENT.SALE.COMPLETED', vente('I-OLD12345678', '9.50')))).texte, 'paiement_sans_ouverture');
  assert.equal((await w.envoyer(evt('BILLING.SUBSCRIPTION.ACTIVATED', abo({ id: 'I-OLD12345678' })))).texte, 'ancien_abonnement');
});

await test('coach qui résilie : noté, son palier se referme à la date', async () => {
  const fin = T0 + 3 * J;
  const w = monde({ users: { 'co@t,fr': { role: 'coach', coachPlan: 'pro', coachSubActive: true, paypalSubscriptionId: 'I-COA12345678' } },
    paypal_abonnes: { 'I-COA12345678': 'co@t,fr' } }, { abonnements: { 'I-COA12345678': abo({ plan_id: PRO, billing_info: { next_billing_time: iso(fin) } }) } });
  await w.envoyer(evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-COA12345678' }));
  assert.equal(w.F.lire('paypal_fins/co@t,fr').fin, fin);
  await w.PP.finsCoachs();
  assert.equal(w.F.lire('users/co@t,fr/coachSubActive'), true, 'pas avant la date');
  w.t = fin + 1;
  await w.PP.finsCoachs();
  assert.equal(w.F.lire('users/co@t,fr/coachSubActive'), false);
  assert.equal(w.F.lire('users/co@t,fr/coachPlan'), 'libre');
});

await test('coach qui repaie : son palier payé revient (coachPlan et coachSubActive)', async () => {
  const w = monde({ users: { 'co@t,fr': { role: 'coach', coachPlan: 'libre', coachSubActive: false, paypalSubscriptionId: 'I-COA12345678',
    abonnement: { finAccesPaypal: T0 - J } } }, paypal_abonnes: { 'I-COA12345678': 'co@t,fr' }, paypal_premiers: { 'co@t,fr': { le: 1 } } },
    { abonnements: { 'I-COA12345678': abo({ plan_id: PRO }) } });
  assert.equal((await w.envoyer(evt('PAYMENT.SALE.COMPLETED', vente('I-COA12345678', '39.00')))).texte, 'paiement');
  assert.equal(w.F.lire('users/co@t,fr/coachPlan'), 'pro');
  assert.equal(w.F.lire('users/co@t,fr/coachSubActive'), true);
  assert.equal(w.F.lire('users/co@t,fr/abonnement/finAccesPaypal'), null);
  assert.notEqual(w.F.lire('users/co@t,fr/status'), 'AUTONOMIE_PREMIUM', 'un coach ne devient pas abonné athlète');
});

await test('premier paiement d’un filleul : compté seulement si plan, montant et devise sont ceux des OFFRES', async () => {
  const base = () => ({ users: Object.assign(LEA({ status: 'FREE', fname: 'Julie' }), { 'kev@t,fr': { role: 'athlete', status: 'FREE' } }),
    paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' },
    parrainage: { liens: { 'lea@t,fr': { parrain: 'kev@t,fr', id: 'f1' } }, comptes: { 'kev@t,fr': { filleuls: { f1: { statut: 'inscrit', prenom: 'Julie' } } } } } });
  // Mauvais montant, puis mauvaise devise : payé, mais pas « premier paiement ».
  let w = monde(base(), { abonnements: { 'I-ABC12345678': abo({ plan_id: ULT }) } });
  assert.equal((await w.envoyer(evt('PAYMENT.SALE.COMPLETED', vente('I-ABC12345678', '0.01')))).texte, 'paiement');
  const usd = vente('I-ABC12345678', '24.90'); usd.amount.currency = 'USD';
  assert.equal((await w.envoyer(evt('PAYMENT.SALE.COMPLETED', usd))).texte, 'paiement');
  assert.equal(w.F.lire('paypal_premiers/lea@t,fr'), null);
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/filleuls/f1/statut'), 'inscrit');
  // Un plan inconnu de la table : pas compté non plus.
  w = monde(base(), { abonnements: { 'I-ABC12345678': abo({ plan_id: 'P-INCONNU' }) } });
  assert.equal((await w.envoyer(evt('PAYMENT.SALE.COMPLETED', vente('I-ABC12345678', '24.90')))).texte, 'paiement');
  assert.equal(w.F.lire('paypal_premiers/lea@t,fr'), null);
  // Le bon : Ultime à 24,90 €.
  w = monde(base(), { abonnements: { 'I-ABC12345678': abo({ plan_id: ULT }) } });
  assert.equal((await w.envoyer(evt('PAYMENT.SALE.COMPLETED', vente('I-ABC12345678', '24.90')))).texte, 'premier_paiement');
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/filleuls/f1/statut'), 'payant');
  assert.equal(w.F.lire('users/kev@t,fr/status'), 'AUTONOMIE_PREMIUM');
  assert.equal(w.F.lire('users/kev@t,fr/accessExpiry'), T0 + MOIS);
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/formule'), 'ultime');
  // droits/ porte désormais chaque accès : l'abonnée, et le mois offert au parrain.
  assert.deepEqual(Object.assign({}, w.F.lire('droits/lea@t,fr'), { maj: 0 }), { palier: 'ultime', echeance: 0, source: 'paypal', abo: 'I-ABC12345678', maj: 0 });
  assert.equal(w.F.lire('droits/kev@t,fr/palier'), 'essentielle');
  assert.equal(w.F.lire('droits/kev@t,fr/echeance'), T0 + MOIS);
  assert.equal(w.F.lire('droits/kev@t,fr/source'), 'parrainage');
  await w.envoyer(evt('PAYMENT.SALE.COMPLETED', vente('I-ABC12345678', '24.90')));
  assert.equal(w.F.lire('users/kev@t,fr/accessExpiry'), T0 + MOIS, 'un second paiement ne recrédite rien');
});

await test('crediterMoisOffert : « fin reculée » seulement sur une vraie fin PayPal', async () => {
  for (const u of [{ status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active' }, { status: 'FREE', programmesAchetes: { p: { ouvertJusqu: T0 + 90 * J } } },
    { status: 'COACHING_SUIVI' }]) {
    const w = monde({ users: { 'kev@t,fr': Object.assign({ role: 'athlete' }, u) } });
    assert.equal(await w.M.crediterMoisOffert('kev@t,fr', T0), 'reserve');
    assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/moisEnReserve'), 1);
    assert.equal(w.F.lire('users/kev@t,fr/status'), u.status);
  }
  // Une fin PayPal posée : elle recule d'un mois.
  let w = monde({ users: { 'kev@t,fr': { role: 'athlete', status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active', accessExpiry: T0 + 5 * J,
    abonnement: { finAccesPaypal: T0 + 5 * J } } }, paypal_fins: { 'kev@t,fr': { fin: T0 + 5 * J, role: 'athlete' } } });
  assert.equal(await w.M.crediterMoisOffert('kev@t,fr', T0), 'fin_reculee');
  assert.equal(w.F.lire('users/kev@t,fr/accessExpiry'), T0 + 5 * J + MOIS);
  assert.equal(w.F.lire('users/kev@t,fr/abonnement/finAccesPaypal'), T0 + 5 * J + MOIS);
  assert.equal(w.F.lire('paypal_fins/kev@t,fr/fin'), T0 + 5 * J + MOIS);
  // Un mois déjà offert (accessExpiry sans fin PayPal) : il s'allonge, sans inventer de fin PayPal.
  w = monde({ users: { 'kev@t,fr': { role: 'athlete', status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active', accessExpiry: T0 + 5 * J } } });
  assert.equal(await w.M.crediterMoisOffert('kev@t,fr', T0), 'acces_prolonge');
  assert.equal(w.F.lire('users/kev@t,fr/accessExpiry'), T0 + 5 * J + MOIS);
  assert.equal(w.F.lire('users/kev@t,fr/abonnement'), null);
});

await test('achat d’un programme : compte lu dans la commande relue chez PayPal, prix de la boutique vérifié', async () => {
  const base = () => ({ users: { 'jul@t,fr': { role: 'athlete' }, 'kev@t,fr': { role: 'athlete', status: 'FREE' } },
    boutique: { p1: { prixCts: 1490 } },
    parrainage: { liens: { 'jul@t,fr': { parrain: 'kev@t,fr', id: 'f1' } }, comptes: { 'kev@t,fr': { filleuls: { f1: { statut: 'inscrit' } } } } } });
  const capture = (cmd, v) => ({ id: 'C' + (++n), amount: { value: v || '14.90', currency_code: 'EUR' }, payer: { email_address: 'jul@t.fr' },
    supplementary_data: { related_ids: { order_id: cmd } } });
  const commande = (custom, v) => ({ status: 'COMPLETED', purchase_units: [{ custom_id: custom, amount: { currency_code: 'EUR', value: v || '14.90' } }] });
  // Commande sans compte (d'avant custom_id) : rangée, jamais perdue, jamais attribuée d'après l'adresse.
  let w = monde(base(), { commandes: { ORD00000001: commande('p1') } });
  assert.equal((await w.envoyer(evt('PAYMENT.CAPTURE.COMPLETED', capture('ORD00000001')))).texte, 'orphelin');
  assert.ok(w.F.lire('paypal_orphelins/commande_ORD00000001'));
  // Mauvais prix : payé, pas compté.
  w = monde(base(), { commandes: { ORD00000002: commande('jul@t,fr|p1', '1.00') } });
  assert.equal((await w.envoyer(evt('PAYMENT.CAPTURE.COMPLETED', capture('ORD00000002', '1.00')))).texte, 'achat_non_compte');
  assert.equal(w.F.lire('paypal_premiers'), null);
  // Le bon.
  w = monde(base(), { commandes: { ORD00000003: commande('jul@t,fr|p1') } });
  assert.equal((await w.envoyer(evt('PAYMENT.CAPTURE.COMPLETED', capture('ORD00000003')))).texte, 'premier_paiement');
  assert.equal(w.F.lire('users/jul@t,fr/abonnement'), null, 'aucun abonnement inventé');
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/filleuls/f1/statut'), 'payant');
});

await test('le jeton OAuth est gardé : un seul par série de webhooks', async () => {
  oublierJetonPaypal();
  const w = monde({ users: LEA(), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' } }, { abonnements: { 'I-ABC12345678': abo() } });
  await w.envoyer(evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-ABC12345678' }));
  await w.envoyer(evt('BILLING.SUBSCRIPTION.SUSPENDED', { id: 'I-ABC12345678' }));
  await Promise.all([jetonPaypal(w.ctx.env, w.ctx.fetchImpl), jetonPaypal(w.ctx.env, w.ctx.fetchImpl)]);
  assert.equal(w.oauth, 1);
  // Expiré (ou autre secret) : redemandé.
  await jetonPaypal(Object.assign({}, w.ctx.env, { PAYPAL_CLIENT_SECRET: 'autre' }), w.ctx.fetchImpl);
  assert.equal(w.oauth, 2);
  oublierJetonPaypal();
});

await test('la table OFFRES du serveur suit les plans et les prix de l’app', async () => {
  const idx = readFileSync(new URL('../../app/index.html', import.meta.url), 'utf8');
  const coeur = idx.match(/rc-core\.\d+\.js/)[0];
  const code = readFileSync(new URL('../../app/' + coeur, import.meta.url), 'utf8');
  const plans = [...code.matchAll(/const (PAYPAL_PLAN_ID\w*)='(P-[A-Z0-9]+)'/g)];
  assert.ok(plans.length >= 7, plans.length + ' plans lus dans l’app');
  for (const [, nom, id] of plans) assert.ok(OFFRES_PAYPAL[id], nom + ' (' + id + ') absent de OFFRES_PAYPAL');
  // Les prix de l'app viennent de tarifs.json, recopié dans rc-core (bloc TARIFS).
  const tarifs = JSON.parse(readFileSync(new URL('../../tarifs.json', import.meta.url), 'utf8'));
  assert.ok(code.includes('/* TARIFS:DEBUT */\nconst TARIFS=') && code.includes('prix:TARIFS.essentielle.mois'), 'l’app lit tarifs.json');
  const prix = (cle, champ) => tarifs[cle][champ === 'prixAn' ? 'an' : 'mois'];
  const a = (id) => OFFRES_PAYPAL[id].montants.map(Number);
  const id = (nom) => plans.find((p) => p[1] === nom)[2];
  assert.ok(a(id('PAYPAL_PLAN_ID')).includes(prix('essentielle', 'prix')), 'Essentielle mensuel');
  // LES ANNUELS : les anciens plans gardent le prix des contrats engagés, les
  // nouveaux (sans engagement) portent celui de tarifs.json — et l'app et le
  // serveur parlent du même identifiant dès qu'il existe.
  const ce = tarifs.contrats_engages;
  assert.ok(a(id('PAYPAL_PLAN_ID_ANNUEL')).includes(ce.essentielle.an), 'Essentielle annuel des contrats engagés');
  const SE = PLANS_ANNUELS_SANS_ENGAGEMENT;
  assert.ok(SE.PAYPAL_PLAN_ID_ANNUEL_SE.montants.map(Number).includes(prix('essentielle', 'prixAn')), 'Essentielle annuel sans engagement');
  assert.ok(SE.PAYPAL_PLAN_ID_ULTIME_ANNUEL_SE.montants.map(Number).includes(prix('ultime', 'prixAn')), 'Ultime annuel sans engagement');
  for (const nom of ['PAYPAL_PLAN_ID_ANNUEL_SE', 'PAYPAL_PLAN_ID_ULTIME_ANNUEL_SE']) {
    const dansApp = (code.match(new RegExp('const ' + nom + "='([^']*)'")) || [])[1];
    assert.ok(dansApp !== undefined, nom + ' absent de l’app');
    assert.equal(dansApp, SE[nom].id, nom + ' : l’app et le serveur n’ont pas le même identifiant');
    if (SE[nom].id) assert.equal(OFFRES_PAYPAL[SE[nom].id].formule, SE[nom].formule);
  }
  assert.ok(a(id('PAYPAL_PLAN_ID_ULTIME')).includes(prix('ultime', 'prix')), 'Ultime mensuel');
  assert.ok(a(id('PAYPAL_PLAN_ID_ULTIME_ANNUEL')).includes(ce.ultime.an), 'Ultime annuel des contrats engagés');
  assert.ok(a(id('PAYPAL_PLAN_ID_ULTIME_DEMI')).includes(tarifs.ultime_demi.premierMois), 'Ultime demi');
  assert.ok(a(id('PAYPAL_PLAN_ID_COACH')).includes(tarifs.coach.coach), 'Coach');
  assert.ok(a(id('PAYPAL_PLAN_ID_PRO')).includes(tarifs.coach.pro), 'Pro');
  // L'app crée bien abonnements et commandes avec le compte dans custom_id.
  assert.match(code, /subscription\.create\(\{'plan_id':planId,'custom_id':_cleComptePaypal\(\)\}\)/);
  assert.equal((code.match(/custom_id:_cleComptePaypal\(\)\+'\|'\+p\.id/g) || []).length, 2);
});

// ── LE PAIEMENT DIRECT AU COACH, PAR LE WEBHOOK (paiements-coach.js) ─────────
await test('une capture à trois segments va au coach, une capture à deux reste un achat de programme', async () => {
  const cmdCoach = { id: 'ORDCOACH01', purchase_units: [{ custom_id: 'kev@t,fr|lea@t,fr|coaching_essentiel', payee: { merchant_id: 'ABCDEFGH12345' },
    amount: { currency_code: 'EUR', value: '150.00' } }] };
  const cmdProg = { id: 'ORDPROG001', purchase_units: [{ custom_id: 'lea@t,fr|prog1', amount: { currency_code: 'EUR', value: '14.90' } }] };
  const w = monde({ users: Object.assign(LEA(), { 'kev@t,fr': { role: 'coach', coachPlan: 'pro' } }), boutique: { prog1: { prixCts: 1490 } },
    coach_paiement: { 'kev@t,fr': { marchand: 'ABCDEFGH12345', type: 'merchant_id', statut: 'relie', le: 1 } } },
    { commandes: { ORDCOACH01: cmdCoach, ORDPROG001: cmdProg } });
  const cap = (id, value, ord) => evt('PAYMENT.CAPTURE.COMPLETED', { id, status: 'COMPLETED', amount: { currency_code: 'EUR', value },
    supplementary_data: { related_ids: { order_id: ord } } });
  assert.deepEqual(await w.envoyer(cap('CAPC0001', '150.00', 'ORDCOACH01')), { status: 200, texte: 'paiement_coach' });
  assert.equal(w.F.lire('paiements_coach/kev@t,fr/ORDCOACH01/statut'), 'recu');
  assert.equal(w.F.lire('droits/lea@t,fr/suiviJusqu'), T0 + MOIS);
  // Le compte RepCore n'a RIEN encaissé : aucune transaction à son registre pour ce paiement.
  assert.equal(w.F.lire('paypal_transactions/CAPC0001'), null);
  assert.equal(w.F.lire('paypal_premiers/lea@t,fr'), null);
  // L'achat d'un programme, lui, suit toujours son chemin.
  const r = await w.envoyer(cap('CAPP0001', '14.90', 'ORDPROG001'));
  assert.equal(r.status, 200);
  assert.notEqual(r.texte, 'paiement_coach');
  assert.equal(w.F.lire('paiements_coach/kev@t,fr/ORDPROG001'), null);
});

// ══ TOUTE ÉCRITURE DANS users/<clé> POSE updatedAt (30/09/2026) ═══════════
// Sans lui, l'app ne redescend pas le dossier : l'écriture du serveur reste
// invisible sur le téléphone, puis le PUT suivant de l'app l'efface.
await test('ACTIVATED : statutPaypal ACTIVE et users/<clé>/updatedAt avancé dans la même écriture', async () => {
  const w = monde({ users: LEA({ updatedAt: 1 }), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' } },
    { abonnements: { 'I-ABC12345678': abo() } });
  await w.envoyer(evt('BILLING.SUBSCRIPTION.ACTIVATED', abo({ id: 'I-ABC12345678' })));
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/statutPaypal'), 'ACTIVE');
  assert.equal(w.F.lire('users/lea@t,fr/updatedAt'), T0);
});

await test('attributionPaiement : compté une fois, updatedAt avancé, et une remise à null de payeLe par un client ne recompte pas', async () => {
  const w = monde({ users: LEA({ updatedAt: 1, origine: { type: 'lien', le: T0 - 5 * J } }) });
  const avant = JSON.stringify(w.F.arbre);
  const o1 = await w.M.attributionPaiement('lea@t,fr');
  assert.ok(o1, 'le premier paiement est compté');
  assert.equal(w.F.lire('users/lea@t,fr/origine/payeLe'), T0);
  assert.equal(w.F.lire('attribution_payes/lea@t,fr'), T0);
  assert.equal(w.F.lire('users/lea@t,fr/updatedAt'), T0);
  assert.notEqual(JSON.stringify(w.F.arbre), avant);
  // UN CLIENT REMET payeLe À NULL (PUT d'une copie ancienne du dossier).
  w.F.ecrire('users/lea@t,fr/origine/payeLe', null);
  w.F.ecrire('users/lea@t,fr/updatedAt', 2);
  const compteurs = (a) => JSON.stringify(Object.assign({}, a, { users: null, attribution_payes: null }));
  const c1 = compteurs(w.F.arbre);
  w.t += J;
  assert.equal(await w.M.attributionPaiement('lea@t,fr'), null, 'pas de second comptage');
  assert.equal(compteurs(w.F.arbre), c1, 'aucun compteur n’a bougé');
  // La copie lisible par l'app est remise en place, datée.
  assert.equal(w.F.lire('users/lea@t,fr/origine/payeLe'), T0);
  assert.equal(w.F.lire('users/lea@t,fr/updatedAt'), T0 + J);
});

await test('attributionPaiement : un dossier déjà compté avant attribution_payes n’est pas recompté', async () => {
  const w = monde({ users: LEA({ origine: { type: 'lien', le: 1, payeLe: T0 - 9 * J } }) });
  const c0 = JSON.stringify(Object.assign({}, w.F.arbre, { users: null, attribution_payes: null }));
  assert.equal(await w.M.attributionPaiement('lea@t,fr'), null);
  assert.equal(w.F.lire('attribution_payes/lea@t,fr'), T0 - 9 * J, 'reporté dans le nœud serveur');
  assert.equal(JSON.stringify(Object.assign({}, w.F.arbre, { users: null, attribution_payes: null })), c0);
});

await test('annulerAttribution : payeLe retiré, le nœud serveur aussi, et updatedAt avancé', async () => {
  const w = monde({ users: LEA({ updatedAt: 1, origine: { type: 'lien', le: T0 - 5 * J } }) });
  await w.M.attributionPaiement('lea@t,fr');
  // Même si le client a effacé sa copie, l'annulation lit le nœud serveur.
  w.F.ecrire('users/lea@t,fr/origine/payeLe', null);
  const t = T0 + 2 * J;
  const r = await w.M.annulerAttribution('lea@t,fr', t);
  assert.deepEqual(r, { payeLe: T0 });
  assert.equal(w.F.lire('users/lea@t,fr/origine/annuleLe'), t);
  assert.equal(w.F.lire('users/lea@t,fr/updatedAt'), t);
  assert.equal(w.F.lire('attribution_payes/lea@t,fr'), null);
});

// LE CRITÈRE : aucune écriture serveur dans users/ sans updatedAt. On relève,
// dans le source, chaque écriture dont un chemin commence par users/, et on
// exige updatedAt dans la même écriture.
await test('aucune écriture serveur dans users/<clé> sans updatedAt (source)', async () => {
  const fichiers = ['metier', 'paypal', 'paiements-coach', 'duels', 'pages', 'prospects', 'relances', 'retour', 'saisons', 'sante', 'xp', 'medias', 'garmin', 'google', 'lignes', 'marque', 'appels', 'retention', 'index', 'planif', 'push', 'migration'];
  const fautes = [];
  for (const f of fichiers) {
    let src = '';
    try { src = readFileSync(new URL('../src/' + f + '.js', import.meta.url), 'utf8'); } catch (e) { continue; }
    const lignes = src.split('\n');
    lignes.forEach((l, i) => {
      if (/^\s*\/\//.test(l)) return;
      // Une écriture sur users/ : update({...users/...}), ref('users/...').set/update/remove/transaction, ref(b + ...).set.
      const ecrit = /\.(update|set|remove|transaction)\(/.test(l) && (/['"]users\//.test(l) || /\[b \+ '/.test(l) || /ref\(b \+/.test(l));
      if (!ecrit) return;
      // updatedAt dans la ligne ou les deux suivantes (objets sur plusieurs lignes), ou dans l'objet `maj` construit avant.
      const fen = lignes.slice(Math.max(0, i - 8), i + 3).join('\n');
      if (!/updatedAt/.test(fen)) fautes.push(f + '.js:' + (i + 1) + '  ' + l.trim().slice(0, 120));
    });
  }
  assert.deepEqual(fautes, []);
});

console.log(ok + ' tests passés');
