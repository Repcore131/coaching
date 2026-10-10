/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
// ══ FIT PULSE — imports Resamania automatiques (zéro clic) ═════════════════
//
// Chaque heure de 6 h à 22 h (Paris) : les pièces jointes CSV, XLSX ou ZIP non
// encore traitées de la boîte dédiée (imports+{club}@domaine, ou libellé Gmail
// « Resamania »), ou les fichiers d'un dossier Google Drive partagé, sont :
//  1. déposées dans Cloud Storage /imports/{clubId}/{date}/ (si FITPULSE_BUCKET) ;
//  2. lues par le VRAI code de l'appli (readAnyFile, analyzeTable,
//     rsmCommitPlan, chargés par chargerAppli) : même détection par colonnes,
//     même clé stable par ligne qu'un dépôt à la main ;
//  3. écrites dans la base, avec une ligne /pulse/rsm/autoLog/{club}/{id}.
// Un fichier déjà reçu (même contenu, empreinte SHA-256) n'est jamais relu.
//
// Réglages du club : /pulse/clubs/{id}/rsmAuto = { address, label, driveFolder }.
// Accès : mêmes secrets OAuth que la relève des résiliations (GMAIL_*), avec les
// portées gmail.readonly et drive.readonly.

import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { chargerAppli, paris } from './fitpulse-rapport.mjs';
import { comptesGmail, jetonGmail } from './fitpulse-resmail.mjs';

