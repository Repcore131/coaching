// ══ LES DROITS, DÉCIDÉS PAR LE SERVEUR SEUL (10/10/2026) ═══════════════════
//
// CE QUI CHANGE. L'app décidait encore, sur la foi du dossier (users/<clé>,
// écrit par son titulaire sans restriction de champ), de trois accès :
//   · l'essai : essai.ouvertLe / essai.finit — une console de navigateur le
//     prolongeait ;
//   · un programme de la boutique : programmesAchetes/<id> — une console se
//     l'attribuait ;
//   · l'abonnement, tant que droits/ n'avait pas été lu ou que la bascule
//     (reglages_publics/droitsServeur) n'était pas posée, et 72 h après un
//     paiement fait sur l'appareil (paiementRecent).
// Tout cela vit maintenant dans droits/<clé>, que les règles ferment à TOUT
// client (".write": false) : seul ce Worker l'écrit, avec la clé du compte de
// service, qui ne passe pas par les règles. L'app lit droits/ et ne décide
// plus rien de ces trois accès.
//
// /fn/droits (jeton Firebase vérifié, appels.js) :
//   {action:'essai'}                   ouvre l'essai, UNE fois dans la vie du compte
//   {action:'rattraper', abo?}         recopie ce que le dossier affirmait, VÉRIFIÉ
//   {action:'verifierAchat', ordre, programme}  un achat, relu chez PayPal
//   {action:'poser', email, champs}    l'écran Accès du créateur (lui seul)
// Chaque appel rend {ok, droits} : l'app pose ce nœud dans son cache.
//
// LE RATTRAPAGE (comptes d'avant ce lot). Rien n'est cru sur parole :
//   · l'essai d'avant : sa date d'ouverture est la PLUS ANCIENNE des dates
//     connues (essai.ouvertLe, createdAt, maintenant) — avancer ou reculer
//     ces champs ne rallonge rien ; la fin est recalculée (30 jours, plus le
//     mois de l'ami si un lien de parrainage ou d'ambassadeur l'atteste) ;
//     essai.finit n'est jamais lu ;
//   · un programme : sa commande est relue chez PayPal (statut, compte,
//     montant) ; un « offert » sans commande n'est pas repris ;
//   · un abonnement : relu chez PayPal, au compte (custom_id) — indexer() et
//     droitsOuverts() de paypal.js, les mêmes que le webhook.
// rattrapeLe est posé une fois le compte passé : l'app ne rappelle plus.
import TARIFS from '../../tarifs.json' with { type: 'json' };

export const ESSAI_JOURS = Number(TARIFS.essai.jours) || 30;
export const BONUS_JOURS = (Number(TARIFS.essai_parrainage && TARIFS.essai_parrainage.moisEnPlus) || 0) * 30;
const J = 864e5;
const CREATEUR = 'guellec.coachingpro@gmail.com';
const ID_PROG_RE = /^[a-z0-9_-]{2,40}$/;
const ORDRE_RE = /^[A-Z0-9]{8,40}$/;
const cleDe = (email) => String(email || '').toLowerCase().trim().replace(/\./g, ',');

/**
 * PURE. L'essai que le serveur ouvre.
 * La date d'ouverture est la plus ancienne des dates connues et positives :
 * un dossier ne recule pas son essai en écrivant une date à venir, ni ne le
 * rouvre en écrivant « maintenant » (createdAt reste plus ancien).
 * @param {{ouvertLe?:number, createdAt?:number, maintenant:number, bonus?:boolean}} o
 * @returns {{essaiOuvertLe:number, essaiFinit:number, essaiBonus?:true}}
 */
export function essaiServeur(o) {
  const t = Number(o.maintenant);
  const dates = [Number(o.ouvertLe), Number(o.createdAt), t].filter((x) => x > 0 && x <= t);
  const ouvert = Math.min.apply(null, dates);
  const r = { essaiOuvertLe: ouvert, essaiFinit: ouvert + (ESSAI_JOURS + (o.bonus ? BONUS_JOURS : 0)) * J };
  if (o.bonus && BONUS_JOURS) r.essaiBonus = true;
  return r;
}

/**
 * PURE. La fiche d'un programme dans droits/<clé>/programmes/<id>.
 * @param {{le:number, prixCts:number, source:string, ordre?:string}} o
 */
export function ficheProgramme(o) {
  const f = { le: Number(o.le) || 0, prixCts: Math.max(0, Math.round(Number(o.prixCts) || 0)), source: String(o.source || 'paypal').slice(0, 20) };
  if (o.ordre) f.ordre = String(o.ordre).slice(0, 64);
  return f;
}

