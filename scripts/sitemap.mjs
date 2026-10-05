#!/usr/bin/env node
// ══ LE PLAN DU SITE (sitemap.xml), RÉGÉNÉRÉ ═════════════════════════════
//
// Une seule liste des pages publiques indexables (PAGES_SITEMAP), et pour
// chacune <lastmod> = la date du DERNIER COMMIT qui a touché le fichier
// (git log -1 --format=%cs). Un fichier modifié et pas encore commité prend
// la date du jour.
//
// APPELÉ PAR scripts/fabriquer_site.mjs, donc par deploie.sh, pages.yml et
// firebase.yml : la copie publiée est toujours à jour. Les deux workflows
// clonent l'historique sans les contenus (fetch-depth: 0, filter: blob:none) ;
// sur un clone SUPERFICIEL, une page inchangée depuis la limite du clone
// prend la date de cette limite (trop récente, jamais fausse dans l'autre
// sens) : le script le dit.
//
// Les vitrines des coachs ont leur propre plan, servi par le Worker
// (/sitemap-coachs.xml, cloudflare/src/pages.js) et cité dans robots.txt.
//
//   node scripts/sitemap.mjs                  réécrit sitemap.xml (dépôt)
//   node scripts/sitemap.mjs <chemin>         écrit ailleurs (_site/sitemap.xml)
//   node scripts/sitemap.mjs --verifier       sort en erreur si sitemap.xml n'est pas à jour
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const RACINE = fileURLToPath(new URL('../', import.meta.url));
export const SITE = 'https://repcore-sync.web.app/';   // l'adresse unique depuis le build 1786
// [fichier du dépôt, chemin publié, priorité]
export const PAGES_SITEMAP = [
  ['index.html', '', '1.0'],
  ['coachs.html', 'coachs.html', '0.9'],
  ['blog/index.html', 'blog/', '0.8'],
  ['blog/cycle-menstruel-entrainement.html', 'blog/cycle-menstruel-entrainement.html', '0.8'],
  ['blog/suivi-athletes-sans-tableur.html', 'blog/suivi-athletes-sans-tableur.html', '0.8'],
  ['blog/numeriser-fiche-programme-papier.html', 'blog/numeriser-fiche-programme-papier.html', '0.8'],
  ['privacy.html', 'privacy.html', '0.3'],
  ['terms.html', 'terms.html', '0.3'],
  ['legal.html', 'legal.html', '0.3'],
];

const git = (args) => { try { return execFileSync('git', args, { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return ''; } };
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** La date (AAAA-MM-JJ) du dernier commit du fichier ; aujourd'hui s'il est modifié ou inconnu de git. */
export function dateFichier(f) {
  if (git(['status', '--porcelain', '--', f])) return aujourdhui();
  return git(['log', '-1', '--format=%cs', '--', f]) || aujourdhui();
}
export function genererSitemap(dates) {
  const lignes = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for (const [f, chemin, prio] of PAGES_SITEMAP) {
    lignes.push('  <url>', '    <loc>' + SITE + chemin + '</loc>', '    <lastmod>' + dates[f] + '</lastmod>', '    <priority>' + prio + '</priority>', '  </url>');
  }
  lignes.push('</urlset>', '');
  return lignes.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const verifier = process.argv.includes('--verifier');
  const cible = process.argv.slice(2).find((a) => !a.startsWith('--')) || RACINE + 'sitemap.xml';
  const manquants = PAGES_SITEMAP.filter(([f]) => !existsSync(RACINE + f)).map(([f]) => f);
  if (manquants.length) { console.error('sitemap : page(s) absente(s) du dépôt : ' + manquants.join(', ')); process.exit(1); }
  if (git(['rev-parse', '--is-shallow-repository']) === 'true')
    console.warn('sitemap : clone superficiel — une page inchangée depuis la limite du clone prend la date de cette limite.');
  const dates = Object.fromEntries(PAGES_SITEMAP.map(([f]) => [f, dateFichier(f)]));
  const xml = genererSitemap(dates);
  if (verifier) {
    const actuel = existsSync(cible) ? readFileSync(cible, 'utf8').replace(/\r\n/g, '\n') : '';
    if (actuel !== xml) { console.error('sitemap.xml n’est pas à jour : node scripts/sitemap.mjs'); process.exit(1); }
    console.log('sitemap.xml à jour (' + PAGES_SITEMAP.length + ' pages).');
  } else {
    writeFileSync(cible, xml);
    console.log('sitemap : ' + PAGES_SITEMAP.length + ' pages → ' + cible);
  }
}
