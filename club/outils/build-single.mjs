/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
// Fit Pulse en UN seul fichier HTML (scripts, styles et bibliothèques intégrés), pour
// l'ouvrir hors ligne ou l'archiver. La version en ligne reste fitpulse-niort.web.app.
//   node club/outils/build-single.mjs [sortie.html]
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('..', import.meta.url); const rd = f => readFileSync(new URL(f, dir), 'utf8');
let html = rd('index.html');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, f) => { try { return `<style>\n${rd(f).replace(/url\((['"]?)fonts\//g, 'url($1fonts/')}\n</style>`; } catch (e) { return m; } });
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, f) => { try { return `<script>\n${rd(f).replace(/<\/script/gi, '<\\/script')}\n</script>`; } catch (e) { return m; } });
// les bibliothèques chargées à la demande (vendor/) restent des fichiers voisins
const out = process.argv[2] || new URL('_dist/fitpulse.html', dir).pathname;
try { (await import('node:fs')).mkdirSync(new URL('_dist/', dir), { recursive: true }); } catch (e) { /* existe */ }
writeFileSync(out, html); console.log('Fichier unique :', out, (html.length / 1024).toFixed(0), 'Ko');
