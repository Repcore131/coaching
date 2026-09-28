// ══ LE MÉTIER DU SERVEUR LÉGER ════════════════════════════════════════════
//
// Porté depuis functions/index.js (branche « viralité », builds 1591-1600),
// écrit d'abord pour les Cloud Functions du plan Blaze. Le plan Blaze est
// payant ; Kevin a tranché « 0 € ». Ce code tourne donc dans un Cloudflare
// Worker gratuit, et trois choses changent :
//
// 1. PAS DE DÉCLENCHEURS DE BASE. Ce que les Functions recevaient à l'écriture
//    d'un nœud (réponse du coach, défi publié, séance terminée, demande de
//    parrainage), le Worker le RELÈVE chaque minute dans des boîtes aux
//    lettres : /evenements (déposés par l'app), /parrainage/demandes et
//    /ambassadeurs_demandes (déjà écrits par l'app, sans « etat » tant
//    qu'ils n'ont pas été jugés).
//
// 2. DIX MILLISECONDES DE CALCUL ET CINQUANTE REQUÊTES PAR EXÉCUTION (plan
//    gratuit). Les rappels planifiés avancent donc PAR LOTS, d'une minute à
//    l'autre, avec un curseur dans /worker/jobs. Et le Worker ne relit JAMAIS
//    les séances d'un athlète : c'est l'app de l'athlète qui écrit sa propre
//    progression dans un défi (elle la calcule déjà pour sa jauge).
//
// 3. LA PAGE PUBLIQUE AVEC APERÇU PERSONNALISÉ n'est pas portée : les liens
//    /@pseudo et /coach/slug gardent l'aperçu par défaut (og-image.png).
//
// Les calculs PURS restent ceux de functions/*-calcul.js, avec leurs bancs.

import D from '../../functions/defis-calcul.js';
import P from '../../functions/parrainage-calcul.js';
import A from '../../functions/ambassadeurs-calcul.js';
import ATT from '../../functions/attribution-calcul.js';
import { envoyerA } from './push.js';

export const CREATOR_EMAIL = 'guellec.coachingpro@gmail.com';
export const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
export const PUSH_TYPES = ['serie', 'wrapped', 'bilan', 'badge', 'coach', 'filleul', 'defi', 'acces'];
const BONUS_ESSAI_JOURS = 30;
const PALIERS = ['aucun', 'essentielle', 'ultime', 'suivi'];

