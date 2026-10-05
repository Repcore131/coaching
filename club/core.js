'use strict';
// ══ PARK PULSE — socle : outils, stockage, donnees de depart ══════════════
//
// Toutes les donnees tiennent dans un seul objet S, range par collections
// (objets indexes par identifiant, jamais de tableaux : une ecriture vise
// toujours un chemin precis, ce qui marche pareil en local et sur Firebase).
// Rien ne sort de nos clubs : il n'existe ni reseau, ni classement inter-
// enseignes, ni fil partage avec l'exterieur.

const APP = { name: 'Park Pulse', tagline: 'Pilotage commercial de nos clubs Fitness Park' };

// ── Outils ─────────────────────────────────────────────────────────────────
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = n => nf0.format(Math.round(n || 0));
const fmtE = n => (Number.isInteger(Math.round((n || 0) * 100) / 100) ? nf0.format(n || 0) : nf2.format(n || 0)) + ' €';
const fmtV = (v, unit) => unit === 'eur' ? fmtE(v) : fmtN(v);
const fmtP = p => p == null ? '—' : Math.round(p * 100) + ' %';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoOf(new Date());
const curMonth = () => today().slice(0, 7);
const dateOf = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); };
const daysIn = mk => { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const addMonths = (mk, n) => { const [y, m] = mk.split('-').map(Number); return isoOf(new Date(y, m - 1 + n, 1)).slice(0, 7); };
const addDays = (s, n) => { const d = dateOf(s); d.setDate(d.getDate() + n); return isoOf(d); };
const monthLabel = mk => { const [y, m] = mk.split('-').map(Number); return MOIS[m - 1] + ' ' + y; };
const weekStart = s => { const d = dateOf(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return isoOf(d); };
const dmy = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';
const dm = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) : '';
const dayLabel = s => { const d = dateOf(s); return JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()].toLowerCase(); };
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const initials = u => u ? ((u.first || '?')[0] + (u.last || '')[0] || '').toUpperCase() : '?';
const fullName = u => u ? `${u.first || ''} ${u.last || ''}`.trim() : 'Inconnu';
const ago = ts => {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'maintenant';
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return dmy(isoOf(new Date(ts)));
};
const timeOf = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const deepGet = (o, path) => path.reduce((a, k) => a == null ? a : a[k], o);

