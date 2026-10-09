// La veille du serveur (scripts/veille_serveur.mjs) : quand elle écrit, et
// qu'elle n'écrit qu'une fois par heure.
//   node cloudflare/test/veille.test.mjs
import assert from 'node:assert/strict';
import { decider } from '../../scripts/veille_serveur.mjs';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const T = Date.parse('2026-10-01T14:05:00Z');
const sain = (ko) => ({ code: 0, corps: JSON.stringify({ ok: true, derniereMinuteIlYA_s: 30, file: 0, ko }) });
const panne = { code: 22, corps: JSON.stringify({ ok: false, raison: 'pouls_ancien', derniereMinuteIlYA_s: 900, ko: 0 }) };

await test('un serveur sain, sans échec : rien', async () => {
  const d = decider(sain(0), null, T);
  assert.equal(d.panne, false); assert.equal(d.envoyer, false);
});
await test('un pouls trop vieux (curl échoue) : panne, et UN courriel par heure', async () => {
  const d1 = decider(panne, null, T);
  assert.equal(d1.panne, true); assert.equal(d1.envoyer, true);
  assert.match(d1.message, /pouls_ancien/); assert.match(d1.objet, /ne répond plus/);
  const d2 = decider(panne, d1.etat, T + 15 * 60e3);
  assert.equal(d2.panne, true); assert.equal(d2.envoyer, false, 'pas deux dans la même heure');
  const d3 = decider(panne, d2.etat, T + 60 * 60e3);
  assert.equal(d3.envoyer, true, 'l’heure suivante, on réécrit');
});
await test('serveur muet (curl sans corps) : panne', async () => {
  const d = decider({ code: 28, corps: '' }, null, T);
  assert.equal(d.panne, true); assert.equal(d.envoyer, true); assert.match(d.message, /code 28/);
});
await test('ko en hausse : un courriel ; stable : rien ; en baisse puis en hausse : de nouveau', async () => {
  const d1 = decider(sain(2), null, T);
  assert.equal(d1.envoyer, true); assert.equal(d1.etat.koSignale, 2); assert.match(d1.objet, /2 événement/);
  const d2 = decider(sain(2), d1.etat, T + 2 * 3600e3);
  assert.equal(d2.envoyer, false, 'pas de hausse');
  const d3 = decider(sain(0), d2.etat, T + 3 * 3600e3);
  assert.equal(d3.etat.koSignale, 0, 'l’écran des échecs a été vidé');
  const d4 = decider(sain(1), d3.etat, T + 4 * 3600e3);
  assert.equal(d4.envoyer, true);
});
await test('une hausse dans l’heure d’un courriel attend l’heure suivante, sans se perdre', async () => {
  const d1 = decider(sain(1), null, T);
  const d2 = decider(sain(3), d1.etat, T + 15 * 60e3);
  assert.equal(d2.envoyer, false); assert.equal(d2.etat.koSignale, 1);
  const d3 = decider(sain(3), d2.etat, T + 60 * 60e3);
  assert.equal(d3.envoyer, true); assert.equal(d3.etat.koSignale, 3);
});

console.log(ok + ' tests passés');
