// Client Resamania (429 puis 200, jeton en cache), webhook (mauvais secret : 404 sans écriture), réconciliation.
import { describe, it, expect } from 'vitest';
import { fabriquerClient, RsmQuotaDepasse, cheminAnonyme, attenteReset } from '../../src/resamania/client.js';
import { fabriquerWebhook, relectureOps } from '../../src/resamania/webhook.js';
import { reconcilierClub } from '../../src/resamania/reconcile.js';
import { journalOps } from '../../src/resamania/config.js';
import { MemDb } from './memdb.js';

const identite = { gatewayBase: 'gateway.example.test/resa2', clientToken: 'demo', clubIri: '/demo/clubs/1', networkNodeIri: '/demo/network_nodes/2' };
const secrets = async () => ({ apiKey: 'K', clientId: 'I', clientSecret: 'S' });
const rep = (status: number, corps: any = {}, h: Record<string, string> = {}) => ({ status, ok: status >= 200 && status < 300, headers: { get: (n: string) => h[n.toLowerCase()] ?? null }, json: async () => corps, text: async () => JSON.stringify(corps) });
function faux(suite: Array<ReturnType<typeof rep>>) {
  const appels: Array<{ url: string; init: any }> = [];
  const fetch = async (url: string, init: any) => { appels.push({ url, init }); if (url.endsWith('/oauth/v2/token')) return rep(200, { access_token: 'JWT', expires_in: 3600 }); return suite.shift() || rep(500); };
  return { fetch, appels };
}

describe('client Resamania', () => {
  it('429 puis 200 : attend 1 s (ou X-Rate-Limit-Reset si plus long) puis réussit, en-têtes complets', async () => {
    const f = faux([rep(429, {}, { 'x-rate-limit-reset': '0' }), rep(200, { 'hydra:member': [] })]); const attentes: number[] = []; const journal: any[] = [];
    const c = fabriquerClient({ identite, secrets, fetch: f.fetch as any, dormir: async ms => { attentes.push(ms); }, maintenant: () => 1_000_000, journal: a => journal.push(a) });
    await c.get('contacts/123', { 'updatedAt[after]': '2026-10-09' });
    expect(attentes).toEqual([1000]);
    const g = f.appels.filter(a => !a.url.endsWith('/token'));
    expect(g[0].url).toBe('https://gateway.example.test/resa2/demo/contacts/123?updatedAt%5Bafter%5D=2026-10-09');
    expect(g[1].init.headers).toMatchObject({ authorization: 'Bearer JWT', 'x-gravitee-api-key': 'K', 'x-user-club-id': '/demo/clubs/1', 'x-user-network-node-id': '/demo/network_nodes/2' });
    expect(journal).toEqual([{ chemin: '/contacts/:id', status: 200, ms: 0, essais: 2 }]);
  });
  it('recul exponentiel 1, 2, 4, 8 s puis abandon au 5e essai avec une erreur typée', async () => {
    const f = faux([rep(429), rep(429), rep(429), rep(429), rep(429), rep(200)]); const attentes: number[] = [];
    const c = fabriquerClient({ identite, secrets, fetch: f.fetch as any, dormir: async ms => { attentes.push(ms); } });
    await expect(c.get('incidents')).rejects.toBeInstanceOf(RsmQuotaDepasse);
    expect(attentes).toEqual([1000, 2000, 4000, 8000]);
    expect(f.appels.filter(a => !a.url.endsWith('/token')).length).toBe(5);
  });
  it('X-Rate-Limit-Reset plus long que le recul : on attend jusqu’au reset', async () => {
    const t = 1_700_000_000_000; const f = faux([rep(429, {}, { 'x-rate-limit-reset': String(t + 5000) }), rep(200, [])]); const attentes: number[] = [];
    const c = fabriquerClient({ identite, secrets, fetch: f.fetch as any, dormir: async ms => { attentes.push(ms); }, maintenant: () => t });
    await c.get('sales'); expect(attentes).toEqual([5000]); expect(attenteReset('3', 0)).toBe(3000);
  });
  it('jeton client_credentials gardé jusqu’à expiration moins 60 s', async () => {
    let t = 0; const f = faux([rep(200, []), rep(200, []), rep(200, [])]);
    const c = fabriquerClient({ identite, secrets, fetch: f.fetch as any, dormir: async () => {}, maintenant: () => t });
    await c.get('sales'); t = 3600_000 - 61_000; await c.get('sales'); t = 3600_000 - 59_000; await c.get('sales');
    const jetons = f.appels.filter(a => a.url.endsWith('/oauth/v2/token'));
    expect(jetons.length).toBe(2); expect(jetons[0].init.body).toBe('grant_type=client_credentials&client_id=I&client_secret=S');
    expect(cheminAnonyme('/contacts/42/subscriptions?x=1')).toBe('/contacts/:id/subscriptions');
  });
});

