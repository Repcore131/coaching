'use strict';
// ══ FIT PULSE — pilotage managérial ════════════════════════════════════════
// Vue équipe en un écran, fiche de coaching, activité, signaux faibles et
// rituels (brief du matin, point hebdo). Tout est calculé : rien de stocké
// en double, sauf ce que le manager écrit (notes, objectifs, actions).

// ── Activité : ce que fait le commercial, pas seulement ce qu'il vend ─────
function activityFor(uid, clubId, from, to) {
  return memo(`act|${uid}|${clubId}|${from}|${to}`, () => {
    const plan = Object.keys(deepGet(S, ['tasks', 'plan', clubId]) || {}).length;
    const tachesPrevues = workdays(uid, clubId, from, to > today() ? today() : to) * plan;
    let tachesFaites = 0;
    for (let d = from; d <= to && d <= today(); d = addDays(d, 1)) tachesFaites += Object.keys(deepGet(S, ['tasks', 'done', d, uid]) || {}).length;
    const f0 = dateOf(from).getTime(), t0 = dateOf(to).getTime() + 864e5;
    const touches = Object.values(S.touches || {}).filter(x => x.by === uid && x.clubId === clubId && x.at >= f0 && x.at < t0 && x.channel !== 'note');
    const loy = Object.values(S.loyalty || {}).filter(x => x.userId === uid && x.at >= f0 && x.at < t0 && !touches.some(t => Math.abs(t.at - x.at) < 2000));
    const relances = touches.length + loy.length;
    const abouties = touches.filter(x => (TOUCH_OUTCOMES[x.outcome] || {}).reached).length + loy.filter(x => OUTCOMES[x.outcome] && OUTCOMES[x.outcome].done && !OUTCOMES[x.outcome].lost).length;
    const gestesResil = resList(clubId).reduce((s, r) => s + resActions(r).filter(a => a.by === uid && a.at >= f0 && a.at < t0 && a.label !== 'Demande enregistrée').length, 0);
    const gestesImpayes = Object.values(S.clients || {}).filter(c => c.clubId === clubId).reduce((s, c) => s + ((c.dunning || {}).history || []).filter(h => h.by === uid && h.at >= f0 && h.at < t0).length, 0);
    const prospects = sumRange(clubId, uid, 'prospects', from, to);
    const club = S.clubs[clubId] || {}; const tg = club.activityTargets || {};
    const days = Math.max(1, Math.round((dateOf(to) - dateOf(from)) / 864e5) + 1);
    const cibleRel = (Number(tg.relances) || 40) * days / 30, cibleProsp = (monthTarget(from.slice(0, 7), uid, 'prospects') || Number(tg.prospects) || 20) * days / 30;
    const tauxTaches = tachesPrevues ? tachesFaites / tachesPrevues : null;
    const indice = 0.4 * Math.min(tauxTaches == null ? 0 : tauxTaches, 1) + 0.3 * Math.min(relances / cibleRel, 1) + 0.3 * Math.min(prospects / cibleProsp, 1);
    return { tachesPrevues, tachesFaites, tauxTaches, relances, abouties, gestesResil, gestesImpayes, prospects, indice };
  });
}

// ── Signaux faibles : règles simples et explicables ───────────────────────
function alertsFor(clubId) {
  return memo(`alr|${clubId}`, () => {
    const out = []; const t = today(); const wk = weekStart(t);
    const lastManual = uid => Object.values(S.entries).filter(e => e.userId === uid && e.clubId === clubId && e.source === 'manual').reduce((m, e) => (e.date > m ? e.date : m), '');
    for (const u of clubMembers(clubId)) {
      const young = u.createdAt && Date.now() - u.createdAt < 35 * 864e5;
      const lm = lastManual(u.id); const silent = lm ? workdays(u.id, clubId, addDays(lm, 1), t) - (isWorkday(t, clubId, u.id) ? 1 : 0) : 99;
      if (silent >= 2) out.push({ uid: u.id, rule: 'R1', level: silent >= 4 ? 'alerte' : 'vigilance', text: `Aucune saisie depuis ${silent >= 99 ? 'le début' : plur(silent, 'jour ouvré', 'jours ouvrés')}`, detail: lm ? `dernière saisie le ${dm(lm)}` : 'jamais' });
      if (!young) {
        const a7 = activityFor(u.id, clubId, addDays(t, -6), t).indice, a28 = activityFor(u.id, clubId, addDays(t, -34), addDays(t, -7)).indice;
        if (a28 > 0 && a7 < 0.7 * a28) out.push({ uid: u.id, rule: 'R2', level: a7 < 0.5 * a28 ? 'alerte' : 'vigilance', text: 'Activité en baisse', detail: `7 derniers jours : indice ${Math.round(a7 * 100)}, contre ${Math.round(a28 * 100)} les 4 semaines d’avant` });
      } else out.push({ uid: u.id, rule: 'R0', level: 'info', text: 'Historique insuffisant', detail: 'arrivé il y a moins de 35 jours' });
      const st = statsFor(clubId, u.id, rangeOf('month', curMonth()));
      st.rows.filter(x => x.k.required && x.target > 0 && st.expected >= 0.4 && x.pct != null && x.pct / st.expected < 0.6).forEach(x => out.push({ uid: u.id, rule: 'R4', level: 'vigilance', text: `${x.k.label} décroché`, detail: `${fmtV(x.real, x.k.unit)} sur ${fmtV(x.target, x.k.unit)}, rythme attendu ${fmtP(st.expected)}` }));
      const seen = deepGet(S, ['prefs', u.id, 'lastSeen']);
      if (seen && workdays(u.id, clubId, isoOf(new Date(seen)), t) > 5) out.push({ uid: u.id, rule: 'R7', level: 'vigilance', text: 'Ne se connecte plus', detail: `dernière visite le ${dm(isoOf(new Date(seen)))}` });
    }
    const acks = deepGet(S, ['alertAcks', clubId]) || {};
    return out.map(a => ({ ...a, key: safeKey(`${a.rule}_${a.uid}_${wk}_${a.text}`) })).filter(a => !acks[a.key]);
  });
}
ACTIONS.alertAck = el => { db.set(['alertAcks', CLUB.id, el.dataset.key], { by: ME.id, at: Date.now() }); toast('Pris en compte'); };

