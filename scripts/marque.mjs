#!/usr/bin/env node
// LA MARQUE, CENTRALISÉE (série 6, lot 19, 08/10/2026).
//
// marque.json porte les valeurs ; ce script les RECOPIE aux endroits du code
// qui les écrivent en dur (une constante par endroit, lue par motif), puis
// réassemble rc-core. Comme scripts/tarifs.mjs pour les prix.
//   node scripts/marque.mjs            (recopie + assemble)
//   node scripts/marque.mjs --verifier (rouge si un endroit diffère)
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const R = new URL('../', import.meta.url);
// [fichier, motif (la valeur dans le 1er groupe), clé de marque.json]
export const CIBLES = [
  ['src/core/001-debut.js', /const ROUGE_MARQUE='(#[0-9A-F]{6})'/, 'couleur'],
  ['src/core/001-debut.js', /ROUGE_MARQUE_MIN='(#[0-9a-f]{6})'/, 'couleur', (v) => v.toLowerCase()],
  ['src/core/001-debut.js', /const CREATOR_EMAIL='([^']+)'/, 'contact'],
  ['src/core/002-l-essai-athlete-symetrique-de-la-promesse-coach.js', /const CONTACT_CREATEUR='([^']+)'/, 'contact'],
  ['src/core/022-le-qr-du-pied-de-carte.js', /const RC_COMPTE_INSTAGRAM='([^']+)'/, 'instagram'],
  ['src/core/022-le-qr-du-pied-de-carte.js', /const RC_ADRESSE_AFFICHEE='([^']+)'/, 'adresse'],
  ['src/core/030-la-fiche-alimentaire-imprimable.js', /createur\?'([^']+)':''\),/, 'slogan'],
  ['cloudflare/src/metier.js', /export const CREATOR_EMAIL = '([^']+)';/, 'contact'],
];
// PURE. Les écarts entre la marque et les textes : [{fichier, cle, attendu, trouve}].
export function ecartsMarque(marque, lire) {
  const l = [];
  for (const [f, re, cle, tr] of CIBLES) {
    const m = re.exec(lire(f));
    const attendu = tr ? tr(String(marque[cle])) : String(marque[cle]);
    if (!m) l.push({ fichier: f, cle, attendu, trouve: null });
    else if (m[1] !== attendu) l.push({ fichier: f, cle, attendu, trouve: m[1] });
  }
  return l;
}
// PURE. Le texte avec la valeur remplacée.
export function recopier(texte, re, valeur) {
  return texte.replace(re, (tout, ancien) => tout.replace(ancien, valeur));
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const marque = JSON.parse(readFileSync(new URL('marque.json', R), 'utf8'));
  const lire = (f) => readFileSync(new URL(f, R), 'utf8');
  const e = ecartsMarque(marque, lire);
  if (process.argv.includes('--verifier')) {
    if (e.length) { for (const x of e) console.error('marque : ' + x.fichier + ' (' + x.cle + ') vaut ' + JSON.stringify(x.trouve) + ', marque.json dit ' + JSON.stringify(x.attendu)); process.exit(1); }
    console.log('marque.json : ' + CIBLES.length + ' endroits à jour.');
    process.exit(0);
  }
  for (const x of e) {
    if (x.trouve == null) { console.error('motif introuvable dans ' + x.fichier + ' (' + x.cle + ') : rien n’est écrit.'); process.exit(1); }
  }
  for (const [f, re, cle, tr] of CIBLES) {
    const v = tr ? tr(String(marque[cle])) : String(marque[cle]);
    writeFileSync(new URL(f, R), recopier(lire(f), re, v));
  }
  execFileSync(process.execPath, [new URL('scripts/assembler_core.mjs', R).pathname, '--forcer'], { stdio: 'inherit' });
  console.log(e.length ? e.length + ' endroit(s) recopié(s).' : 'Rien à recopier.');
}
