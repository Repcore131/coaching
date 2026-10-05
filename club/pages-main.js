'use strict';
// ══ FIT PULSE — accueil, tableau de bord, classement, feed, chat, defis ══

// ── Premiere ouverture ────────────────────────────────────────────────────
PAGES.onboarding = {
  auth: false,
  render() {
    return `<div class="auth"><div class="auth-card">
      ${brandBlock(true)}
      <h1 style="font-size:26px">Bienvenue</h1>
      <p class="muted">L’outil de pilotage commercial de <b style="color:#fff">nos</b> clubs Fitness Park : objectifs, classement, rétention, imports Resamania. Aucun autre club, aucun réseau : vos chiffres restent chez vous.</p>
      <form id="ob" class="grid" style="margin-top:16px">
        <label class="field"><span>Nom du club</span><input class="input" name="club" required placeholder="Fitness Park …"></label>
        <div class="form-grid"><label class="field"><span>Votre prénom</span><input class="input" name="first" required></label><label class="field"><span>Votre nom</span><input class="input" name="last" required></label></div>
        <label class="field"><span>E-mail</span><input class="input" type="email" name="email" placeholder="facultatif en mode local"></label>
        <button class="btn primary" type="submit">Créer mon club</button>
      </form>
      <div class="row" style="margin:16px 0 0"><span class="spacer" style="height:1px;background:#2a2a2e"></span><span class="muted small">ou</span><span class="spacer" style="height:1px;background:#2a2a2e"></span></div>
      <button class="btn" style="width:100%;margin-top:14px;background:#1b1b1e;border-color:#2a2a2e;color:#fff" data-act="loadDemo">Découvrir avec des données de démonstration</button>
      <p class="muted small" style="margin-top:14px">${backend.mode === 'local' ? 'Mode local : les données restent dans ce navigateur. Le mode partagé (toute l’équipe sur la même base) s’active dans config.js.' : 'Mode partagé : base Firebase de l’équipe.'}</p>
    </div></div>`;
  },
};
document.addEventListener('submit', e => {
  if (e.target.id !== 'ob') return;
  e.preventDefault();
  const f = formData(e.target);
  const st = emptyState();
  const cid = norm(f.club).replace(/ /g, '-').slice(0, 30) || 'club';
  st.clubs[cid] = { id: cid, name: f.club.trim(), address: '', city: '', createdAt: Date.now() };
  const uid = newId();
  if (backend.mode === 'firebase') f.email = backend.user.email;
  st.users[uid] = { id: uid, first: f.first.trim(), last: f.last.trim(), email: (f.email || '').trim().toLowerCase(), role: 'manager', clubs: [cid], avatar: 'h1', status: 'active', createdAt: Date.now() };
  if (st.users[uid].email) st.team[st.users[uid].email.replace(/\./g, ',')] = true;
  db.replace(st);
  login(st.users[uid]);
  toast('Club créé. Ajoutez votre équipe dans Membres.');
});
ACTIONS.loadDemo = () => { db.replace(demoState()); const ops = bootstrapOps(); if (ops.length) db.batch(ops); render(); };

