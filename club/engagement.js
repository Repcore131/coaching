/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
'use strict';
// ══ FIT PULSE : engagement de l'équipe (#/engagement, managers et créateur) ══
// Mesure maison, sans outil tiers : S.usage (adoption.js) et les micro-objectifs
// du jour (objectifs.js). Par membre, sur les 7 derniers jours : ouvertures
// moyennes par jour travaillé, jours actifs sur 7, actions par jour travaillé,
// part des micro-objectifs atteints. Moyenne de l'équipe et tendance sur 4 semaines.
// Le créateur voit en plus les indicateurs produit : utilisateurs actifs par jour
// et par semaine, rapport jour sur semaine, taux d'ouverture des notifications
// par type (calculé par le serveur d'envoi : S.serveur.ouvertures).

const jours7 = fin => [6, 5, 4, 3, 2, 1, 0].map(i => addDays(fin, -i));
const moyenne = L => { const v = L.filter(x => x != null && isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
function engagementMembre(clubId, uid, fin = today()) {
  const J = jours7(fin); const travail = J.filter(d => isWorkday(d, clubId, uid));
  const U = d => usageDuJour(uid, d) || {};
  const ouvertures = travail.reduce((s, d) => s + (Number(U(d).opens) || 0), 0);
  const actifs = J.filter(d => (Number(U(d).opens) || 0) > 0 || (typeof jourActif === 'function' && jourActif(uid, d))).length;
  const actions = travail.reduce((s, d) => s + (Number(U(d).actions) || 0), 0);
  let faits = 0, total = 0;
  if (typeof dailyGoals === 'function') for (const d of travail) { try { const G = dailyGoals(uid, d, clubId); total += G.length; faits += G.filter(g => g.done).length; } catch (_) { /* jour sans objectif */ } }
  const n = travail.length;
  return { uid, joursTravailles: n, ouvParJour: n ? ouvertures / n : null, actifs, actionsParJour: n ? actions / n : null, partObjectifs: total ? faits / total : null };
}
function engagementEquipe(clubId, fin = today()) {
  const L = commerciaux(clubId).filter(u => u.role === 'membre').map(u => ({ u, ...engagementMembre(clubId, u.id, fin) }));
  return { L, moy: { ouvParJour: moyenne(L.map(x => x.ouvParJour)), actifs: moyenne(L.map(x => x.actifs)), actionsParJour: moyenne(L.map(x => x.actionsParJour)), partObjectifs: moyenne(L.map(x => x.partObjectifs)) } };
}
// Tendance : la moyenne de l'équipe sur chacune des 4 dernières semaines glissantes.
const engagementTendance = (clubId, fin = today()) => [3, 2, 1, 0].map(i => { const f = addDays(fin, -7 * i); return { fin: f, ...engagementEquipe(clubId, f).moy }; });

// ── Indicateurs produit (créateur) ────────────────────────────────────────
const comptesMesures = () => Object.keys(S.usage || {}).filter(uid => S.users[uid] && !S.users[uid].virtual);
const actifsLe = d => comptesMesures().filter(uid => (Number((usageDuJour(uid, d) || {}).opens) || 0) > 0);
function indicateursProduit(fin = today()) {
  const J = jours7(fin); const dau = actifsLe(fin).length;
  const semaine = new Set(J.flatMap(d => actifsLe(d))); const wau = semaine.size;
  const dauMoy = moyenne(J.map(d => actifsLe(d).length));
  const types = ((S.serveur || {}).ouvertures || {}).types || {};
  const notifs = Object.entries(types).map(([kind, b]) => ({ kind, label: (typeof NOTIF_TYPES === 'object' && NOTIF_TYPES[kind] && NOTIF_TYPES[kind].label) || kind, n: Number(b.n) || 0, o: Number(b.o) || 0 })).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
  return { dau, wau, dauMoy, ratio: wau ? dauMoy / wau : null, notifs, notifsAt: ((S.serveur || {}).ouvertures || {}).at || null };
}

const fmtDec = v => v == null ? 'n.d.' : (Math.round(v * 10) / 10).toString().replace('.', ',');
const fleche = (a, b) => (a == null || b == null || Math.abs(a - b) < 0.05 ? 'stable' : a > b ? 'en hausse' : 'en baisse');
PAGES.engagement = {
  title: 'Engagement de l’équipe',
  manager: true,
  render() {
    const E = engagementEquipe(CLUB.id); const T = engagementTendance(CLUB.id); const m = E.moy;
    const cellule = (v, f) => `<td class="num">${v == null ? '<span class="muted">n.d.</span>' : f(v)}</td>`;
    const ligne = (nom, x, cls = '') => `<tr class="${cls}" data-u="${x.uid || ''}"><td class="nowrap">${nom}</td>${cellule(x.ouvParJour, fmtDec)}${cellule(x.actifs, v => `${fmtDec(v)} sur 7`)}${cellule(x.actionsParJour, fmtDec)}${cellule(x.partObjectifs, fmtP)}</tr>`;
    let h = `<div class="page-head"><div><h1>Engagement de l’équipe</h1><p>${esc(nomAffiche())} · 7 derniers jours. Mesure interne de Fit Pulse, sans outil tiers.</p></div></div>
      <div class="card"><div class="table-wrap"><table class="t engagement"><thead><tr><th>Membre</th><th class="num">Ouvertures par jour travaillé</th><th class="num">Jours actifs</th><th class="num">Actions par jour</th><th class="num">Micro-objectifs atteints</th></tr></thead><tbody>
      ${E.L.map(x => ligne(`<b>${esc(fullName(x.u))}</b>`, x)).join('') || '<tr><td colspan="5" class="muted">Aucun commercial dans ce club.</td></tr>'}
      ${E.L.length ? ligne('<b>Moyenne de l’équipe</b>', m, 'total') : ''}</tbody></table></div>
      <p class="muted small">Une ouverture compte à chaque retour dans l’appli, 5 minutes au moins après la précédente. Actions : saisies, issues de relance, réactions.</p></div>
      <div class="card" id="eng-tendance"><h3>Tendance sur 4 semaines</h3><div class="table-wrap"><table class="t"><thead><tr><th>Semaine jusqu’au</th><th class="num">Ouvertures par jour</th><th class="num">Jours actifs</th><th class="num">Actions par jour</th><th class="num">Micro-objectifs</th></tr></thead><tbody>
      ${T.map(w => `<tr><td>${esc(dm(w.fin))}</td>${cellule(w.ouvParJour, fmtDec)}${cellule(w.actifs, v => `${fmtDec(v)} sur 7`)}${cellule(w.actionsParJour, fmtDec)}${cellule(w.partObjectifs, fmtP)}</tr>`).join('')}</tbody></table></div>
      <p class="small" style="margin:8px 0 0">Ouvertures ${fleche(T[3].ouvParJour, T[2].ouvParJour)} par rapport à la semaine précédente, jours actifs ${fleche(T[3].actifs, T[2].actifs)}.</p></div>`;
    if (isCreator()) {
      const P = indicateursProduit();
      h += `<div class="card" id="eng-produit"><h3>Indicateurs produit</h3><div class="rc-grid">
        <div class="rc-tile"><span>Actifs aujourd’hui</span><b class="num" data-k="dau">${P.dau}</b><small>utilisateurs</small></div>
        <div class="rc-tile"><span>Actifs sur 7 jours</span><b class="num" data-k="wau">${P.wau}</b><small>utilisateurs</small></div>
        <div class="rc-tile"><span>Jour sur semaine</span><b class="num" data-k="ratio">${fmtP(P.ratio)}</b><small>actifs par jour en moyenne, rapportés à la semaine</small></div></div>
        <h3 style="margin-top:14px">Ouverture des notifications par type</h3>${P.notifs.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Type</th><th class="num">Envoyées</th><th class="num">Ouvertes</th><th class="num">Taux</th></tr></thead><tbody>${P.notifs.map(x => `<tr data-type="${esc(x.kind)}"><td>${esc(x.label)}</td><td class="num">${x.n}</td><td class="num">${x.o}</td><td class="num">${fmtP(x.o / x.n)}</td></tr>`).join('')}</tbody></table></div><p class="muted small">30 derniers jours, alertes poussées, calcul du serveur d’envoi${P.notifsAt ? ` du ${esc(dmy(isoOf(new Date(P.notifsAt))))}` : ''}.</p>` : '<p class="muted small">Pas encore de mesure : le serveur d’envoi la calcule chaque nuit.</p>'}</div>`;
    }
    return h;
  },
};
