/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
// Webhook Resamania : POST /rsm/hook/{clubId}/{secret}.
// La doc (https://doc.resamania.com/webhooks/webhooks.html) ne prévoit ni signature ni
// nouvel envoi : le secret est donc dans l'adresse (RSM_HOOK_SECRET_<CLUB>, Secret Manager).
// Mauvais secret ou club inconnu : 404, rien n'est écrit. Bon secret : l'événement brut est
// rangé dans /ingest/{clubId}/events/{pushId} = { event, data, clubHeader, receivedAt } et la
// réponse 200 part tout de suite (une seule écriture, bien sous 300 ms). Le traitement suit à
// part (rsmEvenement, déclenché par l'écriture), et la réconciliation de 3 h 15 rattrape les pertes.
import { timingSafeEqual, randomBytes } from 'node:crypto';
import type { Db } from '../ingestCore.js';

export const WEBHOOK_TAILLE_MAX = 64 * 1024;
const ROUTE = /\/rsm\/hook\/([a-z0-9_-]{1,60})\/([A-Za-z0-9_-]{16,128})\/?$/;
const egal = (a: string, b: string) => { const A = Buffer.from(a), B = Buffer.from(b); return A.length === B.length && timingSafeEqual(A, B); };
// Identifiant croissant, comme une clé push : instant en base 36 puis 8 caractères aléatoires.
export const pushId = (maintenant: number) => maintenant.toString(36).padStart(9, '0') + randomBytes(6).toString('base64url').slice(0, 8);

export function fabriquerWebhook(o: { db: Db; secret: (clubId: string) => Promise<string | null>; maintenant?: () => number }) {
  const maintenant = o.maintenant || (() => Date.now());
  return async (req: any, res: any) => {
    const t0 = maintenant();
    const m = String(req.path || req.url || '').split('?')[0].match(ROUTE);
    if (!m || req.method !== 'POST') return res.status(404).send('');
    const [, clubId, donne] = m;
    const attendu = await o.secret(clubId).catch(() => null);
    if (!attendu || !egal(donne, attendu)) return res.status(404).send('');
    const brut = req.rawBody ? Buffer.from(req.rawBody) : Buffer.from(JSON.stringify(req.body || {}));
    if (brut.length > WEBHOOK_TAILLE_MAX) return res.status(413).send('');
    let corps: any; try { corps = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : JSON.parse(brut.toString('utf8')); } catch { return res.status(400).send(''); }
    const event = typeof corps.event === 'string' ? corps.event.slice(0, 80) : '';
    if (!/^[a-z_]+\.[a-z_]+$/.test(event)) return res.status(400).send('');
    const h = (n: string) => { const v = (req.headers || {})[n]; return typeof v === 'string' ? v.slice(0, 200) : null; };
    await o.db.update({ [`ingest/${clubId}/events/${pushId(t0)}`]: { event, data: corps.data ?? null, clubHeader: h('x-user-club-id'), receivedAt: t0, status: 'reçu' } });
    return res.status(200).json({ ok: true });
  };
}

// Traitement d'un événement : l'objet visé est mis « à relire » (lu ensuite par l'API).
// contact.*, contact_tag.*, accounting_contact_tag.* -> le contact ; subscription.deleted -> l'abonnement.
export const derniereCle = (iri: unknown) => (typeof iri === 'string' ? (iri.split('/').filter(Boolean).pop() || '').replace(/[^A-Za-z0-9_-]/g, '') : '');
export function relectureOps(clubId: string, eventId: string, ev: any, maintenant: number): Record<string, unknown> {
  const o = (ev && ev.data && ev.data.object) || {}; const m: Record<string, unknown> = {};
  const famille = String(ev && ev.event || '').split('.')[0];
  if (['contact', 'contact_tag', 'accounting_contact_tag'].includes(famille)) { const k = derniereCle(o.contactId); if (k) m[`ingest/${clubId}/aRelire/contacts/${k}`] = maintenant; }
  if (famille === 'subscription' || famille === 'subscription_option') { const k = derniereCle(o.subscriptionId || o.subscriptionOptionId); if (k) m[`ingest/${clubId}/aRelire/subscriptions/${k}`] = maintenant; }
  m[`ingest/${clubId}/events/${eventId}/status`] = Object.keys(m).length ? 'à relire' : 'ignoré';
  m[`ingest/${clubId}/events/${eventId}/doneAt`] = maintenant;
  return m;
}
