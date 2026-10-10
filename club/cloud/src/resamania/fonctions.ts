/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
// Déclaration des fonctions Resamania (le code testable est dans client.ts, webhook.ts, reconcile.ts).
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onValueCreated } from 'firebase-functions/v2/database';
import { adminDb, lireSecret } from '../services.js';
import { fabriquerWebhook, relectureOps } from './webhook.js';
import { reconcilierClub } from './reconcile.js';
import { clubsRelies, clientPourClub, nomSecretRsm } from './config.js';
import type { RsmAppel } from './client.js';

// Adresse : https://europe-west1-<projet>.cloudfunctions.net/rsmHook/rsm/hook/{clubId}/{secret}
export const rsmHook = onRequest({ region: 'europe-west1', memory: '256MiB', maxInstances: 10, timeoutSeconds: 10, minInstances: 0 },
  fabriquerWebhook({ db: adminDb(), secret: clubId => lireSecret(nomSecretRsm('HOOK_SECRET', clubId)) }) as any);

// Traitement asynchrone d'un événement reçu (l'objet passe « à relire »).
export const rsmEvenement = onValueCreated({ ref: 'ingest/{clubId}/events/{eventId}', memory: '256MiB' }, async e => {
  await adminDb().update(relectureOps(e.params.clubId, e.params.eventId, e.data.val(), Date.now()));
});

export const rsmReconcile = onSchedule({ region: 'europe-west1', schedule: '15 3 * * *', timeZone: 'Europe/Paris', memory: '512MiB', timeoutSeconds: 540 }, async () => {
  const db = adminDb();
  for (const clubId of await clubsRelies(db)) {
    const appels: RsmAppel[] = []; const client = await clientPourClub(db, clubId, n => lireSecret(n), a => appels.push(a));
    if (client) await reconcilierClub({ db, clubId, client, appels, maintenant: Date.now() });
  }
});
