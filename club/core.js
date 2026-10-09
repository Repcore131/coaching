/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — socle : outils, stockage, donnees de depart ══════════════
//
// Toutes les donnees tiennent dans un seul objet S, range par collections
// (objets indexes par identifiant, jamais de tableaux : une ecriture vise
// toujours un chemin precis, ce qui marche pareil en local et sur Firebase).
// Rien ne sort de nos clubs : il n'existe ni reseau, ni classement inter-
// enseignes, ni fil partage avec l'exterieur.

const APP = { name: TXT.app.nom, tagline: TXT.app.accroche };
// ── Le client (S.tenant) : nom, enseigne, logo, couleurs, société, panier moyen ──
// Saisi à la création du club (formulaire de départ), modifiable dans Club et réglages.
// Aucune valeur par défaut ne cite une enseigne, une ville ou une personne.
const tenant = () => (S && S.tenant) || {};
const entiteTexte = () => tenant().entity ? `Entité = ${tenant().entity}` : 'Entité = votre société d’exploitation';


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
const fmtP = p => p == null ? 'n.d.' : Math.round(p * 100) + ' %';
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
// Accord : plur(3, 'saisie', 'saisies') -> « 3 saisies » (fin des « saisie(s) »).
const plur = (n, one, many, show = true) => `${show ? (typeof fmtN === 'function' ? fmtN(n) : n) + ' ' : ''}${Math.abs(n) >= 2 ? many : one}`;
const addDays = (s, n) => { const d = dateOf(s); d.setDate(d.getDate() + n); return isoOf(d); };
const monthLabel = mk => { const [y, m] = mk.split('-').map(Number); return MOIS[m - 1] + ' ' + y; };
const weekStart = s => { const d = dateOf(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return isoOf(d); };
const dmy = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';
const dm = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) : '';
const dayLabel = s => { const d = dateOf(s); return JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()].toLowerCase(); };
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const initials = u => u ? (((u.first || '?')[0] || '?') + ((u.last || '')[0] || '')).toUpperCase() : '?';
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
  pouls: '<path d="M2 12h4l2-5 4 10 3-7 2 2h5"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
  mail: '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="m22 6-10 7L2 6"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  door: '<path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5M10 17l-5-5 5-5M5 12h12"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
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
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  snow: '<path d="M12 2v20M4.9 7l14.2 10M4.9 17L19.1 7"/><path d="m9 4 3 3 3-3M9 20l3-3 3 3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
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
  // Icones metier : remplacent les emojis (meme trait 2 px, bouts ronds).
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
  cup: '<path d="M7 3h10l-1.5 18h-7z"/><path d="M6.4 8h11.2M12 3V1"/>',
  pen: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4M14 20h6"/>',
  cap: '<path d="M3 15c0-5 4-9 9-9s9 4 9 9"/><path d="M3 15h18l-1 2H8M12 6V4"/>',
  coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.6-2.4-2.9-5.5-3"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  ticket: '<path d="M3 8V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a2 2 0 0 0 0 4v0a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4V12a2 2 0 0 0 0-4z"/><path d="M14 5v14" stroke-dasharray="2 2"/>',
  lifebuoy: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m5.6 5.6 3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"/>',
  magnet: '<path d="M5 3v8a7 7 0 0 0 14 0V3h-4v8a3 3 0 0 1-6 0V3z"/><path d="M5 7h4M15 7h4"/>',
  crown: '<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
  medal: '<path d="M8 3h8l-2 6h-4z"/><circle cx="12" cy="15" r="6"/><path d="m12 12 1 2h2l-1.6 1.3.6 2.2-2-1.3-2 1.3.6-2.2L9 14h2z"/>',
  cake: '<path d="M4 21V12h16v9M2 21h20M4 16c2 1.5 4 1.5 6 0s4-1.5 6 0 3 1 4 0M12 12V8M12 5.5v.5"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  bank: '<path d="m3 9 9-6 9 6M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 21h18"/>',
  flame: '<path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-4-9-1 2-2 3-3 3 0-2-1-4-3-6-.5 4-4 7-4 12a7 7 0 0 0 7 7z"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  calcheck: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>',
};
// Icone d'un KPI : par son id (KPI par defaut), sinon le nom d'icone choisi,
// sinon une cible. Jamais de texte libre injecte dans la page.
const KPI_ICON = { avis: 'star', nutrition: 'cup', contrats: 'pen', accessoires: 'cap', impayes: 'coins', b2b: 'briefcase', invites: 'ticket', sauvetage: 'lifebuoy', prospects: 'magnet' };
const kpiIconName = k => (k && ICONS[k.icon]) ? k.icon : (k && KPI_ICON[k.id]) || 'target';
const kpiIcon = (k, cls = 'ico') => ico(kpiIconName(k), cls);
// Reactions : les cles historiques restent (pas de perte), l'affichage passe
// en icones. Toute autre cle est ignoree (jamais injectee dans la page).
const REACT_ICON = { '🔥': ['flame', 'Bravo'], '💪': ['medal', 'Costaud'], '👏': ['sparkle', 'Bien joué'], '👍': ['check', 'OK'] };
const reactIco = em => REACT_ICON[em] ? ico(REACT_ICON[em][0], 'ico') : '';
// Image du chat : uniquement une image encodee (data:), jamais un texte qui pourrait sortir de l'attribut.
const safeImg = v => typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v);
const ico = (n, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24">${ICONS[n] || ''}</svg>`;

// ── Referentiels par defaut ───────────────────────────────────────────────
// points : ce que vaut le KPI a 100 % de l'objectif. Les points tombent par
// paliers de 25 % (25/50/75/100) : a 60 % d'un KPI a 1 000 pts, on a 500 pts.
const DEFAULT_KPIS = {
  avis:        { id: 'avis',        label: 'Avis Google',            unit: 'qty', points: 100,  required: true,  enabled: true, order: 1, icon: 'star' },
  nutrition:   { id: 'nutrition',   label: 'Nutrition',              unit: 'eur', points: 500,  required: true,  enabled: true, order: 2, icon: 'cup' },
  contrats:    { id: 'contrats',    label: 'Contrats signés',        unit: 'qty', points: 1000, required: true,  enabled: true, order: 3, icon: 'pen' },
  accessoires: { id: 'accessoires', label: 'Accessoires',            unit: 'eur', points: 500,  required: true,  enabled: true, order: 4, icon: 'cap' },
  impayes:     { id: 'impayes',     label: 'Impayés récupérés',      unit: 'eur', points: 750,  required: true,  enabled: true, order: 5, icon: 'coins' },
  b2b:         { id: 'b2b',         label: 'Contrat B2B',            unit: 'qty', points: 100,  required: false, enabled: true, order: 6, icon: 'briefcase' },
  invites:     { id: 'invites',     label: TXT.kpi.invites,        unit: 'qty', points: 300,  required: false, enabled: true, order: 7, icon: 'ticket' },
  sauvetage:   { id: 'sauvetage',   label: 'Sauvetage résiliations', unit: 'qty', points: 300,  required: false, enabled: true, order: 8, icon: 'lifebuoy' },
  prospects:   { id: 'prospects',   label: 'Prospects',              unit: 'qty', points: 0,    required: false, enabled: true, order: 9, icon: 'magnet' },
  upsell:      { id: 'upsell',      label: 'Montée en gamme',        unit: 'eur', points: 300,  required: false, enabled: true, order: 10, icon: 'sparkle' },
};

const DEFAULT_TASKS = [
  ['Ouverture', [TXT.taches.passage, 'Ouverture caisse', 'Tour du plateau', 'Vérification propreté vestiaires']],
  ['Ventes', ['Appels prospects de la veille', 'Relance prospects J+3', 'Rappel des invités du week-end', 'Visites programmées', 'Relance devis B2B', 'Prospection entreprises du secteur']],
  ['Rétention', ['Appels J+15 nouveaux adhérents', 'Appels J+30 nouveaux adhérents', 'Relance adhérents sans mandat', 'Relance impayés du jour', 'Appels anniversaires', 'Appels renouvellements du mois', 'Suivi résiliations et sauvetages']],
  ['Réputation', ['Réponse aux avis Google', TXT.taches.avis, 'Demande d’avis aux adhérents satisfaits']],
  ['Boutique', ['Mise en avant boutique nutrition', 'Inventaire accessoires', 'Réassort frigo']],
  ['Communication', ['Story Instagram', 'Post Facebook du club', 'Affichage planning cours']],
  ['Clôture', ['Validation de caisse', 'Saisie des KPI du jour dans Fit Pulse', 'Point équipe de fin de journée', 'Fermeture et alarme']],
];

// Zones : paliers individuels gagnés par mois validés (voir zoneOf dans calc.js).
const ZONES = TXT.zones.liste;

function emptyState() {
  const st = {
    meta: { version: 1, createdAt: Date.now() },
    clubs: {}, users: {}, kpis: JSON.parse(JSON.stringify(DEFAULT_KPIS)),
    targets: {}, entries: {}, imports: {}, monthly: {}, base: {},
    clients: {}, loyalty: {}, resiliations: {}, challenges: {}, chat: {}, reactions: {},
    recov: {}, rsm: { aliases: {}, controls: {}, routine: {} }, paliers: {},
    tasks: { library: defaultLibrary(), plan: {}, done: {} },
    prefs: {}, team: {}, audit: {}, absences: {}, touches: {}, relances: {}, prospects: {}, guests: {}, companies: {}, opps: {}, templates: {}, relanceCfg: {}, offers: {}, coaching: {}, alertAcks: {}, wrapNotes: {}, targetPlans: {}, product: {}, resRequests: {}, resRequestsMeta: {}, benchmark: {}, settings: {}, recapNotes: {}, usage: {}, tenant: {},
  };
  if (typeof productFill === 'function') productFill(st); // suivi produit : les 32 lignes de depart
  return st;
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
  flush: (() => { let t = null; return function () { clearTimeout(t); t = setTimeout(() => { const js = JSON.stringify(S); if (js.length > 4e6) toast('Données locales volumineuses (plus de 4 Mo) : passez en mode partagé ou exportez une sauvegarde.'); if (!safeLS.set(LOCAL_KEY, js)) toast(TXT.clubs.stockage); }, 150); }; })(),
  replaceAll() { safeLS.set(LOCAL_KEY, JSON.stringify(S)); },
  wipe() { safeLS.del(LOCAL_KEY); },
};

// Firebase Realtime Database : meme arbre, sous /pulse. L'ecoute en direct
// redessine l'ecran quand un collegue saisit quelque chose.
//
// CONNEXION PAR E-MAIL + CODE, depuis n'importe quel appareil :
//  - cle = SHA-256(e-mail|code), 40 caracteres hexadecimaux (bootKey) ;
//  - le manager qui cree un code ecrit /pulse_boot/{cle} = id du membre ;
//  - le membre se connecte a un compte Firebase « technique »
//    fp-{cle}@fitpulse-niort.web.app dont le mot de passe est son code
//    (cree a la premiere connexion) ;
//  - les regles n'ouvrent /pulse qu'a un compte dont la cle existe dans
//    /pulse_boot. Changer ou retirer un code efface la cle : acces coupe.
const AUTH_DOMAIN_FP = '@fitpulse-niort.web.app';
async function bootKeyOf(email, code) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(email || '').trim().toLowerCase() + '|' + normCode(code)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}
// Clé « code seul » : retrouve le compte même si l'e-mail tapé n'est pas celui du compte
// (autre adresse, faute de frappe). Elle pointe vers la clé de connexion (e-mail + code).
async function codeKeyOf(code) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('code|' + normCode(code)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}
// Adresse saisie : sans espaces, en minuscules, et les fautes de clavier courantes corrigées.
const cleanEmail = e => String(e || '').replace(/\s+/g, '').toLowerCase().replace(/[,;]/g, '.').replace(/\.+$/, '').replace(/@gmail\.(fr|con|cm|om)$/, '@gmail.com');
class LoginError extends Error { constructor(kind, msg) { super(msg); this.kind = kind; } }
// ── Mode multi-salles (PARKPULSE_FIREBASE.multi) ─────────────────────────
// Chaque société cliente a son espace : /orgs/{org}/info (abonnement, statut,
// sécurité), /orgs/{org}/clubs/{club}, et toutes les collections sous
// /orgs/{org}/data/… ; les clés de connexion sont dans /orgs_boot/{clé} =
// { org, uid }. Sans ce réglage, l'appli reste sur /pulse (base historique).
const MULTI = !!(window.PARKPULSE_FIREBASE && window.PARKPULSE_FIREBASE.multi);
let ORG = null;
const ROOT = () => MULTI ? `orgs/${ORG}/data` : 'pulse';
const BOOT = MULTI ? 'orgs_boot' : 'pulse_boot';
// Lecture REST d'un chemin public (clé de connexion, invitation), simulateur compris.
function restUrl(chemin) {
  const F = window.PARKPULSE_FIREBASE || {}; const e = F.emulateurs;
  return e ? `http://${e.db[0]}:${e.db[1]}/${chemin}.json?ns=${F.databaseURL.replace(/^https:\/\//, '').split('.')[0]}` : `${F.databaseURL}/${chemin}.json`;
}
// Chemins annexes (push, boîte de réception, journal) : sous l'espace de la société en multi-salles.
const fbPath = p => !MULTI ? p : p.replace(/^pulse_push\//, `orgs_push/${ORG}/`).replace(/^pulse_inbox\//, `orgs_inbox/${ORG}/`).replace(/^pulse\//, ROOT() + '/');
const firebaseBackend = {
  mode: 'firebase', fb: null, root: null, user: null, userId: null, denied: false,
  async loadSdk() {
    // SDK Firebase compat 10.12.2, hébergé dans vendor/
    for (const f of ['firebase-app-compat', 'firebase-auth-compat', 'firebase-database-compat']) {
      await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = `vendor/${f}.js`; s.onload = ok; s.onerror = () => ko(new LoginError('offline', 'Pas de connexion internet.')); document.head.appendChild(s); });
    }
    this.fb = window.firebase; this.fb.initializeApp(window.PARKPULSE_FIREBASE);
    const emu = window.PARKPULSE_FIREBASE.emulateurs; if (emu) { this.fb.database().useEmulator(...emu.db); this.fb.auth().useEmulator(emu.auth, { disableWarnings: true }); }
  },
  keyOfUser(u) { const m = /^fp-([0-9a-f]{40})@/.exec((u && u.email) || ''); return m ? m[1] : null; },
  async start() {
    await this.loadSdk();
    await new Promise(ok => { const off = this.fb.auth().onAuthStateChanged(u => { off(); this.user = u; ok(); }); });
    if (!this.user) return;
    const key = this.keyOfUser(this.user);
    // Session ouverte sur cet appareil : on verifie que le code est toujours valable.
    let id = null;
    try { id = key ? await this.readBoot(key) : null; } catch (e) { id = safeLS.get(SESSION_KEY); }
    if (!id) { await this.fb.auth().signOut(); this.user = null; return; }
    this.userId = id;
    await this.attach();
  },
  // Lecture publique d'une seule cle (jamais de la liste) : savoir si un code
  // existe avant de creer quoi que ce soit.
  async readBoot(key) {
    let r;
    try { r = await fetch(restUrl(`${BOOT}/${key}`), { cache: 'no-store' }); }
    catch (e) { throw new LoginError('offline', 'Pas de connexion internet.'); }
    if (!r.ok) throw new LoginError('server', 'Serveur indisponible (' + r.status + ').');
    const v = await r.json();
    // Multi-salles : { org, uid } ; la société de la personne est fixée ici.
    if (MULTI && v && typeof v === 'object' && v.org && v.uid) { ORG = v.org; this.privilegie = !!v.privilegie; return v.uid; }
    return typeof v === 'string' ? v : null;
  },
  async codeLogin(email, code) {
    if (!navigator.onLine) throw new LoginError('offline', 'Pas de connexion internet.');
    let key = await bootKeyOf(email, code);
    let id = await this.readBoot(key);
    // E-mail différent de celui du compte : le code seul retrouve la clé.
    if (!id) {
      const via = await this.readBoot(await codeKeyOf(code));
      if (via && /^[0-9a-f]{40}$/.test(via)) { const id2 = await this.readBoot(via); if (id2) { key = via; id = id2; } }
    }
    if (!id) throw new LoginError('bad', 'Code incorrect. Vérifiez le code reçu par e-mail (FP-XXXX-XXXX-XXXX), sans confondre les lettres et les chiffres. Code perdu : votre manager vous en génère un nouveau en un clic.');
    const auth = this.fb.auth(), mail = 'fp-' + key + AUTH_DOMAIN_FP, pass = normCode(code);
    try { await auth.signInWithEmailAndPassword(mail, pass); }
    catch (e) {
      if (e.code === 'auth/network-request-failed') throw new LoginError('offline', 'Pas de connexion internet.');
      if (e.code === 'auth/too-many-requests') throw new LoginError('server', 'Trop d’essais : patientez une minute.');
      // Premiere connexion avec ce code : le compte technique n'existe pas encore.
      try { await auth.createUserWithEmailAndPassword(mail, pass); }
      catch (e2) {
        if (e2.code === 'auth/network-request-failed') throw new LoginError('offline', 'Pas de connexion internet.');
        throw new LoginError('server', 'Connexion refusée (' + (e2.code || e.code || 'inconnu') + ').');
      }
    }
    this.user = auth.currentUser; this.userId = id; safeLS.set(SESSION_KEY, id);
    await this.attach();
    return id;
  },
  async attach() {
    if (this.root) this.root.off();
    this.denied = false;
    if (MULTI) {
      if (!ORG) throw new LoginError('bad', 'Espace introuvable.');
      // Double authentification impossible (serveur injoignable, code refusé…) : on ne reste jamais connecté sans données.
      try { await this.mfaGate(); } catch (e) { await this.fb.auth().signOut(); this.user = null; throw new LoginError('server', 'Double authentification : ' + (e.message || e)); }
      await this.listenSide(false);
    }
    this.root = this.fb.database().ref(ROOT());
    let slow = null;
    // Démarrage hors ligne : la dernière copie connue de la base s'affiche, l'écoute reprend au retour du réseau.
    const cached = !navigator.onLine ? await idbGet('pulse').catch(() => null) : null;
    await new Promise((ok, ko) => {
      let first = true;
      if (cached) { S = normalizeState(cached); REV++; first = false; this.offlineStart = true; ok(); }
      // reseau tres lent ou bloque : on ne laisse pas tourner le bouton sans fin
      slow = setTimeout(() => { if (first) { first = false; this.root.off(); ko(new LoginError('offline', 'La base ne répond pas : vérifiez votre connexion internet puis réessayez.')); } }, 25000);
      this.root.on('value', snap => {
        const before = S;
        S = snap.val() ? normalizeState(snap.val()) : null;
        sideApply(S);
        REV++;
        snapSave(snap.val());
        if (first) { first = false; ok(); setTimeout(outboxReplay, 1000); } else { detectLive(before, S); if (ME && S && S.users[ME.id]) ME = S.users[ME.id]; listeners.forEach(f => f()); }
      }, () => { this.denied = true; if (first) { first = false; ok(); } else { toast('Votre accès a été retiré.'); logout(); } });
    }).finally(() => clearTimeout(slow));
    if (this.denied && MULTI && !this.privilegie) { this.privilegie = true; return this.attach(); } // promu manager depuis : double authentification
    if (this.denied) { await this.fb.auth().signOut(); this.user = null; throw new LoginError('bad', 'Accès refusé : ce code n’est plus valable.'); }
    await this.listenSide(true);
  },
  // Collections rangées hors de la racine (voir sidePaths) : écoutées à part. Les
  // collections sans rôle requis (clubs en multi-salles) sont chargées AVANT les
  // données, pour que le premier écran ait déjà ses clubs.
  async listenSide(avecRole) {
    if (!avecRole) { this.sideRefs.forEach(r => r.off()); this.sideRefs = []; }
    const me = avecRole ? S && S.users[this.userId] : null; if (avecRole && !me) return;
    const waits = [];
    for (const [k, root] of Object.entries(sidePaths())) {
      if (!!SIDE_ROLE[k] !== avecRole) continue;
      if (SIDE_ROLE[k] && me.role !== SIDE_ROLE[k]) continue;
      const ref = this.fb.database().ref(root); this.sideRefs.push(ref);
      waits.push(new Promise(ok => { let first = true; ref.on('value', snap => { SIDE_CACHE[k] = snap.val() || {}; if (S) { sideApply(S); REV++; if (!first) listeners.forEach(f => f()); } if (first) { first = false; ok(); } }, () => { if (first) { first = false; ok(); } }); }));
    }
    await Promise.all(waits);
  },
  // Double authentification (multi-salles) : managers et créateurs passent le code TOTP
  // avant d'ouvrir les données ; la vérification est faite côté serveur (club/cloud),
  // les règles de la base refusent tout accès sinon.
  async mfaGate() { if (typeof totpGate === 'function') await totpGate(this); },
  sideRefs: [],
  // Reserve le compte technique des la creation du code (mot de passe = code) :
  // connaitre la cle ne suffit donc jamais, il faut le code. Passe par l'API
  // REST : la session du manager n'est pas touchee.
  async precreate(key, code) {
    try {
      await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${window.PARKPULSE_FIREBASE.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'fp-' + key + AUTH_DOMAIN_FP, password: normCode(code), returnSecureToken: false }) });
    } catch (e) { /* hors ligne : le compte sera cree a la premiere connexion */ }
  },
  // Cles de connexion : ecrites a part (hors /pulse), en une seule fois.
  setBoot(map) { const up = {}; for (const [k, v] of Object.entries(map)) if (/^[0-9a-f]{40}$/.test(k)) up[BOOT + '/' + k] = MULTI && typeof v === 'string' && !/^[0-9a-f]{40}$/.test(v) ? { org: ORG, uid: v, ...(S && S.users[v] && S.users[v].role !== 'membre' ? { privilegie: true } : {}) } : v; if (Object.keys(up).length) return this.fb.database().ref().update(up).catch(e => toast('Code non enregistré : ' + e.message)); },
  queueMail(d) { return this.fb.database().ref(MULTI ? `orgs_mail/${ORG}` : 'fitpulse_mail').push({ ...d, at: this.fb.database.ServerValue.TIMESTAMP }); },
  async signOut() { if (this.root) this.root.off(); this.root = null; this.sideRefs.forEach(r => r.off()); this.sideRefs = []; for (const k of Object.keys(SIDE_CACHE)) delete SIDE_CACHE[k]; if (window.indexedDB) idbSet('pulse', null).catch(() => null); this.userId = null; await this.fb.auth().signOut(); this.user = null; },
  write(path, value) { if (sidePaths()[path[0]]) { this.sideWrite([[path, value]]); return; } const up = fbClean([[path, value]]); outboxPush(up); this.fb.database().ref(ROOT()).update(up).then(() => outboxDone(up), e => writeFail(e)); },
  sideWrite(ops) { const by = {}; ops.forEach(([p, v]) => { (by[p[0]] = by[p[0]] || []).push([p.slice(1), v]); }); for (const [k, list] of Object.entries(by)) { const whole = list.find(([p]) => !p.length); const ref = this.fb.database().ref(sidePaths()[k]); (whole ? ref.set(fbVal(whole[1])) : ref.update(fbClean(list))).catch(e => writeFail(e)); } },
  replaceAll() { const st = { ...S }; Object.keys(sidePaths()).forEach(k => { delete st[k]; }); this.fb.database().ref(ROOT()).set(st); if (MULTI && S && S.clubs) this.fb.database().ref(sidePaths().clubs).update(fbVal(S.clubs) || {}); },
  wipe() { this.fb.database().ref(ROOT()).set(null); },
};
localBackend.setBoot = () => {};
localBackend.precreate = async () => {};

