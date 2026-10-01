#!/usr/bin/env node
// LE WORKER NE DOIT GARDER QUE DEUX VERSIONS D'ACTIFS. On le PROUVE.
//
// POURQUOI UN BANC PLUTOT QU'UNE ASSERTION DE SOURCE. tests.js verifie que la
// garde existe dans sw.js — qu'on y lit bien `_actifGarde`, le plafond a deux
// et le journal de purge. C'est une lecture, pas une mesure : un `slice(0, 2)`
// applique a la mauvaise liste, un tri par ordre alphabetique (« 1409 » apres
// « 141 »), une purge qui tournerait AVANT le report — tout cela passerait.
//
// Or l'enjeu se compte en mega-octets sur le telephone de quelqu'un :
// rc-core.<build>.js pese 5,5 Mo, et le report d'un cache a l'autre recopie
// tout ce que l'ancien portait. Sans garde, dix livraisons EMPILENT dix
// versions — 55 Mo de code que plus aucune page ne demande.
//
// ON EN GARDE DEUX, et c'est delibere : la courante, et celle d'avant. Un
// onglet ouvert AVANT la mise a jour porte encore l'ancien index.html et
// demande encore l'ancien nom ; le lui retirer le laisserait sans code, hors
// ligne compris.
//
// CE BANC monte un faux `caches` en memoire, seme deux anciens caches et un
// cache neuf DEJA POLLUE, declenche `activate`, puis regarde ce qui reste.
// Deux scenes : avec le document en cache, et sans — la purge des anciens
// caches est sous condition, et cette condition merite d'etre prouvee elle
// aussi. Aucun reseau : `fetch` leve.
//
// Usage : node scripts/verif/worker-actifs.mjs
import {readFileSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const SW = readFileSync(join(RACINE, 'app', 'sw.js'), 'utf8');
const BUILD = (SW.match(/const CACHE = 'repcore-v(\d+)'/) || [])[1];
if (!BUILD) { console.error('CACHE introuvable dans sw.js'); process.exit(1); }
const O = 'http://127.0.0.1';
const PRECEDENT = Number(BUILD) - 1, POLLUANT = Number(BUILD) - 2, VIEUX = Number(BUILD) - 3;

// ── UN FAUX MAGASIN DE CACHES, avec des tailles pour que le journal parle ──
class FauxCache {
  constructor(nom) { this.nom = nom; this.m = new Map(); }
  _u(rq) { return typeof rq === 'string' ? new URL(rq, O + '/app/').href : rq.url; }
  async keys() { return [...this.m.keys()].map(u => ({url: u})); }
  async match(rq) { return this.m.get(this._u(rq)); }
  async put(rq, r) { this.m.set(this._u(rq), r); }
  async delete(rq) { return this.m.delete(this._u(rq)); }
  async add() { throw new Error('add() irait sur le reseau'); }
  async addAll() { throw new Error('addAll() irait sur le reseau'); }
}
function reponse(octets, texte) {
  const r = {octets, headers: {get: k => k === 'content-length' ? String(octets) : null},
    async text() { return texte || ''; }};
  r.clone = () => r;
  return r;
}

function scene({avecDocument}) {
  const magasin = new Map();
  const caches = {
    async open(n) { if (!magasin.has(n)) magasin.set(n, new FauxCache(n)); return magasin.get(n); },
    async keys() { return [...magasin.keys()]; },
    async delete(n) { return magasin.delete(n); },
    async match(rq) { for (const c of magasin.values()) { const r = await c.match(rq); if (r) return r; } },
  };
  const semer = async (nom, entrees) => {
    const c = await caches.open(nom);
    for (const [chemin, octets, texte] of entrees) c.m.set(new URL(chemin, O + '/app/').href, reponse(octets, texte));
  };
  const journal = [];
  const pret = (async () => {
    // Le cas reel d'un appareil passe par plusieurs livraisons avant ce lot.
    await semer('repcore-v' + VIEUX, [['./rc-core.' + VIEUX + '.js', 5500000],
      ['./rc-style.' + VIEUX + '.css', 590000], ['./icons/icon-192x192.png', 4000],
      ['./exercices/squat.webp', 40000]]);
    await semer('repcore-v' + PRECEDENT, [['./rc-core.' + PRECEDENT + '.js', 5500000],
      ['./rc-style.' + PRECEDENT + '.css', 590000], ['./data/ciqual.json', 672000],
      // La base porte sa version (sw.js, CIQUAL_VERSION) : c'est elle qui l'autorise a passer.
      ['./data/ciqual.version', 10, ((SW.match(/const CIQUAL_VERSION = '([^']+)'/) || [])[1]) || '']]);
    const neuf = [['./rc-core.' + BUILD + '.js', 5500000], ['./rc-style.' + BUILD + '.css', 590000],
      ['./rc-core.' + POLLUANT + '.js', 5500000]];               // la pollution
    if (avecDocument) neuf.push(['./index.html', 440000, "window.RC_BUILD='" + BUILD + "';"]);
    await semer('repcore-v' + BUILD, neuf);
  })();

  const ecoutes = new Map();
  const self_ = {
    addEventListener: (n, f) => ecoutes.set(n, f),
    skipWaiting: () => {},
    registration: {update: async () => {}, showNotification: async () => {}, scope: O + '/app/'},
    clients: {claim: () => {}, matchAll: async () => [], openWindow: async () => {}},
    location: {origin: O},
  };
  const faux = {
    self: self_, caches, location: self_.location, clients: self_.clients,
    fetch: async () => { throw new Error('le reseau n’existe pas sur ce banc'); },
    indexedDB: {open: () => ({})},
    console: {log: (...a) => journal.push(a.join(' ')), warn: (...a) => journal.push('! ' + a.join(' ')),
      error: (...a) => journal.push('ERR ' + a.join(' '))},
    Response, Request, Headers, URL, setTimeout, clearTimeout,
  };
  new Function(...Object.keys(faux), SW)(...Object.values(faux));
  const activate = ecoutes.get('activate');
  if (!activate) { console.error('aucun ecouteur activate dans sw.js'); process.exit(1); }

  return pret.then(async () => {
    let p = null;
    activate({waitUntil: q => { p = q; }});
    await p;
    const restants = [...(await (await caches.open('repcore-v' + BUILD)).keys())]
      .map(r => r.url.replace(O + '/app/', ''));
    return {restants, journal, caches: await caches.keys()};
  });
}

const ko = [];
// ══ SCENE 1 : LE CAS NORMAL ════════════════════════════════════════════════
{
  const {restants, journal, caches: restes} = await scene({avecDocument: true});
  const versions = [...new Set(restants.filter(u => /^rc-(core|style)\./.test(u))
    .map(u => Number(u.match(/\.(\d+)\./)[1])))].sort((a, b) => b - a);
  console.log('SCENE 1 — caches semes : v' + VIEUX + ', v' + PRECEDENT + ', v' + BUILD
    + ' (pollue par v' + POLLUANT + ')');
  console.log('  versions d’actifs gardees : ' + versions.join(', '));
  console.log('  entrees restantes : ' + restants.length + ' — ' + restants.join(', '));
  for (const l of journal.filter(l => /actifs perimes|report cache/.test(l))) console.log('  ' + l);
  if (versions.length !== 2) ko.push(versions.length + ' version(s) gardees au lieu de 2 : ' + versions.join(', '));
  if (versions[0] !== Number(BUILD)) ko.push('la version COURANTE (' + BUILD + ') n’est pas gardee');
  if (versions[1] !== PRECEDENT) ko.push('la PRECEDENTE (' + PRECEDENT + ') n’est pas gardee : un onglet ouvert resterait sans code');
  if (restants.some(u => u.indexOf('.' + POLLUANT + '.') >= 0)) ko.push('la version qui polluait le cache neuf n’a pas ete purgee');
  if (restants.some(u => u.indexOf('.' + VIEUX + '.') >= 0)) ko.push('une version de ' + VIEUX + ' a ete reportee');
  // LE REPORT NORMAL NE DOIT PAS AVOIR SOUFFERT : les images et la base
  // alimentaire doivent bien etre passees d'un cache a l'autre.
  // ⚠ SAUF LES IMAGES QUAND LA VERSION LES PURGE VOLONTAIREMENT
  //   (PURGE_EXERCICES = CACHE) : des photos reecrites sous le meme nom ne
  //   doivent PAS etre reportees, sinon l'appareil garderait les anciennes.
  //   Dans ce cas, c'est l'inverse qui est verifie.
  const PURGE_IMAGES = /const PURGE_EXERCICES\s*=\s*CACHE\s*;/.test(SW);
  for (const u of ['icons/icon-192x192.png', 'data/ciqual.json'])
    if (!restants.some(r => r.endsWith(u))) ko.push('le report a perdu ' + u);
  const imageReportee = restants.some(r => r.endsWith('exercices/squat.webp'));
  if (!PURGE_IMAGES && !imageReportee) ko.push('le report a perdu exercices/squat.webp');
  if (PURGE_IMAGES && imageReportee) ko.push('la purge des illustrations est annoncee mais exercices/squat.webp a ete reporte');
  if (restes.length !== 1) ko.push('les anciens caches n’ont pas ete supprimes : ' + restes.join(', '));
}
// ══ SCENE 2 : LE CACHE NEUF EST INUTILISABLE ══════════════════════════════
// Sans document, la purge des anciens caches doit etre REPORTEE : les retirer
// laisserait l'appareil sans rien a servir hors ligne.
{
  const {journal, caches: restes} = await scene({avecDocument: false});
  console.log('\nSCENE 2 — cache neuf sans index.html');
  console.log('  caches restants : ' + restes.length + ' — ' + restes.join(', '));
  if (restes.length < 3) ko.push('les anciens caches ont ete supprimes alors que le neuf est inutilisable');
  if (!journal.some(l => /conserv/.test(l))) ko.push('rien n’est dit sur les anciens caches conserves');
}

// ══ SCENES 3 ET 4 : L'INSTALLATION ET LA COPIE D'index.html (01/10/2026) ══
// Un worker neuf ne retelecharge que ce qui a change : il recopie des anciens
// caches les actifs versionnes de meme nom et les fichiers statiques de moins
// de STATIC_TTL_MS. Le banc compte les appels a fetch.
function mondeReseau(source, reseau) {
  const magasin = new Map(), appels = [];
  class CacheReseau extends FauxCache {
    async add(rq) {
      const r = await faux.fetch(typeof rq === 'string' ? new Request(new URL(rq, O + '/app/').href) : rq);
      if (!r.ok) throw new Error('add : ' + r.status);
      await this.put(rq, r);
    }
  }
  const caches = {
    async open(n) { if (!magasin.has(n)) magasin.set(n, new CacheReseau(n)); return magasin.get(n); },
    async keys() { return [...magasin.keys()]; },
    async delete(n) { return magasin.delete(n); },
    async match(rq) { for (const c of magasin.values()) { const r = await c.match(rq); if (r) return r; } },
  };
  const ecoutes = new Map();
  const self_ = {
    addEventListener: (n, f) => ecoutes.set(n, f), skipWaiting: () => {},
    registration: {update: async () => {}, showNotification: async () => {}, scope: O + '/app/'},
    clients: {claim: () => {}, matchAll: async () => [], openWindow: async () => {}},
    location: {origin: O},
  };
  const faux = {
    self: self_, caches, location: self_.location, clients: self_.clients,
    fetch: async (rq) => { const u = typeof rq === 'string' ? rq : rq.url; appels.push({url: u.replace(O + '/app/', './'), mode: rq.cache}); return reseau(u); },
    indexedDB: {open: () => ({})},
    console: {log: () => {}, warn: () => {}, error: () => {}},
    // Le Request du navigateur resout un chemin relatif sur l'adresse du worker.
    Response, Request: class extends Request { constructor(u, o) { super(typeof u === 'string' ? new URL(u, O + '/app/').href : u, o); } },
    Headers, URL, setTimeout, clearTimeout,
  };
  new Function(...Object.keys(faux), source)(...Object.values(faux));
  return {caches, appels, ecoutes};
}
const page = (texte, statut, type) => new Response(texte, {status: statut || 200,
  headers: {'content-type': type || 'text/html; charset=utf-8', date: new Date().toUTCString()}});
{
  // Un worker « v1001 » : CACHE et les deux actifs renommes, le reste tel quel.
  const src = SW.replace(/const CACHE = 'repcore-v\d+'/, "const CACHE = 'repcore-v1001'")
    .replace(/rc-core\.\d+\.js/g, 'rc-core.1001.js').replace(/rc-style\.\d+\.css/g, 'rc-style.1001.css')
    .replace(/rc-theme\.\d+\.css/g, 'rc-theme.1001.css');
  const ASSETS_SW = new Function(src.slice(src.indexOf('const AVATARS'), src.indexOf('// Une séance en cours interdit')) + '; return ASSETS;')();
  const {caches, appels, ecoutes} = mondeReseau(src, (u) => page('reseau:' + u, 200, /\.html$/.test(u) ? 'text/html' : 'application/octet-stream'));
  // L'ANCIEN CACHE v1000 : rc-core.1001.js (la page vient de le demander a
  // l'ancien worker), toutes les images sauf une, et une image vieille de 40 jours.
  const vieux = await caches.open('repcore-v1000');
  const statiques = ASSETS_SW.filter(a => !/index\.html$/.test(a) && !/rc-(core|style|theme)\./.test(a));
  const absente = statiques[statiques.length - 1], perimee = statiques[statiques.length - 2];
  const jour = 864e5;
  const copie = (date) => new Response('ancien', {status: 200, headers: {date: new Date(date).toUTCString()}});
  await vieux.put('./rc-core.1001.js', copie(Date.now() - 2 * jour));
  await vieux.put('./index.html', page('ancienne page'));
  for (const a of statiques) if (a !== absente) await vieux.put(a, copie(a === perimee ? Date.now() - 40 * jour : Date.now() - 3 * jour));
  let p = null;
  ecoutes.get('install')({waitUntil: q => { p = q; }});
  await p;
  const neuf = await caches.open('repcore-v1001');
  const ranges = (await neuf.keys()).length;
  // rc-theme.1001.css, absent de l'ancien cache comme rc-style : telecharge.
  const attendus = ['./index.html', './rc-style.1001.css', './rc-theme.1001.css', absente, perimee].sort();
  const vus = appels.map(a => a.url).sort();
  console.log('\nSCENE 3 — install de v1001 sur un cache v1000 (' + ASSETS_SW.length + ' entrees d’ASSETS)');
  console.log('  telecharges : ' + vus.join(', '));
  console.log('  ranges dans le cache neuf : ' + ranges + ' / ' + ASSETS_SW.length);
  if (JSON.stringify(vus) !== JSON.stringify(attendus)) ko.push('install : fetch appele pour ' + vus.join(', ') + ' au lieu de ' + attendus.join(', '));
  if (ranges !== ASSETS_SW.length) ko.push('install : ' + ranges + ' entrees rangees au lieu de ' + ASSETS_SW.length);
  const modeIndex = (appels.find(a => a.url === './index.html') || {}).mode;
  if (modeIndex !== 'reload') ko.push('index.html n’est plus demande avec cache:reload (' + modeIndex + ')');
  for (const a of appels.filter(a => a.url !== './index.html'))
    if (a.mode === 'reload') ko.push(a.url + ' demande avec cache:reload : le cache HTTP immutable suffit');
  if ((await (await neuf.match('./rc-core.1001.js')).text()) !== 'ancien') ko.push('rc-core.1001.js n’a pas ete recopie de l’ancien cache');
}
{
  // SCENE 4 : un 503 sur index.html ne remplace pas la copie hors ligne ; une
  // vraie page (200, text/html) la remplace.
  let statut = 503;
  const {caches, ecoutes} = mondeReseau(SW, () => statut === 503 ? page('Service indisponible', 503) : page('page neuve', 200));
  const c = await caches.open('repcore-v' + BUILD);
  await c.put('./index.html', page('page en cache'));
  const naviguer = async () => {
    let p = null;
    ecoutes.get('fetch')({request: new Request(O + '/app/index.html'), respondWith: q => { p = q; }});
    const r = await p;
    await new Promise(res => setTimeout(res, 20));   // la mise en cache est detachee
    return r;
  };
  const r1 = await naviguer();
  const apres503 = await (await c.match('./index.html')).text();
  statut = 200;
  await naviguer();
  const apres200 = await (await c.match('./index.html')).text();
  console.log('\nSCENE 4 — index.html : reponse ' + r1.status + ' → cache « ' + apres503 + ' » ; puis 200 → « ' + apres200 + ' »');
  if (apres503 !== 'page en cache') ko.push('un 503 a remplace la copie hors ligne d’index.html');
  if (apres200 !== 'page neuve') ko.push('une vraie page (200, text/html) n’a pas remplace la copie');
}

if (ko.length) { console.error('\nDEFAUTS :\n  ' + ko.join('\n  ')); process.exit(1); }
console.log('\nLa courante et la precedente, pas plus. Le reste est purge, le report est intact,');
console.log('l’install ne retelecharge que ce qui manque ou a vieilli, un 503 ne remplace pas la page,');
console.log('et un cache neuf inutilisable ne fait pas jeter l’ancien.');
