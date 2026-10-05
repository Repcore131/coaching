'use strict';
// ══ FIT PULSE — interface commune : session, routes, coque, modales ══════

let ME = null;            // utilisateur connecte
let CLUB = null;          // club affiche
const UI = {};            // etat d'ecran (onglets, filtres) conserve entre deux rendus
const PAGES = {};         // route -> { title, render(), mount?(), manager? }
const ACTIONS = {};       // data-act -> fonction(el, event)

const isCreator = () => ME && ME.role === 'createur';
const isManager = () => ME && (ME.role === 'manager' || ME.role === 'createur');
const myClubs = () => (ME ? (ME.role === 'createur' ? Object.keys(S.clubs) : (ME.clubs || [])) : []).map(id => S.clubs[id]).filter(Boolean);
const pref = (k, d) => { const p = (S.prefs[ME.id] || {})[k]; return p === undefined ? d : p; };
const setPref = (k, v) => db.set(['prefs', ME.id, k], v);

// ── Toasts, modales, confirmations ────────────────────────────────────────
function toast(msg, ms = 3200) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), ms);
}
let modalClose = null;
function openModal({ title, body, foot = '', wide = false, drawer = false, onMount = null, onClose = null }) {
  closeModal();
  const root = $('#modal-root');
  root.innerHTML = `<div class="overlay${drawer ? ' drawer' : ''}" data-overlay><div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true">
    <div class="modal-head"><h2>${esc(title)}</h2><span class="spacer"></span><button class="btn ghost icon" data-close aria-label="Fermer">${ico('x')}</button></div>
    <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div></div>`;
  const ov = $('[data-overlay]', root);
  ov.addEventListener('mousedown', e => { if (e.target === ov) closeModal(); });
  $$('[data-close]', ov).forEach(b => b.addEventListener('click', closeModal));
  modalClose = onClose;
  if (onMount) onMount($('.modal', ov));
  const f = $('input:not([type=hidden]),select,textarea', $('.modal-body', ov)); if (f && !drawer) setTimeout(() => f.focus(), 30);
  return $('.modal', ov);
}
function closeModal() { const r = $('#modal-root'); if (r && r.innerHTML) { r.innerHTML = ''; const f = modalClose; modalClose = null; if (f) f(); } }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
function confirmDlg(text, { ok = 'Confirmer', danger = false } = {}) {
  return new Promise(res => {
    let done = false;
    openModal({ title: 'Confirmation', body: `<p style="margin:0">${text}</p>`,
      foot: `<button class="btn" data-close>Annuler</button><button class="btn ${danger ? 'dark' : 'primary'}" data-ok>${esc(ok)}</button>`,
      onMount: m => $('[data-ok]', m).addEventListener('click', () => { done = true; closeModal(); res(true); }),
      onClose: () => { if (!done) res(false); } });
  });
}
const formData = root => { const o = {}; $$('[name]', root).forEach(el => { o[el.name] = el.type === 'checkbox' ? el.checked : el.value; }); return o; };

