// Le chiffrement RFC 8291 et le jeton VAPID, vérifiés du côté de l'APPAREIL :
// on déchiffre avec le module crypto de Node (implémentation indépendante),
// et on vérifie la signature ES256 avec la clé publique.
//   node cloudflare/test/push.test.mjs
import nodeCrypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chiffrer, jetonVapid, b64uVersOctets, octetsVersB64u, envoyerA } from '../src/push.js';
import { creerBase } from '../src/base.js';
import { creerMetier, fusionAttente, messageDuMatin, PRIO_PUSH, PUSH_PRIORITE, pushAutorise, prioDe, reserveSerieJeudi } from '../src/metier.js';
import { MESSAGE_RAPPEL } from '../src/sante.js';
import { minute, ESSAIS_MAX, consommerLot, travaux } from '../src/planif.js';
import { fausseBase, appareil } from './fausse-base.mjs';

const b64u = (b) => Buffer.from(b).toString('base64url');
let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };

// L'appareil : sa paire ECDH et son secret d'authentification.
const ua = nodeCrypto.createECDH('prime256v1'); ua.generateKeys();
const uaPublic = ua.getPublicKey();                 // 65 octets non compressés
const authSecret = nodeCrypto.randomBytes(16);

function hkdf(sel, ikm, info, n) {
  const prk = nodeCrypto.createHmac('sha256', sel).update(ikm).digest();
  return nodeCrypto.createHmac('sha256', prk).update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, n);
}
function dechiffrer(corps) {
  const b = Buffer.from(corps);
  const sel = b.subarray(0, 16);
  const rs = b.readUInt32BE(16);
  const idlen = b[20];
  const asPublic = b.subarray(21, 21 + idlen);
  const chiffre = b.subarray(21 + idlen);
  const secret = ua.computeSecret(asPublic);
  const ikm = hkdf(authSecret, secret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32);
  const cek = hkdf(sel, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(sel, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const tag = chiffre.subarray(chiffre.length - 16);
  const d = nodeCrypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(tag);
  const clair = Buffer.concat([d.update(chiffre.subarray(0, chiffre.length - 16)), d.final()]);
  assert.equal(clair[clair.length - 1], 2, 'délimiteur du dernier enregistrement');
  return { rs, texte: clair.subarray(0, clair.length - 1).toString('utf8') };
}

await test('le message chiffré se déchiffre chez l’appareil (RFC 8291)', async () => {
  const charge = JSON.stringify({ title: 'Ton coach a répondu à ton bilan', body: 'Belle régularité ⚡', url: './' });
  const corps = await chiffrer(charge, b64u(uaPublic), b64u(authSecret));
  const r = dechiffrer(corps);
  assert.equal(r.rs, 4096);
  assert.equal(r.texte, charge);
});

await test('deux envois du même message ne se ressemblent pas (sel et clé éphémère)', async () => {
  const a = await chiffrer('x', b64u(uaPublic), b64u(authSecret));
  const b = await chiffrer('x', b64u(uaPublic), b64u(authSecret));
  assert.notEqual(Buffer.from(a).toString('hex'), Buffer.from(b).toString('hex'));
});

// La paire VAPID du serveur.
const vapid = nodeCrypto.createECDH('prime256v1'); vapid.generateKeys();
const pub = b64u(vapid.getPublicKey()), priv = b64u(vapid.getPrivateKey());

await test('le jeton VAPID est un JWT ES256 valide pour l’origine du service', async () => {
  const j = await jetonVapid('https://fcm.googleapis.com/fcm/send/abc', pub, priv, 'mailto:x@y.fr', Date.UTC(2026, 8, 27));
  const [t, c, s] = j.split('.');
  const corps = JSON.parse(Buffer.from(c, 'base64url').toString());
  assert.equal(corps.aud, 'https://fcm.googleapis.com');
  assert.equal(corps.sub, 'mailto:x@y.fr');
  assert.equal(JSON.parse(Buffer.from(t, 'base64url').toString()).alg, 'ES256');
  const cle = nodeCrypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256',
    x: b64u(vapid.getPublicKey().subarray(1, 33)), y: b64u(vapid.getPublicKey().subarray(33)) }, format: 'jwk' });
  const valide = nodeCrypto.verify('sha256', Buffer.from(t + '.' + c), { key: cle, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'));
  assert.ok(valide, 'signature ES256');
});

await test('l’envoi pose les bons en-têtes et rend le statut du service', async () => {
  let vu = null;
  const r = await envoyerA({ endpoint: 'https://push.example/abc', keys: { p256dh: b64u(uaPublic), auth: b64u(authSecret) } }, '{"title":"x"}',
    { publique: pub, privee: priv, contact: 'mailto:x@y.fr', fetchImpl: async (url, init) => { vu = { url, init }; return { status: 201 }; } });
  assert.equal(r.statut, 201);
  assert.equal(vu.init.headers['Content-Encoding'], 'aes128gcm');
  assert.match(vu.init.headers.Authorization, /^vapid t=[^.]+\.[^.]+\.[^,]+, k=/);
  assert.equal(dechiffrer(vu.init.body).texte, '{"title":"x"}');
});

// ══ LES RÈGLES D'ENVOI DU SERVEUR (01/10/2026) ════════════════════════════
const cleVapid = nodeCrypto.createECDH('prime256v1'); cleVapid.generateKeys();
const VAPID = { publique: cleVapid.getPublicKey().toString('base64url'), privee: cleVapid.getPrivateKey().toString('base64url') };
const PARIS = (iso) => Date.parse(iso + '+02:00');
function monde(initial, t) {
  const F = fausseBase(initial);
  let n = 0, horloge = t;
  const f = (u, i) => { n++; return F.fetchImpl(u, i); };
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: f });
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: f, maintenant: () => horloge });
  M.coachsEtUsers = () => db.ref('users').shallow();
  return { F, db, M, avance: (ms) => { horloge += ms; }, get t() { return horloge; },
    minute: () => { n = 0; return minute({ db, M, compteur: () => n, maintenant: () => horloge }); } };
}
const LEA = 'lea@t,fr', tel = appareil('https://push.test/lea');

