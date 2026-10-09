// ══════════════════════════════════════════════════════════════════════════
//  LA SAUVEGARDE DE LA BASE (Realtime Database repcore-sync), SANS DÉPENDANCE
// ══════════════════════════════════════════════════════════════════════════
//
//  POURQUOI. Le plan Spark n'a AUCUNE sauvegarde automatique : un PUT de
//  trop, une règle mal écrite, un script qui boucle, et ce qui est effacé
//  l'est pour de bon. Ce script exporte la base NŒUD PAR NŒUD, un fichier
//  .json.gz par nœud, et un manifeste (taille, sha256, date). Le workflow
//  .github/workflows/sauvegarde.yml l'appelle chaque nuit, puis chiffre.
//
//  L'ACCÈS : le compte de service (secret FIREBASE_SERVICE_ACCOUNT, le JSON
//  entier), échangé contre un jeton OAuth d'une heure — la logique est celle
//  du Worker, importée telle quelle (cloudflare/src/google.js).
//
//  LES NŒUDS TROP GROS. Une réponse REST ne dépasse pas 256 Mo. Au-delà de
//  LIMITE_OCTETS (200 Mo, compté pendant la lecture) ou sur une erreur 413,
//  le nœud est repris UN NIVEAU PLUS BAS : ses clés (?shallow=true), puis
//  ses enfants par lots (orderBy "$key", startAt, limitToFirst). Un lot trop
//  gros se coupe en deux ; un enfant seul trop gros redescend encore.
//
//  Usage :
//    node scripts/sauvegarde_base.mjs --critiques|--complet [--dossier <d>]
//  Variables : FIREBASE_SERVICE_ACCOUNT (obligatoire), FIREBASE_DB_URL
//  (facultatif), GITHUB_STEP_SUMMARY (le résumé du travail, s'il existe).
//
//  ⚠ LE DOSSIER PRODUIT CONTIENT DES DONNÉES PERSONNELLES ET DE SANTÉ, EN
//    CLAIR. Le workflow le chiffre avant tout téléversement ; en local, il ne
//    doit pas quitter la machine sans l'être (docs/sauvegarde.md).
// ══════════════════════════════════════════════════════════════════════════
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { lireCompteService, jetonCompteService } from '../cloudflare/src/google.js';

export const BASE_DEFAUT = 'https://repcore-sync-default-rtdb.firebaseio.com';
export const LIMITE_OCTETS = 200 * 1024 * 1024;
export const LOT = 200;
// Ce que l'argent, les droits et le serveur ne peuvent pas perdre : chaque nuit.
export const CRITIQUES = Object.freeze(['droits', 'paypal_evenements', 'paypal_transactions', 'paypal_journal', 'paypal_abonnes',
  'paypal_premiers', 'paypal_orphelins', 'parrainage', 'ambassadeurs', 'ambassadeurs_publics', 'evenements_ko', 'worker']);

export class TropGros extends Error { constructor(chemin, raison) { super('trop gros : ' + chemin + ' (' + raison + ')'); this.raison = raison; } }

// L'ordre des clés de Firebase : les entiers d'abord, en ordre numérique,
// puis les textes, en ordre lexicographique.
export function ordreFirebase(a, b) {
  const na = /^-?\d+$/.test(a) && String(Number(a)) === a, nb = /^-?\d+$/.test(b) && String(Number(b)) === b;
  if (na && nb) return Number(a) - Number(b);
  if (na) return -1;
  if (nb) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}
// Un chemin de nœud → un nom de fichier (une clé Firebase ne contient pas « / »).
export const nomFichier = (chemin, lot) => chemin.split('/').map(encodeURIComponent).join('__') + (lot != null ? '__lot' + String(lot).padStart(4, '0') : '') + '.json.gz';
const sha256 = (t) => createHash('sha256').update(t).digest('hex');