export const HEURES = [6, 22];
export const INTERVALLE_MS = 55 * 60000;
const EXT = /\.(csv|tsv|txt|xlsx|xls|ods|zip)$/i;
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');
const cle = s => String(s).replace(/[.#$/\[\]]/g, ',');

export function dansLaPlage(now = new Date()) { const h = paris(now).h; return h >= HEURES[0] && h <= HEURES[1]; }

// ── Sources : Gmail (pièces jointes) et Drive (dossier) ───────────────────
export function requetePj(src = {}) {
  const parts = []; if (src.address) parts.push(`to:${src.address}`, `deliveredto:${src.address}`); if (src.label) parts.push(`label:${String(src.label).replace(/\s+/g, '-')}`);
  // Sans réglage : les tableurs reçus dans la boîte de l'accueil (déjà relevée pour les résiliations).
  // Un fichier qui n'est pas un export Resamania reconnu est noté « non utilisé », jamais importé.
  return parts.length ? `has:attachment newer_than:14d (${parts.join(' OR ')})` : REQUETE_DEFAUT;
}
export const REQUETE_DEFAUT = 'has:attachment newer_than:14d {filename:csv filename:xlsx filename:zip}';
function piecesJointes(part, out = []) {
  if (!part) return out;
  if (part.filename && part.body && part.body.attachmentId && EXT.test(part.filename)) out.push({ name: part.filename, attachmentId: part.body.attachmentId, size: part.body.size || 0 });
  (part.parts || []).forEach(p => piecesJointes(p, out));
  return out;
}
export function sourceGmail(access) {
  const get = async chemin => { const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/' + chemin, { headers: { authorization: 'Bearer ' + access } }); if (!r.ok) throw new Error(`Gmail ${r.status}`); return r.json(); };
  return {
    async fichiers(src) {
      const q = requetePj(src); if (!q) return [];
      const out = []; const j = await get(`messages?maxResults=50&q=${encodeURIComponent(q)}`);
      for (const m of j.messages || []) {
        const msg = await get(`messages/${m.id}?format=full`);
        for (const pj of piecesJointes(msg.payload)) out.push({ ref: `g:${m.id}:${pj.attachmentId.slice(0, 40)}`, name: pj.name, at: Number(msg.internalDate) || Date.now(), lire: async () => Buffer.from((await get(`messages/${m.id}/attachments/${pj.attachmentId}`)).data, 'base64url') });
      }
      return out;
    },
  };
}
export function sourceDrive(access) {
  const get = async (chemin, brut = false) => { const r = await fetch('https://www.googleapis.com/drive/v3/' + chemin, { headers: { authorization: 'Bearer ' + access } }); if (!r.ok) throw new Error(`Drive ${r.status}`); return brut ? Buffer.from(await r.arrayBuffer()) : r.json(); };
  return {
    async fichiers(src) {
      if (!src.driveFolder) return [];
      const q = `'${src.driveFolder}' in parents and trashed = false`;
      const j = await get(`files?q=${encodeURIComponent(q)}&fields=files(id,name,md5Checksum,modifiedTime,size)&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`);
      return (j.files || []).filter(f => EXT.test(f.name)).map(f => ({ ref: `d:${f.id}:${f.md5Checksum || f.modifiedTime}`, name: f.name, at: Date.parse(f.modifiedTime) || Date.now(), lire: () => get(`files/${f.id}?alt=media&supportsAllDrives=true`, true) }));
    },
  };
}
// Dépôt dans Cloud Storage : /imports/{clubId}/{date}/{nom}.
export async function stockerGcs(tk, bucket, clubId, date, name, buf) {
  const objet = `imports/${clubId}/${date}/${name}`;
  const r = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(objet)}`, { method: 'POST', headers: { authorization: 'Bearer ' + tk, 'content-type': 'application/octet-stream' }, body: buf });
  if (!r.ok) throw new Error(`Cloud Storage ${r.status}`);
  return objet;
}

// ── Traitement : le code de l'appli, sans navigateur ──────────────────────
// Applique les fichiers l'un après l'autre (chacun voit ce que le précédent a écrit).
export async function traiter(S, clubId, fichiers, { now = Date.now(), run = chargerAppli(S, { libs: true }) } = {}) {
  const resultats = [];
  for (const f of fichiers) {
    run.ctx.__fpBuf = f.buf;
    const out = await run(`(async () => { const b = __fpBuf; const file = { name: ${JSON.stringify(f.name)}, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
      const r = await rsmIngestFile(file, { clubId: ${JSON.stringify(clubId)}, by: 'auto', now: ${Number(f.at || now)}, source: ${JSON.stringify(f.source || 'auto')} });
      r.ops.forEach(([p, v]) => setPath(S, p, v)); return JSON.stringify({ up: fbClean(r.ops), log: r.log }); })()`);
    resultats.push(JSON.parse(out));
  }
  return { resultats, run };
}

// Un passage du serveur. api(tk, chemin, opts) : base ; sources(clubId) → [{ fichiers(src) }].
export async function passageImports(api, tk, S, { sources, now = Date.now(), force = false, stocker = null, log = console.log, clubsGmail = [] } = {}) {
  if (!force && !dansLaPlage(new Date(now))) return 'hors plage (6 h à 22 h)';
  // Clubs relevés : réglage explicite, ou boîte Gmail de l'accueil déjà reliée (réglage par défaut).
  const clubs = Object.keys(S.clubs || {}).filter(id => S.clubs[id] && (S.clubs[id].rsmAuto || clubsGmail.includes(id)) && !S.clubs[id].archived);
  if (!clubs.length) return 'aucun club réglé';
  const out = [];
  for (const clubId of clubs) {
    const meta = ((S.rsm || {}).autoMeta || {})[clubId] || {};
    if (!force && meta.lastRunAt && now - meta.lastRunAt < INTERVALLE_MS) { out.push(`${clubId} : déjà relevé`); continue; }
    const src = S.clubs[clubId].rsmAuto || {}; const vus = ((S.rsm || {}).autoSeen || {})[clubId] || {};
    try {
      const recus = [];
      for (const s of await sources(clubId)) recus.push(...await s.fichiers(src));
      const neufs = []; const seen = {}; const doublons = [];
      for (const f of recus.filter(x => !vus[cle(x.ref)])) {
        const buf = await f.lire(); const h = sha(buf);
        seen[cle(f.ref)] = { at: now, sha: h };
        // même contenu déjà reçu (renvoyé, ou déposé deux fois) : journalisé, jamais relu
        if (Object.values(vus).some(v => v && v.sha === h) || neufs.some(x => x.sha === h)) { doublons.push({ name: f.name, at: f.at }); continue; }
        neufs.push({ ...f, buf, sha: h, source: f.ref.startsWith('d:') ? 'drive' : 'mail' });
      }
      const date = paris(new Date(now)).date;
      if (stocker) for (const f of neufs) { try { f.objet = await stocker(clubId, date, f.name, f.buf); } catch (e) { log && log('stockage :', e.message); } }
      const { resultats } = neufs.length ? await traiter(S, clubId, neufs, { now }) : { resultats: [] };
      const up = {};
      for (const r of resultats) Object.assign(up, r.up);
      for (const d of doublons) { const id = 'a' + sha(clubId + d.name + d.at).slice(0, 16); up[`rsm/autoLog/${clubId}/${id}`] = { id, name: String(d.name).slice(0, 160), at: now, type: 'déjà reçu', doublon: true, rows: 0, nouvelles: 0, ignorees: 0, erreurs: [], avertissements: ['Même contenu qu’un fichier déjà traité : ignoré.'] }; }
      for (const [k, v] of Object.entries(seen)) up[`rsm/autoSeen/${clubId}/${k}`] = v;
      up[`rsm/autoMeta/${clubId}`] = { lastRunAt: now, recus: recus.length, traites: neufs.length };
      const keys = Object.keys(up);
      for (let i = 0; i < keys.length; i += 500) { const part = {}; keys.slice(i, i + 500).forEach(k => { part[k] = up[k]; }); await api(tk, 'pulse.json', { method: 'PATCH', body: JSON.stringify(part) }); }
      out.push(`${clubId} : ${neufs.length} fichier(s) traité(s), ${doublons.length} déjà reçu(s)`);
    } catch (e) {
      await api(tk, `pulse/rsm/autoMeta/${clubId}.json`, { method: 'PATCH', body: JSON.stringify({ lastErrorAt: now, error: String(e.message || e).slice(0, 200) }) }).catch(() => null);
      out.push(`${clubId} : échec, ${e.message}`);
    }
  }
  log && log('Imports automatiques : ' + out.join(' ; '));
  return out.join(' ; ');
}

// Sources réelles à partir des secrets (même compte OAuth que la relève des résiliations).
export function sourcesReelles(S, env = process.env) {
  const comptes = comptesGmail(S, env); const imap = compteImap(S, env);
  return async clubId => {
    const out = []; const c = comptes[clubId];
    if (c) { const a = await jetonGmail(c); out.push(sourceGmail(a), sourceDrive(a)); }
    if (imap && imap.club === clubId) out.push(sourceImap(imap));
    return out;
  };
}

// ── Boîte e-mail relevée par mot de passe d'application (IMAP), sans connexion Google ──
// Secrets IMPORT_IMAP_USER et IMPORT_IMAP_MDP (mot de passe d'application du compte Gmail de
// l'accueil), club IMPORT_IMAP_CLUB (par défaut : le premier club). Lecture seule : les messages
// ne sont ni déplacés ni marqués. Pièces jointes CSV, XLSX, ZIP des 14 derniers jours.
export function compteImap(S, env = process.env) {
  if (!env.IMPORT_IMAP_USER || !env.IMPORT_IMAP_MDP) return null;
  const club = env.IMPORT_IMAP_CLUB && S.clubs && S.clubs[env.IMPORT_IMAP_CLUB] ? env.IMPORT_IMAP_CLUB : Object.keys(S.clubs || {}).find(id => S.clubs[id] && !S.clubs[id].archived);
  return club ? { club, user: env.IMPORT_IMAP_USER, pass: env.IMPORT_IMAP_MDP, host: env.IMPORT_IMAP_HOTE || 'imap.gmail.com', modules: env.IMAP_MODULES || '' } : null;
}
const chargerImap = modules => { const r = createRequire((modules ? modules.replace(/\/?$/, '/') : import.meta.url)); return { ImapFlow: r('imapflow').ImapFlow, simpleParser: r('mailparser').simpleParser }; };
export function sourceImap(c, charger = chargerImap) {
  return {
    async fichiers() {
      const { ImapFlow, simpleParser } = charger(c.modules);
      const cl = new ImapFlow({ host: c.host, port: 993, secure: true, auth: { user: c.user, pass: c.pass }, logger: false });
      await cl.connect(); const verrou = await cl.getMailboxLock('INBOX', { readOnly: true }); const out = [];
      try {
        const uids = (await cl.search({ since: new Date(Date.now() - 14 * 864e5) }, { uid: true })) || [];
        for (const uid of uids.slice(-60)) {
          const m = await cl.fetchOne(String(uid), { source: true }, { uid: true }); if (!m || !m.source) continue;
          const p = await simpleParser(m.source); const id = p.messageId || `uid${uid}`;
          for (const a of p.attachments || []) if (a.filename && EXT.test(a.filename) && /\.(csv|xlsx|zip)$/i.test(a.filename)) out.push({ ref: `i:${sha(id + '|' + a.filename).slice(0, 24)}`, name: a.filename, at: p.date ? p.date.getTime() : Date.now(), source: 'mail', lire: async () => Buffer.from(a.content) });
        }
      } finally { verrou.release(); await cl.logout().catch(() => null); }
      return out;
    },
  };
}
