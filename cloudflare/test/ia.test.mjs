// L'assistant IA (ia.js) : la route, le contrôle d'appartenance, l'interrupteur,
// le quota, le refus, le coût, le retour du coach — et rien sous users/.
//   node cloudflare/test/ia.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { creerIA, routeIA, coutMicro, lireReponse, journalIAAPurger, offreIA, IA_PLAFONDS, TACHES, SCHEMAS } from '../src/ia.js';
import { repondreAppel, ErreurAppel } from '../src/appels.js';
import { creerBase } from '../src/base.js';
import { fausseBase } from './fausse-base.mjs';
import { moisParis } from '../src/quota-coach.js';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };

const T = Date.parse('2026-10-05T10:00:00Z');
const MOIS = moisParis(T);
const COACH = 'coach@t,fr', ATH = 'lea@t,fr', AUTRE = 'tom@t,fr';
const REGISTRE = { [COACH]: { plan: 'coach', actifJusqu: T + 30 * 864e5 } };

// Un monde : la fausse base, et un faux /v1/messages qui note ce qu'il reçoit.
function monde(o) {
  const opt = o || {};
  const F = fausseBase(Object.assign({
    users: { [ATH]: { coachEmailKey: COACH, fname: 'Léa' }, [AUTRE]: { coachEmailKey: 'autre@t,fr' } },
    coachs: { [COACH]: { clients: { [ATH]: true } } },
    coachs_registre: REGISTRE,
  }, opt.base || {}));
  const appels = [];
  const fetchImpl = async (url, init) => {
    if (String(url).startsWith('https://api.anthropic.com/')) {
      const corps = JSON.parse(init.body);
      const entetes = new Headers(init.headers);
      appels.push({ url: String(url), corps, beta: entetes.get('anthropic-beta') || '', cle: entetes.get('x-api-key') });
      const r = typeof opt.reponse === 'function' ? opt.reponse(corps) : (opt.reponse || {
        id: 'msg_1', type: 'message', role: 'assistant', model: corps.model, stop_reason: 'end_turn', stop_sequence: null,
        content: [{ type: 'text', text: JSON.stringify({ message: 'Salut Léa, on reprend jeudi ?' }) }],
        usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 500, cache_creation_input_tokens: 0 },
      });
      return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_1' } });
    }
    return F.fetchImpl(url, init);
  };
  const db = creerBase({ url: 'https://x.firebaseio.com', fetchImpl, auth: 'S' });
  const env = Object.assign({ ANTHROPIC_API_KEY: 'sk-test-faux' }, opt.env || {});
  const IA = creerIA({ env, db, fetchImpl, maintenant: () => T });
  return { F, db, IA, appels, env, fetchImpl };
}
const auth = (email) => ({ email, uid: 'u' });
const statutDe = async (p) => { try { await p; return 200; } catch (e) { assert.ok(e instanceof ErreurAppel, String(e && e.stack)); return e.statut; } };

await test('routeIA : chaque tâche, son modèle et ses réglages', async () => {
  for (const t of ['bilan', 'hebdo', 'relance']) {
    const r = routeIA(t);
    assert.equal(r.model, 'claude-sonnet-5-5', t);
    assert.equal(r.effort, 'low', t);
    assert.deepEqual(r.thinking, { type: 'adaptive' });
    assert.deepEqual(r.betas, ['server-side-fallback-2026-07-01']);
    assert.equal(r.fallbacks, 'default');
    assert.ok(r.max_tokens >= 4096);
  }
  for (const t of ['import', 'programme']) { assert.equal(routeIA(t).model, 'claude-sonnet-5-5'); assert.equal(routeIA(t).effort, 'medium'); }
  for (const t of ['repas', 'relance_courte']) {
    const r = routeIA(t);
    assert.equal(r.model, 'claude-haiku-4-5');
    assert.equal(r.effort, null);
    assert.equal(r.thinking, undefined);
    assert.equal(r.betas, undefined);
  }
  assert.equal(routeIA('inconnue'), null);
  assert.equal(routeIA('toString'), null);
  // Chaque tâche a son schéma strict.
  for (const t of Object.keys(TACHES)) assert.equal(SCHEMAS[t].additionalProperties, false, t);
});