// Generateur pseudo-aleatoire a graine : la demo est la meme a chaque fois.
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ── Icones (trait, 24x24) ─────────────────────────────────────────────────
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  feed: '<path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.5"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  door: '<path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5M10 17l-5-5 5-5M5 12h12"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  clip: '<path d="m21.4 11-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  map: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  euro: '<path d="M18 7a7 7 0 1 0 0 10"/><path d="M4 10h10M4 14h10"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
};
const ico = (n, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24">${ICONS[n] || ''}</svg>`;

// ── Referentiels par defaut ───────────────────────────────────────────────
// points : ce que vaut le KPI a 100 % de l'objectif. Les points tombent par
// paliers de 25 % (25/50/75/100) : a 60 % d'un KPI a 1 000 pts, on a 500 pts.
const DEFAULT_KPIS = {
  avis:        { id: 'avis',        label: 'Avis Google',            unit: 'qty', points: 100,  required: true,  enabled: true, order: 1, emoji: '⭐' },
  nutrition:   { id: 'nutrition',   label: 'Nutrition',              unit: 'eur', points: 500,  required: true,  enabled: true, order: 2, emoji: '🥤' },
  contrats:    { id: 'contrats',    label: 'Contrats signés',        unit: 'qty', points: 1000, required: true,  enabled: true, order: 3, emoji: '✍️' },
  accessoires: { id: 'accessoires', label: 'Accessoires',            unit: 'eur', points: 500,  required: true,  enabled: true, order: 4, emoji: '🧢' },
  impayes:     { id: 'impayes',     label: 'Impayés récupérés',      unit: 'eur', points: 750,  required: true,  enabled: true, order: 5, emoji: '💶' },
  b2b:         { id: 'b2b',         label: 'Contrat B2B',            unit: 'qty', points: 100,  required: false, enabled: true, order: 6, emoji: '🏢' },
  invites:     { id: 'invites',     label: 'Invités > Contrats',     unit: 'qty', points: 300,  required: false, enabled: true, order: 7, emoji: '🎟️' },
  sauvetage:   { id: 'sauvetage',   label: 'Sauvetage résiliations', unit: 'qty', points: 300,  required: false, enabled: true, order: 8, emoji: '🛟' },
  prospects:   { id: 'prospects',   label: 'Prospects',              unit: 'qty', points: 0,    required: false, enabled: true, order: 9, emoji: '🧲' },
};

const DEFAULT_TASKS = [
  ['Ouverture', ['Check passage du matin', 'Ouverture caisse', 'Tour du plateau', 'Vérification propreté vestiaires']],
  ['Ventes', ['Appels prospects de la veille', 'Relance prospects J+3', 'Rappel des invités du week-end', 'Visites programmées', 'Relance devis B2B', 'Prospection entreprises du secteur']],
  ['Rétention', ['Appels J+15 nouveaux adhérents', 'Appels J+30 nouveaux adhérents', 'Relance adhérents sans mandat', 'Relance impayés du jour', 'Appels anniversaires', 'Appels renouvellements du mois', 'Suivi résiliations et sauvetages']],
  ['Réputation', ['Réponse aux avis Google', 'Réponse aux avis Wizville', 'Demande d’avis aux adhérents satisfaits']],
  ['Boutique', ['Mise en avant boutique nutrition', 'Inventaire accessoires', 'Réassort frigo']],
  ['Communication', ['Story Instagram', 'Post Facebook du club', 'Affichage planning cours']],
  ['Clôture', ['Validation de caisse', 'Saisie des KPI du jour dans Park Pulse', 'Point équipe de fin de journée', 'Fermeture et alarme']],
];

const LEVELS = [
  { id: 'rookie', label: 'Rookie', min: 0 },
  { id: 'performer', label: 'Performer', min: 10000 },
  { id: 'warrior', label: 'Warrior', min: 30000 },
  { id: 'elite', label: 'Élite', min: 50000 },
  { id: 'legende', label: 'Légende', min: 100000 },
];

function emptyState() {
  return {
    meta: { version: 1, createdAt: Date.now() },
    clubs: {}, users: {}, kpis: JSON.parse(JSON.stringify(DEFAULT_KPIS)),
    targets: {}, entries: {}, imports: {}, monthly: {}, base: {},
    clients: {}, loyalty: {}, resiliations: {}, challenges: {}, chat: {}, reactions: {},
    recov: {}, rsm: { aliases: {}, controls: {}, routine: {} },
    tasks: { library: defaultLibrary(), plan: {}, done: {} },
    prefs: {}, team: {},
  };
}
function defaultLibrary() {
  const lib = {}; let n = 0;
  DEFAULT_TASKS.forEach(([cat, list]) => list.forEach(label => { const id = 't' + (++n); lib[id] = { id, label, cat }; }));
  return lib;
}

// ── Stockage ───────────────────────────────────────────────────────────────
// db.set(['entries', id], valeur) : ecrit (null efface). S est mis a jour tout
// de suite, l'ecran se redessine, la persistance suit.
let S = null;
let REV = 0;
const LOCAL_KEY = 'parkpulse.v1';
const SESSION_KEY = 'parkpulse.session';
const listeners = new Set();
const safeLS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* rien */ } },
};

function setPath(obj, path, value) {
  let o = obj;
  for (let i = 0; i < path.length - 1; i++) { if (o[path[i]] == null || typeof o[path[i]] !== 'object') o[path[i]] = {}; o = o[path[i]]; }
  const k = path[path.length - 1];
  if (value === null || value === undefined) delete o[k]; else o[k] = value;
}

const localBackend = {
  mode: 'local',
  async start() { const raw = safeLS.get(LOCAL_KEY); S = raw ? normalizeState(JSON.parse(raw)) : null; },
  write(path, value) { this.flush(); },
  flush: (() => { let t = null; return function () { clearTimeout(t); t = setTimeout(() => { if (!safeLS.set(LOCAL_KEY, JSON.stringify(S))) toast('Stockage du navigateur plein : exportez une sauvegarde (Mes clubs > Réglages).'); }, 150); }; })(),
  replaceAll() { safeLS.set(LOCAL_KEY, JSON.stringify(S)); },
  wipe() { safeLS.del(LOCAL_KEY); },
};

