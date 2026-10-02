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
// LE RÉFÉRENCEMENT (02/10/2026) : une vitrine de coach porte son canonical
// (https://repcore-sync.web.app/coach/<slug>) et figure dans le plan des
// vitrines (/sitemap-coachs.xml, cité par robots.txt) ; un profil d'athlète
// porte son canonical ET <meta name="robots" content="noindex"> : il se
// partage, il ne se cherche pas (vie privée). p/index.html le porte aussi en
// dur, pour la page statique de secours.
//
// EN PANNE (base ou hébergement injoignables) : redirection vers la page
// statique (p/?u=, c/?s=), qui marche sans aperçu. Jamais une erreur 500
// devant quelqu'un qui a cliqué un lien.

import { marqueValide, initialesMarque } from './marque.js';

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
    '<link rel="canonical" href="' + esc(o.url) + '">',
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
  // UN PROFIL D'ATHLÈTE NE S'INDEXE PAS, qu'il existe ou non ; une vitrine, si.
  if (type !== 'coach' && !/<meta\s+name="robots"/i.test(s)) s = s.replace(/<head>/i, '<head>\n<meta name="robots" content="noindex">');
  // Servie depuis le Worker, la page chercherait ses images ici : on la
  // rattache à l'hébergement. Une seule fois, juste après <head>.
  if (!/<base\s/i.test(s)) s = s.replace(/<head>/i, '<head>\n<base href="' + ORIGINE + '/">');
  return s;
}

// ── LA MARQUE D'UN COACH PRO (lot M1) ────────────────────────────────────
// Sa couleur (déjà rendue lisible par marqueValide) remplace le rouge de la
// page, et son logo (ou ses initiales, si l'image ne vient pas) coiffe la
// vitrine. Rien n'est lu si le coach n'est plus Pro : la page retombe sur
// RepCore. Mis en cache comme le reste (6 h).
export function injecterMarque(html, m) {
  const s = String(html || '');
  if (!m || !m.couleur || s.indexOf('</head>') < 0) return s;
  const n = parseInt(m.couleur.slice(1), 16);
  const rgba = 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',';
  const style = '<style id="rc-marque">:root{--rouge:' + m.couleur + '}'
    + '.equipe{color:' + m.couleur + '}.photo{border-color:' + m.couleur + ';box-shadow:0 0 0 4px ' + rgba + '.25),0 12px 30px rgba(0,0,0,.5)}'
    + '.cta{box-shadow:0 10px 30px ' + rgba + '.35)}'
    + '.rc-mq{display:flex;align-items:center;justify-content:center;gap:10px;padding:18px 18px 0;font-weight:800;letter-spacing:.5px}'
    + '.rc-mq-l{position:relative;width:40px;height:40px;border-radius:10px;overflow:hidden;background:' + m.couleur + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px}'
    + '.rc-mq-l img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#0b0b0c}</style>';
  const logo = '<span class="rc-mq-l" aria-hidden="true">' + esc(initialesMarque(m.nom))
    + (m.logoUrl ? '<img src="' + esc(m.logoUrl) + '" alt="" onerror="this.remove()">' : '') + '</span>';
  const bande = '<div class="rc-mq">' + logo + '<span>' + esc(m.nom) + '</span></div>';
  let r = s.replace('</head>', style + '\n</head>');
  r = r.replace(/<body([^>]*)>/i, (x) => x + '\n' + bande);
  return r;
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
  // LOT M1 : la marque d'un coach Pro, lue avec le compte de service (x.db) :
  // coachs/<coach>/marque n'est pas publique, ni le palier du coach.
  let marque = null;
  if (c.type === 'coach' && x.db) {
    try {
      const k = (await x.db.ref('slugs/' + c.cle).get()).val();
      if (k && typeof k === 'string') {
        const [m, plan] = await Promise.all([x.db.ref('coachs/' + k + '/marque').get(), x.db.ref('users/' + k + '/coachPlan').get()]);
        marque = marqueValide(m.val(), plan.val() || null, k);
      }
    } catch (e) { marque = null; }   // une marque illisible n'empêche pas la page
  }
  const corps = injecterMarque(injecterOg(html, og, c.type), marque);
  _poserMemoire(cle, corps, t);
  try {
    if (cache && x.ctx && typeof x.ctx.waitUntil === 'function')
      x.ctx.waitUntil(cache.put(new Request(cle), new Response(corps, { headers: entetes() })).catch(() => {}));
  } catch (e) { /* idem */ }
  return rendre(corps, 'neuf');
}