await test('sans jeton : 401, et rien n’est appelé', async () => {
  const w = monde();
  const req = new Request('https://w.dev/fn/ia', { method: 'POST', body: JSON.stringify({ data: { tache: 'relance', charge: 'x' } }) });
  const r = await repondreAppel(req, { ia: (q) => w.IA.appeler(q) }, { db: w.db, env: w.env, projet: 'repcore-sync' });
  assert.equal(r.status, 401);
  assert.equal(w.appels.length, 0);
});

await test('l’athlète d’un autre coach : 403, sans appel ni écriture', async () => {
  const w = monde();
  assert.equal(await statutDe(w.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'relance', athlete: AUTRE, charge: 'x' } })), 403);
  // Désigné par le dossier, mais absent de la liste du coach : 403 aussi.
  const w2 = monde({ base: { coachs: { [COACH]: { clients: {} } } } });
  assert.equal(await statutDe(w2.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'relance', athlete: ATH, charge: 'x' } })), 403);
  assert.equal(w.appels.length + w2.appels.length, 0);
  assert.equal(w.F.lire('ia_journal'), null);
});

await test('l’interrupteur : IA_COUPEE=1 ou clé absente → 503, sans appel', async () => {
  for (const env of [{ IA_COUPEE: '1' }, { ANTHROPIC_API_KEY: '' }, { IA_COUPEE: '1\n' }]) {
    const w = monde({ env });
    const p = w.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'relance', athlete: ATH, charge: 'x' } });
    await assert.rejects(p, (e) => e.statut === 503 && e.message === 'L’assistant est en pause.');
    assert.equal(w.appels.length, 0);
  }
});

await test('le quota : au plafond → 429 ; un coach Libre (0) et un athlète sans Ultime aussi', async () => {
  const w = monde({ base: { ia_quota: { [COACH]: { [MOIS]: IA_PLAFONDS.coach } } } });
  await assert.rejects(w.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'relance', athlete: ATH, charge: 'x' } }),
    (e) => e.statut === 429 && e.message === 'Quota IA du mois atteint.');
  const libre = monde({ base: { coachs_registre: { [COACH]: { plan: 'libre' } } } });
  assert.equal(await statutDe(libre.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'relance', charge: 'x' } })), 429);
  const ath = monde();
  assert.equal(await statutDe(ath.IA.appeler({ auth: auth('lea@t.fr'), data: { tache: 'repas', charge: 'pâtes' } })), 429);
  assert.equal(w.appels.length + libre.appels.length + ath.appels.length, 0);
  // Les offres : un abonnement coach échu vaut Libre ; Ultime ouvre 1 $.
  assert.equal(offreIA({ plan: 'pro', actifJusqu: T - 1 }, null, T), 'libre');
  assert.equal(offreIA(null, { palier: 'ultime', echeance: 0 }, T), 'ultime');
  assert.equal(offreIA(null, { palier: 'essentielle', ultimeJusqu: T + 1 }, T), 'ultime');
  assert.equal(offreIA(null, { palier: 'essentielle' }, T), 'aucune');
});

