// AUCUN CHEMIN DE DÉPLOIEMENT NE PUBLIE functions/ (01/10/2026).
//   node cloudflare/test/deploiement.test.mjs
//
// Les Cloud Functions et le Worker ensemble traiteraient chaque paiement deux
// fois (functions/README.md, « NE PAS DÉPLOYER »). Ce test tombe si :
//   · firebase.json déclare de nouveau un codebase `functions` ;
//   · un workflow, deploie.sh ou un script lance `firebase deploy` sans
//     `--only`, ou avec un `--only` qui nomme functions.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const racine = new URL('../../', import.meta.url);
const lire = (c) => readFileSync(new URL(c, racine), 'utf8');

await test('firebase.json ne déclare aucun codebase functions', async () => {
  const f = JSON.parse(lire('firebase.json'));
  assert.equal(f.functions, undefined, 'clé « functions » présente dans firebase.json');
  assert.ok(f.hosting && f.database, 'hébergement et règles restent déclarés');
});

await test('aucun `firebase deploy` sans --only, ni avec --only functions', async () => {
  const fichiers = ['deploie.sh'].concat(readdirSync(new URL('.github/workflows/', racine)).map((x) => '.github/workflows/' + x));
  if (existsSync(new URL('scripts/', racine)))
    for (const x of readdirSync(new URL('scripts/', racine))) if (/\.(sh|mjs|js|py)$/.test(x)) fichiers.push('scripts/' + x);
  let vus = 0;
  for (const c of fichiers) {
    lire(c).split('\n').forEach((l, i) => {
      if (/^\s*#/.test(l) || !/firebase(-tools)?\s+deploy\b/.test(l)) return;
      vus++;
      const only = l.match(/--only[\s=]+["']?([^\s"']+)/);
      assert.ok(only, c + ':' + (i + 1) + ' : firebase deploy sans --only publierait tout');
      assert.ok(!/functions/.test(only[1]), c + ':' + (i + 1) + ' : --only ' + only[1] + ' publie functions/');
    });
  }
  assert.ok(vus >= 2, 'les déploiements connus (firebase.yml, deploie.sh) sont bien lus');
});

console.log(ok + ' tests passés');
