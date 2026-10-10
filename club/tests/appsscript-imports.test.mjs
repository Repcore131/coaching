// Script Gmail des imports (apps-script-imports/Code.gs) exécuté sur une boîte simulée.
//   node --test club/tests/appsscript-imports.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const CODE = readFileSync(new URL('../apps-script-imports/Code.gs', import.meta.url), 'utf8');
const blob = (nom, contenu) => ({ nom, contenu, getName() { return this.nom; }, setName(n) { this.nom = n; return this; }, getBytes() { return [...Buffer.from(this.contenu)]; }, copyBlob() { return blob(this.nom, this.contenu); } });
const message = (id, objet, pj = [], corps = '') => ({ getId: () => id, getSubject: () => objet, getAttachments: () => pj, getBody: () => corps, getPlainBody: () => corps });
function monde(fils, web = {}, props = { FP_CLUB_TOKEN: 'JETON', FP_MANAGER_EMAIL: 'gerant@club.example' }) {
  const importes = new Set(); const recus = []; const mails = []; const lignes = []; const libelles = {};
  const label = n => ({ n }); const ctx = {
    console, Date, JSON, String, Object, decodeURIComponent, Buffer,
    GmailApp: { search: () => fils, getUserLabelByName: n => label(n), createLabel: n => label(n) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    MailApp: { sendEmail: (a, s, b) => mails.push({ a, s, b }) },
    SpreadsheetApp: { create: () => ({ getId: () => 'feuille', getSheets: () => [{ appendRow: r => lignes.push(r) }] }), openById: () => ({ getSheets: () => [{ appendRow: r => lignes.push(r) }] }) },
    UrlFetchApp: { fetch: (u, o = {}) => {
      if (u.includes('ingestRecevoir')) { // serveur : refuse un id Gmail déjà traité
        if (o.headers['X-Club-Token'] !== 'JETON') return { getResponseCode: () => 401, getContentText: () => '{}' };
        const cle = o.payload.gmailId + ':' + o.payload.file.getName(); recus.push(cle);
        if (importes.has(cle)) return { getResponseCode: () => 409, getContentText: () => '{"statut":"doublon"}' };
        importes.add(cle); return { getResponseCode: () => 200, getContentText: () => '{"statut":"queued"}' };
      }
      const w = web[u]; return { getResponseCode: () => w.code || 200, getAllHeaders: () => w.h, getBlob: () => blob('x', w.corps), getContentText: () => w.corps };
    } },
  };
  vm.createContext(ctx); vm.runInContext(CODE, ctx);
  const fil = msgs => ({ getMessages: () => msgs, addLabel: l => { libelles[msgs[0].getId()] = l.n; } });
  return { ctx, importes, recus, mails, lignes, libelles, fil };
}

test('un même mail traité deux fois ne crée qu’un import ; journal et libellé FP-importé', () => {
  const fils = []; const w = monde(fils);
  fils.push(w.fil([message('18c1', 'Export Resamania', [blob('RSM_ventes.csv', 'a;b'), blob('notice.pdf', '%PDF')])]));
  w.ctx.releverImports(); w.ctx.releverImports();
  assert.equal(w.importes.size, 1); assert.equal(w.recus.length, 2, 'renvoyé, mais refusé par le serveur');
  assert.equal(w.libelles['18c1'], 'FP-importé');
  assert.deepEqual(w.lignes.slice(1).map(l => [l[1], l[2], String(l[4]).slice(0, 3)]), [['Export Resamania', 'RSM_ventes.csv', '200'], ['Export Resamania', 'RSM_ventes.csv', '409']]);
});
test('lien vers un fichier : envoyé ; lien vers une page de connexion : alerte au manager, aucun import, FP-erreur', () => {
  const fils = []; const web = {
    'https://exports.example/f/123': { h: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="RSM_clients.csv"' }, corps: 'x;y' },
    'https://exports.example/login': { h: { 'Content-Type': 'text/html; charset=utf-8' }, corps: '<form><input type="password"></form>' },
  };
  const w = monde(fils, web);
  fils.push(w.fil([message('m1', 'Votre export est prêt', [], 'Téléchargez : https://exports.example/f/123')]));
  fils.push(w.fil([message('m2', 'Votre export est prêt', [], '<a href="https://exports.example/login">ici</a>')]));
  w.ctx.releverImports();
  assert.deepEqual([...w.importes], ['m1:RSM_clients.csv']);
  assert.equal(w.libelles.m1, 'FP-importé'); assert.equal(w.libelles.m2, 'FP-erreur');
  assert.equal(w.mails.length, 1); assert.equal(w.mails[0].s, 'Export à ouvrir à la main'); assert.match(w.mails[0].b, /https:\/\/exports\.example\/login/);
});
test('jeton lu dans les propriétés du script, jamais écrit dans le code ; aucun tiret long', () => {
  assert.match(CODE, /getProperty\('FP_CLUB_TOKEN'\)/); assert.doesNotMatch(CODE, /X-Club-Token': '[A-Za-z0-9]/);
  assert.match(CODE, /label:' \+ LABEL_IN \+ ' -label:' \+ LABEL_OK \+ ' newer_than:3d'/); assert.match(CODE, /everyMinutes\(15\)/);
  for (const f of ['../apps-script-imports/Code.gs', '../apps-script-imports/README.md']) assert.doesNotMatch(readFileSync(new URL(f, import.meta.url), 'utf8'), /[–—]/, f);
  assert.throws(() => monde([], {}, {}).ctx.releverImports(), /FP_CLUB_TOKEN/);
});
