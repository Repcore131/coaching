// La synchronisation santé : le jeton, la réception, les lignes du Raccourci.
//   node cloudflare/test/sante.test.mjs
import assert from 'node:assert/strict';
import { santeJeton, recevoirSante, empreinte, nettoyerJour, CORPS_MAX } from '../src/sante.js';
import { lignesVersJours, etatSommeil } from '../src/lignes.js';
import { creerBase } from '../src/base.js';
import { fausseBase } from './fausse-base.mjs';
import worker from '../src/index.js';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };

// Le 15 octobre 2026, 10 h à Paris.
const T0 = Date.parse('2026-10-15T10:00:00+02:00');
function monde(initial) {
  const F = fausseBase(initial || {});
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl: F.fetchImpl });
  let t = T0;
  const ctx = { db, maintenant: () => t };
  return { F, db, ctx, avancer: (ms) => { t += ms; }, get t() { return t; } };
}
const LEA = { email: 'Lea@T.fr', uid: 'u1' };
const envoyer = (M, jeton, corps, o) => recevoirSante(new Request('https://s.t/sante/i/' + (jeton || ''), {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, (o && o.entetes) || {}),
  body: typeof corps === 'string' ? corps : JSON.stringify(corps) }), M.ctx);
const android = (jours, extra) => Object.assign({ v: 1, plateforme: 'android', source: 'healthconnect', envoye: T0, jours }, extra || {});

await test('créer : jeton de 43 caractères rendu une fois, seule l’empreinte est gardée', async () => {
  const M = monde();
  const r = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  assert.match(r.jeton, /^[A-Za-z0-9_-]{43}$/);
  const emp = await empreinte(r.jeton);
  assert.deepEqual(M.F.lire('sante_jetons/' + emp), { cle: 'lea@t,fr', creeLe: T0 });
  assert.deepEqual(M.F.lire('sante_sync/lea@t,fr/meta'), { empreinte: emp, creeLe: T0 });
  assert.ok(JSON.stringify(M.F.arbre).indexOf(r.jeton) < 0, 'le jeton en clair ne doit jamais être stocké');
  const e = await santeJeton({ auth: LEA, data: { action: 'etat' } }, M.ctx);
  assert.equal(e.actif, true); assert.equal(e.creeLe, T0); assert.equal(e.derniereReception, null);
});

await test('un seul jeton actif : en recréer un révoque le précédent', async () => {
  const M = monde();
  const a = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  const b = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  assert.equal(M.F.lire('sante_jetons/' + await empreinte(a.jeton)), null);
  assert.equal((await envoyer(M, a.jeton, android({ '2026-10-15': { pas: 100 } }))).statut, 401);
  assert.equal((await envoyer(M, b.jeton, android({ '2026-10-15': { pas: 100 } }))).statut, 200);
});

await test('action inconnue : 400', async () => {
  const M = monde();
  await assert.rejects(() => santeJeton({ auth: LEA, data: { action: 'x' } }, M.ctx), (e) => e.statut === 400);
});

await test('jeton inconnu ou mal formé : 401, rien d’écrit', async () => {
  const M = monde();
  await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  const avant = JSON.stringify(M.F.arbre);
  assert.equal((await envoyer(M, 'A'.repeat(43), android({ '2026-10-15': { pas: 1 } }))).statut, 401);
  assert.equal((await envoyer(M, 'court', android({}))).statut, 401);
  assert.equal((await envoyer(M, '', android({}))).statut, 401);
  assert.equal(JSON.stringify(M.F.arbre), avant);
});

await test('corps trop gros : 413 avant même de regarder le jeton', async () => {
  const M = monde();
  const r = await envoyer(M, 'inconnu', 'x'.repeat(CORPS_MAX + 1));
  assert.equal(r.statut, 413);
});

await test('le jeton passe aussi par l’en-tête X-RepCore-Jeton', async () => {
  const M = monde();
  const { jeton } = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  const r = await envoyer(M, '', android({ '2026-10-15': { pas: 4200 } }), { entetes: { 'X-RepCore-Jeton': jeton } });
  assert.equal(r.statut, 200);
  assert.equal(M.F.lire('sante_sync/lea@t,fr/jours/2026-10-15/pas'), 4200);
});