// ── LE TEMPS, À PARIS ─────────────────────────────────────────────────────
export function paris(t) {
  const f = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false });
  const p = {};
  for (const x of f.formatToParts(new Date(t))) p[x.type] = x.value;
  const annee = Number(p.year), mois = Number(p.month), date = Number(p.day);
  return { jour: p.year + '-' + p.month + '-' + p.day, heure: Number(p.hour) % 24, minute: Number(p.minute),
    annee, mois, date, joursem: new Date(Date.UTC(annee, mois - 1, date)).getUTCDay() };
}
export function heuresCalmes(t) { const h = paris(t).heure; return h >= 21 || h < 8; }
export function lundiParis(t) {
  const p = paris(t);
  const d = new Date(Date.UTC(p.annee, p.mois - 1, p.date));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function pushAutorise(type, prefs, log, t) {
  if (PUSH_TYPES.indexOf(type) < 0) return { ok: false, raison: 'type' };
  if (prefs && prefs[type] === false) return { ok: false, raison: 'coupe' };
  if (heuresCalmes(t)) return { ok: false, raison: 'calme' };
  if (log && log.jour === paris(t).jour) return { ok: false, raison: 'plafond' };
  return { ok: true, raison: null };
}
function prolonger(echeanceActuelle, ms, t) {
  return Math.max(Number(echeanceActuelle) || 0, t || Date.now()) + (Number(ms) || 0);
}
export const emailKey = (e) => String(e || '').toLowerCase().trim().replace(/\./g, ',');

// ── LE BUDGET D'UNE EXÉCUTION (plan gratuit : 50 sous-requêtes, 10 ms de calcul)
// Un push isolé coûte ~7 requêtes (préférences, journal, abonnements,
// transaction, l'envoi) ; un rappel planifié, moins (abonnements et journal lus par
// lot : prechargerPush ; la série, 5). Et ~1,1 ms de chiffrement par appareil
// (mesuré : test/charge.test.mjs) : pour les rappels, c'est lui qui borne.
// Cinq chiffrements par exécution tiennent sous les 10 ms avec la marge du
// reste (lecture, JSON) ; au-delà, la suite part en sous-tâches.
export const COUT_PUSH = 8;
export const MAX_CHIFFREMENTS = 5;
const MARGE = 2;

// UN IDENTIFIANT EN FIN DE FILE /evenements : après tout ce qui y est déjà
// (horodaté, trié comme ceux de l'app), au format que les règles acceptent.
let _nFile = 0;
export function idFile(t, marque) {
  const a = new Uint8Array(4); crypto.getRandomValues(a);
  return 'e' + Number(t).toString(36) + (marque || 'r') + (_nFile++ % 46656).toString(36).padStart(3, '0')
    + Array.from(a, (b) => (b % 36).toString(36)).join('');
}

/**
 * @param {{db:any, vapid:{publique:string, privee:string}, fetchImpl?:Function, maintenant?:()=>number}} deps
 */
export function creerMetier(deps) {
  const { db } = deps;
  const now = deps.maintenant || (() => Date.now());
  const _val = async (c) => (await db.ref(c).get()).val();
  const _lire = (uid, champ) => _val('users/' + uid + '/' + champ);

  // ══ LE BUDGET, ET CE QUI NE TIENT PAS DEDANS ═══════════════════════════
  // planif.js fixe `reste` (les requêtes encore permises) à chaque réveil.
  // Les boucles internes — un défi à tous les athlètes, le rappel des 48 h,
  // les messages de la nuit, les ambassadeurs, les fins PayPal — le consultent
  // AVANT chaque tour. Quand il ne suffit plus, elles écrivent la suite en
  // SOUS-TÂCHES (une par athlète) au bout de /evenements, en une seule
  // écriture, et rendent la main : le réveil suivant les reprend.
  // Hors d'un réveil (webhook PayPal), rien n'est fixé : pas de limite ici.
  let _reste = () => Infinity;
  let _chiffres = 0;
  function fixerBudget(fn) { _reste = typeof fn === 'function' ? fn : () => Infinity; _chiffres = 0; }
  const reste = () => _reste();
  const peutPousser = () => _reste() >= COUT_PUSH + MARGE && _chiffres < MAX_CHIFFREMENTS;
  const chiffrements = () => _chiffres;
  // `maj` : d'autres écritures à faire DANS LA MÊME requête (le passage de
  // relais est atomique : rien n'est retiré sans que sa suite soit écrite).
  async function differer(taches, maj0) {
    const t = now();
    const maj = Object.assign({}, maj0 || {});
    for (const x of taches) maj['evenements/' + idFile(t, 't')] = Object.assign({ type: 'tache', par: 'worker', at: t }, x);
    if (Object.keys(maj).length) await db.ref().update(maj);
    return taches.length;
  }
  const tachePush = (uid, message, o) => Object.assign({ quoi: 'push', uid, message }, o && o.attendre === false ? { attendre: false } : {});
  // [{uid, message}] : envoyés tant que le budget le permet, le reste différé.
  async function pousserA(liste, o) {
    let envoyes = 0;
    for (let i = 0; i < liste.length; i++) {
      if (!peutPousser()) {
        await differer(liste.slice(i).map((x) => tachePush(x.uid, x.message, o)));
        return { envoyes, differes: liste.length - i };
      }
      const r = await envoyerPush(liste[i].uid, liste[i].message, o);
      if (r.envoye) envoyes++;
    }
    return { envoyes, differes: 0 };
  }

  // ── LES DROITS (palier, échéance) — écrits par le serveur seul ──────────
  async function lireDroits(cle) { return _val('droits/' + cle); }
  async function ecrireDroits(cle, champs) {
    const patch = Object.assign({}, champs || {}, { maj: now() });
    if (patch.palier !== undefined) patch.palier = PALIERS.indexOf(String(patch.palier)) > 0 ? String(patch.palier) : 'aucun';
    if (patch.echeance !== undefined) patch.echeance = Number(patch.echeance) || 0;
    await db.ref('droits/' + cle).update(patch);
    return patch;
  }
  // ── droits/ SUIT CHAQUE CHANGEMENT DE PAIEMENT (27/09/2026) ────────────
  // Le dossier, son titulaire l'écrit : un accès qui ne vit que là se
  // trafique depuis une console. droits/, seul le créateur l'écrit (et ce
  // serveur, avec son accès administrateur) : c'est ce que l'app lit d'abord.
  //
  // `fn(actuel)` rend les champs à poser, ou rien. En transaction : deux
  // événements PayPal simultanés ne s'écrasent pas.
  // ⚠ UN ACCÈS POSÉ À LA MAIN N'EST PAS RÉÉCRIT. Ouvert (« main ») ou fermé
  //   (« suspension ») par le créateur depuis l'écran Accès, il prime sur ce
  //   que PayPal annonce ; « rendre » la main efface le nœud, et le serveur
  //   reprend au changement suivant.
  const SOURCES_MAIN = ['main', 'suspension'];
  // A-T-IL DÉJÀ PAYÉ ? Trois traces que son titulaire ne peut pas fabriquer
  // pour lui-même, ou qui l'engagent : le premier paiement noté par le
  // serveur, un abonnement PayPal dans le dossier (le vider n'efface pas
  // paypal_premiers), et un accès posé par PayPal dans droits/.
  // ⚠ PAS createdAt : un compte ancien n'a pas forcément payé, et createdAt,
  //   son titulaire l'écrit — le remettre à aujourd'hui passait pour neuf.
  async function dejaPaye(cle, droits) {
    const [premier, abo] = await Promise.all([_val('paypal_premiers/' + cle), _lire(cle, 'paypalSubscriptionId')]);
    const d = droits === undefined ? await lireDroits(cle) : droits;
    return !!(premier || (abo && /^I-/.test(String(abo))) || (d && /^paypal/.test(String(d.source || '')))
      || (d && String(d.abo || '')));
  }
  async function majDroits(cle, fn) {
    if (!cle) return null;
    let res = null;
    const tx = await db.ref('droits/' + cle).transaction((d) => {
      if (d && SOURCES_MAIN.indexOf(String(d.source)) >= 0) return undefined;
      const n = fn(d || null);
      if (!n) return undefined;
      const out = Object.assign({}, d || {}, n, { maj: now() });
      out.palier = PALIERS.indexOf(String(out.palier)) >= 0 ? String(out.palier) : 'aucun';
      out.echeance = Math.max(0, Number(out.echeance) || 0);
      for (const k of Object.keys(out)) if (out[k] === null || out[k] === undefined) delete out[k];
      res = out;
      return out;
    });
    return tx.committed ? res : null;
  }
  // Le palier ouvert à l'instant t par un nœud droits/, comme l'app le lit.
  const palierDroits = (d, t) => {
    if (!d) return null;
    const p = PALIERS.indexOf(String(d.palier)) > 0 ? String(d.palier) : 'aucun';
    return (Number(d.echeance) > 0 && t >= Number(d.echeance)) ? 'aucun' : p;
  };

  // ══ WEB PUSH ═══════════════════════════════════════════════════════════
  // `o.urgent` : un message pour l'ADMINISTRATEUR (un litige PayPal). Ni
  // heures calmes, ni plafond d'un par jour, ni préférences : chaque litige
  // doit arriver, à l'heure où il arrive. Réservé au code du serveur.
  // `o.prefs` : les préférences, déjà lues avec le dossier (null : aucune).
  // `o.lot` : les abonnements et le journal du jour, déjà lus pour tout un
  // lot de rappels (prechargerPush). Ce qui n'est pas fourni est relu ici.
  async function envoyerPush(uid, message, o) {
    const t = now();
    const type = String((message && message.type) || '');
    const urgent = !!(o && o.urgent);
    const lot = (o && o.lot) || null;
    const aPrefs = !!o && Object.prototype.hasOwnProperty.call(o, 'prefs');
    const [prefs, log] = urgent ? [null, null] : await Promise.all([aPrefs ? o.prefs : _lire(uid, 'pushPrefs'),
      lot ? (lot.logs[uid] || null) : _val('push_log/' + uid)]);
    const ok = urgent ? { ok: true, raison: null } : pushAutorise(type, prefs, log, t);
    if (!ok.ok) {
      if (ok.raison === 'calme' && (!o || o.attendre !== false))
        await db.ref('push_attente/' + uid).set(Object.assign({}, message, { at: t }));
      return { envoye: 0, raison: ok.raison };
    }
    const subs = (lot && lot.subs[uid]) || (await _val('push/' + uid)) || {};
    const ids = Object.keys(subs);
    if (!ids.length) return { envoye: 0, raison: 'aucun_abonnement' };
    const jour = paris(t).jour;
    if (!urgent && lot) {
      // Le journal a été lu pour le lot, sous le verrou de la minute : une
      // écriture simple suffit (une requête, contre deux pour la transaction).
      // Seul un webhook PayPal, hors verrou, pourrait passer entre la lecture et
      // l'écriture : au pire un second push ce jour-là, jamais un oubli.
      const entree = { jour, at: t, type };
      await db.ref('push_log/' + uid).set(entree);
      lot.logs[uid] = entree;
    } else if (!urgent) {
      const tx = await db.ref('push_log/' + uid).transaction((cur) => (cur && cur.jour === jour) ? undefined : { jour, at: t, type });
      if (!tx.committed) return { envoye: 0, raison: 'plafond' };
    }
    const charge = JSON.stringify({ title: message.title, body: message.body || '',
      url: message.url || './', tag: message.tag || ('rc-' + type), type });
    let envoye = 0;
    await Promise.all(ids.map(async (id) => {
      const s = subs[id];
      if (!s || !s.endpoint || !s.keys) return;
      _chiffres++;
      try {
        const r = await envoyerA(s, charge, { publique: deps.vapid.publique, privee: deps.vapid.privee,
          contact: 'mailto:' + CREATOR_EMAIL, fetchImpl: deps.fetchImpl });
        if (r.statut >= 200 && r.statut < 300) envoye++;
        else if (r.statut === 404 || r.statut === 410) await db.ref('push/' + uid + '/' + id).remove();
      } catch (e) { /* un appareil injoignable n'arrête pas les autres */ }
    }));
    if (!envoye && !urgent) {
      await db.ref('push_log/' + uid).remove();
      if (lot) delete lot.logs[uid];
    }
    return { envoye, raison: envoye ? null : 'echec' };
  }
  const abonnes = () => db.ref('push').shallow();

  // UN LOT DE RAPPELS EN DEUX REQUÊTES : les abonnements et le journal du jour
  // des clés `uids` (triées), lus d'un coup par plage de clés. Un par un, c'était
  // deux requêtes par athlète. Valable le temps d'un réveil : le suivant relit.
  async function prechargerPush(uids) {
    const l = (uids || []).filter(Boolean);
    if (!l.length) return null;
    const plage = async (n) => (await db.ref(n).orderByKey().startAt(l[0]).endAt(l[l.length - 1]).get()).val() || {};
    const [subs, logs] = await Promise.all([plage('push'), plage('push_log')]);
    return { subs, logs };
  }
  // DES CHAMPS D'UN DOSSIER, AU PLUS JUSTE.
  // `voisins` : ceux dont la clé est entre `de` et `a` (ordre des clés), en UNE
  // requête. streak, streakJokerLe, streakJokers, streakJokersUtilises et
  // streakWeek sont des compteurs et des dates, voisins dans l'ordre des clés.
  // ⚠ PAS DE shallow POUR LES VALEURS : Firebase y rend `true` pour chaque clé,
  //   valeurs simples comprises (vérifié sur la base le 27/09/2026).
  const voisins = async (uid, de, a) => (await db.ref('users/' + uid).orderByKey().startAt(de).endAt(a).get()).val() || {};
  // `presents` : la liste des clés du dossier (shallow, une requête) dit
  // lesquels de `champs` existent ; seuls ceux-là sont lus. Une suspension, des
  // préférences réglées sont rares : deux requêtes au lieu de trois.
  async function presents(uid, champs) {
    const cles = await db.ref('users/' + uid).shallow();
    const v = await Promise.all(champs.map((c) => (cles.indexOf(c) >= 0 ? _lire(uid, c) : null)));
    return Object.fromEntries(champs.map((c, i) => [c, v[i]]));
  }

  // ── LES RAPPELS PLANIFIÉS — UNE PERSONNE À LA FOIS ─────────────────────
  // Chacun rend la même chose : il traite UNE clé. Le découpage en lots, le
  // curseur et le préchargement (`lot`, voir prechargerPush) sont dans planif.js.
  const planifies = {
    // Série en danger : jeudi 18 h. Cinq push par minute au plus (le plafond
    // des chiffrements) : au-delà de 900 abonnés, la fin de la liste tombe dans
    // les heures calmes. Elle part alors le vendredi à 8 h 05, SI la semaine
    // n'a pas été validée entre-temps (`semaine`, relu par tache()).
    async serie(uid, t, acc, lot) {
      const lundi = lundiParis(t);
      const s = await voisins(uid, 'streak', 'streakWeek');
      const n = Number(s.streak);
      if (!(n > 0) || s.streakWeek === lundi) return;
      const d = await presents(uid, ['fname', 'suspension', 'pushPrefs']);
      if (d.suspension && d.suspension.actif) return;
      await envoyerPush(uid, { type: 'serie', url: './?wo=1', tag: 'serie-' + lundi + '-jeu', semaine: lundi,
        title: 'Ta série de ' + n + ' semaine' + (n > 1 ? 's' : '') + ' est en danger',
        body: (d.fname ? d.fname + ', il' : 'Il') + ' te reste jusqu’à dimanche pour valider ta semaine.'
          + (Number(s.streakJokers) > 0 ? ' Ton joker la sauverait, mais garde-le pour un vrai coup dur.' : '') }, { prefs: d.pushPrefs, lot });
    },
    // Wrapped prêt : le 1er du mois, 10 h — pour qui s'est entraîné le mois écoulé.
    async wrapped(uid, t, acc, lot) {
      const p = paris(t);
      const moisPrec = p.mois === 1 ? 12 : p.mois - 1, anPrec = p.mois === 1 ? p.annee - 1 : p.annee;
      const debut = Date.UTC(anPrec, moisPrec - 1, 1) - 2 * 3600e3;
      const cle = 'm-' + anPrec + '-' + String(moisPrec).padStart(2, '0');
      const nom = new Date(Date.UTC(anPrec, moisPrec - 1, 15)).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Europe/Paris' });
      if ((Number(await _lire(uid, 'lastSession')) || 0) < debut) return;
      await envoyerPush(uid, { type: 'wrapped', url: './?wrapped=' + cle, tag: 'wrapped-' + cle,
        title: 'Ton mois de ' + nom + ' est prêt', body: 'Tes chiffres, tes records et ton profil t’attendent.' }, { lot });
    },
    // Rappel de bilan : samedi 10 h, dernier bilan vieux de 13 jours ou plus.
    async bilan(uid, t, acc, lot) {
      if ((await _lire(uid, 'role')) === 'coach') return;
      const s = await db.ref('users/' + uid + '/bilans').orderByKey().limitToLast(1).get();
      let der = 0; s.forEach((c) => { der = Number((c.val() || {}).date) || 0; });
      if (der && t - der < 13 * 864e5) return;
      const [fname, prefs] = await Promise.all([_lire(uid, 'fname'), _lire(uid, 'pushPrefs')]);
      await envoyerPush(uid, { type: 'bilan', url: './?bilan=1', tag: 'bilan-' + paris(t).jour,
        title: 'C’est l’heure de ton bilan', body: (fname ? fname + ', 10' : '10') + ' minutes quand tu as le temps ce week-end.' }, { prefs, lot });
    },
    // FIN D'ACCÈS : chaque jour, 11 h — trois jours ou moins avant l'échéance,
    // UNE fois par échéance. C'était le bandeau de l'accueil, qu'on ne voit
    // qu'en ouvrant l'app : la notification le dit à qui ne l'ouvre plus.
    // L'échéance d'abord (une requête) : le reste n'est lu que dans les trois jours.
    async acces(uid, t, acc, lot) {
      const e = Number(await _lire(uid, 'accessExpiry')) || 0;
      if (!(e > t) || e - t > 3 * 864e5) return;
      const [statut, fin, fname, prefs, deja] = await Promise.all([_lire(uid, 'status'), _lire(uid, 'abonnement/finAccesPaypal'),
        _lire(uid, 'fname'), _lire(uid, 'pushPrefs'), _val('worker/relances_acces/' + uid)]);
      if (Number(deja) === e) return;
      const j = Math.max(1, Math.ceil((e - t) / 864e5));
      const quand = j === 1 ? 'dans moins de 24 heures' : 'dans ' + j + ' jours';
      const date = new Date(e).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' });
      let m = null;
      if (statut === 'COACHING_SUIVI')
        m = { title: 'Ton accès se termine ' + quand, body: (fname ? fname + ', il' : 'Il') + ' prend fin le ' + date + '. Préviens ton coach s’il doit le prolonger.' };
      else if (statut === 'AUTONOMIE_PREMIUM')
        m = { title: 'Ton abonnement prend fin ' + quand, body: fin ? 'Tu as résilié : ton accès reste ouvert jusqu’au ' + date + '.' : 'Ton accès prend fin le ' + date + '.' };
      if (!m) return;
      const r = await envoyerPush(uid, Object.assign({ type: 'acces', url: './', tag: 'acces-' + e }, m), { prefs, lot, attendre: false });
      if (r.envoye) await db.ref('worker/relances_acces/' + uid).set(e);
    },
    // Badge proche : dimanche 17 h — ASSIDU à deux séances ou moins.
    async badge(uid, t, acc, lot) {
      const n = (await db.ref('users/' + uid + '/sessions').shallow()).length;
      const SEUILS = [10, 50, 100, 250];
      const seuil = SEUILS.find((x) => x > n);
      if (!seuil || seuil - n > 2) return;
      const reste = seuil - n, palier = ['I', 'II', 'III', 'IV'][SEUILS.indexOf(seuil)];
      await envoyerPush(uid, { type: 'badge', url: './', tag: 'badge-assidu-' + palier,
        title: 'Encore ' + reste + ' séance' + (reste > 1 ? 's' : '') + ' pour ASSIDU ' + palier,
        body: 'Le badge est à portée de main cette semaine.' }, { lot });
    },
  };
  // Les messages mis de côté pendant la nuit : 8 h 05. TOUS passent en
  // sous-tâches, dans la même écriture qui les retire de push_attente : un
  // par athlète, envoyés au rythme du budget, et rien ne se perd en route.
  async function apresHeuresCalmes() {
    const tout = (await _val('push_attente')) || {};
    const maj = {}, taches = [];
    for (const uid of Object.keys(tout)) {
      const m = tout[uid];
      maj['push_attente/' + uid] = null;
      if (!m || now() - (Number(m.at) || 0) > 12 * 3600e3) continue;
      const message = Object.assign({}, m); delete message.at;
      taches.push(tachePush(uid, message, { attendre: false }));
    }
    if (Object.keys(maj).length) await differer(taches, maj);
    return taches.length;
  }

  // ── LA RARETÉ DES BADGES (la nuit), dossier par dossier ────────────────
  async function statsBadgesUn(uid, acc) {
    const [role, badges] = await Promise.all([_lire(uid, 'role'), _lire(uid, 'badges')]);
    if (role === 'coach') return;
    acc.total = (acc.total || 0) + 1;
    acc.n = acc.n || {};
    const b = (badges && typeof badges === 'object') ? badges : {};
    for (const id of Object.keys(b)) if (b[id] && Number(b[id].at) > 0) acc.n[id] = (acc.n[id] || 0) + 1;
  }
  async function statsBadgesFin(acc) {
    if (!acc.total) return;
    const pct = {};
    for (const id of Object.keys(acc.n || {})) pct[id] = Math.round(acc.n[id] / acc.total * 1000) / 10;
    await db.ref('stats/badges').set({ maj: now(), total: acc.total, pct });
  }

  // ══ LES DÉFIS DU CANAL ═════════════════════════════════════════════════
  async function defisDuCoach(coach) {
    const s = await db.ref('canaux/' + coach + '/messages').orderByChild('type').equalTo('defi').get();
    const out = [];
    s.forEach((c) => { const v = c.val(); if (v && v.type === 'defi') out.push(Object.assign({}, v, { id: c.key })); });
    return out;
  }
  const defiChemin = (coach, id, sous) => 'canaux/' + coach + '/defis/' + id + (sous ? '/' + sous : '');
  // ⚠ LA VALEUR N'EST PAS RECALCULÉE ICI : l'app de l'athlète l'écrit (valeur,
  //   metrique) après chaque séance et à l'inscription. Le prénom vient de
  //   l'inscription (prenom, ou pseudo) : aucune lecture de dossier.
  async function participants(coach, defi) {
    const brut = (await _val(defiChemin(coach, defi.id, 'participants'))) || {};
    return Object.keys(brut).filter((k) => brut[k] && brut[k].inscription).map((k) => {
      const p = brut[k], ins = p.inscription || {};
      return { cle: k, nom: String(ins.pseudo || ins.prenom || '').trim() || 'Athlète', classement: ins.classement === true,
        valeur: Number(p.valeur) || 0, metrique: Number(p.metrique) || 0, termine: !!p.termine, termineLe: Number(p.termineLe) || 0 };
    });
  }
  async function publierSysteme(coach, defi, texte, t) {
    const id = 's' + t + '-' + String(defi.id).slice(-6).replace(/[^a-z0-9]/gi, '');
    await db.ref().update({
      ['canaux/' + coach + '/messages/' + id]: { at: t, type: 'systeme', texte: String(texte).slice(0, 1000), defiId: defi.id },
      ['coach_public/' + coach + '/canalDernier']: t });
    return id;
  }
  async function recalculerDefi(coach, defi, t, o) {
    const parts = await participants(coach, defi);
    const equipe = D.partEquipe(defi, parts.map((p) => p.valeur));
    for (const p of parts) {
      const fini = D.aTermine(defi, p.valeur, equipe);
      if (fini && !p.termineLe) p.termineLe = t;
      p.termine = fini;
    }
    const pl = D.places(parts);
    // UNE SEULE ÉCRITURE pour tous les participants et le résumé public.
    const maj = {};
    for (const p of parts) {
      const b = defiChemin(coach, defi.id, 'participants/' + p.cle);
      maj[b + '/termine'] = p.termine;
      maj[b + '/termineLe'] = p.termine ? p.termineLe : null;
      maj[b + '/place'] = pl[p.cle] || null;
    }
    maj[defiChemin(coach, defi.id, 'public')] = Object.assign(D.resumePublic(defi, parts), { maj: t });
    await db.ref().update(maj);
    if (!(o && o.sansAnnonce)) {
      const etat = (await _val(defiChemin(coach, defi.id, 'etat'))) || {};
      const a = D.annonceSuivante(defi, etat, parts, equipe, paris(t).jour);
      if (a) {
        await publierSysteme(coach, defi, a.texte, t);
        await db.ref(defiChemin(coach, defi.id, 'etat')).set(a.etat);
      }
    }
    return { parts, equipe };
  }
  async function cloturer(coach, defi, t) {
    const r = await recalculerDefi(coach, defi, t, { sansAnnonce: true });
    const g = D.gagnant(r.parts);
    await publierSysteme(coach, defi, D.textePodium(defi, r.parts), t);
    const maj = {};
    for (const p of r.parts.filter((x) => x.termine)) {
      maj['defis_resultats/' + p.cle + '/' + defi.id] = {
        titre: String(defi.titre || '').slice(0, 80), mesure: defi.mesure, collectif: !!defi.collectif,
        fin: Number(defi.fin), termineLe: p.termineLe || t, champion: !!(g && g.cle === p.cle), coach };
    }
    const etat = (await _val(defiChemin(coach, defi.id, 'etat'))) || {};
    maj[defiChemin(coach, defi.id, 'etat')] = Object.assign({}, etat, { clos: true, closLe: t, dernierSysteme: paris(t).jour,
      champion: g ? g.cle : null });
    await db.ref().update(maj);
  }
  // Tous les matins, 9 h : rappel des 48 h, annonces en attente, clôture.
  // Un défi coûte ~5 requêtes (~8 à la clôture) : si le budget ne suffit plus
  // pour le suivant, le coach entier est repris en sous-tâche. Tout y est
  // idempotent (rappel48, dernierSysteme, clos) ; le premier défi passe
  // toujours, pour que chaque reprise avance.
  async function defisQuotidienCoach(coach, t) {
    const jour = paris(t).jour;
    let n = 0;
    for (const defi of await defisDuCoach(coach)) {
      if (n++ > 0 && _reste() < 10) { await differer([{ quoi: 'defis_coach', coach }]); return 'differe'; }
      const etat = (await _val(defiChemin(coach, defi.id, 'etat'))) || {};
      if (etat.clos || t < Number(defi.debut)) continue;
      if (t > Number(defi.fin)) {
        if (etat.dernierSysteme !== jour) await cloturer(coach, defi, t);
        continue;
      }
      if (Number(defi.fin) - t <= 48 * 3600e3 && !etat.rappel48) {
        const parts = await participants(coach, defi);
        // Noté AVANT les envois : ceux qui ne tiennent pas dans le budget sont
        // déjà écrits en sous-tâches quand pousserA rend la main.
        await db.ref(defiChemin(coach, defi.id, 'etat/rappel48')).set(true);
        await pousserA(parts.filter((x) => !x.termine).map((p) => ({ uid: p.cle, message: { type: 'defi', url: './?canal=1', tag: 'defi-48h-' + defi.id,
          title: 'Plus que 48 h : ' + String(defi.titre || 'ton défi').slice(0, 60),
          body: 'Objectif : ' + D.texteObjectif(defi) + '. Tu en es à ' + String(p.valeur).replace('.', ',') + '.' } })), { attendre: false });
      }
      await recalculerDefi(coach, defi, t);
    }
  }
  const coachsAvecCanal = () => db.ref('canaux').shallow();

  // ══ LE PARRAINAGE ══════════════════════════════════════════════════════
  async function parrainageDemande(uid, d) {
    const t = now();
    const code = String(d.code || '').toUpperCase();
    const parrain = P.CODE_RE.test(code) ? await _val('parrainage/codes/' + code) : null;
    const filleulEmail = P.cleVersEmail(uid);
    const [appareil, lien, emailVu, droits, creeLe, prenom, amb] = await Promise.all([
      d.appareil ? _val('parrainage/appareils/' + String(d.appareil).replace(/[^a-z0-9]/g, '')) : null,
      _val('parrainage/liens/' + uid),
      _val('parrainage/emails/' + P.cleNormalisee(filleulEmail)),
      lireDroits(uid), _lire(uid, 'createdAt'), _lire(uid, 'fname'), _val('ambassadeurs_liens/' + uid)]);
    const dec = P.deciderRattachement(Object.assign({}, d, { code }), {
      filleul: uid, filleulEmail, parrain, parrainEmail: parrain ? P.cleVersEmail(parrain) : '',
      appareilsParrain: (appareil && appareil === parrain) ? { [d.appareil]: true } : {},
      dejaFilleul: !!lien, dejaAmbassadeur: !!amb, emailDejaVu: !!emailVu, creeLe, maintenant: t,
      dejaPaye: await dejaPaye(uid, droits) });
    const dem = 'parrainage/demandes/' + uid;
    if (!dec.ok) { await db.ref(dem).update({ etat: 'refuse', raison: dec.raison, traiteLe: t }); return { ok: false, raison: dec.raison }; }
    const id = P.idFilleul(uid);
    const nom = String(prenom || '').trim().slice(0, 24);
    await db.ref().update({
      ['parrainage/comptes/' + parrain + '/filleuls/' + id]: { date: t, statut: 'inscrit', prenom: nom || null },
      ['parrainage/comptes/' + uid + '/parrain']: { code, le: t },
      ['parrainage/liens/' + uid]: { parrain, id },
      ['parrainage/emails/' + P.cleNormalisee(filleulEmail)]: uid,
      [dem + '/etat']: 'accepte', [dem + '/traiteLe']: t });
    await bonusEssai(uid, droits);
    // Le parrain est prévenu (ex-déclencheur pushFilleulInscrit).
    await envoyerPush(parrain, { type: 'filleul', url: './?parrainage=1', tag: 'filleul-' + id,
      title: (nom ? nom + ' vient' : 'Ton filleul vient') + ' de s’inscrire avec ton code',
      body: 'Son premier paiement t’offrira 1 mois de RepCore.' });
    return { ok: true };
  }
  // ⚠ L'ESSAI DU FILLEUL NE PASSE PAS PAR droits/. La version Cloud Functions
  //   y posait `bonusEssaiJours` seul : un nœud sans palier, lu « aucun », qui
  //   fermait l'accès au moment même où le filleul utilisait un code ami.
  //   Le serveur léger n'écrit dans droits/ que des accès complets (palier et
  //   échéance, voir majDroits) ; l'essai, c'est l'app qui le donne à
  //   l'inscription (essaiOuvrir, bonusJours). Rien à faire ici.
  async function bonusEssai() { return null; }
  // LE PREMIER PAIEMENT D'UN FILLEUL : 1 mois au parrain. Idempotent.
  async function parrainagePaiement(cle, source) {
    const lien = await _val('parrainage/liens/' + cle);
    if (!lien || !lien.parrain || !lien.id) return null;
    const t = now();
    const prenom = await _lire(cle, 'fname');
    let res = null;
    const tx = await db.ref('parrainage/comptes/' + lien.parrain).transaction((compte) => {
      const c = compte || {};
      const p = P.premierPaiement(c, lien.id, t);
      if (!p) return undefined;
      res = p;
      const f = Object.assign({}, (c.filleuls || {})[lien.id], p.filleul);
      if (prenom && !f.prenom) f.prenom = String(prenom).slice(0, 24);
      const out = Object.assign({}, c, { moisGagnes: p.moisGagnes, payants: p.payants,
        filleuls: Object.assign({}, c.filleuls, { [lien.id]: f }) });
      if (p.mentor) out.mentorLe = t;
      return out;
    });
    if (!tx.committed || !res) return null;
    if (prenom) res.prenom = String(prenom).trim().slice(0, 24) || res.prenom;
    // LE MOIS OFFERT, CRÉDITÉ DANS LE DOSSIER (jamais dans droits/, voir
    // bonusEssai), et SANS JAMAIS RIEN RETIRER :
    //   · abonné qui a résilié (fin PayPal posée, pas encore atteinte) : sa fin recule d'un mois ;
    //   · accès daté sans fin PayPal (un mois déjà offert) : il s'allonge d'un mois ;
    //   · abonné en cours, athlète suivi, ou accès Ultime par un programme :
    //     le mois va en RÉSERVE — il s'ajoutera à la fin de son abonnement
    //     (paypal.js, fermerALaFin). Lui ouvrir Essentielle ferait descendre
    //     l'Ultime d'un programme, et un athlète suivi n'a rien à gagner ;
    //   · personne sans accès : un mois d'Essentielle s'ouvre tout de suite.
    const mode = await crediterMoisOffert(lien.parrain, t);
    // LA TRACE DU CRÉDIT, pour pouvoir le reprendre si ce paiement est
    // remboursé ou rétrofacturé (retirerMoisOffert) : à qui, et comment.
    await db.ref('parrainage/credits/' + cle).set({ parrain: lien.parrain, id: lien.id, mode, le: t });
    await db.ref('parrainage/evenements/' + lien.parrain).push().set({
      type: res.mentor ? 'mentor' : 'paiement', at: t, prenom: res.prenom, mois: 1, source: String(source || '') });
    const txt = P.textePaiement(res);
    await envoyerPush(lien.parrain, { type: 'filleul', url: './?parrainage=1', tag: 'filleul-paie-' + lien.id, title: txt.title, body: txt.body });
    return res;
  }

  async function crediterMoisOffert(parrain, t) {
    const [statut, paiementSt, ech, role, prog, finPaypal, d] = await Promise.all(['status', 'paymentStatus', 'accessExpiry', 'role',
      'programmesAchetes', 'abonnement/finAccesPaypal'].map((c) => _lire(parrain, c)).concat([lireDroits(parrain)]));
    if (role === 'coach') return 'coach';
    // UNE DETTE PASSE AVANT : un mois offert pour un filleul remboursé, déjà
    // consommé au moment du remboursement, se paie sur le mois suivant.
    const dette = await db.ref('parrainage/comptes/' + parrain + '/dette').transaction((n) => (Number(n) > 0 ? (Number(n) - 1 || null) : undefined));
    if (dette.committed) return 'dette_soldee';
    const e = Number(ech) || 0;
    const ultimeProgramme = !!(prog && typeof prog === 'object' && Object.values(prog).some((x) => x && Number(x.ouvertJusqu) > t));
    const b = 'users/' + parrain + '/';
    const fp = Number(finPaypal) || 0;
    const reserve = async () => {
      await db.ref('parrainage/comptes/' + parrain + '/moisEnReserve').transaction((n) => (Number(n) || 0) + 1);
      return 'reserve';
    };
    // ── droits/ D'ABORD, quand il porte un accès ouvert ──────────────────
    //   · daté (une résiliation, un mois déjà offert) : la date recule d'un mois ;
    //   · sans fin (abonnement en cours, accès posé à la main) : en réserve.
    // Le mois compté sur une fin PayPal est noté dans paypal_fins : si
    // l'abonnement repart avant la fin, il retourne en réserve (paypal.js).
    const pd = palierDroits(d, t);
    const de = Number(d && d.echeance) || 0;
    const manuel = !!(d && SOURCES_MAIN.indexOf(String(d.source)) >= 0);
    if (pd && pd !== 'aucun') {
      if (de > t && !manuel) {
        const fin = Math.max(de, e, fp) + MONTH_MS;
        await majDroits(parrain, () => ({ echeance: fin }));
        const maj = { [b + 'updatedAt']: t };
        if (e > 0) maj[b + 'accessExpiry'] = fin;
        if (fp > 0) maj[b + 'abonnement/finAccesPaypal'] = fin;
        await db.ref().update(maj);
        const paypal = fp > 0 || String(d.source) === 'paypal';
        if (paypal) await db.ref('paypal_fins/' + parrain).transaction((f) => (f ? Object.assign({}, f, { fin, moisRecules: (Number(f.moisRecules) || 0) + 1 }) : undefined));
        return paypal ? 'fin_reculee' : 'acces_prolonge';
      }
      return reserve();
    }
    if (!d) {
      // ── SANS NŒUD droits/ : l'ancien modèle, le temps de la transition ──
      // ⚠ « FIN RECULÉE » SEULEMENT SI PAYPAL A VRAIMENT POSÉ UNE FIN. Un
      //   accessExpiry seul (un mois déjà offert, un essai) n'est pas une
      //   résiliation : y écrire finAccesPaypal inventait une fin PayPal.
      if (statut === 'AUTONOMIE_PREMIUM' && paiementSt === 'active' && e > t && fp > 0) {
        const fin = Math.max(e, fp) + MONTH_MS;
        await db.ref().update({ [b + 'accessExpiry']: fin, [b + 'abonnement/finAccesPaypal']: fin, [b + 'updatedAt']: t });
        await db.ref('paypal_fins/' + parrain).transaction((f) => (f ? Object.assign({}, f, { fin, moisRecules: (Number(f.moisRecules) || 0) + 1 }) : undefined));
        return 'fin_reculee';
      }
      // Un accès daté qui ne vient pas de PayPal (mois déjà offert) : il s'allonge.
      if (statut === 'AUTONOMIE_PREMIUM' && paiementSt === 'active' && e > t) {
        await db.ref().update({ [b + 'accessExpiry']: e + MONTH_MS, [b + 'updatedAt']: t });
        return 'acces_prolonge';
      }
      if ((statut === 'AUTONOMIE_PREMIUM' && paiementSt === 'active') || statut === 'COACHING_SUIVI' || ultimeProgramme) return reserve();
    } else if (manuel || statut === 'COACHING_SUIVI' || ultimeProgramme) return reserve();
    // UN MOIS D'ESSENTIELLE S'OUVRE, dans droits/ (ce que l'app lit d'abord)
    // et dans le dossier (l'ancien modèle, pour les versions d'avant).
    const fin = Math.max(de, e, t) + MONTH_MS;
    await majDroits(parrain, (x) => ({ palier: 'essentielle', echeance: fin, source: 'parrainage', abo: (x && x.abo) || null }));
    await db.ref().update({ [b + 'status']: 'AUTONOMIE_PREMIUM', [b + 'paymentStatus']: 'active',
      [b + 'accessExpiry']: fin, [b + 'abonnement/formule']: 'essentielle',
      [b + 'abonnement/source']: 'parrainage', [b + 'updatedAt']: t });
    return 'mois_ouvert';
  }

  // ══ QUAND UN PREMIER PAIEMENT EST REMBOURSÉ OU RÉTROFACTURÉ ══════════════
  //
  // LE MOIS OFFERT AU PARRAIN EST REPRIS, s'il ne l'a pas encore consommé :
  //   · en réserve : il en sort ;
  //   · ajouté au bout d'un accès : retiré, si le mois entier est encore à
  //     venir (l'accès finit plus d'un mois après aujourd'hui) ;
  //   · sinon (commencé, ou déjà écoulé) : une DETTE d'un mois, soldée sur le
  //     prochain mois qu'il gagnera (crediterMoisOffert).
  // Le filleul repasse de « payant » à « rembourse » dans son compte.
  // Rend {parrain, resultat} ou null s'il n'y avait rien à reprendre.
  async function retirerMoisOffert(cleFilleul, t) {
    const c = await _val('parrainage/credits/' + cleFilleul);
    if (!c || !c.parrain || c.retireLe) return null;
    const parrain = c.parrain, b = 'users/' + parrain + '/';
    const garde = await db.ref('parrainage/credits/' + cleFilleul + '/retireLe').transaction((v) => (v ? undefined : t));
    if (!garde.committed) return null;
    const reserve = async () => (await db.ref('parrainage/comptes/' + parrain + '/moisEnReserve')
      .transaction((n) => (Number(n) >= 1 ? Number(n) - 1 : undefined))).committed;
    let resultat = 'rien';
    if (c.mode === 'coach') resultat = 'rien';
    else if (c.mode === 'dette_soldee') {
      await db.ref('parrainage/comptes/' + parrain + '/dette').transaction((n) => (Number(n) || 0) + 1);
      resultat = 'dette';
    } else if (c.mode === 'reserve') {
      resultat = (await reserve()) ? 'reserve_retiree' : 'dette';
    } else {
      // fin_reculee, acces_prolonge, mois_ouvert : un mois au bout de l'accès.
      const [ech, fp, dr] = await Promise.all([_lire(parrain, 'accessExpiry'), _lire(parrain, 'abonnement/finAccesPaypal'), lireDroits(parrain)]);
      const e = Math.max(Number(ech) || 0, Number(dr && dr.echeance) || 0);
      if (e - MONTH_MS > t) {
        const maj = { [b + 'updatedAt']: t };
        if (Number(ech) > 0) maj[b + 'accessExpiry'] = Number(ech) - MONTH_MS;
        if (Number(fp) > 0) maj[b + 'abonnement/finAccesPaypal'] = Number(fp) - MONTH_MS;
        await db.ref().update(maj);
        if (Number(dr && dr.echeance) > 0) await majDroits(parrain, (x) => ({ echeance: Number(x.echeance) - MONTH_MS }));
        await db.ref('paypal_fins/' + parrain).transaction((f) => (f ? Object.assign({}, f, { fin: Number(f.fin) - MONTH_MS,
          moisRecules: Math.max(0, (Number(f.moisRecules) || 0) - 1) }) : undefined));
        resultat = 'mois_retire';
      } else if (c.mode === 'fin_reculee' && !(Number(fp) > 0) && await reserve()) {
        resultat = 'reserve_retiree';     // l'abonnement était reparti : le mois était retourné en réserve
      } else resultat = 'dette';
    }
    if (resultat === 'dette' && c.mode !== 'dette_soldee')
      await db.ref('parrainage/comptes/' + parrain + '/dette').transaction((n) => (Number(n) || 0) + 1);
    await db.ref('parrainage/comptes/' + parrain).transaction((compte) => {
      if (!compte || !compte.filleuls || !compte.filleuls[c.id]) return undefined;
      const filleuls = Object.assign({}, compte.filleuls, { [c.id]: Object.assign({}, compte.filleuls[c.id], { statut: 'rembourse', annuleLe: t }) });
      return Object.assign({}, compte, { filleuls, moisGagnes: Math.max(0, (Number(compte.moisGagnes) || 0) - 1),
        payants: Object.keys(filleuls).filter((k) => filleuls[k] && filleuls[k].statut === 'payant').length });
    });
    await db.ref('parrainage/credits/' + cleFilleul + '/resultat').set(resultat);
    return { parrain, resultat };
  }

  // L'ÉTAT « PAYANT » DE L'ATTRIBUTION : retiré du dossier, et décompté du
  // jour où il avait été compté (écran « Viralité »).
  async function annulerAttribution(cle, t) {
    const origine = (await _val('users/' + cle + '/origine')) || {};
    const payeLe = Number(origine.payeLe);
    if (!(payeLe > 0)) return null;
    const lien = await _val('ambassadeurs_liens/' + cle);
    const o = Object.assign({}, origine, lien && lien.code ? { amb: lien.code } : {});
    for (const c of ATT.cheminsEvenement('payant', o, payeLe))
      await db.ref(c).transaction((n) => (Number(n) > 1 ? Number(n) - 1 : null));
    await db.ref().update({ ['users/' + cle + '/origine/payeLe']: null, ['users/' + cle + '/origine/annuleLe']: t });
    return { payeLe };
  }

  // ══ LA COMMISSION D'UNE VENTE : suspendue, rétablie, annulée, réduite ════
  // Retrouvée par ambassadeurs_ventes/<vente> (posé au paiement). Rend
  // {code, commission, avant, apres, dejaPayee} ou null (pas de commission).
  async function commissionVente(vente, action, o) {
    const id = String(vente || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
    const v = id ? await _val('ambassadeurs_ventes/' + id) : null;
    if (!v || !v.code || !v.mois || !v.pid) return null;
    const t = now();
    let out = null;
    const tx = await db.ref('ambassadeurs/' + v.code + '/commissions/' + v.mois + '/' + v.pid).transaction((x) => {
      if (!x) return undefined;
      const y = Object.assign({}, x);
      const avant = Number(x.commission) || 0;
      if (action === 'suspendre') {
        if (x.statut === 'annulee' || x.statut === 'rembourse' || x.statut === 'suspendue') return undefined;
        y.statutAvant = x.statut || null; y.statut = 'suspendue'; y.suspendueLe = t;
      } else if (action === 'retablir') {
        if (x.statut !== 'suspendue') return undefined;
        y.statut = x.statutAvant || null; y.statutAvant = null; y.suspendueLe = null;
      } else if (action === 'annuler') {
        if (x.statut === 'annulee' || x.statut === 'rembourse') return undefined;
        if (x.statut === 'payee' || x.statutAvant === 'payee') y.etaitPayee = true;
        y.statut = 'annulee'; y.statutAvant = null; y.annuleeLe = t;
      } else if (action === 'prorata') {
        const ref = String(o.ref || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60) || 'r';
        if (x.rembourses && x.rembourses[ref] !== undefined) return undefined;
        const initial = Number(x.montantInitial) || Number(x.montant) || 0;
        const rembourses = Object.assign({}, x.rembourses, { [ref]: Math.round(Number(o.montant) * 100) / 100 });
        const total = Object.values(rembourses).reduce((a, b) => a + (Number(b) || 0), 0);
        const net = Math.max(0, Math.round((initial - total) * 100) / 100);
        y.montantInitial = initial;
        y.commissionInitiale = Number(x.commissionInitiale) || avant;
        y.rembourses = rembourses; y.montant = net;
        y.commission = Math.round(net * (Number(x.pct) || 0)) / 100;
        if (net <= 0) { y.statut = 'annulee'; y.annuleeLe = t; }
        if (x.statut === 'payee') y.etaitPayee = true;
      } else return undefined;
      out = { code: v.code, mois: v.mois, avant, apres: Number(y.commission) || 0, statut: y.statut || 'attente', dejaPayee: !!y.etaitPayee };
      return y;
    });
    if (!tx.committed) return null;
    if (action === 'prorata') await db.ref('ambassadeurs/' + v.code + '/stats/ca')
      .transaction((n) => Math.max(0, Math.round(((Number(n) || 0) - (Number(o.montant) || 0)) * 100) / 100));
    await ambMajVue(v.code);
    return out;
  }

  // ══ LES AMBASSADEURS ═══════════════════════════════════════════════════
  async function ambConfig(code) {
    const a = await _val('ambassadeurs/' + code);
    if (!a || !a.nom) return null;
    const o = {};
    for (const k of ['nom', 'actif', 'commissionPct', 'palierPct', 'palierSeuil', 'dureeMois', 'secret'])
      if (a[k] !== null && a[k] !== undefined) o[k] = a[k];
    return o;
  }
  async function ambMajVue(code) {
    const a = await _val('ambassadeurs/' + code);
    if (!a || !/^[a-z0-9]{24}$/.test(String(a.secret || ''))) return null;
    const t = now();
    const cfg = A.config(a);
    const v = Object.assign(A.resume(code, a, t), { commissionPct: cfg.commissionPct, palierPct: cfg.palierPct,
      palierSeuil: cfg.palierSeuil, dureeMois: cfg.dureeMois, actif: cfg.actif, maj: t });
    await db.ref('ambassadeurs_vue/' + a.secret).set(v);
    return v;
  }
  const incr = (c) => db.ref(c).transaction((n) => (Number(n) || 0) + 1);
  async function ambassadeurDemande(uid, d) {
    const t = now();
    const code = String(d.code || '').toUpperCase();
    const dem = 'ambassadeurs_demandes/' + uid;
    const cfg = A.CODE_AMB_RE.test(code) ? await ambConfig(code) : null;
    const [lien, parrain, droits, creeLe] = await Promise.all([
      _val('ambassadeurs_liens/' + uid), _val('parrainage/liens/' + uid), lireDroits(uid), _lire(uid, 'createdAt')]);
    let raison = null;
    if (!cfg || cfg.actif === false) raison = 'code_inconnu';
    else if (lien) raison = 'deja_rattache';
    else if (parrain) raison = 'deja_parraine';
    else if (await dejaPaye(uid, droits)) raison = 'deja_client';
    else if (Number(creeLe) > 0 && t - Number(creeLe) > P.DELAI_RATTACHEMENT_MS) raison = 'compte_ancien';
    if (raison) { await db.ref(dem).update({ etat: 'refuse', raison, traiteLe: t }); return { ok: false, raison }; }
    const id = P.idFilleul(uid);
    await db.ref().update({
      ['ambassadeurs_liens/' + uid]: { code, id, le: t },
      ['ambassadeurs/' + code + '/filleuls/' + id]: { inscritLe: t },
      [dem + '/etat']: 'accepte', [dem + '/traiteLe']: t });
    await incr('ambassadeurs/' + code + '/stats/inscrits');
    await incr('attribution/jours/' + ATT.jourParis(t) + '/amb/' + code + '/inscription');
    await bonusEssai(uid, droits);
    await ambMajVue(code);
    return { ok: true };
  }
  async function ambassadeurPaiement(cle, p) {
    const lien = await _val('ambassadeurs_liens/' + cle);
    if (!lien || !lien.code || !lien.id) return null;
    const montant = Number(p && p.montant);
    if (!(montant > 0)) return null;
    const code = lien.code;
    const pid = A.idPaiement(Object.assign({}, p, { montant }));
    const vente = p.venteId ? String(p.venteId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60) : '';
    const tx = await db.ref('ambassadeurs_paiements/' + pid).transaction((cur) => (cur ? undefined : { code, le: now() }));
    if (!tx.committed) return null;
    const cfg = (await ambConfig(code)) || {};
    const fRef = 'ambassadeurs/' + code + '/filleuls/' + lien.id;
    const filleul = (await _val(fRef)) || {};
    let payants = Number(await _val('ambassadeurs/' + code + '/stats/payants')) || 0;
    if (!filleul.premierPaiement) {
      const r = await db.ref('ambassadeurs/' + code + '/stats/payants').transaction((n) => (Number(n) || 0) + 1);
      payants = Number(r.snapshot.val()) || payants + 1;
    }
    const le = Number(p.le) || now();
    await db.ref('ambassadeurs/' + code + '/stats/ca').transaction((n) => Math.round(((Number(n) || 0) + montant) * 100) / 100);
    const c = A.commissionPour(cfg, filleul, payants, { montant, le });
    const maj = {};
    if (!filleul.premierPaiement) maj[fRef + '/premierPaiement'] = le;
    if (c) {
      maj['ambassadeurs/' + code + '/commissions/' + c.mois + '/' + pid] = { filleul: lien.id, montant: c.montant, pct: c.pct,
        commission: c.commission, payeLe: c.payeLe, dueLe: c.dueLe };
      maj['ambassadeurs_paiements/' + pid + '/mois'] = c.mois;
      if (vente) maj['ambassadeurs_ventes/' + vente] = { code, mois: c.mois, pid };
    }
    if (Object.keys(maj).length) await db.ref().update(maj);
    await ambMajVue(code);
    return c;
  }
  // L'ancien point d'entrée (un remboursement, sans autre suite) : la
  // commission de la vente est annulée. paypal.js passe désormais par
  // commissionVente et les reprises ci-dessus.
  async function ambassadeurRemboursement(ress) {
    let id = String(ress.sale_id || '');
    if (!id && Array.isArray(ress.links)) {
      const up = ress.links.find((l) => l && l.rel === 'up');
      if (up && up.href) id = String(up.href).split('/').pop();
    }
    return commissionVente(id, 'annuler');
  }
  // LE PREMIER PAIEMENT pour l'écran « Viralité » : une seule fois.
  async function attributionPaiement(cle) {
    const t = now();
    const tx = await db.ref('users/' + cle + '/origine/payeLe').transaction((cur) => (cur ? undefined : t));
    if (!tx.committed) return null;
    const origine = (await _val('users/' + cle + '/origine')) || {};
    const lien = await _val('ambassadeurs_liens/' + cle);
    const o = Object.assign({}, origine, lien && lien.code ? { amb: lien.code } : {});
    for (const c of ATT.cheminsEvenement('payant', o, t)) await incr(c);
    return origine;
  }
  // Une vue coûte 2 requêtes : au-delà du budget, un ambassadeur par sous-tâche.
  async function ambassadeursQuotidien() {
    const codes = Object.keys((await _val('ambassadeurs_publics')) || {});
    for (let i = 0; i < codes.length; i++) {
      if (i > 0 && _reste() < 6) { await differer(codes.slice(i).map((code) => ({ quoi: 'amb_vue', code }))); return 'differe'; }
      try { await ambMajVue(codes[i]); } catch (e) { /* le suivant */ }
    }
    return codes.length;
  }

  // ══ L'ATTRIBUTION : l'arrivée par un lien ══════════════════════════════
  async function arrivee(q) {
    const t = now();
    for (const c of ATT.cheminsArrivee(q, t)) await incr(c);
    const amb = String(q.amb || '').toUpperCase();
    if (ATT.AMB_RE.test(amb)) {
      const cfg = await ambConfig(amb);
      if (cfg && cfg.actif !== false) await incr('ambassadeurs/' + amb + '/stats/clics');
    }
  }

  // ══ LES ÉVÉNEMENTS DÉPOSÉS PAR L'APP (/evenements) ═════════════════════
  // Chaque événement porte `par` (la clé de qui l'a déposé, contrôlée par
  // les règles). Le Worker VÉRIFIE ce qu'il annonce avant d'agir : il ne
  // croit pas un événement sur parole, il relit la base.
  async function evenement(e) {
    const t = now();
    const type = String(e && e.type || '');
    if (type === 'reponse_bilan' || type === 'reponse_rite') {
      const dest = String(e.dest || '');
      const i = String(e.i || '').replace(/[^A-Za-z0-9_-]/g, '');
      if (!dest || !i) return 'incomplet';
      if ((await _lire(dest, 'coachEmailKey')) !== e.par) return 'pas_son_coach';
      const rep = await _val('users/' + dest + '/' + (type === 'reponse_bilan' ? 'bilans' : 'rites') + '/' + i + '/reponseCoach');
      if (!rep) return 'sans_reponse';
      await envoyerPush(dest, { type: 'coach', url: './', tag: 'coach-' + (type === 'reponse_bilan' ? 'bilan' : 'rite') + '-' + i,
        title: type === 'reponse_bilan' ? 'Ton coach a répondu à ton bilan' : 'Ton coach a répondu à ton bilan de cycle',
        body: String(rep).slice(0, 120) });
      return 'envoye';
    }
    if (type === 'defi_publie') {
      const coach = String(e.par || ''), msg = String(e.msg || '').replace(/[^A-Za-z0-9_-]/g, '');
      const m = msg ? await _val('canaux/' + coach + '/messages/' + msg) : null;
      if (!m || m.type !== 'defi') return 'pas_un_defi';
      const obj = D.texteObjectif(m);
      const fin = Number(m.fin) ? new Date(Number(m.fin)).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' }) : '';
      const annuaire = await db.ref('annuaire_coach/' + coach).shallow();
      const message = { type: 'defi', url: './?canal=1', tag: 'defi-' + msg,
        title: 'Nouveau défi : ' + String(m.titre || 'ton coach te lance un défi').slice(0, 60),
        body: (m.collectif ? 'En équipe : ' : 'Objectif : ') + obj + (fin ? ' d’ici le ' + fin : '') + '. Tu le relèves ?' };
      const r = await pousserA(annuaire.map((uid) => ({ uid, message })));
      return r.differes ? 'differe' : 'envoye';
    }
    if (type === 'defi_maj') {
      const coach = String(e.coach || ''), id = String(e.id || '').replace(/[^A-Za-z0-9_-]/g, '');
      const m = id ? await _val('canaux/' + coach + '/messages/' + id) : null;
      if (!m || m.type !== 'defi') return 'pas_un_defi';
      const etat = (await _val(defiChemin(coach, id, 'etat'))) || {};
      if (etat.clos) return 'clos';
      await recalculerDefi(coach, Object.assign({}, m, { id }), t);
      return 'recalcule';
    }
    return 'type_inconnu';
  }

  // ══ UNE SOUS-TÂCHE (écrite par differer, jamais par l'app : les règles
  // refusent le type « tache » à un client) ══════════════════════════════
  async function tache(e) {
    const quoi = String((e && e.quoi) || '');
    if (quoi === 'push') {
      const uid = String(e.uid || ''), m = e.message || {};
      // Une série en danger mise de côté la nuit ne part pas si la semaine a
      // été validée entre-temps.
      if (m.type === 'serie' && m.semaine && (await _lire(uid, 'streakWeek')) === m.semaine) return 'semaine_validee';
      const r = await envoyerPush(uid, m, e.attendre === false ? { attendre: false } : undefined);
      return r.envoye ? 'envoye' : (r.raison || 'rien');
    }
    if (quoi === 'amb_vue') { await ambMajVue(String(e.code || '')); return 'vue'; }
    if (quoi === 'defis_coach') return defisQuotidienCoach(String(e.coach || ''), now());
    return 'tache_inconnue';
  }

  return { envoyerPush, abonnes, prechargerPush, planifies, apresHeuresCalmes, statsBadgesUn, statsBadgesFin,
    defisQuotidienCoach, coachsAvecCanal, recalculerDefi, parrainageDemande, parrainagePaiement,
    ambassadeurDemande, ambassadeursQuotidien, arrivee, evenement, lireDroits, majDroits, palierDroits,
    crediterMoisOffert, ambassadeurPaiement, ambassadeurRemboursement, attributionPaiement,
    retirerMoisOffert, annulerAttribution, commissionVente,
    fixerBudget, reste, peutPousser, chiffrements, differer, pousserA, tache };
}
