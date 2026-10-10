// ══ LES ALTERNATIVES À LA RÉSILIATION — LE CALCUL, SANS BASE (11/10/2026) ══
//
// Module PUR, éprouvé par cloudflare/test/alternatives.test.mjs. paypal.js
// lit le dossier, appelle ces fonctions, et parle à PayPal.
//
// ⚠ L215-1-1 NE BOUGE PAS. Résilier reste trois clics : Réglages, « Résilier
//   mon abonnement », « Confirmer la résiliation ». Les deux alternatives
//   (pause d'un mois, passage à Essentielle) sont des boutons À CÔTÉ de la
//   confirmation, sur le même écran, sous elle : jamais un écran de plus,
//   jamais avant. Le motif reste facultatif.
//
// QUI Y A DROIT
//   · la PAUSE : un abonnement MENSUEL, sans engagement en cours, ni
//     résiliation demandée, ni pause déjà en cours. Un annuel n'a rien à
//     suspendre d'un mois (son prochain prélèvement est dans des mois), et un
//     contrat engagé doit ses échéances (CGV §5) ;
//   · ESSENTIELLE : un abonnement Ultime, sans engagement en cours, ni
//     résiliation demandée, ni changement déjà demandé.
//
// LES MOTIFS sont comptés par mois dans stats/resiliations/<AAAA-MM>/<clé> :
// la clé fermée du menu, jamais le texte libre (qui peut contenir n'importe
// quoi, et reste dans le dossier de la personne).

export const PAUSE_JOURS = 30;
export const RECONQUETE_JOURS = 30;
const J = 864e5;

// Le menu de l'app (RESIL_MOTIFS, rc-core), dans l'ordre, et sa clé.
export const MOTIFS_RESILIATION = Object.freeze([
  Object.freeze({ lib: 'Trop cher', cle: 'trop_cher' }),
  Object.freeze({ lib: 'Je n\'utilise plus l\'app', cle: 'plus_utilisee' }),
  Object.freeze({ lib: 'Je change de coach', cle: 'change_coach' }),
  Object.freeze({ lib: 'Objectif atteint', cle: 'objectif_atteint' }),
  Object.freeze({ lib: 'Autre', cle: 'autre' }),
]);
/** PURE. La clé comptée d'un motif du menu ; '' → sans_reponse ; inconnu → autre. */
export function motifCle(lib) {
  const s = String(lib || '').trim();
  if (!s) return 'sans_reponse';
  const m = MOTIFS_RESILIATION.find((x) => x.lib === s);
  return m ? m.cle : 'autre';
}

// Ultime → Essentielle, à période égale. Les plans « demi » et l'ancien annuel
// engagé passent aussi : leur suite est un mensuel Ultime, ou un annuel.
export const PLAN_ESSENTIELLE_MENSUEL = 'P-95N51603RD882780YNJKS2QA';
export const PLAN_ESSENTIELLE_ANNUEL = 'P-5WS33005ML186714UNLET2VI';
const ULTIME_MENSUELS = ['P-2W777608239063532NK2LZXA', 'P-57P40267XP026613FNK2LZXQ'];
const ULTIME_ANNUELS = ['P-16Y44630WF304553UNK2LZXI', 'P-2NY44820N2546090CNLET2VQ'];
/** PURE. Le plan Essentielle qui remplace ce plan Ultime, ou null. */
export function planEssentielleDe(planId) {
  if (ULTIME_MENSUELS.indexOf(planId) >= 0) return PLAN_ESSENTIELLE_MENSUEL;
  if (ULTIME_ANNUELS.indexOf(planId) >= 0) return PLAN_ESSENTIELLE_ANNUEL;
  return null;
}

/**
 * PURE. Les alternatives proposées à côté de « Confirmer la résiliation ».
 * @param {{role?:string, status?:string, paypalSubscriptionId?:string, abonnement?:any}} u le dossier
 * @param {number} t maintenant
 * @returns {{pause:boolean, essentielle:boolean}}
 */
