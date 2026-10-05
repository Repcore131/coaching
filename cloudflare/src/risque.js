// ══ LE RISQUE D'ABANDON, APPRIS CHAQUE NUIT — MODULE PUR (05/10/2026) ══════
//
// Sans LLM : une régression logistique sur les RÉSUMÉS D'ACTIVITÉ (retention.js,
// r = {inscrit, sem, src, debut, jour, j30, seance1, parcours, finEssai,
// payant, lev}). Le travail 'retention' (planif.js, 4 h 30) passe chaque
// résumé dans `exemples` puis, à la fin, entraîne, mesure et note.
//
// LES 9 VARIABLES (variables(r, t, decalJours)), toutes ramenées à [0, 1]
// (la pente à [-1, 1]), à la date de référence = aujourd'hui (Paris) moins
// `decalJours` :
//   a7, a14, a30  part des jours actifs sur 7, 14, 30 jours ;
//   pente         (actifs des 14 derniers jours − des 14 d'avant) / 14 ;
//   dernier       jours depuis le dernier jour actif, / 30 (1 : rien vu) ;
//   checkin       3 check-ins ou plus dans les 30 premiers jours (lev) ;
//   notif         notifications activées (lev) ;
//   coach         suivi par un coach (lev) ;
//   anciennete    jours depuis l'inscription, plafonnés à 180, / 180.
// ⚠ LA BANDE j30 NE VOIT QUE 30 JOURS. Une fenêtre qui en déborde est lue sur
//   les jours CONNUS et ramenée à sa longueur (actifs × n / connus) : à la
//   date d'observation (14 jours avant), la fenêtre de 30 jours n'en voit que
//   16, celle des 14 « d'avant » 2. Les jours avant l'inscription ne comptent
//   pas. Les jours APRÈS r.jour (l'app n'a pas republié son résumé) comptent
//   comme inactifs : sans ouvrir l'app, pas de séance, de check-in ni de journal.
//
// LA CIBLE : actif au moins une fois dans les 14 jours qui SUIVENT une date
// d'observation placée 14 jours avant aujourd'hui. Les variables de
// l'exemple sont calculées À CETTE DATE, avec les seuls jours qui la
// précèdent : rien du futur n'y entre. Un compte inscrit après cette date, ou
// dont le dernier résumé est antérieur, n'est pas un exemple.
//
// LE MODÈLE prédit P(actif) ; le RISQUE publié est p = 1 − P(actif).
// Descente de gradient sur tout le jeu, L2, 200 itérations, poids de départ
// nuls : deux nuits sur le même jeu donnent les mêmes poids. Entraîné
// seulement avec ≥ 200 exemples, ≥ 30 positifs et ≥ 30 négatifs ; sinon les
// POIDS PAR DÉFAUT (POIDS_DEFAUT) : un athlète actif cette semaine et la
// précédente est peu à risque, un athlète muet depuis trois semaines l'est.
// L'AUC est mesurée sur 20 % des exemples tenus à l'écart, tirés par hachage
// de la clé du compte (stable d'une nuit à l'autre), jamais vus à l'entraînement.
// ⚠ risque_modele NE PORTE AUCUNE CLÉ DE COMPTE : des poids, des effectifs.

export const VARIABLES = Object.freeze(['a7', 'a14', 'a30', 'pente', 'dernier', 'checkin', 'notif', 'coach', 'anciennete']);
export const OBSERVATION_J = 14;
export const ITERATIONS = 200;
export const L2 = 0.01;
export const PAS = 0.5;
export const MIN_EXEMPLES = 200;
export const MIN_CLASSE = 30;
export const PART_TEST = 5;           // 1 sur 5 : 20 %
export const SEUIL_RISQUE = 0.6;
// P(actif) = σ(biais + Σ w·x). Posés à la main, documentés : actif récemment → actif ensuite.
export const POIDS_DEFAUT = Object.freeze({ biais: -1, a7: 3, a14: 2, a30: 1, pente: 1, dernier: -3, checkin: 0.5, notif: 0.5, coach: 0.5, anciennete: 0.3 });

