// Mode multi-salles de bout en bout : vraie appli dans un navigateur, base et authentification
// sur le simulateur Firebase. Connexion d'un membre, saisie, isolation, invitation à usage
// unique, inscription autonome d'une salle.
// Lancer (site servi sur le port 8765) :
//   cd club/tests/emul && npx firebase-tools emulators:exec --only database,auth --project demo-fitpulse "node ../multi.emul.mjs"
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { avecRegle } from '../outils/fitpulse-serveur.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const NS = 'fitpulse-e2e', U = (process.env.FP_URL || 'http://localhost:8765/') + '?emu=' + NS;
const DB = `http://127.0.0.1:9000`, owner = { authorization: 'Bearer owner', 'content-type': 'application/json' };
const rest = async (method, p, body) => { const r = await fetch(`${DB}/${p}.json?ns=${NS}`, { method, headers: owner, body: body === undefined ? undefined : JSON.stringify(body) }); return r.json(); };
const cle = (email, code) => crypto.createHash('sha256').update(email.toLowerCase() + '|' + code).digest('hex').slice(0, 40);
let fails = 0; const ok = (l, c) => { console.log(`${c ? 'OK ' : 'KO '} ${l}`); if (!c) fails++; };

await fetch(`${DB}/.settings/rules.json?ns=${NS}`, { method: 'PUT', headers: owner, body: avecRegle('{\n  "rules": {\n  }\n}') });
const CODE = 'FP-ABCD-EFGH-JKMN';
const user = (id, role, email) => ({ id, role, email, first: id, last: 'Test', status: 'active', clubs: ['c1'], avatar: 'h1', createdAt: 1 });
const mk = new Date().toISOString().slice(0, 7);
await rest('PUT', '', {
  orgs: {
    beta: { info: { nom: 'Beta Fitness', createdBy: 'x', creeLe: 1, statut: 'actif', securite: { mfa: false } }, clubs: { c1: { id: 'c1', name: 'Beta Centre' } },
      data: { users: { mgrB: user('mgrB', 'manager', 'mgr@beta.fr'), memB: user('memB', 'membre', 'mem@beta.fr') }, targets: { [mk]: { memB: { contrats: 10 } } }, entries: {}, meta: { version: 1 } } },
    alpha: { info: { nom: 'Alpha', createdBy: 'x', creeLe: 1, statut: 'actif', securite: { mfa: true } }, clubs: { a1: { id: 'a1', name: 'Alpha Secret' } }, data: { users: { z: user('z', 'membre', 'z@alpha.fr') }, meta: { version: 1 } } },
  },
  orgs_boot: { [cle('mem@beta.fr', CODE)]: { org: 'beta', uid: 'memB' }, [cle('mgr@beta.fr', CODE)]: { org: 'beta', uid: 'mgrB' } },
});

const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = async () => { const c = await b.newContext({ bypassCSP: true, viewport: { width: 1280, height: 900 } }); const p = await c.newPage(); p.on('pageerror', e => console.log('   erreur JS :', e.message)); return p; };
async function connexion(p, email) {
  await p.goto(U); await p.waitForSelector('#lg-email'); await p.fill('#lg-email', email); await p.fill('#lg-code', CODE); await p.click('#lg-btn');
  try { await p.waitForFunction(() => typeof ME !== 'undefined' && ME && S && CLUB, null, { timeout: 20000 }); }
  catch (e) { console.log('   écran :', (await p.textContent('#app')).replace(/\s+/g, ' ').slice(0, 300)); throw e; }
  await cgu(p);
}
// Conditions d'utilisation, acceptées à la première connexion (comme en vrai).
async function cgu(p) { await p.waitForTimeout(400); if (await p.$('.cgu-gate')) { await p.check('#cgu-1'); await p.check('#cgu-2'); await p.click('#cgu-ok'); await p.waitForTimeout(300); } }