// ══ LE PLAN DES VITRINES (/sitemap-coachs.xml) ═══════════════════════════
// Les vitrines publiées (/vitrines : lecture publique, une vitrine a un nom),
// 500 au plus (les 500 premières par slug), avec leur date de mise à jour
// (maj). Mis en cache 6 h comme les pages. Base injoignable : 503, pour que
// le moteur repasse, plutôt qu'un plan vide qui ferait oublier les vitrines.
export const SITEMAP_COACHS_MAX = 500;
export function xmlSitemapCoachs(vitrines) {
  const l = vitrines && typeof vitrines === 'object' ? vitrines : {};
  const urls = Object.keys(l).filter((s) => SLUG_RE.test(s) && l[s] && typeof l[s] === 'object' && String(l[s].nom || '').trim())
    .sort().slice(0, SITEMAP_COACHS_MAX).map((s) => {
      const maj = Number(l[s].maj) > 0 ? new Date(Number(l[s].maj)).toISOString().slice(0, 10) : '';
      return '  <url>\n    <loc>' + esc(ORIGINE + '/coach/' + s) + '</loc>\n' + (maj ? '    <lastmod>' + maj + '</lastmod>\n' : '') + '  </url>';
    });
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.join('\n') + (urls.length ? '\n' : '') + '</urlset>\n';
}
/** Sert /sitemap-coachs.xml. `o` : {env, ctx, fetchImpl, cache, maintenant}. */
export async function servirSitemapCoachs(req, o) {
  const x = o || {};
  const f = x.fetchImpl || fetch;
  const t = typeof x.maintenant === 'function' ? x.maintenant() : Date.now();
  const cache = x.cache !== undefined ? x.cache : (typeof caches !== 'undefined' ? caches.default : null);
  const cle = new URL(req.url).origin + '/sitemap-coachs.xml';
  const tete = req.method === 'HEAD';
  const enTetes = { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=' + CACHE_S + ', s-maxage=' + CACHE_S, 'X-Content-Type-Options': 'nosniff' };
  const rendre = (corps) => new Response(tete ? null : corps, { status: 200, headers: enTetes });
  try { if (cache) { const r = await cache.match(new Request(cle)); if (r) return rendre(await r.text()); } } catch (e) { /* idem */ }
  const m = _lireMemoire(cle, t);
  if (m) return rendre(m);
  const base = String((x.env && x.env.FIREBASE_DB_URL) || 'https://repcore-sync-default-rtdb.firebaseio.com').trim().replace(/\/$/, '');
  let v;
  try {
    const r = await f(base + '/vitrines.json?orderBy=' + encodeURIComponent('"$key"') + '&limitToFirst=' + SITEMAP_COACHS_MAX);
    if (!r || !r.ok) throw new Error('base ' + (r && r.status));
    v = await r.json();
  } catch (e) {
    return new Response(tete ? null : 'Plan des vitrines indisponible, réessayer plus tard.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '3600', 'Cache-Control': 'no-store' } });
  }
  const corps = xmlSitemapCoachs(v);
  _poserMemoire(cle, corps, t);
  try {
    if (cache && x.ctx && typeof x.ctx.waitUntil === 'function')
      x.ctx.waitUntil(cache.put(new Request(cle), new Response(corps, { headers: enTetes })).catch(() => {}));
  } catch (e) { /* idem */ }
  return rendre(corps);
}
