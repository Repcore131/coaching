// ══ LES FORMULES DE COACHING DE KEVIN, VENDUES DANS L'APP (11/10/2026) ══════
//
// Cinq formules, lues dans tarifs.json (coaching.*), en deux familles :
//   · AVEC SUIVI  : coaching_essentiel, coaching_transfo, coaching_evolution
//                   → droits/<athlète>.suiviJusqu, PROLONGÉ de `mois` × 30 j ;
//   · SANS SUIVI  : programme_perso, revision_prog
//                   → droits/<athlète>.ultimeJusqu, PROLONGÉ de même.
//
// ⚠ CE N'EST PAS paiements-coach.js. Celui-là fait payer un coach TIERS sur
//   SON compte (bénéficiaire = le coach, fermé tant que PAIEMENTS_COACH ≠ oui).
//   Ici, Kevin vend SES formules : l'argent va sur le compte de l'application,
//   comme un programme de la boutique — aucun bénéficiaire dans la commande.
// ⚠ LE PRIX EST CELUI DE tarifs.json, relu ICI, sur la commande créée par ce
//   serveur ET sur la capture : jamais un montant venu de l'app.
//
// LE CHEMIN. L'athlète connecté demande une commande (/fn/coaching, action
// « commande ») ; PayPal lui fait approuver ; il revient dans l'app
// (?coaching=retour&token=<commande>), qui demande la capture (« capturer »).
// Le webhook PAYMENT.CAPTURE.COMPLETED fait la même chose s'il arrive le
// premier : l'un ou l'autre arrivé second ne refait rien (transaction).
//
// À LA CAPTURE CONTRÔLÉE :
//   · les droits (suivi ou Ultime) sont prolongés ;
//   · l'athlète est RELIÉ À KEVIN, sauf s'il a déjà un autre coach (refusé dès
//     la commande, et noté si cela arrive quand même entre-temps) ;
//   · l'achat porte son ATTRIBUTION : l'entrée dans l'app (le bouton touché),
//     la source d'arrivée (users/<clé>/origine → src) et le code ambassadeur
//     (ambassadeurs_liens/<clé>, que le client ne peut pas écrire) ;
//   · LA COMMISSION AMBASSADEUR suit la décision de DECISIONS-A-PRENDRE.md
//     (point 3, tranché le 09/10/2026) : 20 %, puis 25 % au-delà de 50
//     payants, pendant 12 mois à compter du premier paiement du filleul —
//     A.commissionPour en décide, comme pour un abonnement ;
//   · Kevin reçoit une notification.
//
// OÙ C'EST ÉCRIT (par ce serveur seul) :
//   coaching_achats/<commande>   {athlete, formule, montant, statut, date, entree,
//                                 src, amb?, recuLe?, capture?, lien?, executionImmediate}
//   users/<athlète>/coachingAchat {formule, commande, le, famille}  (sa copie lisible)
//   stats/coaching/<AAAA-MM>      {ventes/<formule>, ca, src/<src>, entree/<entree>, amb/<code>}
//   paypal_transactions/<capture> {type:'coaching', …} : ce qu'un remboursement relit.

import T from '../../tarifs.json' with { type: 'json' };
import ATT from '../../functions/attribution-calcul.js';
import { ErreurAppel } from './appels.js';
import { droitsApresPaiement, droitsApresRemboursement } from './paiements-coach.js';