const backend = window.PARKPULSE_FIREBASE ? firebaseBackend : localBackend;
// En ligne, ces collections vivent hors de /pulse (que tout membre peut lire) :
// leur nœud a ses propres règles. En local, elles restent dans S comme le reste.
const sidePaths = () => MULTI ? { clubs: `orgs/${ORG}/clubs`, info: `orgs/${ORG}/info`, product: `orgs_product/${ORG}`, benchmark: 'benchmark' } : { product: 'pulse_product', benchmark: 'benchmark' };
const SIDE_ROLE = { product: 'createur' }; // lecture réservée à ce rôle (sinon : tout membre)
const SIDE_CACHE = {};
function sideApply(st) { if (!st) return; for (const k of Object.keys(sidePaths())) { if (SIDE_CACHE[k] === undefined) continue; st[k] = JSON.parse(JSON.stringify(SIDE_CACHE[k])); if (k === 'product' && typeof productFill === 'function') productFill(st); } }
// File d'écritures gardée sur l'appareil tant que la base n'a pas confirmé : une saisie faite
// hors ligne survit à un rechargement et repart au retour du réseau.
// Copie locale de la base (IndexedDB) pour démarrer sans réseau.
function idbOpen() { return new Promise((ok, ko) => { const r = indexedDB.open('fitpulse', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }); }
async function idbGet(k) { const d = await idbOpen(); return new Promise((ok, ko) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => ok(q.result || null); q.onerror = () => ko(q.error); }); }
async function idbSet(k, v) { const d = await idbOpen(); return new Promise((ok, ko) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => ok(); t.onerror = () => ko(t.error); }); }
const snapSave = (() => { let t = null; return v => { clearTimeout(t); t = setTimeout(() => { if (v && window.indexedDB) idbSet('pulse', v).catch(() => null); }, 3000); }; })();
const OUTBOX_KEY = 'fitpulse.outbox';
const outboxRead = () => { try { return JSON.parse(safeLS.get(OUTBOX_KEY) || '[]'); } catch (_) { return []; } };
const outboxSig = up => Object.keys(up).sort().join('|') + '#' + JSON.stringify(Object.keys(up).sort().map(k => up[k])).length;
function outboxPush(up) { if (navigator.onLine) return; const L = outboxRead(); L.push({ sig: outboxSig(up), up, at: Date.now() }); safeLS.set(OUTBOX_KEY, JSON.stringify(L.slice(-500))); if (typeof renderOffline === 'function') renderOffline(); }
function outboxDone(up) { const L = outboxRead(); if (!L.length) return; const sig = outboxSig(up); const i = L.findIndex(x => x.sig === sig); if (i >= 0) { L.splice(i, 1); safeLS.set(OUTBOX_KEY, JSON.stringify(L)); if (typeof renderOffline === 'function') renderOffline(); } }
function outboxReplay() { if (backend.mode !== 'firebase' || !backend.fb || !navigator.onLine) return; const L = outboxRead(); if (!L.length) return; L.reduce((pr, x) => pr.then(() => backend.fb.database().ref(ROOT()).update(x.up).then(() => outboxDone(x.up))), Promise.resolve()).catch(writeFail); }
function writeFail(e, path) {
  WRITE_FAILS.n++; WRITE_FAILS.last = { msg: (e && e.message) || 'erreur inconnue', path: path || '', at: Date.now() };
  clearTimeout(writeFail.t); writeFail.t = setTimeout(() => { toast(`Écriture refusée${WRITE_FAILS.n > 1 ? ' (' + WRITE_FAILS.n + ' valeurs)' : ''} : ${WRITE_FAILS.last.msg}`); if (typeof render === 'function') render(); }, 300);
  if (typeof logError === 'function') logError('write', e);
}
const WRITE_FAILS = { n: 0, last: null };
// Firebase refuse tout le lot pour une seule valeur undefined ou NaN, une clé
// interdite, ou deux chemins dont l'un contient l'autre : on nettoie avant l'envoi.
function fbVal(v) {
  if (v === undefined || (typeof v === 'number' && !Number.isFinite(v))) return null;
  if (Array.isArray(v)) return v.map(x => { const y = fbVal(x); return y === undefined ? null : y; });
  if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) { const y = fbVal(x); if (y !== null && y !== undefined) o[String(k).replace(/[.#$/\[\]]/g, ',') || '_'] = y; } return Object.keys(o).length ? o : null; }
  return v;
}
function fbClean(ops) {
  const all = {};
  for (const [p, v] of ops) { const k = p.map(s => String(s ?? '_').replace(/[.#$/\[\]]/g, ',') || '_').join('/'); delete all[k]; all[k] = fbVal(v); }
  // chemin ancêtre d'un autre : l'enfant est fusionné dans la valeur du parent
  const order = Object.keys(all); const pos = {}; order.forEach((k, i) => { pos[k] = i; });
  const keys = order.slice().sort();
  for (const k of keys) {
    const parts = k.split('/');
    for (let i = 1; i < parts.length; i++) {
      const a = parts.slice(0, i).join('/'); if (!(a in all)) continue;
      if (pos[k] < pos[a]) { delete all[k]; break; } // le parent, écrit après, remplace l'enfant
      let o = all[a]; if (o === null || typeof o !== 'object') { all[a] = o = {}; }
      const rest = parts.slice(i); for (let j = 0; j < rest.length - 1; j++) { if (!o[rest[j]] || typeof o[rest[j]] !== 'object') o[rest[j]] = {}; o = o[rest[j]]; }
      if (all[k] === null) delete o[rest[rest.length - 1]]; else o[rest[rest.length - 1]] = all[k];
      delete all[k]; break;
    }
  }
  return all;
}
addEventListener('online', () => setTimeout(outboxReplay, 1500));

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
    else {
      const SP = sidePaths(); const side = ops.filter(([p]) => SP[p[0]]); if (side.length) { backend.sideWrite(side); ops = ops.filter(([p]) => !SP[p[0]]); }
      // Lots de 500 chemins au plus, envoyés l'un après l'autre (un import de 50 000 lignes passe).
      const all = fbClean(ops); const keys = Object.keys(all);
      const chunks = []; for (let i = 0; i < keys.length; i += 500) { const up = {}; keys.slice(i, i + 500).forEach(k => { up[k] = all[k]; }); chunks.push(up); }
      chunks.forEach(outboxPush);
      // Un lot refusé n'arrête plus les suivants ; il est rejoué par petits morceaux pour isoler la valeur fautive.
      const send = up => backend.fb.database().ref(ROOT()).update(up).then(() => outboxDone(up));
      const retry = (up, e) => { outboxDone(up); const ks = Object.keys(up); if (ks.length <= 1) { writeFail(e, ks[0]); return null; } const h = Math.ceil(ks.length / 2); return Promise.all([ks.slice(0, h), ks.slice(h)].map(part => { const u = {}; part.forEach(k => { u[k] = up[k]; }); return Promise.resolve().then(() => backend.fb.database().ref(ROOT()).update(u)).catch(e2 => retry(u, e2)); })); };
      chunks.reduce((pr, up) => pr.then(() => Promise.resolve().then(() => send(up)).catch(e => retry(up, e))), Promise.resolve());
    }
    listeners.forEach(f => f());
  },
  replace(state) { S = normalizeState(state); REV++; backend.replaceAll(); listeners.forEach(f => f()); },
  onChange(f) { listeners.add(f); },
};

// Complete les collections absentes (Firebase n'enregistre pas les objets vides).
const BIRTH_FIX = new Set(); // fiches dont l'année de naissance reste à effacer en base
function normalizeState(st) {
  // Minimisation : la date de naissance ne garde que le jour et le mois (MM-JJ).
  if (st && st.clients) for (const c of Object.values(st.clients)) if (c && typeof c.birth === 'string' && c.birth.length > 5) { c.birth = c.birth.slice(-5); if (c.id) BIRTH_FIX.add(c.id); }
  // Anciens KPI : le champ emoji (texte libre) devient un nom d'icone controle.
  if (st.kpis) for (const k of Object.values(st.kpis)) if (k && k.emoji !== undefined) { if (!k.icon) k.icon = KPI_ICON[k.id] || 'target'; delete k.emoji; }
  const base = emptyState();
  for (const k of Object.keys(base)) if (st[k] == null) st[k] = base[k];
  if (typeof productFill === 'function') productFill(st);
  if (!st.tasks.library) st.tasks.library = defaultLibrary();
  if (!st.tasks.plan) st.tasks.plan = {};
  if (!st.tasks.done) st.tasks.done = {};
  for (const k of Object.keys(DEFAULT_KPIS)) if (!st.kpis[k]) st.kpis[k] = { ...DEFAULT_KPIS[k], enabled: false };
  // Libellés par défaut renommés (nouvelle identité) : repris par identifiant, un libellé personnalisé est gardé.
  if (st.kpis.invites && / > /.test(st.kpis.invites.label || '')) st.kpis.invites.label = TXT.kpi.invites;
  const lib = st.tasks.library || {}; if (lib.t1 && /^Check /.test(lib.t1.label || '')) lib.t1.label = TXT.taches.passage;
  Object.values(lib).forEach(t => { if (t && /avis Wiz/i.test(t.label || '')) t.label = TXT.taches.avis; });
  // PSO : « membre » virtuel qui porte les ventes et prospects venus du web ou
  // de l'application, non attribués à un commercial. Jamais enregistré en base,
  // jamais invité ni doté d'un code. Recalculé à chaque chargement.
  const clubIds = Object.keys(st.clubs || {});
  st.users.pso = { ...(st.users.pso || {}), id: 'pso', first: 'PSO', last: '', role: 'membre', status: 'active', virtual: true, clubs: clubIds, avatar: null, createdAt: 0 };
  return st;
}

// Bandeau des saisies en cours : une saisie d'un collegue arrive pendant qu'on travaille.
function detectLive(before, after) {
  if (!before || !after || !ME) return;
  // saisies des collègues, résiliations, sprints, paliers : voir notifs.js
  if (typeof notifLive === 'function') try { notifLive(before, after); } catch (e) { console.warn(e); }
}

// ── Donnees de demonstration ───────────────────────────────────────────────
// Noms fictifs. Trois mois d'historique, objectifs, clients, imports, chat.
function demoState() {
  const st = emptyState();
  const R = rng(20261005);
  const pick = a => a[Math.floor(R() * a.length)];
  st.clubs = {
    centre: { id: 'centre', name: 'Club Centre', address: '1 place du Marché', city: 'Démoville', createdAt: Date.now() },
    littoral: { id: 'littoral', name: 'Club Littoral', address: '12 quai des Pêcheurs', city: 'Démoville-Plage', createdAt: Date.now() },
  };
  const people = [
    ['u1', 'Camille', 'Roux', 'manager', ['centre', 'littoral'], 'f1'],
    ['u2', 'Hugo', 'Lefèvre', 'manager', ['centre'], 'h1'],
    ['u3', 'Inès', 'Moreau', 'membre', ['centre'], 'f2'],
    ['u4', 'Lucas', 'Petit', 'membre', ['centre'], 'h2'],
    ['u5', 'Sarah', 'Garnier', 'membre', ['centre'], 'f1'],
    ['u6', 'Nathan', 'Faure', 'membre', ['littoral'], 'h1'],
    ['u7', 'Léa', 'Bonnet', 'membre', ['littoral'], 'f2'],
  ];
  people.forEach(([id, first, last, role, clubs, avatar], i) => {
    st.users[id] = { id, first, last, role, clubs, avatar, status: 'active', email: `${norm(first)}.${norm(last)}@exemple.fr`.replace(/ /g, ''), createdAt: Date.now() - (200 - i) * 86400000 };
  });
  st.users.u8 = { id: 'u8', first: 'Tom', last: 'Girard', role: 'membre', clubs: ['centre'], avatar: 'h2', status: 'archived', archivedAt: addDays(today(), -60), email: 'tom.girard@exemple.fr', createdAt: Date.now() - 300 * 86400000 };

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
  st.imports.imp1 = { id: 'imp1', name: 'export-ventes-abonnements.csv', type: 'kpi', clubId: 'centre', at: Date.now() - 6 * 86400000, rows: 3, from: `${addMonths(cm, -1)}-01`, to: `${addMonths(cm, -1)}-${daysIn(addMonths(cm, -1))}`, active: true, by: 'u1' };
  [['u2', 2], ['u3', 1], ['u4', 1]].forEach(([u, v], i) => addE({ userId: u, clubId: 'centre', kpiId: 'b2b', date: `${addMonths(cm, -1)}-${pad(10 + i)}`, value: v, source: 'import', importId: 'imp1' }));

  // Historique mensuel du club (annee N-1 et N) pour la comparaison annuelle.
  const y = Number(cm.slice(0, 4));
  ['centre', 'littoral'].forEach((c, ci) => {
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
    const club = i % 4 === 0 ? 'littoral' : 'centre';
    const birth = `${1975 + Math.floor(R() * 30)}-${cm.slice(5, 7)}-${pad(1 + Math.floor(R() * 28))}`;
    const start = addDays(today(), -Math.floor(R() * 400));
    const end = addDays(today(), Math.floor(R() * 120) - 20);
    const bal = R() < .22 ? Math.round((20 + R() * 180) * 100) / 100 : 0;
    st.clients['c' + i] = { id: 'c' + i, clubId: club, name: `${pick(P)} ${pick(N)}`, phone: `06 ${pad(Math.floor(R() * 99))} ${pad(Math.floor(R() * 99))} ${pad(Math.floor(R() * 99))} ${pad(Math.floor(R() * 99))}`, birth: i % 3 ? birth.slice(5) : null, start, end, balance: bal, offer: pick(['Ultimate', 'Premium', 'Basic', 'Ultimate']) };
  }
  // Quelques relances deja faites
  ['c1', 'c2', 'c5'].forEach((c, i) => { st.loyalty['l' + i] = { id: 'l' + i, clientId: c, type: 'suivi', userId: ['u3', 'u4', 'u2'][i], outcome: i === 1 ? 'noanswer' : 'ok', note: '', at: Date.now() - (i + 1) * 86400000 }; });

  // Résiliations : un circuit en cours (nouvelles, en traitement, sauvée, résiliée)
  [['r1', 'Marc Henry', -4, 9, 'Déménagement', 'nouvelle', null],
   ['r2', 'Julie Perrin', -2, 26, 'Prix', 'traitement', 'u3'],
   ['r3', 'Paul Noël', -9, 4, 'Manque de temps', 'traitement', 'u2'],
   ['r4', 'Sophie Lambert', -1, 30, 'Santé', 'nouvelle', null],
   ['r5', 'Karim Benali', -12, 18, 'Prix', 'sauvee', 'u4'],
   ['r6', 'Claire Fontaine', -15, -2, 'Concurrence', 'resiliee', 'u5']].forEach(([id, client, ago, eff, reason, status, owner]) => {
    const at = Date.now() + ago * 86400000;
    st.resiliations[id] = { id, clubId: 'centre', client, date: addDays(today(), ago), effective: addDays(today(), eff), reason, status, saved: status === 'sauvee', ownerId: owner, userId: owner, at,
      actions: [{ at, by: 'u2', label: 'Demande enregistrée' }, ...(owner ? [{ at: at + 86400000, by: owner, label: status === 'sauvee' ? 'Offre proposée · Suspension' : 'Message laissé', note: status === 'traitement' ? 'Rappeler en fin de semaine' : '' }] : []), ...(status === 'sauvee' ? [{ at: at + 2 * 86400000, by: owner, label: 'Client sauvé' }] : [])] };
    if (status === 'sauvee') st.entries['sv_' + id] = { id: 'sv_' + id, userId: owner, clubId: 'centre', kpiId: 'sauvetage', date: addDays(today(), ago + 2), value: 1, source: 'manual', at: at + 2 * 86400000 };
  });

  st.chat.m1 = { id: 'm1', channel: 'centre', userId: 'u2', text: 'Bravo à toute l’équipe pour le mois dernier. On garde le rythme sur les contrats !', at: Date.now() - 2 * 86400000 };
  st.chat.m2 = { id: 'm2', channel: 'centre', userId: 'u3', text: 'Je m’occupe des relances anniversaires cette semaine.', at: Date.now() - 86400000, parentId: 'm1' };
  st.chat.m3 = { id: 'm3', channel: 'all', userId: 'u1', text: 'Point mensuel des deux clubs vendredi 10h. Venez avec vos chiffres.', at: Date.now() - 5 * 3600000 };

  const libIds = Object.keys(st.tasks.library);
  st.tasks.plan.centre = {};
  [[7, 0], [8, 1], [10, 6], [11, 9], [14, 10], [15, 14], [17, 21], [20, 31]].forEach(([h, t], i) => { const id = 'p' + i; st.tasks.plan.centre[id] = { id, taskId: libIds[t], hour: h }; });

  st.challenges.ch1 = { id: 'ch1', clubId: 'centre', title: 'Sprint nutrition', desc: 'Le plus de ventes nutrition en 48 h (rapporté à l’objectif).', kpiId: 'nutrition', start: Date.now() - 20 * 86400000, end: Date.now() - 18 * 86400000, by: 'u2' };
  // Regularisations d'impayes par canal (comme la liste Incidents de Resamania)
  let rv = 0;
  Object.values(st.entries).filter(e => e.kpiId === 'impayes' && e.clubId === 'centre').forEach(e => { const id = 'v' + (++rv); st.recov[id] = { id, clubId: 'centre', date: e.date, amount: e.value, canal: 'equipe', userId: e.userId, type: 'Prélèvements rejetés', at: e.at }; });
  months.forEach(mk => {
    const days = mk === cm ? Math.max(1, Number(today().slice(8)) - 1) : daysIn(mk);
    [['auto', 34, 42], ['client', 10, 38], ['automatismes', 7, 30], ['tiers', 1, 60]].forEach(([canal, n, avg]) => {
      for (let i = 0; i < Math.round(n * days / daysIn(mk)); i++) { const id = 'v' + (++rv); st.recov[id] = { id, clubId: 'centre', date: `${mk}-${pad(1 + Math.floor(R() * days))}`, amount: Math.round(avg * (0.5 + R()) * 100) / 100, canal, userId: null, type: 'Prélèvements rejetés', at: Date.now() }; }
    });
  });
  // Impayés : quelques dossiers déjà pris en charge
  Object.values(st.clients).filter(c => c.balance > 0).forEach((c, i) => { c.num = String(10000 + i); c.balanceAt = addDays(today(), -3 - i * 4); c.incidents = 1 + (i % 2); if (i % 3 === 1) c.dunning = { status: 'relance', ownerId: ['u3', 'u4', 'u5'].at(i % 3), next: addDays(today(), i % 2 ? 0 : 3), note: i % 2 ? 'CB expirée, rappel prévu' : '' }; if (i % 3 === 2) c.dunning = { status: 'promesse', ownerId: 'u2', next: addDays(today(), 5), note: 'Paiera le 15' }; });
  st.clients.c41 = { ...(st.clients.c41 || { id: 'c41', clubId: 'centre', name: 'Hugo Martin' }), clubId: 'centre', balance: 0, dunning: { status: 'recupere', recoveredAt: addDays(today(), -2), amount: 59.9, canal: 'equipe', by: 'u3' } };
  // Paliers collectifs du mois (prime d'équipe)
  st.paliers = { centre: { [cm]: { contrats: [{ target: 90, reward: 'Prime 50 € chacun' }, { target: 100, reward: 'Prime 100 € chacun' }, { target: 115, reward: 'Prime 150 € + resto d’équipe' }], avis: [{ target: 80, reward: 'Petit-déj d’équipe' }, { target: 100, reward: 'Prime 30 € chacun' }] } } };
  for (let i = 1; i <= 5; i++) { const m = addMonths(cm, -i); st.rsm.controls.centre = st.rsm.controls.centre || {}; (st.rsm.controls.centre.du = st.rsm.controls.centre.du || {})[`${m}-28`] = Math.round((1900 - i * 140 + R() * 300) * 100) / 100; (st.rsm.controls.centre.evo = st.rsm.controls.centre.evo || {})[m] = { gained: Math.round(95 + R() * 40), lost: Math.round(60 + R() * 30) }; }
  for (let i = 1; i <= 5; i++) { const m = addMonths(cm, -i); for (let j = 0; j < 3 + Math.floor(R() * 6); j++) { const id = `rh${i}_${j}`; const status = R() < .35 ? 'sauvee' : 'resiliee'; const date = `${m}-${pad(1 + Math.floor(R() * 26))}`; st.resiliations[id] = { id, clubId: 'centre', client: `${pick(P)} ${pick(N)}`, date, effective: addDays(date, 30), reason: pick(['Prix', 'Déménagement', 'Santé', 'Manque de temps']), status, saved: status === 'sauvee', ownerId: pick(['u2', 'u3', 'u4']), at: dateOf(date).getTime() }; } }
  st.rsm.aliases = { 'c:HLEF': 'u2', 'c:IMOR': 'u3', 'c:LPET': 'u4', 'c:SGAR': 'u5', 'c:CROU': 'u1' };
  st.meta.demo = true;
  // Revenus : prix, numéros, prospects, invités, anciens membres, entreprises.
  const PRIX = { Basic: 24.99, Premium: 29.99, Ultimate: 39.99 };
  [['rc1', 'Marc Henry', 'Basic', 40], ['rc2', 'Julie Perrin', 'Ultimate', 240], ['rc3', 'Paul Noël', 'Premium', 90]].forEach(([id, name, offer, d], i) => { st.clients[id] = { id, clubId: 'centre', num: String(700100 + i), name, offer, price: PRIX[offer], status: 'Client', start: addDays(today(), -300), end: addDays(today(), d), phone: '+3361' + String(4000000 + i * 919).slice(0, 7) }; });
  Object.values(st.recov).forEach((x, i) => { x.incidentDate = addDays(x.date, -[3, 6, 9, 14, 21, 35, 50][i % 7]); });
  const sellers = ['u2', 'u3', 'u4', 'u5', 'u6'];
  Object.values(st.clients).forEach((c, i) => { c.num = String(100200 + i); c.price = PRIX[c.offer] || 29.99; c.status = 'Client'; c.sellerId = sellers[i % sellers.length]; if (c.balance > 0) { c.balanceAt = addDays(today(), -[3, 12, 40, 75][i % 4]); c.oldestIncident = c.balanceAt; } });
  const cl = Object.values(st.clients).filter(c => c.clubId === 'centre');
  for (let i = 0; i < 60; i++) {
    const d = i >= 40 ? addDays(today(), -(2 + (i * 7) % 20)) : addDays(today(), -Math.floor(R() * 95)); const conv = i < 14 ? cl[i] : null; const u = i % 7 === 0 ? 'u1' : sellers[i % sellers.length];
    const [prenom, nom] = conv ? conv.name.split(' ') : [pick(P), pick(N)];
    if (conv) { const s0 = addDays(d, 2 + Math.floor(R() * 25)); conv.start = s0 > today() ? today() : s0; }
    const statut = conv ? 'Visite effectuée' : pick(['Nouveau', 'Contacté', 'Contacté', 'RDV pris', 'Essai', 'Injoignable']);
    st.prospects['p' + i] = { id: 'p' + i, clubId: 'centre', nom, prenom, creeLe: d, commercialId: u, statut, provenance: pick(['Site web', 'Passage', 'Parrainage', 'Réseaux sociaux']), valeur: Math.round(R() * 5), phone: '+3366' + String(1000000 + i * 7919).slice(0, 7), at: Date.now() };
  }
  for (let i = 0; i < 6; i++) { const id = 'g' + i; st.guests[id] = { id, clubId: 'centre', nom: `${pick(P)} ${pick(N)}`, phone: '+3367' + String(2000000 + i * 3571).slice(0, 7), date: addDays(today(), -i * 2), parrainId: i % 2 ? cl[20 + i].id : null, by: sellers[i % 5], at: Date.now() - i * 2 * 864e5 }; }
  for (let i = 0; i < 12; i++) { const id = 'a' + i; st.clients[id] = { id, clubId: 'centre', num: String(900100 + i), name: `${pick(P)} ${pick(N)}`, phone: '+3368' + String(3000000 + i * 4111).slice(0, 7), status: 'Ancien client', endDate: addDays(today(), -(95 + i * 50)), offer: pick(['Basic', 'Premium', 'Ultimate']), price: 0, start: addDays(today(), -(500 + i * 50)) }; st.clients[id].price = PRIX[st.clients[id].offer]; }
  [['co1', 'Mutuelle Atlantique', 'signe', 120, 6], ['co2', 'Hôpital du secteur', 'proposition', 450, 0], ['co3', 'Transports Bréan', 'rdv', 60, 0], ['co4', 'Groupe Vallée Bâtiment', 'a_contacter', 0, 0]].forEach(([id, nom, statut, effectif, n]) => {
    st.companies[id] = { id, clubId: 'centre', nom, statut, effectif: effectif || null, ownerId: 'u3', adherents: n, nums: cl.slice(30, 30 + n).map(c => c.num), signeLe: statut === 'signe' ? addDays(today(), -40) : null, at: Date.now() };
    cl.slice(30, 30 + n).forEach(c => { c.company = nom; });
  });
  cl.slice(0, 10).forEach((c, i) => { if (i % 2 === 0 && c.start <= today()) { const id = 'shop' + i; st.entries[id] = { id, userId: c.sellerId, clubId: 'centre', kpiId: 'nutrition', date: addDays(c.start, i % 4 ? 0 : 9), value: 35, source: 'manual', at: Date.now(), clientNum: c.num }; } });
  return st;
}

// ── Roles et codes d'acces ────────────────────────────────────────────────
// createur : tout (clubs, KPI et points, roles, sauvegarde, remise a zero).
// manager  : les clubs ou il est rattache (equipe, objectifs, imports, taches, defis).
// membre   : ses saisies, son tableau de bord, classement, retention, chat, pouls du club.
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
  const c = 'FP-' + [0, 1, 2].map(g => [0, 1, 2, 3].map(i => A[r[g * 4 + i] % A.length]).join('')).join('-');
  return c.startsWith('FP-FP') ? randomCode() : c; // normCode retire un « FP » de tete
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
    ops.push([['users', a.id], { id: a.id, first: a.first, last: a.last, email: a.email, role: a.role, clubs: allClubs, avatar: 'h1', status: 'active', salt: a.salt, codeHash: a.codeHash, ...(a.bootKey ? { bootKey: a.bootKey } : {}), createdAt: Date.now() }]);
    if (a.email) ops.push([['team', a.email.toLowerCase().replace(/\./g, ',')], true]);
  }
  return ops;
}
