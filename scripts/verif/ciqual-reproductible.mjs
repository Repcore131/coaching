// LA BASE D'ALIMENTS SE REGÉNÈRE À L'IDENTIQUE (BUILD 1854).
//
// scripts/ciqual_convert.py --depuis-json relit app/data/ciqual.json, les alias,
// les références et scripts/repcore_generiques.csv, et réécrit la base. Ce banc
// le lance DEUX fois et compare, octet pour octet :
//   1. la base commitée et celle de la première passe — sinon quelqu'un a
//      modifié un CSV ou un TSV sans régénérer ;
//   2. la première et la seconde passe — sinon la sortie dépend d'autre chose
//      que de l'entrée (ordre d'un ensemble, date du jour…) ;
//   3. app/data/ciqual.version et CIQUAL_VERSION de app/sw.js — sinon les
//      appareils déjà installés gardent l'ancienne base.
// Usage : node scripts/verif/ciqual-reproductible.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = join(RACINE, 'app', 'data', 'ciqual.json');
const VERSION = join(RACINE, 'app', 'data', 'ciqual.version');
const empreinte = () => createHash('sha256').update(readFileSync(BASE)).digest('hex');
const passe = () => execFileSync('python3', [join(RACINE, 'scripts', 'ciqual_convert.py'), '--depuis-json'], { encoding: 'utf8' });

let ko = 0;
const echec = m => { ko++; console.error('✗ ' + m); };
const h0 = empreinte();
passe();
const h1 = empreinte();
passe();
const h2 = empreinte();
if (h0 !== h1) echec('la base commitée diffère de sa régénération : relancer python3 scripts/ciqual_convert.py --depuis-json et commiter');
if (h1 !== h2) echec('deux passes successives ne donnent pas le même fichier');
const v = readFileSync(VERSION, 'utf8').trim();
const sw = readFileSync(join(RACINE, 'app', 'sw.js'), 'utf8');
const vsw = (sw.match(/const CIQUAL_VERSION = '([^']+)'/) || [])[1];
if (v !== vsw) echec(`app/data/ciqual.version (${v}) ≠ CIQUAL_VERSION de sw.js (${vsw})`);
if (ko) process.exit(1);
console.log('ciqual.json reproductible (' + h2.slice(0, 12) + '), version ' + v);
