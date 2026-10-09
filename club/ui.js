/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
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
let modalOpener = null;
function openModal({ title, body, foot = '', wide = false, drawer = false, onMount = null, onClose = null }) {
  const opener = $('#modal-root') && $('#modal-root').innerHTML ? modalOpener : document.activeElement;
  closeModal(); modalOpener = opener;
  const root = $('#modal-root');
  root.innerHTML = `<div class="overlay${drawer ? ' drawer' : ''}" data-overlay><div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h2>${esc(title)}</h2><span class="spacer"></span><button class="btn ghost icon" data-close aria-label="Fermer">${ico('x')}</button></div>
    <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div></div>`;
  const ov = $('[data-overlay]', root);
  ov.addEventListener('mousedown', e => { if (e.target === ov) closeModal(); });
  $$('[data-close]', ov).forEach(b => b.addEventListener('click', closeModal));
  modalClose = onClose;
  if (onMount) onMount($('.modal', ov));
  const f = $('input:not([type=hidden]),select,textarea', $('.modal-body', ov)); if (f && !drawer) setTimeout(() => { const m = $('.modal', ov); if (m && !m.contains(document.activeElement)) f.focus(); }, 30);
  return $('.modal', ov);
}
function closeModal() { const r = $('#modal-root'); if (r && r.innerHTML) { r.innerHTML = ''; const f = modalClose; modalClose = null; if (f) f(); const o = modalOpener; modalOpener = null; if (o && o.isConnected && o.focus) try { o.focus({ preventScroll: true }); } catch (_) { /* rien */ } } }
// Piège de focus : Tab reste dans la fenêtre ouverte.
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return; const m = $('#modal-root .modal'); if (!m) return;
  const L = $$('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', m).filter(x => x.offsetParent !== null);
  if (!L.length) return; const first = L[0], last = L[L.length - 1];
  if (!m.contains(document.activeElement)) { e.preventDefault(); first.focus(); } else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
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
const formData = root => { const o = {}; $$('[name]', root).forEach(el => { if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; else if (!(el.name in o)) o[el.name] = ''; return; } o[el.name] = el.type === 'checkbox' ? el.checked : el.value; }); return o; };