export const CREATEUR = 'guellec,coachingpro@gmail,com';
export const PREFIXE = 'ck';
export const FAMILLES = Object.freeze({
  suivi: Object.freeze(['coaching_essentiel', 'coaching_transfo', 'coaching_evolution']),
  sans_suivi: Object.freeze(['programme_perso', 'revision_prog']),
});
export const FORMULES_KEVIN = Object.freeze(FAMILLES.suivi.concat(FAMILLES.sans_suivi));
// Le bouton touché dans l'app. Une valeur inconnue devient « ecran ».
export const ENTREES = Object.freeze(['ecran', 'carte', 'accueil', 'bienvenue', 'abonnement', 'essai', 'reglages', 'landing', 'vitrine', 'lien']);
const net = (s) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
const centimes = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };
const interdit = (s) => /[.#$\[\]\/|]/.test(String(s));

// ── PURES ─────────────────────────────────────────────────────────────────
/** PURE. 'suivi' | 'sans_suivi' | null. */
export function familleDe(formule) {
  if (FAMILLES.suivi.indexOf(formule) >= 0) return 'suivi';
  if (FAMILLES.sans_suivi.indexOf(formule) >= 0) return 'sans_suivi';
  return null;
}
/** PURE. Le prix d'une formule de Kevin, en centimes, lu dans tarifs.json ; null sinon. */
export function prixCoaching(formule) {
  const f = T.coaching && T.coaching[formule];
  return familleDe(formule) && f && Number(f.prix) > 0 ? Math.round(Number(f.prix) * 100) : null;
}
/** PURE. L'entrée dans l'app, bornée à la liste ; 'ecran' sinon. */
export function entreeNette(v) {
  const s = String(v || '').toLowerCase();
  return ENTREES.indexOf(s) >= 0 ? s : 'ecran';
}
/** PURE. custom_id = « ck|<athlète>|<formule>|<entrée> » (quatre segments). */
export function customIdCoaching({ athlete, formule, entree }) {
  return PREFIXE + '|' + athlete + '|' + formule + '|' + entreeNette(entree);
}
/** PURE. {athlete, formule, entree} ou null (un autre custom_id). */
export function lireCustomIdCoaching(c) {
  const p = String(c || '').split('|');
  if (p.length !== 4 || p[0] !== PREFIXE) return null;
  const [, athlete, formule, entree] = p;
  if (!athlete || interdit(athlete) || !familleDe(formule)) return null;
  return { athlete, formule, entree: entreeNette(entree) };
}
/**
 * PURE. Le corps de la commande. AUCUN bénéficiaire : l'argent va sur le compte
 * de l'application. Le montant est celui de tarifs.json.
 */
export function corpsCommandeCoaching({ athlete, formule, entree, retour, annulation }) {
  const cts = prixCoaching(formule);
  if (cts === null) throw new Error('formule inconnue : ' + formule);
  const f = T.coaching[formule];
  return {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: formule,
      custom_id: customIdCoaching({ athlete, formule, entree }),
      description: String(f.lib || formule).slice(0, 127),
      amount: { currency_code: 'EUR', value: (cts / 100).toFixed(2) },
    }],
    payment_source: { paypal: { experience_context: { brand_name: 'RepCore', user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING',
      return_url: retour, cancel_url: annulation } } },
  };
}
/**
 * PURE. LE CONTRÔLE DU MONTANT : en euros, au centime près le prix de
 * tarifs.json, sur la commande ET sur la capture. Et aucun autre bénéficiaire.
 */
export function montantConforme(pu, capture, formule) {
  const cts = prixCoaching(formule);
  if (cts === null || !pu || !capture) return false;
  const eur = (a) => String((a && a.currency_code) || '').toUpperCase() === 'EUR';
  const payee = pu.payee && (pu.payee.merchant_id || pu.payee.email_address);
  return eur(pu.amount) && eur(capture.amount) && !payee
    && centimes(pu.amount.value) === cts && centimes(capture.amount.value) === cts;
}
/**
 * PURE. L'attribution d'un achat : la source d'arrivée (normalisée comme à
 * l'inscription) et le code ambassadeur — celui du lien serveur d'abord.
 * Aucune donnée personnelle : un src et un code public.
 */
export function attributionAchat(origine, lienAmb) {
  const o = (origine && typeof origine === 'object') ? origine : {};
  const brut = String((lienAmb && lienAmb.code) || o.amb || '').toUpperCase();
  const amb = ATT.AMB_RE.test(brut) ? brut : null;
  return { src: ATT.srcArrivee(Object.assign({}, o, amb ? { amb } : {})), amb };
}
/**
 * PURE. Le lien athlète ↔ Kevin, en écritures multi-chemins, ou {refus}.
 * Un athlète déjà suivi par un AUTRE coach n'est jamais détaché ici.
 * @param {string} cle la clé de l'athlète
 * @param {{coachEmailKey?:string, status?:string}} a son dossier
 * @param {{id?:string|number, fname?:string, lname?:string}} k celui de Kevin
 */
