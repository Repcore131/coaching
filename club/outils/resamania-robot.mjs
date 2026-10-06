/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// ══ FIT PULSE — Robot Resamania (accord du siège) ══════════════════════════
// Se connecte à l'espace de gestion Resamania du club avec le compte du
// manager (secrets RESAMANIA_IDENTIFIANT / RESAMANIA_MOT_DE_PASSE), lit le
// code de connexion reçu par e-mail (boîte MAIL_UTILISATEUR, mot de passe
// d'application MAIL_MOT_DE_PASSE, IMAP Gmail) puis télécharge les exports.
// Les journaux GitHub sont publics : on n'y écrit JAMAIS de données
// d'adhérents, de code ni d'identifiant, seulement la structure des pages.
//   ROBOT_MODE=reperage node club/outils/resamania-robot.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import crypto from 'node:crypto';

const require = createRequire(process.env.ROBOT_MODULES ? process.env.ROBOT_MODULES + '/' : import.meta.url);
const URL0 = process.env.RESAMANIA_URL || 'https://fr.fitnesspark.app/fitnesspark/-/management/dashboard-v2';
const ID = process.env.RESAMANIA_IDENTIFIANT || '', MDP = process.env.RESAMANIA_MOT_DE_PASSE || '';
const MODE = process.env.ROBOT_MODE || 'reperage';
const SORTIE = process.env.ROBOT_SORTIE || 'robot-sortie';
const log = (...a) => console.log('[robot]', ...a);
const court = (s, n = 60) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
// Masque tout ce qui ressemble à un e-mail, un téléphone ou un nombre long.
const propre = s => court(s, 80).replace(/[\w.+-]+@[\w.-]+/g, '‹e-mail›').replace(/\+?\d[\d .-]{6,}\d/g, '‹n°›');

