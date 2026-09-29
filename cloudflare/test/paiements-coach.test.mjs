// Le paiement direct au coach : la commande va sur SON compte, RepCore ne prend rien.
//   node --test cloudflare/test/paiements-coach.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { creerBase } from '../src/base.js';
import { creerMetier } from '../src/metier.js';
import { creerPaypal } from '../src/paypal.js';
import * as PC from '../src/paiements-coach.js';
import { fausseBase } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const T0 = Date.parse('2026-10-05T12:00:00+02:00');
const J = 864e5, MOIS = 30 * J;
const COACH = 'kev@t,fr', LEA = 'lea@t,fr', MARCHAND = 'ABCDEFGH12345';

// Un faux PayPal Orders v2 : crée, relit, capture, et refuse un bénéficiaire inconnu.
function monde(initial, o) {
  const F = fausseBase(initial);
  const opt = o || {};
  const w = { F, commandes: {}, crees: [], t: T0, n: 0 };
  const rep = (status, j) => ({ ok: status < 400, status, json: async () => JSON.parse(JSON.stringify(j)) });
  const fetchImpl = async (url, init) => {
    const u = String(url);
    if (u.endsWith('/v1/oauth2/token')) return rep(200, { access_token: 'tok', expires_in: 32400 });
    if (u.endsWith('/v2/checkout/orders') && init.method === 'POST') {
      const b = JSON.parse(init.body);
      w.crees.push(b);
      const p = b.purchase_units[0].payee || {};
      if (p.merchant_id === 'INCONNU000000' || p.email_address === 'inconnu@paypal.fr') return rep(422, { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'PAYEE_ACCOUNT_INVALID' }] });
      const id = 'ORD' + String(++w.n).padStart(6, '0');
      w.commandes[id] = { id, status: 'CREATED', purchase_units: [Object.assign({}, b.purchase_units[0])],
        links: [{ rel: 'payer-action', href: 'https://www.paypal.com/checkoutnow?token=' + id }] };
      return rep(201, w.commandes[id]);
    }
    let m = u.match(/\/v2\/checkout\/orders\/([A-Z0-9]+)\/capture$/);
    if (m) {
      const c = w.commandes[m[1]];
      if (!c) return rep(404, {});
      const pu = c.purchase_units[0];
      pu.payments = { captures: [{ id: 'CAP' + m[1], status: 'COMPLETED', amount: Object.assign({}, pu.amount) }] };
      c.status = 'COMPLETED';
      return rep(201, c);
    }
    m = u.match(/\/v2\/checkout\/orders\/([A-Z0-9]+)$/);
    if (m) return w.commandes[m[1]] ? rep(200, w.commandes[m[1]]) : rep(404, {});
    return F.fetchImpl(url, init);
  };
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl });
  const M = creerMetier({ db, vapid: VAPID, fetchImpl, maintenant: () => w.t });
  const env = { PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'sec', PAYPAL_WEBHOOK_ID: 'wh', PAIEMENTS_COACH: opt.ferme ? '' : 'oui' };
  w.ctx = { db, M, env, fetchImpl, maintenant: () => w.t };
  w.P = PC.creerPaiementsCoach(w.ctx);
  w.appel = (email, data) => w.P.appel({ auth: { email }, data });
  return w;
}
const BASE = () => ({
  users: { [COACH]: { role: 'coach', coachPlan: 'pro' }, [LEA]: { role: 'athlete', fname: 'Léa' } },
  slugs: { 'kevin-guellec': COACH },
  vitrines: { 'kevin-guellec': { nom: 'Kévin', formules: ['coaching_essentiel', 'coaching_transfo'] } },
});
const chercher = (o, cle) => JSON.stringify(o).toLowerCase().indexOf(cle) >= 0;

