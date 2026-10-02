// ══ LE CALENDRIER DES SAISONS (02/10/2026) — MODULE PUR ══════════════════
//
// Douze modèles, un par mois. Le 25 à 12 h (Paris), le travail
// « saisons_auto » (planif.js, metier.js saisonsAuto) crée la saison du mois
// suivant depuis son modèle, SI AUCUNE saison ne commence déjà ce mois-là :
// une saison posée à la main par Kevin (/saisons, écran admin) l'emporte
// toujours, avant comme après. Une saison créée ici porte `auto: true` ; si
// Kevin en pose une sur la même période ensuite, l'automatique s'efface
// (saisonsEffectives : ni bannière, ni push, ni badge pour elle).
//
// LA CALIBRATION : l'objectif perso est ce qu'atteint un athlète à TROIS
// SÉANCES PAR SEMAINE qui en fait 80 % — 3 × 4,3 semaines × 0,8 ≈ 10 séances
// sur un mois, 3 à 4 semaines validées, ~40 t (≈ 4 t par séance), +3 % de
// charge. `objectifCollectifParParticipant` : ce que chacun apporte au
// compteur commun — moins que l'objectif perso, tout le monde ne boucle pas.
//
// ⚠ Deux exemples de la demande ne tenaient pas cette règle et sont ramenés
//   à elle : « Été sans pause » 12 séances (90 % d'un mois à 3 par semaine)
//   → 11 ; « Novembre de fer » 14 séances (plus que 3 × 30 / 7 = 12,9, donc
//   hors d'atteinte à 3 par semaine) → 10.
import { SAISON_ID_RE, saisonValide } from './saisons.js';

export const MODELES = Object.freeze([
  { mois: 1, nom: 'Résolution tenue', mesure: 'serie', objectifPerso: 4, objectifCollectifParParticipant: 3,
    couleurAccent: '#E02020', texteAccueil: 'Quatre semaines validées en janvier : la résolution qui tient.', badgeCle: 'resolution-tenue' },
  { mois: 2, nom: 'Février sans excuse', mesure: 'seances', objectifPerso: 10, objectifCollectifParParticipant: 8,
    couleurAccent: '#C2185B', texteAccueil: 'Le mois le plus court : dix séances, pas une excuse.', badgeCle: 'fevrier-sans-excuse' },
  { mois: 3, nom: 'Mars en fonte', mesure: 'tonnage', objectifPerso: 40000, objectifCollectifParParticipant: 32000,
    couleurAccent: '#FF6D00', texteAccueil: '40 tonnes en un mois. Ensemble, on fait fondre la fonte.', badgeCle: 'mars-en-fonte' },
  { mois: 4, nom: 'Avril en série', mesure: 'serie', objectifPerso: 3, objectifCollectifParParticipant: 2,
    couleurAccent: '#2E7D32', texteAccueil: 'Trois semaines validées en avril, sans se découvrir d’un fil.', badgeCle: 'avril-en-serie' },
  { mois: 5, nom: 'Progression de printemps', mesure: 'progressionPct', objectifPerso: 3, objectifCollectifParParticipant: 2,
    couleurAccent: '#43A047', texteAccueil: '+3 % sur tes charges en mai. La progression, pas la perfection.', badgeCle: 'progression-printemps' },
  { mois: 6, nom: 'Juin en charge', mesure: 'tonnage', objectifPerso: 40000, objectifCollectifParParticipant: 32000,
    couleurAccent: '#F9A825', texteAccueil: '40 tonnes avant l’été. Chaque série compte pour tous.', badgeCle: 'juin-en-charge' },
  { mois: 7, nom: 'Été sans pause', mesure: 'seances', objectifPerso: 11, objectifCollectifParParticipant: 8,
    couleurAccent: '#00ACC1', texteAccueil: 'Onze séances en juillet. Les vacances, oui ; la pause, non.', badgeCle: 'ete-sans-pause' },
  { mois: 8, nom: 'Août tient bon', mesure: 'serie', objectifPerso: 3, objectifCollectifParParticipant: 2,
    couleurAccent: '#0277BD', texteAccueil: 'Trois semaines validées en août : la série passe l’été.', badgeCle: 'aout-tient-bon' },
  { mois: 9, nom: 'La rentrée', mesure: 'seances', objectifPerso: 10, objectifCollectifParParticipant: 8,
    couleurAccent: '#5E35B1', texteAccueil: 'Dix séances en septembre : la rentrée commence à la salle.', badgeCle: 'la-rentree' },
  { mois: 10, nom: 'Octobre lourd', mesure: 'tonnage', objectifPerso: 40000, objectifCollectifParParticipant: 32000,
    couleurAccent: '#D84315', texteAccueil: '40 tonnes en octobre. Les feuilles tombent, les charges montent.', badgeCle: 'octobre-lourd' },
  { mois: 11, nom: 'Novembre de fer', mesure: 'seances', objectifPerso: 10, objectifCollectifParParticipant: 8,
    couleurAccent: '#546E7A', texteAccueil: 'Dix séances quand il fait nuit à 17 h. C’est ça, le fer.', badgeCle: 'novembre-de-fer' },
  { mois: 12, nom: 'Finir fort', mesure: 'serie', objectifPerso: 3, objectifCollectifParParticipant: 2,
    couleurAccent: '#E02020', texteAccueil: 'Trois semaines validées en décembre, fêtes comprises. On finit fort.', badgeCle: 'finir-fort' },
].map(Object.freeze));

