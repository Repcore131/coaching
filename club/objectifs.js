/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
'use strict';
// ══ FIT PULSE : objectifs du jour et série de jours travaillés ═══════════
// dailyGoals(userId) : exactement 3 micro-objectifs pour aujourd'hui,
// calculés sur les chiffres d'AVANT ce jour (ils ne changent pas en cours de
// journée) et cochés par les données du jour (saisies et imports du jour de
// vente compris) :
//   a. le KPI le plus en retard sur le rythme du mois (au moins 1, au moins 5 € en euros) ;
//   b. « Traiter 2 relances » s'il y en a à mon nom, sinon « Demander 1 avis Google » ;
//   c. mon défi perso de la semaine (prefs.goal), sinon le 2e KPI le plus en retard.
// Série : un jour travaillé compte s'il a au moins un objectif fait, ou une
// relance notée avec une issue. Jours non travaillés (absence, dimanche ou jour
// fermé du club, jour sans aucune saisie de l'équipe, jour sans connexion ni
// activité du commercial) : neutres. Un jour manqué
// par période de 14 jours est couvert par le joker.
const EUR_MIN = 5;
// Impayés récupérés et sauvetages dépendent des dossiers reçus, pas d'une vente : l'objectif b (relances) les couvre.
const KPI_HORS_OBJECTIFS = ['impayes', 'sauvetage'];
const SERIE_MAX_JOURS = 120;

// Actions de relance notées un jour (relances, rétention, résiliations, dossiers impayés).
function actionsDuJour(uid, d) {
  const n = actionEvents(uid).filter(e => isoOf(new Date(e.at)) === d).length;
  const dun = memo(`dunact|${uid}`, () => { const L = []; for (const c of Object.values(S.clients || {})) for (const h of ((c && c.dunning) || {}).history || []) if (h && h.by === uid && h.outcome && h.at) L.push(isoOf(new Date(h.at))); return L; });
  return n + dun.filter(x => x === d).length;
}
// KPI du mois classés du plus en retard au moins en retard, avec la quantité du jour.
function kpisEnRetard(uid, clubId, d) {
  return memo(`retard|${uid}|${clubId}|${d}`, () => {
    const mk = d.slice(0, 7); const r = rangeOf('month', mk); const veille = addDays(d, -1);
    const st = statsFor(clubId, uid, r, { requiredOnly: true });
    const restants = Math.max(1, workdays(uid, clubId, d, `${mk}-${daysIn(mk)}`));
    const passes = workdays(uid, clubId, mk + '-01', veille); const total = Math.max(1, workdays(uid, clubId, mk + '-01', `${mk}-${daysIn(mk)}`));
    return st.rows.filter(x => x.target > 0 && !KPI_HORS_OBJECTIFS.includes(x.k.id)).map(x => {
      const avant = veille >= mk + '-01' ? sumRange(clubId, uid, x.k.id, mk + '-01', veille) : 0;
      const attendu = x.target * passes / total; const ratio = attendu > 0 ? avant / attendu : avant / x.target;
      const reste = x.target - avant; let q = reste / restants;
      q = x.k.unit === 'eur' ? Math.max(EUR_MIN, Math.ceil(q)) : Math.max(1, Math.ceil(q));
      return { k: x.k, ratio, reste, q };
    }).filter(x => x.reste > 0).sort((a, b) => a.ratio - b.ratio || b.q - a.q);
  });
}
const faitKpi = (uid, clubId, kpiId, d, q) => { const v = sumRange(clubId, uid, kpiId, d, d); return { value: v, done: v >= q - 1e-9 }; };
function objectifKpi(uid, clubId, x, d, id) {
  const f = faitKpi(uid, clubId, x.k.id, d, x.q);
  return { id, kpiId: x.k.id, target: x.q, value: f.value, done: f.done, label: `${x.k.unit === 'eur' ? fmtU(x.q, x.k) + ' en ' + x.k.label : fmtU(x.q, x.k)} aujourd’hui`, link: '#/dashboard' };
}
function dailyGoals(userId = ME.id, d = today(), clubId = CLUB.id) {
  const R = kpisEnRetard(userId, clubId, d); const out = [];
  // a. le plus en retard (à défaut, une vente de l'indicateur principal)
  const k0 = R[0] || (S.kpis.contrats ? { k: S.kpis.contrats, q: 1 } : null);
  if (k0) out.push(objectifKpi(userId, clubId, k0, d, 'a'));
  // b. relances, sinon un avis
  const faites = actionsDuJour(userId, d);
  const aFaire = d === today() && ME && ME.id === userId && typeof myToDo === 'function' ? (() => { const t = myToDo(); return t.res.length + t.dun.length + t.loy.length; })() : 0;
  const n = Math.min(2, aFaire + faites);
  if (n > 0) out.push({ id: 'b', target: n, value: faites, done: faites >= n, label: `Traiter ${plur(n, 'relance', 'relances')}`, link: '#/relances' });
  else if (S.kpis.avis && !(k0 && k0.k.id === 'avis')) { const f = faitKpi(userId, clubId, 'avis', d, 1); out.push({ id: 'b', kpiId: 'avis', target: 1, value: f.value, done: f.done, label: 'Demander 1 avis Google', link: '#/dashboard' }); }
  else out.push({ id: 'b', target: 1, value: faites, done: faites >= 1, label: 'Traiter 1 relance', link: '#/relances' });
  // c. défi perso de la semaine, sinon le 2e KPI en retard
  const g = ME && ME.id === userId ? prefsOf(userId).goal : ((S.prefs || {})[userId] || {}).goal;
  if (g && g.week === semaineIso(d) && S.kpis[g.kpiId]) {
    const k = S.kpis[g.kpiId]; const lundi = weekStart(d); const avant = d > lundi ? sumRange(clubId, userId, g.kpiId, lundi, addDays(d, -1)) : 0;
    const reste = Math.max(0, g.target - avant); const jours = Math.max(1, workdays(userId, clubId, d, addDays(lundi, 6)));
    const q = reste ? Math.max(k.unit === 'eur' ? EUR_MIN : 1, Math.ceil(reste / jours)) : 0; const f = faitKpi(userId, clubId, g.kpiId, d, q);
    out.push({ id: 'c', kpiId: g.kpiId, target: q, value: f.value, done: !q || f.done, label: q ? `Défi perso : ${fmtU(q, k)} en ${k.label}` : `Défi perso tenu : ${fmtU(g.target, k)}`, link: '#/home' });
  } else {
    const x = R.find(y => !out.some(o => o.kpiId === y.k.id));
    if (x) out.push(objectifKpi(userId, clubId, x, d, 'c'));
    else { const k = kpiList().find(y => y.unit === 'qty' && !out.some(o => o.kpiId === y.id)); if (k) out.push(objectifKpi(userId, clubId, { k, q: 1 }, d, 'c')); }
  }
  while (out.length < 3) out.push({ id: 'x' + out.length, target: 1, value: faites, done: faites >= 1, label: 'Noter 1 relance', link: '#/relances' });
  return out.slice(0, 3);
}
const journeeGagnee = (uid = ME.id, d = today()) => dailyGoals(uid, d).every(g => g.done);

