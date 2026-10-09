// ══ LE PARRAINAGE — LES RÈGLES, SANS FIREBASE ══════════════════════════════
//
// Module PUR, éprouvé par functions/test/parrainage.test.js. index.js lit la
// base, appelle ces fonctions et écrit ce qu'elles rendent. Aucun déclencheur
// ici : seul index.js est lu par le déploiement.
"use strict";

const CODE_RE = /^[A-Z]{4,6}[A-Z2-9]{3}$/;
const PALIER_MENTOR = 10;
// Un compte de plus de sept jours ne se déclare plus filleul : le parrainage
// récompense une ARRIVÉE, pas un code saisi après coup par un ancien.
const DELAI_RATTACHEMENT_MS = 7 * 864e5;

// L'adresse ramenée à la personne : minuscules, sans « +alias », et, chez
// Gmail, sans les points (j.dupont et jdupont sont la même boîte). C'est ce
// qui arrête le parrainage de soi-même par un alias.
function emailNormalise(mail) {
  const m = String(mail || "").trim().toLowerCase();
  const i = m.lastIndexOf("@");
  if (i < 1) return m;
  let local = m.slice(0, i), dom = m.slice(i + 1);
  local = local.split("+")[0];
  if (dom === "googlemail.com") dom = "gmail.com";
  if (dom === "gmail.com") local = local.replace(/\./g, "");
  return local + "@" + dom;
}
// La clé Firebase d'une adresse normalisée (les points deviennent des virgules).
function cleNormalisee(mail) { return emailNormalise(mail).replace(/\./g, ","); }
function cleVersEmail(cle) { return String(cle || "").replace(/,/g, "."); }

// L'identifiant d'un filleul CHEZ SON PARRAIN : un hachage, jamais son
// adresse. Le parrain voit « Julie, inscrite le 3 », pas julie@…
function idFilleul(cle) {
  const s = String(cle || "");
  let a = 0x811c9dc5, b = 0x9e3779b9 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return "f" + a.toString(36) + b.toString(36);
}

// LA DÉCISION SUR UNE DEMANDE DE RATTACHEMENT. Rend {ok, raison}.
//   d        la demande {code, le, appareil}
//   ctx      {filleul: clé, filleulEmail, parrain: clé ou null, parrainEmail,
//             appareilsParrain: {id:true}, dejaFilleul: bool, emailDejaVu: bool,
//             creeLe: ms, maintenant: ms, dejaPaye: bool}
function deciderRattachement(d, ctx) {
  const c = ctx || {};
  if (!d || !CODE_RE.test(String(d.code || ""))) return { ok: false, raison: "code_invalide" };
  if (!c.parrain) return { ok: false, raison: "code_inconnu" };
  if (c.parrain === c.filleul) return { ok: false, raison: "soi_meme" };
  if (emailNormalise(c.parrainEmail) === emailNormalise(c.filleulEmail)) return { ok: false, raison: "meme_personne" };
  if (d.appareil && c.appareilsParrain && c.appareilsParrain[d.appareil]) return { ok: false, raison: "meme_appareil" };
  if (c.dejaFilleul) return { ok: false, raison: "deja_parraine" };
  // UN SEUL AVANTAGE : venu par un ambassadeur, on ne devient pas filleul.
  if (c.dejaAmbassadeur) return { ok: false, raison: "ambassadeur" };
  if (c.emailDejaVu) return { ok: false, raison: "adresse_deja_parrainee" };
  if (c.dejaPaye) return { ok: false, raison: "deja_client" };
  if (Number(c.creeLe) > 0 && Number(c.maintenant) - Number(c.creeLe) > DELAI_RATTACHEMENT_MS)
    return { ok: false, raison: "compte_ancien" };
  return { ok: true, raison: null };
}

