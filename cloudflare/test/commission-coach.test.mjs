// La commission du coach sur ses athlètes devenus abonnés (commission-coach.js),
// de bout en bout par le webhook PayPal.   node cloudflare/test/commission-coach.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { creerBase } from '../src/base.js';
import { creerMetier } from '../src/metier.js';
import { recevoirWebhook } from '../src/paypal.js';
import { fausseBase, appareil } from './fausse-base.mjs';
import ATT from '../../functions/attribution-calcul.js';
import * as CC from '../src/commission-coach.js';

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
  const fetchImpl = async (url, init) => {
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
  w.envoyer = async (type, ress) => {
    const e = { id: 'WH-' + (++n), event_type: type, resource: ress, create_time: iso(w.t) };
    const r = await recevoirWebhook(new Request('https://s.t/paypal', { method: 'POST', body: JSON.stringify(e) }), w.ctx);
    return { status: r.status, texte: await r.text() };
  };
  w.journal = () => Object.values(w.F.lire('paypal_journal') || {});
  w.com = () => Object.values((w.F.lire('ambassadeurs/LEAFIT/commissions') || {})[Object.keys(w.F.lire('ambassadeurs/LEAFIT/commissions') || {})[0]] || {})[0];
  return w;
}
let n = 0;
const vente = (id, montant) => ({ id, billing_agreement_id: ABO, amount: { total: montant || '9.50', currency: 'EUR' }, create_time: iso(T0) });
const rembourse = (id, montant, rid) => ({ id: rid || ('R' + (++n) + 'XXXXXXX'), sale_id: id, amount: { total: montant || '9.50', currency: 'EUR' }, reason: 'geste commercial' });

const SAM = 'sam@t,fr';
const CODE = CC.codeCoach(SAM);
// Léa : athlète de Sam (coach externe) ; son code a pris fin il y a `jours` jours ;
// elle s'abonne à Essentielle (9,50 €).
function base(jours, o) {
  const x = o || {};
  return {
    users: { 'lea@t,fr': Object.assign({ role: 'athlete', status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active', paypalSubscriptionId: ABO, fname: 'Léa',
      coachEmailKey: SAM, accessExpiry: T0 - jours * J }, x.lea),
      [SAM]: Object.assign({ role: 'coach', fname: 'Sam' }, x.sam) },
    coachs: { [SAM]: { clients: x.pasClient ? {} : { 'lea@t,fr': true } } },
    paypal_abonnes: { [ABO]: 'lea@t,fr' },
    ...(x.amb ? { ambassadeurs: { LEAFIT: { nom: 'Léa Fit', actif: true, commissionPct: 20, secret: 'a'.repeat(24), filleuls: { fx: { inscritLe: 1 } } } },
      ambassadeurs_liens: { 'lea@t,fr': { code: 'LEAFIT', id: 'fx', le: 1 } } } : {}),
    push: { [KEV]: { x: null } },
  };
}
const coms = (w, code) => { const c = w.F.lire('ambassadeurs/' + code + '/commissions') || {}; return Object.values(c).flatMap((m) => Object.values(m)); };
async function payer(w, id) {
  const r = await w.envoyer('PAYMENT.SALE.COMPLETED', vente(id || 'SALE0000001'));
  assert.equal(r.texte, 'premier_paiement');
}

await test('le code du coach : stable, au format des ambassadeurs, différent d’un coach à l’autre', () => {
  assert.equal(CC.codeCoach(SAM), CC.codeCoach(SAM));
  assert.match(CODE, /^[A-Z0-9]{3,16}$/);
  assert.notEqual(CC.codeCoach('sam@t,fr'), CC.codeCoach('sam@t,com'));
});

await test('fenêtre de 90 jours : 89 jours après la fin du code, le coach est crédité comme un ambassadeur', async () => {
  const w = monde(base(89));
  await payer(w);
  const lien = w.F.lire('ambassadeurs_liens/lea@t,fr');
  assert.equal(lien.code, CODE);
  assert.equal(lien.coach, true);
  const fiche = w.F.lire('ambassadeurs/' + CODE);
  assert.equal(fiche.type, 'coach');
  assert.equal(fiche.coach, SAM);
  assert.equal(fiche.nom, 'Coach Sam');
  assert.equal(w.F.lire('ambassadeurs_publics/' + CODE), null, 'pas un code d’invitation');
  const c = coms(w, CODE);
  assert.equal(c.length, 1);
  assert.equal(c[0].pct, 20, 'le taux de la décision commune');
  assert.equal(c[0].commission, 1.9);
  assert.equal(c[0].dueLe - c[0].payeLe, 30 * J, 'due à J+30');
  // Le tableau du coach.
  const v = w.F.lire('coach_commissions_vue/' + SAM);
  assert.equal(v.convertis, 1);
  assert.equal(v.commissionMois, 1.9);
  // Le paiement suivant (mois 2) : même règle que pour un ambassadeur aujourd'hui
  // (paypal.js ne commissionne que le premier paiement d'un abonnement), sans recompter l'athlète.
  w.t = T0 + 31 * J;
  await w.envoyer('PAYMENT.SALE.COMPLETED', Object.assign(vente('SALE0000002'), { create_time: iso(w.t) }));
  assert.equal(coms(w, CODE).length, 1);
  assert.equal(w.F.lire('coach_commissions_vue/' + SAM).convertis, 1);
});