// ── Avatars ───────────────────────────────────────────────────────────────
// Mascotte du tableau de bord : 4 silhouettes, l'humeur suit le rythme.
function mascot(kind = 'h1', mood = 'ok', size = 120) {
  const skin = { h1: '#F2C9A0', h2: '#8D5A3B', f1: '#F5D0B5', f2: '#C68B5E' }[kind] || '#F2C9A0';
  const hair = { h1: '#2B1E16', h2: '#111', f1: '#B5651D', f2: '#1d1d1d' }[kind] || '#222';
  const fem = kind[0] === 'f';
  const mouth = mood === 'happy' ? 'M44 66 Q60 80 76 66' : mood === 'tired' ? 'M46 72 Q60 64 74 72' : 'M46 70 L74 70';
  const eyes = mood === 'tired' ? '<path d="M40 52 h12 M68 52 h12" stroke="#111" stroke-width="3" stroke-linecap="round"/>' : '<circle cx="46" cy="52" r="4.5" fill="#111"/><circle cx="74" cy="52" r="4.5" fill="#111"/>';
  const sweat = mood === 'tired' ? '<path d="M90 36 q5 9 0 12 q-5-3 0-12z" fill="#7cc4ff"/>' : '';
  const spark = mood === 'happy' ? '<path d="M100 18 l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#FFD200"/>' : '';
  return `<svg viewBox="0 0 120 150" width="${size}" height="${size * 1.25}" aria-hidden="true">
    <rect x="22" y="104" width="76" height="46" rx="22" fill="#FFD200"/><text x="60" y="136" text-anchor="middle" font-family="Anton,Impact" font-size="17" fill="#0B0B0C">FP</text>
    ${fem ? `<path d="M22 60 q-6 40 14 46 h48 q20-6 14-46z" fill="${hair}"/>` : ''}
    <circle cx="60" cy="58" r="36" fill="${skin}"/>
    <path d="M24 52 q4-34 36-34 q32 0 36 34 q-14-16-36-14 q-22-2-36 14z" fill="${hair}"/>
    ${eyes}<path d="${mouth}" stroke="#111" stroke-width="3.5" fill="none" stroke-linecap="round"/>${sweat}${spark}</svg>`;
}
function avatar(u, cls = '') { return `<span class="avatar ${cls}" title="${esc(fullName(u))}">${esc(initials(u))}</span>`; }

