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
export const PUSH_TYPES = ['serie', 'wrapped', 'bilan', 'badge', 'coach', 'filleul', 'defi'];
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

/**
 * @param {{db:any, vapid:{publique:string, privee:string}, fetchImpl?:Function, maintenant?:()=>number}} deps
 */
export function creerMetier(deps) {
  const { db } = deps;
  const now = deps.maintenant || (() => Date.now());
  const _val = async (c) => (await db.ref(c).get()).val();
  const _lire = (uid, champ) => _val('users/' + uid + '/' + champ);

  // ── LES DROITS (palier, échéance) — écrits par le serveur seul ──────────
  async function lireDroits(cle) { return _val('droits/' + cle); }
  async function ecrireDroits(cle, champs) {
    const patch = Object.assign({}, champs || {}, { maj: now() });
    if (patch.palier !== undefined) patch.palier = PALIERS.indexOf(String(patch.palier)) > 0 ? String(patch.palier) : 'aucun';
    if (patch.echeance !== undefined) patch.echeance = Number(patch.echeance) || 0;
    await db.ref('droits/' + cle).update(patch);
    return patch;
  }

  // ══ WEB PUSH ═══════════════════════════════════════════════════════════
  async function envoyerPush(uid, message, o) {
    const t = now();
    const type = String((message && message.type) || '');
    const [prefs, log] = await Promise.all([_lire(uid, 'pushPrefs'), _val('push_log/' + uid)]);
    const ok = pushAutorise(type, prefs, log, t);
    if (!ok.ok) {
      if (ok.raison === 'calme' && (!o || o.attendre !== false))
        await db.ref('push_attente/' + uid).set(Object.assign({}, message, { at: t }));
      return { envoye: 0, raison: ok.raison };
    }
    const subs = (await _val('push/' + uid)) || {};
    const ids = Object.keys(subs);
    if (!ids.length) return { envoye: 0, raison: 'aucun_abonnement' };
    const jour = paris(t).jour;
    const tx = await db.ref('push_log/' + uid).transaction((cur) => (cur && cur.jour === jour) ? undefined : { jour, at: t, type });
    if (!tx.committed) return { envoye: 0, raison: 'plafond' };
    const charge = JSON.stringify({ title: message.title, body: message.body || '',
      url: message.url || './', tag: message.tag || ('rc-' + type), type });
    let envoye = 0;
    await Promise.all(ids.map(async (id) => {
      const s = subs[id];
      if (!s || !s.endpoint || !s.keys) return;
      try {
        const r = await envoyerA(s, charge, { publique: deps.vapid.publique, privee: deps.vapid.privee,
          contact: 'mailto:' + CREATOR_EMAIL, fetchImpl: deps.fetchImpl });
        if (r.statut >= 200 && r.statut < 300) envoye++;
        else if (r.statut === 404 || r.statut === 410) await db.ref('push/' + uid + '/' + id).remove();
      } catch (e) { /* un appareil injoignable n'arrête pas les autres */ }
    }));
    if (!envoye) await db.ref('push_log/' + uid).remove();
    return { envoye, raison: envoye ? null : 'echec' };
  }
  const abonnes = () => db.ref('push').shallow();

  // ── LES RAPPELS PLANIFIÉS — UNE PERSONNE À LA FOIS ─────────────────────
  // Chacun rend la même chose : il traite UNE clé. Le découpage en lots et le
  // curseur sont dans planif.js.
  const planifies = {
    // Série en danger : jeudi 18 h.
    async serie(uid, t) {
      const lundi = lundiParis(t);
      const [streak, semaine, susp, fname, jokers] = await Promise.all(['streak', 'streakWeek', 'suspension', 'fname', 'streakJokers'].map((c) => _lire(uid, c)));
      if (!(Number(streak) > 0) || semaine === lundi || (susp && susp.actif)) return;
      const n = Number(streak);
      await envoyerPush(uid, { type: 'serie', url: './?wo=1', tag: 'serie-' + lundi + '-jeu',
        title: 'Ta série de ' + n + ' semaine' + (n > 1 ? 's' : '') + ' est en danger',
        body: (fname ? fname + ', il' : 'Il') + ' te reste jusqu’à dimanche pour valider ta semaine.'
          + (Number(jokers) > 0 ? ' Ton joker la sauverait, mais garde-le pour un vrai coup dur.' : '') }, { attendre: false });
    },
    // Wrapped prêt : le 1er du mois, 10 h — pour qui s'est entraîné le mois écoulé.
    async wrapped(uid, t) {
      const p = paris(t);
      const moisPrec = p.mois === 1 ? 12 : p.mois - 1, anPrec = p.mois === 1 ? p.annee - 1 : p.annee;
      const debut = Date.UTC(anPrec, moisPrec - 1, 1) - 2 * 3600e3;
      const cle = 'm-' + anPrec + '-' + String(moisPrec).padStart(2, '0');
      const nom = new Date(Date.UTC(anPrec, moisPrec - 1, 15)).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Europe/Paris' });
      const der = Number(await _lire(uid, 'lastSession')) || 0;
      if (der < debut) return;
      await envoyerPush(uid, { type: 'wrapped', url: './?wrapped=' + cle, tag: 'wrapped-' + cle,
        title: 'Ton mois de ' + nom + ' est prêt', body: 'Tes chiffres, tes records et ton profil t’attendent.' });
    },
    // Rappel de bilan : samedi 10 h, dernier bilan vieux de 13 jours ou plus.
    async bilan(uid, t) {
      if ((await _lire(uid, 'role')) === 'coach') return;
      const s = await db.ref('users/' + uid + '/bilans').orderByKey().limitToLast(1).get();
      let der = 0; s.forEach((c) => { der = Number((c.val() || {}).date) || 0; });
      if (der && t - der < 13 * 864e5) return;
      const fname = await _lire(uid, 'fname');
      await envoyerPush(uid, { type: 'bilan', url: './?bilan=1', tag: 'bilan-' + paris(t).jour,
        title: 'C’est l’heure de ton bilan', body: (fname ? fname + ', 10' : '10') + ' minutes quand tu as le temps ce week-end.' });
    },
    // Badge proche : dimanche 17 h — ASSIDU à deux séances ou moins.
    async badge(uid) {
      const n = (await db.ref('users/' + uid + '/sessions').shallow()).length;
      const SEUILS = [10, 50, 100, 250];
      const seuil = SEUILS.find((x) => x > n);
      if (!seuil || seuil - n > 2) return;
      const reste = seuil - n, palier = ['I', 'II', 'III', 'IV'][SEUILS.indexOf(seuil)];
      await envoyerPush(uid, { type: 'badge', url: './', tag: 'badge-assidu-' + palier,
        title: 'Encore ' + reste + ' séance' + (reste > 1 ? 's' : '') + ' pour ASSIDU ' + palier,
        body: 'Le badge est à portée de main cette semaine.' });
    },
  };
  // Les messages mis de côté pendant la nuit : 8 h 05.
  async function apresHeuresCalmes() {
    const tout = (await _val('push_attente')) || {};
    for (const uid of Object.keys(tout)) {
      const m = tout[uid];
      await db.ref('push_attente/' + uid).remove();
      if (!m || now() - (Number(m.at) || 0) > 12 * 3600e3) continue;
      await envoyerPush(uid, m, { attendre: false });
    }
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
  async function defisQuotidienCoach(coach, t) {
    const jour = paris(t).jour;
    for (const defi of await defisDuCoach(coach)) {
      const etat = (await _val(defiChemin(coach, defi.id, 'etat'))) || {};
      if (etat.clos || t < Number(defi.debut)) continue;
      if (t > Number(defi.fin)) {
        if (etat.dernierSysteme !== jour) await cloturer(coach, defi, t);
        continue;
      }
      if (Number(defi.fin) - t <= 48 * 3600e3 && !etat.rappel48) {
        const parts = await participants(coach, defi);
        for (const p of parts.filter((x) => !x.termine))
          await envoyerPush(p.cle, { type: 'defi', url: './?canal=1', tag: 'defi-48h-' + defi.id,
            title: 'Plus que 48 h : ' + String(defi.titre || 'ton défi').slice(0, 60),
            body: 'Objectif : ' + D.texteObjectif(defi) + '. Tu en es à ' + String(p.valeur).replace('.', ',') + '.' }, { attendre: false });
        await db.ref(defiChemin(coach, defi.id, 'etat/rappel48')).set(true);
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
      dejaPaye: !!(droits && /^paypal/.test(String(droits.source || ''))) });
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
  // ⚠ LE SERVEUR LÉGER N'ÉCRIT JAMAIS DANS droits/ (27/09/2026).
  //   Dans l'app, un nœud droits/ qui porte QUOI QUE CE SOIT prime sur le
  //   dossier (droitsDe, palierDe). La version Cloud Functions y posait
  //   `bonusEssaiJours` chez le filleul : son nœud devenait non vide, sans
  //   palier, donc « aucun » — le filleul PERDAIT son essai au moment même où
  //   il utilisait un code ami. Et le mois offert au parrain y posait
  //   « essentielle » pour un mois : un parrain abonné Ultime dans son
  //   dossier était rétrogradé, puis coupé à la fin du mois.
  //   LE MOIS D'ESSAI DU FILLEUL, c'est l'app qui le donne à l'inscription
  //   (essaiOuvrir, bonusJours). Rien à faire ici.
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
    // LE MOIS OFFERT N'EST PAS ÉCRIT DANS droits/ (voir bonusEssai) : il est
    // compté ici (moisGagnes) et annoncé (événement, push). Son crédit sur
    // l'accès se branchera avec les paiements PayPal.
    await db.ref('parrainage/evenements/' + lien.parrain).push().set({
      type: res.mentor ? 'mentor' : 'paiement', at: t, prenom: res.prenom, mois: 1, source: String(source || '') });
    const txt = P.textePaiement(res);
    await envoyerPush(lien.parrain, { type: 'filleul', url: './?parrainage=1', tag: 'filleul-paie-' + lien.id, title: txt.title, body: txt.body });
    return res;
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
    else if (droits && /^paypal/.test(String(droits.source || ''))) raison = 'deja_client';
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
  async function ambassadeursQuotidien() {
    const tous = (await _val('ambassadeurs_publics')) || {};
    for (const code of Object.keys(tous)) { try { await ambMajVue(code); } catch (e) { /* le suivant */ } }
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
      for (const uid of annuaire)
        await envoyerPush(uid, { type: 'defi', url: './?canal=1', tag: 'defi-' + msg,
          title: 'Nouveau défi : ' + String(m.titre || 'ton coach te lance un défi').slice(0, 60),
          body: (m.collectif ? 'En équipe : ' : 'Objectif : ') + obj + (fin ? ' d’ici le ' + fin : '') + '. Tu le relèves ?' });
      return 'envoye';
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

  return { envoyerPush, abonnes, planifies, apresHeuresCalmes, statsBadgesUn, statsBadgesFin,
    defisQuotidienCoach, coachsAvecCanal, recalculerDefi, parrainageDemande, parrainagePaiement,
    ambassadeurDemande, ambassadeursQuotidien, arrivee, evenement, lireDroits, ecrireDroits };
}
