// ══ LA MINUTE DU SERVEUR LÉGER ═══════════════════════════════════════════
//
// Cloudflare réveille le Worker chaque minute (une seule tâche programmée :
// le plan gratuit en autorise cinq). À chaque réveil, avec un BUDGET de
// requêtes (le plan gratuit en permet 50 par exécution, on s'arrête avant) :
//
//   1. les événements déposés par l'app (/evenements), un par un ;
//   2. les travaux du jour dont l'heure est passée (heure de Paris), repris
//      là où le réveil précédent s'est arrêté : /worker/jobs/<nom> garde le
//      jour, le curseur et, pour la rareté des badges, les comptes en cours.
//
// UN TRAVAIL MANQUÉ SE RATTRAPE : la condition est « l'heure est passée
// aujourd'hui et ce n'est pas fini », pas « il est exactement 18 h 00 ».

import { paris } from './metier.js';

export const BUDGET = 38;          // requêtes par réveil (plafond Cloudflare : 50)
const apres = (p, h, m) => p.heure * 60 + p.minute >= h * 60 + m;

export function travaux(M) {
  return [
    { nom: 'stats_badges', quand: (p) => apres(p, 3, 17), cles: () => M.coachsEtUsers(), un: (c, t, acc) => M.statsBadgesUn(c, acc), fin: M.statsBadgesFin, cout: 3 },
    { nom: 'ambassadeurs', quand: (p) => apres(p, 6, 20), une: M.ambassadeursQuotidien },
    // Pas en heures calmes : ce serait relire les messages mis de côté pour la
    // nuit et les jeter au lieu de les envoyer le lendemain à 8 h 05.
    { nom: 'attente', quand: (p) => apres(p, 8, 5) && p.heure < 21, une: M.apresHeuresCalmes },
    { nom: 'defis', quand: (p) => apres(p, 9, 0), cles: () => M.coachsAvecCanal(), un: (c, t) => M.defisQuotidienCoach(c, t), cout: 8 },
    { nom: 'serie', quand: (p) => p.joursem === 4 && apres(p, 18, 0), cles: () => M.abonnes(), un: M.planifies.serie, cout: 12 },
    { nom: 'bilan', quand: (p) => p.joursem === 6 && apres(p, 10, 0), cles: () => M.abonnes(), un: M.planifies.bilan, cout: 12 },
    { nom: 'wrapped', quand: (p) => p.date === 1 && apres(p, 10, 0), cles: () => M.abonnes(), un: M.planifies.wrapped, cout: 10 },
    { nom: 'badge', quand: (p) => p.joursem === 0 && apres(p, 17, 0), cles: () => M.abonnes(), un: M.planifies.badge, cout: 10 },
  ];
}

/**
 * Un réveil. `compteur()` rend le nombre de requêtes déjà émises dans ce
 * réveil (base ET services de push).
 */
export async function minute({ db, M, compteur, maintenant }) {
  const t = (maintenant || Date.now)();
  const p = paris(t);
  const reste = () => BUDGET - compteur();
  const bilan = { evenements: 0, travaux: {} };

  // 1. LES ÉVÉNEMENTS. Relus un par un et SUPPRIMÉS une fois traités — même
  //    en échec : un événement qui planterait à chaque réveil bloquerait tout.
  const ids = await db.ref('evenements').shallow();
  ids.sort();
  for (const id of ids) {
    if (reste() < 12) break;
    const e = (await db.ref('evenements/' + id).get()).val();
    try {
      if (e && e.type === 'parrainage_demande') {
        const d = (await db.ref('parrainage/demandes/' + e.par).get()).val();
        if (d && !d.etat) await M.parrainageDemande(e.par, d);
      } else if (e && e.type === 'ambassadeur_demande') {
        const d = (await db.ref('ambassadeurs_demandes/' + e.par).get()).val();
        if (d && !d.etat) await M.ambassadeurDemande(e.par, d);
      } else if (e) {
        await M.evenement(e);
      }
    } catch (err) { bilan.erreur = String(err && err.message || err).slice(0, 200); }
    await db.ref('evenements/' + id).remove();
    bilan.evenements++;
  }

  // 2. LES TRAVAUX DU JOUR.
  for (const w of travaux(M)) {
    if (!w.quand(p) || reste() < 6) continue;
    const ref = db.ref('worker/jobs/' + w.nom);
    let etat = (await ref.get()).val();
    if (!etat || etat.jour !== p.jour) etat = { jour: p.jour, curseur: 0, fini: false, acc: {} };
    if (etat.fini) continue;
    // Firebase ne garde pas un objet vide : relu, il revient null.
    if (!etat.acc || typeof etat.acc !== 'object') etat.acc = {};
    if (w.une) {
      await w.une(t);
      etat.fini = true;
    } else {
      const cles = (await w.cles()).sort();
      let i = Number(etat.curseur) || 0;
      while (i < cles.length && reste() >= (w.cout || 10) + 2) {
        try { await w.un(cles[i], t, etat.acc); } catch (err) { bilan.erreur = String(err && err.message || err).slice(0, 200); }
        i++;
      }
      etat.curseur = i;
      if (i >= cles.length) {
        if (w.fin) await w.fin(etat.acc || {});
        etat.fini = true;
      }
    }
    bilan.travaux[w.nom] = etat.fini ? 'fini' : etat.curseur;
    await ref.set(etat);
  }
  bilan.requetes = compteur();
  return bilan;
}
