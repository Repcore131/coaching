#!/usr/bin/env node
// LES RÈGLES EN LIGNE CONTRE CELLES DU DÉPÔT (série 6, lot 12, 08/10/2026).
//
// Avant « Deployer », firebase.yml lit les règles EN PRODUCTION (compte de
// service, lecture seule) et les compare, nœud racine par nœud racine, à
// database.rules.json. Il DIT ce que le déploiement va retirer ou ajouter —
// un bloc posé à la main ou par un autre outil (Fit Pulse l'a fait) disparaît
// sinon sans un mot. Avertissement seulement : le dépôt fait foi.
//
//   node scripts/verif/regles_en_ligne.mjs            (FIREBASE_SERVICE_ACCOUNT : le JSON, ou son chemin)
//   node scripts/verif/regles_en_ligne.mjs --fichier=<règles en ligne>.json   (tests)
import { readFileSync, existsSync } from 'node:fs';

const sansCom = (t) => String(t || '').replace(/^\s*\/\/.*$/gm, '');
// PURE. {retires, ajoutes, modifies} entre deux textes de règles.
export function comparerRegles(enLigne, depot) {
  const a = (JSON.parse(sansCom(enLigne)).rules) || {}, b = (JSON.parse(sansCom(depot)).rules) || {};
  const ka = Object.keys(a), kb = Object.keys(b);
  return {
    retires: ka.filter((k) => !(k in b)),
    ajoutes: kb.filter((k) => !(k in a)),
    modifies: kb.filter((k) => k in a && JSON.stringify(a[k]) !== JSON.stringify(b[k])),
  };
}
export function texteComparaison(d) {
  const l = [];
  if (d.retires.length) l.push('::warning::Le déploiement RETIRE ces nœuds, présents en ligne et absents du dépôt : ' + d.retires.join(', '));
  if (d.ajoutes.length) l.push('Nœuds nouveaux : ' + d.ajoutes.join(', '));
  if (d.modifies.length) l.push('Nœuds modifiés : ' + d.modifies.join(', '));
  return l.length ? l.join('\n') : 'Règles en ligne identiques au dépôt.';
}

async function enLigne() {
  const { lireCompteService, jetonCompteService } = await import('../../cloudflare/src/google.js');
  const brut = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  const json = existsSync(brut) ? readFileSync(brut, 'utf8') : brut;
  const compte = lireCompteService(json);
  if (!compte) throw new Error('FIREBASE_SERVICE_ACCOUNT absent');
  const toml = readFileSync(new URL('../../cloudflare/wrangler.toml', import.meta.url), 'utf8');
  const url = process.env.FIREBASE_DB_URL || (toml.match(/^FIREBASE_DB_URL\s*=\s*"([^"]+)"/m) || [])[1];
  const jeton = await jetonCompteService(compte);
  const r = await fetch(url.replace(/\/$/, '') + '/.settings/rules.json', { headers: { authorization: 'Bearer ' + jeton } });
  if (!r.ok) throw new Error('lecture des règles : ' + r.status);
  return r.text();
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const f = (process.argv.find((a) => a.startsWith('--fichier=')) || '').slice(10);
  try {
    const d = comparerRegles(f ? readFileSync(f, 'utf8') : await enLigne(), readFileSync('database.rules.json', 'utf8'));
    console.log(texteComparaison(d));
  } catch (e) {
    console.log('::warning::Règles en ligne illisibles (' + (e && e.message || e) + ') : comparaison sautée.');
  }
}
