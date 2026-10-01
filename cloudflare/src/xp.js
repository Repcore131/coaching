// ══ LES VOLTS RECALCULÉS PAR LE SERVEUR (/xp_serveur/<compte>) — SANS BASE ══
//
// Module PUR, éprouvé par cloudflare/test/xp.test.mjs. metier.js lit, appelle,
// écrit. Le client écrivait lui-même u.xp, que le coach, la page publique et
// les défis lisaient : un total trichable. Désormais, à chaque séance terminée
// (événement « seance_fin »), le Worker :
//   1. relit les SÉANCES NOUVELLES seulement (l'état xp_etat/<compte> retient
//      l'index de la suivante, les meilleures charges par exercice, les volts
//      déjà pris par jour sous le plafond) — jamais tout l'historique à chaque
//      fois ;
//   2. en recalcule les volts avec la règle de l'app (xpCalcul) : séance
//      (100 V seulement si ≥ 15 min ET ≥ 6 séries validées, sinon séries × 10,
//      max 100), complète (+30), records (+50 chacun), sous le plafond du jour ;
//   3. borne ce qu'il ne recalcule pas (bilans, badges, journal, sommeil,
//      check-in, semaines, parcours) : la valeur du client (u.xpDetail) est
//      prise, mais jamais au-delà de ce que le dossier rend possible ;
//   4. CONTRÔLE LES BADGES SECRETS HORAIRES (AUBE, NUIT, NOUVEL AN, NOËL,
//      VENDREDI 13) avec son heure : une séance n'en prouve un que si sa date
//      est à moins de RECU_TOLERANCE de l'heure du serveur à la réception. Une
//      horloge de téléphone avancée ne donne plus AUBE.
//
// Les constantes sont celles de l'app (rc-core : XP_ACTIONS, XP_PLAFOND_JOUR,
// RANGS, EX_RENOMMAGES) — à tenir en phase, un test le rappelle.

// cible : la journée dans sa cible alimentaire (lot N2), 40 V par jour au plus.
// Le Worker ne relit pas le journal : il BORNE la valeur de l'app, comme pour
// le journal lui-même (jours × barème).
export const XP = { seance: 100, complete: 30, record: 50, bilan: 80, badge: 40, badgePalier4: 200,
  nutrition: 15, sommeil: 5, checkin: 10, cible: 40, semaine: 150, semaineAssiette: 75, parcours: 300 };