// ── Graphiques SVG ────────────────────────────────────────────────────────
function barChart({ labels, series, height = 220, fmt = fmtN }) {
  // series : [{ name, color, values[] }]
  const W = 640, H = height, L = 46, B = 26, T = 10;
  const max = Math.max(1, ...series.flatMap(s => s.values.map(v => v || 0))) * 1.1;
  const gw = (W - L - 8) / labels.length; const bw = Math.min(18, (gw - 6) / series.length);
  let g = '';
  for (let i = 0; i <= 4; i++) { const y = T + (H - T - B) * (1 - i / 4); g += `<line x1="${L}" x2="${W}" y1="${y}" y2="${y}" stroke="currentColor" opacity=".08"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${fmt(max * i / 4)}</text>`; }
  labels.forEach((lb, i) => {
    const x0 = L + i * gw + (gw - bw * series.length) / 2;
    series.forEach((s, j) => { const v = s.values[i] || 0; const h = (H - T - B) * v / max; g += `<rect x="${x0 + j * bw}" y="${H - B - h}" width="${bw - 2}" height="${Math.max(0, h)}" rx="3" fill="${s.color}"><title>${esc(s.name)} — ${esc(lb)} : ${fmt(v)}</title></rect>`; });
    g += `<text x="${L + i * gw + gw / 2}" y="${H - 8}" text-anchor="middle">${esc(lb)}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" style="color:var(--text)">${g}</svg></div>`;
}
function lineChart({ labels, values, height = 200, fmt = fmtN, color = '#FFD200' }) {
  const W = 640, H = height, L = 50, B = 26, T = 12;
  const max = Math.max(1, ...values) * 1.1; const n = Math.max(1, labels.length - 1);
  const pt = (v, i) => [L + (W - L - 10) * i / n, T + (H - T - B) * (1 - v / max)];
  let g = '';
  for (let i = 0; i <= 4; i++) { const y = T + (H - T - B) * (1 - i / 4); g += `<line x1="${L}" x2="${W}" y1="${y}" y2="${y}" stroke="currentColor" opacity=".08"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${fmt(max * i / 4)}</text>`; }
  const pts = values.map(pt);
  if (pts.length) {
    g += `<path d="M${pts[0][0]},${H - B} ${pts.map(p => 'L' + p.join(',')).join(' ')} L${pts[pts.length - 1][0]},${H - B}Z" fill="${color}" opacity=".15"/>`;
    g += `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5"/>`;
    pts.forEach((p, i) => { g += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${color}"><title>${esc(labels[i])} : ${fmt(values[i])}</title></circle>`; });
  }
  const step = Math.ceil(labels.length / 12);
  labels.forEach((lb, i) => { if (i % step === 0) g += `<text x="${pt(0, i)[0]}" y="${H - 8}" text-anchor="middle">${esc(lb)}</text>`; });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" style="color:var(--text)">${g}</svg></div>`;
}
function progressBar(pct, { pace = null, ticks = true } = {}) {
  const w = clamp((pct || 0) * 100, 0, 100);
  const col = pct >= 1 ? 'var(--ok)' : 'var(--fp)';
  return `<div class="bar"><i style="width:${w}%;background:${col}"></i>${ticks ? [25, 50, 75].map(t => `<span class="tick" style="left:${t}%"></span>`).join('') : ''}${pace != null ? `<span class="pace" style="left:${clamp(pace * 100, 0, 100)}%" title="Rythme attendu"></span>` : ''}</div>`;
}

// Logo Fit Pulse (image) ; à défaut, la marque en texte
function brandBlock(big = false) {
  const w = (window.PARKPULSE_ASSETS || {}).wordmark;
  if (w) return `<div class="brand with-logo ${big ? 'big' : ''}"><img class="brand-logo" src="${w}" alt="Fit Pulse"><div class="brand-sub">${esc(APP.tagline)}</div></div>`;
  return `<div class="brand"><div class="brand-mark">${ico('bolt')}</div><div><div class="brand-name">FIT <span>PULSE</span></div><div class="brand-sub">${esc(APP.tagline)}</div></div></div>`;
}

// ── Coque ──────────────────────────────────────────────────────────────────
const NAV = [
  ['home', 'Accueil', 'dashboard'],
  ['dashboard', 'Mes objectifs', 'target'],
  ['leaderboard', 'Classement', 'trophy'],
  ['recap', 'Récap du mois', 'chart', true],
  ['sep'],
  ['resiliations', 'Résiliations', 'door'],
  ['impayes', 'Impayés', 'euro'],
  ['loyalty', 'Action Rétention', 'heart'],
  ['challenges', 'Défis flash', 'bolt'],
  ['chat', 'Chat', 'chat'],
  ['feed', 'Feed', 'feed'],
  ['sep'],
  ['imports', 'Imports Resamania', 'upload', true],
  ['members', 'Équipe & paliers', 'users', true],
  ['clubs', 'Mes clubs', 'building', true],
];
function unseenFeed() {
  const seen = pref('feedSeen', 0);
  const clubs = ME.clubs || [];
  return Object.values(S.entries).filter(e => e.source === 'manual' && e.at > seen && e.userId !== ME.id && clubs.includes(e.clubId)).length;
}
function unseenChat() {
  const seen = pref('chatSeen', 0);
  const ch = new Set([...(ME.clubs || []), 'all']);
  return Object.values(S.chat).filter(m => m.at > seen && m.userId !== ME.id && ch.has(m.channel)).length;
}
function shell(route, inner) {
  const nav = NAV.map(([id, label, icon, mgr]) => {
    if (id === 'sep') return '<div class="nav-sep"></div>';
    if (mgr && !isManager()) return '';
    const n = id === 'feed' ? unseenFeed() : id === 'chat' ? unseenChat() : id === 'loyalty' ? loyaltyTasks(CLUB.id).filter(t => t.state === 'todo').length : id === 'resiliations' ? resToHandle(CLUB.id).length : id === 'impayes' ? dunRows(CLUB.id).filter(dunDue).length : 0;
    return `<a href="#/${id}" class="${route === id ? 'on' : ''}">${ico(icon)}<span>${label}</span>${n ? `<span class="pill">${n > 99 ? '99+' : n}</span>` : ''}</a>`;
  }).join('');
  const clubs = myClubs();
  const theme = curTheme();
  return `<div class="shell" id="shell">
    <aside class="side">
      ${brandBlock()}
      ${(window.PARKPULSE_ASSETS || {}).logo ? `<div class="club-logo"><img src="${window.PARKPULSE_ASSETS.logo}" alt="Fitness Park"></div>` : ''}
      <div class="club-pick"><label>Votre club</label>${clubs.length > 1 ? `<select data-change="pickClub">${clubs.map(c => `<option value="${c.id}" ${c.id === CLUB.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : `<div class="club-name">${esc(CLUB.name)}</div>`}</div>
      <nav class="nav">${nav}</nav>
      <div class="side-foot nav">
        <a href="#/profile" class="${route === 'profile' ? 'on' : ''}">${ico('user')}<span>Mon profil</span></a>
        <a href="javascript:void 0" data-act="theme">${ico(theme === 'dark' ? 'sun' : 'moon')}<span>Thème ${theme === 'dark' ? 'clair' : 'sombre'}</span></a>
        <a href="javascript:void 0" data-act="logout">${ico('logout')}<span>Se déconnecter</span></a>
        <div class="me" style="margin-top:8px">${avatar(ME, 'xs')}<div class="small"><b>${esc(fullName(ME))}</b><div class="muted">${roleLabel(ME.role)}${backend.mode === 'local' ? ' · mode local' : ''}</div></div></div>
      </div>
    </aside>
    <main class="main">
      <div class="topbar"><button class="btn ghost icon burger" data-act="burger" aria-label="Menu">${ico('menu')}</button>${(window.PARKPULSE_ASSETS || {}).icon ? `<img class="top-icon" src="${window.PARKPULSE_ASSETS.icon}" alt="">` : ''}
        <b class="title" style="font-size:17px">${esc(PAGES[route] ? PAGES[route].title : '')}</b>
        <div class="countdown" id="countdown"></div><button class="btn primary top-cta" data-act="tbSaisir">${ico('plus')} Saisir</button></div>
      <div class="page page-${route}">${inner}</div>
    </main>
    ${tabBar(route)}
  </div>`;
}
function tickCountdown() {
  const el = $('#countdown'); if (!el) return;
  const n = new Date(); const end = new Date(n.getFullYear(), n.getMonth() + 1, 1);
  let s = Math.max(0, Math.floor((end - n) / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400; const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60); s -= m * 60;
  el.innerHTML = `${ico('cal')}<b>${d}j ${pad(h)}:${pad(m)}:${pad(s)}</b><span>restants en ${MOIS[n.getMonth()]}</span>`;
}
setInterval(tickCountdown, 1000);

// ── Routeur ────────────────────────────────────────────────────────────────
function currentRoute() { const h = location.hash.replace(/^#\/?/, ''); const [r, ...rest] = h.split('/'); return { r: r || 'home', args: rest }; }
let renderQueued = false;
function render() {
  if (renderQueued) return; renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; renderNow(); });
}
function renderNow() {
  const app = $('#app');
  if (backend.mode === 'firebase' && !backend.user) { app.innerHTML = PAGES.login.render(); if (PAGES.login.mount) PAGES.login.mount(); return; }
  if (!S) { app.innerHTML = PAGES.onboarding.render(); return; }
  if (!ME) { app.innerHTML = PAGES.login.render(); if (PAGES.login.mount) PAGES.login.mount(); return; }
  ME = S.users[ME.id] || null;
  if (!ME || ME.status === 'archived') { logout(); return; }
  if (!CLUB || !S.clubs[CLUB.id] || !myClubs().some(c => c.id === CLUB.id)) CLUB = myClubs()[0] || null;
  else CLUB = S.clubs[CLUB.id];
  if (!CLUB) { app.innerHTML = `<div class="auth"><div class="auth-card"><h2>Aucun club</h2><p class="muted">Votre compte n'est rattaché à aucun club. Demandez à un manager de vous ajouter.</p><button class="btn primary" data-act="logout">Se déconnecter</button></div></div>`; return; }
  let { r, args } = currentRoute();
  if (r === 'wrap') { app.innerHTML = PAGES.wrap.render(args); PAGES.wrap.mount(args); return; }
  if (!PAGES[r] || PAGES[r].auth === false) r = 'home';
  if (PAGES[r].manager && !isManager()) r = 'home';
  const keepScroll = UI._lastRoute === r ? window.scrollY : 0;
  const active = document.activeElement; const focusKey = active && active.dataset ? active.dataset.focus : null;
  app.innerHTML = shell(r, PAGES[r].render(args));
  UI._lastRoute = r;
  if (PAGES[r].mount) PAGES[r].mount(args);
  tickCountdown();
  window.scrollTo(0, keepScroll);
  if (focusKey) { const el = $(`[data-focus="${focusKey}"]`); if (el) { el.focus(); if (el.setSelectionRange && el.value) el.setSelectionRange(el.value.length, el.value.length); } }
}
window.addEventListener('hashchange', () => { UI._lastRoute = null; render(); });

// ── Delegation d'evenements ────────────────────────────────────────────────
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const f = ACTIONS[el.dataset.act];
  if (f) { e.preventDefault(); f(el, e); }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el && ACTIONS[el.dataset.change]) ACTIONS[el.dataset.change](el, e);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-input]');
  if (el && ACTIONS[el.dataset.input]) ACTIONS[el.dataset.input](el, e);
});
// onglets / segments generiques : data-ui="cle" data-val="valeur"
ACTIONS.ui = el => { UI[el.dataset.key] = el.dataset.val; render(); };
ACTIONS.burger = () => $('#shell').classList.toggle('nav-open');
const curTheme = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
ACTIONS.theme = () => { const t = curTheme() === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; safeLS.set('parkpulse.theme', t); render(); };
ACTIONS.logout = () => logout();
ACTIONS.pickClub = el => { CLUB = S.clubs[el.value]; safeLS.set('parkpulse.club', CLUB.id); UI.dashUser = null; render(); };
ACTIONS.go = el => { location.hash = el.dataset.href; };
document.addEventListener('click', e => { const sh = $('#shell'); if (sh && sh.classList.contains('nav-open') && e.target.closest('.nav a')) sh.classList.remove('nav-open'); });
document.addEventListener('click', e => { const sh = $('#shell'); if (sh && sh.classList.contains('nav-open') && !e.target.closest('.side') && !e.target.closest('[data-act=burger]')) sh.classList.remove('nav-open'); }, true);

function seg(key, options, cur) {
  return `<div class="seg">${options.map(([v, l]) => `<button data-act="ui" data-key="${key}" data-val="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}
function tabs(key, options, cur) {
  return `<div class="tabs">${options.map(([v, l]) => `<button data-act="ui" data-key="${key}" data-val="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}
function monthNav(key, mk) {
  return `<div class="row" style="gap:4px"><button class="btn icon sm" data-act="ui" data-key="${key}" data-val="${addMonths(mk, -1)}" aria-label="Mois précédent">${ico('chevL')}</button>
    <b style="min-width:130px;text-align:center">${monthLabel(mk)}</b>
    <button class="btn icon sm" data-act="ui" data-key="${key}" data-val="${addMonths(mk, 1)}" aria-label="Mois suivant">${ico('chevR')}</button></div>`;
}
function login(user) { ME = user; safeLS.set(SESSION_KEY, user.id); UI._lastRoute = null; if (!location.hash) location.hash = '#/home'; render(); }
async function logout() { ME = null; safeLS.del(SESSION_KEY); if (backend.mode === 'firebase') { await backend.signOut(); S = null; } render(); }

// Telechargement d'un fichier genere
function downloadFile(name, content, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
