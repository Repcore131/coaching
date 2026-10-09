/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// graphPoll : relève horaire des boîtes accueil sur Microsoft 365 (Outlook), pour les clubs dont
// mailProvider vaut 'm365'. Jeton d'application (client_credentials, permission Mail.Read limitée à la
// boîte accueil par une stratégie d'accès Exchange : voir docs/m365.md). Même moteur que le script Gmail
// (MAIL_ENGINE), même format de fil, puis la logique interne d'ingestion (aucun appel HTTP).
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { ingerer, validerCorps, type Db, type Fil } from './ingestCore.js';
import { adminDb } from './services.js';

const M365_TENANT_ID = defineSecret('M365_TENANT_ID');
const M365_CLIENT_ID = defineSecret('M365_CLIENT_ID');
const M365_CLIENT_SECRET = defineSecret('M365_CLIENT_SECRET');
const GRAPH = 'https://graph.microsoft.com/v1.0';
type Fetch = typeof fetch;

// Le moteur de détection de l'appli (moteur-mail.js), copié dans lib/app au déploiement.
export function moteur(): any {
  const req = createRequire(import.meta.url);
  for (const p of ['../app/moteur-mail.js', '../../moteur-mail.js', '../../../moteur-mail.js']) { const u = new URL(p, import.meta.url); if (existsSync(u)) return req(u.pathname); }
  throw new Error('moteur-mail.js introuvable');
}
export async function jetonGraph(f: Fetch, tenant: string, id: string, secret: string): Promise<string> {
  const r = await f(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: 'client_credentials', scope: 'https://graph.microsoft.com/.default' }) });
  const j: any = await r.json(); if (!r.ok || !j.access_token) throw new Error('jeton Microsoft refusé (' + r.status + ')'); return j.access_token;
}
const graph = async (f: Fetch, tk: string, url: string) => { const r = await f(url, { headers: { authorization: 'Bearer ' + tk, prefer: 'outlook.body-content-type="text"', ConsistencyLevel: 'eventual' } }); if (!r.ok) throw new Error('Graph ' + r.status); return r.json() as Promise<any>; };

// Une boîte -> les fils retenus. $search ne se combine pas avec $filter sur les messages (limite de Graph) :
// la fenêtre de 45 jours est appliquée sur receivedDateTime après la recherche.
export async function releverBoite(f: Fetch, tk: string, boite: string, regles: any, maintenant = Date.now()): Promise<{ scanned: number; threads: Fil[] }> {
  const M = moteur(); const depuis = maintenant - 45 * 864e5; const b = encodeURIComponent(boite);
  const sel = '$select=id,conversationId,receivedDateTime,from,subject,body,webLink,internetMessageHeaders';
  let url: string | null = `${GRAPH}/users/${b}/messages?$search=${encodeURIComponent('"resiliation OR résiliation OR résilier"')}&$top=50&${sel}`;
  const conv = new Map<string, string>(); let pages = 0;
  while (url && pages++ < 10) { const j = await graph(f, tk, url); for (const m of j.value || []) if (Date.parse(m.receivedDateTime) >= depuis && m.conversationId && !conv.has(m.conversationId)) conv.set(m.conversationId, m.webLink || ''); url = j['@odata.nextLink'] || null; }
  const threads: Fil[] = []; const moi = boite.toLowerCase(); const propres = (regles && regles.ownAddresses || []).map((x: string) => x.toLowerCase());
  for (const [cid, lien] of [...conv].slice(0, 150)) {
    // Tous les messages de la conversation, Éléments envoyés compris (requête sur la boîte entière).
    const j = await graph(f, tk, `${GRAPH}/users/${b}/messages?$filter=${encodeURIComponent(`conversationId eq '${cid.replace(/'/g, "''")}'`)}&$top=50&${sel}`);
    const items = (j.value || []).map((m: any) => { const de = (m.from && m.from.emailAddress) || {}; const email = String(de.address || '').toLowerCase();
      const pub = (m.internetMessageHeaders || []).some((h: any) => /^list-unsubscribe$/i.test(h.name));
      return { at: Date.parse(m.receivedDateTime), out: email === moi || propres.includes(email), from: { name: de.name || '', email }, subject: m.subject || '', pub, body: M.coupeCitation(String((m.body && m.body.content) || '')) }; })
      .sort((x: any, y: any) => x.at - y.at);
    const t = M.analyseFil(cid, items, moi, regles, { link: /^https:\/\//.test(lien) ? lien : null }); if (t) threads.push(t);
  }
  return { scanned: conv.size, threads };
}
// Passage complet : chaque club en Microsoft 365 -> ingestion interne.
export async function passageGraph(db: Db, f: Fetch, ids: { tenant: string; id: string; secret: string }, maintenant = Date.now()) {
  const clubs = (await db.get('pulse/clubs')) || {}; const res: Record<string, unknown> = {};
  const cibles = Object.entries(clubs).filter(([, c]: [string, any]) => c && c.mailProvider === 'm365' && c.m365Mailbox);
  if (!cibles.length) return res; const tk = await jetonGraph(f, ids.tenant, ids.id, ids.secret);
  for (const [clubId, c] of cibles as [string, any][]) {
    const t0 = Date.now(); let corps: any;
    try { const r = await releverBoite(f, tk, c.m365Mailbox, c.mailRules, maintenant); corps = { clubId, mailbox: c.m365Mailbox, runAt: new Date(maintenant).toISOString(), version: 1, scanned: r.scanned, threads: r.threads }; }
    catch (e) { corps = { clubId, mailbox: c.m365Mailbox, runAt: new Date(maintenant).toISOString(), version: 1, scanned: 0, threads: [], error: String((e as Error).message).slice(0, 300) }; }
    const v = validerCorps(corps); if (!v) continue; res[clubId] = await ingerer(db, v.corps, maintenant, v.ignores);
    console.log(JSON.stringify({ fonction: 'graphPoll', clubId, fils: v.corps.threads.length, ms: Date.now() - t0 }));
  }
  return res;
}
export const graphPoll = onSchedule({ region: 'europe-west1', schedule: 'every 60 minutes', timeZone: 'Europe/Paris', timeoutSeconds: 300, secrets: [M365_TENANT_ID, M365_CLIENT_ID, M365_CLIENT_SECRET] }, async () => {
  await passageGraph(adminDb(), fetch, { tenant: M365_TENANT_ID.value(), id: M365_CLIENT_ID.value(), secret: M365_CLIENT_SECRET.value() });
});
