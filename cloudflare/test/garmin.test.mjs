// Garmin Health API : la conversion, les bornes, les doublons avec Health
// Connect, la liaison OAuth (PKCE), la révocation, et les envois refusés.
//   node --test cloudflare/test/garmin.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import { garminVersJours, garminParUtilisateur, jourGarmin, creerGarmin, garminOuvert, chiffrer, dechiffrer, defiPkce, GARMIN_AUTORISER } from '../src/garmin.js';
import { santeJeton, recevoirSante, PLATEFORMES, METHODE_DEFAUT } from '../src/sante.js';
import { creerBase } from '../src/base.js';
import { fausseBase } from './fausse-base.mjs';
import worker from '../src/index.js';

const T0 = Date.parse('2026-10-15T10:00:00+02:00');   // 15 octobre, 10 h à Paris
const ENV = { GARMIN_CLIENT_ID: 'cid-repcore', GARMIN_CLIENT_SECRET: 'csecret', GARMIN_PUSH_SECRET: 'Ps3cret-garmin-push-0123456789',
  GARMIN_CLE: crypto.randomBytes(32).toString('base64'), APP_URL: 'https://app.test/app/' };
const LEA = { email: 'Lea@T.fr', uid: 'u1' }, CLE = 'lea@t,fr', GUID = 'garmin-user-4f2a';
// 14 octobre, 23 h 10 à Paris (UTC+2) → réveil le 15 à 7 h 05.
const NUIT = { userId: GUID, summaryId: 's1', calendarDate: '2026-10-15', startTimeInSeconds: Date.parse('2026-10-14T21:10:00Z') / 1000,
  startTimeOffsetInSeconds: 7200, durationInSeconds: 27000, deepSleepDurationInSeconds: 5400, lightSleepDurationInSeconds: 14400,
  remSleepInSeconds: 7200, awakeDurationInSeconds: 1500 };
const JOURNEE = { userId: GUID, summaryId: 'd1', calendarDate: '2026-10-15', startTimeInSeconds: Date.parse('2026-10-14T22:00:00Z') / 1000,
  startTimeOffsetInSeconds: 7200, durationInSeconds: 36000, steps: 8421, restingHeartRateInBeatsPerMinute: 52 };
const VFC = { userId: GUID, summaryId: 'h1', calendarDate: '2026-10-15', startTimeInSeconds: NUIT.startTimeInSeconds, lastNightAvg: 61 };

// Le faux Garmin : jetons, identifiant, désinscription.
function fauxGarmin() {
  const appels = [];
  const f = async (url, init) => {
    appels.push({ url: String(url), init: init || {} });
    const u = new URL(url);
    const rep = (st, corps) => ({ ok: st < 400, status: st, json: async () => corps, text: async () => JSON.stringify(corps) });
    if (u.hostname === 'diauth.garmin.com') return rep(200, { access_token: 'acc-' + appels.length, refresh_token: 'ref-' + appels.length, expires_in: 86400, refresh_token_expires_in: 7775998 });
    if (u.pathname === '/wellness-api/rest/user/id') return rep(200, { userId: GUID });
    if (u.pathname === '/wellness-api/rest/user/registration') return rep(204, null);
    return rep(404, {});
  };
  return { f, appels };
}
function monde(initial, env) {
  const F = fausseBase(initial || {});
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl: F.fetchImpl });
  const G = fauxGarmin();
  let t = T0;
  const ctx = { db, env: env || ENV, fetchImpl: G.f, maintenant: () => t };
  return { F, db, G, ctx, g: creerGarmin(ctx), avancer: (ms) => { t += ms; } };
}
const pousser = (M, corps, o) => M.g.recevoir(new Request('https://w.t/garmin/push/' + (o && o.secret !== undefined ? o.secret : ENV.GARMIN_PUSH_SECRET), {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, (o && o.entetes) || {}), body: JSON.stringify(corps) }));
const relie = () => ({ garmin_uid: { [GUID]: CLE }, garmin_liens: { [CLE]: { uid: GUID, jeton: 'x', lieLe: T0 - 864e5 } } });

