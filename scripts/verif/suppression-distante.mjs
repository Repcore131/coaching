#!/usr/bin/env node
// LA SUPPRESSION DISTANTE, EPROUVEE POUR DE VRAI — pas relue.
//
// cloudinaryDestroy detient l'API secret de Cloudinary. Un identifiant public
// suffit a designer un fichier : sans controle d'appartenance, n'importe quel
// compte connecte pourrait effacer les videos et les photos de n'importe qui.
// Une lecture de source ne prouve pas cela ; une signature dont un parametre
// manque non plus — elle rend 401, et TOUTES les suppressions echouent en
// silence, pendant que l'app croit avoir demande ce qu'il fallait.
//
// CE BANC charge functions/index.js avec un faux `require` (aucune dependance
// installee n'est necessaire), un faux `fetch` et une fausse base, puis appelle
// la fonction comme Firebase l'appellerait. Il verifie les refus, les
// autorisations, et la signature — recalculee independamment.
//
// Il verifie aussi que privacy.html DECLARE le domaine appele : une fonction
// serveur, c'est un sous-traitant de plus, et il est interdit d'appeler un
// domaine que la politique ne nomme pas.
//
// Usage : node scripts/verif/suppression-distante.mjs
import {readFileSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';
import crypto from 'node:crypto';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const SRC = readFileSync(join(RACINE, 'functions', 'index.js'), 'utf8');
const ko = [];

// ── LA FAUSSE BASE ─────────────────────────────────────────────────────────
// Un athlete, son coach, et un tiers connecte qui n'est ni l'un ni l'autre.
const DOSSIERS = {
  'ath@t,fr': {id: 'A1', email: 'ath@t.fr', role: 'athlete', coachId: 'C1'},
  'coach@t,fr': {id: 'C1', email: 'coach@t.fr', role: 'coach'},
  'tiers@t,fr': {id: 'Z9', email: 'tiers@t.fr', role: 'coach'},
};
let lus = [];
const db = {
  ref(chemin) {
    lus.push(chemin);
    return {async get() { const k = chemin.replace(/^users\//, ''); return {val: () => DOSSIERS[k] || null}; }};
  },
};

// ── LE FAUX RESEAU ─────────────────────────────────────────────────────────
let envois = [];
let reponse = {status: 200, body: {result: 'ok'}};
globalThis.fetch = async (url, opts) => {
  envois.push({url: String(url), body: String((opts && opts.body) || ''), methode: opts && opts.method});
  return {
    status: reponse.status,
    ok: reponse.status < 400,
    async json() { if (reponse.body === null) throw new Error('pas du JSON'); return reponse.body; },
  };
};

// ── LE FAUX require ────────────────────────────────────────────────────────
const fonctions = {};
class HttpsError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const faux = {
  'firebase-functions/v2/https': {
    onCall: (opts, handler) => {
      const f = handler || opts;
      f._opts = handler ? opts : {};
      return f;
    },
    HttpsError,
  },
  'firebase-functions/params': {defineSecret: (n) => ({value: () => 'secret-' + n, name: n})},
  'firebase-functions/v2': {setGlobalOptions: () => {}},
  'firebase-admin': {initializeApp: () => {}, database: () => db},
  'node:crypto': crypto,
  'crypto': crypto,
};
const exportes = {};
const module_ = {exports: exportes};
new Function('require', 'exports', 'module', 'process', SRC)(
  (n) => { if (!(n in faux)) throw new Error('require inattendu : ' + n); return faux[n]; },
  exportes, module_, {env: {}});
Object.assign(fonctions, exportes);

const f = fonctions.cloudinaryDestroy;
if (typeof f !== 'function') { console.error('cloudinaryDestroy n’est pas exportee'); process.exit(1); }

// LES DEUX SECRETS, ET PAS D'AUTRE : une fonction qui demande plus que ce
// qu'il lui faut elargit la surface d'attaque pour rien.
const noms = ((f._opts && f._opts.secrets) || []).map((s) => s.name).sort();
if (noms.join(',') !== 'CLOUDINARY_API_KEY,CLOUDINARY_API_SECRET')
  ko.push('secrets declares : ' + (noms.join(', ') || 'aucun'));

const appel = (auth, data) => f({auth, data});
const AUTH = (email) => ({token: {email}});
async function refus(titre, auth, data, code) {
  envois = [];
  try {
    await appel(auth, data);
    ko.push(titre + ' : AUCUN refus — la suppression est passee');
  } catch (e) {
    if (e.code !== code) ko.push(titre + ' : refus « ' + e.code + ' » au lieu de « ' + code + ' »');
    else if (envois.length) ko.push(titre + ' : refuse, mais Cloudinary a quand meme ete appele');
    else console.log('  refus attendu (' + code + ') : ' + titre);
  }
}

const BON = {publicId: 'repcore/A1/squat_abc', resourceType: 'video', proprietaire: 'ath@t.fr'};

// ══ CE QUI DOIT ETRE REFUSE ════════════════════════════════════════════════
await refus('sans authentification', null, BON, 'unauthenticated');
await refus('jeton sans adresse', {token: {}}, BON, 'unauthenticated');
await refus('identifiant hors de repcore/', AUTH('ath@t.fr'),
  {...BON, publicId: 'autrechose/A1/x'}, 'invalid-argument');
await refus('remontee de dossier (..)', AUTH('ath@t.fr'),
  {...BON, publicId: 'repcore/../secret'}, 'invalid-argument');
await refus('type de ressource inconnu', AUTH('ath@t.fr'),
  {...BON, resourceType: 'raw'}, 'invalid-argument');
await refus('identifiant sans proprietaire', AUTH('ath@t.fr'),
  {...BON, publicId: 'repcore/'}, 'invalid-argument');
// LE CŒUR : le media d'un autre, demande par un compte connecte.
await refus('un tiers connecte veut detruire le media d’un athlete', AUTH('tiers@t.fr'),
  BON, 'permission-denied');
// Un coach qui n'est pas LE coach de cet athlete.
await refus('un coach qui n’est pas le sien', AUTH('tiers@t.fr'),
  {...BON, proprietaire: 'ath@t.fr'}, 'permission-denied');
// Le dossier annonce ne porte pas cet identifiant : le client a menti sur le
// proprietaire pour se faire autoriser.
await refus('proprietaire annonce qui ne correspond pas a l’identifiant', AUTH('coach@t.fr'),
  {publicId: 'repcore/INCONNU/x', resourceType: 'image', proprietaire: 'ath@t.fr'}, 'permission-denied');
await refus('dossier appelant absent de la base', AUTH('fantome@t.fr'), BON, 'permission-denied');

// ══ CE QUI DOIT PASSER ═════════════════════════════════════════════════════
// 1. Le proprietaire lui-meme.
envois = []; reponse = {status: 200, body: {result: 'ok'}};
let r = await appel(AUTH('ath@t.fr'), BON).catch((e) => ({erreur: e.code + ' ' + e.message}));
if (r.erreur) ko.push('le proprietaire est refuse : ' + r.erreur);
else if (r.result !== 'ok') ko.push('reponse au proprietaire : ' + JSON.stringify(r));
else console.log('  autorise : le proprietaire de son propre media');

// LA REQUETE ELLE-MEME : l'URL porte le type de ressource, et la signature
// couvre EXACTEMENT les parametres envoyes. Un parametre signe mais absent du
// corps (ou l'inverse) rend 401 chez Cloudinary — toutes les suppressions
// echoueraient, et l'app ne saurait pas pourquoi.
if (envois.length !== 1) ko.push(envois.length + ' appel(s) a Cloudinary au lieu d’un');
else {
  const e = envois[0];
  if (!/\/video\/destroy$/.test(e.url)) ko.push('URL appelee : ' + e.url);
  if (e.methode !== 'POST') ko.push('methode : ' + e.methode);
  const p = new URLSearchParams(e.body);
  const envoyes = [...p.keys()].filter((k) => k !== 'api_key' && k !== 'signature').sort();
  const attendu = crypto.createHash('sha1')
    .update(envoyes.map((k) => k + '=' + p.get(k)).join('&') + 'secret-CLOUDINARY_API_SECRET')
    .digest('hex');
  if (p.get('signature') !== attendu)
    ko.push('la signature ne couvre pas exactement les parametres envoyes ('
      + envoyes.join(', ') + ') : Cloudinary rendrait 401');
  if (p.get('public_id') !== BON.publicId) ko.push('public_id envoye : ' + p.get('public_id'));
  // `invalidate` purge les copies du reseau de diffusion : sans lui, une photo
  // revoquee reste servie des heures par les caches.
  if (p.get('invalidate') !== 'true') ko.push('invalidate n’est pas demande : une photo revoquee resterait en cache');
  if (!p.get('api_key')) ko.push('api_key absente');
  if (String(e.body).indexOf('secret-CLOUDINARY_API_SECRET') >= 0)
    ko.push('LE SECRET PART DANS LE CORPS DE LA REQUETE');
  console.log('  signature verifiee sur : ' + envoyes.join(', '));
}

// 2. Le coach designe par le dossier de l'athlete.
envois = [];
r = await appel(AUTH('coach@t.fr'), BON).catch((e) => ({erreur: e.code + ' ' + e.message}));
if (r.erreur) ko.push('le coach designe est refuse : ' + r.erreur);
else console.log('  autorise : le coach designe par le dossier');

// 3. « introuvable » EST un succes : le fichier n'est plus la, c'est le but.
envois = []; reponse = {status: 404, body: {result: 'not found'}};
r = await appel(AUTH('ath@t.fr'), BON).catch((e) => ({erreur: e.code + ' ' + e.message}));
if (r.erreur) ko.push('« introuvable » est traite en echec : ' + r.erreur + ' — la file rejouerait sans fin');
else console.log('  « introuvable » compte comme detruit');

// 4. Un compte Cloudinary qui n'est pas le notre : on le DIT.
envois = []; reponse = {status: 401, body: {error: {message: 'Invalid Signature'}}};
r = await appel(AUTH('ath@t.fr'), BON).then(() => null, (e) => e);
if (!r || r.code !== 'permission-denied' || !/autre compte Cloudinary/.test(r.message))
  ko.push('un 401 de Cloudinary n’est pas explique : ' + (r ? r.code + ' ' + r.message : 'aucune erreur'));
else console.log('  un 401 de Cloudinary est explique a l’appelant');

// 5. La base est lue POUR L'APPELANT, jamais crue sur parole.
if (!lus.some((c) => c === 'users/coach@t,fr')) ko.push('le dossier de l’appelant n’est pas lu dans la base');
if (!lus.some((c) => c === 'users/ath@t,fr')) ko.push('le dossier du proprietaire n’est pas lu dans la base');

// ══ ET LA POLITIQUE DE CONFIDENTIALITE ═════════════════════════════════════
const priv = readFileSync(join(RACINE, 'privacy.html'), 'utf8');
if (priv.indexOf('cloudfunctions.net') < 0)
  ko.push('privacy.html ne declare pas cloudfunctions.net, que l’app appelle desormais');
const idx = readFileSync(join(RACINE, 'app', 'index.html'), 'utf8');
const coeur = (idx.match(/<script src="\.\/(rc-core\.\d+\.js)"><\/script>/) || [])[1];
const code = coeur ? readFileSync(join(RACINE, 'app', coeur), 'utf8') : idx;
if (code.indexOf("_callFn('cloudinaryDestroy'") < 0)
  ko.push('l’app n’appelle pas cloudinaryDestroy');
// UNE POLITIQUE MODIFIEE SE REDEMANDE : c'est la regle ecrite au-dessus de
// POLICY_VERSION, et un consentement porte sur un texte precis.
const pv = (code.match(/const POLICY_VERSION='([^']+)'/) || [])[1];
if (pv === '2026-08')
  ko.push('POLICY_VERSION vaut encore 2026-08 alors que privacy.html a change');

if (ko.length) { console.error('\nDEFAUTS :\n  ' + ko.join('\n  ')); process.exit(1); }
console.log('\nLes refus refusent, les autorisations lisent la base, la signature tient,');
console.log('et le domaine appele est declare dans la politique (POLICY_VERSION ' + pv + ').');
