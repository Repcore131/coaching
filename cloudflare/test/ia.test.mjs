// L'assistant IA (ia.js) : la route, le contrôle d'appartenance, l'interrupteur,
// le quota, le refus, le coût, le retour du coach — et rien sous users/.
//   node cloudflare/test/ia.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { creerIA, routeIA, coutMicro, lireReponse, journalIAAPurger, offreIA, chiffresInventes, IA_PLAFONDS, TACHES, SCHEMAS, REGLES_C2, SCHEMA_IMPORT, controlerImport, SCHEMA_PROGRAMME, controlerProgramme, SCHEMA_REPAS, controlerRepas, REPAS_APPELS_MOIS } from '../src/ia.js';
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
  // Tom : ni Ultime, ni un coach au registre — la photo du repas reste fermée.
  const ath = monde();
  assert.equal(await statutDe(ath.IA.appeler({ auth: auth('tom@t.fr'), data: { tache: 'repas', charge: { image: { media_type: 'image/jpeg', data: 'AAAA' } } } })), 429);
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
      content: [{ type: 'text', text: '{"aliments":[{"nom":"pâtes cuites","grammes":120,"confiance":0.8}],"remarque":null}' }],
      usage: { input_tokens: 300, output_tokens: 40 } }) });
  const r = await w.IA.appeler({ auth: auth('lea@t.fr'), data: { tache: 'repas', charge: { image: { media_type: 'image/jpeg', data: 'AAAA' } } } });
  const { corps, beta } = w.appels[0];
  assert.equal(corps.model, 'claude-haiku-4-5');
  assert.equal(corps.output_config.effort, undefined);
  assert.equal(corps.thinking, undefined);
  assert.equal(corps.fallbacks, undefined);
  assert.equal(beta, '');
  assert.equal(r.plafond, IA_PLAFONDS.ultime);
  assert.equal(r.coutMois, 300 * 1 + 40 * 5);
  assert.deepEqual(r.proposition, { aliments: [{ nom: 'pâtes cuites', grammes: 120, confiance: 0.8 }], remarque: null });
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

// ══ LE BROUILLON C2 RÉÉCRIT (tâche 'bilan') ═════════════════════════════════
const FAITS = ['Ton poids moyen sur 7 jours est passé de 72,4 à 71,9 kg depuis ton dernier bilan (−0,5 kg).',
  '9 séances faites sur 12 prévues depuis ton dernier bilan.'];
const CHARGE_C2 = { faits: FAITS, accroche: [], texteLibre: { difficultes: 'les horaires du boulot', ecarts: '', modifs: '', stress: '', objectifs: '' },
  notesSeances: [], styleCoach: [], formules: { ouverture: 'Salut {prénom},', cloture: 'À très vite' }, prenom: 'Léa' };
const repC2 = (texte) => (c) => ({ id: 'm', type: 'message', role: 'assistant', model: c.model, stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify({ texte, elementsRepris: ['les horaires du boulot'], question: 'Comment ça se passe ?' }) }],
  usage: { input_tokens: 900, output_tokens: 120 } });

await test('chiffresInventes : un nombre absent des faits est signalé ; 72,4 = 72.4, 1 200 = 1200', async () => {
  assert.deepEqual(chiffresInventes('Salut Léa, tu as perdu 3 kg.', FAITS), ['3']);
  assert.deepEqual(chiffresInventes('De 72.4 à 71,9 kg en 7 jours, 9 séances sur 12.', FAITS), []);
  assert.deepEqual(chiffresInventes('1 200 pas', ['1200 pas par jour']), []);
  assert.deepEqual(chiffresInventes('Aucun chiffre ici.', []), []);
});

await test('bilan : « tu as perdu 3 kg » sans 3 dans les faits → rejet chiffre_invente, aucune proposition, journal en échec', async () => {
  const w = monde({ reponse: repC2('Salut Léa,\n\nTu as perdu 3 kg, bravo. Les horaires du boulot t’ont compliqué la tâche : comment ça se passe ?\n\nÀ très vite') });
  const r = await w.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'bilan', athlete: ATH, charge: CHARGE_C2 } });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'chiffre_invente');
  assert.equal(r.proposition, undefined);
  const j = Object.values(w.F.lire('ia_journal/' + COACH));
  assert.equal(j.length, 1);
  assert.equal(j[0].statut, 'echec');
  assert.equal(j[0].raison, 'chiffre_invente');
  // Le coût reste compté : l'appel a été facturé.
  assert.equal(w.F.lire('ia_quota/' + COACH + '/' + MOIS), 900 * 2 + 120 * 10);
});

