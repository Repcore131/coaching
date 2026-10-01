// ══ LES LIGUES (01/10/2026) — MODULE PUR ═════════════════════════════════
//
// Chaque semaine, les athlètes actifs sont rangés en groupes de 20, par
// division ; le lundi suivant, les 5 premiers montent, les 5 derniers
// descendent (sauf en BRONZE), les autres restent. LE SCORE est celui du
// serveur, infalsifiable : les volts d'entraînement de la semaine
// (xp_etat/<k>.sem[lundi].v, tenu par xp.js avancer). Rien ici ne lit ni
// n'écrit la base : metier.js lit, appelle, écrit. Éprouvé par
// cloudflare/test/ligues.test.mjs.
//
// ⚠ DÉTERMINISTE. Le mélange des groupes prend pour graine le lundi de la
//   semaine : relancer la répartition (une minute coupée par le budget, un
//   travail rattrapé) rend exactement les mêmes groupes.
// ⚠ ON NE RECLASSE PAS UN ABSENT. Un compte sans séance la semaine close ET
//   la précédente sort des ligues sans bouger de division (« sorti ») ; il y
//   rentre à sa prochaine séance, dans sa division.
// ⚠ COACH, OPT-OUT (u.liguesOff), SUSPENSION : hors ligue. La suspension ne
//   fait pas descendre : le compte suspendu est retiré du classement final.

export const DIVISIONS = Object.freeze([
  { cle: 'bronze', nom: 'BRONZE' }, { cle: 'acier', nom: 'ACIER' }, { cle: 'voltage', nom: 'VOLTAGE' },
  { cle: 'foudre', nom: 'FOUDRE' }, { cle: 'titan', nom: 'TITAN' }, { cle: 'legende', nom: 'LÉGENDE' },
].map(Object.freeze));
export const TAILLE = 20;          // la taille visée d'un groupe
export const MONTENT = 5;          // les 5 premiers d'un groupe de 20 montent…
export const FUSION_MIN = 8;       // une division de moins de 8 actifs rejoint sa voisine
export const NOUVEAU_JOURS = 14;   // un compte de moins de 14 jours entre sans séance
export const TAILLE_MAX = 24;      // un groupe accepte les arrivées de la semaine jusque-là
const J = 864e5;

export const indexDivision = (cle) => Math.max(0, DIVISIONS.findIndex((d) => d.cle === cle));
export const nomDivision = (cle) => DIVISIONS[indexDivision(cle)].nom;

// Le lundi (AAAA-MM-JJ) d'un jour AAAA-MM-JJ, et le lundi d'avant.
export function lundiDe(jour) {
  const [a, m, d] = String(jour).split('-').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}
export function lundiPlus(lundi, semaines) {
  const [a, m, d] = String(lundi).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + 7 * semaines)).toISOString().slice(0, 10);
}

