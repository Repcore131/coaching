// LA SUITE DE TESTS SUR LE FICHIER SERVI, PAS SEULEMENT SUR L'ORIGINAL (05/10/2026).
//
//   node scripts/miroir_minifie.mjs <dossier du miroir>
//
// Recopie le depot (sans .git ni les dossiers lourds que la suite ne lit pas)
// dans un dossier a part, puis y minifie rc-core et rc-style exactement comme
// le fait la mise en ligne (scripts/minifier.mjs). Le miroir GARDE tests.js :
// on y lance la suite navigateur, et elle juge donc le code que les
// utilisateurs recoivent reellement.
//
//   node scripts/miroir_minifie.mjs /tmp/miroir
//   node <banc>/suite.mjs /tmp/miroir 4361 9991 sortie.json
import { execFileSync, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cible = process.argv[2];
if (!cible) { console.error('usage : node scripts/miroir_minifie.mjs <dossier du miroir>'); process.exit(2); }
const OUT = path.resolve(cible);
if (OUT === RACINE || RACINE.startsWith(OUT + path.sep) || OUT.startsWith(RACINE + path.sep)) {
  console.error('Refus : le miroir doit vivre HORS du depot.'); process.exit(2);
}
// On ne vide qu'un dossier qui est deja un miroir (il porte notre marque), ou qui n'existe pas.
const MARQUE = path.join(OUT, '.miroir-minifie');
if (fs.existsSync(OUT) && fs.readdirSync(OUT).length && !fs.existsSync(MARQUE)) {
  console.error('Refus : ' + OUT + ' existe et n est pas un miroir.'); process.exit(2);
}
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(MARQUE, new Date().toISOString());
const HORS = new Set(['.git', 'node_modules', '_site', '_pages', 'rangs-bruts', 'badges-bruts', 'android']);
for (const e of fs.readdirSync(RACINE)) {
  if (HORS.has(e)) continue;
  fs.cpSync(path.join(RACINE, e), path.join(OUT, e), { recursive: true });
}
// ── LE TEXTE D'ORIGINE, POUR LES TESTS QUI RELISENT LE CODE ────────────────
//
// Des centaines d'assertions ne jugent pas un comportement mais le TEXTE d'une
// fonction (String(fn)) ou du fichier : « le garde est toujours la », « ce
// commentaire n'a pas disparu ». Sur un fichier minifie ce texte n'existe
// plus, et ces assertions n'auraient plus de sens. Le miroir garde donc, a
// cote du code minifie qui S'EXECUTE :
//   app/_origine/rc-core.js, rc-style.css : les deux fichiers d'origine ;
//   app/_origine/fonctions.json : le texte d'origine de chaque fonction de
//     premier niveau (et des methodes des objets de premier niveau), par nom.
// Le haut de tests.js les lit quand ils existent : String(fn) rend alors le
// texte d'origine, et une lecture du fichier rend le fichier d'origine. Rien
// de cela n'est mis en ligne (fabriquer_site.mjs ne passe pas par ici).
const APP = path.join(OUT, 'app');
const coreF = fs.readdirSync(APP).find((f) => /^rc-core\.\d+\.js$/.test(f));
const styleF = fs.readdirSync(APP).find((f) => /^rc-style\.\d+\.css$/.test(f));
const ORI = path.join(APP, '_origine');
fs.mkdirSync(ORI, { recursive: true });
fs.copyFileSync(path.join(APP, coreF), path.join(ORI, 'rc-core.js'));
fs.copyFileSync(path.join(APP, styleF), path.join(ORI, 'rc-style.css'));
{
  const outils = path.join(OUT, '.outils');
  fs.mkdirSync(outils, { recursive: true });
  fs.writeFileSync(path.join(outils, 'package.json'), '{"private":true}');
  execSync('npm install --no-audit --no-fund --silent acorn@8.14.0', { cwd: outils, stdio: 'inherit' });
  const acorn = createRequire(path.join(outils, 'package.json'))('acorn');
  const src = fs.readFileSync(path.join(ORI, 'rc-core.js'), 'utf8');
  const arbre = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' });
  const table = {};
  const texte = (n) => src.slice(n.start, n.end);
  const estFn = (n) => n && (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression');
  // Une valeur de premier niveau, parcourue en profondeur : objets, tableaux,
  // et ce qu'enveloppe Object.freeze(…). Chaque fonction trouvee est rangee
  // sous l'EXPRESSION qui la designe (`DB.get`, `DEB_STEPS[2]`,
  // `PP_COLS[4].v`) : tests.js l'evalue pour retrouver la fonction elle-meme.
  const valeur = (chemin, v, prof) => {
    if (!v || prof > 6) return;
    if (v.type === 'CallExpression' && v.arguments.length === 1) return valeur(chemin, v.arguments[0], prof + 1);
    if (estFn(v)) { table[chemin] = texte(v); return; }
    if (v.type === 'ArrayExpression') { v.elements.forEach((e, k) => valeur(chemin + '[' + k + ']', e, prof + 1)); return; }
    if (v.type !== 'ObjectExpression') return;
    for (const p of v.properties) {
      if (p.type !== 'Property' || p.computed) continue;
      const cle = p.key.type === 'Identifier' ? p.key.name : (p.key.type === 'Literal' ? String(p.key.value) : null);
      if (cle == null) continue;
      const acces = /^[A-Za-z_$][\w$]*$/.test(cle) ? chemin + '.' + cle : chemin + '[' + JSON.stringify(cle) + ']';
      // Une methode abregee `nom(){…}` se lit, par String(), depuis sa cle.
      if (estFn(p.value) && (p.method || p.kind !== 'init')) table[acces] = texte(p);
      else valeur(acces, p.value, prof + 1);
    }
  };
  for (const n of arbre.body) {
    if (n.type === 'FunctionDeclaration' && n.id) table[n.id.name] = texte(n);
    else if (n.type === 'VariableDeclaration') for (const d of n.declarations) {
      if (d.id.type === 'Identifier' && d.init) valeur(d.id.name, d.init, 0);
    }
  }
  fs.writeFileSync(path.join(ORI, 'fonctions.json'), JSON.stringify(table));
  fs.rmSync(outils, { recursive: true, force: true });
  console.log('Texte d origine garde pour ' + Object.keys(table).length + ' fonctions.');
}
execFileSync(process.execPath, [path.join(RACINE, 'scripts', 'minifier.mjs'), APP], { stdio: 'inherit' });
console.log('Miroir minifie pret : ' + OUT);
