// ══ L'ESSAI ULTIME, OUVERT PAR LE SERVEUR (01/10/2026) ═══════════════════
//
// Porté de functions/index.js (ouvrirEssai), qui ne sera jamais déployé.
// L'essai vivait dans users/<clé>/essai, que son titulaire réécrit depuis la
// console : remis à zéro, il rouvrait un mois, indéfiniment. Il vit désormais
// dans droits/<clé>, que seul le serveur écrit (majDroits, en transaction).
//
//   ouvrirEssai({auth, data:{jours}})
//     · jours : borné à ESSAI_JOURS (tarifs.json, 30) — le client peut
//       demander moins, jamais plus ; absent, c'est ESSAI_JOURS ;
//     · UNE FOIS PAR COMPTE : droits/<clé>/essaiOuvertLe pris en transaction.
//       Un second appel rend l'échéance existante et n'écrit rien (idempotent) ;
//     · refusé à un coach (400) et à qui a DÉJÀ PAYÉ (409, M.dejaPaye) : un
//       client n'a pas d'essai à consommer ;
//     · écrit {palier:'ultime', echeance, source:'essai', essaiFinit} par
//       majDroits, qui ne réécrit jamais un accès posé à la main.
//
// L'adresse vient du jeton Firebase vérifié (appels.js), jamais des données.

import T from '../../tarifs.json' with { type: 'json' };
import { ErreurAppel } from './appels.js';

const JOUR_MS = 86400000;
export const ESSAI_JOURS = Number(T.essai.jours);
const PALIERS = ['aucun', 'essentielle', 'ultime', 'suivi'];
const cleDe = (email) => String(email || '').toLowerCase().replace(/\./g, ',');

// PURE. Les jours accordés pour une demande : 1 à ESSAI_JOURS.
export function joursEssai(demande) {
  const j = Math.round(Number(demande));
  return Number.isFinite(j) && j > 0 ? Math.min(ESSAI_JOURS, j) : ESSAI_JOURS;
}

// Le palier ouvert à l'instant t par un nœud droits/ (comme l'app le lit).
function palierOuvert(d, t) {
  if (!d) return 'aucun';
  const p = PALIERS.indexOf(String(d.palier)) > 0 ? String(d.palier) : 'aucun';
  return (Number(d.echeance) > 0 && t >= Number(d.echeance)) ? 'aucun' : p;
}

export function creerEssai(ctx) {
  const { db, M } = ctx;
  const now = () => (ctx.maintenant || Date.now)();
  const lire = async (c) => (await db.ref(c).get()).val();

  async function ouvrirEssai({ auth, data }) {
    const cle = cleDe(auth.email), t = now();
    // DÉJÀ OUVERT : l'échéance existante, sans rien réécrire.
    const avant = await lire('droits/' + cle);
    if (avant && Number(avant.essaiOuvertLe) > 0) {
      return { ok: true, deja: true, essaiFinit: Number(avant.essaiFinit) || 0, echeance: Number(avant.essaiFinit) || 0 };
    }
    if (await lire('coachs_registre/' + cle)) throw new ErreurAppel(400, "Un compte coach n'a pas d'essai.");
    if (await M.dejaPaye(cle, avant)) throw new ErreurAppel(409, "Ce compte a déjà payé : l'essai est réservé aux nouveaux comptes.");
    // LA GARDE : deux appels simultanés, un seul ouvre.
    const tx = await db.ref('droits/' + cle + '/essaiOuvertLe').transaction((cur) => (cur ? undefined : t));
    if (!tx.committed) {
      const d = await lire('droits/' + cle);
      return { ok: true, deja: true, essaiFinit: Number(d && d.essaiFinit) || 0, echeance: Number(d && d.essaiFinit) || 0 };
    }
    const fin = t + joursEssai(data && data.jours) * JOUR_MS;
    const d = await M.majDroits(cle, (x) => {
      const ouvert = palierOuvert(x, t);
      // Un palier ultime ou suivi déjà ouvert plus loin : l'essai ne le raccourcit pas.
      if ((ouvert === 'ultime' || ouvert === 'suivi') && (Number(x.echeance) === 0 || Number(x.echeance) >= fin)) return { essaiFinit: fin };
      return { palier: 'ultime', echeance: fin, source: 'essai', essaiFinit: fin };
    });
    return { ok: true, deja: false, essaiFinit: fin, echeance: fin, droits: d || null };
  }

  return { ouvrirEssai };
}
