#!/usr/bin/env node
/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// ══ FIT PULSE — captures d'écran commerciales (mode ?capture=1) ═════════════
// 6 scènes × clair et sombre = 12 PNG en échelle 2 dans club/captures/ :
// home, resiliations, impayes, imports, themes en 1440 × 900 ; retention en 390 × 844.
//   node club/scripts/captures.mjs [--base sauvegarde.json] [--sortie dossier]
// Playwright : PW=/chemin/vers/playwright (sinon le module « playwright » installé).
// Contrôles, la capture échoue sinon : aucune erreur JavaScript, aucun état vide, ni NaN ni
// undefined, chaque chiffre des tuiles avec son unité ou %, aucun nom réel (comptes de
// tools/bootstrap.js et, avec --base, S.users et S.clients d'une sauvegarde de la vraie base).
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
const require = createRequire(import.meta.url);
const DIR = new URL('..', import.meta.url).pathname;
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const SORTIE = arg('--sortie') || join(DIR, 'captures');
const { chromium } = require(process.env.PW || 'playwright');

// Noms réels à ne jamais voir : comptes et identité du déploiement historique, et la vraie base si fournie.
const { BOOTSTRAP } = require(join(DIR, 'tools/bootstrap.js'));
const REELS = new Set(['Fitness Park', 'Niort', 'FPN', BOOTSTRAP.tenant.legal.societe, ...BOOTSTRAP.accounts.flatMap(a => [`${a.first} ${a.last}`, a.last])]);
const base = arg('--base');
if (base) { const st = JSON.parse(readFileSync(base, 'utf8')); const S = st.data || st; for (const u of Object.values(S.users || {})) if (u && u.last) REELS.add(`${u.first} ${u.last}`); for (const c of Object.values(S.clients || {})) if (c && c.name) REELS.add(c.name); }

// Petit serveur statique du dossier club/.
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const srv = createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = normalize(join(DIR, p)); if (!f.startsWith(DIR) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f)); });
await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const URL0 = `http://127.0.0.1:${srv.address().port}/`;

const SCENES = [['home', 1440, 900], ['resiliations', 1440, 900], ['impayes', 1440, 900], ['retention', 390, 844], ['imports', 1440, 900], ['themes', 1440, 900]];
mkdirSync(SORTIE, { recursive: true });
const b = await chromium.launch(); let echecs = 0; const fichiers = [];
for (const theme of ['light', 'dark']) for (const [scene, w, h] of SCENES) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: theme, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });
  await p.goto(`${URL0}?capture=1&scene=${scene}&theme=${theme}`); await p.waitForTimeout(scene === 'themes' ? 4000 : 1800);
  await p.evaluate(() => document.fonts && document.fonts.ready);
  const textes = scene === 'themes' ? await Promise.all(p.frames().filter(f => f !== p.mainFrame()).map(f => f.evaluate(() => document.body.innerText))) : [await p.evaluate(() => document.body.innerText)];
  const vides = scene === 'themes' ? 0 : await p.evaluate(() => document.querySelectorAll('.empty-state, .empty').length);
  // chiffres des tuiles : une unité, un % ou un mot après le nombre
  const sansUnite = scene === 'themes' ? [] : await p.evaluate(() => [...document.querySelectorAll('.stat b, .bk b, .ck2 b, .rc-tile b, .num-l, .palier-n')].map(e => e.textContent.trim()).filter(t => /^\d[\d\s ,.]*$/.test(t)));
  const tout = textes.join('\n');
  const pb = [];
  if (errs.length) pb.push('erreurs JS : ' + errs.slice(0, 3).join(' | '));
  if (/\bNaN\b|\bundefined\b/.test(tout)) pb.push('NaN ou undefined affiché');
  if (vides) pb.push(`${vides} état(s) vide(s)`);
  if (sansUnite.length) pb.push('chiffres sans unité : ' + sansUnite.slice(0, 5).join(', '));
  const reels = [...REELS].filter(n => n && n.length > 2 && tout.includes(n)); if (reels.length) pb.push('noms réels : ' + reels.join(', '));
  const f = join(SORTIE, `${scene}-${theme}.png`); await p.screenshot({ path: f }); fichiers.push(f);
  console.log(`${pb.length ? 'KO' : 'OK'} ${scene} ${theme} ${w}×${h}${pb.length ? ' · ' + pb.join(' ; ') : ''}`); if (pb.length) echecs++;
  await ctx.close();
}
await b.close(); srv.close();
console.log(`${fichiers.length} captures dans ${SORTIE}${echecs ? `, ${echecs} en échec` : ', toutes conformes'}`);
process.exit(echecs ? 1 : 0);