// Ce que l'écran Accès du créateur écrit (accesCalcul, dans l'app). Ni
// l'essai, ni les programmes : ceux-là ne s'ouvrent que par leurs chemins.
const CHAMPS_ACCES = ['palier', 'echeance', 'source', 'avant', 'avantEcheance', 'avantSource'];
const PALIERS = ['aucun', 'essentielle', 'ultime', 'suivi'];
/**
 * PURE. Les champs que le créateur peut poser, bornés ; null si rien de valable.
 * @param {object|null} champs null : « rouvrir » (les champs d'accès sont retirés)
 */
export function champsAcces(champs) {
  if (champs === null) {
    const o = {}; for (const k of CHAMPS_ACCES) o[k] = null;
    o.source = 'rattrapage';   // l'accès revient à ce que le serveur sait (abonnement, suivi)
    return o;
  }
  if (!champs || typeof champs !== 'object') return null;
  const o = {};
  for (const k of CHAMPS_ACCES) {
    if (!(k in champs)) continue;
    const v = champs[k];
    if (k === 'palier' || k === 'avant') { if (v === null || PALIERS.indexOf(v) >= 0) o[k] = v; }
    else if (k === 'echeance' || k === 'avantEcheance') { const n = Number(v); if (v === null || (n >= 0 && n < 4102444800000)) o[k] = v === null ? null : n; }
    else if (v === null || (typeof v === 'string' && v.length < 30)) o[k] = v;
  }
  return Object.keys(o).length ? o : null;
}

/**
 * Le service. ctx : {db, M (metier : majDroits), paypal (creerPaypal), maintenant}.
 */
