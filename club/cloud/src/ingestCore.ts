/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// Cœur de l'ingestion des demandes de résiliation relevées dans la boîte accueil (Apps Script
// ou Microsoft 365) : validation du corps, signature, fusion des fils dans /pulse/resiliations.
// Aucune donnée personnelle dans le journal : clubId, nombre de fils, durée.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { moteurMail, moteurRes } from './appli.js';

export interface Fil {
  threadId: string; link: string | null; subject: string; review: boolean; kind: 'adherent' | 'notification' | 'formulaire'; type: 'resiliation' | 'suspension';
  score: number; signals: string[]; fromName: string; fromEmail: string | null; name: string | null; clientNum: string | null; phone: string | null;
  motif: string | null; effective: string | null; requestedAt: number; firstInAt: number; lastInAt: number; inCount: number;
  firstReplyAt: number | null; lastOutAt: number | null; outCount: number; awaitingReply: boolean; excerpt: string | null;
}
export interface Corps { clubId: string; mailbox: string; runAt: string; version: number; scanned: number; error?: string | null; threads: Fil[] }
export interface Db { get(chemin: string): Promise<any>; update(maj: Record<string, unknown>): Promise<void> }
export interface Bilan { created: number; updated: number; ignored: number }

export const TAILLE_MAX = 1024 * 1024;
export const ECART_HORLOGE_MS = 10 * 60 * 1000;
export const CLUB_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const nomSecret = (clubId: string) => 'FP_MAIL_SECRET_' + clubId.toUpperCase().replace(/[^A-Z0-9]/g, '_');
export const idDossier = (clubId: string, threadId: string) => 'ml' + createHash('sha1').update(clubId + '|' + threadId).digest('hex').slice(0, 16);

// Signature = HMAC-SHA256 hexadécimal de « X-FP-Time + "." + corps brut », comparée à temps constant.
export function signatureValide(secret: string | string[], temps: string, signature: string, brut: Buffer | string, maintenant = Date.now()): boolean {
  // Rotation : le nouveau secret et, pendant 24 h, l'ancien.
  if (Array.isArray(secret)) return secret.filter(Boolean).some(x => signatureValide(x, temps, signature, brut, maintenant));
  if (!secret || !/^\d{10,16}$/.test(temps || '') || !/^[0-9a-f]{64}$/i.test(signature || '')) return false;
  if (Math.abs(maintenant - Number(temps)) > ECART_HORLOGE_MS) return false;
  const attendu = createHmac('sha256', secret).update(temps + '.').update(brut).digest();
  const recu = Buffer.from(signature.toLowerCase(), 'hex');
  return recu.length === attendu.length && timingSafeEqual(recu, attendu);
}

