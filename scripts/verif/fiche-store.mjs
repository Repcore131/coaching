#!/usr/bin/env node
// LA FICHE PLAY STORE EST PRÊTE À COLLER (02/10/2026).
//
// android/fiche-store/fr-FR/ suit le format de fastlane (supply) : title.txt,
// short_description.txt, full_description.txt, changelogs/<versionCode>.txt,
// images/phoneScreenshots/, images/featureGraphic.png, images/icon.png.
//
// CE QUE CE CONTRÔLE REFUSE :
//   1. un texte trop long pour la Play Console : titre 30, description courte
//      80, description complète 4000, notes de version 500 (en caractères) ;
//   2. un prix NON LIÉ : un montant en euros écrit en dur dans le modèle de la
//      description (il doit passer par {{tarif:<clé>}}), ou n'importe quel
//      montant dans le titre, la description courte ou les notes ; une
//      description complète qui n'est plus le modèle rendu avec tarifs.json
//      (lancer node scripts/tarifs.mjs) ;
//   3. des notes de version absentes pour le versionCode de build.gradle ;
//   4. des images que la Play Console refuserait : 2 à 8 captures, chacune
//      entre 320 et 3840 px de côté, dont le grand côté ne dépasse pas le
//      double du petit, sans couche alpha ; une bannière de 1024×500 sans
//      transparence ; une icône de 512×512.
// Et il se prouve : un titre trop long et un prix en dur doivent être vus.
//   node scripts/verif/fiche-store.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { RACINE, lireTarifs, rendreFiche, FICHES } from '../tarifs.mjs';

const F = RACINE + 'android/fiche-store/';
export const LIMITES = { 'title.txt': 30, 'short_description.txt': 80, 'full_description.txt': 4000 };
export const NOTES_MAX = 500;
const longueur = (s) => [...String(s).replace(/\n$/, '')].length;
const RE_PRIX = /\d[\d  .,]*\s?€/;

// Les dimensions d'une image PNG (en-tête IHDR, et sa couche alpha) ou JPEG
// (premier segment SOF).
export function infoImage(buf) {
  if (!buf || buf.length < 26) return null;
  if (buf.toString('ascii', 1, 4) === 'PNG') return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), alpha: buf[25] === 6 || buf[25] === 4 };
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  for (let i = 2; i + 9 < buf.length;) {
    if (buf[i] !== 0xff) return null;
    const m = buf[i + 1], l = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5), alpha: false };
    i += 2 + l;
  }
  return null;
}
export function controlerTextes(t) {
  const e = [];
  for (const [f, max] of Object.entries(LIMITES)) {
    if (t[f] == null) { e.push('fr-FR/' + f + ' absent'); continue; }
    const n = longueur(t[f]);
    if (!n) e.push('fr-FR/' + f + ' vide');
    if (n > max) e.push('fr-FR/' + f + ' : ' + n + ' caractères, ' + max + ' au plus');
  }
  for (const f of ['title.txt', 'short_description.txt']) if (t[f] && RE_PRIX.test(t[f])) e.push('fr-FR/' + f + ' : un prix (aucun lien possible avec tarifs.json)');
  for (const [v, n] of Object.entries(t.notes || {})) {
    if (longueur(n) > NOTES_MAX) e.push('changelogs/' + v + '.txt : ' + longueur(n) + ' caractères, ' + NOTES_MAX + ' au plus');
    if (RE_PRIX.test(n)) e.push('changelogs/' + v + '.txt : un prix');
  }
  // Le modèle : chaque montant passe par {{tarif:…}}.
  const libre = String(t.modele || '').replace(/\{\{(tarif|nb):[a-z_.]+\}\}/gi, '');
  const m = libre.match(RE_PRIX);
  if (m) e.push('modeles/full_description.txt : prix écrit en dur « ' + m[0].trim() + ' » — {{tarif:<clé>}}');
  if (t.attendu != null && t['full_description.txt'] !== t.attendu) e.push('fr-FR/full_description.txt n’est pas le modèle rendu avec tarifs.json — node scripts/tarifs.mjs');
  return e;
}

