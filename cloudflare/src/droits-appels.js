// ══ LES DROITS NE S'ÉCRIVENT PLUS DEPUIS L'APP (30/09/2026) ═══════════════
//
// Le palier d'un athlète, le rôle de coach et le plan d'un coach se lisaient
// dans users/<clé>, que son titulaire écrit comme il veut : un PUT
// status:'COACHING_SUIVI' ouvrait tout. database.rules.json gèle désormais ces
// champs (seul le créateur les change), et c'est ICI, avec le compte de
// service, qu'ils s'écrivent :
//
//   redeemCode({code})        un code d'accès de coach → droits/<athlète> suivi
//   (ouvrirEssai              l'essai Ultime : essai.js)
//   devenirCoach({invitation}) une invitation du créateur (ou une place Libre)
//                             → coachs_registre/<clé> et users/<clé>/role
//   prolongerCode({code})     le coach a prolongé un code déjà consommé
//
// Chaque appel est authentifié (appels.js : jeton Firebase vérifié) ; l'adresse
// vient du jeton, jamais des données envoyées.

import { ErreurAppel } from './appels.js';
import { CREATOR_EMAIL, MONTH_MS } from './metier.js';
import { estCreateur } from './createur.js';

export const CODE_MOIS_MAX_AFFILIE = 12;      // = CODE_MOIS_MAX_AFFILIE de l'app
export const LIBRE_MAX = 200;                 // = LIBRE_MAX de l'app
const CODE_RE = /^RC-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const PALIERS = ['aucun', 'essentielle', 'ultime', 'suivi'];
export const cleDe = (email) => String(email || '').toLowerCase().replace(/\./g, ',');
export const CLE_CREATEUR = cleDe(CREATOR_EMAIL);

// Le palier ouvert à l'instant t par un nœud droits/ (comme l'app le lit).
function palierOuvert(d, t) {
  if (!d) return 'aucun';
  const p = PALIERS.indexOf(String(d.palier)) > 0 ? String(d.palier) : 'aucun';
  return (Number(d.echeance) > 0 && t >= Number(d.echeance)) ? 'aucun' : p;
}

// PURE. La fin d'accès qu'un code ouvre, à l'instant t. Le plafond est celui
// du SERVEUR : 12 mois pour tout code qui n'est pas du créateur, quoi que le
// code dise de lui-même (grantedBy s'écrit à la main dans un code forgé).
export function finDuCode(code, cleCoach, t) {
  const createur = cleCoach === CLE_CREATEUR;
  const max = createur ? Infinity : CODE_MOIS_MAX_AFFILIE;
  const m = Number(code && code.months);
  const plafond = createur ? Infinity : t + CODE_MOIS_MAX_AFFILIE * MONTH_MS;
  if (m > 0) return Math.min(t + Math.min(m, max) * MONTH_MS, plafond);
  const exp = Number(code && code.expiry) || 0;
  return exp > t ? Math.min(exp, plafond) : 0;
}

// ══ LE PROGRAMME DE DÉPART D'UNE INVITATION (05/10/2026) ═════════════════════
// Un coach qui invite en lot peut choisir un modèle : le code porte alors
// programmeModeleId. L'athlète, lui, NE PEUT PAS lire le modèle — il vit dans
// users/<coach>/coachPrograms, que les règles ne lui ouvrent pas. C'est donc
// ici, à la consommation du code, avec le compte de service, qu'il est posé :
// au moment même où l'app attend la réponse, et non au passage suivant de la
// file /evenements (l'athlète aurait vu « Programme en cours de création » à
// sa première ouverture). Mêmes règles que _assignerModele dans l'app.
const ID_MODELE_RE = /^[A-Za-z0-9_-]{1,64}$/;
// PURE. La cadence portée par un code, bornée comme la règle users/bilanCadence.
export function cadenceValide(x) {
  if (!x || typeof x !== 'object') return null;
  const f = Number(x.freq), j = Number(x.jour);
  return [1, 2, 4].indexOf(f) >= 0 && Number.isInteger(j) && j >= 0 && j <= 6 ? { freq: f, jour: j } : null;
}
const listeDe = (x) => (Array.isArray(x) ? x : (x && typeof x === 'object' ? Object.values(x) : [])).filter(Boolean);
// PURE. Les séances garnies d'une version (comme _cplSeancesPleines).
const pleines = (p, g) => listeDe(p && p[g === 'F' ? 'sessions_F' : 'sessions_H'])
  .filter((s) => s && s.active && Array.isArray(s.exercises) && s.exercises.length);