await test('bilan : une réponse conforme passe ; prompt système figé en cache, règles C2 mot pour mot, schéma {texte, elementsRepris, question}', async () => {
  const texte = 'Salut Léa,\n\nTon poids moyen sur 7 jours est passé de 72,4 à 71,9 kg, et 9 séances sur 12. Tu parles des horaires du boulot : qu’est-ce qui a été le plus dur à caler ?\n\nÀ très vite';
  const w = monde({ reponse: repC2(texte) });
  const r = await w.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'bilan', athlete: ATH, charge: CHARGE_C2 } });
  assert.equal(r.ok, true);
  assert.equal(r.proposition.texte, texte);
  const { corps } = w.appels[0];
  assert.equal(corps.model, 'claude-sonnet-5-5');
  assert.equal(corps.output_config.effort, 'low');
  assert.deepEqual(corps.output_config.format.schema.required, ['texte', 'elementsRepris', 'question']);
  assert.ok(Array.isArray(corps.system) && corps.system.length === 1);
  assert.deepEqual(corps.system[0].cache_control, { type: 'ephemeral' });
  assert.ok(corps.system[0].text.includes(REGLES_C2), 'les règles C2 ne sont pas reprises telles quelles');
  for (const m of ['baisse la charge', 'prends un jour', 'j’aimerais qu’on fasse un point', 'Une seule question', 'Tutoie'])
    assert.ok(corps.system[0].text.includes(m), m);
  // La charge part dans le message utilisateur, jamais dans le système (cache stable).
  assert.ok(!corps.system[0].text.includes('les horaires du boulot'));
  assert.ok(JSON.parse(corps.messages[0].content).texteLibre.difficultes === 'les horaires du boulot');
  assert.equal(w.F.lire('ia_journal/' + COACH + '/' + r.journalId).statut, 'propose');
});

await test('bilan : sans faits → 400, sans appel', async () => {
  const w = monde();
  assert.equal(await statutDe(w.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'bilan', athlete: ATH, charge: 'texte libre' } })), 400);
  assert.equal(w.appels.length, 0);
});

// ══ L'IMPORT DE SÉANCE PAR PDF OU PHOTO (tâche 'import', Claude Vision) ══════
const IMG = Buffer.from('fausse image jpeg').toString('base64');
const CHARGE_IMPORT = { pages: [{ type: 'image', media_type: 'image/jpeg', data: IMG }, { type: 'image', media_type: 'image/jpeg', data: IMG }],
  banque: ['SQUAT', 'DÉVELOPPÉ COUCHÉ BARRE'] };
const sortieImport = { seances: [{ nom: 'Jambes', jour: null, echauffement: null, exercices: [
  { nomLu: 'Squat barre', nomBanque: 'SQUAT', series: 4, reps: '8', repos: '2 min', tempo: null, note: null, videoUrl: null, confiance: 0.9 },
  { nomLu: 'Presse 45', nomBanque: 'PRESSE À CUISSES INVENTÉE', series: null, reps: null, repos: null, tempo: null, note: null, videoUrl: null, confiance: 0.4 }] }],
  nonLu: ['ligne 7 effacée'] };
const repImport = (stop, sortie) => (c) => ({ id: 'm', type: 'message', role: 'assistant', model: c.model, stop_reason: stop,
  content: [{ type: 'text', text: JSON.stringify(sortie) }], usage: { input_tokens: 3000, output_tokens: 500 } });

