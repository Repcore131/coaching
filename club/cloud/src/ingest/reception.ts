/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
// Réceptions qui aboutissent à ingestFile :
//  1. recevoirScript : POST multipart du script Gmail (apps-script-imports/Code.gs), en-têtes
//     X-Club-Id et X-Club-Token (jeton du club dans Secret Manager : FP_INGEST_TOKEN_<CLUB>).
//     Champ gmailId envoyé avec chaque fichier : un message déjà traité est refusé (409).
//  2. recevoirMail : message reçu sur {slugClub}-{4 caractères}@import.fitpulse.app, relayé par le
//     récepteur e-mail (email-worker/), signé HMAC. Adresse inconnue ou régénérée : 404 (la
//     correspondance adresse -> club est relue au plus tard toutes les 60 s). Expéditeur d'origine
//     hors liste blanche du club : fichiers en quarantaine, jamais importés automatiquement.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Db } from '../ingestCore.js';
import type { Deps, Resultat } from './core.js';
import { ingestFile, empreinte, nouvelId, EXT_TABULAIRES, TAILLE_MAX } from './core.js';

const egal = (a: string, b: string) => { const A = Buffer.from(a), B = Buffer.from(b); return A.length === B.length && timingSafeEqual(A, B); };
const CLUB = /^[A-Za-z0-9_-]{1,60}$/;
const codeDe = (r: Resultat) => (r.statut === 'queued' ? 200 : r.statut === 'doublon' ? 409 : 415);

// ── multipart/form-data (fichiers jusqu'à 25 Mo) ──────────────────────────
export interface Partie { name: string; filename?: string; type?: string; data: Buffer }
export function lireMultipart(corps: Buffer, contentType: string): Partie[] {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || ''); if (!m) return [];
  const sep = Buffer.from('--' + (m[1] || m[2]).trim()); const out: Partie[] = []; let i = corps.indexOf(sep);
  while (i >= 0) {
    const debut = i + sep.length; if (corps.slice(debut, debut + 2).toString() === '--') break;
    const fin = corps.indexOf(sep, debut); if (fin < 0) break;
    const bloc = corps.slice(debut + 2, fin - 2); const h = bloc.indexOf('\r\n\r\n');
    if (h > 0) {
      const tete = bloc.slice(0, h).toString('utf8'); const data = bloc.slice(h + 4);
      const nom = /name="([^"]*)"/i.exec(tete); const fichier = /filename\*?=(?:UTF-8'')?"?([^";\r\n]*)"?/i.exec(tete); const type = /content-type:\s*([^\r\n]+)/i.exec(tete);
      if (nom) out.push({ name: nom[1], filename: fichier ? decodeURIComponent(fichier[1]) : undefined, type: type ? type[1].trim() : undefined, data });
    }
    i = fin;
  }
  return out;
}