// 1. Un membre se connecte : ses clubs, ses données, rien d'une autre société
const p1 = await page(); await connexion(p1, 'mem@beta.fr');
ok('membre connecté dans sa société', await p1.evaluate(() => ORG === 'beta' && ME.id === 'memB' && CLUB.name === 'Beta Centre'));
await p1.evaluate(() => quickAdd('contrats', 1)); await p1.waitForTimeout(800);
const E = await rest('GET', 'orgs/beta/data/entries');
ok('saisie écrite sous /orgs/beta/data', Object.values(E || {}).some(e => e.userId === 'memB' && e.kpiId === 'contrats'));
ok('aucune écriture sous /pulse', (await rest('GET', 'pulse')) === null);
ok('l’autre société est illisible depuis l’appli', await p1.evaluate(async () => { try { await backend.fb.database().ref('orgs/alpha/data').get(); return false; } catch (e) { return /permission/i.test(e.message); } }));
ok('objectif non modifiable par un membre', await p1.evaluate(async () => { try { await backend.fb.database().ref(`orgs/beta/data/targets/${curMonth()}/memB/contrats`).set(99); return false; } catch (e) { return true; } }));

// 2. Le manager invite un commercial ; le lien sert une seule fois
const p2 = await page(); await connexion(p2, 'mgr@beta.fr');
await p2.evaluate(() => ACTIONS.inviteMail()); await p2.fill('#invf [name=first]', 'Lou'); await p2.fill('#invf [name=email]', 'lou@beta.fr'); await p2.click('[data-act=inviteMailOk]');
await p2.waitForSelector('.modal input[readonly]'); const lien = await p2.inputValue('.modal input[readonly]');
const [org, t] = lien.split('#/invitation/')[1].split('/');
ok('invitation créée (7 jours, e-mail en file)', !!(await rest('GET', `orgs_invites/beta/${t}`)) && Object.keys((await rest('GET', 'orgs_mail/beta')) || {}).length === 1);
const p3 = await page(); await p3.goto(`${U}#/invitation/${org}/${t}`); await p3.waitForSelector('#inv-go'); await p3.click('#inv-go');
await p3.waitForSelector('.code-once', { timeout: 15000 }); const codeLou = (await p3.textContent('.code-once')).trim();
await p3.click('#mt-go'); await p3.waitForFunction(() => typeof ME !== 'undefined' && ME && ME.email === 'lou@beta.fr', null, { timeout: 20000 }); await cgu(p3);
ok('invité connecté, rôle de l’invitation', await p3.evaluate(() => ME.role === 'membre' && ORG === 'beta') && /^FP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codeLou));
ok('lien marqué utilisé', !!(await rest('GET', `orgs_invites/beta/${t}/usedAt`)));
const p4 = await page(); await p4.goto(`${U}#/invitation/${org}/${t}`); await p4.waitForTimeout(1500);
ok('le même lien ne sert pas deux fois', /Lien déjà utilisé/.test(await p4.textContent('#app')));

// 3. Inscription autonome d'une salle
const p5 = await page(); await p5.goto(`${U}#/inscription`); await p5.waitForSelector('#insf');
await p5.fill('#insf [name=societe]', 'Gamma Sport'); await p5.fill('#insf [name=club]', 'Gamma Ville'); await p5.fill('#insf [name=first]', 'Sam'); await p5.fill('#insf [name=last]', 'Durand'); await p5.fill('#insf [name=email]', 'sam@gamma.fr');
await p5.click('#ins-btn'); await p5.waitForSelector('.code-once', { timeout: 15000 });
const orgs = await rest('GET', 'orgs', undefined); const g = Object.entries(orgs).find(([, o]) => o.info && o.info.nom === 'Gamma Sport');
ok('espace créé : société, club, premier manager', !!g && g[1].info.statut === 'essai' && g[1].info.securite.mfa === true && Object.values(g[1].clubs)[0].name === 'Gamma Ville' && Object.values(g[1].data.users)[0].role === 'manager');
await p5.click('#mt-go'); await p5.waitForTimeout(2500);
const ecran5 = (await p5.textContent('#app')).replace(/\s+/g, ' ').slice(0, 200); const s5 = await p5.evaluate(() => !!S); console.log('   écran :', ecran5, '· données chargées :', s5);
ok('manager : double authentification demandée avant tout accès', /Double authentification : /.test(ecran5) && !s5);

await b.close(); console.log(fails ? `${fails} échec(s)` : 'Mode multi-salles : tout est bon.'); process.exit(fails ? 1 : 0);
