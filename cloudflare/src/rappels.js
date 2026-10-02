// ══ LES RAPPELS DU SOIR ET DU DIMANCHE (02/10/2026) — MODULE PUR ══════════
//
// metier.js lit, appelle, écrit ; ce module ne touche pas la base. Éprouvé
// par cloudflare/test/rappels.test.mjs.
//
// LA VEILLE (19 h 30) : la veille d'un créneau actif, à qui ne s'est pas
//   entraîné aujourd'hui — « Demain : Haut du corps » et, si un exercice du
//   créneau a sa dernière charge à 97,5 % au moins de son record (xp_etat :
//   meilleurs, et le journal e.jr), « Squat : 97,5 kg, ton record est à
//   portée ». Deux fois par semaine au plus et par athlète.
// LE BADGE PROCHE (dimanche 17 h) : le plus proche de trois paliers — ASSIDU
//   (séances faites, xp_etat.faites), BRISEUR DE RECORDS (records,
//   xp_etat.s.record / 50), un PALIER DE SÉRIE (streak + 1 ∈ 4, 8, 12, 26,
//   52) — un seul push.
import { cleExo } from './xp.js';

export const VEILLE_PAR_SEMAINE = 2;
export const VEILLE_PART_RECORD = 0.975;

// Le créneau de DEMAIN : sessions_config est indexé lundi → dimanche ;
// `joursem` est celui d'aujourd'hui (0 = dimanche, comme getDay).
export function creneauDemain(cfg, joursem) {
  const l = Array.isArray(cfg) ? cfg : (cfg && typeof cfg === 'object' ? cfg : {});
  const demain = (Number(joursem) + 1) % 7;
  const c = l[(demain + 6) % 7];
  return c && c.active ? c : null;
}
// Les noms d'exercices d'un créneau (tableau d'objets ou de noms).
export function exercicesDu(c) {
  const l = Array.isArray(c && c.exercises) ? c.exercises : Object.values((c && c.exercises) || {});
  return l.map((x) => (typeof x === 'string' ? x : (x && (x.name || x.nom)) || '')).filter(Boolean);
}
/**
 * Le premier exercice du créneau dont la DERNIÈRE charge (le journal e.jr,
 * jour le plus récent qui le porte) vaut au moins 97,5 % du record
 * (e.meilleurs). Rend {nom, charge, record} ou null.
 */
export function recordAPortee(exos, meilleurs, jr) {
  const jours = Object.keys(jr && typeof jr === 'object' ? jr : {}).sort().reverse();
  for (const nom of exos || []) {
    const k = cleExo(nom, null), rec = Number(meilleurs && meilleurs[k]) || 0;
    if (!(rec > 0)) continue;
    const j = jours.find((d) => Number(jr[d] && jr[d].pr && jr[d].pr[k]) > 0);
    const charge = j ? Number(jr[j].pr[k]) : 0;
    if (charge > 0 && charge >= VEILLE_PART_RECORD * rec) return { nom, charge, record: rec };
  }
  return null;
}
// Combien de veilles cette semaine (les dates AAAA-MM-JJ à partir du lundi).
export function veillesDeLaSemaine(dates, lundi) {
  return (Array.isArray(dates) ? dates : Object.values(dates || {})).filter((d) => String(d) >= String(lundi)).length;
}
const kg = (v) => String(Math.round(Number(v) * 10) / 10).replace('.', ',');
export function messageVeille(creneau, rec) {
  const nom = String((creneau && (creneau.name || creneau.nom)) || '').trim().slice(0, 40) || 'ta séance';
  return { type: 'serie', prio: 'veille', url: './?wo=1', title: 'Demain : ' + nom,
    body: rec ? rec.nom + ' : ' + kg(rec.charge) + ' kg, ton record est à portée' : 'Ta séance est prête. Une bonne nuit, et on y va.' };
}

// ── LE BADGE PROCHE ──────────────────────────────────────────────────────
export const SEUILS_ASSIDU = [10, 50, 100, 250];
export const SEUILS_BRISEUR = [5, 25, 50, 100];
export const PALIERS_SERIE = [4, 8, 12, 26, 52];
const ROMAINS = ['I', 'II', 'III', 'IV'];
const pl = (n, mot) => n + ' ' + mot + (n > 1 ? 's' : '');
/**
 * PURE. Le badge le plus proche : {cle, reste, title, body, tag}, ou null.
 * `faites` : séances à au moins une série validée ; `records` : records
 * battus ; `streak` : semaines d'affilée. À égalité, la série d'abord (une
 * semaine suffit), puis ASSIDU, puis BRISEUR.
 */
export function badgeProche(o) {
  const x = o || {};
  const c = [];
  const s = Math.max(0, Math.round(Number(x.streak) || 0));
  if (s > 0 && PALIERS_SERIE.includes(s + 1)) {
    c.push({ cle: 'serie', reste: 1, tag: 'badge-serie-' + (s + 1),
      title: 'Une semaine de plus et tu passes ' + (s + 1) + ' semaines d’affilée', body: 'Valide ta semaine : le palier t’attend.' });
  }
  const n = Math.max(0, Math.round(Number(x.faites) || 0));
  const sa = SEUILS_ASSIDU.find((v) => v > n);
  if (sa && sa - n <= 2) {
    const p = ROMAINS[SEUILS_ASSIDU.indexOf(sa)];
    c.push({ cle: 'assidu', reste: sa - n, tag: 'badge-assidu-' + p,
      title: 'Encore ' + pl(sa - n, 'séance') + ' pour ASSIDU ' + p, body: 'Le badge est à portée de main cette semaine.' });
  }
  const r = Math.max(0, Math.round(Number(x.records) || 0));
  const sb = SEUILS_BRISEUR.find((v) => v > r);
  if (sb && sb - r <= 2) {
    const p = ROMAINS[SEUILS_BRISEUR.indexOf(sb)];
    c.push({ cle: 'briseur', reste: sb - r, tag: 'badge-briseur-' + p,
      title: 'Encore ' + pl(sb - r, 'record') + ' pour BRISEUR DE RECORDS ' + p, body: 'Ta prochaine séance peut le faire tomber.' });
  }
  const ordre = ['serie', 'assidu', 'briseur'];
  c.sort((a, b) => (a.reste - b.reste) || (ordre.indexOf(a.cle) - ordre.indexOf(b.cle)));
  return c[0] || null;
}
