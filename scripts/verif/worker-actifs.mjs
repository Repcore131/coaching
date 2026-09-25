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
      ['./rc-style.' + PRECEDENT + '.css', 590000], ['./data/ciqual.json', 672000]]);
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

if (ko.length) { console.error('\nDEFAUTS :\n  ' + ko.join('\n  ')); process.exit(1); }
console.log('\nLa courante et la precedente, pas plus. Le reste est purge, le report est intact,');
console.log('et un cache neuf inutilisable ne fait pas jeter l’ancien.');