export const XP_PLAFOND_JOUR = 400;
export const SEANCE_MIN_MIN = 15, SEANCE_MIN_SERIES = 6, VOLTS_PAR_SERIE = 10;
export const RANGS = [
  { n: 1, nom: 'ÉTINCELLE', seuil: 0 }, { n: 2, nom: 'IMPULSION', seuil: 1800 }, { n: 3, nom: 'VOLTAGE', seuil: 3800 },
  { n: 4, nom: 'MACHINE', seuil: 7500 }, { n: 5, nom: 'ÉLITE', seuil: 14000 }, { n: 6, nom: 'SURTENSION', seuil: 20000 },
  { n: 7, nom: 'MONSTRE', seuil: 29000 }, { n: 8, nom: 'FOUDRE', seuil: 37000 }, { n: 9, nom: 'TITAN', seuil: 53000 },
  { n: 10, nom: 'LÉGENDE', seuil: 85000 },
];
const EX_RENOMMAGES = {
  'ABDUCTEURS A LA MACHINE': 'ABDUCTEUR A LA MACHINE',
  'CURL LARRY SCOTT MACHINE GUIDEE OU PUPITRE': 'CURL LARRY SCOTT MACHINE GUIDEE',
  'DEVELOPPE MACHINE HAUT DE PECS OU A LA SMITH': 'DEVELOPPE ASSIS A LA MACHINE HAUT DE PECS',
  'HIP THRUST MACHINE OU A LA BARRE': 'HIP THRUST MACHINE',
  'CURL A LA POULIE': 'CURL BARRE POULIE',
  'PRESSE A CUISSE INCLINEE': 'PRESSE A CUISSE INCLINE',
  'PRESSE A CUISSE INCLINEE PIEDS EN HAUT': 'PRESSE A CUISSE INCLINE',
  'TIRAGE POITRINE NEUTRE': 'TIRAGE POITRINE PRISE NEUTRE',
  'SQUAT BULGARE HALTERE': 'SQUAT BULGAR HALTERE',
  // 01/10/2026 : les deux fautes du guide corrigées, comme dans l'app.
  'EXTENTION TRICEPS POULIE BASSE': 'EXTENSION TRICEPS POULIE BASSE',
  'EXTENTION TRICEPS SUR BANC': 'EXTENSION TRICEPS SUR BANC',
  'EXTENTION TRICEPS SUR BANC ALTERNE': 'EXTENSION TRICEPS SUR BANC ALTERNE',
  'EXTENTION TRICEPS SUR BANC UNILATERALE': 'EXTENSION TRICEPS SUR BANC UNILATERALE',
  'LEG EXTENTION': 'LEG EXTENSION',
  'LEG EXTENTION ALLONGE ELASTIQUE': 'LEG EXTENSION ALLONGE ELASTIQUE',
  'LEG EXTENTION ALLONGE HALTERE': 'LEG EXTENSION ALLONGE HALTERE',
  'LEG EXTENTION HALTERE': 'LEG EXTENSION HALTERE',
  'CURL BARRE POULIE ELASTIQUE': 'CURL BARRE POULIE',
  'CURL BARRE POULIE ELASTIQUE ELASTIQUE': 'CURL BARRE POULIE',
};
// Les badges secrets dont la preuve est une HEURE : ceux que le serveur contrôle.
export const SECRETS_HORAIRES = ['aube', 'nuit', 'nouvel_an', 'noel', 'vendredi13'];
// Un badge horaire daté d'avant le contrôle serveur reste compté (il ne peut
// plus être vérifié, et il n'a pas été obtenu en trichant contre lui).
export const XP_SERVEUR_DEPUIS = Date.parse('2026-09-29T00:00:00+02:00');
export const RECU_TOLERANCE = 3 * 3600e3;
export const LOT_SEANCES = 40;
const J = 864e5;

