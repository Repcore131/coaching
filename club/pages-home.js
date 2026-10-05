'use strict';
// ══ FIT PULSE — accueil, paliers collectifs, saisie rapide, relances ══════
//
// L'écran que le commercial ouvre sur son téléphone : où en est l'équipe,
// saisir en un geste, ce que j'ai à faire aujourd'hui. Le manager y voit en
// plus ce qui demande une action (résiliations, impayés, équipe).

// ── Paliers collectifs ────────────────────────────────────────────────────
// S.paliers[club][mois][kpi] = [{ target, reward }, …] dans l'ordre P1, P2, P3.
const PALIER_DEFAULT = { contrats: [{ target: 100, reward: '' }, { target: 115, reward: '' }, { target: 130, reward: '' }], avis: [{ target: 60, reward: '' }, { target: 80, reward: '' }] };
function paliersFor(clubId, mk) {
  const p = deepGet(S, ['paliers', clubId, mk]);
  if (p) return p;
  // pas encore réglés ce mois-ci : on reprend le dernier mois réglé
  const months = Object.keys(deepGet(S, ['paliers', clubId]) || {}).filter(m => m < mk).sort();
  return months.length ? S.paliers[clubId][months.at(-1)] : PALIER_DEFAULT;
}
function palierState(clubId, mk, kpiId) {
  const tiers = (paliersFor(clubId, mk)[kpiId] || []).filter(t => Number(t.target) > 0);
  if (!tiers.length) return null;
  const real = sumRange(clubId, null, kpiId, mk + '-01', `${mk}-${daysIn(mk)}`);
  const reached = tiers.filter(t => real >= Number(t.target)).length;
  const next = tiers.at(reached) || null;
  const max = Number(tiers.at(-1).target);
  const r = rangeOf('month', mk);
  return { kpiId, tiers, real, reached, next, max, expected: elapsed(r) };
}
function palierBlock(clubId, mk, kpiId, big) {
  const s = palierState(clubId, mk, kpiId); if (!s) return '';
  const k = S.kpis[kpiId];
  const scale = Math.max(s.max * 1.08, s.real);
  const left = s.next ? Number(s.next.target) - s.real : 0;
  const daysLeft = Math.max(1, daysIn(mk) - Number(today().slice(8)) + 1);
  return `<div class="palier ${big ? 'big' : ''}">
    <div class="row"><span class="palier-k">${kpiIcon(k)} ${esc(k.label)}</span><span class="spacer"></span><b class="palier-n">${fmtN(s.real)}</b></div>
    <div class="palier-track"><i style="width:${clamp(s.real / scale * 100, 0, 100)}%"></i>${s.tiers.map((t, i) => `<span class="palier-mark ${s.real >= t.target ? 'got' : ''}" style="left:${t.target / scale * 100}%"><em>P${i + 1}</em></span>`).join('')}<span class="palier-pace" style="left:${clamp(s.expected * s.max / scale * 100, 0, 100)}%" title="Rythme attendu pour le dernier palier"></span></div>
    <div class="palier-tiers">${s.tiers.map((t, i) => `<span class="${s.real >= t.target ? 'got' : ''}">P${i + 1} · ${fmtN(t.target)}${s.real >= t.target ? ' ✓' : ''}</span>`).join('')}</div>
    <div class="palier-msg">${s.next ? `Encore <b>${fmtN(Math.ceil(left))}</b> pour le <b>Palier ${s.reached + 1}</b>${s.next.reward ? ` · ${esc(s.next.reward)}` : ''} <span class="muted">· ${(left / daysLeft).toFixed(1).replace('.', ',')} par jour</span>` : `<b>Tous les paliers sont atteints</b> 🎉`}</div></div>`;
}