await test('deux messages de nuit : le mot du coach survit au défi, et l’envoi du matin dit « + 1 autre nouvelle »', async () => {
  const w = monde({ users: { [LEA]: {} }, push: { [LEA]: { a: tel.abonnement } } }, PARIS('2026-09-28T23:10:00'));
  const r1 = await w.M.envoyerPush(LEA, { type: 'coach', title: 'Ton coach a répondu', body: 'Belle séance.' });
  assert.equal(r1.raison, 'calme'); assert.equal(r1.differe, true);
  w.avance(20 * 60e3);
  await w.M.envoyerPush(LEA, { type: 'defi', title: 'Nouveau défi', body: '12 séances.' });
  const e = w.F.lire('push_attente/' + LEA);
  assert.equal(e.message.type, 'coach', 'le défi (2) ne remplace pas le coach (5)');
  assert.equal(e.prio, PRIO_PUSH.coach); assert.equal(e.cumul, 2);
  // Et l'inverse : un message d'égale ou de plus haute priorité remplace.
  assert.equal(fusionAttente({ message: { type: 'defi' }, at: 1, prio: 2, cumul: 1 }, { type: 'coach' }, 2).message.type, 'coach');
  assert.equal(fusionAttente({ message: { type: 'defi' }, at: 1, prio: 2, cumul: 1 }, { type: 'serie' }, 2).message.type, 'serie', 'égale : la plus récente');
  // L'ancien format (le message à plat) est relu.
  assert.equal(fusionAttente({ type: 'coach', title: 'x', at: 1 }, { type: 'defi' }, 2).message.type, 'coach');
  // Le matin : il part, et dit ce qu'il a absorbé.
  w.avance(9 * 3600e3);                            // 8 h 30 le lendemain
  await w.minute();
  await w.minute();
  assert.equal(w.F.recus.length, 1, 'un seul push le matin');
  const m = tel.lire(w.F.recus[0].init.body);
  assert.equal(m.title, 'Ton coach a répondu');
  assert.equal(m.body, 'Belle séance. + 1 autre nouvelle');
  assert.equal(w.F.lire('push_attente/' + LEA), null);
  assert.equal(messageDuMatin({ message: { body: 'a' }, cumul: 4 }).body, 'a + 3 autres nouvelles');
});

