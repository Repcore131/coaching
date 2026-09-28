#!/usr/bin/env node
// LE BANC SANTÉ À DEUX APPAREILS — la synchronisation de bout en bout.
//
//   1. SERVEUR (le vrai code du Worker, cloudflare/src/sante.js, sur une base
//      en mémoire) : deux jetons ; Léa envoie depuis Android (format
//      « jours », Health Connect), Tom depuis iPhone (format « lignes », le
//      Raccourci « RepCore Santé »).
//   2. APPAREIL DE L'ATHLÈTE (un onglet) : chacun lit son sante_sync et le
//      fusionne dans son dossier (sanFusionSync + sanAppliquerSync).
//   3. APPAREIL DU COACH (un autre onglet) : reçoit les dossiers comme la base
//      les lui rendrait, et affiche le tableau Sommeil (pastille
//      « synchronisé », FC de repos, VFC) — et RIEN pour un athlète sans
//      synchronisation.
//
// Usage (un serveur HTTP sur la racine du dépôt, un Chromium avec
// --remote-debugging-port) :
//   node scripts/verif/banc-sante.mjs http://127.0.0.1:8080/app/index.html 9222
import { santeJeton, recevoirSante } from '../../cloudflare/src/sante.js';
import { creerBase } from '../../cloudflare/src/base.js';
import { fausseBase } from '../../cloudflare/test/fausse-base.mjs';
import { paris } from '../../cloudflare/src/metier.js';

const [,, URL_APP, PORT = '9222'] = process.argv;
if (!URL_APP) { console.error('usage : node scripts/verif/banc-sante.mjs <url app/index.html> <port CDP>'); process.exit(2); }
const ko = [];
const verifier = (c, m) => { if (!c) ko.push(m); else console.log('ok  ', m); };

