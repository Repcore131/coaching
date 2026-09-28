// ══ L'APERÇU DES PAGES PUBLIQUES (Open Graph), SERVI PAR LE WORKER ═══════
//
// Les robots de WhatsApp, d'Instagram (DM), d'iMessage ou de Facebook
// n'exécutent pas de JavaScript : l'aperçu d'un lien se lit dans le HTML
// servi. p/index.html et c/index.html portent un aperçu PAR DÉFAUT entre
// <!--og:debut--> et <!--og:fin-->. Ici, /@<pseudo> et /coach/<slug> servent
// LA MÊME page (relue sur l'hébergement), avec l'aperçu de la personne :
//   athlète  « Julie · rang VOLTAGE », ses séances et sa série, et l'emblème
//            du rang en image (app/img/rangs/rang_<n>-og.jpg, 1200×630) ;
//   coach    son nom, sa phrase, sa photo (https) ou l'image par défaut.
// Rien d'autre n'est lu que ce que la page elle-même affiche (/profils_publics,
// /vitrines : lecture publique, liste blanche de champs dans les règles).
//
// COMMENT LES LIENS ARRIVENT ICI : firebase.json REDIRIGE /@* et /coach/*
// vers ce Worker (302). Le lien partagé garde l'adresse de RepCore ; le robot
// suit la redirection et lit l'aperçu ici. La page servie porte un
// <base href> vers l'hébergement : ses images, /i et l'app restent chez
// Firebase.
//
// MIS EN CACHE 6 H : l'aperçu d'une personne change rarement, et chaque
// partage d'un lien fait passer plusieurs robots. Cache de Cloudflare
// (caches.default, quand le Worker est sur un domaine à soi ; sans effet sur
// *.workers.dev) et, toujours, une copie en mémoire de l'instance. La clé est
// le CHEMIN seul : ?ref= et ?src= sont lus par la page, pas par le serveur.
//
// EN PANNE (base ou hébergement injoignables) : redirection vers la page
// statique (p/?u=, c/?s=), qui marche sans aperçu. Jamais une erreur 500
// devant quelqu'un qui a cliqué un lien.

export const ORIGINE = 'https://repcore-sync.web.app';
export const IMAGE_DEFAUT = ORIGINE + '/og-image.png';
export const CACHE_S = 6 * 3600;
const PSEUDO_RE = /^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function court(s, n) { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; }