await test('503 de l’unique appareil : la tâche repart en file avec essais = 1, et le jour n’est pas consommé', async () => {
  const w = monde({ users: { [LEA]: {} }, push: { [LEA]: { a: tel.abonnement } },
    evenements: { e0000000001: { type: 'tache', quoi: 'push', uid: LEA, par: 'worker', at: 1, message: { type: 'coach', title: 'Bravo' } } } },
    PARIS('2026-09-28T12:00:00'));
  w.F.pushStatut = 503;
  const b = await w.minute();
  assert.equal(b.echecs, 1);
  const file = Object.values(w.F.lire('evenements') || {});
  assert.equal(file.length, 1, 'remise en file');
  assert.equal(file[0].essais, 1);
  assert.equal(file[0].erreur, 'push_transitoire');
  assert.equal(w.F.lire('push_log/' + LEA), null, 'push_log non consommé');
  // Le service revient : elle part, une fois.
  w.F.pushStatut = 201;
  w.avance(60e3);
  await w.minute();
  assert.equal(w.F.lire('evenements'), null);
  assert.equal(w.F.recus.filter((r) => r.endpoint === tel.abonnement.endpoint).length, 2, 'une tentative refusée, puis l’envoi');
  assert.ok(w.F.lire('push_log/' + LEA));
  // 429 compte aussi comme passager ; 410 reste « abonnement supprimé », sans retour en file.
  const w2 = monde({ users: { [LEA]: {} }, push: { [LEA]: { a: tel.abonnement } } }, PARIS('2026-09-28T12:00:00'));
  w2.F.pushStatut = 429;
  assert.equal((await w2.M.envoyerPush(LEA, { type: 'coach', title: 'x' })).raison, 'transitoire');
  w2.F.pushStatut = 410;
  assert.equal((await w2.M.envoyerPush(LEA, { type: 'coach', title: 'x' })).raison, 'echec');
  assert.equal(w2.F.lire('push/' + LEA), null);
  assert.ok(ESSAIS_MAX >= 2);
});

await test('mode file : differer envoie les push dans la file (paquets de 100), le reste dans /evenements ; pousserA n’envoie rien lui-même', async () => {
  const F = fausseBase({ users: { [LEA]: {} }, push: { [LEA]: { a: tel.abonnement } } });
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: F.fetchImpl });
  const paquets = [];
  const file = { async sendBatch(l) { paquets.push(l.map((m) => m.body)); } };
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: F.fetchImpl, maintenant: () => PARIS('2026-09-28T12:00:00'), file });
  assert.equal(M.enModeFile(), true);
  const pushs = Array.from({ length: 250 }, (_, i) => ({ quoi: 'push', uid: 'u' + i, message: { type: 'defi' } }));
  await M.differer(pushs.concat([{ quoi: 'paiement_suite', etape: 'parrainage', cle: LEA }]));
  assert.deepEqual(paquets.map((p) => p.length), [100, 100, 50]);
  const file0 = Object.values(F.lire('evenements') || {});
  assert.equal(file0.length, 1, 'seule la suite PayPal reste dans /evenements (son ordre compte)');
  assert.equal(file0[0].quoi, 'paiement_suite');
  const r = await M.pousser1(LEA, { type: 'coach', title: 'x' });
  assert.deepEqual(r, { envoyes: 0, differes: 1 });
  assert.equal(F.recus.length, 0, 'le consommateur envoie, pas l’appelant');
  assert.equal(paquets[3][0].uid, LEA);
  // Sans file : le chemin gratuit, inchangé.
  const M2 = creerMetier({ db, vapid: VAPID, fetchImpl: F.fetchImpl, maintenant: () => PARIS('2026-09-28T12:00:00') });
  assert.equal(M2.enModeFile(), false);
});

await test('consommateur : ack si envoyé, retry sur 503 (push_log intact), ack d’un abonnement supprimé (410)', async () => {
  const F = fausseBase({ users: { [LEA]: {} }, push: { [LEA]: { a: tel.abonnement } } });
  let n = 0;
  const f = (u, i) => { n++; return F.fetchImpl(u, i); };
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: f });
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: f, maintenant: () => PARIS('2026-09-28T12:00:00'), file: { async sendBatch() {} } });
  const lot = () => { const m = { body: { quoi: 'push', uid: LEA, message: { type: 'defi', title: 'x' } } };
    m.ack = () => { m.r = 'ack'; }; m.retry = () => { m.r = 'retry'; }; return { m, batch: { messages: [m] } }; };
  F.pushStatut = 503;
  let { m, batch } = lot();
  await consommerLot(batch, { M, compteur: () => n, budget: 900 });
  assert.equal(m.r, 'retry'); assert.equal(F.lire('push_log/' + LEA), null);
  F.pushStatut = 201;
  ({ m, batch } = lot());
  await consommerLot(batch, { M, compteur: () => n, budget: 900 });
  assert.equal(m.r, 'ack'); assert.ok(F.lire('push_log/' + LEA));
  F.ecrire('push_log/' + LEA, null);
  F.pushStatut = 410;
  ({ m, batch } = lot());
  await consommerLot(batch, { M, compteur: () => n, budget: 900 });
  assert.equal(m.r, 'ack', 'abonnement supprimé : rien à rejouer');
  assert.equal(F.lire('push/' + LEA), null, 'le 410 a bien retiré l’abonnement');
});

