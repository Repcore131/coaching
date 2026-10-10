// ══ LE PARCOURS DU PROSPECT (lot C6) — LE CALCUL, SANS BASE ═══════════════
//
// Module PUR, éprouvé par cloudflare/test/prospects.test.mjs. metier.js lit
// la base, appelle ces fonctions, écrit ce qu'elles rendent.
//
// Sur la vitrine d'un coach (/coach/<slug>), le bouton « Ça m'intéresse »
// d'une formule envoie un prénom et UN moyen de contact. Le serveur crée le
// prospect chez le coach : prospects/<coach>/<id>.
//
// ⚠ AUCUN PAIEMENT ICI. Les formules de coaching se règlent hors de l'app.
//   Cette page fait entrer le contact, pas l'argent.
// ⚠ LA RELANCE À 48 H VA AU COACH, jamais au prospect. Un prospect à qui le
//   coach a répondu (statut autre que « nouveau ») ne déclenche rien.
// ⚠ RIEN QUE LE NÉCESSAIRE : un prénom, un contact, la formule, une date. Ni
//   nom de famille, ni message libre, ni adresse IP.

const J = 864e5;
export const PROSPECT_RELANCE_H = 48;
export const PROSPECT_DOUBLON_J = 30;
import { formuleCoach, FORMULE_ID_RE } from './formules-coach.js';
export const PROSPECTS_JOUR_MAX = 30;
export const PROSPECT_PRENOM_MAX = 30;
export const PROSPECT_STATUTS = ['nouveau', 'repondu', 'athlete', 'sans_suite'];
// Les formules qu'une vitrine peut porter : celles du tableau des offres
// (tarifs.json, « coaching »), sauf le programme de la boutique, qui se vend
// par son propre lien.
export const PROSPECT_FORMULES = ['programme_perso', 'revision_prog', 'coaching_essentiel', 'coaching_transfo', 'coaching_evolution'];

