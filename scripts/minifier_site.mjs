#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════
//  LA COPIE PUBLIÉE EST MINIFIÉE, LE DÉPÔT JAMAIS (01/10/2026)
// ══════════════════════════════════════════════════════════════════════════
//
// POURQUOI. app/rc-core.<build>.js pèse 7,2 Mo, dont un bon tiers de
// commentaires, et app/rc-style.<build>.css 1,6 Mo. Chaque athlète les
// télécharge, et le quota Hosting du plan Spark est de 360 Mo par jour.
//
// POURQUOI SEULEMENT _site. app/tests.js et assertNoCycleRuleAltersSeries
// (rc-core) lisent le SOURCE des fonctions avec String(fn) : les fichiers du
// dépôt restent tels quels. Ce script ne touche qu'à la copie assemblée par
// scripts/assembler_site.sh, juste avant l'envoi.
//
// CE QU'IL FAIT, EN PLACE, dans <dossier>/app :
//   · rc-core.*.js et motion-lab.js : esbuild --minify-whitespace
//     --minify-syntax --target=es2020 --legal-comments=none --charset=utf8
//     (sans lui, chaque « é » devient « \u00E9 » : +43 Ko sur rc-core). JAMAIS
//     --minify-identifiers : les noms globaux sont appelés depuis des
//     onclick="…" et des chaînes innerHTML ;
//   · rc-style.*.css et rc-theme.*.css : esbuild --minify (chargeur CSS, par l'extension) ;
//   · index.html : les commentaires HTML <!-- … --> hors <script>/<style>
//     (sauf les conditionnels <!--[ ) ; dans les <script> en ligne, les lignes
//     qui ne sont qu'un commentaire // — SEULEMENT si le bloc minifié par
//     esbuild est identique avant et après (une ligne « // » dans une chaîne
//     sur plusieurs lignes changerait la chaîne : le bloc est alors laissé tel quel).
// Puis il affiche avant/après (octets, gzip, brotli) et ÉCHOUE (exit 1) si un
// fichier minifié ne se parse plus (new Function, comme scripts/verif/syntaxe.mjs).
//
// Usage : node scripts/minifier_site.mjs [_site]
//   ESBUILD="npx -y esbuild@0.25" par défaut (aucune dépendance dans le dépôt).
import {readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execSync} from 'node:child_process';
import {gzipSync, brotliCompressSync, constants as Z} from 'node:zlib';

const SITE = process.argv[2] || '_site';
const APP = join(SITE, 'app');
const ESBUILD = process.env.ESBUILD || 'npx -y esbuild@0.25';
if (!existsSync(join(APP, 'index.html'))) { console.error('Rien à minifier : ' + APP + '/index.html absent.'); process.exit(1); }
const TMP = mkdtempSync(join(tmpdir(), 'minif-'));
const q = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
const esbuild = (args, entree) => {
  try {
    return execSync(ESBUILD + ' ' + args.map(q).join(' '),
      {input: entree, maxBuffer: 64 * 1024 * 1024, stdio: [entree == null ? 'ignore' : 'pipe', 'pipe', 'pipe']}).toString();
  } catch (e) {
    const err = new Error('esbuild : ' + String((e.stderr || '') + (e.message || '')).trim().split('\n')[0]);
    err.esbuild = true;
    throw err;
  }
};

const mesure = (b) => ({brut: b.length, gzip: gzipSync(b, {level: 9}).length,
  brotli: brotliCompressSync(b, {params: {[Z.BROTLI_PARAM_QUALITY]: 11, [Z.BROTLI_PARAM_SIZE_HINT]: b.length}}).length});
const ko = (n) => (n / 1024).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ko';
const lignes = [];
const erreurs = [];
const parse = (nom, code) => { try { new Function(code); } catch (e) { erreurs.push(nom + ' ne se parse plus : ' + e.message); } };

function traiter(nom, fn) {
  const chemin = join(APP, nom);
  const avant = readFileSync(chemin);
  let apres;
  // Une erreur d'esbuild : le fichier reste tel quel, et le script échoue à la fin.
  try { apres = Buffer.from(fn(avant.toString('utf8'), chemin)); } catch (e) { erreurs.push(nom + ' : ' + e.message); return; }
  writeFileSync(chemin, apres);
  lignes.push([nom, mesure(avant), mesure(apres)]);
}

const fichiers = readdirSync(APP);
const JS = fichiers.filter((f) => /^rc-core\.\d+\.js$/.test(f) || f === 'motion-lab.js');
// rc-theme : le theme clair, sorti de rc-style le 01/10/2026 (scripts/extraire_theme_clair.py).
const CSS = fichiers.filter((f) => /^rc-(style|theme)\.\d+\.css$/.test(f));
if (!JS.some((f) => f.startsWith('rc-core.'))) erreurs.push('aucun rc-core.<build>.js dans ' + APP);
if (!CSS.length) erreurs.push('aucun rc-style.<build>.css dans ' + APP);

