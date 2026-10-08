// node --test scripts/verif/assetlinks.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifierAssetlinks } from './assetlinks.mjs';

const A = '9E:55:AE:95:8A:99:DC:55:22:8B:8F:CD:8A:9C:FD:81:2E:90:25:02:51:ED:B3:57:55:A6:AF:2A:0C:6A:98:FA';
const P = 'AB:'.repeat(31) + 'CD';
const doc = (e) => JSON.stringify([{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: 'com.repcore.app', sha256_cert_fingerprints: e } }]);
test('une clé, Play pas encore posée : vert', () => assert.equal(verifierAssetlinks(doc([A]), A, 'A_POSER').ok, true));
test('deux empreintes dans l’ordre : vert', () => assert.equal(verifierAssetlinks(doc([A, P]), A, P).ok, true));
test('Play posée mais absente, ou ordre inversé, ou mal formée : rouge', () => {
  assert.equal(verifierAssetlinks(doc([A]), A, P).ok, false);
  assert.equal(verifierAssetlinks(doc([P, A]), A, P).ok, false);
  assert.equal(verifierAssetlinks(doc([A, 'ab:cd']), A, 'A_POSER').ok, false);
  assert.equal(verifierAssetlinks('[]', A, '').ok, false);
});
