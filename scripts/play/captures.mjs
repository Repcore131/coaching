#!/usr/bin/env node
// LES CAPTURES DE LA FICHE GOOGLE PLAY (10/10/2026) — 1080 × 1920.
//   node scripts/play/captures.mjs [url de l'app] [dossier]
//   url par défaut : http://127.0.0.1:8830/app/index.html (python3 -m http.server 8830)
// Un COMPTE DE DÉMONSTRATION fictif (« Camille », aucune donnée réelle), en
// version Play (?src=play). Huit captures pour la fiche (le maximum de Play),
// et verif/abonnement-version-play.png : la preuve qu'aucun paiement n'y apparaît.
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const URL_APP = process.argv[2] || 'http://127.0.0.1:8830/app/index.html';
const SORTIE = process.argv[3] || 'docs/play/captures';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = createRequire(process.env.PLAYWRIGHT_MODULE || '/opt/node-tools/node_modules/')('playwright'); }
mkdirSync(SORTIE, { recursive: true });
mkdirSync(SORTIE + '/../verif', { recursive: true });
const lancer = { args: ['--no-sandbox'] };
if (process.env.PLAYWRIGHT_CHROMIUM) lancer.executablePath = process.env.PLAYWRIGHT_CHROMIUM;
const b = await pw.chromium.launch(lancer);
// 360 × 640 à la densité 3 : 1080 × 1920.
const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris',
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' });
const p = await ctx.newPage();
await p.goto(URL_APP + '?src=play', { waitUntil: 'load' });
await p.waitForTimeout(6000);
const ECRANS = (process.env.ECRANS || '').split(',').filter(Boolean);
const etapes = [
  ['8-badges', `demoConnecter('athlete'); go('s-client-home'); loadClientHome();`, true],
  ['1-accueil', `demoConnecter('athlete'); go('s-client-home'); loadClientHome();`],
  ['2-seance', `demoSeance();`],
  ['3-cycle', `demoConnecter('athlete'); go('s-client-home'); loadClientHome(); setTimeout(()=>{ try{ startWorkoutSession(0); }catch(e){} },200);`, true],
  ['4-nutrition', `demoConnecter('athlete'); go('s-nutrition'); loadNutrition();`],
  ['5-progression', `demoConnecter('athlete'); go('s-progress'); loadProgress();`],
  ['6-historique', `demoConnecter('athlete'); go('s-historique-seances'); loadHistoriqueSeances();`],
  ['7-coach', `demoConnecter('coach'); go('s-coach-home'); loadCoachHome();`],
  ['../verif/abonnement-version-play', `demoConnecter('athlete'); go('s-subscribe'); loadSubscribePage(); setTimeout(()=>{ const z=document.querySelector('[data-canal-play]'); if(z) z.scrollIntoView({block:'center'}); },300);`],
];
await p.addScriptTag({ path: new URL('./demo.js', import.meta.url).pathname });
for (const [nom, code, garderCouche] of etapes) {
  if (ECRANS.length && !ECRANS.includes(nom)) continue;
  try { await p.evaluate(code); } catch (e) { console.log(nom, 'erreur :', e.message.slice(0, 200)); }
  await p.waitForTimeout(1800);
  await p.evaluate((garder) => { try {
    document.querySelectorAll('.toast,#toast,[data-toast]').forEach(t => t.remove());
    // Les écrans par-dessus (badges gagnés, bilan…) : gardés seulement pour leur propre capture.
    // Les fenêtres de l'app (cycle) se cachent, elles ne s'enlèvent pas.
    if (!garder) ['cycle-modal', 'cycle-choix-modal'].forEach((id) => { const m = document.getElementById(id); if (m) m.style.display = 'none'; });
    if (!garder) document.querySelectorAll('[id$="-fonds"],#bdg-ecran,.bdg-ecran,#rc-attente,#modal-overlay,.rc-sync-badge').forEach(t => t.remove());
  } catch (e) {} }, !!garderCouche);
  await p.screenshot({ path: SORTIE + '/' + nom + '.png' });
  console.log('capture', nom);
}
await b.close();
