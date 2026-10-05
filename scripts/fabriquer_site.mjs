// CE QUI EST MIS EN LIGNE, ET RIEN D'AUTRE (05/10/2026).
//
//   node scripts/fabriquer_site.mjs <dossier de sortie> [--pages] [--sans-minifier]
//
// UN SEUL ASSEMBLAGE POUR LES DEUX HOTES. Avant, Firebase publiait une liste
// choisie mais GitHub Pages publiait le DEPOT ENTIER (path: .) : tests.js,
// scripts/, cloudflare/, database.rules.json, docs/ et les notes de travail
// etaient lisibles par n'importe qui. Les deux workflows appellent maintenant
// ce script, et il n'y a qu'une liste : celle-ci.
//
// CE QUI ENTRE : l'app, la page de vente et ses pages (legales, blog, aide),
// les pages publiques (i, maj, p, c, a), tarifs.json, et leurs fichiers.
// CE QUI N'ENTRE JAMAIS : voir INTERDITS, reverifie sur le resultat.
//
// --pages : ajoute ce que SEUL GitHub Pages sert (l'appli VAULT construite,
//           et .nojekyll). Firebase ne les a jamais servis.
// La suite de tests continue de tourner sur le DEPOT (qui garde tests.js) :
// rien ici ne le touche.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const sortie = args.find((a) => !a.startsWith('--'));
const PAGES = args.includes('--pages'), MINIFIER = !args.includes('--sans-minifier');
if (!sortie) { console.error('usage : node scripts/fabriquer_site.mjs <dossier de sortie> [--pages] [--sans-minifier]'); process.exit(2); }
const OUT = path.resolve(sortie);
if (OUT === RACINE || RACINE.startsWith(OUT + path.sep)) { console.error('Refus : la sortie contiendrait le depot.'); process.exit(2); }

const DOSSIERS = ['app', 'blog', 'i', 'maj', 'p', 'c', 'a'];
// coachs.html : l'annuaire public des coachs ; charte.css : la charte des
// pages publiques (i/, p/, c/, 404.html la lient en /charte.css).
const FICHIERS = ['index.html', 'coachs.html', 'legal.html', 'privacy.html', 'terms.html', '404.html', 'aide-apk.html',
  'logo.png', 'og-image.png', 'robots.txt', 'sitemap.xml', 'tarifs.json', 'charte.css'];
// Dans app/ : les fichiers de travail qui vivent a cote du code servi.
const HORS_APP = [/^tests\.js$/, /\.d\.ts$/, /\.map$/, /\.md$/i];
// LE CONTROLE FINAL : aucun de ces chemins ne doit exister dans la sortie.
const INTERDITS = ['app/tests.js', 'scripts', 'cloudflare', 'functions', 'docs', '.claude', '.github', '.git',
  'database.rules.json', 'firebase.json', 'deploie.sh', 'tsconfig.json', 'android', 'audit_design',
  'rangs-bruts', 'badges-bruts', 'vault/src', 'vault/package.json'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const copier = (src, dst, filtre) => fs.cpSync(src, dst, { recursive: true, filter: filtre });

for (const d of DOSSIERS) {
  const src = path.join(RACINE, d);
  if (!fs.existsSync(src)) { console.error('Dossier attendu absent : ' + d); process.exit(1); }
  copier(src, path.join(OUT, d), d === 'app'
    ? (s) => { const rel = path.relative(src, s); return !(rel && !rel.includes(path.sep) && HORS_APP.some((r) => r.test(rel))); }
    : undefined);
}
for (const f of FICHIERS) {
  const src = path.join(RACINE, f);
  if (!fs.existsSync(src)) { console.error('Fichier attendu absent : ' + f); process.exit(1); }
  fs.copyFileSync(src, path.join(OUT, f));
}
// well-known/ (sans point dans le depot) -> .well-known/. Absent, Firebase
// sert un assetlinks.json VIDE et l'app Android s'ouvre avec la barre d'adresse.
copier(path.join(RACINE, 'well-known'), path.join(OUT, '.well-known'));
if (PAGES) {
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  // VAULT : seule sa version construite, jamais ses sources.
  fs.mkdirSync(path.join(OUT, 'vault'), { recursive: true });
  copier(path.join(RACINE, 'vault', 'app'), path.join(OUT, 'vault', 'app'));
  if (fs.existsSync(path.join(RACINE, 'vault', 'index.html'))) fs.copyFileSync(path.join(RACINE, 'vault', 'index.html'), path.join(OUT, 'vault', 'index.html'));
} else if (fs.existsSync(path.join(RACINE, '.nojekyll'))) {
  fs.copyFileSync(path.join(RACINE, '.nojekyll'), path.join(OUT, '.nojekyll'));
}

// LE PLAN DU SITE, régénéré sur la copie publiée : <lastmod> = dernier commit
// de chaque page (scripts/sitemap.mjs ; l'historique du checkout doit être complet).
execFileSync(process.execPath, [path.join(RACINE, 'scripts', 'sitemap.mjs'), path.join(OUT, 'sitemap.xml')], { stdio: 'inherit' });

if (MINIFIER) execFileSync(process.execPath, [path.join(RACINE, 'scripts', 'minifier.mjs'), path.join(OUT, 'app')], { stdio: 'inherit' });

const restes = INTERDITS.filter((p) => fs.existsSync(path.join(OUT, p)));
if (restes.length) { console.error('Fichiers de travail dans la sortie : ' + restes.join(', ')); process.exit(1); }
let n = 0; const compter = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? compter(path.join(d, e.name)) : n++; };
compter(OUT);
console.log('Site assemble dans ' + sortie + ' : ' + n + ' fichiers' + (PAGES ? ' (GitHub Pages, avec VAULT)' : '') + (MINIFIER ? ', code minifie' : ', code non minifie') + '.');
