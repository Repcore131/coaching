// Robot : chaque page, pour chaque rôle (créateur, manager, membre), sur ordinateur et
// téléphone, avec la démo puis avec une base vide « à la Firebase » (ni tableau ni objet
// vide), à plusieurs dates délicates (1er du mois, Saint-Sylvestre, changement d'heure).
// Échoue sur toute erreur JavaScript, texte « undefined / NaN / Infinity / [object Object] »,
// débordement horizontal sur téléphone, ou incohérence des chiffres (club = somme des
// membres = saisies brutes ; prévision ≥ réalisé ; primes ≥ 0).
//   (cd club && python3 -m http.server 8765) & node club/tests/robot.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const U = process.env.FP_URL || 'http://localhost:8765/';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const issues = []; let pages = 0;
const SCEN = [['démo', null, null], ['base vide', null, 'empty'], ['1er novembre', '2026-11-01T08:30:00+01:00', null], ['31 décembre', '2026-12-31T21:00:00+01:00', null], ['changement d’heure', '2027-03-28T10:00:00+02:00', null]];
for (const [nom, date, mode] of SCEN) for (const vw of ['ordinateur', 'téléphone']) {
  const p = await b.newPage({ timezoneId: 'Europe/Paris', viewport: vw === 'téléphone' ? { width: 390, height: 844 } : { width: 1360, height: 900 } });
  let ctx = ''; p.on('pageerror', e => issues.push(`JS ${e.message} @ ${ctx}`));
  if (date) await p.clock.setFixedTime(new Date(date));
  await p.goto(U); await p.evaluate(() => localStorage.clear()); await p.goto(U); await p.waitForTimeout(300);
  await p.click('[data-act=loadDemo]'); await p.waitForTimeout(200);
  await p.evaluate(m => {
    const k = Object.keys(localStorage).find(x => { try { const j = JSON.parse(localStorage.getItem(x)); return j && j.users && j.entries; } catch (e) { return false; } });
    let j = JSON.parse(localStorage.getItem(k));
    if (m === 'empty') Object.keys(j).forEach(x => { if (!['users', 'clubs', 'kpis'].includes(x)) delete j[x]; });
    const prune = v => { if (Array.isArray(v)) { const a = v.map(prune).filter(x => x !== undefined); return a.length ? a : undefined; } if (v && typeof v === 'object') { const o = {}; for (const [kk, x] of Object.entries(v)) { const y = prune(x); if (y !== undefined) o[kk] = y; } return Object.keys(o).length ? o : undefined; } return v === null ? undefined : v; };
    localStorage.setItem(k, JSON.stringify(prune(j) || {}));
  }, mode);
  const roles = await p.evaluate(() => ['createur', 'manager', 'membre'].map(r => (Object.values(S.users).find(u => u.role === r && u.status !== 'archived') || {}).id).filter(Boolean));
  const snap = await p.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
  for (const uid of roles) {
    await p.evaluate(s => { localStorage.clear(); Object.entries(JSON.parse(s)).forEach(([k, v]) => localStorage.setItem(k, v)); }, snap);
    await p.goto(U + '#/home'); await p.reload(); await p.waitForTimeout(250);
    await p.evaluate(id => login(S.users[id]), uid); await p.waitForTimeout(150);
    const routes = await p.evaluate(() => { const uid = Object.keys(S.users)[2]; const cid = Object.keys(S.clients || {})[0] || 'x'; return [...Object.keys(PAGES).filter(k => !['login', 'onboarding'].includes(k)), 'coach/' + uid, 'profile/' + uid, 'client/' + cid, 'coach/inexistant', 'client/inexistant', 'wrap/' + addMonths(curMonth(), -1), 'pageinconnue']; });
    for (const r of routes) {
      ctx = `${nom} · ${vw} · ${uid} · #/${r}`; pages++;
      await p.evaluate(h => { location.hash = h; }, '#/' + r); await p.waitForTimeout(120);
      const t = await p.evaluate(() => document.body.innerText);
      const bad = t.match(/.{0,30}(undefined|NaN|Infinity|\[object Object\]|Invalid Date).{0,30}/); if (bad) issues.push(`TEXTE « ${bad[0].replace(/\s+/g, ' ')} » @ ${ctx}`);
      if (vw === 'téléphone') { const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (ov > 2) issues.push(`DÉBORDEMENT ${ov}px @ ${ctx}`); }
    }
  }
  if (vw === 'ordinateur') {
    ctx = `${nom} · chiffres`;
    const bad = await p.evaluate(() => {
      const out = []; const fin = (x, w) => { if (x != null && !Number.isFinite(x)) out.push(w + ' = ' + x); };
      for (const club of Object.keys(S.clubs)) for (let i = 0; i < 3; i++) {
        const mk = addMonths(curMonth(), -i); const r = rangeOf('month', mk); const users = perimeterMembers(club, r.from, r.to); const st = statsFor(club, null, r);
        for (const row of st.rows) {
          fin(row.real, `${club} ${mk} ${row.k.id} réalisé`); fin(row.pct, `${club} ${mk} ${row.k.id} %`);
          const sumU = users.reduce((s, u) => s + statsFor(club, u.id, r).rows.find(x => x.k.id === row.k.id).real, 0);
          if (Math.abs(sumU - row.real) > 0.02) out.push(`${club} ${mk} ${row.k.id} : club ${row.real} ≠ somme des membres ${sumU}`);
          const raw = Object.values(S.entries).filter(e => e && e.clubId === club && e.kpiId === row.k.id && e.date >= r.from && e.date <= r.to && entryCounts(e) && !replacedByImport(e) && users.some(u => u.id === e.userId)).reduce((s, e) => s + Number(e.value), 0);
          if (Math.abs(raw - row.real) > 0.02) out.push(`${club} ${mk} ${row.k.id} : club ${row.real} ≠ saisies ${raw}`);
        }
        fin(st.score, `${club} ${mk} score`);
        for (const u of users) { const pr = primeOf(club, u.id, mk); fin(pr.total, 'prime'); if (pr.total < 0) out.push(`prime négative ${u.id} ${mk}`); }
        if (i === 0) for (const k of Object.keys(S.kpis)) { const f = forecast(club, k, mk); fin(f.value, `prévision ${k}`); if (f.value + 0.01 < sumRange(club, null, k, r.from, r.to)) out.push(`prévision ${club} ${k} < réalisé`); }
      }
      return out;
    });
    bad.forEach(x => issues.push(`CHIFFRES ${x} @ ${ctx}`));
  }
  await p.close();
}
console.log(`${pages} pages vérifiées`);
if (issues.length) { console.log(`KO ${issues.length} problème(s) :`); [...new Set(issues)].slice(0, 40).forEach(x => console.log(' - ' + x)); } else console.log('OK  aucun problème');
await b.close(); process.exit(issues.length ? 1 : 0);