// ══ LE FILLEUL QUALIFIÉ, ET LE PLAFOND DU PARRAIN (01/10/2026) ═══════════
//
// Un mois offert ne part plus sur quatre séances qu'on peut fabriquer en une
// soirée, avec une adresse jetable. Le filleul est QUALIFIÉ quand :
//   · son adresse e-mail est VÉRIFIÉE (email_verified du jeton Firebase, que
//     le Worker relève lui-même : parrainage/verifies/<clé>) ;
//   · il a au moins QUATRE séances où au moins une série est validée,
//   · tombées sur QUATRE jours calendaires distincts (heure de Paris),
//   · étalées sur au moins DIX jours entre le premier et le dernier.
// Une séance datée dans le futur du serveur ne compte pas.
//
// PARRAINAGE_AU_PAIEMENT (recommandé, actif) : le mois n'est crédité qu'au
// PREMIER PAIEMENT du filleul, ET seulement s'il est qualifié. Payé avant
// d'être qualifié, il est mis en attente ; la qualification le déclenche.
//
// PLAFOND : au plus PARRAIN_MOIS_MAX_AN mois offerts par parrain sur douze
// mois glissants (le mois du palier des 10 compris). Au-delà, rien n'est
// crédité : le Worker le journalise et prévient le créateur.
const PARRAINAGE_AU_PAIEMENT = true;
const PARRAIN_MOIS_MAX_AN = 6;
const AN_MS = 365 * 864e5;
const QUALIF_JOURS_MIN = 10;
const _JOUR_PARIS = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
function _jourParis(t) { return _JOUR_PARIS.format(new Date(t)); }
// Les séries validées d'une séance (même définition que xp.js).
function _seriesValidees(s) {
  const d = s && s.data && typeof s.data === "object" ? s.data : null;
  if (!d) return 0;
  let n = 0;
  for (const k of Object.keys(d)) for (const st of ((d[k] || {}).sets || [])) if (st && st.done === true) n++;
  return n;
}
// PURE. Le filleul est-il qualifié ? `seances` : tableau (ou objet indexé) des
// séances de son dossier ; `emailVerifie` : true seulement si le serveur l'a vu
// dans un jeton ; `maintenant` : ms.
function filleulQualifie(seances, emailVerifie, maintenant) {
  if (emailVerifie !== true) return false;
  const t = Number(maintenant) || Date.now();
  const liste = Array.isArray(seances) ? seances : (seances && typeof seances === "object" ? Object.values(seances) : []);
  const jours = new Set();
  for (const s of liste) {
    const d = Number(s && s.date);
    if (!(d > 0) || d > t + 10 * 60e3) continue;
    if (_seriesValidees(s) < 1) continue;
    jours.add(_jourParis(d));
  }
  if (jours.size < SEUIL_SEANCES) return false;
  const tri = [...jours].sort();
  const ecart = (Date.parse(tri[tri.length - 1] + "T00:00:00Z") - Date.parse(tri[0] + "T00:00:00Z")) / 864e5;
  return ecart >= QUALIF_JOURS_MIN;
}
// PURE. Les mois offerts à ce parrain sur les douze derniers mois : un par
// filleul crédité (creditLe), plus le mois du palier des 10 (mentorLe).
function moisOffertsSurUnAn(compte, maintenant) {
  const t = Number(maintenant) || Date.now(), depuis = t - AN_MS;
  const f = (compte && compte.filleuls) || {};
  let n = 0;
  for (const k of Object.keys(f)) if (f[k] && f[k].creditE && Number(f[k].creditLe) > depuis) n++;
  if (Number(compte && compte.mentorLe) > depuis) n++;
  return n;
}
// Les options des décisions ci-dessous. SANS options (l'ancien appelant,
// functions/index.js), le comportement d'avant : qualifié, pas de plafond.
function _opts(o) {
  if (!o) return { qualifie: true, auPaiement: false, plafond: Infinity };
  return { qualifie: o.qualifie === true, auPaiement: o.auPaiement === true,
    plafond: Number.isFinite(Number(o.plafond)) ? Number(o.plafond) : PARRAIN_MOIS_MAX_AN };
}

// LE PREMIER PAIEMENT D'UN FILLEUL. Rend ce qu'il faut écrire, ou null quand il
// n'y a rien à faire (pas de parrain, ou déjà payant : UN seul mois par
// filleul, au premier paiement, jamais aux renouvellements).
//   compte   /parrainage/comptes/<parrain> tel qu'il est
//   id       l'identifiant du filleul chez son parrain
//
// ⚠ UN SEUL MOIS PAR FILLEUL, QUEL QUE SOIT LE CHEMIN (29/09/2026). Le mois
// du parrain arrive quand le filleul a fait SES QUATRE PREMIÈRES SÉANCES
// (seuilSeances) ; un premier paiement qui arrive AVANT les quatre séances le
// donne aussi. La marque `creditE` sur le filleul garantit qu'il ne le
// donnera jamais deux fois, même si les événements sont rejoués ou arrivent
// dans le désordre.
function _valides(filleuls) { return Object.keys(filleuls).filter((k) => filleuls[k] && (filleuls[k].creditE || filleuls[k].statut === "payant")).length; }
// `o` : {qualifie, auPaiement, plafond} — voir filleulQualifie. Non qualifié :
// payant, mais en ATTENTE (enAttente) ; plafond atteint : rien de crédité,
// `plafond: true` pour que l'appelant le journalise.
function premierPaiement(compte, id, maintenant, o) {
  const f = compte && compte.filleuls && compte.filleuls[id];
  if (!f || f.statut === "payant") return null;
  const op = _opts(o);
  const annee = moisOffertsSurUnAn(compte, maintenant);
  const veut = !f.creditE && !f.plafondLe && op.qualifie;
  const plafond = veut && annee >= op.plafond;
  const credit = veut && !plafond;
  const maj = { statut: "payant", payeLe: maintenant };
  if (credit) { maj.creditE = true; maj.creditLe = maintenant; }
  if (!f.creditE && !f.plafondLe && !op.qualifie) maj.enAttente = true;
  if (plafond) maj.plafondLe = maintenant;
  const filleuls = Object.assign({}, compte.filleuls, { [id]: Object.assign({}, f, maj) });
  const payants = Object.keys(filleuls).filter((k) => filleuls[k] && filleuls[k].statut === "payant").length;
  const actifs = _valides(filleuls);
  // Le mois du palier des 10 compte aussi dans le plafond.
  const mentor = credit && actifs >= PALIER_MENTOR && !(compte && compte.mentorLe) && annee + 2 <= op.plafond;
  return {
    filleul: maj,
    moisGagnes: (Number(compte && compte.moisGagnes) || 0) + (credit ? 1 : 0),
    payants,
    actifs,
    credit,
    mentor,
    plafond,
    enAttente: !!maj.enAttente,
    prenom: String(f.prenom || "").trim() || "Ton filleul"
  };
}

