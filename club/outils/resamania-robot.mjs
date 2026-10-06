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

const require = createRequire(process.env.ROBOT_MODULES ? process.env.ROBOT_MODULES + '/' : import.meta.url);
const URL0 = process.env.RESAMANIA_URL || 'https://fr.fitnesspark.app/fitnesspark/-/management/dashboard-v2';
const ID = process.env.RESAMANIA_IDENTIFIANT || '', MDP = process.env.RESAMANIA_MOT_DE_PASSE || '';
const BOITE = process.env.MAIL_UTILISATEUR || 'kevinguellec.pro@gmail.com', BOITE_MDP = process.env.MAIL_MOT_DE_PASSE || '';
const MODE = process.env.ROBOT_MODE || 'reperage';
const SORTIE = process.env.ROBOT_SORTIE || 'robot-sortie';
const log = (...a) => console.log('[robot]', ...a);
const court = (s, n = 60) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
// Masque tout ce qui ressemble à un e-mail, un téléphone ou un nombre long.
const propre = s => court(s, 80).replace(/[\w.+-]+@[\w.-]+/g, '‹e-mail›').replace(/\+?\d[\d .-]{6,}\d/g, '‹n°›');

// ── Code de connexion reçu par e-mail ─────────────────────────────────────
async function codeParEmail(depuis, { essais = 24 } = {}) {
  const { ImapFlow } = require('imapflow');
  for (let i = 0; i < essais; i++) {
    const c = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: BOITE, pass: BOITE_MDP }, logger: false });
    try {
      await c.connect();
      const lock = await c.getMailboxLock('INBOX');
      try {
        const ids = await c.search({ since: new Date(depuis - 120000) }, { uid: true });
        let meilleur = null;
        for await (const m of c.fetch(ids.slice(-15), { envelope: true, source: true, internalDate: true }, { uid: true })) {
          if (m.internalDate && m.internalDate.getTime() < depuis - 60000) continue;
          const de = ((m.envelope.from || [])[0] || {}).address || '';
          const txt = m.source.toString('utf8');
          if (!/resamania|fitnesspark|fitness park|xplor/i.test(de + ' ' + (m.envelope.subject || '') + ' ' + txt.slice(0, 4000))) continue;
          const corps = txt.replace(/=\r?\n/g, '').replace(/<[^>]+>/g, ' ');
          const k = corps.match(/(?:code|Code|CODE)[^0-9A-Z]{0,80}\b([0-9]{4,8})\b/) || corps.match(/\b([0-9]{6})\b/);
          if (k && (!meilleur || m.internalDate > meilleur.at)) meilleur = { code: k[1], at: m.internalDate };
        }
        if (meilleur) return meilleur.code;
      } finally { lock.release(); }
    } catch (e) { log('boîte mail :', court(e.message, 120)); } finally { await c.logout().catch(() => {}); }
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error('code de connexion non reçu par e-mail après 2 minutes');
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
  await page.goto(URL0, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000);
  await decrire(page, 'page de connexion', { complet: true });
  const champId = page.locator('input[type=email],input[name*=mail i],input[name*=user i],input[name*=login i],input[id*=mail i],input[id*=user i],input[autocomplete=username]');
  if (await visible(champId)) { await champId.first().fill(ID); log('identifiant saisi'); }
  let champMdp = page.locator('input[type=password]');
  if (!(await visible(champMdp))) { await cliquerSuite(page); await page.waitForTimeout(3500); await decrire(page, 'après identifiant', { complet: true }); champMdp = page.locator('input[type=password]'); }
  if (!(await visible(champMdp))) throw new Error('champ mot de passe introuvable');
  await champMdp.first().fill(MDP); log('mot de passe saisi');
  const avant = Date.now();
  await cliquerSuite(page); await page.waitForTimeout(5000);
  await decrire(page, 'après mot de passe', { complet: true });
  // Code à usage unique reçu par e-mail ?
  const champCode = page.locator('input[autocomplete=one-time-code],input[name*=code i],input[id*=code i],input[name*=otp i],input[inputmode=numeric],input[maxlength="1"],input[type=tel],input[type=number]');
  if (await visible(champCode)) {
    log('code de connexion demandé : lecture de la boîte mail…');
    const code = await codeParEmail(avant);
    log('code reçu (masqué)');
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
async function reperage(page) {
  const base = new URL(URL0).origin;
  await page.goto(URL0, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(5000);
  const gestion = page.getByRole('button', { name: /gestion/i });
  if (await visible(gestion)) {
    await gestion.first().click(); await page.waitForTimeout(1500);
    const items = await page.evaluate(() => [...document.querySelectorAll('a[href*="/management/"]')].filter(e => e.getBoundingClientRect().height > 0).map(e => `${(e.innerText || '').trim()} → ${e.getAttribute('href')}`));
    log('=== menu GESTION'); items.slice(0, 150).forEach(x => log('  menu', propre(x)));
    await page.keyboard.press('Escape');
  }
  await page.goto(base + '/fitnesspark/-/management/exports/export', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(5000);
  const f = await page.evaluate(() => {
    const vis = e => e.getBoundingClientRect().height > 0;
    return {
      labels: [...document.querySelectorAll('label,legend,h1,h2,h3,h4,.mat-form-field-label,mat-label,[class*=label]')].filter(vis).map(e => (e.innerText || '').trim()).filter(t => t && t.length < 80).slice(0, 60),
      selects: [...document.querySelectorAll('select')].map(s => `${s.name || s.id}: ${[...s.options].map(o => o.text.trim()).slice(0, 80).join(' | ')}`),
      champs: [...document.querySelectorAll('input,textarea')].filter(vis).map(e => [e.type, e.name || e.id, e.placeholder || ''].join('|')).slice(0, 30),
      boutons: [...document.querySelectorAll('button,[role=button],[role=option],[role=tab],[role=radio]')].filter(vis).map(e => (e.innerText || e.getAttribute('aria-label') || '').trim()).filter(t => t && t.length < 80).slice(0, 80),
    };
  });
  log('=== formulaire d’export'); f.labels.forEach(x => log('  libellé', propre(x))); f.selects.forEach(x => log('  liste', court(x, 2000)));
  f.champs.forEach(x => log('  champ', propre(x))); log('  boutons :', f.boutons.map(propre).join(' · '));
  // Les listes déroulantes « maison » : on ouvre la première pour lire les types d'export proposés.
  const combo = page.locator('[role=combobox],mat-select,.select2-selection,.choices,[class*=select]').first();
  if (await visible(combo)) {
    await combo.click().catch(() => {}); await page.waitForTimeout(1500);
    const opts = await page.evaluate(() => [...document.querySelectorAll('[role=option],li.select2-results__option,.choices__item--choice,mat-option')].map(e => (e.innerText || '').trim()).filter(Boolean));
    log('=== types proposés dans la liste :', opts.length); opts.slice(0, 120).forEach(x => log('  type', propre(x)));
    await page.keyboard.press('Escape');
  }
  const tous = page.getByRole('button', { name: /tous les exports/i }).or(page.getByRole('link', { name: /tous les exports/i }));
  if (await visible(tous)) {
    await tous.first().click(); await page.waitForTimeout(5000);
    const t = await page.evaluate(() => ({ url: location.pathname, tetes: [...document.querySelectorAll('th,[role=columnheader]')].map(e => (e.innerText || '').trim()).filter(Boolean), lignes: document.querySelectorAll('tbody tr,[role=row]').length, actions: [...new Set([...document.querySelectorAll('tbody a,tbody button,[role=row] a,[role=row] button')].map(e => (e.innerText || e.getAttribute('aria-label') || e.getAttribute('title') || '').trim()).filter(x => x && x.length < 30))] }));
    log(`=== liste des exports : ${t.url} · ${t.lignes} lignes`); log('  colonnes :', t.tetes.map(propre).join(' | ')); log('  actions :', t.actions.map(propre).join(' · '));
  }
}

async function main() {
  const { chromium } = require('playwright');
  mkdirSync(SORTIE, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', acceptDownloads: true, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    await connecter(page);
    if (MODE === 'reperage') await reperage(page);
  } catch (e) {
    log('ÉCHEC :', court(e.message, 200)); await decrire(page, 'page au moment de l’échec').catch(() => {}); process.exitCode = 1;
  } finally { await b.close(); }
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) main();
