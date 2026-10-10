// ══ LA COMMISSION DU COACH SUR SES ATHLÈTES DEVENUS ABONNÉS (10/10/2026) ═══
//
// Un athlète suivi par un coach externe (code du coach dans l'app) qui devient
// abonné payant de RepCore dans les 90 jours suivant la fin de son code : le
// coach est crédité COMME UN AMBASSADEUR. Même taux (décision commune : 20 %,
// 25 % au-delà de 50 payants), mêmes 12 mois, même échéance (J+30), même
// rapport mensuel (écran Ambassadeurs, export CSV).
//
// COMMENT : au premier paiement (paypal.js, premierPaiement), le Worker pose
// ambassadeurs_liens/<athlète> = {code, id, le, coach:true} vers le compte du
// coach dans le registre des ambassadeurs (ambassadeurs/<code>, type:'coach').
// Tout le reste — commission, remboursement, litige, rapport — est le chemin
// des ambassadeurs, inchangé.
//
// PAS DE DOUBLE : un athlète déjà rattaché à un ambassadeur garde son
// ambassadeur ; le coach n'a rien sur lui. Un lien, une commission.
//
// Le compte du coach n'est PAS dans ambassadeurs_publics : son code ne sert pas
// d'invitation, et un athlète ne peut pas le saisir comme code ambassadeur.

export const FENETRE_JOURS = 90;
export const FENETRE_MS = FENETRE_JOURS * 864e5;
const CREATEUR = 'guellec,coachingpro@gmail,com';
const CLE_RE = /^[^.#$\[\]\/]{3,200}$/;

/**
 * PURE. Le code du coach dans le registre des ambassadeurs, tiré de sa clé :
 * « CO » + 10 caractères (deux FNV-1a 32 bits, en base 36). Toujours le même
 * pour le même coach ; conforme à /^[A-Z0-9]{3,16}$/.
 * @param {string} cle la clé du coach (e-mail, points en virgules)
 * @returns {string}
 */
export function codeCoach(cle) {
  const s = String(cle || '');
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x01000193) >>> 0;
    b = (b ^ (b >>> 13)) >>> 0;
  }
  const z = (n) => n.toString(36).toUpperCase().padStart(7, '0').slice(-5);
  return 'CO' + z(a) + z(b);
}

/**
 * PURE. L'athlète ouvre-t-il une commission à son coach ?
 * @param {{athlete:string, coach?:string|null, roleCoach?:string|null, rattache?:boolean,
 *   finCode?:number, lienAmb?:object|null, t:number}} o
 *   coach : users/<athlète>/coachEmailKey ; roleCoach : users/<coach>/role ;
 *   rattache : coachs/<coach>/clients/<athlète> === true (écrit par le coach) ;
 *   finCode : la fin du code (accessExpiry, ou droits.suiviJusqu) ;
 *   lienAmb : ambassadeurs_liens/<athlète>.
 * @returns {{ok:true}|{ok:false, raison:string}}
 */
export function eligibilite(o) {
  const x = o || {};
  const coach = String(x.coach || '');
  if (x.lienAmb) return { ok: false, raison: 'deja_ambassadeur' };
  if (!coach || !CLE_RE.test(coach)) return { ok: false, raison: 'sans_coach' };
  if (coach === x.athlete) return { ok: false, raison: 'soi' };
  if (coach === CREATEUR) return { ok: false, raison: 'createur' };
  if (x.roleCoach !== 'coach') return { ok: false, raison: 'pas_coach' };
  if (x.rattache !== true) return { ok: false, raison: 'non_rattache' };
  const fin = Number(x.finCode) || 0;
  if (!(fin > 0)) return { ok: false, raison: 'sans_code' };
  if (Number(x.t) > fin + FENETRE_MS) return { ok: false, raison: 'hors_fenetre' };
  return { ok: true };
}

/**
 * PURE. La vue du coach (coach_commissions_vue/<coach>) : ses athlètes devenus
 * abonnés et sa commission du mois en cours (attente + due + payée, hors
 * annulées et suspendues), en euros.
 * @param {{stats?:{payants?:number}, commissions?:Object}} a la fiche ambassadeurs/<code>
 * @param {string} mois « AAAA-MM » (Paris)
 * @param {number} t
 */
export function vueCoach(a, mois, t) {
  const x = a || {};
  const com = (x.commissions && x.commissions[mois]) || {};
  let total = 0;
  for (const k of Object.keys(com)) {
    const c = com[k] || {};
    if (c.statut === 'annulee' || c.statut === 'rembourse' || c.statut === 'suspendue') continue;
    total += Number(c.commission) || 0;
  }
  return { convertis: Number(x.stats && x.stats.payants) || 0, mois, commissionMois: Math.round(total * 100) / 100, maj: t };
}
