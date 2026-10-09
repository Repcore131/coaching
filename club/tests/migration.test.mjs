// Migration /pulse → /orgs/{org} : mêmes totaux de septembre, clés de connexion converties.
//   TZ=Europe/Paris node club/tests/migration.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerAppli } from '../outils/fitpulse-rapport.mjs';
import { migrer, vueOrg, totaux, ecarts } from '../outils/migration-orgs.mjs';

const demo = () => { const run = chargerAppli('demo'); return JSON.parse(run('JSON.stringify(S)')); };
test('la migration conserve exactement les totaux de septembre', () => {
  const pulse = demo(); const k = 'a'.repeat(40), p = 'b'.repeat(40);
  const { up, rapport } = migrer({ pulse, pulse_boot: { [k]: 'u2', [p]: k }, pulse_product: { p01: { status: 'devant' } } }, 'fitnessparkniort', { nom: 'FPN Gestion' });
  const avant = totaux(pulse, '2026-09'), apres = totaux(vueOrg(up, 'fitnessparkniort'), '2026-09');
  assert.ok(Object.values(avant.horizon.kpi).some(v => v > 0), 'la démo a des chiffres en septembre');
  assert.deepEqual(ecarts(avant, apres), []);
  assert.deepEqual(up[`orgs_boot/${k}`], { org: 'fitnessparkniort', uid: 'u2', privilegie: true });
  assert.equal(up[`orgs_boot/${p}`], k);
  assert.equal(rapport.saisies, Object.keys(pulse.entries).length);
  assert.ok(!('clubs' in up['orgs/fitnessparkniort/data']));
  assert.deepEqual(up['orgs_product/fitnessparkniort'], { p01: { status: 'devant' } });
  assert.equal(up['orgs/fitnessparkniort/info'].securite.mfa, true);
});
test('un écart est détecté (garde-fou)', () => {
  const pulse = demo(); const { up } = migrer({ pulse }, 'x-org');
  const vue = vueOrg(up, 'x-org'); const e = Object.values(vue.entries).find(x => x.date.startsWith('2026-09') && x.kpiId === 'contrats'); e.value += 1;
  assert.ok(ecarts(totaux(pulse, '2026-09'), totaux(vue, '2026-09')).length > 0);
});
