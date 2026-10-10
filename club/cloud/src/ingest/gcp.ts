/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
// Branchements Google Cloud de l'ossature : Cloud Storage (gs://fitpulse-ingest), Cloud Tasks
// (une file par club, une tâche à la fois), alerte import_failed dans la boîte des managers.
// Appels REST avec le compte de service de la fonction (google-auth-library, déjà en dépendance).
import { GoogleAuth } from 'google-auth-library';
import type { Db } from '../ingestCore.js';
import type { Stockage, FileTaches, Tache } from './core.js';
import { nomFile, nouvelId } from './core.js';

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const jeton = async () => (await (await auth.getClient()).getAccessToken()).token as string;
const projet = () => process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
export const BUCKET = process.env.FITPULSE_INGEST_BUCKET || 'fitpulse-ingest';
export const REGION = 'europe-west1';

export function stockageGcs(bucket = BUCKET): Stockage {
  return {
    async ecrire(objet, b) {
      const r = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(objet)}`, { method: 'POST', headers: { authorization: `Bearer ${await jeton()}`, 'content-type': 'application/octet-stream' }, body: new Uint8Array(b) });
      if (!r.ok) throw new Error(`Cloud Storage ${r.status}`);
    },
    async lire(objet) {
      const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objet)}?alt=media`, { headers: { authorization: `Bearer ${await jeton()}` } });
      if (!r.ok) throw new Error(`Cloud Storage ${r.status}`); return Buffer.from(await r.arrayBuffer());
    },
  };
}
// Règle de cycle de vie du bucket : fichiers bruts supprimés au bout de 30 jours (à poser une fois).
export const CYCLE_DE_VIE = { rule: [{ action: { type: 'Delete' }, condition: { age: 30 } }] };
export async function poserCycleDeVie(bucket = BUCKET) {
  const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}?fields=lifecycle`, { method: 'PATCH', headers: { authorization: `Bearer ${await jeton()}`, 'content-type': 'application/json' }, body: JSON.stringify({ lifecycle: CYCLE_DE_VIE }) });
  if (!r.ok) throw new Error(`Cycle de vie ${r.status}`);
}

// File par club : créée à la première tâche, maxConcurrentDispatches = 1, pas de nouvel essai
// automatique (les essais 1 min et 5 min sont gérés par processIngest).
export function fileCloudTasks(o: { urlWorker: string; secret: () => Promise<string>; compte?: string }): FileTaches {
  const connues = new Set<string>();
  const base = () => `https://cloudtasks.googleapis.com/v2/projects/${projet()}/locations/${REGION}/queues`;
  async function assurer(q: string, tk: string) {
    if (connues.has(q)) return;
    const r = await fetch(base(), { method: 'POST', headers: { authorization: `Bearer ${tk}`, 'content-type': 'application/json' }, body: JSON.stringify({ name: `projects/${projet()}/locations/${REGION}/queues/${q}`, rateLimits: { maxConcurrentDispatches: 1, maxDispatchesPerSecond: 1 }, retryConfig: { maxAttempts: 3, minBackoff: '60s', maxBackoff: '1800s' } }) });
    if (!r.ok && r.status !== 409) throw new Error(`Cloud Tasks (file) ${r.status}`);
    connues.add(q);
  }
  return {
    async pousser(t: Tache, delaiS = 0) {
      const tk = await jeton(); const q = nomFile(t.clubId); await assurer(q, tk);
      const corps = Buffer.from(JSON.stringify(t)).toString('base64');
      const tache: any = { httpRequest: { httpMethod: 'POST', url: o.urlWorker, headers: { 'content-type': 'application/json', 'x-fp-tache': await o.secret() }, body: corps, ...(o.compte ? { oidcToken: { serviceAccountEmail: o.compte } } : {}) } };
      if (delaiS) tache.scheduleTime = new Date(Date.now() + delaiS * 1000).toISOString();
      const r = await fetch(`${base()}/${q}/tasks`, { method: 'POST', headers: { authorization: `Bearer ${tk}`, 'content-type': 'application/json' }, body: JSON.stringify({ task: tache }) });
      if (!r.ok) throw new Error(`Cloud Tasks ${r.status}`);
    },
  };
}

// Alerte import_failed : boîte de réception de chaque manager actif du club (et des créateurs).
export function alerteManagers(db: Db) {
  return async (clubId: string, texte: string) => {
    const U = (await db.get('pulse/users')) || {}; const t = Date.now(); const m: Record<string, unknown> = {};
    for (const u of Object.values<any>(U)) if (u && u.status !== 'archived' && (u.role === 'createur' || (u.role === 'manager' && (u.clubs || []).includes(clubId)))) m[`pulse_inbox/${u.id}/if_${nouvelId(t)}`] = { title: 'Import en échec', body: texte.slice(0, 200), url: '#/imports', kind: 'import_failed', at: t };
    m[`ingest/${clubId}/alertes/${nouvelId(t)}`] = { kind: 'import_failed', texte: texte.slice(0, 200), at: t };
    await db.update(m);
  };
}
