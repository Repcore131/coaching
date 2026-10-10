/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// Accès partagés : base (SDK admin, compte de service) et Secret Manager (cache de 5 minutes).
import { initializeApp, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import type { Db } from './ingestCore.js';

const DB_URL = process.env.FIREBASE_DB_URL || 'https://repcore-sync-default-rtdb.firebaseio.com';
export function adminDb(): Db {
  const base = () => { if (!getApps().length) initializeApp({ databaseURL: DB_URL }); return getDatabase(); };
  return { get: async p => (await base().ref(p).get()).val(), update: async m => { await base().ref().update(m); } };
}
const projet = () => process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
const cache = new Map<string, { v: string | null; at: number }>();
async function client() { const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager'); return new SecretManagerServiceClient(); }
export async function lireSecret(nom: string, version = 'latest'): Promise<string | null> {
  const k = nom + '@' + version; const c = cache.get(k); if (c && Date.now() - c.at < 5 * 60000) return c.v;
  let v: string | null = null;
  try { const [r] = await (await client()).accessSecretVersion({ name: `projects/${projet()}/secrets/${nom}/versions/${version}` }); v = r.payload?.data ? Buffer.from(r.payload.data as Uint8Array).toString('utf8').trim() : null; } catch { v = null; }
  cache.set(k, { v, at: Date.now() }); return v;
}
// Numéro de la version active (avant une rotation).
export async function versionActive(nom: string): Promise<string | null> {
  try { const [r] = await (await client()).accessSecretVersion({ name: `projects/${projet()}/secrets/${nom}/versions/latest` }); return String(r.name || '').split('/').pop() || null; } catch { return null; }
}
// Secrets acceptés pour un club : la version active et, jusqu'à la date notée par setMailSecret
// (rotation, 24 h), la version précédente. Le numéro de version est rangé hors de /pulse.
export async function secretsValides(db: Db, nom: string, clubId: string, maintenant = Date.now(), lire: (nom: string, version?: string) => Promise<string | null> = lireSecret): Promise<string[]> {
  const out: string[] = []; const actuel = await lire(nom); if (actuel) out.push(actuel);
  const rot = await db.get(`fitpulse_secret/mail/${clubId}`).catch(() => null);
  if (rot && rot.version && Number(rot.until) > maintenant) { const anc = await lire(nom, String(rot.version)); if (anc) out.push(anc); }
  return out;
}
export async function ecrireSecret(nom: string, valeur: string): Promise<void> {
  const sm = await client(); const parent = `projects/${projet()}`;
  try { await sm.getSecret({ name: `${parent}/secrets/${nom}` }); } catch { await sm.createSecret({ parent, secretId: nom, secret: { replication: { automatic: {} } } }); }
  await sm.addSecretVersion({ parent: `${parent}/secrets/${nom}`, payload: { data: Buffer.from(valeur, 'utf8') } });
  for (const k of [...cache.keys()]) if (k.startsWith(nom + '@')) cache.delete(k);
}
