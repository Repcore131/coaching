// LA SAUVEGARDE ET LA RESTAURATION, contre la base en mémoire
// (cloudflare/test/fausse-base.mjs, fetch injecté). Aucun réseau.
//   node scripts/verif/sauvegarde.test.mjs
//
// Ce qui est vérifié :
//   · --critiques n'exporte que la liste, --complet tout ;
//   · un nœud qui répond 413, ou dépasse la limite, est repris UN NIVEAU PLUS
//     BAS (clés, puis enfants par lots) ; un enfant seul trop gros redescend ;
//   · le manifeste dit vrai (sha256, tailles) ;
//   · l'aller-retour export → restauration est À L'IDENTIQUE : la simulation
//     affiche 0 différence, et après dégâts, --ecrire remet la base telle quelle ;
//   · le chiffrement du workflow (tar + openssl) se défait par restaurer_noeud.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fausseBase } from '../../cloudflare/test/fausse-base.mjs';
import { creerClient, sauvegarder, CRITIQUES, resume, ordreFirebase } from '../sauvegarde_base.mjs';
import { restaurer, dechiffrer, difference } from '../restaurer_noeud.mjs';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const temp = mkdtempSync(join(tmpdir(), 'sauvegarde-test-'));
const BASE = 'https://base.test';

// Une base qui ressemble à la vraie : des nœuds critiques, gros et petits,
// des clés numériques (tableaux Firebase) et des textes, des accents.
function donnees() {
  const users = {}, journal = {}, profils = {};
  for (let i = 0; i < 40; i++) users['a' + i + '@t,fr'] = { fname: 'Léa ' + i, sessions: [{ date: i, notes: 'x'.repeat(300) }] };
  for (let i = 0; i < 120; i++) journal['j' + String(i).padStart(4, '0')] = { montant: i * 1.5, note: 'é'.repeat(200) };
  for (let i = 0; i < 60; i++) profils['p' + i + '@t,fr'] = { streak: i, fname: 'Zoé', bloc: 'y'.repeat(900) };
  return {
    users, droits: { 'lea@t,fr': { palier: 'ultime', echeance: 0 }, 'max@t,fr': { palier: 'aucun' } },
    paypal_journal: journal, paypal_premiers: { 'lea@t,fr': 1 },
    worker: { verrou: { jusqua: 0 }, jobs: { serie: { jour: '2026-10-01', fini: true } }, profils },
    evenements_ko: { e1: { type: 'message', erreur: 'base 500' } },
    parrainage: { liens: { 0: 'a', 1: 'b', 10: 'c', 2: 'd' } },
    metrics: { '2026-10-01': { landing_view: 3 } },
  };
}
// Le fetch injecté : la base en mémoire, et un 413 sur le GET entier d'un nœud choisi.
function monde(init, o) {
  const F = fausseBase(init);
  const vus = [];
  const f = async (url, i) => {
    const u = new URL(url);
    vus.push(((i && i.method) || 'GET') + ' ' + u.pathname + u.search);
    const entier = !u.searchParams.has('orderBy') && !u.searchParams.has('shallow');
    if ((!i || !i.method || i.method === 'GET') && entier && (o && o.refus413 || []).includes(u.pathname))
      return { ok: false, status: 413, text: async () => 'Payload Too Large' };
    return F.fetchImpl(url, i);
  };
  return { F, vus, client: (limite) => creerClient({ base: BASE, fetchImpl: f, limite }) };
}
const lireGz = (d, f) => JSON.parse(gunzipSync(readFileSync(join(d, f))).toString('utf8'));

await test('--critiques : la liste seule ; --complet : tout ; le manifeste dit vrai (sha256, tailles)', async () => {
  const w = monde(donnees());
  const d1 = join(temp, 'crit');
  const m = await sauvegarder({ client: w.client(), mode: 'critiques', dossier: d1 });
  assert.deepEqual(m.noeuds, CRITIQUES.filter((k) => k in donnees()).sort(ordreFirebase).sort((a, b) => CRITIQUES.indexOf(a) - CRITIQUES.indexOf(b)));
  assert.ok(!m.noeuds.includes('users') && !m.noeuds.includes('metrics'), 'ni users ni metrics en critiques');
  assert.ok(m.absents.includes('paypal_abonnes'), 'un nœud critique absent de la base est signalé');
  for (const p of m.parts) {
    const brut = gunzipSync(readFileSync(join(d1, p.fichier)));
    assert.equal(createHash('sha256').update(brut).digest('hex'), p.sha256, p.fichier);
    assert.equal(brut.length, p.octets);
  }
  assert.deepEqual(lireGz(d1, 'droits.json.gz'), donnees().droits);
  assert.ok(m.telecharges > 0 && m.requetes > 0);
  assert.match(resume(m), /Téléchargé depuis la base/);
  const d2 = join(temp, 'complet');
  const mc = await sauvegarder({ client: w.client(), mode: 'complet', dossier: d2 });
  assert.deepEqual(mc.noeuds.slice().sort(), Object.keys(donnees()).sort());
});

