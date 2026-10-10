// ══ LES INSCRITS QUI N'ONT JAMAIS COMMENCÉ (11/10/2026) ═════════════════
//
// Le travail « jamais_commence » (planif.js, 17 h, heure de Paris) : un push
// aux inscrits depuis 1, 3 et 6 jours qui n'ont fait AUCUNE séance, avec leur
// prénom et la séance de leur programme du jour. Le push ouvre directement
// cette séance (./?wo=1&i=<créneau>, lu par l'app).
//
// LES GARDE-FOUS
// · envoyerPush (metier.js) : seulement vers un appareil abonné, préférences
//   lues (pushPrefs.premiere === false coupe), heures calmes, et le PLAFOND
//   COMMUN d'un push par jour et par personne, tous types confondus. Un push
//   refusé par le plafond ne repart pas le lendemain : le palier suivant
//   prendra le relais.
// · Jamais à un coach, ni pendant une suspension, ni à qui a déjà une séance
//   (users/<k>/lastSession, relu : le résumé d'activité peut dater).
//
// LA MESURE : premiere_trace/<compte> note chaque envoi ; à la première séance
// (ou 14 jours après l'inscription) la trace se clôt dans les compteurs
// stats/relance_premiere (retention.js : bilanPremiere, ajouterPremiere),
// publiés avec /stats/retention.

import { paris } from './metier.js';
import * as RT from './retention.js';

const J = 864e5;
export const PREMIERE_PALIERS = Object.freeze([1, 3, 6]);
const JOURS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const LIRE_MAX = 1000;
const jours = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / J);

/**
 * PURE. Le palier du jour (1, 3 ou 6 jours de calendrier à Paris depuis
 * l'inscription), ou 0.
 * @param {string} inscrit AAAA-MM-JJ
 * @param {number} t
 * @returns {number}
 */
export function palierPremiere(inscrit, t) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(inscrit || ''))) return 0;
  const n = jours(String(inscrit), paris(t).jour);
  return PREMIERE_PALIERS.indexOf(n) >= 0 ? n : 0;
}

/**
 * PURE. La séance à proposer : le créneau ACTIF du jour (sessions_config est
 * indexé lundi → dimanche, comme dans l'app), sinon le prochain créneau actif.
 * @param {Array<{day?:string, name?:string, active?:boolean, exercises?:Array}>} cfg
 * @param {number} joursem 0 = dimanche … 6 = samedi (paris(t).joursem)
 * @returns {?{idx:number, nom:string, n:number, aujourdhui:boolean}}
 */
export function seancePremiere(cfg, joursem) {
  const c = Array.isArray(cfg) ? cfg : (cfg && typeof cfg === 'object' ? Object.keys(cfg).sort((a, b) => a - b).map((k) => cfg[k]) : []);
  const auj = (Number(joursem) + 6) % 7;
  for (let d = 0; d < 7; d++) {
    const i = (auj + d) % 7, s = c[i];
    const n = s && s.active && Array.isArray(s.exercises) ? s.exercises.filter((e) => e && (e.name || e.nm)).length : 0;
    if (n > 0) return { idx: i, nom: String(s.name || s.day || JOURS_FR[i]).trim().slice(0, 40), n, aujourdhui: d === 0 };
  }
  return null;
}

/**
 * PURE. Le message. Rien d'inventé : le prénom et la séance viennent du
 * dossier ; sans programme lisible, un message sans détail.
 * @param {number} palier 1, 3 ou 6
 * @param {{prenom?:string, seance?:?{idx:number, nom:string, n:number, aujourdhui:boolean}}} d
 */
export function messagePremiere(palier, d) {
  const x = d || {};
  const pr = String(x.prenom || '').trim().slice(0, 30);
  const s = x.seance;
  const detail = s ? s.nom + ' · ' + s.n + ' exercice' + (s.n > 1 ? 's' : '') : '';
  const titres = {
    1: (pr ? pr + ', ta' : 'Ta') + ' première séance t’attend',
    3: (pr ? pr + ', on' : 'On') + ' s’y met aujourd’hui ?',
    6: 'Ton programme est prêt' + (pr ? ', ' + pr : ''),
  };
  const corps = s
    ? (s.aujourdhui ? 'Au programme aujourd’hui : ' : 'Ta prochaine séance : ') + detail + '. Un appui et elle s’ouvre.'
    : 'Ton programme t’attend : un appui et tu choisis ta séance.';
  return { type: 'premiere', tag: 'premiere-j' + palier, url: s ? './?wo=1&i=' + s.idx : './?wo=1',
    title: titres[palier] || titres[1], body: corps };
}

/** @param {{db:any, M:any, maintenant?:()=>number}} ctx */
export function creerPremiere(ctx) {
  const { db, M } = ctx;
  const now = ctx.maintenant || (() => Date.now());
  const lire = async (c) => (await db.ref(c).get()).val();
  const budget = () => typeof M.reste === 'function' && M.reste() < 12;

  // UN INSCRIT : rend ce qui a été fait (pour les tests et le journal).
  async function un(cle, a, trace, t) {
    const palier = palierPremiere(a && a.inscrit, t);
    if (!palier) return 'hors_palier';
    if (a.seance1) return 'deja_commence';
    if (trace && Number(trace['j' + palier]) > 0) return 'deja';
    const [role, der, susp] = await Promise.all([lire('users/' + cle + '/role'), lire('users/' + cle + '/lastSession'), lire('users/' + cle + '/suspension')]);
    if (role === 'coach') return 'coach';
    if (Number(der) > 0) return 'deja_commence';
    if (susp && susp.actif) return 'suspension';
    const [fname, cfg] = await Promise.all([lire('users/' + cle + '/fname'), lire('users/' + cle + '/sessions_config')]);
    const m = messagePremiere(palier, { prenom: fname || '', seance: seancePremiere(cfg, paris(t).joursem) });
    const r = await M.envoyerPush(cle, m, { attendre: false });
    if (!(r && r.envoye)) return String((r && r.raison) || 'non');
    await db.ref('premiere_trace/' + cle).update({ inscrit: String(a.inscrit), ['j' + palier]: t });
    return 'envoye';
  }

  // LES TRACES : la première séance arrivée, ou 14 jours passés → compteurs.
  async function clore(traces, t) {
    let stats = null; const maj = {}; let n = 0;
    for (const cle of Object.keys(traces).sort()) {
      if (budget()) break;
      const der = Number(await lire('users/' + cle + '/lastSession')) || 0;
      const b = RT.bilanPremiere(traces[cle], der, t);
      if (!b.fini) continue;
      if (!stats) stats = (await lire('stats/relance_premiere')) || {};
      stats = RT.ajouterPremiere(stats, b);
      maj['premiere_trace/' + cle] = null; n++;
    }
    if (n) { maj['stats/relance_premiere'] = stats; await db.ref().update(maj); }
    return n;
  }

  // CHAQUE JOUR À 17 H. Rend false si le budget coupe : le travail reprend à
  // la minute suivante (une trace ou le plafond du jour empêche tout doublon).
  async function quotidien(t0) {
    const t = t0 || now();
    const traces = (await lire('premiere_trace')) || {};
    const closes = await clore(traces, t);
    const lot = await db.ref('activite').entre('inscrit', paris(t - 6 * J).jour, paris(t - J).jour, LIRE_MAX);
    const bilan = { closes };
    for (const cle of Object.keys(lot).sort()) {
      if (budget()) return false;
      try { bilan[cle] = await un(cle, lot[cle], traces[cle], t); } catch (e) { bilan[cle] = 'erreur'; }
    }
    return bilan;
  }

  return { quotidien, un, clore };
}