// ── Avatars ───────────────────────────────────────────────────────────────
// Photo ou couleur choisies dans Mon espace (préférences de la personne).
const PROFIL_COLORS = ['#FFD600', '#F97316', '#EF4444', '#EC4899', '#A855F7', '#3B82F6', '#06B6D4', '#22C55E', '#F5F5F3', '#6B7280'];
const profilOf = u => (u && S && S.prefs && S.prefs[u.id] && S.prefs[u.id].profil) || {};
function avatar(u, cls = '') {
  const p = profilOf(u); const name = esc(fullName(u));
  if (p.photo && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.photo)) return `<span class="avatar ${cls}" title="${name}"><img src="${p.photo}" alt=""></span>`;
  const col = PROFIL_COLORS.includes(p.color) ? p.color : null;
  return `<span class="avatar ${cls}" title="${name}"${col ? ` style="background:${col};color:${['#FFD600', '#F5F5F3', '#06B6D4', '#22C55E', '#F97316'].includes(col) ? '#0B0B0C' : '#fff'}"` : ''}>${esc(initials(u))}</span>`;
}

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
    series.forEach((s, j) => { const v = s.values[i] || 0; const h = (H - T - B) * v / max; g += `<rect x="${x0 + j * bw}" y="${H - B - h}" width="${bw - 2}" height="${Math.max(0, h)}" rx="3" style="fill:${s.color}"><title>${esc(s.name)}, ${esc(lb)} : ${fmt(v)}</title></rect>`; });
    g += `<text x="${L + i * gw + gw / 2}" y="${H - 8}" text-anchor="middle">${esc(lb)}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" style="color:var(--text)">${g}</svg></div>`;
}
function lineChart({ labels, values, height = 200, fmt = fmtN, color = 'var(--d-1)' }) {
  const W = 640, H = height, L = 50, B = 26, T = 12;
  const max = Math.max(1, ...values) * 1.1; const n = Math.max(1, labels.length - 1);
  const pt = (v, i) => [L + (W - L - 10) * i / n, T + (H - T - B) * (1 - v / max)];
  let g = '';
  for (let i = 0; i <= 4; i++) { const y = T + (H - T - B) * (1 - i / 4); g += `<line x1="${L}" x2="${W}" y1="${y}" y2="${y}" stroke="currentColor" opacity=".08"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${fmt(max * i / 4)}</text>`; }
  const pts = values.map(pt);
  if (pts.length) {
    g += `<path d="M${pts[0][0]},${H - B} ${pts.map(p => 'L' + p.join(',')).join(' ')} L${pts[pts.length - 1][0]},${H - B}Z" style="fill:${color}" opacity=".25"/>`;
    g += `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + p.join(',')).join(' ')}" fill="none" class="c-line2" style="stroke:${color}" stroke-width="2.5"/>`;
    pts.forEach((p, i) => { g += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" style="fill:${color}"><title>${esc(labels[i])} : ${fmt(values[i])}</title></circle>`; });
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

// ── Couleurs : --brand (Fit Pulse, fixe) et --club (réglable par club ou par espace) ──
// Le club choisit sa couleur dans Club et réglages ; sans réglage, --club = --brand.
const COULEUR_OK = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
function couleurClub() { const c = (CLUB && S && S.clubs[CLUB.id] && S.clubs[CLUB.id].couleur) || deepGet(S || {}, ['info', 'couleur']); return COULEUR_OK(c) ? c : null; }
// Encre lisible sur une couleur (noir ou blanc selon la luminance).
function encreSur(hex) { const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); const L = 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; return L > 0.22 ? '#0B0B0C' : '#FFFFFF'; }
function appliquerCouleurClub() {
  const r = document.documentElement.style; const c = couleurClub();
  if (c) { r.setProperty('--club', c); r.setProperty('--club-ink', encreSur(c)); } else { r.removeProperty('--club'); r.removeProperty('--club-ink'); }
}
// Logo du club : réglage du club, sinon celui de config.js (aucun par défaut). Fichier du site uniquement.
function clubLogo() { const l = (CLUB && CLUB.logo) || (window.PARKPULSE_ASSETS || {}).logo; return typeof l === 'string' && /^assets\/[\w.-]+\.(svg|png|jpe?g|webp)$/i.test(l) ? l : null; }

// ── Tracé de pouls : amplitude et couleur selon le rythme (statusOf) ──────
const POULS = { ahead: [1, 'var(--ok)'], ontime: [0.8, 'var(--ok)'], done: [1, 'var(--ok)'], late: [0.5, 'var(--warn)'], verylate: [0.25, 'var(--bad)'], wait: [0.12, 'var(--muted)'], none: [0, 'var(--muted)'] };
function pulseLine(rythme, { w = 120, h = 32, label = '' } = {}) {
  const key = typeof rythme === 'string' ? rythme : (rythme && rythme.key) || 'none'; const [amp, col] = POULS[key] || POULS.none;
  const m = h / 2, a = (h / 2 - 3) * amp, x = f => Math.round(w * f * 10) / 10, y = v => Math.round((m + v) * 10) / 10;
  const d = `M0 ${m} H${x(0.3)} L${x(0.36)} ${y(-a * 0.35)} L${x(0.42)} ${y(a * 0.3)} L${x(0.5)} ${y(-a)} L${x(0.57)} ${y(a)} L${x(0.63)} ${m} H${x(0.72)} L${x(0.76)} ${y(-a * 0.25)} L${x(0.8)} ${m} H${w}`;
  const t = label || (rythme && rythme.label) || '';
  return `<svg class="pulse-line pl-${key}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(t)}"${t ? '' : ' aria-hidden="true"'}><path d="${d}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// Logo Fit Pulse (image) ; à défaut, la marque en texte
function brandBlock(big = false) {
  const w = (window.PARKPULSE_ASSETS || {}).wordmark;
  if (w) return `<div class="brand with-logo ${big ? 'big' : ''}"><img class="brand-logo" src="${w}" alt="Fit Pulse"><div class="brand-sub">${esc(APP.tagline)}</div></div>`;
  return `<div class="brand"><div class="brand-mark">${ico('pouls')}</div><div><div class="brand-name">FIT <span>PULSE</span></div><div class="brand-sub">${esc(APP.tagline)}</div></div></div>`;
}

// ── Coque ──────────────────────────────────────────────────────────────────
// 4e champ : true = managers seulement, 'm' = commerciaux seulement (leur menu
// tient en 6 entrees : les pages detaillees sont dans les poles Relances et Equipe).
const NAV = [
  ['home', TXT.nav.home, 'dashboard'],
  ['kpimatin', TXT.nav.kpimatin, 'send'],
  ['dashboard', TXT.nav.dashboard, 'target'],
  ['relances', TXT.nav.relances, 'phone'],
  ['leaderboard', TXT.nav.leaderboard, 'trophy'],
  ['equipe', TXT.nav.equipeMembre, 'users', 'm'],
  ['recap', TXT.nav.recap, 'chart', true],
  ['rapporte', TXT.nav.rapporte, 'euro', true],
  ['team', TXT.nav.team, 'users', true],
  ['equipe', TXT.nav.equipeManager, 'chart', true],
  ['b2b', TXT.nav.b2b, 'briefcase'],
  ['sep'],
  ['resiliations', TXT.nav.resiliations, 'door', true],
  ['impayes', TXT.nav.impayes, 'euro', true],
  ['loyalty', TXT.nav.loyalty, 'heart', true],
  ['pouls', TXT.nav.pouls, 'pouls', true],
  ['sep'],
  ['imports', TXT.nav.imports, 'upload', true],
  ['controle', TXT.nav.controle, 'check', true],
];
// Anciennes pages regroupées : l'adresse reste valable et ouvre le bon onglet.
const ROUTE_ALIAS = { opportunites: ['dashboard', 'dashTab', 'opportunites'], members: ['team', 'teamTab', 'membres'], quality: ['b2b', 'bizTab', 'qualite'], clubs: ['b2b', 'bizTab', 'clubs'], chat: ['equipe', 'eqTab', 'fil'] };
function unseenPouls() {
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
    if (mgr === true && !isManager()) return '';
    if (mgr === 'm' && isManager()) return '';
    const n = id === 'pouls' ? unseenPouls() : id === 'chat' ? unseenChat() : id === 'equipe' ? (isManager() ? 0 : unseenPouls()) : id === 'relances' ? relBadge() : id === 'loyalty' ? loyaltyTasks(CLUB.id).filter(t => t.state === 'todo').length : id === 'resiliations' ? resToHandle(CLUB.id).length + rrqCounts(CLUB.id).open : id === 'impayes' ? dunRows(CLUB.id).filter(dunDue).length : 0;
    const late = id === 'resiliations' ? rrqCounts(CLUB.id).late : 0;
    return `<a href="#/${id}" class="${route === id ? 'on' : ''}">${ico(icon)}<span>${label}</span>${n ? `<span class="pill">${n > 99 ? '99+' : n}</span>` : ''}${late ? `<span class="pill pill-late" title="dont ${late} sans réponse depuis 48 h" aria-label="dont ${late} sans réponse depuis 48 h">${late}</span>` : ''}</a>`;
  }).join('');
  const clubs = myClubs();
  return `<div class="shell" id="shell">
    <aside class="side">
      ${brandBlock()}
      ${clubLogo() ? `<div class="club-logo"><img src="${esc(clubLogo())}" alt="${esc(CLUB.name)}"></div>` : ''}
      <div class="club-pick"><label>Votre club</label>${clubs.length > 1 ? `<select data-change="pickClub">${clubs.map(c => `<option value="${c.id}" ${c.id === CLUB.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : `<div class="club-name">${esc(CLUB.name)}</div>`}</div>
      <nav class="nav">${nav}</nav>
      <div class="side-foot nav">
        <a href="#/profile" class="${route === 'profile' ? 'on' : ''}">${ico('user')}<span>${TXT.nav.profil}</span></a>
        <a href="#/legal" class="${route === 'legal' ? 'on' : ''}">${ico('shield')}<span>${TXT.pages.legal}</span></a>
        <a href="#/confidentialite" class="${route === 'confidentialite' ? 'on' : ''}">${ico('lock')}<span>${TXT.nav.confidentialite}</span></a>
        <div class="me" style="margin-top:8px">${avatar(ME, 'xs')}<div class="small"><b>${esc(fullName(ME))}</b><div class="muted">${roleLabel(ME.role)}${backend.mode === 'local' ? ' · mode local' : ''}</div></div></div>
      </div>
    </aside>
    <main class="main">
      <div class="topbar"><button class="btn ghost icon burger" data-act="burger" aria-label="Menu">${ico('menu')}</button>${(window.PARKPULSE_ASSETS || {}).icon ? `<img class="top-icon" src="${window.PARKPULSE_ASSETS.icon}" alt="">` : ''}
        <b class="title t-16">${esc(PAGES[route] ? PAGES[route].title : '')}</b>
        <div class="countdown" id="countdown"></div><button class="btn ghost icon" data-act="search" aria-label="Rechercher un client">${ico('search')}</button>${bellBtn()}<button class="btn primary top-cta" data-act="tbSaisir">${ico('plus')} Saisir</button></div>
      <div class="page page-${route}">${inner}${typeof legalFooter === 'function' ? legalFooter() : ''}</div>
    </main>
    ${tabBar(route)}
  </div>`;
}
function tickCountdown() {
  const el = $('#countdown'); if (!el) return;
  const c = compteRebours();
  const html = `${ico('cal')}<b>${esc(c.texte)}</b>`;
  el.title = c.titre;
  if (el.dataset.v !== html) { el.dataset.v = html; el.innerHTML = html; }
}
setInterval(tickCountdown, 60000);

// ── Routeur ────────────────────────────────────────────────────────────────
function currentRoute() { const h = location.hash.replace(/^#\/?/, ''); const [r, ...rest] = h.split('/'); return { r: r || 'home', args: rest }; }
let renderQueued = false;
function render() {
  if (renderQueued) return; renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; renderNow(); });
}
// ?perf dans l'adresse : temps de chaque rendu affiché en bas à gauche.
const PERF_ON = /[?&]perf\b/.test(location.search);
function renderNow() { const t0 = performance.now(); renderNowInner(); if (PERF_ON) { const ms = performance.now() - t0; let el = $('#perf-hud'); if (!el) { el = document.createElement('div'); el.id = 'perf-hud'; el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;background:#000;color:#ffd600;font:12px monospace;padding:6px 8px;border-radius:6px'; document.body.appendChild(el); } el.textContent = `rendu ${ms.toFixed(1)} ms · ${(location.hash || '#/home').slice(2)} · ${Object.keys(S && S.entries || {}).length} saisies`; } }
function renderNowInner() {
  const app = $('#app'); if (!app) return;
  // Pages légales : lisibles sans être connecté
  if (currentRoute().r === 'legal' && ((backend.mode === 'firebase' && !backend.user) || !S || !ME)) { app.innerHTML = legalStandalone(currentRoute().args[0]); window.scrollTo(0, 0); return; }
  if (currentRoute().r === 'confidentialite' && ((backend.mode === 'firebase' && !backend.user) || !S || !ME)) { app.innerHTML = confidentialiteStandalone(); window.scrollTo(0, 0); return; }
  if (MULTI && !backend.user && typeof multiPublic === 'function' && multiPublic(currentRoute().r, currentRoute().args)) return;
  if (backend.mode === 'firebase' && !backend.user) { app.innerHTML = PAGES.login.render(); if (PAGES.login.mount) PAGES.login.mount(); return; }
  if (!S) { app.innerHTML = PAGES.onboarding.render(); return; }
  if (!ME) { app.innerHTML = PAGES.login.render(); if (PAGES.login.mount) PAGES.login.mount(); return; }
  ME = S.users[ME.id] || null;
  if (!ME || ME.status === 'archived') { logout(); return; }
  if (!CLUB || !S.clubs[CLUB.id] || !myClubs().some(c => c.id === CLUB.id)) CLUB = myClubs()[0] || null;
  else CLUB = S.clubs[CLUB.id];
  if (!CLUB) { app.innerHTML = `<div class="auth"><div class="auth-card"><h2>Aucun club</h2><p class="muted">Votre compte n'est rattaché à aucun club. Demandez à un manager de vous ajouter.</p><button class="btn primary" data-act="logout">Se déconnecter</button></div></div>`; return; }
  appliquerCouleurClub();
  let { r, args } = currentRoute();
  if (r === 'wrap') { app.innerHTML = PAGES.wrap.render(args); PAGES.wrap.mount(args); return; }
  if (ROUTE_ALIAS[r]) { const [to, k, v] = ROUTE_ALIAS[r]; if (UI._aliasFrom !== location.hash) { UI[k] = v; UI._aliasFrom = location.hash; } r = to; } else UI._aliasFrom = null;
  if (!PAGES[r] || PAGES[r].auth === false) r = 'home';
  if (PAGES[r].manager && !isManager()) r = 'home';
  if (PAGES[r].creator && !isCreator()) { r = 'home'; history.replaceState(null, '', location.pathname + location.search + '#/home'); }
  const keepScroll = UI._lastRoute === r ? window.scrollY : 0;
  const active = document.activeElement; const focusKey = active && active.dataset ? active.dataset.focus : null;
  app.innerHTML = shell(r, PAGES[r].render(args));
  UI._lastRoute = r;
  if (PAGES[r].mount) PAGES[r].mount(args);
  if (typeof cguGate === 'function') cguGate();
  // Lecteurs d'écran : boutons icône nommés par leur infobulle, pastilles de santé lisibles.
  $$('button[title]:not([aria-label]),a[title]:not([aria-label])', app).forEach(b => { if (!b.textContent.trim()) b.setAttribute('aria-label', b.title); });
  $$('.hdot[title]:not([role])', app).forEach(i => { i.setAttribute('role', 'img'); i.setAttribute('aria-label', i.title); });
  tickCountdown();
  window.scrollTo(0, keepScroll);
  if (focusKey) { const el = $(`[data-focus="${focusKey}"]`); if (el) { el.focus(); if (el.setSelectionRange && el.value) el.setSelectionRange(el.value.length, el.value.length); } }
}
window.addEventListener('hashchange', () => { UI._lastRoute = null; render(); });

// Page intégrée dans l'onglet d'une autre : son propre en-tête est retiré.
const subPage = html => String(html).replace(/^\s*<div class="page-head">[\s\S]*?<\/div>\s*(<span class="spacer"><\/span>[\s\S]*?)?<\/div>/, m => { const acts = m.match(/<span class="spacer"><\/span>([\s\S]*)<\/div>\s*$/); return acts ? `<div class="row wrap sub-acts">${acts[1]}</div>` : ''; });

// ── Delegation d'evenements ────────────────────────────────────────────────
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const f = ACTIONS[el.dataset.act];
  if (f) {
    e.preventDefault(); f(el, e);
    // Lien interne qui porte aussi une action : l'action d'abord, puis la page visée.
    const href = el.tagName === 'A' ? el.getAttribute('href') || '' : '';
    if (href.startsWith('#/')) { if (location.hash !== href) location.hash = href; else render(); }
  }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el && ACTIONS[el.dataset.change]) ACTIONS[el.dataset.change](el, e);
});
// Recherches : un seul rendu 200 ms après la dernière frappe (le curseur reste en place).
const debounce = (fn, ms) => { let t = null; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const debounced = {};
document.addEventListener('input', e => {
  const el = e.target.closest('[data-input]');
  if (!el || !ACTIONS[el.dataset.input]) return;
  const k = el.dataset.input;
  if (/Q$/.test(k)) { (debounced[k] = debounced[k] || debounce(ACTIONS[k], 200))(el, e); } else ACTIONS[k](el, e);
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
async function logout() { if (typeof pushForget === 'function' && backend.mode === 'firebase') await pushForget(); ME = null; safeLS.del(SESSION_KEY); if (backend.mode === 'firebase') { await backend.signOut(); S = null; } render(); }

// CSV pour Excel : point-virgule, BOM UTF-8, et neutralisation des cellules qui
// commencent par = + - @ (une formule cachee dans un nom ne s'execute pas).
function csvCell(x) {
  let v = x == null ? '' : String(x);
  if (/^[=+\-@\t\r]/.test(v) && !/^-?\d+([,.]\d+)?$/.test(v)) v = "'" + v;
  return `"${v.replace(/"/g, '""')}"`;
}
const toCsv = (headers, rows) => '\uFEFF' + [headers, ...rows].map(r => r.map(csvCell).join(';')).join('\r\n');
const csvNum = n => n == null || n === '' ? '' : String(Math.round(Number(n) * 100) / 100).replace('.', ',');
// Telechargement d'un fichier genere
function downloadFile(name, content, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