// PURE. Une configuration RÉELLE (= _configReelle de l'app) : une séance
// active, garnie, et qui n'est ni un essai ni la Fondation posée d'office.
export function configReelle(sc) {
  return listeDe(sc).some((s) => s.active && Array.isArray(s.exercises) && s.exercises.length && !s._essai && !s._foundation);
}
/**
 * PURE. Le programme qu'un modèle du coach donne à un athlète, ou null.
 * Le public du modèle tranche (progGenreServi) : un modèle « Pour les
 * hommes » ne livre que sa version H, quel que soit le genre de l'athlète.
 * @param {any} progs     users/<coach>/coachPrograms (tableau, ou objet Firebase)
 * @param {string} id     programmeModeleId du code
 * @param {string} genre  le genre de l'athlète ('F' ou autre)
 * @param {number} t      l'heure
 */
export function programmeDuModele(progs, id, genre, t) {
  if (!ID_MODELE_RE.test(String(id || ''))) return null;
  const p = listeDe(progs).find((x) => String(x.id || '') === String(id));
  if (!p) return null;
  const v = p.publicVise;
  const pub = (v === 'H' || v === 'F' || v === 'HF') ? v
    : (pleines(p, 'H').length && !pleines(p, 'F').length) ? 'H'
    : (pleines(p, 'F').length && !pleines(p, 'H').length) ? 'F' : 'HF';
  const g = (pub === 'H' || pub === 'F') ? pub : (genre === 'F' ? 'F' : 'H');
  // Copie profonde, et marquée publiée (_marquerCommePublie) : un essai ne
  // se glisse pas dans le programme du coach.
  const sc = JSON.parse(JSON.stringify(listeDe(p[g === 'F' ? 'sessions_F' : 'sessions_H'])));
  sc.forEach((s) => { delete s._essai; delete s._foundation; });
  if (!configReelle(sc)) return null;
  return { sessions_config: sc, assignedProgramName: String(p.name || 'Programme').slice(0, 120),
    assignedProgramAt: t, assignedProgramId: String(p.id), assignedProgramGenre: g,
    assignedProgramVersion: Number(p.majAt) || Number(p.createdAt) || 0 };
}