// ── Pilotage équipe : une matrice membres x KPI ───────────────────────────
PAGES.team = {
  title: 'Pilotage équipe', manager: true,
  render() {
    const mk = UI.teamMonth || curMonth(); const r = rangeOf('month', mk);
    const kpis = kpiList().filter(k => clubMonthTarget(mk, CLUB.id, k.id) > 0);
    const members = perimeterMembers(CLUB.id, r.from, r.to);
    const club = statsFor(CLUB.id, null, r); const exp = club.expected;
    const rows = members.map(u => { const st = statsFor(CLUB.id, u.id, r); const stR = statsFor(CLUB.id, u.id, r, { requiredOnly: true }); const late = st.rows.filter(x => x.target > 0 && st.expected > 0 && x.pct / st.expected < 0.75);
      const lm = Object.values(S.entries).filter(e => e.userId === u.id && e.clubId === CLUB.id && e.source === 'manual').reduce((m, e) => (e.date > m ? e.date : m), '');
      return { u, st, score: stR.score, ratio: stR.progress != null && stR.expected ? stR.progress / stR.expected : null, late, lm, act: activityFor(u.id, CLUB.id, r.from, r.to) }; });
    const sort = UI.teamSort || 'late';
    rows.sort(sort === 'name' ? (a, b) => fullName(a.u).localeCompare(fullName(b.u)) : sort === 'score' ? (a, b) => (b.score ?? -1) - (a.score ?? -1) : (a, b) => (a.ratio ?? 9) - (b.ratio ?? 9));
    const left = Math.max(1, workdaysLeft(null, CLUB.id, mk));
    const al = alertsFor(CLUB.id).filter(a => a.level !== 'info');
    return `<div class="page-head"><div><h1>Pilotage équipe</h1><p>${esc(CLUB.name)} · rythme attendu ${fmtP(exp)} · ${plur(left, 'jour ouvré restant', 'jours ouvrés restants')}</p></div><span class="spacer"></span>${monthNav('teamMonth', mk)}</div>
      <div class="rc-grid">${club.rows.filter(x => x.k.required && x.target > 0).map(x => { const proj = exp >= 0.1 ? x.real / exp : null; return `<div class="rc-tile"><span>${esc(x.k.label)}</span><b>${fmtV(x.real, x.k.unit)}</b><small>sur ${fmtV(x.target, x.k.unit)} · ${fmtP(x.pct)} · projection ${proj == null ? 'n.d.' : fmtV(x.k.unit === 'qty' ? Math.round(proj) : proj, x.k.unit)}</small></div>`; }).join('')}</div>
      ${al.length ? `<a class="recap-ready" href="javascript:void 0" data-act="ui" data-key="teamView" data-val="signaux">${ico('alert')}<div><b>${plur(al.length, 'signal faible', 'signaux faibles')}</b><span>${al.slice(0, 3).map(a => esc(S.users[a.uid].first) + ' : ' + esc(a.text.toLowerCase())).join(' · ')}</span></div>${ico('chevR')}</a>` : ''}
      ${tabs('teamView', [['matrice', 'Objectifs'], ['activite', 'Activité'], ['signaux', `Signaux faibles${al.length ? ' · ' + al.length : ''}`]], UI.teamView || 'matrice')}
      ${(UI.teamView || 'matrice') === 'activite' ? teamActivity(members, r) : (UI.teamView === 'signaux') ? teamSignals() : `
      <div class="row wrap" style="margin-bottom:10px">${seg('teamSort', [['late', 'Plus en retard d’abord'], ['score', 'Score'], ['name', 'Nom']], sort)}<span class="spacer"></span><button class="btn sm" data-act="teamCsv">${ico('download')} CSV</button></div>
      <div class="table-wrap"><table class="t team-m"><thead><tr><th>Membre</th>${kpis.map(k => `<th class="num">${esc(k.label)}</th>`).join('')}<th class="num">Score</th><th>KPI en retard</th><th>Dernière saisie</th></tr></thead><tbody>
      ${rows.map(x => `<tr><td class="sticky"><a href="#/coach/${x.u.id}"><b>${esc(fullName(x.u))}</b></a>${(() => { const n = Object.values(S.audit || {}).filter(a => a.userId === x.u.id && a.club === CLUB.id && ['adjust', 'delete', 'proxy'].includes(a.action) && isoOf(new Date(a.at)).slice(0, 7) === mk).length; return n ? ` <span class="tag is-warn" title="Corrections ou saisies pour autrui ce mois">${plur(n, 'correction', 'corrections')}</span>` : ''; })()}</td>${kpis.map(k => { const y = x.st.rows.find(rr => rr.k.id === k.id); if (!y || !y.target) return '<td class="num muted">n.d.</td>'; const h = healthOf(x.st.expected ? y.pct / x.st.expected : null); const per = Math.max(0, y.target - y.real) / Math.max(1, workdaysLeft(x.u.id, CLUB.id, mk)); return `<td class="num cell ${h.cls}" title="Reste à faire : ${fmtV(k.unit === 'qty' ? Math.ceil(per) : per, k.unit)} par jour"><b>${fmtP(y.pct)}</b><br><small>${fmtV(y.real, k.unit)} / ${fmtV(y.target, k.unit)}</small></td>`; }).join('')}
        <td class="num"><b>${fmtP(x.score)}</b></td><td class="small late-k" title="${x.late.map(y => esc(y.k.label)).join(', ')}">${x.late.length ? `${x.late.length} : ${x.late.map(y => esc(y.k.label)).join(', ')}` : '<span class="muted">aucun</span>'}</td><td class="small ${x.lm && workdays(x.u.id, CLUB.id, addDays(x.lm, 1), today()) > 2 ? 'bad' : ''}">${x.lm ? dm(x.lm) : 'jamais'}</td></tr>`).join('')}
      </tbody></table></div>`}`;
  },
};
function teamActivity(members, r) {
  const rows = members.map(u => ({ u, a: activityFor(u.id, CLUB.id, r.from, r.to), s: statsFor(CLUB.id, u.id, r, { requiredOnly: true }) }));
  const W = 520, H = 300, P = 30; const exp = statsFor(CLUB.id, null, r).expected || 1;
  // Échelles relatives à l'équipe : activité rapportée au plus actif, résultat rapporté au rythme attendu.
  const maxA = Math.max(0.01, ...rows.map(x => x.a.indice)); const avgA = rows.reduce((t, x) => t + x.a.indice, 0) / Math.max(1, rows.length) / maxA;
  const X = v => P + Math.min(1, v / maxA) * (W - 2 * P), Y = v => H - P - Math.min(2, (v || 0) / exp) / 2 * (H - 2 * P);
  return `<div class="g12"><div class="card col7"><div class="table-wrap"><table class="t"><thead><tr><th>Membre</th><th class="num">Tâches</th><th class="num">Relances (abouties)</th><th class="num">Gestes résiliation</th><th class="num">Gestes impayés</th><th class="num">Prospects</th><th class="num">Indice</th></tr></thead><tbody>
    ${rows.map(x => `<tr><td class="nowrap"><a href="#/coach/${x.u.id}">${esc(fullName(x.u))}</a></td><td class="num">${x.a.tauxTaches == null ? 'n.d.' : fmtP(x.a.tauxTaches)}</td><td class="num">${x.a.relances} (${x.a.abouties})</td><td class="num">${x.a.gestesResil}</td><td class="num">${x.a.gestesImpayes}</td><td class="num">${fmtN(x.a.prospects)}</td><td class="num"><b>${Math.round(x.a.indice * 100)}</b></td></tr>`).join('')}</tbody></table></div></div>
    <div class="card col5"><h3>Activité et résultat</h3><svg class="quad" viewBox="0 0 ${W} ${H}" role="img" aria-label="Matrice activité et résultat">
      <line x1="${P + avgA * (W - 2 * P)}" y1="${P}" x2="${P + avgA * (W - 2 * P)}" y2="${H - P}" class="q-axis"/><line x1="${P}" y1="${Y(exp)}" x2="${W - P}" y2="${Y(exp)}" class="q-axis"/>
      <text x="${W - P}" y="${P + 12}" text-anchor="end" class="q-l">Moteurs</text><text x="${P}" y="${P + 12}" class="q-l">Talents à cadrer</text><text x="${W - P}" y="${H - P - 6}" text-anchor="end" class="q-l">Travaille sans convertir</text><text x="${P}" y="${H - P - 6}" class="q-l">À relancer</text>
      ${rows.map((x, i) => { const cx = X(x.a.indice), cy = Y(x.s.score); const near = rows.slice(0, i).filter(o => Math.abs(X(o.a.indice) - cx) < 40 && Math.abs(Y(o.s.score) - cy) < 14).length; return `<circle cx="${cx}" cy="${cy}" r="7" class="q-dot"/><text x="${cx > W - 90 ? cx - 10 : cx + 10}" y="${cy + 4 - near * 14}" text-anchor="${cx > W - 90 ? 'end' : 'start'}" class="q-n">${esc(x.u.first)}</text>`; }).join('')}
    </svg><p class="muted small">Axe horizontal : indice d’activité (tâches, relances, prospects). Axe vertical : score du mois. Lignes : activité moyenne de l’équipe et rythme attendu.</p></div></div>`;
}
function teamSignals() {
  const al = alertsFor(CLUB.id); const by = {}; al.forEach(a => { (by[a.uid] = by[a.uid] || []).push(a); });
  if (!al.length) return `<div class="card">${emptyBox({ art: 'done', title: 'Aucun signal faible', text: 'Toute l’équipe est dans le rythme cette semaine.' })}</div>`;
  return Object.entries(by).map(([uid, L]) => `<div class="card"><div class="card-head"><b>${esc(fullName(S.users[uid]))}</b><span class="spacer"></span><a class="btn sm" href="#/coach/${uid}">Fiche</a></div>${L.map(a => `<div class="q-alert"><span class="tag ${a.level === 'alerte' ? 'is-bad' : a.level === 'vigilance' ? 'is-warn' : ''}">${a.level === 'alerte' ? 'Alerte' : a.level === 'vigilance' ? 'Vigilance' : 'Info'}</span><span class="spacer"><b>${esc(a.text)}</b><br><span class="muted small">${esc(a.detail)}</span></span>${a.level !== 'info' ? `<button class="btn sm ghost" data-act="alertAck" data-key="${a.key}">Pris en compte</button>` : ''}</div>`).join('')}</div>`).join('');
}
ACTIONS.teamCsv = () => {
  const mk = UI.teamMonth || curMonth(); const r = rangeOf('month', mk); const kpis = kpiList().filter(k => clubMonthTarget(mk, CLUB.id, k.id) > 0);
  const rows = perimeterMembers(CLUB.id, r.from, r.to).map(u => { const st = statsFor(CLUB.id, u.id, r); return [fullName(u), ...kpis.flatMap(k => { const y = st.rows.find(rr => rr.k.id === k.id) || {}; return [csvNum(y.real), csvNum(y.target), y.pct == null ? '' : Math.round(y.pct * 100) + ' %']; }), statsFor(CLUB.id, u.id, r, { requiredOnly: true }).score == null ? '' : Math.round(statsFor(CLUB.id, u.id, r, { requiredOnly: true }).score * 100) + ' %']; });
  downloadFile(`fitpulse-equipe-${CLUB.id}-${mk}.csv`, toCsv(['Membre', ...kpis.flatMap(k => [k.label, 'Objectif', '%']), 'Score'], rows), 'text/csv;charset=utf-8');
};

