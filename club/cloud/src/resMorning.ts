/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// Résumé du matin des résiliations : passages de 8 h 00 à 10 h 00 par quart d'heure, envoi à l'heure
// choisie par chaque club (Réglages > Relève des résiliations), une fois par jour (plan : resPlans.ts).
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { adminDb } from './services.js';
import { planMatin } from './resPlans.js';
import { envoyer } from './notify.js';
import { COMMUN, MAIL_UTILISATEUR, MAIL_MOT_DE_PASSE, transports } from './resPlanifie.js';

export const resMorning = onSchedule({ ...COMMUN, schedule: '*/15 8-10 * * *', secrets: [MAIL_UTILISATEUR, MAIL_MOT_DE_PASSE] }, async () => {
  const db = adminDb(); const S = (await db.get('pulse')) || {}; const now = Date.now();
  const { envois, maj } = planMatin(S, now); if (Object.keys(maj).length) await db.update(maj);
  const n = await envoyer(db, await transports(), envois, 'res_matin'); console.log(JSON.stringify({ fonction: 'resMorning', destinataires: n }));
});