// ── Série ─────────────────────────────────────────────────────────────────
// Activité d'un vendeur un jour : une vente (saisie ou import) ou une relance notée.
function jourActif(uid, d) { return memo('actifs|' + uid, () => new Set(Object.values(S.entries).filter(e => e.userId === uid && entryCounts(e)).map(e => e.date))).has(d) || actionsDuJour(uid, d) > 0; }
// Jour de repos habituel : sans planning saisi, un jour de la semaine où le vendeur
// n'a rien fait les 4 semaines d'avant alors qu'il a travaillé les autres jours.
function jourReposHabituel(uid, d) {
  const avant = [1, 2, 3, 4].map(i => addDays(d, -7 * i));
  if (avant.some(x => jourActif(uid, x))) return false;
  let autres = 0; for (let i = 1; i <= 27; i++) { const x = addDays(d, -i); if (i % 7 && jourActif(uid, x)) autres++; }
  return autres >= 8;
}
function jourNeutre(uid, clubId, d) {
  if (deepGet(S, ['absences', uid, d])) return true;
  if (jourReposHabituel(uid, d)) return true;
  // Sans planning : un jour où le commercial n'a ni ouvert l'appli ni rien saisi ou noté est présumé non travaillé.
  if (!jourActif(uid, d) && !deepGet(S, ['usage', uid, d])) return true;
  if (!isWorkday(d, clubId) || (typeof estFerie === 'function' && estFerie(d))) return true;
  return !memo('joursEquipe|' + clubId, () => new Set(Object.values(S.entries).filter(e => e.clubId === clubId && entryCounts(e)).map(e => e.date))).has(d);
}
function jourCompte(uid, clubId, d) { return memo(`jc|${uid}|${clubId}|${d}`, () => actionsDuJour(uid, d) > 0 || dailyGoals(uid, d, clubId).some(g => g.done)); }
function serieJours(uid = ME.id, clubId = CLUB.id) {
  return memo(`serie|${uid}|${clubId}`, () => {
    let n = 0; const jokers = []; let d = today();
    // Aujourd'hui compte s'il est déjà gagné ; sinon on part d'hier sans casser la série.
    if (!jourNeutre(uid, clubId, d) && jourCompte(uid, clubId, d)) n++;
    for (let i = 0; i < SERIE_MAX_JOURS; i++) {
      d = addDays(d, -1);
      if (jourNeutre(uid, clubId, d)) continue;
      if (jourCompte(uid, clubId, d)) { n++; continue; }
      // jour manqué : le joker le couvre si aucun autre n'a servi dans les 14 jours
      const recent = jokers.find(j => (dateOf(j) - dateOf(d)) / 864e5 < 14);
      if (!recent && n > 0) { jokers.push(d); continue; }
      break;
    }
    const dernier = jokers[0] || null; const dispo = !dernier || (dateOf(today()) - dateOf(dernier)) / 864e5 >= 14;
    return { n, joker: dispo ? null : dernier, jokerDispo: dispo };
  });
}
const serieTexte = s => `Série : ${plur(s.n, 'jour travaillé', 'jours travaillés')}`;
const jokerTexte = s => (s.jokerDispo ? 'Joker disponible' : `Joker utilisé le ${Number(s.joker.slice(8))} ${MOIS[Number(s.joker.slice(5, 7)) - 1].toLowerCase()}`);
// Meilleure série personnelle (prefs.records.serie), mise à jour quand elle est battue.
function serieRecord(uid = ME.id) {
  const s = serieJours(uid); const best = Number(deepGet(S, ['prefs', uid, 'records', 'serie']) || 0);
  if (ME && uid === ME.id && s.n > best && !CFG.capture) setTimeout(() => { if (Number(deepGet(S, ['prefs', uid, 'records', 'serie']) || 0) < s.n) setPrefPath(['records', 'serie'], s.n); }, 0);
  return Math.max(best, s.n);
}

