// L'avis avant le renouvellement d'un annuel (art. L215-1), sur une base en
// mémoire, un faux PayPal et un faux Systeme.io.
//   node cloudflare/test/renouvellement.test.mjs
import assert from 'node:assert/strict';
import { creerBase } from '../src/base.js';
import { creerMetier } from '../src/metier.js';
import { creerPaypal, recevoirWebhook, OFFRES_PAYPAL, PLANS_ANNUELS_SANS_ENGAGEMENT } from '../src/paypal.js';
import { avisDu, texteAvis, etiqueterSystemeio, AVIS_JOURS, AVIS_MIN_JOURS, AVIS_MAX_JOURS } from '../src/renouvellement.js';
import { travaux } from '../src/planif.js';
import { fausseBase } from './fausse-base.mjs';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const J = 864e5;
const T0 = Date.parse('2026-10-05T12:00:00+02:00');
const ANNUEL = 'P-92T09491KF550281RNK2LZWY', MENSUEL = 'P-95N51603RD882780YNJKS2QA';
const iso = (t) => new Date(t).toISOString();
const CLE = 'lea@t,fr', ABO = 'I-ANN12345678';

function monde(initial, o) {
  const F = fausseBase(initial);
  const opt = o || {};
  const w = { F, t: T0, abos: opt.abonnements || {}, sio: [], pushs: [], sioPanne: false };
  const fetchImpl = async (url, init) => {
    const u = String(url);
    if (u.endsWith('/v1/oauth2/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'tok', expires_in: 32400 }) };
    if (u.endsWith('/v1/notifications/verify-webhook-signature')) return { ok: true, status: 200, json: async () => ({ verification_status: 'SUCCESS' }) };
    const m = u.match(/\/v1\/billing\/subscriptions\/(I-[A-Z0-9]+)$/);
    if (m) { const s = w.abos[m[1]]; return s ? { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(s)) } : { ok: false, status: 404, json: async () => ({}) }; }
    if (u.startsWith('https://api.systeme.io/')) {
      w.sio.push({ methode: init.method, chemin: u.slice('https://api.systeme.io/api'.length), corps: init.body ? JSON.parse(init.body) : null, cle: init.headers['X-API-Key'] });
      if (w.sioPanne) return { ok: false, status: 500, json: async () => ({}) };
      if (init.method === 'GET') return { ok: true, status: 200, json: async () => ({ items: opt.contactExiste ? [{ id: 77, email: 'lea@t.fr' }] : [] }) };
      if (init.method === 'POST' && u.endsWith('/contacts')) return { ok: true, status: 201, json: async () => ({ id: 88 }) };
      return { ok: true, status: init.method === 'DELETE' ? 404 : 204, json: async () => null };
    }
    return F.fetchImpl(url, init);
  };
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl });
  const M = creerMetier({ db, fetchImpl, maintenant: () => w.t });
  // La notification : doublure (le chiffrement a ses propres tests).
  M.envoyerPush = async (uid, message, oo) => { w.pushs.push({ uid, message, oo }); return { envoye: opt.sansTelephone ? 0 : 1 }; };
  const env = Object.assign({ PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'sec', PAYPAL_WEBHOOK_ID: 'wh' }, opt.env || {});
  w.ctx = { db, M, env, fetchImpl, maintenant: () => w.t };
  w.PP = creerPaypal(w.ctx);
  M.paypal = w.PP;
  w.M = M;
  w.envoyer = async (e) => { const r = await recevoirWebhook(new Request('https://s.t/paypal', { method: 'POST', body: JSON.stringify(e) }), w.ctx); return r.text(); };
  return w;
}
let n = 0;
const evt = (type, ress) => ({ id: 'WH-' + (++n), event_type: type, resource: ress, create_time: iso(T0 + n * 1000) });
const vente = (abo, montant) => ({ id: 'S' + (++n), billing_agreement_id: abo, amount: { total: montant, currency: 'EUR' } });
const LEA = () => ({ [CLE]: { role: 'athlete', status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active', paypalSubscriptionId: ABO, fname: 'Léa', email: 'lea@t.fr' } });
const SIO = { SYSTEMEIO_API_KEY: 'k', SYSTEMEIO_TAG_RENOUVELLEMENT: '42', SYSTEMEIO_CHAMP_ECHEANCE: 'date_renouvellement', SYSTEMEIO_CHAMP_MONTANT: 'montant_renouvellement' };

await test('PURE avisDu : la fenêtre légale (au plus tôt 3 mois, au plus tard 1 mois), une fois par échéance', async () => {
  assert.ok(AVIS_MIN_JOURS < AVIS_JOURS && AVIS_JOURS < AVIS_MAX_JOURS);
  assert.equal(avisDu(T0 + 61 * J, T0, null).envoyer, false);
  assert.deepEqual(avisDu(T0 + 60 * J, T0, null), { envoyer: true, tardif: false, jours: 60 });
  assert.equal(avisDu(T0 + 60 * J, T0, T0 + 60 * J).envoyer, false);          // déjà parti pour celle-ci
  assert.equal(avisDu(T0 + 60 * J, T0, T0 - 305 * J).envoyer, true);          // parti l'an dernier : celle-ci reste due
  assert.deepEqual(avisDu(T0 + 20 * J, T0, null), { envoyer: true, tardif: true, jours: 20 });
  assert.equal(avisDu(T0 - J, T0, null).envoyer, false);                      // échue
});

await test('PURE texteAvis : la date et le montant de PayPal, le chemin de résiliation de l’app', async () => {
  const x = texteAvis({ prenom: 'Léa', formule: 'essentielle', echeance: Date.parse('2027-10-05T10:00:00Z'), montantCentimes: 9500 });
  assert.equal(x.date, '5 octobre 2027');
  assert.equal(x.montant, '95,00 €');
  assert.match(x.title, /se renouvelle le 5 octobre 2027/);
  assert.match(x.body, /^Léa, ton abonnement Essentielle sera reconduit pour un an le 5 octobre 2027 \(95,00 € au dernier paiement\)/);
  assert.match(x.body, /Réglages → Mon abonnement → Résilier/);
  assert.doesNotMatch(texteAvis({ formule: 'ultime', echeance: T0 }).body, /au dernier paiement/);
});

await test('les plans annuels (anciens et sans engagement) sont marqués annuels, les mensuels non', async () => {
  assert.equal(OFFRES_PAYPAL[ANNUEL].annuel, true);
  assert.equal(OFFRES_PAYPAL['P-16Y44630WF304553UNK2LZXI'].annuel, true);
  assert.ok(!OFFRES_PAYPAL[MENSUEL].annuel);
  for (const p of Object.values(PLANS_ANNUELS_SANS_ENGAGEMENT)) if (p.id) assert.equal(OFFRES_PAYPAL[p.id].annuel, true);
});

await test('le paiement d’un annuel note la prochaine échéance ; un mensuel ne note rien', async () => {
  const fin = T0 + 365 * J;
  const w = monde({ users: LEA(), paypal_abonnes: { [ABO]: CLE, 'I-MEN12345678': 'mo@t,fr' } },
    { abonnements: { [ABO]: { status: 'ACTIVE', plan_id: ANNUEL, billing_info: { next_billing_time: iso(fin) } },
      'I-MEN12345678': { status: 'ACTIVE', plan_id: MENSUEL, billing_info: { next_billing_time: iso(T0 + 30 * J) } } } });
  w.F.ecrire('users/mo@t,fr', { role: 'athlete', status: 'AUTONOMIE_PREMIUM', paypalSubscriptionId: 'I-MEN12345678' });
  await w.envoyer(evt('PAYMENT.SALE.COMPLETED', vente(ABO, '114.00')));
  assert.deepEqual(w.F.lire('renouvellements/' + CLE), { abo: ABO, echeance: fin, formule: 'essentielle', montant: 11400 });
  await w.envoyer(evt('PAYMENT.SALE.COMPLETED', vente('I-MEN12345678', '9.50')));
  assert.equal(w.F.lire('renouvellements/mo@t,fr'), null);
});

await test('une résiliation retire l’échéance : plus de reconduction, plus d’avis', async () => {
  const w = monde({ users: LEA(), paypal_abonnes: { [ABO]: CLE }, renouvellements: { [CLE]: { abo: ABO, echeance: T0 + 50 * J, formule: 'essentielle' } } },
    { abonnements: { [ABO]: { status: 'CANCELLED', plan_id: ANNUEL, billing_info: { next_billing_time: iso(T0 + 50 * J) } } } });
  await w.envoyer(evt('BILLING.SUBSCRIPTION.CANCELLED', { id: ABO }));
  assert.equal(w.F.lire('renouvellements/' + CLE), null);
});

await test('l’avis part à J-60 : notification urgente et étiquette Systeme.io, une seule fois', async () => {
  const ech = T0 + 60 * J;
  const w = monde({ users: LEA(), renouvellements: { [CLE]: { abo: ABO, echeance: ech, formule: 'essentielle', montant: 9500 } } }, { env: SIO });
  assert.equal(await w.PP.avisRenouvellementUn(CLE, T0), 'avis_envoye');
  assert.equal(w.pushs.length, 1);
  assert.equal(w.pushs[0].oo.urgent, true);
  assert.match(w.pushs[0].message.body, /reconduit pour un an/);
  const ch = w.sio.map((x) => x.methode + ' ' + x.chemin);
  assert.deepEqual(ch, ['GET /contacts?email=lea%40t.fr', 'POST /contacts', 'DELETE /contacts/88/tags/42', 'POST /contacts/88/tags']);
  assert.deepEqual(w.sio[1].corps.fields.map((f) => f.slug), ['first_name', 'date_renouvellement', 'montant_renouvellement']);
  assert.deepEqual(w.sio[3].corps, { tagId: 42 });
  const r = w.F.lire('renouvellements/' + CLE);
  assert.equal(r.avisPour, ech); assert.equal(r.avisLe, T0); assert.equal(r.email, 'envoye'); assert.equal(r.push, 1);
  // Le lendemain : rien de plus.
  w.t = T0 + J;
  assert.equal(await w.PP.avisRenouvellementUn(CLE, w.t), 'pas_encore');
  assert.equal(w.pushs.length, 1);
});

await test('contact Systeme.io existant : ses champs sont mis à jour, pas de doublon', async () => {
  const w = monde({ users: LEA(), renouvellements: { [CLE]: { abo: ABO, echeance: T0 + 40 * J, formule: 'ultime' } } }, { env: SIO, contactExiste: true });
  await w.PP.avisRenouvellementUn(CLE, T0);
  assert.deepEqual(w.sio.map((x) => x.methode + ' ' + x.chemin), ['GET /contacts?email=lea%40t.fr', 'PATCH /contacts/77', 'DELETE /contacts/77/tags/42', 'POST /contacts/77/tags']);
});

await test('sans Systeme.io configuré : la notification seule, noté « non_configure »', async () => {
  const w = monde({ users: LEA(), renouvellements: { [CLE]: { abo: ABO, echeance: T0 + 45 * J, formule: 'essentielle' } } });
  assert.equal(await w.PP.avisRenouvellementUn(CLE, T0), 'avis_envoye');
  assert.equal(w.sio.length, 0);
  assert.equal(w.F.lire('renouvellements/' + CLE + '/email'), 'non_configure');
});

await test('aucun canal n’a porté : l’avis n’est pas noté parti, il se retente le lendemain', async () => {
  const w = monde({ users: LEA(), renouvellements: { [CLE]: { abo: ABO, echeance: T0 + 45 * J, formule: 'essentielle' } } }, { env: SIO, sansTelephone: true });
  w.sioPanne = true;
  assert.equal(await w.PP.avisRenouvellementUn(CLE, T0), 'avis_en_echec');
  assert.equal(w.F.lire('renouvellements/' + CLE + '/avisPour'), null);
  assert.match(w.F.lire('renouvellements/' + CLE + '/dernierEchec/email'), /^erreur : Systeme\.io GET/);
  w.sioPanne = false; w.t = T0 + J;
  assert.equal(await w.PP.avisRenouvellementUn(CLE, w.t), 'avis_envoye');
  assert.equal(w.F.lire('renouvellements/' + CLE + '/dernierEchec'), null);
});

await test('un renouvellement payé garde l’avis de CETTE échéance et rouvre le suivant', async () => {
  const ech = T0 + 30 * J, suivante = ech + 365 * J;
  const w = monde({ users: LEA(), paypal_abonnes: { [ABO]: CLE }, renouvellements: { [CLE]: { abo: ABO, echeance: ech, formule: 'essentielle', avisPour: ech, avisLe: T0 } } },
    { abonnements: { [ABO]: { status: 'ACTIVE', plan_id: ANNUEL, billing_info: { next_billing_time: iso(suivante) } } } });
  w.t = ech + 3600e3;
  await w.envoyer(evt('PAYMENT.SALE.COMPLETED', vente(ABO, '114.00')));
  const r = w.F.lire('renouvellements/' + CLE);
  assert.equal(r.echeance, suivante); assert.equal(r.avisPour, undefined);
  assert.equal(avisDu(r.echeance, w.t, r.avisPour).envoyer, false);       // dans un an seulement
});

await test('le travail quotidien « renouvellement » existe et lit renouvellements/', async () => {
  const w = monde({ users: LEA(), renouvellements: { [CLE]: { abo: ABO, echeance: T0 + 10 * J, formule: 'essentielle' } } });
  const job = travaux(w.M).find((x) => x.nom === 'renouvellement');
  assert.ok(job);
  assert.equal(job.quand({ heure: 11, minute: 0 }), true);
  assert.equal(job.quand({ heure: 9, minute: 0 }), false);
  assert.deepEqual(await job.cles(), [CLE]);
  assert.equal(await job.un(CLE, T0), 'avis_envoye');
});

await test('etiqueterSystemeio : sans clé ou étiquette non numérique, rien ne part', async () => {
  let appels = 0;
  const f = async () => { appels++; return { ok: true, status: 200, json: async () => ({}) }; };
  assert.equal(await etiqueterSystemeio({}, f, { email: 'a@b.fr' }), 'non_configure');
  assert.equal(await etiqueterSystemeio({ SYSTEMEIO_API_KEY: 'k', SYSTEMEIO_TAG_RENOUVELLEMENT: 'abc' }, f, { email: 'a@b.fr' }), 'non_configure');
  assert.equal(await etiqueterSystemeio(SIO, f, { email: 'pas-une-adresse' }), 'sans_email');
  assert.equal(appels, 0);
});

console.log('\n' + ok + ' tests verts (avis L215-1).');