// Célébration plein écran (palier franchi, client sauvé, impayé récupéré)
function celebrate(title, sub) {
  const el = document.createElement('div'); el.className = 'celebrate';
  el.innerHTML = `<div class="celebrate-in"><div class="celebrate-t">${esc(title)}</div><div class="celebrate-s">${esc(sub || '')}</div></div>`;
  for (let i = 0; i < 28; i++) { const c = document.createElement('i'); c.style.left = (i * 37 % 100) + '%'; c.style.animationDelay = (i % 7) * 0.08 + 's'; c.style.background = i % 3 ? '#FFD200' : '#fff'; el.appendChild(c); }
  document.body.appendChild(el); el.addEventListener('click', () => el.remove()); setTimeout(() => el.remove(), 2600);
}
// palier franchi par cette saisie ? (comparaison avant / après)
function palierSnapshot() { const mk = curMonth(); return Object.keys(paliersFor(CLUB.id, mk)).map(k => { const s = palierState(CLUB.id, mk, k); return s ? s.reached : 0; }); }
function checkPalierCrossed(before) {
  const mk = curMonth(); const keys = Object.keys(paliersFor(CLUB.id, mk));
  keys.forEach((k, i) => { const s = palierState(CLUB.id, mk, k); if (s && s.reached > (before[i] || 0)) setTimeout(() => celebrate(`PALIER ${s.reached} ATTEINT`, `${S.kpis[k].label} · ${fmtN(s.real)} pour l’équipe${s.tiers.at(s.reached - 1).reward ? ' · ' + s.tiers.at(s.reached - 1).reward : ''}`), 300); });
}

// ── Saisie rapide : un geste = une saisie, annulable 5 s ──────────────────
function quickAdd(kpiId, value, userId = ME.id) {
  const before = palierSnapshot();
  const id = newId();
  db.set(['entries', id], { id, userId, clubId: CLUB.id, kpiId, date: today(), value, source: 'manual', at: Date.now(), by: ME.id });
  const k = S.kpis[kpiId];
  toastUndo(`+${fmtV(value, k.unit)} ${k.label} enregistré`, () => db.set(['entries', id], null));
  checkPalierCrossed(before);
}
function toastUndo(msg, undo) {
  const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = `<span>${esc(msg)}</span><button>Annuler</button>`;
  el.style.pointerEvents = 'auto';
  $('button', el).addEventListener('click', () => { undo(); el.remove(); toast('Saisie annulée'); });
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), 5000);
}
const QUICK_QTY = ['contrats', 'avis', 'b2b', 'invites', 'prospects'];
const QUICK_EUR = ['nutrition', 'accessoires', 'impayes'];
function quickPad() {
  const qty = QUICK_QTY.filter(k => S.kpis[k] && S.kpis[k].enabled);
  const eur = QUICK_EUR.filter(k => S.kpis[k] && S.kpis[k].enabled);
  const mine = id => sumRange(CLUB.id, ME.id, id, today(), today());
  return `<div class="quick">${qty.map(k => `<button class="quick-btn" data-act="qAdd" data-k="${k}"><span class="quick-plus">+1</span><span class="quick-l">${esc(S.kpis[k].label)}</span>${mine(k) ? `<span class="quick-today">${fmtN(mine(k))} auj.</span>` : ''}</button>`).join('')}
    ${eur.map(k => `<button class="quick-btn eur" data-act="qEur" data-k="${k}"><span class="quick-plus">€</span><span class="quick-l">${esc(S.kpis[k].label)}</span>${mine(k) ? `<span class="quick-today">${fmtE(mine(k))} auj.</span>` : ''}</button>`).join('')}</div>`;
}
ACTIONS.qAdd = el => { quickAdd(el.dataset.k, 1); };
ACTIONS.qEur = el => {
  const k = S.kpis[el.dataset.k];
  openModal({ title: k.label, body: `<div class="pad-display" id="pad-v">0</div><div class="pad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'].map(x => `<button type="button" data-p="${x}">${x}</button>`).join('')}</div><div class="row wrap" style="gap:6px;margin-top:10px">${[5, 10, 20, 30, 50].map(v => `<button type="button" class="btn sm" data-q="${v}">${v} €</button>`).join('')}</div>`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" id="pad-ok">Enregistrer</button>`,
    onMount: m => {
      let s = '';
      const show = () => { $('#pad-v', m).textContent = (s || '0') + ' €'; };
      m.addEventListener('click', e => {
        const b = e.target.closest('[data-p]'); const q = e.target.closest('[data-q]');
        if (b) { const x = b.dataset.p; if (x === '⌫') s = s.slice(0, -1); else if (x === ',') { if (!s.includes(',')) s = (s || '0') + ','; } else if (!/,\d\d$/.test(s)) s += x; show(); }
        if (q) { s = q.dataset.q; show(); }
      });
      $('#pad-ok', m).addEventListener('click', () => { const v = Math.round(toNum(s) * 100) / 100; if (!v) { toast('Saisissez un montant.'); return; } closeModal(); quickAdd(el.dataset.k, v); });
    } });
};

