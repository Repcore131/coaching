// node --test club/tests  — lecture des fichiers déposés et nettoyage des écritures Firebase
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const fn = (file, name) => { const t = src(file); const i = t.indexOf('function ' + name + '('); let d = 0, j = t.indexOf('{', i); for (; j < t.length; j++) { if (t[j] === '{') d++; else if (t[j] === '}' && !--d) break; } return t.slice(i, j + 1); };
const { parseCSV, decodeBytes, fbClean } = new Function(`${fn('pages-data.js', 'parseCSV')}\n${fn('resamania.js', 'decodeBytes')}\n${fn('core.js', 'fbVal')}\n${fn('core.js', 'fbClean')}\nreturn { parseCSV, decodeBytes, fbClean };`)();

test('CSV : séparateur, ligne de titre, sep=, guillemets', () => {
  assert.deepEqual(parseCSV('a;b;c\n1;2;3\n').headers, ['a', 'b', 'c']);
  assert.deepEqual(parseCSV('a,b,c\n1,"2,5",3\n').rows, [['1', '2,5', '3']]);
  assert.deepEqual(parseCSV('﻿sep=;\r\nNom;Prénom\r\nA;B\r\n').headers, ['Nom', 'Prénom']);
  const t = parseCSV('Export du 05/10/2026\n\nNuméro;Nom;Date\n1;A;02/09/2026\n2;B;03/09/2026\n');
  assert.deepEqual(t.headers, ['Numéro', 'Nom', 'Date']); assert.equal(t.rows.length, 2);
  assert.deepEqual(parseCSV('a\tb\n1\t2\n').rows, [['1', '2']]);
  assert.deepEqual(parseCSV('Produit;Taille\nBarre 12" ;XL\n').rows, [['Barre 12"', 'XL']]);
  assert.deepEqual(parseCSV('a;b;\n1;2;\n').headers, ['a', 'b']);
});
test('encodages', () => {
  assert.equal(decodeBytes(new TextEncoder().encode('Échéancier €')).text, 'Échéancier €');
  assert.equal(decodeBytes(Uint8Array.from([0x4e, 0xe9, 0x3b, 0x80])).encoding, 'Windows-1252');
  // Node sans ICU complet décode windows-1252 comme latin-1 ; les navigateurs suivent le WHATWG
  if (new TextDecoder('windows-1252').decode(Uint8Array.from([0x80])) === '€') assert.equal(decodeBytes(Uint8Array.from([0x4e, 0xe9, 0x3b, 0x80])).text, 'Né;€');
  assert.equal(decodeBytes(Uint8Array.from([0x4e, 0xe9, 0x3b, 0xa4])).text, 'Né;€');
  const u16 = Uint8Array.from([0xff, 0xfe, ...[...'Nom'].flatMap(c => [c.charCodeAt(0), 0])]);
  assert.equal(decodeBytes(u16).text.replace(/^﻿/, ''), 'Nom');
});
test('écritures Firebase : undefined, NaN, clés interdites, chemins imbriqués', () => {
  assert.deepEqual(fbClean([[['a', 'b'], { x: 1, y: undefined, z: NaN }], [['a', 'b', 'c'], 2]]), { 'a/b': { x: 1, c: 2 } });
  assert.deepEqual(fbClean([[['a', 'b', 'c'], 2], [['a', 'b'], { x: 1 }]]), { 'a/b': { x: 1 } });
  assert.deepEqual(fbClean([[['k', 'e.mail'], { 'p.q': 1 }]]), { 'k/e,mail': { 'p,q': 1 } });
  assert.deepEqual(fbClean([[['v'], undefined]]), { v: null });
});
