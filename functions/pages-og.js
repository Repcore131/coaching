// ══ L'APERÇU DES PAGES PUBLIQUES (Open Graph), SANS FIREBASE ═══════════════
//
// Module PUR, éprouvé par functions/test/pages.test.js. Les robots d'Instagram
// et de WhatsApp n'exécutent pas de JavaScript : l'aperçu d'un lien se lit
// dans le HTML servi. p/index.html et c/index.html portent un aperçu PAR
// DÉFAUT entre <!--og:debut--> et <!--og:fin--> ; la fonction pagePublique
// sert LA MÊME page avec, à la place, celui de la personne.
"use strict";

const ORIGINE = "https://repcore-sync.web.app";
const IMAGE_DEFAUT = ORIGINE + "/og-image.png";
const PSEUDO_RE = /^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function court(s, n) { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; }

// Le chemin demandé → {type:'athlete'|'coach', cle} ou null.
function analyserChemin(chemin) {
  const p = decodeURIComponent(String(chemin || ""));
  let m = /^\/@([^/?#]+)\/?$/.exec(p);
  if (m && PSEUDO_RE.test(m[1].toLowerCase())) return { type: "athlete", cle: m[1].toLowerCase() };
  m = /^\/coach\/([^/?#]+)\/?$/.exec(p);
  if (m && SLUG_RE.test(m[1].toLowerCase())) return { type: "coach", cle: m[1].toLowerCase() };
  return null;
}
// L'aperçu d'un athlète : son prénom, son rang, et l'emblème du rang en image.
// Jamais un poids ni une mesure — le profil public n'en porte pas.
function ogAthlete(pseudo, p) {
  if (!p || !p.prenom) return null;
  const bouts = [];
  if (p.rang && p.rang.nom) bouts.push(p.rang.nom);
  if (p.seances != null) bouts.push((p.seances | 0) + " séances");
  if (p.serie) bouts.push((p.serie | 0) + " semaines d’affilée");
  const n = p.rang && p.rang.n ? Math.max(1, Math.min(10, p.rang.n | 0)) : 0;
  return {
    titre: court(p.prenom, 24) + " sur RepCore",
    description: (bouts.length ? bouts.join(" · ") + ". " : "") + "Rejoins " + court(p.prenom, 24) + " sur RepCore.",
    image: n ? ORIGINE + "/app/img/rangs/rang_" + n + "-og.jpg" : IMAGE_DEFAUT,
    url: ORIGINE + "/@" + pseudo
  };
}
function ogCoach(slug, v) {
  if (!v || !v.nom) return null;
  const photo = /^https:\/\//.test(String(v.photo || "")) ? String(v.photo) : IMAGE_DEFAUT;
  return {
    titre: court(v.nom, 60) + " : coaching sur RepCore",
    description: court(v.phrase || v.bio || "Programmes, suivi, séances : commence avec " + v.nom + " sur RepCore.", 180),
    image: photo,
    url: ORIGINE + "/coach/" + slug
  };
}
function balisesOg(o) {
  return [
    '<meta property="og:type" content="profile">',
    '<meta property="og:site_name" content="RepCore">',
    '<meta property="og:title" content="' + esc(o.titre) + '">',
    '<meta property="og:description" content="' + esc(o.description) + '">',
    '<meta property="og:image" content="' + esc(o.image) + '">',
    '<meta property="og:url" content="' + esc(o.url) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="description" content="' + esc(o.description) + '">'
  ].join("\n");
}
// Remplace le bloc par défaut ; la page, elle, ne change pas d'un octet.
function injecterOg(html, o) {
  const s = String(html || "");
  const a = s.indexOf("<!--og:debut-->"), b = s.indexOf("<!--og:fin-->");
  if (!o || a < 0 || b < a) return s;
  return (s.slice(0, a) + "<!--og:debut-->\n" + balisesOg(o) + "\n" + s.slice(b))
    .replace(/<title>[^<]*<\/title>/, "<title>" + esc(o.titre) + "</title>");
}

module.exports = { ORIGINE, IMAGE_DEFAUT, PSEUDO_RE, SLUG_RE, analyserChemin, ogAthlete, ogCoach, balisesOg, injecterOg };
