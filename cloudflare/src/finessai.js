// ══ LA FIN D'ESSAI, UN MOMENT DE CONVERSION (10/10/2026) ═══════════════════
//
// Trois notifications, à 18 h 30 (heure de Paris) : trois jours avant la fin
// de l'essai, la veille, et le jour même. Seulement à qui a accepté les
// notifications (envoyerPush ne part que vers un appareil abonné, et respecte
// les préférences et le plafond d'une par jour), jamais à un compte déjà
// payant ou suivi par un coach.
//
// LES CHIFFRES SONT RÉELS. Ils viennent de activite/<compte>.essai, que l'app
// publie (essaiResumeDe, rc-core) : séances terminées, tonnage, records battus,
// semaines actives. Sans séance, un autre message, sans chiffre.
//
// À J-3, si le compte a accepté les e-mails (users/<clé>/consentements/email.accepte === true),
// le serveur envoie l'e-mail de fin d'essai (modèle Brevo
// BREVO_MODELE_FIN_ESSAI, avec le lien de désinscription). Sans accord, après une désinscription, ou sans
// configuration, rien ne part.

import { paris } from './metier.js';
import { envoyerModele, lienDesinscription } from './brevo.js';

const JOUR = 864e5;
export const PALIERS_FIN_ESSAI = Object.freeze({ j3: 3, j1: 1, j0: 0 });
const STATUTS_SANS_RELANCE = Object.freeze(['AUTONOMIE_PREMIUM', 'COACHING_SUIVI']);
const LIRE_MAX = 500;

/**
 * PURE. Le palier du jour : 'j3', 'j1', 'j0', ou null. Compté en JOURS DE
 * CALENDRIER à Paris, entre aujourd'hui et le jour de la fin.
 * @param {number} fin fin de l'essai (ms)
 * @param {number} t maintenant (ms)
 * @returns {'j3'|'j1'|'j0'|null}
 */
export function palierFinEssai(fin, t) {
  const f = Number(fin) || 0;
  if (!(f > 0)) return null;
  const a = Date.parse(paris(t).jour + 'T00:00:00Z'), b = Date.parse(paris(f).jour + 'T00:00:00Z');
  const n = Math.round((b - a) / JOUR);
  for (const k of Object.keys(PALIERS_FIN_ESSAI)) if (PALIERS_FIN_ESSAI[k] === n) return k;
  return null;
}

/**
 * PURE. Le texte de la notification. Les nombres sont ceux de l'essai, et
 * seulement eux ; sans séance, aucun chiffre.
 * @param {{palier:'j3'|'j1'|'j0', prenom?:string, essai?:{s?:number, r?:number, t?:number, w?:number}}} o
 * @returns {{title:string, body:string}}
 */
export function texteFinEssai(o) {
  const e = o.essai || {};
  const s = Math.max(0, Math.floor(Number(e.s) || 0)), r = Math.max(0, Math.floor(Number(e.r) || 0));
  const quand = o.palier === 'j3' ? 'dans 3 jours' : (o.palier === 'j1' ? 'demain' : 'aujourd’hui');
  const pre = o.prenom ? o.prenom + ', ton' : 'Ton';
  if (s > 0) {
    const titre = s + ' séance' + (s > 1 ? 's' : '') + (r > 0 ? ', ' + r + ' record' + (r > 1 ? 's' : '') : '') + ' : on continue ?';
    return { title: titre, body: pre + ' essai se termine ' + quand + '. Tout ce que tu as construit reste à toi.' };
  }
  // RÉSUMÉ PAS ENCORE PUBLIÉ (app pas rouverte depuis la version 1804) : on ne
  // sait pas s'il y a eu des séances, donc ni chiffre ni « première séance ».
  if (!o.essai) return { title: 'Ton essai se termine ' + quand, body: pre + ' programme et tout ce que tu as enregistré restent à toi. Rien n’est effacé.' };
  return {
    title: 'Ton essai se termine ' + quand,
    body: o.palier === 'j0'
      ? 'Ton programme t’attend toujours. Rien n’est effacé.'
      : 'Il est encore temps de faire ta première séance : tout est ouvert.',
  };
}

/** @param {{db:any, M:any, env?:any, fetchImpl?:Function, maintenant?:()=>number}} ctx */
export function creerFinEssai(ctx) {
  const { db, M } = ctx;
  const env = ctx.env || {};
  const now = ctx.maintenant || (() => Date.now());
  const lire = async (c) => (await db.ref(c).get()).val();

  // UN COMPTE : rend ce qui a été fait (pour les tests et le journal).
  async function un(cle, a, t) {
    const fin = Number(a && a.finEssai) || 0;
    const palier = palierFinEssai(fin, t);
    if (!palier) return 'hors_palier';
    if (a.payant) return 'payant';
    const etat = (await lire('worker/fin_essai/' + cle)) || {};
    if (Number(etat[palier]) === fin) return 'deja';
    const [statut, role, fname] = await Promise.all([lire('users/' + cle + '/status'), lire('users/' + cle + '/role'), lire('users/' + cle + '/fname')]);
    if (role === 'coach' || STATUTS_SANS_RELANCE.indexOf(String(statut)) >= 0) {
      await db.ref('worker/fin_essai/' + cle + '/' + palier).set(fin);
      return 'payant';
    }
    const m = texteFinEssai({ palier, prenom: fname || '', essai: a.essai });
    let push = 'non';
    try {
      const r = await M.envoyerPush(cle, Object.assign({ type: 'acces', url: './', tag: 'fin-essai-' + palier }, m), { attendre: false });
      push = r && r.envoye ? 'oui' : String((r && r.raison) || 'non');
    } catch (e) { push = 'erreur'; }
    let mail = 'sans_accord';
    if (palier === 'j3' && (await lire('users/' + cle + '/consentements/email/accepte')) === true) {
      try {
        const email = (await lire('users/' + cle + '/email')) || cle.replace(/,/g, '.');
        if (await lire('desinscrits/' + cle)) mail = 'desinscrit';
        else mail = await envoyerModele(env, ctx.fetchImpl, { email: String(email), prenom: fname || '', modele: env.BREVO_MODELE_FIN_ESSAI,
          params: { DESINSCRIPTION: await lienDesinscription(env, String(email)) } });
      } catch (e) { mail = 'erreur'; }
    }
    // UNE FOIS PAR PALIER ET PAR ESSAI, qu'un appareil ait reçu ou non : le
    // relancer le lendemain doublerait le message du palier suivant.
    await db.ref('worker/fin_essai/' + cle + '/' + palier).set(fin);
    return { palier, push, mail };
  }

  // CHAQUE JOUR À 18 H 30 (planif.js, travail « fin_essai »). Rend false si le
  // budget de requêtes a coupé : le travail reprend à la minute suivante, et
  // worker/fin_essai empêche tout doublon.
  async function quotidien(t0) {
    const t = t0 || now();
    const lot = await db.ref('activite').entre('finEssai', t - JOUR, t + 4 * JOUR, LIRE_MAX);
    const bilan = {};
    for (const cle of Object.keys(lot).sort()) {
      if (typeof M.reste === 'function' && M.reste() < 10) return false;
      try { bilan[cle] = await un(cle, lot[cle], t); } catch (e) { bilan[cle] = 'erreur'; }
    }
    return bilan;
  }

  return { quotidien, un };
}
