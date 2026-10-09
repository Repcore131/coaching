// Inventaire des libellés : chaque terme interdit présent dans le HTML est relevé, le HTML n'est pas modifié.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { auditer, INTERDITS, plat, trouves } = require('../scripts/audit-libelles.js');

test('comparaison sans casse ni accents, mot entier', () => {
  assert.deepEqual(trouves('Voir la LEGENDE du club'), ['Légende']);
  assert.deepEqual(trouves('Feedback reçu'), []);
  assert.deepEqual(trouves('Bilan  du   jour'), ['Bilan du jour']);
  assert.equal(plat('Défis’flash'), 'defis\'flash');
});

test('chaînes JS, gabarits imbriqués, HTML et fonction englobante', () => {
  const html = `<title>Mes clubs</title><script>
function renderX() { return \`<h1>\${ok ? 'Défis flash' : ''}</h1>\`; }
const LEVELS = [{ name: 'Rookie' }];
// commentaire : Warrior
const re = /Feed/g;
</script>`;
  const r = auditer(html); const t = r.map(x => x.terme);
  for (const x of ['Mes clubs', 'Défis flash', 'Rookie', 'Warrior']) assert.ok(t.includes(x), x);
  assert.equal(r.find(x => x.terme === 'Défis flash').fonction, 'renderX');
  assert.equal(r.find(x => x.terme === 'Rookie').fonction, 'LEVELS');
  assert.equal(r.find(x => x.terme === 'Warrior').fonction, 'hors interface');
});

test('fichier complet : tout terme présent est relevé, le fichier reste identique', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'audit-')); const html = path.join(dir, 'fitpulse.html'), csv = path.join(dir, 'out.csv');
  execFileSync(process.execPath, [path.join(ici, '../outils/build-single.mjs'), html], { stdio: 'ignore' });
  const avant = createHash('sha256').update(readFileSync(html)).digest('hex');
  const r = spawnSync(process.execPath, [path.join(ici, '../scripts/audit-libelles.js'), html, csv], { encoding: 'utf8' });
  assert.notEqual(r.status, 1, r.stderr);
  assert.equal(createHash('sha256').update(readFileSync(html)).digest('hex'), avant);
  const src = plat(readFileSync(html, 'utf8')); const lignes = readFileSync(csv, 'utf8');
  assert.match(lignes.split('\n')[0], /^chaîne;ligne;fonction;terme interdit trouvé$/);
  const releves = new Set(auditer(readFileSync(html, 'utf8')).map(x => x.terme));
  for (const t of INTERDITS) if (src.includes(plat(t)) && trouves(src).includes(t)) assert.ok(releves.has(t), t);
});