// Firebase Realtime Database : meme arbre, sous /pulse. L'ecoute en direct
// redessine l'ecran quand un collegue saisit quelque chose.
const firebaseBackend = {
  mode: 'firebase', fb: null, root: null, user: null,
  async loadSdk() {
    const v = '10.12.2';
    for (const f of ['firebase-app-compat', 'firebase-auth-compat', 'firebase-database-compat']) {
      await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = `https://www.gstatic.com/firebasejs/${v}/${f}.js`; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
    }
    this.fb = window.firebase; this.fb.initializeApp(window.PARKPULSE_FIREBASE);
  },
  async start() {
    await this.loadSdk();
    await new Promise(ok => this.fb.auth().onAuthStateChanged(u => { this.user = u; ok(); }));
    if (this.user) await this.attach();
  },
  async attach() {
    this.root = this.fb.database().ref('pulse');
    await new Promise((ok) => {
      let first = true;
      this.root.on('value', snap => {
        const before = S;
        S = snap.val() ? normalizeState(snap.val()) : null;
        REV++;
        if (first) { first = false; ok(); } else { detectLive(before, S); listeners.forEach(f => f()); }
      }, err => { toast('Accès refusé à la base : votre adresse n’est pas dans l’équipe.'); ok(); });
    });
  },
  async signIn(email, pass) { await this.fb.auth().signInWithEmailAndPassword(email, pass); this.user = this.fb.auth().currentUser; await this.attach(); },
  async signUp(email, pass) { await this.fb.auth().createUserWithEmailAndPassword(email, pass); this.user = this.fb.auth().currentUser; await this.attach(); },
  async signOut() { if (this.root) this.root.off(); await this.fb.auth().signOut(); },
  write(path, value) { this.fb.database().ref(['pulse', ...path].join('/')).set(value ?? null).catch(e => toast('Écriture refusée : ' + e.message)); },
  replaceAll() { this.fb.database().ref('pulse').set(S); },
  wipe() { this.fb.database().ref('pulse').set(null); },
};

const backend = window.PARKPULSE_FIREBASE ? firebaseBackend : localBackend;

const db = {
  set(path, value) {
    setPath(S, path, value);
    REV++;
    backend.write(path, value === undefined ? null : value);
    listeners.forEach(f => f());
  },
  // plusieurs ecritures, un seul rafraichissement
  batch(ops) {
    ops.forEach(([p, v]) => setPath(S, p, v));
    REV++;
    if (backend.mode === 'local') backend.write();
    else { const up = {}; ops.forEach(([p, v]) => { up[p.join('/')] = v ?? null; }); backend.fb.database().ref('pulse').update(up).catch(e => toast('Écriture refusée : ' + e.message)); }
    listeners.forEach(f => f());
  },
  replace(state) { S = normalizeState(state); REV++; backend.replaceAll(); listeners.forEach(f => f()); },
  onChange(f) { listeners.add(f); },
};

// Complete les collections absentes (Firebase n'enregistre pas les objets vides).
function normalizeState(st) {
  const base = emptyState();
  for (const k of Object.keys(base)) if (st[k] == null) st[k] = base[k];
  if (!st.tasks.library) st.tasks.library = defaultLibrary();
  if (!st.tasks.plan) st.tasks.plan = {};
  if (!st.tasks.done) st.tasks.done = {};
  for (const k of Object.keys(DEFAULT_KPIS)) if (!st.kpis[k]) st.kpis[k] = { ...DEFAULT_KPIS[k], enabled: false };
  return st;
}

// Bandeau en direct : une saisie d'un collegue arrive pendant qu'on travaille.
function detectLive(before, after) {
  if (!before || !after || !ME) return;
  const pref = (after.prefs[ME.id] || {});
  if (pref.liveBanner === false) return;
  for (const id of Object.keys(after.entries || {})) {
    if (before.entries[id]) continue;
    const e = after.entries[id];
    if (e.source !== 'manual' || e.userId === ME.id || Date.now() - e.at > 60000) continue;
    const u = after.users[e.userId], k = after.kpis[e.kpiId], c = after.clubs[e.clubId];
    if (u && k) toast(`${k.emoji || '🔥'} ${fullName(u)} — ${fmtV(e.value, k.unit)} ${k.label}${c ? ' — ' + c.name : ''}`);
  }
}