// ── Fiche de coaching ─────────────────────────────────────────────────────
PAGES.coach = {
  title: 'Fiche coaching',
  render(args) {
    const uid = (args || [])[0]; const u = S.users[uid];
    if (!u || (!isManager() && uid !== ME.id)) { setTimeout(() => { location.hash = '#/home'; }, 0); return ''; }
    const tab = UI.coachTab || 'tendances'; const cm = curMonth();
    const T = [['tendances', 'Tendances'], ['forces', 'Forces et axes'], ['activite', 'Activité'], ['plan', 'Objectifs et plan'], ...(isManager() ? [['notes', 'Notes']] : [])];
    const months = Array.from({ length: 6 }, (_, i) => addMonths(cm, i - 5));
    let body = '';
    if (tab === 'tendances') {
      const sc = months.map(m => statsFor(CLUB.id, uid, rangeOf('month', m), { requiredOnly: true }).score);
      const avg = months.map(m => { const rk = ranking(CLUB.id, rangeOf('month', m)).filter(x => x.score != null); return rk.length ? rk.reduce((s, x) => s + x.score, 0) / rk.length : null; });
      const kpis = kpiList().filter(k => k.points > 0);
      body = `<div class="card"><h3>Score des 6 derniers mois</h3>${monthBars(months, [{ label: 'Score', color: 'var(--d-1)', values: sc.map(v => Math.round((v || 0) * 100)) }, { label: 'Moyenne du club', color: 'var(--d-3)', values: avg.map(v => Math.round((v || 0) * 100)) }], { fmt: v => v + ' %' })}</div>
        <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>KPI</th>${months.map(m => `<th class="num">${MOIS_C[Number(m.slice(5)) - 1]}</th>`).join('')}<th class="num">vs ma moyenne</th></tr></thead><tbody>
        ${kpis.map(k => { const pcts = months.map(m => (statsFor(CLUB.id, uid, rangeOf('month', m), { kpiIds: [k.id] }).rows[0] || {}).pct); const prev = pcts.slice(2, 5).filter(v => v != null); const ex = statsFor(CLUB.id, uid, rangeOf('month', cm)).expected; const cur = pcts[5] != null && ex >= 0.2 ? pcts[5] / ex : null; const d = cur != null && prev.length ? Math.round((cur - prev.reduce((s, v) => s + v, 0) / prev.length) * 100) : null;
          return `<tr><td>${esc(k.label)}</td>${pcts.map(p => `<td class="num cell ${healthOf(p).cls}">${fmtP(p)}</td>`).join('')}<td class="num ${d == null ? '' : d >= 0 ? 'ok' : 'bad'}">${d == null ? 'n.d.' : (d > 0 ? '+' : '') + d + ' pts'}</td></tr>`; }).join('')}</tbody></table></div></div>`;
    } else if (tab === 'forces') {
      const f = forcesAxes(uid);
      body = `<div class="g12"><div class="card col6"><h3>Forces</h3>${f.forces.length ? f.forces.map(x => `<p><b>${esc(x.k.label)}</b> : ${fmtP(x.me)} de l’objectif en moyenne, contre ${fmtP(x.team)} pour l’équipe.</p>`).join('') : '<p class="muted">Profil homogène.</p>'}</div>
        <div class="card col6"><h3>Axes de progrès</h3>${f.axes.length ? f.axes.map(x => `<p><b>${esc(x.k.label)}</b> : ${fmtP(x.me)} de l’objectif en moyenne, contre ${fmtP(x.team)} pour l’équipe.</p>`).join('') : '<p class="muted">Profil homogène.</p>'}</div>
        <div class="card col12"><h3>Transformation</h3><p>${(() => { const from = addMonths(cm, -3) + '-01', to = `${addMonths(cm, -1)}-${daysIn(addMonths(cm, -1))}`; const c = sumRange(CLUB.id, uid, 'contrats', from, to), p = sumRange(CLUB.id, uid, 'prospects', from, to); return p ? `${fmtP(c / p)} sur 3 mois (${plur(c, 'contrat', 'contrats')} pour ${plur(p, 'prospect', 'prospects')})` : 'Pas assez de prospects saisis sur 3 mois.'; })()}</p></div></div>`;
    } else if (tab === 'activite') {
      const a4 = activityFor(uid, CLUB.id, addDays(today(), -27), today());
      body = `<div class="rc-grid"><div class="rc-tile"><span>Indice d’activité</span><b>${Math.round(a4.indice * 100)}</b><small>4 dernières semaines</small></div><div class="rc-tile"><span>Tâches</span><b>${a4.tauxTaches == null ? 'n.d.' : fmtP(a4.tauxTaches)}</b><small>${a4.tachesFaites} faites</small></div><div class="rc-tile"><span>Relances</span><b>${a4.relances}</b><small>${plur(a4.abouties, 'aboutie', 'abouties')}</small></div><div class="rc-tile"><span>Gestes</span><b>${a4.gestesResil + a4.gestesImpayes}</b><small>résiliations et impayés</small></div></div>`;
    } else if (tab === 'plan') body = coachPlan(uid);
    else if (tab === 'notes' && isManager()) body = coachNotes(uid);
    return `<div class="page-head"><div><h1>${esc(fullName(u))}</h1><p>Fiche de coaching · ${roleLabel(u.role)}</p></div><span class="spacer"></span>${isManager() ? '<button class="btn" data-act="coachPrint">' + ico('download') + ' Imprimer</button>' : ''}</div>${tabs('coachTab', T, tab)}${body}`;
  },
};
function forcesAxes(uid) {
  const cm = curMonth(); const ms = [1, 2, 3].map(i => addMonths(cm, -i));
  const res = [];
  for (const k of kpiList().filter(k => k.points > 0)) {
    const mine = ms.map(m => (statsFor(CLUB.id, uid, rangeOf('month', m), { kpiIds: [k.id] }).rows[0] || {}).pct).filter(v => v != null);
    if (mine.length < 2) continue;
    const team = ms.flatMap(m => clubMembers(CLUB.id).map(u => (statsFor(CLUB.id, u.id, rangeOf('month', m), { kpiIds: [k.id] }).rows[0] || {}).pct)).filter(v => v != null);
    if (!team.length) continue;
    const me = mine.reduce((s, v) => s + v, 0) / mine.length, tm = team.reduce((s, v) => s + v, 0) / team.length;
    if (tm > 0) res.push({ k, me, team: tm, idx: me / tm });
  }
  res.sort((a, b) => b.idx - a.idx);
  return { forces: res.filter(x => x.idx >= 1.1).slice(0, 2), axes: res.slice().reverse().filter(x => x.idx <= 0.9).slice(0, 2) };
}
const coachOf = uid => deepGet(S, ['coaching', uid]) || {};
function goalProgress(uid, g) {
  if (g.metric === 'activite') { const acts = Object.values(coachOf(uid).actions || {}).filter(a => a.done && a.doneAt >= dateOf(g.from).getTime() && a.doneAt <= dateOf(g.due).getTime() + 864e5).length; return g.target ? acts / g.target : 0; }
  if (!g.kpiId) return null;
  if (g.metric === 'pct') { const y = statsFor(CLUB.id, uid, rangeOf('month', g.due.slice(0, 7)), { kpiIds: [g.kpiId] }).rows[0]; return y ? y.pct : null; }
  return g.target ? sumRange(CLUB.id, uid, g.kpiId, g.from, today() < g.due ? today() : g.due) / g.target : null;
}
function coachPlan(uid) {
  const C = coachOf(uid); const goals = Object.values(C.goals || {}).sort((a, b) => b.createdAt - a.createdAt); const actions = Object.values(C.actions || {}).sort((a, b) => (a.done - b.done) || a.due.localeCompare(b.due));
  const late = actions.filter(a => !a.done && a.due < today()).length;
  return `<p class="muted">${plur(goals.filter(g => g.status === 'en_cours').length, 'objectif en cours', 'objectifs en cours')} · ${plur(late, 'action en retard', 'actions en retard')}</p>
    <div class="card"><div class="card-head"><h3>Objectifs SMART</h3><span class="spacer"></span>${isManager() ? `<button class="btn sm primary" data-act="goalNew" data-u="${uid}">${ico('plus')} Objectif</button>` : ''}</div>
    ${goals.length ? goals.map(g => { const p = goalProgress(uid, g); const st = g.status !== 'en_cours' ? g.status : today() > g.due ? (p != null && p >= 1 ? 'atteint' : 'non_atteint') : 'en_cours'; return `<div class="goal"><div class="row"><b class="spacer">${esc(g.label)}</b><span class="tag ${st === 'atteint' ? 'is-ok' : st === 'non_atteint' ? 'is-bad' : st === 'abandonne' ? '' : 'is-info'}">${{ en_cours: 'En cours', atteint: 'Atteint', non_atteint: 'Non atteint', abandonne: 'Abandonné' }[st]}</span></div>${progressBar(p || 0, { ticks: false })}<div class="muted small">${fmtP(p)} · échéance ${dmy(g.due)}</div></div>`; }).join('') : '<p class="muted">Aucun objectif.</p>'}</div>
    <div class="card"><div class="card-head"><h3>Plan d’action</h3><span class="spacer"></span><button class="btn sm" data-act="actNew" data-u="${uid}">${ico('plus')} Action</button></div>
    ${actions.length ? actions.map(a => `<label class="row act-row ${!a.done && a.due < today() ? 'late' : ''}"><input type="checkbox" data-change="actDone" data-u="${uid}" data-id="${a.id}" ${a.done ? 'checked' : ''} ${isManager() || a.owner === 'membre' ? '' : 'disabled'}><span class="spacer">${esc(a.label)}</span><span class="small muted">${a.owner === 'membre' ? 'commercial' : 'manager'} · ${dm(a.due)}</span></label>`).join('') : '<p class="muted">Aucune action.</p>'}</div>`;
}
ACTIONS.goalNew = el => {
  const uid = el.dataset.u; const d90 = addDays(today(), 90);
  openModal({ title: 'Objectif SMART', body: `<form id="gf" class="grid"><label class="field"><span>Spécifique : quoi ?</span><input class="input" name="label" required placeholder="Signer plus de contrats Premium"></label>
    <div class="form-grid"><label class="field"><span>Mesurable : KPI</span><select class="input" name="kpiId"><option value="">Activité (actions du plan)</option>${kpiList().map(k => `<option value="${k.id}">${esc(k.label)}</option>`).join('')}</select></label><label class="field"><span>Cible</span><input class="input" name="target" inputmode="decimal" required></label></div>
    <div class="form-grid"><label class="field"><span>Mesure</span><select class="input" name="metric"><option value="valeur">Valeur cumulée</option><option value="pct">% de l’objectif du mois</option></select></label><label class="field"><span>Temporel : échéance</span><input class="input" type="date" name="due" min="${today()}" max="${d90}" required></label></div>
    <label class="row small"><input type="checkbox" name="ok"> Réaliste : validé avec le commercial</label></form>`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="goalSave" data-u="${uid}">Enregistrer</button>` });
};
ACTIONS.goalSave = el => {
  const f = formData($('#gf')); const t = parseMontant(f.target);
  if (!f.label.trim() || Number.isNaN(t) || !f.due) { toast('Renseignez quoi, la cible et l’échéance.'); return; }
  if (f.due > addDays(today(), 90)) { toast('Échéance à 90 jours au plus.'); return; }
  if (!f.ok) { toast('Validez l’objectif avec le commercial (case Réaliste).'); return; }
  const id = newId(); db.set(['coaching', el.dataset.u, 'goals', id], { id, createdAt: Date.now(), by: ME.id, label: f.label.trim().slice(0, 120), kpiId: f.kpiId || null, metric: f.kpiId ? f.metric : 'activite', target: t, from: today(), due: f.due, status: 'en_cours' });
  closeModal(); toast('Objectif enregistré');
};
ACTIONS.actNew = el => {
  openModal({ title: 'Nouvelle action', body: `<form id="af" class="grid"><label class="field"><span>Action</span><input class="input" name="label" required></label><div class="form-grid"><label class="field"><span>Échéance</span><input class="input" type="date" name="due" value="${addDays(today(), 7)}"></label><label class="field"><span>Qui</span><select class="input" name="owner"><option value="membre">Le commercial</option><option value="manager">Le manager</option></select></label></div></form>`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="actSave" data-u="${el.dataset.u}">Ajouter</button>` });
};
ACTIONS.actSave = el => { const f = formData($('#af')); if (!f.label.trim()) return; const id = newId(); db.set(['coaching', el.dataset.u, 'actions', id], { id, createdAt: Date.now(), by: ME.id, label: f.label.trim().slice(0, 140), due: f.due || addDays(today(), 7), owner: f.owner, done: false }); closeModal(); };
ACTIONS.actDone = el => { db.batch([[['coaching', el.dataset.u, 'actions', el.dataset.id, 'done'], el.checked], [['coaching', el.dataset.u, 'actions', el.dataset.id, 'doneAt'], el.checked ? Date.now() : null]]); };
function coachNotes(uid) {
  const notes = Object.values(coachOf(uid).notes || {}).sort((a, b) => b.at - a.at);
  return `<div class="card"><form id="cnn" class="grid"><div class="form-grid"><label class="field"><span>Type</span><select class="input" name="type"><option value="entretien">Entretien</option><option value="point">Point</option><option value="felicitation">Félicitation</option><option value="recadrage">Recadrage</option></select></label><label class="field"><span>Humeur perçue</span><select class="input" name="mood"><option value="">n.d.</option>${[1, 2, 3, 4, 5].map(n => `<option>${n}</option>`).join('')}</select></label></div>
    <textarea class="input" name="text" rows="4" placeholder="Compte rendu"></textarea><label class="row small"><input type="checkbox" name="shared"> Partager avec le commercial</label><div class="row" style="gap:8px"><button class="btn" type="button" data-act="coachPrep" data-u="${uid}">Préparer un entretien</button><button class="btn primary" type="button" data-act="noteSave" data-u="${uid}">Enregistrer</button></div></form></div>
    ${notes.map(n => `<div class="card"><div class="row"><b class="spacer">${{ entretien: 'Entretien', point: 'Point', felicitation: 'Félicitation', recadrage: 'Recadrage' }[n.type] || 'Note'}${n.shared ? ' · partagée' : ''}</b><span class="muted small">${dmy(isoOf(new Date(n.at)))}</span></div><p style="white-space:pre-wrap;margin:6px 0 0">${esc(n.text)}</p></div>`).join('')}`;
}
ACTIONS.coachPrep = el => {
  const uid = el.dataset.u; const f = forcesAxes(uid); const C = coachOf(uid);
  const goals = Object.values(C.goals || {}).filter(g => g.status === 'en_cours'); const late = Object.values(C.actions || {}).filter(a => !a.done && a.due < today());
  $('#cnn textarea').value = [`Forces : ${f.forces.map(x => x.k.label).join(', ') || 'profil homogène'}.`, `Axes : ${f.axes.map(x => x.k.label).join(', ') || 'profil homogène'}.`, `Objectifs en cours : ${goals.map(g => `${g.label} (${fmtP(goalProgress(uid, g))})`).join(', ') || 'aucun'}.`, `Actions en retard : ${late.map(a => a.label).join(', ') || 'aucune'}.`, '', 'Ce qui est décidé :'].join('\n');
};
ACTIONS.noteSave = el => { const f = formData($('#cnn')); if (!f.text.trim()) return; const id = newId(); db.set(['coaching', el.dataset.u, 'notes', id], { id, at: Date.now(), by: ME.id, type: f.type, text: f.text.trim().slice(0, 4000), shared: !!f.shared, mood: f.mood ? Number(f.mood) : null }); toast('Note enregistrée'); };
ACTIONS.coachPrint = () => { document.body.classList.add('printing'); setTimeout(() => { window.print(); document.body.classList.remove('printing'); }, 100); };