await test('un appel servi : la requête (schéma, effort, réflexion, repli), le coût exact, le journal, la réponse', async () => {
  const w = monde();
  const avant = JSON.stringify(w.F.lire('users'));
  const r = await w.IA.appeler({ auth: auth('Coach@T.fr'), data: { tache: 'relance', athlete: ATH, charge: { jours: 9, prenom: 'Léa' } } });
  assert.equal(w.appels.length, 1);
  const { corps, beta, cle, url } = w.appels[0];
  assert.match(url, /\/v1\/messages/);
  assert.equal(cle, 'sk-test-faux');
  assert.equal(corps.model, 'claude-sonnet-5-5');
  assert.equal(corps.output_config.effort, 'low');
  assert.equal(corps.output_config.format.type, 'json_schema');
  assert.deepEqual(corps.output_config.format.schema, SCHEMAS.relance);
  assert.deepEqual(corps.thinking, { type: 'adaptive' });
  assert.equal(corps.fallbacks, 'default');
  assert.match(beta, /server-side-fallback-2026-07-01/);
  // Jamais de préremplissage : le dernier message est celui de l'utilisateur.
  assert.equal(corps.messages[corps.messages.length - 1].role, 'user');
  assert.equal(corps.temperature, undefined);
  // 1000 × 2 + 500 × 0,2 + 200 × 10 = 4 100 µ$.
  assert.equal(coutMicro('claude-sonnet-5-5', { input_tokens: 1000, cache_read_input_tokens: 500, output_tokens: 200 }), 4100);
  assert.equal(coutMicro('claude-haiku-4-5', { input_tokens: 1000, cache_read_input_tokens: 500, output_tokens: 200 }), 2050);
  assert.deepEqual(Object.keys(r).sort(), ['coutMois', 'journalId', 'ok', 'plafond', 'proposition']);
  assert.equal(r.ok, true);
  assert.deepEqual(r.proposition, { message: 'Salut Léa, on reprend jeudi ?' });
  assert.equal(r.coutMois, 4100);
  assert.equal(r.plafond, IA_PLAFONDS.coach);
  assert.equal(w.F.lire('ia_quota/' + COACH + '/' + MOIS), 4100);
  const j = w.F.lire('ia_journal/' + COACH + '/' + r.journalId);
  assert.deepEqual(j, { t: T, tache: 'relance', modele: 'claude-sonnet-5-5', tin: 1000, tout: 200, cout: 4100, athlete: ATH, statut: 'propose' });
  // Un second appel s'ajoute au compteur du mois.
  const r2 = await w.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'relance', charge: 'x' } });
  assert.equal(r2.coutMois, 8200);
  assert.equal(w.F.lire('ia_quota/' + COACH + '/' + MOIS), 8200);
  // AUCUNE écriture sous users/.
  assert.equal(JSON.stringify(w.F.lire('users')), avant);
});

await test('Haiku : ni effort, ni réflexion, ni bêta ; schéma du repas', async () => {
  const w = monde({ base: { droits: { [ATH]: { palier: 'ultime', echeance: 0 } } },
    reponse: (c) => ({ id: 'm', type: 'message', role: 'assistant', model: c.model, stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"aliments":[{"nom":"pâtes","grammes":120}],"kcal":430}' }],
      usage: { input_tokens: 300, output_tokens: 40 } }) });
  const r = await w.IA.appeler({ auth: auth('lea@t.fr'), data: { tache: 'repas', charge: 'Une assiette de pâtes' } });
  const { corps, beta } = w.appels[0];
  assert.equal(corps.model, 'claude-haiku-4-5');
  assert.equal(corps.output_config.effort, undefined);
  assert.equal(corps.thinking, undefined);
  assert.equal(corps.fallbacks, undefined);
  assert.equal(beta, '');
  assert.equal(r.plafond, IA_PLAFONDS.ultime);
  assert.equal(r.coutMois, 300 * 1 + 40 * 5);
  assert.equal(r.proposition.kcal, 430);
});

await test('stop_reason refusal ou max_tokens : ok:false, jamais de texte, aucun journal « propose », coût compté', async () => {
  for (const [stop, raison] of [['refusal', 'refus'], ['max_tokens', 'coupee']]) {
    const w = monde({ reponse: (c) => ({ id: 'm', type: 'message', role: 'assistant', model: c.model, stop_reason: stop,
      stop_details: stop === 'refusal' ? { type: 'refusal', category: null, explanation: null } : null,
      content: [{ type: 'text', text: '{"message":"Salut L' }], usage: { input_tokens: 100, output_tokens: 10 } }) });
    const r = await w.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'relance', athlete: ATH, charge: 'x' } });
    assert.equal(r.ok, false);
    assert.equal(r.raison, raison);
    assert.equal(r.proposition, undefined);
    const journal = Object.values(w.F.lire('ia_journal/' + COACH) || {});
    assert.equal(journal.filter((e) => e.statut === 'propose').length, 0, stop);
    assert.equal(journal.length, 1);
    assert.equal(w.F.lire('ia_quota/' + COACH + '/' + MOIS), 100 * 2 + 10 * 10);
  }
  assert.deepEqual(lireReponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'pas du json' }] }), { ok: false, raison: 'illisible' });
});

