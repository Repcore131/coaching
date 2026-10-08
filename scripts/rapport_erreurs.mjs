#!/usr/bin/env node
// LE COURRIEL QUOTIDIEN DES ERREURS (série 6, lot 14, 08/10/2026).
//
// Lit erreurs/ sur huit jours et metrics/ du mois (compte de service, lecture
// seule) et écrit rapport-erreurs.md quand il y a quelque chose à dire :
//   · une erreur NOUVELLE hier (empreinte jamais vue les sept jours d'avant) ;
//   · une erreur DOUBLÉE (hier ≥ 2 × sa moyenne des jours d'avant) ;
//   · le quota de téléchargement du mois au-delà de 70 % ou de 90 %.
// Sortie 0 : un courriel à envoyer ; 3 : rien à dire (pas de courriel).
//   node scripts/rapport_erreurs.mjs [--base=<fausse base>.json] [--maintenant=<ms>]
import { readFileSync, writeFileSync } from 'node:fs';

export const QUOTA_MOIS_KO = 10e6, SEUILS = [70, 90];
const jourParis = (t) => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });

// PURE.
export function rapportErreurs(parJour, metricsMois, hier, mois) {
  const avant = Object.keys(parJour || {}).filter((j) => j < hier).sort();
  const vus = new Map();
  for (const j of avant) for (const [b, hs] of Object.entries(parJour[j] || {})) for (const [h, e] of Object.entries(hs || {})) {
    const k = b + '/' + h; vus.set(k, (vus.get(k) || 0) + (Number(e && e.n) || 0));
  }
  const nouvelles = [], doublees = [];
  for (const [b, hs] of Object.entries((parJour || {})[hier] || {})) for (const [h, e] of Object.entries(hs || {})) {
    const k = b + '/' + h, n = Number(e && e.n) || 0, ligne = { b, h, n, m: String((e && e.m) || ''), ou: String((e && e.ou) || ''), s: String((e && e.s) || '') };
    if (!vus.has(k)) nouvelles.push(ligne);
    else { const moy = vus.get(k) / Math.max(1, avant.length); if (n >= 2 * moy && n >= 2) doublees.push(Object.assign(ligne, { moy: Math.round(moy * 10) / 10 })); }
  }
  let ko = 0;
  for (const [j, v] of Object.entries(metricsMois || {})) if (j.indexOf(mois) === 0) ko += Number(v && v.oct_out_ko) || 0;
  const pct = Math.round(ko / QUOTA_MOIS_KO * 1000) / 10, seuil = SEUILS.filter((s) => pct >= s).pop() || 0;
  const tri = (a, b) => b.n - a.n;
  return { nouvelles: nouvelles.sort(tri), doublees: doublees.sort(tri), quota: { ko, pct, seuil }, envoyer: !!(nouvelles.length || doublees.length || seuil) };
}
export function texteRapport(r, hier) {
  const l = ['# RepCore : la santé de l’app au ' + hier, ''];
  const ligne = (x) => '- **' + x.m + '** — build ' + x.b + (x.ou ? ', ' + x.ou : '') + ' : ' + x.n + ' fois' + (x.moy != null ? ' (moyenne ' + x.moy + ')' : '');
  if (r.nouvelles.length) l.push('## Nouvelles (' + r.nouvelles.length + ')', ...r.nouvelles.slice(0, 20).map(ligne), '');
  if (r.doublees.length) l.push('## En hausse (' + r.doublees.length + ')', ...r.doublees.slice(0, 20).map(ligne), '');
  l.push('## Quota de la base', String(r.quota.pct).replace('.', ',') + ' % des 10 Go téléchargeables ce mois' + (r.quota.seuil ? ' — **au-delà de ' + r.quota.seuil + ' %**' : '') + '.', '');
  l.push('Le détail : l’app, onglet Paiements, « Santé de l’app ».');
  return l.join('\n');
}

async function lireBase(t) {
  const { creerBase } = await import('../cloudflare/src/base.js');
  const { lireCompteService, jetonCompteService } = await import('../cloudflare/src/google.js');
  const brut = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  let json = brut; try { json = readFileSync(brut, 'utf8'); } catch (e) { /* le JSON lui-même */ }
  const compte = lireCompteService(json);
  if (!compte) throw new Error('FIREBASE_SERVICE_ACCOUNT absent');
  const toml = readFileSync(new URL('../cloudflare/wrangler.toml', import.meta.url), 'utf8');
  const db = creerBase({ url: process.env.FIREBASE_DB_URL || (toml.match(/^FIREBASE_DB_URL\s*=\s*"([^"]+)"/m) || [])[1], jeton: () => jetonCompteService(compte) });
  const jours = [...Array(8)].map((_, i) => jourParis(t - (i + 1) * 864e5));
  const mois = jours[0].slice(0, 7);
  const jm = [...Array(Number(jours[0].slice(8)))].map((_, i) => mois + '-' + String(i + 1).padStart(2, '0'));
  const er = await Promise.all(jours.map((j) => db.ref('erreurs/' + j).get().then((s) => s.val())));
  const me = await Promise.all(jm.map((j) => db.ref('metrics/' + j).get().then((s) => s.val())));
  return { erreurs: Object.fromEntries(jours.map((j, i) => [j, er[i]]).filter((x) => x[1])), metrics: Object.fromEntries(jm.map((j, i) => [j, me[i]]).filter((x) => x[1])) };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const arg = (k) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '').slice(k.length + 3);
  const t = Number(arg('maintenant')) || Date.now();
  const hier = jourParis(t - 864e5);
  try {
    const d = arg('base') ? JSON.parse(readFileSync(arg('base'), 'utf8')) : await lireBase(t);
    const r = rapportErreurs(d.erreurs, d.metrics, hier, hier.slice(0, 7));
    const txt = texteRapport(r, hier);
    console.log(txt);
    if (r.envoyer) { writeFileSync('rapport-erreurs.md', txt); process.exit(0); }
    console.log('\nRien de nouveau : pas de courriel.');
    process.exit(3);
  } catch (e) { console.error('Erreur : ' + (e && e.message || e)); process.exit(1); }
}
