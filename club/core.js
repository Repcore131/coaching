/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — socle : outils, stockage, donnees de depart ══════════════
//
// Toutes les donnees tiennent dans un seul objet S, range par collections
// (objets indexes par identifiant, jamais de tableaux : une ecriture vise
// toujours un chemin precis, ce qui marche pareil en local et sur Firebase).
// Rien ne sort de nos clubs : il n'existe ni reseau, ni classement inter-
// enseignes, ni fil partage avec l'exterieur.

// Configuration du déploiement (config.js). Repli sur les anciens noms window.PARKPULSE_* pour une installation existante.
const CFG = window.FITPULSE_CONFIG || { firebase: window.PARKPULSE_FIREBASE, club: window.PARKPULSE_CLUB, assets: window.PARKPULSE_ASSETS, demo: window.PARKPULSE_DEMO, mailAuto: window.PARKPULSE_MAIL_AUTO };
CFG.assets = CFG.assets || {};
const APP = { name: TXT.app.nom, tagline: TXT.app.accroche, version: '2026.10.10' };
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
// Montant au centime (historique des acomptes : « 50,00 € »).
const fmtEc = n => nf2.format(Math.round((n || 0) * 100) / 100) + ' €';
const fmtV = (v, unit) => unit === 'eur' ? fmtE(v) : fmtN(v);
// Valeur et unité d'un KPI : « 30 contrats », « 1 avis », « 1 240 € ». Unité des KPI créés à la main : k.nom = [singulier, pluriel].
const KPI_NOMS = { avis: ['avis', 'avis'], contrats: ['contrat', 'contrats'], b2b: ['contrat B2B', 'contrats B2B'], invites: ['invité', 'invités'], sauvetage: ['sauvetage', 'sauvetages'], prospects: ['prospect', 'prospects'] };
function uniteKpi(k, v) { const n = (k && (k.nom || KPI_NOMS[k.id])) || ['unité', 'unités']; return Math.abs(Math.round(v || 0)) >= 2 ? n[1] : n[0]; }
const fmtU = (v, k) => { const kk = typeof k === 'string' ? S && S.kpis && S.kpis[k] : k; return kk && kk.unit === 'eur' ? fmtE(v) : `${fmtN(v)} ${uniteKpi(kk, v)}`; };
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
// Minuit à Paris d'une date AAAA-MM-JJ, en millisecondes (heure d'été comprise), quel que soit le fuseau de l'appareil.
function minuitParis(iso) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso || '')) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number); const u = Date.UTC(y, m - 1, d, 12);
  let off = 1; try { const t = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', timeZoneName: 'shortOffset' }).formatToParts(new Date(u)).find(p => p.type === 'timeZoneName').value; const k = /GMT([+-]\d+)/.exec(t); if (k) off = Number(k[1]); } catch (e) { /* repli : heure d'hiver */ }
  return Date.UTC(y, m - 1, d) - off * 3600000;
}
const deepGet = (o, path) => path.reduce((a, k) => a == null ? a : a[k], o);