await test('une réception complète : jours, meta, origines, réponse {jours, ignores}', async () => {
  const M = monde();
  const { jeton } = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  const r = await envoyer(M, jeton, android({
    '2026-10-15': { pas: 8123, sommeilMin: 432, coucher: '23:10', lever: '06:52', phases: { profond: 80, leger: 250, paradoxal: 90, eveil: 20 },
      fcRepos: 54, vfc: 48.26, vfcMethode: 'rmssd', poids: 78.44, masseGrasse: 17.8 },
    '2026-10-14': { pas: 10000 },
  }, { origines: { pas: 'samsung', sommeil: 'Garmin' } }));
  assert.equal(r.statut, 200);
  assert.deepEqual(r.corps, { jours: 2, ignores: 0 });
  const j = M.F.lire('sante_sync/lea@t,fr/jours/2026-10-15');
  assert.equal(j.pas, 8123); assert.equal(j.sommeilMin, 432); assert.equal(j.vfc, 48.3); assert.equal(j.vfcMethode, 'rmssd');
  assert.equal(j.poids, 78.4); assert.deepEqual(j.phases, { profond: 80, leger: 250, paradoxal: 90, eveil: 20 }); assert.equal(j.recu, T0);
  const m = M.F.lire('sante_sync/lea@t,fr/meta');
  assert.equal(m.derniereReception, T0); assert.equal(m.plateforme, 'android'); assert.equal(m.source, 'healthconnect');
  assert.deepEqual(m.origines, { pas: 'samsung', sommeil: 'garmin' }); assert.equal(m.recus, 1);
  const e = await santeJeton({ auth: LEA, data: { action: 'etat' } }, M.ctx);
  assert.equal(e.derniereReception, T0); assert.equal(e.source, 'healthconnect');
});

await test('rejouer le même envoi : même état, même réponse', async () => {
  const M = monde();
  const { jeton } = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  const c = android({ '2026-10-15': { pas: 500, fcRepos: 60 } });
  const r1 = await envoyer(M, jeton, c);
  const j1 = JSON.stringify(M.F.lire('sante_sync/lea@t,fr/jours'));
  const r2 = await envoyer(M, jeton, c);
  assert.deepEqual(r1.corps, r2.corps);
  assert.equal(JSON.stringify(M.F.lire('sante_sync/lea@t,fr/jours')), j1);
});

await test('un envoi partiel n’efface pas les autres champs du jour', async () => {
  const M = monde();
  const { jeton } = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  await envoyer(M, jeton, android({ '2026-10-15': { sommeilMin: 400, vfc: 40 } }));
  await envoyer(M, jeton, android({ '2026-10-15': { pas: 900 } }));
  const j = M.F.lire('sante_sync/lea@t,fr/jours/2026-10-15');
  assert.equal(j.sommeilMin, 400); assert.equal(j.pas, 900); assert.equal(j.vfcMethode, 'rmssd');
});

await test('plafond : le 21e envoi de l’heure est refusé (429), l’heure suivante repasse', async () => {
  const M = monde();
  const { jeton } = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  for (let i = 0; i < 20; i++) assert.equal((await envoyer(M, jeton, android({ '2026-10-15': { pas: i } }))).statut, 200, 'envoi ' + i);
  assert.equal((await envoyer(M, jeton, android({ '2026-10-15': { pas: 99 } }))).statut, 429);
  assert.equal(M.F.lire('sante_sync/lea@t,fr/jours/2026-10-15/pas'), 19);
  M.avancer(3600e3);
  assert.equal((await envoyer(M, jeton, android({ '2026-10-15': { pas: 99 } }))).statut, 200);
});