// ══ LA PRIORITÉ DES PUSH : deux par jour, le second pour la série ou un duel ══
const ZOE = 'zoe@t,fr', telZ = appareil('https://push.test/zoe');
const recusDe = (w, tel) => w.F.recus.filter((r) => r.endpoint === tel.abonnement.endpoint).map((r) => tel.lire(r.init.body));
const zoe = () => ({ fname: 'Zoé', streak: 3, streakWeek: '2026-09-21', lastSession: PARIS('2026-09-28T19:00:00') });

await test('(a) le défi des 48 h à 9 h, puis la série à 18 h : les deux partent', async () => {
  const w = monde({ users: { [ZOE]: zoe() }, push: { [ZOE]: { a: telZ.abonnement } } }, PARIS('2026-10-01T09:00:00'));
  const r1 = await w.M.envoyerPush(ZOE, { type: 'defi', tag: 'defi-48h-d1', title: 'Plus que 48 h', body: 'Ton défi se termine.' });
  assert.equal(r1.envoye, 1);
  assert.deepEqual(w.F.lire('push_log/' + ZOE), { jour: '2026-10-01', n: 1, at: w.t, type: 'defi', prio: 70 });
  w.avance(9 * 3600e3);                                      // jeudi 18 h
  assert.equal(await w.M.planifies.serie(ZOE, w.t), 'envoye');
  assert.deepEqual(recusDe(w, telZ).map((m) => m.title), ['Plus que 48 h', 'Ta série de 3 semaines est en danger']);
  const l = w.F.lire('push_log/' + ZOE);
  assert.equal(l.n, 2); assert.equal(l.type, 'serie'); assert.equal(l.prio, PUSH_PRIORITE.serie);
  // La réservation du jeudi : de 8 h à 18 h, une série non validée garde sa place.
  assert.equal(reserveSerieJeudi(PARIS('2026-10-01T11:00:00'), 3, '2026-09-21'), true);
  assert.equal(reserveSerieJeudi(PARIS('2026-10-01T11:00:00'), 3, '2026-09-28'), false, 'semaine validée');
  assert.equal(reserveSerieJeudi(PARIS('2026-10-01T18:00:00'), 3, '2026-09-21'), false, '18 h : la série parle');
  assert.equal(reserveSerieJeudi(PARIS('2026-10-02T11:00:00'), 3, '2026-09-21'), false, 'vendredi');
});

await test('(b) le rappel de santé, puis les réactions : les réactions sont refusées et attendent demain', async () => {
  const w = monde({ users: { [ZOE]: {} }, push: { [ZOE]: { a: telZ.abonnement } },
    reactions_push: { [ZOE]: { pk: 'zoe', jour: '2026-09-29', le: 1 } },
    reactions: { zoe: { '2026-09-29': { tom__fit: '💪' } } }, profils_publics: { tom__fit: { prenom: 'Tom' } } }, PARIS('2026-09-29T10:00:00'));
  assert.equal((await w.M.envoyerPush(ZOE, MESSAGE_RAPPEL, { attendre: false })).envoye, 1);
  w.avance(9 * 3600e3);                                      // 19 h
  assert.equal(await w.M.reactionsPushUn(ZOE, w.t), 'plafond', 'priorité 45 : pas de second push');
  assert.deepEqual(w.F.lire('reactions_push/' + ZOE), { pk: 'zoe', jour: '2026-09-29', le: 1 }, 'gardé pour le lendemain');
  w.avance(24 * 3600e3);                                     // le lendemain, 19 h
  assert.equal(await w.M.reactionsPushUn(ZOE, w.t), 'envoye');
  assert.equal(w.F.lire('reactions_push/' + ZOE), null, 'effacé après l’envoi');
  assert.deepEqual(recusDe(w, telZ).map((m) => m.title), [MESSAGE_RAPPEL.title, 'Tom a réagi à ta séance']);
});

