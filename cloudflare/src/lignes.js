// ══ LES « LIGNES » DU RACCOURCI iPHONE → LES « JOURS » (format rc-sante-1) ══
//
// Module PUR, éprouvé par cloudflare/test/sante.test.mjs. Le Raccourci
// « RepCore Santé » fabrique mal du JSON imbriqué : il envoie un TEXTE par
// type, une ligne par échantillon, champs séparés par des points-virgules,
// dates ISO 8601 avec fuseau, virgule décimale possible.
//   pas          debut;valeur
//   sommeil      debut;fin;etat          (Profond, Essentiel, Paradoxal, Éveillé, Au lit, Endormi…
//                                          ou Deep, Core, REM, Awake, InBed, Asleep)
//   fcRepos      date;bpm                 (dernière valeur du jour)
//   vfc          date;ms                  (moyenne du jour, SDNN chez Apple)
//   poids        date;kg                  (la PREMIÈRE pesée du matin, 4 h-12 h ;
//                                          sans pesée du matin, la première du jour)
//   masseGrasse  date;fraction ou %       (0,178 = 17,8 % ; même règle que le poids)
// LES JOURS SONT CEUX DE PARIS (paris() de metier.js) ; une nuit appartient
// au jour de son RÉVEIL. Au plus LIGNES_MAX lignes en tout : le reste est
// ignoré (plafond de 10 ms de CPU du Worker).
import { paris } from './metier.js';

export const LIGNES_MAX = 2000;
// Une nuit : des segments qui se suivent à moins de 3 h d'écart.
const NUIT_TROU_MS = 3 * 3600e3;
// Les états, en français et en anglais, sans accent ni casse. iOS ne les
// écrit pas toujours pareil selon la langue et la version : « Endormi(e) »,
// « Éveillé(e) », « Sommeil profond », « Asleep Core », « Asleep (Unspecified) »…
// On cherche donc un MOT dans le libellé, et l'ordre compte : la phase
// précise (profond, paradoxal, essentiel) passe avant le générique
// (endormi, sommeil), sinon « Asleep Core » serait un sommeil sans phase.
const ETATS = [
  [/profond|deep/, 'profond'],
  [/paradox|^rem$|asleeprem|sommeilrem/, 'paradoxal'],
  [/essentiel|core|leger|light/, 'leger'],
  [/eveil|awake/, 'eveil'],
  [/aulit|inbed|danslelit|aucouche/, 'aulit'],
  [/endormi|asleep|sommeil|sleep/, 'endormi'],
];
const net = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
export const etatSommeil = (s) => { const n = net(s); if (!n) return null; for (const [re, e] of ETATS) if (re.test(n)) return e; return null; };
export const nombre = (s) => { const v = Number(String(s == null ? '' : s).trim().replace(/\s/g, '').replace(',', '.')); return Number.isFinite(v) ? v : NaN; };
const instant = (s) => { const t = Date.parse(String(s || '').trim()); return Number.isFinite(t) ? t : NaN; };
const hhmm = (t) => { const p = paris(t); return String(p.heure).padStart(2, '0') + ':' + String(p.minute).padStart(2, '0'); };

/** Découpe les textes en lignes, au plus LIGNES_MAX en tout. Rend {par type: [[champs]]}, ignores. */
export function decouper(lignes) {
  const out = {};
  let n = 0, ignores = 0;
  for (const type of ['pas', 'sommeil', 'fcRepos', 'vfc', 'poids', 'masseGrasse']) {
    const txt = lignes && typeof lignes[type] === 'string' ? lignes[type] : '';
    const l = [];
    for (const brut of txt.split(/\r?\n/)) {
      if (!brut.trim()) continue;
      if (n >= LIGNES_MAX) { ignores++; continue; }
      n++;
      l.push(brut.split(';').map((x) => x.trim()));
    }
    out[type] = l;
  }
  return { types: out, ignores };
}