export function fabriquerReceptionScript(o: { deps: Deps; jeton: (clubId: string) => Promise<string | null> }) {
  return async (req: any, res: any) => {
    if (req.method !== 'POST') return res.status(405).send('');
    const clubId = String((req.headers || {})['x-club-id'] || ''); const donne = String((req.headers || {})['x-club-token'] || '');
    const attendu = CLUB.test(clubId) ? await o.jeton(clubId).catch(() => null) : null;
    if (!attendu || !donne || !egal(donne, attendu)) return res.status(401).json({ statut: 'refusé' });
    const corps: Buffer = req.rawBody ? Buffer.from(req.rawBody) : Buffer.alloc(0);
    if (corps.length > TAILLE_MAX + 64 * 1024) return res.status(413).json({ statut: 'trop lourd' });
    const P = lireMultipart(corps, String((req.headers || {})['content-type'] || ''));
    const gmailId = (P.find(p => p.name === 'gmailId')?.data.toString('utf8') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
    const fichier = P.find(p => p.filename);
    if (!fichier || !gmailId) return res.status(400).json({ statut: 'incomplet' });
    const r = await ingestFile(o.deps, clubId, fichier.data, { canal: 'mail', name: fichier.filename || 'fichier', gmailId, cle: `gmail:${gmailId}:${fichier.filename}` });
    return res.status(codeDe(r)).json(r);
  };
}

// ── Adresse d'import par club ─────────────────────────────────────────────
export const CACHE_ADRESSES_MS = 60_000;
export function annuaire(db: Db, maintenant: () => number = Date.now) {
  let cache: { at: number; map: Record<string, { clubId: string; allow: string[]; status: string }> } | null = null;
  return async (adresse: string) => {
    if (!cache || maintenant() - cache.at >= CACHE_ADRESSES_MS) {
      const C = (await db.get('pulse/ingestConfig')) || {}; const map: Record<string, any> = {};
      for (const [clubId, c] of Object.entries<any>(C)) { const m = c && c.mail; if (m && m.address) map[String(m.address).toLowerCase()] = { clubId, allow: Object.values(m.allow || {}).map(x => String(x).toLowerCase()), status: m.status || 'inactif' }; }
      cache = { at: maintenant(), map };
    }
    return cache.map[String(adresse || '').toLowerCase().trim()] || null;
  };
}
export const adresseDe = (s: string) => ((/<([^>]+)>/.exec(s || '') || [])[1] || s || '').trim().toLowerCase();
export const autorise = (allow: string[], exp: string) => { const a = adresseDe(exp); const dom = a.split('@')[1] || ''; return !!a && allow.some(x => x === a || (x.startsWith('@') && x.slice(1) === dom)); };

export interface MailRelaye { to: string; from: string; origFrom: string; spf: string; dkim: string; subject?: string; messageId: string; size: number; attachments: Array<{ name: string; b64: string }>; links?: string[] }
export function fabriquerReceptionMail(o: { deps: Deps; secret: () => Promise<string | null>; clubDe: (adresse: string) => Promise<{ clubId: string; allow: string[]; status: string } | null>; liens?: (clubId: string, url: string, m: MailRelaye) => Promise<void> }) {
  const maintenant = o.deps.maintenant || Date.now;
  return async (req: any, res: any) => {
    if (req.method !== 'POST') return res.status(405).send('');
    const brut: Buffer = req.rawBody ? Buffer.from(req.rawBody) : Buffer.from(JSON.stringify(req.body || {}));
    const t = String((req.headers || {})['x-fp-time'] || ''); const sig = String((req.headers || {})['x-fp-signature'] || ''); const s = await o.secret();
    if (!s || !/^\d{10,14}$/.test(t) || Math.abs(maintenant() - Number(t)) > 10 * 60_000 || !egal(sig, createHmac('sha256', s).update(t + '.').update(brut).digest('hex'))) return res.status(401).send('');
    if (brut.length > 36 * 1024 * 1024) return res.status(413).send('');
    const m: MailRelaye = JSON.parse(brut.toString('utf8'));
    if (Number(m.size) > TAILLE_MAX) return res.status(413).json({ statut: 'message de plus de 25 Mo' });
    if (m.spf !== 'pass' && m.dkim !== 'pass') return res.status(403).json({ statut: 'SPF et DKIM en échec' });
    const club = await o.clubDe(m.to);
    if (!club || club.status !== 'actif') return res.status(404).json({ statut: 'adresse inconnue' });
    const fichiers = (m.attachments || []).filter(a => EXT_TABULAIRES.test(a.name || '')).map(a => ({ name: String(a.name).slice(0, 160), data: Buffer.from(a.b64 || '', 'base64') }));
    if (!autorise(club.allow, m.origFrom)) {
      const id = nouvelId(maintenant()); const L = [];
      for (const f of fichiers) { const sha = empreinte(f.data); await o.deps.stockage.ecrire(`${club.clubId}/quarantaine/${sha}`, f.data); L.push({ name: f.name, sha, size: f.data.length }); }
      await o.deps.db.update({ [`ingest/${club.clubId}/quarantine/${id}`]: { id, from: adresseDe(m.origFrom).slice(0, 120), subject: String(m.subject || '').slice(0, 160), files: L, links: (m.links || []).length, at: maintenant(), raison: 'expéditeur hors liste blanche' } });
      return res.status(202).json({ statut: 'quarantaine', fichiers: L.length });
    }
    const out: Resultat[] = [];
    for (const f of fichiers) out.push(await ingestFile(o.deps, club.clubId, f.data, { canal: 'mail', name: f.name, cle: `mail:${m.messageId}:${f.name}` }));
    if (!fichiers.length && o.liens) for (const u of (m.links || []).slice(0, 5)) await o.liens(club.clubId, u, m);
    return res.status(200).json({ statut: 'reçu', fichiers: out });
  };
}
