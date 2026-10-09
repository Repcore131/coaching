// LES INVITATIONS EN LOT, DE BOUT EN BOUT (05/10/2026).
//
// 1. Le coach ouvre « Inviter plusieurs athlètes », colle 20 lignes, choisit
//    un modèle comme programme de départ : 20 invitations « En attente », 20
//    liens à l'écran.
// 2. Un athlète s'inscrit avec l'un des codes (autre appareil, stockage
//    vierge) : à sa première ouverture, son programme est là — pas « Programme
//    en cours de création ».
//
// Rien ne part sur le réseau : Firebase est servi par la fausse base des tests
// du Worker (cloudflare/test/fausse-base.mjs), et redeemCode est le VRAI code
// du Worker (cloudflare/src/droits-appels.js), joué ici dans Node.
//
//   python3 -m http.server 8799 --bind 127.0.0.1 &      (à la racine du dépôt)
//   node scripts/verif/invitations-lot.mjs [dossier-captures]
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import { fausseBase } from '../../cloudflare/test/fausse-base.mjs';
import { creerBase } from '../../cloudflare/src/base.js';
import { creerMetier } from '../../cloudflare/src/metier.js';
import { creerAppelsDroits } from '../../cloudflare/src/droits-appels.js';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const OUT = process.argv[2] || '';
const BASE = 'http://127.0.0.1:8799';
let executablePath;
const pwb = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
if (existsSync(pwb)) { const d = readdirSync(pwb).find((x) => /^chromium-\d+$/.test(x)); const p = d && pwb + '/' + d + '/chrome-linux/chrome'; if (p && existsSync(p)) executablePath = p; }

// ── LE SERVEUR : la fausse base, et le Worker par-dessus.
const COACH = 'kevin@repcore.test', CLE_COACH = 'kevin@repcore,test';
const F = fausseBase({ coachs_registre: { [CLE_COACH]: { plan: 'pro', le: 1 } } });
const db = creerBase({ url: 'https://repcore-sync-default-rtdb.firebaseio.com', auth: 's', fetchImpl: F.fetchImpl });
const M = creerMetier({ db, vapid: { publique: 'x', privee: 'y' }, fetchImpl: F.fetchImpl });
const W = creerAppelsDroits({ db, M });
const echecs = [];
const attendre = (c, m) => { if (!c) echecs.push(m); };

async function brancher(ctx, email) {
  await ctx.route((u) => !u.toString().startsWith(BASE + '/'), async (r) => {
    const req = r.request(), url = req.url();
    if (/firebaseio\.com/.test(url)) {
      const h = {}; for (const [k, v] of Object.entries(req.headers())) h[k] = v;
      const rep = await F.fetchImpl(url, { method: req.method(), body: req.postData() || undefined, headers: h });
      return r.fulfill({ status: rep.status, contentType: 'application/json', body: await rep.text() });
    }
    return r.abort();
  });
  await ctx.exposeFunction('__worker', async (nom, data) => {
    if (!W[nom]) throw new Error('appel inconnu : ' + nom);
    return W[nom]({ auth: { email }, data: data || {} });
  });
  await ctx.addInitScript(() => {
    const poser = () => {
      if (typeof CLOUD === 'undefined') return setTimeout(poser, 5);
      CLOUD._getToken = async () => 'jeton-sonde';
      CLOUD._callFn = async (nom, data) => window.__worker(nom, data);
    };
    poser();
  });
}

const b = await pw.chromium.launch({ executablePath, args: ['--no-sandbox'] });

