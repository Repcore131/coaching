#!/usr/bin/env node
// LE BOUTON « PAYER PAR CARTE » EST-IL RENDU ? (09/10/2026)
//
// POURQUOI. Le paiement par carte sans compte PayPal dépend de PayPal, pas de
// nous : un réglage du compte (« Compte PayPal facultatif »), l'éligibilité du
// pays, une évolution du SDK. Le jour où le bouton disparaît, rien ne casse à
// l'écran — il manque, c'est tout, et la moitié des gens qui voulaient payer
// par carte repartent. Ce contrôle charge le VRAI écran d'abonnement, avec le
// VRAI SDK, sur deux téléphones (iPhone 13, Pixel 7), et dit si le bouton
// carte est là. Il ne paie rien : il ouvre le formulaire carte et s'arrête.
//
//   node scripts/verif/paypal-carte.mjs [url de l'app] [dossier des captures]
//     url par défaut : https://repcore-sync.web.app/app/index.html
//   Sort en erreur (code 1) si un appareil n'a pas le bouton carte.
//
// Playwright : celui du poste (npm i playwright), ou PLAYWRIGHT_CHROMIUM pour
// un Chromium déjà installé.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const URL_APP = process.argv[2] || 'https://repcore-sync.web.app/app/index.html';
const SORTIE = process.argv[3] || 'captures-paypal-carte';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (e) { pw = createRequire(process.env.PLAYWRIGHT_MODULE || '/opt/node-tools/node_modules/')('playwright'); }
mkdirSync(SORTIE, { recursive: true });

const APPAREILS = ['iPhone 13', 'Pixel 7'];
const lancer = { args: ['--no-sandbox'] };
if (process.env.PLAYWRIGHT_CHROMIUM) lancer.executablePath = process.env.PLAYWRIGHT_CHROMIUM;
const navigateur = await pw.chromium.launch(lancer);
const rapport = [];
for (const nom of APPAREILS) {
  const d = pw.devices[nom];
  // Chromium pour les deux : l'iPhone est émulé (taille, agent, tactile).
  const ctx = await navigateur.newContext(Object.assign({}, d, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' }));
  const p = await ctx.newPage();
  const fic = (x) => SORTIE + '/' + nom.replace(/\W+/g, '-').toLowerCase() + '-' + x + '.png';
  const r = { appareil: nom, sdk: false, boutonPaypal: false, boutonCarte: false, formulaireCarte: false, secours: false, erreur: '' };
  try {
    await p.goto(URL_APP, { waitUntil: 'load', timeout: 60000 });
    await p.waitForTimeout(6000);
    // Un compte fictif, l'écran d'abonnement, Essentielle au mois : le chemin
    // réel d'un athlète qui souscrit, sans connexion ni donnée réelle.
    await p.evaluate(() => {
      try { sessionStorage.setItem('rc_offre_choisie', 'essentielle'); sessionStorage.removeItem('rc_offre_annuel'); } catch (e) {}
      // eslint-disable-next-line no-undef
      currentUser = { id: 'verif-carte', email: 'verif-carte@repcore.invalid', fname: 'Vérif', role: 'athlete', status: 'FREE', sessions: [], sessions_config: [] };
      go('s-subscribe'); loadSubscribePage();
      const c = document.getElementById('sub-renonciation'); if (c && !c.checked) c.click();
      initPaypalSubscription();
    });
    await p.waitForSelector('#cgv-ok', { timeout: 30000 });
    r.sdk = await p.evaluate(() => typeof paypal !== 'undefined');
    await p.click('#cgv-ok');
    // Le bouton PayPal, puis le bouton carte : chacun est une iframe de PayPal.
    await p.waitForSelector('#pp-abo iframe', { timeout: 30000 }).then(() => { r.boutonPaypal = true; }).catch(() => {});
    await p.waitForSelector('#pp-carte iframe', { timeout: 20000 }).then(() => { r.boutonCarte = true; }).catch(() => {});
    r.secours = await p.evaluate(() => !!document.querySelector('[data-carte-secours]'));
    const captureBoutons = async () => {
      await p.evaluate(() => { const z = document.getElementById('paypal-btn-container'); if (z) z.scrollIntoView({ block: 'center' }); });
      await p.waitForTimeout(1500);
      await p.screenshot({ path: fic('1-boutons') });
    };
    if (!r.boutonCarte) await captureBoutons();
    if (r.boutonCarte) {
      // Pour un ABONNEMENT, le formulaire carte s'ouvre dans une FENÊTRE PayPal
      // (checkoutnow, paiement invité). On clique le bouton, on attend la
      // fenêtre et le champ du numéro de carte, on capture, ON FERME : rien
      // n'est saisi, rien n'est payé.
      // Le bouton ignore un clic trop précoce : on lui laisse le temps de s'armer.
      await p.waitForTimeout(3000);
      const cadre = await (await p.$('#pp-carte iframe')).contentFrame();
      const fenetre = ctx.waitForEvent('page', { timeout: 20000 }).catch(() => null);
      await cadre.locator('[data-funding-source="card"]').first().click({ timeout: 15000 });
      const pop = await fenetre;
      if (process.env.DEBUG_CARTE) console.error('cadre', cadre.url().slice(0, 80), 'pages', ctx.pages().length, 'pop', !!pop);
      if (pop) {
        await pop.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
        const champ = await pop.waitForSelector('input[name*="card" i], input[id*="cardNumber" i], input[autocomplete="cc-number"], input[name="cardnumber"]', { timeout: 30000 }).catch(() => null);
        // Le champ peut vivre dans un cadre de la fenêtre : on regarde aussi là.
        let vu = !!champ;
        if (!vu) for (const f of pop.frames()) {
          if (await f.locator('input[autocomplete="cc-number"], input[name*="card" i]').count().catch(() => 0)) { vu = true; break; }
        }
        r.formulaireCarte = vu;
        r.urlFormulaire = pop.url().split('?')[0];
        await pop.waitForTimeout(1500);
        await pop.screenshot({ path: fic('2-formulaire-carte') });
        await pop.close();
      }
      // La capture des boutons APRÈS le clic : prise avant, elle faisait
      // ignorer le clic par le bouton de PayPal (constaté le 09/10/2026).
      await captureBoutons();
    }
  } catch (e) { r.erreur = String(e && e.message || e).slice(0, 300); try { await p.screenshot({ path: fic('erreur') }); } catch (_) {} }
  rapport.push(r);
  await ctx.close();
}
await navigateur.close();
writeFileSync(SORTIE + '/rapport.json', JSON.stringify(rapport, null, 2));
for (const r of rapport)
  console.log((r.boutonCarte ? 'OK   ' : 'ABSENT ') + r.appareil.padEnd(10) + ' SDK ' + (r.sdk ? 'oui' : 'non') + ' · bouton PayPal ' + (r.boutonPaypal ? 'oui' : 'non')
    + ' · bouton carte ' + (r.boutonCarte ? 'oui' : 'non') + ' · formulaire carte ' + (r.formulaireCarte ? 'oui' : 'non')
    + ' · secours affiché ' + (r.secours ? 'oui' : 'non') + (r.erreur ? ' · erreur : ' + r.erreur : ''));
process.exit(rapport.every((r) => r.boutonCarte) ? 0 : 1);
