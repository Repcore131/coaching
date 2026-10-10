// Rotation du secret de la relève : l'ancien secret reste accepté 24 h, puis il est refusé.
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { fabriquerSecret } from '../../src/setMailSecret.js';
import { fabriquerIngestion } from '../../src/ingestResiliations.js';
import { secretsValides } from '../../src/services.js';
import { MemDb } from './memdb.js';

const CLE = 'a'.repeat(40); const ANCIEN = '1'.repeat(64); const NOUVEAU = '2'.repeat(64); const T0 = Date.UTC(2026, 9, 12, 8);
// Secret Manager simulé : versions numérotées.
const versions: Record<string, string[]> = { FP_MAIL_SECRET_NIORT: [ANCIEN] };
const lire = async (nom: string, v = 'latest') => { const L = versions[nom] || []; return v === 'latest' ? L[L.length - 1] || null : L[Number(v) - 1] || null; };
const db = new MemDb({ pulse_boot: { [CLE]: 'm1' }, pulse: { users: { m1: { id: 'm1', role: 'manager', clubs: ['niort'], status: 'active' } }, clubs: { niort: { id: 'niort' } } } });
let maintenant = T0;
const changer = fabriquerSecret({ db, ecrire: async (nom, val) => { (versions[nom] = versions[nom] || []).push(val); }, version: async nom => String((versions[nom] || []).length), maintenant: () => maintenant });
const ingestion = fabriquerIngestion({ db, secret: c => secretsValides(db, 'FP_MAIL_SECRET_' + c.toUpperCase(), c, maintenant, lire), maintenant: () => maintenant, journal: () => {} });
async function envoi(secret: string) {
  const body = JSON.stringify({ clubId: 'niort', mailbox: 'accueil@club.fr', runAt: '', version: 1, scanned: 0, threads: [] }); const t = String(maintenant);
  let code = 0; const res: any = { status(c: number) { code = c; return res; }, json() {}, send() {} };
  await ingestion({ method: 'POST', headers: { 'x-fp-club': 'niort', 'x-fp-time': t, 'x-fp-signature': createHmac('sha256', secret).update(t + '.' + body).digest('hex') }, rawBody: Buffer.from(body) }, res);
  return code;
}
describe('Changer le secret', () => {
  it('ancien secret accepté 24 h, puis refusé ; le nouveau toujours accepté', async () => {
    expect(await envoi(ANCIEN)).toBe(200);
    const r: any = await changer({ auth: { token: { email: `fp-${CLE}@fitpulse-niort.web.app` } }, data: { clubId: 'niort', secret: NOUVEAU, rotation: true } });
    expect(r.precedentJusqua).toBe(T0 + 24 * 3600000);
    expect(await db.get('pulse/clubs/niort/mailSecretPrevUntil')).toBe(T0 + 24 * 3600000);
    expect(JSON.stringify(await db.get('pulse'))).not.toContain(ANCIEN);
    maintenant = T0 + 23 * 3600000; expect(await envoi(ANCIEN)).toBe(200); expect(await envoi(NOUVEAU)).toBe(200);
    maintenant = T0 + 25 * 3600000; expect(await envoi(ANCIEN)).toBe(401); expect(await envoi(NOUVEAU)).toBe(200);
  });
});
