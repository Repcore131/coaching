/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// notify(userId, msg, { channels, groupKey, quiet }) : boîte de réception de l'appli, notification push,
// e-mail et SMS. Le texte ne porte que des prénoms et initiales. Clé de groupe : un seul envoi par
// destinataire et par passage (rejouer le même passage ne renvoie rien).
import type { Db } from './ingestCore.js';
import type { Canal, Envoi } from './resPlans.js';

export interface Transports {
  push?(uid: string, msg: { title: string; body: string; url: string; tag: string }): Promise<number>;
  email?(to: string, sujet: string, texte: string): Promise<void>;
  sms?(to: string, texte: string): Promise<void>;
}
export interface Notif { title: string; body: string; url: string; kind?: string }
export async function notify(db: Db, T: Transports, userId: string, msg: Notif, { channels, groupKey, quiet = false }: { channels: Canal[]; groupKey: string; quiet?: boolean }): Promise<Canal[]> {
  const cle = groupKey.replace(/[.#$/[\]]/g, ',');
  if (await db.get(`fitpulse_secret/notifLog/${cle}`)) return [];
  const faits: Canal[] = []; const user = (await db.get(`pulse/users/${userId}`)) || {};
  const maj: Record<string, unknown> = { [`pulse_inbox/${userId}/${cle}`]: { title: msg.title, body: msg.body, url: msg.url, kind: msg.kind || 'resiliations', at: Date.now() }, [`fitpulse_secret/notifLog/${cle}`]: { at: Date.now(), uid: userId } };
  faits.push('inbox');
  if (!quiet && channels.includes('push') && T.push) { try { if ((await T.push(userId, { title: msg.title, body: msg.body, url: msg.url, tag: cle })) > 0) faits.push('push'); } catch { /* appareil injoignable */ } }
  if (channels.includes('email') && T.email && user.email) { try { await T.email(user.email, msg.title, `${msg.body}\n\nOuvrir Fit Pulse : ${msg.url}`); faits.push('email'); } catch { /* messagerie indisponible */ } }
  if (channels.includes('sms') && T.sms && user.phone) { try { await T.sms(user.phone, `${msg.title}. ${msg.body}`.slice(0, 300)); faits.push('sms'); } catch { /* fournisseur indisponible */ } }
  await db.update(maj);
  return faits;
}
export async function envoyer(db: Db, T: Transports, envois: Envoi[], kind: string): Promise<number> {
  let n = 0; for (const e of envois) { const f = await notify(db, T, e.uid, { title: e.title, body: e.body, url: e.url, kind }, { channels: e.channels, groupKey: e.groupKey }); if (f.length) n++; }
  return n;
}
