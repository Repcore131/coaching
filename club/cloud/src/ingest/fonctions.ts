/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
// Déclaration des fonctions d'ingestion (le code testable est dans core.ts, reception.ts, drive.ts).
//   ingestRecevoir  HTTP   script Gmail (multipart, X-Club-Token)
//   ingestMail      HTTP   récepteur e-mail (email-worker/, signé HMAC)
//   ingestWorker    HTTP   cible des tâches Cloud Tasks (une file par club)
//   ingestDrive     planifiée toutes les 10 minutes de 6 h à 22 h
//   ingestPurge     planifiée chaque nuit (rapports 13 mois, boîte 30 jours)
//   ingestRejouer   écriture de pulse/rsm/aliases/{clé} : lignes en attente rejouées
//   ingestJeton     appel de l'appli (manager) : jeton du script Gmail, montré une seule fois
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onValueWritten } from 'firebase-functions/v2/database';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { GoogleAuth } from 'google-auth-library';
import { adminDb, lireSecret, ecrireSecret } from '../services.js';
import { autoriser } from '../setMailSecret.js';
import { processIngest, rejouerAttentes, purgeRapports, type Deps, type Moteur } from './core.js';
import { stockageGcs, fileCloudTasks, alerteManagers, REGION } from './gcp.js';
import { fabriquerReceptionScript, fabriquerReceptionMail, annuaire } from './reception.js';
import { releverDrive, driveReel, DOSSIER_RE } from './drive.js';

const nomJeton = (c: string) => `FP_INGEST_TOKEN_${c.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
const projet = () => process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
const urlWorker = () => process.env.FITPULSE_INGEST_WORKER_URL || `https://${REGION}-${projet()}.cloudfunctions.net/ingestWorker`;
let moteur: Moteur | null = null;
async function leMoteur(): Promise<Moteur> {
  if (moteur) return moteur;
  // @ts-ignore module JavaScript copié dans lib/ par « npm run copier »
  const { creerMoteur } = await import('../../fitpulse-moteur.mjs');
  process.env.FITPULSE_APP_DIR = process.env.FITPULSE_APP_DIR || './app/';
  moteur = creerMoteur({ lireEtat: async () => (await adminDb().get('pulse')) || {} }) as Moteur;
  return moteur;
}
function deps(): Deps {
  const db = adminDb();
  return { db, stockage: stockageGcs(), file: fileCloudTasks({ urlWorker: urlWorker(), secret: async () => (await lireSecret('FP_INGEST_TACHE')) || '' }), alerte: alerteManagers(db) };
}
const COMMUN = { region: REGION, memory: '1GiB' as const, timeoutSeconds: 300 };

export const ingestRecevoir = onRequest({ ...COMMUN, maxInstances: 10 }, fabriquerReceptionScript({ deps: deps(), jeton: c => lireSecret(nomJeton(c)) }) as any);
export const ingestMail = onRequest({ ...COMMUN, maxInstances: 10 }, fabriquerReceptionMail({ deps: deps(), secret: () => lireSecret('FP_INGEST_MAIL_SECRET'), clubDe: annuaire(adminDb()) }) as any);

export const ingestWorker = onRequest({ ...COMMUN, memory: '2GiB', timeoutSeconds: 540, maxInstances: 20 }, async (req: any, res: any) => {
  const attendu = (await lireSecret('FP_INGEST_TACHE')) || ''; const donne = String(req.headers['x-fp-tache'] || '');
  if (!attendu || Buffer.byteLength(donne) !== Buffer.byteLength(attendu) || !timingSafeEqual(Buffer.from(donne), Buffer.from(attendu))) return res.status(403).send('');
  const t = req.body && typeof req.body === 'object' ? req.body : JSON.parse(Buffer.from(req.rawBody || '').toString('utf8') || '{}');
  const statut = await processIngest({ ...deps(), moteur: await leMoteur() }, { clubId: String(t.clubId), id: String(t.id), essai: Number(t.essai) || 1 });
  res.status(200).json({ statut }); // jamais d'échec HTTP : les essais sont gérés par processIngest
});

const authDrive = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive'] });
export const ingestDrive = onSchedule({ ...COMMUN, schedule: 'every 10 minutes from 06:00 to 22:00', timeZone: 'Europe/Paris' }, async () => {
  const d = deps(); const C = (await d.db.get('pulse/ingestConfig')) || {};
  const drive = driveReel(async () => (await (await authDrive.getClient()).getAccessToken()).token as string);
  for (const [clubId, c] of Object.entries<any>(C)) if (c && c.drive && c.drive.status === 'actif' && DOSSIER_RE.test(c.drive.folderId || '')) await releverDrive({ ...d, drive }, clubId, c.drive.folderId).catch(() => null);
});

export const ingestPurge = onSchedule({ ...COMMUN, schedule: '30 4 * * *', timeZone: 'Europe/Paris' }, async () => {
  const db = adminDb(); for (const clubId of Object.keys((await db.get('ingest')) || {})) await purgeRapports(db, clubId, Date.now());
});

export const ingestRejouer = onValueWritten({ ref: 'pulse/rsm/aliases/{cle}', memory: '1GiB' }, async e => {
  const uid = e.data.after.val(); if (typeof uid !== 'string') return;
  const db = adminDb(); const d = { ...deps(), moteur: await leMoteur() };
  for (const clubId of Object.keys((await db.get('ingest')) || {})) await rejouerAttentes(d, clubId, e.params.cle, uid);
});

export const ingestJeton = onCall({ region: REGION }, async (req: any) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Connexion requise.');
  const clubId = String(req.data?.clubId || ''); if (!/^[A-Za-z0-9_-]{1,60}$/.test(clubId)) throw new HttpsError('invalid-argument', 'Club invalide.');
  const uid = await autoriser(adminDb(), req.auth.token?.email, clubId);
  const jeton = randomBytes(24).toString('base64url'); await ecrireSecret(nomJeton(clubId), jeton);
  await adminDb().update({ [`pulse/clubs/${clubId}/ingestTokenAt`]: Date.now(), [`pulse/clubs/${clubId}/ingestTokenBy`]: uid });
  return { jeton }; // montré une seule fois, à coller dans les propriétés du script Gmail
});