// ── LE JAVASCRIPT ─────────────────────────────────────────────────────────
for (const f of JS) traiter(f, (src, chemin) => {
  const sortie = join(TMP, f);
  esbuild([chemin, '--minify-whitespace', '--minify-syntax', '--target=es2020', '--legal-comments=none', '--charset=utf8', '--log-level=error', '--outfile=' + sortie]);
  const code = readFileSync(sortie, 'utf8');
  parse(f, code);
  return code;
});

// ── LES FEUILLES DE STYLE ─────────────────────────────────────────────────
for (const f of CSS) traiter(f, (src, chemin) => {
  const sortie = join(TMP, f);
  // Le chargeur CSS vient de l'extension (--loader=css ne vaut que sur stdin).
  esbuild([chemin, '--minify', '--log-level=error', '--outfile=' + sortie]);
  const css = readFileSync(sortie, 'utf8');
  if (css.length < src.length / 4) erreurs.push(f + ' : la feuille minifiée est suspecte (' + css.length + ' octets)');
  return css;
});

// ── index.html ────────────────────────────────────────────────────────────
let blocsNettoyes = 0, blocsLaisses = 0;
traiter('index.html', (html) => {
  // Les blocs <script> et <style> sont mis de côté : un « <!-- » dans du
  // code n'est pas un commentaire HTML.
  const morceaux = html.split(/(<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>)/i);
  return morceaux.map((m, i) => {
    if (i % 2 === 0) return m.replace(/<!--(?!\[)[\s\S]*?-->/g, '');
    const s = /^<script\b([^>]*)>([\s\S]*?)<\/script>$/i.exec(m);
    if (!s || /\bsrc\s*=/.test(s[1])) return m;
    const type = (/\btype\s*=\s*["']([^"']+)["']/i.exec(s[1]) || [])[1];
    if (type && !/^(?:text\/javascript|module|application\/javascript)$/i.test(type.trim())) return m;
    const corps = s[2];
    const sans = corps.replace(/^[ \t]*\/\/[^\r\n]*(?:\r?\n)/gm, '');
    if (sans === corps) return m;
    // LA PREUVE : les commentaires ne changent pas le code minifié ; une ligne
    // « // » qui était dans une chaîne, si.
    try {
      const a = esbuild(['--minify-whitespace', '--loader=js', '--log-level=error'], corps);
      const b = esbuild(['--minify-whitespace', '--loader=js', '--log-level=error'], sans);
      if (a !== b) { blocsLaisses++; return m; }
    } catch (e) { blocsLaisses++; return m; }
    blocsNettoyes++;
    return '<script' + s[1] + '>' + sans + '</script>';
  }).join('');
});
// Chaque bloc en ligne doit encore se parser.
{
  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)].forEach((m, i) => {
    const t = /\btype\s*=\s*["']([^"']+)["']/i.exec(m[1]);
    if (t && !/^(?:text\/javascript|module|application\/javascript)$/i.test(t[1].trim())) return;
    if (m[2].trim()) parse('index.html, bloc ' + i, m[2]);
  });
}
rmSync(TMP, {recursive: true, force: true});

// ── LE BILAN ──────────────────────────────────────────────────────────────
console.log('| fichier | avant (brut / gzip / brotli) | après (brut / gzip / brotli) |');
console.log('|---|---|---|');
const tot = {a: {brut: 0, gzip: 0, brotli: 0}, b: {brut: 0, gzip: 0, brotli: 0}};
for (const [n, a, b] of lignes) {
  console.log('| ' + n + ' | ' + ko(a.brut) + ' / ' + ko(a.gzip) + ' / ' + ko(a.brotli) + ' | ' + ko(b.brut) + ' / ' + ko(b.gzip) + ' / ' + ko(b.brotli) + ' |');
  for (const k of ['brut', 'gzip', 'brotli']) { tot.a[k] += a[k]; tot.b[k] += b[k]; }
}
console.log('| **total** | ' + ko(tot.a.brut) + ' / ' + ko(tot.a.gzip) + ' / ' + ko(tot.a.brotli) + ' | ' + ko(tot.b.brut) + ' / ' + ko(tot.b.gzip) + ' / ' + ko(tot.b.brotli) + ' |');
console.log('index.html : ' + blocsNettoyes + ' bloc(s) <script> débarrassé(s) de leurs lignes // , ' + blocsLaisses + ' laissé(s) tel(s) quel(s).');
if (erreurs.length) { console.error('\nÉCHEC :\n  ' + erreurs.join('\n  ')); process.exit(1); }
console.log('Tout se parse encore.');
