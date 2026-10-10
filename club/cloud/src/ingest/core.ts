/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
// Ossature d'ingestion : un seul point d'entrée pour les 4 canaux (e-mail, Drive, API, dépôt).
//   ingestFile(clubId, bytes, meta) : empreinte SHA-256, doublon refusé, fichier brut rangé dans
//     gs://fitpulse-ingest/{clubId}/{sha}, ligne /ingest/{clubId}/inbox/{id} (status 'queued') et
//     une tâche dans la file Cloud Tasks ingest-{clubId} (maxConcurrentDispatches = 1 : deux
//     fichiers d'un même club ne sont jamais traités en même temps ; deux clubs, si).
//   processIngest(tâche) : lecture du fichier, moteur commun (resamania-core.js : planImport),
//     écritures par lots de 500 chemins, lignes d'un vendeur inconnu en attente
//     (/ingest/{clubId}/pending/{id}, jamais comptées), rapport /ingest/{clubId}/reports/{id}.
//   Statuts : queued, processing, done, done_with_pending, failed. En cas d'échec : nouvel essai
//   après 1 min puis 5 min ; au 3e échec, 'failed' et alerte import_failed aux managers du club.
// Les dépendances (base, stockage, file, moteur) sont injectées : testables sans Google Cloud.
import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../ingestCore.js';

export type Canal = 'mail' | 'drive' | 'api' | 'manual';
export type Statut = 'queued' | 'processing' | 'done' | 'done_with_pending' | 'failed';
export interface Stockage { ecrire(objet: string, b: Buffer): Promise<void>; lire(objet: string): Promise<Buffer> }
export interface Tache { clubId: string; id: string; essai: number }
export interface FileTaches { pousser(t: Tache, delaiS?: number): Promise<void> }
export type Op = [string[], unknown];
export interface Plan { ops: Op[]; summary: Record<string, unknown>; pending: Array<Record<string, any>>; lignes: Record<string, unknown[]>; rowsRead: number; warnings: string[] }
export interface Moteur { planifier(clubId: string, bytes: Buffer, name: string, by: string): Promise<Plan>; rejouer?(attente: any, uid: string, clubId: string, by: string): Promise<Op[]> }
export interface Deps { db: Db; stockage: Stockage; file: FileTaches; moteur?: Moteur; maintenant?: () => number; racine?: string; alerte?: (clubId: string, texte: string) => Promise<void> }

export const EXT_TABULAIRES = /\.(csv|zip|xlsx)$/i;
export const LOT_CHEMINS = 500;
export const ECHECS_MAX = 3;
export const RECUL_S = [60, 300, 1800]; // 1 min, 5 min (30 min : plafond de la file en cas d'incident d'acheminement)
export const TAILLE_MAX = 25 * 1024 * 1024;
export const empreinte = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const cleSure = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);
export const nouvelId = (t: number) => t.toString(36).padStart(9, '0') + randomBytes(5).toString('hex');
export const nomFile = (clubId: string) => `ingest-${clubId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`.slice(0, 100);

export interface Meta { canal: Canal; name: string; cle?: string; driveId?: string; gmailId?: string; by?: string }
export type Resultat = { statut: 'queued'; id: string; sha: string } | { statut: 'doublon'; sha: string; id?: string } | { statut: 'ignoré'; raison: string };

export async function ingestFile(d: Deps, clubId: string, bytes: Buffer, meta: Meta): Promise<Resultat> {
  const t = (d.maintenant || Date.now)();
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(clubId)) return { statut: 'ignoré', raison: 'club invalide' };
  if (!EXT_TABULAIRES.test(meta.name || '')) return { statut: 'ignoré', raison: 'non tabulaire' };
  if (!bytes.length || bytes.length > TAILLE_MAX) return { statut: 'ignoré', raison: 'taille' };
  const sha = empreinte(bytes);
  const deja = await d.db.get(`ingest/${clubId}/files/${sha}`);
  if (deja) return { statut: 'doublon', sha, id: deja.id };
  if (meta.cle) { const c = await d.db.get(`ingest/${clubId}/cles/${cleSure(meta.cle)}`); if (c) return { statut: 'doublon', sha, id: String(c) }; }
  const id = nouvelId(t);
  await d.stockage.ecrire(`${clubId}/${sha}`, bytes);
  const m: Record<string, unknown> = {
    [`ingest/${clubId}/files/${sha}`]: { id, name: String(meta.name).slice(0, 160), canal: meta.canal, at: t },
    [`ingest/${clubId}/inbox/${id}`]: { sha, name: String(meta.name).slice(0, 160), canal: meta.canal, size: bytes.length, receivedAt: t, status: 'queued', echecs: 0, ...(meta.driveId ? { driveId: meta.driveId } : {}), ...(meta.gmailId ? { gmailId: meta.gmailId } : {}) },
  };
  if (meta.cle) m[`ingest/${clubId}/cles/${cleSure(meta.cle)}`] = id;
  await d.db.update(m);
  await d.file.pousser({ clubId, id, essai: 1 });
  return { statut: 'queued', id, sha };
}

// Écritures du plan par lots de 500 chemins (sous /pulse).
// Branches rangées hors de /pulse, comme dans l'appli (core.js, sidePaths) en mode club.
const HORS_PULSE: Record<string, string> = { product: 'pulse_product', benchmark: 'benchmark', private: 'private' };
export const cheminBase = (p: string[], racine = 'pulse') => (racine === 'pulse' && HORS_PULSE[p[0]] ? [HORS_PULSE[p[0]], ...p.slice(1)] : [racine, ...p]).join('/');
export async function ecrireParLots(db: Db, ops: Op[], racine = 'pulse') {
  const m = Object.entries(Object.fromEntries(ops.map(([p, v]) => [cheminBase(p, racine), v ?? null])));
  for (let i = 0; i < m.length; i += LOT_CHEMINS) await db.update(Object.fromEntries(m.slice(i, i + LOT_CHEMINS)));
  return m.length;
}

