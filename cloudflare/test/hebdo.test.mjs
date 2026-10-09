// Le point de la semaine (hebdo.js, ia.js) : le lot du dimanche, la collecte du lundi.
//   node cloudflare/test/hebdo.test.mjs
import assert from 'node:assert/strict';
import { creerIA } from '../src/ia.js';
import { semaineISO, idsLot, requeteHebdo, lirePoint, SCHEMA_HEBDO, HEBDO_LIGNES_MAX } from '../src/hebdo.js';
import { creerBase } from '../src/base.js';
import { fausseBase } from './fausse-base.mjs';
import { moisParis } from '../src/quota-coach.js';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };

const DIMANCHE = Date.parse('2026-10-11T21:30:00Z');   // 23 h 30 à Paris
const LUNDI = Date.parse('2026-10-12T05:00:00Z');
const SEM = '2026-W41';
const A = 'anne@t,fr', B = 'bruno@t,fr', C = 'chloe@t,fr';
const ACTIF = { plan: 'coach', actifJusqu: DIMANCHE + 30 * 864e5 };
const resume = (prenom) => ({ prenom, urgence: 2, motifs: [], seances: { faites: 3, prevues: 3 }, poidsTendance: -0.3, bilanSansReponse: false, notes: [], texteBilan: null });
const BASE = {
  coachs_registre: { [A]: ACTIF, [B]: ACTIF, [C]: { plan: 'libre' } },
  hebdo_entree: {
    [A]: { 'lea@t,fr': resume('Léa'), 'tom@t,fr': resume('Tom') },
    [B]: { 'zoe@t,fr': resume('Zoé') },
    [C]: { 'max@t,fr': resume('Max') },          // coach Libre : pas d'assistant
  },
  users: { 'lea@t,fr': { fname: 'Léa' } },
};

// Un faux /v1/messages/batches : création, état, résultats (JSONL).
function monde(o) {
  const opt = o || {};
  const F = fausseBase(Object.assign({}, JSON.parse(JSON.stringify(BASE)), opt.base || {}));
  const vus = { crees: [], resultats: 0 };
  let etat = opt.etat || 'ended';
  const fetchImpl = async (url, init) => {
    const u = String(url);
    if (u.startsWith('https://api.anthropic.com/')) {
      const json = (corps) => new Response(JSON.stringify(corps), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'r' } });
      const lot = { id: 'msgbatch_1', type: 'message_batch', processing_status: etat, request_counts: {},
        results_url: etat === 'ended' ? 'https://api.anthropic.com/v1/messages/batches/msgbatch_1/results' : null,
        created_at: '2026-10-11T21:30:00Z', expires_at: '2026-10-12T21:30:00Z', ended_at: null, archived_at: null, cancel_initiated_at: null };
      if (u.endsWith('/v1/messages/batches') && init && init.method === 'POST') { vus.crees.push(JSON.parse(init.body)); return json(lot); }
      if (u.endsWith('/results')) {
        vus.resultats++;
        return new Response((opt.resultats || []).map((x) => JSON.stringify(x)).join('\n') + '\n', { status: 200, headers: { 'content-type': 'application/binary' } });
      }
      if (u.endsWith('/v1/messages/batches/msgbatch_1')) return json(lot);
      throw new Error('appel inattendu ' + u);
    }
    return F.fetchImpl(url, init);
  };
  const db = creerBase({ url: 'https://x.firebaseio.com', fetchImpl, auth: 'S' });
  const pushs = [];
  const M = { reste: () => 40, envoyerPush: async (uid, msg) => { pushs.push({ uid, msg }); return { envoye: 1 }; } };
  const IA = creerIA({ env: { ANTHROPIC_API_KEY: 'sk-test' }, db, fetchImpl, maintenant: () => LUNDI });
  return { F, IA, M, vus, pushs, setEtat: (e) => { etat = e; } };
}
const succes = (customId, sortie, usage) => ({ custom_id: customId, result: { type: 'succeeded', message: {
  id: 'm', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify(sortie) }], usage: usage || { input_tokens: 2000, output_tokens: 400 } } } });
const point = (lignes) => ({ texte: 'Une semaine calme.', sections: { aTraiter: lignes, progres: [], silencieux: [] } });