/** Le chemin → {type:'athlete'|'coach', cle} ou null. */
export function analyserChemin(chemin) {
  let p = '';
  try { p = decodeURIComponent(String(chemin || '')); } catch (e) { return null; }
  let m = /^\/@([^/?#]+)\/?$/.exec(p);
  if (m && PSEUDO_RE.test(m[1].toLowerCase())) return { type: 'athlete', cle: m[1].toLowerCase() };
  m = /^\/coach\/([^/?#]+)\/?$/.exec(p);
  if (m && SLUG_RE.test(m[1].toLowerCase())) return { type: 'coach', cle: m[1].toLowerCase() };
  return null;
}
/**
 * LE RANG DU SERVEUR PRIME. /volts_publics/<pseudo> est écrit par le Worker
 * à chaque séance terminée (xp.js) : le rang et la jauge y remplacent ceux que
 * le client a publiés, et les badges secrets horaires qu'il n'a pas prouvés
 * (`masquer`) disparaissent de la page. Même règle dans p/index.html.
 */
export function ficheAvecServeur(fiche, vs) {
  if (!fiche || !vs || typeof vs !== 'object') return fiche;
  const o = Object.assign({}, fiche);
  if (o.rang && vs.rang && vs.rang.n) {
    o.rang = { n: Math.max(1, Math.min(10, vs.rang.n | 0)), nom: String(vs.rang.nom || '').slice(0, 20) };
    o.volts = { xp: Number(vs.xp) || 0, de: Number(vs.de) || 0, a: Number(vs.a) || 0 };
  }
  const masquer = Array.isArray(vs.masquer) ? vs.masquer : Object.values(vs.masquer || {});
  if (o.badges && masquer.length) {
    const l = Array.isArray(o.badges) ? o.badges : Object.values(o.badges);
    o.badges = l.filter((b) => b && masquer.indexOf(b.id) < 0);
  }
  return o;
}
/** L'aperçu d'un athlète : prénom, rang, séances, série — jamais une charge ni une mesure. */
export function ogAthlete(pseudo, p) {
  if (!p || !p.prenom) return null;
  const prenom = court(p.prenom, 24);
  const n = p.rang && p.rang.n ? Math.max(1, Math.min(10, p.rang.n | 0)) : 0;
  const nomRang = p.rang && p.rang.nom ? court(p.rang.nom, 20) : '';
  const bouts = [];
  if (p.seances != null) bouts.push((p.seances | 0) + ' séances');
  if (p.serie) bouts.push((p.serie | 0) + ' semaines d’affilée');
  return {
    titre: prenom + (nomRang ? ' · rang ' + nomRang : '') + ' sur RepCore',
    description: (bouts.length ? bouts.join(' · ') + '. ' : '') + 'Rejoins ' + prenom + ' sur RepCore.',
    image: n ? ORIGINE + '/app/img/rangs/rang_' + n + '-og.jpg' : IMAGE_DEFAUT,
    imageAlt: n ? 'Emblème du rang ' + nomRang : 'RepCore',
    largeur: 1200, hauteur: 630,
    url: ORIGINE + '/@' + pseudo,
  };
}
export function ogCoach(slug, v) {
  if (!v || !v.nom) return null;
  const photo = /^https:\/\//.test(String(v.photo || '')) ? String(v.photo) : '';
  return {
    titre: court(v.nom, 60) + ' : coaching sur RepCore',
    description: court(v.phrase || v.bio || 'Programmes, suivi, séances : commence avec ' + v.nom + ' sur RepCore.', 180),
    image: photo || IMAGE_DEFAUT,
    imageAlt: court(v.nom, 60),
    largeur: photo ? 0 : 1200, hauteur: photo ? 0 : 630,
    url: ORIGINE + '/coach/' + slug,
  };
}
export function balisesOg(o, type) {
  return [
    '<meta property="og:type" content="' + (type === 'coach' ? 'website' : 'profile') + '">',
    '<meta property="og:site_name" content="RepCore">',
    '<meta property="og:locale" content="fr_FR">',
    '<meta property="og:title" content="' + esc(o.titre) + '">',
    '<meta property="og:description" content="' + esc(o.description) + '">',
    '<meta property="og:image" content="' + esc(o.image) + '">',
    '<meta property="og:image:secure_url" content="' + esc(o.image) + '">',
    o.largeur ? '<meta property="og:image:width" content="' + o.largeur + '">' : '',
    o.hauteur ? '<meta property="og:image:height" content="' + o.hauteur + '">' : '',
    '<meta property="og:image:alt" content="' + esc(o.imageAlt || o.titre) + '">',
    '<meta property="og:url" content="' + esc(o.url) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + esc(o.titre) + '">',
    '<meta name="twitter:image" content="' + esc(o.image) + '">',
    '<meta name="description" content="' + esc(o.description) + '">',
  ].filter(Boolean).join('\n');
}
/**
 * La page, avec l'aperçu de la personne (ou celui par défaut si `o` est
 * null), et <base href> vers l'hébergement. Le reste ne change pas d'un octet.
 */
export function injecterOg(html, o, type) {
  let s = String(html || '');
  const a = s.indexOf('<!--og:debut-->'), b = s.indexOf('<!--og:fin-->');
  if (o && a >= 0 && b > a) {
    s = s.slice(0, a) + '<!--og:debut-->\n' + balisesOg(o, type) + '\n' + s.slice(b);
    s = s.replace(/<title>[^<]*<\/title>/, '<title>' + esc(o.titre) + '</title>');
  }
  // Servie depuis le Worker, la page chercherait ses images ici : on la
  // rattache à l'hébergement. Une seule fois, juste après <head>.
  if (!/<base\s/i.test(s)) s = s.replace(/<head>/i, '<head>\n<base href="' + ORIGINE + '/">');
  return s;
}

// ── Le service ────────────────────────────────────────────────────────────
const _memoire = new Map();          // clé → {t, corps} (aperçus et gabarits)
const MEMOIRE_MAX = 500;
function _lireMemoire(k, maintenant) {
  const x = _memoire.get(k);
  if (x && maintenant - x.t < CACHE_S * 1000) return x.corps;
  if (x) _memoire.delete(k);
  return null;
}
function _poserMemoire(k, corps, maintenant) {
  if (_memoire.size >= MEMOIRE_MAX) _memoire.delete(_memoire.keys().next().value);
  _memoire.set(k, { t: maintenant, corps });
}
export function _viderMemoire() { _memoire.clear(); }

function entetes(extra) {
  return Object.assign({ 'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=' + CACHE_S + ', s-maxage=' + CACHE_S,
    'X-Content-Type-Options': 'nosniff' }, extra || {});
}
function statique(c) {
  return ORIGINE + (c.type === 'coach' ? '/c/?s=' : '/p/?u=') + encodeURIComponent(c.cle);
}

/**
 * Sert /@<pseudo> ou /coach/<slug>. `o` : {env, ctx, fetchImpl, cache,
 * maintenant} — fetchImpl et cache remplaçables (tests).
 * Rend null si le chemin n'est pas une page publique.
 */
export async function servirPagePublique(req, o) {
  const url = new URL(req.url);
  const c = analyserChemin(url.pathname);
  if (!c) return null;
  const x = o || {};
  const f = x.fetchImpl || fetch;
  const t = typeof x.maintenant === 'function' ? x.maintenant() : Date.now();
  const cache = x.cache !== undefined ? x.cache : (typeof caches !== 'undefined' ? caches.default : null);
  const cle = url.origin + '/' + (c.type === 'coach' ? 'coach/' : '@') + c.cle;
  const tete = req.method === 'HEAD';
  const rendre = (corps, source) => new Response(tete ? null : corps, { status: 200, headers: entetes({ 'X-RepCore-Apercu': source }) });
  // 1. Le cache de Cloudflare, puis la mémoire.
  try {
    if (cache) {
      const r = await cache.match(new Request(cle));
      if (r) return rendre(await r.text(), 'cache');
    }
  } catch (e) { /* un cache absent n'empêche rien */ }
  const m = _lireMemoire(cle, t);
  if (m) return rendre(m, 'memoire');
  // 2. Le gabarit (la page statique) et la fiche publique, ensemble.
  const dossier = c.type === 'coach' ? 'c' : 'p';
  const base = String((x.env && x.env.FIREBASE_DB_URL) || 'https://repcore-sync-default-rtdb.firebaseio.com').trim().replace(/\/$/, '');
  const noeud = c.type === 'coach' ? 'vitrines/' : 'profils_publics/';
  let html = _lireMemoire('gabarit:' + dossier, t);
  let fiche = null;
  try {
    const [g, d, vs] = await Promise.all([
      html ? Promise.resolve(null) : f(ORIGINE + '/' + dossier + '/index.html'),
      // Le point d'un pseudo est « __ » en base (Firebase refuse le point dans une clé).
      f(base + '/' + noeud + encodeURIComponent(c.type === 'coach' ? c.cle : c.cle.replace(/\./g, '__')) + '.json'),
      // Le rang recalculé par le serveur (/volts_publics), pour un athlète.
      c.type === 'coach' ? Promise.resolve(null) : f(base + '/volts_publics/' + encodeURIComponent(c.cle.replace(/\./g, '__')) + '.json').catch(() => null),
    ]);
    if (!html) {
      if (!g || !g.ok) throw new Error('gabarit ' + (g && g.status));
      html = await g.text();
      if (html.indexOf('<!--og:debut-->') < 0) throw new Error('gabarit sans marqueurs');
      _poserMemoire('gabarit:' + dossier, html, t);
    }
    if (d && d.ok) fiche = await d.json();
    if (fiche && vs && vs.ok) { try { fiche = ficheAvecServeur(fiche, await vs.json()); } catch (e) { /* la fiche du client reste */ } }
  } catch (e) {
    return new Response(null, { status: 302, headers: { Location: statique(c) + url.search.replace(/^\?/, '&'), 'Cache-Control': 'no-store' } });
  }
  const og = c.type === 'coach' ? ogCoach(c.cle, fiche) : ogAthlete(c.cle, fiche);
  const corps = injecterOg(html, og, c.type);
  _poserMemoire(cle, corps, t);
  try {
    if (cache && x.ctx && typeof x.ctx.waitUntil === 'function')
      x.ctx.waitUntil(cache.put(new Request(cle), new Response(corps, { headers: entetes() })).catch(() => {}));
  } catch (e) { /* idem */ }
  return rendre(corps, 'neuf');
}