if (process.argv[1] && process.argv[1].endsWith('fiche-store.mjs')) {
  const T = lireTarifs();
  const erreurs = [];
  const lire = (f) => { try { return readFileSync(F + f, 'utf8'); } catch (e) { return null; } };
  const textes = { notes: {} };
  for (const f of Object.keys(LIMITES)) textes[f] = lire('fr-FR/' + f);
  textes.modele = lire('modeles/full_description.txt') || '';
  textes.attendu = rendreFiche(readFileSync(RACINE + FICHES[0][0], 'utf8'), T);
  let notes = [];
  try { notes = readdirSync(F + 'fr-FR/changelogs').filter((x) => /^\d+\.txt$/.test(x)); } catch (e) { notes = []; }
  for (const n of notes) textes.notes[n.replace('.txt', '')] = lire('fr-FR/changelogs/' + n);
  erreurs.push(...controlerTextes(textes));
  // 3. Les notes de la version en cours.
  const v = (readFileSync(RACINE + 'android/app/build.gradle', 'utf8').match(/versionCode (\d+)/) || [])[1];
  const twa = JSON.parse(readFileSync(RACINE + 'android/twa-manifest.json', 'utf8'));
  if (!v || !textes.notes[v]) erreurs.push('changelogs/' + v + '.txt absent (versionCode de build.gradle)');
  if (String(twa.appVersionCode) !== String(v)) erreurs.push('twa-manifest.json appVersionCode ' + twa.appVersionCode + ' ≠ build.gradle versionCode ' + v);
  // 4. Les images.
  const img = (f) => { const p = F + 'fr-FR/images/' + f; return existsSync(p) ? infoImage(readFileSync(p)) : null; };
  let caps = [];
  try { caps = readdirSync(F + 'fr-FR/images/phoneScreenshots').filter((x) => /\.(png|jpe?g)$/i.test(x)).sort(); } catch (e) { caps = []; }
  if (caps.length < 2 || caps.length > 8) erreurs.push(caps.length + ' capture(s) : 2 à 8 attendues (node scripts/captures-store.mjs)');
  for (const c of caps) {
    const i = img('phoneScreenshots/' + c);
    if (!i) { erreurs.push(c + ' : image illisible'); continue; }
    if (i.alpha) erreurs.push(c + ' : PNG avec couche alpha, refusé par la Play Console');
    const pt = Math.min(i.w, i.h), gd = Math.max(i.w, i.h);
    if (pt < 320 || gd > 3840 || gd > 2 * pt) erreurs.push(c + ' : ' + i.w + '×' + i.h + ' refusé (320 à 3840 px, grand côté ≤ 2 × petit)');
  }
  const fg = img('featureGraphic.jpg') || img('featureGraphic.png');
  if (!fg || fg.w !== 1024 || fg.h !== 500 || fg.alpha) erreurs.push('images/featureGraphic.(jpg|png) : 1024×500 sans transparence attendu' + (fg ? ' (' + fg.w + '×' + fg.h + (fg.alpha ? ', alpha' : '') + ')' : ''));
  const ic = img('icon.png');
  if (!ic || ic.w !== 512 || ic.h !== 512) erreurs.push('images/icon.png : 512×512 attendu');
  // Le contrôle se prouve.
  const faux1 = controlerTextes(Object.assign({}, textes, { 'title.txt': 'RepCore – Carnet de musculation' }));
  if (!faux1.some((x) => /title\.txt : 31 caractères/.test(x))) erreurs.push('auto-contrôle : un titre de 31 caractères n’est pas vu');
  const faux2 = controlerTextes(Object.assign({}, textes, { modele: textes.modele + '\nOffre : 9,95 € par mois.' }));
  if (!faux2.some((x) => /prix écrit en dur « 9,95 € »/.test(x))) erreurs.push('auto-contrôle : un prix en dur n’est pas vu');
  if (erreurs.length) { console.error('FICHE PLAY STORE (' + erreurs.length + ') :\n  ' + erreurs.join('\n  ')); process.exit(1); }
  console.log('Fiche Play Store prête : titre ' + longueur(textes['title.txt']) + '/30, courte ' + longueur(textes['short_description.txt']) + '/80, complète '
    + longueur(textes['full_description.txt']) + '/4000, notes v' + v + ', ' + caps.length + ' captures, bannière 1024×500, icône 512. Prix liés à tarifs.json.');
}
