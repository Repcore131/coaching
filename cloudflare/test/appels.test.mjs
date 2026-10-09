// Les appels de l'app : le jeton Firebase (RS256) et la suppression Cloudinary.
//   node cloudflare/test/appels.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifierJeton, repondreAppel } from '../src/appels.js';
import { cloudinaryDestroy, cloudinarySigner, signatureCloudinary, LIMITE_SIGNATURES_HEURE } from '../src/medias.js';
import { creerBase } from '../src/base.js';
import { fausseBase } from './fausse-base.mjs';
import { creerMetier } from '../src/metier.js';
import { creerAppelsDroits, programmeDuModele, configReelle } from '../src/droits-appels.js';
import { creerEssai } from '../src/essai.js';
import { ErreurAppel } from '../src/appels.js';
import { planifierDroitsCoachs } from '../src/migration.js';
import { CREATOR_EMAIL } from '../src/metier.js';
import { estCreateur, reconnaitCreateur, CREATEUR_UID, UID_A_POSER } from '../src/createur.js';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };

// Une paire RSA « Google » d'essai, et de quoi signer des jetons.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'k1', alg: 'RS256', use: 'sig' });
const cleVerif = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
const CLES = { k1: cleVerif };
const PROJET = 'repcore-sync';
function jeton(corps, o) {
  const b = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
  const s = Math.floor(Date.now() / 1000);
  const t = b({ alg: 'RS256', kid: (o && o.kid) || 'k1' }) + '.' + b(Object.assign({ aud: PROJET, iss: 'https://securetoken.google.com/' + PROJET,
    iat: s - 10, exp: s + 3600, sub: 'uid1', email: 'Lea@T.fr' }, corps));
  return t + '.' + crypto.sign('sha256', Buffer.from(t), privateKey).toString('base64url');
}

await test('un jeton Firebase valide rend l’adresse, en minuscules', async () => {
  const r = await verifierJeton(jeton({}), PROJET, { cles: CLES });
  assert.equal(r.email, 'lea@t.fr');
});
await test('refusés : autre projet, expiré, signature falsifiée, clé inconnue, sans adresse', async () => {
  const s = Math.floor(Date.now() / 1000);
  for (const [nom, j] of [['projet', jeton({ aud: 'autre' })], ['expiré', jeton({ exp: s - 1 })],
    ['clé', jeton({}, { kid: 'k9' })], ['adresse', jeton({ email: '' })]])
    await assert.rejects(() => verifierJeton(j, PROJET, { cles: CLES }), undefined, nom);
  const j = jeton({}); const faux = j.slice(0, -4) + (j.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  await assert.rejects(() => verifierJeton(faux, PROJET, { cles: CLES }), undefined, 'signature');
  // Et un corps réécrit avec la signature d'origine.
  const [t, , sig] = j.split('.');
  const autre = Buffer.from(JSON.stringify({ aud: PROJET, iss: 'https://securetoken.google.com/' + PROJET, iat: s, exp: s + 99, sub: 'x', email: 'pirate@t.fr' })).toString('base64url');
  await assert.rejects(() => verifierJeton(t + '.' + autre + '.' + sig, PROJET, { cles: CLES }), undefined, 'corps réécrit');
});

// La suppression : une base, un faux Cloudinary qui vérifie la signature.
function monde(users, extra) {
  const F = fausseBase(Object.assign({ users }, extra || {}));
  const vus = [];
  const fetchImpl = async (url, init) => {
    if (String(url).startsWith('https://api.cloudinary.com/')) {
      const p = Object.fromEntries(new URLSearchParams(init.body));
      const attendu = crypto.createHash('sha1').update('invalidate=true&public_id=' + p.public_id + '&timestamp=' + p.timestamp + 'SECRET').digest('hex');
      vus.push({ url, p, signatureOk: p.signature === attendu });
      return { status: 200, json: async () => ({ result: 'ok' }) };
    }
    return F.fetchImpl(url, init);
  };
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl });
  return { F, db, vus, ctx: { db, env: { CLOUDINARY_API_KEY: 'KEY', CLOUDINARY_API_SECRET: 'SECRET\n' }, fetchImpl, projet: PROJET, cles: CLES } };
}
// Léa est l'athlète de Kev : elle le désigne, et il l'a inscrite dans sa liste.
const USERS = { 'lea@t,fr': { id: 'u_lea', role: 'athlete', coachId: 'u_kev', coachEmailKey: 'kev@t,fr' },
  'kev@t,fr': { id: 'u_kev', role: 'coach' }, 'autre@t,fr': { id: 'u_autre', role: 'coach' } };
const INDEX = { medias_proprio: { u_lea: 'lea@t,fr', u_kev: 'kev@t,fr', u_autre: 'autre@t,fr' },
  coachs: { 'kev@t,fr': { clients: { 'lea@t,fr': true } } } };
const detruire = (w, email, publicId, extra) =>
  cloudinaryDestroy({ auth: { email }, data: Object.assign({ publicId, resourceType: 'image' }, extra) }, w.ctx);
const refus = (statut) => (e) => e.statut === statut;

