// Les droits décidés par le serveur seul (droits-serveur.js, /fn/droits) : l'essai,
// le rattrapage des comptes d'avant, l'achat vérifié, l'écran Accès.
//   node cloudflare/test/droits-serveur.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { creerBase } from '../src/base.js';
import { creerMetier } from '../src/metier.js';
import { recevoirWebhook, creerPaypal } from '../src/paypal.js';
import { creerDroits, essaiServeur, champsAcces, ESSAI_JOURS, BONUS_JOURS } from '../src/droits-serveur.js';
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
  w.D = creerDroits({ db, M: w.M, paypal: creerPaypal(w.ctx), maintenant: () => w.t });
  w.appel = (email, data) => w.D.appel({ auth: { email }, data });
  w.droits = (k) => { const d = w.F.lire('droits/' + (k || 'lea@t,fr')); if (d) delete d.maj; return d; };
  return w;
}

const LEA = 'lea@t,fr', EL = 'lea@t.fr';
const ath = (u) => ({ [LEA]: Object.assign({ role: 'athlete', createdAt: T0 - 2 * J }, u) });
const cmd = (custom, value, statut) => ({ status: statut || 'COMPLETED', purchase_units: [{ custom_id: custom, amount: { currency_code: 'EUR', value },
  payments: { captures: [{ id: 'CAPX0001', status: statut || 'COMPLETED', amount: { currency_code: 'EUR', value }, create_time: iso(T0 - 5 * J) }] } }] });

await test('l’essai s’ouvre UNE fois, au serveur : un second appel ne rallonge rien', async () => {
  const w = monde({ users: ath() });
  const r = await w.appel(EL, { action: 'essai' });
  assert.equal(r.ok, true);
  // La plus ancienne date connue : la création du compte, il y a deux jours.
  assert.equal(r.droits.essaiOuvertLe, T0 - 2 * J);
  assert.equal(r.droits.essaiFinit, T0 - 2 * J + ESSAI_JOURS * J);
  assert.equal(r.droits.palier, 'aucun', 'l’essai ne pose pas de palier payé');
  w.t = T0 + 40 * J;
  const r2 = await w.appel(EL, { action: 'essai' });
  assert.equal(r2.droits.essaiFinit, T0 - 2 * J + ESSAI_JOURS * J, 'pas de second essai');
});

await test('un dossier trafiqué ne prolonge pas l’essai : ni essai.ouvertLe à venir, ni essai.finit, ni createdAt à venir', async () => {
  const w = monde({ users: ath({ createdAt: T0 + 300 * J, essai: { ouvertLe: T0 + 200 * J, finit: T0 + 999 * J } }) });
  const r = await w.appel(EL, { action: 'essai' });
  assert.equal(r.droits.essaiOuvertLe, T0, 'les dates à venir sont ignorées : maintenant');
  assert.equal(r.droits.essaiFinit, T0 + ESSAI_JOURS * J);
  // Rouvrir en écrivant « maintenant » dans le dossier d'un vieux compte : la création, plus ancienne, l'emporte.
  const e = essaiServeur({ ouvertLe: T0, createdAt: T0 - 200 * J, maintenant: T0 });
  assert.ok(e.essaiFinit < T0, 'un essai fini reste fini');
});

await test('le mois de l’ami : compté à l’ouverture s’il est déjà accepté, ajouté une fois s’il l’est après', async () => {
  const w = monde({ users: ath(), parrainage: { liens: { [LEA]: { parrain: 'kev@t,fr', id: 'f1' } } } });
  const r = await w.appel(EL, { action: 'essai' });
  assert.equal(r.droits.essaiFinit - r.droits.essaiOuvertLe, (ESSAI_JOURS + BONUS_JOURS) * J);
  assert.equal(await w.D.bonusEssai(LEA), null, 'déjà compté : rien de plus');
  const w2 = monde({ users: ath() });
  await w2.appel(EL, { action: 'essai' });
  const fin0 = w2.F.lire('droits/' + LEA + '/essaiFinit');
  await w2.D.bonusEssai(LEA); await w2.D.bonusEssai(LEA);
  assert.equal(w2.F.lire('droits/' + LEA + '/essaiFinit'), fin0 + BONUS_JOURS * J, 'une seule fois');
});

await test('un coach n’a pas d’essai ; un compte inconnu non plus', async () => {
  const w = monde({ users: { 'sam@t,fr': { role: 'coach' } } });
  assert.equal((await w.appel('sam@t.fr', { action: 'essai' })).raison, 'coach');
  assert.equal((await w.appel('x@t.fr', { action: 'essai' })).raison, 'compte');
});

await test('rattrapage : un programme ne passe que si sa commande est payée, pour ce compte, au prix de la boutique', async () => {
  const w = monde({ users: ath({ programmesAchetes: {
      vrai: { ordre: 'ORDVRAI001', prixCts: 1490, date: T0 - 5 * J },
      autre: { ordre: 'ORDAUTRE01', prixCts: 1490, date: T0 - 5 * J },
      faux: { ordre: 'ORDFAUX001', prixCts: 1490 },
      offert: { ordre: 'offert', prixCts: 0, source: 'offert' },
      brade: { ordre: 'ORDBRADE01', prixCts: 1490 } } }),
    boutique: { vrai: { prixCts: 1490 }, autre: { prixCts: 1490 }, faux: { prixCts: 1490 }, offert: { prixCts: 1490 }, brade: { prixCts: 1490 } } },
  { abonnements: {}, commandes: { ORDVRAI001: cmd(LEA + '|vrai', '14.90'), ORDAUTRE01: cmd('zoe@t,fr|autre', '14.90'), ORDBRADE01: cmd(LEA + '|brade', '1.00') } });
  const r = await w.appel(EL, { action: 'rattraper' });
  assert.deepEqual(Object.keys(r.droits.programmes || {}), ['vrai']);
  assert.deepEqual(r.rapport.refuses.sort(), ['autre', 'brade', 'faux', 'offert']);
  assert.equal(r.droits.programmes.vrai.source, 'rattrapage');
  assert.ok(r.droits.rattrapeLe > 0);
  // 30 jours d'Ultime comptés depuis l'achat d'il y a cinq jours, pas depuis le rattrapage.
  assert.equal(r.droits.ultimeJusqu, T0 - 5 * J + MOIS);
});

