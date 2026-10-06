// LE FICHIER SERVI N'EST PAS LE FICHIER DU DEPOT (05/10/2026).
//
//   node scripts/minifier.mjs <dossier de l'app>
//
// Remplace SUR PLACE rc-core.<build>.js et rc-style.<build>.css du dossier
// donne par leur version minifiee : commentaires retires, blancs retires, noms
// internes (variables et parametres locaux) raccourcis. Aucune carte de source
// n'est ecrite. Le depot garde le code lisible et commente : on n'appelle ce
// script que sur une COPIE (le dossier _site d'un deploiement, ou le miroir
// sur lequel la suite de tests est rejouee).
//
// CE QUI NE CHANGE PAS, ET POURQUOI :
//  - les noms de premier niveau (fonctions et constantes globales). rc-core est
//    un script classique : l'interface les appelle par leur nom depuis des
//    attributs onclick et des gabarits HTML. esbuild ne les renomme pas tant
//    qu'on ne lui donne pas de format de module ;
//  - la syntaxe (--minify-syntax n'est PAS demande) : des centaines de tests
//    relisent le texte d'une fonction (String(fn)) et y cherchent une
//    construction ; reecrire `true` en `!0` les ferait mentir.
//
// esbuild est epingle : une version qui change la sortie change le fichier
// servi sans qu'une ligne du depot ait bouge.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ESBUILD = 'esbuild@0.25.10';
const dossier = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(path.join(dossier, 'index.html'))) {
  console.error('usage : node scripts/minifier.mjs <dossier de l app (celui qui porte index.html)>');
  process.exit(2);
}
// GARDE-FOU : jamais sur le depot lui-meme. Le depot est reconnu a tests.js
// accompagne d'un .git au-dessus ; le miroir de test porte tests.js mais pas
// de .git, et _site ne porte ni l'un ni l'autre.
if (fs.existsSync(path.join(dossier, '..', '.git')) && !process.argv.includes('--force')) {
  console.error('Refus : ' + dossier + ' est dans un depot git. On ne minifie qu une copie.');
  process.exit(2);
}
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const esbuild = (args) => execFileSync(npx, ['--yes', ESBUILD, ...args],
  { stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' });

const un = (motif) => {
  const l = fs.readdirSync(dossier).filter((f) => motif.test(f));
  if (l.length !== 1) { console.error('Attendu un seul fichier ' + motif + ', trouve : ' + l.join(', ')); process.exit(1); }
  return path.join(dossier, l[0]);
};
const core = un(/^rc-core\.\d+\.js$/), style = un(/^rc-style\.\d+\.css$/);
const ko = (f) => Math.round(fs.statSync(f).size / 1024);
const bilan = [];

for (const [f, args] of [
  [core, ['--minify-whitespace', '--minify-identifiers']],
  [style, ['--minify']],
]) {
  const avant = ko(f), tmp = f + '.min';
  esbuild([f, ...args, '--charset=utf8', '--legal-comments=none', '--log-level=warning', '--outfile=' + tmp]);
  const sortie = fs.readFileSync(tmp, 'utf8');
  if (/sourceMappingURL/.test(sortie)) { console.error('Une carte de source est annoncee dans ' + f); process.exit(1); }
  if (sortie.length < 100000) { console.error('Sortie trop courte pour ' + f); process.exit(1); }
  fs.renameSync(tmp, f);
  bilan.push(path.basename(f) + ' : ' + avant + ' Ko -> ' + ko(f) + ' Ko');
}
// Le JS minifie doit encore se lire comme un script.
execFileSync(process.execPath, ['--check', core], { stdio: 'inherit' });
if (fs.readdirSync(dossier).some((f) => /\.map$/.test(f))) { console.error('Une carte de source traine dans ' + dossier); process.exit(1); }
console.log('Minifie. ' + bilan.join(' ; '));