// ── Carte « Ma journée » ──────────────────────────────────────────────────
function maJourneeCard(ctx) {
  const G = dailyGoals(); const s = serieJours(); const tout = G.every(g => g.done);
  if (tout && prefsOf().seen.journee !== today() && !CFG.capture) setTimeout(() => { if (prefsOf().seen.journee === today()) return; setPrefPath(['seen', 'journee'], today()); stepBanner('Journée gagnée'); vibrer([20, 30, 20]); }, 300);
  const rw = typeof weeklyRewardCheck === 'function' ? weeklyRewardCheck(ME.id) : null;
  return `<div class="card col6 ma-journee"><div class="race-h"><div><div class="eyebrow">${dayLabel(today())}</div><h3>Ma journée</h3></div><span class="spacer"></span>${tout ? '<span class="tag is-ok">Journée gagnée</span>' : `<span class="muted small">${G.filter(g => g.done).length} sur 3</span>`}</div>
    <ul class="mj-obj">${G.map(g => `<li class="${g.done ? 'done' : ''}" data-obj="${g.id}"><span class="mj-case" role="img" aria-label="${g.done ? 'Fait' : 'À faire'}">${g.done ? ico('check', 'ico ico-xs') : ''}</span><a class="spacer" href="${g.link}">${esc(g.label)}</a>${g.done ? '' : g.target > 1 && g.value ? `<small class="muted">${esc(String(Math.floor(g.value)))} sur ${esc(String(g.target))}</small>` : ''}</li>`).join('')}</ul>
    <div class="mj-serie"><b>${esc(serieTexte(s))}</b><span class="muted small">${esc(jokerTexte(s))}</span></div>
    ${rw ? `<p class="muted small" style="margin:8px 0 0" data-recompense>${esc(rw.texte)}</p>` : ''}
    <div class="mj-top" style="margin-top:10px"><div><b class="num-l">${fmtP(ctx.myPct)}</b><span>score du mois</span></div><div><b class="num-l">${ctx.me ? ctx.me.rank + '<sup>' + (ctx.me.rank === 1 ? 'er' : 'e') + '</sup>' : 'n.d.'}</b><span>sur ${plur(ctx.rk.length, 'commercial', 'commerciaux')}</span></div><div title="${esc(compteRebours().titre)}"><b class="num-l">${compteRebours().ouvres} j</b><span>${compteRebours().ouvres > 1 ? 'ouvrés restants' : 'ouvré restant'}</span></div></div></div>`;
}
// Prochaine micro-action : le premier objectif du jour pas encore fait.
function prochaineMicroAction(uid = ME.id) { const g = dailyGoals(uid).find(x => !x.done); return g ? { label: g.label, link: g.link } : null; }