export function creerDroits(ctx) {
  const { db, M } = ctx;
  const now = ctx.maintenant || (() => Date.now());
  const lire = async (c) => (await db.ref(c).get()).val();
  const pp = () => ctx.paypal || (M && M.paypal);

  // Le mois de l'ami : un lien de parrainage accepté, ou un code ambassadeur
  // « essai+1mois » (l'autre avantage, ultime_demi, remplace ce mois).
  async function aDroitAuBonus(cle) {
    const [par, amb] = await Promise.all([lire('parrainage/liens/' + cle), lire('ambassadeurs_liens/' + cle)]);
    if (par && par.parrain) return true;
    if (amb && amb.code) {
      const av = await lire('ambassadeurs/' + amb.code + '/avantage');
      return av !== 'ultime_demi';
    }
    return false;
  }

  // L'ESSAI, UNE FOIS DANS LA VIE DU COMPTE. La transaction ferme la porte à
  // deux appels simultanés ; un essai déjà posé est rendu tel quel.
  async function essai(cle) {
    const [role, ouvertLe, createdAt, bonus] = await Promise.all([lire('users/' + cle + '/role'), lire('users/' + cle + '/essai/ouvertLe'),
      lire('users/' + cle + '/createdAt'), aDroitAuBonus(cle)]);
    if (role === null) return { ok: false, raison: 'compte' };
    if (role === 'coach') return { ok: false, raison: 'coach' };
    const t = now();
    const e = essaiServeur({ ouvertLe, createdAt, maintenant: t, bonus });
    await db.ref('droits/' + cle).transaction((d) => {
      if (d && Number(d.essaiOuvertLe) > 0) return undefined;
      return Object.assign({ palier: 'aucun', echeance: 0, source: 'essai' }, d || {}, e, { maj: t });
    });
    return { ok: true, droits: await lire('droits/' + cle) };
  }

  // LE MOIS DE L'AMI, ACCEPTÉ APRÈS L'OUVERTURE DE L'ESSAI (parrainage ou code
  // ambassadeur jugé dans la minute qui suit l'inscription) : la fin recule
  // d'un mois, une fois. Avant l'ouverture, essai() le compte lui-même.
  async function bonusEssai(cle) {
    if (!BONUS_JOURS) return null;
    let fait = null;
    await db.ref('droits/' + cle).transaction((d) => {
      if (!d || !(Number(d.essaiOuvertLe) > 0) || d.essaiBonus) return undefined;
      fait = Number(d.essaiFinit) + BONUS_JOURS * J;
      return Object.assign({}, d, { essaiFinit: fait, essaiBonus: true, maj: now() });
    });
    return fait;
  }

  // UN PROGRAMME, ENREGISTRÉ À VIE dans droits/ (le dossier garde sa fiche,
  // pour l'historique et les versions d'avant de l'app). La date du premier
  // enregistrement n'est pas réécrite.
  async function enregistrerProgramme(cle, prog, o) {
    if (!ID_PROG_RE.test(String(prog || ''))) return null;
    const c = 'droits/' + cle + '/programmes/' + prog;
    const deja = await lire(c);
    const f = ficheProgramme(Object.assign({}, o, { le: (deja && Number(deja.le)) || o.le }));
    await db.ref(c).set(f);
    await db.ref('droits/' + cle + '/maj').set(now());
    return f;
  }
  async function programmeRembourse(cle, prog, t) {
    if (!ID_PROG_RE.test(String(prog || ''))) return null;
    const c = 'droits/' + cle + '/programmes/' + prog;
    if ((await lire(c)) === null) return null;
    await db.ref().update({ [c + '/rembourseLe']: t, ['droits/' + cle + '/maj']: now() });
    return t;
  }

  // LE RATTRAPAGE D'UN COMPTE D'AVANT : essai, programmes, abonnement. Rien
  // n'est cru sur la foi du dossier (voir l'en-tête).
  async function rattraper(cle, aboDemande) {
    const [role, d0, essaiDossier, achats, sid] = await Promise.all([lire('users/' + cle + '/role'), lire('droits/' + cle),
      lire('users/' + cle + '/essai'), lire('users/' + cle + '/programmesAchetes'), lire('users/' + cle + '/paypalSubscriptionId')]);
    if (role === null) return { ok: false, raison: 'compte' };
    const rapport = { essai: null, programmes: [], refuses: [], abonnement: null };
    const P = pp();
    if (role !== 'coach') {
      // L'essai d'avant ce lot, s'il y en a eu un.
      if (essaiDossier && typeof essaiDossier === 'object' && !(d0 && Number(d0.essaiOuvertLe) > 0)) {
        const r = await essai(cle); rapport.essai = r.ok ? 'repris' : r.raison;
      }
      // Les programmes : chaque commande, relue.
      const dejaServeur = (d0 && d0.programmes) || {};
      for (const [prog, a] of Object.entries(achats && typeof achats === 'object' ? achats : {})) {
        if (dejaServeur[prog]) continue;
        const ordre = String((a && a.ordre) || '');
        if (!ORDRE_RE.test(ordre) || !P) { rapport.refuses.push(prog); continue; }
        const v = await P.verifierAchatProgramme(cle, ordre, prog, { rattrapage: true, le: Number(a && (a.date || a.le)) || 0 });
        if (v.ok) rapport.programmes.push(prog); else rapport.refuses.push(prog);
      }
    }
    // L'abonnement : celui que l'app vient de signaler, ou celui du dossier.
    if (P && role !== 'coach') rapport.abonnement = await P.rattraperAbonnement(cle, [aboDemande, sid]);
    await db.ref('droits/' + cle).transaction((d) => Object.assign({ palier: 'aucun', echeance: 0, source: 'rattrapage' }, d || {},
      { rattrapeLe: now(), maj: now() }));
    return { ok: true, rapport, droits: await lire('droits/' + cle) };
  }

  // L'ÉCRAN ACCÈS DU CRÉATEUR : ouvrir, prolonger, fermer, rouvrir à la main.
  async function poser(email, champs) {
    const cle = cleDe(email);
    if (!cle || cle.indexOf('@') < 0 || /[#$\[\]\/]/.test(cle)) return { ok: false, raison: 'adresse' };
    const c = champsAcces(champs);
    if (!c) return { ok: false, raison: 'champs' };
    const t = now();
    await db.ref('droits/' + cle).update(Object.assign({}, c, { maj: t }));
    return { ok: true, droits: await lire('droits/' + cle) };
  }

  async function appel(req) {
    const email = String((req && req.auth && req.auth.email) || '').toLowerCase();
    const cle = cleDe(email);
    if (!cle) return { ok: false, raison: 'compte' };
    const d = (req && req.data) || {};
    const a = String(d.action || '');
    if (a === 'essai') return essai(cle);
    if (a === 'rattraper') return rattraper(cle, String(d.abo || ''));
    if (a === 'verifierAchat') {
      const P = pp();
      const v = P ? await P.verifierAchatProgramme(cle, String(d.ordre || ''), String(d.programme || '')) : { ok: false, raison: 'paypal' };
      return Object.assign({}, v, { droits: await lire('droits/' + cle) });
    }
    if (a === 'poser') {
      if (email !== CREATEUR) return { ok: false, raison: 'createur' };
      return poser(String(d.email || ''), d.champs === null ? null : d.champs);
    }
    return { ok: false, raison: 'action' };
  }

  return { essai, bonusEssai, enregistrerProgramme, programmeRembourse, rattraper, poser, appel };
}