await test('format : JSON illisible, v ≠ 1, plateforme inconnue → 400 (et l’envoi compte)', async () => {
  const M = monde();
  const { jeton } = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  assert.equal((await envoyer(M, jeton, '{pas')).statut, 400);
  assert.equal((await envoyer(M, jeton, android({}, { v: 2 }))).statut, 400);
  assert.equal((await envoyer(M, jeton, android({}, { plateforme: 'windows' }))).statut, 400);
  assert.equal((await envoyer(M, jeton, android({}, { source: 'raccourci' }))).statut, 400);
  assert.equal(M.F.lire('sante_sync/lea@t,fr/meta/fenetre/n'), 4);
  assert.equal(M.F.lire('sante_sync/lea@t,fr/jours'), null);
});

await test('dates : demain passe, après-demain non, pas plus de 30 jours en arrière, au plus 14 jours', async () => {
  const M = monde();
  const { jeton } = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  const r = await envoyer(M, jeton, android({ '2026-10-16': { pas: 1 }, '2026-10-17': { pas: 1 }, '2026-09-15': { pas: 1 },
    '2026-09-14': { pas: 1 }, '2026-02-30': { pas: 1 }, 'hier': { pas: 1 } }));
  assert.deepEqual(r.corps, { jours: 2, ignores: 4 });
  const j = M.F.lire('sante_sync/lea@t,fr/jours');
  assert.deepEqual(Object.keys(j).sort(), ['2026-09-15', '2026-10-16']);
  const M2 = monde();
  const k = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M2.ctx);
  const beaucoup = {};
  for (let i = 0; i < 20; i++) beaucoup[new Date(Date.parse('2026-10-15T12:00:00Z') - i * 864e5).toISOString().slice(0, 10)] = { pas: i };
  const r2 = await envoyer(M2, k.jeton, android(beaucoup));
  assert.deepEqual(r2.corps, { jours: 14, ignores: 6 });
  assert.ok(M2.F.lire('sante_sync/lea@t,fr/jours/2026-10-15'), 'les plus récents sont gardés');
});

await test('bornes : chaque valeur hors bornes est écartée, le reste du jour passe', async () => {
  const n = nettoyerJour({ pas: 100000, sommeilMin: 20, coucher: '23:10', fcRepos: 25, vfc: 300, poids: 24, masseGrasse: 70 }, 'healthconnect');
  assert.deepEqual(n.v, {}); assert.equal(n.ignores, 7);
  const b = nettoyerJour({ pas: 99999, sommeilMin: 1080, coucher: '24:00', lever: '7:5', fcRepos: 120, vfc: 5, poids: 300, masseGrasse: 3,
    phases: { profond: 600, leger: 600 } }, 'raccourci');
  assert.equal(b.v.pas, 99999); assert.equal(b.v.sommeilMin, 1080); assert.equal(b.v.coucher, undefined); assert.equal(b.v.phases, undefined);
  assert.equal(b.v.vfcMethode, 'sdnn'); assert.equal(b.ignores, 3);
  const c = nettoyerJour({ sommeilMin: 400, phases: { profond: 100, leger: 300, paradoxal: 50, eveil: 10 } }, 'healthconnect');
  assert.deepEqual(c.v.phases, { profond: 100, leger: 300, paradoxal: 50, eveil: 10 }, 'somme 460 ≤ 400 + 60');
});

await test('rétention : un envoi efface les jours reçus il y a plus de 30 jours', async () => {
  const M = monde();
  const { jeton } = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  M.F.ecrire('sante_sync/lea@t,fr/jours/2026-09-10', { pas: 1 });
  M.F.ecrire('sante_sync/lea@t,fr/jours/2026-09-15', { pas: 2 });
  await envoyer(M, jeton, android({ '2026-10-15': { pas: 3 } }));
  assert.deepEqual(Object.keys(M.F.lire('sante_sync/lea@t,fr/jours')).sort(), ['2026-09-15', '2026-10-15']);
});

