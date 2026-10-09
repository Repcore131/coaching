// node --test scripts/verif/mise_en_prod.test.mjs — sur une FAUSSE base, sans réseau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { etatMiseEnProd, texteMiseEnProd, uidDuDepot, SECRETS_REQUIS, UID_ABSENT } from '../mise_en_prod.mjs';

const BASE_FAITE = { droitsServeur: { le: 1, v: 2 }, boutique: { a: { titre: 'X', aContenu: true } }, boutique_contenu: { a: { seances: '[]', maj: 1 } }, fitpulse: [] };
const etat = (l, k) => l.find((e) => e.cle === k).etat;

test('tout est fait : sept étapes FAIT', () => {
  const l = etatMiseEnProd({ uid: 'abc123', secrets: SECRETS_REQUIS, sauvegarde: true, sante: { ok: true }, base: BASE_FAITE });
  assert.equal(l.length, 7);
  assert.ok(l.every((e) => e.etat === 'FAIT'), JSON.stringify(l));
  assert.match(texteMiseEnProd(l), /Tout est fait/);
});
test('rien n’est fait : chaque étape dit son geste', () => {
  const l = etatMiseEnProd({ uid: UID_ABSENT, secrets: ['FIREBASE_SERVICE_ACCOUNT'], sante: { ok: false, raison: 'pouls_absent' },
    base: { boutique: { a: { seances: '[1]', maj: 2 } }, fitpulse: ['pulse'] } });
  for (const k of ['uid', 'secrets', 'droits', 'boutique', 'worker', 'fitpulse']) assert.equal(etat(l, k), 'A_FAIRE', k);
  assert.equal(etat(l, 'sauvegarde'), 'INCONNU');
  assert.match(l.find((e) => e.cle === 'secrets').detail, /SAUVEGARDE_CLE, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID/);
  assert.match(l.find((e) => e.cle === 'boutique').detail, /1 fiche/);
  assert.ok(l.filter((e) => e.etat === 'A_FAIRE').every((e) => e.geste));
});
test('sans base ni secrets connus : INCONNU, jamais FAIT par défaut', () => {
  const l = etatMiseEnProd({ uid: 'x' });
  for (const k of ['secrets', 'droits', 'boutique', 'worker', 'sauvegarde', 'fitpulse']) assert.equal(etat(l, k), 'INCONNU', k);
});
test('l’UID se lit dans createur.js', () => {
  assert.equal(uidDuDepot("export const CREATEUR_UID = 'UID_CREATEUR_A_POSER';"), UID_ABSENT);
  assert.equal(uidDuDepot("export const CREATEUR_UID = 'k3v1n';"), 'k3v1n');
});
test('la commande, sur une fausse base : lecture seule, sortie 2 tant qu’il reste à faire, --ecrire refusé', () => {
  const d = mkdtempSync(join(tmpdir(), 'mep-'));
  const f = join(d, 'base.json');
  writeFileSync(f, JSON.stringify(Object.assign({ _sante: { ok: true } }, BASE_FAITE)));
  const r = spawnSync(process.execPath, ['scripts/mise_en_prod.mjs', '--base=' + f], { encoding: 'utf8', env: Object.assign({}, process.env, { SECRETS_PRESENTS: SECRETS_REQUIS.join(','), SAUVEGARDE_FAITE: '1' }) });
  assert.match(r.stdout, /FAIT    Rattrapage des droits/);
  assert.match(r.stdout, /FAIT    Boutique migrée/);
  // L'UID du dépôt n'est pas encore posé : il reste une étape.
  const uid = uidDuDepot(readFileSync('cloudflare/src/createur.js', 'utf8'));
  assert.equal(r.status, uid && uid !== UID_ABSENT ? 0 : 2);
  const w = spawnSync(process.execPath, ['scripts/mise_en_prod.mjs', '--base=' + f, '--ecrire'], { encoding: 'utf8' });
  assert.equal(w.status, 1);
  assert.match(w.stderr, /refuse une fausse base/);
});