// Un client REST minimal : GET (avec compte des octets), shallow, PUT, PATCH, DELETE.
export function creerClient({ base, fetchImpl, jeton, limite }) {
  const F = fetchImpl || fetch;
  const LIM = limite || LIMITE_OCTETS;
  let octetsLus = 0, requetes = 0;
  const url = (chemin, q) => {
    const u = new URL(base.replace(/\/$/, '') + '/' + chemin.split('/').filter(Boolean).map(encodeURIComponent).join('/') + '.json');
    for (const [k, v] of Object.entries(q || {})) if (v !== undefined) u.searchParams.set(k, v);
    return u.toString();
  };
  const entetes = async (extra) => Object.assign({}, extra || {}, jeton ? { Authorization: 'Bearer ' + (await jeton()) } : {});
  // LE CORPS EST COMPTÉ PENDANT LA LECTURE : au-delà de la limite, on coupe
  // (le reste n'est pas téléchargé, donc pas facturé au quota).
  async function corpsBorne(r, chemin) {
    if (r.body && typeof r.body.getReader === 'function') {
      const lecteur = r.body.getReader(), morceaux = [];
      let n = 0;
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        n += value.length;
        if (n > LIM) { try { await lecteur.cancel(); } catch (e) { /* coupé */ } octetsLus += n; throw new TropGros(chemin, 'plus de ' + Math.round(LIM / 1048576) + ' Mo'); }
        morceaux.push(value);
      }
      octetsLus += n;
      return Buffer.concat(morceaux.map((m) => Buffer.from(m))).toString('utf8');
    }
    const t = await r.text();
    octetsLus += Buffer.byteLength(t);
    if (Buffer.byteLength(t) > LIM) throw new TropGros(chemin, 'plus de ' + Math.round(LIM / 1048576) + ' Mo');
    return t;
  }
  async function lire(chemin, q) {
    requetes++;
    const r = await F(url(chemin, q), { method: 'GET', headers: await entetes() });
    if (r.status === 413) throw new TropGros(chemin, '413');
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      // Firebase dit aussi « trop gros » en 400 : « Data requested exceeds the maximum size… »
      if (/exceeds the maximum size|too large|payload too big/i.test(t)) throw new TropGros(chemin, String(r.status));
      throw new Error('GET ' + chemin + ' : HTTP ' + r.status + ' ' + t.slice(0, 160));
    }
    return corpsBorne(r, chemin);
  }
  async function ecrire(methode, chemin, valeur) {
    requetes++;
    const r = await F(url(chemin), { method: methode, headers: await entetes({ 'Content-Type': 'application/json' }),
      body: valeur === undefined ? undefined : JSON.stringify(valeur) });
    if (!r.ok) throw new Error(methode + ' ' + chemin + ' : HTTP ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 160));
  }
  return {
    url, lire,
    async cles(chemin) { const v = JSON.parse(await lire(chemin, { shallow: 'true' })); return v && typeof v === 'object' ? Object.keys(v).sort(ordreFirebase) : null; },
    put: (c, v) => ecrire('PUT', c, v), patch: (c, v) => ecrire('PATCH', c, v), suppr: (c) => ecrire('DELETE', c),
    octetsLus: () => octetsLus, requetes: () => requetes,
  };
}

// EXPORTE UN CHEMIN dans des « parts » : { chemin, lot, texte } où texte est
// le JSON de la valeur (part « entier ») ou d'un objet d'enfants (part « lot »).
// `rendre(part)` reçoit chaque part dès qu'elle est lue (rien ne s'accumule).
export async function exporterChemin(client, chemin, rendre, o) {
  const lot = (o && o.lot) || LOT;
  try {
    const texte = await client.lire(chemin, { format: 'export' });
    return rendre({ chemin, type: 'entier', texte });
  } catch (e) {
    if (!(e instanceof TropGros)) throw e;
  }
  // UN NIVEAU PLUS BAS : les clés, puis les enfants par lots.
  const cles = await client.cles(chemin);
  if (!cles || !cles.length) throw new Error(chemin + ' : trop gros, et pas d’enfants à découper');
  let n = 0;
  const parLot = async (debut, taille) => {
    const sous = cles.slice(debut, debut + taille);
    try {
      // UNE PLAGE DE CLÉS (startAt…endAt), et non « N à partir de » : une clé
      // ajoutée entre la lecture des clés et celle du lot y entre aussi, au
      // lieu de pousser hors du lot la dernière clé prévue.
      const texte = await client.lire(chemin, { format: 'export', orderBy: '"$key"',
        startAt: JSON.stringify(sous[0]), endAt: JSON.stringify(sous[sous.length - 1]) });
      const v = JSON.parse(texte) || {};
      await rendre({ chemin, type: 'lot', lot: n++, cles: Object.keys(v).length, texte });
    } catch (e) {
      if (!(e instanceof TropGros)) throw e;
      if (sous.length > 1) {
        const m = Math.ceil(sous.length / 2);
        await parLot(debut, m);
        await parLot(debut + m, sous.length - m);
      } else {
        // Un enfant seul trop gros : il redescend à son tour.
        await exporterChemin(client, chemin + '/' + sous[0], rendre, o);
      }
    }
  };
  for (let i = 0; i < cles.length; i += lot) await parLot(i, lot);
}