await test('propriétaire : détruit, signature Cloudinary exacte (secret nettoyé)', async () => {
  const w = monde(USERS, INDEX);
  const r = await cloudinaryDestroy({ auth: { email: 'lea@t.fr' }, data: { publicId: 'repcore/u_lea/v1', resourceType: 'video' } }, w.ctx);
  assert.equal(r.result, 'ok');
  assert.equal(w.vus.length, 1);
  assert.ok(w.vus[0].signatureOk, 'signature SHA-1 des paramètres triés + secret');
  assert.match(w.vus[0].url, /\/dntu57ml\/video\/destroy$/);
  // Un ancien envoi rangé sous l'adresse appartient à l'adresse.
  assert.equal((await detruire(w, 'lea@t.fr', 'repcore/lea@t.fr/p0')).result, 'ok');
});
await test('coach réel (désigné ET inscrit dans sa liste) : détruit', async () => {
  const w = monde(USERS, INDEX);
  assert.equal((await detruire(w, 'kev@t.fr', 'repcore/u_lea/p1')).result, 'ok');
  assert.equal(w.vus.length, 1);
});
await test('id usurpé : 403', async () => {
  // 1. L'appelant nomme le média d'un autre.
  let w = monde(USERS, INDEX);
  await assert.rejects(() => detruire(w, 'autre@t.fr', 'repcore/u_lea/p1'), refus(403));
  // 2. Le champ « proprietaire » de l'appel n'est plus cru.
  await assert.rejects(() => detruire(w, 'autre@t.fr', 'repcore/u_lea/p1', { proprietaire: 'autre@t.fr' }), refus(403));
  // 3. Un compte neuf recopie l'id de Léa dans son dossier et réclame l'index avant elle.
  w = monde(Object.assign({}, USERS, { 'pirate@t,fr': { id: 'u_lea', role: 'athlete' } }),
    Object.assign({}, INDEX, { medias_proprio: { u_lea: 'pirate@t,fr' } }));
  await assert.rejects(() => detruire(w, 'pirate@t.fr', 'repcore/u_lea/p1'), refus(403));
  // 4. L'index désigne un dossier dont l'id n'est pas celui-là.
  w = monde(USERS, Object.assign({}, INDEX, { medias_proprio: { u_lea: 'autre@t,fr' } }));
  await assert.rejects(() => detruire(w, 'autre@t.fr', 'repcore/u_lea/p1'), refus(403));
  // 5. L'adresse d'un autre en guise de dossier.
  await assert.rejects(() => detruire(w, 'autre@t.fr', 'repcore/lea@t.fr/p1'), refus(403));
  assert.equal(w.vus.length, 0, 'aucune destruction pour les refus');
});
await test('coach usurpé : 403', async () => {
  // 1. L'athlète désigne un coach qui ne l'a jamais inscrite (champ écrit par elle seule).
  let w = monde(Object.assign({}, USERS, { 'lea@t,fr': Object.assign({}, USERS['lea@t,fr'], { coachEmailKey: 'autre@t,fr' }) }), INDEX);
  await assert.rejects(() => detruire(w, 'autre@t.fr', 'repcore/u_lea/p1'), refus(403));
  // 2. Un coach s'inscrit Léa dans sa liste, alors qu'elle ne le désigne pas.
  w = monde(USERS, Object.assign({}, INDEX, { coachs: { 'kev@t,fr': { clients: { 'lea@t,fr': true } }, 'autre@t,fr': { clients: { 'lea@t,fr': true } } } }));
  await assert.rejects(() => detruire(w, 'autre@t.fr', 'repcore/u_lea/p1'), refus(403));
  // 3. Le coach d'avant : Léa ne le désigne plus, même s'il l'a gardée dans sa liste.
  w = monde(Object.assign({}, USERS, { 'lea@t,fr': Object.assign({}, USERS['lea@t,fr'], { coachEmailKey: null }) }), INDEX);
  await assert.rejects(() => detruire(w, 'kev@t.fr', 'repcore/u_lea/p1'), refus(403));
  assert.equal(w.vus.length, 0);
});
await test('index absent (compte d’avant l’index) : 409, la file de l’app attend', async () => {
  const w = monde(USERS);
  await assert.rejects(() => detruire(w, 'lea@t.fr', 'repcore/u_lea/p1'), refus(409));
});
await test('le compte Cloudinary vient du worker, jamais de l’appel', async () => {
  const w = monde(USERS, INDEX);
  await detruire(w, 'lea@t.fr', 'repcore/u_lea/p1', { cloudName: 'pirate' });
  assert.match(w.vus[0].url, /\/dntu57ml\/image\/destroy$/);
  w.ctx.env.CLOUDINARY_CLOUD_NAME = 'moncompte';
  await detruire(w, 'lea@t.fr', 'repcore/u_lea/p2', { cloudName: 'pirate' });
  assert.match(w.vus[1].url, /\/moncompte\/image\/destroy$/);
});
await test('identifiants refusés : hors repcore/, remontée de chemin, type inconnu', async () => {
  const w = monde(USERS);
  for (const [pid, t] of [['autre/u_lea/x', 'video'], ['repcore/../x', 'video'], ['repcore/u_lea/x', 'raw'], ['repcore/a[b]/x', 'image'], ['repcore/x@y#z/x', 'image']])
    await assert.rejects(() => cloudinaryDestroy({ auth: { email: 'lea@t.fr' }, data: { publicId: pid, resourceType: t } }, w.ctx), refus(400));
  assert.equal(w.vus.length, 0);
});
await test('sans secrets Cloudinary : « indisponible », et la file de l’app attend', async () => {
  const w = monde(USERS); w.ctx.env = {};
  await assert.rejects(() => cloudinaryDestroy({ auth: { email: 'lea@t.fr' }, data: { publicId: 'repcore/u_lea/v1', resourceType: 'video' } }, w.ctx),
    (e) => e.statut === 503);
});
await test('le protocole onCall : 401 sans jeton, {result} avec', async () => {
  const w = monde(USERS, INDEX);
  const req = (h) => new Request('https://s.t/fn/cloudinaryDestroy', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, h),
    body: JSON.stringify({ data: { publicId: 'repcore/u_lea/v1', resourceType: 'video' } }) });
  const sans = await repondreAppel(req({}), { cloudinaryDestroy }, w.ctx);
  assert.equal(sans.status, 401);
  const avec = await repondreAppel(req({ Authorization: 'Bearer ' + jeton({}) }), { cloudinaryDestroy }, w.ctx);
  assert.equal(avec.status, 200);
  assert.deepEqual(await avec.json(), { result: { result: 'ok', publicId: 'repcore/u_lea/v1' } });
  const inconnu = await repondreAppel(new Request('https://s.t/fn/rien', { method: 'POST', body: '{}' }), { cloudinaryDestroy }, w.ctx);
  assert.equal(inconnu.status, 404);
});