/** Les « jours » tirés des lignes. Rend { jours, ignores }. */
export function lignesVersJours(lignes) {
  const { types, ignores: trop } = decouper(lignes);
  let ignores = trop;
  const jours = {};
  const jour = (d) => jours[d] || (jours[d] = {});
  // PAS : somme par jour.
  for (const [a, v] of types.pas) {
    const t = instant(a), n = nombre(v);
    if (!Number.isFinite(t) || !Number.isFinite(n) || n < 0) { ignores++; continue; }
    const j = jour(paris(t).jour);
    j.pas = (j.pas || 0) + n;
  }
  // FC DE REPOS : la dernière valeur du jour ; VFC : la moyenne.
  const dernier = (liste, champ, conv) => {
    const vu = {};
    for (const [a, v] of liste) {
      const t = instant(a), n = conv(nombre(v));
      if (!Number.isFinite(t) || !Number.isFinite(n)) { ignores++; continue; }
      const d = paris(t).jour;
      if (!vu[d] || t >= vu[d].t) vu[d] = { t, n };
    }
    for (const d of Object.keys(vu)) jour(d)[champ] = vu[d].n;
  };
  // POIDS et MASSE GRASSE : la PREMIÈRE mesure du matin (4 h-12 h, heure de
  // Paris), à jeun et au lever, la seule comparable d'un jour à l'autre ; sans
  // pesée du matin, la première du jour. `champHeure` reçoit son heure (HH:MM).
  const premierDuMatin = (liste, champ, conv, champHeure) => {
    const vu = {};
    for (const [a, v] of liste) {
      const t = instant(a), n = conv(nombre(v));
      if (!Number.isFinite(t) || !Number.isFinite(n)) { ignores++; continue; }
      const p = paris(t), matin = p.heure >= 4 && p.heure < 12;
      const x = vu[p.jour];
      // Un matin bat un hors-matin ; à égalité de rang, la plus ancienne.
      if (!x || (matin && !x.matin) || (matin === x.matin && t < x.t)) vu[p.jour] = { t, n, matin };
    }
    for (const d of Object.keys(vu)) { const j = jour(d); j[champ] = vu[d].n; if (champHeure) j[champHeure] = hhmm(vu[d].t); }
  };
  dernier(types.fcRepos, 'fcRepos', (x) => x);
  premierDuMatin(types.poids, 'poids', (x) => x, 'poidsHeure');
  // Apple Santé donne une fraction (0,178) ; une valeur déjà en % passe telle quelle.
  premierDuMatin(types.masseGrasse, 'masseGrasse', (x) => (x <= 1 ? Math.round(x * 1000) / 10 : x));
  const vfc = {};
  for (const [a, v] of types.vfc) {
    const t = instant(a), n = nombre(v);
    if (!Number.isFinite(t) || !Number.isFinite(n)) { ignores++; continue; }
    const d = paris(t).jour;
    (vfc[d] || (vfc[d] = [])).push(n);
  }
  for (const d of Object.keys(vfc)) { const j = jour(d); j.vfc = vfc[d].reduce((s, x) => s + x, 0) / vfc[d].length; j.vfcMethode = 'sdnn'; }
  // SOMMEIL : les segments regroupés en nuits, la nuit au jour du réveil.
  const seg = [];
  for (const [a, b, e] of types.sommeil) {
    const d = instant(a), f = instant(b), et = etatSommeil(e);
    if (!Number.isFinite(d) || !Number.isFinite(f) || f <= d || !et) { ignores++; continue; }
    seg.push({ d, f, et });
  }
  seg.sort((x, y) => x.d - y.d);
  const nuits = [];
  for (const s of seg) {
    const n = nuits[nuits.length - 1];
    if (n && s.d - n.f < NUIT_TROU_MS) { n.l.push(s); if (s.f > n.f) n.f = s.f; }
    else nuits.push({ d: s.d, f: s.f, l: [s] });
  }
  for (const n of nuits) {
    const min = { profond: 0, leger: 0, paradoxal: 0, endormi: 0, eveil: 0, aulit: 0 };
    let debut = Infinity, fin = 0;
    for (const s of n.l) {
      min[s.et] += (s.f - s.d) / 60000;
      if (s.et !== 'aulit' && s.et !== 'eveil') { if (s.d < debut) debut = s.d; if (s.f > fin) fin = s.f; }
    }
    const endormi = min.profond + min.leger + min.paradoxal + min.endormi;
    const total = endormi > 0 ? endormi : Math.max(0, min.aulit - min.eveil);
    if (!(total > 0)) continue;
    if (!Number.isFinite(debut)) { debut = n.d; fin = n.f; }
    // Une même date de réveil déjà prise (sieste) : la plus longue gagne.
    const d = paris(fin).jour, j = jour(d);
    if (j.sommeilMin && j.sommeilMin >= total) continue;
    j.sommeilMin = Math.round(total);
    j.coucher = hhmm(debut);
    j.lever = hhmm(fin);
    if (endormi > 0) {
      j.phases = { profond: Math.round(min.profond), leger: Math.round(min.leger + min.endormi),
        paradoxal: Math.round(min.paradoxal), eveil: Math.round(min.eveil) };
    } else delete j.phases;
  }
  return { jours, ignores };
}