await test('la semaine ISO, à Paris : le dimanche 11/10/2026 est en 2026-W41, comme le lundi qui précède', async () => {
  assert.equal(semaineISO('2026-10-11'), SEM);
  assert.equal(semaineISO('2026-10-05'), SEM);
  assert.equal(semaineISO('2026-10-12'), '2026-W42');
  assert.equal(semaineISO('2027-01-03'), '2026-W53');
});

await test('le lot du dimanche : une requête par coach ayant des entrées et du quota, Sonnet 5.5 effort low, schéma strict, système en cache', async () => {
  const w = monde();
  assert.equal(await w.IA.hebdoEnvoi(DIMANCHE, w.M), true);
  assert.equal(w.vus.crees.length, 1);
  const { requests } = w.vus.crees[0];
  assert.deepEqual(requests.map((r) => r.custom_id), ['c0', 'c1']);           // A et B ; C (Libre) écarté
  for (const r of requests) {
    assert.match(r.custom_id, /^[A-Za-z0-9_-]{1,64}$/);
    assert.equal(r.params.model, 'claude-sonnet-5-5');
    assert.equal(r.params.output_config.effort, 'low');
    assert.deepEqual(r.params.output_config.format.schema, SCHEMA_HEBDO);
    assert.deepEqual(r.params.system[0].cache_control, { type: 'ephemeral' });
    assert.equal(r.params.fallbacks, undefined);                                 // refusé par la Batch API
    assert.equal(r.params.messages[r.params.messages.length - 1].role, 'user');
  }
  assert.deepEqual(Object.keys(JSON.parse(requests[0].params.messages[0].content).athletes).sort(), ['lea@t,fr', 'tom@t,fr']);
  const lot = w.F.lire('hebdo_batch/' + SEM);
  assert.equal(lot.id, 'msgbatch_1');
  assert.equal(lot.cree, DIMANCHE);
  assert.deepEqual(lot.coachs, { c0: A, c1: B });
  // La fonction pure rend la même requête.
  assert.deepEqual(requeteHebdo('c1', BASE.hebdo_entree[B], SEM), requests[1]);
  assert.deepEqual(idsLot([B, A, A]).parId, { c0: A, c1: B });
});

await test('pas de second lot la même semaine', async () => {
  const w = monde();
  await w.IA.hebdoEnvoi(DIMANCHE, w.M);
  assert.equal(await w.IA.hebdoEnvoi(DIMANCHE + 600e3, w.M), true);
  assert.equal(w.vus.crees.length, 1);
  // Un lot vide (aucun coach) clôt aussi la semaine.
  const v = monde({ base: { hebdo_entree: null } });
  await v.IA.hebdoEnvoi(DIMANCHE, v.M);
  await v.IA.hebdoEnvoi(DIMANCHE + 600e3, v.M);
  assert.equal(v.vus.crees.length, 0);
  assert.equal(v.F.lire('hebdo_batch/' + SEM).n, 0);
});

await test('la collecte : résultats DANS LE DÉSORDRE, rangés par custom_id ; coût ×0,5 ; push au coach', async () => {
  const w = monde({ base: { hebdo_batch: { [SEM]: { id: 'msgbatch_1', cree: DIMANCHE, coachs: { c0: A, c1: B } } } },
    resultats: [
      succes('c1', point([{ athlete: 'zoe@t,fr', pourquoi: 'Bilan à lire : répondre au bilan.' }]), { input_tokens: 1000, output_tokens: 100 }),
      succes('c0', point([{ athlete: 'lea@t,fr', pourquoi: 'Trois séances : ouvrir la fiche.' }]), { input_tokens: 2000, output_tokens: 400 }),
    ] });
  assert.equal(await w.IA.hebdoCollecte(LUNDI, w.M), true);
  const pa = w.F.lire('hebdo/' + A + '/' + SEM), pb = w.F.lire('hebdo/' + B + '/' + SEM);
  assert.equal(pa.sections.aTraiter[0].athlete, 'lea@t,fr');
  assert.equal(pb.sections.aTraiter[0].athlete, 'zoe@t,fr');
  assert.equal(pa.t, LUNDI);
  const mois = moisParis(LUNDI);
  assert.equal(w.F.lire('ia_quota/' + A + '/' + mois), Math.ceil((2000 * 2 + 400 * 10) * 0.5));
  assert.equal(w.F.lire('ia_quota/' + B + '/' + mois), Math.ceil((1000 * 2 + 100 * 10) * 0.5));
  assert.deepEqual(w.pushs.map((p) => p.uid).sort(), [A, B]);
  assert.equal(w.pushs[0].msg.title, 'Ton point de la semaine est prêt');
  assert.ok(w.F.lire('hebdo_batch/' + SEM + '/fini'));
  // Relancée, la collecte ne refait rien.
  await w.IA.hebdoCollecte(LUNDI + 3600e3, w.M);
  assert.equal(w.pushs.length, 2);
  assert.equal(w.vus.resultats, 1);
});