// ── Donnees de demonstration ───────────────────────────────────────────────
// Noms fictifs. Trois mois d'historique, objectifs, clients, imports, chat.
function demoState() {
  const st = emptyState();
  const R = rng(20261005);
  const pick = a => a[Math.floor(R() * a.length)];
  st.clubs = {
    niort: { id: 'niort', name: 'Fitness Park Niort', address: '600 Av. de Paris', city: '79000 Niort', createdAt: Date.now() },
    rochelle: { id: 'rochelle', name: 'Fitness Park La Rochelle', address: '12 rue du Port', city: '17000 La Rochelle', createdAt: Date.now() },
  };
  const people = [
    ['u1', 'Camille', 'Roux', 'manager', ['niort', 'rochelle'], 'f1'],
    ['u2', 'Hugo', 'Lefèvre', 'manager', ['niort'], 'h1'],
    ['u3', 'Inès', 'Moreau', 'membre', ['niort'], 'f2'],
    ['u4', 'Lucas', 'Petit', 'membre', ['niort'], 'h2'],
    ['u5', 'Sarah', 'Garnier', 'membre', ['niort'], 'f1'],
    ['u6', 'Nathan', 'Faure', 'membre', ['rochelle'], 'h1'],
    ['u7', 'Léa', 'Bonnet', 'membre', ['rochelle'], 'f2'],
  ];
  people.forEach(([id, first, last, role, clubs, avatar], i) => {
    st.users[id] = { id, first, last, role, clubs, avatar, status: 'active', email: `${norm(first)}.${norm(last)}@exemple.fr`.replace(/ /g, ''), createdAt: Date.now() - (200 - i) * 86400000 };
  });
  st.users.u8 = { id: 'u8', first: 'Tom', last: 'Girard', role: 'membre', clubs: ['niort'], avatar: 'h2', status: 'archived', archivedAt: addDays(today(), -60), email: 'tom.girard@exemple.fr', createdAt: Date.now() - 300 * 86400000 };

  const cm = curMonth();
  const months = [addMonths(cm, -3), addMonths(cm, -2), addMonths(cm, -1), cm];
  const baseT = { avis: 20, nutrition: 300, contrats: 20, accessoires: 150, impayes: 250, b2b: 2, invites: 3, sauvetage: 2, prospects: 40 };
  const skill = { u1: .95, u2: 1.12, u3: .82, u4: .7, u5: .58, u6: .9, u7: .76 };
  let eid = 0;
  const addE = (o) => { const id = 'e' + (++eid); st.entries[id] = { id, at: dateOf(o.date).getTime() + 9 * 3600000 + Math.floor(R() * 9 * 3600000), source: 'manual', ...o }; };
  months.forEach(mk => {
    st.targets[mk] = {};
    Object.keys(skill).forEach(uid => {
      const t = {}; Object.entries(baseT).forEach(([k, v]) => { t[k] = uid === 'u5' && k === 'b2b' ? 0 : v; });
      st.targets[mk][uid] = t;
      const days = mk === cm ? Math.max(0, Number(today().slice(8)) - 1) : daysIn(mk);
      for (let d = 1; d <= days; d++) {
        const date = `${mk}-${pad(d)}`;
        if (dateOf(date).getDay() === 0) continue;
        const k = skill[uid] * (0.75 + R() * 0.5);
        const per = 1 / daysIn(mk) * 1.15;
        Object.entries(baseT).forEach(([kpi, tv]) => {
          let v = tv * per * k * (0.4 + R() * 1.2);
          if (st.kpis[kpi].unit === 'qty') { v = R() < (v % 1) ? Math.ceil(v) : Math.floor(v); if (!v) return; }
          else { if (R() < .45) return; v = Math.round(v * 1.8 * 100) / 100; }
          addE({ userId: uid, clubId: st.users[uid].clubs[0], kpiId: kpi, date, value: v });
        });
      }
    });
  });
  // Un import Resamania deja passe (actif), pour montrer l'historique.
  st.imports.imp1 = { id: 'imp1', name: 'export-ventes-abonnements.csv', type: 'kpi', clubId: 'niort', at: Date.now() - 6 * 86400000, rows: 3, from: `${addMonths(cm, -1)}-01`, to: `${addMonths(cm, -1)}-${daysIn(addMonths(cm, -1))}`, active: true, by: 'u1' };
  [['u2', 2], ['u3', 1], ['u4', 1]].forEach(([u, v], i) => addE({ userId: u, clubId: 'niort', kpiId: 'b2b', date: `${addMonths(cm, -1)}-${pad(10 + i)}`, value: v, source: 'import', importId: 'imp1' }));

  // Historique mensuel du club (annee N-1 et N) pour la comparaison annuelle.
  const y = Number(cm.slice(0, 4));
  ['niort', 'rochelle'].forEach((c, ci) => {
    st.monthly[c] = {};
    for (let yy = y - 1; yy <= y; yy++) for (let m = 1; m <= 12; m++) {
      const mk = `${yy}-${pad(m)}`; if (mk >= cm) continue;
      const f = (yy === y ? 1.15 : 1) * (ci ? .8 : 1) * (0.8 + R() * 0.4);
      st.monthly[c][mk] = { contrats: Math.round(110 * f), visiteurs: Math.round(180 * f), complements: Math.round(1500 * f * 100) / 100, goodies: Math.round(420 * f * 100) / 100, impayes: Math.round(900 * f), caPack: Math.round(7600 * f) };
    }
    st.base[c] = {};
    for (let i = -6; i <= 0; i++) { const mk = addMonths(cm, i); const actifs = Math.round((ci ? 1350 : 1680) + i * 6 + R() * 20); st.base[c][mk] = { actifs, sortants: Math.round(70 + R() * 30), objectif: actifs + 50 }; }
  });

  // Clients (fichier « Résumé clients » + « Solde clients »).
  const P = ['Emma', 'Louis', 'Chloé', 'Jules', 'Manon', 'Arthur', 'Zoé', 'Gabriel', 'Lina', 'Raphaël', 'Jade', 'Adam', 'Alice', 'Léo', 'Rose', 'Noah', 'Anna', 'Paul', 'Mila', 'Ethan', 'Nina', 'Sacha', 'Lou', 'Tim'];
  const N = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Durand', 'Leroy', 'Simon', 'Laurent', 'Michel', 'Garcia', 'David', 'Bertrand', 'Morel', 'Fournier', 'Mercier', 'Blanc', 'Guerin', 'Muller'];
  for (let i = 1; i <= 46; i++) {
    const club = i % 4 === 0 ? 'rochelle' : 'niort';
    const birth = `${1975 + Math.floor(R() * 30)}-${cm.slice(5, 7)}-${pad(1 + Math.floor(R() * 28))}`;
    const start = addDays(today(), -Math.floor(R() * 400));
    const end = addDays(today(), Math.floor(R() * 120) - 20);
    const bal = R() < .22 ? Math.round((20 + R() * 180) * 100) / 100 : 0;
    st.clients['c' + i] = { id: 'c' + i, clubId: club, name: `${pick(P)} ${pick(N)}`, phone: `06 ${pad(Math.floor(R() * 99))} ${pad(Math.floor(R() * 99))} ${pad(Math.floor(R() * 99))} ${pad(Math.floor(R() * 99))}`, birth: i % 3 ? addDays(birth, 0) : null, start, end, balance: bal, offer: pick(['Ultimate', 'Premium', 'Basic', 'Ultimate']) };
  }
  // Quelques relances deja faites
  ['c1', 'c2', 'c5'].forEach((c, i) => { st.loyalty['l' + i] = { id: 'l' + i, clientId: c, type: 'suivi', userId: ['u3', 'u4', 'u2'][i], outcome: i === 1 ? 'noanswer' : 'ok', note: '', at: Date.now() - (i + 1) * 86400000 }; });

  st.resiliations.r1 = { id: 'r1', clubId: 'niort', client: 'Marc Henry', date: addDays(today(), -4), reason: 'Déménagement', saved: false, userId: 'u2', at: Date.now() - 4 * 86400000 };
  st.resiliations.r2 = { id: 'r2', clubId: 'niort', client: 'Julie Perrin', date: addDays(today(), -2), reason: 'Prix', saved: true, userId: 'u3', at: Date.now() - 2 * 86400000 };

  st.chat.m1 = { id: 'm1', channel: 'niort', userId: 'u2', text: 'Bravo à toute l’équipe pour le mois dernier 💪 On garde le rythme sur les contrats !', at: Date.now() - 2 * 86400000 };
  st.chat.m2 = { id: 'm2', channel: 'niort', userId: 'u3', text: 'Je m’occupe des relances anniversaires cette semaine.', at: Date.now() - 86400000, parentId: 'm1' };
  st.chat.m3 = { id: 'm3', channel: 'all', userId: 'u1', text: 'Point mensuel des deux clubs vendredi 10h. Venez avec vos chiffres 📊', at: Date.now() - 5 * 3600000 };

  const libIds = Object.keys(st.tasks.library);
  st.tasks.plan.niort = {};
  [[7, 0], [8, 1], [10, 6], [11, 9], [14, 10], [15, 14], [17, 21], [20, 31]].forEach(([h, t], i) => { const id = 'p' + i; st.tasks.plan.niort[id] = { id, taskId: libIds[t], hour: h }; });

  st.challenges.ch1 = { id: 'ch1', clubId: 'niort', title: 'Sprint nutrition', desc: 'Le plus de ventes nutrition en 48 h (rapporté à l’objectif).', kpiId: 'nutrition', start: Date.now() - 20 * 86400000, end: Date.now() - 18 * 86400000, by: 'u2' };
  // Regularisations d'impayes par canal (comme la liste Incidents de Resamania)
  let rv = 0;
  Object.values(st.entries).filter(e => e.kpiId === 'impayes' && e.clubId === 'niort').forEach(e => { const id = 'v' + (++rv); st.recov[id] = { id, clubId: 'niort', date: e.date, amount: e.value, canal: 'equipe', userId: e.userId, type: 'Prélèvements rejetés', at: e.at }; });
  months.forEach(mk => {
    const days = mk === cm ? Math.max(1, Number(today().slice(8)) - 1) : daysIn(mk);
    [['auto', 34, 42], ['client', 10, 38], ['automatismes', 7, 30], ['tiers', 1, 60]].forEach(([canal, n, avg]) => {
      for (let i = 0; i < Math.round(n * days / daysIn(mk)); i++) { const id = 'v' + (++rv); st.recov[id] = { id, clubId: 'niort', date: `${mk}-${pad(1 + Math.floor(R() * days))}`, amount: Math.round(avg * (0.5 + R()) * 100) / 100, canal, userId: null, type: 'Prélèvements rejetés', at: Date.now() }; }
    });
  });
  st.rsm.aliases = { 'c:HLEF': 'u2', 'c:IMOR': 'u3', 'c:LPET': 'u4', 'c:SGAR': 'u5', 'c:CROU': 'u1' };
  st.meta.demo = true;
  return st;
}

