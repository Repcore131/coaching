// ══ LA RÉTENTION (/stats/retention) — LE CALCUL, SANS BASE ═══════════════
//
// Module PUR, éprouvé par cloudflare/test/retention.test.mjs. Chaque app écrit
// son RÉSUMÉ D'ACTIVITÉ (/activite/<compte>, voir activiteResume dans
// rc-core) : aucune séance, aucune mesure, seulement des jours et des oui/non.
// Le Worker, chaque nuit, le parcourt PAR LOTS (planif.js, un résumé = une
// lecture, l'accumulateur gardé d'une minute à l'autre) et publie des
// AGRÉGATS : aucune clé de compte, aucun prénom ne sort d'ici.
//
// ACTIF un jour = une séance, un check-in ou un journal ce jour-là.
//   J1  : actif le lendemain de l'inscription (jour 1) ;
//   J7  : actif au moins un jour de la 2e semaine (jours 7 à 13) ;
//   J30 : actif au moins un jour entre les jours 30 et 36.
// Une cohorte n'entre dans un taux que quand sa fenêtre est passée.
// DAU / WAU / MAU : actifs hier, sur les 7 et les 30 derniers jours.
//
// LES LEVIERS : la rétention J30 AVEC et SANS chaque levier (utilisé dans les
// 30 premiers jours), la taille des deux groupes, et une ALERTE quand l'un
// fait moins de 30 personnes : l'écart n'y veut encore rien dire. Une
// corrélation, pas une preuve — l'écran le dit.

export const J = 864e5;
export const SEUIL_GROUPE = 30;
export const COHORTES_MAX = 16;
export const LEVIERS = [
  { cle: 'parcours', lib: 'Parcours « Mise sous tension » fini' },
  { cle: 'checkin', lib: '3 check-ins du matin ou plus' },
  { cle: 'notif', lib: 'Notifications activées' },
  { cle: 'duel', lib: 'A lancé ou relevé un duel' },
  { cle: 'defi', lib: 'A relevé un défi ou une saison' },
  { cle: 'coach', lib: 'Suivi par un coach' },
  { cle: 'invite', lib: 'Arrivé par un ami ou un ambassadeur' },
];
const ETAPES = ['inscrits', 'seance1', 'parcours', 'finEssai', 'payant'];
// Une clé Firebase propre (une source vient d'un lien).
const net = (s) => String(s || 'direct').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20) || 'direct';
const jourDe = (t) => new Date(t).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
const jours = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / J);

export function accVide() { return { c: {}, d: { dau: 0, wau: 0, mau: 0, n: 0 }, f: {}, l: {} }; }
/** Un résumé d'activité est-il lisible ? */
export function resumeValide(r) {
  return !!(r && typeof r === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(String(r.inscrit || '')));
}
/**
 * Ajoute UN résumé à l'accumulateur. `t` : l'heure du serveur.
 * r = {inscrit:'AAAA-MM-JJ', sem:'AAAA-MM-JJ', src, debut:[jours actifs 0..40],
 *      jour:'AAAA-MM-JJ', j30:'0101…' (30 derniers jours, le dernier = jour),
 *      seance1, parcours, finEssai (ms), payant, lev:{…}}
 */