// ── Connexion ─────────────────────────────────────────────────────────────
// Un seul parcours, sur ordinateur comme sur telephone : e-mail + code
// personnel. En ligne (mode partage), le code est verifie par la base de
// l'equipe : il marche sur n'importe quel appareil.
PAGES.login = {
  auth: false,
  render() {
    const shared = backend.mode === 'firebase';
    const img = (window.PARKPULSE_ASSETS || {}).login;
    const club = (window.PARKPULSE_CLUB || {}).name || 'Fitness Park';
    const q = new URLSearchParams(location.search);
    const email = q.get('email') || safeLS.get('parkpulse.lastEmail') || '';
    const demo = !shared && S ? Object.values(S.users).filter(u => isActive(u) && !u.codeHash).sort((a, b) => (ROLES[b.role] || {}).rank - (ROLES[a.role] || {}).rank || fullName(a).localeCompare(fullName(b))) : [];
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return `<div class="auth login2"${img ? ` style="--login:url('${img}')"` : ''}><div class="login-bg" aria-hidden="true"></div>
      <div class="login-wrap">
        <div class="login-claim"><span>Chaque contrat compte.</span><span>Chaque client aussi.</span><p>${esc(club)} · l’équipe commerciale</p></div>
        <div class="login-card">
          ${brandBlock(true)}
          <h1>Connexion</h1>
          <form id="lgc" class="login-form" novalidate>
            <label class="field"><span>E-mail</span><input class="input" type="email" name="email" id="lg-email" required inputmode="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="prenom.nom@exemple.fr" value="${esc(email)}"></label>
            <label class="field"><span>Code d’accès</span><input class="input code-input" name="code" id="lg-code" required autocomplete="current-password" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="17" placeholder="FP-XXXX-XXXX-XXXX"></label>
            <div id="lg-msg" class="login-msg" role="alert" aria-live="polite">${navigator.onLine ? '' : 'Pas de connexion internet : activez le Wi-Fi ou les données mobiles.'}</div>
            <button class="btn primary login-btn" type="submit" id="lg-btn">Se connecter</button>
          </form>
          <p class="login-help">Votre code personnel vous a été envoyé par e-mail. Pas reçu ? Regardez dans les spams ou demandez-le à votre manager.</p>
          ${!standalone ? `<details class="login-install"><summary>${ico('download')} Installer Fit Pulse sur mon téléphone</summary><p><b>iPhone</b> (Safari) : bouton Partager ⬆︎ puis « Sur l’écran d’accueil ».<br><b>Android / Samsung</b> : menu ⋮ (ou ≡) puis « Ajouter à l’écran d’accueil » / « Installer l’application ».</p></details>` : ''}
          ${demo.length ? `<div class="muted small" style="margin-top:18px;font-weight:700">Profils de démonstration</div><div class="who">${demo.map(u => `<button data-act="loginAs" data-id="${u.id}">${avatar(u)}<span><b>${esc(fullName(u))}</b><br><span class="muted small">${roleLabel(u.role)} · ${(u.clubs || []).map(c => S.clubs[c] ? esc(S.clubs[c].name) : '').join(', ')}</span></span></button>`).join('')}</div>` : ''}
          ${!shared && S && S.meta.demo ? '<button class="btn sm ghost" style="margin-top:12px;color:#9a9aa0" data-act="resetAll">Effacer la démo</button>' : !shared && S && !Object.keys(S.entries).length ? '<button class="btn login-alt" data-act="loadDemo">Découvrir avec des données de démonstration</button>' : ''}
        </div>
      </div></div>`;
  },
  mount() {
    const c = $('#lg-code'), e = $('#lg-email');
    if (c) c.addEventListener('input', () => {
      const raw = c.value.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^FP/, '').slice(0, 12);
      const v = raw ? 'FP-' + raw.replace(/(.{4})(?=.)/g, '$1-') : '';
      if (v !== c.value) c.value = v;
      loginMsg('');
    });
    if (e && !e.value) e.focus({ preventScroll: true }); else if (c && matchMedia('(pointer:fine)').matches) c.focus({ preventScroll: true });
  },
};
function loginMsg(t, kind = 'bad') { const m = $('#lg-msg'); if (m) { m.textContent = t; m.dataset.kind = kind; } }
addEventListener('online', () => { if ($('#lg-msg') && /internet/.test($('#lg-msg').textContent)) loginMsg(''); });
addEventListener('offline', () => { if ($('#lg-msg')) loginMsg('Pas de connexion internet : activez le Wi-Fi ou les données mobiles.'); });
document.addEventListener('submit', async e => {
  if (e.target.id !== 'lgc') return;
  e.preventDefault();
  const f = formData(e.target);
  const email = (f.email || '').trim().toLowerCase();
  const code = (f.code || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { loginMsg('Saisissez votre adresse e-mail complète.'); $('#lg-email').focus(); return; }
  if (normCode(code).replace(/[^A-Z0-9]/g, '').length !== 14) { loginMsg('Le code fait 12 caractères : FP-XXXX-XXXX-XXXX.'); $('#lg-code').focus(); return; }
  safeLS.set('parkpulse.lastEmail', email);
  const btn = $('#lg-btn'); btn.disabled = true; btn.classList.add('loading'); btn.textContent = 'Connexion…'; loginMsg('');
  const done = () => { if (btn.isConnected) { btn.disabled = false; btn.classList.remove('loading'); btn.textContent = 'Se connecter'; } };
  if (backend.mode === 'firebase') {
    try {
      const id = await backend.codeLogin(email, code);
      if (!S) db.replace(emptyState());
      const ops = bootstrapOps(); if (ops.length) db.batch(ops);
      const u = S.users[id];
      if (!u || u.status === 'archived') { await backend.signOut(); done(); loginMsg('Ce compte n’est plus actif. Voyez avec votre manager.'); return; }
      if (u.status === 'pending') db.set(['users', u.id, 'status'], 'active');
      if (history.replaceState && /[?&]email=/.test(location.search)) { const q = new URLSearchParams(location.search); q.delete('email'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); }
      login(S.users[id]); toast(`Bienvenue ${u.first} · accès ${roleLabel(u.role)}`);
    } catch (err) { done(); loginMsg(err.kind ? err.message : 'Connexion impossible : ' + (err.code || err.message)); }
    return;
  }
  // Mode local : une meme adresse peut porter plusieurs comptes (createur et
  // manager) : c'est le code qui designe le compte.
  for (const u of Object.values(S.users)) {
    if ((u.email || '').toLowerCase() !== email || !u.codeHash || u.status === 'archived') continue;
    if (await hashCode(u.salt, code) === u.codeHash) {
      if (u.status === 'pending') db.set(['users', u.id, 'status'], 'active');
      login(S.users[u.id]); toast(`Bienvenue ${u.first} · accès ${roleLabel(u.role)}`); return;
    }
  }
  done(); loginMsg('E-mail ou code incorrect.');
});
ACTIONS.loginAs = el => login(S.users[el.dataset.id]);
ACTIONS.resetAll = async () => { if (await confirmDlg('Effacer toutes les données de ce navigateur ?', { ok: 'Tout effacer', danger: true })) { backend.wipe(); S = null; ME = null; if ((window.PARKPULSE_ACCOUNTS || []).length && backend.mode === 'local') { db.replace(emptyState()); db.batch(bootstrapOps()); } render(); } };

// ── Tableau de bord ───────────────────────────────────────────────────────
PAGES.dashboard = {
  title: 'Tableau de bord',
  render() {
    const mk = UI.dashMonth || curMonth();
    const view = UI.dashView || (isCreator() ? 'club' : 'perso');
    const tab = UI.dashTab || 'objectifs';
    const members = clubMembers(CLUB.id);
    let who = view === 'perso' ? (UI.dashUser && S.users[UI.dashUser] ? UI.dashUser : isCreator() ? (members[0] || {}).id || null : ME.id) : null;
    if (who && !isManager() && who !== ME.id) who = ME.id;
    const r = rangeOf('month', mk);
    const st = statsFor(CLUB.id, who, r);
    const subject = who ? S.users[who] : null;
    const filters = `<div class="row wrap">
      ${seg('dashView', [['perso', 'Vue perso'], ['club', 'Vue club']], view)}
      ${view === 'perso' && isManager() ? `<select class="input sm" style="width:auto" data-change="dashUser">${members.map(u => `<option value="${u.id}" ${u.id === who ? 'selected' : ''}>${esc(fullName(u))}${u.id === ME.id ? ' (moi)' : ''}</option>`).join('')}</select>` : ''}
      <span class="spacer"></span>${monthNav('dashMonth', mk)}</div>`;
    const head = `<div class="page-head"><div><h1>${view === 'club' ? esc(CLUB.name) : esc(fullName(subject))}</h1><p>${view === 'club' ? 'Objectifs cumulés de l’équipe active' : 'Objectifs individuels'} · ${monthLabel(mk)}</p></div></div>`;
    return head + filters + `<div style="margin-top:14px">${tabs('dashTab', [['objectifs', 'Objectifs'], ['analyses', 'Analyses']], tab)}</div>` +
      (tab === 'objectifs' ? dashObjectives(st, r, subject, who) : dashAnalyses(r, who)) +
      `<button class="saisies-tab" data-act="openSaisies">＋ Saisir</button>`;
  },
  mount() { bindKpiDrag(); },
};
ACTIONS.dashUser = el => { UI.dashUser = el.value; render(); };

function moodOf(st) {
  if (st.score == null) return 'ok';
  const ratio = st.progress != null ? st.progress / Math.max(st.expected, 0.03) : 1;
  return ratio >= 1 ? 'happy' : ratio >= 0.7 ? 'ok' : 'tired';
}
function dashObjectives(st, r, subject, who) {
  if (!st.rows.some(x => x.target > 0)) {
    return `<div class="card empty"><div class="title">Pas d’objectif pour ${monthLabel(r.from.slice(0, 7))}</div>
      <p>${isManager() ? 'Fixez les objectifs du mois dans Membres > Objectifs.' : 'Votre manager n’a pas encore fixé vos objectifs du mois.'}</p>
      ${isManager() ? '<a class="btn primary" href="#/members" data-act="go" data-href="#/members">Fixer les objectifs</a>' : ''}</div>`;
  }
  const exp = st.expected;
  // Avancement continu compare au rythme (les points en marches de 25 % ne le
  // sont jamais : 49 % de tout au jour 10 n'est pas « en retard »).
  const pctPts = st.progress || 0;
  const lag = Math.round(st.max * (exp - pctPts));
  const status = statusOf(pctPts, exp);
  const conv = (() => {
    // Resamania (Taux de transformation par commerciaux) prime quand il est importe
    const tti = deepGet(S, ['rsm', 'controls', CLUB.id, 'tti', r.from.slice(0, 7)]);
    if (tti) {
      const rows = who ? [tti[who]].filter(Boolean) : Object.values(tti);
      const cr = rows.reduce((a, x) => a + Number(x.created || 0), 0), tr = rows.reduce((a, x) => a + Number(x.transformed || 0), 0);
      if (cr) return { v: fmtP(tr / cr), sub: `${fmtN(tr)} transformé(s) / ${fmtN(cr)} prospect(s) créé(s) · source Resamania` };
    }
    const c = st.rows.find(x => x.k.id === 'contrats'), p = st.rows.find(x => x.k.id === 'prospects');
    if (!c || !p || !p.real) return { v: '—', sub: `${fmtN(c ? c.real : 0)} contrat(s) / ${fmtN(p ? p.real : 0)} prospect(s)` };
    return { v: fmtP(c.real / p.real), sub: `${fmtN(c.real)} contrat(s) / ${fmtN(p.real)} prospect(s)` };
  })();
  const order = pref('kpiOrder', null);
  let rows = st.rows.filter(x => x.target > 0 || x.real > 0);
  if (order) rows.sort((a, b) => (order.indexOf(a.k.id) + 1 || 99) - (order.indexOf(b.k.id) + 1 || 99));
  const tips = pref('tipDrag', true);
  return `<div class="dash-top">
    <div class="card hero">
      <div>${mascot(subject ? subject.avatar : 'h1', moodOf(st), 120)}</div>
      <div>
        <div class="row"><span class="muted small">${subject ? 'Progression du mois' : 'Progression du club'}</span><span class="spacer"></span><span class="badge ${status.cls === 'status-ok' ? 'ok' : status.cls === 'status-warn' ? 'warn' : status.cls === 'status-bad' ? 'bad' : ''}">${status.label}</span></div>
        <div class="big">${fmtP(pctPts)}</div>
        <div><b>${fmtN(st.earned)}</b> / ${fmtN(st.max)} pts ${lag > 0 ? `· <span style="color:#ff8a7a">${fmtN(lag)} pts de retard</span> sur le rythme` : st.max ? '· <span style="color:#7be0a5">dans le rythme</span>' : ''}</div>
        <div class="tiers">${TIERS.map(t => `<span class="${pctPts >= t ? 'got' : ''}">${t * 100} %</span>`).join('')}</div>
        <div class="row" style="margin-top:12px"><button class="btn sm primary" data-act="dayRecap" data-who="${who || ''}">Bilan du jour</button><span class="muted small">Rythme attendu : ${fmtP(exp)} (jour ${Math.round(exp * daysIn(r.from.slice(0, 7)))}/${daysIn(r.from.slice(0, 7))})</span></div>
      </div>
    </div>
    <div class="grid">
      <div class="card"><div class="muted small">Taux de conversion</div><div class="title" style="font-size:34px">${conv.v}</div><div class="muted small">${conv.sub}</div></div>
      ${!who && typeof recovList === 'function' && recovList(CLUB.id, r.from, r.to).length ? (() => { const L = recovList(CLUB.id, r.from, r.to); const t = L.reduce((a, x) => a + x.amount, 0); const e = L.filter(x => x.canal === 'equipe').reduce((a, x) => a + x.amount, 0); return `<a class="card" href="#/impayes" style="text-decoration:none"><div class="muted small">Impayés récupérés, tous canaux</div><div class="title" style="font-size:34px">${fmtE(t)}</div><div class="muted small">dont équipe ${fmtE(e)} (${fmtP(t ? e / t : null)}) · voir le détail par canal</div></a>`; })() : ''}
      <div class="card"><div class="muted small">Score pondéré ${ico('info', 'ico')}</div><div class="title" style="font-size:34px">${fmtP(st.score)}</div><div class="muted small">${st.reached}/${st.count} KPI atteints · moyenne des % pondérée par les points (plafond 150 % par KPI)</div></div>
    </div>
  </div>
  ${tips ? `<div class="alert info" style="margin-bottom:14px">${ico('grip')}<div class="spacer">Astuce : réorganisez les cartes par glisser-déposer (poignée en haut à droite).</div><button class="btn ghost sm" data-act="closeTip">${ico('x')}</button></div>` : ''}
  <div class="kpi-grid" id="kpi-grid">${rows.map(x => kpiCard(x, exp)).join('')}</div>`;
}
ACTIONS.closeTip = () => setPref('tipDrag', false);
function kpiCard(x, exp) {
  const { k, real, target, pct, earned, status } = x;
  const hl = healthOf(pct != null && exp ? pct / exp : null);
  return `<div class="card kpi ${hl.cls}" draggable="true" data-kpi="${k.id}">
    <div class="row"><span class="kpi-ico">${kpiIcon(k)}</span><b>${esc(k.label)}</b>${k.required ? `<span class="badge req" title="KPI obligatoire du classement">${ico('crown', 'ico ico-xs')} Obligatoire</span>` : ''}<span class="spacer"></span><span class="drag" title="Glisser pour réorganiser">${ico('grip')}</span></div>
    <div class="row" style="align-items:flex-end;margin-top:8px"><div class="val">${fmtV(real, k.unit)} <small>/ ${fmtV(target, k.unit)}</small></div><span class="spacer"></span><b class="${status.cls}" style="font-size:18px">${fmtP(pct)}</b></div>
    <div style="margin-top:10px">${progressBar(pct, { pace: exp })}</div>
    <div class="tierlbl"><span>${fmtN(earned)} / ${fmtN(target ? k.points : 0)} pts</span><span class="${status.cls}">${status.label}</span></div>
    <div class="kpi-msg">${esc(paceMessage(x, exp))}</div></div>`;
}
function bindKpiDrag() {
  const grid = $('#kpi-grid'); if (!grid) return;
  let dragId = null;
  grid.addEventListener('dragstart', e => { const c = e.target.closest('.kpi'); if (!c) return; dragId = c.dataset.kpi; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
  grid.addEventListener('dragend', () => { $$('.kpi', grid).forEach(c => c.classList.remove('dragging', 'over')); });
  grid.addEventListener('dragover', e => { e.preventDefault(); const c = e.target.closest('.kpi'); $$('.kpi', grid).forEach(x => x.classList.toggle('over', x === c && c.dataset.kpi !== dragId)); });
  grid.addEventListener('drop', e => {
    e.preventDefault(); const c = e.target.closest('.kpi'); if (!c || !dragId || c.dataset.kpi === dragId) return;
    const ids = $$('.kpi', grid).map(x => x.dataset.kpi).filter(id => id !== dragId);
    ids.splice(ids.indexOf(c.dataset.kpi), 0, dragId);
    setPref('kpiOrder', ids);
  });
}

function dashAnalyses(r, who) {
  const mk = r.from.slice(0, 7); const y = Number(mk.slice(0, 4));
  const kpis = kpiList().filter(k => k.points > 0 || k.id === 'prospects');
  const kSel = UI.anaKpi && S.kpis[UI.anaKpi] ? UI.anaKpi : (kpis[1] || kpis[0]).id;
  const k = S.kpis[kSel];
  const cm = curMonth();
  // Comparaison N / N-1 : historique mensuel du club s'il existe pour ce mois,
  // sinon les saisies. Le total ne compare QUE les mois termines des deux
  // annees (pas 10 mois contre 9).
  const manualKey = { contrats: 'contrats', nutrition: 'complements', accessoires: 'goodies', impayes: 'impayes' }[kSel];
  const valOf = (m) => {
    const man = manualKey && !who ? deepGet(S.monthly, [CLUB.id, m, manualKey]) : null;
    if (man != null && man !== '') return Number(man);
    return sumRange(CLUB.id, who, kSel, m + '-01', `${m}-${daysIn(m)}`);
  };
  const lab = MOIS_C.map(x => x.replace('.', ''));
  const vN1 = [], vN = [];
  for (let m = 1; m <= 12; m++) { vN1.push(valOf(`${y - 1}-${pad(m)}`)); vN.push(`${y}-${pad(m)}` <= cm ? valOf(`${y}-${pad(m)}`) : 0); }
  const closed = []; for (let m = 1; m <= 12; m++) if (`${y}-${pad(m)}` < cm) closed.push(m - 1);
  const totN1 = closed.reduce((s, i) => s + vN1[i], 0), totN = closed.reduce((s, i) => s + vN[i], 0);
  const evo = totN1 ? (totN - totN1) / totN1 : null;
  const st = statsFor(CLUB.id, who, r);
  const exp = st.expected;
  const period = UI.caPeriod || '12';
  const nM = { '3': 3, '6': 6, '12': 12, '24': 24 }[period] || (Number(cm.slice(5)));
  const caLabels = [], caVals = [];
  for (let i = nM - 1; i >= 0; i--) { const m = addMonths(period === 'ytd' ? `${cm.slice(0, 4)}-${pad(nM)}` : cm, -i); caLabels.push(MOIS_C[Number(m.slice(5)) - 1] + ' ' + m.slice(2, 4)); caVals.push(caMonth(CLUB.id, m, who)); }
  const caTot = caVals.reduce((a, b) => a + b, 0);
  return `<div class="grid">
    <div class="card">
      <div class="card-head"><h3>Comparaison ${y} vs ${y - 1}</h3><span class="spacer"></span>
        <select class="input sm" style="width:auto" data-change="anaKpi">${kpis.map(x => `<option value="${x.id}" ${x.id === kSel ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
        ${isManager() ? `<a class="btn sm" href="#/imports" data-act="goManual" title="Corriger l’historique mensuel">${ico('edit')}</a>` : ''}</div>
      <div class="row wrap" style="gap:22px;margin-bottom:8px">
        <div><div class="muted small">${y - 1} (${closed.length} mois)</div><b class="title" style="font-size:22px">${fmtV(totN1, k.unit)}</b></div>
        <div><div class="muted small">${y} (${closed.length} mois)</div><b class="title" style="font-size:22px">${fmtV(totN, k.unit)}</b></div>
        <div><div class="muted small">Évolution à période égale</div><b class="title ${evo == null ? '' : evo >= 0 ? 'ok' : 'bad'}" style="font-size:22px">${evo == null ? '—' : (evo >= 0 ? '+' : '') + (evo * 100).toFixed(1).replace('.', ',') + ' %'}</b></div>
        <div class="muted small" style="max-width:280px">Le mois en cours (${monthLabel(cm)}) est affiché mais exclu du total tant qu’il n’est pas terminé.</div>
      </div>
      <div class="legend"><span><i style="background:#8a8a90"></i>${y - 1}</span><span><i style="background:#FFD200"></i>${y}</span></div>
      ${barChart({ labels: lab, series: [{ name: String(y - 1), color: '#8a8a90', values: vN1 }, { name: String(y), color: '#FFD200', values: vN }], fmt: v => k.unit === 'eur' ? fmtN(v) + ' €' : fmtN(v) })}
    </div>
    <div class="card">
      <div class="card-head"><h3>Progression par objectif</h3><span class="spacer"></span><span class="muted small">Repère : rythme attendu au ${Math.round(exp * daysIn(mk))}/${daysIn(mk)}</span></div>
      <div class="legend" style="margin-bottom:10px"><span><i style="background:var(--ok)"></i>En avance / à l’heure</span><span><i style="background:var(--warn)"></i>En léger retard</span><span><i style="background:var(--bad)"></i>Très en retard</span></div>
      ${st.rows.filter(x => x.target > 0).map(x => {
        const col = x.status.cls === 'status-ok' ? 'var(--ok)' : x.status.cls === 'status-warn' ? 'var(--warn)' : x.status.cls === 'status-bad' ? 'var(--bad)' : 'var(--muted)';
        return `<div style="display:grid;grid-template-columns:150px 1fr 60px;gap:12px;align-items:center;margin:9px 0"><span class="small"><b>${esc(x.k.label)}</b></span>
          <div class="bar" style="height:14px"><i style="width:${clamp(x.pct * 100, 0, 100)}%;background:${col}"></i><span class="pace" style="left:${exp * 100}%"></span></div><b class="num small" style="text-align:right">${fmtP(x.pct)}</b></div>`;
      }).join('') || '<p class="muted">Aucun objectif ce mois-ci.</p>'}
    </div>
    <div class="card">
      <div class="card-head"><h3>Ventes boutique ${who ? 'personnelles' : 'du club'} (nutrition, accessoires)</h3><span class="spacer"></span>${seg('caPeriod', [['3', '3M'], ['6', '6M'], ['12', '12M'], ['24', '24M'], ['ytd', 'YTD']], period)}</div>
      <p class="muted small" style="margin-top:-4px">Somme des KPI en euros (nutrition, accessoires, impayés récupérés…) : <b>${fmtE(caTot)}</b> sur la période.</p>
      ${lineChart({ labels: caLabels, values: caVals, fmt: v => fmtN(v) + ' €' })}
    </div></div>`;
}
ACTIONS.anaKpi = el => { UI.anaKpi = el.value; render(); };
ACTIONS.goManual = () => { UI.impTab = 'manual'; location.hash = '#/imports'; };

// Bilan du jour : la vraie liste des saisies du jour, et un titre qui suit.
ACTIONS.dayRecap = el => {
  const who = el.dataset.who || null;
  let d = today();
  const draw = () => {
    const list = Object.values(S.entries).filter(e => e.date === d && e.clubId === CLUB.id && (!who || e.userId === who) && entryCounts(e));
    const r = rangeOf('month', d.slice(0, 7)); const st = statsFor(CLUB.id, who, r);
    const byK = {}; list.forEach(e => { byK[e.kpiId] = (byK[e.kpiId] || 0) + Number(e.value); });
    const title = !list.length ? 'Journée sans saisie' : Object.keys(byK).length >= 3 ? 'Mission accomplie 💪' : 'Belle journée';
    return `<div class="row" style="justify-content:center;gap:6px;margin-bottom:12px"><button class="btn icon sm" data-d="-1">${ico('chevL')}</button><b style="min-width:200px;text-align:center">${dayLabel(d)}</b><button class="btn icon sm" data-d="1" ${d >= today() ? 'disabled' : ''}>${ico('chevR')}</button></div>
      <div style="text-align:center"><div class="title" style="font-size:28px">${title}</div></div>
      ${list.length ? `<div class="grid" style="margin:16px 0">${Object.entries(byK).map(([kid, v]) => `<div class="row card" style="padding:10px 14px"><span class="kpi-ico">${kpiIcon(S.kpis[kid] || { id: kid })}</span><b>${esc(S.kpis[kid] ? S.kpis[kid].label : kid)}</b><span class="spacer"></span><b class="title" style="font-size:20px">+${fmtV(v, S.kpis[kid] ? S.kpis[kid].unit : 'qty')}</b></div>`).join('')}</div>` : '<p class="muted" style="text-align:center">Aucune saisie enregistrée ce jour-là.</p>'}
      <div class="muted small" style="margin-top:8px">Progression du mois</div>${progressBar(st.progress || 0, { pace: st.expected })}<div class="small" style="margin-top:4px"><b>${fmtP(st.max ? st.earned / st.max : 0)}</b> · ${fmtN(st.earned)} / ${fmtN(st.max)} pts</div>`;
  };
  const m = openModal({ title: 'Récap du jour', body: `<div id="dr">${draw()}</div>` });
  m.addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (!b || b.disabled) return; d = addDays(d, Number(b.dataset.d)); $('#dr', m).innerHTML = draw(); });
};

// Panneau « Saisies » : saisir ses KPI (ou ceux d'un membre pour un manager)
// et cocher la liste de taches du jour.
ACTIONS.openSaisies = () => {
  let tab = 'saisie';
  const draw = (m) => {
    const members = isManager() ? clubMembers(CLUB.id) : [ME];
    const body = tab === 'saisie' ? `
      <form id="sf" class="grid">
        <div class="form-grid">
          <label class="field"><span>Commercial</span><select class="input" name="userId">${members.map(u => `<option value="${u.id}" ${u.id === ME.id ? 'selected' : ''}>${esc(fullName(u))}</option>`).join('')}</select></label>
          <label class="field"><span>Date</span><input class="input" type="date" name="date" value="${today()}" max="${today()}" ${minEntryDate(CLUB.id) ? `min="${minEntryDate(CLUB.id)}"` : ''}></label>
        </div>
        ${kpiList().map(k => `<label class="row card" style="padding:9px 12px"><span class="kpi-ico">${kpiIcon(k)}</span><span class="spacer"><b>${esc(k.label)}</b><br><span class="muted small">${k.unit === 'eur' ? 'Montant TTC en €' : 'Quantité'}</span></span><input class="input sm" style="width:110px;text-align:right" type="number" min="0" step="${k.unit === 'eur' ? '0.01' : '1'}" name="k_${k.id}" placeholder="0"></label>`).join('')}
        <button class="btn primary" type="submit">Enregistrer</button>
      </form>
      <h3 style="margin:20px 0 8px">Mes dernières saisies</h3>
      ${Object.values(S.entries).filter(e => e.source === 'manual' && e.clubId === CLUB.id && (e.userId === ME.id || e.by === ME.id)).sort((a, b) => b.at - a.at).slice(0, 8).map(e => `<div class="row small" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${dm(e.date)}</span><b>${esc(S.kpis[e.kpiId] ? S.kpis[e.kpiId].label : '')}</b><span class="muted">${esc(fullName(S.users[e.userId]))}</span><span class="spacer"></span><b>+${fmtV(e.value, S.kpis[e.kpiId] ? S.kpis[e.kpiId].unit : 'qty')}</b><button class="btn ghost icon sm" data-delentry="${e.id}" title="Supprimer">${ico('trash')}</button></div>`).join('') || '<p class="muted small">Aucune saisie.</p>'}`
      : tasksToday();
    $('.modal-body', m).innerHTML = `<div class="tabs"><button data-t="saisie" class="${tab === 'saisie' ? 'on' : ''}">Mes saisies</button><button data-t="tasks" class="${tab === 'tasks' ? 'on' : ''}">Liste de tâches</button></div>${body}`;
  };
  const m = openModal({ title: 'Saisies', drawer: true, body: '' });
  draw(m);
  m.addEventListener('click', async e => {
    const t = e.target.closest('[data-t]'); if (t) { tab = t.dataset.t; draw(m); return; }
    const del = e.target.closest('[data-delentry]');
    if (del) {
      const en = S.entries[del.dataset.delentry]; const mn = minEntryDate(CLUB.id);
      if (en && mn && en.date < mn) { toast('Cette saisie est dans une période close : demandez à votre manager.'); return; }
      if (await confirmDlg('Supprimer cette saisie ?', { ok: 'Supprimer', danger: true })) { db.batch([[['entries', del.dataset.delentry], null], [['audit', newId()], { at: Date.now(), by: ME.id, action: 'delete', club: CLUB.id, entry: en || null }]]); ACTIONS.openSaisies(); }
      return;
    }
    const cb = e.target.closest('[data-task]');
    if (cb) { const p = ['tasks', 'done', today(), ME.id, cb.dataset.task]; const pl = deepGet(S, ['tasks', 'plan', CLUB.id, cb.dataset.task]) || {}; db.set(p, deepGet(S, p) ? null : { at: Date.now(), taskId: pl.taskId || null, hour: pl.hour || null }); draw(m); }
  });
  m.addEventListener('submit', e => {
    e.preventDefault();
    const f = formData(e.target);
    const date = f.date || today(); const mn = minEntryDate(CLUB.id);
    if (!isManager() && f.userId !== ME.id) { toast('Vous ne saisissez que pour vous-même.'); return; }
    if (date > today()) { toast('Pas de saisie dans le futur.'); return; }
    if (mn && date < mn) { toast(`Saisie possible à partir du ${dm(mn)} : période close.`); return; }
    let reason = null;
    if (isManager() && date < lockStart(CLUB.id)) { reason = prompt('Mois clos : motif de la correction (obligatoire)'); if (!reason || !reason.trim()) { toast('Motif obligatoire pour un mois clos.'); return; } reason = reason.trim().slice(0, 200); }
    const ops = [];
    for (const k of kpiList()) {
      const v = parseMontant(f['k_' + k.id]);
      if (Number.isNaN(v) || !v || v < 0) continue;
      const id = newId();
      ops.push([['entries', id], { id, userId: f.userId, clubId: CLUB.id, kpiId: k.id, date, value: k.unit === 'qty' ? Math.round(v) : Math.round(v * 100) / 100, source: 'manual', at: date === today() ? Date.now() : dateOf(date).getTime() + 12 * 3600000, by: ME.id, ...(reason ? { reason } : {}) }]);
    }
    if (!ops.length) { toast('Rien à enregistrer.'); return; }
    if (f.userId !== ME.id) ops.push([['audit', newId()], { at: Date.now(), by: ME.id, action: 'proxy', club: CLUB.id, userId: f.userId, count: ops.length }]);
    db.batch(ops);
    toast(plur(ops.filter(o => o[0][0] === 'entries').length, 'saisie enregistrée', 'saisies enregistrées'));
    draw(m);
  });
};
function tasksToday() {
  const plan = Object.values(S.tasks.plan[CLUB.id] || {}).sort((a, b) => a.hour - b.hour);
  if (!plan.length) return `<div class="empty"><div class="title">Aucune tâche configurée</div><p>${isManager() ? 'Construisez le planning dans Membres > Tâches.' : 'Votre manager n’a pas encore construit le planning du club.'}</p></div>`;
  const done = deepGet(S.tasks.done, [today(), ME.id]) || {};
  return `<p class="muted small">Cochez au fil de la journée. ${Object.keys(done).length}/${plan.length} faites.</p>` + plan.map(p => {
    const t = S.tasks.library[p.taskId]; if (!t) return '';
    return `<label class="row" style="padding:8px 0;border-bottom:1px solid var(--line);cursor:pointer"><input type="checkbox" data-task="${p.id}" ${done[p.id] ? 'checked' : ''}><b class="title" style="width:46px;color:var(--muted)">${pad(p.hour)}:00</b><span class="${done[p.id] ? 'muted' : ''}" style="${done[p.id] ? 'text-decoration:line-through' : ''}">${esc(t.label)}</span></label>`;
  }).join('');
}

// ── Classement ────────────────────────────────────────────────────────────
PAGES.leaderboard = {
  title: 'Classement',
  render() {
    const period = UI.lbPeriod || 'month';
    const scope = UI.lbScope || 'members';
    const anchor = UI.lbAnchor || today();
    const r = rangeOf(period, anchor);
    const kpi = UI.lbKpi && S.kpis[UI.lbKpi] ? UI.lbKpi : '';
    const multi = Object.keys(S.clubs).length > 1;
    const nav = `<div class="row" style="gap:4px"><button class="btn icon sm" data-act="lbShift" data-n="-1">${ico('chevL')}</button><b style="min-width:190px;text-align:center">${r.label}</b><button class="btn icon sm" data-act="lbShift" data-n="1">${ico('chevR')}</button></div>`;
    let main;
    if (scope === 'clubs') {
      const cr = clubRanking(r);
      main = `<div class="card"><p class="muted small" style="margin-top:0">Nos clubs uniquement. Score d’un club = moyenne des scores de ses membres actifs sur les KPI obligatoires : un grand club n’est pas avantagé.</p>
        ${cr.map(x => `<div class="rank-row ${x.c.id === CLUB.id ? 'me-row' : ''}"><div class="rank-n">${x.rank}</div><div class="row">${ico('building')}<div><b>${esc(x.c.name)}</b><div class="muted small">${x.members} membre(s)</div></div></div><div>${progressBar(x.score)}</div><b class="num">${fmtP(x.score)}</b></div>`).join('')}</div>`;
    } else {
      const rk = ranking(CLUB.id, r, kpi || null);
      const meRow = rk.find(x => x.u.id === ME.id);
      const top = rk.slice(0, 3);
      const k = kpi ? S.kpis[kpi] : null;
      const val = x => k ? `${fmtV(x.real, k.unit)} · ${fmtP(x.score)}` : `${fmtP(x.score)} · ${fmtN(x.earned)} pts`;
      main = `<div class="card">
        <div class="tabs" style="margin-top:-4px">${[['', 'Global'], ...kpiList().filter(x => x.points > 0).map(x => [x.id, x.label])].map(([v, l]) => `<button data-act="ui" data-key="lbKpi" data-val="${v}" class="${kpi === v ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>
        ${rk.length ? `<div class="podium">${[top[1], top[0], top[2]].map((x, i) => x ? `<div class="step p${[2, 1, 3][i]}">${avatar(x.u, 'lg')}<div style="margin-top:6px"><b>${esc(fullName(x.u))}</b></div><div class="muted small">${val(x)}</div><div class="block">${[2, 1, 3][i]}</div></div>` : '<div></div>').join('')}</div>
        ${meRow ? `<div class="banner-me">Vous êtes #${meRow.rank} ${period === 'week' ? 'cette semaine' : period === 'quarter' ? 'ce trimestre' : 'ce mois-ci'} — ${val(meRow)}</div>` : ''}
        ${rk.slice(3).map(x => `<div class="rank-row ${x.u.id === ME.id ? 'me-row' : ''}"><div class="rank-n">${x.rank}</div><div class="row">${avatar(x.u)}<div><b>${esc(fullName(x.u))}</b><div class="small">${trophies(x.u.id).slice(-4).map(t => `<span title="${esc(t.label)}">${trophyIcon(t, 'ico ico-xs')}</span>`).join('')}</div></div></div><div>${progressBar(x.score)}</div><b class="num pts"><i class="hdot ${healthOf(x.score != null && x.st.expected ? (k ? x.score : x.score) / Math.max(x.st.expected, 0.01) : null).cls}"></i> ${val(x)}</b></div>`).join('')}` : '<div class="empty">Aucun membre actif.</div>'}
        <p class="muted small" style="margin-bottom:0">Égalités départagées par les points, puis par ordre alphabétique. ${kpi ? '' : 'Classement global calculé sur les KPI obligatoires 👑.'}</p></div>`;
    }
    const atMode = UI.atMode || 'score';
    const all = clubMembers(CLUB.id, { all: true }).filter(u => u.status !== 'pending').map(u => ({ u, pts: allTime(u.id), tr: trophies(u.id).length }));
    all.sort((a, b) => atMode === 'score' ? b.pts - a.pts : b.tr - a.tr);
    const side = `<div class="card"><div class="card-head"><h3>Performance all-time</h3><span class="spacer"></span>${seg('atMode', [['score', 'Score'], ['badges', 'Badges']], atMode)}</div>
      ${all.map((x, i) => `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)"><b class="title" style="width:22px;color:var(--muted)">${i + 1}</b>${avatar(x.u, 'xs')}<span class="spacer">${esc(fullName(x.u))}${x.u.status === 'archived' ? ' <span class="badge">archivé</span>' : ''}</span><b>${atMode === 'score' ? fmtN(x.pts) + ' pts' : x.tr + ' 🏅'}</b></div>`).join('')}
      <p class="muted small">Points cumulés de tous les mois (paliers atteints) + 200 pts par défi flash gagné.</p></div>`;
    return `<div class="page-head"><div><h1>Classement</h1><p>${esc(scope === 'clubs' ? 'Nos clubs' : CLUB.name)} · ${r.label}</p></div></div>
      <div class="row wrap" style="margin-bottom:14px">${seg('lbPeriod', [['week', 'Hebdomadaire'], ['month', 'Mensuel'], ['quarter', 'Trimestriel']], period)}${multi ? seg('lbScope', [['members', 'Membres'], ['clubs', 'Nos clubs']], scope) : ''}<span class="spacer"></span>${nav}</div>
      <div class="lb-layout">${main}${side}</div>`;
  },
};
ACTIONS.lbShift = el => { const r = rangeOf(UI.lbPeriod || 'month', UI.lbAnchor || today()); const n = shiftRange(r, Number(el.dataset.n)); UI.lbAnchor = n.from; render(); };

// ── Feed : uniquement nos clubs ───────────────────────────────────────────
PAGES.feed = {
  title: 'Feed',
  render() {
    const multi = myClubs().length > 1;
    const scope = multi ? (UI.feedScope || 'club') : 'club';
    const clubs = scope === 'club' ? [CLUB.id] : (ME.clubs || []);
    const list = Object.values(S.entries).filter(e => e.source === 'manual' && clubs.includes(e.clubId)).sort((a, b) => b.at - a.at).slice(0, 120);
    setTimeout(() => { if (unseenFeed()) setPref('feedSeen', Date.now()); }, 600);
    let lastDay = '';
    const items = list.map(e => {
      const u = S.users[e.userId], k = S.kpis[e.kpiId], c = S.clubs[e.clubId];
      const day = isoOf(new Date(e.at));
      const sep = day !== lastDay ? `<div class="day-sep">${day === today() ? 'Aujourd’hui' : day === addDays(today(), -1) ? 'Hier' : dayLabel(day)}</div>` : '';
      lastDay = day;
      const rx = S.reactions[e.id] || {};
      return sep + `<div class="card act"><div class="stripe"></div><div>
        <div class="row"><span class="muted small">${k ? kpiIcon(k, 'ico ico-xs') + ' ' + esc(k.label) : ''}</span><span class="spacer"></span><span class="muted small">${ago(e.at)}</span></div>
        <div class="amount">+${fmtV(e.value, k ? k.unit : 'qty')}</div>
        <div class="row small" style="margin-top:4px">${avatar(u, 'xs')}<b>${esc(fullName(u))}</b>${c ? `<span class="muted">· ${ico('map')} ${esc(c.name)}</span>` : ''}</div>
        <div class="reacts">${['🔥', '💪', '👏'].map(em => { const who = rx[em] ? Object.keys(rx[em]) : []; return `<button data-act="react" data-id="${e.id}" data-em="${em}" class="${who.includes(ME.id) ? 'on' : ''}" title="${esc(who.map(id => fullName(S.users[id])).join(', '))}">${em} ${who.length || ''}</button>`; }).join('')}</div>
      </div></div>`;
    }).join('');
    return `<div class="page-head"><div><h1>Feed</h1><p>Les saisies de l’équipe, en direct. Visible uniquement par les membres de nos clubs.</p></div></div>
      ${multi ? `<div style="margin-bottom:12px">${seg('feedScope', [['club', esc(CLUB.name)], ['all', 'Tous nos clubs']], scope)}</div>` : ''}
      <div class="feed">${items || '<div class="card empty"><div class="title">Pas encore d’activité</div><p>Les saisies de votre équipe apparaîtront ici en direct.</p></div>'}</div>`;
  },
};
ACTIONS.react = el => { const p = ['reactions', el.dataset.id, el.dataset.em, ME.id]; db.set(p, deepGet(S, p) ? null : true); };

// ── Chat : un canal par club + un canal commun a nos clubs ────────────────
PAGES.chat = {
  title: 'Chat',
  render() {
    const chans = [...myClubs().map(c => [c.id, c.name]), ...(Object.keys(S.clubs).length > 1 ? [['all', 'Tous nos clubs']] : [])];
    const ch = chans.find(c => c[0] === UI.chatCh) ? UI.chatCh : CLUB.id;
    const msgs = Object.values(S.chat).filter(m => m.channel === ch).sort((a, b) => a.at - b.at);
    const roots = msgs.filter(m => !m.parentId);
    const replies = id => msgs.filter(m => m.parentId === id);
    let lastDay = '';
    const bubble = m => {
      const u = S.users[m.userId]; const rx = m.reactions || {};
      return `<div class="msg ${m.userId === ME.id ? 'mine' : ''}">${avatar(u)}<div>
        <div class="meta"><b>${esc(fullName(u))}</b>${u && u.role === 'manager' ? ' <span class="badge fp">MANAGER</span>' : ''} · ${timeOf(m.at)}</div>
        ${m.text ? `<div class="bubble">${esc(m.text)}</div>` : ''}${safeImg(m.image) ? `<img class="att" src="${m.image}" alt="Image jointe">` : ''}
        <div class="tools">${Object.entries(rx).filter(([, w]) => Object.keys(w).length).map(([em, w]) => `<a data-act="chatReact" data-id="${m.id}" data-em="${em}" title="${esc(Object.keys(w).map(id => fullName(S.users[id])).join(', '))}">${em} ${Object.keys(w).length}</a>`).join('')}
          <a data-act="chatReact" data-id="${m.id}" data-em="👍">👍</a><a data-act="chatReact" data-id="${m.id}" data-em="🔥">🔥</a>
          ${!m.parentId ? `<a data-act="chatReply" data-id="${m.id}">Répondre</a>` : ''}
          ${m.userId === ME.id || isManager() ? `<a data-act="chatDel" data-id="${m.id}">Supprimer</a>` : ''}</div>
        ${!m.parentId && replies(m.id).length ? `<div class="replies">${replies(m.id).map(bubble).join('')}</div>` : ''}
      </div></div>`;
    };
    const list = roots.map(m => { const d = isoOf(new Date(m.at)); const sep = d !== lastDay ? `<div class="day-sep">${d === today() ? 'Aujourd’hui' : dayLabel(d)}</div>` : ''; lastDay = d; return sep + bubble(m); }).join('');
    setTimeout(() => { if (unseenChat()) setPref('chatSeen', Date.now()); const l = $('#chat-list'); if (l) l.scrollTop = l.scrollHeight; }, 50);
    const rep = UI.chatReply && S.chat[UI.chatReply];
    return `<div class="card chat-wrap"><div class="chat-head"><h3>Canal</h3>${seg('chatCh', chans.map(([id, n]) => [id, esc(n)]), ch)}<span class="spacer"></span><span class="muted small">${ch === 'all' ? 'Toutes les équipes de nos clubs' : 'L’équipe du club uniquement'}</span></div>
      <div class="chat-list" id="chat-list">${list || '<div class="empty"><div class="title">Aucun message</div><p>Lancez la discussion avec votre équipe.</p></div>'}</div>
      <form class="chat-input" id="chat-form">
        <div class="spacer">${rep ? `<div class="small muted" style="margin-bottom:4px">Réponse à ${esc(fullName(S.users[rep.userId]))} <a href="javascript:void 0" data-act="chatReply" data-id="">annuler</a></div>` : ''}<textarea class="input" name="text" placeholder="Écrire un message…" rows="1" data-focus="chat"></textarea></div>
        <label class="btn icon" title="Joindre une image">${ico('clip')}<input type="file" accept="image/*" hidden id="chat-file"></label>
        <button class="btn primary icon" type="submit" title="Envoyer">${ico('send')}</button>
      </form></div>`;
  },
  mount() {
    const f = $('#chat-form'); if (!f) return;
    const ta = $('textarea', f);
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } });
    f.addEventListener('submit', e => { e.preventDefault(); const text = ta.value.trim(); if (!text) return; sendChat({ text }); });
    $('#chat-file').addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      shrinkImage(file, 900).then(data => sendChat({ image: data, text: ta.value.trim() }));
    });
  },
};
function sendChat(o) {
  const chans = [...(ME.clubs || []), 'all'];
  const ch = chans.includes(UI.chatCh) ? UI.chatCh : CLUB.id;
  const id = newId();
  db.set(['chat', id], { id, channel: ch, userId: ME.id, at: Date.now(), ...o, ...(UI.chatReply ? { parentId: UI.chatReply } : {}) });
  UI.chatReply = null;
}
function shrinkImage(file, max) {
  return new Promise(ok => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.78)); };
    img.src = url;
  });
}
ACTIONS.chatReact = el => { const p = ['chat', el.dataset.id, 'reactions', el.dataset.em, ME.id]; db.set(p, deepGet(S, p) ? null : true); };
ACTIONS.chatReply = el => { UI.chatReply = el.dataset.id || null; render(); setTimeout(() => { const t = $('#chat-form textarea'); if (t) t.focus(); }, 60); };
ACTIONS.chatDel = async el => { if (await confirmDlg('Supprimer ce message ?', { ok: 'Supprimer', danger: true })) db.batch([[['chat', el.dataset.id], null], ...Object.values(S.chat).filter(m => m.parentId === el.dataset.id).map(m => [['chat', m.id], null])]); };

// ── Defis flash ───────────────────────────────────────────────────────────
PAGES.challenges = {
  title: 'Défis flash',
  render() {
    const list = Object.values(S.challenges).filter(c => c.clubId === CLUB.id).sort((a, b) => b.start - a.start);
    const live = list.filter(c => c.end > Date.now());
    const past = list.filter(c => c.end <= Date.now());
    const card = (ch, isLive) => {
      const k = S.kpis[ch.kpiId]; const rk = challengeRanking(ch);
      const left = Math.max(0, ch.end - Date.now()); const h = Math.floor(left / 3600000), m = Math.floor(left % 3600000 / 60000);
      return `<div class="card"><div class="card-head">${ico('bolt')}<div><h3>${esc(ch.title)}</h3><div class="muted small">${k ? esc(k.label) : ''} · ${Math.round((ch.end - ch.start) / 3600000)} h · lancé par ${esc(fullName(S.users[ch.by]))}</div></div><span class="spacer"></span>${isLive ? `<span class="badge fp">${h} h ${pad(m)} restantes</span>` : `<span class="badge">Terminé le ${dmy(isoOf(new Date(ch.end)))}</span>`}</div>
        ${ch.desc ? `<p class="muted" style="margin-top:0">${esc(ch.desc)}</p>` : ''}
        ${rk.slice(0, isLive ? 10 : 3).map((x, i) => `<div class="row" style="padding:7px 0;border-bottom:1px solid var(--line)"><b class="title" style="width:24px">${i + 1}</b>${avatar(x.u, 'xs')}<span class="spacer">${esc(fullName(x.u))}</span><span class="muted small">${fmtV(x.value, k ? k.unit : 'qty')}</span><b style="width:70px;text-align:right">${fmtP(x.norm)}</b></div>`).join('')}
        ${isLive && isManager() ? `<div class="row" style="margin-top:10px"><span class="spacer"></span><button class="btn sm danger" data-act="endChallenge" data-id="${ch.id}">Arrêter le défi</button></div>` : ''}</div>`;
    };
    return `<div class="page-head"><div><h1>⚡ Défis flash</h1><p>Un mini-défi de 6 à 72 h sur un KPI. Classement rapporté à l’objectif mensuel de chacun : équitable entre profils.</p></div><span class="spacer"></span>${isManager() ? `<button class="btn primary" data-act="newChallenge">${ico('plus')} Lancer un défi</button>` : ''}</div>
      ${live.length ? `<h2 style="margin-bottom:10px">En cours</h2><div class="grid" style="margin-bottom:20px">${live.map(c => card(c, true)).join('')}</div>` : ''}
      <h2 style="margin-bottom:10px">Historique des défis</h2>
      ${past.length ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(320px, 100%), 1fr))">${past.map(c => card(c, false)).join('')}</div>` : '<div class="card empty">Aucun défi flash terminé pour le moment.</div>'}`;
  },
};
ACTIONS.newChallenge = () => {
  openModal({ title: 'Lancer un défi flash', body: `<p class="muted" style="margin-top:0">Choisissez un KPI et une durée. Le défi démarre dès la confirmation, pour l’équipe de ${esc(CLUB.name)}.</p>
    <form id="chf" class="grid"><label class="field"><span>Titre</span><input class="input" name="title" required placeholder="Sprint final du mois"></label>
    <label class="field"><span>Description (facultatif)</span><textarea class="input" name="desc"></textarea></label>
    <div class="form-grid"><label class="field"><span>KPI ciblé</span><select class="input" name="kpi">${kpiList().map(k => `<option value="${k.id}">${esc(k.label)}</option>`).join('')}</select></label>
    <label class="field"><span>Durée</span><select class="input" name="dur">${[6, 12, 24, 48, 72].map(h => `<option value="${h}" ${h === 24 ? 'selected' : ''}>${h} h</option>`).join('')}</select></label></div></form>`,
    foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="createChallenge">Lancer le défi</button>' });
};
ACTIONS.createChallenge = async () => {
  const f = formData($('#chf'));
  if (!f.title.trim()) { toast('Donnez un titre au défi.'); return; }
  if (!await confirmDlg(`Lancer « ${esc(f.title)} » pour ${f.dur} h ? Toute l’équipe le verra immédiatement.`, { ok: 'Lancer' })) return;
  const id = newId(); const now = Date.now();
  db.set(['challenges', id], { id, clubId: CLUB.id, title: f.title.trim(), desc: f.desc.trim(), kpiId: f.kpi, start: now, end: now + Number(f.dur) * 3600000, by: ME.id });
  closeModal(); toast('Défi lancé ⚡');
};
ACTIONS.endChallenge = async el => { if (await confirmDlg('Arrêter ce défi maintenant ? Le classement actuel devient définitif.', { ok: 'Arrêter', danger: true })) db.set(['challenges', el.dataset.id, 'end'], Date.now()); };