// ── Récompenses de la semaine (non compétitives) ─────────────────────────
// « Semaine complète » : la série n'a pas cassé de la semaine (3 jours travaillés au moins, joker compris) ;
// « Record perso » : meilleur score de semaine depuis 8 semaines ;
// « Objectifs du jour » : au moins 4 journées gagnées dans la semaine.
const SEMAINES_PERSO = 8;
function semainePerso(uid, clubId, lundi) {
  const jours = [...Array(7)].map((_, i) => addDays(lundi, i)).filter(d => d <= today());
  const travailles = jours.filter(d => !jourNeutre(uid, clubId, d));
  const comptes = travailles.filter(d => jourCompte(uid, clubId, d)).length;
  const gagnees = travailles.filter(d => d < today() || d === today()).filter(d => dailyGoals(uid, d, clubId).every(g => g.done)).length;
  const score = statsFor(clubId, uid, rangeOf('week', lundi), { requiredOnly: true }).score;
  const avant = [...Array(SEMAINES_PERSO)].map((_, i) => statsFor(clubId, uid, rangeOf('week', addDays(lundi, -7 * (i + 1))), { requiredOnly: true }).score).filter(x => x != null);
  const meilleur = avant.length ? Math.max(...avant) : null;
  return { travailles: travailles.length, manques: travailles.length - comptes, gagnees, score, meilleur };
}
function tropheesPersoSemaine(clubId) {
  return memo('trPerso|' + clubId, () => {
    const out = []; const t = today(); let w = weekStart(addDays(t, -7));
    const team = clubMembers(clubId).filter(u => !u.virtual && u.role === 'membre');
    for (let i = 0; i < SEMAINES_PERSO; i++, w = addDays(w, -7)) {
      for (const u of team) {
        const s = semainePerso(u.id, clubId, w); const base = { userId: u.id, kind: 'perso', mk: w.slice(0, 7), week: w, clubId, perso: true };
        // le joker de la série couvre un jour manqué
        if (s.travailles >= 3 && s.manques <= 1) out.push({ ...base, icon: 'calcheck', label: `Semaine complète du ${dm(w)}` });
        if (s.score != null && s.score > 0 && s.meilleur != null && s.score > s.meilleur + 1e-9) out.push({ ...base, icon: 'flag', label: `Record perso, semaine du ${dm(w)}` });
        if (s.gagnees >= 4) out.push({ ...base, icon: 'check', label: `Objectifs du jour, semaine du ${dm(w)}` });
      }
    }
    return out;
  });
}
// Le trophée personnel le plus proche cette semaine et ce qu'il reste à faire.
function weeklyRewardCheck(userId = ME.id, clubId = CLUB.id) {
  const lundi = weekStart(today()); const s = semainePerso(userId, clubId, lundi);
  const restants = workdays(userId, clubId, today(), addDays(lundi, 6)) - (jourNeutre(userId, clubId, today()) ? 0 : (jourCompte(userId, clubId, today()) ? 1 : 0));
  const L = [];
  const jg = Math.max(0, 4 - s.gagnees); if (jg <= Math.max(0, restants)) L.push({ trophee: 'Objectifs du jour', reste: jg, texte: jg ? `Encore ${plur(jg, 'journée gagnée', 'journées gagnées')} pour Objectifs du jour` : 'Objectifs du jour : obtenu cette semaine' });
  if (s.manques <= 1) { const n = Math.max(0, 3 - s.travailles); L.push({ trophee: 'Semaine complète', reste: Math.max(n, restants > 0 ? 1 : 0), texte: restants > 0 ? `Semaine complète : ${s.manques ? '1 jour couvert par le joker' : 'aucun jour manqué jusqu’ici'}, encore ${plur(Math.max(1, restants), 'jour', 'jours')}` : 'Semaine complète : obtenue cette semaine' }); }
  if (s.meilleur != null && s.score != null && s.score <= s.meilleur) { const ecart = Math.ceil((s.meilleur - s.score) * 100 + 1e-9); L.push({ trophee: 'Record perso', reste: ecart, texte: `Encore ${ecart} points de score pour Record perso` }); }
  return L.sort((a, b) => a.reste - b.reste)[0] || null;
}
// Cockpit : membres sans aucune récompense depuis 3 semaines.
function sansRecompense(clubId, jours = 21) {
  const lim = Date.now() - jours * 864e5;
  return clubMembers(clubId).filter(u => !u.virtual && u.role === 'membre').filter(u => !allTrophies().some(t => t.userId === u.id && tropheeAt(t) >= lim && tropheeAt(t) <= Date.now()));
}