await test('(e) un troisième push du jour, même de priorité 90, est refusé ; l’urgent passe toujours', async () => {
  const w = monde({ users: { [ZOE]: {} }, push: { [ZOE]: { a: telZ.abonnement } } }, PARIS('2026-09-29T12:00:00'));
  assert.equal((await w.M.envoyerPush(ZOE, { type: 'defi', title: '1' })).envoye, 1);
  assert.equal((await w.M.envoyerPush(ZOE, { type: 'defi', prio: 'duel_fin', title: '2' })).envoye, 1);
  assert.equal((await w.M.envoyerPush(ZOE, { type: 'defi', prio: 'duel_fin', title: '3' })).raison, 'plafond');
  assert.equal(w.F.lire('push_log/' + ZOE).n, 2);
  assert.equal((await w.M.envoyerPush(ZOE, { type: 'coach', title: 'Litige' }, { urgent: true })).envoye, 1, 'urgent : hors plafond');
  // Le pur : un second push de priorité ≥ 80 ne passe jamais en heures calmes.
  const log = { jour: '2026-09-29', n: 1, at: 1, type: 'defi', prio: 70 };
  assert.equal(pushAutorise('serie', null, log, PARIS('2026-09-29T22:00:00'), null, 85).raison, 'calme');
  assert.equal(pushAutorise('defi', null, log, PARIS('2026-09-29T15:00:00'), null, 79).raison, 'plafond');
  assert.equal(pushAutorise('defi', null, log, PARIS('2026-09-29T15:00:00'), null, 80).ok, true);
  // L'ancien journal ({jour, at, type}, sans n) compte pour un.
  assert.equal(pushAutorise('serie', null, { jour: '2026-09-29', at: 1, type: 'defi' }, PARIS('2026-09-29T18:00:00'), null, 85).ok, true);
  // Une sous-tâche différée garde sa priorité : elle voyage dans le message.
  assert.equal(prioDe({ type: 'defi', prio: 'duel_fin' }), 90);
  assert.equal(prioDe({ type: 'serie', prio: 'parcours' }), 60, 'le parcours n’hérite pas des 85 de la série');
});

await test('le dernier appel du samedi 10 h (serie_sam) et la réservation du jeudi pour l’accès', async () => {
  const sam = PARIS('2026-10-03T10:05:00');
  const w = monde({ users: { [ZOE]: zoe() }, push: { [ZOE]: { a: telZ.abonnement } } }, sam);
  assert.equal(await w.M.planifies.serieSamedi(ZOE, w.t), 'envoye');
  const m = recusDe(w, telZ)[0];
  assert.equal(m.title, 'Dernier week-end pour ta série de 3 semaines');
  assert.equal(m.body, 'Une séance d’ici dimanche soir et elle continue.');
  assert.equal(m.tag, 'serie-2026-09-28-sam');
  // Une séance depuis jeudi 18 h : rien.
  const w2 = monde({ users: { [ZOE]: Object.assign(zoe(), { lastSession: PARIS('2026-10-01T19:30:00') }) }, push: { [ZOE]: { a: telZ.abonnement } } }, sam);
  assert.equal(await w2.M.planifies.serieSamedi(ZOE, w2.t), 'ouvert');
  assert.ok(travaux(w.M).some((x) => x.nom === 'serie_sam' && x.un === w.M.planifies.serieSamedi), 'planif.js : serie_sam');
  // Jeudi 11 h : l'accès qui expire attend demain ; la place reste à la série.
  const jeu = PARIS('2026-10-01T11:00:00');
  const u = Object.assign(zoe(), { status: 'AUTONOMIE_PREMIUM', accessExpiry: jeu + 2.5 * 864e5 });
  const w3 = monde({ users: { [ZOE]: u }, push: { [ZOE]: { a: telZ.abonnement } } }, jeu);
  assert.equal(await w3.M.planifies.acces(ZOE, w3.t), 'reserve_serie');
  assert.equal(w3.F.recus.length, 0);
  assert.equal(w3.F.lire('worker/relances_acces/' + ZOE), null, 'rien de retenu : il repart demain');
  w3.avance(864e5);
  await w3.M.planifies.acces(ZOE, w3.t);
  assert.equal(w3.F.recus.length, 1, 'vendredi : il part');
});

console.log(ok + ' tests passés');
