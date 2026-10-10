// Récepteur e-mail des adresses d'import (email-worker/src/worker.js) avec un message simulé.
//   node --test club/tests/email-worker.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { creerRecepteur, verdicts, expediteurOrigine, TAILLE_MAX } from '../email-worker/src/worker.js';

const env = { INGEST_MAIL_URL: 'https://fonctions.example/ingestMail', FP_INGEST_MAIL_SECRET: 'SEC' };
const message = (o = {}) => { const m = { from: 'transfert@club.example', to: 'club-a-ab12@import.fitpulse.app', rawSize: 2000, raw: 'brut', rejet: null, setReject(r) { m.rejet = r; }, headers: new Headers({ 'authentication-results': 'mx.cloudflare.net; dkim=pass header.d=resamania.example; spf=pass smtp.mailfrom=club.example', ...(o.h || {}) }), ...o }; return m; };
const analyse = { from: { address: 'exports@resamania.example' }, subject: 'Export', messageId: '<m1@x>', text: 'Bonjour', attachments: [{ filename: 'RSM_ventes.csv', content: new TextEncoder().encode('a;b') }, { filename: 'notice.pdf', content: new Uint8Array([1]) }] };

test('message relayé, signé HMAC, avec l’expéditeur d’origine et les seules pièces tabulaires', async () => {
  const envois = []; const email = creerRecepteur({ analyser: async () => analyse, envoyer: async (u, o) => { envois.push(o); return { status: 200, ok: true }; }, maintenant: () => 1_700_000_000_000 });
  assert.equal(await email(message(), env), 'transmis');
  const o = envois[0]; const corps = JSON.parse(o.body);
  assert.equal(o.headers['x-fp-signature'], createHmac('sha256', 'SEC').update('1700000000000.' + o.body).digest('hex'));
  assert.equal(corps.origFrom, 'exports@resamania.example'); assert.deepEqual(corps.attachments.map(a => a.name), ['RSM_ventes.csv']);
  assert.equal(Buffer.from(corps.attachments[0].b64, 'base64').toString(), 'a;b'); assert.equal(corps.spf, 'pass');
});
test('plus de 25 Mo, ou SPF et DKIM en échec : refusé sans rien relayer ; adresse inconnue : refusée', async () => {
  let n = 0; const email = creerRecepteur({ analyser: async () => analyse, envoyer: async () => { n++; return { status: 404, ok: false }; } });
  const gros = message({ rawSize: TAILLE_MAX + 1 }); assert.equal(await email(gros, env), 'trop lourd'); assert.match(gros.rejet, /25 Mo/);
  const faux = message({ h: { 'authentication-results': 'mx; spf=fail; dkim=fail' } }); assert.equal(await email(faux, env), 'refusé'); assert.equal(n, 0);
  const inc = message(); assert.equal(await email(inc, env), 'inconnue'); assert.match(inc.rejet, /inconnue/);
});
test('transfert manuel : l’expéditeur d’origine est lu dans la ligne « De : »', () => {
  assert.equal(expediteurOrigine('gerant@club.example', '---------- Message transféré ---------\nDe : Resamania <exports@resamania.example>\nDate : lundi'), 'exports@resamania.example');
  assert.equal(expediteurOrigine('exports@resamania.example', 'Bonjour'), 'exports@resamania.example');
  assert.deepEqual(verdicts('x; spf=softfail; dkim=pass'), { spf: 'softfail', dkim: 'pass' });
});