export function alternativesResiliation(u, t) {
  const x = u || {};
  const a = (x.abonnement && typeof x.abonnement === 'object') ? x.abonnement : {};
  const base = x.role !== 'coach' && /^I-[A-Z0-9]{8,}$/.test(String(x.paypalSubscriptionId || ''))
    && !(a.resiliationDemandee && typeof a.resiliationDemandee === 'object')
    && !(Number(a.engagementJusqu) > t);
  const enPause = !!(a.pause && Number(a.pause.reprise) > t);
  return {
    pause: base && !enPause && a.palier !== 'annuel',
    essentielle: base && !enPause && a.formule === 'ultime' && !(a.changement && a.changement.vers === 'essentielle'),
  };
}

/** PURE. Le jour (AAAA-MM) de Paris, pour les compteurs de motifs. */
export function moisParis(t) {
  return new Date(t).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }).slice(0, 7);
}

/** PURE. « 2 mois offerts » sur l'annuel, calculé depuis tarifs.json ; '' sinon. */
export function remiseAnnuelle(tarif) {
  const m = Number(tarif && tarif.mois), an = Number(tarif && tarif.an);
  if (!(m > 0 && an > 0)) return '';
  const n = Math.floor((12 * m - an) / m + 1e-9);
  return n >= 1 ? n + ' mois offert' + (n > 1 ? 's' : '') : '';
}

const tonnage = (kg) => { const v = Math.round(Number(kg) || 0); return v >= 1000 ? String(Math.round(v / 100) / 10).replace('.', ',') + ' t' : v + ' kg'; };
const eur = (v) => (Math.round(Number(v) * 100) % 100 ? Number(v).toFixed(2).replace('.', ',') : String(Math.round(Number(v)))) + ' €';
/**
 * PURE. Le message de reconquête (J+30 après la résiliation). Les chiffres
 * sont ceux du dossier : sans séance, aucun chiffre. L'offre est celle de
 * tarifs.json, rien d'autre.
 * @param {{prenom?:string, seances?:number, tonnageKg?:number, tarif:{mois:number, an:number}}} o
 */
export function messageReconquete(o) {
  const pr = String(o.prenom || '').trim().slice(0, 30);
  const s = Math.max(0, Math.floor(Number(o.seances) || 0)), kg = Math.max(0, Number(o.tonnageKg) || 0);
  const hist = s > 0
    ? s + ' séance' + (s > 1 ? 's' : '') + (kg >= 1 ? ' et ' + tonnage(kg) + ' soulevées' : '') + ' : tout est gardé.'
    : 'Ton programme et ton compte sont gardés.';
  const rem = remiseAnnuelle(o.tarif);
  const offre = o.tarif && Number(o.tarif.an) > 0 ? ' Ultime à l’année : ' + eur(o.tarif.an) + (rem ? ', soit ' + rem : '') + '.' : '';
  return { type: 'reconquete', tag: 'reconquete', url: './?abonnement=1',
    title: (pr ? pr + ', ta' : 'Ta') + ' place est toujours là', body: hist + offre,
    // Pour l'e-mail (modèle Brevo de reconquête) : les deux phrases, séparées.
    historique: hist, offre: offre.trim() || 'L’offre du moment est affichée dans l’application, sans engagement.' };
}

/** PURE. La reconquête part-elle aujourd'hui ? J+30 (jours de Paris) à J+37. */
export function reconqueteDue(le, t) {
  const a = Date.parse(new Date(Number(le)).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }) + 'T00:00:00Z');
  const b = Date.parse(new Date(t).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }) + 'T00:00:00Z');
  const n = Math.round((b - a) / J);
  return { due: n >= RECONQUETE_JOURS && n <= RECONQUETE_JOURS + 7, perimee: n > RECONQUETE_JOURS + 7 };
}
