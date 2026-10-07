// ══ LE SUPPORT DU CRÉATEUR (build 1876) ══════════════════════════════════════
//
// Toute réparation (bilan à rouvrir, programme à restaurer, doublon, retrait
// du suivi fait par erreur) se faisait à la main dans la console Firebase.
// Cette route les fait par le Worker, avec un journal.
//
// ⚠ RÉSERVÉ AU CRÉATEUR : l'UID ET l'adresse vérifiée (estCreateur), et
//   l'adresse égale à CREATOR_EMAIL. Jamais l'adresse seule.
// ⚠ CHAQUE ACTION ÉCRIT support_log/<id> = {le, action, email, avant, apres},
//   des RÉSUMÉS — jamais le dossier entier, jamais une photo.
// ⚠ LE WORKER ÉCRIT (compte de service) ; les règles ouvrent support_log et
//   support_tickets en LECTURE au créateur seul, en écriture à personne.
//
// signalerProbleme : n'importe quel compte connecté dépose un ticket
// (support_tickets) avec un diagnostic borné ; un par minute au plus.
import { ErreurAppel } from './appels.js';
import { CREATOR_EMAIL } from './metier.js';
import { estCreateur } from './createur.js';

export const SUPPORT_CORBEILLE_JOURS = 30;
export const SUPPORT_HISTO_MAX = 15;
export const TICKET_TEXTE_MAX = 2000;
export const TICKET_DIAG_MAX = 6000;
export const TICKET_INTERVALLE_MS = 60000;
const ACTIONS = ['lire', 'rouvrirBilan', 'restaurerProgramme', 'retirerDoublonBilan', 'rattacher', 'exporter', 'journal', 'tickets'];
const VUES = ['face', 'back', 'side'];

export const cleEmail = (e) => String(e || '').trim().toLowerCase().replace(/\./g, ',');
// Même identifiant que l'app (_idBilan) : b.id, sinon 'bil_'+date.
export const idBilan = (b) => b && (b.id || ('bil_' + b.date));
// Même clé que les pierres tombales de l'app (syncFusion) : date|type.
const tombeBilan = (b) => String(b && b.date) + '|' + String((b && b.type) || '');
const enTableau = (x) => Array.isArray(x) ? x : (x && typeof x === 'object' ? Object.values(x) : []);

export function estAdminSupport(auth) {
  return !!auth && estCreateur(auth) && String(auth.email || '').toLowerCase() === CREATOR_EMAIL.toLowerCase();
}

// Le dossier allégé : ce qu'il faut pour réparer, sans photo ni texte de santé.
export function resumeDossier(u, cle, extra) {
  const x = u || {};
  const bilans = enTableau(x.bilans).map((b, i) => ({ i, id: idBilan(b), date: b && b.date, type: (b && b.type) || 'coaching',
    photos: VUES.filter((v) => b && ((b.photos && b.photos[v]) || b['bil-photo-' + v] || b['deb-photo-' + v])).length,
    repondu: !!(b && (b.reponseCoach || (b.reponseAudio && b.reponseAudio.url))),
    aCompleter: !!(b && b.aCompleter) })).slice(-12);
  const historique = enTableau(x.sessions_config_history).map((e, index) => ({ index, ts: e && e.ts, motif: (e && e.motif) || '' }));
  return Object.assign({ cle, email: x.email || cle.replace(/,/g, '.'), fname: x.fname || '', lname: x.lname || '', role: x.role || '',
    coach: x.coachEmailKey || null, coachId: x.coachId || null, status: x.status || null, paymentStatus: x.paymentStatus || null,
    updatedAt: x.updatedAt || null, seances: enTableau(x.sessions).length, bilans, historique }, extra || {});
}

