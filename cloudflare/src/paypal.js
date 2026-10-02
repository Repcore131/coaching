// ══ PAYPAL, ÉCOUTÉ PAR LE SERVEUR LÉGER ══════════════════════════════════
//
// « PayPal prélève tout seul, mais rien ne redescend jusqu'à l'application :
// une résiliation, un impayé, une carte qui expire ne changent RIEN ici »
// (écran Accès, 24/09/2026). Ce module est l'oreille qui manquait : PayPal
// appelle /paypal à chaque événement d'abonnement, et le dossier suit.
//
// ⚠ LE MODÈLE EST CELUI DU DOSSIER, pas droits/ (voir metier.js, bonusEssai) :
//   · UNE RÉSILIATION NE COUPE PAS LE JOUR MÊME. Passer paymentStatus à
//     « cancelled » fermerait l'accès à l'instant (_palierHerite). On pose donc
//     accessExpiry à la FIN DE LA PÉRIODE PAYÉE (next_billing_time chez
//     PayPal), plus les mois offerts en réserve : l'accès court jusque-là, puis
//     se ferme de lui-même.
//   · UN PAIEMENT QUI REVIENT (après un impayé) rouvre : la fin posée par ce
//     module est retirée — mais seulement si l'abonnement, relu chez PayPal,
//     est ACTIVE et que c'est le courant du dossier (paypalSubscriptionId).
//   · LE COMPTE SE LIT DANS custom_id, posé par l'app à la création de
//     l'abonnement (et de la commande d'un programme) : jamais d'après
//     l'adresse du payeur. Un événement encore sans compte est rangé dans
//     paypal_orphelins, et rejoué dès que le lien est fait.
//   · LE COACH n'a pas d'échéance dans son dossier : sa fin est notée dans
//     /paypal_fins, et le travail quotidien referme son palier à la date.
//
// ⚠ AUCUN APPEL N'EST CRU SANS VÉRIFICATION : la signature est contrôlée
//   AUPRÈS DE PAYPAL (verify-webhook-signature) avec le corps BRUT reçu — le
//   re-sérialiser fausserait le contrôle. Sans PAYPAL_WEBHOOK_ID, sans secret,
//   ou si PayPal ne répond pas SUCCESS : 401, rien n'est écrit.
//
// SECRETS : PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID. VARIABLE : PAYPAL_CLIENT_ID.

import T from '../../tarifs.json' with { type: 'json' };
import { creerPaiementsCoach, lireCustomId } from './paiements-coach.js';
import { ErreurAppel } from './appels.js';

const API = 'https://api-m.paypal.com';
const MOIS_MS = 30 * 864e5;
const EN_COURS_MAX_MS = 10 * 60 * 1000;
const PROGRAMME_MS = 3 * MOIS_MS;          // OFFRES.boutique_prog.mois de l'app
const cleEmail = (e) => String(e || '').toLowerCase().trim().replace(/\./g, ',');
const net = (s) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
const centimes = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };

// ══ LES OFFRES QUE PAYPAL ENCAISSE ════════════════════════════════════════
// Le MIROIR de OFFRES et des PAYPAL_PLAN_ID* de l'app (rc-core) : un test
// (paypal.test.mjs) relit l'app et refuse tout écart. Un paiement n'est
// compté comme « premier paiement » (parrain, ambassadeur, statistique) que
// si son plan est ici, en euros, et pour l'un de ces montants.
// ⚠ PLUSIEURS MONTANTS PAR PLAN : un prix qui a changé chez PayPal laisse des
//   abonnés à l'ancien tarif (9,95 puis 9,50 ; 99 puis 114 ; 249 puis 298,80),
//   et le plan « demi » facture 12,45 le premier mois puis 24,90.
export const OFFRES_PAYPAL = Object.freeze({
  // `periode` : ce que couvre UN paiement du plan (un mois, ou un an).
  'P-95N51603RD882780YNJKS2QA': { formule: 'essentielle', montants: ['9.50', '9.95'], periode: 'mois' },
  // Les ANCIENS annuels (114 € et 298,80 €) : plus vendus depuis le 02/10/2026,
  // gardés pour leurs abonnés. Les nouveaux (95 € et 249 €) sont ajoutés en
  // fin de table par `node scripts/paypal_plans.mjs --ecrire`, qui les crée.
  'P-92T09491KF550281RNK2LZWY': { formule: 'essentielle', montants: ['114.00', '99.00'], periode: 'an' },
  'P-2W777608239063532NK2LZXA': { formule: 'ultime', montants: ['24.90'], periode: 'mois' },
  'P-16Y44630WF304553UNK2LZXI': { formule: 'ultime', montants: ['298.80', '249.00'], periode: 'an' },
  // `demi` : le 1er mois d'Ultime à moitié prix — UNE fois par compte
  // (droits.demiPackUtilise, posé à l'ouverture), sortie de pack ou code
  // ambassadeur « ultime_demi ».
  'P-57P40267XP026613FNK2LZXQ': { formule: 'ultime', montants: ['12.45', '24.90'], demi: true, periode: 'mois' },
  'P-9JD300001T4718058NK2RF5Q': { coachPlan: 'coach', montants: ['19.00'], periode: 'mois' },
  'P-1WS20264K4576284KNK2RF5Y': { coachPlan: 'pro', montants: ['39.00'], periode: 'mois' },
});
function montantValide(plan, montant, devise, role) {
  if (!plan || String(devise || '').toUpperCase() !== 'EUR') return false;
  if ((role === 'coach') !== !!plan.coachPlan) return false;
  const c = centimes(montant);
  return plan.montants.some((m) => centimes(m) === c);
}

// ══ LE JETON OAUTH, GARDÉ JUSQU'À SON EXPIRATION ══════════════════════════
// Deux sous-requêtes de moins par webhook (le plan gratuit en compte 50 par
// exécution). En mémoire de l'isolat : il vit tant que le worker reste chaud,
// et se redemande sinon. Rendu une minute avant son expiration.
export const GARDE_EVENEMENTS_MS = 90 * 864e5;
const LOT_PURGE = 200;

// ══ LE BUDGET D'UN WEBHOOK (01/10/2026) ═══════════════════════════════════
// Une exécution de Worker n'a droit qu'à 50 sous-requêtes ; index.js fixe le
// budget du webhook à 44 (M.fixerBudget). Mesuré : jusqu'à 45 dans un seul
// webhook de test, donc au bord. Trois règles :
//   · AVANT UNE ÉCRITURE, il reste au moins BUDGET_ETAPE requêtes, sinon on
//     lève ErreurBudget AVANT d'écrire : l'événement reste « en_cours », la
//     réponse est 503, et PayPal le renverra ;
//   · une étape qui pose d'abord une GARDE (annuler : annuleLe ; premier
//     paiement : paypal_premiers) exige le budget de l'étape ENTIÈRE avant
//     la garde — sinon le renvoi trouverait la garde posée et ne referait
//     jamais le reste (commission, mois offert, accès) ;
//   · un seul orphelin rejoué par webhook ; les suivants, et l'événement
//     courant après eux, partent en sous-tâches (planif.js), dans l'ordre.
// Les push du chemin PayPal passent par M.pousser1 : à court de budget, ils
// partent à la minute suivante au lieu de faire tomber le webhook.
export const BUDGET_ETAPE = 8;
// LA RÉSILIATION (02/10/2026) : l'annulation part chez PayPal trois jours
// avant la date d'effet, pour qu'aucune échéance ne tombe entre les deux.
export const RESIL_AVANCE_MS = 3 * 864e5;
// Au-delà de cette marge, une fin payée qui tombe avant le terme de
// l'engagement est une rupture (les échéances PayPal et le terme calculé
// peuvent différer de quelques heures).
export const RUPTURE_MARGE_MS = 3 * 864e5;
// PURE. n mois après t, au même quantième (borné au dernier jour du mois),
// comme moisApres dans l'app.
export function moisApres(t, n) {
  const d = new Date(Number(t));
  const jour = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + (Number(n) || 0));
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(jour, dernier));
  return d.getTime();
}
// PURE. LE TERME DE L'ENGAGEMENT, tel que le serveur le retient : le plus
// tardif entre celui du dossier (posé par l'app à la souscription) et celui
// que PayPal atteste (début de l'abonnement + engagementMois). Le dossier est
// écrit par son titulaire : il ne peut pas raccourcir son propre engagement.
// 0 : pas d'engagement (coach, ou rien de connu).
export function termeEngagement({ role, engagementJusqu, debut }) {
  if (role === 'coach') return 0;
  const d = Date.parse(debut || '') || 0;
  const parPaypal = d > 0 && Number(T.engagementMois) > 0 ? moisApres(d, T.engagementMois) : 0;
  return Math.max(Number(engagementJusqu) || 0, parPaypal);
}
// PURE. La date d'effet d'une résiliation demandée à `t`, et le jour où
// l'annulation part chez PayPal. Pendant l'engagement : son terme. Après : la
// fin de la période en cours (la prochaine échéance), et l'annulation part
// tout de suite — PayPal arrête les prélèvements, l'accès court jusqu'à la
// fin payée (fermerALaFin).
export function effetResiliation({ t, terme, prochaine }) {
  if (terme > t) return { effet: terme, annulerLe: Math.max(t, terme - RESIL_AVANCE_MS), pendantEngagement: true };
  const p = Number(prochaine) || 0;
  return { effet: p > t ? p : t, annulerLe: t, pendantEngagement: false };
}
// Le premier paiement : sa garde (transaction : 2) et, au pire, l'écriture qui
// diffère ses suites (1). Les suites (parrain, ambassadeur, attribution) ne
// partent dans le webhook que si leur coût y tient (COUT_SUITE), sinon en
// sous-tâches `paiement_suite` : mesuré le 01/10/2026, un premier paiement
// complet coûtait 72 sous-requêtes d'un bloc.
export const BUDGET_PREMIER = 6;
// Mesurés le 01/10/2026, une marge par-dessus. Le push du parrain n'est pas
// compté : à court de budget, M.pousser1 le diffère à son tour.
export const COUT_SUITE = Object.freeze({ parrainage: 12, ambassadeur: 14, attribution: 10 });
// L'annulation : sa garde (2), la commission (~12) et, au pire, l'écriture qui
// diffère la reprise du premier paiement (1), plus la marge. La reprise du
// premier paiement (mois offert ~8, attribution ~8, accès ~8, journal) en
// coûte COUT_REPRISE_PREMIER : mesuré le 01/10/2026, l'annulation entière
// en demandait ~40 d'un bloc.
export const BUDGET_ANNULER = 16;
export const COUT_REPRISE_PREMIER = 28;
// Un RENOUVELLEMENT remboursé en totalité : l'abonnement relu (plan inconnu
// du registre), le dossier, l'accès fermé, le repère pour fermerALaFin.
export const COUT_FERMER_RENOUVELLEMENT = 12;
// PURE. LA PÉRIODE QU'UN PAIEMENT D'ABONNEMENT COUVRE : de son encaissement
// à un mois (ou un an, pour un plan annuel) plus tard.
export function periodeCouverte(le, planId) {
  const p = OFFRES_PAYPAL[planId];
  return { debut: Number(le) || 0, fin: moisApres(Number(le) || 0, p && p.periode === 'an' ? 12 : 1) };
}
// L'achat d'un programme, de la garde au registre (voir achat) : 2 + 6 + 8 + 8, arrondi.
export const BUDGET_ACHAT = 16;
export class ErreurBudget extends Error {
  constructor(etape, reste) { super('budget : ' + etape + ' (reste ' + reste + ')'); this.budget = true; }
}