await test('révoquer : le jeton meurt, le dossier synchronisé est effacé', async () => {
  const M = monde();
  const { jeton } = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  await envoyer(M, jeton, android({ '2026-10-15': { pas: 1 } }));
  await santeJeton({ auth: LEA, data: { action: 'revoquer' } }, M.ctx);
  assert.equal(M.F.lire('sante_sync/lea@t,fr'), null);
  assert.equal(M.F.lire('sante_jetons'), null);
  assert.equal((await envoyer(M, jeton, android({ '2026-10-15': { pas: 1 } }))).statut, 401);
  assert.equal((await santeJeton({ auth: LEA, data: { action: 'etat' } }, M.ctx)).actif, false);
});

await test('un dossier effacé par son propriétaire vaut révocation', async () => {
  const M = monde();
  const { jeton } = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  M.F.ecrire('sante_sync/lea@t,fr', null);
  assert.equal((await envoyer(M, jeton, android({ '2026-10-15': { pas: 1 } }))).statut, 401);
  assert.equal(M.F.lire('sante_sync/lea@t,fr'), null);
});

// ── LES LIGNES DU RACCOURCI ───────────────────────────────────────────────
await test('lignes : les états en français et en anglais', async () => {
  assert.equal(etatSommeil('Profond'), 'profond'); assert.equal(etatSommeil('Deep'), 'profond');
  assert.equal(etatSommeil('Essentiel'), 'leger'); assert.equal(etatSommeil('Core'), 'leger');
  assert.equal(etatSommeil('Paradoxal'), 'paradoxal'); assert.equal(etatSommeil('REM'), 'paradoxal');
  assert.equal(etatSommeil('Éveillé'), 'eveil'); assert.equal(etatSommeil('Awake'), 'eveil');
  assert.equal(etatSommeil('Au lit'), 'aulit'); assert.equal(etatSommeil('InBed'), 'aulit');
  assert.equal(etatSommeil('Dans le lit'), 'aulit'); assert.equal(etatSommeil('bof'), null);
});

await test('lignes : une nuit à cheval sur minuit appartient au jour du réveil', async () => {
  const { jours } = lignesVersJours({ sommeil: [
    '2026-10-14T23:10:00+02:00;2026-10-15T01:00:00+02:00;Essentiel',
    '2026-10-15T01:00:00+02:00;2026-10-15T02:30:00+02:00;Profond',
    '2026-10-15T02:30:00+02:00;2026-10-15T02:40:00+02:00;Éveillé',
    '2026-10-15T02:40:00+02:00;2026-10-15T04:00:00+02:00;Paradoxal',
    '2026-10-15T04:00:00+02:00;2026-10-15T06:52:00+02:00;Core',
  ].join('\n') });
  assert.deepEqual(Object.keys(jours), ['2026-10-15']);
  const j = jours['2026-10-15'];
  assert.equal(j.coucher, '23:10'); assert.equal(j.lever, '06:52');
  assert.equal(j.sommeilMin, 110 + 90 + 80 + 172);
  assert.deepEqual(j.phases, { profond: 90, leger: 282, paradoxal: 80, eveil: 10 });
});

await test('lignes : sans phases, « au lit » moins « éveillé » ; la sieste la plus courte cède', async () => {
  const { jours } = lignesVersJours({ sommeil: [
    '2026-10-14T22:30:00+02:00;2026-10-15T06:30:00+02:00;InBed',
    '2026-10-15T03:00:00+02:00;2026-10-15T03:30:00+02:00;Awake',
    '2026-10-15T14:00:00+02:00;2026-10-15T14:40:00+02:00;Endormi',
  ].join('\n') });
  assert.equal(jours['2026-10-15'].sommeilMin, 450);
  assert.equal(jours['2026-10-15'].phases, undefined);
  assert.equal(jours['2026-10-15'].lever, '06:30');
});

