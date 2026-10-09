#!/usr/bin/env node
// LA REGLE D'ORDRE DE src/core/ (LISEZMOI.md) : un morceau ne peut utiliser A
// SON NIVEAU RACINE — ce qui s'execute au chargement, hors des corps de
// fonction — que des declarations de morceaux de numero inferieur (ou du sien).
//
// POURQUOI ELLE COMPTE DEJA. Tant que les morceaux sont recolles en un seul
// script, une `function` declaree plus loin est HISSEE : l'appeler plus haut
// marche. Le jour ou un morceau part dans son propre <script> (etape (c) :
// rc-coach.<build>.js), ce qui marchait par hissage casse. Et une `const` ou une
// `let` lue avant sa ligne casse deja aujourd'hui (zone morte temporelle).
//
// CE QU'IL FAIT : pour chaque morceau, il parcourt les instructions racine avec
// acorn, sans entrer dans les corps de fonction (sauf une fonction appelee sur
// place, (function(){…})() ou (()=>{…})(), qui s'execute au chargement), et
// releve chaque identifiant lu qui designe une declaration racine d'un morceau
// de numero SUPERIEUR. Les noms masques par une declaration locale du meme
// bloc ne sont pas suivis finement : c'est une approximation qui peut signaler
// en trop, jamais en moins pour un nom racine lu directement.
//
// Usage : node scripts/verif/ordre-core.mjs [--strict]
//   sans --strict : rapporte et sort en 0 ; avec : sort en 1 s'il y a un ecart.
import {readFileSync, readdirSync, existsSync, mkdirSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execSync} from 'node:child_process';
import {createRequire} from 'node:module';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const SRC = join(RACINE, 'src', 'core');
const outils = join(tmpdir(), 'repcore-acorn');
if (!existsSync(join(outils, 'node_modules', 'acorn'))) {
  mkdirSync(outils, {recursive: true});
  execSync('npm install --silent --no-audit --no-fund --prefix ' + JSON.stringify(outils) + ' acorn@8', {stdio: 'inherit'});
}
const acorn = createRequire(join(outils, 'node_modules', '/'))('acorn');

const fichiers = readdirSync(SRC).filter((f) => /^\d{3}-.*\.js$/.test(f)).sort();
// Les morceaux se parsent un par un : une coupe tombe toujours entre deux
// instructions racine (decouper_core.mjs), donc chacun est un programme valide.
const progs = fichiers.map((f) => acorn.parse(readFileSync(join(SRC, f), 'utf8'), {ecmaVersion: 'latest', sourceType: 'script', locations: true}));

// ── OU EST DECLARE CHAQUE NOM RACINE ──────────────────────────────────────
const noms = (p, out) => {
  if (!p) return;
  if (p.type === 'Identifier') out.push(p.name);
  else if (p.type === 'ObjectPattern') p.properties.forEach((x) => noms(x.type === 'RestElement' ? x.argument : x.value, out));
  else if (p.type === 'ArrayPattern') p.elements.forEach((x) => noms(x, out));
  else if (p.type === 'RestElement') noms(p.argument, out);
  else if (p.type === 'AssignmentPattern') noms(p.left, out);
};
const declare = new Map();   // nom -> {i, genre}
progs.forEach((prog, i) => {
  for (const n of prog.body) {
    const l = [];
    if (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') l.push([n.id.name, n.type === 'FunctionDeclaration' ? 'function' : 'class']);
    else if (n.type === 'VariableDeclaration') { const t = []; n.declarations.forEach((d) => noms(d.id, t)); t.forEach((x) => l.push([x, n.kind])); }
    for (const [nom, genre] of l) if (!declare.has(nom)) declare.set(nom, {i, genre});
  }
});

// ── CE QUI EST LU AU CHARGEMENT ───────────────────────────────────────────
const FONCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
function lus(noeud, out) {
  const visiter = (n, parent, cle) => {
    if (!n || typeof n.type !== 'string') return;
    if (FONCTIONS.has(n.type)) {
      // Appelee sur place : son corps s'execute maintenant.
      if (parent && (parent.type === 'CallExpression' || parent.type === 'NewExpression') && cle === 'callee') visiter(n.body, n, 'body');
      return;
    }
    if (n.type === 'ClassDeclaration' || n.type === 'ClassExpression') { if (n.superClass) visiter(n.superClass, n, 'superClass'); return; }
    if (n.type === 'Identifier') {
      // Pas un nom de propriete (o.x, {x: …}), pas un libelle.
      if (parent && parent.type === 'MemberExpression' && cle === 'property' && !parent.computed) return;
      if (parent && (parent.type === 'Property' || parent.type === 'PropertyDefinition' || parent.type === 'MethodDefinition') && cle === 'key' && !parent.computed) return;
      if (parent && /Statement$/.test(parent.type) && cle === 'label') return;
      out.push(n);
      return;
    }
    for (const k of Object.keys(n)) {
      if (k === 'type' || k === 'loc' || k === 'start' || k === 'end') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((x) => visiter(x, n, k));
      else if (v && typeof v.type === 'string') visiter(v, n, k);
    }
  };
  visiter(noeud, null, null);
}

const ecarts = [];
progs.forEach((prog, i) => {
  for (const n of prog.body) {
    if (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration' && !n.superClass) continue;
    const out = [];
    if (n.type === 'VariableDeclaration') n.declarations.forEach((d) => d.init && lus(d.init, out));
    else lus(n, out);
    for (const id of out) {
      const d = declare.get(id.name);
      if (d && d.i > i) ecarts.push({de: fichiers[i] + ':' + id.loc.start.line, nom: id.name, vers: fichiers[d.i], genre: d.genre});
    }
  }
});

for (const e of ecarts) console.log(e.de + '  lit ' + e.nom + ' (' + e.genre + ', ' + e.vers + ')');
const parGenre = {};
for (const e of ecarts) parGenre[e.genre] = (parGenre[e.genre] || 0) + 1;
console.log('\n' + fichiers.length + ' morceaux, ' + declare.size + ' noms racine : ' + ecarts.length + ' lecture(s) au chargement d\'un nom declare plus loin'
  + (ecarts.length ? ' — ' + Object.entries(parGenre).map(([k, v]) => k + ' ' + v).join(', ') : '') + '.');
process.exit(ecarts.length && process.argv.includes('--strict') ? 1 : 0);