let _jeton = null;          // { cle, valeur, expire }
let _jetonEnVol = null;     // { cle, promesse } : deux appels simultanés, une requête
export function oublierJetonPaypal() { _jeton = null; _jetonEnVol = null; }
export async function jetonPaypal(env, fetchImpl, maintenant) {
  const id = String(env.PAYPAL_CLIENT_ID || '').trim(), secret = String(env.PAYPAL_CLIENT_SECRET || '').trim();
  if (!id || !secret) throw new Error('PayPal non configuré');
  const cle = id + ':' + secret;
  const t = (maintenant || Date.now)();
  if (_jeton && _jeton.cle === cle && _jeton.expire > t) return _jeton.valeur;
  if (_jetonEnVol && _jetonEnVol.cle === cle) return _jetonEnVol.promesse;
  const promesse = (async () => {
    const r = await (fetchImpl || fetch)(API + '/v1/oauth2/token', { method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(id + ':' + secret), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials' });
    if (!r.ok) throw new Error('PayPal OAuth ' + r.status);
    const j = await r.json();
    if (!j.access_token) throw new Error('jeton PayPal absent');
    const duree = Math.max(0, (Number(j.expires_in) || 300) - 60) * 1000;
    _jeton = { cle, valeur: j.access_token, expire: (maintenant || Date.now)() + duree };
    return j.access_token;
  })();
  _jetonEnVol = { cle, promesse };
  try { return await promesse; } finally { if (_jetonEnVol && _jetonEnVol.promesse === promesse) _jetonEnVol = null; }
}

// La vérification, avec le corps BRUT inséré tel quel dans la requête.
export async function signatureValide(entetes, brut, env, fetchImpl) {
  const wid = String(env.PAYPAL_WEBHOOK_ID || '').trim();
  if (!wid) return false;
  const h = (k) => entetes.get(k) || '';
  const tete = JSON.stringify({ auth_algo: h('paypal-auth-algo'), cert_url: h('paypal-cert-url'),
    transmission_id: h('paypal-transmission-id'), transmission_sig: h('paypal-transmission-sig'),
    transmission_time: h('paypal-transmission-time'), webhook_id: wid });
  const corps = tete.slice(0, -1) + ',"webhook_event":' + brut + '}';
  try {
    const jeton = await jetonPaypal(env, fetchImpl);
    const r = await (fetchImpl || fetch)(API + '/v1/notifications/verify-webhook-signature', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jeton }, body: corps });
    const j = await r.json();
    return !!(j && j.verification_status === 'SUCCESS');
  } catch (e) { return false; }
}