test('la plateforme garmin est déclarée, VFC en RMSSD par défaut', () => {
  assert.equal(PLATEFORMES.garmin, 'garmin');
  assert.equal(METHODE_DEFAUT.garmin, 'rmssd');
});

test('conversion PURE : pas, FC de repos, nuit (phases, coucher, lever), VFC RMSSD', () => {
  const r = garminVersJours({ dailies: [JOURNEE], sleeps: [NUIT], hrv: [VFC] });
  assert.equal(r.ignores, 0);
  assert.deepEqual(r.jours, { '2026-10-15': { pas: 8421, fcRepos: 52, sommeilMin: 450,
    phases: { profond: 90, leger: 240, paradoxal: 120, eveil: 25 }, coucher: '23:10', lever: '07:05', vfc: 61, vfcMethode: 'rmssd' } });
});

test('conversion : le résumé le plus récent du jour gagne ; sans calendarDate, le jour de Paris', () => {
  const tot = Object.assign({}, JOURNEE, { steps: 3000, durationInSeconds: 20000 });
  const r = garminVersJours({ dailies: [JOURNEE, tot] });
  assert.equal(r.jours['2026-10-15'].pas, 8421, 'la journée la plus longue est la plus récente');
  // 22 h 30 UTC le 14 = 0 h 30 le 15 à Paris.
  assert.equal(jourGarmin({ startTimeInSeconds: Date.parse('2026-10-14T22:30:00Z') / 1000 }), '2026-10-15');
  // Une nuit sans date : le jour du réveil.
  const n = Object.assign({}, NUIT); delete n.calendarDate;
  assert.deepEqual(Object.keys(garminVersJours({ sleeps: [n] }).jours), ['2026-10-15']);
  assert.equal(garminVersJours({ dailies: [{ steps: 5 }], sleeps: [{ calendarDate: '2026-10-15' }] }).ignores, 2);
});

test('un envoi rangé par utilisateur ; retraits (désinscription, permission HEALTH_EXPORT retirée)', () => {
  const g = garminParUtilisateur({ dailies: [JOURNEE, { userId: 'autre-9999', calendarDate: '2026-10-15', steps: 1 }, { steps: 2 }],
    deregistrations: [{ userId: 'parti-0001' }], userPermissionsChange: [{ userId: 'perm-0002', permissions: ['ACTIVITY_EXPORT'] }, { userId: 'perm-0003', permissions: ['HEALTH_EXPORT'] }] });
  assert.deepEqual(Object.keys(g.par).sort(), ['autre-9999', GUID]);
  assert.equal(g.ignores, 1);
  assert.deepEqual(g.retraits.sort(), ['parti-0001', 'perm-0002']);
});

test('un envoi Garmin s’écrit EXACTEMENT comme la même journée Health Connect (hors origine)', async () => {
  const M = monde(relie());
  const r = await pousser(M, { dailies: [JOURNEE], sleeps: [NUIT], hrv: [VFC] });
  assert.equal(r.statut, 200);
  assert.deepEqual(r.corps, { jours: 1, ignores: 0, inconnus: 0 });
  const g = M.F.lire('sante_sync/' + CLE + '/jours/2026-10-15');
  // La même journée, envoyée par l'APK Health Connect :
  const H = monde();
  const jt = await santeJeton({ auth: LEA, data: { action: 'creer' } }, H.ctx);
  const conv = garminVersJours({ dailies: [JOURNEE], sleeps: [NUIT], hrv: [VFC] }).jours['2026-10-15'];
  const hc = await recevoirSante(new Request('https://s.t/sante/i/' + jt.jeton, { method: 'POST',
    body: JSON.stringify({ v: 1, plateforme: 'android', source: 'healthconnect', jours: { '2026-10-15': conv } }) }), H.ctx);
  assert.equal(hc.statut, 200);
  const h = H.F.lire('sante_sync/' + CLE + '/jours/2026-10-15');
  const sans = (x) => { const c = Object.assign({}, x); delete c.origines; return c; };
  assert.deepEqual(sans(g), sans(h));
  assert.deepEqual(g.origines, { pas: 'garmin', sommeil: 'garmin', fcRepos: 'garmin', vfc: 'garmin' });
  assert.equal(h.origines, undefined, 'Health Connect ne marque rien');
  const meta = M.F.lire('sante_sync/' + CLE + '/meta');
  assert.equal(meta.derniereReception, T0);
  assert.equal(meta.origines, undefined, 'l’origine du compte (celle de Health Connect) n’est pas touchée');
  assert.deepEqual(meta.garmin.dernierEnvoi, { jours: 1, nuits: 1 });
});