export function lienCoachMaj(cle, a, k, formule, t) {
  const x = a || {};
  if (x.coachEmailKey && x.coachEmailKey !== CREATEUR) return { refus: 'autre_coach' };
  const kv = k || {};
  const b = 'users/' + cle + '/';
  const maj = { [b + 'coachEmailKey']: CREATEUR, [b + 'updatedAt']: t,
    ['annuaire_coach/' + CREATEUR + '/' + cle]: { email: cle.replace(/,/g, '.'), maj: t },
    ['coachs/' + CREATEUR + '/clients/' + cle]: true };
  if (kv.id !== undefined && kv.id !== null && kv.id !== '') maj[b + 'coachId'] = kv.id;
  const nom = ((kv.fname || '') + ' ' + (kv.lname || '')).trim();
  if (nom) maj[b + 'coachName'] = nom.slice(0, 80);
  if (familleDe(formule) === 'suivi') maj[b + 'status'] = 'COACHING_SUIVI';
  return { maj };
}
/** PURE. Le mois (AAAA-MM) de Paris. */
export const moisParis = (t) => ATT.jourParis(t).slice(0, 7);
/** PURE. Les compteurs du mois, une vente de plus. */
export function statsApres(s, a) {
  const x = Object.assign({}, s || {});
  const inc = (k, sous, n) => { x[k] = Object.assign({}, x[k] || {}); x[k][sous] = (Number(x[k][sous]) || 0) + (n || 1); };
  inc('ventes', a.formule);
  x.ca = (Number(x.ca) || 0) + (Number(a.montant) || 0);
  inc('src', a.src || 'direct');
  inc('entree', a.entree || 'ecran');
  if (a.amb) inc('amb', a.amb);
  return x;
}

// ── AVEC LA BASE ET PAYPAL ────────────────────────────────────────────────
/**
 * @param {{db:any, M:any, env:any, maintenant?:()=>number,
 *   pp:{lire:(chemin:string)=>Promise<any>, ecrire:(chemin:string, corps:any)=>Promise<{statut:number, corps:any}>},
 *   premierPaiement:(cle:string, abo:any, ress:any)=>Promise<boolean>,
 *   noterTransaction:(id:string, rec:any)=>Promise<void>}} ctx
 */