await test('un 413 sur un nœud : il est repris un niveau plus bas, par lots, sans rien perdre', async () => {
  const w = monde(donnees(), { refus413: ['/paypal_journal.json'] });
  const d = join(temp, 'r413');
  const m = await sauvegarder({ client: w.client(), mode: 'critiques', dossier: d, lot: 50 });
  const parts = m.parts.filter((p) => p.noeud === 'paypal_journal');
  assert.equal(parts.length, 3, '120 enfants en lots de 50');
  assert.ok(parts.every((p) => p.type === 'lot'));
  assert.ok(w.vus.some((v) => v.startsWith('GET /paypal_journal.json?shallow=true')), 'les clés d’abord');
  assert.ok(w.vus.some((v) => /GET \/paypal_journal\.json\?.*orderBy=%22%24key%22.*startAt=.*endAt=/.test(v)), 'puis des plages de clés');
  const tout = Object.assign({}, ...parts.map((p) => lireGz(d, p.fichier)));
  assert.deepEqual(tout, donnees().paypal_journal);
});

await test('au-delà de la limite d’octets : même descente ; un lot trop gros se coupe, un enfant seul trop gros redescend', async () => {
  const w = monde(donnees());
  const d = join(temp, 'limite');
  // 30 Ko : worker (profils ~30 Ko) ne passe pas d'un bloc ; profils non plus.
  const m = await sauvegarder({ client: w.client(30 * 1024), mode: 'critiques', dossier: d, lot: 200 });
  const parts = m.parts.filter((p) => p.noeud === 'worker');
  assert.ok(parts.some((p) => p.chemin === 'worker/profils'), 'worker/profils exporté à part : ' + parts.map((p) => p.chemin + ':' + p.type).join(' '));
  assert.ok(parts.filter((p) => p.chemin === 'worker/profils').length >= 2, 'et lui-même en plusieurs lots');
  assert.ok(m.parts.every((p) => p.octets <= 30 * 1024), 'aucune part au-dessus de la limite');
});

await test('aller-retour : la simulation affiche 0 différence pour chaque nœud, y compris découpé', async () => {
  const w = monde(donnees(), { refus413: ['/paypal_journal.json'] });
  const d = join(temp, 'aller-retour');
  const m = await sauvegarder({ client: w.client(30 * 1024), mode: 'complet', dossier: d, lot: 50 });
  for (const n of m.noeuds) {
    const lignes = [];
    const r = await restaurer({ client: w.client(30 * 1024), dossier: d, noeud: n, ecrire: false, journal: (l) => lignes.push(l) });
    assert.equal(r.difference.total, 0, n + ' : ' + lignes.join(' | '));
    assert.equal(r.ecrit, false);
  }
});

await test('après dégâts : la simulation les montre, sans rien écrire ; --ecrire remet la base à l’identique', async () => {
  const w = monde(donnees());
  const d = join(temp, 'degats');
  await sauvegarder({ client: w.client(), mode: 'critiques', dossier: d });
  // Une clé effacée, une modifiée, une ajoutée.
  w.F.ecrire('droits/lea@t,fr', null);
  w.F.ecrire('droits/max@t,fr/palier', 'ultime');
  w.F.ecrire('droits/pirate@t,fr', { palier: 'suivi' });
  const avant = JSON.stringify(w.F.lire('droits'));
  const sim = await restaurer({ client: w.client(), dossier: d, noeud: 'droits', ecrire: false, journal: () => {} });
  assert.deepEqual(sim.difference.ajoutees, ['lea@t,fr']);
  assert.deepEqual(sim.difference.retirees, ['pirate@t,fr']);
  assert.deepEqual(sim.difference.modifiees, ['max@t,fr']);
  assert.equal(JSON.stringify(w.F.lire('droits')), avant, 'la simulation n’a rien écrit');
  await restaurer({ client: w.client(), dossier: d, noeud: 'droits', ecrire: true, journal: () => {} });
  assert.deepEqual(w.F.lire('droits'), donnees().droits);
  assert.equal((await restaurer({ client: w.client(), dossier: d, noeud: 'droits', ecrire: false, journal: () => {} })).difference.total, 0);
});

