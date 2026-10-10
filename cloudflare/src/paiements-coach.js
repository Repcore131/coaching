// ══ LE PAIEMENT DIRECT AU COACH (Orders v2, « payer un autre compte ») ═════
//
// Un coach relié (palier Coach ou Pro, ou le créateur) se fait payer SES
// formules de coaching directement sur SON compte PayPal. RepCore crée la
// commande avec ses propres identifiants d'application, mais le bénéficiaire
// (payee) est le coach : l'argent va chez lui.
//
// ⚠ REPCORE N'ENCAISSE JAMAIS POUR LE COMPTE D'UN COACH (NOTE-DECISION-MODELE-
//   ECONOMIQUE.md §2) : pas de platform_fees, pas de reversement, pas de fonds
//   qui transitent. Un test le vérifie sur chaque commande.
// ⚠ RIEN N'EST OUVERT TANT QUE env.PAIEMENTS_COACH !== 'oui'. Le parcours
//   doit d'abord être prouvé en sandbox (README, « Paiement direct au coach ») :
//   la documentation PayPal ne dit ni qui reçoit les événements d'une
//   commande payée à un autre compte, ni si un remboursement fait depuis le
//   compte du coach nous est signalé.
// ⚠ LE PRIX EST CELUI QUE LE COACH A FIXÉ (10/10/2026) : /coachs/<coach>/
//   formules/<id> = {lib, prixCts, mois, comprend}, de 0 à 2 000 €, relu ici à
//   la commande, et le montant ainsi fixé est gardé sur la commande : la
//   capture est comparée à LUI, jamais à un montant venu de l'app, ni aux prix
//   de Kevin (tarifs.json ne sert plus qu'à ses formules à lui, coaching.js).
//   Une formule absente ou hors bornes : rien ne se vend.
//
// LE CHEMIN. L'athlète connecté demande une commande (action « commande ») ;
// PayPal lui fait approuver le paiement ; il revient dans l'app, qui demande la
// capture (action « capturer ») : l'accès s'ouvre. Le webhook
// PAYMENT.CAPTURE.COMPLETED fait la même chose, si PayPal nous l'envoie, et
// l'un ou l'autre arrivé second ne refait rien.
//
// OÙ C'EST ÉCRIT (par ce serveur seul) :
//   coach_paiement/<coach>            {marchand, type, statut, le, raison?}
//   paiements_coach/<coach>/<commande> {athlete, formule, lib, mois, montant, statut, date, capture?}
//   paiements_coach_captures/<capture> "<coach>|<commande>"   (pour un remboursement)
//   droits/<athlète>.suiviJusqu / .ultimeJusqu  (PROLONGÉS, jamais écrasés)

import T from '../../tarifs.json' with { type: 'json' };
import { ErreurAppel } from './appels.js';

export const API_LIVE = 'https://api-m.paypal.com';
export const API_SANDBOX = 'https://api-m.sandbox.paypal.com';
const J = 864e5;
const MOIS_MS = 30 * J;
const cleEmail = (e) => String(e || '').toLowerCase().trim().replace(/\./g, ',');
const net = (s) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
const centimes = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };
const CREATEUR = 'guellec,coachingpro@gmail,com';
export const PALIERS_COACH = ['coach', 'pro'];
// La formule → ce qu'elle ouvre, et combien de temps (tarifs.json : mois).
export const FORMULES_COACH = Object.freeze({
  programme_perso: 'ultime', revision_prog: 'ultime',
  coaching_essentiel: 'suivi', coaching_transfo: 'suivi', coaching_evolution: 'suivi' });
export const STATUTS = ['en_attente', 'recu', 'rembourse', 'annule'];
// LES FORMULES DU COACH : ses bornes (les mêmes que database.rules.json).
import { FORMULE_ID_RE, PRIX_MAX_CTS, PRIX_MIN_PAYABLE_CTS, MOIS_MAX, FORMULES_MAX, formuleCoach, payable } from './formules-coach.js';
export { FORMULE_ID_RE, PRIX_MAX_CTS, PRIX_MIN_PAYABLE_CTS, MOIS_MAX, FORMULES_MAX, formuleCoach, payable };

