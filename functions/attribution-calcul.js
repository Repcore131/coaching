// ══ L'ATTRIBUTION — SANS FIREBASE ══════════════════════════════════════════
//
// Module PUR, éprouvé par functions/test/attribution.test.js. La même
// normalisation vit côté client (attribSrc, app/rc-core.*.js) : un `src` mal
// formé devient 'direct' des deux côtés, un `src` inconnu 'autre' : jamais une
// clé de base refusée.
"use strict";

const SRC_RE = /^[a-z0-9_-]{1,20}$/;
// LA LISTE BLANCHE DES `src` (01/10/2026). La regle de /attribution n accepte
// qu eux : une cle libre laissait n importe qui creer des milliers de noeuds.
// Un `src` bien forme mais inconnu devient 'autre'. La meme liste vit dans
// l app (ATTR_SRC_CONNUS) et dans database.rules.json ; scripts/verif/regles.mjs
// verifie que les trois disent la meme chose.
const SRC_CONNUS = Object.freeze(["amb", "amis", "autre", "avant", "badge", "bilan", "bio", "blog", "carte",
  "champion", "charge", "coachs", "commissions", "cycle", "defi", "diete", "direct", "dossier", "duel", "email",
  "envois", "facebook", "fond", "instagram", "invitation", "journal", "kit", "logo", "mes", "muscles",
  "parrainage", "pesees", "photos", "profil", "pub", "qr", "rang", "record", "records", "saison", "seance",
  "seances", "serie", "site", "story", "team", "tiktok", "victoire", "visuel", "vitrine", "whatsapp", "wrapped", "youtube"]);
const AMB_RE = /^[A-Z0-9]{3,16}$/;
const REF_RE = /^[A-Z]{4,6}[A-Z2-9]{3}$/;
const METRIQUES_SRC = ["partage", "telechargement", "copie", "clic", "inscription", "payant"];
const METRIQUES_AMB = ["clic", "inscription", "payant"];

// Le `src` d'une arrivée : celui du lien ; à défaut, 'amb' (un ambassadeur),
// 'parrainage' (un code parrain seul), sinon 'direct'.
function srcArrivee(q) {
  const x = q || {};
  const s = String(x.src || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 20);
  if (SRC_RE.test(s)) return SRC_CONNUS.indexOf(s) >= 0 ? s : "autre";
  if (AMB_RE.test(String(x.amb || "").toUpperCase())) return "amb";
  if (String(x.ref || "").trim()) return "parrainage";
  return "direct";
}
function jourParis(t) {
  const p = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date(t)).forEach((x) => { p[x.type] = x.value; });
  return p.year + "-" + p.month + "-" + p.day;
}
// Les chemins à incrémenter pour une arrivée. AUCUNE donnée personnelle :
// ni IP, ni code parrain (il désigne une personne), ni identifiant — un
// compteur par jour, par src, et par code ambassadeur (qui est public).
function cheminsArrivee(q, t) {
  const j = jourParis(t);
  const out = ["attribution/jours/" + j + "/src/" + srcArrivee(q) + "/clic"];
  const amb = String((q && q.amb) || "").toUpperCase();
  if (AMB_RE.test(amb)) out.push("attribution/jours/" + j + "/amb/" + amb + "/clic");
  return out;
}
function cheminsEvenement(metrique, origine, t) {
  const j = jourParis(t);
  const o = origine || {};
  const out = [];
  if (METRIQUES_SRC.indexOf(metrique) >= 0) out.push("attribution/jours/" + j + "/src/" + srcArrivee(o) + "/" + metrique);
  const amb = String(o.amb || "").toUpperCase();
  if (METRIQUES_AMB.indexOf(metrique) >= 0 && AMB_RE.test(amb)) out.push("attribution/jours/" + j + "/amb/" + amb + "/" + metrique);
  return out;
}
module.exports = { SRC_RE, SRC_CONNUS, AMB_RE, REF_RE, METRIQUES_SRC, METRIQUES_AMB, srcArrivee, jourParis, cheminsArrivee, cheminsEvenement };