await test('lignes : heure d’été (mars) et d’hiver (octobre), jours de Paris', async () => {
  // Nuit du 28 au 29 mars 2026 : 2 h → 3 h. 23:00+01 → 07:00+02 = 7 h réelles.
  const mars = lignesVersJours({ sommeil: '2026-03-28T23:00:00+01:00;2026-03-29T07:00:00+02:00;Asleep' }).jours;
  assert.equal(mars['2026-03-29'].sommeilMin, 420); assert.equal(mars['2026-03-29'].coucher, '23:00'); assert.equal(mars['2026-03-29'].lever, '07:00');
  // Nuit du 24 au 25 octobre 2026 : 3 h → 2 h. 23:00+02 → 07:00+01 = 9 h réelles.
  const oct = lignesVersJours({ sommeil: '2026-10-24T23:00:00+02:00;2026-10-25T07:00:00+01:00;Asleep' }).jours;
  assert.equal(oct['2026-10-25'].sommeilMin, 540);
  // Des pas en UTC à 23:30Z le 14 = 01:30 le 15 à Paris.
  const p = lignesVersJours({ pas: '2026-10-14T23:30:00Z;1200\n2026-10-14T21:00:00Z;300' }).jours;
  assert.equal(p['2026-10-15'].pas, 1200); assert.equal(p['2026-10-14'].pas, 300);
});

await test('lignes : virgule décimale, masse grasse en fraction, VFC moyenne en SDNN, dernier poids du jour', async () => {
  const { jours, ignores } = lignesVersJours({
    pas: '2026-10-15T08:00:00+02:00;1000\n2026-10-15T09:00:00+02:00;2 500\nnimporte;quoi',
    poids: '2026-10-15T07:00:00+02:00;78,4\n2026-10-15T20:00:00+02:00;79,1',
    masseGrasse: '2026-10-15T07:00:00+02:00;0,178',
    vfc: '2026-10-15T03:00:00+02:00;40\n2026-10-15T05:00:00+02:00;50',
    fcRepos: '2026-10-15T09:00:00+02:00;55',
  });
  const j = jours['2026-10-15'];
  assert.equal(j.pas, 3500); assert.equal(j.poids, 79.1); assert.equal(j.masseGrasse, 17.8);
  assert.equal(j.vfc, 45); assert.equal(j.vfcMethode, 'sdnn'); assert.equal(j.fcRepos, 55); assert.equal(ignores, 1);
});

await test('un envoi iPhone en lignes passe par la même validation', async () => {
  const M = monde();
  const { jeton } = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  const r = await envoyer(M, jeton, { v: 1, plateforme: 'ios', source: 'raccourci', envoye: T0, lignes: {
    pas: '2026-10-15T08:00:00+02:00;4000',
    sommeil: '2026-10-14T23:00:00+02:00;2026-10-15T06:30:00+02:00;Endormi',
    vfc: '2026-10-15T03:00:00+02:00;400',
  } });
  assert.equal(r.statut, 200);
  const j = M.F.lire('sante_sync/lea@t,fr/jours/2026-10-15');
  assert.equal(j.pas, 4000); assert.equal(j.sommeilMin, 450); assert.equal(j.vfc, undefined, 'VFC 400 hors bornes');
  assert.equal(r.corps.ignores, 1);
  assert.equal(M.F.lire('sante_sync/lea@t,fr/meta/source'), 'raccourci');
});

await test('le Worker route /sante/i/… avec CORS, sans casser /sante', async () => {
  const r = await worker.fetch(new Request('https://s.t/sante/i/x', { method: 'OPTIONS' }), { FIREBASE_DB_URL: 'https://b.t', FIREBASE_DB_SECRET: 'x' }, { waitUntil() {} });
  assert.equal(r.status, 204);
  assert.match(r.headers.get('Access-Control-Allow-Headers'), /X-RepCore-Jeton/);
  const g = await worker.fetch(new Request('https://s.t/sante'), { FIREBASE_DB_URL: 'https://b.t' }, { waitUntil() {} });
  assert.equal((await g.json()).ok, true);
  const t = await worker.fetch(new Request('https://s.t/sante/i/court', { method: 'POST', body: '{}' }), { FIREBASE_DB_URL: 'https://b.t', FIREBASE_DB_SECRET: 'x' }, { waitUntil() {} });
  assert.equal(t.status, 401);
  assert.equal(t.headers.get('Access-Control-Allow-Origin'), '*');
});

console.log(ok + ' tests santé passés');