// ── PURES ─────────────────────────────────────────────────────────────────
// L'identifiant marchand : 13 caractères (merchant id PayPal), ou l'adresse
// e-mail du compte PayPal Business. {type:'merchant_id'|'email_address', valeur} ou null.
export function marchandNet(v) {
  const s = String(v == null ? '' : v).trim();
  if (/^[A-Z0-9]{13}$/.test(s.toUpperCase()) && !s.includes('@')) return { type: 'merchant_id', valeur: s.toUpperCase() };
  const e = s.toLowerCase();
  if (e.length <= 120 && /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/.test(e)) return { type: 'email_address', valeur: e };
  return null;
}
// Le prix d'une formule, en centimes, lu dans tarifs.json.
export function prixFormule(formule) {
  const f = T.coaching && T.coaching[formule];
  return (FORMULES_COACH[formule] && f && Number(f.prix) > 0) ? Math.round(Number(f.prix) * 100) : null;
}
export function dureeFormule(formule) {
  const f = T.coaching && T.coaching[formule];
  return f && Number(f.mois) > 0 ? Number(f.mois) * MOIS_MS : 0;
}
// custom_id = « <coach>|<athlète>|<formule> » : trois segments, sinon null.
export function lireCustomId(c) {
  const p = String(c || '').split('|');
  if (p.length !== 3) return null;
  const [coach, athlete, formule] = p;
  if (!coach || !athlete || /[.#$\[\]\/]/.test(coach + athlete) || !FORMULE_ID_RE.test(formule)) return null;
  return { coach, athlete, formule };
}
// Le corps de la commande. ⚠ AUCUN platform_fees, AUCUN disbursement : le
// payee est le coach, et rien d'autre n'est prélevé. `f` : la formule du coach.
export function corpsCommande({ coach, athlete, formule, f, marchand, retour, annulation }) {
  const cts = f.prixCts;
  return {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: formule,
      custom_id: coach + '|' + athlete + '|' + formule,
      description: String(f.lib || formule).slice(0, 127),
      amount: { currency_code: 'EUR', value: (cts / 100).toFixed(2) },
      payee: { [marchand.type]: marchand.valeur },
    }],
    payment_source: { paypal: { experience_context: { brand_name: 'RepCore', user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING',
      return_url: retour, cancel_url: annulation } } },
  };
}
// PROLONGER, NE PAS ÉCRASER : l'accès payé court à partir du plus tard entre
// maintenant et la fin déjà acquise. Le palier de base (un abonnement) ne bouge pas.
export function droitsApresPaiement(x, formule, t) {
  const champ = FORMULES_COACH[formule] === 'suivi' ? 'suiviJusqu' : 'ultimeJusqu';
  const d = x || {};
  return { [champ]: Math.max(Number(d[champ]) || 0, t) + dureeFormule(formule) };
}
// Un remboursement retire la durée payée, sans descendre sous maintenant.
export function droitsApresRemboursement(x, formule, t) {
  const champ = FORMULES_COACH[formule] === 'suivi' ? 'suiviJusqu' : 'ultimeJusqu';
  const d = x || {};
  return { [champ]: Math.max(t, (Number(d[champ]) || 0) - dureeFormule(formule)) };
}
// La formule d'un coach : SUIVI pendant ses mois (30 jours chacun), prolongé.
export function droitsCoach(x, mois, t) {
  const d = x || {};
  return { suiviJusqu: Math.max(Number(d.suiviJusqu) || 0, t) + Number(mois) * MOIS_MS };
}
export function droitsCoachRemboursement(x, mois, t) {
  const d = x || {};
  return { suiviJusqu: Math.max(t, (Number(d.suiviJusqu) || 0) - Number(mois) * MOIS_MS) };
}
// Le bénéficiaire de la capture est-il bien le coach relié ?
export function payeeConforme(pu, marchand) {
  const p = (pu && pu.payee) || {};
  if (!marchand) return false;
  if (marchand.type === 'merchant_id') return String(p.merchant_id || '').toUpperCase() === marchand.valeur;
  return String(p.email_address || '').toLowerCase() === marchand.valeur;
}