await test('iaRetour : statut et distance mis à jour ; refus des valeurs hors bornes et du journal d’un autre', async () => {
  const w = monde();
  const r = await w.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'relance', athlete: ATH, charge: 'x' } });
  assert.deepEqual(await w.IA.retour({ auth: auth('coach@t.fr'), data: { journalId: r.journalId, statut: 'modifie', distance: 0.37 } }), { ok: true });
  const j = w.F.lire('ia_journal/' + COACH + '/' + r.journalId);
  assert.equal(j.statut, 'modifie');
  assert.equal(j.distance, 0.37);
  assert.equal(j.retourLe, T);
  for (const data of [{ journalId: r.journalId, statut: 'valide', distance: 1.5 }, { journalId: r.journalId, statut: 'parti', distance: 0 },
    { journalId: '../x', statut: 'valide', distance: 0 }])
    assert.equal(await statutDe(w.IA.retour({ auth: auth('coach@t.fr'), data })), 400);
  // Le journal d'un autre compte n'existe pas sous SA clé : 404, rien ne bouge.
  assert.equal(await statutDe(w.IA.retour({ auth: auth('lea@t.fr'), data: { journalId: r.journalId, statut: 'rejete', distance: 1 } })), 404);
  assert.equal(w.F.lire('ia_journal/' + COACH + '/' + r.journalId).statut, 'modifie');
});

await test('la purge de la nuit : plus de 90 jours, effacés ; le reste gardé', async () => {
  const J = 864e5;
  assert.deepEqual(journalIAAPurger({ a: { t: T - 91 * J }, b: { t: T - 10 * J } }, T), ['a']);
  const w = monde({ base: { ia_journal: { [COACH]: { vieux: { t: T - 100 * J, statut: 'propose' }, recent: { t: T - J, statut: 'valide' } } } } });
  assert.equal(await w.IA.purgerUn(COACH, T), 1);
  assert.deepEqual(Object.keys(w.F.lire('ia_journal/' + COACH)), ['recent']);
});

await test('la charge : vide ou trop longue → 400 ; tâche inconnue → 400', async () => {
  const w = monde();
  assert.equal(await statutDe(w.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'relance', charge: '' } })), 400);
  assert.equal(await statutDe(w.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'relance', charge: 'x'.repeat(60001) } })), 400);
  assert.equal(await statutDe(w.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'roman', charge: 'x' } })), 400);
  assert.equal(w.appels.length, 0);
});

// Le chemin complet /fn/ia : un jeton signé, l'appel routé par repondreAppel.
await test('/fn/ia de bout en bout : le jeton, puis {result} ; le 403 sort en erreur Firebase', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'k1', alg: 'RS256', use: 'sig' });
  const CLES = { k1: await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']) };
  const b = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
  const s = Math.floor(Date.now() / 1000);
  const t = b({ alg: 'RS256', kid: 'k1' }) + '.' + b({ aud: 'repcore-sync', iss: 'https://securetoken.google.com/repcore-sync', iat: s - 10, exp: s + 3600, sub: 'u1', email: 'coach@t.fr' });
  const jeton = t + '.' + crypto.sign('sha256', Buffer.from(t), privateKey).toString('base64url');
  const w = monde();
  const g = { ia: (q) => w.IA.appeler(q) };
  const req = (data) => new Request('https://w.dev/fn/ia', { method: 'POST', headers: { Authorization: 'Bearer ' + jeton }, body: JSON.stringify({ data }) });
  const ctx = { db: w.db, env: w.env, projet: 'repcore-sync', cles: CLES };
  const r = await repondreAppel(req({ tache: 'relance', athlete: ATH, charge: 'x' }), g, ctx);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).result.ok, true);
  const r2 = await repondreAppel(req({ tache: 'relance', athlete: AUTRE, charge: 'x' }), g, ctx);
  assert.equal(r2.status, 403);
});

console.log(ok + ' tests IA');