// LES QUATRE PREMIÈRES SÉANCES D'UN FILLEUL : le mois du parrain, une fois.
// Rend ce qu'il faut écrire, ou null quand il n'y a rien à faire (pas ce
// filleul, ou déjà crédité : par ses séances, ou par un premier paiement).
const SEUIL_SEANCES = 4;
// AVEC `o` (le Worker) : la QUALIFICATION. Non qualifié : null, on
// repassera. Au paiement (auPaiement) et pas encore payé : null aussi —
// c'est le premier paiement qui créditera. Payé en attente de qualification :
// c'est ICI que le mois part. Plafond atteint : rien, `plafond: true`.
function seuilSeances(compte, id, maintenant, o) {
  const f = compte && compte.filleuls && compte.filleuls[id];
  // Déjà refusé au plafond : on ne le rejuge pas (ni journal ni push répétés).
  if (!f || f.creditE || f.plafondLe) return null;
  const op = _opts(o);
  if (!op.qualifie) return null;
  if (op.auPaiement && f.statut !== "payant") return null;
  // Sans options : crédité au paiement, avant la règle des séances (ancien modèle).
  const deja = !o && f.statut === "payant";
  const annee = moisOffertsSurUnAn(compte, maintenant);
  const plafond = !deja && annee >= op.plafond;
  const credit = !deja && !plafond;
  const maj = plafond ? { plafondLe: maintenant, actifLe: maintenant } : { creditE: true, actifLe: maintenant };
  if (credit) { maj.creditLe = maintenant; maj.enAttente = null; }
  const filleuls = Object.assign({}, compte.filleuls, { [id]: Object.assign({}, f, maj) });
  for (const k of Object.keys(filleuls[id])) if (filleuls[id][k] === null) delete filleuls[id][k];
  const actifs = _valides(filleuls);
  return {
    filleul: maj,
    moisGagnes: (Number(compte && compte.moisGagnes) || 0) + (credit ? 1 : 0),
    actifs,
    credit,
    plafond,
    mentor: credit && actifs >= PALIER_MENTOR && !(compte && compte.mentorLe) && annee + 2 <= op.plafond,
    prenom: String(f.prenom || "").trim() || "Ton filleul"
  };
}
// Le texte du push au parrain quand son filleul passe les quatre séances.
function texteSeuil(p, mode) {
  const quand = mode === "reserve" ? "Il t’attend en réserve : il s’ajoutera à la fin de ton abonnement."
    : "Ton accès est prolongé d’un mois.";
  return p.mentor
    ? { title: "10 filleuls au travail : 1 mois d’Ultime offert", body: p.prenom + " a fait ses quatre premières séances. " + quand }
    : { title: p.prenom + " s’est mis au travail : ton mois est offert", body: quand };
}

// Le texte du push au parrain.
function textePaiement(p) {
  if (p.credit === false) return { title: p.prenom + " vient de s’abonner", body: "Merci de faire découvrir RepCore." };
  return p.mentor
    ? { title: "10 filleuls abonnés : 1 mois d’Ultime offert", body: p.prenom + " vient de s’abonner. Tu gagnes aussi 1 mois offert." }
    : { title: p.prenom + " vient de s’abonner : 1 mois offert", body: "Merci de faire découvrir RepCore. Ton accès est prolongé d’un mois." };
}

module.exports = { CODE_RE, PALIER_MENTOR, DELAI_RATTACHEMENT_MS, emailNormalise, cleNormalisee, cleVersEmail,
  idFilleul, deciderRattachement, premierPaiement, textePaiement, SEUIL_SEANCES, seuilSeances, texteSeuil,
  PARRAINAGE_AU_PAIEMENT, PARRAIN_MOIS_MAX_AN, QUALIF_JOURS_MIN, filleulQualifie, moisOffertsSurUnAn };