await test('fenêtre de 90 jours : 91 jours après, rien ; payer pendant le code compte aussi', async () => {
  const w = monde(base(91));
  await payer(w);
  assert.equal(w.F.lire('ambassadeurs_liens/lea@t,fr'), null);
  assert.equal(w.F.lire('ambassadeurs/' + CODE), null);
  assert.equal(w.F.lire('coach_commissions_vue/' + SAM), null);
  const w2 = monde(base(-10));
  await payer(w2);
  assert.equal(w2.F.lire('ambassadeurs_liens/lea@t,fr').code, CODE);
  // Pur : les bornes exactes.
  const o = { athlete: 'lea@t,fr', coach: SAM, roleCoach: 'coach', rattache: true, finCode: T0 };
  assert.equal(CC.eligibilite(Object.assign({}, o, { t: T0 + 90 * J })).ok, true);
  assert.equal(CC.eligibilite(Object.assign({}, o, { t: T0 + 90 * J + 1 })).raison, 'hors_fenetre');
});

await test('pas de double commission : un athlète déjà rattaché à un ambassadeur reste à l’ambassadeur', async () => {
  const w = monde(base(10, { amb: true }));
  await payer(w);
  assert.equal(w.F.lire('ambassadeurs_liens/lea@t,fr').code, 'LEAFIT');
  assert.equal(coms(w, 'LEAFIT').length, 1);
  assert.equal(w.F.lire('ambassadeurs/' + CODE), null);
  assert.equal(coms(w, CODE).length, 0);
  assert.equal(CC.eligibilite({ athlete: 'a', coach: SAM, roleCoach: 'coach', rattache: true, finCode: T0, t: T0, lienAmb: { code: 'X' } }).raison, 'deja_ambassadeur');
});

await test('rien sans rattachement réel : ni sans coachs/<coach>/clients, ni pour un non-coach, ni pour Kevin, ni sans code', async () => {
  for (const [o, raison] of [[{ pasClient: true }, 'non_rattache'], [{ sam: { role: 'athlete' } }, 'pas_coach'],
    [{ lea: { coachEmailKey: KEV } }, 'createur'], [{ lea: { accessExpiry: null } }, 'sans_code'], [{ lea: { coachEmailKey: null } }, 'sans_coach']]) {
    const w = monde(base(10, o));
    assert.equal((await w.M.lierCoachCommission('lea@t,fr', T0)).raison, raison, raison);
    await payer(w);
    assert.equal(w.F.lire('ambassadeurs_liens/lea@t,fr'), null, raison);
  }
});

await test('le code du coach ne vaut pas code ambassadeur, et un remboursement annule la commission du coach', async () => {
  const w = monde(base(5));
  await payer(w);
  // Un autre athlète tape le code du coach comme code ambassadeur : refusé.
  w.F.ecrire('users/zoe@t,fr', { role: 'athlete', createdAt: T0 });
  assert.equal((await w.M.ambassadeurDemande('zoe@t,fr', { code: CODE })).raison, 'code_inconnu');
  w.t = T0 + 3 * J;
  assert.equal((await w.envoyer('PAYMENT.SALE.REFUNDED', rembourse('SALE0000001'))).texte, 'remboursement');
  assert.equal(coms(w, CODE)[0].statut, 'annulee');
  assert.equal(w.F.lire('coach_commissions_vue/' + SAM).commissionMois, 0);
});

await test('un achat qui n’est pas un abonnement (un programme de la boutique) ne rattache pas le coach', async () => {
  const b = base(5); b.boutique = { prog1: { prixCts: 1490 } };
  const w = monde(b, { commandes: { ORDPROG001: { id: 'ORDPROG001', purchase_units: [{ custom_id: 'lea@t,fr|prog1', amount: { currency_code: 'EUR', value: '14.90' } }] } } });
  const r = await w.envoyer('PAYMENT.CAPTURE.COMPLETED', { id: 'CAPP0001', status: 'COMPLETED', amount: { currency_code: 'EUR', value: '14.90' },
    supplementary_data: { related_ids: { order_id: 'ORDPROG001' } } });
  assert.equal(r.status, 200);
  assert.ok(w.F.lire('paypal_premiers/lea@t,fr'), 'le premier paiement du compte est bien passé');
  assert.equal(w.F.lire('ambassadeurs_liens/lea@t,fr'), null);
  assert.equal(w.F.lire('ambassadeurs/' + CODE), null);
});

console.log(ok + ' tests passés');