// ── Validation : types et longueurs ; un fil invalide est ignoré, un corps invalide refusé ──
const chaine = (v: unknown, max: number, vide: string | null = null): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : vide);
const nombre = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e14 ? Math.round(v) : null);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export function validerFil(x: any): Fil | null {
  if (!x || typeof x !== 'object') return null;
  const threadId = chaine(x.threadId, 200); const firstInAt = nombre(x.firstInAt); const lastInAt = nombre(x.lastInAt);
  if (!threadId || firstInAt == null || lastInAt == null || lastInAt < firstInAt) return null;
  const kind = ['adherent', 'notification', 'formulaire'].includes(x.kind) ? x.kind : 'adherent';
  const link = typeof x.link === 'string' && /^https:\/\/[^\s"<>]{1,500}$/.test(x.link) ? x.link : null;
  const email = typeof x.fromEmail === 'string' && /^[^@\s]{1,64}@[^@\s]{1,190}$/.test(x.fromEmail) ? x.fromEmail.toLowerCase() : null;
  return {
    threadId, link, subject: chaine(x.subject, 140, '') as string, review: x.review === true, kind, type: x.type === 'suspension' ? 'suspension' : 'resiliation',
    score: typeof x.score === 'number' && Number.isFinite(x.score) ? Math.max(-50, Math.min(50, Math.round(x.score))) : 0,
    signals: Array.isArray(x.signals) ? x.signals.filter((s: unknown) => typeof s === 'string').slice(0, 10).map((s: string) => s.slice(0, 40)) : [],
    fromName: chaine(x.fromName, 60, '') as string, fromEmail: email, name: chaine(x.name, 60), clientNum: chaine(x.clientNum, 20),
    phone: typeof x.phone === 'string' && /^[0-9 +.]{6,20}$/.test(x.phone) ? x.phone : null, motif: chaine(x.motif, 40),
    effective: typeof x.effective === 'string' && ISO.test(x.effective) ? x.effective : null,
    requestedAt: nombre(x.requestedAt) ?? firstInAt, firstInAt, lastInAt, inCount: Math.max(1, nombre(x.inCount) ?? 1),
    firstReplyAt: nombre(x.firstReplyAt), lastOutAt: nombre(x.lastOutAt), outCount: nombre(x.outCount) ?? 0, awaitingReply: x.awaitingReply === true,
    excerpt: chaine(x.excerpt, 280),
  };
}
export function validerCorps(c: any): { corps: Corps; ignores: number } | null {
  if (!c || typeof c !== 'object' || typeof c.clubId !== 'string' || !CLUB_RE.test(c.clubId) || !Array.isArray(c.threads) || c.threads.length > 500) return null;
  const fils = c.threads.map(validerFil); const ok = fils.filter((f: Fil | null): f is Fil => !!f);
  return { corps: { clubId: c.clubId, mailbox: chaine(c.mailbox, 190, '') as string, runAt: chaine(c.runAt, 40, '') as string, version: nombre(c.version) ?? 1, scanned: nombre(c.scanned) ?? 0, error: chaine(c.error, 300), threads: ok }, ignores: fils.length - ok.length };
}

// ── Rapprochement client : matchClient de l'appli (res-moteur.js), même code des deux côtés ──
export function rapprocher(fil: Fil, clients: Record<string, any>, clubId: string): { id: string; num: string | null; confidence: string } | null {
  const m = moteurRes().matchClient(clients || {}, clubId, { email: fil.fromEmail, clientNum: fil.clientNum, name: fil.name || fil.fromName });
  if (!m.clientId || !['forte', 'moyenne'].includes(m.confidence)) return null;
  const c = (clients || {})[m.clientId] || {}; return { id: m.clientId, num: c.num || null, confidence: m.confidence };
}

// Date AAAA-MM-JJ à Paris d'un horodatage.
export const jourParis = (ms: number) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const mailDe = (f: Fil) => ({ threadId: f.threadId, link: f.link, subject: f.subject, firstInAt: f.firstInAt, lastInAt: f.lastInAt, firstReplyAt: f.firstReplyAt, lastOutAt: f.lastOutAt, inCount: f.inCount, outCount: f.outCount, awaitingReply: f.awaitingReply, kind: f.kind, score: f.score });

// Fusion d'une relève : un seul update() multi-chemins. Un dossier existant ne voit changer que mail.*,
// ses champs vides (numéro, date d'effet) et des actions ajoutées (clés déterministes : idempotent).
// E-mail, téléphone et extrait vont dans /private/resiliations/{club}/{id} (manager et responsable seulement).
export async function ingerer(db: Db, corps: Corps, maintenant = Date.now(), ignoresAvant = 0): Promise<Bilan> {
  const { clubId } = corps; const maj: Record<string, unknown> = {}; const bilan: Bilan = { created: 0, updated: 0, ignored: ignoresAvant };
  const RES = moteurRes(); const MAIL = moteurMail();
  maj[`pulse/clubs/${clubId}/mailSync`] = { at: maintenant, ok: !corps.error, scanned: corps.scanned, found: corps.threads.length, error: corps.error || null };
  const club = (await db.get(`pulse/clubs/${clubId}`)) || {}; const sla = Number(club.mailRules && club.mailRules.slaHours) || 24;
  const vus = new Set<string>(); let clients: Record<string, any> | null = null; const crees: Record<string, any> = {};
  for (const f of corps.threads) {
    const id = idDossier(clubId, f.threadId); if (vus.has(id)) { bilan.ignored++; continue; } vus.add(id);
    const P = `pulse/resiliations/${id}`; const PV = `private/resiliations/${clubId}/${id}`; const old = await db.get(P);
    if (!old) {
      if (clients == null) clients = (await db.get('pulse/clients')) || {};
      const c = rapprocher(f, clients || {}, clubId); const appli = f.kind === 'notification' && f.signals.includes('appli');
      const fiche = c ? (clients || {})[c.id] || {} : {};
      const dossier: Record<string, unknown> = {
        id, clubId, client: f.name || f.fromName || 'Demande reçue par e-mail', clientId: c ? c.id : null, clientConfidence: c ? c.confidence : null, clientNum: f.clientNum || (c && c.num) || null,
        date: jourParis(f.firstInAt), effective: f.effective, reason: MAIL.motifValide(f.motif), status: f.review ? 'averifier' : 'nouvelle', saved: false, ownerId: null, userId: null,
        source: appli ? 'appli' : 'mail', channel: appli ? 'Appli adhérents' : 'Boîte accueil', type: f.type, receivedAt: f.firstInAt, dueAt: f.lastInAt + sla * 3600000,
        mail: mailDe(f), at: maintenant, actions: [{ at: f.firstInAt, by: 'system', label: f.review ? 'Message à vérifier reçu par e-mail' : 'Demande reçue par e-mail' }],
      };
      if (f.firstReplyAt) dossier.log = { ['rep' + f.firstReplyAt]: { at: f.firstReplyAt, by: 'system', label: 'Réponse envoyée depuis la boîte accueil' } };
      const prive = { email: f.fromEmail || fiche.email || null, phone: f.phone || fiche.phone || null, excerpt: f.excerpt || null };
      if (prive.email || prive.phone || prive.excerpt) maj[PV] = prive;
      maj[P] = dossier; crees[id] = dossier; bilan.created++; continue;
    }
    const m = old.mail || {};
    for (const [k, v] of Object.entries(mailDe(f))) maj[`${P}/mail/${k}`] = v;
    if (f.phone || f.excerpt) { const pv = (await db.get(PV)) || {}; if (!pv.phone && f.phone) maj[`${PV}/phone`] = f.phone; if (f.excerpt && !pv.excerpt) maj[`${PV}/excerpt`] = f.excerpt; }
    if (!old.clientNum && f.clientNum) maj[`${P}/clientNum`] = f.clientNum;
    if (!old.effective && f.effective) maj[`${P}/effective`] = f.effective;
    if (old.status === 'averifier' && !f.review && !old.outcome) { maj[`${P}/status`] = 'nouvelle'; maj[`${P}/log/conf${f.lastInAt}`] = { at: maintenant, by: 'system', label: 'Confirmée comme demande par la relève' }; }
    // L'adhérent a réécrit : nouveau message, échéance de réponse et escalade repartent de ce message.
    if (m.lastInAt && f.lastInAt > m.lastInAt) { maj[`${P}/log/in${f.lastInAt}`] = { at: f.lastInAt, by: 'system', label: 'Nouveau message de l\'adhérent' }; maj[`${P}/escalation`] = null; maj[`${P}/dueAt`] = f.lastInAt + sla * 3600000; }
    if (f.firstReplyAt && !m.firstReplyAt) maj[`${P}/log/rep${f.firstReplyAt}`] = { at: f.firstReplyAt, by: 'system', label: 'Réponse envoyée depuis la boîte accueil' };
    if (f.lastOutAt && m.lastOutAt && f.lastOutAt > m.lastOutAt) maj[`${P}/log/rep${f.lastOutAt}`] = { at: f.lastOutAt, by: 'system', label: 'Réponse envoyée depuis la boîte accueil' };
    bilan.updated++;
  }
  // Doublons : un client déjà suivi dans un dossier ouvert de moins de 60 jours (même règle que l'appli).
  if (Object.keys(crees).length) {
    const tous = { ...((await db.get('pulse/resiliations')) || {}), ...crees };
    for (const op of RES.dedupePlan(tous, clubId, jourParis(maintenant), maintenant)) {
      const cible = crees[op.id];
      if (cible) { Object.assign(cible, op.set || {}); if (op.action) cible.log = { ...(cible.log || {}), ['fu' + createHash('sha1').update(op.id + '|' + op.action.fusion).digest('hex').slice(0, 12)]: op.action }; continue; }
      for (const [k, v] of Object.entries(op.set || {})) maj[`pulse/resiliations/${op.id}/${k}`] = v;
      if (op.action) maj[`pulse/resiliations/${op.id}/log/fu${createHash('sha1').update(op.id + '|' + op.action.fusion).digest('hex').slice(0, 12)}`] = op.action;
    }
  }
  await db.update(maj);
  return bilan;
}