await test('import : le schéma de sortie est strict (null admis, rien d’autre) ; les pages partent en blocs image ; nomBanque hors liste → null', async () => {
  // Le schéma : chaque objet ferme ses propriétés et les exige toutes.
  const exo = SCHEMA_IMPORT.properties.seances.items.properties.exercices.items;
  assert.equal(SCHEMA_IMPORT.additionalProperties, false);
  assert.deepEqual(SCHEMA_IMPORT.required, ['seances', 'nonLu']);
  assert.equal(exo.additionalProperties, false);
  assert.deepEqual(exo.required, ['nomLu', 'nomBanque', 'series', 'reps', 'repos', 'tempo', 'note', 'videoUrl', 'confiance']);
  assert.deepEqual(exo.properties.series, { anyOf: [{ type: 'integer' }, { type: 'null' }] });
  assert.deepEqual(SCHEMA_IMPORT.properties.seances.items.required, ['nom', 'jour', 'echauffement', 'exercices']);
  const w = monde({ reponse: repImport('end_turn', sortieImport) });
  const r = await w.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'import', charge: CHARGE_IMPORT } });
  assert.equal(r.ok, true);
  const { corps } = w.appels[0];
  assert.equal(corps.model, 'claude-sonnet-5-5');
  assert.equal(corps.output_config.effort, 'medium');
  assert.deepEqual(corps.output_config.format.schema, SCHEMA_IMPORT);
  const contenu = corps.messages[0].content;
  assert.deepEqual(contenu.slice(0, 2).map((b) => b.type), ['image', 'image']);
  assert.deepEqual(contenu[0].source, { type: 'base64', media_type: 'image/jpeg', data: IMG });
  assert.deepEqual(JSON.parse(contenu[2].text).banque, CHARGE_IMPORT.banque);
  assert.match(corps.system[0].text, /rends null plutôt qu’un défaut/);
  const ex = r.proposition.seances[0].exercices;
  assert.equal(ex[0].nomBanque, 'SQUAT');
  assert.equal(ex[1].nomBanque, null);
  assert.equal(ex[1].series, null);
  assert.deepEqual(controlerImport({ seances: [{ exercices: [{ nomBanque: 'X' }] }] }, ['Y']).seances[0].exercices[0].nomBanque, null);
});

await test('import : stop_reason max_tokens → ok:false, aucune proposition ; pages invalides → 400', async () => {
  const w = monde({ reponse: repImport('max_tokens', sortieImport) });
  const r = await w.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'import', charge: CHARGE_IMPORT } });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'coupee');
  assert.equal(r.proposition, undefined);
  const v = monde();
  const sept = { pages: Array.from({ length: 7 }, () => ({ type: 'image', media_type: 'image/jpeg', data: IMG })), banque: [] };
  const mixte = { pages: [{ type: 'image', media_type: 'image/jpeg', data: IMG }, { type: 'document', media_type: 'application/pdf', data: IMG }], banque: [] };
  const gif = { pages: [{ type: 'image', media_type: 'image/gif', data: IMG }], banque: [] };
  for (const charge of [sept, mixte, gif, { pages: [], banque: [] }])
    assert.equal(await statutDe(v.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'import', charge } })), 400);
  assert.equal(v.appels.length, 0);
  // Un PDF seul passe, en bloc document.
  const p = monde({ reponse: repImport('end_turn', sortieImport) });
  await p.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'import', charge: { pages: [{ type: 'document', media_type: 'application/pdf', data: IMG }], banque: [] } } });
  assert.equal(p.appels[0].corps.messages[0].content[0].type, 'document');
});

// ══ LE PREMIER PROGRAMME (tâche 'programme') : un modèle choisi, des ajustements ══
const CHARGE_PROG = { depart: { jours: ['Lundi', 'Mercredi', 'Vendredi'], duree: '45 min', lieu: 'En salle' },
  contraintes: { texte: 'douleur épaule', zones: [] },
  modeles: [{ id: 'p_full', nom: 'Full body', jours: ['Lundi', 'Mercredi', 'Vendredi'], seances: [{ nom: 'A', exercices: [['DÉVELOPPÉ MILITAIRE', 4, '8']] }] }],
  banque: { Barre: ['DÉVELOPPÉ MILITAIRE', 'SQUAT'], 'Haltères': ['DÉVELOPPÉ HALTÈRES ASSIS'] } };
const sortieProg = (o) => Object.assign({ modeleId: 'p_full', raisonChoix: 'Trois jours, comme demandé.', ajustements: [
  { type: 'remplacement', seance: 'A', exercice: 'DÉVELOPPÉ MILITAIRE', par: 'DÉVELOPPÉ HALTÈRES ASSIS', pourquoi: 'amplitude plus libre' },
  { type: 'remplacement', seance: 'A', exercice: 'SQUAT', par: 'PRESSE INVENTÉE', pourquoi: 'x' },
  { type: 'jour', seance: 'A', exercice: null, par: 'Mardi', pourquoi: 'jour souhaité' }],
  alertes: ['Épaule : à vérifier avec l’athlète.'] }, o || {});

