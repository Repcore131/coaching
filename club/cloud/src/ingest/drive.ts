/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
// Relève Drive : toutes les 10 minutes de 6 h à 22 h (Europe/Paris). Chaque club partage un dossier
// avec le compte de service d'ingestion ; S.ingestConfig[clubId].drive = { folderId, status: 'actif' }.
//  - seuls les fichiers du dossier déclaré, modifiés depuis le dernier passage, sont listés
//    (Drive API files.list, q = parents et modifiedTime) ; un fichier dont les parents ne
//    contiennent pas ce dossier n'est jamais lu ;
//  - .csv, .zip, .xlsx : téléchargés, empreinte SHA-256 (doublon ignoré : /ingest/{clubId}/files/{sha}),
//    puis ingestFile(clubId, buffer, { canal: 'drive', name, driveId }) ;
//  - autre type (PDF...) : ignoré, rapport « non tabulaire » ;
//  - le fichier d'origine n'est jamais supprimé ni déplacé : seule la propriété
//    appProperties.fitpulse = 'importé' est posée (si le partage le permet).
import type { Deps } from './core.js';
import { ingestFile, EXT_TABULAIRES, nouvelId } from './core.js';

export interface FichierDrive { id: string; name: string; mimeType?: string; modifiedTime: string; parents?: string[]; size?: string }
export interface DriveApi { lister(q: string): Promise<FichierDrive[]>; telecharger(id: string): Promise<Buffer>; marquer(id: string): Promise<void> }
export const DOSSIER_RE = /^[A-Za-z0-9_-]{10,100}$/;

export async function releverDrive(d: Deps & { drive: DriveApi }, clubId: string, folderId: string) {
  const t = (d.maintenant || Date.now)(); const n = { importes: 0, doublons: 0, ignores: 0, erreurs: 0 };
  if (!DOSSIER_RE.test(folderId)) return n;
  const dernier = Number(await d.db.get(`ingest/${clubId}/drive/last`)) || 0;
  const depuis = new Date(dernier || t - 24 * 3600_000).toISOString();
  const L = await d.drive.lister(`'${folderId}' in parents and modifiedTime > '${depuis}' and trashed = false`);
  const m: Record<string, unknown> = {};
  for (const f of L) {
    if (!(f.parents || []).includes(folderId)) continue; // jamais hors du dossier déclaré
    if (!EXT_TABULAIRES.test(f.name || '')) {
      const id = nouvelId(t) + n.ignores; n.ignores++;
      m[`ingest/${clubId}/reports/${id}`] = { file: String(f.name).slice(0, 160), canal: 'drive', rowsRead: 0, rowsImported: 0, pending: 0, warnings: ['non tabulaire'], ms: 0, status: 'ignored', receivedAt: t, at: t };
      continue;
    }
    try {
      const r = await ingestFile(d, clubId, await d.drive.telecharger(f.id), { canal: 'drive', name: f.name, driveId: f.id });
      if (r.statut === 'queued') n.importes++; else if (r.statut === 'doublon') n.doublons++; else n.ignores++;
      if (r.statut !== 'ignoré') await d.drive.marquer(f.id).catch(() => null); // lecture seule : la marque peut être refusée
    } catch { n.erreurs++; }
  }
  m[`ingest/${clubId}/drive/last`] = t; m[`ingest/${clubId}/drive/bilan`] = { at: t, ...n };
  await d.db.update(m);
  return n;
}

// Drive API réelle (compte de service, portée drive : lecture, et pose d'appProperties).
export function driveReel(jeton: () => Promise<string>): DriveApi {
  const api = async (chemin: string, init: any = {}) => { const r = await fetch('https://www.googleapis.com/drive/v3/' + chemin, { ...init, headers: { authorization: `Bearer ${await jeton()}`, ...(init.headers || {}) } }); if (!r.ok) throw new Error(`Drive ${r.status}`); return r; };
  return {
    async lister(q) { const out: FichierDrive[] = []; let page = ''; do { const j: any = await (await api(`files?q=${encodeURIComponent(q)}&fields=nextPageToken,files(id,name,mimeType,modifiedTime,parents,size)&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true${page ? '&pageToken=' + page : ''}`)).json(); out.push(...(j.files || [])); page = j.nextPageToken || ''; } while (page); return out; },
    async telecharger(id) { return Buffer.from(await (await api(`files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`)).arrayBuffer()); },
    async marquer(id) { await api(`files/${encodeURIComponent(id)}?supportsAllDrives=true`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ appProperties: { fitpulse: 'importé' } }) }); },
  };
}
