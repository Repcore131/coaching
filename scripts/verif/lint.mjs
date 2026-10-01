#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════
//  LE LINT DE LA PAGE — UNE SEULE PORTEE GLOBALE, VERIFIEE D'UN BLOC
// ══════════════════════════════════════════════════════════════════════════
//
// POURQUOI. Les scripts en ligne d'app/index.html, vendor/qr.js,
// vendor/rc-video.js, rc-core.<build>.js et motion-lab.js partagent la MEME
// portee globale. Une fonction appelee et jamais definie (renderClientDetail),
// une variable mal nommee (impossibles au lieu de rejets), deux fonctions du
// meme nom dont la seconde ECRASE la premiere (mlAnnulerTrace) : rien de cela
// ne se voit a la lecture, et un try/catch l'avale a l'execution. Ces trois-la
// ont ete trouves le 01/10/2026 en lancant ce lint pour la premiere fois.
//
// CE QU'IL FAIT : il concatene ces scripts DANS L'ORDRE DE LA PAGE dans un
// fichier temporaire, lance ESLint 9 (config plate en ligne : sourceType
// 'script', globaux du navigateur + ceux des bibliotheques chargees a la
// demande), avec trois regles en erreur :
//   · no-undef      un nom utilise et declare nulle part ;
//   · no-redeclare  un nom declare deux fois (la seconde ecrase la premiere) ;
//   · no-dupe-keys  une cle d'objet ecrite deux fois (la seconde l'emporte).
// Chaque erreur est ramenee a fichier:ligne d'origine. Sortie 1 s'il y en a.
//
// RIEN DANS LE DEPOT : ESLint et `globals` sont installes dans un dossier
// temporaire (npm install --prefix ; le cache npm evite de retelecharger).
//
// Usage : node scripts/verif/lint.mjs
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execSync, spawnSync} from 'node:child_process';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const APP = join(RACINE, 'app');
const html = readFileSync(join(APP, 'index.html'), 'utf8');

// ── LES MORCEAUX, DANS L'ORDRE DE LA PAGE ─────────────────────────────────
// Chaque <script> : en ligne (son texte, et la ligne d'index.html ou il
// commence) ou externe (le fichier). motion-lab.js, charge a la demande par
// rc-core, vient en dernier.
const morceaux = [];
const ligneDe = (i) => html.slice(0, i).split('\n').length;
for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  const attrs = m[1];
  const type = (/\btype\s*=\s*["']([^"']+)["']/i.exec(attrs) || [])[1];
  if (type && !/^(?:text\/javascript|module|application\/javascript)$/i.test(type.trim())) continue;
  const src = (/\bsrc\s*=\s*["']\.\/([^"'?]+)/i.exec(attrs) || [])[1];
  if (src) {
    const p = join(APP, src);
    if (!existsSync(p)) { console.error('script demande et absent : ' + src); process.exit(1); }
    morceaux.push({fichier: 'app/' + src, debut: 1, texte: readFileSync(p, 'utf8')});
  } else if (m[2].trim()) {
    const debut = ligneDe(m.index + m[0].indexOf('>') + 1);
    morceaux.push({fichier: 'app/index.html', debut, texte: m[2]});
  }
}
morceaux.push({fichier: 'app/motion-lab.js', debut: 1, texte: readFileSync(join(APP, 'motion-lab.js'), 'utf8')});

// ── LE FICHIER CONCATENE, ET LA TABLE POUR REVENIR AUX ORIGINES ───────────
const TMP = join(tmpdir(), 'repcore-lint');
mkdirSync(TMP, {recursive: true});
let concat = '', ligne = 1;
const table = [];   // {de, a, fichier, debut} : lignes [de, a] du concatene
for (const m of morceaux) {
  const t = m.texte.replace(/\r\n/g, '\n').replace(/\n?$/, '\n');
  const n = t.split('\n').length - 1;
  table.push({de: ligne, a: ligne + n - 1, fichier: m.fichier, debut: m.debut});
  concat += t; ligne += n;
}
writeFileSync(join(TMP, 'page.js'), concat);
const origine = (l) => {
  const s = table.find((x) => l >= x.de && l <= x.a);
  return s ? s.fichier + ':' + (s.debut + l - s.de) : 'page.js:' + l;
};

// ── ESLINT ET globals, HORS DU DEPOT ──────────────────────────────────────
const outils = join(TMP, 'outils');
if (!existsSync(join(outils, 'node_modules', 'eslint')) || !existsSync(join(outils, 'node_modules', 'globals'))) {
  mkdirSync(outils, {recursive: true});
  execSync('npm install --silent --no-audit --no-fund --prefix ' + JSON.stringify(outils) + ' eslint@9 globals@15', {stdio: 'inherit'});
}
// Les bibliotheques chargees a la demande (pdf.js, Tesseract, MediaPipe Pose,
// MP4Box, mp4-muxer, PayPal) et l'encodeur QR : declarees ailleurs que dans
// ces fichiers.
const EXTERNES = ['Tesseract', 'pdfjsLib', 'Pose', 'MP4Box', 'Mp4Muxer', 'paypal', 'RepCoreQR'];
writeFileSync(join(TMP, 'eslint.config.mjs'), `
import globals from ${JSON.stringify(join(outils, 'node_modules', 'globals', 'index.js'))};
const externes = Object.fromEntries(${JSON.stringify(EXTERNES)}.map((n) => [n, 'readonly']));
export default [{
  files: ['page.js'],
  languageOptions: { ecmaVersion: 'latest', sourceType: 'script',
    globals: { ...globals.browser, ...externes } },
  linterOptions: { reportUnusedDisableDirectives: 'off' },
  rules: { 'no-undef': 'error', 'no-redeclare': 'error', 'no-dupe-keys': 'error' },
}];`);
const r = spawnSync(join(outils, 'node_modules', '.bin', 'eslint'), ['-f', 'json', '--no-inline-config', 'page.js'],
  {cwd: TMP, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024});
let res;
try { res = JSON.parse(r.stdout); } catch (e) {
  console.error('ESLint n’a pas rendu de JSON :\n' + (r.stderr || r.stdout || '').slice(0, 2000)); process.exit(1);
}
const msgs = (res[0] && res[0].messages) || [];
const parRegle = {};
for (const m of msgs) {
  parRegle[m.ruleId || 'analyse'] = (parRegle[m.ruleId || 'analyse'] || 0) + 1;
  console.log(origine(m.line) + ':' + m.column + '  ' + (m.ruleId || 'analyse') + '  ' + m.message);
}
const total = msgs.length;
console.log('\n' + morceaux.length + ' script(s), ' + (ligne - 1) + ' lignes : ' + total + ' erreur(s)'
  + (total ? ' — ' + Object.entries(parRegle).map(([k, v]) => k + ' ' + v).join(', ') : '') + '.');
process.exit(total ? 1 : 0);
