#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════
//  DECOUPER rc-core EN MORCEAUX — src/core/NNN-titre.js (01/10/2026)
// ══════════════════════════════════════════════════════════════════════════
//
// POURQUOI. app/rc-core.<build>.js fait 130 000 lignes d'un seul tenant, en
// portee globale (script classique : des centaines de onclick="…" et de
// chaines innerHTML appellent ses fonctions par leur nom). Ce script le coupe
// en fichiers de 1 000 a 4 000 lignes, SANS CHANGER UN OCTET du code produit :
// scripts/assembler_core.mjs les recolle, et assembler(decouper(f)) === f.
// C'est l'etape (a) de src/core/LISEZMOI.md.
//
// OU IL COUPE. Seulement sur une ligne de bandeau de section, en colonne 0 :
//     // ══ TITRE ═══…   (ou // ══════ TITRE ═══…)
// et seulement si ce bandeau tombe ENTRE deux instructions de niveau racine :
// l'AST (acorn) dit ou finit chaque noeud du Program, et un bandeau qui
// tomberait dans un noeud (un commentaire a l'interieur d'un objet de
// premier niveau, par exemple) n'est pas une frontiere. Chaque morceau finit
// donc sur la fin d'un noeud du Program (suivie, au plus, de commentaires et
// de blancs), et le script le reverifie avant d'ecrire.
//
// COMMENT IL CHOISIT. Parmi les bandeaux admissibles, le jeu de coupes dont
// les morceaux s'ecartent le moins de CIBLE lignes, tous entre 1 000 et 4 000
// (programmation dynamique, plus bas). Le nom du fichier vient du titre du premier bandeau du
// morceau (ou « debut » pour le premier).
//
// FORMAT D'UN MORCEAU. Le texte d'origine, de sa premiere ligne a la fin de
// sa derniere ligne, saut de ligne final compris. assembler_core.mjs retire ce
// saut final de chaque morceau et les joint par un saut de ligne, puis en
// remet un a la fin : le resultat est le fichier d'origine.
//
// Usage :
//   node scripts/decouper_core.mjs            refuse si src/core/ contient deja des .js
//   node scripts/decouper_core.mjs --forcer   efface les .js de src/core/ et recoupe
//   node scripts/decouper_core.mjs --garder-coupes
//       recoupe rc-core AUX MEMES FRONTIERES et sous les MEMES NOMS que les
//       morceaux existants : chaque morceau recommence a sa premiere ligne
//       actuelle, retrouvee dans rc-core. Sert a reporter dans src/core/ une
//       modification faite sur rc-core (la fusion d'une branche qui ne connait
//       pas encore src/core/, par exemple), sans renumeroter.
// acorn est installe a la demande dans un dossier temporaire (comme ESLint
// pour scripts/verif/lint.mjs) : rien dans le depot.
import {readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, unlinkSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {assembler, fichierCore, SRC} from './assembler_core.mjs';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const MIN = 1000, MAX = 4000, CIBLE = 2400;
const BANDEAU = /^\/\/ ═{2,}[^\n]*?[A-Za-z0-9À-ÿ][^\n]*?═{2,}\s*$/;
// Le sous-bandeau « // ── TITRE ──── », en colonne 0 lui aussi : une coupe DE
// SECOURS, prise seulement quand aucun jeu de bandeaux ═ ne tient dans
// [MIN, MAX] (l'analyse morpho-anatomique : 4 883 lignes sans un seul ═).
const SOUS_BANDEAU = /^\/\/ ─{2,}[^\n]*?[A-Za-z0-9À-ÿ][^\n]*?─{2,}\s*$/;

// ── acorn, hors du depot ──────────────────────────────────────────────────
const outils = join(tmpdir(), 'repcore-acorn');
if (!existsSync(join(outils, 'node_modules', 'acorn'))) {
  mkdirSync(outils, {recursive: true});
  execSync('npm install --silent --no-audit --no-fund --prefix ' + JSON.stringify(outils) + ' acorn@8', {stdio: 'inherit'});
}
const acorn = createRequire(join(outils, 'node_modules', '/'))('acorn');

const fichier = fichierCore();
const texte = readFileSync(fichier, 'utf8');
if (texte.includes('\r')) { console.error(fichier + ' contient des CR : attendu en LF.'); process.exit(1); }
if (!texte.endsWith('\n')) { console.error(fichier + ' ne finit pas par un saut de ligne.'); process.exit(1); }

const dejaLa = existsSync(SRC) ? readdirSync(SRC).filter((f) => f.endsWith('.js')) : [];
const GARDER = process.argv.includes('--garder-coupes');
if (dejaLa.length && !process.argv.includes('--forcer') && !GARDER) {
  console.error('src/core/ contient deja ' + dejaLa.length + ' morceau(x). Les modifications se font LA, pas dans '
    + fichier.replace(RACINE + '/', '') + '. Pour tout recouper depuis rc-core : --forcer.');
  process.exit(1);
}

// ── L'AST : ou finit chaque instruction de niveau racine ──────────────────
const prog = acorn.parse(texte, {ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true});
const noeuds = prog.body.map((n) => [n.start, n.end]);
// Un decalage est-il a l'interieur d'un noeud racine ? (recherche dichotomique)
const dansUnNoeud = (pos) => {
  let a = 0, b = noeuds.length - 1;
  while (a <= b) {
    const m = (a + b) >> 1;
    if (noeuds[m][1] <= pos) a = m + 1;
    else if (noeuds[m][0] > pos) b = m - 1;
    else return pos > noeuds[m][0];
  }
  return false;
};

// ── LES LIGNES, ET LES BANDEAUX ADMISSIBLES ──────────────────────────────
const debuts = [0];
for (let i = 0; i < texte.length; i++) if (texte[i] === '\n' && i + 1 < texte.length) debuts.push(i + 1);
const nLignes = debuts.length;
const ligneTexte = (l) => texte.slice(debuts[l], l + 1 < nLignes ? debuts[l + 1] - 1 : texte.length - 1);
const candidats = [];   // numeros de ligne (0-indexes) ou un morceau peut commencer
const secours = new Set();
let nBandeaux = 0;
for (let l = 1; l < nLignes; l++) {
  const t = ligneTexte(l);
  const principal = BANDEAU.test(t);
  if (principal) nBandeaux++;
  if (!principal && !SOUS_BANDEAU.test(t)) continue;
  if (dansUnNoeud(debuts[l])) continue;
  candidats.push(l);
  if (!principal) secours.add(l);
}

// ── LE CHOIX DES COUPES ───────────────────────────────────────────────────
// Programmation dynamique sur les bandeaux admissibles : chaque morceau coute
// (lignes - CIBLE)², et un morceau hors de [MIN, MAX] coute en plus une
// penalite qui l'ecarte des qu'une autre solution existe. Un glouton se
// laissait enfermer : un bandeau pris trop tot pouvait ne laisser, plus loin,
// qu'un morceau de 5 000 lignes.
const pts = [0, ...candidats, nLignes];
// Une coupe de secours coute 1e10 : plus que tout ecart a CIBLE, moins qu'un
// morceau hors de [MIN, MAX].
const cout = (n) => (n - CIBLE) ** 2 + (n < MIN || n > MAX ? 1e12 + Math.abs(n < MIN ? MIN - n : n - MAX) * 1e9 : 0);
const meilleur = new Array(pts.length).fill(Infinity), prec = new Array(pts.length).fill(-1);
meilleur[0] = 0;
for (let j = 1; j < pts.length; j++) {
  for (let i = j - 1; i >= 0; i--) {
    const n = pts[j] - pts[i];
    if (n > 3 * MAX && i < j - 1) break;   // au-dela, jamais meilleur qu'une coupe plus proche
    const c = meilleur[i] + cout(n) + (secours.has(pts[j]) ? 1e10 : 0);
    if (c < meilleur[j]) { meilleur[j] = c; prec[j] = i; }
  }
}
const coupes = [];
for (let j = prec[pts.length - 1]; j > 0; j = prec[j]) coupes.unshift(pts[j]);
coupes.unshift(0);
const ecarts = [];
coupes.forEach((c, i) => {
  const n = (i + 1 < coupes.length ? coupes[i + 1] : nLignes) - c;
  if (n < MIN || n > MAX) ecarts.push('morceau de ' + n + ' lignes a partir de la ligne ' + (c + 1) + ' (hors de ' + MIN + '-' + MAX + ')');
});

// ── --garder-coupes : LES FRONTIERES ET LES NOMS DES MORCEAUX EXISTANTS ───
let nomsGardes = null;
if (GARDER) {
  const anciens = dejaLa.filter((f) => /^\d{3}-.*\.js$/.test(f)).sort();
  if (!anciens.length) { console.error('--garder-coupes : aucun morceau dans src/core/.'); process.exit(1); }
  const admis = new Set(candidats);
  const garde = [0];
  for (const f of anciens.slice(1)) {
    const premiere = readFileSync(join(SRC, f), 'utf8').split('\n')[0];
    let l = garde[garde.length - 1] + 1;
    while (l < nLignes && !(ligneTexte(l) === premiere && admis.has(l))) l++;
    if (l >= nLignes) { console.error('--garder-coupes : la premiere ligne de ' + f + ' est introuvable apres la coupe precedente :\n  ' + premiere); process.exit(1); }
    garde.push(l);
  }
  coupes.length = 0; coupes.push(...garde);
  ecarts.length = 0;
  nomsGardes = anciens;
}

// ── LA PREUVE : CHAQUE COUPE TOMBE ENTRE DEUX NOEUDS DU PROGRAM ───────────
for (const c of coupes.slice(1)) {
  const pos = debuts[c] - 1;  // le saut de ligne qui precede le bandeau
  const avant = noeuds.filter((n) => n[1] <= pos);
  const fin = avant.length ? avant[avant.length - 1][1] : 0;
  const entre = texte.slice(fin, pos);
  // Entre la fin du dernier noeud et la coupe : des blancs et des commentaires seulement.
  const reste = entre.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').trim();
  if (dansUnNoeud(debuts[c]) || reste) { console.error('coupe invalide a la ligne ' + (c + 1)); process.exit(1); }
}

// ── LES NOMS ──────────────────────────────────────────────────────────────
const slug = (l) => {
  const t = ligneTexte(l).replace(/^\/\/\s*/, '').replace(/═/g, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  // Au plus 48 caracteres, coupes a la fin d'un mot.
  const c = t.length <= 48 ? t : (t.slice(0, 49).replace(/-[^-]*$/, '') || t.slice(0, 48));
  return c.replace(/-+$/, '') || 'section';
};
const morceaux = coupes.map((c, i) => {
  const fin = i + 1 < coupes.length ? debuts[coupes[i + 1]] : texte.length;
  const nom = nomsGardes ? nomsGardes[i] : String(i + 1).padStart(3, '0') + '-' + (i === 0 ? 'debut' : slug(c)) + '.js';
  return {nom, texte: texte.slice(debuts[c], fin), lignes: (i + 1 < coupes.length ? coupes[i + 1] : nLignes) - c};
});

// ── ECRITURE, PUIS LA GARANTIE ────────────────────────────────────────────
mkdirSync(SRC, {recursive: true});
for (const f of dejaLa) unlinkSync(join(SRC, f));
for (const m of morceaux) writeFileSync(join(SRC, m.nom), m.texte);
if (assembler() !== texte) { console.error('ECHEC : assembler(decouper(f)) differe de f.'); process.exit(1); }

const tailles = morceaux.map((m) => m.lignes);
const nSecours = coupes.filter((c) => secours.has(c)).length;
console.log(morceaux.length + ' morceaux dans src/core/ ; ' + nBandeaux + ' bandeaux ═ (' + (candidats.length - secours.size)
  + ' entre deux instructions racine), ' + nSecours + ' coupe(s) de secours sur un sous-bandeau ── ; lignes : min '
  + Math.min(...tailles) + ', max ' + Math.max(...tailles) + ', total ' + nLignes + '.');
for (const e of ecarts) console.log('  ⚠ ' + e);
console.log('assembler(decouper(' + fichier.replace(RACINE + '/', '') + ')) === original, octet pour octet.');
