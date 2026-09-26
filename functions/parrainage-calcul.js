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

// LE PREMIER PAIEMENT D'UN FILLEUL. Rend ce qu'il faut écrire, ou null quand il
// n'y a rien à faire (pas de parrain, ou déjà payant : UN seul mois par
// filleul, au premier paiement, jamais aux renouvellements).
//   compte   /parrainage/comptes/<parrain> tel qu'il est
//   id       l'identifiant du filleul chez son parrain
function premierPaiement(compte, id, maintenant) {
  const f = compte && compte.filleuls && compte.filleuls[id];
  if (!f || f.statut === "payant") return null;
  const filleuls = Object.assign({}, compte.filleuls, { [id]: Object.assign({}, f, { statut: "payant", payeLe: maintenant }) });
  const payants = Object.keys(filleuls).filter((k) => filleuls[k] && filleuls[k].statut === "payant").length;
  const mentor = payants >= PALIER_MENTOR && !(compte && compte.mentorLe);
  return {
    filleul: { statut: "payant", payeLe: maintenant },
    moisGagnes: (Number(compte && compte.moisGagnes) || 0) + 1,
    payants,
    mentor,
    prenom: String(f.prenom || "").trim() || "Ton filleul"
  };
}

// Le texte du push au parrain.
function textePaiement(p) {
  return p.mentor
    ? { title: "10 filleuls abonnés : 1 mois d’Ultime offert", body: p.prenom + " vient de s’abonner. Tu gagnes aussi 1 mois offert." }
    : { title: p.prenom + " vient de s’abonner : 1 mois offert", body: "Merci de faire découvrir RepCore. Ton accès est prolongé d’un mois." };
}

module.exports = { CODE_RE, PALIER_MENTOR, DELAI_RATTACHEMENT_MS, emailNormalise, cleNormalisee, cleVersEmail,
  idFilleul, deciderRattachement, premierPaiement, textePaiement };