await test('programme : schéma strict {modeleId, raisonChoix, ajustements, alertes} ; effort medium ; remplacement hors banque retiré', async () => {
  assert.equal(SCHEMA_PROGRAMME.additionalProperties, false);
  assert.deepEqual(SCHEMA_PROGRAMME.required, ['modeleId', 'raisonChoix', 'ajustements', 'alertes']);
  const aj = SCHEMA_PROGRAMME.properties.ajustements.items;
  assert.equal(aj.additionalProperties, false);
  assert.deepEqual(aj.required, ['type', 'seance', 'exercice', 'par', 'pourquoi']);
  assert.deepEqual(aj.properties.type.enum, ['jour', 'remplacement', 'retrait', 'series', 'duree']);
  assert.deepEqual(aj.properties.par, { anyOf: [{ type: 'string' }, { type: 'null' }] });
  assert.equal(SCHEMAS.programme, SCHEMA_PROGRAMME);
  const w = monde({ reponse: repImport('end_turn', sortieProg()) });
  const r = await w.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'programme', athlete: ATH, charge: CHARGE_PROG } });
  assert.equal(r.ok, true);
  const { corps } = w.appels[0];
  assert.equal(corps.model, 'claude-sonnet-5-5');
  assert.equal(corps.output_config.effort, 'medium');
  assert.deepEqual(corps.output_config.format.schema, SCHEMA_PROGRAMME);
  assert.match(corps.system[0].text, /Tu ne réécris pas le programme/);
  assert.match(corps.system[0].text, /à vérifier avec l’athlète/);
  assert.equal(r.proposition.modeleId, 'p_full');
  assert.deepEqual(r.proposition.ajustements.map((a) => a.par), ['DÉVELOPPÉ HALTÈRES ASSIS', 'Mardi']);
  assert.equal(r.proposition.retires, 1);
  assert.deepEqual(r.proposition.alertes, ['Épaule : à vérifier avec l’athlète.']);
});

await test('programme : sortie invalide (modèle hors liste, objet illisible) → ok:false sortie_invalide, journal en échec ; charge sans modèle → 400', async () => {
  const w = monde({ reponse: repImport('end_turn', sortieProg({ modeleId: 'p_invente' })) });
  const r = await w.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'programme', athlete: ATH, charge: CHARGE_PROG } });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'sortie_invalide');
  assert.equal(r.proposition, undefined);
  const j = w.F.lire('ia_journal/' + COACH + '/' + r.journalId);
  assert.equal(j.statut, 'echec');
  assert.equal(j.raison, 'sortie_invalide');
  assert.equal(controlerProgramme(null, ['p_full'], []), null);
  assert.equal(controlerProgramme({ modeleId: 3 }, ['p_full'], []), null);
  const v = monde();
  for (const charge of [{ banque: [] }, { modeles: [], banque: [] }, { modeles: [{ nom: 'sans id' }], banque: [] },
    { modeles: Array.from({ length: 13 }, (_, i) => ({ id: 'm' + i })), banque: [] }])
    assert.equal(await statutDe(v.IA.appeler({ auth: auth('coach@t.fr'), data: { tache: 'programme', athlete: ATH, charge } })), 400);
  assert.equal(v.appels.length, 0);
});

// ══ LA PHOTO DU REPAS (tâche 'repas', Haiku 4.5) ══════════════════════════════
const PHOTO = { image: { media_type: 'image/jpeg', data: Buffer.from('fausse photo').toString('base64') } };
const repRepas = (sortie) => (c) => ({ id: 'm', type: 'message', role: 'assistant', model: c.model, stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify(sortie) }], usage: { input_tokens: 1500, output_tokens: 80 } });