// Generateur pseudo-aleatoire a graine : la demo est la meme a chaque fois.
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ── Icones (trait, 24x24) ─────────────────────────────────────────────────
const ICONS = {
  // Navigation (planche de référence assets/brand/icons-sheet.png) : trait 2, extrémités arrondies.
  home: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  target: '<circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="4"/><path d="M11 13l8.5-8.5M16 4.5V8h3.5"/>',
  ranking: '<rect x="3" y="13" width="5" height="8" rx="1.5"/><rect x="9.5" y="8" width="5" height="13" rx="1.5"/><rect x="16" y="3" width="5" height="18" rx="1.5"/>',
  callback: '<path d="M5.5 3.5h2.8l1.4 3.8-2 1.4a10.5 10.5 0 0 0 4.6 4.6l1.4-2 3.8 1.4v2.8a2 2 0 0 1-2 2A14.5 14.5 0 0 1 3.5 5.5a2 2 0 0 1 2-2z"/><path d="M14.5 3a6.5 6.5 0 0 1 6.2 5"/><path d="M18.4 7.4l2.3.9.8-2.3"/>',
  door: '<path d="M4 3.5l8.5 1.5v15.5L4 19z"/><path d="M12.5 5h5v14.5h-5"/><path d="M7.5 12h2"/>',
  coinsback: '<path d="M19.5 10A8.5 8.5 0 1 0 11 20.5"/><path d="M14 8.6a3.5 3.5 0 1 0 0 5.8"/><path d="M7.5 10.6h5M7.5 12.6h5"/><path d="M21 21a3 3 0 0 0-3-3h-3.5"/><path d="M16.5 16l-2 2 2 2"/>',
  magnet: '<path d="M5 4h4.5v7.5a2.5 2.5 0 0 0 5 0V4H19v7.5a7 7 0 0 1-14 0z"/><path d="M5 8h4.5M14.5 8H19"/>',
  import: '<path d="M12 3v10M8 9.5l4 4 4-4"/><path d="M3.5 14.5l1.8-3.5M20.5 14.5l-1.8-3.5"/><path d="M3.5 14.5h17V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20.5a6.5 6.5 0 0 1 13 0z"/><circle cx="17" cy="9.5" r="2.5"/><path d="M15.5 20.5h6a4.5 4.5 0 0 0-5.6-4.4"/>',
  chat: '<path d="M5.5 4h13A2.5 2.5 0 0 1 21 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-5 4v-4h-.5A2.5 2.5 0 0 1 3 14.5v-8A2.5 2.5 0 0 1 5.5 4z"/>',
  flag: '<path d="M5 21V3.5"/><path d="M5 4.5c3-2 6 2 9 0s4.5-1 5.5-.5v9c-1-.5-2.5-1.5-5.5.5s-6-2-9 0"/>',
  report: '<path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M15 3v4h4"/><path d="M8.5 16.5l3-3 2 1.5 3-3.5"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  pouls: '<path d="M2 12h4l2-5 4 10 3-7 2 2h5"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
  // Applaudissements stylisés (réaction Bravo) : deux mains au trait et trois traits d'élan.
  clap: '<path d="M8.5 10.5 6.2 8.2a1.3 1.3 0 0 0-1.9 1.9l4.6 4.6"/><path d="m10.6 8.4-2.3-2.3a1.3 1.3 0 0 0-1.9 1.9l4.2 4.2"/><path d="m12.7 6.3-1.4-1.4a1.3 1.3 0 0 0-1.9 1.9l4 4"/><path d="m13.4 9.3.9-2.6a1.4 1.4 0 0 1 2.7.6l-.5 3.4a6 6 0 0 1-1.7 3.4l-1.6 1.6a5 5 0 0 1-7.1 0l-2.2-2.2"/><path d="M15 2.5v2M18.5 3.5l-1.2 1.6M20.5 6.5l-1.8.6"/>',
  mail: '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="m22 6-10 7L2 6"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  chevU: '<path d="m18 15-6-6-6 6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
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
  crown: '<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
  medal: '<path d="M8 3h8l-2 6h-4z"/><circle cx="12" cy="15" r="6"/><path d="m12 12 1 2h2l-1.6 1.3.6 2.2-2-1.3-2 1.3.6-2.2L9 14h2z"/>',
  cake: '<path d="M4 21V12h16v9M2 21h20M4 16c2 1.5 4 1.5 6 0s4-1.5 6 0 3 1 4 0M12 12V8M12 5.5v.5"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  bank: '<path d="m3 9 9-6 9 6M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 21h18"/>',
  flame: '<path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-4-9-1 2-2 3-3 3 0-2-1-4-3-6-.5 4-4 7-4 12a7 7 0 0 0 7 7z"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  calcheck: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>',
};
// Icone d'un KPI : par son id (KPI par defaut), sinon le nom d'icone choisi,
// sinon une cible. Jamais de texte libre injecte dans la page.
const KPI_ICON = { avis: 'star', nutrition: 'cup', contrats: 'pen', accessoires: 'cap', impayes: 'coins', b2b: 'briefcase', invites: 'ticket', sauvetage: 'lifebuoy', prospects: 'magnet' };
const kpiIconName = k => (k && ICONS[k.icon]) ? k.icon : (k && KPI_ICON[k.id]) || 'target';
const kpiIcon = (k, cls = 'ico') => ico(kpiIconName(k), cls);
// Reactions : les cles historiques restent (pas de perte), l'affichage passe
// en icones. Toute autre cle est ignoree (jamais injectee dans la page).
// Réactions du fil et du chat : Bravo, Fort, Merci, avec une icône au trait. Les anciennes clés
// (pictogrammes, puis Vu et Question) sont relues sous la nouvelle au chargement : aucun compteur perdu.
// Applaudissements : Bravo ; feu et biceps : Fort ; pouce, Vu et Question : Merci.
const REACTIONS = { bravo: ['clap', 'Bravo'], fort: ['bolt', 'Fort'], merci: ['heart', 'Merci'] };
const REACT_MIGR = { '\u{1F44F}': 'bravo', '\u{1F525}': 'fort', '\u{1F4AA}': 'fort', '\u{1F44D}': 'merci', vu: 'merci', question: 'merci' };
// rx : { cle: { uid: heure } } (nouvelles et anciennes clés mêlées) -> { bravo: [uid…], fort: [uid…], merci: [uid…] }
function reactionsDe(rx) { const o = Object.fromEntries(Object.keys(REACTIONS).map(k => [k, new Set()])); for (const [k, w] of Object.entries(rx || {})) { const n = REACTIONS[k] ? k : REACT_MIGR[k]; if (n) Object.keys(w || {}).filter(id => w[id]).forEach(id => o[n].add(id)); } return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...v]])); }
// Bascule de ma réaction : écrit la nouvelle clé et efface les anciennes clés équivalentes.
// La valeur d'une réaction est son heure (fil d'équipe, dernière visite) ; les anciennes valent true.
function reactOps(base, rx, cle) { const mine = reactionsDe(rx)[cle].includes(ME.id); const ops = [[[...base, cle, ME.id], mine ? null : Date.now()]]; for (const [old, n] of Object.entries(REACT_MIGR)) if (n === cle && deepGet(rx || {}, [old, ME.id])) ops.push([[...base, old, ME.id], null]); return ops; }
const reactBtns = (act, id, rx, cls = '') => { const R = reactionsDe(rx); return Object.entries(REACTIONS).map(([k, [ic, l]]) => `<button class="${cls} ${R[k].includes(ME.id) ? 'on' : ''}" data-act="${act}" data-id="${id}" data-em="${k}" aria-pressed="${R[k].includes(ME.id)}" title="${esc(`${l} : ${R[k].map(u => (S.users[u] || { first: '?' }).first).join(', ') || 'personne pour l’instant'}`)}" data-noms="${esc(`${l} : ${R[k].map(u => (S.users[u] || { first: '?' }).first).join(', ') || 'personne pour l’instant'}`)}">${ico(ic, 'ico ico-xs')} ${l}${R[k].length ? ` <span class="num">${R[k].length}</span>` : ''}</button>`).join(''); };
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

