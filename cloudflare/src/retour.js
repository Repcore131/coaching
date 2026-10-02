// ══ LA RELANCE DES INACTIFS (type de push « retour ») — LE CALCUL, SANS BASE ══
//
// Module PUR, éprouvé par cloudflare/test/retour.test.mjs. metier.js lit
// quelques champs du dossier, appelle ces fonctions, écrit ce qu'elles
// rendent. Le Worker ne relit jamais les séances : le rang (xpRang), la série
// (streak) et le tonnage cumulé (tonnageTotal) sont écrits par l'app.
//
// QUATRE PALIERS, comptés en jours de Paris depuis la dernière séance :
//   PRÉCOCE (02/10/2026) : l'écart normal entre deux séances, plus un jour
//         — ceil(7 / créneaux actifs) + 1 : 4 jours pour 3 séances par
//         semaine, 5 pour 2, rien pour 1 (il tomberait après J+7). « Ta
//         semaine se joue maintenant » — avant que l'absence s'installe ;
//   J+7   « Ta semaine t'attend » — le rang et la série ;
//   J+14  « Tu as soulevé 84 t avec nous » — le tonnage et son équivalent ;
//   J+30  « Reprise en douceur » — la baisse de 10 % proposée (./?reprise=1).
// Puis silence. Un message par palier, QUATRE au plus par période
// d'inactivité (la période = la date de la dernière séance : une séance la
// referme, la suivante repart de zéro). Rien pendant une suspension.
//
// PAS DE DOUBLON AVEC LA SÉRIE EN DANGER (jeudi, 17 h–21 h) : un palier ne part pas
// si une relance de série est partie dans les RETOUR_ECART_J derniers jours,
// et la série se tait si une relance « retour » vient de partir.

import { RANGS, PRESTIGE_TRANCHE } from './xp.js';

export const RETOUR_PALIERS = [7, 14, 30];
export const RETOUR_MAX = 4;
export const RETOUR_ECART_J = 4;
const J = 864e5;

