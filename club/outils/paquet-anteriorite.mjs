/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
// Paquet de dépôt d'antériorité (e-Soleau) : code source, documents légaux,
// empreintes SHA-256 de chaque fichier. Sortie : club/_dist/FitPulse-depot-anteriorite-AAAA-MM-JJ.zip
//   node club/outils/paquet-anteriorite.mjs
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const club = new URL('..', import.meta.url).pathname;
const skip = /(^|\/)(_dist|_en_ligne|node_modules|\.git|vendor|fonts)(\/|$)|\.(webp|png|jpg|woff2?)$/;
const files = [];
(function walk(d) { for (const n of readdirSync(d)) { const p = join(d, n); const r = relative(club, p); if (skip.test(r)) continue; if (statSync(p).isDirectory()) walk(p); else files.push(r); } })(club);
files.sort();
const day = new Date().toISOString().slice(0, 10);
const lignes = files.map(f => `${createHash('sha256').update(readFileSync(join(club, f))).digest('hex')}  ${f}`);
const out = join(club, '_dist'); mkdirSync(out, { recursive: true });
const manifeste = join(out, 'EMPREINTES-SHA256.txt');
writeFileSync(manifeste, `Fit Pulse : dépôt d'antériorité du ${day}\nTitulaires : Kévin GUELLEC (auteur) et FPN GESTION, SASU, RCS Saint-Malo 934 823 055 (Fitness Park Niort)\n${files.length} fichiers\n\n${lignes.join('\n')}\n`);
const zip = join(out, `FitPulse-depot-anteriorite-${day}.zip`); rmSync(zip, { force: true });
execFileSync('zip', ['-q', '-9', zip, ...files], { cwd: club });
execFileSync('zip', ['-q', '-j', zip, manifeste]);
console.log(`${zip} (${files.length} fichiers, ${Math.round(statSync(zip).size / 1024)} Ko)`);
