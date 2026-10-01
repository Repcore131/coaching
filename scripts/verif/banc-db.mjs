#!/usr/bin/env node
// LE BANC DU CACHE DE DB.get (build 1764). Un rc_users synthetique de ~2,9 Mo
// (52 dossiers de 60 seances, sessions_config en objet comme Firebase le rend),
// CPU x4, puis trois mesures de 10 appels : DB.get('users') seul, suivi de la
// lecture d'un dossier, suivi de la lecture de tous (Object.values).
// Les chiffres d'avant/apres sont consignes au-dessus de DB, dans rc-core.
// Usage : node scripts/verif/banc-db.mjs http://localhost:8799/app/index.html
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ serviceWorkers: 'block' });
const page = await ctx.newPage();
await page.goto(process.argv[2] || 'http://localhost:8799/app/index.html', { waitUntil: 'load' });
await page.waitForTimeout(3000);
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const r = await page.evaluate(() => {
  const users = {};
  for (let a = 0; a < 52; a++) {
    const sessions = [];
    for (let s = 0; s < 60; s++) sessions.push({ id: 's' + a + '_' + s, date: 1.7e12 + s * 864e5, name: 'Séance ' + s,
      data: Object.fromEntries(['SQUAT', 'DEVELOPPE_COUCHE', 'ROWING', 'TRACTIONS'].map((e) => [e, { sets: [1, 2, 3, 4].map((k) => ({ weight: String(60 + k), reps: '8', done: true, rpe: 8 })) }])) });
    users['a' + a + '@t,fr'] = { email: 'a' + a + '@t.fr', role: 'athlete', fname: 'A' + a, sessions,
      sessions_config: { 0: { name: 'Push', exercises: { 0: { name: 'SQUAT', sets: 4 }, 2: { name: 'ROWING', sets: 4 } } }, 3: { name: 'Pull', exercises: [] } },
      weightLog: Array.from({ length: 100 }, (_, i) => ({ date: '2026-0' + (1 + i % 9) + '-1' + (i % 9), kg: 70 + i / 10 })) };
  }
  const brut = JSON.stringify(users);
  localStorage.setItem('rc_users', brut);
  const dix = (f) => { const t0 = performance.now(); for (let i = 0; i < 10; i++) f(); return Math.round(performance.now() - t0); };
  DB.get('users'); // premier appel : remplit le cache s'il y en a un
  return { Mo: +(brut.length / 1048576).toFixed(2),
    dixGet: dix(() => DB.get('users')),
    dixGetUnDossier: dix(() => (DB.get('users') || {})['a7@t,fr'].sessions.length),
    dixGetTout: dix(() => Object.values(DB.get('users') || {}).reduce((n, u) => n + u.sessions.length, 0)) };
});
console.log(JSON.stringify(r));
await b.close();
