// ══ LES CONNEXIONS SIMULTANÉES, COMPTÉES CHAQUE MINUTE (09/10/2026) ═══════
//
// POURQUOI. Plan Spark : la base accepte 100 connexions temps réel
// simultanées. Au-delà, elle refuse les nouvelles. Passer en Blaze (payant à
// l'usage) lève la limite, mais on ne veut pas payer tant que le pic n'a pas
// lieu : il faut donc SAVOIR qu'il approche. Ce module prévient Kevin à 70.
//
// CE QU'IL COMPTE. L'app écrit /presence/<clé> = {t: heure serveur, f: 0|1}
// toutes les 5 minutes, app visible (CLOUD.presence, rc-core). Chaque minute,
// on lit les présences de moins de PRESENCE_FENETRE_MS (requête indexée sur t,
// seules les récentes descendent) et on publie /stats/connexions :
//   · actifs : appareils ouverts dans la fenêtre ;
//   · flux   : ceux qui tiennent le flux temps réel du coach (EventSource),
//              les seules connexions persistantes de l'app ;
//   · estime : l'estimation retenue = actifs. C'est un MAJORANT : chaque
//              appareil actif est compté comme une connexion, même ceux qui
//              ne font que des requêtes REST ponctuelles. Mieux vaut une
//              alerte un peu tôt qu'un refus de connexion sans prévenir.
//
// L'ALERTE. À SEUIL_ALERTE (70) estimées : une notification urgente à Kevin,
// au plus une par heure tant que le niveau tient. Le jour où elle sonne :
// docs/BASCULE-BLAZE.md.
//
// LA PURGE. Une présence de plus de 24 h ne sert plus : effacée chaque nuit.

import { CREATOR_EMAIL } from './metier.js';

export const SEUIL_ALERTE = 70;
export const LIMITE_SPARK = 100;
// La fenêtre : un peu plus que la période d'écriture de l'app (5 min).
export const PRESENCE_FENETRE_MS = 6 * 60000;
export const ALERTE_ESPACEMENT_MS = 3600e3;
export const PURGE_PRESENCE_MS = 24 * 3600e3;
const LOT_PURGE = 200;
const LIRE_MAX = 1000;

/**
 * PURE. Les présences de la fenêtre → les chiffres publiés.
 * @param {Object<string, {t?:number, f?:number}>} presences
 * @param {number} t maintenant
 * @returns {{actifs:number, flux:number, estime:number}}
 */
export function estimerConnexions(presences, t) {
  let actifs = 0, flux = 0;
  for (const k of Object.keys(presences || {})) {
    const p = presences[k];
    const tp = Number(p && p.t) || 0;
    if (tp <= 0 || t - tp > PRESENCE_FENETRE_MS) continue;
    actifs++;
    if (Number(p.f) === 1) flux++;
  }
  return { actifs, flux, estime: actifs };
}

/**
 * PURE. Faut-il prévenir Kevin maintenant ?
 * @param {number} estime connexions estimées
 * @param {number} derniere heure de la dernière alerte (0 : jamais)
 * @param {number} t maintenant
 * @returns {boolean}
 */
export function alerteDue(estime, derniere, t) {
  return Number(estime) >= SEUIL_ALERTE && t - (Number(derniere) || 0) >= ALERTE_ESPACEMENT_MS;
}

/**
 * PURE. Le texte de l'alerte.
 * @param {{estime:number, flux:number}} c
 * @returns {{title:string, body:string}}
 */
export function texteAlerte(c) {
  return {
    title: 'RepCore : ' + c.estime + ' connexions simultanées estimées',
    body: 'Limite du plan gratuit : ' + LIMITE_SPARK + '. ' + c.flux + ' flux temps réel ouverts. '
      + 'Si ça continue, active Blaze : docs/BASCULE-BLAZE.md.',
  };
}

/** @param {{db:any, M:any, maintenant?:()=>number}} ctx */
export function creerAffluence(ctx) {
  const { db, M } = ctx;
  const now = ctx.maintenant || (() => Date.now());
  const cleKevin = CREATOR_EMAIL.replace(/\./g, ',');

  // CHAQUE MINUTE (planif.js, travail « affluence »).
  async function minute(t0) {
    const t = t0 || now();
    const presences = await db.ref('presence').depuis('t', t - PRESENCE_FENETRE_MS, LIRE_MAX);
    const c = estimerConnexions(presences, t);
    const avant = (await db.ref('stats/connexions').get()).val() || {};
    const jour = new Date(t).toISOString().slice(0, 10);
    const pic = avant.pic && avant.pic.jour === jour && Number(avant.pic.v) >= c.estime ? avant.pic : { v: c.estime, le: t, jour };
    let alerteLe = Number(avant.alerteLe) || 0;
    let alerte = false;
    if (alerteDue(c.estime, alerteLe, t)) {
      try {
        const r = await M.envoyerPush(cleKevin, Object.assign({ type: 'acces', url: './', tag: 'affluence' }, texteAlerte(c)), { urgent: true });
        alerte = !!(r && r.envoye);
      } catch (e) { alerte = false; }
      // Noté même sans téléphone joignable : l'écran admin lit stats/connexions.
      alerteLe = t;
    }
    const change = c.estime !== Number(avant.estime) || c.flux !== Number(avant.flux) || pic !== avant.pic || alerteLe !== (Number(avant.alerteLe) || 0);
    if (change) {
      await db.ref('stats/connexions').set({ maj: t, actifs: c.actifs, flux: c.flux, estime: c.estime, seuil: SEUIL_ALERTE,
        limite: LIMITE_SPARK, pic, alerteLe: alerteLe || null });
    }
    return Object.assign({ alerte }, c);
  }

  // CHAQUE NUIT : les présences de plus de 24 h. Rend false si le budget a coupé.
  async function purger(t0) {
    const limite = (t0 || now()) - PURGE_PRESENCE_MS;
    let n = 0;
    for (let tour = 0; tour < 5; tour++) {
      const vieux = await db.ref('presence').jusqua('t', limite, LOT_PURGE);
      const ks = Object.keys(vieux);
      if (!ks.length) return n;
      const maj = {};
      for (const k of ks) maj['presence/' + k] = null;
      await db.ref().update(maj);
      n += ks.length;
      if (ks.length < LOT_PURGE) return n;
    }
    return false;
  }

  return { minute, purger };
}
