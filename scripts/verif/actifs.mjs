#!/usr/bin/env node
// LES ACTIFS VERSIONNES EXISTENT-ILS, ET SOUS LE BON NUMERO ?
//
// POURQUOI CE GARDE-FOU. Depuis le build 1417, app/index.html ne porte plus le
// code : il le DEMANDE, par un nom qui contient le numero de build
// (rc-core.<build>.js, rc-style.<build>.css), et l'hebergement sert ces deux
// fichiers `immutable` pour un an. Deux facons de tout casser, toutes deux
// silencieuses a la lecture du diff :
//
//   • livrer index.html en oubliant de renommer ou d'ajouter l'actif : la page
//     s'ouvre, demande un fichier absent, prend un 404 — et il ne reste RIEN a
//     l'ecran. Pas un ecran degrade : un ecran blanc, pour tout le monde ;
//   • laisser une ancienne version dans le depot : 5,5 Mo par livraison
//     abandonnee, que plus aucune page ne demande.
//
// Et un troisieme, plus vicieux : un nom qui ne suit pas RC_BUILD. L'en-tete
// `immutable` fait confiance au NOM. Servir un contenu neuf sous un nom deja
// vu, c'est figer l'app pour un an chez qui l'a ouverte une fois.
//
// Usage : node scripts/verif/actifs.mjs [racine]      (defaut : le depot)
import {readFileSync, existsSync, readdirSync, statSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';

const ICI = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const RACINE = resolve(process.argv[2] || resolve(ICI, '..', '..'));
const APP = join(RACINE, 'app');
const ko = [];

const html = readFileSync(join(APP, 'index.html'), 'utf8');
const build = (html.match(/window\.RC_BUILD\s*=\s*'(\d+)'/) || [])[1];
if (!build) { console.error('RC_BUILD introuvable dans app/index.html'); process.exit(1); }

// Le worker doit annoncer le meme numero, sinon l'appareil garde l'ancien tout.
const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
const cache = (sw.match(/const CACHE = 'repcore-v(\d+)'/) || [])[1];
if (cache !== build) ko.push('sw.js annonce repcore-v' + cache + ' et la page RC_BUILD=' + build);

// ── CE QUE LA PAGE DEMANDE ────────────────────────────────────────────────
const demandes = [...html.matchAll(/(?:src|href)="\.\/(rc-(?:core|style)\.\d+\.(?:js|css))"/g)].map(m => m[1]);
if (demandes.length !== 2)
  ko.push(demandes.length + ' actif(s) versionne(s) demande(s) par la page au lieu de 2 : ' + demandes.join(', '));
for (const n of demandes) {
  if (!existsSync(join(APP, n))) ko.push(n + ' est demande par la page et ABSENT du depot');
  const v = n.match(/\.(\d+)\./)[1];
  if (v !== build) ko.push(n + ' ne porte pas le build courant (' + build + ')');
}

// ── CE QUE LE WORKER MET HORS LIGNE ───────────────────────────────────────
for (const n of demandes)
  if (sw.indexOf("'./" + n + "'") < 0) ko.push(n + ' manque a ASSETS du worker : il ne serait pas hors ligne');

// ── CE QUI TRAINE ─────────────────────────────────────────────────────────
const presents = readdirSync(APP).filter(n => /^rc-(core|style)\.\d+\.(js|css)$/.test(n));
for (const n of presents)
  if (!demandes.includes(n))
    ko.push(n + ' traine dans le depot (' + Math.round(statSync(join(APP, n)).size / 1024) + ' Ko) : plus aucune page ne le demande');

// ── ET LA PAGE RESTE LEGERE ───────────────────────────────────────────────
// C'est la mesure du lot : 6,6 Mo de page servie en no-cache a chaque
// ouverture, contre 434 Ko. Un gros bloc revenu en ligne annulerait tout.
const gros = [...html.matchAll(/<(style|script)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)]
  .filter(m => m[2].length > 50000).map(m => m[1] + ' de ' + m[2].length + ' o');
if (gros.length) ko.push('bloc(s) en ligne trop lourd(s) dans index.html : ' + gros.join(', '));

const o = n => Math.round(statSync(join(APP, n)).size / 1024) + ' Ko';
console.log('build ' + build + ' — index.html ' + o('index.html')
  + ', ' + demandes.map(n => n + ' ' + o(n)).join(', '));
if (ko.length) { console.error('\nDEFAUTS :\n  ' + ko.join('\n  ')); process.exit(1); }
console.log('La page demande deux actifs, ils existent, ils portent le build, et rien ne traine.');