// ── Roles et codes d'acces ────────────────────────────────────────────────
// createur : tout (clubs, KPI et points, roles, sauvegarde, remise a zero).
// manager  : les clubs ou il est rattache (equipe, objectifs, imports, taches, defis).
// membre   : ses saisies, son tableau de bord, classement, retention, chat, feed.
const ROLES = {
  createur: { label: 'Créateur', rank: 3 },
  manager: { label: 'Manager', rank: 2 },
  membre: { label: 'Membre', rank: 1 },
};
const roleLabel = r => (ROLES[r] || ROLES.membre).label;
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^FP/, '').replace(/(.{4})(?=.)/g, '$1-').replace(/^/, 'FP-');
async function hashCode(salt, code) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + normCode(code)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function randomCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; const r = crypto.getRandomValues(new Uint32Array(12));
  return 'FP-' + [0, 1, 2].map(g => [0, 1, 2, 3].map(i => A[r[g * 4 + i] % A.length]).join('')).join('-');
}
async function newCodeRecord() {
  const code = randomCode(); const salt = [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');
  return { code, salt, codeHash: await hashCode(salt, code) };
}
// Comptes declares dans config.js : crees s'ils manquent, rattaches a tous les clubs.
function bootstrapOps() {
  const ops = []; const accounts = window.PARKPULSE_ACCOUNTS || [];
  if (!accounts.length) return ops;
  const club = window.PARKPULSE_CLUB;
  if (club && !S.clubs[club.id]) ops.push([['clubs', club.id], { ...club, createdAt: Date.now() }]);
  const allClubs = [...new Set([...Object.keys(S.clubs), ...(club ? [club.id] : [])])];
  for (const a of accounts) {
    if (S.users[a.id]) continue;
    ops.push([['users', a.id], { id: a.id, first: a.first, last: a.last, email: a.email, role: a.role, clubs: allClubs, avatar: 'h1', status: 'active', salt: a.salt, codeHash: a.codeHash, createdAt: Date.now() }]);
    if (a.email) ops.push([['team', a.email.toLowerCase().replace(/\./g, ',')], true]);
  }
  return ops;
}