// LA SAUVEGARDE ENTIÈRE : liste des nœuds, export, fichiers, manifeste.
export async function sauvegarder({ client, mode, dossier, maintenant, lot }) {
  const t = (maintenant || Date.now)();
  mkdirSync(dossier, { recursive: true });
  const racine = await client.cles('');
  const presents = racine || [];
  const noeuds = mode === 'complet' ? presents : CRITIQUES.filter((k) => presents.includes(k));
  const absents = mode === 'complet' ? [] : CRITIQUES.filter((k) => !presents.includes(k));
  const parts = [];
  for (const noeud of noeuds) {
    await exporterChemin(client, noeud, async (p) => {
      const fichier = nomFichier(p.chemin, p.type === 'lot' ? p.lot : null);
      const brut = Buffer.from(p.texte, 'utf8');
      const gz = gzipSync(brut, { level: 9 });
      writeFileSync(join(dossier, fichier), gz);
      parts.push({ noeud, chemin: p.chemin, type: p.type, lot: p.lot, fichier, octets: brut.length, octetsGz: gz.length, sha256: sha256(brut) });
    }, { lot });
  }
  const manifeste = { version: 1, base: client.url('').replace(/\/\.json$/, ''), mode, date: new Date(t).toISOString(),
    noeuds, absents, parts, octets: parts.reduce((a, p) => a + p.octets, 0), octetsGz: parts.reduce((a, p) => a + p.octetsGz, 0),
    telecharges: client.octetsLus(), requetes: client.requetes() };
  writeFileSync(join(dossier, 'manifeste.json'), JSON.stringify(manifeste, null, 2));
  return manifeste;
}

const Mo = (n) => (n / 1048576).toFixed(n < 10485760 ? 2 : 1) + ' Mo';
export function resume(m) {
  const parNoeud = {};
  for (const p of m.parts) { const x = parNoeud[p.noeud] = parNoeud[p.noeud] || { octets: 0, gz: 0, parts: 0 }; x.octets += p.octets; x.gz += p.octetsGz; x.parts++; }
  // LE QUOTA : 10 Go téléchargés par mois (plan Spark), pour TOUT le projet —
  // l'app comprise. Les critiques chaque nuit, le complet chaque dimanche.
  const l = ['## Sauvegarde ' + m.mode + ' du ' + m.date.slice(0, 10), '',
    '| nœud | JSON | gzip | parts |', '|---|---|---|---|'];
  for (const n of Object.keys(parNoeud)) l.push('| ' + n + ' | ' + Mo(parNoeud[n].octets) + ' | ' + Mo(parNoeud[n].gz) + ' | ' + parNoeud[n].parts + ' |');
  l.push('', '**Téléchargé depuis la base : ' + Mo(m.telecharges) + '** en ' + m.requetes + ' requêtes (archive gzip : ' + Mo(m.octetsGz) + ').');
  const mois = m.mode === 'complet' ? m.telecharges * 4.35 : m.telecharges * 30;
  l.push('', 'Au même rythme, ce mode coûte **~' + Mo(mois) + ' par mois**, soit ' + (mois / (10 * 1024 ** 3) * 100).toFixed(2)
    + ' % du quota Spark de 10 Go (qui compte aussi tout le trafic de l’app).');
  if (m.absents && m.absents.length) l.push('', 'Absents de la base (rien à sauvegarder) : ' + m.absents.join(', ') + '.');
  return l.join('\n') + '\n';
}

// En ligne de commande (le workflow).
if (import.meta.url === 'file://' + process.argv[1]) {
  const a = process.argv.slice(2);
  const mode = a.includes('--complet') ? 'complet' : a.includes('--critiques') ? 'critiques' : null;
  if (!mode) { console.error('Usage : node scripts/sauvegarde_base.mjs --critiques|--complet [--dossier <d>]'); process.exit(2); }
  const i = a.indexOf('--dossier');
  const dossier = i >= 0 ? a[i + 1] : 'sauvegarde-' + new Date().toISOString().slice(0, 10) + '-' + mode;
  const compte = lireCompteService(process.env.FIREBASE_SERVICE_ACCOUNT || '');
  if (!compte) { console.error('FIREBASE_SERVICE_ACCOUNT absent ou illisible : rien n’a été exporté.'); process.exit(2); }
  const client = creerClient({ base: (process.env.FIREBASE_DB_URL || BASE_DEFAUT).trim(), jeton: () => jetonCompteService(compte) });
  const m = await sauvegarder({ client, mode, dossier });
  const r = resume(m);
  console.log(r);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, r);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'dossier=' + dossier + '\noctets=' + m.telecharges + '\n');
}