// ── Rituels : brief du matin, point hebdo ─────────────────────────────────
function briefText() {
  const t = today(); let y = addDays(t, -1); for (let i = 0; i < 6 && !isWorkday(y, CLUB.id); i++) y = addDays(y, -1); const mk = curMonth(), r = rangeOf('month', mk); const L = [];
  L.push(`BRIEF ${CLUB.name.toUpperCase()} · ${dayLabel(t)}`, '');
  L.push(y === addDays(t, -1) ? 'HIER' : `${dayLabel(y).toUpperCase()}`);
  const members = clubMembers(CLUB.id); const none = [];
  members.forEach(u => { const parts = kpiList().filter(k => k.points > 0).map(k => { const v = sumRange(CLUB.id, u.id, k.id, y, y); return v ? `${k.label} ${fmtV(v, k.unit)}` : ''; }).filter(Boolean); if (parts.length) L.push(`${u.first} : ${parts.join(', ')}`); else none.push(u.first); });
  if (none.length) L.push(`Sans saisie : ${none.join(', ')}`);
  const st = statsFor(CLUB.id, null, r); L.push('', `LE MOIS · rythme attendu ${fmtP(st.expected)}`);
  st.rows.filter(x => x.k.required && x.target > 0).forEach(x => L.push(`${x.k.label} : ${fmtV(x.real, x.k.unit)} sur ${fmtV(x.target, x.k.unit)} (${fmtP(x.pct)}, ${x.status.label.toLowerCase()})`));
  const left = Math.max(1, workdaysLeft(null, CLUB.id, mk));
  Object.keys(paliersFor(CLUB.id, mk)).forEach(k => { const s = palierState(CLUB.id, mk, k); if (s && s.next) L.push(`Palier ${s.reached + 1} ${S.kpis[k].label.toLowerCase()} : encore ${fmtN(Math.ceil(s.next.target - s.real))}, soit ${((s.next.target - s.real) / left).toFixed(1).replace('.', ',')} par jour`); });
  const worst = st.rows.filter(x => x.k.required && x.target > 0 && st.expected > 0).sort((a, b) => a.pct / st.expected - b.pct / st.expected)[0];
  if (worst) { const per = (worst.target - worst.real) / left / Math.max(1, members.length); L.push('', `FOCUS DU JOUR : ${worst.k.label}, ${worst.k.unit === 'eur' ? fmtE(Math.max(0, per)) : Math.max(1, Math.ceil(per))} par personne aujourd’hui`); }
  const Q = relancesFor(CLUB.id); const n = k => Q.filter(rl => rl.kind === k).length;
  L.push('', `AUJOURD’HUI : ${plur(n('resiliation'), 'résiliation', 'résiliations')}, ${plur(n('impaye'), 'impayé', 'impayés')}, ${plur(n('anniversaire'), 'anniversaire', 'anniversaires')}, ${plur(n('suivi15') + n('suivi30'), 'suivi', 'suivis')} à appeler`);
  return L.join('\n');
}
ACTIONS.ritual = () => {
  const txt = briefText();
  openModal({ title: 'Brief du matin', drawer: true, body: `<pre class="brief">${esc(txt)}</pre>`, foot: `<button class="btn" data-act="briefCopy">Copier le texte</button><button class="btn primary" data-act="briefChat">Publier dans le chat</button>`, onMount: m => { m.dataset.txt = txt; } });
};
ACTIONS.briefCopy = () => { const t = $('.modal').dataset.txt; navigator.clipboard.writeText(t).then(() => toast('Brief copié'), () => toast('Copie impossible')); };
ACTIONS.briefChat = () => { sendChat({ text: $('.modal').dataset.txt }); closeModal(); toast('Brief publié dans le chat'); };
// Lundi : bilan de la semaine (préférence digest), une fois.
function weekDigestCard() {
  if (new Date().getDay() !== 1 || !pref('digest', true) || pref('digestSeen', '') === today()) return '';
  const r = rangeOf('week', addDays(today(), -7)), r2 = rangeOf('week', addDays(today(), -14));
  const s1 = statsFor(CLUB.id, ME.id, r, { requiredOnly: true }), s2 = statsFor(CLUB.id, ME.id, r2, { requiredOnly: true });
  const c1 = statsFor(CLUB.id, null, r, { kpiIds: ['contrats'] }).rows[0];
  return `<div class="recap-ready">${ico('chart')}<div><b>Bilan de la semaine</b><span>Votre score : ${fmtP(s1.score)} (semaine d’avant ${fmtP(s2.score)}). Équipe : ${c1 ? plur(c1.real, 'contrat', 'contrats') : 'n.d.'}.</span></div><button class="btn sm ghost" data-act="digestSeen">Fermer</button></div>`;
}
ACTIONS.digestSeen = () => { setPref('digestSeen', today()); render(); };
// Accueil commercial : son plan d'action en cours (objectifs et actions ouvertes).
function myPlanCard() {
  if (!ME) return '';
  const C = coachOf(ME.id); const goals = Object.values(C.goals || {}).filter(g => g.status === 'en_cours' && g.due >= today());
  const acts = Object.values(C.actions || {}).filter(a => !a.done).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 3);
  if (!goals.length && !acts.length) return '';
  return `<div class="card my-plan"><div class="race-h"><div><div class="eyebrow">Avec votre manager</div><h3>Mon plan d’action</h3></div><span class="spacer"></span><a class="btn ghost sm" href="#/coach/${ME.id}">Ouvrir</a></div>
    ${goals.map(g => { const p = goalProgress(ME.id, g); return `<div class="goal"><div class="row"><b class="spacer">${esc(g.label)}</b><span class="small muted">${dm(g.due)}</span></div>${progressBar(p || 0, { ticks: false })}</div>`; }).join('')}
    ${acts.map(a => `<label class="row act-row ${a.due < today() ? 'late' : ''}"><input type="checkbox" data-change="actDone" data-u="${ME.id}" data-id="${a.id}" ${a.owner === 'membre' ? '' : 'disabled'}><span class="spacer">${esc(a.label)}</span><span class="small muted">${dm(a.due)}</span></label>`).join('')}</div>`;
}
// Dernière connexion (signal « absent de l'appli »), au plus une écriture par heure.
function touchSeen() { try { if (typeof ME !== 'undefined' && ME && ME.id && S.prefs && Date.now() - Number(pref('lastSeen', 0)) > 3600e3) setPref('lastSeen', Date.now()); } catch (_) { /* hors connexion */ } }
addEventListener('hashchange', touchSeen); addEventListener('focus', touchSeen); setTimeout(touchSeen, 4000);