// ── PURES ─────────────────────────────────────────────────────────────────
test('la commande : le bénéficiaire est le coach, le prix vient de tarifs.json, AUCUN frais de plateforme', () => {
  const c = PC.corpsCommande({ coach: COACH, athlete: LEA, formule: 'coaching_transfo', marchand: { type: 'merchant_id', valeur: MARCHAND }, retour: 'r', annulation: 'a' });
  const pu = c.purchase_units[0];
  assert.deepEqual(pu.payee, { merchant_id: MARCHAND });
  assert.equal(pu.custom_id, COACH + '|' + LEA + '|coaching_transfo');
  assert.deepEqual(pu.amount, { currency_code: 'EUR', value: '350.00' });
  for (const k of ['platform_fees', 'payment_instruction', 'disbursement', 'payee_pricing']) assert.equal(chercher(c, k), false, k);
  assert.equal(PC.prixFormule('boutique_prog'), null, 'le programme de la boutique ne passe pas ici');
  assert.equal(PC.prixFormule('inconnue'), null);
});

test('l’identifiant marchand : 13 caractères, ou une adresse PayPal ; le reste est refusé', () => {
  assert.deepEqual(PC.marchandNet(' abcdefgh12345 '), { type: 'merchant_id', valeur: MARCHAND });
  assert.deepEqual(PC.marchandNet('Coach@Exemple.FR'), { type: 'email_address', valeur: 'coach@exemple.fr' });
  for (const v of ['', 'ABC', 'ABCDEFGH123456', 'pas un id', 'a@b', '<script>@x.fr']) assert.equal(PC.marchandNet(v), null, v);
  assert.deepEqual(PC.lireCustomId('a|b|coaching_essentiel'), { coach: 'a', athlete: 'b', formule: 'coaching_essentiel' });
  for (const c of ['a|b', 'a|b|c|d', 'a|b|boutique_prog', 'a.b|c|coaching_essentiel', 'verification']) assert.equal(PC.lireCustomId(c), null, c);
});

test('prolonger, ne pas écraser : un suivi en cours s’allonge de la durée payée', () => {
  assert.deepEqual(PC.droitsApresPaiement({}, 'coaching_essentiel', T0), { suiviJusqu: T0 + MOIS });
  assert.deepEqual(PC.droitsApresPaiement({ suiviJusqu: T0 + 10 * J, palier: 'essentielle', echeance: 0 }, 'coaching_transfo', T0), { suiviJusqu: T0 + 10 * J + 3 * MOIS });
  assert.deepEqual(PC.droitsApresPaiement({ suiviJusqu: T0 - J }, 'coaching_essentiel', T0), { suiviJusqu: T0 + MOIS }, 'une fin passée repart d’aujourd’hui');
  assert.deepEqual(PC.droitsApresPaiement({ ultimeJusqu: T0 + J }, 'programme_perso', T0), { ultimeJusqu: T0 + J + 3 * MOIS });
  assert.deepEqual(PC.droitsApresRemboursement({ suiviJusqu: T0 + MOIS }, 'coaching_essentiel', T0 + J), { suiviJusqu: T0 + J });
});

// ── RELIER ────────────────────────────────────────────────────────────────
test('relier : format, palier, puis PayPal lui-même ; fermé tant que PAIEMENTS_COACH ≠ oui', async () => {
  const w = monde(BASE());
  assert.deepEqual(await w.appel('kev@t.fr', { action: 'relier', marchand: 'n importe quoi' }), { relie: false, raison: 'format' });
  assert.deepEqual(await w.appel('kev@t.fr', { action: 'relier', marchand: 'INCONNU000000' }), { relie: false, raison: 'PAYEE_ACCOUNT_INVALID' });
  assert.equal(w.F.lire('coach_paiement/' + COACH + '/statut'), 'refuse');
  assert.deepEqual(await w.appel('kev@t.fr', { action: 'relier', marchand: MARCHAND }), { relie: true });
  assert.equal(w.F.lire('coach_paiement/' + COACH + '/marchand'), MARCHAND);
  assert.equal((await w.appel('kev@t.fr', { action: 'etat' })).statut, 'relie');
  // L'essai de liaison ne crée aucun paiement.
  assert.equal(w.F.lire('paiements_coach'), null);
  // Palier Libre : refusé.
  const w2 = monde(Object.assign(BASE(), { users: { [COACH]: { role: 'coach', coachPlan: 'libre' } } }));
  await assert.rejects(w2.appel('kev@t.fr', { action: 'relier', marchand: MARCHAND }), /Coach et Pro/);
  // Fermé : rien ne se relie, rien ne se commande.
  const w3 = monde(BASE(), { ferme: true });
  await assert.rejects(w3.appel('kev@t.fr', { action: 'relier', marchand: MARCHAND }), /pas encore ouvert/);
  await assert.rejects(w3.appel('lea@t.fr', { coach: 'kevin-guellec', formuleId: 'coaching_essentiel' }), /pas encore ouvert/);
});