// ── 1. LE COACH : 20 lignes collées, un modèle choisi.
const cc = await b.newContext({ viewport: { width: 390, height: 844 } });
await brancher(cc, COACH);
const pc = await cc.newPage(); const errC = []; pc.on('pageerror', (e) => errC.push(e.message));
await pc.goto(BASE + '/app/'); await pc.waitForTimeout(2500);
const coach = await pc.evaluate(async (email) => {
  const sans = (l) => l.map((s) => { const c = JSON.parse(JSON.stringify(s)); delete c._foundation; delete c._essai; return c; });
  currentUser = { id: 'c-kevin', email, role: 'coach', fname: 'Kevin', lname: 'G', code: 'GCP-KEV1', studentCodes: [],
    consent: { cgu: true, health: true, policyVersion: POLICY_VERSION }, coachPlan: 'pro', coachSubActive: true,
    coachPrograms: [{ id: 'p_force', name: 'Force 3 jours', createdAt: 1, majAt: 2, sessions_H: sans(FONDATION_H), sessions_F: sans(FONDATION_F) }] };
  const u = DB.get('users') || {}; u[email] = currentUser; DB.set('users', u); DB.set('session', currentUser);
  go('s-coach-code');
  return currentUser;
}, COACH);
F.ecrire('users/' + CLE_COACH, coach);
await pc.getByRole('button', { name: 'Inviter plusieurs athlètes' }).click();
const lignes = Array.from({ length: 20 }, (_, i) => 'Athlète' + String.fromCharCode(65 + i) + ' Nom' + (i + 1) + (i % 4 === 0 ? ' ; a' + i + '@exemple.fr' : '')).join('\n');
await pc.fill('#lot-texte', lignes);
await pc.selectOption('#lot-modele', 'p_force');
const compte = await pc.textContent('#lot-compte');
if (OUT) await pc.screenshot({ path: OUT + '/lot-saisie.png' });
await pc.click('#lot-go');
await pc.waitForSelector('#lot-liste', { timeout: 30000 });
const res = await pc.evaluate(() => ({
  titre: document.getElementById('lot-titre').textContent,
  liens: [...document.querySelectorAll('#lot-liste .lot-lien')].map((x) => x.textContent),
  copier: document.querySelectorAll('#lot-liste button').length,
  enAttente: invitationsEnAttente(currentUser).length,
  titreAttente: (_htmlInvitationsEnAttente(currentUser).match(/En attente \((\d+)\)/) || [])[1],
  tokens: currentUser.studentCodes.map((c) => c.token),
}));
if (OUT) await pc.screenshot({ path: OUT + '/lot-resultat.png' });
const codes = Object.entries(F.lire('rc_codes') || {});
console.log('1. coach :', compte, '→', res.titre, '·', res.liens.length, 'liens ·', res.copier, '« Copier » · en attente', res.enAttente,
  '(titre', res.titreAttente + ') ·', codes.length, 'codes en base, dont', codes.filter(([, c]) => c.programmeModeleId === 'p_force').length, 'avec le modèle');
attendre(res.liens.length === 20 && new Set(res.liens).size === 20, '20 liens distincts attendus, ' + res.liens.length);
attendre(res.liens.every((l) => /\/i\/?\?inv=RC-/.test(l)), 'un lien ne porte pas ?inv=');
attendre(res.enAttente === 20 && res.titreAttente === '20', '20 invitations en attente attendues');
attendre(codes.length === 20 && codes.every(([, c]) => c.programmeModeleId === 'p_force'), 'programmeModeleId absent d’un code');
attendre(!JSON.stringify(F.lire('rc_codes')).includes('@exemple.fr'), 'un e-mail est parti dans /rc_codes');
attendre(!errC.length, 'erreurs de page (coach) : ' + errC.join(' | '));