// ── Mes relances : ce dont je suis responsable, et ce qui tombe aujourd'hui ─
function myToDo() {
  const res = resToHandle(CLUB.id).filter(r => r.ownerId === ME.id).sort((a, b) => (a.effective || '9').localeCompare(b.effective || '9'));
  const dun = dunRows(CLUB.id).filter(c => Number(c.balance) > 0 && dunOf(c).ownerId === ME.id).sort((a, b) => (dunDue(b) - dunDue(a)) || Number(b.balance) - Number(a.balance));
  const loy = loyaltyTasks(CLUB.id).filter(t => t.state === 'todo' && ['anniversaire', 'suivi', 'renouvellement'].includes(t.type)).sort((a, b) => a.due.localeCompare(b.due));
  return { res, dun, loy };
}
function todoList(limit = 6) {
  const { res, dun, loy } = myToDo();
  const rows = [
    ...res.map(r => ({ icon: 'door', title: r.client, sub: `Résiliation · ${r.effective ? (daysTo(r.effective) <= 0 ? 'effective' : 'J-' + daysTo(r.effective)) : 'sans date'}`, hot: resUrgent(r), act: `data-act="resCall" data-id="${r.id}"`, cta: 'Noter un appel' })),
    ...dun.map(c => ({ icon: 'coins', title: c.name, sub: `Impayé · ${fmtE(Number(c.balance))}${dunOf(c).next ? ' · relance ' + dm(dunOf(c).next) : ''}`, hot: dunDue(c), act: `data-act="dunPaid" data-id="${c.id}"`, cta: 'Récupéré' })),
    ...loy.slice(0, 4).map(t => ({ icon: LOYALTY_TYPES[t.type].icon, title: t.client.name, sub: `${LOYALTY_TYPES[t.type].label}${t.client.phone ? ' · ' + t.client.phone : ''}`, hot: false, act: `data-act="go" data-href="#/loyalty"`, cta: 'Ouvrir' })),
  ];
  if (!rows.length) return '<div class="empty small" style="padding:18px">Rien d’assigné pour l’instant. Prenez un dossier dans Résiliations ou Impayés avec « Je m’en occupe ».</div>';
  return rows.slice(0, limit).map(x => `<div class="todo ${x.hot ? 'hot' : ''}"><span class="todo-i">${ico(x.icon)}</span><div class="spacer"><b>${esc(x.title)}</b><div class="muted small">${esc(x.sub)}</div></div><button class="btn sm" ${x.act}>${x.cta}</button></div>`).join('') + (rows.length > limit ? `<a class="btn ghost sm" href="#/relances" style="margin-top:6px">Voir les ${rows.length} relances ${ico('chevR')}</a>` : '');
}

