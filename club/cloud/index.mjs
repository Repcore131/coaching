/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// ══ FIT PULSE — Cloud Functions planifiées (Europe/Paris, europe-west1) ════
// Mêmes passages que le serveur GitHub Actions (club/outils/*.mjs), pour un
// projet Firebase au forfait Blaze. Les secrets vivent dans Secret Manager :
//   firebase functions:secrets:set GMAIL_CLIENT_ID   (puis GMAIL_CLIENT_SECRET, GMAIL_TOKENS)
// Déploiement : cd club/cloud && npm run copier && firebase deploy --only functions
// Les modules partagés sont copiés dans lib/ par « npm run copier ».
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { GoogleAuth } from 'google-auth-library';

const DB = process.env.FIREBASE_DB_URL || 'https://repcore-sync-default-rtdb.firebaseio.com';
const GMAIL_CLIENT_ID = defineSecret('GMAIL_CLIENT_ID');
const GMAIL_CLIENT_SECRET = defineSecret('GMAIL_CLIENT_SECRET');
const GMAIL_TOKENS = defineSecret('GMAIL_TOKENS');
const COMMUN = { region: 'europe-west1', timeZone: 'Europe/Paris', retryCount: 0, timeoutSeconds: 300 };

// Accès REST à la base avec le compte de service de la fonction (même signature que le serveur).
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/firebase.database', 'https://www.googleapis.com/auth/userinfo.email'] });
const jeton = async () => (await (await auth.getClient()).getAccessToken()).token;
const api = async (tk, chemin, opts = {}) => {
  const r = await fetch(`${DB}/${chemin}`, { ...opts, headers: { authorization: `Bearer ${tk}`, ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${chemin} → ${r.status} ${await r.text()}`);
  return r;
};
const lire = async (tk, chemin) => (await (await api(tk, chemin)).json()) || {};

// 1. Relève des demandes de résiliation : toutes les heures.
export const releveResiliations = onSchedule({ ...COMMUN, schedule: 'every 60 minutes', secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_TOKENS] }, async () => {
  const { passageResiliations, comptesGmail, gmailReel } = await import('./lib/fitpulse-resmail.mjs');
  const tk = await jeton(); const S = await lire(tk, 'pulse.json');
  const comptes = comptesGmail(S, { GMAIL_CLIENT_ID: GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET: GMAIL_CLIENT_SECRET.value(), GMAIL_TOKENS: GMAIL_TOKENS.value() });
  await passageResiliations(api, tk, S, { gmailPour: gmailReel, comptes, force: true });
});
