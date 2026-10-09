/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// setMailSecret (appel de l'appli, manager ou créateur du club) : range le secret de signature de la
// relève dans Secret Manager (FP_MAIL_SECRET_<CLUB>). Aucune copie dans la base : seule la date est notée.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { CLUB_RE, nomSecret, type Db } from './ingestCore.js';
import { adminDb, ecrireSecret } from './services.js';

export interface DepsSecret { db: Db; ecrire(nom: string, valeur: string): Promise<void> }
// Le compte connecté (fp-<clé>@fitpulse-niort.web.app) est-il manager de ce club ?
export async function autoriser(db: Db, email: string | undefined, clubId: string): Promise<string> {
  const m = /^fp-([0-9a-f]{40})@fitpulse-niort\.web\.app$/.exec(email || ''); if (!m) throw new HttpsError('permission-denied', 'Compte inconnu.');
  const uid = await db.get(`pulse_boot/${m[1]}`); const u = uid ? await db.get(`pulse/users/${uid}`) : null;
  if (!u || u.status === 'archived' || !(u.role === 'createur' || (u.role === 'manager' && (u.clubs || []).includes(clubId)))) throw new HttpsError('permission-denied', 'Réservé au manager du club.');
  return String(uid);
}
export function fabriquerSecret(d: DepsSecret) {
  return async (req: { auth?: { token?: { email?: string } } | null; data?: any }) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Connexion requise.');
    const clubId = String(req.data?.clubId || ''); const secret = String(req.data?.secret || '');
    if (!CLUB_RE.test(clubId) || !/^[0-9a-f]{64}$/.test(secret)) throw new HttpsError('invalid-argument', 'Secret ou club invalide.');
    const uid = await autoriser(d.db, req.auth.token?.email, clubId);
    await d.ecrire(nomSecret(clubId), secret);
    await d.db.update({ [`pulse/clubs/${clubId}/mailSecretAt`]: Date.now(), [`pulse/clubs/${clubId}/mailSecretBy`]: uid });
    return { ok: true };
  };
}
export const setMailSecret = onCall({ region: 'europe-west1' }, fabriquerSecret({ db: adminDb(), ecrire: ecrireSecret }) as any);
