// Migration de bout en bout sur le simulateur : /pulse (démo) → /orgs/fitnessparkniort,
// écriture, relecture, totaux de septembre identiques ; seconde exécution refusée.
//   cd club/tests/emul && npx firebase-tools emulators:exec --only database --project fitpulse-test "node ../migration.emul.mjs"
import { chargerAppli } from '../outils/fitpulse-rapport.mjs';
import { main } from '../outils/migration-orgs.mjs';

process.env.FIREBASE_NS = 'fitpulse-migration';
const H = `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000'}`, ns = `?ns=${process.env.FIREBASE_NS}`, owner = { authorization: 'Bearer owner' };
const run = chargerAppli('demo'); const pulse = JSON.parse(run('JSON.stringify(S)'));
await fetch(`${H}/.json${ns}`, { method: 'PUT', headers: owner, body: JSON.stringify({ pulse, pulse_boot: { ['a'.repeat(40)]: 'u2', ['b'.repeat(40)]: 'a'.repeat(40) } }) });
let fails = 0; const ok = (l, c) => { console.log(`${c ? 'OK ' : 'KO '} ${l}`); if (!c) fails++; };
const r = await main(['--org', 'fitnessparkniort', '--nom', 'FPN Gestion', '--mois', '2026-09', '--ecrire']);
ok(`migration écrite (${r.rapport.saisies} saisies, ${r.rapport.utilisateurs} utilisateurs), totaux de septembre identiques après relecture`, r.rapport.saisies > 100 && r.rapport.clubs >= 1 && Object.values(r.avant.niort.kpi).some(v => v > 0) && JSON.stringify(r.avant) === JSON.stringify(r.apres));
const boot = await (await fetch(`${H}/orgs_boot/${'a'.repeat(40)}.json${ns}`, { headers: owner })).json();
ok('clé de connexion convertie', boot && boot.org === 'fitnessparkniort' && boot.uid === 'u2');
ok('/pulse intact', !!(await (await fetch(`${H}/pulse/entries.json${ns}&shallow=true`, { headers: owner })).json()));
let refus = false; try { await main(['--org', 'fitnessparkniort', '--mois', '2026-09', '--ecrire']); } catch (e) { refus = /existe déjà/.test(e.message); }
ok('seconde migration vers le même espace refusée', refus);
console.log(fails ? `${fails} échec(s)` : 'Migration : tout est bon.'); process.exit(fails ? 1 : 0);