// UNE LECTURE CHEZ PAYPAL : null si l'objet n'existe pas (404), une ERREUR
// sinon — PayPal indisponible n'est pas « introuvable », et l'erreur remonte
// en 500 pour que PayPal renvoie l'événement plus tard.
async function lirePaypal(chemin, env, fetchImpl) {
  const jeton = await jetonPaypal(env, fetchImpl);
  const r = await (fetchImpl || fetch)(API + chemin, { headers: { Authorization: 'Bearer ' + jeton } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('PayPal ' + r.status + ' sur ' + chemin);
  return r.json();
}
const lireAbonnement = (id, env, f) => (/^I-[A-Z0-9]{8,}$/.test(id) ? lirePaypal('/v1/billing/subscriptions/' + id, env, f) : Promise.resolve(null));
const lireCommande = (id, env, f) => (/^[A-Z0-9]{8,40}$/.test(id) ? lirePaypal('/v2/checkout/orders/' + id, env, f) : Promise.resolve(null));
const lireVente = (id, env, f) => (/^[A-Z0-9]{8,40}$/.test(id) ? lirePaypal('/v1/payments/sale/' + id, env, f) : Promise.resolve(null));
const lireCapture = (id, env, f) => (/^[A-Z0-9]{8,40}$/.test(id) ? lirePaypal('/v2/payments/captures/' + id, env, f) : Promise.resolve(null));
const euros = (c) => (Number.isFinite(Number(c)) && c !== null && c !== '' ? (Number(c) / 100).toFixed(2).replace('.', ',') + ' €' : 'montant inconnu');
const dateFr = (t) => new Date(t).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric' });
const CREATEUR = 'guellec,coachingpro@gmail,com';

/**
 * @param {{db:any, M:any, env:any, fetchImpl?:Function, maintenant?:()=>number}} ctx
 */
export function creerPaypal(ctx) {
  const { db, M, env } = ctx;
  const now = ctx.maintenant || (() => Date.now());
  const lire = async (c) => (await db.ref(c).get()).val();
  const abonnement = (id) => lireAbonnement(id, env, ctx.fetchImpl);
  // LE PAIEMENT DIRECT AU COACH : ses commandes portent un custom_id à TROIS
  // segments (« <coach>|<athlète>|<formule> ») et suivent leur propre chemin.
  const PC = creerPaiementsCoach(ctx);
  // LE BUDGET (voir l'en-tête de ErreurBudget). Hors d'un réveil ou d'un
  // webhook (tests, outils), M.reste n'est pas borné : rien ne lève.
  const resteB = () => (M && typeof M.reste === 'function' ? M.reste() : Infinity);
  const exigerBudget = (etape, n) => { const r = resteB(); if (r < (n || BUDGET_ETAPE)) throw new ErreurBudget(etape, r); };
  // Les push du chemin PayPal : envoyés si le budget le permet, sinon différés.
  const pousser = (uid, message, o) => (M.pousser1 ? M.pousser1(uid, message, o) : M.envoyerPush(uid, message, o));
  // Les abonnements dont des orphelins attendent en sous-tâches, dans CETTE
  // exécution : l'événement courant passe après eux (voir traiter).
  const differesPour = new Set();

  // ── À QUI EST CET ABONNEMENT ? ─────────────────────────────────────────
  // L'index paypal_abonnes d'abord. Sinon, l'abonnement lui-même, lu chez
  // PayPal : l'app le crée avec custom_id = clé du compte. PLUS D'ADRESSE DE
  // PAYEUR : celle du compte PayPal n'a aucune raison d'être celle du compte
  // RepCore, et une coïncidence rattachait l'argent d'un autre.
  async function compteDe(abo) {
    if (!abo) return { cle: null };
    const k = await lire('paypal_abonnes/' + abo);
    if (k) return { cle: k };
    const sub = await abonnement(abo);
    const c = sub && String(sub.custom_id || '');
    if (c && /^[^.#$\[\]\/]+$/.test(c) && (await lire('users/' + c + '/role')) !== null) {
      if (await lier(abo, c)) return { cle: c, sub };
    }
    return { cle: null, sub };
  }

  // RELIER, UNE SEULE FOIS, PUIS REJOUER CE QUI ATTENDAIT. Rendu faux si
  // l'abonnement appartient déjà à un autre compte.
  async function lier(abo, cle) {
    // Le lien posé, ses orphelins DOIVENT pouvoir être relus et différés
    // (transaction 2, lecture 1, sous-tâches 1) : sinon on ne le pose pas.
    exigerBudget('lier', 4);
    let autre = null;
    const tx = await db.ref('paypal_abonnes/' + abo).transaction((v) => { if (v) { autre = v; return undefined; } return cle; });
    if (!tx.committed && autre !== cle) return false;
    await rejouerOrphelins(abo);
    return true;
  }

  // ── LES ORPHELINS ──────────────────────────────────────────────────────
  // Un événement dont l'abonnement n'est encore relié à aucun compte (le
  // webhook arrive souvent AVANT que l'app ait signalé l'abonnement) est
  // RANGÉ, jamais perdu : paypal_orphelins/<abonnement>/<événement>. Il est
  // rejoué, dans l'ordre de PayPal, dès que le lien est fait.
  async function ranger(abo, evt) {
    const lot = abo || 'sans_abonnement';
    const id = net(evt.id) || ('x' + now());
    exigerBudget('ranger');
    await db.ref('paypal_orphelins/' + lot + '/' + id).set({ evt, at: now() });
    return id;
  }
  // UN SEUL REJOUÉ ICI (opts.enLigne, 1 par défaut) : chaque orphelin peut
  // coûter un premier paiement entier. Les suivants partent en sous-tâches
  // `orphelin_paypal`, en UNE écriture, dans l'ordre de PayPal (create_time) ;
  // planif.js les rejoue un par un (rejouerUnOrphelin).
  const triOrphelins = (tout) => Object.keys(tout || {}).map((k) => ({ k, o: tout[k] })).filter((x) => x.o && x.o.evt)
    .sort((a, b) => (Date.parse(a.o.evt.create_time || '') || a.o.at || 0) - (Date.parse(b.o.evt.create_time || '') || b.o.at || 0));
  async function rejouerOrphelins(abo, opts) {
    // Rejouer ici, seulement si le budget couvre un rejeu ENTIER : le lien est
    // déjà posé, et un orphelin coupé en route ne serait plus jamais repris.
    const enLigne = opts && opts.enLigne != null ? opts.enLigne : (resteB() >= BUDGET_PREMIER + BUDGET_ETAPE ? 1 : 0);
    const liste = triOrphelins(await lire('paypal_orphelins/' + abo));
    let n = 0;
    for (const { k, o } of liste.slice(0, enLigne)) {
      let r;
      try {
        r = await traiter(o.evt, { rejeu: true });   // une autre erreur remonte : le reste attend le prochain passage
      } catch (e) {
        // À COURT DE BUDGET EN ROUTE : il part en sous-tâche avec les suivants.
        // Le lien est déjà posé : remonter l'erreur le laisserait orphelin pour
        // toujours (le renvoi trouverait l'index, et ne rejouerait plus rien).
        if (!(e && e.budget)) throw e;
        break;
      }
      // Encore sans compte : traiter l'a rangé à la même place ; on le garde.
      if (r !== 'orphelin') await db.ref('paypal_orphelins/' + abo + '/' + k).remove();
      n++;
    }
    const reste = liste.slice(n);
    if (reste.length) {
      exigerBudget('differer_orphelins', 1);
      await M.differer(reste.map(({ k }) => ({ quoi: 'orphelin_paypal', abo, k })));
      differesPour.add(abo);
    }
    return n;
  }
  // UNE SOUS-TÂCHE : l'orphelin <k> de l'abonnement <abo>. Déjà rejoué (ou
  // retiré) : rien. Rejoué, il quitte paypal_orphelins.
  async function rejouerUnOrphelin(abo, k) {
    const a = net(abo), id = net(k);
    if (!a || !id) return 'incomplet';
    const o = await lire('paypal_orphelins/' + a + '/' + id);
    if (!o || !o.evt) return 'deja_rejoue';
    const r = await traiter(o.evt, { rejeu: true });
    // Encore sans compte : traiter l'a rangé à la même place ; on le garde.
    if (r !== 'orphelin') await db.ref('paypal_orphelins/' + a + '/' + id).remove();
    return r;
  }

  // ── droits/<compte>, CE QUE L'APP LIT D'ABORD (27/09/2026) ──────────────
  // Chaque changement (paiement, résiliation, fin, remboursement, achat) y
  // est écrit EN PLUS du dossier : le dossier, son titulaire l'écrit ; ce
  // nœud, seul le créateur (et ce serveur, en administrateur). Les coachs
  // n'en ont pas : leur palier est coachPlan, et l'app ne lit pas droits/
  // pour eux. Un accès posé à la main par le créateur n'est pas réécrit
  // (voir majDroits, metier.js).
  const PALIERS_OUVERTS = ['essentielle', 'ultime', 'suivi'];
  const palierPaye = (x, plan) => (x && x.palier === 'suivi') ? 'suivi'
    : (plan && plan.formule) || (x && PALIERS_OUVERTS.indexOf(String(x.palier)) >= 0 ? String(x.palier) : 'essentielle');
  const demi = (plan) => (plan && plan.demi ? { demiPackUtilise: true } : {});
  // `plus(x)` : ce qu'un changement de formule ajoute (Ultime gardé jusqu'à
  // l'échéance après une baisse, voir misAJour).
  async function droitsOuverts(cle, abo, plan, plus) {
    return M.majDroits(cle, (x) => Object.assign({ palier: palierPaye(x, plan), echeance: 0, source: 'paypal', abo: abo || (x && x.abo) || null }, demi(plan), plus ? plus(x) : {}));
  }
  async function droitsJusqua(cle, abo, plan, fin) {
    return M.majDroits(cle, (x) => Object.assign({ palier: palierPaye(x, plan), echeance: fin, source: 'paypal', abo: abo || (x && x.abo) || null }, demi(plan)));
  }

  // EST-CE L'ABONNEMENT COURANT DU DOSSIER ? Celui que paypalSubscriptionId
  // désigne ; à défaut d'en désigner un (l'app n'a pas encore envoyé le
  // dossier), celui dont PayPal atteste qu'il a été créé pour ce compte.
  const estCourant = (courant, abo, sub, cle) => (courant ? courant === abo : !!(sub && sub.custom_id === cle));

  // ── LA RÉSILIATION (ou la suspension, ou la fin) ───────────────────────
  // L'accès court jusqu'à la fin payée, plus les mois en réserve. La fin ne
  // RECULE JAMAIS : une suspension puis une annulation donnent la même date,
  // réserve comprise. La réserve, elle, n'est PAS remise à zéro ici : elle
  // n'est consommée qu'à la fin effective (fins(), en transaction), et un
  // abonnement qui repart avant garde ses mois.
  async function fermerALaFin(cle, abo, type) {
    const t = now();
    const [role, statut, courant, a, finNotee, compte] = await Promise.all([lire('users/' + cle + '/role'), lire('users/' + cle + '/status'),
      lire('users/' + cle + '/paypalSubscriptionId'), lire('users/' + cle + '/abonnement'), lire('paypal_fins/' + cle), lire('parrainage/comptes/' + cle)]);
    if (courant && abo && courant !== abo) return { ignore: 'ancien_abonnement' };
    const sub = abo ? await abonnement(abo) : null;
    const prochain = sub && sub.billing_info && Date.parse(sub.billing_info.next_billing_time || '');
    const dernier = sub && sub.billing_info && sub.billing_info.last_payment && Date.parse(sub.billing_info.last_payment.time || '');
    // La fin payée : la prochaine échéance si PayPal la donne, sinon un mois
    // après le dernier paiement, sinon maintenant (impayé sans historique).
    let payee = Number(prochain) > t ? Number(prochain) : (Number(dernier) > 0 ? Number(dernier) + MOIS_MS : t);
    // ⚠ LE PAIEMENT QUI COUVRAIT CETTE ÉCHÉANCE A ÉTÉ REMBOURSÉ (02/10/2026) :
    //   la fin est la date du remboursement, pas la prochaine échéance (un an
    //   plus tard pour un annuel). Relu seulement après un remboursement
    //   (statutPaypal REMBOURSE, posé par fermerAcces) : une requête de plus,
    //   là seulement.
    if (abo && a && a.statutPaypal === 'REMBOURSE') {
      const r = await lire('paypal_rembourses/' + abo);
      if (r && Number(r.debut) < payee && payee <= Number(r.fin) + 2 * 864e5) payee = Math.min(payee, Number(r.le) || t);
    }
    const reserve = role === 'coach' ? 0 : Math.max(0, Number(compte && compte.moisEnReserve) || 0);
    const finAvant = Math.max(Number(a && a.finAccesPaypal) || 0, Number(finNotee && finNotee.fin) || 0);
    const calculee = payee + reserve * MOIS_MS;
    const fin = Math.max(finAvant, calculee);
    const reserveComptee = fin === calculee ? reserve : Number(finNotee && finNotee.reserve) || 0;
    const maj = { ['users/' + cle + '/abonnement/statutPaypal']: type, ['users/' + cle + '/abonnement/finAccesPaypal']: fin,
      ['users/' + cle + '/abonnement/resilieLe']: t, ['users/' + cle + '/updatedAt']: t,
      ['paypal_fins/' + cle]: Object.assign({}, finNotee || {}, { fin, type, le: t, role: role === 'coach' ? 'coach' : 'athlete', reserve: reserveComptee, abo: abo || null }) };
    if (role !== 'coach' && statut === 'AUTONOMIE_PREMIUM') maj['users/' + cle + '/accessExpiry'] = fin;
    // Le coach garde son plan jusqu'à la fin payée : le registre le dit.
    if (role === 'coach') { maj['coachs_registre/' + cle + '/actifJusqu'] = fin; maj['coachs_registre/' + cle + '/maj'] = t; }
    // ── LA RUPTURE D'ENGAGEMENT (02/10/2026) ───────────────────────────────
    // Annulé DIRECTEMENT chez PayPal pendant l'engagement, sans résiliation
    // demandée dans l'app (resiliations/<clé>, que seul ce serveur écrit) :
    // les échéances restantes sont dues (CGV §5). L'accès N'EST PAS prolongé
    // jusqu'au terme : il court jusqu'à la fin payée, comme toute fin. Kevin
    // décide du recouvrement : une ligne au journal, un push.
    const terme = type === 'CANCELLED' && role !== 'coach'
      ? termeEngagement({ role, engagementJusqu: a && a.engagementJusqu, debut: sub && sub.start_time }) : 0;
    // La résiliation demandée n'est relue que si la fin tombe avant le terme :
    // une requête de plus, seulement là où une rupture est possible.
    // Un abonnement dont un paiement vient d'être remboursé (statutPaypal
    // REMBOURSE) n'est pas une rupture : c'est RepCore qui a rendu l'argent.
    const rupture = !!(terme && terme - fin > RUPTURE_MARGE_MS && !(a && a.statutPaypal === 'REMBOURSE') && !(await lire('resiliations/' + cle)));
    exigerBudget('fin', rupture ? BUDGET_ETAPE + 2 : BUDGET_ETAPE);
    await db.ref().update(maj);
    if (role !== 'coach') await droitsJusqua(cle, abo, sub && OFFRES_PAYPAL[sub.plan_id], fin);
    if (rupture) {
      const moisRestants = Math.ceil((terme - fin) / MOIS_MS);
      await journal({ quoi: 'rupture_engagement', qui: qui(cle), abo: abo || null, mois_restants: moisRestants,
        pourquoi: 'abonnement annulé chez PayPal le ' + dateFr(t) + ', engagement jusqu’au ' + dateFr(terme),
        actions: ['accès jusqu’à la fin payée (' + dateFr(fin) + '), pas au-delà', moisRestants + ' échéance(s) restante(s) : recouvrement à décider'] });
      await pousserAdmin('Rupture d’engagement', qui(cle) + ' a annulé chez PayPal : ' + moisRestants + ' mois restants sur l’engagement', 'rupture-' + cle);
      return { fin, reserve: reserveComptee, rupture: moisRestants };
    }
    return { fin, reserve: reserveComptee };
  }

  // ── LE PAIEMENT D'UN ABONNEMENT ────────────────────────────────────────
  // N'OUVRE QUE SUR PREUVE : l'abonnement, relu chez PayPal, est ACTIVE et
  // c'est le courant du dossier. Un paiement arrivé après une annulation, ou
  // sur un ancien abonnement, ne rouvre rien.
  async function paiementAbonnement(cle, abo, ress, subConnu) {
    const t = now();
    const sub = subConnu || await abonnement(abo);
    const [role, statut, courant, a, finNotee] = await Promise.all([lire('users/' + cle + '/role'), lire('users/' + cle + '/status'),
      lire('users/' + cle + '/paypalSubscriptionId'), lire('users/' + cle + '/abonnement'), lire('paypal_fins/' + cle)]);
    const plan = sub && OFFRES_PAYPAL[sub.plan_id];
    const ouvrir = !!(sub && sub.status === 'ACTIVE' && estCourant(courant, abo, sub, cle));
    // ── DEUX ABONNEMENTS ACTIFS (02/10/2026) ──────────────────────────────
    // Un paiement encaissé sur un abonnement ACTIVE qui n'est pas le courant
    // du dossier : le client paie deux fois. L'app ne le permet plus (« Changer
    // de formule », remplacement à l'approbation), mais un doublon d'avant
    // existe peut-être. Rien n'est annulé d'office : l'administrateur est
    // prévenu, une ligne au journal, un push à chaque prélèvement en double.
    if (sub && sub.status === 'ACTIVE' && courant && courant !== abo) await doubleAbonnement(cle, abo, courant, ress);
    if (ouvrir) {
      const b = 'users/' + cle + '/';
      const maj = { [b + 'abonnement/dernierPaiementLe']: t, [b + 'abonnement/statutPaypal']: 'ACTIVE', [b + 'updatedAt']: t,
        [b + 'paymentStatus']: 'active', ['paypal_fins/' + cle]: null };
      if (a && a.finAccesPaypal) {    // un impayé réglé, ou une résiliation annulée : on rouvre
        maj[b + 'abonnement/finAccesPaypal'] = null;
        if (role !== 'coach') maj[b + 'accessExpiry'] = null;
      }
      if (role === 'coach') {
        // LE PALIER PAYÉ REVIENT : une résiliation l'avait refermé (fins()).
        if (plan && plan.coachPlan) {
          maj[b + 'coachPlan'] = plan.coachPlan; maj[b + 'coachSubActive'] = true;
          // LE REGISTRE DES COACHS (30/09/2026) : c'est lui que l'app lit, le
          // dossier n'étant plus qu'un miroir. Actif jusqu'à la prochaine
          // échéance PayPal, plus sept jours de grâce pour un webhook en retard.
          const prochain = sub && sub.billing_info && Date.parse(sub.billing_info.next_billing_time || '');
          maj['coachs_registre/' + cle + '/plan'] = plan.coachPlan;
          maj['coachs_registre/' + cle + '/actifJusqu'] = Math.max(Number(prochain) || 0, t + MOIS_MS) + 7 * 86400000;
          maj['coachs_registre/' + cle + '/maj'] = t;
          // LE QUOTA (02/10/2026) : la couverture de ses athlètes est recalculée
          // dès le réveil suivant (metier.js couvertureCoach), pas demain.
          maj['worker/jobs/couverture_coachs'] = null;
        }
      } else if (plan && plan.formule && statut !== 'COACHING_SUIVI') {
        maj[b + 'status'] = 'AUTONOMIE_PREMIUM';
        maj[b + 'abonnement/formule'] = plan.formule;
      }
      exigerBudget('paiement');
      await db.ref().update(maj);
      if (role !== 'coach') await droitsOuverts(cle, abo, plan);
      // Les mois offerts ajoutés à une fin qui disparaît retournent en réserve.
      const recules = Number(finNotee && finNotee.moisRecules) || 0;
      if (recules > 0) await db.ref('parrainage/comptes/' + cle + '/moisEnReserve').transaction((n) => (Number(n) || 0) + recules);
    }
    const valide = montantValide(plan, ress.amount && (ress.amount.total || ress.amount.value),
      ress.amount && (ress.amount.currency || ress.amount.currency_code), role);
    const premier = valide ? await premierPaiement(cle, abo, ress) : false;
    await noterTransaction(ress.id, { cle, abo, type: 'abonnement', premier, plan: (sub && sub.plan_id) || null,
      montant: centimes(ress.amount && (ress.amount.total || ress.amount.value)), devise: String((ress.amount && ress.amount.currency) || '') });
    await lancerSuites();
    return premier ? 'premier_paiement' : (ouvrir ? 'paiement' : 'paiement_sans_ouverture');
  }

  // ── L'ACHAT D'UN PROGRAMME ─────────────────────────────────────────────
  // Le compte est dans la commande (custom_id = « <clé>|<programme> », posé
  // par l'app), RELUE CHEZ PAYPAL. Le montant doit être le prix de la
  // boutique, en euros, sur la commande comme sur la capture.
  // `commandeLue` : la commande déjà relue chez PayPal (verifierAchat), pour
  // ne pas la relire une seconde fois.
  async function achat(evt, commandeLue) {
    const ress = evt.resource || {};
    const rel = ress.supplementary_data && ress.supplementary_data.related_ids;
    const idCommande = String((rel && rel.order_id) || '');
    const commande = commandeLue || (idCommande ? await lireCommande(idCommande, env, ctx.fetchImpl) : null);
    const pu = commande && Array.isArray(commande.purchase_units) ? commande.purchase_units[0] : null;
    if (pu && lireCustomId(pu.custom_id)) return PC.evenementCapture(evt, commande);
    const [cle, prog] = String((pu && pu.custom_id) || '').split('|');
    if (!pu || !cle || /[.#$\[\]\/]/.test(cle) || (await lire('users/' + cle + '/role')) === null) {
      await ranger('commande_' + (net(idCommande) || 'inconnue'), evt);
      return 'orphelin';
    }
    const prixCts = prog && !/[.#$\[\]\/]/.test(prog) ? await lire('boutique/' + prog + '/prixCts') : null;
    const role = await lire('users/' + cle + '/role');
    const devise = (x) => String((x && x.currency_code) || '').toUpperCase();
    const valide = role !== 'coach' && Number.isFinite(Number(prixCts)) && Number(prixCts) > 0
      && devise(pu.amount) === 'EUR' && devise(ress.amount) === 'EUR'
      && centimes(pu.amount.value) === Number(prixCts) && centimes(ress.amount.value) === Number(prixCts);
    // UNE CAPTURE N'OUVRE QU'UNE FOIS. Le webhook et l'appel de l'app
    // (verifierAchatProgramme) annoncent le même achat : le second ne rouvre
    // pas trois mois de plus. La garde, en transaction, sur le registre.
    // ⚠ TOUT LE BUDGET DE L'ÉTAPE AVANT LA GARDE (garde 2, premier paiement
    //   6, droits 8, registre 8, moins ce qui est déjà consommé en route) :
    //   une ErreurBudget APRÈS la garde laisserait l'achat marqué ouvert sans
    //   l'être, et le renvoi de PayPal le sauterait. Et toute autre erreur
    //   (base, réseau) relâche la garde avant de remonter.
    const garde = valide && net(ress.id) ? db.ref('paypal_transactions/' + net(ress.id) + '/ouvert') : null;
    if (garde) {
      exigerBudget('garde_achat', BUDGET_ACHAT);
      const g = await garde.transaction((v) => (v ? undefined : now()));
      if (!g.committed) return 'deja_ouvert';
    }
    try {
      return await achatOuvrir(evt, { cle, prog, prixCts, valide, idCommande, ress });
    } catch (e) {
      if (garde) await garde.remove().catch(() => null);
      throw e;
    }
  }
  async function achatOuvrir(evt, { cle, prog, prixCts, valide, idCommande, ress }) {
    const premier = valide ? await premierPaiement(cle, null, ress) : false;
    // LE PROGRAMME OUVRE ULTIME TROIS MOIS, par-dessus le palier de
    // l'abonnement (ultimeJusqu), sans le remplacer.
    if (valide) {
      const t = now();
      exigerBudget('achat');
      await M.majDroits(cle, (x) => ({ palier: (x && x.palier) || 'aucun', echeance: Number(x && x.echeance) || 0, source: (x && x.source) || 'paypal',
        ultimeJusqu: Math.max(Number(x && x.ultimeJusqu) || 0, t) + PROGRAMME_MS }));
      // LA TRACE DE L'ACHAT DANS LE DOSSIER, écrite ICI depuis le 30/09/2026 :
      // programmesAchetes est gelé par les règles, l'app ne peut plus l'y poser.
      // ET LA PREUVE D'ACHAT, dans droits/ (01/10/2026) : c'est elle, et elle
      // seule, qui ouvre boutique_contenu/<prog> — le contenu vendu.
      await db.ref().update({ ['users/' + cle + '/programmesAchetes/' + prog]: { le: t, prixCts: Number(prixCts),
        ordre: net(idCommande).slice(0, 64), ouvertJusqu: t + PROGRAMME_MS }, ['users/' + cle + '/updatedAt']: t,
        ['droits/' + cle + '/programmes/' + prog]: t });
    }
    await noterTransaction(ress.id, { cle, prog: prog || null, commande: idCommande, type: 'programme', premier,
      montant: centimes(ress.amount && ress.amount.value), devise: String((ress.amount && ress.amount.currency_code) || '') });
    await lancerSuites();
    if (!valide) return 'achat_non_compte';
    return premier ? 'premier_paiement' : 'paiement';
  }

  // ── L'ACHAT ANNONCÉ PAR L'APP (verifierAchatProgramme) ─────────────────
  // Porté de functions/index.js. L'app envoie l'identifiant de la commande
  // dès la capture, sans attendre le webhook : le contenu s'ouvre tout de
  // suite. RIEN N'EST CRU DU CLIENT : la commande est relue chez PayPal,
  // elle doit être COMPLETED, porter custom_id = « <clé de l'appelant>|<programme> »
  // et une capture COMPLETED au prix de la boutique. Puis c'est LE MÊME
  // chemin que le webhook (achat) : premier paiement, droits, trace, registre.
  // Rend {ouvert, deja, jusqua} ; lève ErreurAppel sinon.
  async function verifierAchat(cle, orderId, programmeId) {
    const id = String(orderId || '').trim(), prog = String(programmeId || '').trim();
    if (!/^[A-Z0-9]{8,40}$/.test(id)) throw new ErreurAppel(400, 'Commande PayPal mal formée.');
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(prog)) throw new ErreurAppel(400, 'Programme mal formé.');
    const commande = await lireCommande(id, env, ctx.fetchImpl);
    if (!commande) throw new ErreurAppel(404, 'Commande PayPal introuvable.');
    const pu = Array.isArray(commande.purchase_units) ? commande.purchase_units[0] : null;
    // LA COMMANDE D'UN AUTRE COMPTE (ou d'un autre programme) : refusée, et
    // rien n'est écrit — c'est le webhook qui la rangera chez son titulaire.
    if (!pu || String(pu.custom_id || '') !== cle + '|' + prog) throw new ErreurAppel(403, "Cette commande n'est pas la tienne.");
    const caps = (pu.payments && Array.isArray(pu.payments.captures)) ? pu.payments.captures : [];
    const cap = caps.find((c) => c && c.status === 'COMPLETED');
    if (commande.status !== 'COMPLETED' || !cap) {
      throw new ErreurAppel(409, 'Paiement pas encore encaissé chez PayPal (statut : ' + String(commande.status || 'inconnu') + ').');
    }
    const evt = { event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: Object.assign({}, cap, { supplementary_data: { related_ids: { order_id: id } } }) };
    const r = await achat(evt, commande);
    if (r === 'achat_non_compte') throw new ErreurAppel(403, 'Montant ou devise différents du prix de la boutique : achat non ouvert.');
    if (r === 'orphelin') throw new ErreurAppel(403, "Cette commande n'est pas la tienne.");
    const d = await lire('droits/' + cle);
    return { ok: true, ouvert: r !== 'deja_ouvert', deja: r === 'deja_ouvert',
      jusqua: Number(d && d.ultimeJusqu) || 0, programme: prog };
  }

  // ── LE REGISTRE DES ENCAISSEMENTS ──────────────────────────────────────
  // paypal_transactions/<vente ou capture> : à qui, combien, et si c'était le
  // premier paiement du compte. C'est ce qu'un remboursement ou un litige
  // relit pour savoir quoi reprendre — PayPal ne le redit pas.
  async function noterTransaction(id, rec) {
    const k = net(id);
    if (!k) return;
    exigerBudget('transaction');
    await db.ref('paypal_transactions/' + k).update(Object.assign({ le: now() }, rec));
  }

  // LE PREMIER PAIEMENT, TOUS ACHATS CONFONDUS : un nœud du serveur seul,
  // pris en transaction — deux événements simultanés ne récompensent pas deux fois.
  const suitesEnAttente = [];
  async function lancerSuites() {
    const differes = [];
    for (const lot of suitesEnAttente.splice(0)) {
      for (const { etape, fn, extra, cle } of lot) {
        if (M.differer && resteB() < COUT_SUITE[etape] + BUDGET_ETAPE) { differes.push(Object.assign({ quoi: 'paiement_suite', etape, cle }, extra)); continue; }
        await fn().catch(() => null);
      }
    }
    if (differes.length) await M.differer(differes);
  }
  async function premierPaiement(cle, abo, ress) {
    const t = now();
    // La garde (paypal_premiers) puis parrain, ambassadeur, attribution : le
    // budget de TOUTE l'étape, avant la garde.
    exigerBudget('premier_paiement', BUDGET_PREMIER);
    const tx = await db.ref('paypal_premiers/' + cle).transaction((v) => (v ? undefined : { le: t, abo: abo || null, vente: net(ress.id) || null }));
    if (!tx.committed) return false;
    const montant = ress.amount && (ress.amount.total || ress.amount.value);
    const ap = { montant, le: Date.parse(ress.create_time || '') || t, abonnement: abo || null, venteId: ress.id || null };
    // LES SUITES : chacune est gardée par sa propre transaction (rejouable sans
    // double compte). Ici si le budget du webhook le permet, sinon à la minute
    // suivante — et là, une erreur est réessayée au lieu d'être perdue.
    // Elles partent APRÈS le registre de la transaction (lancerSuites, appelé
    // par paiementAbonnement et achat) : c'est lui que relit un remboursement.
    suitesEnAttente.push([['parrainage', () => M.parrainagePaiement(cle, 'paypal'), {}],
      ['ambassadeur', () => M.ambassadeurPaiement(cle, ap), { p: ap }],
      ['attribution', () => M.attributionPaiement(cle), {}]].map(([etape, fn, extra]) => ({ etape, fn, extra, cle })));
    return true;
  }

  // `o.rejeu` : un orphelin qu'on rejoue (dans le webhook du lien, ou en
  // sous-tâche) ; il est lui-même dans l'ordre, et ne se re-diffère jamais.
  async function traiter(evt, o) {
    exigerBudget('debut');
    const rejeu = !!(o && o.rejeu);
    const type = String(evt.event_type || '');
    const ress = evt.resource || {};
    if (type === 'PAYMENT.SALE.REFUNDED' || type === 'PAYMENT.CAPTURE.REFUNDED') return rembourse(evt);
    if (type === 'PAYMENT.SALE.REVERSED') return retrofacture(evt);
    if (type === 'CUSTOMER.DISPUTE.CREATED') return litigeOuvert(evt);
    if (type === 'CUSTOMER.DISPUTE.RESOLVED') return litigeClos(evt);
    if (type === 'PAYMENT.CAPTURE.COMPLETED') return achat(evt);
    const abo = net(ress.billing_agreement_id || (String(ress.id || '').startsWith('I-') ? ress.id : ''));
    const connus = ['BILLING.SUBSCRIPTION.ACTIVATED', 'PAYMENT.SALE.COMPLETED', 'BILLING.SUBSCRIPTION.CANCELLED',
      'BILLING.SUBSCRIPTION.EXPIRED', 'BILLING.SUBSCRIPTION.SUSPENDED', 'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
      'BILLING.SUBSCRIPTION.UPDATED'];
    if (connus.indexOf(type) < 0) return 'ignore';
    const { cle, sub } = await compteDe(abo);
    if (!cle) { await ranger(abo, evt); return 'orphelin'; }
    // DES ORPHELINS PLUS ANCIENS ATTENDENT EN SOUS-TÂCHES (le lien vient
    // d'être fait) : celui-ci passe APRÈS eux, comme PayPal les a envoyés.
    // Une résiliation ne doit pas être appliquée avant le paiement qui la précède.
    if (!rejeu && differesPour.has(abo)) {
      const k = await ranger(abo, evt);
      await M.differer([{ quoi: 'orphelin_paypal', abo, k }]);
      return 'apres_orphelins';
    }
    if (type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const courant = await lire('users/' + cle + '/paypalSubscriptionId');
      if (!estCourant(courant, abo, sub || ress, cle)) return 'ancien_abonnement';
      exigerBudget('activation');
      await db.ref().update({ ['users/' + cle + '/abonnement/statutPaypal']: 'ACTIVE', ['users/' + cle + '/updatedAt']: now() });
      // L'ACCÈS S'OUVRE DÈS L'ACTIVATION, sans attendre le paiement qui suit :
      // l'app ne donne plus l'abonnement sur la foi du dossier.
      const s2 = sub || ress;
      if (s2.status === 'ACTIVE' && (await lire('users/' + cle + '/role')) !== 'coach') await droitsOuverts(cle, abo, OFFRES_PAYPAL[s2.plan_id]);
      // Relu chez PayPal (sub) avant d'annuler quoi que ce soit, jamais sur la foi de l'avis seul.
      if (s2.status === 'ACTIVE') await remplacementEnAttente(abo, sub);
      return 'active';
    }
    if (type === 'BILLING.SUBSCRIPTION.UPDATED') return misAJour(cle, abo);
    if (type === 'PAYMENT.SALE.COMPLETED') return paiementAbonnement(cle, abo, ress, sub);
    if (type === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') return 'echec_note';   // PayPal réessaie ; SUSPENDED suivra s'il faut
    const r = await fermerALaFin(cle, abo, type.split('.').pop());
    return r.ignore || (r.rupture ? 'rupture_engagement' : 'fin_posee');
  }

  // ══ LA RÉSILIATION, TENUE PAR LE SERVEUR (02/10/2026) ═══════════════════
  //
  // L'app disait : « RepCore ne peut pas annuler l'abonnement à ta place ».
  // C'était vrai sans serveur. Désormais :
  //   · POST /resiliation (resilier) enregistre la demande dans
  //     resiliations/<clé> = {ts, motif, abo, effet, annulerLe} : la date
  //     d'effet est le terme de l'engagement (CGV §5), ou, après les douze
  //     mois, la fin de la période en cours ;
  //   · PENDANT L'ENGAGEMENT, RIEN N'EST ANNULÉ CHEZ PAYPAL : les échéances
  //     restantes sont dues. Le travail quotidien (resiliationsDues) annule
  //     l'abonnement chez PayPal trois jours avant la date d'effet ;
  //   · après l'engagement, l'annulation part tout de suite.
  // Un abonnement résilié dans l'app n'est donc plus jamais prélevé après sa
  // date d'effet, sans que la personne ait à passer par PayPal.
  async function resilier(cle, motifBrut, tsBrut) {
    const t = now();
    const deja = await lire('resiliations/' + cle);
    if (deja && deja.effet) return { effet: Number(deja.effet), annulerLe: Number(deja.annulerLe) || 0, annule: !!deja.annuleLe, deja: true };
    const [abo, role, a] = await Promise.all([lire('users/' + cle + '/paypalSubscriptionId'), lire('users/' + cle + '/role'), lire('users/' + cle + '/abonnement')]);
    if (!/^I-[A-Z0-9]{8,}$/.test(String(abo || ''))) throw new ErreurAppel(404, 'Aucun abonnement PayPal sur ce compte.');
    const sub = await abonnement(abo);
    if (!sub) throw new ErreurAppel(404, 'Abonnement introuvable chez PayPal.');
    // La date de la demande : celle de l'appareil (une demande faite hors
    // ligne compte du jour où elle a été faite), bornée aux 30 derniers jours.
    const tsC = Number(tsBrut);
    const ts = tsC > 0 && tsC <= t && t - tsC < 30 * 864e5 ? tsC : t;
    const terme = termeEngagement({ role, engagementJusqu: a && a.engagementJusqu, debut: sub.start_time });
    const prochaine = Date.parse((sub.billing_info && sub.billing_info.next_billing_time) || '') || 0;
    const fini = sub.status === 'CANCELLED' || sub.status === 'EXPIRED';
    const e = fini ? { effet: Math.max(prochaine, ts), annulerLe: ts, pendantEngagement: false } : effetResiliation({ t: ts, terme, prochaine });
    const rec = { ts, motif: String(motifBrut || '').slice(0, 300), abo, effet: e.effet, annulerLe: e.annulerLe, le: t };
    if (fini) rec.annuleLe = t;          // déjà fait chez PayPal : rien à envoyer
    exigerBudget('resiliation', 2);
    await db.ref('resiliations/' + cle).set(rec);
    // Hors engagement : l'annulation part maintenant (une échéance pourrait
    // tomber avant le prochain passage du travail quotidien).
    let annule = fini;
    if (!fini && e.annulerLe <= t) annule = (await annulerResiliation(cle, rec, t)) === 'annule';
    return { effet: e.effet, annulerLe: e.annulerLe, annule, pendantEngagement: e.pendantEngagement };
  }
  // L'ANNULATION CHEZ PAYPAL d'une résiliation arrivée à date. Seulement si
  // l'abonnement résilié est encore celui du dossier : remplacé depuis (une
  // nouvelle souscription), il n'y a plus rien à arrêter.
  async function annulerResiliation(cle, r, t) {
    const courant = await lire('users/' + cle + '/paypalSubscriptionId');
    if (courant && courant !== r.abo) {
      await db.ref('resiliations/' + cle).update({ annuleLe: t, etat: 'remplace' });
      return 'remplace';
    }
    const rep = await ecrirePaypal('/v1/billing/subscriptions/' + r.abo + '/cancel', { reason: 'Résiliation demandée dans RepCore' });
    // 204 : annulé. 422 : déjà annulé ou inactif chez PayPal.
    if (!rep.ok && rep.status !== 422) throw new Error('PayPal ' + rep.status + ' sur l’annulation de ' + r.abo);
    await db.ref('resiliations/' + cle).update({ annuleLe: t, etat: 'annule' });
    return 'annule';
  }
  // LE TRAVAIL QUOTIDIEN : chaque résiliation dont le jour d'annulation est
  // venu. ~3 requêtes chacune ; au-delà du budget, les suivantes partent en
  // sous-tâches (une par compte). Le jour d'annulation précède la date
  // d'effet de trois jours : un passage manqué se rattrape le lendemain.
  async function resiliationsDues(tBrut) {
    const t = tBrut || now();
    const tout = (await lire('resiliations')) || {};
    const dues = Object.keys(tout).filter((k) => tout[k] && !tout[k].annuleLe && Number(tout[k].annulerLe) <= t && tout[k].abo);
    for (let i = 0; i < dues.length; i++) {
      if (resteB() < BUDGET_ETAPE && M && M.differer) {
        await M.differer(dues.slice(i).map((cle) => ({ quoi: 'resiliation_paypal', cle })));
        return 'differe';
      }
      await annulerResiliation(dues[i], tout[dues[i]], t);
    }
    return dues.length;
  }
  async function resiliationTache(cleBrut) {
    const cle = String(cleBrut || '');
    const r = cle ? await lire('resiliations/' + cle) : null;
    if (!r || r.annuleLe || !(Number(r.annulerLe) <= now())) return 'plus_due';
    return annulerResiliation(cle, r, now());
  }

  // ══ CHANGER DE FORMULE SANS DEUXIÈME ABONNEMENT (02/10/2026) ════════════
  //
  // Un abonné qui passait d'Essentielle à Ultime souscrivait un SECOND
  // abonnement : l'ancien continuait d'être prélevé, et ce serveur l'ignorait
  // (« ancien_abonnement », « paiement_sans_ouverture »). Trois chemins le
  // ferment :
  //   · changerFormule (POST /abonnement/changer) RÉVISE l'abonnement en
  //     cours chez PayPal (/revise) : un seul abonnement, un autre plan. La
  //     personne valide chez PayPal (lien rel=approve), puis PayPal envoie
  //     BILLING.SUBSCRIPTION.UPDATED, traité par misAJour ;
  //   · remplacer : un nouvel abonnement approuvé alors qu'un autre existait
  //     (l'ancien était résilié, ou l'app d'avant) — l'ancien est annulé chez
  //     PayPal, mais SEULEMENT quand le nouveau est ACTIVE ;
  //   · doubleAbonnement : un doublon qui existe déjà est signalé.
  // ⚠ L'ENGAGEMENT (abonnement/engagementJusqu) n'est jamais touché ici : un
  //   changement de formule ne le fait pas repartir à zéro.
  const RANG = { essentielle: 1, ultime: 2, coach: 1, pro: 2 };
  const rangPlan = (p) => (p ? RANG[p.coachPlan || p.formule] || 0 : 0);
  // Les plans annuels de l'athlète : abonnement/palier suit le plan facturé.
  const ANNUELS = Object.keys(OFFRES_PAYPAL).filter((k) => OFFRES_PAYPAL[k].periode === 'an');
  const estA = async (cle, abo, sub) => {
    const k = await lire('paypal_abonnes/' + abo);
    if (k) return k === cle;
    if (sub && sub.custom_id) return sub.custom_id === cle;
    return !!(sub && cleEmail(sub.subscriber && sub.subscriber.email_address) === cle);
  };
  async function ecrirePaypal(chemin, corps) {
    const jeton = await jetonPaypal(env, ctx.fetchImpl);
    return (ctx.fetchImpl || fetch)(API + chemin, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jeton }, body: JSON.stringify(corps) });
  }

  // L'APPEL DE L'APP. Rend { approve, baisse, effet, formule } : le lien à
  // ouvrir pour valider chez PayPal ; pour une baisse (Ultime → Essentielle,
  // Pro → Coach), la date d'effet, qui est la prochaine échéance.
  async function changerFormule(cle, planIdBrut) {
    const planId = String(planIdBrut || '').trim();
    const cible = Object.prototype.hasOwnProperty.call(OFFRES_PAYPAL, planId) ? OFFRES_PAYPAL[planId] : null;
    if (!cible) throw new ErreurAppel(400, 'Formule inconnue.');
    // Le premier mois à moitié prix accueille un NOUVEL abonné, une fois.
    if (cible.demi) throw new ErreurAppel(400, 'Le premier mois à moitié prix ne s’applique pas à un changement de formule.');
    const [abo, role] = await Promise.all([lire('users/' + cle + '/paypalSubscriptionId'), lire('users/' + cle + '/role')]);
    if (!/^I-[A-Z0-9]{8,}$/.test(String(abo || ''))) throw new ErreurAppel(404, 'Aucun abonnement PayPal sur ce compte.');
    const sub = await abonnement(abo);
    if (!sub) throw new ErreurAppel(404, 'Abonnement introuvable chez PayPal.');
    if (!(await estA(cle, abo, sub))) throw new ErreurAppel(403, 'Cet abonnement n’est pas le tien.');
    // DÉJÀ ANNULÉ OU ÉCHU CHEZ PAYPAL, sans que le dossier le sache : rien
    // à réviser, et rien n'empêche plus une nouvelle souscription. Le dossier
    // l'apprend ici (statutPaypal), l'app remonte le bouton de souscription.
    if (sub.status === 'CANCELLED' || sub.status === 'EXPIRED') {
      exigerBudget('statut', 2);
      await db.ref().update({ ['users/' + cle + '/abonnement/statutPaypal']: sub.status, ['users/' + cle + '/updatedAt']: now() });
      return { fini: true, statut: sub.status };
    }
    if (sub.status !== 'ACTIVE') throw new ErreurAppel(409, 'Ton abonnement n’est pas actif chez PayPal (' + String(sub.status || 'inconnu') + ') : il ne peut pas changer de formule.');
    if (sub.plan_id === planId) throw new ErreurAppel(409, 'C’est déjà ta formule.');
    const actuel = OFFRES_PAYPAL[sub.plan_id] || null;
    // Un coach reste coach, un athlète reste athlète.
    if ((role === 'coach') !== !!cible.coachPlan || (actuel && !!actuel.coachPlan !== !!cible.coachPlan)) {
      throw new ErreurAppel(400, 'Cette formule n’est pas proposée à ce compte.');
    }
    const APP = String(env.APP_URL || 'https://repcore-sync.web.app/app/').trim();
    const r = await ecrirePaypal('/v1/billing/subscriptions/' + abo + '/revise', { plan_id: planId,
      application_context: { brand_name: 'RepCore', locale: 'fr-FR', shipping_preference: 'NO_SHIPPING', user_action: 'CONTINUE',
        return_url: APP + '?formule=validee', cancel_url: APP + '?formule=annulee' } });
    if (!r.ok) throw new ErreurAppel(502, 'PayPal refuse le changement (' + r.status + ').');
    const j = await r.json();
    const lien = (Array.isArray(j && j.links) ? j.links : []).find((l) => l && l.rel === 'approve');
    if (!lien || !lien.href) throw new ErreurAppel(502, 'PayPal n’a pas rendu de lien de validation.');
    const baisse = rangPlan(cible) < rangPlan(actuel);
    const prochain = Date.parse((sub.billing_info && sub.billing_info.next_billing_time) || '') || 0;
    const effet = baisse ? prochain : 0;
    // La demande, relue par misAJour : la date d'effet d'une baisse.
    exigerBudget('revision', 2);
    await db.ref('paypal_revisions/' + abo).set({ cle, de: String(sub.plan_id || ''), vers: planId, le: now(), effet });
    return { approve: String(lien.href), baisse, effet, formule: cible.coachPlan || cible.formule };
  }

  // BILLING.SUBSCRIPTION.UPDATED : l'abonnement, RELU chez PayPal, porte un
  // autre plan. Les droits suivent le plan facturé. Après une baisse,
  // l'ancienne formule court jusqu'à la date d'effet (Ultime : ultimeJusqu).
  async function misAJour(cle, abo) {
    const t = now();
    const [courant, role, statut, rev] = await Promise.all([lire('users/' + cle + '/paypalSubscriptionId'), lire('users/' + cle + '/role'),
      lire('users/' + cle + '/status'), lire('paypal_revisions/' + abo)]);
    const sub = await abonnement(abo);
    if (!estCourant(courant, abo, sub, cle)) return 'ancien_abonnement';
    if (!sub || sub.status !== 'ACTIVE') return 'maj_sans_effet';
    const plan = OFFRES_PAYPAL[sub.plan_id];
    if (!plan) return 'plan_inconnu';
    const b = 'users/' + cle + '/';
    const maj = { [b + 'abonnement/statutPaypal']: 'ACTIVE', [b + 'updatedAt']: t };
    if (rev && rev.vers === sub.plan_id) maj['paypal_revisions/' + abo] = null;
    if (role === 'coach') {
      if (!plan.coachPlan) return 'plan_inconnu';
      const prochain = Date.parse((sub.billing_info && sub.billing_info.next_billing_time) || '') || 0;
      maj[b + 'coachPlan'] = plan.coachPlan; maj[b + 'coachSubActive'] = true;
      maj['coachs_registre/' + cle + '/plan'] = plan.coachPlan;
      maj['coachs_registre/' + cle + '/actifJusqu'] = Math.max(prochain, t + MOIS_MS) + 7 * 86400000;
      maj['coachs_registre/' + cle + '/maj'] = t;
      maj['worker/jobs/couverture_coachs'] = null;
      exigerBudget('changement');
      await db.ref().update(maj);
      return 'formule_changee';
    }
    if (!plan.formule) return 'plan_inconnu';
    maj[b + 'abonnement/formule'] = plan.formule;
    maj[b + 'abonnement/palier'] = ANNUELS.indexOf(sub.plan_id) >= 0 ? 'annuel' : 'mensuel';
    if (statut !== 'COACHING_SUIVI') maj[b + 'status'] = 'AUTONOMIE_PREMIUM';
    exigerBudget('changement');
    await db.ref().update(maj);
    // UNE BAISSE NE RETIRE RIEN AVANT L'ÉCHÉANCE DÉJÀ PAYÉE : Ultime court
    // jusqu'à la date d'effet notée à la demande (sinon la prochaine échéance).
    const prochain = Date.parse((sub.billing_info && sub.billing_info.next_billing_time) || '') || 0;
    const effet = rev && rev.vers === sub.plan_id ? Number(rev.effet) || 0 : prochain;
    await droitsOuverts(cle, abo, plan, (x) => (plan.formule === 'essentielle' && x && x.palier === 'ultime' && effet > t
      ? { ultimeJusqu: Math.max(Number(x.ultimeJusqu) || 0, effet) } : {}));
    return 'formule_changee';
  }

  // LE REMPLACEMENT : `nouveau` vient d'être approuvé, `ancien` était dans le
  // dossier. L'ancien n'est annulé chez PayPal que si le nouveau est ACTIVE ;
  // sinon la demande attend (paypal_remplacements), reprise à l'activation
  // du nouveau (BILLING.SUBSCRIPTION.ACTIVATED, qui précède son premier
  // paiement ; pas de lecture de plus dans le paiement, au budget serré). Déjà annulé ou échu : rien à faire.
  async function remplacer(cle, nouveau, ancienBrut, subNouveau) {
    const ancien = net(ancienBrut);
    if (!/^I-[A-Z0-9]{8,}$/.test(ancien) || ancien === nouveau) return 'rien';
    const vieux = await abonnement(ancien);
    if (!vieux) { await db.ref('paypal_remplacements/' + nouveau).remove(); return 'ancien_introuvable'; }
    if (!(await estA(cle, ancien, vieux))) return 'ancien_pas_a_toi';
    if (vieux.status === 'CANCELLED' || vieux.status === 'EXPIRED') {
      await db.ref('paypal_remplacements/' + nouveau).remove();
      return 'ancien_deja_annule';
    }
    const nv = subNouveau && subNouveau.id === nouveau ? subNouveau : await abonnement(nouveau);
    if (!nv || nv.status !== 'ACTIVE') {
      exigerBudget('remplacement_attente', 2);
      await db.ref('paypal_remplacements/' + nouveau).set({ cle, ancien, le: now() });
      return 'en_attente_activation';
    }
    exigerBudget('remplacement');
    const r = await ecrirePaypal('/v1/billing/subscriptions/' + ancien + '/cancel', { reason: 'remplacé' });
    // 204 : annulé. 422 : PayPal le dit déjà annulé ou inactif.
    if (!r.ok && r.status !== 422) throw new Error('PayPal ' + r.status + ' sur l’annulation de ' + ancien);
    // Le dossier désigne le NOUVEAU (vérifié à moi) : l'avis d'annulation de
    // l'ancien, qui va suivre, n'est plus « le courant » et ne ferme rien.
    await db.ref().update({ ['paypal_remplacements/' + nouveau]: null, ['users/' + cle + '/paypalSubscriptionId']: nouveau,
      ['users/' + cle + '/updatedAt']: now() });
    await journal({ quoi: 'ancien_annule', qui: qui(cle), abo: ancien, nouveau, actions: ['ancien abonnement annulé chez PayPal (remplacé)'] });
    return 'ancien_annule';
  }
  // À l'activation d'un abonnement : un remplacement l'attendait-il ?
  async function remplacementEnAttente(abo, sub) {
    const rp = await lire('paypal_remplacements/' + abo);
    if (!rp || !rp.cle || !rp.ancien) return null;
    return remplacer(rp.cle, abo, rp.ancien, sub);
  }

  // UN DOUBLON QUI EXISTE DÉJÀ : signalé, pas annulé d'office (lequel garder
  // est une décision, et un remboursement est peut-être dû).
  async function doubleAbonnement(cle, abo, courant, ress) {
    const montant = centimes(ress && ress.amount && (ress.amount.total || ress.amount.value));
    exigerBudget('double_abonnement');
    await journal({ quoi: 'double_abonnement', qui: qui(cle), abo, courant, transaction: net(ress && ress.id) || null, montant: euros(montant),
      actions: ['aucune : à annuler et rembourser à la main si le client n’a pas voulu deux abonnements'] });
    await pousserAdmin('Deux abonnements actifs', qui(cle) + ' a deux abonnements actifs (' + abo + ' et ' + courant + ')', 'double-' + abo);
  }

  // ══ REMBOURSEMENTS, RÉTROFACTURATIONS, LITIGES ══════════════════════════
  //
  // CE QUI EST REPRIS, ET QUAND :
  //   · remboursement TOTAL, rétrofacturation, litige PERDU : la commission de
  //     l'ambassadeur est « annulée ». Et si c'était le PREMIER paiement du
  //     compte : le mois offert au parrain est repris (ou devient une dette),
  //     l'état « payant » de l'attribution est retiré, et l'accès du remboursé
  //     se ferme à la date du remboursement ;
  //   · remboursement PARTIEL : la commission seule, au prorata ;
  //   · litige ouvert : commission « suspendue » ; gagné : rétablie, rien d'autre.
  // Chaque cas laisse une ligne dans paypal_journal (écran Ambassadeurs de
  // l'administrateur) : qui, quoi, pourquoi, et ce qui a été fait. Chaque
  // litige, ouvert ou clos, envoie un push à l'administrateur.
  //
  // IDEMPOTENT PAR TRANSACTION : une rétrofacturation suit souvent un litige
  // perdu, et les deux annoncent la même chose. La seconde ne refait rien.

  // La transaction d'origine, depuis le registre ; à défaut (paiement d'avant
  // le registre), relue chez PayPal. null si elle reste inconnue.
  async function origine(id, genre) {
    const k = net(id);
    if (!k) return null;
    const rec = await lire('paypal_transactions/' + k);
    if (rec && rec.cle) return Object.assign({ id: k }, rec);
    let cle = null, abo = null, prog = null, montant = NaN, devise = '', le = 0, type = 'abonnement';
    const v = genre !== 'capture' ? await lireVente(k, env, ctx.fetchImpl) : null;
    if (v) {
      abo = net(v.billing_agreement_id); montant = centimes(v.amount && v.amount.total);
      devise = String((v.amount && v.amount.currency) || ''); le = Date.parse(v.create_time || '') || 0;
      if (abo) cle = await lire('paypal_abonnes/' + abo);
    } else {
      const c = genre !== 'vente' ? await lireCapture(k, env, ctx.fetchImpl) : null;
      if (!c) return null;
      type = 'programme';
      montant = centimes(c.amount && c.amount.value); devise = String((c.amount && c.amount.currency_code) || '');
      le = Date.parse(c.create_time || '') || 0;
      const rel = c.supplementary_data && c.supplementary_data.related_ids;
      const cmd = rel && rel.order_id ? await lireCommande(String(rel.order_id), env, ctx.fetchImpl) : null;
      const pu = cmd && Array.isArray(cmd.purchase_units) ? cmd.purchase_units[0] : null;
      [cle, prog] = String((pu && pu.custom_id) || '').split('|');
      if (!cle || /[.#$\[\]\/]/.test(cle)) cle = null;
    }
    if (!cle) return null;
    // Était-ce le premier ? Le registre des premiers le dit depuis qu'il note
    // la vente ; avant, par l'abonnement et la date (deux jours d'écart au plus).
    const p = await lire('paypal_premiers/' + cle);
    const premier = !!(p && (p.vente ? p.vente === k : (String(p.abo || '') === String(abo || '') && Math.abs((Number(p.le) || 0) - le) < 2 * 864e5)));
    const out = { cle, abo: abo || null, prog: prog || null, type, premier, montant, devise, le };
    await noterTransaction(k, out);
    return Object.assign({ id: k }, out);
  }

  const journal = (ligne) => db.ref('paypal_journal').push().set(Object.assign({ le: now() }, ligne));
  const qui = (cle) => String(cle || '').replace(/,/g, '.');

  // L'ACCÈS DU REMBOURSÉ, fermé à la date du remboursement.
  async function fermerAcces(rec, t) {
    const b = 'users/' + rec.cle + '/';
    if (rec.type === 'programme') {
      if (rec.prog && (await lire(b + 'programmesAchetes/' + rec.prog)) !== null) {
        await db.ref().update({ [b + 'programmesAchetes/' + rec.prog + '/ouvertJusqu']: t, [b + 'updatedAt']: t });
      }
      // Remboursé : le contenu se referme.
      if (rec.prog) await db.ref().update({ ['droits/' + rec.cle + '/programmes/' + rec.prog]: null });
      const d = await M.majDroits(rec.cle, (x) => (x && Number(x.ultimeJusqu) > t ? { ultimeJusqu: t } : null));
      return (d || rec.prog) ? 'programme fermé au ' + dateFr(t) : null;
    }
    const [role, statut] = await Promise.all([lire(b + 'role'), lire(b + 'status')]);
    const maj = { [b + 'abonnement/statutPaypal']: 'REMBOURSE', [b + 'abonnement/finAccesPaypal']: t, [b + 'updatedAt']: t,
      ['paypal_fins/' + rec.cle]: null };
    if (role === 'coach') {
      maj[b + 'coachPlan'] = 'libre'; maj[b + 'coachSubActive'] = false;
      maj['coachs_registre/' + rec.cle + '/plan'] = 'libre'; maj['coachs_registre/' + rec.cle + '/actifJusqu'] = t;
      maj['coachs_registre/' + rec.cle + '/maj'] = t;
      maj['worker/jobs/couverture_coachs'] = null;    // le quota se recalcule au réveil suivant
    }
    else if (statut === 'AUTONOMIE_PREMIUM') maj[b + 'accessExpiry'] = t;
    await db.ref().update(maj);
    if (role !== 'coach') await M.majDroits(rec.cle, (x) => ({ palier: (x && x.palier) || 'aucun', echeance: t, source: 'paypal', abo: rec.abo || (x && x.abo) || null }));
    return (role === 'coach' ? 'palier coach refermé' : 'accès fermé') + ' au ' + dateFr(t);
  }

  // ── UN RENOUVELLEMENT ANNULÉ EN TOTALITÉ (02/10/2026) ────────────────────
  // Remboursé, rétrofacturé ou perdu en litige, un paiement qui n'est pas le
  // premier ne fermait rien : l'accès courait jusqu'à la prochaine échéance,
  // un an pour un annuel. Si la période qu'il couvrait contient maintenant ou
  // le futur, l'accès se ferme à max(encaissement, maintenant). Une période
  // déjà écoulée (un vieux renouvellement remboursé tard) ne change rien.
  // Ce n'est vrai que de l'abonnement COURANT du dossier.
  // Le repère paypal_rembourses/<abonnement> est relu par fermerALaFin : un
  // avis CANCELLED qui suivrait ne rouvre pas jusqu'à la prochaine échéance.
  async function fermerRenouvellement(rec, t) {
    if (!rec.abo) return null;
    let plan = rec.plan;
    if (!plan) { const sub = await abonnement(rec.abo); plan = (sub && sub.plan_id) || null; }
    const per = periodeCouverte(rec.le, plan);
    if (!(per.fin > t)) return 'période couverte déjà écoulée (jusqu’au ' + dateFr(per.fin) + ') : accès inchangé';
    const courant = await lire('users/' + rec.cle + '/paypalSubscriptionId');
    if (courant && courant !== rec.abo) return 'ancien abonnement : accès inchangé';
    const fin = Math.max(per.debut, t);
    exigerBudget('fermer_renouvellement');
    await db.ref('paypal_rembourses/' + rec.abo).set({ vente: rec.id, debut: per.debut, fin: per.fin, le: fin });
    return fermerAcces(rec, fin);
  }

  // L'ANNULATION D'UNE TRANSACTION (total, rétrofacturation, litige perdu).
  async function annuler(rec, quoi, pourquoi, extra) {
    const t = now();
    // La garde (annuleLe) PUIS la commission, ici. Le budget est vérifié pour
    // les deux AVANT la garde : posée, elle répond « deja_annule » au renvoi.
    // La reprise du premier paiement suit : ici si elle tient dans le budget,
    // sinon en UNE sous-tâche `annulation_suite` (rejouable : le mois offert
    // est gardé par retireLe), qui écrit aussi le journal.
    exigerBudget('annuler', BUDGET_ANNULER);
    const garde = await db.ref('paypal_transactions/' + rec.id + '/annuleLe').transaction((v) => (v ? undefined : t));
    if (!garde.committed) return 'deja_annule';
    const actions = [];
    const c = await M.commissionVente(rec.id, 'annuler');
    if (c) actions.push('commission ' + c.code + ' annulée (' + euros(Math.round(c.avant * 100)) + ')' + (c.dejaPayee ? ' — déjà versée, à reprendre' : ''));
    const suite = { rec: { id: rec.id, cle: rec.cle, premier: !!rec.premier, montant: rec.montant, type: rec.type || null, prog: rec.prog || null, abo: rec.abo || null,
      le: Number(rec.le) || 0, plan: rec.plan || null },
      quoi, pourquoi: String(pourquoi || '').slice(0, 300), extra: extra || {}, actions, t };
    const cout = rec.premier ? COUT_REPRISE_PREMIER : (rec.type === 'abonnement' ? COUT_FERMER_RENOUVELLEMENT : 0);
    if (cout && M.differer && resteB() < cout + BUDGET_ETAPE) {
      await M.differer([Object.assign({ quoi: 'annulation_suite' }, { suite })]);
      return quoi;
    }
    return annulationSuite(suite);
  }
  // LA REPRISE DU PREMIER PAIEMENT, et le journal de l'annulation. Appelée
  // par annuler, ou par planif.js (sous-tâche `annulation_suite`).
  async function annulationSuite(s) {
    const { rec, quoi, pourquoi, extra, t } = s;
    const actions = Array.isArray(s.actions) ? s.actions.slice() : [];
    if (rec.premier) {
      const m = await M.retirerMoisOffert(rec.cle, t);
      if (m) actions.push({ reserve_retiree: 'mois offert retiré de la réserve de ', mois_retire: 'mois offert retiré de l’accès de ',
        dette: 'mois offert déjà consommé : dette d’un mois pour ', rien: 'aucun mois à reprendre pour ' }[m.resultat] + qui(m.parrain));
      if (await M.annulerAttribution(rec.cle, t)) actions.push('état « payant » retiré de l’attribution');
      const a = await fermerAcces(rec, t);
      if (a) actions.push(a);
      await db.ref('paypal_premiers/' + rec.cle).remove();
    } else if (rec.type === 'abonnement') {
      const a = await fermerRenouvellement(rec, t);
      if (a) actions.push(a);
    }
    if (!actions.length) actions.push('rien à reprendre');
    await journal(Object.assign({ quoi, qui: qui(rec.cle), transaction: rec.id, montant: euros(rec.montant), premier: !!rec.premier,
      pourquoi: String(pourquoi || '').slice(0, 300), actions }, extra || {}));
    return quoi;
  }

  async function rembourse(evt) {
    const ress = evt.resource || {};
    const capture = evt.event_type === 'PAYMENT.CAPTURE.REFUNDED';
    let id = String(ress.sale_id || '');
    if (!id && Array.isArray(ress.links)) {
      const up = ress.links.find((l) => l && l.rel === 'up');
      if (up && up.href) id = String(up.href).split('/').pop();
    }
    // Une capture payée à un coach : c'est son paiement qui se rembourse.
    if (capture) { const rc = await PC.remboursement(id); if (rc) return rc; }
    const rec = await origine(id, capture ? 'capture' : 'vente');
    const montant = centimes(ress.amount && (ress.amount.total || ress.amount.value));
    const pourquoi = ress.note_to_payer || ress.reason || ress.description || '';
    if (!rec) { await journal({ quoi: 'remboursement_inconnu', transaction: net(id), montant: euros(montant), pourquoi, actions: ['transaction introuvable : rien de repris'] }); return 'remboursement_inconnu'; }
    // Le cumul des remboursements de cette transaction décide total ou partiel.
    const ref = net(ress.id) || ('r' + now());
    exigerBudget('remboursement');
    await db.ref('paypal_transactions/' + rec.id + '/rembourses/' + ref).set(montant);
    const deja = (await lire('paypal_transactions/' + rec.id + '/rembourses')) || {};
    const cumul = Object.values(deja).reduce((a, b) => a + (Number(b) || 0), 0);
    if (Number.isFinite(rec.montant) && cumul < rec.montant) {
      const c = await M.commissionVente(rec.id, 'prorata', { ref, montant: montant / 100 });
      await journal({ quoi: 'remboursement_partiel', qui: qui(rec.cle), transaction: rec.id, montant: euros(montant), pourquoi,
        actions: [c ? 'commission ' + c.code + ' ramenée de ' + euros(Math.round(c.avant * 100)) + ' à ' + euros(Math.round(c.apres * 100))
          : 'aucune commission sur cette vente', 'accès et parrainage inchangés'] });
      return 'remboursement_partiel';
    }
    return annuler(rec, 'remboursement', pourquoi, { rembourse: euros(cumul) });
  }

  async function retrofacture(evt) {
    const ress = evt.resource || {};
    const id = String(ress.sale_id || ress.id || '');
    const rec = await origine(id, 'vente');
    const pourquoi = ress.reason_code || ress.reason || 'rétrofacturation';
    if (!rec) { await journal({ quoi: 'retrofacturation_inconnue', transaction: net(id), pourquoi, actions: ['transaction introuvable : rien de repris'] }); return 'retrofacturation_inconnue'; }
    // Une rétrofacturation PARTIELLE se traite comme un litige perdu pour une
    // partie : même clé (« contestation »), pour ne pas déduire deux fois le
    // même argent quand PayPal annonce les deux.
    const montant = Math.abs(centimes(ress.amount && (ress.amount.total || ress.amount.value)));
    if (Number.isFinite(montant) && montant > 0 && Number.isFinite(rec.montant) && montant < rec.montant) {
      const c = await M.commissionVente(rec.id, 'prorata', { ref: 'contestation', montant: montant / 100 });
      await journal({ quoi: 'retrofacturation_partielle', qui: qui(rec.cle), transaction: rec.id, montant: euros(montant), pourquoi,
        actions: [c ? 'commission ' + c.code + ' ramenée à ' + euros(Math.round(c.apres * 100)) : 'aucune commission sur cette vente'] });
      return 'retrofacturation_partielle';
    }
    return annuler(rec, 'retrofacturation', pourquoi);
  }

  const transactionsDuLitige = (ress) => (Array.isArray(ress.disputed_transactions) ? ress.disputed_transactions : [])
    .map((x) => net(x && (x.seller_transaction_id || x.transaction_id))).filter(Boolean);
  const pousserAdmin = (titre, corps, id) => Promise.resolve(pousser(CREATEUR, { type: 'admin', url: './?paiements=1', tag: 'litige-' + id,
    title: titre, body: corps }, { urgent: true })).catch(() => null);

  async function litigeOuvert(evt) {
    const ress = evt.resource || {};
    const lid = net(ress.dispute_id || ress.id);
    const montant = centimes(ress.dispute_amount && ress.dispute_amount.value);
    const pourquoi = String(ress.reason || '').replace(/_/g, ' ').toLowerCase();
    const actions = [], gens = [];
    for (const id of transactionsDuLitige(ress)) {
      exigerBudget('litige');
      const rec = await origine(id);
      if (rec) gens.push(qui(rec.cle));
      const c = await M.commissionVente(id, 'suspendre');
      actions.push(c ? 'commission ' + c.code + ' suspendue (' + euros(Math.round(c.avant * 100)) + ')' : 'transaction ' + id + ' : aucune commission');
    }
    await journal({ quoi: 'litige_ouvert', qui: gens.join(', ') || null, litige: lid, montant: euros(montant), pourquoi, actions: actions.length ? actions : ['aucune transaction reconnue'] });
    await pousserAdmin('Litige PayPal ouvert : ' + euros(montant), (gens.join(', ') || 'client inconnu') + (pourquoi ? ' · ' + pourquoi : ''), lid);
    return 'litige_ouvert';
  }

  async function litigeClos(evt) {
    const ress = evt.resource || {};
    const lid = net(ress.dispute_id || ress.id);
    const issue = String((ress.dispute_outcome && ress.dispute_outcome.outcome_code) || '');
    const perdu = issue === 'RESOLVED_BUYER_FAVOUR' || issue === 'ACCEPTED';
    const rendu = centimes(ress.dispute_outcome && ress.dispute_outcome.amount_refunded && ress.dispute_outcome.amount_refunded.value);
    const pourquoi = issue.replace(/_/g, ' ').toLowerCase() || 'clos';
    const gens = [], resultats = [];
    for (const id of transactionsDuLitige(ress)) {
      exigerBudget('litige');
      const rec = await origine(id);
      if (rec) gens.push(qui(rec.cle));
      if (!perdu) {
        const c = await M.commissionVente(id, 'retablir');
        await journal({ quoi: 'litige_gagne', qui: rec ? qui(rec.cle) : null, litige: lid, transaction: id, pourquoi,
          actions: [c ? 'commission ' + c.code + ' rétablie' : 'rien à rétablir'] });
        resultats.push('gagne');
      } else if (rec && Number.isFinite(rendu) && Number.isFinite(rec.montant) && rendu > 0 && rendu < rec.montant) {
        // Perdu pour une partie seulement : comme un remboursement partiel.
        await M.commissionVente(id, 'retablir');
        const c = await M.commissionVente(id, 'prorata', { ref: 'contestation', montant: rendu / 100 });
        await journal({ quoi: 'litige_perdu_partiel', qui: qui(rec.cle), litige: lid, transaction: id, montant: euros(rendu), pourquoi,
          actions: [c ? 'commission ' + c.code + ' ramenée à ' + euros(Math.round(c.apres * 100)) : 'aucune commission sur cette vente'] });
        resultats.push('perdu_partiel');
      } else if (rec) {
        resultats.push(await annuler(rec, 'litige_perdu', pourquoi, { litige: lid }));
      } else {
        await journal({ quoi: 'litige_perdu', litige: lid, transaction: id, pourquoi, actions: ['transaction introuvable : rien de repris'] });
      }
    }
    await pousserAdmin('Litige PayPal ' + (perdu ? 'perdu' : 'clos en ta faveur'), (gens.join(', ') || 'client inconnu') + ' · ' + pourquoi, lid);
    return perdu ? 'litige_perdu' : 'litige_gagne';
  }

  // ── LES FINS ATTEINTES (travail quotidien) ─────────────────────────────
  // Le coach : son palier se referme. L'athlète : son accès se ferme tout
  // seul (accessExpiry) ; ici, les mois de réserve comptés dans cette fin
  // sont enfin consommés — en transaction, sans toucher à ceux gagnés depuis.
  // UNE FIN à la fois (~3 requêtes). Au-delà du budget du réveil, les
  // suivantes partent en sous-tâches (une par compte), reprises plus tard.
  const resteM = () => (M && typeof M.reste === 'function' ? M.reste() : Infinity);
  async function fins() {
    const tout = (await lire('paypal_fins')) || {};
    const t = now();
    const dues = Object.keys(tout).filter((cle) => tout[cle] && Number(tout[cle].fin) <= t);
    for (let i = 0; i < dues.length; i++) {
      if (i > 0 && resteM() < 8 && M && M.differer) {
        await M.differer(dues.slice(i).map((cle) => ({ quoi: 'fin_paypal', cle })));
        return 'differe';
      }
      await finUne(dues[i], tout[dues[i]], t);
    }
    return dues.length;
  }
  // La sous-tâche : relue, car elle a pu changer (abonnement reparti) depuis.
  async function finTache(cle) {
    const f = await lire('paypal_fins/' + cle);
    if (f && Number(f.fin) <= now()) { await finUne(cle, f, now()); return 'fin'; }
    return 'plus_due';
  }
  async function finUne(cle, f, t) {
    const role = f.role || 'coach';          // les entrées d'avant ne portaient que les coachs
    if (role === 'coach') {
      await db.ref().update({ ['users/' + cle + '/coachSubActive']: false, ['users/' + cle + '/coachPlan']: 'libre',
        ['users/' + cle + '/updatedAt']: t, ['coachs_registre/' + cle + '/plan']: 'libre',
        ['coachs_registre/' + cle + '/actifJusqu']: t, ['coachs_registre/' + cle + '/maj']: t,
        ['worker/jobs/couverture_coachs']: null });    // le quota se recalcule au réveil suivant
    } else if (Number(f.reserve) > 0) {
      const r = Number(f.reserve);
      await db.ref('parrainage/comptes/' + cle + '/moisEnReserve').transaction((n) => Math.max(0, (Number(n) || 0) - r));
    }
    await db.ref('paypal_fins/' + cle).remove();
  }

  // ── LA PURGE MENSUELLE de paypal_evenements (le 1er, planif.js) ─────────
  // Plus de 90 jours : PayPal ne renvoie plus un événement après trois jours,
  // l'idempotence n'a plus rien à garder. Par lots de 200, les plus anciens
  // d'abord (".indexOn": ["at"]). Rend false si le budget a coupé avant la fin.
  async function purgerEvenements(t) {
    const limite = (t || now()) - GARDE_EVENEMENTS_MS;
    let n = 0;
    while (resteM() >= 6) {
      const vieux = await db.ref('paypal_evenements').jusqua('at', limite, LOT_PURGE);
      const ks = Object.keys(vieux);
      if (!ks.length) return n;
      const maj = {};
      for (const k of ks) maj['paypal_evenements/' + k] = null;
      await db.ref().update(maj);
      n += ks.length;
      if (ks.length < LOT_PURGE) return n;
    }
    return false;
  }

  // L'INDEX abonnement → compte, déposé par l'app à l'approbation (événement
  // « abonnement »). Vérifié chez PayPal : l'abonnement doit avoir été CRÉÉ
  // pour ce compte (custom_id). Ceux d'avant le custom_id sont reliés si
  // l'adresse de l'abonné est celle du compte, et à cette seule condition.
  async function indexer(cle, id, remplace) {
    const abo = net(id);
    if (!/^I-[A-Z0-9]{8,}$/.test(abo)) return 'format';
    const deja = await lire('paypal_abonnes/' + abo);
    if (deja && deja !== cle) return 'deja_a_un_autre';
    const sub = await abonnement(abo);
    if (!sub) return 'introuvable';
    if (sub.custom_id) { if (sub.custom_id !== cle) return 'autre_compte'; }
    else if (cleEmail(sub.subscriber && sub.subscriber.email_address) !== cle) return 'non_verifie';
    if (!(await lier(abo, cle))) return 'deja_a_un_autre';
    // UN NOUVEL ABONNEMENT QUI EN REMPLACE UN AUTRE (onApprove, l'app) :
    // l'ancien s'annule chez PayPal dès que le nouveau est ACTIVE.
    if (remplace) { const r = await remplacer(cle, abo, remplace, sub); return r === 'rien' ? 'indexe' : 'indexe_' + r; }
    return 'indexe';
  }

  return { traiter, verifierAchat, changerFormule, remplacer, resilier, resiliationsDues, resiliationTache, fins, finsCoachs: fins, finTache, indexer, fermerALaFin, rejouerOrphelins, rejouerUnOrphelin, annulationSuite, purgerEvenements };
}

// ══ LE POINT D'ENTRÉE HTTP : /paypal (POST, appelé par PayPal) ═══════════
// L'IDEMPOTENCE TIENT EN DEUX ÉCRITURES. paypal_evenements/<id> passe à
// « en_cours » AVANT le traitement, et à « fait » APRÈS son succès seulement.
//   · un renvoi d'un événement « fait » : 200, rien ne se refait ;
//   · un renvoi pendant qu'il est « en_cours » depuis moins de dix minutes :
//     503, PayPal renverra plus tard ;
//   · un « en_cours » plus vieux (le worker est mort en route) est repris ;
//   · une erreur : l'état passe à « erreur », réponse 500, et PayPal renvoie.
export async function recevoirWebhook(req, ctx) {
  const now = ctx.maintenant || (() => Date.now());
  const brut = await req.text();
  if (!(await signatureValide(req.headers, brut, ctx.env, ctx.fetchImpl)))
    return new Response('signature refusée', { status: 401 });
  let evt;
  try { evt = JSON.parse(brut); } catch (e) { return new Response('corps illisible', { status: 400 }); }
  const id = net(evt.id);
  const type = String(evt.event_type || '').slice(0, 80);
  const ref = id ? ctx.db.ref('paypal_evenements/' + id) : null;
  if (ref) {
    const t = now();
    let vu = null;
    const tx = await ref.transaction((v) => {
      vu = v;
      if (v && (v.etat === 'fait' || !v.etat)) return undefined;              // sans état : l'ancien format, traité
      if (v && v.etat === 'en_cours' && t - (Number(v.at) || 0) < EN_COURS_MAX_MS) return undefined;
      return { etat: 'en_cours', at: t, type, essais: ((v && Number(v.essais)) || 0) + 1 };
    });
    if (!tx.committed) {
      if (vu && vu.etat === 'en_cours') return new Response('en cours', { status: 503 });
      return new Response('déjà traité', { status: 200 });
    }
  }
  let res;
  try {
    res = await creerPaypal(ctx).traiter(evt);
  } catch (e) {
    // À COURT DE BUDGET, avant toute écriture de l'étape : RIEN n'est écrit
    // (plus une requête de trop), l'état reste « en_cours », et PayPal
    // renverra — repris après EN_COURS_MAX_MS au plus tard.
    if (e && e.budget) return new Response('budget', { status: 503 });
    if (ref) await ref.set({ etat: 'erreur', at: now(), type, erreur: String((e && e.message) || e).slice(0, 200) }).catch(() => {});
    return new Response('erreur', { status: 500 });
  }
  if (ref) await ref.set({ etat: 'fait', at: now(), type, res: String(res).slice(0, 40) });
  return new Response(String(res), { status: 200 });
}