// ── Lien avec Fit Pulse (base) : code de connexion saisi par le manager ────
// Resamania envoie un code à chaque connexion. Le manager le recopie dans
// l'appli (page KPI du matin) ; le robot le relit ici, l'efface, et poursuit.
// Le code n'est JAMAIS lu automatiquement dans une boîte mail.
const DB = (process.env.FIREBASE_DB_URL || 'https://repcore-sync-default-rtdb.firebaseio.com').replace(/\/$/, '');
let TOKEN = null;
async function fbToken() {
  if (TOKEN) return TOKEN;
  const c = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (!c.client_email || !c.private_key) return null;
  const b = s => Buffer.from(s).toString('base64url');
  const iat = Math.floor(Date.now() / 1000);
  const tete = b(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corps = b(JSON.stringify({ iss: c.client_email, scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 }));
  const sig = crypto.createSign('RSA-SHA256').update(`${tete}.${corps}`).sign(c.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${tete}.${corps}.${sig}` });
  const j = await r.json(); TOKEN = j.access_token || null; return TOKEN;
}
async function fb(chemin, opts = {}) {
  const tk = await fbToken(); if (!tk) return null;
  const r = await fetch(`${DB}/${chemin}`, { ...opts, headers: { authorization: `Bearer ${tk}`, ...(opts.headers || {}) } });
  return r.ok ? r.json() : null;
}
const fbEtat = (step, extra = {}) => fb('pulse/rsm/etat.json', { method: 'PUT', body: JSON.stringify({ step, at: Date.now(), ...extra }) }).catch(() => {});
// Attend que le manager saisisse le code dans l'appli (6 min au plus).
async function codeDepuisApp({ essais = 72 } = {}) {
  await fb('pulse/rsm/code.json', { method: 'DELETE' }).catch(() => {});
  await fbEtat('code');
  for (let i = 0; i < essais; i++) {
    const c = await fb('pulse/rsm/code.json').catch(() => null);
    if (c && c.v) { await fb('pulse/rsm/code.json', { method: 'DELETE' }).catch(() => {}); return String(c.v).replace(/\s/g, ''); }
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error('code non saisi dans l’application (6 min)');
}

// ── Description d'une page (sans aucune donnée personnelle) ───────────────
async function decrire(page, titre, { complet = false } = {}) {
  const d = await page.evaluate(complet => {
    const ZONE = 'nav,aside,header,[role=navigation],[role=menu],[role=menubar]';
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
    return {
      url: location.pathname + location.hash,
      titre: document.title,
      // Après connexion, seuls les menus (nav, barre latérale, en-tête) sont décrits : jamais le contenu des pages.
      champs: complet ? [...document.querySelectorAll('input,select,textarea')].filter(vis).map(e => [e.tagName.toLowerCase(), e.type || '', e.name || '', e.id || '', e.placeholder || '', e.getAttribute('autocomplete') || '', (e.labels && e.labels[0] ? e.labels[0].innerText : e.getAttribute('aria-label')) || ''].join('|')).slice(0, 25) : [],
      boutons: [...document.querySelectorAll('button,[role=button],input[type=submit]')].filter(vis).filter(e => complet || e.closest(ZONE)).map(e => (e.innerText || e.value || e.getAttribute('aria-label') || '').trim()).filter(Boolean).slice(0, 40),
      liens: [...document.querySelectorAll('a[href],[role=menuitem]')].filter(vis).filter(e => complet || e.closest(ZONE)).map(e => [(e.innerText || e.getAttribute('aria-label') || '').trim(), e.getAttribute('href') || ''].join(' → ')).filter(x => x.length > 3).slice(0, 120),
    };
  }, complet);
  log(`=== ${titre} : ${d.url} (${court(d.titre)})`);
  d.champs.forEach(x => log('  champ', propre(x)));
  log('  boutons :', d.boutons.map(propre).join(' · '));
  d.liens.forEach(x => log('  lien', propre(x)));
}

// ── Connexion ─────────────────────────────────────────────────────────────
const visible = async loc => { try { return await loc.first().isVisible({ timeout: 1500 }); } catch { return false; } };
async function cliquerSuite(page) {
  for (const t of [/se connecter/i, /connexion/i, /continuer/i, /suivant/i, /valider/i, /login|sign in|next|continue|submit/i]) {
    const b = page.getByRole('button', { name: t });
    if (await visible(b)) { await b.first().click(); return true; }
  }
  const s = page.locator('button[type=submit],input[type=submit]');
  if (await visible(s)) { await s.first().click(); return true; }
  await page.keyboard.press('Enter'); return true;
}
export async function connecter(page) {
  if (!ID || !MDP) throw new Error('secrets RESAMANIA_IDENTIFIANT / RESAMANIA_MOT_DE_PASSE absents');
  await fbEtat('connexion');
  await page.goto(URL0, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000);
  await decrire(page, 'page de connexion', { complet: true });
  const champId = page.locator('input[type=email],input[name*=mail i],input[name*=user i],input[name*=login i],input[id*=mail i],input[id*=user i],input[autocomplete=username]');
  if (await visible(champId)) { await champId.first().fill(ID); log('identifiant saisi'); }
  let champMdp = page.locator('input[type=password]');
  if (!(await visible(champMdp))) { await cliquerSuite(page); await page.waitForTimeout(3500); await decrire(page, 'après identifiant', { complet: true }); champMdp = page.locator('input[type=password]'); }
  if (!(await visible(champMdp))) throw new Error('champ mot de passe introuvable');
  await champMdp.first().fill(MDP); log('mot de passe saisi');
  await cliquerSuite(page); await page.waitForTimeout(5000);
  await decrire(page, 'après mot de passe', { complet: true });
  // Code à usage unique : le manager le saisit dans l'appli (jamais lu dans un e-mail).
  const champCode = page.locator('input[autocomplete=one-time-code],input[name*=code i],input[id*=code i],input[name*=otp i],input[inputmode=numeric],input[maxlength="1"],input[type=tel],input[type=number]');
  if (await visible(champCode)) {
    log('code de connexion demandé : attente de la saisie dans l’application…');
    const code = await codeDepuisApp();
    log('code reçu de l’application (masqué)');
    const n = await champCode.count();
    if (n >= 4 && n <= 8) { for (let i = 0; i < n && i < code.length; i++) await champCode.nth(i).fill(code[i]); } else await champCode.first().fill(code);
    await cliquerSuite(page); await page.waitForTimeout(6000);
    await decrire(page, 'après code');
  }
  if (await visible(page.locator('input[type=password]'))) throw new Error('toujours sur la page de connexion (identifiants ou code refusés ?)');
  log('connecté');
}

// ── Repérage : menu Gestion, formulaire d'export, liste des exports ──────
// Seuls des libellés d'interface sont écrits (types d'export, intitulés de
// champs, en-têtes de colonnes) : aucune ligne de données.
// Fenêtres d'information (ex. « Alerte sécurité ») qui bloquent les clics.
async function fermerAlertes(page) {
  for (const t of [/je reste vigilant/i, /j'ai compris|compris|fermer|ok$/i]) {
    const b = page.getByRole('button', { name: t });
    if (await visible(b)) { await b.first().click().catch(() => {}); log('fenêtre d’information fermée'); await page.waitForTimeout(800); }
  }
}
async function reperage(page) {
  const base = new URL(URL0).origin;
  await page.goto(base + '/fitnesspark/-/management/exports/export', { waitUntil: 'domcontentloaded' });
  await page.getByText(/Rechercher une catégorie/i).first().waitFor({ timeout: 45000 }).catch(() => log('page des exports lente à charger'));
  await page.waitForTimeout(2000); await fermerAlertes(page); await page.waitForTimeout(1000); await fermerAlertes(page);
  log('texte de la page (libellés) :'); (await page.evaluate(() => (document.querySelector('main') || document.body).innerText)).split('\n').map(x => x.trim()).filter(x => x && x.length < 120).slice(0, 80).forEach(x => log('  |', propre(x)));
  // 1. Chaque catégorie dépliée : titre et description des exports (libellés d'interface).
  for (const cat of ['Comptabilité', 'Finance', 'Membres & Ventes', "Points d'attention", 'Spécifiques', 'Vie du Club']) {
    const h = page.getByText(cat, { exact: true });
    if (!(await h.count())) { log('catégorie introuvable :', cat); continue; }
    const avant = await page.evaluate(() => document.body.innerText.length);
    await h.first().click({ timeout: 8000 }).catch(e => log('  clic impossible :', court(e.message, 100))); await page.waitForTimeout(1500);
    const cartes = await page.evaluate(() => [...document.querySelectorAll('button,[role=button]')].filter(e => e.getBoundingClientRect().height > 0).map(e => (e.innerText || '').trim().replace(/\s+/g, ' ')).filter(t => t.length > 3 && t.length < 160 && !/NOTIFICATION|ALERTE|GESTION|EXPORTER|TOUS LES EXPORTS|VIGILANT/.test(t)));
    log(`=== ${cat} (${(await page.evaluate(() => document.body.innerText.length)) - avant} car.)`); [...new Set(cartes)].forEach(x => log('  export', propre(x).slice(0, 80), court(x, 160).length > 80 ? '…' : ''));
    log('  détail :'); [...new Set(cartes)].forEach(x => log('   ·', court(x, 160).replace(/[\w.+-]+@[\w.-]+/g, '‹e-mail›')));
    await h.first().click().catch(() => {}); await page.waitForTimeout(800);
  }
  // 2. Essai réel : l'export « Prospects » sur 7 jours, pour voir le formulaire et la façon dont le fichier sort.
  await fermerAlertes(page);
  const carte = page.getByRole('button', { name: /^Prospects/ });
  if (!(await visible(carte))) log('carte Prospects introuvable');
  if (await visible(carte)) {
    await carte.first().click(); await page.waitForTimeout(3000);
    const f = await page.evaluate(() => ({ url: location.pathname + location.search, champs: [...document.querySelectorAll('input,select,textarea')].filter(e => e.getBoundingClientRect().height > 0).map(e => [e.type, e.name || e.id, e.placeholder || '', (e.closest('label,div') || {}).innerText ? e.closest('div').innerText.trim().slice(0, 40) : ''].join('|')), boutons: [...document.querySelectorAll('button')].filter(e => e.getBoundingClientRect().height > 0).map(e => (e.innerText || e.getAttribute('aria-label') || '').trim()).filter(t => t && t.length < 50) }));
    log('=== formulaire Prospects :', f.url); f.champs.forEach(x => log('  champ', propre(x))); log('  boutons :', f.boutons.map(propre).join(' · '));
    const dates = page.locator('input[placeholder="DD/MM/YYYY"],input[placeholder*="JJ/MM" i],input[type=date]');
    const nd = await dates.count(); log('  champs date :', nd);
    const fmt = d => { const p = n => String(n).padStart(2, '0'); return { iso: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, fr: `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}` }; };
    const d1 = fmt(new Date(Date.now() - 7 * 864e5)), d2 = fmt(new Date());
    for (let i = 0; i < Math.min(nd, 2); i++) { const e = dates.nth(i); const t = await e.getAttribute('type'); const v = (i ? d2 : d1)[t === 'date' ? 'iso' : 'fr']; await e.click().catch(() => {}); await e.fill('').catch(() => {}); await e.pressSequentially(v.replace(/\//g, ''), { delay: 40 }).catch(() => {}); log(`  date ${i + 1} remplie (${t})`); }
    const go = page.getByRole('button', { name: /^valider$/i }).last();
    if (await visible(go)) {
      const dl = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
      await go.click(); log('  export lancé');
      const fichier = await dl;
      if (fichier) { const nom = fichier.suggestedFilename(); const chemin = `${SORTIE}/${nom}`; await fichier.saveAs(chemin); const { statSync } = await import('node:fs'); log(`  ✓ téléchargement direct : extension .${nom.split('.').pop()} · ${statSync(chemin).size} octets`); }
      else {
        await page.waitForTimeout(3000);
        const msg = await page.evaluate(() => [...document.querySelectorAll('[role=alert],[class*=snackbar],[class*=Snackbar],[class*=toast],[class*=Alert]')].map(e => (e.innerText || '').trim()).filter(Boolean));
        log('  pas de téléchargement direct ; messages :', msg.map(propre).join(' · ') || 'aucun');
        // L'export est peut-être préparé en différé : on regarde « Mes derniers exports » quelques minutes.
        for (let k = 0; k < 6; k++) {
          await page.goto(base + '/fitnesspark/-/management/exports/export', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(8000); await fermerAlertes(page);
          const derniers = await page.evaluate(() => [...document.querySelectorAll('a[href],button,[role=button]')].filter(e => e.getBoundingClientRect().height > 0).map(e => [(e.innerText || e.getAttribute('aria-label') || e.title || '').trim().replace(/\s+/g, ' ').slice(0, 60), (e.getAttribute('href') || '').slice(0, 80)].join(' → ')).filter(t => /télécharg|download|\.csv|\.xls|prospect|en cours|prêt|termin/i.test(t)));
          log(`  essai ${k + 1} :`, derniers.map(propre).join(' | ') || 'rien');
          const lien = page.locator('a[href*=".csv"],a[href*=".xls"],a[download],[aria-label*="élécharg" i],[title*="élécharg" i]').first();
          if (await visible(lien)) { const dl2 = page.waitForEvent('download', { timeout: 30000 }).catch(() => null); await lien.click().catch(() => {}); const f2 = await dl2; if (f2) { const nom = f2.suggestedFilename(); await f2.saveAs(`${SORTIE}/${nom}`); const { statSync } = await import('node:fs'); log(`  ✓ fichier récupéré : .${nom.split('.').pop()} · ${statSync(`${SORTIE}/${nom}`).size} octets`); break; } }
          await page.waitForTimeout(20000);
        }
      }
    } else log('  bouton de lancement introuvable');
  }
  // 3. « Tous les exports » : colonnes et actions (fichiers générés en différé ?).
  await page.goto(base + '/fitnesspark/-/management/exports/export', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(5000);
  await fermerAlertes(page);
  const tous = page.getByRole('button', { name: /tous les exports/i }).or(page.getByRole('link', { name: /tous les exports/i }));
  if (await visible(tous)) {
    await tous.first().click(); await page.waitForTimeout(6000);
    const t = await page.evaluate(() => ({ url: location.pathname, tetes: [...document.querySelectorAll('th,[role=columnheader]')].map(e => (e.innerText || '').trim()).filter(Boolean), lignes: document.querySelectorAll('tbody tr,[role=row]').length, actions: [...new Set([...document.querySelectorAll('tbody a,tbody button,[role=row] a,[role=row] button')].map(e => (e.innerText || e.getAttribute('aria-label') || e.getAttribute('title') || '').trim()).filter(x => x && x.length < 30))] }));
    log(`=== tous les exports : ${t.url} · ${t.lignes} lignes`); log('  colonnes :', t.tetes.map(propre).join(' | ')); log('  actions :', t.actions.map(propre).join(' · '));
  } else log('bouton « Tous les exports » introuvable');
}

async function main() {
  const { chromium } = require('playwright');
  mkdirSync(SORTIE, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', acceptDownloads: true, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(10000);
  try {
    await connecter(page);
    if (MODE === 'reperage') await reperage(page);
    await fbEtat('ok');
    await fb('pulse/serveur/rsm.json', { method: 'PUT', body: JSON.stringify({ at: Date.now() }) }).catch(() => {});
  } catch (e) {
    log('ÉCHEC :', court(e.message, 200)); await fbEtat('erreur', { msg: court(e.message, 140) }); await decrire(page, 'page au moment de l’échec').catch(() => {}); process.exitCode = 1;
  } finally { await b.close(); }
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) main();