export function exKey(nom) {
  return String(nom || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
export function cleExo(nom, alias) {
  let cur = exKey(nom);
  for (let i = 0; i < 3; i++) {
    const p = alias && alias[cur];
    const suiv = (p && p !== cur) ? p : EX_RENOMMAGES[cur];
    if (!suiv || suiv === cur) return cur;
    cur = suiv;
  }
  return cur;
}
// Les séries VALIDÉES, comptées dans les données (pas le compteur du client).
export function seriesValidees(s) {
  const d = s && s.data && typeof s.data === 'object' ? s.data : null;
  if (!d) return Math.max(0, Math.round(Number(s && s.sets) || 0));
  let n = 0;
  for (const k of Object.keys(d)) for (const st of ((d[k] || {}).sets || [])) if (st && st.done === true) n++;
  return n;
}
/** Les volts d'une séance : 100 si ≥ 15 min ET ≥ 6 séries validées, sinon séries × 10 (max 100). */
export function voltsSeance(s) {
  const n = seriesValidees(s), min = Number(s && s.duration) || 0;
  if (min >= SEANCE_MIN_MIN && n >= SEANCE_MIN_SERIES) return XP.seance;
  return Math.min(XP.seance, n * VOLTS_PAR_SERIE);
}
export function seanceComplete(s) {
  if (!s || s.complete === false) return false;
  return !(Number(s.setsPlanned) > 0 && Number(s.sets) < Number(s.setsPlanned));
}
// L'heure LOCALE de la séance : s.tz est getTimezoneOffset() de l'appareil
// (minutes, UTC − local). Sans lui, Paris.
function decalageParis(t) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour12: false, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(t));
  const o = {}; for (const x of p) o[x.type] = x.value;
  const loc = Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour % 24, +o.minute);
  return Math.round((Math.floor(t / 60000) * 60000 - loc) / 60000);
}
export function heureLocale(t, tz) {
  const dec = (Number.isFinite(Number(tz)) && Math.abs(Number(tz)) <= 14 * 60 && tz !== null && tz !== undefined) ? Number(tz) : decalageParis(t);
  const d = new Date(t - dec * 60000);
  return { jour: d.toISOString().slice(0, 10), heure: d.getUTCHours(), mois: d.getUTCMonth(), date: d.getUTCDate(), joursem: d.getUTCDay() };
}
/** Les secrets horaires qu'une séance remplit, à son heure locale. */
export function secretsDeSeance(s) {
  const out = [];
  const fin = Number(s && s.date);
  if (!(fin > 0)) return out;
  const debut = fin - (Number(s.duration) || 0) * 60000;
  const a = heureLocale(debut, s.tz), b = heureLocale(fin, s.tz);
  if (a.heure < 6) out.push('aube');
  if (b.heure >= 23 || b.heure < 4) out.push('nuit');
  if (b.mois === 0 && b.date === 1) out.push('nouvel_an');
  if (b.mois === 11 && b.date === 25) out.push('noel');
  if (b.joursem === 5 && b.date === 13) out.push('vendredi13');
  return out;
}
// LE LUNDI (AAAA-MM-JJ) d'un jour AAAA-MM-JJ : en dates UTC, donc sans
// changement d'heure (la semaine de l'app, _lundiDe, est la même borne).
export function lundiDuJour(j) {
  const [a, m, d] = String(j).split('-').map(Number);
  const t = Date.UTC(a, m - 1, d);
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - dow * 864e5).toISOString().slice(0, 10);
}
export const SEMAINES_GARDEES = 13;
export function etatVide() { return { n: 0, faites: 0, meilleurs: {}, jours: {}, s: { seance: 0, complete: 0, record: 0 }, secrets: {} }; }
/**
 * Fait avancer l'état sur des séances NOUVELLES (dans l'ordre de leur index).
 * `tRecu` : l'heure du serveur à la réception de l'événement.
 */