// Niveaux individuels gagnés par mois à 100 % (voir zoneOf dans calc.js).
const ZONES = TXT.zones.liste;
const LEVELS = ZONES;

// État initial de la base. emptyState() sans argument y renvoie ; art.js redéfinit emptyState
// pour les états vides de l'interface (avec un argument).
function emptyState() { return etatInitial(); }
function etatInitial() {
  const st = {
    meta: { version: 1, createdAt: Date.now() },
    clubs: {}, users: {}, kpis: JSON.parse(JSON.stringify(DEFAULT_KPIS)),
    targets: {}, entries: {}, imports: {}, monthly: {}, base: {},
    clients: {}, loyalty: {}, resiliations: {}, challenges: {}, chat: {}, reactions: {}, celebrated: {},
    recov: {}, rsm: { aliases: {}, controls: {}, routine: {} }, paliers: {},
    tasks: { library: defaultLibrary(), plan: {}, done: {} },
    prefs: {}, team: {}, audit: {}, absences: {}, touches: {}, relances: {}, prospects: {}, guests: {}, companies: {}, opps: {}, templates: {}, relanceCfg: {}, offers: {}, coaching: {}, alertAcks: {}, wrapNotes: {}, targetPlans: {}, product: {}, resRequests: {}, resRequestsMeta: {}, private: {}, tarifs: {}, transferts: {}, roiCfg: {}, leagues: {}, leagueMember: {}, duels: {}, kudos: {}, comments: {}, ingestConfig: {}, scriptsReseau: {}, billing: {}, benchmark: {}, settings: {}, recapNotes: {}, usage: {}, tenant: {},
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
const LOCAL_KEY = 'fitpulse.v1';
const SESSION_KEY = 'fitpulse.session';
const listeners = new Set();
const safeLS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* rien */ } },
};
// Repli : les clés locales d'une installation existante (préfixe historique « parkpulse. »)
// sont lues une fois et recopiées sous « fitpulse. » : club choisi, thème, session et préférences restent.
(function migrerClesLocales() {
  try {
    if (CFG.demo || localStorage.getItem('fitpulse.migre')) return; // la démonstration ne touche pas aux clés réelles
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('parkpulse.')) { const n = 'fitpulse.' + k.slice(10); if (localStorage.getItem(n) == null) localStorage.setItem(n, localStorage.getItem(k)); } }
    localStorage.setItem('fitpulse.migre', '1');
  } catch (e) { /* stockage indisponible */ }
})();

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
// ── Mode multi-salles (FITPULSE_CONFIG.firebase.multi) ─────────────────────────
// Chaque société cliente a son espace : /orgs/{org}/info (abonnement, statut,
// sécurité), /orgs/{org}/clubs/{club}, et toutes les collections sous
// /orgs/{org}/data/… ; les clés de connexion sont dans /orgs_boot/{clé} =
// { org, uid }. Sans ce réglage, l'appli reste sur /pulse (base historique).
const MULTI = !!(CFG.firebase && CFG.firebase.multi);
let ORG = null;
const ROOT = () => MULTI ? `orgs/${ORG}/data` : 'pulse';
const BOOT = MULTI ? 'orgs_boot' : 'pulse_boot';
// Lecture REST d'un chemin public (clé de connexion, invitation), simulateur compris.
function restUrl(chemin) {
  const F = CFG.firebase || {}; const e = F.emulateurs;
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
    this.fb = window.firebase; this.fb.initializeApp(CFG.firebase);
    const emu = CFG.firebase.emulateurs; if (emu) { this.fb.database().useEmulator(...emu.db); this.fb.auth().useEmulator(emu.auth, { disableWarnings: true }); }
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
        SYNC.ok = Date.now();
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
      if (SIDE_SANS_ECOUTE.has(k) || !!SIDE_ROLE[k] !== avecRole) continue;
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
      await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${CFG.firebase.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'fp-' + key + AUTH_DOMAIN_FP, password: normCode(code), returnSecureToken: false }) });
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

