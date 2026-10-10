/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
'use strict';
// ══ FIT PULSE : moteur d'import Resamania (analyse et plan d'écriture) ════
// Un seul moteur pour les 4 canaux : le navigateur (écran de revue des Imports)
// et le serveur (ingestFile : e-mail, Drive, API) l'appellent de la même façon.
// Aucun accès au DOM, à l'interface (UI, ME, CLUB) ni à l'état de l'appli :
// l'état des données est passé en paramètre et n'est jamais modifié.
//
//   analyzeFile(bytes, name, ctx)            -> tables analysées (analyzeTables pour des tables déjà lues)
//   planImport(tables, state, aliases, opt)  -> { ops, summary, pending }
//     pending : décisions qui manquent
//       { kind: 'seller', label, keys, count }    vendeur inconnu, ses lignes ne comptent pas
//       { kind: 'truncated', file, rows }          liste plafonnée à 2 000 lignes
//       { kind: 'unknown', file, headers }         fichier non reconnu
//   lignesVendeur(tables, keys)              -> lignes d'un vendeur inconnu, à mettre en attente
//   rejouerOps(attente, uid, opt)            -> écritures des lignes en attente, une fois le vendeur rattaché
//   by : 'auto:mail', 'auto:drive', 'auto:api' ou l'id de l'utilisateur.
//
// Les lecteurs historiques (readAnyFile, analyzeTable, rsmCommitPlan, unknownSellers)
// lisent encore leurs données dans une variable d'état : le moteur leur prête une
// copie de l'état reçu le temps de l'appel, puis rend la main (aucun effet de bord).

const RSM_BY = ['auto:mail', 'auto:drive', 'auto:api'];
const byValide = by => (RSM_BY.includes(by) || (typeof by === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(by)) ? by : null);
function etatImport(state, aliases) {
  const st = { entries: {}, clients: {}, imports: {}, recov: {}, resiliations: {}, users: {}, relances: {}, prospects: {}, companies: {}, kpis: {}, clubs: {}, ...(state || {}) };
  st.rsm = { ...(st.rsm || {}), aliases: { ...((st.rsm || {}).aliases || {}), ...(aliases || {}) } };
  return st;
}
// Exécute fn avec l'état prêté (synchrone : rien ne s'intercale avant la restitution).
function avecEtat(state, fn) { const avant = S; S = state; try { return fn(); } finally { S = avant; } }

async function analyzeFile(bytes, name, ctx = {}) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const file = { name: String(name || 'fichier'), size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
  return analyzeTables(await readAnyFile(file), ctx);
}
// Tables déjà lues (écran de revue : il garde les tables brutes pour « Pourquoi ? »).
function analyzeTables(tables, ctx = {}) {
  const month = ctx.month || addMonths((ctx.today || today()).slice(0, 7), -1);
  return avecEtat(etatImport(ctx.state, ctx.aliases), () => tables.map(t => {
    try { const r = analyzeTable(t, { clubId: ctx.clubId, month }); if (!r.def && t.headers) r.headers = t.headers.slice(0, 40).map(String); return r; } catch (e) { return { name: t.name, def: null, rowsCount: 0, entries: [], recov: [], clients: {}, clientsByName: [], resil: [], controls: [], prospects: [], companies: {}, flags: {}, counts: {}, warnings: [`Lecture impossible : ${String(e.message || e).slice(0, 120)}`], skipped: {} }; }
  }));
}

function planImport(tables, state, aliases = {}, { club, choices = {}, by, now = Date.now() } = {}) {
  const auteur = byValide(by); if (!auteur) throw new Error('planImport : auteur invalide');
  return avecEtat(etatImport(state, aliases), () => {
    const groupes = unknownSellers(tables);
    const { ops, summary } = rsmCommitPlan(tables, { club, choices, by: auteur, now });
    const pending = [];
    groupes.filter(g => !choices[g.key]).forEach(g => pending.push({ kind: 'seller', label: g.label, keys: g.keys, count: g.count }));
    for (const t of tables) {
      if (t.def && t.def.family === 'liste' && t.rowsCount === 2000) pending.push({ kind: 'truncated', file: t.name, rows: t.rowsCount });
      if (!t.def && !(t.warnings || []).length && t.headers) pending.push({ kind: 'unknown', file: t.name, headers: t.headers });
    }
    return { ops, summary, pending };
  });
}

// Lignes KPI d'un vendeur inconnu (toutes ses clés), sérialisables pour /ingest/{club}/pending.
function lignesVendeur(tables, keys) {
  const K = new Set(keys || []); const out = [];
  for (const t of tables) {
    if (!t.def || t.def.silent) continue;
    const L = (t.entries || []).filter(e => e.seller && e.seller.status === 'unknown' && (e.seller.keys || []).some(k => K.has(k)))
      .map(e => ({ key: e.key, kpiId: e.kpiId, date: e.date, value: e.value, ...(e.line ? { line: e.line } : {}) }));
    if (L.length) out.push({ defId: t.def.id, file: t.name, entries: L });
  }
  return out;
}
// Lignes en attente rejouées une fois le vendeur rattaché : même identifiant de saisie
// que l'import d'origine ('r' + hkey(club|clé de ligne)), donc rejouer deux fois ne change rien.
function rejouerOps(attente, uid, { club, by, now = Date.now(), state = null } = {}) {
  const auteur = byValide(by); if (!auteur || !uid) return [];
  const st = state || {}; const ops = []; const impId = 'rsm_' + hkey(club + '|attente|' + (attente.id || '') + '|' + uid);
  let n = 0;
  for (const bloc of attente.lignes || []) for (const e of bloc.entries || []) {
    const id = 'r' + hkey(club + '|' + e.key); const old = (st.entries || {})[id];
    if (old && old.userId === uid && Number(old.value) === Number(e.value) && old.date === e.date) continue;
    ops.push([['entries', id], { id, userId: uid, clubId: club, kpiId: e.kpiId, date: e.date, value: e.value, source: 'import', importId: impId, importIds: { ...((old && old.importIds) || {}), [impId]: true }, rowKey: e.key, at: now, ...(e.line ? { line: e.line } : {}) }]);
    n++;
  }
  if (n) ops.push([['imports', impId], { id: impId, name: `Lignes en attente : ${String(attente.label || 'vendeur').slice(0, 80)}`, type: 'kpi', defId: ((attente.lignes || [])[0] || {}).defId || 'ventes', source: 'resamania', clubId: club, at: now, rows: n, count: n, active: true, by: auteur, auto: auteur.startsWith('auto:') }]);
  return ops;
}

// Appli : un plan d'import validé s'écrit tel quel, puis doublons et dossiers fermés sont recalculés.
function applyOps(ops, club = CLUB.id) { db.batch(ops); resDedupe(club); resAutoClose(club); }
