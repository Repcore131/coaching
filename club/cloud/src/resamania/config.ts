/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
// Accès Resamania d'un club, tout côté serveur :
//  - secrets dans Secret Manager : RSM_API_KEY_<CLUB>, RSM_CLIENT_ID_<CLUB>, RSM_CLIENT_SECRET_<CLUB>,
//    RSM_HOOK_SECRET_<CLUB> (segment secret de l'adresse du webhook) ;
//  - identité de l'accès (passerelle, clientToken, IRI du club et du nœud réseau) dans
//    fitpulse_secret/resamania/{clubId}, illisible depuis l'appli (règles : aucun accès client).
// Rien de tout cela n'est écrit sous /pulse ni livré dans le front.
import type { Db } from '../ingestCore.js';
import type { RsmIdentite, RsmSecrets, RsmAppel } from './client.js';
import { fabriquerClient } from './client.js';

export const nomSecretRsm = (genre: 'API_KEY' | 'CLIENT_ID' | 'CLIENT_SECRET' | 'HOOK_SECRET', clubId: string) => `RSM_${genre}_${clubId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
export async function identiteClub(db: Db, clubId: string): Promise<RsmIdentite | null> {
  const x = await db.get(`fitpulse_secret/resamania/${clubId}`).catch(() => null);
  return x && x.gatewayBase && x.clientToken && x.clubIri ? { gatewayBase: x.gatewayBase, clientToken: x.clientToken, clubIri: x.clubIri, networkNodeIri: x.networkNodeIri || null } : null;
}
export async function clubsRelies(db: Db): Promise<string[]> { return Object.keys((await db.get('fitpulse_secret/resamania').catch(() => null)) || {}); }
export async function secretsClub(lire: (nom: string) => Promise<string | null>, clubId: string): Promise<RsmSecrets> {
  const [apiKey, clientId, clientSecret] = await Promise.all((['API_KEY', 'CLIENT_ID', 'CLIENT_SECRET'] as const).map(g => lire(nomSecretRsm(g, clubId))));
  if (!apiKey || !clientId || !clientSecret) throw new Error(`Accès Resamania incomplet pour ${clubId}`);
  return { apiKey, clientId, clientSecret };
}
// Journal d'appels : /ingest/{clubId}/log/{date}/{id} = { chemin, status, ms, essais, at }, sans donnée personnelle.
export function journalOps(clubId: string, appels: RsmAppel[], maintenant: number): Record<string, unknown> {
  const jour = new Date(maintenant).toISOString().slice(0, 10); const m: Record<string, unknown> = {};
  appels.forEach((a, i) => { m[`ingest/${clubId}/log/${jour}/${maintenant.toString(36)}${i.toString(36).padStart(3, '0')}`] = { chemin: a.chemin, status: a.status, ms: a.ms, essais: a.essais, at: maintenant }; });
  return m;
}
export async function clientPourClub(db: Db, clubId: string, lire: (nom: string) => Promise<string | null>, journal: (a: RsmAppel) => void) {
  const identite = await identiteClub(db, clubId); if (!identite) return null;
  let cache: RsmSecrets | null = null;
  return fabriquerClient({ identite, secrets: async () => (cache = cache || await secretsClub(lire, clubId)), journal });
}
