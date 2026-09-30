#!/usr/bin/env node
// LE BANC DE SYNCHRONISATION A DEUX APPAREILS (30/09/2026).
//
// Node 22, sans dependance. Il ne recopie PAS la fusion : il la LIT dans
// app/rc-core.<build>.js (fonctions pures _sync*, sync*, constantes SYNC_*),
// l'evalue, et la fait tourner dans un mini-modele — deux appareils
// {local, base} et une fausse RTDB {doc, etag}.
//
// CE QUE LE MODELE REPREND DE _doPushOne ET DE _mergeUser, et comment il le
// sait. Les deux methodes sont trop liees au navigateur pour etre evaluees
// telles quelles ; le banc lit donc leur source et en DEDUIT les traits
// qu'il rejoue :
//   • FUSION    : _doPushOne appelle syncFusion AVANT le PUT (fusion a trois
//                 voies de ce qui part avec ce que porte le serveur) ;
//   • UNION     : sans base, syncUnionSansBase avant le PUT ;
//   • ETAG      : PUT conditionnel (if-match), refusion sur 412 ;
//   • INTEGRE   : apres un PUT reussi, l'appareil fusionne ce qu'il a envoye ;
//   • INTEGRE_SANS_BASE : et de meme sans base, contre ce qui est parti ;
//   • DESCENTE  : _mergeUser fusionne a trois voies a la descente.
// Retirer la fusion de _doPushOne fait donc tomber FUSION, le modele pousse
// sa copie locale telle quelle, et l'invariant casse : le banc rougit.
//
// Ce que le modele NE rejoue PAS : le garde-fou « dossier plus pauvre », la
// file de relance, les pierres tombales des videos. Il isole la question de
// la fusion et de la course entre deux ecritures.
//
// L'INVARIANT : apres convergence (descente des deux, envoi des deux,
// descente des deux), toute seance jamais supprimee volontairement est sur le
// serveur ET sur les deux appareils ; de meme chaque bilan et chaque jour de
// pesee.
//
// LE CAS « COURSE SANS ETAG » : GET-A, GET-B, PUT-A, PUT-B. Sans if-match, le
// PUT de B ecrase la seance que A vient d'envoyer, et la descente suivante de
// A — qui l'avait dans sa base — la retire aussi chez lui. Il est joue deux
// fois : avec les traits lus dans le code (DOIT etre vert si l'ETag est la ;
// ATTENDU ROUGE sinon, signale sans faire echouer), et sur un modele force
// sans ETag (DOIT etre rouge : preuve que le banc voit la course).
//
//   node scripts/verif/banc-sync.mjs
//   BANC_SOURCE=/chemin/rc-core.js node scripts/verif/banc-sync.mjs   (autre source)
import {readFileSync} from 'node:fs';
import {fichierCode} from './source-prod.mjs';

const T0 = Date.now();
const FICHIER = process.env.BANC_SOURCE || fichierCode();
const SRC = readFileSync(FICHIER, 'utf8');