const J = 864e5;
const jourDe = (t) => new Date(t).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
const jours = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / J);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const r3 = (x) => Math.round(x * 1000) / 1000;

/** PURE. Le résumé est-il exploitable ici ? */
export function resumeRisque(r) {
  return !!(r && typeof r === 'object' && ISO.test(String(r.inscrit || '')) && ISO.test(String(r.jour || '')) && /^[01]{1,40}$/.test(String(r.j30 || '')));
}
// L'état d'un jour (`d` jours avant la date de référence `ref`) : 1, 0, ou null (inconnu).
function etatJour(r, ref, d) {
  const jour = new Date(Date.parse(ref + 'T00:00:00Z') - d * J).toISOString().slice(0, 10);
  if (jour < r.inscrit) return null;                 // avant l'inscription : ne compte pas
  const apres = jours(r.jour, jour);                 // > 0 : après le dernier résumé
  if (apres > 0) return 0;
  const b = String(r.j30), i = b.length - 1 + apres;
  if (i < 0) return null;                            // plus vieux que la bande
  return b[i] === '1' ? 1 : 0;
}
// Les actifs d'une fenêtre [d0, d0+n[ (en jours avant ref), ramenés à n.
function fenetre(r, ref, d0, n) {
  let a = 0, connus = 0;
  for (let d = d0; d < d0 + n; d++) { const e = etatJour(r, ref, d); if (e === null) continue; connus++; a += e; }
  return connus ? a * n / connus : 0;
}
/**
 * PURE. Les variables d'un résumé, à la date de référence aujourd'hui − decal
 * (jours). Rend un objet {a7, …, anciennete}, ou null (résumé illisible, ou
 * pas encore inscrit à cette date).
 */
