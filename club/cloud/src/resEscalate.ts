/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// Escalade des demandes sans réponse : toutes les 15 minutes (Europe/Paris), paliers 4 h, 24 h et 48 h,
// heures calmes de 22 h à 7 h, un message par destinataire et par passage (plan : resPlans.ts).
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { adminDb } from './services.js';
import { planEscalade } from './resPlans.js';
import { envoyer } from './notify.js';
import { COMMUN, MAIL_UTILISATEUR, MAIL_MOT_DE_PASSE, transports } from './resPlanifie.js';

export const resEscalate = onSchedule({ ...COMMUN, schedule: 'every 15 minutes', secrets: [MAIL_UTILISATEUR, MAIL_MOT_DE_PASSE] }, async () => {
  const db = adminDb(); const S = (await db.get('pulse')) || {}; const now = Date.now();
  const { envois, maj } = planEscalade(S, now); if (Object.keys(maj).length) await db.update(maj);
  const n = await envoyer(db, await transports(), envois, 'res_escalade'); console.log(JSON.stringify({ fonction: 'resEscalate', destinataires: n }));
});
