// La synchronisation santé : le jeton, la réception, les lignes du Raccourci.
//   node cloudflare/test/sante.test.mjs
import assert from 'node:assert/strict';
import { santeJeton, recevoirSante, empreinte, nettoyerJour, CORPS_MAX, compteDuJeton, masquer, rappelSante, rappelSanteUn, MESSAGE_RAPPEL, RAPPEL_MAX } from '../src/sante.js';
import { travaux } from '../src/planif.js';
import { PUSH_TYPES, pushAutorise } from '../src/metier.js';
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

await test('suppression du compte : sante_sync effacé à la main, puis révocation — l’empreinte orpheline part aussi', async () => {
  const M = monde({ sante_jetons: { vieux: { cle: 'lea@t,fr', creeLe: 1 }, autre: { cle: 'tom@t,fr', creeLe: 1 } } });
  const { jeton } = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  const emp = await empreinte(jeton);
  // L'app a effacé sante_sync elle-même (serveur injoignable ce jour-là).
  M.F.ecrire('sante_sync/lea@t,fr', null);
  assert.ok(M.F.lire('sante_jetons/' + emp));
  await santeJeton({ auth: LEA, data: { action: 'revoquer' } }, M.ctx);
  assert.equal(M.F.lire('sante_jetons/' + emp), null, 'l’empreinte du jeton courant');
  assert.equal(M.F.lire('sante_jetons/vieux'), null, 'une empreinte orpheline');
  assert.deepEqual(M.F.lire('sante_jetons/autre'), { cle: 'tom@t,fr', creeLe: 1 }, 'celle d’un autre compte reste');
  assert.equal(M.F.lire('sante_sync/lea@t,fr'), null);
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

await test('lignes : virgule décimale, masse grasse en fraction, VFC moyenne en SDNN, première pesée du matin', async () => {
  const { jours, ignores } = lignesVersJours({
    pas: '2026-10-15T08:00:00+02:00;1000\n2026-10-15T09:00:00+02:00;2 500\nnimporte;quoi',
    poids: '2026-10-15T07:00:00+02:00;78,4\n2026-10-15T20:00:00+02:00;79,1',
    masseGrasse: '2026-10-15T07:00:00+02:00;0,178',
    vfc: '2026-10-15T03:00:00+02:00;40\n2026-10-15T05:00:00+02:00;50',
    fcRepos: '2026-10-15T09:00:00+02:00;55',
  });
  const j = jours['2026-10-15'];
  assert.equal(j.pas, 3500); assert.equal(j.poids, 78.4); assert.equal(j.poidsHeure, '07:00'); assert.equal(j.masseGrasse, 17.8);
  assert.equal(j.vfc, 45); assert.equal(j.vfcMethode, 'sdnn'); assert.equal(j.fcRepos, 55); assert.equal(ignores, 1);
});

// ══ LE POIDS : LA PREMIÈRE PESÉE DU MATIN (05/10/2026) ═════════════════════
await test('poids : trois pesées le même jour (07:10, 13:00, 21:00) → celle de 07:10, avec son heure', async () => {
  const { jours } = lignesVersJours({ poids: '2026-10-15T21:00:00+02:00;81,4\n2026-10-15T07:10:00+02:00;80,0\n2026-10-15T13:00:00+02:00;80,9' });
  assert.equal(jours['2026-10-15'].poids, 80.0);
  assert.equal(jours['2026-10-15'].poidsHeure, '07:10');
});
await test('poids : sans pesée du matin (14:00, 20:00) → la première du jour ; deux matins → le plus tôt', async () => {
  const a = lignesVersJours({ poids: '2026-10-15T20:00:00+02:00;81,0\n2026-10-15T14:00:00+02:00;80,6' }).jours['2026-10-15'];
  assert.equal(a.poids, 80.6); assert.equal(a.poidsHeure, '14:00');
  // 03:30 n'est pas un matin (avant 4 h) : 09:00 passe devant, et 05:00 devant 09:00.
  const b = lignesVersJours({ poids: '2026-10-15T03:30:00+02:00;82\n2026-10-15T09:00:00+02:00;80,2\n2026-10-15T05:00:00+02:00;80,1' }).jours['2026-10-15'];
  assert.equal(b.poids, 80.1); assert.equal(b.poidsHeure, '05:00');
  // 12:00 pile n'est plus le matin.
  const c = lignesVersJours({ poids: '2026-10-15T12:00:00+02:00;80,5\n2026-10-15T11:59:00+02:00;80,7' }).jours['2026-10-15'];
  assert.equal(c.poids, 80.7);
  // La masse grasse suit la même règle ; la FC de repos reste la dernière valeur.
  const d = lignesVersJours({ masseGrasse: '2026-10-15T21:00:00+02:00;0,19\n2026-10-15T07:00:00+02:00;0,18',
    fcRepos: '2026-10-15T07:00:00+02:00;50\n2026-10-15T21:00:00+02:00;58' }).jours['2026-10-15'];
  assert.equal(d.masseGrasse, 18); assert.equal(d.fcRepos, 58);
});
await test('poidsHeure : HH:MM, seulement avec un poids ; un poids sans heure efface l’heure précédente', async () => {
  assert.equal(nettoyerJour({ poids: 80, poidsHeure: '07:10' }, 'healthconnect').v.poidsHeure, '07:10');
  const x = nettoyerJour({ poids: 80, poidsHeure: '7h10' }, 'healthconnect');
  assert.equal(x.v.poidsHeure, undefined); assert.equal(x.ignores, 1);
  const y = nettoyerJour({ pas: 100, poidsHeure: '07:10' }, 'healthconnect');
  assert.equal(y.v.poidsHeure, undefined); assert.equal(y.ignores, 1);
  const M = monde();
  const { jeton } = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  await envoyer(M, jeton, { v: 1, plateforme: 'android', source: 'healthconnect', envoye: T0, jours: { '2026-10-14': { poids: 80, poidsHeure: '07:10' } } });
  await envoyer(M, jeton, { v: 1, plateforme: 'android', source: 'healthconnect', envoye: T0, jours: { '2026-10-14': { poids: 80.4 } } });
  const j = M.F.lire('sante_sync/lea@t,fr/jours/2026-10-14');
  assert.equal(j.poids, 80.4); assert.equal(j.poidsHeure, undefined);
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

await test('le corps EXACT de la fiche du Raccourci : lignes vides, espaces fines, libellés iOS, v en texte', async () => {
  const M = monde();
  const { jeton } = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  // Formater la date : yyyy-MM-dd'T'HH:mm:ssZZZZZ ; « Grouper par jour » pour les pas.
  const corps = { v: '1', plateforme: 'ios', source: 'raccourci', lignes: {
    pas: '2026-10-13T00:00:00+02:00;7\u202f412\n2026-10-14T00:00:00+02:00;10\u202f031\n2026-10-15T00:00:00+02:00;2\u202f210',
    sommeil: ['2026-10-14T23:05:00+02:00;2026-10-14T23:20:00+02:00;Au lit',
      '2026-10-14T23:20:00+02:00;2026-10-15T01:00:00+02:00;Essentiel',
      '2026-10-15T01:00:00+02:00;2026-10-15T02:10:00+02:00;Sommeil profond',
      '2026-10-15T02:10:00+02:00;2026-10-15T02:20:00+02:00;Éveillé(e)',
      '2026-10-15T02:20:00+02:00;2026-10-15T03:50:00+02:00;Paradoxal',
      '2026-10-15T03:50:00+02:00;2026-10-15T06:45:00+02:00;Asleep Core'].join('\n'),
    fcRepos: '2026-10-15T08:00:00+02:00;57', vfc: '2026-10-15T03:00:00+02:00;38,6',
    poids: '', masseGrasse: '' } };
  const r = await envoyer(M, jeton, corps);
  assert.equal(r.statut, 200);
  assert.equal(r.corps.ignores, 0);
  const j = M.F.lire('sante_sync/lea@t,fr/jours/2026-10-15');
  assert.equal(j.pas, 2210); assert.equal(M.F.lire('sante_sync/lea@t,fr/jours/2026-10-14/pas'), 10031);
  assert.equal(j.sommeilMin, 100 + 70 + 90 + 175); assert.equal(j.coucher, '23:20'); assert.equal(j.lever, '06:45');
  assert.deepEqual(j.phases, { profond: 70, leger: 275, paradoxal: 90, eveil: 10 });
  assert.equal(j.vfc, 38.6); assert.equal(j.vfcMethode, 'sdnn'); assert.equal(j.fcRepos, 57);
  assert.equal((await envoyer(M, jeton, Object.assign({}, corps, { v: '2' }))).statut, 400);
});

await test('le Worker route /sante/i/… avec CORS, sans casser /sante', async () => {
  const r = await worker.fetch(new Request('https://s.t/sante/i/x', { method: 'OPTIONS' }), { FIREBASE_DB_URL: 'https://b.t', FIREBASE_DB_SECRET: 'x' }, { waitUntil() {} });
  assert.equal(r.status, 204);
  assert.match(r.headers.get('Access-Control-Allow-Headers'), /X-RepCore-Jeton/);
  // /sante (le pouls du serveur) répond toujours en JSON, base joignable ou non.
  const f0 = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('hors ligne'); };
  try {
    const g = await worker.fetch(new Request('https://s.t/sante'), { FIREBASE_DB_URL: 'https://b.t' }, { waitUntil() {} });
    assert.equal(g.status, 503);
    assert.equal((await g.json()).ok, false);
  } finally { globalThis.fetch = f0; }
  const t = await worker.fetch(new Request('https://s.t/sante/i/court', { method: 'POST', body: '{}' }), { FIREBASE_DB_URL: 'https://b.t', FIREBASE_DB_SECRET: 'x' }, { waitUntil() {} });
  assert.equal(t.status, 401);
  assert.equal(t.headers.get('Access-Control-Allow-Origin'), '*');
});

await test('/sante/qui : le compte du jeton, masqué ; inconnu ou révoqué → 401', async () => {
  const M = monde();
  const { jeton } = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  const qui = (j) => compteDuJeton(new Request('https://s.t/sante/qui', { method: 'POST', headers: { 'X-RepCore-Jeton': j } }), M.ctx);
  const r = await qui(jeton);
  assert.equal(r.statut, 200); assert.deepEqual(r.corps, { compte: 'l•••@t.fr' });
  assert.equal((await qui('A'.repeat(43))).statut, 401);
  assert.equal((await qui('court')).statut, 401);
  await santeJeton({ auth: LEA, data: { action: 'revoquer' } }, M.ctx);
  assert.equal((await qui(jeton)).statut, 401);
  assert.equal(masquer('kevin,guellec@gmail,com'), 'k•••@gmail.com');
  assert.equal(masquer('x'), '•••');
});

// ── LE RAPPEL DU MATIN (iPhone) ───────────────────────────────────────────
const H = (s) => Date.parse(s);                  // instants explicites, fuseau compris
const J15_10H = H('2026-10-15T10:00:00+02:00');
const IOS = (recu) => ({ empreinte: 'e', plateforme: 'ios', derniereReception: recu });

await test('rappel : iPhone sans réception depuis 4 h ce matin → oui ; reçu à 6 h → non', async () => {
  assert.deepEqual(rappelSante({ meta: IOS(H('2026-10-14T09:00:00+02:00')), rappel: null, t: J15_10H }),
    { ok: true, raison: null, n: 1, recu: H('2026-10-14T09:00:00+02:00') });
  assert.equal(rappelSante({ meta: IOS(H('2026-10-15T03:30:00+02:00')), t: J15_10H }).ok, true, 'avant 4 h : la nuit n’y est pas');
  assert.equal(rappelSante({ meta: IOS(H('2026-10-15T06:00:00+02:00')), t: J15_10H }).raison, 'recu');
});
await test('rappel : pas iPhone, inactif, jamais reçu → non', async () => {
  const hier = H('2026-10-14T09:00:00+02:00');
  assert.equal(rappelSante({ meta: { empreinte: 'e', plateforme: 'android', derniereReception: hier }, t: J15_10H }).raison, 'pas_ios');
  assert.equal(rappelSante({ meta: { plateforme: 'ios', derniereReception: hier }, t: J15_10H }).raison, 'inactif');
  assert.equal(rappelSante({ meta: IOS(null), t: J15_10H }).raison, 'jamais_recu');
  assert.equal(rappelSante({ meta: null, t: J15_10H }).raison, 'inactif');
});
await test('rappel : une fois par jour, jamais deux jours de suite, silence après deux sans effet', async () => {
  const recu = H('2026-10-12T08:00:00+02:00');
  const j = (d) => H(d + 'T10:00:00+02:00');
  assert.equal(rappelSante({ meta: IOS(recu), rappel: { jour: '2026-10-15', n: 1, recu }, t: j('2026-10-15') }).raison, 'deja');
  assert.equal(rappelSante({ meta: IOS(recu), rappel: { jour: '2026-10-14', n: 1, recu }, t: j('2026-10-15') }).raison, 'hier');
  assert.equal(rappelSante({ meta: IOS(recu), rappel: { jour: '2026-10-13', n: 1, recu }, t: j('2026-10-15') }).n, 2);
  assert.equal(rappelSante({ meta: IOS(recu), rappel: { jour: '2026-10-13', n: RAPPEL_MAX, recu }, t: j('2026-10-20') }).raison, 'silence');
  // Une réception entre-temps remet à zéro.
  const recu2 = H('2026-10-18T08:00:00+02:00');
  assert.deepEqual(rappelSante({ meta: IOS(recu2), rappel: { jour: '2026-10-13', n: 2, recu }, t: j('2026-10-20') }).n, 1);
});
await test('rappel : exécutant — pousse le bon message, retient l’état ; refusé : rien retenu', async () => {
  const recu = H('2026-10-14T09:00:00+02:00');
  const F = fausseBase({ sante_sync: { 'lea@t,fr': { meta: IOS(recu) }, 'tom@t,fr': { meta: { empreinte: 'e', plateforme: 'android', derniereReception: recu } } } });
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl: F.fetchImpl });
  const envois = [];
  const envoyerPush = async (uid, m, o) => { envois.push({ uid, m, o }); return { envoye: 1 }; };
  assert.equal(await rappelSanteUn('lea@t,fr', J15_10H, { db, envoyerPush }), 'envoye');
  assert.equal(await rappelSanteUn('tom@t,fr', J15_10H, { db, envoyerPush }), 'pas_ios');
  assert.equal(await rappelSanteUn('lea@t,fr', J15_10H + 3600e3, { db, envoyerPush }), 'deja');
  assert.equal(envois.length, 1);
  assert.deepEqual(envois[0].m, MESSAGE_RAPPEL);
  assert.equal(envois[0].m.url, './#sante-envoyer'); assert.equal(envois[0].o.attendre, false);
  assert.deepEqual(F.lire('sante_sync/lea@t,fr/rappel'), { jour: '2026-10-15', n: 1, recu });
  const refus = async () => ({ envoye: 0, raison: 'plafond' });
  assert.equal(await rappelSanteUn('lea@t,fr', H('2026-10-17T10:00:00+02:00'), { db, envoyerPush: refus }), 'plafond');
  assert.equal(F.lire('sante_sync/lea@t,fr/rappel/jour'), '2026-10-15');
});
await test('rappel : le type « sante » existe, se coupe par pushPrefs, se tait en heures calmes ; travail de 10 h', async () => {
  assert.ok(PUSH_TYPES.includes('sante'));
  assert.equal(pushAutorise('sante', { sante: false }, null, J15_10H).raison, 'coupe');
  assert.equal(pushAutorise('sante', {}, null, H('2026-10-15T22:30:00+02:00')).raison, 'calme');
  const w = travaux({ planifies: {} }).find((x) => x.nom === 'sante_rappel');
  assert.ok(w && w.push);
  const p = (h, m) => ({ heure: h, minute: m });
  assert.equal(w.quand(p(9, 59)), false); assert.equal(w.quand(p(10, 0)), true); assert.equal(w.quand(p(21, 0)), false);
});
await test('réception : meta.dernierEnvoi dit les jours et les nuits', async () => {
  const M = monde();
  const { jeton } = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  await envoyer(M, jeton, android({ '2026-10-15': { pas: 1, sommeilMin: 400 }, '2026-10-14': { pas: 2 }, '2026-10-13': { sommeilMin: 420 } }));
  assert.deepEqual(M.F.lire('sante_sync/lea@t,fr/meta/dernierEnvoi'), { jours: 3, nuits: 2 });
});

console.log(ok + ' tests santé passés');