const backend = CFG.firebase ? firebaseBackend : localBackend;
// En ligne, ces collections vivent hors de /pulse (que tout membre peut lire) :
// leur nœud a ses propres règles. En local, elles restent dans S comme le reste.
const sidePaths = () => MULTI ? { clubs: `orgs/${ORG}/clubs`, info: `orgs/${ORG}/info`, product: `orgs_product/${ORG}`, benchmark: 'benchmark', private: `orgs_private/${ORG}` } : { product: 'pulse_product', benchmark: 'benchmark', private: 'private' };
// Données privées (e-mail, téléphone des dossiers de résiliation) : jamais écoutées en bloc, lues dossier par dossier.
const SIDE_SANS_ECOUTE = new Set(['private']);
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
// Dernière synchronisation réussie avec la base partagée (lecture reçue ou écriture confirmée).
const SYNC = { ok: null };
function outboxDone(up) { SYNC.ok = Date.now(); const L = outboxRead(); if (!L.length) return; const sig = outboxSig(up); const i = L.findIndex(x => x.sig === sig); if (i >= 0) { L.splice(i, 1); safeLS.set(OUTBOX_KEY, JSON.stringify(L)); if (typeof renderOffline === 'function') renderOffline(); } }
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
  // Marque blanche : le club historique (niort) sans thème garde son nom, son jaune et son logo d'avant.
  const ni = st.clubs && st.clubs.niort; if (ni && !ni.theme) ni.theme = { displayName: ni.name || null, accent: '#FFD600', logo: ni.logo || (CFG.assets || {}).logo || null };
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
// ── Démo vendeur : « Club Horizon », Valmont (club fictif, aucune enseigne) ──
// Générateur à graine fixe : deux chargements le même jour donnent exactement
// les mêmes chiffres (aucun Date.now(), aucun Math.random()). Dates calculées
// depuis aujourd'hui pour que la démo reste vivante. Moins de 3 Mo sérialisée.
//  - Directeur Démo (manager), 1 manager, 6 commerciaux (rythmes 1,15 à 0,55 ;
//    le dernier est arrivé il y a 20 jours) ;
//  - 2 000 clients (1 600 actifs, 400 anciens), offres à 24,90, 32,90, 39,90 € ;
//  - 13 mois de saisies (janvier et septembre +35 %, août -25 %) ;
//  - 8 dossiers de résiliation (scénario de la relève des e-mails), 78 impayés (4 tranches d'ancienneté, 6 promesses).
const DEMO_GRAINE = 20261101;
const DEMO_CLUB = { id: 'horizon', name: 'Club Horizon', address: '12 avenue des Tilleuls', city: 'Valmont' };
const DEMO_OFFRES = [['Essentiel', 24.9, 0.30], ['Confort', 32.9, 0.45], ['Intégral', 39.9, 0.25]];
function demoState() {
  const st = emptyState(); const R = rng(DEMO_GRAINE);
  const pick = a => a[Math.floor(R() * a.length)]; const t = today(); const cm = curMonth(); const C = DEMO_CLUB.id;
  const ts = (iso, h = 10, m = 0) => dateOf(iso).getTime() + h * 3600000 + m * 60000; // horodatage déterministe
  const T0 = ts(t, 9);
  st.meta.demo = true; st.meta.demoSeed = DEMO_GRAINE; st.meta.createdAt = ts(addDays(t, -3 * 365));
  st.clubs[C] = { ...DEMO_CLUB, createdAt: ts(addDays(t, -3 * 365)), openDays: [1, 2, 3, 4, 5, 6] };
  st.tenant = { name: DEMO_CLUB.name, brand: null, logo: null, colors: null, entity: 'SAS Horizon Sport', panierMoyen: null, legal: { societe: 'SAS Horizon Sport', club: DEMO_CLUB.name, etablissement: `${DEMO_CLUB.address}, ${DEMO_CLUB.city}`, email: 'contact@example.com' } };
  st.settings = { panierMoyen: 32 };
  // ── Équipe ──
  const EQUIPE = [
    ['u1', 'Directeur', 'Démo', 'manager', 'h1', null, 900], ['u2', 'Julie', 'Bernard', 'manager', 'f1', null, 700],
    ['u3', 'Thomas', 'Petit', 'membre', 'h2', 1.15, 820], ['u4', 'Sarah', 'Leroy', 'membre', 'f2', 1.0, 640], ['u5', 'Nicolas', 'Morel', 'membre', 'h1', 0.95, 520],
    ['u6', 'Laura', 'Girard', 'membre', 'f1', 0.85, 410], ['u7', 'Maxime', 'Faure', 'membre', 'h2', 0.7, 300], ['u8', 'Camille', 'Roussel', 'membre', 'f2', 0.55, 20],
  ];
  const rythme = {}; const arrivee = {};
  EQUIPE.forEach(([id, first, last, role, avatar, sk, depuis]) => {
    st.users[id] = { id, first, last, role, clubs: [C], avatar, status: 'active', email: `${norm(first)}.${norm(last)}@example.com`, createdAt: ts(addDays(t, -depuis)) };
    if (sk) { rythme[id] = sk; arrivee[id] = addDays(t, -depuis); }
  });
  const vendeurs = Object.keys(rythme);
  // ── Objectifs et saisies : 13 mois, saisonnalité ──
  const SAISON = m => m === 1 || m === 9 ? 1.35 : m === 8 ? 0.75 : 1;
  const CIBLES = { contrats: 20, avis: 18, nutrition: 300, accessoires: 150, impayes: 220, prospects: 40, sauvetage: 2, invites: 3, b2b: 1 };
  let ne = 0;
  for (let i = 12; i >= 0; i--) {
    const mk = addMonths(cm, -i); const f = SAISON(Number(mk.slice(5))); const fin = mk === cm ? addDays(t, -1) : `${mk}-${pad(daysIn(mk))}`;
    const ouvres = joursOuvres(mk + '-01', `${mk}-${pad(daysIn(mk))}`); st.targets[mk] = {};
    vendeurs.forEach(uid => {
      const debut = arrivee[uid] > mk + '-01' ? arrivee[uid] : mk + '-01'; if (debut > `${mk}-${pad(daysIn(mk))}`) return;
      const prorata = joursOuvres(debut, `${mk}-${pad(daysIn(mk))}`) / ouvres;
      st.targets[mk][uid] = Object.fromEntries(Object.entries(CIBLES).map(([k, v]) => [k, S_arrondi(v * prorata, st.kpis[k].unit)]));
      for (let d = debut; d <= fin; d = addDays(d, 1)) {
        if (!estOuvre(d)) continue;
        Object.entries(CIBLES).forEach(([k, v]) => {
          const moyen = v / ouvres * rythme[uid] * f * (0.55 + R() * 0.9); let val;
          if (st.kpis[k].unit === 'qty') { val = Math.floor(moyen) + (R() < moyen % 1 ? 1 : 0); if (!val) return; } else { if (R() < 0.4) return; val = Math.round(moyen / 0.6 * 100) / 100; }
          const id = 'e' + (++ne); st.entries[id] = { id, userId: uid, clubId: C, kpiId: k, date: d, value: val, source: 'manual', at: ts(d, 10 + (ne % 8), ne % 60) };
        });
      }
    });
  }
  // ── 2 000 clients : 1 600 actifs, 400 anciens ──
  const P = ['Emma', 'Louis', 'Chloé', 'Jules', 'Manon', 'Arthur', 'Zoé', 'Gabriel', 'Lina', 'Raphaël', 'Jade', 'Adam', 'Alice', 'Léo', 'Rose', 'Noah', 'Anna', 'Paul', 'Mila', 'Ethan', 'Nina', 'Hugo', 'Inès', 'Lucas', 'Léna', 'Nathan', 'Eva', 'Tom', 'Clara', 'Théo'];
  const N = ['Martin', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Durand', 'Lefebvre', 'Simon', 'Laurent', 'Michel', 'Garcia', 'David', 'Bertrand', 'Fontaine', 'Fournier', 'Mercier', 'Blanc', 'Guérin', 'Muller', 'Lemoine', 'Chevalier', 'Lambert', 'Bonnet', 'François', 'Dupont', 'Rousseau', 'Vincent', 'Muller', 'Lefèvre', 'Andre'];
  const offre = () => { const x = R(); let a = 0; for (const o of DEMO_OFFRES) { a += o[2]; if (x < a) return o; } return DEMO_OFFRES[1]; };
  const clients = [];
  for (let i = 0; i < 2000; i++) {
    const id = 'c' + (i + 1); const pr = pick(P), nm = pick(N); const [of, prix] = offre(); const actif = i < 1600;
    const start = addDays(t, -(actif ? 1 + Math.floor(R() * 3 * 365) : 400 + Math.floor(R() * 700)));
    const engage = R() < 0.8; let end = null;
    if (actif && engage) { end = start; while (end <= t) end = addMonths(end.slice(0, 7), 12) + end.slice(7); if (end.slice(8) > pad(daysIn(end.slice(0, 7)))) end = end.slice(0, 8) + pad(daysIn(end.slice(0, 7))); }
    const c = { id, clubId: C, num: String(310000 + i), name: `${pr} ${nm}`, phone: `06 39 98 ${pad(Math.floor(i / 100))} ${pad(i % 100)}`, email: `${norm(pr)}.${norm(nm)}@example.com`.replace(/ /g, ''),
      offer: of, price: prix, status: actif ? 'Client' : 'Ancien client', start, sellerId: vendeurs[i % vendeurs.length], birth: `${pad(1 + Math.floor(R() * 12))}-${pad(1 + Math.floor(R() * 28))}` };
    if (end) c.end = end;
    if (!actif) { c.endDate = addDays(t, -(30 + Math.floor(R() * 900))); c.end = c.endDate; }
    st.clients[id] = c; clients.push(c);
  }
  const actifs = clients.slice(0, 1600);
  // ── Résiliations : scénario de la relève des e-mails, 8 dossiers fictifs (noms « Exemple », téléphones 06 00 00 00 0X) ──
  // 3 en attente de réponse (2 h, 9 h, 27 h : en retard), 1 à vérifier, 2 en cours, 1 sauvée (preuve Resamania),
  // 1 résiliée avec confirmation envoyée. Horodatages calés sur 9 h ; recalés sur l'heure réelle au chargement (demoRecaler).
  const Hm = 3600000; const lien = '#demo';
  const mailDe = (at, o = {}) => ({ threadId: 'demo-' + at, link: lien, subject: 'Résiliation de mon abonnement', firstInAt: at, lastInAt: at, inCount: 1, outCount: 0, firstReplyAt: null, lastOutAt: null, awaitingReply: true, kind: 'adherent', score: 7, ...o });
  const dossier = (id, o) => { const at = o.receivedAt; st.resiliations[id] = { id, clubId: C, date: isoOf(new Date(at)), status: 'nouvelle', saved: false, ownerId: null, userId: null, type: 'resiliation', at, dueAt: at + 24 * Hm, actions: [{ at, by: 'system', label: o.mail ? 'Demande reçue par e-mail' : 'Demande enregistrée' }], ...o }; };
  const prive = (id, phone, email) => { st.private.resiliations = st.private.resiliations || {}; (st.private.resiliations[C] = st.private.resiliations[C] || {})[id] = { ...(phone ? { phone } : {}), ...(email ? { email } : {}) }; };
  dossier('r1', { client: 'Camille Exemple', reason: 'Déménagement', source: 'mail', receivedAt: T0 - 2 * Hm, effective: addDays(t, 40), mail: mailDe(T0 - 2 * Hm, { subject: 'Résiliation suite à mon déménagement' }) }); prive('r1', '06 00 00 00 01', 'camille.exemple@example.com');
  dossier('r2', { client: 'Hugo Exemple', reason: 'Prix', source: 'mail', receivedAt: T0 - 9 * Hm, mail: mailDe(T0 - 9 * Hm, { subject: 'Demande de résiliation' }), ownerId: 'u3', userId: 'u3' }); prive('r2', '06 00 00 00 02', 'hugo.exemple@example.com');
  dossier('r3', { client: 'Léa Exemple', reason: 'Manque de temps', source: 'mail', receivedAt: T0 - 27 * Hm, effective: addDays(t, 20), mail: mailDe(T0 - 27 * Hm, { subject: 'Arrêter mon abonnement' }) }); prive('r3', null, 'lea.exemple@example.com');
  dossier('r4', { client: 'Nadia Exemple', reason: 'Autre', source: 'mail', status: 'averifier', receivedAt: T0 - 5 * Hm, mail: mailDe(T0 - 5 * Hm, { subject: 'Question sur mon contrat', score: 2 }), actions: [{ at: T0 - 5 * Hm, by: 'system', label: 'Message à vérifier reçu par e-mail' }] });
  dossier('r5', { client: 'Paul Exemple', reason: 'Santé', source: 'appli', channel: 'Appli adhérents', receivedAt: T0 - 50 * Hm, effective: addDays(t, 12), rsm: { state: 'accepted', at: T0 - 26 * Hm }, ownerId: 'u4', userId: 'u4', status: 'traitement',
    log: { o1: { at: T0 - 20 * Hm, by: 'u4', label: 'Offre proposée : Suspension', offer: 'Suspension', out: 'offer' } } }); prive('r5', '06 00 00 00 05');
  dossier('r6', { client: 'Inès Exemple', reason: 'Concurrence', source: 'resamania', receivedAt: T0 - 72 * Hm, effective: addDays(t, 25), rsm: { state: 'submitted', at: T0 - 70 * Hm }, ownerId: 'u5', userId: 'u5', status: 'traitement',
    log: { o1: { at: T0 - 24 * Hm, by: 'u5', label: 'Réponse envoyée par e-mail' } } }); prive('r6', '06 00 00 00 06');
  dossier('r7', { client: 'Marc Exemple', reason: 'Prix', source: 'mail', receivedAt: T0 - 96 * Hm, mail: mailDe(T0 - 96 * Hm, { awaitingReply: false, firstReplyAt: T0 - 93 * Hm, lastOutAt: T0 - 93 * Hm, outCount: 1 }), rsm: { state: 'canceled', at: T0 - 20 * Hm }, ownerId: 'u3', userId: 'u3',
    status: 'sauvee', saved: true, outcome: 'sauvee', closedAt: T0 - 20 * Hm, closedBy: 'resamania', closedReason: 'resamania', valeur: 395,
    log: { o1: { at: T0 - 70 * Hm, by: 'u3', label: 'Offre proposée : Changement de formule', offer: 'Changement de formule', out: 'offer' }, o2: { at: T0 - 20 * Hm, by: 'system', label: 'Sauvetage confirmé par Resamania' } } });
  st.entries.sv_r7 = { id: 'sv_r7', userId: 'u3', clubId: C, kpiId: 'sauvetage', date: isoOf(new Date(T0 - 20 * Hm)), value: 1, source: 'manual', at: T0 - 20 * Hm, proof: 'resamania', offer: 'Changement de formule' };
  dossier('r8', { client: 'Sophie Exemple', reason: 'Déménagement', source: 'mail', receivedAt: T0 - 120 * Hm, effective: addDays(t, -1), mail: mailDe(T0 - 120 * Hm, { awaitingReply: false, firstReplyAt: T0 - 117 * Hm, lastOutAt: T0 - 70 * Hm, outCount: 2 }), ownerId: 'u4', userId: 'u4',
    status: 'resiliee', outcome: 'resiliee', validatedAt: T0 - 96 * Hm, closedAt: T0 - 96 * Hm, closedBy: 'u4', closedReason: 'fitpulse', dateFin: addDays(t, -1),
    log: { o1: { at: T0 - 96 * Hm, by: 'u4', label: 'Résiliation validée, confirmation à envoyer' } } });
  st.meta.demoT0 = T0;
  st.clubs[C].mailSync = { at: T0 - 12 * 60000, ok: true, scanned: 12, found: 4, error: null };
  // historique : 12 mois de demandes sauvées et résiliées
  for (let i = 1; i <= 12; i++) {
    const mk = addMonths(cm, -i);
    for (let j = 0; j < 6; j++) {
      const c = actifs[300 + i * 13 + j]; const date = `${mk}-${pad(2 + j * 4)}`; const status = j % 3 === 0 ? 'sauvee' : 'resiliee'; const owner = vendeurs[(i + j) % vendeurs.length];
      const id = `rh${i}_${j}`; st.resiliations[id] = { id, clubId: C, client: c.name, clientId: c.id, num: c.num, date, effective: addDays(date, 30), reason: pick(['Prix', 'Déménagement', 'Santé', 'Manque de temps', 'Concurrence']), status, saved: status === 'sauvee', ownerId: owner, userId: owner, at: ts(date), valeur: Math.round(c.price * (6 + j)) };
      if (status === 'sauvee') st.entries['sv_' + id] = { id: 'sv_' + id, userId: owner, clubId: C, kpiId: 'sauvetage', date: addDays(date, 2), value: 1, source: 'manual', at: ts(addDays(date, 2)) };
    }
  }
  // ── 78 impayés (environ 3 400 €), 4 tranches d'ancienneté, 6 promesses ──
  const TRANCHES = [[30, 2, 15], [20, 16, 30], [16, 31, 60], [12, 61, 140]]; let ni = 0;
  TRANCHES.forEach(([n, de, a]) => { for (let k = 0; k < n; k++) {
    const c = actifs[700 + ni * 7]; const age = de + Math.floor(R() * (a - de + 1)); const at = addDays(t, -age);
    c.balance = Math.round(c.price * (1 + (ni % 3 === 0 ? 1 : 0)) * 100) / 100 + (ni % 5 === 0 ? 4.5 : 0); c.balanceAt = at; c.oldestIncident = at; c.incidents = 1 + (ni % 3);
    if (ni < 6) c.dunning = { status: 'promesse', ownerId: vendeurs[ni % vendeurs.length], promiseDate: addDays(t, ni % 2 ? 2 : -1), next: addDays(t, ni % 2 ? 2 : -1), note: 'Règlement promis', history: [{ at: ts(addDays(t, -2)), by: vendeurs[ni % vendeurs.length], label: 'Prise en charge' }] };
    else if (ni % 4 === 1) c.dunning = { status: 'relance', ownerId: vendeurs[ni % vendeurs.length], next: addDays(t, ni % 3), note: '' };
    ni++;
  } });
  // ── Impayés régularisés (liste Incidents) : 13 mois, par canal ──
  let nv = 0;
  for (let i = 12; i >= 0; i--) {
    const mk = addMonths(cm, -i); const jours = mk === cm ? Math.max(1, Number(t.slice(8)) - 1) : daysIn(mk);
    [['equipe', 14, 45], ['auto', 30, 40], ['client', 9, 36], ['automatismes', 6, 30]].forEach(([canal, n, moy]) => {
      for (let k = 0; k < Math.round(n * jours / daysIn(mk)); k++) {
        const id = 'v' + (++nv); const date = `${mk}-${pad(1 + Math.floor(R() * jours))}`; const c = actifs[1200 + (nv % 380)];
        st.recov[id] = { id, clubId: C, date, incidentDate: addDays(date, -(3 + nv % 25)), amount: Math.round(moy * (0.6 + R() * 0.8) * 100) / 100, canal, userId: canal === 'equipe' ? vendeurs[nv % vendeurs.length] : null, clientNum: c.num, type: 'Prélèvements rejetés', at: ts(date) };
      }
    });
  }
  // ── Relances notées récentes ──
  for (let i = 0; i < 40; i++) { const c = actifs[900 + i * 3]; const d = addDays(t, -(i % 12)); st.loyalty['l' + i] = { id: 'l' + i, clientId: c.id, type: i % 3 ? 'suivi' : 'renouvellement', step: i % 2 ? 15 : 30, userId: vendeurs[i % vendeurs.length], outcome: ['ok', 'noanswer', 'rdv', 'message'][i % 4], note: '', at: ts(d, 11, i) }; }
  // ── Base, chiffres mensuels, imports et contrôles ──
  st.base[C] = {}; st.monthly[C] = {};
  for (let i = 12; i >= 0; i--) { const mk = addMonths(cm, -i); st.base[C][mk] = { actifs: 1560 + (12 - i) * 4, sortants: 52 + (i % 4) * 3, objectif: 1620 }; }
  const semaine = ts(weekStart(t), 9);
  ['ventes', 'clients', 'clients-incident', 'incidents', 'paiements', 'abonnements', 'sans-mandat'].forEach((d, i) => { st.rsm.routine[C] = st.rsm.routine[C] || {}; st.rsm.routine[C][d] = semaine + i * 600000; });
  st.rsm.rowsHistory = st.rsm.rowsHistory || {}; st.rsm.rowsHistory[C] = { clients: [{ at: semaine - 7 * 864e5, rows: 1596 }, { at: semaine, rows: 1600 }], ventes: [{ at: semaine - 7 * 864e5, rows: 92 }, { at: semaine, rows: 96 }] };
  st.rsm.nonRattaches = { [C]: { at: semaine, n: 0 } };
  st.imports.imp1 = { id: 'imp1', name: 'RSM_ventes-abonnements_semaine.csv', type: 'kpi', defId: 'ventes', clubId: C, at: semaine, rows: 96, active: true, by: 'u1', source: 'resamania' };
  st.imports.imp2 = { id: 'imp2', name: 'RSM_clients.csv', type: 'clients', defId: 'clients', clubId: C, at: semaine + 600000, rows: 1600, active: true, by: 'u1', source: 'resamania' };
  st.rsm.aliases = { 'c:TPET': 'u3', 'c:SLER': 'u4', 'c:NMOR': 'u5', 'c:LGIR': 'u6', 'c:MFAU': 'u7', 'c:CROU': 'u8' };
  // ── Vie d'équipe : paliers, sprints, chat, prospects, entreprises, plan de tâches ──
  st.paliers = { [C]: { [cm]: { contrats: [{ target: 100, reward: 'Prime 50 € chacun' }, { target: 125, reward: 'Prime 100 € chacun' }], avis: [{ target: 90, reward: 'Petit-déjeuner d’équipe' }] } } };
  st.challenges.ch1 = { id: 'ch1', clubId: C, title: 'Sprint contrats', desc: 'Le plus de contrats signés en 48 h, rapporté à l’objectif de chacun.', kpiId: 'contrats', start: T0 - 20 * 3600000, end: T0 + 28 * 3600000, by: 'u1' };
  st.challenges.ch2 = { id: 'ch2', clubId: C, title: 'Semaine nutrition', desc: 'Ventes nutrition sur 72 h, rapportées à l’objectif.', kpiId: 'nutrition', start: T0 - 24 * 864e5, end: T0 - 21 * 864e5, by: 'u2' };
  st.chat.m1 = { id: 'm1', channel: C, userId: 'u1', text: 'Septembre clos à 104 % sur les contrats. Cette semaine : priorité aux résiliations à J-7.', at: T0 - 2 * 864e5 };
  st.chat.m2 = { id: 'm2', channel: C, userId: 'u4', text: 'Je prends les relances J+15 aujourd’hui.', at: T0 - 864e5, parentId: 'm1' };
  st.chat.m3 = { id: 'm3', channel: C, userId: 'u8', text: 'Première semaine : merci pour l’accueil.', at: T0 - 3 * 3600000 };
  for (let i = 0; i < 40; i++) { const d = addDays(t, -(1 + Math.floor(R() * 60))); st.prospects['p' + i] = { id: 'p' + i, clubId: C, nom: pick(N), prenom: pick(P), creeLe: d, commercialId: vendeurs[i % vendeurs.length], statut: pick(['Nouveau', 'Contacté', 'RDV pris', 'Essai', 'Visite effectuée', 'Injoignable']), provenance: pick(['Site web', 'Passage', 'Parrainage', 'Réseaux sociaux']), phone: `06 39 98 ${pad(20 + Math.floor(i / 10))} ${pad(i)}`, at: ts(d) }; }
  [['co1', 'Société Alpha Services', 'signe', 80, 4], ['co2', 'Cabinet Bêta Conseil', 'proposition', 35, 0], ['co3', 'Atelier Gamma', 'rdv', 20, 0]].forEach(([id, nom, statut, effectif, n]) => { st.companies[id] = { id, clubId: C, nom, statut, effectif, ownerId: 'u4', adherents: n, nums: actifs.slice(50, 50 + n).map(c => c.num), signeLe: statut === 'signe' ? addDays(t, -40) : null, at: T0 }; });
  const lib = Object.keys(st.tasks.library); st.tasks.plan[C] = {};
  [[7, 0], [9, 6], [11, 9], [14, 10], [17, 14], [20, 31]].forEach(([h, k], i) => { st.tasks.plan[C]['p' + i] = { id: 'p' + i, taskId: lib[k], hour: h }; });
  return st;
}
const S_arrondi = (v, unit) => unit === 'eur' ? Math.round(v) : Math.max(v > 0 ? 1 : 0, Math.round(v));

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
  const ops = []; const accounts = CFG.accounts || [];
  if (!accounts.length) return ops;
  const club = CFG.club;
  if (club && !S.clubs[club.id]) ops.push([['clubs', club.id], { ...club, createdAt: Date.now() }]);
  const allClubs = [...new Set([...Object.keys(S.clubs), ...(club ? [club.id] : [])])];
  for (const a of accounts) {
    if (S.users[a.id]) continue;
    ops.push([['users', a.id], { id: a.id, first: a.first, last: a.last, email: a.email, role: a.role, clubs: allClubs, avatar: 'h1', status: 'active', salt: a.salt, codeHash: a.codeHash, ...(a.bootKey ? { bootKey: a.bootKey } : {}), createdAt: Date.now() }]);
    if (a.email) ops.push([['team', a.email.toLowerCase().replace(/\./g, ',')], true]);
  }
  return ops;
}