export async function processIngest(d: Deps, tache: Tache): Promise<Statut> {
  const t0 = (d.maintenant || Date.now)(); const { clubId, id } = tache; const base = `ingest/${clubId}`;
  const ib = await d.db.get(`${base}/inbox/${id}`); if (!ib) return 'failed';
  if (ib.status === 'done' || ib.status === 'done_with_pending' || ib.status === 'failed') return ib.status;
  await d.db.update({ [`${base}/inbox/${id}/status`]: 'processing', [`${base}/inbox/${id}/startedAt`]: t0 });
  try {
    if (!d.moteur) throw new Error('moteur absent');
    const bytes = await d.stockage.lire(`${clubId}/${ib.sha}`);
    const plan = await d.moteur.planifier(clubId, bytes, ib.name, `auto:${ib.canal === 'manual' ? 'mail' : ib.canal}`);
    const n = await ecrireParLots(d.db, plan.ops, d.racine || 'pulse');
    const vendeurs = plan.pending.filter(p => p.kind === 'seller'); const m: Record<string, unknown> = {};
    vendeurs.forEach((p, i) => { m[`${base}/pending/${id}_${i}`] = { id: `${id}_${i}`, kind: 'seller', label: p.label, keys: p.keys, count: p.count, lignes: plan.lignes[p.keys[0]] || [], file: ib.name, reportId: id, at: t0 }; });
    const statut: Statut = vendeurs.length ? 'done_with_pending' : 'done';
    const fin = (d.maintenant || Date.now)();
    const importees = Number((plan.summary as any).entries || 0) + Number((plan.summary as any).recov || 0) + Number((plan.summary as any).resil || 0);
    m[`${base}/reports/${id}`] = { file: ib.name, canal: ib.canal, rowsRead: plan.rowsRead, rowsImported: importees, pending: vendeurs.reduce((s, p) => s + (Number(p.count) || 0), 0), warnings: [...plan.warnings, ...plan.pending.filter(p => p.kind !== 'seller').map(p => (p.kind === 'truncated' ? `${p.file} : exactement 2 000 lignes, fichier probablement tronqué` : `${p.file} : fichier non reconnu`))].slice(0, 20), ms: fin - t0, status: statut, receivedAt: ib.receivedAt, at: fin, chemins: n };
    m[`${base}/inbox/${id}/status`] = statut; m[`${base}/inbox/${id}/doneAt`] = fin;
    await d.db.update(m);
    return statut;
  } catch (e: any) {
    const echecs = (Number(ib.echecs) || 0) + 1; const raison = String(e && e.message || e).slice(0, 200);
    if (echecs < ECHECS_MAX) {
      await d.db.update({ [`${base}/inbox/${id}/status`]: 'queued', [`${base}/inbox/${id}/echecs`]: echecs, [`${base}/inbox/${id}/erreur`]: raison });
      await d.file.pousser({ clubId, id, essai: echecs + 1 }, RECUL_S[echecs - 1]);
      return 'queued';
    }
    const fin = (d.maintenant || Date.now)();
    await d.db.update({ [`${base}/inbox/${id}/status`]: 'failed', [`${base}/inbox/${id}/echecs`]: echecs, [`${base}/inbox/${id}/erreur`]: raison,
      [`${base}/reports/${id}`]: { file: ib.name, canal: ib.canal, rowsRead: 0, rowsImported: 0, pending: 0, warnings: [raison], ms: fin - t0, status: 'failed', receivedAt: ib.receivedAt, at: fin } });
    await d.alerte?.(clubId, `Import en échec après ${ECHECS_MAX} essais : ${ib.name}`);
    return 'failed';
  }
}

// Vendeur rattaché par le manager (rsm/aliases/{clé} = uid) : lignes en attente rejouées, puis effacées.
export async function rejouerAttentes(d: Deps, clubId: string, cle: string, uid: string) {
  if (!d.moteur || !d.moteur.rejouer || !uid || uid === 'system' || uid === 'ignore') return 0;
  const P = (await d.db.get(`ingest/${clubId}/pending`)) || {}; let n = 0;
  for (const p of Object.values<any>(P)) {
    if (!p || !(p.keys || []).includes(cle)) continue;
    const ops = await d.moteur.rejouer(p, uid, clubId, 'auto:' + 'mail'); n += await ecrireParLots(d.db, ops, d.racine || 'pulse');
    await d.db.update({ [`ingest/${clubId}/pending/${p.id}`]: null, [`ingest/${clubId}/reports/${p.reportId}/rattache`]: { uid, at: (d.maintenant || Date.now)() } });
  }
  return n;
}

// Purge : rapports et journaux de plus de 13 mois ; brut du stockage : règle de cycle de vie (30 jours).
export const GARDE_RAPPORTS_MS = 396 * 864e5;
export async function purgeRapports(db: Db, clubId: string, maintenant: number) {
  const R = (await db.get(`ingest/${clubId}/reports`)) || {}; const m: Record<string, unknown> = {};
  for (const [id, r] of Object.entries<any>(R)) if (!r || (r.at || 0) < maintenant - GARDE_RAPPORTS_MS) m[`ingest/${clubId}/reports/${id}`] = null;
  const I = (await db.get(`ingest/${clubId}/inbox`)) || {};
  for (const [id, r] of Object.entries<any>(I)) if (!r || (r.receivedAt || 0) < maintenant - 30 * 864e5) m[`ingest/${clubId}/inbox/${id}`] = null;
  if (Object.keys(m).length) await db.update(m);
  return Object.keys(m).length;
}