// ══ L'ENVOI SIGNÉ (cloudinarySigner, 01/10/2026) ═══════════════════════════
const TS = Date.UTC(2026, 9, 1, 8, 0, 0);
const signer = (w, email, data, t) => cloudinarySigner({ auth: { email }, data }, Object.assign({}, w.ctx, { maintenant: () => t || TS }));
await test('signature : celle de Cloudinary pour des paramètres connus (triés, secret nettoyé, SHA-1)', async () => {
  const w = monde(USERS, INDEX);
  const r = await signer(w, 'lea@t.fr', { dossier: 'repcore/u_lea/bilan', type: 'image' });
  const attendu = crypto.createHash('sha1').update('allowed_formats=jpg,png,webp&folder=repcore/u_lea/bilan&timestamp='
    + Math.floor(TS / 1000) + '&upload_preset=repcore_videos' + 'SECRET').digest('hex');
  assert.equal(r.signature, attendu);
  assert.equal(r.api_key, 'KEY'); assert.equal(r.cloud_name, 'dntu57ml'); assert.equal(r.resource_type, 'image');
  assert.equal(r.folder, 'repcore/u_lea/bilan'); assert.equal(r.timestamp, Math.floor(TS / 1000));
  assert.equal(await signatureCloudinary({ b: 2, a: 1, vide: '' }, 'S'), crypto.createHash('sha1').update('a=1&b=2S').digest('hex'));
  // public_id et vidéo : signés aussi.
  const v = await signer(w, 'lea@t.fr', { dossier: 'repcore/u_lea', type: 'video', publicId: 'bilan_1_2' });
  assert.equal(v.public_id, 'bilan_1_2'); assert.equal(v.allowed_formats, 'mp4,mov,webm'); assert.equal(v.resource_type, 'video');
});
await test('refus sans jeton : le protocole onCall répond 401 avant toute signature', async () => {
  const w = monde(USERS, INDEX);
  const req = new Request('https://s.t/fn/cloudinarySigner', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { dossier: 'repcore/u_lea', type: 'video' } }) });
  const r = await repondreAppel(req, { cloudinarySigner }, w.ctx);
  assert.equal(r.status, 401);
  assert.equal(w.F.lire('cloudinary_signatures'), null);
});
await test('refus d’un dossier d’un autre compte ; le vrai coach signe pour son athlète, un autre coach non', async () => {
  const w = monde(USERS, INDEX);
  await assert.rejects(() => signer(w, 'lea@t.fr', { dossier: 'repcore/u_autre', type: 'video' }), refus(403));
  await assert.rejects(() => signer(w, 'lea@t.fr', { dossier: 'repcore/audio/kev@t,fr', type: 'audio' }), refus(403));
  await assert.rejects(() => signer(w, 'autre@t.fr', { dossier: 'repcore/u_lea', type: 'image' }), refus(403));
  assert.ok((await signer(w, 'kev@t.fr', { dossier: 'repcore/u_lea/bilan', type: 'image' })).signature);
  assert.ok((await signer(w, 'kev@t.fr', { dossier: 'repcore/audio/lea@t,fr', type: 'audio', publicId: 'bilan_x_1' })).signature);
  assert.ok((await signer(w, 'lea@t.fr', { dossier: 'repcore/lea@t.fr', type: 'video' })).signature, 'ancien dossier à l’adresse');
  for (const d of ['autre/u_lea', 'repcore/u_lea/../u_autre', 'repcore/u_lea/Bilan2', 'repcore', ''])
    await assert.rejects(() => signer(w, 'lea@t.fr', { dossier: d, type: 'image' }), refus(400), d);
  await assert.rejects(() => signer(w, 'lea@t.fr', { dossier: 'repcore/u_lea', type: 'raw' }), refus(400));
  await assert.rejects(() => signer(w, 'lea@t.fr', { dossier: 'repcore/u_lea', type: 'video', publicId: '../x' }), refus(400));
});
await test('limite : 30 signatures par heure et par compte, la 31e refusée ; l’heure suivante repart', async () => {
  const w = monde(USERS, INDEX);
  for (let i = 0; i < LIMITE_SIGNATURES_HEURE; i++) await signer(w, 'lea@t.fr', { dossier: 'repcore/u_lea', type: 'video' });
  await assert.rejects(() => signer(w, 'lea@t.fr', { dossier: 'repcore/u_lea', type: 'video' }), refus(429));
  assert.ok((await signer(w, 'kev@t.fr', { dossier: 'repcore/u_lea', type: 'video' })).signature, 'un autre compte a sa propre limite');
  assert.ok((await signer(w, 'lea@t.fr', { dossier: 'repcore/u_lea', type: 'video' }, TS + 3600e3)).signature);
});
await test('sans secret configuré : 503, l’envoi reste en file', async () => {
  const w = monde(USERS, INDEX);
  await assert.rejects(() => cloudinarySigner({ auth: { email: 'lea@t.fr' }, data: { dossier: 'repcore/u_lea', type: 'video' } },
    Object.assign({}, w.ctx, { env: {} })), refus(503));
});