// ── COMMANDER, PAYER ──────────────────────────────────────────────────────
test('un coach non relié ne vend rien ; relié, la commande part à son nom et l’athlète passe en suivi', async () => {
  const w = monde(BASE());
  await assert.rejects(w.appel('lea@t.fr', { coach: 'kevin-guellec', formuleId: 'coaching_essentiel' }), /n’encaisse pas encore/);
  await w.appel('kev@t.fr', { action: 'relier', marchand: MARCHAND });
  await assert.rejects(w.appel('lea@t.fr', { coach: 'kevin-guellec', formuleId: 'coaching_evolution' }), /pas proposée/);
  const r = await w.appel('lea@t.fr', { coach: 'kevin-guellec', formuleId: 'coaching_essentiel', athlete: 'quelqu-un@autre,fr' });
  assert.match(r.lien, /^https:\/\/www\.paypal\.com\/checkoutnow\?token=/);
  const envoye = w.crees[w.crees.length - 1];
  assert.deepEqual(envoye.purchase_units[0].payee, { merchant_id: MARCHAND });
  assert.equal(envoye.purchase_units[0].custom_id, COACH + '|' + LEA + '|coaching_essentiel', 'l’athlète est celui de la session, jamais celui du corps');
  assert.equal(chercher(envoye, 'platform_fees'), false);
  assert.equal(w.F.lire('paiements_coach/' + COACH + '/' + r.commande + '/statut'), 'en_attente');
  // Un autre compte ne capture pas la commande de Léa.
  await assert.rejects(w.appel('tom@t.fr', { action: 'capturer', commande: r.commande }), /pas la tienne/);
  assert.deepEqual(await w.appel('lea@t.fr', { action: 'capturer', commande: r.commande }), { statut: 'recu' });
  const p = w.F.lire('paiements_coach/' + COACH + '/' + r.commande);
  assert.equal(p.statut, 'recu'); assert.equal(p.montant, 15000); assert.equal(p.athlete, LEA); assert.equal(p.formule, 'coaching_essentiel');
  assert.equal(w.F.lire('droits/' + LEA + '/suiviJusqu'), T0 + MOIS);
  // Rejouée, la capture ne rouvre pas une seconde fois.
  assert.deepEqual(await w.appel('lea@t.fr', { action: 'capturer', commande: r.commande }), { statut: 'deja' });
  assert.equal(w.F.lire('droits/' + LEA + '/suiviJusqu'), T0 + MOIS);
});

test('déjà en suivi : prolongé, et l’abonnement de base n’est pas touché', async () => {
  const b = BASE();
  b.droits = { [LEA]: { palier: 'essentielle', echeance: 0, source: 'paypal', abo: 'I-XYZ12345678', suiviJusqu: T0 + 20 * J } };
  const w = monde(b);
  await w.appel('kev@t.fr', { action: 'relier', marchand: MARCHAND });
  const r = await w.appel('lea@t.fr', { coach: 'kevin-guellec', formuleId: 'coaching_transfo' });
  await w.appel('lea@t.fr', { action: 'capturer', commande: r.commande });
  const d = w.F.lire('droits/' + LEA);
  assert.equal(d.suiviJusqu, T0 + 20 * J + 3 * MOIS);
  assert.equal(d.palier, 'essentielle'); assert.equal(d.echeance, 0); assert.equal(d.abo, 'I-XYZ12345678');
});

