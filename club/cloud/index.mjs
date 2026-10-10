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

process.env.FITPULSE_APP_DIR = './app/'; // code de l'appli copié par « npm run copier »
process.env.TZ = 'Europe/Paris';
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

// 2. Exports Resamania arrivés seuls (boîte dédiée ou dossier Drive) : chaque heure de 6 h à 22 h.
//    Les fichiers sont déposés dans Cloud Storage /imports/{clubId}/{date}/ (bucket par défaut du projet).
export const importsAutomatiques = onSchedule({ ...COMMUN, schedule: 'every 1 hours from 06:00 to 22:00', memory: '1GiB', secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_TOKENS] }, async () => {
  const { passageImports, sourcesReelles, stockerGcs } = await import('./lib/fitpulse-autoimport.mjs');
  const tk = await jeton(); const S = await lire(tk, 'pulse.json');
  const env = { GMAIL_CLIENT_ID: GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET: GMAIL_CLIENT_SECRET.value(), GMAIL_TOKENS: GMAIL_TOKENS.value() };
  const bucket = process.env.FITPULSE_BUCKET || `${process.env.GCLOUD_PROJECT}.appspot.com`;
  await passageImports(api, tk, S, { sources: sourcesReelles(S, env), force: true, stocker: (club, date, name, buf) => stockerGcs(tk, bucket, club, date, name, buf) });
});

// 3. Brief du matin : 7 h 30 heure de Paris, du lundi au samedi (changement d'heure géré par le fuseau).
//    L'envoi d'e-mail passe par la même messagerie que le serveur (secrets MAIL_UTILISATEUR, MAIL_MOT_DE_PASSE).
const MAIL_UTILISATEUR = defineSecret('MAIL_UTILISATEUR');
const MAIL_MOT_DE_PASSE = defineSecret('MAIL_MOT_DE_PASSE');
export const briefDuMatin = onSchedule({ ...COMMUN, schedule: '30 7 * * 1-6', secrets: [MAIL_UTILISATEUR, MAIL_MOT_DE_PASSE] }, async () => {
  process.env.MAIL_UTILISATEUR = MAIL_UTILISATEUR.value(); process.env.MAIL_MOT_DE_PASSE = MAIL_MOT_DE_PASSE.value();
  const { passageBrief } = await import('./lib/fitpulse-brief.mjs'); const { envoyerMail } = await import('./lib/fitpulse-serveur.mjs');
  const tk = await jeton(); const S = await lire(tk, 'pulse.json');
  await passageBrief(api, tk, S, envoyerMail, { force: true });
});

// 4. Double authentification TOTP (multi-salles) : appelées par l'appli (totp.js).
//    Le secret reste dans /orgs_secret ; un code juste pose mfaAt = auth_time sur le jeton.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
const admin = async () => { const { initializeApp, getApps } = await import('firebase-admin/app'); if (!getApps().length) initializeApp({ databaseURL: DB }); const { getDatabase } = await import('firebase-admin/database'); const { getAuth } = await import('firebase-admin/auth'); return { rtdb: getDatabase(), auth: getAuth() }; };
async function contexteTotp(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Connexion requise.');
  const m = /^fp-([0-9a-f]{40})@/.exec(req.auth.token.email || ''); if (!m) throw new HttpsError('permission-denied', 'Compte inconnu.');
  const { rtdb, auth } = await admin(); const boot = (await rtdb.ref(`orgs_boot/${m[1]}`).get()).val();
  if (!boot || !boot.org || !boot.uid) throw new HttpsError('permission-denied', 'Compte inconnu.');
  const u = (await rtdb.ref(`orgs/${boot.org}/data/users/${boot.uid}`).get()).val() || {};
  const db = { lire: async p => (await rtdb.ref(p).get()).val(), ecrire: async (p, v) => rtdb.ref(p).set(v) };
  return { db, org: boot.org, uid: boot.uid, compte: u.email || boot.uid, auth, authUid: req.auth.uid, authTime: req.auth.token.auth_time };
}
const appel = fn => async req => { try { return await fn(await contexteTotp(req), req.data || {}); } catch (e) { if (e instanceof HttpsError) throw e; throw new HttpsError(e.code || 'internal', e.message); } };
export const totpEtat = onCall({ region: 'europe-west1' }, appel(async c => (await import('./lib/fitpulse-totp.mjs')).etat(c)));
export const totpInscrire = onCall({ region: 'europe-west1' }, appel(async c => (await import('./lib/fitpulse-totp.mjs')).inscrire(c)));
export const totpValider = onCall({ region: 'europe-west1' }, appel(async (c, d) => (await import('./lib/fitpulse-totp.mjs')).valider({ ...c, code: d.code,
  fixer: async claims => { const u = await c.auth.getUser(c.authUid); await c.auth.setCustomUserClaims(c.authUid, { ...(u.customClaims || {}), ...claims }); } })));

// 5. Résiliations (TypeScript, compilé dans lib/ts par « npm run build ») : relève signée, secret,
//    Microsoft 365, escalade (15 min), résumé du matin, clôture de nuit (2 h).
//    ingestResiliations (HTTPS, signée), setMailSecret (appel de l'appli), graphPoll (Microsoft 365).
export { ingestResiliations, setMailSecret, graphPoll, resEscalate, resMorning, resNightly } from './lib/ts/index.js';