// ══ LES DROITS PAR LE SERVEUR (droits-appels.js) ══════════════════════════
const JMS = 86400000, MMS = 30 * JMS, T0 = Date.UTC(2026, 8, 30, 10);
function mondeDroits(initial) {
  const F = fausseBase(initial);
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl: F.fetchImpl });
  const w = { F, t: T0 };
  const M = creerMetier({ db, vapid: { publique: 'x', privee: 'y' }, fetchImpl: F.fetchImpl, maintenant: () => w.t });
  w.A = Object.assign(creerAppelsDroits({ db, M, maintenant: () => w.t }), creerEssai({ db, M, maintenant: () => w.t }));
  w.appel = (nom, email, data) => w.A[nom]({ auth: { email }, data: data || {} });
  return w;
}
const CODE = (x) => Object.assign({ coachEmailKey: 'kev@t,fr', coachEmail: 'kev@t.fr', coachId: 'u_kev', coachName: 'Kev',
  type: 'athlete', active: true, redeemed: false, months: 3, expiry: T0 + 3 * MMS, grantedBy: 'coach' }, x);
const refusA = (statut) => (e) => e instanceof ErreurAppel && e.statut === statut;

await test('redeemCode : un code de coach enregistré ouvre le suivi, pose coachEmailKey et consomme le code', async () => {
  const w = mondeDroits({ coachs_registre: { 'kev@t,fr': { plan: 'libre', le: 1 } }, rc_codes: { 'RC-AAAA-BBBB': CODE() } });
  const r = await w.appel('redeemCode', 'lea@t.fr', { code: 'rc-aaaa-bbbb' });
  assert.equal(r.ok, true);
  const d = w.F.lire('droits/lea@t,fr');
  assert.equal(d.palier, 'suivi'); assert.equal(d.source, 'code_coach'); assert.equal(d.echeance, T0 + 3 * MMS);
  assert.equal(w.F.lire('users/lea@t,fr/coachEmailKey'), 'kev@t,fr');
  assert.equal(w.F.lire('users/lea@t,fr/coachId'), 'u_kev');
  assert.equal(w.F.lire('users/lea@t,fr/status'), 'COACHING_SUIVI');
  assert.equal(w.F.lire('users/lea@t,fr/updatedAt'), T0);
  assert.equal(w.F.lire('rc_codes/RC-AAAA-BBBB/redeemed'), true);
  assert.equal(w.F.lire('rc_codes/RC-AAAA-BBBB/athleteEmail'), 'lea@t.fr');
});
await test('redeemCode : la cadence des Réglages de coaching passe au dossier neuf, jamais sur une cadence posée', async () => {
  const w = mondeDroits({ coachs_registre: { 'kev@t,fr': { plan: 'libre', le: 1 } },
    rc_codes: { 'RC-CCCC-DDDD': CODE({ bilanCadence: { freq: 1, jour: 1 } }), 'RC-EEEE-FFFF': CODE({ bilanCadence: { freq: 4, jour: 3 } }) },
    users: { 'max@t,fr': { bilanCadence: { freq: 2, jour: 6 } } } });
  await w.appel('redeemCode', 'lea@t.fr', { code: 'RC-CCCC-DDDD' });
  assert.deepEqual(w.F.lire('users/lea@t,fr/bilanCadence'), { freq: 1, jour: 1 });
  await w.appel('redeemCode', 'max@t.fr', { code: 'RC-EEEE-FFFF' });
  assert.deepEqual(w.F.lire('users/max@t,fr/bilanCadence'), { freq: 2, jour: 6 }, 'la cadence en place reste');
});
await test('redeemCode : un code FORGÉ par un compte qui n’est pas coach est refusé, rien n’est écrit', async () => {
  const w = mondeDroits({ rc_codes: { 'RC-FAUX-CODE': CODE({ coachEmailKey: 'pirate@t,fr', coachEmail: 'pirate@t.fr', months: 99, expiry: T0 + 99 * MMS }) } });
  await assert.rejects(() => w.appel('redeemCode', 'pirate2@t.fr', { code: 'RC-FAUX-CODE' }), refusA(403));
  assert.equal(w.F.lire('droits/pirate2@t,fr'), null);
  assert.equal(w.F.lire('rc_codes/RC-FAUX-CODE/redeemed'), false);
  assert.equal(w.F.lire('users/pirate2@t,fr'), null);
});
await test('redeemCode : les mois sont plafonnés à 12 pour un affilié, quoi que dise le code', async () => {
  const w = mondeDroits({ coachs_registre: { 'kev@t,fr': { plan: 'libre' } },
    rc_codes: { 'RC-LONG-CODE': CODE({ months: 60, expiry: T0 + 60 * MMS, grantedBy: 'creator', creatorFree: true }),
      'RC-SANS-MOIS': CODE({ months: 0, expiry: T0 + 40 * MMS }) } });
  const r = await w.appel('redeemCode', 'lea@t.fr', { code: 'RC-LONG-CODE' });
  assert.equal(r.echeance, T0 + 12 * MMS);
  assert.equal(w.F.lire('droits/lea@t,fr/echeance'), T0 + 12 * MMS);
  const r2 = await w.appel('redeemCode', 'tom@t.fr', { code: 'RC-SANS-MOIS' });
  assert.equal(r2.echeance, T0 + 12 * MMS, 'sans months : l’expiry, plafonnée aussi');
});
await test('redeemCode : le créateur n’est pas plafonné', async () => {
  const w = mondeDroits({ rc_codes: { 'RC-CREA-TEUR': CODE({ coachEmailKey: 'guellec,coachingpro@gmail,com', months: 24, expiry: T0 + 24 * MMS }) } });
  const r = await w.appel('redeemCode', 'lea@t.fr', { code: 'RC-CREA-TEUR' });
  assert.equal(r.echeance, T0 + 24 * MMS);
});
await test('redeemCode : double consommation refusée ; le même compte peut rejouer sans rien rallonger', async () => {
  const w = mondeDroits({ coachs_registre: { 'kev@t,fr': { plan: 'libre' } }, rc_codes: { 'RC-AAAA-BBBB': CODE() } });
  await w.appel('redeemCode', 'lea@t.fr', { code: 'RC-AAAA-BBBB' });
  await assert.rejects(() => w.appel('redeemCode', 'tom@t.fr', { code: 'RC-AAAA-BBBB' }), refusA(409));
  assert.equal(w.F.lire('droits/tom@t,fr'), null);
  w.t += 20 * JMS;
  const r = await w.appel('redeemCode', 'lea@t.fr', { code: 'RC-AAAA-BBBB' });
  assert.equal(r.deja, true);
  assert.equal(w.F.lire('droits/lea@t,fr/echeance'), T0 + 3 * MMS, 'rejouer ne rallonge pas');
});
// ══ LE PROGRAMME DE DÉPART D'UNE INVITATION EN LOT (05/10/2026) ═══════════
const SEANCE = (nom, x) => Object.assign({ name: nom, active: true, exercises: [{ name: 'Squat', series: 3, reps: '8' }] }, x);
const MODELES = [{ id: 'p_force', name: 'Force 3j', majAt: 7, sessions_H: [SEANCE('A'), SEANCE('B', { _essai: true })], sessions_F: [SEANCE('F1')] },
  { id: 'p_homme', name: 'Hommes', publicVise: 'H', sessions_H: [SEANCE('H1')], sessions_F: [] }];
