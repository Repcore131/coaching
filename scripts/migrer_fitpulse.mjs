#!/usr/bin/env node
// FIT PULSE QUITTE LA BASE DE REPCORE (série 6, lot 12, 08/10/2026). Une fois.
//
// Copie les nœuds Fit Pulse (pulse, pulse_boot, pulse_inbox, pulse_push,
// fitpulse_mail) de la base RepCore vers la base du PROJET DÉDIÉ, vérifie que
// la copie est identique, et seulement alors, sur demande, les retire de
// RepCore.
//
//   À BLANC (par défaut) : lit les deux bases, n'écrit rien, dit ce qui bougerait.
//     node scripts/migrer_fitpulse.mjs
//   COPIER (RepCore n'est pas touché) :
//     node scripts/migrer_fitpulse.mjs --ecrire
//   RETIRER DE REPCORE (refusé tant que la copie n'est pas identique) :
//     node scripts/migrer_fitpulse.mjs --purger
//
// Variables (jamais dans le dépôt, saisies par Kevin dans son terminal) :
//   FIREBASE_SERVICE_ACCOUNT  chemin du JSON du compte de service RepCore
//   FITPULSE_SERVICE_ACCOUNT  chemin du JSON du compte de service Fit Pulse
//   FITPULSE_DB_URL           l'adresse de la base Fit Pulse
import { readFileSync } from 'node:fs';

export const NOEUDS_FITPULSE = ['pulse', 'pulse_boot', 'pulse_inbox', 'pulse_push', 'fitpulse_mail'];
// Égalité profonde, indifférente à l'ordre des clés.
export function memeValeur(a, b) {
  const n = (x) => (x && typeof x === 'object') ? Object.keys(x).sort().reduce((o, k) => (o[k] = n(x[k]), o), Array.isArray(x) ? [] : {}) : (x === undefined ? null : x);
  return JSON.stringify(n(a)) === JSON.stringify(n(b));
}
// PURE. Ce qui se copie, ce qui est déjà là, ce qui se purgerait.
//   source : {nœud: valeur} lu dans RepCore ; cible : idem dans Fit Pulse.
export function planMigrationFitpulse(source, cible) {
  const s = source || {}, c = cible || {};
  const copier = {}, identiques = [], differents = [], vides = [];
  for (const k of NOEUDS_FITPULSE) {
    const v = s[k];
    if (v == null) { vides.push(k); continue; }
    if (memeValeur(v, c[k])) identiques.push(k);
    else { copier[k] = v; if (c[k] != null) differents.push(k); }
  }
  // Purger n'est permis que quand TOUT ce qui existe chez RepCore est déjà, à
  // l'identique, chez Fit Pulse.
  const purgeable = Object.keys(copier).length === 0 && identiques.length > 0;
  const purger = {};
  if (purgeable) for (const k of identiques) purger[k] = null;
  return { copier, identiques, differents, vides, purgeable, purger };
}
export function texteMigration(p, mode) {
  const l = [];
  for (const k of Object.keys(p.copier)) l.push((mode === 'ecrire' ? 'copié      ' : 'copierait  ') + k + (p.differents.indexOf(k) >= 0 ? ' (différent chez Fit Pulse : remplacé)' : ''));
  for (const k of p.identiques) l.push('identique  ' + k);
  for (const k of p.vides) l.push('absent     ' + k + ' (rien chez RepCore)');
  if (mode === 'purger') l.push(p.purgeable ? 'Retiré de RepCore : ' + Object.keys(p.purger).join(', ') : 'PURGE REFUSÉE : la copie n’est pas encore identique (lancer --ecrire d’abord).');
  else if (mode !== 'ecrire') l.push('\nÀ blanc : rien n’a été écrit. --ecrire copie, --purger retire de RepCore ensuite.');
  return l.join('\n');
}

async function base(url, cheminCompte) {
  const { creerBase } = await import('../cloudflare/src/base.js');
  const { lireCompteService, jetonCompteService } = await import('../cloudflare/src/google.js');
  const compte = lireCompteService(readFileSync(cheminCompte, 'utf8'));
  return creerBase({ url, jeton: () => jetonCompteService(compte) });
}
async function lire(db) {
  const v = await Promise.all(NOEUDS_FITPULSE.map((k) => db.ref(k).get().then((s) => s.val())));
  return Object.fromEntries(NOEUDS_FITPULSE.map((k, i) => [k, v[i]]));
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const mode = process.argv.includes('--purger') ? 'purger' : (process.argv.includes('--ecrire') ? 'ecrire' : 'blanc');
  const toml = readFileSync(new URL('../cloudflare/wrangler.toml', import.meta.url), 'utf8');
  const urlRc = process.env.FIREBASE_DB_URL || (toml.match(/^FIREBASE_DB_URL\s*=\s*"([^"]+)"/m) || [])[1];
  const urlFp = process.env.FITPULSE_DB_URL || '';
  if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.FITPULSE_SERVICE_ACCOUNT || !urlFp) {
    console.error('FIREBASE_SERVICE_ACCOUNT, FITPULSE_SERVICE_ACCOUNT (chemins des JSON) et FITPULSE_DB_URL sont requis.'); process.exit(1);
  }
  if (urlFp.replace(/\/$/, '') === String(urlRc).replace(/\/$/, '') || /repcore-sync/.test(urlFp)) { console.error('FITPULSE_DB_URL désigne la base RepCore : arrêt.'); process.exit(1); }
  const rc = await base(urlRc, process.env.FIREBASE_SERVICE_ACCOUNT), fp = await base(urlFp, process.env.FITPULSE_SERVICE_ACCOUNT);
  let p = planMigrationFitpulse(await lire(rc), await lire(fp));
  if (mode === 'ecrire' && Object.keys(p.copier).length) {
    await fp.ref().update(p.copier);
    p = planMigrationFitpulse(await lire(rc), await lire(fp));
    if (Object.keys(p.copier).length) { console.error('Copie relue différente : ' + Object.keys(p.copier).join(', ')); process.exit(1); }
    console.log(texteMigration(planMigrationFitpulse(await lire(rc), {}), 'ecrire'));
  } else if (mode === 'purger') {
    if (p.purgeable) await rc.ref().update(p.purger);
    console.log(texteMigration(p, 'purger'));
    process.exit(p.purgeable ? 0 : 2);
  } else console.log(texteMigration(p, mode));
}
