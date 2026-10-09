// Script de relève Apps Script (apps-script/Code.gs) exécuté sur une boîte Gmail simulée.
//   node --test club/tests/appsscript.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

const CODE = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
const b64 = s => Buffer.from(s, 'utf8').toString('base64url');
const msg = (id, at, from, subject, body, sent = false) => ({ id, internalDate: String(at), labelIds: sent ? ['SENT'] : ['INBOX'], payload: { mimeType: 'multipart/alternative', headers: [{ name: 'From', value: from }, { name: 'Subject', value: subject }], parts: [{ mimeType: 'text/plain', body: { data: b64(body) } }] } });
function boite(threads, props = {}) {
  const logs = []; const envois = [];
  const ctx = {
    console: { log: x => logs.push(x), warn: () => {} }, Date, JSON, Number, String, Object, encodeURIComponent,
    Gmail: { Users: { getProfile: () => ({ emailAddress: 'accueil@club-demo.fr' }), Threads: { list: (me, o) => ({ threads: Object.keys(threads).map(id => ({ id })) }), get: (me, id) => ({ messages: threads[id] }) } } },
    Utilities: { base64DecodeWebSafe: d => [...Buffer.from(d, 'base64url')], newBlob: b => ({ getDataAsString: () => Buffer.from(b).toString('utf8') }), formatDate: d => d.toISOString().slice(0, 10),
      computeHmacSha256Signature: (v, k) => [...createHmac('sha256', k).update(v).digest()].map(x => (x > 127 ? x - 256 : x)) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    UrlFetchApp: { fetch: (u, o) => { envois.push(o); return { getResponseCode: () => 200, getContentText: () => '{}' }; } },
  };
  vm.createContext(ctx); vm.runInContext(CODE, ctx);
  return { ctx, logs, envois };
}

test('apercu : demande d’un adhérent, puis réponse envoyée depuis la boîte', () => {
  const t0 = Date.UTC(2026, 9, 12, 9);
  const fil = [msg('m1', t0, 'Paul Exemple <paul.exemple@exemple.fr>', 'Mon abonnement', 'Bonjour,\nJe souhaite résilier mon abonnement, je déménage à Lyon.\nPaul Exemple')];
  const B = boite({ th1: fil });
  B.ctx.apercu(); const r = JSON.parse(B.logs[0]).threads[0];
  assert.equal(r.kind, 'adherent'); assert.equal(r.type, 'resiliation'); assert.equal(r.motif, 'Déménagement'); assert.equal(r.name, 'Paul Exemple'); assert.equal(r.awaitingReply, true); assert.equal(r.firstReplyAt, null);
  assert.equal(B.envois.length, 0, 'apercu n’envoie rien');
  fil.push(msg('m2', t0 + 3 * 3600000, 'Accueil <accueil@club-demo.fr>', 'Re: Mon abonnement', 'Bonjour, nous vous rappelons cet après-midi.', true));
  B.ctx.apercu(); const r2 = JSON.parse(B.logs[1]).threads[0];
  assert.equal(r2.awaitingReply, false); assert.equal(r2.firstReplyAt, t0 + 3 * 3600000); assert.equal(r2.outCount, 1);
});
test('releve : envoi signé (HMAC-SHA256 de « horodatage.corps »)', () => {
  const B = boite({ th1: [msg('m1', Date.UTC(2026, 9, 12, 9), 'A B <a@b.fr>', 'Résiliation', 'Je veux résilier mon abonnement.')] }, { FP_SECRET: 'secret-de-test' });
  B.ctx.releve(); assert.equal(B.envois.length, 1);
  const o = B.envois[0]; const sig = createHmac('sha256', 'secret-de-test').update(o.headers['X-FP-Time'] + '.' + o.payload).digest('hex');
  assert.equal(o.headers['X-FP-Signature'], sig); assert.equal(o.headers['X-FP-Club'], 'niort');
});
test('une newsletter n’est pas retenue', () => {
  const B = boite({ th1: [{ ...msg('m1', 1, 'News <news@marque.fr>', 'Offre spéciale', 'Résiliation offerte, se désabonner ici.'), payload: { mimeType: 'text/plain', headers: [{ name: 'From', value: 'News <news@marque.fr>' }, { name: 'Subject', value: 'Offre' }, { name: 'List-Unsubscribe', value: '<x>' }], body: { data: b64('Résiliation offerte') } } }] });
  B.ctx.apercu(); assert.equal(JSON.parse(B.logs[0]).threads.length, 0);
});