await test('redeemCode : programmeModeleId pose le modèle du coach dans sessions_config, sans _essai, et le renvoie', async () => {
  const w = mondeDroits({ coachs_registre: { 'kev@t,fr': { plan: 'libre' } }, users: { 'kev@t,fr': { coachPrograms: MODELES } },
    rc_codes: { 'RC-PROG-AAAA': CODE({ programmeModeleId: 'p_force' }) } });
  const r = await w.appel('redeemCode', 'lea@t.fr', { code: 'RC-PROG-AAAA' });
  assert.equal(r.programme.assignedProgramId, 'p_force');
  const sc = w.F.lire('users/lea@t,fr/sessions_config');
  const l = Array.isArray(sc) ? sc : Object.values(sc);
  assert.deepEqual(l.map((s) => s.name), ['A', 'B']);
  assert.ok(l.every((s) => !s._essai && !s._foundation), 'aucun _essai');
  assert.equal(configReelle(sc), true);
  assert.equal(w.F.lire('users/lea@t,fr/assignedProgramName'), 'Force 3j');
  assert.equal(w.F.lire('users/lea@t,fr/assignedProgramVersion'), 7);
  assert.equal(w.F.lire('users/kev@t,fr/coachPrograms/0/sessions_H/1/_essai'), true, 'le modèle du coach n’est pas touché');
});
await test('redeemCode : programmeModeleId — genre, modèle absent, programme déjà réel', async () => {
  const w = mondeDroits({ coachs_registre: { 'kev@t,fr': { plan: 'libre' } },
    users: { 'kev@t,fr': { coachPrograms: MODELES }, 'zoe@t,fr': { gender: 'F' }, 'tom@t,fr': { sessions_config: [SEANCE('Mien')] } },
    rc_codes: { 'RC-PROG-ZOEE': CODE({ programmeModeleId: 'p_force' }), 'RC-PROG-HOMM': CODE({ programmeModeleId: 'p_homme' }),
      'RC-PROG-ABSE': CODE({ programmeModeleId: 'p_supprime' }), 'RC-PROG-TOMM': CODE({ programmeModeleId: 'p_force' }) } });
  assert.equal((await w.appel('redeemCode', 'zoe@t.fr', { code: 'RC-PROG-ZOEE' })).programme.assignedProgramGenre, 'F');
  assert.equal(w.F.lire('users/zoe@t,fr/sessions_config/0/name'), 'F1');
  const h = await w.appel('redeemCode', 'ana@t.fr', { code: 'RC-PROG-HOMM' });
  assert.equal(h.programme.assignedProgramGenre, 'H', 'un modèle « Pour les hommes » ne livre que sa version H');
  const a = await w.appel('redeemCode', 'max@t.fr', { code: 'RC-PROG-ABSE' });
  assert.equal(a.ok, true); assert.equal(a.programme, null, 'modèle supprimé : le code vaut quand même, sans programme');
  assert.equal(w.F.lire('users/max@t,fr/sessions_config'), null);
  const t = await w.appel('redeemCode', 'tom@t.fr', { code: 'RC-PROG-TOMM' });
  assert.equal(t.programme, null, 'un programme réel déjà en place n’est pas remplacé');
  assert.equal(w.F.lire('users/tom@t,fr/sessions_config/0/name'), 'Mien');
});
await test('programmeDuModele : identifiant invalide ou modèle vide → null (PURE)', () => {
  assert.equal(programmeDuModele(MODELES, '../x', 'H', 1), null);
  assert.equal(programmeDuModele(MODELES, 'x'.repeat(65), 'H', 1), null);
  assert.equal(programmeDuModele([{ id: 'v', sessions_H: [], sessions_F: [] }], 'v', 'H', 1), null);
  assert.equal(programmeDuModele({ a: MODELES[0] }, 'p_force', 'H', 1).assignedProgramName, 'Force 3j', 'objet Firebase lu comme un tableau');
});
await test('redeemCode : désactivé, expiré, invitation coach — refusés', async () => {
  const w = mondeDroits({ coachs_registre: { 'kev@t,fr': { plan: 'libre' } },
    rc_codes: { 'RC-OFFF-OFFF': CODE({ active: false }), 'RC-VIEU-VIEU': CODE({ expiry: T0 - 1 }), 'RC-COAC-HHHH': CODE({ type: 'coach' }) } });
  await assert.rejects(() => w.appel('redeemCode', 'lea@t.fr', { code: 'RC-OFFF-OFFF' }), refusA(403));
  await assert.rejects(() => w.appel('redeemCode', 'lea@t.fr', { code: 'RC-VIEU-VIEU' }), refusA(403));
  await assert.rejects(() => w.appel('redeemCode', 'lea@t.fr', { code: 'RC-COAC-HHHH' }), refusA(400));
  await assert.rejects(() => w.appel('redeemCode', 'lea@t.fr', { code: 'n’importe quoi' }), refusA(400));
});
await test('redeemCode : un abonné Ultime en cours garde son palier ; le suivi passe par-dessus (suiviJusqu)', async () => {
  const w = mondeDroits({ coachs_registre: { 'kev@t,fr': { plan: 'libre' } }, rc_codes: { 'RC-AAAA-BBBB': CODE() },
    droits: { 'lea@t,fr': { palier: 'ultime', echeance: 0, source: 'paypal', abo: 'I-1' } } });
  await w.appel('redeemCode', 'lea@t.fr', { code: 'RC-AAAA-BBBB' });
  const d = w.F.lire('droits/lea@t,fr');
  assert.equal(d.palier, 'ultime'); assert.equal(d.abo, 'I-1'); assert.equal(d.suiviJusqu, T0 + 3 * MMS);
});
await test('ouvrirEssai : Ultime pendant TARIFS.essai.jours, une seule fois par compte ; pas pour un coach', async () => {
  const w = mondeDroits({ coachs_registre: { 'kev@t,fr': { plan: 'libre' } } });
  const r = await w.appel('ouvrirEssai', 'lea@t.fr', { jours: 400 });
  assert.equal(r.deja, false);
  const d = w.F.lire('droits/lea@t,fr');
  assert.equal(d.palier, 'ultime'); assert.equal(d.source, 'essai'); assert.equal(d.essaiOuvertLe, T0);
  assert.equal(d.echeance, T0 + 30 * JMS, 'la durée du serveur, pas celle demandée');
  w.t += 60 * JMS;
  const r2 = await w.appel('ouvrirEssai', 'lea@t.fr', {});
  assert.equal(r2.deja, true);
  assert.equal(w.F.lire('droits/lea@t,fr/echeance'), T0 + 30 * JMS);
  await assert.rejects(() => w.appel('ouvrirEssai', 'kev@t.fr', {}), refusA(400));
});
await test('devenirCoach : invitation du créateur → registre + rôle ; invitation d’un autre refusée ; place Libre comptée', async () => {
  const w = mondeDroits({ coachs_libres: { n: 199 }, rc_codes: {
    'RC-INVI-TEUR': CODE({ type: 'coach', coachEmailKey: 'guellec,coachingpro@gmail,com' }),
    'RC-INVI-FAUX': CODE({ type: 'coach', coachEmailKey: 'kev@t,fr' }) } });
  await assert.rejects(() => w.appel('devenirCoach', 'zoe@t.fr', { invitation: 'RC-INVI-FAUX' }), refusA(403));
  assert.equal(w.F.lire('coachs_registre/zoe@t,fr'), null);
  const r = await w.appel('devenirCoach', 'zoe@t.fr', { invitation: 'RC-INVI-TEUR' });
  assert.equal(r.plan, 'libre');
  assert.equal(w.F.lire('coachs_registre/zoe@t,fr/plan'), 'libre');
  assert.equal(w.F.lire('users/zoe@t,fr/role'), 'coach');
  assert.equal(w.F.lire('rc_codes/RC-INVI-TEUR/redeemed'), true);
  await assert.rejects(() => w.appel('devenirCoach', 'max@t.fr', { invitation: 'RC-INVI-TEUR' }), refusA(409));
  // Sans invitation : la dernière place Libre, puis plus rien.
  await w.appel('devenirCoach', 'max@t.fr', {});
  assert.equal(w.F.lire('coachs_libres/n'), 200);
  await assert.rejects(() => w.appel('devenirCoach', 'ben@t.fr', {}), refusA(409));
  assert.equal(w.F.lire('users/ben@t,fr'), null);
});
await test('prolongerCode : le coach du code repousse l’accès de l’athlète, plafonné à 12 mois ; un autre coach non', async () => {
  const w = mondeDroits({ coachs_registre: { 'kev@t,fr': { plan: 'libre' } }, rc_codes: { 'RC-AAAA-BBBB': CODE() } });
  await w.appel('redeemCode', 'lea@t.fr', { code: 'RC-AAAA-BBBB' });
  w.F.ecrire('rc_codes/RC-AAAA-BBBB/expiry', T0 + 30 * MMS);
  await assert.rejects(() => w.appel('prolongerCode', 'autre@t.fr', { code: 'RC-AAAA-BBBB' }), refusA(403));
  const r = await w.appel('prolongerCode', 'kev@t.fr', { code: 'RC-AAAA-BBBB' });
  assert.equal(r.applique, true);
  assert.equal(w.F.lire('droits/lea@t,fr/echeance'), T0 + 12 * MMS);
});
await test('le créateur se reconnaît à son UID et à une adresse vérifiée, jamais à son adresse seule', async () => {
  const w = mondeDroits({ coachs_registre: { 'kev@t,fr': { plan: 'libre' } }, rc_codes: { 'RC-AAAA-BBBB': CODE() } });
  await w.appel('redeemCode', 'lea@t.fr', { code: 'RC-AAAA-BBBB' });
  // L'adresse du créateur, sous un autre UID (compte Google ou lié) : refusé,
  // sur le code d'un coach comme sur un code émis par le créateur lui-même.
  await assert.rejects(() => w.A.prolongerCode({ auth: { email: CREATOR_EMAIL, uid: 'un-autre-uid', emailVerifie: true },
    data: { code: 'RC-AAAA-BBBB' } }), refusA(403));
  w.F.ecrire('rc_codes/RC-CREA-TEUR', Object.assign(CODE(), { coachEmail: CREATOR_EMAIL, coachEmailKey: 'guellec,coachingpro@gmail,com' }));
  await assert.rejects(() => w.A.prolongerCode({ auth: { email: CREATOR_EMAIL, uid: 'un-autre-uid', emailVerifie: true },
    data: { code: 'RC-CREA-TEUR' } }), refusA(403));
  const est = reconnaitCreateur('uidDuCreateur0000000000000ab');
  assert.equal(est({ email: CREATOR_EMAIL, uid: 'uidDuCreateur0000000000000ab', emailVerifie: true }), true);
  assert.equal(est({ email: CREATOR_EMAIL, uid: 'uidDuCreateur0000000000000ab', emailVerifie: false }), false, 'adresse non vérifiée');
  assert.equal(est({ email: CREATOR_EMAIL, uid: 'un-autre-uid', emailVerifie: true }), false, 'autre UID');
  assert.equal(est({ email: 'x@t.fr', uid: 'uidDuCreateur0000000000000ab', emailVerifie: true }), true, 'l’UID fait foi, pas l’adresse');
  // Tant que la constante n'est pas posée, PERSONNE n'est créateur.
  assert.equal(reconnaitCreateur(UID_A_POSER)({ uid: UID_A_POSER, emailVerifie: true }), false);
  if (CREATEUR_UID === UID_A_POSER) assert.equal(estCreateur({ email: CREATOR_EMAIL, uid: UID_A_POSER, emailVerifie: true }), false);
});