await test('un résultat « errored » est ignoré sans planter ; les autres coachs reçoivent leur point', async () => {
  const w = monde({ base: { hebdo_batch: { [SEM]: { id: 'msgbatch_1', cree: DIMANCHE, coachs: { c0: A, c1: B } } } },
    resultats: [
      { custom_id: 'c0', result: { type: 'errored', error: { type: 'error', error: { type: 'overloaded_error', message: 'x' } } } },
      succes('c1', point([{ athlete: 'zoe@t,fr', pourquoi: 'ouvrir la fiche' }])),
    ] });
  assert.equal(await w.IA.hebdoCollecte(LUNDI, w.M), true);
  assert.equal(w.F.lire('hebdo/' + A), null);
  assert.ok(w.F.lire('hebdo/' + B + '/' + SEM));
  assert.equal(w.F.lire('hebdo_batch/' + SEM + '/faits/c0'), 'echec');
  assert.equal(w.F.lire('ia_quota/' + A), null);
  assert.deepEqual(w.pushs.map((p) => p.uid), [B]);
});

await test('le contrôle : une clé d’athlète étrangère au coach est retirée ; 12 lignes au plus', async () => {
  const w = monde({ base: { hebdo_batch: { [SEM]: { id: 'msgbatch_1', cree: DIMANCHE, coachs: { c0: A } } } },
    resultats: [succes('c0', point([{ athlete: 'lea@t,fr', pourquoi: 'ouvrir la fiche' }, { athlete: 'zoe@t,fr', pourquoi: 'athlète d’un autre coach' },
      { athlete: 'Léa', pourquoi: 'un prénom au lieu d’une clé' }]))] });
  await w.IA.hebdoCollecte(LUNDI, w.M);
  assert.deepEqual(w.F.lire('hebdo/' + A + '/' + SEM).sections.aTraiter.map((l) => l.athlete), ['lea@t,fr']);
  const trop = point(Array.from({ length: 20 }, () => ({ athlete: 'tom@t,fr', pourquoi: 'x' })));
  const p = lirePoint(succes('c0', trop), ['tom@t,fr']);
  assert.equal(p.sections.aTraiter.length, HEBDO_LIGNES_MAX);
  // Un refus ou une sortie coupée : rien, sans lever.
  assert.equal(lirePoint({ custom_id: 'c0', result: { type: 'succeeded', message: { stop_reason: 'refusal', content: [] } } }, []), null);
  assert.equal(lirePoint({ custom_id: 'c0', result: { type: 'expired' } }, []), null);
  assert.equal(lirePoint(undefined, []), null);
});

await test('lot pas encore fini : la collecte attend l’heure suivante ; interrupteur coupé : rien ne part', async () => {
  const w = monde({ etat: 'in_progress', base: { hebdo_batch: { [SEM]: { id: 'msgbatch_1', cree: DIMANCHE, coachs: { c0: A } } } } });
  assert.equal(await w.IA.hebdoCollecte(LUNDI, w.M), true);
  assert.equal(w.vus.resultats, 0);
  assert.equal(w.F.lire('hebdo_batch/' + SEM + '/fini'), null);
  const F = fausseBase(BASE);
  const db = creerBase({ url: 'https://x.firebaseio.com', fetchImpl: F.fetchImpl, auth: 'S' });
  const coupe = creerIA({ env: { ANTHROPIC_API_KEY: 'sk', IA_COUPEE: '1' }, db, fetchImpl: F.fetchImpl });
  assert.equal(await coupe.hebdoEnvoi(DIMANCHE, { reste: () => 40 }), true);
  assert.equal(F.lire('hebdo_batch'), null);
  // Budget trop court : on rend la main sans rien faire (repris au réveil suivant).
  assert.equal(await w.IA.hebdoEnvoi(DIMANCHE, { reste: () => 3 }), false);
});

console.log(ok + ' tests point de la semaine');