// FNV-1a puis mulberry32 : la même graine que la mission du jour de l'app.
function hash(s) { let h = 0x811c9dc5; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
function alea(graine) {
  let a = graine >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function melanger(liste, graine) {
  const r = alea(hash(graine)), t = liste.slice();
  for (let i = t.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [t[i], t[k]] = [t[k], t[i]]; }
  return t;
}

const semDe = (c, lundi) => (c && c.sem && c.sem[lundi]) || { v: 0, n: 0 };
/**
 * PURE. Le compte entre-t-il dans les ligues de la semaine `lundi` ?
 * `c` : {k, division, sem, debut, coach, off, suspendu}. Actif la semaine
 * d'avant (sem.n ≥ 1), ou inscrit depuis moins de 14 jours.
 */
export function eligible(c, lundi, t) {
  if (!c || !c.k || c.coach || c.off || c.suspendu) return false;
  if ((Number(semDe(c, lundiPlus(lundi, -1)).n) || 0) >= 1) return true;
  const debut = Number(c.debut) || 0;
  return debut > 0 && t - debut < NOUVEAU_JOURS * J;
}

// Combien montent (et descendent) dans un groupe de n : 5 à partir de 15,
// un tiers au-dessous (un groupe de 8 : 2 et 2), jamais les mêmes.
export function nMonte(n) { return Math.max(0, Math.min(MONTENT, Math.floor(n / 3))); }

// Les divisions trop maigres (moins de FUSION_MIN) rejoignent leur voisine
// du dessus (LÉGENDE, celle du dessous) jusqu'à ce que chaque réserve en ait
// assez, ou qu'il n'en reste qu'une.
export function fusionner(parDivision) {
  let pools = DIVISIONS.map((d, i) => ({ divs: [i], comptes: parDivision[i] || [] })).filter((p) => p.comptes.length);
  for (;;) {
    const i = pools.findIndex((p) => p.comptes.length < FUSION_MIN);
    if (i < 0 || pools.length < 2) break;
    const v = i + 1 < pools.length ? i + 1 : i - 1;
    const a = Math.min(i, v), b = Math.max(i, v);
    const m = { divs: pools[a].divs.concat(pools[b].divs), comptes: pools[a].comptes.concat(pools[b].comptes) };
    pools = pools.slice(0, a).concat([m], pools.slice(b + 1));
  }
  return pools;
}
// La division AFFICHÉE d'un groupe fusionné : celle qui y a le plus de
// membres (à égalité, la plus haute).
function divisionPrincipale(comptes) {
  const n = {};
  for (const c of comptes) n[c.d] = (n[c.d] || 0) + 1;
  return Number(Object.keys(n).sort((x, y) => (n[y] - n[x]) || (Number(y) - Number(x)))[0]) || 0;
}
/**
 * PURE. LA RÉPARTITION du lundi `lundi` (AAAA-MM-JJ). `comptes` : [{k,
 * division (clé), sem, debut, coach, off, suspendu}]. Rend
 * [{id, division, membres: [{k, division}]}], groupes de taille ÉQUILIBRÉE
 * (45 actifs : 15, 15, 15), mélangés sur la graine du lundi.
 */
export function repartir(comptes, t, lundi) {
  const l = lundi || lundiDe(new Date(t).toISOString().slice(0, 10));
  const par = DIVISIONS.map(() => []);
  const vus = new Set();
  for (const c of (comptes || []).slice().sort((a, b) => (String(a.k) < String(b.k) ? -1 : 1))) {
    if (vus.has(c.k) || !eligible(c, l, t)) continue;
    vus.add(c.k);
    const d = indexDivision(c.division);
    par[d].push({ k: c.k, d });
  }
  const groupes = [];
  for (const pool of fusionner(par)) {
    const tous = melanger(pool.comptes, l + '|' + pool.divs.join(','));
    const nb = Math.max(1, Math.ceil(tous.length / TAILLE));
    const principale = DIVISIONS[divisionPrincipale(tous)].cle;
    for (let g = 0; g < nb; g++) {
      const membres = tous.filter((_, i) => i % nb === g).map((x) => ({ k: x.k, division: DIVISIONS[x.d].cle }));
      groupes.push({ id: principale + '-' + (groupes.filter((y) => y.division === principale).length + 1), division: principale, membres });
    }
  }
  return groupes;
}

// Le classement : volts, puis séances, puis la dernière séance la plus TÔT
// (arrivé le premier), puis la clé (rien n'est laissé au hasard).
export function classer(membres, semV) {
  const s = (k) => (semV && semV[k]) || {};
  return membres.slice().sort((a, b) => {
    const x = s(a.k), y = s(b.k);
    return ((Number(y.v) || 0) - (Number(x.v) || 0)) || ((Number(y.n) || 0) - (Number(x.n) || 0))
      || ((Number(x.der) || Infinity) - (Number(y.der) || Infinity)) || (String(a.k) < String(b.k) ? -1 : 1);
  });
}
/**
 * PURE. LA CLÔTURE d'un groupe. `groupe` : {division, membres: [{k,
 * division}]} ; `semV` : {k: {v, n, der, nAvant, suspendu}} — la semaine
 * close (v, n), la dernière séance (der), les séances de la semaine d'avant
 * (nAvant). Rend [{k, division (avant), vers (après), place, mouvement:
 * 'monte' | 'descend' | 'reste' | 'sorti', taille}].
 *  - suspendu : hors classement, sans descente ('sorti') ;
 *  - aucune séance ni cette semaine ni la précédente : 'sorti', sans
 *    reclassement ;
 *  - les autres : top nMonte monte, les nMonte derniers descendent (sauf en
 *    BRONZE), la LÉGENDE ne monte pas plus haut.
 */
export function cloturer(groupe, semV) {
  const s = (k) => (semV && semV[k]) || {};
  const sortis = [], classes = [];
  for (const m of (groupe && groupe.membres) || []) {
    const x = s(m.k);
    if (x.suspendu || (!(Number(x.n) > 0) && !(Number(x.nAvant) > 0))) sortis.push(m);
    else classes.push(m);
  }
  const ordre = classer(classes, semV);
  const n = ordre.length, q = nMonte(n);
  const out = ordre.map((m, i) => {
    const d = indexDivision(m.division), place = i + 1;
    let vers = d, mouvement = 'reste';
    if (place <= q && d < DIVISIONS.length - 1) { vers = d + 1; mouvement = 'monte'; }
    else if (place > n - q && d > 0) { vers = d - 1; mouvement = 'descend'; }
    return { k: m.k, division: DIVISIONS[d].cle, vers: DIVISIONS[vers].cle, place, mouvement, taille: n };
  });
  for (const m of sortis) out.push({ k: m.k, division: m.division, vers: m.division, place: 0, mouvement: 'sorti', taille: n });
  return out;
}

/**
 * PURE. La place est-elle dans une ZONE DE BASCULE (le push du samedi) ?
 * Juste sous la montée (6e à 8e d'un groupe de 20) ou autour de la descente
 * (13e à 16e) ; pas de descente en BRONZE. Rend 'monte' | 'descend' | null.
 */
export function zoneBascule(place, taille, division) {
  const q = nMonte(taille);
  if (!q || !(place > 0)) return null;
  if (place > q && place <= q + 3 && indexDivision(division) < DIVISIONS.length - 1) return 'monte';
  if (indexDivision(division) > 0 && place >= taille - q - 2 && place <= taille - q + 1) return 'descend';
  return null;
}
export function messageBascule(place, taille, division, zone) {
  const q = nMonte(taille), nom = nomDivision(division);
  return { type: 'defi', prio: 'ligue', url: './?ligue=1', title: 'Tu es ' + place + (place === 1 ? 'er' : 'e') + ' de ta ligue ' + nom,
    body: zone === 'monte' ? 'Le top ' + q + ' monte : une séance d’ici dimanche peut tout changer.'
      : 'Les ' + q + ' derniers descendent : une séance d’ici dimanche te met à l’abri.' };
}
export function messageResultat(r) {
  const vers = nomDivision(r.vers);
  const title = r.mouvement === 'monte' ? 'Tu montes en ' + vers + ' ⚡'
    : r.mouvement === 'descend' ? 'Tu redescends en ' + vers : 'Tu restes en ' + vers;
  const body = 'Ta semaine : ' + r.place + (r.place === 1 ? 'er' : 'e') + ' sur ' + r.taille + '. Ta nouvelle ligue t’attend.';
  return { type: 'defi', prio: 'ligue', url: './?ligue=1', title, body };
}
// Le nom public d'un membre : son pseudo s'il a une page publique, sinon
// « Athlète N » (N : sa place dans la liste du groupe). Jamais son adresse.
export function nomPublic(pseudo, i) {
  return /^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/.test(String(pseudo || '')) ? String(pseudo) : 'Athlète ' + (i + 1);
}
// La clé de base d'un nom (Firebase refuse « . ») : « marc.fit » → « marc__fit ».
export const cleNom = (nom) => String(nom).replace(/\./g, '__').replace(/[#$\[\]/]/g, '_').replace(/\s+/g, '_');

/**
 * PURE. Le groupe d'un compte qui ENTRE en cours de semaine (sa première
 * séance, son retour) : le moins plein de sa division, sinon de la division
 * la plus proche (au-dessous d'abord), sous TAILLE_MAX. `index` : {division:
 * {groupe: membres}} (ligues_index/<lundi>). Rend {g, division} ou null.
 */
export function groupeDArrivee(index, division) {
  const d0 = indexDivision(division), ordre = [d0];
  for (let e = 1; e < DIVISIONS.length; e++) { if (d0 - e >= 0) ordre.push(d0 - e); if (d0 + e < DIVISIONS.length) ordre.push(d0 + e); }
  for (const d of ordre) {
    const cle = DIVISIONS[d].cle, gs = (index && index[cle]) || {};
    const libres = Object.keys(gs).filter((g) => (Number(gs[g]) || 0) < TAILLE_MAX).sort((a, b) => ((Number(gs[a]) || 0) - (Number(gs[b]) || 0)) || (a < b ? -1 : 1));
    if (libres.length) return { g: libres[0], division: cle };
  }
  return null;
}
