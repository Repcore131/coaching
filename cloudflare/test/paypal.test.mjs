// PayPal écouté par le serveur léger, sur une base en mémoire et un faux PayPal.
//   node cloudflare/test/paypal.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { creerBase } from '../src/base.js';
import { creerMetier } from '../src/metier.js';
import { creerPaypal, recevoirWebhook, jetonPaypal, oublierJetonPaypal, OFFRES_PAYPAL, moisApres, RESIL_AVANCE_MS } from '../src/paypal.js';
import { spawnSync } from 'node:child_process';
import { fausseBase } from './fausse-base.mjs';
import { BUDGET_REQUETE } from '../src/index.js';
import { minute, travaux } from '../src/planif.js';
import { paris } from '../src/metier.js';

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
  const w = { F, verifs: [], paypalEcrits: [], oauth: 0, panne: 0, abos: opt.abonnements || {}, commandes: opt.commandes || {}, t: T0, req: 0, max: 0 };
  // CHAQUE sous-requête compte (base, PayPal, push) : c'est ce que Cloudflare plafonne à 50.
  const fetchImpl = async (url, init) => {
    w.req++;
    const u = String(url);
    if (u.endsWith('/v1/oauth2/token')) { w.oauth++; return { ok: true, status: 200, json: async () => ({ access_token: 'tok', expires_in: 32400 }) }; }
    if (u.endsWith('/v1/notifications/verify-webhook-signature')) {
      w.verifs.push(init.body);
      return { ok: true, status: 200, json: async () => ({ verification_status: opt.signature === false ? 'FAILURE' : 'SUCCESS' }) };
    }
    // ÉCRIRE CHEZ PAYPAL : réviser (changer de plan) et annuler un abonnement.
    const ecrit = u.match(/\/v1\/billing\/subscriptions\/(I-[A-Z0-9]+)\/(revise|cancel)$/);
    if (ecrit) {
      const corps = JSON.parse(init.body || '{}');
      w.paypalEcrits.push({ abo: ecrit[1], quoi: ecrit[2], corps });
      const s = w.abos[ecrit[1]];
      if (!s) return { ok: false, status: 404, json: async () => ({}) };
      if (ecrit[2] === 'cancel') {
        if (s.status === 'CANCELLED') return { ok: false, status: 422, json: async () => ({}) };
        s.status = 'CANCELLED';
        return { ok: true, status: 204, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => ({ plan_id: corps.plan_id,
        links: [{ rel: 'approve', href: 'https://www.paypal.com/webapps/billing/subscriptions/update?ba_token=BA-1' }, { rel: 'edit', href: 'x' }] }) };
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
  M.paypal = w.PP;
  // Une minute du Worker (planif.js), avec SON compteur : elle rejoue ce que
  // les webhooks ont différé. Les travaux du jour sont marqués faits.
  w.minute = async () => {
    const p = paris(w.t);
    F.ecrire('worker/jobs', Object.fromEntries(travaux({ planifies: {}, abonnes: () => [] })
      .map((x) => [x.nom, { jour: x.heure ? p.jour + 'h' + p.heure : p.jour, fini: true }])));
    w.req = 0;
    const b = await minute({ db, M, compteur: () => w.req, maintenant: () => w.t });
    M.fixerBudget();
    assert.ok(b.requetes <= 50, 'minute : ' + b.requetes + ' sous-requêtes');
    return b;
  };
  // COMME index.js : un compteur par webhook, et le budget fixé à 44 (BUDGET_REQUETE).
  // AUCUN appel ne doit dépasser 46 sous-requêtes (plafond Cloudflare : 50).
  w.envoyer = async (e) => {
    w.req = 0;
    M.fixerBudget(() => BUDGET_REQUETE - w.req);
    try {
      const r = await recevoirWebhook(post(e), w.ctx);
      const sortie = { status: r.status, texte: await r.text() };
      w.max = Math.max(w.max, w.req); MAX_WEBHOOK = Math.max(MAX_WEBHOOK, w.req);
      assert.ok(w.req <= 46, e.event_type + ' : ' + w.req + ' sous-requêtes dans un seul webhook');
      return sortie;
    } finally { M.fixerBudget(); }
  };
  return w;
}
let n = 0;
let MAX_WEBHOOK = 0;   // le plus gros webhook de tout le fichier
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

// Un filleul QUALIFIÉ (01/10/2026) : quatre séances validées sur quatre jours
// étalés sur douze, et l'adresse vérifiée vue par le serveur.
const seancesQualif = (t) => [12, 8, 4, 1].map((k) => ({ date: t - k * 864e5, data: { Squat: { sets: [{ done: true }] } } }));
await test('premier paiement d’un filleul : compté seulement si plan, montant et devise sont ceux des OFFRES', async () => {
  const base = () => ({ users: Object.assign(LEA({ status: 'FREE', fname: 'Julie', sessions: seancesQualif(T0) }), { 'kev@t,fr': { role: 'athlete', status: 'FREE' } }),
    paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' },
    parrainage: { verifies: { 'lea@t,fr': 1 }, liens: { 'lea@t,fr': { parrain: 'kev@t,fr', id: 'f1' } }, comptes: { 'kev@t,fr': { filleuls: { f1: { statut: 'inscrit', prenom: 'Julie' } } } } } });
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
  assert.ok(a(id('PAYPAL_PLAN_ID_ANNUEL')).includes(prix('essentielle', 'prixAn')), 'Essentielle annuel');
  assert.ok(a(id('PAYPAL_PLAN_ID_ULTIME')).includes(prix('ultime', 'prix')), 'Ultime mensuel');
  assert.ok(a(id('PAYPAL_PLAN_ID_ULTIME_ANNUEL')).includes(prix('ultime', 'prixAn')), 'Ultime annuel');
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

await test('trois orphelins puis le lien : le webhook du lien reste sous 46, la suite part en sous-tâches, rejouée dans l’ordre en 2 minutes', async () => {
  const ABO = 'I-ABC12345678';
  const lea = LEA({ status: 'FREE', fname: 'Julie', sessions: seancesQualif(T0) })['lea@t,fr'];
  // Le dossier de Léa n'est pas encore sur le serveur : tout est rangé.
  const w = monde({ users: { 'kev@t,fr': { role: 'athlete', status: 'FREE' } },
    parrainage: { verifies: { 'lea@t,fr': 1 }, liens: { 'lea@t,fr': { parrain: 'kev@t,fr', id: 'f1' } },
      comptes: { 'kev@t,fr': { filleuls: { f1: { statut: 'inscrit', prenom: 'Julie' } } } } } },
    { abonnements: { [ABO]: abo({ custom_id: 'lea@t,fr' }) } });
  const e1 = evt('BILLING.SUBSCRIPTION.ACTIVATED', abo({ id: ABO, custom_id: 'lea@t,fr' }));
  const e2 = evt('PAYMENT.SALE.COMPLETED', vente(ABO, '9.50', 'S-UN'));
  const e3 = evt('PAYMENT.SALE.COMPLETED', vente(ABO, '9.50', 'S-DEUX'));
  for (const e of [e1, e2, e3]) assert.equal((await w.envoyer(e)).texte, 'orphelin');
  assert.equal(Object.keys(w.F.lire('paypal_orphelins/' + ABO)).length, 3);
  // Le dossier arrive ; le quatrième événement fait le lien par custom_id.
  w.F.ecrire('users/lea@t,fr', lea);
  w.max = 0;
  const r = await w.envoyer(evt('PAYMENT.SALE.COMPLETED', vente(ABO, '9.50', 'S-TROIS')));
  assert.equal(r.status, 200);
  assert.equal(r.texte, 'apres_orphelins', 'l’événement du lien passe après les orphelins plus anciens');
  assert.ok(w.max <= 46, w.max + ' sous-requêtes');
  assert.equal(w.F.lire('paypal_abonnes/' + ABO), 'lea@t,fr');
  // Le plus ancien (l'activation) est rejoué tout de suite ; les deux autres
  // orphelins, et l'événement du lien après eux, sont en sous-tâches.
  const file = Object.values(w.F.lire('evenements') || {});
  assert.deepEqual(file.map((x) => x.quoi), ['orphelin_paypal', 'orphelin_paypal', 'orphelin_paypal']);
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/statutPaypal'), 'ACTIVE', 'l’activation, rejouée dans le webhook');
  assert.equal(w.F.lire('paypal_premiers/lea@t,fr'), null, 'le premier paiement attend son tour');
  // Deux minutes : tous les orphelins sont rejoués, DANS L'ORDRE de PayPal.
  await w.minute();
  await w.minute();
  assert.equal(w.F.lire('paypal_orphelins'), null, 'plus aucun orphelin');
  assert.ok(!Object.values(w.F.lire('evenements') || {}).some((x) => x.quoi === 'orphelin_paypal'), 'plus aucun orphelin en file');
  assert.equal(w.F.lire('paypal_premiers/lea@t,fr/vente'), 'S-UN', 'le premier paiement est le plus ancien, posé une seule fois');
  assert.equal(w.F.lire('paypal_transactions/S-UN/premier'), true);
  assert.equal(w.F.lire('paypal_transactions/S-DEUX/premier'), false);
  assert.equal(w.F.lire('paypal_transactions/S-TROIS/premier'), false);
  assert.equal(w.F.lire('parrainage/comptes/kev@t,fr/filleuls/f1/statut'), 'payant');
  assert.equal(w.F.lire('users/kev@t,fr/accessExpiry'), T0 + MOIS, 'le parrain crédité une seule fois');
  assert.equal(w.F.lire('droits/kev@t,fr/echeance'), T0 + MOIS);
  // Ce qui reste en file (ambassadeur, attribution, push différés) part aux
  // minutes suivantes, et ne recompte rien.
  for (let i = 0; i < 5 && w.F.lire('evenements'); i++) await w.minute();
  assert.equal(w.F.lire('evenements'), null, 'la file est vide');
  assert.equal(w.F.lire('evenements_ko'), null, 'aucun échec');
  assert.equal(w.F.lire('users/kev@t,fr/accessExpiry'), T0 + MOIS, 'toujours un seul mois');
  assert.equal(w.F.lire('paypal_premiers/lea@t,fr/vente'), 'S-UN');
});

await test('à court de budget avant une écriture : 503, rien d’écrit, l’état reste « en_cours » ; le renvoi passe', async () => {
  const w = monde({ users: LEA(), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' } }, { abonnements: { 'I-ABC12345678': abo() } });
  const e = evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-ABC12345678' }, 'WH-BUDGET');
  // Un webhook dont il ne reste presque rien (comme après un long chemin).
  w.req = 0;
  w.M.fixerBudget(() => 12 - w.req);
  const r = await recevoirWebhook(post(e), w.ctx);
  w.M.fixerBudget();
  assert.equal(r.status, 503);
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/finAccesPaypal'), null, 'rien d’écrit à moitié');
  assert.equal(w.F.lire('paypal_evenements/WH-BUDGET/etat'), 'en_cours');
  w.t = T0 + 11 * 60e3;                          // PayPal renvoie plus tard
  assert.deepEqual(await w.envoyer(e), { status: 200, texte: 'fin_posee' });
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/finAccesPaypal'), T0 + 10 * J);
});

await test('un orphelin rejoué dans le webhook qui manque de budget en route part en sous-tâche : le lien n’est jamais posé sans ses orphelins', async () => {
  const ABO = 'I-ABC12345678';
  const w = monde({ users: LEA({ status: 'FREE' }) }, { abonnements: { [ABO]: abo({ custom_id: 'lea@t,fr' }) } });
  w.F.ecrire('paypal_orphelins/' + ABO, { 'WH-A': { evt: evt('PAYMENT.SALE.COMPLETED', vente(ABO, '9.50', 'S-A')), at: 1 },
    'WH-B': { evt: evt('BILLING.SUBSCRIPTION.CANCELLED', { id: ABO }), at: 2 } });
  // Le lien vient d'être posé (lier l'écrit AVANT de rejouer) ; il reste
  // assez pour tenter le rejeu (seuil forcé), pas pour le mener au bout.
  w.F.ecrire('paypal_abonnes/' + ABO, 'lea@t,fr');
  w.req = 0;
  w.M.fixerBudget(() => 12 - w.req);
  assert.equal(await w.PP.rejouerOrphelins(ABO, { enLigne: 1 }), 0, 'aucun rejoué jusqu’au bout');
  w.M.fixerBudget();
  assert.deepEqual(Object.values(w.F.lire('evenements')).map((x) => x.k), ['WH-A', 'WH-B'], 'les deux en sous-tâches, dans l’ordre');
  assert.ok(w.F.lire('paypal_orphelins/' + ABO + '/WH-A'), 'toujours rangé tant qu’il n’est pas rejoué');
  for (let i = 0; i < 4 && w.F.lire('evenements'); i++) await w.minute();
  assert.equal(w.F.lire('paypal_orphelins'), null);
  assert.ok(w.F.lire('paypal_premiers/lea@t,fr'), 'le paiement est passé');
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/statutPaypal'), 'CANCELLED', 'puis l’annulation, dans l’ordre');
});

// ══ CHANGER DE FORMULE SANS DEUXIÈME ABONNEMENT (02/10/2026) ════════════
const ULT_AN = 'P-16Y44630WF304553UNK2LZXI', DEMI = 'P-57P40267XP026613FNK2LZXQ', COACH = 'P-9JD300001T4718058NK2RF5Q';
const espionAdmin = (w) => { const l = []; w.M.pousser1 = async (uid, m) => { l.push({ uid, m }); return { envoye: 1 }; }; return l; };
const ENG = T0 + 300 * J;

await test('révision : Essentielle → Ultime révise l’abonnement en cours chez PayPal et rend le lien d’approbation', async () => {
  const w = monde({ users: LEA({ abonnement: { formule: 'essentielle', engagementJusqu: ENG } }), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' } },
    { abonnements: { 'I-ABC12345678': abo({ custom_id: 'lea@t,fr' }) } });
  const r = await w.PP.changerFormule('lea@t,fr', ULT);
  assert.equal(r.approve, 'https://www.paypal.com/webapps/billing/subscriptions/update?ba_token=BA-1');
  assert.equal(r.baisse, false); assert.equal(r.effet, 0); assert.equal(r.formule, 'ultime');
  assert.deepEqual(w.paypalEcrits.map((x) => [x.abo, x.quoi, x.corps.plan_id]), [['I-ABC12345678', 'revise', ULT]]);
  assert.match(w.paypalEcrits[0].corps.application_context.return_url, /\?formule=validee$/);
  assert.equal(w.F.lire('paypal_revisions/I-ABC12345678/vers'), ULT);
  // PayPal confirme : BILLING.SUBSCRIPTION.UPDATED, l'abonnement relu porte Ultime.
  w.abos['I-ABC12345678'].plan_id = ULT;
  assert.equal((await w.envoyer(evt('BILLING.SUBSCRIPTION.UPDATED', { id: 'I-ABC12345678' }))).texte, 'formule_changee');
  assert.equal(w.F.lire('droits/lea@t,fr/palier'), 'ultime');
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/formule'), 'ultime');
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/engagementJusqu'), ENG, 'l’engagement ne repart pas à zéro');
  assert.equal(w.F.lire('paypal_revisions/I-ABC12345678'), null);
  assert.equal(w.paypalEcrits.filter((x) => x.quoi === 'cancel').length, 0, 'un seul abonnement, rien à annuler');
});

await test('révision : Ultime → Essentielle (baisse) donne la date d’effet ; Ultime court jusque-là, puis Essentielle', async () => {
  const w = monde({ users: LEA({ abonnement: { formule: 'ultime', engagementJusqu: ENG } }), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' },
    droits: { 'lea@t,fr': { palier: 'ultime', echeance: 0, source: 'paypal' } } },
    { abonnements: { 'I-ABC12345678': abo({ plan_id: ULT, custom_id: 'lea@t,fr' }) } });
  const r = await w.PP.changerFormule('lea@t,fr', ESS);
  assert.equal(r.baisse, true);
  assert.equal(r.effet, T0 + 10 * J, 'la prochaine échéance');
  w.abos['I-ABC12345678'].plan_id = ESS;
  w.abos['I-ABC12345678'].billing_info.next_billing_time = iso(T0 + 40 * J);   // PayPal a déjà avancé : la date notée à la demande fait foi
  assert.equal((await w.envoyer(evt('BILLING.SUBSCRIPTION.UPDATED', { id: 'I-ABC12345678' }))).texte, 'formule_changee');
  assert.equal(w.F.lire('droits/lea@t,fr/palier'), 'essentielle');
  assert.equal(w.F.lire('droits/lea@t,fr/ultimeJusqu'), T0 + 10 * J, 'Ultime gardé jusqu’à la date d’effet');
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/engagementJusqu'), ENG);
});

await test('révision refusée : plan demi, même formule, abonnement d’un autre, rôle croisé ; déjà annulé : le dossier l’apprend', async () => {
  const w = monde({ users: Object.assign(LEA({ abonnement: { formule: 'essentielle' } }),
    { 'kev@t,fr': { role: 'coach', paypalSubscriptionId: 'I-COACH0000001' } }), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' } },
    { abonnements: { 'I-ABC12345678': abo({ custom_id: 'lea@t,fr' }), 'I-COACH0000001': abo({ plan_id: COACH, custom_id: 'kev@t,fr' }) } });
  const refus = async (cle, plan, re) => { await assert.rejects(() => w.PP.changerFormule(cle, plan), (e) => { assert.match(e.message, re); return true; }); };
  await refus('lea@t,fr', DEMI, /moitié prix/);
  await refus('lea@t,fr', ESS, /déjà ta formule/);
  await refus('lea@t,fr', PRO, /pas proposée/);
  await refus('lea@t,fr', 'P-INCONNU', /inconnue/);
  await refus('kev@t,fr', ULT, /pas proposée/);
  w.abos['I-COACH0000001'].custom_id = 'autre@t,fr';
  await refus('kev@t,fr', PRO, /pas le tien/);
  assert.equal(w.paypalEcrits.length, 0, 'rien n’est demandé à PayPal');
  // Un abonnement déjà annulé chez PayPal : rien à réviser, et la souscription redevient possible.
  w.abos['I-ABC12345678'].status = 'CANCELLED';
  assert.deepEqual(await w.PP.changerFormule('lea@t,fr', ULT), { fini: true, statut: 'CANCELLED' });
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/statutPaypal'), 'CANCELLED');
  w.abos['I-ABC12345678'].status = 'SUSPENDED';
  await refus('lea@t,fr', ULT, /pas actif chez PayPal \(SUSPENDED\)/);
});

await test('coach : Coach → Pro par la même révision ; UPDATED ouvre le palier Pro au registre', async () => {
  const w = monde({ users: { 'kev@t,fr': { role: 'coach', coachPlan: 'coach', paypalSubscriptionId: 'I-COACH0000001' } },
    paypal_abonnes: { 'I-COACH0000001': 'kev@t,fr' }, coachs_registre: { 'kev@t,fr': { plan: 'coach', actifJusqu: T0 + 20 * J } } },
    { abonnements: { 'I-COACH0000001': abo({ plan_id: COACH, custom_id: 'kev@t,fr' }) } });
  const r = await w.PP.changerFormule('kev@t,fr', PRO);
  assert.equal(r.formule, 'pro'); assert.equal(r.baisse, false);
  w.abos['I-COACH0000001'].plan_id = PRO;
  assert.equal((await w.envoyer(evt('BILLING.SUBSCRIPTION.UPDATED', { id: 'I-COACH0000001' }))).texte, 'formule_changee');
  assert.equal(w.F.lire('coachs_registre/kev@t,fr/plan'), 'pro');
  assert.equal(w.F.lire('users/kev@t,fr/coachPlan'), 'pro');
  assert.equal(w.F.lire('droits/kev@t,fr'), null, 'un coach n’a pas de droits/');
});

await test('UPDATED sur un ancien abonnement, ou un abonnement non actif : rien ne change', async () => {
  const w = monde({ users: LEA({ paypalSubscriptionId: 'I-NOUVEAU00001' }), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr', 'I-NOUVEAU00001': 'lea@t,fr' } },
    { abonnements: { 'I-ABC12345678': abo({ plan_id: ULT }), 'I-NOUVEAU00001': abo({ status: 'SUSPENDED' }) } });
  assert.equal((await w.envoyer(evt('BILLING.SUBSCRIPTION.UPDATED', { id: 'I-ABC12345678' }))).texte, 'ancien_abonnement');
  assert.equal((await w.envoyer(evt('BILLING.SUBSCRIPTION.UPDATED', { id: 'I-NOUVEAU00001' }))).texte, 'maj_sans_effet');
  assert.equal(w.F.lire('droits/lea@t,fr'), null);
});

await test('double abonnement : un paiement sur un abonnement ACTIVE qui n’est pas le courant est journalisé et signalé à l’administrateur', async () => {
  const w = monde({ users: LEA({ paypalSubscriptionId: 'I-NOUVEAU00001' }), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr', 'I-NOUVEAU00001': 'lea@t,fr' },
    paypal_premiers: { 'lea@t,fr': { le: T0 - 90 * J, abo: 'I-ABC12345678' } } },
    { abonnements: { 'I-ABC12345678': abo({ custom_id: 'lea@t,fr' }), 'I-NOUVEAU00001': abo({ plan_id: ULT, custom_id: 'lea@t,fr' }) } });
  const admin = espionAdmin(w);
  assert.equal((await w.envoyer(evt('PAYMENT.SALE.COMPLETED', vente('I-ABC12345678', '9.50', 'S-DOUBLE')))).texte, 'paiement_sans_ouverture');
  const j = Object.values(w.F.lire('paypal_journal'));
  assert.equal(j.length, 1);
  assert.equal(j[0].quoi, 'double_abonnement');
  assert.equal(j[0].qui, 'lea@t.fr'); assert.equal(j[0].abo, 'I-ABC12345678'); assert.equal(j[0].courant, 'I-NOUVEAU00001');
  assert.equal(j[0].montant, '9,50 €');
  assert.equal(admin.length, 1);
  assert.equal(admin[0].uid, 'guellec,coachingpro@gmail,com');
  assert.equal(admin[0].m.body, 'lea@t.fr a deux abonnements actifs (I-ABC12345678 et I-NOUVEAU00001)');
  // Un paiement sur un ancien abonnement DÉJÀ annulé n'est pas un doublon.
  w.abos['I-ABC12345678'].status = 'CANCELLED';
  await w.envoyer(evt('PAYMENT.SALE.COMPLETED', vente('I-ABC12345678', '9.50', 'S-TARDIF')));
  assert.equal(Object.values(w.F.lire('paypal_journal')).length, 1);
  assert.equal(admin.length, 1);
  // Ni le paiement du courant.
  await w.envoyer(evt('PAYMENT.SALE.COMPLETED', vente('I-NOUVEAU00001', '24.90', 'S-COURANT')));
  assert.equal(admin.length, 1);
});

await test('remplacement : l’ancien n’est annulé chez PayPal que quand le nouveau est ACTIVE', async () => {
  const w = monde({ users: LEA({ paypalSubscriptionId: 'I-NOUVEAU00001', abonnement: { engagementJusqu: ENG } }), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' } },
    { abonnements: { 'I-ABC12345678': abo({ custom_id: 'lea@t,fr' }), 'I-NOUVEAU00001': abo({ plan_id: ULT, status: 'APPROVAL_PENDING', custom_id: 'lea@t,fr' }) } });
  // L'app signale le nouveau avec {remplace: ancien} : le nouveau n'est pas encore actif.
  assert.equal(await w.PP.indexer('lea@t,fr', 'I-NOUVEAU00001', 'I-ABC12345678'), 'indexe_en_attente_activation');
  assert.equal(w.paypalEcrits.length, 0, 'rien n’est annulé avant');
  assert.equal(w.F.lire('paypal_remplacements/I-NOUVEAU00001/ancien'), 'I-ABC12345678');
  // PayPal active le nouveau : l'ancien est annulé, « remplacé ».
  w.abos['I-NOUVEAU00001'].status = 'ACTIVE';
  assert.equal((await w.envoyer(evt('BILLING.SUBSCRIPTION.ACTIVATED', { id: 'I-NOUVEAU00001', status: 'ACTIVE', plan_id: ULT }))).texte, 'active');
  assert.deepEqual(w.paypalEcrits.map((x) => [x.abo, x.quoi, x.corps.reason]), [['I-ABC12345678', 'cancel', 'remplacé']]);
  assert.equal(w.abos['I-ABC12345678'].status, 'CANCELLED');
  assert.equal(w.F.lire('paypal_remplacements'), null);
  assert.equal(Object.values(w.F.lire('paypal_journal'))[0].quoi, 'ancien_annule');
  // L'avis d'annulation de l'ancien arrive : il ne ferme rien.
  assert.equal((await w.envoyer(evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-ABC12345678' }))).texte, 'ancien_abonnement');
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/finAccesPaypal'), null);
  assert.equal(w.F.lire('droits/lea@t,fr/palier'), 'ultime');
  assert.equal(w.F.lire('users/lea@t,fr/abonnement/engagementJusqu'), ENG);
});

await test('remplacement : nouveau déjà actif → annulé tout de suite ; ancien déjà CANCELLED → rien ; ancien d’un autre → jamais', async () => {
  const w = monde({ users: LEA({ paypalSubscriptionId: 'I-NOUVEAU00001' }), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr', 'I-AUTRUI000001': 'bob@t,fr' } },
    { abonnements: { 'I-ABC12345678': abo({ custom_id: 'lea@t,fr' }), 'I-NOUVEAU00001': abo({ plan_id: ULT, custom_id: 'lea@t,fr' }),
      'I-AUTRUI000001': abo({ custom_id: 'bob@t,fr' }) } });
  assert.equal(await w.PP.indexer('lea@t,fr', 'I-NOUVEAU00001', 'I-AUTRUI000001'), 'indexe_ancien_pas_a_toi');
  assert.equal(w.paypalEcrits.length, 0, 'l’abonnement d’un autre n’est jamais annulé');
  assert.equal(await w.PP.indexer('lea@t,fr', 'I-NOUVEAU00001', 'I-ABC12345678'), 'indexe_ancien_annule');
  assert.equal(w.paypalEcrits.length, 1);
  assert.equal(await w.PP.indexer('lea@t,fr', 'I-NOUVEAU00001', 'I-ABC12345678'), 'indexe_ancien_deja_annule');
  assert.equal(w.paypalEcrits.length, 1, 'déjà CANCELLED : pas de seconde annulation');
});

await test('remplacement par l’événement de l’app : planif passe `remplace` à indexer, les règles l’acceptent pour « abonnement » seulement', async () => {
  const src = readFileSync(new URL('../src/planif.js', import.meta.url), 'utf8');
  assert.match(src, /M\.paypal\.indexer\(e\.par, e\.abo, e\.remplace\)/);
  const regles = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');
  assert.match(regles, /"remplace": \{ "\.validate": "newData\.isString\(\) && newData\.val\(\)\.matches\(\/\^I-\[A-Z0-9\]\{6,30\}\$\/\) && newData\.parent\(\)\.child\('type'\)\.val\(\) === 'abonnement'" \}/);
  assert.match(regles, /"paypal_revisions":\s+\{ "\.read": false, "\.write": false \}/);
  assert.match(regles, /"paypal_remplacements": \{ "\.read": false, "\.write": false \}/);
  const index = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.match(index, /url\.pathname === '\/abonnement\/changer' && req\.method === 'POST'/);
});

// ══ LA RÉSILIATION, TENUE PAR LE SERVEUR (02/10/2026) ═══════════════════
const DEBUT = T0 - 165 * J;                      // souscrit il y a 165 jours
const TERME = moisApres(DEBUT, 12);              // le terme que PayPal atteste
const annulations = (w) => w.paypalEcrits.filter((x) => x.quoi === 'cancel');

await test('résiliation demandée pendant l’engagement : rien n’est annulé avant, l’annulation part chez PayPal trois jours avant le terme, une seule fois', async () => {
  const w = monde({ users: LEA({ abonnement: { formule: 'essentielle', engagementJusqu: TERME } }), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' } },
    { abonnements: { 'I-ABC12345678': abo({ custom_id: 'lea@t,fr', start_time: iso(DEBUT) }) } });
  const r = await w.PP.resilier('lea@t,fr', 'Trop cher', T0 - 60e3);
  assert.equal(r.effet, TERME, 'la date d’effet est le terme de l’engagement');
  assert.equal(r.annulerLe, TERME - RESIL_AVANCE_MS);
  assert.equal(r.annule, false); assert.equal(r.pendantEngagement, true);
  assert.deepEqual(w.F.lire('resiliations/lea@t,fr'), { ts: T0 - 60e3, motif: 'Trop cher', abo: 'I-ABC12345678', effet: TERME, annulerLe: TERME - RESIL_AVANCE_MS, le: T0 });
  assert.equal(annulations(w).length, 0, 'pendant l’engagement, rien n’est annulé chez PayPal');
  // Une seconde demande ne change rien.
  assert.equal((await w.PP.resilier('lea@t,fr', 'Autre')).deja, true);
  assert.equal(w.F.lire('resiliations/lea@t,fr/motif'), 'Trop cher');
  // Le travail quotidien : rien la veille du jour d'annulation…
  w.t = TERME - RESIL_AVANCE_MS - J;
  assert.equal(await w.PP.resiliationsDues(w.t), 0);
  assert.equal(annulations(w).length, 0);
  // … l'annulation le jour venu, trois jours avant le terme…
  w.t = TERME - RESIL_AVANCE_MS + 6 * 3600e3;
  assert.equal(await w.PP.resiliationsDues(w.t), 1);
  assert.deepEqual(annulations(w).map((x) => [x.abo, x.corps.reason]), [['I-ABC12345678', 'Résiliation demandée dans RepCore']]);
  assert.equal(w.F.lire('resiliations/lea@t,fr/annuleLe'), w.t);
  // … et plus jamais ensuite.
  w.t += J;
  assert.equal(await w.PP.resiliationsDues(w.t), 0);
  assert.equal(annulations(w).length, 1);
  // L'avis CANCELLED qui suit : l'accès court jusqu'à la fin payée (le terme), sans rupture.
  w.abos['I-ABC12345678'].billing_info.next_billing_time = iso(TERME);
  assert.equal((await w.envoyer(evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-ABC12345678' }))).texte, 'fin_posee');
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), TERME);
  assert.equal(w.F.lire('paypal_journal'), null);
});

await test('le dossier ne raccourcit pas l’engagement : un engagementJusqu réécrit dans le passé n’avance pas l’annulation', async () => {
  const w = monde({ users: LEA({ abonnement: { engagementJusqu: T0 - 10 * J } }), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' } },
    { abonnements: { 'I-ABC12345678': abo({ custom_id: 'lea@t,fr', start_time: iso(DEBUT) }) } });
  const r = await w.PP.resilier('lea@t,fr', '');
  assert.equal(r.effet, TERME, 'le terme attesté par PayPal (début + 12 mois)');
  assert.equal(annulations(w).length, 0);
});

await test('résiliation après l’engagement : effet à la fin de la période en cours, annulation chez PayPal tout de suite', async () => {
  const debut = moisApres(T0, -14);
  const w = monde({ users: LEA({ abonnement: { engagementJusqu: moisApres(debut, 12) } }), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' } },
    { abonnements: { 'I-ABC12345678': abo({ custom_id: 'lea@t,fr', start_time: iso(debut) }) } });
  const r = await w.PP.resilier('lea@t,fr', '');
  assert.equal(r.effet, T0 + 10 * J, 'la prochaine échéance');
  assert.equal(r.annule, true); assert.equal(r.pendantEngagement, false);
  assert.equal(annulations(w).length, 1);
  assert.equal(await w.PP.resiliationsDues(T0 + J), 0, 'rien de plus le lendemain');
});

await test('coach (sans engagement) : annulé tout de suite ; abonnement déjà annulé : rien n’est envoyé ; remplacé depuis : rien n’est arrêté', async () => {
  const w = monde({ users: Object.assign(LEA({ paypalSubscriptionId: 'I-NOUVEAU00001' }), { 'kev@t,fr': { role: 'coach', paypalSubscriptionId: 'I-COACH0000001' } }),
    paypal_abonnes: { 'I-COACH0000001': 'kev@t,fr', 'I-NOUVEAU00001': 'lea@t,fr' } },
    { abonnements: { 'I-COACH0000001': abo({ plan_id: PRO, custom_id: 'kev@t,fr', start_time: iso(T0 - 20 * J) }),
      'I-NOUVEAU00001': abo({ status: 'CANCELLED', custom_id: 'lea@t,fr', start_time: iso(DEBUT) }) } });
  assert.equal((await w.PP.resilier('kev@t,fr', '')).annule, true);
  assert.equal(annulations(w).length, 1);
  const r = await w.PP.resilier('lea@t,fr', '');
  assert.equal(r.annule, true); assert.equal(annulations(w).length, 1, 'déjà annulé chez PayPal : rien n’est envoyé');
  // Une résiliation dont l'abonnement a été remplacé depuis (nouvelle souscription) n'arrête pas le nouveau.
  w.F.ecrire('resiliations/zoe@t,fr', { ts: T0, abo: 'I-VIEUX0000001', effet: T0 + 3 * J, annulerLe: T0 });
  w.F.ecrire('users/zoe@t,fr', { role: 'athlete', paypalSubscriptionId: 'I-NEUF00000001' });
  assert.equal(await w.PP.resiliationsDues(T0 + 60e3), 1);
  assert.equal(annulations(w).length, 1);
  assert.equal(w.F.lire('resiliations/zoe@t,fr/etat'), 'remplace');
});

await test('annulation directe chez PayPal pendant l’engagement : l’accès n’est pas prolongé, ligne « rupture_engagement » et push à l’administrateur', async () => {
  const w = monde({ users: LEA({ abonnement: { formule: 'essentielle', engagementJusqu: TERME } }), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' } },
    { abonnements: { 'I-ABC12345678': abo({ status: 'CANCELLED', custom_id: 'lea@t,fr', start_time: iso(DEBUT) }) } });
  const admin = espionAdmin(w);
  assert.equal((await w.envoyer(evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-ABC12345678' }))).texte, 'rupture_engagement');
  assert.equal(w.F.lire('users/lea@t,fr/accessExpiry'), T0 + 10 * J, 'la fin payée, pas le terme de l’engagement');
  const j = Object.values(w.F.lire('paypal_journal'));
  assert.equal(j.length, 1);
  assert.equal(j[0].quoi, 'rupture_engagement');
  assert.equal(j[0].qui, 'lea@t.fr');
  assert.equal(j[0].mois_restants, Math.ceil((TERME - (T0 + 10 * J)) / MOIS));
  assert.equal(admin.length, 1);
  assert.match(admin[0].m.body, /lea@t\.fr a annulé chez PayPal : \d+ mois restants sur l’engagement/);
  // Avec une résiliation demandée dans l'app, la même annulation n'est pas une rupture.
  const w2 = monde({ users: LEA({ abonnement: { engagementJusqu: TERME } }), paypal_abonnes: { 'I-ABC12345678': 'lea@t,fr' },
    resiliations: { 'lea@t,fr': { ts: T0 - J, abo: 'I-ABC12345678', effet: TERME, annulerLe: TERME - RESIL_AVANCE_MS } } },
    { abonnements: { 'I-ABC12345678': abo({ status: 'CANCELLED', custom_id: 'lea@t,fr', start_time: iso(DEBUT) }) } });
  assert.equal((await w2.envoyer(evt('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-ABC12345678' }))).texte, 'fin_posee');
  assert.equal(w2.F.lire('paypal_journal'), null);
});

await test('la landing, les CGV, l’écran de résiliation et le Worker disent la même chose (scripts/verif/tarifs.mjs)', async () => {
  const r = spawnSync(process.execPath, [new URL('../../scripts/verif/tarifs.mjs', import.meta.url).pathname], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Résiliation : la landing, les CGV, l’écran et le Worker disent la même chose/);
  const src = readFileSync(new URL('../src/planif.js', import.meta.url), 'utf8');
  assert.match(src, /nom: 'resiliations', quand: \(p\) => apres\(p, 5, 45\), une: \(t\) => \(M\.paypal \? M\.paypal\.resiliationsDues\(t\) : null\)/);
  assert.match(src, /e\.quoi === 'resiliation_paypal'/);
  const index = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.match(index, /url\.pathname === '\/resiliation' && req\.method === 'POST'/);
  const regles = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');
  assert.match(regles, /"resiliations":\s+\{ "\.read": false, "\.write": false \}/);
});

console.log(ok + ' tests passés — au plus ' + MAX_WEBHOOK + ' sous-requêtes dans un webhook (plafond Cloudflare : 50, exigé : 46)');