await test('repas : schéma strict sans calories ; la photo part en bloc image ; sortie bornée (8 aliments, grammes entiers, remarque sur le poids retirée)', async () => {
  assert.equal(SCHEMA_REPAS.additionalProperties, false);
  assert.deepEqual(SCHEMA_REPAS.required, ['aliments', 'remarque']);
  const al = SCHEMA_REPAS.properties.aliments.items;
  assert.deepEqual(al.required, ['nom', 'grammes', 'confiance']);
  assert.deepEqual(al.properties.grammes, { type: 'integer' });
  assert.equal(JSON.stringify(SCHEMA_REPAS).indexOf('kcal'), -1);
  const neuf = Array.from({ length: 10 }, (_, i) => ({ nom: 'aliment ' + i, grammes: 50, confiance: 2 }));
  const w = monde({ base: { droits: { [ATH]: { palier: 'ultime', echeance: 0 } } }, reponse: repRepas({ aliments: neuf, remarque: 'Peu de calories, bon pour ton poids.' }) });
  const r = await w.IA.appeler({ auth: auth('lea@t.fr'), data: { tache: 'repas', charge: PHOTO } });
  const { corps } = w.appels[0];
  assert.equal(corps.model, 'claude-haiku-4-5');
  assert.deepEqual(corps.output_config.format.schema, SCHEMA_REPAS);
  assert.deepEqual(corps.messages[0].content[0], { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: PHOTO.image.data } });
  assert.match(corps.system[0].text, /JAMAIS de calories/);
  assert.match(corps.system[0].text, /Huit aliments au plus/);
  assert.equal(r.proposition.aliments.length, 8);
  assert.equal(r.proposition.aliments[0].confiance, 1);
  assert.equal(r.proposition.remarque, null);
  assert.deepEqual(controlerRepas({ aliments: [{ nom: 'riz', grammes: 150.5 }, { nom: '', grammes: 10 }, { nom: 'pain', grammes: 40, confiance: 0.5 }], remarque: 'Une sauce est peut-être cachée.' }),
    { aliments: [{ nom: 'pain', grammes: 40, confiance: 0.5 }], remarque: 'Une sauce est peut-être cachée.' });
  // La photo ne laisse aucune trace : ni dans le journal, ni ailleurs dans la base.
  assert.equal(JSON.stringify(w.F.lire('')).indexOf(PHOTO.image.data), -1);
  // Sans photo, ou dans un autre format : 400, sans appel.
  const v = monde({ base: { droits: { [ATH]: { palier: 'ultime', echeance: 0 } } } });
  for (const charge of ['pâtes', { image: { media_type: 'image/gif', data: 'AAAA' } }, { image: { media_type: 'image/jpeg', data: '@@' } }])
    assert.equal(await statutDe(v.IA.appeler({ auth: auth('lea@t.fr'), data: { tache: 'repas', charge } })), 400);
  assert.equal(v.appels.length, 0);
});

await test('repas : 60 appels par mois et par compte, en plus du plafond ; le compteur avance à chaque appel servi', async () => {
  assert.equal(REPAS_APPELS_MOIS, 60);
  const w = monde({ base: { droits: { [ATH]: { palier: 'ultime', echeance: 0 } }, ia_appels: { [ATH]: { [MOIS]: { repas: 59 } } } },
    reponse: repRepas({ aliments: [], remarque: null }) });
  await w.IA.appeler({ auth: auth('lea@t.fr'), data: { tache: 'repas', charge: PHOTO } });
  assert.equal(w.F.lire('ia_appels/' + ATH + '/' + MOIS + '/repas'), 60);
  await assert.rejects(w.IA.appeler({ auth: auth('lea@t.fr'), data: { tache: 'repas', charge: PHOTO } }), (e) => e.statut === 429);
  assert.equal(w.appels.length, 1);
});

await test('repas : un athlète sans Ultime, suivi par un coach Coach ou Pro, passe sur l’offre du coach (qui paie) ; coach Libre ou hors quota → 429', async () => {
  const w = monde({ reponse: repRepas({ aliments: [{ nom: 'riz blanc cuit', grammes: 150, confiance: 0.9 }], remarque: null }) });
  const r = await w.IA.appeler({ auth: auth('lea@t.fr'), data: { tache: 'repas', charge: PHOTO } });
  assert.equal(r.ok, true);
  assert.equal(r.plafond, IA_PLAFONDS.coach);
  assert.equal(w.F.lire('ia_quota/' + COACH + '/' + MOIS), 1500 + 80 * 5);
  assert.equal(w.F.lire('ia_quota/' + ATH), null);
  assert.equal(w.F.lire('ia_journal/' + COACH + '/' + r.journalId).athlete, ATH);
  assert.equal(w.F.lire('ia_appels/' + ATH + '/' + MOIS + '/repas'), 1);
  const libre = monde({ base: { coachs_registre: { [COACH]: { plan: 'libre' } } } });
  assert.equal(await statutDe(libre.IA.appeler({ auth: auth('lea@t.fr'), data: { tache: 'repas', charge: PHOTO } })), 429);
  const hq = monde({ base: { droits: { [ATH]: { palier: 'suivi', couvertParCoach: { jusqu: T - 1 } } } } });
  assert.equal(await statutDe(hq.IA.appeler({ auth: auth('lea@t.fr'), data: { tache: 'repas', charge: PHOTO } })), 429);
  assert.equal(libre.appels.length + hq.appels.length, 0);
});

console.log(ok + ' tests IA');