test('bornes : les mêmes que Health Connect, les rejets comptés dans ignores', async () => {
  const M = monde(relie());
  const r = await pousser(M, { dailies: [Object.assign({}, JOURNEE, { steps: 150000, restingHeartRateInBeatsPerMinute: 20 })],
    hrv: [Object.assign({}, VFC, { lastNightAvg: 400 })], sleeps: [Object.assign({}, NUIT, { calendarDate: '2026-08-01' })] });
  assert.equal(r.statut, 200);
  // pas, FC, VFC hors bornes (3) ; la nuit hors de la fenêtre de 30 jours (1) ; le jour resté vide (1).
  assert.equal(r.corps.ignores, 5);
  assert.equal(r.corps.jours, 0);
  assert.equal(M.F.lire('sante_sync/' + CLE + '/jours/2026-10-15'), null);
  assert.equal(M.F.lire('sante_sync/' + CLE + '/jours/2026-08-01'), null);
});

test('doublon avec Health Connect : la source la plus récente gagne, et son origine est notée', async () => {
  const M = monde(relie());
  const jt = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  const hc = (jours) => recevoirSante(new Request('https://s.t/sante/i/' + jt.jeton, { method: 'POST',
    body: JSON.stringify({ v: 1, plateforme: 'android', source: 'healthconnect', jours }) }), M.ctx);
  await hc({ '2026-10-15': { pas: 5000, sommeilMin: 400, coucher: '23:40', phases: { profond: 60, leger: 300 } } });
  M.avancer(60e3);
  await pousser(M, { dailies: [JOURNEE], sleeps: [NUIT] });
  let j = M.F.lire('sante_sync/' + CLE + '/jours/2026-10-15');
  assert.equal(j.pas, 8421); assert.equal(j.sommeilMin, 450); assert.equal(j.coucher, '23:10');
  assert.deepEqual(j.phases, { profond: 90, leger: 240, paradoxal: 120, eveil: 25 });
  assert.equal(j.origines.pas, 'garmin'); assert.equal(j.origines.sommeil, 'garmin');
  // Health Connect repasse ensuite avec les pas seuls : ils gagnent, la nuit Garmin reste.
  M.avancer(60e3);
  await hc({ '2026-10-15': { pas: 9000 } });
  j = M.F.lire('sante_sync/' + CLE + '/jours/2026-10-15');
  assert.equal(j.pas, 9000);
  assert.equal(j.origines.pas, undefined);
  assert.equal(j.origines.sommeil, 'garmin');
  assert.equal(j.sommeilMin, 450);
  // Une nuit Garmin sans heures n'hérite pas de celles d'une autre source.
  M.avancer(60e3);
  await hc({ '2026-10-15': { sommeilMin: 420, coucher: '22:00', lever: '05:00' } });
  const n = Object.assign({}, NUIT); delete n.startTimeInSeconds;
  M.avancer(60e3);
  await pousser(M, { sleeps: [n] });
  j = M.F.lire('sante_sync/' + CLE + '/jours/2026-10-15');
  assert.equal(j.sommeilMin, 450); assert.equal(j.coucher, undefined); assert.equal(j.lever, undefined);
});

