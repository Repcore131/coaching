/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
'use strict';
// ══ FIT PULSE : catalogue des notifications commerciales ═════════════════
// Une table, lue par l'appli (Profil > Notifications, exemples) et par le
// serveur d'envoi (outils/fitpulse-push.mjs charge ce même code) : les
// déclencheurs utilisent les fonctions de l'interface (ranking, palierState,
// myToDo, dailyGoals). Chaque notification ouvre l'écran indiqué par url.
// Jamais de montant d'impayé ni de nom de client : « 1 relance due ».
// detect(ctx) renvoie les occurrences du moment ; ctx = { uid, jour, hm, last, W }
// avec W l'état mémorisé pour ce compte (rang, bravos, paliers proches).
const entre = (hm, de, a) => hm >= de && hm < a;
const NOTIF_TYPES = {
  dayStart: { label: 'Début de journée, 8 h 30', ex: '3 objectifs aujourd’hui, 2 relances dues.', defaultOn: true, priority: 'normal', cooldownMin: 720,
    detect: c => (entre(c.hm, '08:30', '09:30') ? [{ key: 'ds_' + c.jour, n: dailyGoals(c.uid).filter(g => !g.done).length, r: relQueue(CLUB.id, 'mine').now.length }] : []),
    build: p => ({ title: 'Votre journée', body: `${plur(p.n, 'objectif', 'objectifs')} aujourd’hui${p.r ? `, ${plur(p.r, 'relance due', 'relances dues')}` : ''}.`, url: '#/home' }) },
  dueFollowup: { label: 'Relances dues', ex: '1 relance due.', defaultOn: true, priority: 'high', cooldownMin: 240,
    detect: c => { if (!(entre(c.hm, '10:30', '11:30') || entre(c.hm, '15:30', '16:30'))) return []; const n = relQueue(CLUB.id, 'mine').now.length; return n ? [{ key: `due_${c.jour}_${c.hm < '12:00' ? 'm' : 'a'}`, n }] : []; },
    build: p => ({ title: 'Relances', body: `${plur(p.n, 'relance due', 'relances dues')}.`, url: '#/relances' }) },
  overtaken: { label: 'Un collègue passe devant vous (à 1 vente près)', ex: 'Lucas est passé devant vous, à 1 contrat près.', defaultOn: true, priority: 'normal', cooldownMin: 1440,
    detect: c => {
      const mk = c.jour.slice(0, 7); const rk = ranking(CLUB.id, rangeOf('month', mk)).filter(x => x.score != null); const i = rk.findIndex(x => x.u.id === c.uid);
      const R0 = c.W.rank; c.W.rank = i < 0 ? null : { mk, rank: i + 1, devant: rk.slice(0, i).map(x => x.u.id) };
      if (i < 0 || !R0 || R0.mk !== mk || i + 1 <= R0.rank) return [];
      const qui = rk.slice(0, i).map(x => x.u.id).find(id => !(R0.devant || []).includes(id)); if (!qui) return [];
      // l'écart sur le KPI le plus proche (en quantités) : au plus 1
      let best = null; for (const k of kpiList().filter(k => k.required && k.unit === 'qty')) { const d = Math.abs(sumRange(CLUB.id, qui, k.id, mk + '-01', c.jour) - sumRange(CLUB.id, c.uid, k.id, mk + '-01', c.jour)); if (!best || d < best.d) best = { d, k }; }
      return best && best.d <= 1 ? [{ key: 'ov_' + c.jour, qui: S.users[qui].first, k: best.k.id, d: best.d }] : [];
    },
    build: p => ({ title: 'Classement', body: `${p.qui} est passé devant vous${p.d ? `, à ${fmtU(p.d, S.kpis[p.k])} près` : ', à égalité'}.`, url: '#/leaderboard' }) },
  challengeStart: { label: 'Défi lancé', ex: 'Défi Sprint avis lancé, fin dans 3 heures.', defaultOn: true, priority: 'normal', cooldownMin: 0,
    detect: c => Object.values(S.challenges || {}).filter(ch => ch.clubId === CLUB.id && ch.start > c.last && ch.start <= Date.now() && ch.end > Date.now() && ch.by !== c.uid).map(ch => ({ key: 'ch_' + ch.id, t: ch.title || 'Défi', end: ch.end })),
    build: p => ({ title: 'Défi lancé', body: `${p.t}, fin dans ${finDans(p.end)}.`, url: '#/leaderboard' }) },
  kudos: { label: 'Félicitations et bravos reçus', ex: '2 félicitations reçues.', defaultOn: true, priority: 'normal', cooldownMin: 60,
    detect: c => {
      let n = 0, max = Number(c.W.kudosAt || 0);
      for (const [eid, rx] of Object.entries(S.reactions || {})) { const e = S.entries[eid]; if (!e || e.userId !== c.uid) continue; for (const [u, v] of Object.entries((rx || {}).bravo || {})) if (u !== c.uid && typeof v === 'number' && v > Number(c.W.kudosAt || 0)) { n++; max = Math.max(max, v); } }
      for (const k of Object.values(S.kudos || {})) if (k && k.to === c.uid && k.at > Number(c.W.kudosAt || 0)) { n++; max = Math.max(max, k.at); }
      if (c.W.kudosAt == null) { c.W.kudosAt = max || Date.now(); return []; } // premier passage : point de départ
      c.W.kudosAt = max; return n ? [{ key: 'kd_' + max, n }] : [];
    },
    build: p => ({ title: 'Bravo', body: `${plur(p.n, 'félicitation reçue', 'félicitations reçues')}.`, url: '#/pouls' }) },
  kudosRappel: { label: 'Rappel du vendredi : féliciter l’équipe (managers)', ex: 'Personne n’a été félicité cette semaine.', defaultOn: true, priority: 'normal', cooldownMin: 1440,
    detect: c => { const u = S.users[c.uid]; if (!u || (u.role !== 'manager' && u.role !== 'createur') || dateOf(c.jour).getDay() !== 5 || !entre(c.hm, '16:00', '17:00')) return []; const lundi = dateOf(weekStart(c.jour)).getTime(); return Object.values(S.kudos || {}).some(k => k && k.from === c.uid && k.at >= lundi) ? [] : [{ key: 'kr_' + c.jour }]; },
    build: () => ({ title: 'Équipe', body: 'Personne n’a été félicité cette semaine.', url: '#/home' }) },
  palierNear: { label: 'Palier d’équipe tout proche (5 % ou moins)', ex: 'Palier 2 : plus que 4 contrats pour l’équipe.', defaultOn: true, priority: 'normal', cooldownMin: 0,
    detect: c => {
      const mk = c.jour.slice(0, 7); const out = [];
      for (const k of Object.keys(paliersFor(CLUB.id, mk))) { const s = palierState(CLUB.id, mk, k); if (!s || !s.next || !S.kpis[k]) continue; const reste = s.next.target - s.real; if (reste > 0 && reste <= 0.05 * s.next.target) out.push({ key: `pn_${CLUB.id}_${mk}_${k}_${s.reached + 1}`, n: s.reached + 1, k, reste: Math.ceil(reste) }); }
      return out;
    },
    build: p => ({ title: 'Palier tout proche', body: `Palier ${p.n} : plus que ${fmtU(p.reste, S.kpis[p.k])} pour l’équipe.`, url: '#/home' }) },
  dayWrap: { label: 'Fin de journée, 19 h', ex: 'Journée : 2 objectifs sur 3. Série : 12 jours travaillés.', defaultOn: true, priority: 'normal', cooldownMin: 720,
    detect: c => (entre(c.hm, '19:00', '20:00') ? [{ key: 'dw_' + c.jour, f: dailyGoals(c.uid).filter(g => g.done).length, s: serieJours(c.uid).n }] : []),
    build: p => ({ title: 'Votre journée', body: `Journée : ${p.f} ${p.f > 1 ? 'objectifs' : 'objectif'} sur 3. ${serieTexte({ n: p.s })}.`, url: '#/home' }) },
  wrapReady: { label: 'Bilan du mois prêt', ex: 'Votre bilan de septembre est prêt.', defaultOn: true, priority: 'normal', cooldownMin: 0,
    detect: c => { if (Number(c.jour.slice(8)) !== 1 || !entre(c.hm, '09:00', '12:00')) return []; const mk = addMonths(c.jour.slice(0, 7), -1); return [{ key: 'wr_' + mk, mk, uid: c.uid }]; },
    build: p => ({ title: 'Bilan du mois', body: `Votre bilan de ${MOIS[Number(p.mk.slice(5)) - 1].toLowerCase()} est prêt.`, url: `#/wrap/${p.mk}/${p.uid}` }) },
};
// Réglage du compte : un type est actif sauf s'il a été décoché (ou mis en pause faute d'ouverture).
const typeActif = (uid, type) => { const r = ((((S.prefs || {})[uid] || {}).notif || {}).rules || {})[type]; return r === undefined ? NOTIF_TYPES[type].defaultOn : r !== false; };
// Jour de repos d'un compte : aucun envoi ce jour-là.
const jourDeRepos = (uid, clubId, jour) => !!deepGet(S, ['absences', uid, jour]) || !isWorkday(jour, clubId) || (typeof estFerie === 'function' && estFerie(jour)) || (typeof jourReposHabituel === 'function' && jourReposHabituel(uid, jour));

// Évalué par le serveur pour chaque compte : occurrences construites (titre, texte, écran).
function notifCatalogue(uid, { jour = today(), hm, last = 0, W = {} } = {}) {
  const u = S.users[uid]; if (!u) return { items: [], W };
  const club = (u.clubs || []).find(id => S.clubs[id]) || Object.keys(S.clubs)[0]; if (!club) return { items: [], W };
  const avant = { ME, CLUB }; ME = u; CLUB = S.clubs[club];
  const items = []; const W2 = JSON.parse(JSON.stringify(W || {}));
  try {
    if (jourDeRepos(uid, club, jour)) return { items: [], W: W2, repos: true };
    for (const [type, T] of Object.entries(NOTIF_TYPES)) {
      let L = []; try { L = T.detect({ uid, jour, hm, last, W: W2 }); } catch (e) { L = []; }
      for (const p of L) { const b = T.build(p); items.push({ type, key: p.key, title: b.title, body: b.body, url: b.url, priority: T.priority, cooldownMin: T.cooldownMin, on: typeActif(uid, type) }); }
    }
  } finally { ME = avant.ME; CLUB = avant.CLUB; }
  return { items, W: W2 };
}