// ── LE WEBHOOK ────────────────────────────────────────────────────────────
test('le webhook de la capture ouvre l’accès ; arrivé avant la liaison, il est rangé puis rejoué', async () => {
  const w = monde(BASE());
  // Une commande (créée pendant une liaison passée) capturée alors que le coach n'est plus relié.
  const cmd = { id: 'ORD999999', purchase_units: [{ custom_id: COACH + '|' + LEA + '|coaching_essentiel', payee: { merchant_id: MARCHAND },
    amount: { currency_code: 'EUR', value: '150.00' } }] };
  w.commandes[cmd.id] = cmd;
  const PP = creerPaypal(w.ctx);
  const evt = { id: 'WH-C1', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAPX1', status: 'COMPLETED',
    amount: { currency_code: 'EUR', value: '150.00' }, supplementary_data: { related_ids: { order_id: cmd.id } } } };
  assert.equal(await PP.traiter(evt), 'orphelin');
  assert.ok(w.F.lire('paypal_orphelins/coach_' + COACH));
  assert.equal(w.F.lire('droits/' + LEA), null);
  // La liaison rejoue l'événement.
  await w.appel('kev@t.fr', { action: 'relier', marchand: MARCHAND });
  assert.equal(w.F.lire('paypal_orphelins/coach_' + COACH), null);
  assert.equal(w.F.lire('paiements_coach/' + COACH + '/ORD999999/statut'), 'recu');
  assert.equal(w.F.lire('droits/' + LEA + '/suiviJusqu'), T0 + MOIS);
  // Le même événement, renvoyé : rien de plus.
  assert.equal(await PP.traiter(evt), 'deja');
});

test('un montant ou un bénéficiaire faux n’ouvre rien', async () => {
  const w = monde(BASE());
  await w.appel('kev@t.fr', { action: 'relier', marchand: MARCHAND });
  const PP = creerPaypal(w.ctx);
  const mk = (id, value, payee) => { w.commandes[id] = { id, purchase_units: [{ custom_id: COACH + '|' + LEA + '|coaching_essentiel', payee, amount: { currency_code: 'EUR', value } }] };
    return { id: 'WH-' + id, event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAP' + id, status: 'COMPLETED', amount: { currency_code: 'EUR', value }, supplementary_data: { related_ids: { order_id: id } } } }; };
  assert.equal(await PP.traiter(mk('ORD111111', '1.00', { merchant_id: MARCHAND })), 'refuse');
  assert.equal(await PP.traiter(mk('ORD222222', '150.00', { merchant_id: 'AUTRECOMPTE12' })), 'refuse');
  assert.equal(w.F.lire('droits/' + LEA), null);
});

test('le remboursement : la commande passe « remboursé » et l’accès perd la durée payée', async () => {
  const w = monde(BASE());
  await w.appel('kev@t.fr', { action: 'relier', marchand: MARCHAND });
  const r = await w.appel('lea@t.fr', { coach: 'kevin-guellec', formuleId: 'coaching_essentiel' });
  await w.appel('lea@t.fr', { action: 'capturer', commande: r.commande });
  w.t = T0 + 2 * J;
  const PP = creerPaypal(w.ctx);
  const res = await PP.traiter({ id: 'WH-R1', event_type: 'PAYMENT.CAPTURE.REFUNDED', resource: { id: 'REF1', amount: { value: '150.00', currency_code: 'EUR' },
    links: [{ rel: 'up', href: 'https://api-m.paypal.com/v2/payments/captures/CAP' + r.commande }] } });
  assert.equal(res, 'rembourse_coach');
  assert.equal(w.F.lire('paiements_coach/' + COACH + '/' + r.commande + '/statut'), 'rembourse');
  assert.equal(w.F.lire('droits/' + LEA + '/suiviJusqu'), T0 + 2 * J);
});
