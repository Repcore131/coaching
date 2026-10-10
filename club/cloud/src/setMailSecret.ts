/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// setMailSecret (appel de l'appli, manager ou créateur du club) : range le secret de signature de la
// relève dans Secret Manager (FP_MAIL_SECRET_<CLUB>). Aucune copie dans la base : seule la date est notée.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { CLUB_RE, nomSecret, type Db } from './ingestCore.js';
import { adminDb, ecrireSecret, versionActive } from './services.js';

export interface DepsSecret { db: Db; ecrire(nom: string, valeur: string): Promise<void>; version?(nom: string): Promise<string | null>; maintenant?: () => number }
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
    const uid = await autoriser(d.db, req.auth.token?.email, clubId); const now = d.maintenant ? d.maintenant() : Date.now();
    // « Changer le secret » : la version active reste acceptée 24 h (numéro rangé hors de /pulse, sans la valeur).
    const avant = req.data?.rotation && d.version ? await d.version(nomSecret(clubId)) : null;
    await d.ecrire(nomSecret(clubId), secret);
    const until = avant ? now + 24 * 3600000 : null;
    await d.db.update({ [`pulse/clubs/${clubId}/mailSecretAt`]: now, [`pulse/clubs/${clubId}/mailSecretBy`]: uid, [`pulse/clubs/${clubId}/mailSecretPrevUntil`]: until,
      [`fitpulse_secret/mail/${clubId}`]: avant ? { version: avant, until } : null });
    return { ok: true, precedentJusqua: until };
  };
}
export const setMailSecret = onCall({ region: 'europe-west1' }, fabriquerSecret({ db: adminDb(), ecrire: ecrireSecret, version: versionActive }) as any);
