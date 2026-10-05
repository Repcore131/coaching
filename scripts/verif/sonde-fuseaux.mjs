// LA MÊME DATE DANS TROIS FUSEAUX (02/10/2026).
//
// Une clé « AAAA-MM-JJ » est un JOUR LOCAL. Lue par new Date('2026-09-29'),
// elle devient minuit UTC : à la Martinique (UTC-4) ou à Tahiti (UTC-10),
// c'est encore le 28 au soir, et l'écran affichait la veille. Cette sonde
// ouvre l'app dans trois fuseaux (Playwright, timezoneId) et compare ce qu'elle
// affiche pour les mêmes clés : tout doit être IDENTIQUE.
//
//   python3 -m http.server 8799 --bind 127.0.0.1 &      (à la racine du dépôt)
//   node scripts/verif/sonde-fuseaux.mjs [url]
//
// Sortie 0 si les trois fuseaux rendent la même chose, 1 sinon.
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const url = process.argv[2] || 'http://127.0.0.1:8799/app/index.html';
const FUSEAUX = ['Europe/Paris', 'America/Martinique', 'Pacific/Tahiti'];
// Chromium du poste (PLAYWRIGHT_BROWSERS_PATH), sinon celui de Playwright.
let executablePath;
const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
if (existsSync(base)) {
  const d = readdirSync(base).find((x) => /^chromium-\d+$/.test(x));
  const p = d && `${base}/${d}/chrome-linux/chrome`;
  if (p && existsSync(p)) executablePath = p;
}
const navigateur = await pw.chromium.launch({ executablePath, args: ['--no-sandbox'] });
const rendus = {};
for (const tz of FUSEAUX) {
  const ctx = await navigateur.newContext({ timezoneId: tz, viewport: { width: 412, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof dateLocaleDeCle === 'function' && typeof _renderEcheance === 'function', null, { timeout: 30000 });
  rendus[tz] = await page.evaluate(() => {
    const cles = ['2026-09-29', '2026-03-29', '2026-10-25', '2026-10-03', '2026-01-01'];
    const r = {};
    for (const k of cles) {
      const d = dateLocaleDeCle(k);
      r[k] = { court: _fmtDateCourte(k), long: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), cle: localISODate(d) };
    }
    // La compétition du 3 octobre, à l'écran.
    const sU = currentUser, sS = window.saveUser, z = document.getElementById('ech-contenu');
    try {
      window.saveUser = () => true;
      currentUser = { id: 'tz', email: 'tz@t.fr', role: 'athlete', sessions: [], bilans: [],
        echeance: { date: '2026-10-03', type: 'COMPETITION', fiches: {}, journal: [], vueLe: 1 } };
      _renderEcheance();
      const m = (z && z.textContent.match(/(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+\d{2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i)) || [];
      r.competition = m[0] || '(rien)';
    } finally { currentUser = sU; window.saveUser = sS; }
    // TÉMOIN, HORS COMPARAISON : l'ancienne lecture, new Date(clé). Elle
    // DOIT différer d'un fuseau à l'autre — sinon la sonde ne prouve rien.
    r.temoin = new Date('2026-09-29').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return r;
  });
  await ctx.close();
}
await navigateur.close();
const sansTemoin = (o) => JSON.stringify(Object.assign({}, o, { temoin: undefined }));
const ref = sansTemoin(rendus[FUSEAUX[0]]);
let ok = true;
for (const tz of FUSEAUX) {
  const same = sansTemoin(rendus[tz]) === ref;
  ok = ok && same;
  console.log((same ? 'IDENTIQUE ' : 'DIFFÉRENT ') + tz.padEnd(20) + ' compétition : ' + rendus[tz].competition
    + ' · 29/09 : ' + rendus[tz]['2026-09-29'].court + ' · ' + rendus[tz]['2026-03-29'].long
    + '   (ancienne lecture : ' + rendus[tz].temoin + ')');
}
if (!ok) console.log(JSON.stringify(rendus, null, 1));
console.log(ok ? '\nSONDE FUSEAUX : la même date dans les trois.' : '\n::error::SONDE FUSEAUX : les fuseaux ne rendent pas la même date.');
process.exit(ok ? 0 : 1);