export function creerSupport({ db, maintenant, estAdmin }) {
  const now = maintenant || (() => Date.now());
  const admin = estAdmin || estAdminSupport;

  async function journal(action, email, avant, apres) {
    await db.ref('support_log').push().set({ le: now(), action, email: email || null, avant: avant || null, apres: apres || null });
  }
  async function dossier(email) {
    const cle = cleEmail(email);
    if (!cle || cle.length > 200) throw new ErreurAppel(400, 'Adresse manquante.');
    const u = (await db.ref('users/' + cle).get()).val();
    if (!u) throw new ErreurAppel(404, 'Aucun dossier pour cette adresse.');
    return { cle, u };
  }
  function bilanDe(u, bilanId) {
    const l = enTableau(u.bilans);
    const i = l.findIndex((b) => idBilan(b) === bilanId);
    if (i < 0) throw new ErreurAppel(404, 'Bilan introuvable.');
    return { l, i, b: l[i] };
  }

  async function support({ auth, data }) {
    if (!admin(auth)) throw new ErreurAppel(403, 'Réservé au créateur.');
    const d = data || {};
    const action = String(d.action || '');
    if (ACTIONS.indexOf(action) < 0) throw new ErreurAppel(400, 'Action inconnue.');
    const t = now();

    if (action === 'journal' || action === 'tickets') {
      const r = (await db.ref(action === 'journal' ? 'support_log' : 'support_tickets').orderByKey().limitToLast(50).get()).val() || {};
      return Object.entries(r).map(([id, v]) => Object.assign({ id }, v)).reverse();
    }

    const { cle, u } = await dossier(d.email);

    if (action === 'lire') {
      const droits = (await db.ref('droits/' + cle).get()).val();
      const ev = (await db.ref('evenements').get()).val() || {};
      const attente = Object.entries(ev).filter(([, v]) => v && (v.dest === cle || v.par === cle)).map(([id, v]) => ({ id, type: v.type, at: v.at }));
      await journal('lire', cle, null, null);
      return resumeDossier(u, cle, { droits: droits || null, evenementsEnAttente: attente });
    }

    if (action === 'exporter') {
      await journal('exporter', cle, null, { octets: JSON.stringify(u).length });
      return u;
    }

    if (action === 'rouvrirBilan') {
      const { i, b } = bilanDe(u, String(d.bilanId || ''));
      const vues = enTableau(d.vues).filter((v) => VUES.indexOf(v) >= 0);
      const dem = { vues: vues.length ? vues : VUES.slice(), mesures: [], note: '', le: t, par: 'support' };
      const avant = { aCompleter: !!b.aCompleter };
      await db.ref('users/' + cle + '/bilans/' + i + '/aCompleter').set(dem);
      await db.ref('users/' + cle + '/updatedAt').set(t);
      await journal('rouvrirBilan', cle, avant, { bilan: idBilan(b), vues: dem.vues });
      return { ok: true, vues: dem.vues };
    }

    if (action === 'restaurerProgramme') {
      const h = enTableau(u.sessions_config_history);
      const k = Number(d.index);
      const e = h[k];
      if (!e || !e.sessions_config) throw new ErreurAppel(404, 'Version introuvable.');
      // L'état courant d'abord, dans l'historique : la restauration se défait.
      const neuf = [{ ts: t, motif: 'restauration', sessions_config: u.sessions_config || [] }].concat(h).slice(0, SUPPORT_HISTO_MAX);
      await db.ref('users/' + cle).update({ sessions_config: e.sessions_config, sessions_config_history: neuf, updatedAt: t });
      await journal('restaurerProgramme', cle, { versions: h.length }, { depuis: e.ts || null, motif: e.motif || '' });
      return { ok: true };
    }

    if (action === 'retirerDoublonBilan') {
      const { l, i, b } = bilanDe(u, String(d.bilanId || ''));
      const id = idBilan(b);
      await db.ref('support_corbeille/' + cle + '/' + String(id).replace(/[.#$\[\]\/]/g, '_')).set({ le: t, expire: t + SUPPORT_CORBEILLE_JOURS * 864e5, bilan: b });
      const reste = l.filter((_, j) => j !== i);
      await db.ref('users/' + cle).update({ bilans: reste, updatedAt: t, ['supprimes/bilans/' + tombeBilan(b).replace(/[.#$\[\]\/]/g, '_')]: t });
      await journal('retirerDoublonBilan', cle, { bilans: l.length }, { bilans: reste.length, retire: id });
      return { ok: true };
    }

    if (action === 'rattacher') {
      const cc = cleEmail(d.coachEmail);
      const c = cc ? (await db.ref('users/' + cc).get()).val() : null;
      if (!c || c.role !== 'coach') throw new ErreurAppel(404, 'Coach introuvable.');
      const avant = { coach: u.coachEmailKey || null };
      await db.ref('users/' + cle).update({ coachEmailKey: cc, coachId: c.id || null, coachName: String((c.fname || '') + ' ' + (c.lname || '')).trim() || null, updatedAt: t });
      await journal('rattacher', cle, avant, { coach: cc });
      return { ok: true };
    }
    throw new ErreurAppel(400, 'Action inconnue.');
  }

  // Le ticket : un texte, un diagnostic borné, l'adresse du jeton.
  async function signalerProbleme({ auth, data }) {
    const cle = cleEmail(auth && auth.email);
    if (!cle) throw new ErreurAppel(401, 'Connecte-toi.');
    const d = data || {};
    const texte = String(d.texte || '').trim().slice(0, TICKET_TEXTE_MAX);
    if (!texte) throw new ErreurAppel(400, 'Décris le problème.');
    const t = now();
    const der = (await db.ref('support_tickets_dernier/' + cle).get()).val();
    if (der && t - Number(der) < TICKET_INTERVALLE_MS) throw new ErreurAppel(429, 'Un signalement vient de partir : attends une minute.');
    let diag = null;
    try { const s = JSON.stringify(d.diag || null); diag = s && s.length <= TICKET_DIAG_MAX ? JSON.parse(s) : { tronque: true }; } catch (e) { diag = null; }
    await db.ref('support_tickets').push().set({ le: t, email: cle, texte, diag });
    await db.ref('support_tickets_dernier/' + cle).set(t);
    return { ok: true };
  }

  return { support, signalerProbleme };
}