// ── Lecture de source ──────────────────────────────────────────────────────
// Fin d'une declaration : l'accolade fermante qui ramene la profondeur a zero
// (fonction), ou le ';' de profondeur zero (const). Chaines et commentaires
// sont sautes — '{'+parts.join(',')+'}' est dans _syncCarte.
function finDeclaration(s, i, fonction) {
  let prof = 0, vuAccolade = false;
  for (; i < s.length; i++) {
    const c = s[i], c2 = s[i + 1];
    if (c === '/' && c2 === '/') { i = s.indexOf('\n', i); if (i < 0) return s.length; continue; }
    if (c === '/' && c2 === '*') { i = s.indexOf('*/', i + 2) + 1; continue; }
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < s.length && s[i] !== c; i++) if (s[i] === '\\') i++;
      continue;
    }
    if (c === '{' || c === '(' || c === '[') { prof++; if (c === '{') vuAccolade = true; }
    else if (c === '}' || c === ')' || c === ']') {
      prof--;
      if (fonction && vuAccolade && prof === 0 && c === '}') return i + 1;
    } else if (!fonction && c === ';' && prof === 0) return i + 1;
  }
  throw new Error('declaration non terminee');
}
function declarations() {
  const out = [], noms = [];
  const re = /^(?:const (SYNC_[A-Z_]+)\s*=|function (_?sync[A-Z]\w*)\s*\()/gm;
  let m;
  while ((m = re.exec(SRC))) {
    const nom = m[1] || m[2];
    const fin = finDeclaration(SRC, m.index + m[0].length - (m[2] ? 1 : 0), !!m[2]);
    out.push(SRC.slice(m.index, fin));
    noms.push(nom);
  }
  return {code: out.join('\n'), noms};
}
// Le corps d'une methode de CLOUD, commentaires retires.
function methode(nom) {
  const m = new RegExp('^  (?:async )?' + nom + '\\(', 'm').exec(SRC);
  if (!m) return '';
  const corps = SRC.slice(m.index, finDeclaration(SRC, m.index + m[0].length - 1, true));
  return corps.split('\n').map(l => l.replace(/(^|[\s;{}])\/\/.*$/, '$1')).join('\n');
}

const {code, noms} = declarations();
const ATTENDUS = ['_syncFnv', '_syncEstObjet', '_syncCanon', '_syncVersArbre', '_syncDepuisArbre', '_syncCarte',
  'syncEmpreintes', 'syncFusion', 'syncUnionSansBase', 'SYNC_PAR_CLEF', 'SYNC_PROFONDEUR', 'SYNC_VIDE', 'SYNC_HORS_FUSION'];
const manque = ATTENDUS.filter(n => noms.indexOf(n) < 0);
if (manque.length) { console.error('banc-sync : introuvable dans ' + FICHIER + ' : ' + manque.join(', ')); process.exit(1); }
const S = new Function(code + '\nreturn {' + noms.join(',') + '};')();

const PUSH = methode('_doPushOne'), MERGE = methode('_mergeUser');
if (!PUSH) { console.error('banc-sync : _doPushOne introuvable'); process.exit(1); }
// LE PUT DU DOSSIER, et non celui de sante_privee qui part avant : l'URL de
// users/<clef>, a defaut le dernier PUT de la methode.
let iPut = PUSH.search(/_fbUrl\.replace\('users\.json',\s*'users\/'/);
if (iPut < 0) iPut = PUSH.lastIndexOf("method:'PUT'");
const avantPut = iPut >= 0 ? PUSH.slice(0, iPut) : PUSH, apresPut = iPut >= 0 ? PUSH.slice(iPut) : '';
const TRAITS = {
  FUSION: /syncFusion\(/.test(avantPut),
  UNION: /syncUnionSansBase\(/.test(avantPut),
  ETAG: /'if-match'/.test(PUSH) && /412/.test(PUSH),
  INTEGRE: /syncFusion\(/.test(apresPut),
  INTEGRE_SANS_BASE: /syncEmpreintes\(_safeAvantFusion\)/.test(apresPut),
  DESCENTE: /syncFusion\(/.test(MERGE),
};

// ── Le modele ──────────────────────────────────────────────────────────────
const cl = o => o == null ? o : JSON.parse(JSON.stringify(o));
// Firebase ne stocke ni vide ni undefined : le serveur garde la forme canonique.
const stocker = d => cl(S._syncCanon(d)) || null;

function monde(traits, graine) {
  let horloge = 1000;
  const W = {
    traits, srv: {doc: null, v: 0}, horloge: () => ++horloge,
    etag() { return this.srv.doc == null ? 'null_etag' : 'E' + this.srv.v; },
    creees: {sessions: new Set(), bilans: new Set(), pesees: new Set()}, supprimees: new Set(),
    appareils: {},
  };
  for (const n of ['A', 'B']) W.appareils[n] = {nom: n, local: null, base: null, attente: null};
  return W;
}
const poserBase = (a, doc) => { a.base = {h: S.syncEmpreintes(doc), maj: Number(doc.updatedAt) || 0}; };

function edit(W, n, f) {
  const a = W.appareils[n];
  a.local = f(cl(a.local) || {email: 'x@t.fr'});
  a.local.updatedAt = W.horloge();
}
// Ce qui part : la copie locale integree a une version du serveur (_integrer).
function integrer(W, snap, base, d) {
  let safe = cl(snap);
  if (d) {
    const avant = Number(safe.updatedAt) || 0;
    if (base && W.traits.FUSION) safe = S.syncFusion(base.h, safe, d);
    else if (!base && W.traits.UNION) safe = S.syncUnionSansBase(safe, d);
    safe.updatedAt = Math.max(avant, (Number(d.updatedAt) || 0) + 1);
  }
  return safe;
}
function pushGet(W, n) {
  const a = W.appareils[n];
  if (!a.local) return false;
  a.attente = {snap: cl(a.local), base: a.base && cl(a.base), doc: cl(W.srv.doc), etag: W.etag()};
  return true;
}
function pushPut(W, n) {
  const a = W.appareils[n], p = a.attente;
  if (!p) return false;
  a.attente = null;
  let safe = integrer(W, p.snap, p.base, p.doc), etag = p.etag;
  for (let essai = 0; ; essai++) {
    if (W.traits.ETAG && etag !== W.etag()) {
      if (essai >= 3) return false;                      // rejouable : repartira plus tard
      etag = W.etag();
      safe = integrer(W, p.snap, p.base, cl(W.srv.doc));  // refusion depuis la copie d'avant fusion
      continue;
    }
    break;
  }
  W.srv.doc = stocker(safe); W.srv.v++;
  // Apres le PUT : l'appareil integre ce qu'il vient d'envoyer, puis la base.
  // Sans base, la base de cette integration est ce qui est parti avant fusion.
  if (a.base && W.traits.INTEGRE) a.local = S.syncFusion(a.base.h, a.local, safe);
  else if (!a.base && W.traits.INTEGRE_SANS_BASE) a.local = S.syncFusion(S.syncEmpreintes(p.snap), a.local, safe);
  poserBase(a, safe);
  return true;
}
function pull(W, n) {
  const a = W.appareils[n], d = cl(W.srv.doc);
  if (!d) return false;
  if (!a.local) a.local = d;
  else if (a.base && W.traits.DESCENTE) a.local = S.syncFusion(a.base.h, a.local, d);
  else a.local = S.syncUnionSansBase(a.local, d);
  poserBase(a, d);
  return true;
}
const pousser = (W, n) => { pushGet(W, n); return pushPut(W, n); };

// Les gestes d'un appareil.
function ajoutSeance(W, n, id) {
  W.creees.sessions.add(id);
  edit(W, n, u => { (u.sessions = u.sessions || []).push({id, date: W.horloge(), name: 'S ' + id, data: {}}); return u; });
}
function ajoutBilan(W, n, date) {
  W.creees.bilans.add(date + '|hebdo');
  edit(W, n, u => { (u.bilans = u.bilans || []).push({date, type: 'hebdo', poids: 70}); return u; });
}
function pesee(W, n, jour, kg) {
  W.creees.pesees.add(jour);
  edit(W, n, u => {
    u.weightLog = (u.weightLog || []).filter(e => e && e.date !== jour);
    u.weightLog.push({date: jour, kg});
    return u;
  });
}
function supprimerSeance(W, n, rnd) {
  const a = W.appareils[n];
  const l = ((a.local && a.local.sessions) || []).filter(Boolean);
  if (!l.length) return false;
  const id = l[Math.floor(rnd() * l.length)].id;
  W.supprimees.add(String(id));
  edit(W, n, u => {
    u.sessions = (u.sessions || []).filter(s => s && s.id !== id);
    u.supprimes = u.supprimes || {}; u.supprimes.sessions = u.supprimes.sessions || {};
    u.supprimes.sessions[id] = W.horloge();
    return u;
  });
  return true;
}

function converger(W) {
  for (const n of ['A', 'B']) W.appareils[n].attente = null;   // envois en vol abandonnes, rejoues ici
  pull(W, 'A'); pull(W, 'B');
  pousser(W, 'A'); pousser(W, 'B');
  pull(W, 'A'); pull(W, 'B');
}
// Les manques, lieu par lieu. Vide = invariant tenu.
function verifier(W) {
  const manques = [];
  const lieux = {serveur: W.srv.doc, A: W.appareils.A.local, B: W.appareils.B.local};
  for (const [ou, d] of Object.entries(lieux)) {
    const ids = new Set(S._syncTableau(d && d.sessions).filter(Boolean).map(s => String(s.id)));
    for (const id of W.creees.sessions) if (!W.supprimees.has(String(id)) && !ids.has(String(id))) manques.push(ou + ' : seance ' + id);
    for (const id of W.supprimees) if (ids.has(id)) manques.push(ou + ' : seance supprimee ' + id + ' revenue');
    const bl = new Set(S._syncTableau(d && d.bilans).filter(Boolean).map(b => b.date + '|' + (b.type || '')));
    for (const k of W.creees.bilans) if (!bl.has(k)) manques.push(ou + ' : bilan ' + k);
    const pj = new Set(S._syncTableau(d && d.weightLog).filter(Boolean).map(e => e.date));
    for (const j of W.creees.pesees) if (!pj.has(j)) manques.push(ou + ' : pesee ' + j);
  }
  return manques;
}
// Etat de depart : un dossier deja synchronise sur les deux appareils (ou un
// appareil neuf, sans base ni copie, une fois sur quatre).
function depart(traits, rnd) {
  const W = monde(traits);
  ajoutSeance(W, 'A', 's0');
  pousser(W, 'A');
  pull(W, 'B');
  if (rnd && rnd() < 0.25) { W.appareils.B.local = null; W.appareils.B.base = null; }
  return W;
}

// ── Le cas nomme : course sans ETag ────────────────────────────────────────
function course(traits) {
  const W = depart(traits);
  ajoutSeance(W, 'A', 'sA');
  ajoutSeance(W, 'B', 'sB');
  pushGet(W, 'A'); pushGet(W, 'B');
  pushPut(W, 'A'); pushPut(W, 'B');
  converger(W);
  return verifier(W);
}

// ── Les entrelacements aleatoires (graine fixe) ────────────────────────────
function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function aleatoire(traits, iterations, graine) {
  const rnd = mulberry32(graine);
  const echecs = [];
  for (let it = 0; it < iterations; it++) {
    const W = depart(traits, rnd);
    const journal = [];
    const nOps = 6 + Math.floor(rnd() * 18);
    let seq = 0;
    for (let k = 0; k < nOps; k++) {
      const n = rnd() < 0.5 ? 'A' : 'B', r = rnd();
      if (r < 0.22) { const id = n + it + '_' + (seq++); ajoutSeance(W, n, id); journal.push(n + ':seance ' + id); }
      else if (r < 0.32) { const d = 2000 + it * 100 + (seq++); ajoutBilan(W, n, d); journal.push(n + ':bilan ' + d); }
      else if (r < 0.44) { const j = '2026-09-' + String(1 + Math.floor(rnd() * 5)).padStart(2, '0'); pesee(W, n, j, 60 + Math.floor(rnd() * 20)); journal.push(n + ':pesee ' + j); }
      else if (r < 0.48) { if (supprimerSeance(W, n, rnd)) journal.push(n + ':suppr'); }
      else if (r < 0.64) { if (pushGet(W, n)) journal.push('GET-' + n); }
      else if (r < 0.82) { if (pushPut(W, n)) journal.push('PUT-' + n); }
      else { if (pull(W, n)) journal.push('pull-' + n); }
    }
    converger(W);
    const m = verifier(W);
    if (m.length) echecs.push({it, journal: journal.join(' '), manques: m.slice(0, 4)});
  }
  return echecs;
}

// ── Execution ──────────────────────────────────────────────────────────────
let rouge = false;
const trait = Object.entries(TRAITS).map(([k, v]) => k + (v ? ' ✓' : ' ✗')).join(' · ');
console.log('banc-sync : ' + FICHIER.replace(/^.*[\\/]app[\\/]/, 'app/') + ' — ' + noms.length + ' declarations lues');
console.log('  traits lus dans le code : ' + trait);

// 1. Le banc voit la course : sans ETag, elle DOIT perdre une seance.
const temoin = course(Object.assign({}, TRAITS, {ETAG: false}));
if (!temoin.length) { console.log('✗ temoin : sans ETag, la course GET-A GET-B PUT-A PUT-B ne perd rien — le banc ne voit plus la course'); rouge = true; }
else console.log('✓ temoin : sans ETag, la course perd bien des donnees (' + temoin[0] + ')');

// 2. La course avec le code tel qu'il est.
const c = course(TRAITS);
if (!c.length) console.log('✓ course sans ETag (GET-A, GET-B, PUT-A, PUT-B) : rien de perdu');
else if (!TRAITS.ETAG) console.log('⚠ course sans ETag : ATTENDU ROUGE tant que le PUT conditionnel n\'est pas en place — ' + c.join(' ; '));
else { console.log('✗ course sans ETag, AVEC ETag dans le code : ' + c.join(' ; ')); rouge = true; }

// 3. 2000 entrelacements.
const N = 2000, GRAINE = 20260930;
const e = aleatoire(TRAITS, N, GRAINE);
// Sans ETag, les courses du tirage sont le defaut attendu : on ne les compte
// pas contre le code, mais on les dit.
if (!e.length) console.log('✓ ' + N + ' entrelacements (graine ' + GRAINE + ') : invariant tenu');
else if (!TRAITS.ETAG) console.log('⚠ ' + e.length + '/' + N + ' entrelacements perdent des donnees — ATTENDU sans ETag');
else {
  rouge = true;
  console.log('✗ ' + e.length + '/' + N + ' entrelacements perdent des donnees. Premiers cas :');
  for (const x of e.slice(0, 3)) console.log('   #' + x.it + ' ' + x.journal + '\n     → ' + x.manques.join(' ; '));
}
// Garde de fond : sans FUSION, il n'y a rien a attendre de vert.
if (!TRAITS.FUSION) { console.log('✗ _doPushOne ne fusionne plus avant le PUT (syncFusion absent)'); rouge = true; }

console.log((rouge ? 'ROUGE' : 'VERT') + ' en ' + ((Date.now() - T0) / 1000).toFixed(1) + ' s');
process.exit(rouge ? 1 : 0);
