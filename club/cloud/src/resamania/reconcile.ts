/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
// Réconciliation nocturne (3 h 15, Europe/Paris) : les webhooks Resamania ne sont pas
// renvoyés en cas d'échec (doc publique, page Webhooks). Chaque nuit, pour chaque club
// relié : les contacts modifiés depuis 26 h (GET /contacts, filtre updatedAt, cité dans la
// référence de l'API) et les incidents ouverts (GET /incidents, cité sur la page « Debts,
// incidents and closures » ; le filtre d'état sans contact est à confirmer en sandbox).
// Les objets lus sont rangés en attente de lecture par le moteur d'import
// (/ingest/{clubId}/objets/...), le journal d'appels sans donnée personnelle.
import type { Db } from '../ingestCore.js';
import type { RsmAppel } from './client.js';
import { derniereCle } from './webhook.js';
import { journalOps } from './config.js';

export const RECONCILE_FENETRE_MS = 26 * 3600_000;
type Client = { liste(chemin: string, q?: Record<string, string | number | boolean>, parPage?: number): AsyncGenerator<any> };

export async function reconcilierClub(o: { db: Db; clubId: string; client: Client; appels: RsmAppel[]; maintenant: number }) {
  const depuis = new Date(o.maintenant - RECONCILE_FENETRE_MS).toISOString(); const m: Record<string, unknown> = {}; const n = { contacts: 0, incidents: 0, erreurs: 0 };
  const lire = async (chemin: string, q: Record<string, string>, dossier: string, cle: 'contacts' | 'incidents') => {
    try { for await (const x of o.client.liste(chemin, q)) { const k = derniereCle(x && (x['@id'] || x.id)); if (!k) continue; m[`ingest/${o.clubId}/objets/${dossier}/${k}`] = { lu: o.maintenant, objet: x }; m[`ingest/${o.clubId}/aRelire/${dossier}/${k}`] = null; n[cle]++; } } catch { n.erreurs++; }
  };
  await lire('contacts', { 'updatedAt[after]': depuis }, 'contacts', 'contacts');
  await lire('incidents', { state: 'open' }, 'incidents', 'incidents');
  Object.assign(m, journalOps(o.clubId, o.appels, o.maintenant));
  m[`ingest/${o.clubId}/reconcile/last`] = { at: o.maintenant, ...n };
  await o.db.update(m);
  return n;
}
