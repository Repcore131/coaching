/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// Fonctions planifiées des résiliations (Europe/Paris) : transports communs (push, e-mail, SMS) et
// clôture automatique la nuit à 2 h 00. Escalade : resEscalate.ts ; résumé du matin : resMorning.ts.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { adminDb } from './services.js';
import { planNuit } from './resPlans.js';
import type { Transports } from './notify.js';

export const COMMUN = { region: 'europe-west1', timeZone: 'Europe/Paris', retryCount: 0, timeoutSeconds: 120 } as const;
export const MAIL_UTILISATEUR = defineSecret('MAIL_UTILISATEUR');
export const MAIL_MOT_DE_PASSE = defineSecret('MAIL_MOT_DE_PASSE');
// Transports réels : Web Push (clés VAPID du serveur), e-mail (messagerie du serveur), SMS mis en file
// dans /fitpulse_sms pour le fournisseur choisi par le club (aucun envoi tant qu'il n'est pas branché).
export async function transports(): Promise<Transports> {
  const db = adminDb();
  process.env.MAIL_UTILISATEUR = MAIL_UTILISATEUR.value(); process.env.MAIL_MOT_DE_PASSE = MAIL_MOT_DE_PASSE.value();
  // @ts-ignore : modules JavaScript copiés dans lib/ par « npm run copier »
  const push: any = await import('../fitpulse-push.mjs'); // @ts-ignore
  const serveur: any = await import('../fitpulse-serveur.mjs');
  const vapid = await db.get('fitpulse_secret/vapid');
  return {
    push: async (uid, msg) => { if (!vapid) return 0; const subs = (await db.get(`pulse_push/${uid}`)) || {}; let n = 0; for (const s of Object.values(subs) as any[]) { const st = await push.sendPush(s, msg, vapid).catch(() => 0); if (st >= 200 && st < 300) n++; } return n; },
    email: async (to, sujet, texte) => { await serveur.envoyerMail(to, { objet: sujet, texte }); },
    sms: async (to, texte) => { await db.update({ [`fitpulse_sms/${Date.now()}_${Math.random().toString(36).slice(2, 8)}`]: { to, text: texte, at: Date.now() } }); },
  };
}
export const resNightly = onSchedule({ ...COMMUN, schedule: '0 2 * * *' }, async () => {
  const db = adminDb(); const S = (await db.get('pulse')) || {}; const maj = planNuit(S, Date.now());
  if (Object.keys(maj).length) await db.update(maj); console.log(JSON.stringify({ fonction: 'resNightly', ecritures: Object.keys(maj).length }));
});