describe('webhook Resamania', () => {
  const SECRET = 'a'.repeat(32);
  const res = () => { const r: any = { code: 0, status(c: number) { r.code = c; return r; }, json() { return r; }, send() { return r; } }; return r; };
  it('mauvais secret : 404 sans aucune écriture', async () => {
    const db = new MemDb(); const h = fabriquerWebhook({ db, secret: async c => (c === 'niort' ? SECRET : null) });
    const r = res(); await h({ method: 'POST', path: `/rsm/hook/niort/${'b'.repeat(32)}`, headers: {}, body: { event: 'contact.created', data: {} } }, r);
    expect(r.code).toBe(404); expect(db.data).toEqual({});
    const r2 = res(); await h({ method: 'POST', path: `/rsm/hook/autre/${SECRET}`, headers: {}, body: { event: 'contact.created' } }, r2); // club sans secret
    expect(r2.code).toBe(404);
  });
  it('bon secret : événement brut écrit, 200 en moins de 300 ms, puis mis à relire', async () => {
    const db = new MemDb(); const h = fabriquerWebhook({ db, secret: async c => (c === 'niort' ? SECRET : null) });
    const r = res(); const t0 = Date.now();
    await h({ method: 'POST', path: `/rsm/hook/niort/${SECRET}`, headers: { 'x-user-club-id': '/demo/clubs/1' }, body: { event: 'contact.updated', data: { object: { contactId: '/demo/contacts/77', clubId: '/demo/clubs/1' } } } }, r);
    expect(r.code).toBe(200); expect(Date.now() - t0).toBeLessThan(300);
    const [[id, ev]] = Object.entries(db.data.ingest.niort.events) as any;
    expect(ev).toMatchObject({ event: 'contact.updated', clubHeader: '/demo/clubs/1', status: 'reçu' });
    await db.update(relectureOps('niort', id, ev, 5));
    expect(db.data.ingest.niort.aRelire.contacts['77']).toBe(5); expect(db.data.ingest.niort.events[id].status).toBe('à relire');
  });
});

describe('réconciliation nocturne', () => {
  it('contacts modifiés depuis 26 h et incidents ouverts, journal sans donnée personnelle', async () => {
    const db = new MemDb(); const vus: any[] = [];
    const client = { async *liste(chemin: string, q: any) { vus.push([chemin, q]); if (chemin === 'contacts') yield { '@id': '/demo/contacts/9', familyName: 'Durand' }; } };
    const t = Date.UTC(2026, 9, 10, 1, 15);
    const n = await reconcilierClub({ db, clubId: 'niort', client, appels: [{ chemin: '/contacts', status: 200, ms: 120, essais: 1 }], maintenant: t });
    expect(n).toEqual({ contacts: 1, incidents: 0, erreurs: 0 });
    expect(vus[0]).toEqual(['contacts', { 'updatedAt[after]': new Date(t - 26 * 3600_000).toISOString() }]);
    const log = JSON.stringify(db.data.ingest.niort.log); expect(log).toContain('/contacts'); expect(log).not.toContain('Durand');
    expect(Object.keys(journalOps('x', [], t))).toEqual([]);
  });
});