// ── 2. L'ATHLÈTE s'inscrit avec le 7e lien (autre appareil, stockage vierge).
const lien = res.liens[6], code = new URL(lien).searchParams.get('inv');
const EMAIL = 'lea7@repcore.test';
const ca = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await brancher(ca, EMAIL);
const pa = await ca.newPage(); const errA = []; pa.on('pageerror', (e) => errA.push(e.message));
await pa.goto(BASE + '/app/?inv=' + encodeURIComponent(code)); await pa.waitForTimeout(2500);
const entree = await pa.evaluate(() => ({ ecran: (document.querySelector('.screen.active') || {}).id, code: (document.getElementById('ae-code') || {}).value }));
// L'inscription elle-même (Firebase Auth) n'est pas jouée : le compte est
// posé comme doRegister le laisse, puis le code est appliqué par le même
// chemin (_appliquerCodeApresInscription → redeemCode → _appliquerPayloadCode).
const apres = await pa.evaluate(async ({ email, code }) => {
  const d = await _verifierCodeSansConsommer(code);
  _retenirCodeVerifie(code, d);
  currentUser = { id: 'u-lea7', email, role: 'athlete', fname: 'Léa', lname: 'Sept', gender: 'F', createdAt: Date.now(),
    consent: { cgu: true, health: true, policyVersion: POLICY_VERSION }, sessions: [], status: 'FREE' };
  const u = DB.get('users') || {}; u[email] = currentUser; DB.set('users', u); DB.set('session', currentUser);
  const ok = await _appliquerCodeApresInscription();
  await new Promise((r) => setTimeout(r, 1500));
  return { ok, reelle: _configReelle(currentUser.sessions_config), prog: currentUser.assignedProgramName,
    essai: (currentUser.sessions_config || []).some((s) => s._essai || s._foundation) };
}, { email: EMAIL, code });
// LA PREMIÈRE OUVERTURE : l'app rouverte, sur le dossier tel qu'il est.
await pa.goto(BASE + '/app/'); await pa.waitForTimeout(3500);
// Un nouvel inscrit passe d'abord par la question des jours (existante) :
// « Je choisirai plus tard », et c'est l'accueil.
const premier = await pa.evaluate(() => (document.querySelector('.screen.active') || {}).id);
if (premier === 's-jours-entrainement') { await pa.getByText('Je choisirai plus tard').click(); await pa.waitForTimeout(1500); }
const accueil = await pa.evaluate(() => ({ ecran: (document.querySelector('.screen.active') || {}).id,
  texte: document.body.innerText, reelle: _configReelle(currentUser && currentUser.sessions_config),
  seances: (currentUser.sessions_config || []).filter((s) => s.active).map((s) => s.name) }));
if (OUT) await pa.screenshot({ path: OUT + '/lot-athlete.png' });
console.log('   première ouverture :', premier, '→', accueil.ecran, '· séances :', accueil.seances.join(', '));
attendre(accueil.ecran === 's-client-home', 'l’accueil de l’athlète ne s’ouvre pas : ' + accueil.ecran);
attendre(accueil.seances.length && accueil.seances.some((n) => accueil.texte.includes(n)), 'les séances du programme ne sont pas à l’écran');
const serveur = F.lire('users/' + EMAIL.replace(/\./g, ','));
console.log('2. athlète :', JSON.stringify({ entree, apres }), '· accueil :', accueil.ecran, '· programme réel :', accueil.reelle,
  '· serveur :', serveur && serveur.assignedProgramName, '· code consommé :', F.lire('rc_codes/' + code + '/redeemed'));
attendre(entree.ecran === 's-athlete-entry' && entree.code === code, 'le lien n’ouvre pas l’Espace athlète, code pré-rempli');
attendre(apres.ok && apres.reelle && !apres.essai && apres.prog === 'Force 3 jours', 'programme non posé à l’inscription');
attendre(accueil.reelle, 'programme absent à la première ouverture');
attendre(!/Programme en cours de création/.test(accueil.texte), '« Programme en cours de création » à la première ouverture');
attendre(serveur && serveur.assignedProgramId === 'p_force', 'le Worker n’a pas écrit le programme dans le dossier');
attendre(!errA.length, 'erreurs de page (athlète) : ' + errA.join(' | '));
await b.close();
console.log(echecs.length ? 'ROUGE\n  ' + echecs.join('\n  ') : 'VERT');
process.exit(echecs.length ? 1 : 0);