// Les rangs de l'app (RANGS, rc-core, et xp.js), dans l'ordre : xpRang est un numéro 1..10.
export const RANGS_NOMS = RANGS.map((r) => r.nom);
// « 1 240 » : les milliers séparés par une espace insécable, comme l'app.
export const voltsTexte = (v) => String(Math.max(0, Math.round(Number(v) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
/**
 * PURE. Vers quoi avance-t-on ? `total` : xp_serveur/<k>.total (ou null),
 * `xpRang` : le rang déjà fêté (il ne redescend pas). Rend {vers, reste} :
 * le rang suivant (ou, en LÉGENDE, l'étoile suivante) et les volts qui
 * manquent (null sans total), ou null sans rang connu.
 */
export function prochainPalier(total, xpRang) {
  const v = Number(total);
  const aTotal = total != null && isFinite(v) && v >= 0;
  let n = Math.round(Number(xpRang) || 0);
  if (aTotal) for (const r of RANGS) if (v >= r.seuil && r.n > n) n = r.n;
  if (!(n >= 1)) return null;
  if (n >= RANGS.length) {
    const l = RANGS[RANGS.length - 1].seuil, p = aTotal ? Math.max(0, Math.floor((v - l) / PRESTIGE_TRANCHE)) : 0;
    const a = l + (p + 1) * PRESTIGE_TRANCHE;
    return { vers: 'LÉGENDE ★' + (p + 1), reste: aTotal ? Math.max(0, a - v) : null };
  }
  const s = RANGS[n];
  return { vers: s.nom, reste: aTotal ? Math.max(0, s.seuil - v) : null };
}
// La table de l'app (EQUIV_TONNAGE, rc-core) : mêmes seuils, mêmes libellés.
const EQUIV = [
  { kg: 4, un: 'chat', plu: 'chats' }, { kg: 75, un: 'humain', plu: 'humains' },
  { kg: 300, un: 'piano', plu: 'pianos' }, { kg: 1200, un: 'voiture', plu: 'voitures' },
  { kg: 2300, un: 'rhinocéros', plu: 'rhinocéros' }, { kg: 6000, un: 'éléphant', plu: 'éléphants' },
  { kg: 8000, un: 'T-Rex', plu: 'T-Rex' }, { kg: 12000, un: 'bus', plu: 'bus' },
  { kg: 150000, un: 'baleine bleue', plu: 'baleines bleues' },
  { kg: 204000, un: 'Statue de la Liberté', plu: 'Statues de la Liberté' },
  { kg: 7300000, un: 'tour Eiffel', plu: 'tours Eiffel' },
];
// « 2 éléphants », ou null sous 2 kg — equivalentTonnage de l'app.
export function equivalentTonnage(kg) {
  const v = Number(kg);
  if (!isFinite(v) || v < 2) return null;
  let o = EQUIV[0];
  for (const x of EQUIV) if (v / x.kg >= 1) o = x;
  const n = Math.max(0.5, Math.round(v / o.kg * 2) / 2);
  return String(n).replace('.', ',') + ' ' + (n >= 2 ? o.plu : o.un);
}
// « 84 t », « 950 kg ».
export function tonnageTexte(kg) {
  const v = Math.round(Number(kg) || 0);
  if (v >= 1000) return String(Math.round(v / 100) / 10).replace('.', ',') + ' t';
  return v + ' kg';
}
// Le jour de Paris (AAAA-MM-JJ) → jours entiers entre deux instants.
const jourParis = (t) => new Date(t).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
export function joursDepuis(der, t) {
  const a = Date.parse(jourParis(der) + 'T00:00:00Z'), b = Date.parse(jourParis(t) + 'T00:00:00Z');
  return Math.round((b - a) / J);
}
// Le palier PRÉCOCE d'un athlète à `creneaux` créneaux actifs : l'écart
// normal (ceil(7 / créneaux)) plus un jour, ou 0 s'il ne tombe pas avant J+7.
export function palierPrecoce(creneaux) {
  const c = Math.round(Number(creneaux) || 0);
  if (c < 1) return 0;
  const p = Math.ceil(7 / Math.min(7, c)) + 1;
  return p < RETOUR_PALIERS[0] ? p : 0;
}
// Le nombre de créneaux actifs de sessions_config (tableau ou objet).
export function creneauxActifs(cfg) {
  return (Array.isArray(cfg) ? cfg : Object.values(cfg || {})).filter((x) => x && x.active).length;
}
// Le palier du jour (le précoce, 7, 14 ou 30), ou 0.
export function palierDuJour(der, t, creneaux) {
  if (!(Number(der) > 0) || !(t > der)) return 0;
  const n = joursDepuis(Number(der), t);
  if (RETOUR_PALIERS.indexOf(n) >= 0) return n;
  const p = palierPrecoce(creneaux);
  return p && n === p ? p : 0;
}
// L'état de la période : repart à zéro quand la dernière séance change.
export function etatPeriode(etat, der) {
  return (etat && Number(etat.depuis) === Number(der)) ? etat : { depuis: Number(der), paliers: {} };
}
// Peut-on envoyer ce palier ? {ok, raison}.
export function retourAutorise(o) {
  const { palier, etat, suspension, logPush, t } = o;
  if (!palier) return { ok: false, raison: 'jour' };
  if (suspension && suspension.actif) return { ok: false, raison: 'suspension' };
  const p = (etat && etat.paliers) || {};
  if (p[palier]) return { ok: false, raison: 'deja' };
  if (Object.keys(p).length >= RETOUR_MAX) return { ok: false, raison: 'max' };
  if (logPush && logPush.type === 'serie' && t - Number(logPush.at) < RETOUR_ECART_J * J) return { ok: false, raison: 'serie' };
  return { ok: true, raison: null };
}
// La série se tait-elle ? Une relance « retour » partie il y a moins de RETOUR_ECART_J jours.
export function retourRecent(etat, t) {
  const p = (etat && etat.paliers) || {};
  return Object.keys(p).some((k) => Number(p[k]) > 0 && t - Number(p[k]) < RETOUR_ECART_J * J);
}
// LE MESSAGE, avec les vraies données.
export function messageRetour(palier, d, t) {
  const x = d || {};
  const pr = String(x.fname || '').trim().slice(0, 30);
  const base = { type: 'retour', tag: 'retour-' + palier };
  if (palier < RETOUR_PALIERS[0]) {
    // LE PRÉCOCE : la semaine n'est pas perdue, elle se joue.
    const s = Math.max(0, Math.round(Number(x.streak) || 0));
    return Object.assign(base, { url: './?wo=1', title: (pr ? pr + ', ta' : 'Ta') + ' semaine se joue maintenant',
      body: s > 0 ? 'Ta série de ' + s + ' semaine' + (s > 1 ? 's' : '') + ' tient si tu fais ta séance d’ici dimanche.'
        : 'Ta prochaine séance t’attend, elle prend 45 min.' });
  }
  if (palier === 7) {
    // POUR AVANCER, pas « pour garder » : un rang fêté ne se perd jamais
    // (01/10/2026). Le total du serveur (xp_serveur/<k>.total) dit ce qu'il reste.
    const pp = prochainPalier(x.total, x.xpRang);
    const s = Math.max(0, Math.round(Number(x.streak) || 0));
    const serie = s > 0 ? ' et garder ta série de ' + s + ' semaine' + (s > 1 ? 's' : '') : '';
    const body = pp
      ? 'Une séance suffit pour avancer vers ' + pp.vers + serie + '.' + (pp.reste != null && pp.reste > 0 ? ' Plus que ' + voltsTexte(pp.reste) + ' V avant ' + pp.vers + '.' : '')
      : 'Une séance suffit pour repartir' + serie + '.';
    return Object.assign(base, { url: './?wo=1', title: (pr ? pr + ', ta' : 'Ta') + ' semaine t’attend', body });
  }
  if (palier === 14) {
    const kg = Number(x.tonnageTotal) || 0;
    const eq = equivalentTonnage(kg);
    return Object.assign(base, { url: './?wo=1', title: kg >= 1 ? 'Tu as soulevé ' + tonnageTexte(kg) + ' avec nous' : 'Deux semaines sans toi',
      body: (kg >= 1 && eq ? 'Soit ' + eq + '. ' : '') + 'Ta prochaine séance t’attend, on reprend où tu t’es arrêté.' });
  }
  return Object.assign(base, { url: './?reprise=1', title: 'Reprise en douceur',
    body: 'Un mois sans séance : on te propose de baisser tes charges de 10 % pour la prochaine. Tu décides.' });
}