export function variables(r, t, decal) {
  if (!resumeRisque(r)) return null;
  const ref = new Date(Date.parse(jourDe(t) + 'T00:00:00Z') - (Number(decal) || 0) * J).toISOString().slice(0, 10);
  const age = jours(r.inscrit, ref);
  if (age < 0) return null;
  const a14 = fenetre(r, ref, 0, 14), avant = fenetre(r, ref, 14, 14);
  let dernier = 30;
  for (let d = 0; d < 30; d++) { const e = etatJour(r, ref, d); if (e === null) break; if (e === 1) { dernier = d; break; } }
  const lev = (r.lev && typeof r.lev === 'object') ? r.lev : {};
  return { a7: r3(fenetre(r, ref, 0, 7) / 7), a14: r3(a14 / 14), a30: r3(fenetre(r, ref, 0, 30) / 30),
    pente: r3((a14 - avant) / 14), dernier: r3(dernier / 30), checkin: lev.checkin ? 1 : 0, notif: lev.notif ? 1 : 0,
    coach: lev.coach ? 1 : 0, anciennete: r3(Math.min(age, 180) / 180) };
}
/** PURE. La cible d'un exemple : actif dans les 14 jours qui suivent l'observation (1/0), ou null. */
export function cible(r, t) {
  if (!resumeRisque(r)) return null;
  const auj = jourDe(t);
  const obs = new Date(Date.parse(auj + 'T00:00:00Z') - OBSERVATION_J * J).toISOString().slice(0, 10);
  if (jours(r.inscrit, obs) < 0 || jours(obs, r.jour) < 0) return null;   // inscrit après, ou parti avant
  for (let d = 0; d < OBSERVATION_J; d++) if (etatJour(r, auj, d) === 1) return 1;
  return 0;
}
/** PURE. Le hachage stable d'une clé (FNV-1a, 32 bits). */
export function hachage(s) {
  let h = 0x811c9dc5;
  for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
export const enTest = (cle) => hachage(cle) % PART_TEST === 0;
const vecteur = (v) => VARIABLES.map((k) => Number(v[k]) || 0);
const sigma = (z) => 1 / (1 + Math.exp(-z));

/**
 * PURE. L'exemple d'un compte : [test (0/1), y, x…] — ou null. Rangé tel quel
 * dans l'accumulateur du travail : la clé n'y figure pas.
 */
export function exemple(cle, r, t) {
  const y = cible(r, t);
  if (y === null) return null;
  const v = variables(r, t, OBSERVATION_J);
  if (!v) return null;
  return [enTest(cle) ? 1 : 0, y].concat(vecteur(v));
}
/** PURE. La régression : {biais, a7…}. Déterministe (départ nul, ordre du jeu). */
export function entrainer(lignes) {
  const X = (lignes || []).map((l) => l.slice(2)), Y = (lignes || []).map((l) => l[1]);
  const n = X.length, d = VARIABLES.length;
  let w = new Array(d).fill(0), b = 0;
  if (!n) return Object.assign({ biais: 0 }, Object.fromEntries(VARIABLES.map((k) => [k, 0])));
  for (let it = 0; it < ITERATIONS; it++) {
    const g = new Array(d).fill(0); let gb = 0;
    for (let i = 0; i < n; i++) {
      let z = b; for (let j = 0; j < d; j++) z += w[j] * X[i][j];
      const e = sigma(z) - Y[i];
      gb += e; for (let j = 0; j < d; j++) g[j] += e * X[i][j];
    }
    b -= PAS * gb / n;
    w = w.map((wj, j) => wj - PAS * (g[j] / n + L2 * wj));
  }
  return Object.assign({ biais: r3(b) }, Object.fromEntries(VARIABLES.map((k, j) => [k, r3(w[j])])));
}
/** PURE. P(actif) pour des variables et des poids. */
export function probaActif(v, poids) {
  const P = poids || POIDS_DEFAUT;
  let z = Number(P.biais) || 0;
  for (const k of VARIABLES) z += (Number(P[k]) || 0) * (Number(v && v[k]) || 0);
  return sigma(z);
}
/** PURE. Le risque d'abandon (0..1), arrondi au centième. */
export const risque = (v, poids) => Math.round((1 - probaActif(v, poids)) * 100) / 100;
/** PURE. L'aire sous la courbe ROC (rangs, ex aequo à demi), ou null sans les deux classes. */
export function auc(scores, y) {
  const l = scores.map((s, i) => [s, y[i]]).sort((a, b) => a[0] - b[0]);
  const nPos = y.filter((v) => v === 1).length, nNeg = y.length - nPos;
  if (!nPos || !nNeg) return null;
  let somme = 0;
  for (let i = 0; i < l.length;) {
    let j = i; while (j < l.length && l[j][0] === l[i][0]) j++;
    const moyen = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) if (l[k][1] === 1) somme += moyen;
    i = j;
  }
  return Math.round((somme - nPos * (nPos + 1) / 2) / (nPos * nNeg) * 1000) / 1000;
}
/**
 * PURE. Le modèle de la nuit : {poids, n, auc, t, defaut}. Entraîné sur les
 * exemples hors test si le jeu est assez grand, sinon POIDS_DEFAUT ; l'AUC
 * est mesurée sur les exemples tenus à l'écart, dans les deux cas.
 */
export function modele(lignes, t) {
  const L = (lignes || []).filter((l) => Array.isArray(l) && l.length === 2 + VARIABLES.length);
  const pos = L.filter((l) => l[1] === 1).length, neg = L.length - pos;
  const assez = L.length >= MIN_EXEMPLES && pos >= MIN_CLASSE && neg >= MIN_CLASSE;
  const poids = assez ? entrainer(L.filter((l) => !l[0])) : Object.assign({}, POIDS_DEFAUT);
  const test = L.filter((l) => l[0]);
  const obj = (l) => Object.fromEntries(VARIABLES.map((k, j) => [k, l[2 + j]]));
  const a = auc(test.map((l) => probaActif(obj(l), poids)), test.map((l) => l[1]));
  return { poids, n: L.length, nTest: test.length, positifs: pos, auc: a, t, defaut: !assez };
}