// PURE. Le prénom tel qu'on le garde, ou '' s'il n'en est pas un.
export function prenomNet(p) {
  const s = String(p == null ? '' : p).replace(/\s+/g, ' ').trim();
  if (!s || s.length > PROSPECT_PRENOM_MAX) return '';
  return /^[\p{L}][\p{L}' -]*$/u.test(s) ? s : '';
}
// PURE. Un moyen de contact : {type:'email'|'tel', valeur} ou null.
// Téléphone : international (+ et 8 à 15 chiffres), ou français à 10 chiffres
// (0X…), rendu en +33.
export function contactNet(c) {
  const s = String(c == null ? '' : c).trim();
  if (!s || s.length > 120) return null;
  if (s.indexOf('@') >= 0) {
    const e = s.toLowerCase();
    return /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/.test(e) ? { type: 'email', valeur: e } : null;
  }
  const t = s.replace(/[\s.()-]/g, '');
  if (/^0[1-9]\d{8}$/.test(t)) return { type: 'tel', valeur: '+33' + t.slice(1) };
  if (/^00[1-9]\d{7,14}$/.test(t)) return { type: 'tel', valeur: '+' + t.slice(2) };
  if (/^\+[1-9]\d{7,14}$/.test(t)) return { type: 'tel', valeur: t };
  return null;
}
// PURE. Les formules que la vitrine porte : les offres du coach (ses prix,
// vitrines/<slug>/offres/<id>, valides selon formuleCoach), et, pour la seule
// vitrine de Kevin, les clés du tableau des offres (v.formules). L'appelant
// retire v.formules d'une vitrine qui n'est pas celle de Kevin : un coach
// externe n'affiche jamais les prix de Kevin.
export function formulesVitrine(v) {
  const f = v && v.formules;
  const l = Array.isArray(f) ? f : (f && typeof f === 'object' ? Object.values(f) : []);
  const o = v && v.offres && typeof v.offres === 'object' ? v.offres : {};
  const offres = Object.keys(o).filter((id) => FORMULE_ID_RE.test(id) && formuleCoach(o[id]));
  return offres.concat(l.filter((k) => PROSPECT_FORMULES.indexOf(k) >= 0 && offres.indexOf(k) < 0));
}
// PURE. Le libellé d'une offre du coach, ou '' (alors le libellé du tableau).
export function libOffre(v, id) {
  const f = v && v.offres && formuleCoach(v.offres[id]);
  return f ? f.lib : '';
}
function liste(brut) {
  const o = (brut && typeof brut === 'object') ? brut : {};
  return Object.keys(o).map((id) => Object.assign({ id }, o[id])).filter((p) => p && Number(p.at) > 0);
}

/**
 * PURE. Le formulaire → {ok:true, prospect} ou {ok:false, raison}.
 *   corps    : {prenom, contact, formule, site} (site : le piège à robots, vide)
 *   vitrine  : la vitrine publique du coach (ses formules)
 *   existants: prospects/<coach> (brut)
 * raisons : robot, prenom, contact, formule, doublon, plafond.
 */
export function prospectDepuisFormulaire(corps, vitrine, existants, t) {
  const c = corps || {};
  if (String(c.site || '').trim()) return { ok: false, raison: 'robot' };
  const prenom = prenomNet(c.prenom);
  if (!prenom) return { ok: false, raison: 'prenom' };
  const contact = contactNet(c.contact);
  if (!contact) return { ok: false, raison: 'contact' };
  const formule = String(c.formule || '');
  if (formulesVitrine(vitrine).indexOf(formule) < 0) return { ok: false, raison: 'formule' };
  const l = liste(existants);
  // Le même contact dans les trente jours : c'est la même personne, qui a
  // cliqué deux fois ou sur deux formules. Le coach a déjà sa fiche.
  if (l.some((p) => p.contact === contact.valeur && t - Number(p.at) < PROSPECT_DOUBLON_J * J)) return { ok: false, raison: 'doublon' };
  if (l.filter((p) => t - Number(p.at) < J).length >= PROSPECTS_JOUR_MAX) return { ok: false, raison: 'plafond' };
  return { ok: true, prospect: { at: t, prenom, contact: contact.valeur, canal: contact.type, formule, statut: 'nouveau' } };
}

// PURE. Les prospects à qui le coach n'a pas répondu depuis 48 h, et pour
// lesquels la relance n'est pas encore partie : [{id, prenom, formule, at}].
export function prospectsARelancer(brut, t) {
  return liste(brut).filter((p) => (p.statut || 'nouveau') === 'nouveau' && !p.relanceLe
    && t - Number(p.at) >= PROSPECT_RELANCE_H * 3600e3).sort((a, b) => Number(a.at) - Number(b.at));
}
// PURE. La notification au coach, pour un ou plusieurs prospects en attente.
export function messageRelanceCoach(l) {
  const n = (l || []).length;
  const p = n ? String(l[0].prenom || '').slice(0, 30) : '';
  return { type: 'prospect', url: './?prospects=1', tag: 'prospect-relance',
    title: n > 1 ? n + ' contacts attendent ta réponse' : p + ' attend ta réponse',
    body: n > 1 ? 'Arrivés par ta page il y a plus de deux jours. Un message aujourd’hui, et tu ne les perds pas.'
      : 'Arrivé par ta page il y a plus de deux jours. Un message aujourd’hui, et tu ne le perds pas.' };
}
// PURE. La notification au coach à l'arrivée d'un contact.
export function messageNouveauProspect(p, libFormule) {
  return { type: 'prospect', url: './?prospects=1', tag: 'prospect-' + Number(p.at),
    title: 'Nouveau contact : ' + String(p.prenom || '').slice(0, 30),
    body: 'Intéressé par ' + (libFormule || 'une de tes formules') + '. Réponds-lui vite : c’est dans les deux premiers jours que ça se joue.' };
}