// ── 1. LE SERVEUR ─────────────────────────────────────────────────────────
const F = fausseBase({});
const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl: F.fetchImpl });
const ctx = { db };
const t = Date.now();
const jour = (n) => paris(t - n * 864e5).jour;
const LEA = { email: 'lea@exemple.fr', uid: 'u1' }, TOM = { email: 'tom@exemple.fr', uid: 'u2' };
const jl = (await santeJeton({ auth: LEA, data: { action: 'creer' } }, ctx)).jeton;
const jt = (await santeJeton({ auth: TOM, data: { action: 'creer' } }, ctx)).jeton;
const poster = (jeton, corps) => recevoirSante(new Request('https://s.t/sante/i', { method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-RepCore-Jeton': jeton }, body: JSON.stringify(corps) }), ctx);

// Léa, Android : 10 jours, FC et VFC RMSSD sur tous, phases sur la dernière nuit.
const joursLea = {};
for (let i = 1; i <= 10; i++) joursLea[jour(i)] = { pas: 8000 + i * 100, sommeilMin: 420 + i, coucher: '23:10', lever: '06:40',
  fcRepos: 54 + (i % 3), vfc: 48 + i, vfcMethode: 'rmssd' };
joursLea[jour(1)].phases = { profond: 71, leger: 230, paradoxal: 98, eveil: 12 };
const rA = await poster(jl, { v: 1, plateforme: 'android', source: 'healthconnect', envoye: t, jours: joursLea,
  origines: { pas: 'garmin', sommeil: 'garmin' } });
verifier(rA.statut === 200 && rA.corps.jours === 10, 'serveur : envoi Android « jours » reçu (10 jours) ' + JSON.stringify(rA.corps));

// Tom, iPhone : des lignes, comme le Raccourci les fabrique (heure de Paris, virgule décimale).
const iso = (n, hh) => new Date(t - n * 864e5).toISOString().slice(0, 10) + 'T' + hh + ':00+02:00';
const L = { pas: [], sommeil: [], fcRepos: [], vfc: [] };
for (let i = 1; i <= 3; i++) {
  L.pas.push(iso(i, '08:00') + ';3000', iso(i, '18:00') + ';4 200');
  L.sommeil.push(iso(i + 1, '23:30') + ';' + iso(i, '02:00') + ';Essentiel', iso(i, '02:00') + ';' + iso(i, '03:30') + ';Profond',
    iso(i, '03:30') + ';' + iso(i, '05:00') + ';Paradoxal', iso(i, '05:00') + ';' + iso(i, '07:00') + ';Core');
  L.fcRepos.push(iso(i, '09:00') + ';58');
  L.vfc.push(iso(i, '03:00') + ';41,5');
}
const lignes = Object.fromEntries(Object.entries(L).map(([k, v]) => [k, v.join('\n')]));
const rI = await poster(jt, { v: 1, plateforme: 'ios', source: 'raccourci', envoye: t, lignes, origines: { pas: 'apple', sommeil: 'apple' } });
verifier(rI.statut === 200 && rI.corps.jours >= 3 && rI.corps.ignores === 0, 'serveur : envoi iPhone « lignes » reçu ' + JSON.stringify(rI.corps));
const syncLea = F.lire('sante_sync/lea@exemple,fr'), syncTom = F.lire('sante_sync/tom@exemple,fr');
verifier(syncTom.meta.dernierEnvoi && syncTom.meta.dernierEnvoi.nuits === 3, 'serveur : 3 nuits iPhone, rangées au jour du réveil');

// ── 2 et 3. LES DEUX APPAREILS ────────────────────────────────────────────
async function onglet() {
  const cible = await (await fetch(`http://127.0.0.1:${PORT}/json/new?` + encodeURIComponent(URL_APP), { method: 'PUT' })).json();
  const ws = new WebSocket(cible.webSocketDebuggerUrl);
  let n = 0; const att = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && att.has(m.id)) { att.get(m.id)(m.result); att.delete(m.id); } };
  await new Promise((r) => { ws.onopen = r; });
  const cmd = (m, p) => new Promise((r) => { const id = ++n; att.set(id, r); ws.send(JSON.stringify({ id, method: m, params: p || {} })); });
  await new Promise((r) => setTimeout(r, 4500));
  const ev = async (x) => { const r = await cmd('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
  return { ev, fermer: () => fetch(`http://127.0.0.1:${PORT}/json/close/${cible.id}`) };
}
const athlete = await onglet(), coach = await onglet();
const fusion = (email, sync) => `(()=>{
  const u={email:${JSON.stringify(email)},role:'athlete',coachEmailKey:'kev@exemple,fr',consent:{health:true,policyVersion:POLICY_VERSION,cgu:true},
    stepsLog:[],sleepLog:[],weightLog:[]};
  currentUser=u;
  const plan=sanFusionSync(u,${JSON.stringify(sync)},Date.now());
  const n=sanAppliquerSync(plan);
  return JSON.stringify(currentUser);
})()`;
const dossLea = JSON.parse(await athlete.ev(fusion('lea@exemple.fr', syncLea)));
const dossTom = JSON.parse(await athlete.ev(fusion('tom@exemple.fr', syncTom)));
verifier(dossLea.stepsLog.length === 10 && dossLea.stepsLog.every((e) => e.dataStatus === 'sync'), 'athlète Android : 10 jours de pas fusionnés, marqués « sync »');
verifier(dossLea.fcReposLog.length === 10 && dossLea.vfcLog.every((v) => v.methode === 'rmssd'), 'athlète Android : FC de repos et VFC (RMSSD)');
verifier(dossLea.santeSource.pas === 'garmin', 'athlète Android : la source devient Garmin Connect');
verifier(dossTom.sleepLog.length === 3 && dossTom.sleepLog.every((e) => e.phases && e.phases.profond === 90), 'athlète iPhone : 3 nuits avec leurs phases');
verifier(dossTom.vfcLog.every((v) => v.methode === 'sdnn' && v.ms === 41.5), 'athlète iPhone : VFC en SDNN, jamais mélangée');
const carte = await athlete.ev(`(()=>{ currentUser=${JSON.stringify(dossLea)}; const r=sanResume(currentUser,0);
  return _htmlPhasesNuit(currentUser,r.jours); })()`);
verifier(/Profond 1 h 11 · Paradoxal 1 h 38/.test(carte), 'athlète Android : « Profond 1 h 11 · Paradoxal 1 h 38 » sous la nuit');

const vue = (doss, meta) => `(()=>{
  const c=${JSON.stringify(doss)};
  ${meta ? `_sanSyncCoach[c.email.replace(/\\./g,',')]={lu:Date.now(),meta:_sanMetaNorm(${JSON.stringify(meta)})};` : ''}
  const d=document.createElement('div'); d.innerHTML=_htmlDomaineCoach(c,'sommeil');
  return d.textContent; })()`;
await coach.ev(`currentUser={email:'kev@exemple.fr',role:'coach'}; 1`);
const tLea = await coach.ev(vue(dossLea, syncLea.meta));
verifier(/synchronisé/.test(tLea) && /Dernière réception/.test(tLea), 'coach : pastille « synchronisé » et dernière réception (Léa)');
verifier(/FC de repos \(28 j\)55 bpm · 10 mesures/.test(tLea) && /VFC RMSSD \(28 j\)54 ms · 10 mesures/.test(tLea), 'coach : FC de repos et VFC (Léa)');
const tTom = await coach.ev(vue(dossTom, syncTom.meta));
verifier(/VFC SDNN \(28 j\)42 ms/.test(tTom), 'coach : VFC SDNN (Tom)');
const tSans = await coach.ev(vue({ email: 'zoe@exemple.fr', role: 'athlete', sleepLog: [{ date: jour(1), duration: 7 }] }, null));
verifier(!/synchronisé|FC de repos|VFC/.test(tSans), 'coach : rien pour un athlète sans synchronisation');

await athlete.fermer(); await coach.fermer();
if (ko.length) { console.error('\nÉCHECS :\n  ' + ko.join('\n  ')); process.exit(1); }
console.log('\nBanc santé à deux appareils : tout passe.');
process.exit(0);