await test('build 1876 : UN SEUL dossier (users/<clé>) se restaure depuis le complet, sans toucher aux autres', async () => {
  const w = monde(donnees());
  const d = join(temp, 'un-dossier');
  await sauvegarder({ client: w.client(), mode: 'complet', dossier: d });
  w.F.ecrire('users/a3@t,fr/fname', 'Abîmé');
  w.F.ecrire('users/a4@t,fr/fname', 'Changé après');
  const sim = await restaurer({ client: w.client(), dossier: d, noeud: 'users/a3@t,fr', ecrire: false, journal: () => {} });
  assert.deepEqual(sim.difference.modifiees, ['fname']);
  await restaurer({ client: w.client(), dossier: d, noeud: 'users/a3@t,fr', ecrire: true, journal: () => {} });
  assert.equal(w.F.lire('users/a3@t,fr/fname'), 'Léa 3');
  assert.equal(w.F.lire('users/a4@t,fr/fname'), 'Changé après', 'l’autre dossier n’est pas touché');
});

await test('un nœud découpé se réécrit par lots, et ses enfants en trop sont retirés (comme un PUT)', async () => {
  const w = monde(donnees(), { refus413: ['/paypal_journal.json'] });
  const d = join(temp, 'decoupe');
  await sauvegarder({ client: w.client(), mode: 'critiques', dossier: d, lot: 50 });
  w.F.ecrire('paypal_journal/j0005', null);
  w.F.ecrire('paypal_journal/zz-intrus', { montant: 1 });
  const r = await restaurer({ client: w.client(), dossier: d, noeud: 'paypal_journal', ecrire: true, journal: () => {} });
  assert.equal(r.difference.total, 2);
  assert.deepEqual(w.F.lire('paypal_journal'), donnees().paypal_journal);
});

await test('une part abîmée (sha256 faux) : on refuse, on n’écrit rien', async () => {
  const w = monde(donnees());
  const d = join(temp, 'abime');
  await sauvegarder({ client: w.client(), mode: 'critiques', dossier: d });
  const mf = JSON.parse(readFileSync(join(d, 'manifeste.json'), 'utf8'));
  mf.parts.find((p) => p.noeud === 'droits').sha256 = '0'.repeat(64);
  (await import('node:fs')).writeFileSync(join(d, 'manifeste.json'), JSON.stringify(mf));
  w.F.ecrire('droits/max@t,fr/palier', 'ultime');
  await assert.rejects(restaurer({ client: w.client(), dossier: d, noeud: 'droits', ecrire: true, journal: () => {} }), /sha256/);
  assert.equal(w.F.lire('droits/max@t,fr/palier'), 'ultime');
});

await test('le chiffrement du workflow (tar + openssl aes-256-cbc pbkdf2) se défait par restaurer_noeud', async () => {
  let openssl = true;
  try { execFileSync('openssl', ['version'], { stdio: 'ignore' }); } catch (e) { openssl = false; }
  if (!openssl) { console.log('     (openssl absent : épreuve sautée)'); return; }
  const w = monde(donnees());
  const nom = 'sauvegarde-2026-10-01-critiques';
  await sauvegarder({ client: w.client(), mode: 'critiques', dossier: join(temp, nom) });
  const cle = 'une-cle-de-test-' + Math.random().toString(36).slice(2);
  // LES MÊMES COMMANDES QUE .github/workflows/sauvegarde.yml.
  execFileSync('tar', ['-cf', join(temp, nom + '.tar'), '-C', temp, nom]);
  execFileSync('openssl', ['enc', '-aes-256-cbc', '-pbkdf2', '-iter', '200000', '-salt', '-in', join(temp, nom + '.tar'),
    '-out', join(temp, nom + '.tar.enc'), '-pass', 'env:SAUVEGARDE_CLE'], { env: Object.assign({}, process.env, { SAUVEGARDE_CLE: cle }) });
  const clair = readFileSync(join(temp, nom + '.tar.enc'));
  assert.ok(!clair.includes(Buffer.from('manifeste')), 'l’archive chiffrée ne laisse rien lire');
  const dd = dechiffrer(join(temp, nom + '.tar.enc'), cle);
  try {
    const r = await restaurer({ client: w.client(), dossier: dd, noeud: 'droits', ecrire: false, journal: () => {} });
    assert.equal(r.difference.total, 0);
  } finally { rmSync(dd, { recursive: true, force: true }); }
  assert.throws(() => dechiffrer(join(temp, nom + '.tar.enc'), 'mauvaise-cle'));
});

await test('difference : valeurs simples et objets', async () => {
  assert.equal(difference(3, 3).total, 0);
  assert.equal(difference(3, 4).total, 1);
  assert.equal(difference({ a: { b: 1, c: 2 } }, { a: { c: 2, b: 1 } }).total, 0, 'l’ordre des clés ne compte pas');
});

rmSync(temp, { recursive: true, force: true });
console.log(ok + ' tests passés');
