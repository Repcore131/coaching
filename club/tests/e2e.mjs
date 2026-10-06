// Parcours de bout en bout dans un vrai navigateur : démo, connexion, saisie d'une vente,
// classement, pages principales sans erreur. Lancer avec le site servi sur le port 8765 :
//   (cd club && python3 -m http.server 8765) & node club/tests/e2e.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const U = process.env.FP_URL || 'http://localhost:8765/';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const errs = []; let fails = 0;
const ok = (label, cond) => { console.log(`${cond ? 'OK ' : 'KO '} ${label}`); if (!cond) fails++; };
for (const [w, h, tag] of [[1360, 900, 'ordinateur'], [390, 844, 'téléphone']]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', e => errs.push(`${tag} : ${e.message}`));
  await p.goto(U); await p.click('[data-act=loadDemo]'); await p.click('[data-act=loginAs][data-id=u4]'); await p.waitForTimeout(600);
  const tour = await p.$('[data-tour=skip]'); if (tour) await tour.click();
  const before = await p.evaluate(() => sumRange(CLUB.id, ME.id, 'contrats', today(), today()));
  await p.evaluate(() => quickAdd('contrats', 1)); await p.waitForTimeout(300);
  ok(`${tag} : la vente est enregistrée`, await p.evaluate(() => sumRange(CLUB.id, ME.id, 'contrats', today(), today())) === before + 1);
  await p.goto(U + '#/leaderboard'); await p.waitForTimeout(400);
  ok(`${tag} : le classement s’affiche`, (await p.$$('.rank-row, .podium .step')).length > 0);
  for (const r of ['home', 'dashboard', 'relances', 'opportunites', 'equipe', 'profile']) {
    await p.goto(U + '#/' + r); await p.waitForTimeout(300);
    ok(`${tag} : ${r} sans débordement`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  }
  await p.close();
}
ok('aucune erreur JavaScript', !errs.length); if (errs.length) console.log(errs.join('\n'));
await b.close(); process.exit(fails ? 1 : 0);