// ── AVEC LA BASE ET PAYPAL ────────────────────────────────────────────────
export function creerPaiementsCoach(ctx) {
  const { db, M, env } = ctx;
  const f = ctx.fetchImpl || fetch;
  const now = ctx.maintenant || (() => Date.now());
  const lire = async (c) => (await db.ref(c).get()).val();
  const base = String(env.PAYPAL_API_BASE || '').trim() === API_SANDBOX ? API_SANDBOX : API_LIVE;
  const ouvert = () => String(env.PAIEMENTS_COACH || '').trim() === 'oui';
  const APP = String(env.APP_URL || 'https://repcore-sync.web.app/app/').trim();

  let jeton = null;
  async function jetonPP() {
    if (jeton && jeton.expire > now()) return jeton.valeur;
    const id = String(env.PAYPAL_CLIENT_ID || '').trim(), sec = String(env.PAYPAL_CLIENT_SECRET || '').trim();
    if (!id || !sec) throw new ErreurAppel(503, 'Le paiement n’est pas configuré.');
    const r = await f(base + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + btoa(id + ':' + sec),
      'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
    if (!r.ok) throw new ErreurAppel(502, 'PayPal ne répond pas.');
    const j = await r.json();
    jeton = { valeur: j.access_token, expire: now() + Math.max(0, (Number(j.expires_in) || 300) - 60) * 1000 };
    return jeton.valeur;
  }
  async function pp(methode, chemin, corps) {
    const r = await f(base + chemin, { method: methode, headers: { Authorization: 'Bearer ' + (await jetonPP()), 'Content-Type': 'application/json',
      Prefer: 'return=representation' }, body: corps === undefined ? undefined : JSON.stringify(corps) });
    let j = null; try { j = await r.json(); } catch (e) { j = null; }
    return { statut: r.status, j };
  }
  async function palierCoach(coach) {
    if (coach === CREATEUR) return true;
    const [role, plan] = await Promise.all([lire('users/' + coach + '/role'), lire('users/' + coach + '/coachPlan')]);
    return role === 'coach' && PALIERS_COACH.indexOf(String(plan)) >= 0;
  }

  // RELIER. Le format d'abord, puis PayPal lui-même : une commande d'essai
  // (jamais approuvée, elle expire seule) dont le bénéficiaire est ce compte.
  // PayPal la refuse si le compte n'existe pas ou ne peut pas recevoir.
  async function relier(coach, brut) {
    if (!ouvert()) throw new ErreurAppel(403, 'Le paiement direct n’est pas encore ouvert.');
    if (!(await palierCoach(coach))) throw new ErreurAppel(403, 'Réservé aux paliers Coach et Pro.');
    const m = marchandNet(brut);
    if (!m) {
      await db.ref('coach_paiement/' + coach).set({ statut: 'refuse', raison: 'format', le: now() });
      return { relie: false, raison: 'format' };
    }
    const essai = corpsCommande({ coach, athlete: 'verification', formule: 'verification', f: { lib: 'Vérification du compte', prixCts: 100 }, marchand: m,
      retour: APP + '?paiement_coach=verification', annulation: APP + '?paiement_coach=verification' });
    essai.purchase_units[0].custom_id = 'verification';
    const r = await pp('POST', '/v2/checkout/orders', essai);
    if (r.statut !== 201 && r.statut !== 200) {
      const raison = String((r.j && r.j.details && r.j.details[0] && r.j.details[0].issue) || (r.j && r.j.name) || ('HTTP ' + r.statut)).slice(0, 60);
      await db.ref('coach_paiement/' + coach).set({ statut: 'refuse', raison, le: now() });
      return { relie: false, raison };
    }
    await db.ref('coach_paiement/' + coach).set({ marchand: m.valeur, type: m.type, statut: 'relie', le: now() });
    // Les événements arrivés avant la liaison sont rejoués maintenant.
    await rejouer(coach);
    return { relie: true };
  }
  async function liaison(coach) {
    const l = await lire('coach_paiement/' + coach);
    return (l && l.statut === 'relie' && l.marchand) ? { type: l.type, valeur: l.marchand } : null;
  }

  // LA COMMANDE, demandée par l'athlète connecté. Le coach vient de son slug.
  async function commande(athlete, data) {
    if (!ouvert()) throw new ErreurAppel(403, 'Le paiement direct n’est pas encore ouvert.');
    const slug = String((data && data.coach) || '').toLowerCase();
    const formule = String((data && (data.formuleId || data.formule)) || '');
    if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) throw new ErreurAppel(400, 'Page de coach inconnue.');
    const coach = await lire('slugs/' + slug);
    if (!coach) throw new ErreurAppel(404, 'Page de coach inconnue.');
    if (coach === athlete) throw new ErreurAppel(400, 'Tu ne peux pas t’acheter ta propre formule.');
    // LA FORMULE ET SON PRIX : ceux du coach, lus ici (jamais ceux de l'app).
    const [m, brute] = await Promise.all([liaison(coach), FORMULE_ID_RE.test(formule) ? lire('coachs/' + coach + '/formules/' + formule) : null]);
    if (!m) throw new ErreurAppel(409, 'Ce coach n’encaisse pas encore dans l’app : écris-lui depuis sa page.');
    const f = formuleCoach(brute);
    if (!f || !payable(f)) throw new ErreurAppel(400, 'Cette formule n’est pas proposée.');
    if (!(await palierCoach(coach))) throw new ErreurAppel(409, 'Ce coach n’encaisse pas encore dans l’app.');
    const r = await pp('POST', '/v2/checkout/orders', corpsCommande({ coach, athlete, formule, f, marchand: m,
      retour: APP + '?paiement_coach=retour', annulation: APP + '?paiement_coach=annule' }));
    if ((r.statut !== 201 && r.statut !== 200) || !r.j || !r.j.id) throw new ErreurAppel(502, 'PayPal a refusé la commande. Réessaie dans un moment.');
    const id = net(r.j.id);
    await db.ref('paiements_coach/' + coach + '/' + id).set({ athlete, formule, lib: f.lib, mois: f.mois, montant: f.prixCts, statut: 'en_attente', date: now() });
    const lien = (r.j.links || []).find((l) => l && (l.rel === 'payer-action' || l.rel === 'approve'));
    return { commande: id, lien: lien ? lien.href : null };
  }

  // FINALISER : la capture est faite (par nous, ou annoncée par le webhook).
  // Contrôles : montant = prix de tarifs.json en euros, bénéficiaire = coach
  // relié. Idempotent : une commande déjà « reçue » ne rouvre rien de plus.
  async function finaliser(c, idCommande, capture, pu) {
    const t = now();
    const cheminP = 'paiements_coach/' + c.coach + '/' + idCommande;
    const deja = await lire(cheminP);
    if (deja && deja.statut === 'recu') return 'deja';
    const m = await liaison(c.coach);
    if (!m) return 'orphelin';
    // LE MONTANT ATTENDU : celui fixé à la commande (le coach a pu changer son
    // prix depuis) ; à défaut (commande d'avant), la formule telle qu'elle est.
    let attendu = deja && Number(deja.montant) > 0 ? Number(deja.montant) : null;
    let mois = deja && Number(deja.mois) > 0 ? Number(deja.mois) : null;
    if (attendu === null || mois === null) {
      const f = formuleCoach(await lire('coachs/' + c.coach + '/formules/' + c.formule));
      if (f) { if (attendu === null) attendu = f.prixCts; if (mois === null) mois = f.mois; }
    }
    const cts = centimes(capture && capture.amount && capture.amount.value);
    const puCts = centimes(pu && pu.amount && pu.amount.value);
    const eur = String((capture && capture.amount && capture.amount.currency_code) || '').toUpperCase() === 'EUR';
    if (!eur || !(attendu > 0) || !(mois > 0) || cts !== attendu || puCts !== attendu || !payeeConforme(pu, m)) {
      await db.ref(cheminP).update({ athlete: c.athlete, formule: c.formule, statut: 'annule', raison: 'controle', date: (deja && deja.date) || t });
      return 'refuse';
    }
    const cap = net(capture.id);
    await db.ref().update({ [cheminP]: { athlete: c.athlete, formule: c.formule, lib: (deja && deja.lib) || null, mois, montant: cts, statut: 'recu', date: (deja && deja.date) || t, recuLe: t, capture: cap },
      ['paiements_coach_captures/' + cap]: c.coach + '|' + idCommande });
    await M.majDroits(c.athlete, (x) => Object.assign({ palier: (x && x.palier) || 'aucun', echeance: Number(x && x.echeance) || 0,
      source: (x && x.source) || 'paiement_coach' }, droitsCoach(x, mois, t)));
    return 'recu';
  }
  async function capturer(athlete, data) {
    if (!ouvert()) throw new ErreurAppel(403, 'Le paiement direct n’est pas encore ouvert.');
    const id = net(data && data.commande);
    if (!id) throw new ErreurAppel(400, 'Commande inconnue.');
    const lu = await pp('GET', '/v2/checkout/orders/' + id);
    const pu0 = lu.j && lu.j.purchase_units && lu.j.purchase_units[0];
    const c = lireCustomId(pu0 && pu0.custom_id);
    if (!c || c.athlete !== athlete) throw new ErreurAppel(403, 'Cette commande n’est pas la tienne.');
    let cap = pu0.payments && pu0.payments.captures && pu0.payments.captures[0];
    let pu = pu0;
    if (!cap) {
      const r = await pp('POST', '/v2/checkout/orders/' + id + '/capture', {});
      pu = r.j && r.j.purchase_units && r.j.purchase_units[0];
      cap = pu && pu.payments && pu.payments.captures && pu.payments.captures[0];
      if (!cap) throw new ErreurAppel(402, 'Le paiement n’a pas abouti chez PayPal.');
    }
    if (cap.status !== 'COMPLETED') return { statut: 'en_attente' };
    return { statut: await finaliser(c, id, cap, pu) };
  }

  // LE WEBHOOK (paypal.js lui passe les événements à trois segments).
  async function evenementCapture(evt, commandeLue) {
    const pu = commandeLue && commandeLue.purchase_units && commandeLue.purchase_units[0];
    const c = lireCustomId(pu && pu.custom_id);
    if (!c) return 'ignore';
    const id = net(commandeLue.id);
    const r = await finaliser(c, id, evt.resource || {}, pu);
    if (r === 'orphelin') {
      await db.ref('paypal_orphelins/coach_' + c.coach + '/' + (net(evt.id) || 'x' + now())).set({ evt, commande: commandeLue, at: now() });
    }
    return r === 'recu' ? 'paiement_coach' : r;
  }
  async function rejouer(coach) {
    const tout = (await lire('paypal_orphelins/coach_' + coach)) || {};
    let n = 0;
    for (const k of Object.keys(tout).sort()) {
      const o = tout[k];
      if (o && o.evt && o.commande) { const r = await evenementCapture(o.evt, o.commande); if (r === 'orphelin') continue; }
      await db.ref('paypal_orphelins/coach_' + coach + '/' + k).remove();
      n++;
    }
    return n;
  }
  // LE REMBOURSEMENT : de la capture, on retrouve la commande ; l'accès perd la durée payée.
  async function remboursement(idCapture) {
    const k = net(idCapture);
    const ref = k ? await lire('paiements_coach_captures/' + k) : null;
    if (!ref) return null;
    const [coach, idCommande] = String(ref).split('|');
    const chemin = 'paiements_coach/' + coach + '/' + idCommande;
    const p = await lire(chemin);
    if (!p || p.statut === 'rembourse') return 'deja';
    const t = now();
    await db.ref(chemin).update({ statut: 'rembourse', remboursLe: t });
    await M.majDroits(p.athlete, (x) => Object.assign({ palier: (x && x.palier) || 'aucun', echeance: Number(x && x.echeance) || 0,
      source: (x && x.source) || 'paiement_coach' }, Number(p.mois) > 0 ? droitsCoachRemboursement(x, p.mois, t) : droitsApresRemboursement(x, p.formule, t)));
    return 'rembourse_coach';
  }

  // L'APPEL DE L'APP : /fn/paiementCoach {action, …}.
  async function appel({ auth, data }) {
    const moi = cleEmail(auth && auth.email);
    if (!moi) throw new ErreurAppel(401, 'Connecte-toi pour effectuer cette action.');
    const a = String((data && data.action) || 'commande');
    if (a === 'etat') {
      const l = await lire('coach_paiement/' + moi);
      return { ouvert: ouvert(), statut: (l && l.statut) || 'non_relie', raison: (l && l.raison) || null,
        marchand: l && l.marchand ? String(l.marchand).replace(/^(.{2}).*(.{2})$/, '$1…$2') : null };
    }
    if (a === 'relier') return relier(moi, data && data.marchand);
    if (a === 'capturer') return capturer(moi, data);
    return commande(moi, data);
  }
  return { appel, relier, commande, capturer, finaliser, evenementCapture, rejouer, remboursement, liaison, ouvert };
}
