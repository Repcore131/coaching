/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// Fonction HTTPS ingestResiliations (europe-west1) : reçoit la relève signée du script Apps Script.
// POST seulement, 1 Mo au plus ; en-têtes X-FP-Club, X-FP-Time, X-FP-Signature ; secret du club dans
// Secret Manager (FP_MAIL_SECRET_<CLUB>). Réponse 401 sans détail. Écritures par le compte de service.
import { onRequest } from 'firebase-functions/v2/https';
import { CLUB_RE, TAILLE_MAX, ingerer, nomSecret, signatureValide, validerCorps, type Db } from './ingestCore.js';
import { adminDb, lireSecret } from './services.js';

export interface Dependances { secret(clubId: string): Promise<string | null>; db: Db; maintenant?: () => number; journal?: (o: Record<string, unknown>) => void }
type Req = { method: string; headers: Record<string, string | string[] | undefined>; rawBody?: Buffer; body?: unknown };
type Res = { status(c: number): Res; json(o: unknown): void; send(s: string): void; set?(k: string, v: string): Res };

const entete = (req: Req, k: string) => { const v = req.headers[k.toLowerCase()]; return Array.isArray(v) ? v[0] : v || ''; };
export function fabriquerIngestion(d: Dependances) {
  return async (req: Req, res: Res): Promise<void> => {
    const t0 = Date.now(); const maintenant = d.maintenant ? d.maintenant() : Date.now();
    if (req.method !== 'POST') { res.status(405).send(''); return; }
    const brut = req.rawBody || Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? ''));
    if (brut.length > TAILLE_MAX) { res.status(413).send(''); return; }
    const clubId = entete(req, 'X-FP-Club'); const temps = entete(req, 'X-FP-Time'); const sig = entete(req, 'X-FP-Signature');
    const refus = () => res.status(401).send('');
    if (!CLUB_RE.test(clubId)) return refus();
    const secret = await d.secret(clubId).catch(() => null);
    if (!secret || !signatureValide(secret, temps, sig, brut, maintenant)) return refus();
    let corps: unknown; try { corps = JSON.parse(brut.toString('utf8')); } catch { res.status(400).send(''); return; }
    const v = validerCorps(corps); if (!v || v.corps.clubId !== clubId) { res.status(400).send(''); return; }
    const bilan = await ingerer(d.db, v.corps, maintenant, v.ignores);
    (d.journal || (o => console.log(JSON.stringify(o))))({ fonction: 'ingestResiliations', clubId, fils: v.corps.threads.length, ...bilan, ms: Date.now() - t0 });
    res.status(200).json(bilan);
  };
}
export const ingestResiliations = onRequest({ region: 'europe-west1', memory: '256MiB', maxInstances: 5, timeoutSeconds: 60 },
  fabriquerIngestion({ secret: clubId => lireSecret(nomSecret(clubId)), db: adminDb() }) as any);