export function accumuler(acc0, r, t) {
  const acc = acc0 && acc0.c ? acc0 : accVide();
  acc.c = acc.c || {}; acc.d = acc.d || { dau: 0, wau: 0, mau: 0, n: 0 }; acc.f = acc.f || {}; acc.l = acc.l || {};
  if (!resumeValide(r)) return acc;
  const auj = jourDe(t), age = jours(r.inscrit, auj);
  if (age < 0) return acc;
  const deb = new Set((Array.isArray(r.debut) ? r.debut : Object.values(r.debut || {})).map(Number).filter((x) => x >= 0 && x <= 40));
  const dans = (a, b) => { for (let k = a; k <= b; k++) if (deb.has(k)) return true; return false; };
  // 1. La cohorte (la semaine d'inscription).
  const sem = /^\d{4}-\d{2}-\d{2}$/.test(String(r.sem || '')) ? r.sem : r.inscrit;
  const c = acc.c[sem] || (acc.c[sem] = { n: 0, n1: 0, a1: 0, n7: 0, a7: 0, n30: 0, a30: 0 });
  c.n++;
  if (age >= 2) { c.n1++; if (deb.has(1)) c.a1++; }
  if (age >= 14) { c.n7++; if (dans(7, 13)) c.a7++; }
  const j30ok = age >= 37 ? dans(30, 36) : null;
  if (j30ok !== null) { c.n30++; if (j30ok) c.a30++; }
  // 2. DAU / WAU / MAU, à la veille du serveur, depuis la bande des 30 jours.
  const hier = jourDe(t - J);
  const bande = String(r.j30 || '');
  const decal = /^\d{4}-\d{2}-\d{2}$/.test(String(r.jour || '')) ? jours(r.jour, hier) : 999;
  const actifIl = (n) => { // actif il y a n jours (0 = hier)
    const i = bande.length - 1 - (n - decal);
    return n >= decal && i >= 0 && i < bande.length && bande[i] === '1';
  };
  acc.d.n++;
  if (actifIl(0)) acc.d.dau++;
  let w = false, m = false;
  for (let n = 0; n < 30; n++) if (actifIl(n)) { m = true; if (n < 7) w = true; }
  if (w) acc.d.wau++;
  if (m) acc.d.mau++;
  // 3. L'entonnoir, par source.
  const s = net(r.src);
  const f = acc.f[s] || (acc.f[s] = { inscrits: 0, seance1: 0, parcours: 0, finEssai: 0, payant: 0 });
  f.inscrits++;
  if (r.seance1) f.seance1++;
  if (r.parcours) f.parcours++;
  if (Number(r.finEssai) > 0 && Number(r.finEssai) <= t) f.finEssai++;
  if (r.payant) f.payant++;
  // 4. Les leviers : seulement les cohortes dont le J30 est connu.
  if (j30ok !== null) {
    const lev = r.lev || {};
    for (const L of LEVIERS) {
      const x = acc.l[L.cle] || (acc.l[L.cle] = { an: 0, ao: 0, sn: 0, so: 0 });
      if (lev[L.cle]) { x.an++; if (j30ok) x.ao++; } else { x.sn++; if (j30ok) x.so++; }
    }
  }
  return acc;
}
const pct = (a, b) => (b > 0 ? Math.round(a / b * 1000) / 10 : null);
/** Les statistiques publiées : des agrégats, rien d'autre. */
export function resultat(acc0, t, premiere) {
  const acc = acc0 && acc0.c ? acc0 : accVide();
  const cohortes = Object.keys(acc.c || {}).sort().slice(-COHORTES_MAX).map((sem) => {
    const c = acc.c[sem];
    return { sem, n: c.n, j1: pct(c.a1, c.n1), n1: c.n1, j7: pct(c.a7, c.n7), n7: c.n7, j30: pct(c.a30, c.n30), n30: c.n30 };
  });
  const d = acc.d || {};
  const sources = Object.keys(acc.f || {}).map((src) => Object.assign({ src }, acc.f[src]))
    .sort((a, b) => b.inscrits - a.inscrits);
  const total = { inscrits: 0, seance1: 0, parcours: 0, finEssai: 0, payant: 0 };
  for (const x of sources) for (const k of ETAPES) total[k] += Number(x[k]) || 0;
  const leviers = LEVIERS.map((L) => {
    const x = (acc.l || {})[L.cle] || { an: 0, ao: 0, sn: 0, so: 0 };
    return { cle: L.cle, lib: L.lib, avec: { n: x.an, j30: pct(x.ao, x.an) }, sans: { n: x.sn, j30: pct(x.so, x.sn) },
      alerte: x.an < SEUIL_GROUPE || x.sn < SEUIL_GROUPE };
  });
  return { maj: t, comptes: Number(d.n) || 0, premiereSeance: tauxPremiere(premiere),
    actifs: { dau: d.dau || 0, wau: d.wau || 0, mau: d.mau || 0, dauMau: d.mau > 0 ? Math.round(d.dau / d.mau * 1000) / 10 : null },
    cohortes, entonnoir: { sources, total }, leviers, seuilGroupe: SEUIL_GROUPE };
}

// ══ LA RELANCE DES INSCRITS SANS PREMIÈRE SÉANCE : L'ATTRIBUTION ═════════
// (11/10/2026) Chaque push « premiere » (J1, J3, J6 après l'inscription) est
// noté dans premiere_trace/<compte> = {inscrit, j1?, j3?, j6?} (l'instant
// d'envoi). Une trace se CLÔT quand la première séance arrive, ou 14 jours
// après l'inscription sans séance. À la clôture, chaque push envoyé compte
// un envoi de son palier ; la première séance est ATTRIBUÉE au DERNIER push
// parti avant elle, s'il date de moins de PREMIERE_FENETRE_J jours. Les
// compteurs (stats/relance_premiere) ne gardent que des nombres.
export const PREMIERE_LEVIERS = ['j1', 'j3', 'j6'];
export const PREMIERE_FENETRE_J = 7;
export const PREMIERE_CLOTURE_J = 14;
/**
 * PURE. Le bilan d'une trace.
 * @param {{inscrit:string, j1?:number, j3?:number, j6?:number}} trace
 * @param {number} seance1Le instant de la première séance (0 = aucune)
 * @param {number} t maintenant
 * @returns {{fini:boolean, envois:string[], attribue:?string}}
 */
export function bilanPremiere(trace, seance1Le, t) {
  const x = trace || {};
  const envois = PREMIERE_LEVIERS.filter((k) => Number(x[k]) > 0);
  const s1 = Number(seance1Le) || 0;
  const age = /^\d{4}-\d{2}-\d{2}$/.test(String(x.inscrit || '')) ? jours(x.inscrit, jourDe(t)) : PREMIERE_CLOTURE_J;
  if (!(s1 > 0) && age < PREMIERE_CLOTURE_J) return { fini: false, envois, attribue: null };
  let attribue = null, der = 0;
  if (s1 > 0) for (const k of envois) {
    const at = Number(x[k]);
    if (at <= s1 && s1 - at < PREMIERE_FENETRE_J * J && at > der) { der = at; attribue = k; }
  }
  return { fini: true, envois, attribue };
}
/** PURE. Les compteurs après une trace close : {j1:{e,s}, …}. Ne touche pas l'entrée. */
export function ajouterPremiere(stats, bilan) {
  const o = {};
  for (const k of PREMIERE_LEVIERS) { const v = (stats && stats[k]) || {}; o[k] = { e: Number(v.e) || 0, s: Number(v.s) || 0 }; }
  if (!bilan || !bilan.fini) return o;
  for (const k of bilan.envois) if (o[k]) o[k].e++;
  if (bilan.attribue && o[bilan.attribue]) o[bilan.attribue].s++;
  return o;
}
/** PURE. Le taux de première séance après chaque push, avec l'alerte des petits groupes. */
export function tauxPremiere(stats) {
  return PREMIERE_LEVIERS.map((k) => {
    const v = (stats && stats[k]) || {};
    const e = Number(v.e) || 0, s = Number(v.s) || 0;
    return { levier: k, envoyes: e, seances: s, taux: pct(s, e), alerte: e < SEUIL_GROUPE };
  });
}