await test('rattrapage : l’essai d’avant est repris (fin recalculée), l’abonnement relu chez PayPal', async () => {
  const w = monde({ users: ath({ essai: { ouvertLe: T0 - 10 * J, finit: T0 + 500 * J }, paypalSubscriptionId: ABO }) });
  const r = await w.appel(EL, { action: 'rattraper' });
  assert.equal(r.droits.essaiFinit, T0 - 10 * J + ESSAI_JOURS * J, 'essai.finit du dossier ignoré');
  assert.equal(r.droits.palier, 'ultime');
  assert.equal(r.rapport.abonnement, 'ouvert');
  // L'abonnement d'un autre compte ne s'attribue pas.
  const w2 = monde({ users: ath({ paypalSubscriptionId: 'I-ZOE12345678' }) },
    { abonnements: { 'I-ZOE12345678': { status: 'ACTIVE', plan_id: ULT, custom_id: 'zoe@t,fr' } } });
  const r2 = await w2.appel(EL, { action: 'rattraper' });
  assert.equal(r2.droits.palier, 'aucun');
  assert.equal(r2.rapport.abonnement, 'autre_compte');
});

await test('rattrapage : un dossier « AUTONOMIE_PREMIUM » sans abonnement vérifiable n’ouvre rien', async () => {
  const w = monde({ users: ath({ status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active', abonnement: { formule: 'ultime' } }) }, { abonnements: {} });
  const r = await w.appel(EL, { action: 'rattraper' });
  assert.equal(r.droits.palier, 'aucun');
  assert.equal(r.droits.source, 'rattrapage');
});

await test('achat vérifié à la demande : autre compte, autre montant, commande impayée refusés ; le bon passe', async () => {
  const w = monde({ users: ath(), boutique: { p1: { prixCts: 1490 } } }, { abonnements: {}, commandes: {
    ORDZOE0001: cmd('zoe@t,fr|p1', '14.90'), ORDPEU0001: cmd(LEA + '|p1', '0.10'), ORDATT0001: cmd(LEA + '|p1', '14.90', 'APPROVED'), ORDBON0001: cmd(LEA + '|p1', '14.90') } });
  for (const [o, raison] of [['ORDZOE0001', 'autre_compte'], ['ORDPEU0001', 'montant'], ['ORDATT0001', 'non_payee'], ['pas-un-ordre', 'format']])
    assert.equal((await w.appel(EL, { action: 'verifierAchat', ordre: o, programme: 'p1' })).raison, raison);
  assert.equal(w.F.lire('droits/' + LEA + '/programmes'), null);
  const r = await w.appel(EL, { action: 'verifierAchat', ordre: 'ORDBON0001', programme: 'p1' });
  assert.equal(r.ok, true);
  assert.equal(r.droits.programmes.p1.prixCts, 1490);
  assert.equal(r.droits.ultimeJusqu, T0 - 5 * J + MOIS, '30 jours depuis la capture');
  assert.equal(w.F.lire('users/' + LEA + '/programmesAchetes/p1/ordre'), 'ORDBON0001', 'le dossier garde sa fiche');
});

await test('l’écran Accès : le créateur seul ; « rouvrir » garde l’essai et les programmes', async () => {
  const w = monde({ users: ath(), droits: { [LEA]: { palier: 'ultime', echeance: 0, source: 'main', essaiOuvertLe: 1, essaiFinit: 2,
    programmes: { p1: { le: 1, prixCts: 1490, source: 'paypal' } } } } });
  assert.equal((await w.appel(EL, { action: 'poser', email: EL, champs: { palier: 'ultime', echeance: 0, source: 'main' } })).raison, 'createur');
  const k = await w.appel('guellec.coachingpro@gmail.com', { action: 'poser', email: EL, champs: { palier: 'aucun', source: 'suspension', avant: 'ultime', essaiFinit: 9e12, programmes: { x: 1 } } });
  assert.equal(k.ok, true);
  assert.equal(k.droits.palier, 'aucun');
  assert.equal(k.droits.essaiFinit, 2, 'l’écran Accès ne touche pas à l’essai');
  assert.deepEqual(Object.keys(k.droits.programmes), ['p1'], 'ni aux programmes');
  const r = await w.appel('guellec.coachingpro@gmail.com', { action: 'poser', email: EL, champs: null });
  assert.equal(r.droits.palier, undefined);
  assert.equal(r.droits.source, 'rattrapage');
  assert.equal(r.droits.essaiFinit, 2);
  assert.ok(r.droits.programmes.p1);
  assert.equal(champsAcces({ palier: 'roi' }), null);
});

console.log(ok + ' tests passés');