test('signature de push invalide → 401, rien n’est lu ni écrit', async () => {
  const M = monde(relie());
  assert.equal((await pousser(M, { dailies: [JOURNEE] }, { secret: 'mauvais' })).statut, 401);
  assert.equal((await pousser(M, { dailies: [JOURNEE] }, { secret: '' })).statut, 401);
  assert.equal((await pousser(M, { dailies: [JOURNEE] }, { entetes: { 'garmin-client-id': 'un-autre-client' } })).statut, 401);
  assert.equal(M.F.lire('sante_sync'), null);
  // Le bon en-tête passe.
  assert.equal((await pousser(M, { dailies: [JOURNEE] }, { entetes: { 'garmin-client-id': ENV.GARMIN_CLIENT_ID } })).statut, 200);
  // JSON illisible : 400.
  const r = await M.g.recevoir(new Request('https://w.t/garmin/push/' + ENV.GARMIN_PUSH_SECRET, { method: 'POST', body: '{pas du json' }));
  assert.equal(r.statut, 400);
});

test('un utilisateur Garmin inconnu est ignoré, sans erreur (Garmin veut un 200)', async () => {
  const M = monde();
  const r = await pousser(M, { dailies: [JOURNEE] });
  assert.equal(r.statut, 200);
  assert.deepEqual(r.corps, { jours: 0, ignores: 0, inconnus: 1 });
  assert.equal(M.F.lire('sante_sync'), null);
});

test('fermé sans les quatre secrets : push 404, /fn/garmin dit dispo:false', async () => {
  const env = Object.assign({}, ENV); delete env.GARMIN_CLE;
  assert.equal(garminOuvert(env), false); assert.equal(garminOuvert(ENV), true);
  const M = monde(relie(), env);
  assert.equal((await pousser(M, { dailies: [JOURNEE] })).statut, 404);
  const e = await M.g.appel({ auth: LEA, data: { action: 'etat' } });
  assert.equal(e.dispo, false);
  await assert.rejects(M.g.appel({ auth: LEA, data: { action: 'lier' } }), /pas encore ouverte/);
});

