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

export function accVide() { return { c: {}, d: { dau: 0, wau: 0, mau: 0, n: 0 }, f: {}, l: {}, a: {} }; }
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
  // 4. L'activation (u.activation, recopiée dans le résumé sous `act`).
  if (r.act) {
    acc.a = acc.a || {};
    accumulerActivation(acc.a, { role: 'athlete', activation: r.act, palier: r.pal }, t);
  }
  // 5. Les leviers : seulement les cohortes dont le J30 est connu.
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
export function resultat(acc0, t) {
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
  const activation = finirActivation(acc.a || {});
  return { maj: t, comptes: Number(d.n) || 0, activation,
    actifs: { dau: d.dau || 0, wau: d.wau || 0, mau: d.mau || 0, dauMau: d.mau > 0 ? Math.round(d.dau / d.mau * 1000) / 10 : null },
    cohortes, entonnoir: { sources, total }, leviers, seuilGroupe: SEUIL_GROUPE };
}

// ══ L'ACTIVATION, PAR SEMAINE D'INSCRIPTION ET PAR CANAL (05/10/2026) ══════
//
// Chaque compte inscrit depuis ce lot porte u.activation = {inscrit, canal,
// premiereSeance, premierBilan, premierRepas} (dates en ms, posées UNE fois
// par l'app). Le résumé d'activité la recopie (act: {i, c, s, b, r}) avec le
// palier du moment (pal). Par semaine d'inscription (lundi, Paris) et par
// canal :
//   n          comptes de la cohorte ;
//   seance24h  % ayant fait leur première séance dans les 24 h, parmi ceux
//              inscrits depuis 24 h au moins ;
//   delaiMedH  délai médian jusqu'à la première séance, en heures, parmi ceux
//              qui l'ont faite ;
//   bilan7j    % ayant rempli le bilan de départ dans les 7 jours, parmi ceux
//              inscrits depuis 7 jours au moins ;
//   payantJ30  % dont le palier n'est pas « aucun », parmi ceux inscrits depuis
//              30 jours au moins (le palier LU au calcul, pas celui du jour 30 :
//              l'historique des paliers n'est pas gardé).
// Exclus : les comptes sans activation (antérieurs, pas de rétro-calcul) et
// les coachs. Une date antérieure à l'inscription (horloge du téléphone) est
// ramenée à l'inscription.
export const CANAUX = ['autonome', 'coach', 'ami', 'ambassadeur'];
const H = 3600e3;
const DELAIS_MAX = 5000;   // par groupe : la médiane n'a pas besoin de plus
// Le lundi (Paris) de la semaine d'un instant, AAAA-MM-JJ.
function lundiDe(t) {
  const j = jourDe(t);
  const d = new Date(j + 'T12:00:00Z');
  const k = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - k * J).toISOString().slice(0, 10);
}
// PURE. Une activation lisible, normalisée, ou null. Accepte la forme du
// dossier (inscrit, canal, premiereSeance…) et celle du résumé (i, c, s…).
export function activationNormale(a) {
  if (!a || typeof a !== 'object') return null;
  const ins = Number(a.inscrit != null ? a.inscrit : a.i);
  if (!(ins > 0)) return null;
  const c = String(a.canal != null ? a.canal : a.c || '');
  const date = (v) => { const x = Number(v); return x > 0 ? Math.max(ins, x) : null; };
  return { inscrit: ins, canal: CANAUX.includes(c) ? c : 'autonome',
    premiereSeance: date(a.premiereSeance != null ? a.premiereSeance : a.s),
    premierBilan: date(a.premierBilan != null ? a.premierBilan : a.b),
    premierRepas: date(a.premierRepas != null ? a.premierRepas : a.r) };
}
/** Ajoute UN dossier ({role, activation, palier}) à l'accumulateur d'activation. */
export function accumulerActivation(acc, dossier, t) {
  const x = dossier || {};
  if (x.role === 'coach') return acc;
  const a = activationNormale(x.activation);
  if (!a || a.inscrit > t) return acc;
  const sem = lundiDe(a.inscrit);
  const g = ((acc[sem] = acc[sem] || {})[a.canal] = acc[sem][a.canal]
    || { n: 0, n24: 0, s24: 0, d: [], n7: 0, b7: 0, n30: 0, p30: 0 });
  g.n++;
  const age = t - a.inscrit;
  if (age >= 24 * H) { g.n24++; if (a.premiereSeance && a.premiereSeance - a.inscrit < 24 * H) g.s24++; }
  if (a.premiereSeance && g.d.length < DELAIS_MAX) g.d.push(Math.round((a.premiereSeance - a.inscrit) / H * 10) / 10);
  if (age >= 7 * J) { g.n7++; if (a.premierBilan && a.premierBilan - a.inscrit < 7 * J) g.b7++; }
  if (age >= 30 * J) { g.n30++; if (x.palier && x.palier !== 'aucun') g.p30++; }
  return acc;
}
/** PURE. La médiane d'une liste de nombres, ou null. */
export function mediane(l) {
  const v = (l || []).map(Number).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2 * 10) / 10;
}
/** Les cohortes publiées : [{sem, canal, n, seance24h, n24, delaiMedH, bilan7j, n7, payantJ30, n30}]. */
export function finirActivation(acc) {
  const out = [];
  for (const sem of Object.keys(acc || {}).sort().slice(-COHORTES_MAX)) {
    for (const canal of CANAUX) {
      const g = acc[sem][canal];
      if (!g) continue;
      out.push({ sem, canal, n: g.n, seance24h: pct(g.s24, g.n24), n24: g.n24, delaiMedH: mediane(g.d),
        bilan7j: pct(g.b7, g.n7), n7: g.n7, payantJ30: pct(g.p30, g.n30), n30: g.n30 });
    }
  }
  return out;
}
/**
 * PURE. Les cohortes d'activation d'une liste de dossiers
 * ({role, activation, palier}), à l'instant `maintenant`.
 */
export function activationCohortes(dossiers, maintenant) {
  const t = Number(maintenant) || Date.now();
  const acc = {};
  for (const d of dossiers || []) accumulerActivation(acc, d, t);
  return finirActivation(acc);
}