export function avancer(etat0, seances, alias, tRecu) {
  const e = JSON.parse(JSON.stringify(etat0 || etatVide()));
  e.meilleurs = e.meilleurs || {}; e.jours = e.jours || {}; e.secrets = e.secrets || {};
  e.s = Object.assign({ seance: 0, complete: 0, record: 0 }, e.s || {});
  // LES SÉANCES FAITES (au moins une série validée), pour le mois du parrain
  // (quatre séances d'un filleul). Un état d'avant ce compteur part du
  // nombre de séances déjà relues : au plus quelques vides comptées en trop.
  if (!Number.isFinite(Number(e.faites)) || e.faites == null) e.faites = Number(e.n) || 0;
  for (const s of seances) {
    e.n = (Number(e.n) || 0) + 1;
    const d = Number(s && s.date);
    if (!s || !(d > 0)) continue;
    // Une date dans le futur du serveur n'est pas une séance faite : ignorée.
    if (d > tRecu + 10 * 60e3) continue;
    const sv = seriesValidees(s);
    if (sv > 0) e.faites++;
    if (d > (Number(e.derniere) || 0)) e.derniere = d;
    const j = heureLocale(d, s.tz).jour;
    let nRec = 0;
    const data = s.data && typeof s.data === 'object' ? s.data : {};
    const prJour = {};
    for (const nm of Object.keys(data)) {
      let cur = 0;
      for (const st of ((data[nm] || {}).sets || [])) {
        if (!st || st.done === false) continue;
        const w = parseFloat(st.weight) || 0;
        if (w > cur) cur = w;
      }
      if (!cur) continue;
      const k = cleExo(nm, alias);
      if (cur > (prJour[k] || 0)) prJour[k] = cur;
      const h = Number(e.meilleurs[k]) || 0;
      if (h > 0 && cur > h) nRec++;
      if (cur > h) e.meilleurs[k] = cur;
    }
    // LE JOURNAL DES QUARANTE DERNIERS JOURS (01/10/2026) : ce que valeurServeur
    // relit pour les défis, les duels et les saisons, sans relire une séance.
    // Une séance sans série validée ne compte JAMAIS (ni séance, ni kilos, ni charge).
    if (sv > 0) {
      e.jr = e.jr || {};
      const r = e.jr[j] || { n: 0, ton: 0, pr: {} };
      r.n = (Number(r.n) || 0) + 1;
      r.ton = (Number(r.ton) || 0) + tonnageSeance(s);
      r.pr = Object.assign({}, r.pr || {});
      for (const k of Object.keys(prJour)) if (prJour[k] > (Number(r.pr[k]) || 0)) r.pr[k] = prJour[k];
      e.jr[j] = r;
    }
    let reste = XP_PLAFOND_JOUR - (Number(e.jours[j]) || 0);
    let gagnes = 0;
    for (const [c, v] of [['seance', voltsSeance(s)], ['complete', seanceComplete(s) ? XP.complete : 0], ['record', nRec * XP.record]]) {
      const pris = Math.max(0, Math.min(v, reste));
      e.s[c] += pris; reste -= pris; gagnes += pris;
    }
    // LA SEMAINE (lot D, le classement entre amis) : un INCRÉMENT, jamais un
    // recalcul. Rejouer un événement ne relit aucune séance déjà comptée
    // (e.n avance avec elles), donc n'ajoute rien.
    e.sem = e.sem || {};
    const lu = lundiDuJour(j), w = e.sem[lu] || { v: 0, n: 0 };
    e.sem[lu] = { v: (Number(w.v) || 0) + gagnes, n: (Number(w.n) || 0) + (seriesValidees(s) > 0 ? 1 : 0) };
    e.jours[j] = XP_PLAFOND_JOUR - reste;
    // LES SECRETS HORAIRES : prouvés seulement par une séance reçue à l'heure.
    if (Math.abs(d - tRecu) <= RECU_TOLERANCE) for (const id of secretsDeSeance(s)) if (!e.secrets[id]) e.secrets[id] = d;
  }
  // Les jours anciens ne servent plus au plafond.
  const derniers = Object.keys(e.jours).sort().slice(-4);
  e.jours = Object.fromEntries(derniers.map((k) => [k, e.jours[k]]));
  if (e.sem) e.sem = Object.fromEntries(Object.keys(e.sem).sort().slice(-SEMAINES_GARDEES).map((k) => [k, e.sem[k]]));
  if (e.jr) {
    const ks = Object.keys(e.jr).sort();
    const limite = ks.length ? decalerJour(ks[ks.length - 1], -JOURS_GARDES) : '';
    e.jr = Object.fromEntries(ks.filter((k) => k >= limite).map((k) => [k, e.jr[k]]));
  }
  return e;
}

