// ══════════════════════════════════════════════════════════════════════════
//  RESTAURER UN NŒUD DE LA BASE DEPUIS UNE SAUVEGARDE
// ══════════════════════════════════════════════════════════════════════════
//
//  UN SEUL NŒUD À LA FOIS (droits, paypal_journal, worker…), et EN
//  SIMULATION PAR DÉFAUT : rien n'est écrit, le script compare l'archive à la
//  base et affiche les clés à ajouter, à retirer et à modifier. Il n'écrit
//  qu'avec --ecrire.
//
//  Usage :
//    node scripts/restaurer_noeud.mjs <archive.tar.enc | dossier> <nœud> [--ecrire]
//  L'archive chiffrée se déchiffre avec la variable SAUVEGARDE_CLE, que Kevin
//  saisit lui-même dans son terminal (jamais dans un fichier) :
//    read -rs SAUVEGARDE_CLE && export SAUVEGARDE_CLE
//  L'accès à la base : FIREBASE_SERVICE_ACCOUNT (le JSON), ou --compte <fichier.json>.
//
//  ÉCRITURE : un PUT du nœud entier (il remplace tout, comme l'archive le
//  porte). Un nœud qui avait été découpé (trop gros pour une requête) est
//  réécrit enfant par enfant (PATCH par lots), puis les enfants absents de
//  l'archive sont supprimés — le même résultat qu'un PUT.
//
//  Chaque part est vérifiée (sha256 du manifeste) AVANT toute comparaison.
//  Procédure complète : docs/sauvegarde.md.
// ══════════════════════════════════════════════════════════════════════════
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { readFileSync, existsSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { lireCompteService, jetonCompteService } from '../cloudflare/src/google.js';
import { creerClient, exporterChemin, BASE_DEFAUT } from './sauvegarde_base.mjs';

const sha256 = (t) => createHash('sha256').update(t).digest('hex');
const ECRITURE_D_UN_COUP = 100 * 1024 * 1024;   // sous la limite de 256 Mo d'une requête
const LOT_ECRITURE = 200;

// Déchiffre une archive .tar.enc dans un dossier temporaire (openssl et tar).
export function dechiffrer(archive, cle) {
  if (!cle) throw new Error('SAUVEGARDE_CLE absente : read -rs SAUVEGARDE_CLE && export SAUVEGARDE_CLE');
  const d = mkdtempSync(join(tmpdir(), 'restauration-'));
  const tar = join(d, 'archive.tar');
  try {
    execFileSync('openssl', ['enc', '-d', '-aes-256-cbc', '-pbkdf2', '-iter', '200000', '-in', archive, '-out', tar, '-pass', 'env:SAUVEGARDE_CLE'],
      { env: Object.assign({}, process.env, { SAUVEGARDE_CLE: cle }), stdio: ['ignore', 'ignore', 'pipe'] });
    execFileSync('tar', ['-xf', tar, '-C', d], { stdio: ['ignore', 'ignore', 'pipe'] });
    rmSync(tar);
    return d;
  } catch (e) {
    // Mauvaise clé, ou archive abîmée : rien ne reste sur le disque.
    rmSync(d, { recursive: true, force: true });
    throw new Error('déchiffrement impossible : mauvaise SAUVEGARDE_CLE, ou archive abîmée');
  }
}

// La valeur d'un nœud, reconstruite depuis les parts du dossier (vérifiées).
export function valeurDepuisArchive(dossier, noeud) {
  const racineArchive = existsSync(join(dossier, 'manifeste.json')) ? dossier
    : join(dossier, readdirSync(dossier).find((x) => existsSync(join(dossier, x, 'manifeste.json'))) || '');
  const m = JSON.parse(readFileSync(join(racineArchive, 'manifeste.json'), 'utf8'));
  const parts = m.parts.filter((p) => p.noeud === noeud);
  if (!parts.length) throw new Error(noeud + ' : absent de cette sauvegarde (' + m.mode + ' du ' + m.date + ')');
  let valeur;
  const poser = (relatif, v) => {
    if (!relatif.length) { valeur = v; return; }
    if (!valeur || typeof valeur !== 'object') valeur = {};
    let o = valeur;
    for (const k of relatif.slice(0, -1)) { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }
    o[relatif[relatif.length - 1]] = v;
  };
  let decoupe = false;
  for (const p of parts) {
    const brut = gunzipSync(readFileSync(join(racineArchive, p.fichier)));
    if (sha256(brut) !== p.sha256) throw new Error(p.fichier + ' : sha256 différent du manifeste — archive abîmée, on n’écrit rien');
    const v = JSON.parse(brut.toString('utf8'));
    const relatif = p.chemin.split('/').slice(1);
    if (p.type === 'entier') poser(relatif, v);
    else {
      decoupe = true;
      for (const [k, x] of Object.entries(v || {})) poser(relatif.concat(k), x);
    }
    if (relatif.length) decoupe = true;
  }
  return { valeur, decoupe, manifeste: m };
}

const canon = (v) => JSON.stringify(trier(v));
function trier(v) {
  if (!v || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(trier);
  const o = {};
  for (const k of Object.keys(v).sort()) o[k] = trier(v[k]);
  return o;
}
// Le diff de clés (premier niveau sous le nœud) : à ajouter, à retirer, modifiées.
export function difference(archive, base) {
  const objet = (v) => (v && typeof v === 'object' ? v : null);
  const a = objet(archive), b = objet(base);
  if (!a || !b) {
    const egal = canon(archive) === canon(base);
    return { ajoutees: [], retirees: [], modifiees: egal ? [] : ['(valeur du nœud)'], total: egal ? 0 : 1 };
  }
  const ajoutees = Object.keys(a).filter((k) => !(k in b));
  const retirees = Object.keys(b).filter((k) => !(k in a));
  const modifiees = Object.keys(a).filter((k) => k in b && canon(a[k]) !== canon(b[k]));
  return { ajoutees, retirees, modifiees, total: ajoutees.length + retirees.length + modifiees.length };
}

// La valeur ACTUELLE du nœud, lue comme la sauvegarde la lit (même découpe).
export async function valeurDepuisBase(client, noeud) {
  let valeur;
  await exporterChemin(client, noeud, async (p) => {
    const v = JSON.parse(p.texte);
    const relatif = p.chemin.split('/').slice(1);
    const poser = (rel, x) => {
      if (!rel.length) { valeur = x; return; }
      if (!valeur || typeof valeur !== 'object') valeur = {};
      let o = valeur;
      for (const k of rel.slice(0, -1)) { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }
      o[rel[rel.length - 1]] = x;
    };
    if (p.type === 'entier') poser(relatif, v);
    else for (const [k, x] of Object.entries(v || {})) poser(relatif.concat(k), x);
  });
  return valeur === undefined ? null : valeur;
}

export async function restaurer({ client, dossier, noeud, ecrire, journal }) {
  const log = journal || console.log;
  const { valeur, decoupe, manifeste } = valeurDepuisArchive(dossier, noeud);
  const actuelle = await valeurDepuisBase(client, noeud);
  const d = difference(valeur, actuelle);
  log('Archive : ' + manifeste.mode + ' du ' + manifeste.date + ' — nœud « ' + noeud + ' »' + (decoupe ? ' (découpé en parts)' : ''));
  log('Différences avec la base : ' + d.total + ' (' + d.ajoutees.length + ' à ajouter, ' + d.retirees.length + ' à retirer, ' + d.modifiees.length + ' modifiées)');
  const montrer = (titre, l) => { if (l.length) log('  ' + titre + ' : ' + l.slice(0, 20).join(', ') + (l.length > 20 ? ' … (+' + (l.length - 20) + ')' : '')); };
  montrer('à ajouter', d.ajoutees); montrer('à retirer', d.retirees); montrer('modifiées', d.modifiees);
  if (!ecrire) { log('SIMULATION : rien n’a été écrit. Pour restaurer : la même commande avec --ecrire.'); return { difference: d, ecrit: false }; }
  if (!d.total) { log('Rien à écrire : la base porte déjà exactement l’archive.'); return { difference: d, ecrit: false }; }
  const texte = JSON.stringify(valeur === undefined ? null : valeur);
  if (Buffer.byteLength(texte) <= ECRITURE_D_UN_COUP || !valeur || typeof valeur !== 'object') {
    await client.put(noeud, valeur === undefined ? null : valeur);
  } else {
    const cles = Object.keys(valeur);
    for (let i = 0; i < cles.length; i += LOT_ECRITURE) {
      const lot = {};
      for (const k of cles.slice(i, i + LOT_ECRITURE)) lot[k] = valeur[k];
      await client.patch(noeud, lot);
    }
    for (const k of d.retirees) await client.suppr(noeud + '/' + k);
  }
  log('ÉCRIT : « ' + noeud + ' » porte maintenant la valeur de l’archive.');
  return { difference: d, ecrit: true };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const a = process.argv.slice(2);
  const ecrire = a.includes('--ecrire');
  const ic = a.indexOf('--compte');
  const positionnels = a.filter((x, i) => !x.startsWith('--') && !(ic >= 0 && i === ic + 1));
  const [source, noeud] = positionnels;
  if (!source || !noeud) { console.error('Usage : node scripts/restaurer_noeud.mjs <archive.tar.enc | dossier> <nœud> [--ecrire] [--compte <fichier.json>]'); process.exit(2); }
  const brut = ic >= 0 ? readFileSync(a[ic + 1], 'utf8') : (process.env.FIREBASE_SERVICE_ACCOUNT || '');
  const compte = lireCompteService(brut);
  if (!compte) { console.error('Compte de service absent : FIREBASE_SERVICE_ACCOUNT, ou --compte <fichier.json>.'); process.exit(2); }
  const temp = /\.enc$/.test(source) ? dechiffrer(source, process.env.SAUVEGARDE_CLE) : null;
  try {
    const client = creerClient({ base: (process.env.FIREBASE_DB_URL || BASE_DEFAUT).trim(), jeton: () => jetonCompteService(compte) });
    const r = await restaurer({ client, dossier: temp || source, noeud, ecrire });
    process.exitCode = 0;
    if (!ecrire) console.log(r.difference.total === 0 ? '0 différence.' : r.difference.total + ' différence(s).');
  } finally {
    // Le dossier déchiffré porte des données personnelles : il ne reste pas sur le disque.
    if (temp) rmSync(temp, { recursive: true, force: true });
  }
}