// ── Accueil ───────────────────────────────────────────────────────────────
const ASSET = k => (window.PARKPULSE_ASSETS || {})[k] || null;
function clubWeather(mk) {
  // météo du club = la pire projection des paliers collectifs
  const keys = Object.keys(paliersFor(CLUB.id, mk)); if (!keys.length) return HEALTH.none;
  let worst = HEALTH.good;
  keys.forEach(k => { const s = palierState(CLUB.id, mk, k); if (!s) return; const dayNow = Number(today().slice(8)); const proj = s.real / Math.max(1, dayNow) * daysIn(mk); const t = s.tiers.filter(x => proj >= x.target).length; const h = t === s.tiers.length ? HEALTH.good : t ? HEALTH.watch : HEALTH.alert; if (h === HEALTH.alert || (h === HEALTH.watch && worst === HEALTH.good)) worst = h; });
  return worst;
}
PAGES.home = {
  title: 'Accueil',
  render() {
    const mk = curMonth(); const r = rangeOf('month', mk);
    const st = statsFor(CLUB.id, ME.id, r);
    const rk = ranking(CLUB.id, r); const me = rk.find(x => x.u.id === ME.id);
    const acc = accomplishments(ME.id);
    const hour = new Date().getHours();
    const hello = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    const daysLeft = Math.max(1, daysIn(mk) - Number(today().slice(8)) + 1);
    const mission = st.rows.filter(x => x.target > 0 && x.real < x.target && ['contrats', 'avis', 'nutrition', 'accessoires'].includes(x.k.id)).map(x => {
      const per = (x.target - x.real) / daysLeft; const doneToday = sumRange(CLUB.id, ME.id, x.k.id, today(), today());
      return { k: x.k, per: x.k.unit === 'qty' ? Math.max(1, Math.ceil(per)) : Math.ceil(per), done: doneToday };
    });
    const palierKeys = Object.keys(paliersFor(CLUB.id, mk));
    const weather = clubWeather(mk);
    const myPct = st.max ? st.earned / st.max : null;
    const myHealth = healthOf(myPct != null && st.expected ? myPct / st.expected : null);
    const banner = ASSET('banner');
    const bigKpis = palierKeys.slice(0, 2).map(k => { const s = palierState(CLUB.id, mk, k); if (!s) return ''; return `<div class="bk"><span>${esc(S.kpis[k].label)} · équipe</span><b>${fmtN(s.real)}</b><small>${s.next ? `P${s.reached + 1} à ${fmtN(s.next.target)} · encore ${fmtN(Math.ceil(s.next.target - s.real))}` : 'tous les paliers atteints'}</small></div>`; }).join('');
    const top5 = rk.filter(x => x.score != null).slice(0, 5);
    const manager = isManager();
    const recovRows = manager && typeof recovList === 'function' ? (() => { const out = []; for (let i = 3; i >= 0; i--) { const m = addMonths(mk, -i); const L = recovList(CLUB.id, m + '-01', `${m}-${daysIn(m)}`); const parts = {}; L.forEach(x => { parts[x.canal] = (parts[x.canal] || 0) + x.amount; }); out.push({ label: MOIS_C[Number(m.slice(5)) - 1], parts, total: L.reduce((a, x) => a + x.amount, 0) }); } return out; })() : [];
    return `<div class="home2">
      <section class="banner" ${banner ? `style="--banner:url('${banner}')"` : ''}><div class="banner-stripe"></div>
        <div class="banner-in"><div class="eyebrow light">${esc(CLUB.name)} · ${monthLabel(mk)}</div>
          <h1 class="banner-t">${hello} <span>${esc(ME.first)}</span></h1>
          <div class="row wrap banner-meta"><span class="jtag">J-${daysLeft - 1}</span><span>avant la fin du mois</span>${healthChip(weather)}<span class="muted-l">météo des paliers</span></div>
          <div class="banner-kpis">${bigKpis}${me && me.score != null ? `<a class="bk link" href="#/leaderboard"><span>Mon rang</span><b>#${me.rank}</b><small>sur ${rk.length} · ${acc.streak} jour(s) de suite</small></a>` : ''}</div></div></section>
      ${manager && Number(today().slice(8)) <= 5 ? `<a class="recap-ready" href="#/recap">${ico('chart')}<div><b>Le récapitulatif de ${MOIS[Number(addMonths(mk, -1).slice(5)) - 1].toLowerCase()} est prêt</b><span>Ventes, résiliations, impayés, avis, boutique : comparés au mois d’avant.</span></div>${ico('chevR')}</a>` : ''}
      ${manager ? localTransferCard() : ''}
      ${manager ? managerCockpit() : ''}
      <div class="g12">
        <div class="card col8">${palierKeys.includes('contrats') ? palierRace(CLUB.id, mk, 'contrats') : palierKeys[0] ? palierRace(CLUB.id, mk, palierKeys[0]) : '<p class="muted">Aucun palier ce mois-ci.</p>'}</div>
        <div class="card col4 paliers"><div class="race-h"><div><div class="eyebrow light">Prime d’équipe</div><h3>Paliers du mois</h3></div><span class="spacer"></span>${manager ? '<a class="btn ghost sm light" href="#/members" data-act="goPaliers">Régler</a>' : ''}</div>${palierKeys.map(k => palierBlock(CLUB.id, mk, k, false)).join('') || '<p class="muted">Aucun palier collectif.</p>'}</div>
        <div class="card col5"><div class="race-h"><div><div class="eyebrow">Un toucher = enregistré</div><h3>Saisir</h3></div></div>${quickPad()}</div>
        <div class="card col3"><div class="race-h"><div><div class="eyebrow">Mes objectifs</div><h3>Ma progression</h3></div></div>
          <div class="center">${ring(myPct, { label: fmtP(myPct), sub: 'des points', color: myHealth.color })}${healthChip(myHealth)}</div>
          ${mission.length ? `<div class="mini-mission">${mission.map(m => `<div class="${m.done >= m.per ? 'done' : ''}"><span>${esc(m.k.label)}</span><b>${m.done >= m.per ? '✓' : (m.k.unit === 'eur' ? fmtE(m.per) : m.per) + ' auj.'}</b></div>`).join('')}</div>` : '<p class="muted small center">Objectifs du mois tenus 👏</p>'}</div>
        <div class="card col4"><div class="race-h"><div><div class="eyebrow">Ce mois-ci</div><h3>Top 5</h3></div><span class="spacer"></span><a class="btn ghost sm" href="#/leaderboard">Classement</a></div>
          ${top5.map(x => { const h = healthOf(x.score != null && x.st.expected ? x.score / x.st.expected : null); return `<div class="top-r ${x.u.id === ME.id ? 'me' : ''}"><b class="top-n">${x.rank}</b>${avatar(x.u, 'xs')}<span class="spacer">${esc(fullName(x.u))}</span><i class="hdot ${h.cls}" title="${h.label}"></i><b>${fmtP(x.score)}</b></div>`; }).join('') || '<p class="muted small">Pas encore de classement.</p>'}</div>
        <div class="card ${manager ? 'col6' : 'col12'}"><div class="race-h"><div><div class="eyebrow">À mon nom</div><h3>Mes relances</h3></div><span class="spacer"></span><a class="btn ghost sm" href="#/relances">Tout voir</a></div>${todoList(5)}</div>
        ${manager ? `<div class="card col3"><div class="race-h"><div><div class="eyebrow">${MOIS[Number(mk.slice(5)) - 1]}</div><h3>Résiliations</h3></div></div>${resFunnel(CLUB.id, mk)}</div>
        <div class="card col3"><div class="race-h"><div><div class="eyebrow">Tous canaux</div><h3>Impayés récupérés</h3></div></div>${stackRows(recovRows, Object.entries(RECOV_CHANNELS).map(([key, c]) => ({ key, label: c.label, color: c.color })))}</div>` : ''}
      </div></div>`;
  },
};
// Donnees saisies sur cet appareil AVANT le mode partage (ancien mode local) :
// on propose de les verser dans la base de l'equipe, sans rien ecraser.
function localData() {
  if (backend.mode !== 'firebase' || safeLS.get('parkpulse.transferred')) return null;
  try { const st = JSON.parse(safeLS.get(LOCAL_KEY) || 'null'); if (!st || (st.meta && st.meta.demo)) return null; return st; } catch (e) { return null; }
}
function localTransferPlan(st) {
  const ops = []; let users = 0, items = 0;
  for (const [coll, val] of Object.entries(st)) {
    if (!val || typeof val !== 'object' || Array.isArray(val) || ['team', 'meta'].includes(coll)) continue;
    const remote = S[coll] || {};
    for (const [k, v] of Object.entries(val)) {
      if (remote[k] !== undefined) continue;
      if (coll === 'users') { const { salt, codeHash, bootKey, ...rest } = v; ops.push([[coll, k], rest]); users++; }
      else { ops.push([[coll, k], v]); items++; }
    }
  }
  return { ops, users, items };
}
function localTransferCard() {
  const st = localData(); if (!st) return '';
  const p = localTransferPlan(st); if (!p.ops.length) return '';
  return `<div class="recap-ready" style="cursor:default">${ico('upload')}<div><b>Données trouvées sur cet appareil</b><span>${p.users} membre(s) et ${p.items} élément(s) saisis avant la base partagée. Transférez-les pour que toute l’équipe les voie. Les membres transférés auront besoin d’un nouveau code (envoyé par e-mail).</span></div>
    <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn primary sm" data-act="localTransfer">Transférer</button><button class="btn ghost sm" data-act="localTransferSkip">Ignorer</button></div></div>`;
}
ACTIONS.localTransfer = () => {
  const st = localData(); if (!st) return;
  const p = localTransferPlan(st);
  for (let i = 0; i < p.ops.length; i += 400) db.batch(p.ops.slice(i, i + 400));
  safeLS.set('parkpulse.transferred', '1');
  toast(`Transféré : ${p.users} membre(s), ${p.items} élément(s). Générez maintenant leurs codes dans Équipe.`);
  render();
};
ACTIONS.localTransferSkip = () => { safeLS.set('parkpulse.transferred', '1'); render(); };
ACTIONS.goPaliers = () => { UI.memTab = 'paliers'; location.hash = '#/members'; };
function managerCockpit() {
  const res = resToHandle(CLUB.id); const urgent = res.filter(resUrgent).length; const noOwner = res.filter(r => !r.ownerId).length;
  const dun = dunRows(CLUB.id).filter(c => Number(c.balance) > 0); const dunTot = dun.reduce((s, c) => s + Number(c.balance), 0); const dunNobody = dun.filter(c => !dunOf(c).ownerId).length; const dunDueN = dun.filter(dunDue).length;
  const team = clubMembers(CLUB.id);
  const silent = team.filter(u => !Object.values(S.entries).some(e => e.userId === u.id && e.date === today() && e.source === 'manual'));
  const lvl = (bad, warn) => bad ? 'h-alert' : warn ? 'h-watch' : 'h-good';
  const tile = (href, l, cls, label, value, sub) => `<a class="ck2 ${cls}" href="${href}"><div class="ck2-h"><span>${label}</span><i class="hdot ${cls}"></i></div><b>${value}</b><small>${sub}</small><em>${l}</em></a>`;
  return `<div class="cockpit2">
    ${tile('#/resiliations', 'Traiter', lvl(urgent, noOwner), 'Résiliations à traiter', res.length, `${urgent} à J-7 · ${noOwner} sans responsable`)}
    ${tile('#/impayes', 'Relancer', lvl(dunNobody > 2, dunNobody || dunDueN), 'Impayés en cours', fmtE(dunTot), `${dun.length} dossiers · ${dunDueN} à relancer aujourd’hui`)}
    ${tile('#/members', 'Voir', lvl(silent.length > team.length / 2 && new Date().getHours() >= 15, silent.length), 'Sans saisie aujourd’hui', `${silent.length}/${team.length}`, silent.slice(0, 3).map(u => esc(u.first)).join(', ') || 'toute l’équipe a saisi')}
  </div>`;
}

// ── Relances (onglet du téléphone) ────────────────────────────────────────
PAGES.relances = {
  title: 'Mes relances',
  render() {
    const { res, dun, loy } = myToDo();
    return `<div class="page-head"><div><h1>Mes relances</h1><p>Les dossiers dont vous êtes responsable, et les appels du jour.</p></div></div>
      <div class="card" style="padding:6px 14px;margin-bottom:14px">${todoList(99)}</div>
      <div class="row wrap"><a class="btn" href="#/resiliations">${ico('door')} Toutes les résiliations</a><a class="btn" href="#/impayes">${ico('euro')} Tous les impayés</a><a class="btn" href="#/loyalty">${ico('heart')} Action Rétention</a></div>
      <p class="muted small">${res.length} résiliation(s), ${dun.length} impayé(s) à votre nom · ${loy.length} appel(s) de fidélisation en attente pour le club.</p>`;
  },
};

// ── Membres > Paliers collectifs ──────────────────────────────────────────
function memPaliers() {
  const mk = UI.palMonth || curMonth();
  const p = paliersFor(CLUB.id, mk); const saved = !!deepGet(S, ['paliers', CLUB.id, mk]);
  const kpis = kpiList().filter(k => k.unit === 'qty' && k.points > 0);
  const rows = Object.keys(p);
  return `<div class="row wrap" style="margin-bottom:12px">${monthNav('palMonth', mk)}<span class="spacer"></span>${saved ? '<span class="badge ok">Réglés pour ce mois</span>' : '<span class="badge warn">Repris du mois précédent : enregistrez pour les figer</span>'}</div>
    <p class="muted small">Objectifs COLLECTIFS du club : chaque saisie de l’équipe fait avancer la barre, visible sur l’accueil de tous. Laissez un seuil vide pour retirer un palier.</p>
    <div class="grid">${rows.map(k => `<div class="card"><div class="card-head"><h3>${esc(S.kpis[k] ? S.kpis[k].label : k)}</h3><span class="spacer"></span><button class="btn ghost sm danger" data-act="palDel" data-k="${k}">Retirer</button></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Palier</th><th class="num">Seuil (équipe)</th><th>Récompense</th></tr></thead><tbody>${[0, 1, 2].map(i => { const t = (p[k] || [])[i] || {}; return `<tr><td><b>P${i + 1}</b></td><td class="num"><input class="cell" type="number" min="0" value="${t.target || ''}" data-pal="${k}" data-i="${i}" data-f="target"></td><td><input class="input sm" value="${esc(t.reward || '')}" placeholder="ex. Prime 100 € chacun" data-pal="${k}" data-i="${i}" data-f="reward"></td></tr>`; }).join('')}</tbody></table></div></div>`).join('')}</div>
    <div class="row wrap" style="margin-top:12px"><select class="input sm" style="width:auto" id="pal-add">${kpis.filter(k => !rows.includes(k.id)).map(k => `<option value="${k.id}">${esc(k.label)}</option>`).join('')}</select><button class="btn sm" data-act="palAdd">${ico('plus')} Ajouter un objectif collectif</button><span class="spacer"></span><button class="btn primary" data-act="palSave" data-mk="${mk}">Enregistrer les paliers de ${monthLabel(mk)}</button></div>`;
}
function palRead(mk) {
  const p = JSON.parse(JSON.stringify(paliersFor(CLUB.id, mk)));
  $$('[data-pal]').forEach(el => { const k = el.dataset.pal, i = Number(el.dataset.i); p[k] = p[k] || []; while (p[k].length <= i) p[k].push({ target: 0, reward: '' }); p[k][i][el.dataset.f] = el.dataset.f === 'target' ? toNum(el.value) : el.value.trim(); });
  Object.keys(p).forEach(k => { p[k] = p[k].filter(t => Number(t.target) > 0).sort((a, b) => a.target - b.target); });
  return p;
}
ACTIONS.palSave = el => { db.set(['paliers', CLUB.id, el.dataset.mk], palRead(el.dataset.mk)); toast('Paliers enregistrés'); };
ACTIONS.palAdd = () => { const k = $('#pal-add').value; if (!k) return; const mk = UI.palMonth || curMonth(); const p = palRead(mk); p[k] = [{ target: 10, reward: '' }]; db.set(['paliers', CLUB.id, mk], p); };
ACTIONS.palDel = el => { const mk = UI.palMonth || curMonth(); const p = palRead(mk); delete p[el.dataset.k]; db.set(['paliers', CLUB.id, mk], p); };

// ── Barre d'onglets du téléphone ──────────────────────────────────────────
function tabBar(route) {
  const t = [['home', 'Accueil', 'dashboard'], ['saisir', 'Saisir', 'plus'], ['relances', 'Relances', 'phone'], ['leaderboard', 'Classement', 'trophy'], ['more', 'Plus', 'menu']];
  const n = (() => { const { res, dun } = myToDo(); return res.length + dun.filter(dunDue).length; })();
  return `<nav class="tabbar">${t.map(([id, l, i]) => id === 'saisir' ? `<button class="tb-main" data-act="tbSaisir" aria-label="Saisir">${ico('plus')}</button>` : id === 'more' ? `<button class="tb" data-act="burger">${ico(i)}<span>${l}</span></button>` : `<a class="tb ${route === id ? 'on' : ''}" href="#/${id}">${ico(i)}<span>${l}</span>${id === 'relances' && n ? `<em>${n}</em>` : ''}</a>`).join('')}</nav>`;
}
ACTIONS.tbSaisir = () => {
  openModal({ title: 'Saisir', body: `${quickPad()}<p class="muted small" style="margin-bottom:0">Pour une autre date ou un autre membre : <a href="javascript:void 0" data-act="openSaisiesFromPad">saisie détaillée</a>.</p>` });
};
ACTIONS.openSaisiesFromPad = () => { closeModal(); ACTIONS.openSaisies(); };