export function creerAppelsDroits(ctx) {
  const { db, M } = ctx;
  const now = () => (ctx.maintenant || Date.now)();
  const lire = async (c) => (await db.ref(c).get()).val();

  // Le suivi jusqu'à `fin`, sans jamais raccourcir ce qui est déjà ouvert :
  //   · droits déjà « suivi » par un code : l'échéance la plus lointaine ;
  //   · un palier PAYÉ en cours (PayPal, parrainage, essai) : il reste, et le
  //     suivi passe par-dessus (suiviJusqu, que l'app lit déjà) ;
  //   · rien d'ouvert : le suivi devient le palier.
  // majDroits ne touche pas à un accès posé à la main (source main/suspension).
  async function poserSuivi(cle, fin) {
    const t = now();
    return M.majDroits(cle, (x) => {
      const ouvert = palierOuvert(x, t);
      if (x && x.source === 'code_coach' && x.palier === 'suivi') {
        const e = Number(x.echeance) || 0;
        return { echeance: e === 0 || fin === 0 ? 0 : Math.max(e, fin) };
      }
      if (ouvert !== 'aucun' && ouvert !== 'suivi') {
        return { suiviJusqu: Math.max(Number(x.suiviJusqu) || 0, fin || 0) };
      }
      return { palier: 'suivi', echeance: fin, source: 'code_coach' };
    });
  }

  // Lire un code, et dire pourquoi il ne vaut rien.
  async function lireCode(brut) {
    const code = String(brut || '').trim().toUpperCase();
    if (!CODE_RE.test(code)) throw new ErreurAppel(400, 'Code mal formé (format RC-XXXX-XXXX).');
    const d = await lire('rc_codes/' + code);
    if (!d || typeof d !== 'object') throw new ErreurAppel(404, 'Code invalide ou introuvable. Vérifie avec ton coach.');
    return { code, d };
  }
  // Le coach qui a émis le code : sa clé, lue sur le code (ou déduite de son
  // adresse pour les codes d'avant coachEmailKey).
  const coachDuCode = (d) => String(d.coachEmailKey || cleDe(d.coachEmail || '') || '');

  // Consommer, en transaction : deux comptes qui saisissent le même code au
  // même instant, un seul passe. Rend 'consomme', 'deja' (même compte) ou
  // lève.
  async function consommer(code, email, champs) {
    let etat = null;
    const tx = await db.ref('rc_codes/' + code).transaction((cur) => {
      if (!cur) { etat = 'absent'; return undefined; }
      const par = String(cur.athleteEmail || cur.coachEmail || '').toLowerCase();
      if (cur.redeemed === true) { etat = (par && par === email) ? 'deja' : 'pris'; return undefined; }
      etat = 'consomme';
      return Object.assign({}, cur, { redeemed: true }, champs);
    });
    if (tx.committed) return 'consomme';
    if (etat === 'deja') return 'deja';
    if (etat === 'absent') throw new ErreurAppel(404, 'Code invalide ou introuvable.');
    throw new ErreurAppel(409, 'Ce code a déjà été utilisé par un autre compte.');
  }

  // ── redeemCode ────────────────────────────────────────────────────────
  async function redeemCode({ auth, data }) {
    const email = auth.email, cle = cleDe(email), t = now();
    const { code, d } = await lireCode(data && data.code);
    if (d.type === 'coach') throw new ErreurAppel(400, "Ce code est une invitation coach, pas un code d'accès athlète.");
    if (!d.active) throw new ErreurAppel(403, 'Ce code a été désactivé par ton coach.');
    if (!(Number(d.expiry) > t)) throw new ErreurAppel(403, 'Ce code a expiré. Demande un nouveau code à ton coach.');
    const coach = coachDuCode(d);
    if (!coach) throw new ErreurAppel(403, 'Ce code ne désigne aucun coach.');
    // LE COACH ÉMETTEUR DOIT ÊTRE ENREGISTRÉ. Un code forgé par un compte qui
    // n'est pas coach — la faille que ce lot ferme — n'ouvre rien.
    if (coach !== CLE_CREATEUR && !(await lire('coachs_registre/' + coach))) {
      throw new ErreurAppel(403, "Ce code n'a pas été émis par un coach RepCore.");
    }
    if (coach === cle) throw new ErreurAppel(400, 'Un coach ne consomme pas son propre code.');
    const nom = String((data && data.nom) || d.studentName || '').slice(0, 80);
    const r = await consommer(code, email, { athleteEmail: email, usedBy: nom || email, etat: 'cree', creeLe: new Date(t).toISOString() });
    const fin = finDuCode(d, coach, t);
    const droits = r === 'deja' ? await lire('droits/' + cle) : await poserSuivi(cle, fin);
    if (r === 'consomme') {
      const b = 'users/' + cle + '/';
      // LE RANG DE RATTACHEMENT (02/10/2026) : les places du quota du coach vont
      // dans cet ordre (metier.js couvertureCoach). droits/ ne s'écrit pas
      // depuis le client : c'est lui qui fait foi, le dossier n'en est qu'un miroir.
      const maj = { [b + 'coachEmailKey']: coach, [b + 'status']: 'COACHING_SUIVI', [b + 'updatedAt']: t, [b + 'rattacheLe']: t };
      if (droits) maj['droits/' + cle + '/rattache'] = { coach, le: t };
      if (d.coachId) maj[b + 'coachId'] = String(d.coachId);
      if (d.coachName) maj[b + 'coachName'] = String(d.coachName).slice(0, 120);
      // LA CADENCE DE BILAN DU COACH (Réglages de coaching, 06/10/2026), sur un
      // dossier qui n'en a pas : un code ne remplace jamais une cadence posée.
      const cad = cadenceValide(d.bilanCadence);
      if (cad && !cadenceValide(await lire(b + 'bilanCadence'))) maj[b + 'bilanCadence'] = cad;
      await db.ref().update(maj);
    }
    // Le programme de départ choisi par le coach, s'il y en a un, et SEULEMENT
    // sur un athlète sans programme réel : un code ne remplace jamais un
    // programme déjà en place. Rejouer (même compte) le repose s'il manque.
    let programme = null;
    if (d.programmeModeleId && ID_MODELE_RE.test(String(d.programmeModeleId))) {
      const [progs, sc, genre] = await Promise.all([lire('users/' + coach + '/coachPrograms'),
        lire('users/' + cle + '/sessions_config'), lire('users/' + cle + '/gender')]);
      if (!configReelle(sc)) programme = programmeDuModele(progs, d.programmeModeleId, genre, t);
      if (programme) {
        const b = 'users/' + cle + '/', maj = { [b + 'updatedAt']: t };
        for (const [k, v] of Object.entries(programme)) maj[b + k] = v;
        await db.ref().update(maj);
      }
    }
    return { ok: true, deja: r === 'deja', echeance: fin, coachEmailKey: coach, coachId: d.coachId || null,
      coachName: d.coachName || null, droits: droits || null, programme };
  }

  // ── devenirCoach ──────────────────────────────────────────────────────
  // Avec une invitation : un code de type 'coach' ÉMIS PAR LE CRÉATEUR, non
  // consommé. Sans : une place Libre, comptée ici (coachs_libres), en
  // transaction — c'est le serveur qui tient le plafond, plus le client.
  async function devenirCoach({ auth, data }) {
    const email = auth.email, cle = cleDe(email), t = now();
    const deja = await lire('coachs_registre/' + cle);
    if (deja) return { ok: true, deja: true, plan: deja.plan || 'libre' };
    let source = 'libre';
    const inv = data && data.invitation;
    if (inv) {
      const { code, d } = await lireCode(inv);
      if (d.type !== 'coach') throw new ErreurAppel(400, "Ce code n'est pas une invitation coach.");
      if (coachDuCode(d) !== CLE_CREATEUR) throw new ErreurAppel(403, "Cette invitation n'a pas été émise par RepCore.");
      if (d.active === false) throw new ErreurAppel(403, 'Cette invitation a été désactivée.');
      if (!(Number(d.expiry) > t)) throw new ErreurAppel(403, 'Cette invitation a expiré.');
      await consommer(code, email, { coachEmail: email, usedBy: email, redeemedAt: t });
      source = 'invitation';
    } else {
      const tx = await db.ref('coachs_libres').transaction((cur) => {
        const n = Number(cur && cur.n) || 0;
        return n >= LIBRE_MAX ? undefined : { n: n + 1 };
      });
      if (!tx.committed) throw new ErreurAppel(409, 'Les ' + LIBRE_MAX + ' comptes coach gratuits sont pris.');
    }
    const b = 'users/' + cle + '/';
    await db.ref().update({ ['coachs_registre/' + cle]: { plan: 'libre', le: t, source },
      [b + 'role']: 'coach', [b + 'coachPlan']: 'libre', [b + 'coachSubActive']: false, [b + 'updatedAt']: t });
    return { ok: true, deja: false, plan: 'libre' };
  }

  // ── prolongerCode ─────────────────────────────────────────────────────
  // Le coach a repoussé l'échéance de son code (rc_codes, que les règles lui
  // laissent écrire) : l'accès de l'athlète qui l'a consommé suit, plafonné.
  async function prolongerCode({ auth, data }) {
    const cle = cleDe(auth.email), t = now();
    const { d } = await lireCode(data && data.code);
    const coach = coachDuCode(d);
    // Le créateur prolonge tout code — reconnu par son UID et une adresse
    // vérifiée (createur.js), jamais par son adresse seule.
    // Un code ÉMIS PAR LE CRÉATEUR ne se prolonge que par lui, reconnu de même :
    // sinon un compte qui porte son adresse sous un autre UID passerait par
    // « coach === cle ».
    const sien = coach === cle && (coach !== CLE_CREATEUR || estCreateur(auth));
    if (!sien && !estCreateur(auth)) throw new ErreurAppel(403, "Ce code n'est pas le tien.");
    if (coach !== CLE_CREATEUR && !(await lire('coachs_registre/' + coach))) throw new ErreurAppel(403, "Tu n'es pas enregistré comme coach.");
    if (d.redeemed !== true || !d.athleteEmail) return { ok: true, applique: false };
    const fin = finDuCode({ expiry: d.expiry }, coach, t);
    if (!fin) return { ok: true, applique: false };
    const droits = await poserSuivi(cleDe(d.athleteEmail), fin);
    return { ok: true, applique: !!droits, echeance: fin };
  }

  // ── emailVerifie ──────────────────────────────────────────────────────
  // L'app l'appelle une fois l'adresse vérifiée. Le serveur NE CROIT QUE LE
  // JETON (email_verified, signé par Google) et note la date dans
  // parrainage/verifies/<clé>, que personne d'autre n'écrit : c'est ce que
  // lit la qualification d'un filleul. Puis il rejuge le parrainage (un
  // filleul payé en attente peut être qualifié dès maintenant).
  async function emailVerifie({ auth }) {
    if (!auth.emailVerifie) throw new ErreurAppel(400, 'Adresse e-mail pas encore vérifiée.');
    const cle = cleDe(auth.email), t = now();
    await db.ref('parrainage/verifies/' + cle).transaction((cur) => (cur ? undefined : t));
    let parrainage = null;
    try { if (M.parrainageSeuil) parrainage = await M.parrainageSeuil(cle, t); } catch (e) { parrainage = null; }
    return { ok: true, parrainage };
  }

  return { redeemCode, devenirCoach, prolongerCode, emailVerifie, poserSuivi };
}