await test('emailVerifie : le serveur ne croit que le jeton ; il note la date une fois', async () => {
  const w = mondeDroits({});
  const j = await verifierJeton(jeton({ email_verified: true }), PROJET, { cles: CLES });
  assert.equal(j.emailVerifie, true);
  assert.equal((await verifierJeton(jeton({}), PROJET, { cles: CLES })).emailVerifie, false);
  await assert.rejects(() => w.A.emailVerifie({ auth: { email: 'lea@t.fr', emailVerifie: false }, data: { verifie: true } }), refusA(400));
  assert.equal(w.F.lire('parrainage/verifies/lea@t,fr'), null);
  await w.A.emailVerifie({ auth: { email: 'lea@t.fr', emailVerifie: true }, data: {} });
  assert.equal(w.F.lire('parrainage/verifies/lea@t,fr'), T0);
  w.t += JMS;
  await w.A.emailVerifie({ auth: { email: 'lea@t.fr', emailVerifie: true }, data: {} });
  assert.equal(w.F.lire('parrainage/verifies/lea@t,fr'), T0, 'la première date reste');
});
await test('remplir-droits : registre des coachs réels, suivi des athlètes au code consommé, rien pour un code forgé', async () => {
  const U = (x) => Object.assign({ role: 'athlete' }, x);
  const F = fausseBase({
    users: { 'kev@t,fr': U({ role: 'coach', coachPlan: 'libre' }), 'seul@t,fr': U({ role: 'coach' }),
      'pirate@t,fr': U({ role: 'coach' }),
      'lea@t,fr': U({ status: 'COACHING_SUIVI', coachEmailKey: 'kev@t,fr', accessExpiry: T0 + 2 * MMS }),
      'tom@t,fr': U({ status: 'COACHING_SUIVI', coachEmailKey: 'kev@t,fr' }),
      'zoe@t,fr': U({ status: 'COACHING_SUIVI' }),
      'max@t,fr': U({ status: 'COACHING_SUIVI', coachEmailKey: 'faux@t,fr' }),
      'ana@t,fr': U({ status: 'COACHING_SUIVI', accessExpiry: T0 + 99 * MMS }),
      'eve@t,fr': U({ status: 'FREE', essai: { ouvertLe: T0 - 5 * JMS, finit: T0 + 25 * JMS } }),
      'triche@t,fr': U({ status: 'FREE', essai: { ouvertLe: T0 - 5 * JMS, finit: T0 + 900 * JMS } }),
      'fini@t,fr': U({ status: 'FREE', essai: { ouvertLe: T0 - 90 * JMS, finit: T0 - 60 * JMS } }) },
    rc_codes: { 'RC-LEAA-0001': CODE({ redeemed: true, athleteEmail: 'lea@t.fr' }),
      'RC-TOMM-0001': CODE({ redeemed: true, athleteEmail: 'tom@t.fr' }),
      'RC-MAXX-0001': CODE({ coachEmailKey: 'faux@t,fr', redeemed: true, athleteEmail: 'max@t.fr' }),
      'RC-ANAA-0001': CODE({ coachEmailKey: 'guellec,coachingpro@gmail,com', redeemed: true, athleteEmail: 'ana@t.fr' }) } });
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl: F.fetchImpl });
  const { maj, rapport } = await planifierDroitsCoachs({ db, env: {}, fetchImpl: F.fetchImpl, maintenant: () => T0 });
  assert.deepEqual(Object.keys(maj).filter((k) => k.startsWith('coachs_registre/')), ['coachs_registre/kev@t,fr']);
  assert.deepEqual(rapport.coachsEcartes.sort(), ['pirate@t,fr', 'seul@t,fr']);
  assert.equal(maj['droits/lea@t,fr'].palier, 'suivi');
  assert.equal(maj['droits/lea@t,fr'].echeance, T0 + 2 * MMS);
  assert.equal(maj['droits/tom@t,fr'].echeance, T0 + 12 * MMS, 'sans échéance : 12 mois pour un affilié');
  assert.equal(maj['droits/ana@t,fr'].echeance, T0 + 99 * MMS, 'le créateur n’est pas plafonné');
  assert.equal(maj['droits/zoe@t,fr'], undefined, 'COACHING_SUIVI sans code : rien');
  assert.equal(maj['droits/max@t,fr'], undefined, 'code d’un coach qui n’existe pas : rien');
  assert.deepEqual(rapport.suivisSansCode.sort(), ['max@t,fr', 'zoe@t,fr']);
  assert.equal(maj['droits/eve@t,fr'].palier, 'ultime'); assert.equal(maj['droits/eve@t,fr'].echeance, T0 + 25 * JMS);
  assert.equal(maj['droits/triche@t,fr'].echeance, T0 + 55 * JMS, 'une fin forgée est bornée à 60 jours');
  assert.equal(maj['droits/fini@t,fr'].palier, 'aucun'); assert.equal(maj['droits/fini@t,fr'].essaiOuvertLe, T0 - 90 * JMS, 'l’essai passé compte : pas de second');
  const tous = await planifierDroitsCoachs({ db, env: {}, fetchImpl: F.fetchImpl, maintenant: () => T0, tousCoachs: true });
  assert.ok(tous.maj['coachs_registre/seul@t,fr'], '--tous-coachs');
});

console.log(ok + ' tests passés');
