// Imports Resamania automatiques : le vrai code de l'appli, sans réseau.
//   TZ=Europe/Paris node club/tests/autoimport.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chargerAppli } from '../outils/fitpulse-rapport.mjs';
import { passageImports, traiter, requetePj } from '../outils/fitpulse-autoimport.mjs';

const JSZip = createRequire(import.meta.url)('../vendor/jszip.min.js');
const demo = () => { const run = chargerAppli('demo'); const S = JSON.parse(run('JSON.stringify(S)')); S.clubs.horizon.rsmAuto = { address: 'imports+niort@club.fr' }; return S; };
const NOW = new Date('2026-10-09T10:00:00+02:00').getTime();
const ventesCsv = () => {
  const H = ['Numéro du client', 'Nom du produit', 'Echéancier', 'Date de création', 'Nom de l’offre', 'Etat', 'Canal', 'Prix toutes taxes', 'Prénom', 'Nom', 'Prénom du commercial initial', 'Nom du commercial initial', 'Code du commercial initial'];
  const R = [['880001', 'Abonnement Premium', 'Mensuel', '2026-10-02', 'Premium', 'Validé', 'Club', '29,99', 'Alice', 'TESTA', 'Thomas', 'Petit', 'TPET'],
    ['880002', 'Abonnement Basic', 'Mensuel', '2026-10-03', 'Basic', 'Validé', 'Club', '24,99', 'Bruno', 'TESTB', 'Thomas', 'Petit', 'TPET'],
    ['880003', 'Abonnement Ultimate', 'Mensuel', '2026-10-04', 'Ultimate', 'Validé', 'Club', '39,99', 'Chloé', 'TESTC', 'Thomas', 'Petit', 'TPET']];
  return [H, ...R].map(r => r.join(';')).join('\n');
};
const zip = async () => { const z = new JSZip(); z.file('ventes.csv', ventesCsv()); return Buffer.from(await z.generateAsync({ type: 'uint8array' })); };
const contrats = S => Object.values(S.entries).filter(e => e.kpiId === 'contrats' && e.clubId === 'horizon' && !e.removedBy).reduce((s, e) => s + Number(e.value), 0);
function fausseBase(S) {
  return async (tk, chemin, opts = {}) => {
    if (opts.method === 'PATCH' && chemin === 'pulse.json') for (const [k, v] of Object.entries(JSON.parse(opts.body))) { const p = k.split('/'); let o = S; for (const x of p.slice(0, -1)) o = o[x] = o[x] || {}; o[p[p.length - 1]] = v; }
    return { ok: true, json: async () => null };
  };
}
const source = list => async () => [{ fichiers: async () => list }];

test('requête Gmail : adresse dédiée ou libellé', () => {
  assert.match(requetePj({ address: 'imports+niort@club.fr' }), /has:attachment newer_than:14d \(to:imports\+niort@club\.fr/);
  assert.match(requetePj({ label: 'Resamania' }), /label:Resamania/);
});

test('déposer deux fois le même ZIP ne change aucun total', async () => {
  const S = demo(); const api = fausseBase(S); const buf = await zip(); const avant = contrats(S);
  await passageImports(api, 'tk', S, { sources: source([{ ref: 'g:m1:a1', name: 'RSM_ventes.zip', at: NOW, lire: async () => buf }]), now: NOW, log: null });
  // l'export de gestion fait foi sur sa période (comportement de l'import manuel) : les 3 ventes du fichier y sont
  const apres1 = contrats(S); assert.notEqual(apres1, avant); assert.equal(Object.values(S.entries).filter(e => e.source === 'import' && /^sub:88000/.test(e.rowKey || '')).length, 3);
  await passageImports(api, 'tk', S, { sources: source([{ ref: 'g:m2:a9', name: 'RSM_ventes (copie).zip', at: NOW + 1, lire: async () => buf }]), now: NOW + 3600000, log: null });
  assert.equal(contrats(S), apres1);
  const L = Object.values(S.rsm.autoLog.horizon); assert.equal(L.length, 2); assert.ok(L.some(x => x.doublon));
});

test('même relu sans l’empreinte, la clé stable évite tout doublon', async () => {
  const S = demo(); const buf = await zip();
  await traiter(S, 'horizon', [{ name: 'a.zip', buf, at: NOW }], { now: NOW }); const t1 = contrats(S);
  await traiter(S, 'horizon', [{ name: 'a.zip', buf, at: NOW + 5 }], { now: NOW + 5 });
  assert.equal(contrats(S), t1);
});

test('journal : heure d’arrivée, type détecté, lignes lues et nouvelles', async () => {
  const S = demo(); const { resultats } = await traiter(S, 'horizon', [{ name: 'RSM_ventes.zip', buf: await zip(), at: NOW }], { now: NOW });
  const l = resultats[0].log; assert.equal(l.at, NOW); assert.equal(l.type, 'Vente d’abonnements'); assert.equal(l.rows, 3); assert.ok(l.nouvelles >= 3); assert.deepEqual(l.erreurs, []);
});

test('un export inconnu est classé « non utilisé » sans erreur', async () => {
  const S = demo(); const { resultats } = await traiter(S, 'horizon', [{ name: 'inconnu.csv', buf: Buffer.from('Colonne A;Colonne B\n1;2\n3;4'), at: NOW }], { now: NOW });
  assert.equal(resultats[0].log.type, 'non utilisé'); assert.deepEqual(resultats[0].log.erreurs, []);
});

test('une liste de 2 000 lignes exactes : « Fichier probablement tronqué »', async () => {
  const S = demo(); const rows = ['Numéro;Prénom;Nom;Date d’anniversaire;Statut'];
  for (let i = 0; i < 2000; i++) rows.push(`${700000 + i};P${i};N${i};1990-0${1 + (i % 9)}-1${i % 9};Client`);
  const { resultats } = await traiter(S, 'horizon', [{ name: 'RSM_clients.csv', buf: Buffer.from(rows.join('\n')), at: NOW }], { now: NOW });
  const l = resultats[0].log; assert.equal(l.rows, 2000); assert.equal(l.tronque, true); assert.ok(l.avertissements.some(w => w.startsWith('Fichier probablement tronqué')));
});

test('hors de 6 h à 22 h : rien n’est relevé', async () => {
  const S = demo(); const r = await passageImports(fausseBase(S), 'tk', S, { sources: source([]), now: new Date('2026-10-09T23:30:00+02:00').getTime(), log: null });
  assert.match(r, /hors plage/);
});

test('sans réglage : la boîte de l’accueil déjà reliée est relevée par défaut (tableurs seulement) ; sans boîte reliée, rien', async () => {
  assert.equal(requetePj({}), 'has:attachment newer_than:14d {filename:csv filename:xlsx filename:zip}');
  const S = demo(); delete S.clubs.horizon.rsmAuto; const api = fausseBase(S); const buf = await zip(); const vus = [];
  const sources = async c => [{ fichiers: async src => { vus.push([c, requetePj(src)]); return [{ ref: 'g:d1:a1', name: 'RSM_ventes.zip', at: NOW, lire: async () => buf }]; } }];
  await passageImports(api, 'tk', S, { sources, now: NOW, log: null });
  assert.deepEqual(vus, [], 'club sans réglage ni boîte reliée : pas relevé');
  await passageImports(api, 'tk', S, { sources, now: NOW, log: null, clubsGmail: ['horizon'] });
  assert.deepEqual(vus, [['horizon', 'has:attachment newer_than:14d {filename:csv filename:xlsx filename:zip}']]);
  assert.equal(Object.values(S.rsm.autoLog.horizon).length, 1);
});