// ══ LES SCORES DES DÉFIS, DES DUELS ET DES SAISONS, CALCULÉS ICI (01/10/2026) ══
// Ils étaient écrits par l'app (defiValeur) et seulement COMPARÉS par le
// Worker : n'importe qui pouvait écrire 999 depuis la console. Ils se tirent
// maintenant du journal e.jr, que seul le Worker écrit. La règle est celle de
// functions/defis-calcul.js (valeurDefi), aux deux nuances près que le
// journal impose : les bornes sont des JOURS (heure locale de la séance), et
// une séance sans série validée ne compte pas.
export const JOURS_GARDES = 40;
const decalerJour = (j, n) => {
  const [a, m, d] = String(j).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d) + n * J).toISOString().slice(0, 10);
};
// Les exercices d'une séance : `data` (nom → {sets}) ou `exercises` (ancienne forme).
function _liste(x) {
  if (Array.isArray(x)) return x.filter(Boolean);
  if (x && typeof x === 'object') return Object.keys(x).map((k) => x[k]).filter(Boolean);
  return [];
}
function _exos(s) {
  if (s && s.data && typeof s.data === 'object' && Object.keys(s.data).length)
    return Object.keys(s.data).map((nm) => ({ nom: nm, sets: _liste((s.data[nm] || {}).sets) }));
  return _liste(s && s.exercises).filter((e) => e && (e.name || e.nm)).map((e) => ({ nom: e.name || e.nm, sets: _liste(e.sets) }));
}
/** Les kilos d'une séance : la règle de functions/defis-calcul.js (tonnageSeance). */
export function tonnageSeance(s) {
  if (Number(s && s.volume) > 0) return Math.round(Number(s.volume));
  let v = 0;
  for (const e of _exos(s)) for (const st of e.sets) {
    if (!st || st.done === false) continue;
    v += (parseFloat(st.weight) || 0) * (parseFloat(st.repsDone != null ? st.repsDone : st.reps) || 0);
  }
  return Math.round(v);
}
/**
 * L'INSTANTANÉ « AVANT » d'une progression : les meilleures charges telles
 * qu'elles étaient AVANT les séances de ce recalcul (etatAvant), figées au
 * premier calcul du défi `id`. Rend le nouvel état (copie) ; ne touche à rien
 * si l'instantané existe. Les instantanés de plus de 120 jours sont oubliés.
 */
export function figerRef(etatAvant, etat, id, t) {
  const e = Object.assign({}, etat, { ref: Object.assign({}, (etat && etat.ref) || {}) });
  for (const k of Object.keys(e.ref)) if (!(Number(e.ref[k] && e.ref[k].at) > t - 120 * J)) delete e.ref[k];
  if (!e.ref[id]) e.ref[id] = { at: t, m: Object.assign({}, (etatAvant && etatAvant.meilleurs) || {}) };
  return e;
}
/**
 * PURE. La valeur d'un athlète pour une mesure, entre debut et fin (instants) :
 *   seances         Σ n des jours de la fenêtre ;
 *   tonnage         Σ ton ;
 *   serie           les semaines (lundiDuJour) où Σ n atteint le quota ;
 *   progressionPct  la moyenne des (max pendant / meilleur avant − 1) × 100,
 *                   « avant » étant l'instantané `ref` (ou etat.ref[ref]).
 */
export function valeurServeur(etat, mesure, debut, fin, quota, ref) {
  const jr = (etat && etat.jr) || {};
  const j0 = heureLocale(Number(debut), null).jour, j1 = heureLocale(Number(fin), null).jour;
  const jours = Object.keys(jr).filter((j) => j >= j0 && j <= j1);
  if (mesure === 'seances') return jours.reduce((a, j) => a + (Number(jr[j].n) || 0), 0);
  if (mesure === 'tonnage') return jours.reduce((a, j) => a + (Number(jr[j].ton) || 0), 0);
  if (mesure === 'serie') {
    const q = Math.max(1, Number(quota) || 1), sem = {};
    for (const j of jours) { const l = lundiDuJour(j); sem[l] = (sem[l] || 0) + (Number(jr[j].n) || 0); }
    return Object.keys(sem).filter((l) => sem[l] >= q).length;
  }
  if (mesure === 'progressionPct') {
    const r = typeof ref === 'string' ? (etat && etat.ref && etat.ref[ref] && etat.ref[ref].m) : ref;
    const avant = r || {};
    const pendant = {};
    for (const j of jours) for (const k of Object.keys(jr[j].pr || {})) {
      const w = Number(jr[j].pr[k]) || 0;
      if (w > (pendant[k] || 0)) pendant[k] = w;
    }
    const pcts = Object.keys(pendant).filter((k) => Number(avant[k]) > 0).map((k) => (pendant[k] / Number(avant[k]) - 1) * 100);
    if (!pcts.length) return 0;
    return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length * 10) / 10;
  }
  return 0;
}
/** Le classement d'un défi (functions/defis-calcul.js, metriqueClassement) :
 *  la progression en %, les semaines, sinon les séances — jamais les kilos. */