test('liaison OAuth PKCE : lier → Garmin (S256) → retour ; jetons chiffrés, identifiant routé', async () => {
  const M = monde();
  const { url } = await M.g.appel({ auth: LEA, data: { action: 'lier' } }, new Request('https://w.t/fn/garmin'));
  const s = new URL(url).searchParams.get('s');
  assert.equal(new URL(url).pathname, '/garmin/lier');
  const r1 = await M.g.lier(new Request(url));
  assert.equal(r1.status, 302);
  const loc = new URL(r1.headers.get('Location'));
  assert.equal(loc.origin + loc.pathname, GARMIN_AUTORISER);
  assert.equal(loc.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(loc.searchParams.get('client_id'), ENV.GARMIN_CLIENT_ID);
  assert.equal(loc.searchParams.get('redirect_uri'), 'https://w.t/garmin/retour');
  assert.equal(loc.searchParams.get('state'), s);
  const r2 = await M.g.retour(new Request('https://w.t/garmin/retour?code=abc&state=' + s));
  assert.equal(r2.headers.get('Location'), 'https://app.test/app/?garmin=ok');
  // Le vérificateur envoyé à Garmin correspond au défi montré à l'autorisation.
  const echange = M.G.appels.find((a) => a.url.includes('diauth'));
  const corps = new URLSearchParams(echange.init.body);
  assert.equal(corps.get('grant_type'), 'authorization_code');
  assert.equal(await defiPkce(corps.get('code_verifier')), loc.searchParams.get('code_challenge'));
  const lien = M.F.lire('garmin_liens/' + CLE);
  assert.equal(lien.uid, GUID);
  assert.equal(M.F.lire('garmin_uid/' + GUID), CLE);
  assert.ok(JSON.stringify(M.F.lire('')).indexOf('acc-') < 0, 'aucun jeton Garmin en clair dans la base');
  assert.equal((await dechiffrer(lien.jeton, ENV)).a.slice(0, 4), 'acc-');
  assert.equal(M.F.lire('garmin_etats'), null, 'l’état ne sert qu’une fois');
  const e = await M.g.appel({ auth: LEA, data: { action: 'etat' } });
  assert.equal(e.dispo, true); assert.equal(e.lie, true);
  // Rejouer le retour : l'état a disparu.
  assert.equal((await M.g.retour(new Request('https://w.t/garmin/retour?code=abc&state=' + s))).headers.get('Location'), 'https://app.test/app/?garmin=expire');
});

test('refus chez Garmin, état expiré : retour à l’app, rien de relié', async () => {
  const M = monde();
  const { url } = await M.g.appel({ auth: LEA, data: { action: 'lier' } });
  const s = new URL(url).searchParams.get('s');
  const r = await M.g.retour(new Request('https://w.t/garmin/retour?error=access_denied&state=' + s));
  assert.equal(r.headers.get('Location'), 'https://app.test/app/?garmin=refus');
  const { url: u2 } = await M.g.appel({ auth: LEA, data: { action: 'lier' } });
  M.avancer(11 * 60e3);
  assert.equal((await M.g.lier(new Request(u2))).headers.get('Location'), 'https://app.test/app/?garmin=expire');
  assert.equal(M.F.lire('garmin_liens'), null);
});

test('révocation depuis l’app : DELETE chez Garmin (jeton rafraîchi), liaison et méta effacées', async () => {
  const M = monde({ sante_sync: { [CLE]: { meta: { garmin: { lieLe: 1 } }, jours: { '2026-10-15': { pas: 10 } } } } });
  const jeton = await chiffrer({ a: 'vieux', r: 'ref-0', ea: T0 - 1, er: T0 + 864e5 }, ENV);
  await M.db.ref('').update({ ['garmin_liens/' + CLE]: { uid: GUID, jeton, lieLe: 1 }, ['garmin_uid/' + GUID]: CLE });
  const r = await M.g.appel({ auth: LEA, data: { action: 'revoquer' } });
  assert.deepEqual(r, { lie: false });
  const del = M.G.appels.find((a) => a.url.endsWith('/user/registration'));
  assert.equal(del.init.method, 'DELETE');
  assert.ok(/^Bearer acc-/.test(del.init.headers.Authorization), 'jeton expiré : rafraîchi avant l’appel');
  assert.equal(M.F.lire('garmin_liens/' + CLE), null);
  assert.equal(M.F.lire('garmin_uid/' + GUID), null);
  assert.equal(M.F.lire('sante_sync/' + CLE + '/meta/garmin'), null);
  assert.equal(M.F.lire('sante_sync/' + CLE + '/jours/2026-10-15/pas'), 10, 'le suivi déjà reçu reste');
});

test('révocation côté Garmin (deregistrations) : la liaison tombe, les envois suivants sont ignorés', async () => {
  const M = monde(Object.assign(relie(), { sante_sync: { [CLE]: { meta: { garmin: { lieLe: 1 } } } } }));
  const r = await pousser(M, { deregistrations: [{ userId: GUID }] });
  assert.equal(r.statut, 200);
  assert.equal(M.F.lire('garmin_liens/' + CLE), null);
  assert.equal(M.F.lire('garmin_uid/' + GUID), null);
  assert.equal((await pousser(M, { dailies: [JOURNEE] })).corps.inconnus, 1);
});

test('une source garmin est refusée par /sante/i (elle ne vient que du Worker)', async () => {
  const M = monde();
  const jt = await santeJeton({ auth: LEA, data: { action: 'creer' } }, M.ctx);
  const r = await recevoirSante(new Request('https://s.t/sante/i/' + jt.jeton, { method: 'POST',
    body: JSON.stringify({ v: 1, plateforme: 'garmin', source: 'garmin', jours: { '2026-10-15': { pas: 1 } } }) }), M.ctx);
  assert.equal(r.statut, 400);
});

test('index.js : /garmin/push route et répond 401 sans le secret', async () => {
  const r = await worker.fetch(new Request('https://w.t/garmin/push/faux', { method: 'POST', body: '{}' }),
    Object.assign({ FIREBASE_DB_URL: 'https://b.t', FIREBASE_DB_SECRET: 's' }, ENV), { waitUntil() {} });
  assert.equal(r.status, 401);
});