export function creerCoaching(ctx) {
  const { db, M, env, pp } = ctx;
  const now = ctx.maintenant || (() => Date.now());
  const lire = async (c) => (await db.ref(c).get()).val();
  const ouvert = () => String(env.COACHING_VENTE || '').trim() !== 'non';
  const APP = String(env.APP_URL || 'https://repcore-sync.web.app/app/').trim();
  const pousserKevin = (titre, corps, tag) => (M && M.envoyerPush
    ? M.envoyerPush(CREATEUR, { type: 'admin', url: './?coaching_admin=1', tag, title: titre, body: corps }).catch(() => null) : null);

  // LA COMMANDE, demandée par l'athlète connecté.
  async function commande(athlete, data) {
    if (!ouvert()) throw new ErreurAppel(403, 'Le paiement du coaching est fermé pour l’instant.');
    const formule = String((data && data.formule) || '');
    if (prixCoaching(formule) === null) throw new ErreurAppel(400, 'Cette formule n’existe pas.');
    // LE DÉMARRAGE IMMÉDIAT EST DEMANDÉ EXPRESSÉMENT (art. L221-25) : sans la
    // case, pas de commande. La date est gardée sur l'achat.
    if (data.executionImmediate !== true) throw new ErreurAppel(400, 'Coche la case de démarrage immédiat pour continuer.');
    if (athlete === CREATEUR) throw new ErreurAppel(400, 'Tu ne peux pas t’acheter ta propre formule.');
    const [role, coach] = await Promise.all([lire('users/' + athlete + '/role'), lire('users/' + athlete + '/coachEmailKey')]);
    if (role === null) throw new ErreurAppel(404, 'Compte introuvable : reconnecte-toi.');
    if (role === 'coach') throw new ErreurAppel(400, 'Un compte coach ne peut pas acheter de coaching.');
    if (coach && coach !== CREATEUR) throw new ErreurAppel(409, 'Tu es déjà suivi par un autre coach : détache-toi d’abord dans tes réglages.');
    const entree = entreeNette(data.entree);
    const r = await pp.ecrire('/v2/checkout/orders', corpsCommandeCoaching({ athlete, formule, entree,
      retour: APP + '?coaching=retour', annulation: APP + '?coaching=annule' }));
    const j = r && r.corps;
    if ((r.statut !== 201 && r.statut !== 200) || !j || !j.id) throw new ErreurAppel(502, 'PayPal a refusé la commande. Réessaie dans un moment.');
    const id = net(j.id);
    await db.ref('coaching_achats/' + id).set({ athlete, formule, montant: prixCoaching(formule), statut: 'en_attente', date: now(),
      entree, executionImmediate: now() });
    const lien = (j.links || []).find((l) => l && (l.rel === 'payer-action' || l.rel === 'approve'));
    return { commande: id, lien: lien ? lien.href : null };
  }

  // FINALISER : la capture est faite (par nous, ou annoncée par le webhook).
  async function finaliser(c, idCommande, capture, pu) {
    const t = now();
    const chemin = 'coaching_achats/' + idCommande;
    if (!montantConforme(pu, capture, c.formule)) {
      const deja = await lire(chemin);
      if (deja && deja.statut === 'recu') return { statut: 'deja' };
      await db.ref(chemin).update({ athlete: c.athlete, formule: c.formule, statut: 'annule', raison: 'controle', date: (deja && deja.date) || t });
      await pousserKevin('Coaching : paiement refusé au contrôle', 'Le montant ne correspond pas au tarif (' + c.formule + '). Vérifie dans PayPal.', 'coaching-' + idCommande);
      return { statut: 'refuse' };
    }
    // UNE SEULE FOIS : la transaction sur le statut tranche entre la capture
    // de l'app et le webhook arrivés ensemble.
    const cap = net(capture.id);
    const garde = await db.ref(chemin + '/statut').transaction((s) => (s === 'recu' ? undefined : 'recu'));
    if (!garde.committed) return { statut: 'deja' };
    const [deja, origine, lienAmb, dossier, kevin] = await Promise.all([lire(chemin), lire('users/' + c.athlete + '/origine'),
      lire('ambassadeurs_liens/' + c.athlete), lire('users/' + c.athlete), lire('users/' + CREATEUR)]);
    const att = attributionAchat(origine, lienAmb);
    const cts = prixCoaching(c.formule);
    const famille = familleDe(c.formule);
    const lien = lienCoachMaj(c.athlete, dossier, kevin, c.formule, t);
    const maj = Object.assign({}, lien.maj || {}, {
      [chemin]: Object.assign({}, deja || {}, { athlete: c.athlete, formule: c.formule, montant: cts, statut: 'recu',
        date: (deja && deja.date) || t, recuLe: t, capture: cap, entree: (deja && deja.entree) || c.entree, src: att.src,
        amb: att.amb, lien: lien.refus || 'kevin' }),
      ['users/' + c.athlete + '/coachingAchat']: { formule: c.formule, commande: idCommande, le: t, famille },
      ['users/' + c.athlete + '/updatedAt']: t,
    });
    await db.ref().update(maj);
    await M.majDroits(c.athlete, (x) => Object.assign({ palier: (x && x.palier) || 'aucun', echeance: Number(x && x.echeance) || 0,
      source: (x && x.source) || 'coaching' }, droitsApresPaiement(x, c.formule, t)));
    await db.ref('stats/coaching/' + moisParis(t)).transaction((s) => statsApres(s, { formule: c.formule, montant: cts,
      src: att.src, entree: (deja && deja.entree) || c.entree, amb: att.amb }));
    // LE PREMIER PAIEMENT DU COMPTE porte déjà la commission (paypal.js) ;
    // un achat suivant la porte ici, dans la même période de 12 mois.
    const ress = { id: cap, amount: { value: (cts / 100).toFixed(2), currency_code: 'EUR' }, create_time: new Date(t).toISOString() };
    const premier = await ctx.premierPaiement(c.athlete, null, ress);
    if (!premier) await M.ambassadeurPaiement(c.athlete, { montant: cts / 100, le: t, id: cap, venteId: cap }).catch(() => null);
    await ctx.noterTransaction(cap, { cle: c.athlete, commande: idCommande, formule: c.formule, type: 'coaching', premier,
      montant: cts, devise: 'EUR' });
    const lib = (T.coaching[c.formule] && T.coaching[c.formule].lib) || c.formule;
    await pousserKevin('Nouveau coaching : ' + lib, c.athlete.replace(/,/g, '.') + (lien.refus ? ' (déjà suivi par un autre coach : à relier à la main)' : ''),
      'coaching-' + idCommande);
    return { statut: 'recu', formule: c.formule, famille, lien: lien.refus || 'kevin',
      coach: lien.maj ? { coachEmailKey: CREATEUR, coachId: (kevin && kevin.id) || null,
        coachName: (((kevin && kevin.fname) || '') + ' ' + ((kevin && kevin.lname) || '')).trim() || null } : null };
  }

  async function capturer(athlete, data) {
    const id = net(data && data.commande);
    if (!/^[A-Z0-9]{8,40}$/.test(id)) throw new ErreurAppel(400, 'Commande inconnue.');
    let cmd = await pp.lire('/v2/checkout/orders/' + id);
    const pu0 = cmd && cmd.purchase_units && cmd.purchase_units[0];
    const c = lireCustomIdCoaching(pu0 && pu0.custom_id);
    if (!c || c.athlete !== athlete) throw new ErreurAppel(403, 'Cette commande n’est pas la tienne.');
    let cap = pu0.payments && pu0.payments.captures && pu0.payments.captures[0];
    if (!cap) {
      const r = await pp.ecrire('/v2/checkout/orders/' + id + '/capture', {});
      if (r.statut >= 400 && r.statut !== 422) throw new ErreurAppel(402, 'Le paiement n’a pas abouti chez PayPal.');
      // On relit : la réponse de la capture peut être abrégée.
      cmd = await pp.lire('/v2/checkout/orders/' + id);
      const pu1 = cmd && cmd.purchase_units && cmd.purchase_units[0];
      cap = pu1 && pu1.payments && pu1.payments.captures && pu1.payments.captures[0];
      if (!cap) throw new ErreurAppel(402, 'Le paiement n’a pas abouti chez PayPal.');
    }
    if (cap.status !== 'COMPLETED') return { statut: 'en_attente' };
    return finaliser(c, id, cap, cmd.purchase_units[0]);
  }

  // LE WEBHOOK (paypal.js lui passe les captures à custom_id « ck|… »).
  async function evenementCapture(evt, commandeLue) {
    const pu = commandeLue && commandeLue.purchase_units && commandeLue.purchase_units[0];
    const c = lireCustomIdCoaching(pu && pu.custom_id);
    if (!c) return 'ignore';
    const ress = evt.resource || {};
    if (ress.status && ress.status !== 'COMPLETED') return 'en_attente';
    const r = await finaliser(c, net(commandeLue.id), ress, pu);
    return r.statut === 'recu' ? 'coaching' : 'coaching_' + r.statut;
  }

  // LE REMBOURSEMENT TOTAL (paypal.js, annuler) : la durée payée est retirée,
  // l'achat passe « remboursé ». Le lien au coach reste : c'est Kevin qui
  // détache, s'il le veut, depuis la fiche.
  async function rembourse(rec, t) {
    if (!rec || rec.type !== 'coaching' || !rec.commande) return null;
    const chemin = 'coaching_achats/' + net(rec.commande);
    const a = await lire(chemin);
    if (!a || a.statut === 'rembourse') return null;
    await db.ref(chemin).update({ statut: 'rembourse', remboursLe: t });
    await M.majDroits(a.athlete, (x) => Object.assign({ palier: (x && x.palier) || 'aucun', echeance: Number(x && x.echeance) || 0,
      source: (x && x.source) || 'coaching' }, droitsApresRemboursement(x, a.formule, t)));
    return 'coaching ' + a.formule + ' : durée payée retirée';
  }

  // L'APPEL DE L'APP : /fn/coaching {action, …}.
  async function appel({ auth, data }) {
    const moi = String((auth && auth.email) || '').toLowerCase().trim().replace(/\./g, ',');
    if (!moi) throw new ErreurAppel(401, 'Connecte-toi pour payer ton coaching.');
    const d = data || {};
    if (d.action === 'etat') return { ouvert: ouvert() };
    if (d.action === 'capturer') return capturer(moi, d);
    return commande(moi, d);
  }
  return { appel, commande, capturer, finaliser, evenementCapture, rembourse, ouvert };
}

// Le délai d'une formule (en jours), pour les tests et l'écran.
export const dureeJours = (formule) => (familleDe(formule) && T.coaching[formule] ? Number(T.coaching[formule].mois) * 30 : 0);