export function metriqueServeur(etat, mesure, debut, fin, quota, ref) {
  if (mesure === 'progressionPct' || mesure === 'serie') return valeurServeur(etat, mesure, debut, fin, quota, ref);
  return valeurServeur(etat, 'seances', debut, fin, quota, ref);
}
// Les séances lues par /users/<k>/sessions?orderBy="$key"&startAt=... : un
// tableau (à trous) ou un objet {index: séance}. Rend la liste dans l'ordre.
export function listeSeances(v, depuis) {
  if (!v || typeof v !== 'object') return [];
  const ks = Object.keys(v).map(Number).filter((k) => Number.isInteger(k) && k >= depuis).sort((a, b) => a - b);
  return ks.map((k) => v[k]);
}
/** La valeur des badges que le dossier porte, les secrets horaires non prouvés exclus. */
export function valeurBadges(badges, secrets) {
  let v = 0;
  const nonVerifies = [];
  for (const id of Object.keys(badges || {})) {
    const at = Number(badges[id] && badges[id].at) || 0;
    if (!(at > 0) || !/^[a-z0-9_-]{2,40}$/.test(id)) continue;
    if (SECRETS_HORAIRES.includes(id) && !(secrets && secrets[id]) && at >= XP_SERVEUR_DEPUIS) { nonVerifies.push(id); continue; }
    v += /_4$/.test(id) ? XP.badgePalier4 : XP.badge;
  }
  return { v, nonVerifies };
}
/**
 * LE TOTAL SERVEUR. `client` : u.xpDetail (les catégories de l'app) ;
 * `dossier` : {nBilans, badges, debut (1re trace du compte)}.
 */
export function totalServeur(etat, client, dossier, t) {
  const c = client && typeof client === 'object' ? client : {};
  const d = dossier || {};
  const jours = Math.max(1, Math.ceil((t - (Number(d.debut) || t)) / J) + 1);
  const b = valeurBadges(d.badges, etat && etat.secrets);
  const borne = (k, max) => Math.max(0, Math.min(Math.round(Number(c[k]) || 0), max));
  const cat = Object.assign({}, (etat && etat.s) || { seance: 0, complete: 0, record: 0 }, {
    bilan: borne('bilan', (Number(d.nBilans) || 0) * XP.bilan),
    badge: borne('badge', b.v),
    nutrition: borne('nutrition', jours * XP.nutrition),
    cible: borne('cible', jours * XP.cible),
    sommeil: borne('sommeil', jours * XP.sommeil),
    checkin: borne('checkin', jours * XP.checkin),
    semaine: borne('semaine', (Math.floor(jours / 7) + 1) * XP.semaine),
    // Lot N4 : la semaine d'assiette (5 jours tenus sur 7), une par semaine au plus.
    semaineAssiette: borne('semaineAssiette', (Math.floor(jours / 7) + 1) * XP.semaineAssiette),
    parcours: borne('parcours', XP.parcours),
    archive: borne('archive', jours * XP.sommeil),
  });
  const total = Object.keys(cat).reduce((a, k) => a + (Number(cat[k]) || 0), 0);
  return { total, cat, nonVerifies: b.nonVerifies };
}
export function rangDe(xp) {
  const v = Math.max(0, Number(xp) || 0);
  let i = 0;
  for (let k = 0; k < RANGS.length; k++) if (v >= RANGS[k].seuil) i = k;
  return { rang: RANGS[i], suivant: RANGS[i + 1] || null, xp: v };
}
export function voltsPublics(total) {
  const r = rangDe(total);
  return { xp: Math.round(r.xp), de: r.rang.seuil, a: r.suivant ? r.suivant.seuil : 0 };
}