// L'identifiant d'une saison automatique : « mars-2027 » (sans accent).
const NOMS_MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
export const idSaison = (mois, annee) => NOMS_MOIS[mois - 1] + '-' + annee;

// Le jour et l'heure de Paris d'un instant.
function partsParis(t) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(t))) p[x.type] = x.value;
  return { annee: Number(p.year), mois: Number(p.month), jour: Number(p.day), heure: Number(p.hour) % 24, minute: Number(p.minute) };
}
/** L'instant (ms) d'une heure de Paris : heure d'été et d'hiver comprises. */
export function instantParis(annee, mois, jour, heure, minute) {
  const voulu = Date.UTC(annee, mois - 1, jour, heure || 0, minute || 0);
  let t = voulu - 3600e3;
  for (let i = 0; i < 3; i++) {
    const p = partsParis(t);
    const vu = Date.UTC(p.annee, p.mois - 1, p.jour, p.heure, p.minute);
    t += voulu - vu;
  }
  return t;
}
/** Le mois suivant celui de Paris à l'instant t : {mois, annee}. */
export function moisSuivant(t) {
  const p = partsParis(t);
  return p.mois === 12 ? { mois: 1, annee: p.annee + 1 } : { mois: p.mois + 1, annee: p.annee };
}
/** Le début (1er, 0 h) et la fin (dernier jour, 23 h 59) d'un mois, à Paris. */
export function bornesMois(mois, annee) {
  const dernier = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  return { debut: instantParis(annee, mois, 1, 0, 0), fin: instantParis(annee, mois, dernier, 23, 59) };
}
/** Les saisons (valides) dont le début tombe dans [debut, fin]. */
export function saisonsDuMois(toutes, debut, fin) {
  const l = toutes && typeof toutes === 'object' ? toutes : {};
  return Object.keys(l).filter((id) => SAISON_ID_RE.test(id) && saisonValide(l[id]) && Number(l[id].debut) >= debut && Number(l[id].debut) <= fin);
}
/**
 * PURE. La saison à créer le 25 pour le mois suivant, ou null si une saison
 * (manuelle ou déjà automatique) y commence déjà. `participants` : ceux de la
 * saison du mois en cours (stats/saisons/<id>.participants). Rend {id, saison}.
 */
export function saisonAuto(toutes, t, participants) {
  const { mois, annee } = moisSuivant(t);
  const b = bornesMois(mois, annee);
  if (saisonsDuMois(toutes, b.debut, b.fin).length) return null;
  const id = idSaison(mois, annee);
  if (toutes && toutes[id]) return null;
  const m = MODELES.find((x) => x.mois === mois);
  const n = Math.max(0, Math.round(Number(participants) || 0));
  return { id, saison: { nom: m.nom, debut: b.debut, fin: b.fin, mesure: m.mesure, objectifPerso: m.objectifPerso,
    objectifCollectif: Math.max(1, Math.round(n * m.objectifCollectifParParticipant)), badgeCle: m.badgeCle,
    couleurAccent: m.couleurAccent, texteAccueil: m.texteAccueil, auto: true } };
}
/**
 * PURE. Les saisons qui comptent : une saison AUTOMATIQUE s'efface devant une
 * saison posée à la main qui chevauche sa période. Rend {id: saison}.
 */
export function saisonsEffectives(toutes) {
  const l = toutes && typeof toutes === 'object' ? toutes : {};
  const out = {};
  for (const id of Object.keys(l)) {
    const s = l[id];
    if (s && s.auto === true && Object.keys(l).some((k) => k !== id && l[k] && l[k].auto !== true && saisonValide(l[k])
      && Number(l[k].debut) <= Number(s.fin) && Number(l[k].fin) >= Number(s.debut))) continue;
    out[id] = s;
  }
  return out;
}
