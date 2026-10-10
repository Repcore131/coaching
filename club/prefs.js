/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
'use strict';
// ══ FIT PULSE : préférences de compte, version 2 ═════════════════════════
// Tout ce qui concerne le compte vit dans S.prefs[userId] (base de l'équipe,
// donc suivi d'un appareil à l'autre). Le navigateur ne garde qu'un cache du
// thème pour l'écran de connexion. Modèle :
//   v: 2
//   home: { cards: [...], hidden: [...] }          cartes de l'accueil, dans l'ordre
//   kpiOrder: { <clubId>: [kpiId, ...] }           ordre de MES indicateurs, par club
//   feed: { types: { sale: true, ... }, kpis: { <kpiId>: false }, scope: 'club' | 'all', muteUntil: 0 }
//   seen: { feed, chat, home, rank, wrap: { 'AAAA-MM': true } }
//   sense: { haptics, sound, motion: 'auto' | 'reduced' }
//   theme: 'auto' | 'dark' | 'light'
//   goal: { week: 'AAAA-Snn', kpiId, target } | null
//   notif: { liveBanner, quietFrom, quietTo, maxPerDay, sunday, rules: { <type>: false }, digest }
//   tips: { drag }
// Les autres clés à plat (onboarded, dashSort, kmLast, profil…) restent lisibles par pref().
const PREFS_V = 2;
const FIL_TYPES = ['sale', 'import', 'trophy', 'palier', 'save', 'recovered', 'challenge', 'kudos', 'manager'];
const prefsDefaut = () => ({
  v: PREFS_V,
  home: { cards: null, hidden: [] }, // null : accueil conseillé selon le rôle (voir HOME_CARDS)
  kpiOrder: {},
  feed: { types: Object.fromEntries(FIL_TYPES.map(t => [t, true])), kpis: {}, scope: 'club', muteUntil: 0 },
  seen: { feed: 0, chat: 0, home: 0, rank: null, wrap: {} },
  sense: { haptics: true, sound: false, motion: 'auto' },
  theme: 'auto',
  goal: null,
  notif: { liveBanner: true, quietFrom: '20:30', quietTo: '08:00', maxPerDay: 6, sunday: true, rules: {}, digest: true },
  tips: { drag: true },
});
const estObjet = x => x && typeof x === 'object' && !Array.isArray(x);
function fusionPrefs(base, brut) {
  if (!estObjet(brut)) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(brut)) out[k] = estObjet(base[k]) && estObjet(v) ? fusionPrefs(base[k], v) : v;
  return out;
}
// L'objet complet : valeurs par défaut + ce que le compte a choisi.
function prefsOf(userId = ME && ME.id) { return fusionPrefs(prefsDefaut(), ((S && S.prefs) || {})[userId] || {}); }
// Sans compte connecté (écriture différée après une déconnexion) : rien n'est écrit.
const setPrefPath = (path, value) => ME && db.set(['prefs', ME.id, ...(Array.isArray(path) ? path : String(path).split('.'))], value === undefined ? null : value);

// ── Migration de l'ancien format (clés à plat), une seule fois ────────────
// Quand v est absent. Idempotente : relancée, elle ne trouve plus rien.
const THEME_CACHE = 'fitpulse.theme';
function migrationPrefsOps(userId, clubId, themeLocal) {
  const p = ((S && S.prefs) || {})[userId] || {};
  if (p.v >= PREFS_V) return [];
  const base = ['prefs', userId]; const ops = [];
  const set = (path, v) => { if (v !== undefined && v !== null) ops.push([[...base, ...path], v]); };
  const drop = k => { if (p[k] !== undefined && !estObjet(prefsDefaut()[k])) ops.push([[...base, k], null]); };
  if (Array.isArray(p.kpiOrder)) { ops.push([[...base, 'kpiOrder'], clubId ? { [clubId]: p.kpiOrder } : {}]); }
  if (p.feedSeen !== undefined) { set(['seen', 'feed'], Number(p.feedSeen) || 0); drop('feedSeen'); }
  if (p.chatSeen !== undefined) { set(['seen', 'chat'], Number(p.chatSeen) || 0); drop('chatSeen'); }
  // Ancien bloc notif { rules, quiet: { from, to, sunday }, max } : remis à plat dans notif.
  const n = estObjet(p.notif) ? p.notif : {};
  if (n.quiet || n.max !== undefined) {
    const q = n.quiet || {};
    ops.push([[...base, 'notif'], { rules: n.rules || {}, quietFrom: q.from || '20:30', quietTo: q.to || '08:00', sunday: q.sunday !== false, maxPerDay: Number(n.max) || 6, liveBanner: p.liveBanner !== false, digest: p.digest !== false }]);
  } else {
    if (p.liveBanner !== undefined) set(['notif', 'liveBanner'], p.liveBanner !== false);
    if (p.digest !== undefined) set(['notif', 'digest'], p.digest !== false);
  }
  drop('liveBanner'); drop('digest');
  if (p.tipDrag !== undefined) { set(['tips', 'drag'], p.tipDrag !== false); drop('tipDrag'); }
  if (p.vibrate !== undefined) { set(['sense', 'haptics'], p.vibrate !== false); drop('vibrate'); }
  if (p.theme === undefined && ['dark', 'light'].includes(themeLocal)) set(['theme'], themeLocal);
  ops.push([[...base, 'v'], PREFS_V]);
  return ops;
}
function migrerPrefs() {
  if (!ME || !S) return false;
  const loc = safeLS.get(THEME_CACHE); // l'ancienne clé locale est déjà recopiée sous ce nom au démarrage (voir safeLS)
  const ops = migrationPrefsOps(ME.id, CLUB && CLUB.id, loc);
  if (!ops.length) return false;
  db.batch(ops); return true;
}

// ── Thème et animations : appliqués depuis le compte ──────────────────────
let PREFS_APPLIQUE = '';
function appliquerTheme(t) {
  if (t === 'dark' || t === 'light') { document.documentElement.dataset.theme = t; safeLS.set(THEME_CACHE, t); }
  else { delete document.documentElement.dataset.theme; safeLS.del(THEME_CACHE); }
}
function appliquerSens(P) {
  if (P.sense.motion === 'reduced') document.documentElement.dataset.motion = 'reduced'; else delete document.documentElement.dataset.motion;
}
// Appelé à chaque rendu une fois connecté : migre une fois, puis suit le compte
// (un thème choisi sur un autre appareil s'applique dès la synchronisation).
function prefsSync() {
  if (!ME || !S) return;
  if (migrerPrefs()) return;
  const P = prefsOf(); const cle = `${ME.id}|${P.theme}|${P.sense.motion}`;
  if (cle === PREFS_APPLIQUE) return; PREFS_APPLIQUE = cle;
  if (!CFG.capture) appliquerTheme(P.theme);
  appliquerSens(P);
  if (typeof themeFor === 'function' && CLUB) try { themeFor(CLUB); } catch (_) { /* accent recalculé au prochain rendu */ }
}
function choisirTheme(t) { appliquerTheme(t); if (ME && S) { setPrefPath(['theme'], t === 'dark' || t === 'light' ? t : 'auto'); PREFS_APPLIQUE = ''; } render(); }

// Retours sensoriels : voir fx.js (vibrer, bip et fx).

// ── Profil > Mon compte : carte « Mon appli » ─────────────────────────────
function monAppliCard() {
  const P = prefsOf(); const t = P.theme;
  const choix = (act, cle, val, label, on) => `<button class="btn sm ${on ? 'primary' : ''}" data-act="${act}" data-k="${cle}" data-v="${val}" aria-pressed="${on}">${label}</button>`;
  const inter = (cle, label, detail, on) => `<label class="row"><input type="checkbox" data-change="senseSet" data-k="${cle}" ${on ? 'checked' : ''}><span class="spacer">${label}<small class="muted">${detail}</small></span></label>`;
  return `<div class="card" id="mon-appli"><h3>Mon appli</h3><p class="muted small" style="margin-top:-4px">Réglages de votre compte : ils vous suivent sur tous vos appareils.</p>
    <div class="field"><span>Thème</span><div class="row wrap" style="gap:6px">${[['auto', 'Automatique'], ['dark', 'Sombre'], ['light', 'Clair']].map(([k, l]) => choix('themeSet', 'theme', k, l, t === k)).join('')}</div></div>
    <div class="nt-rules" style="margin-top:10px">${inter('haptics', 'Vibrations', 'Une vibration courte à chaque saisie et au début d’un déplacement.', P.sense.haptics)}${inter('sound', 'Sons', 'Un bip discret à chaque saisie.', P.sense.sound)}${inter('motion', 'Animations réduites', 'Moins de mouvements à l’écran.', P.sense.motion === 'reduced')}</div>
    <div class="form-grid" style="margin-top:10px"><label class="field"><span>Heures calmes : de</span><input class="input" type="time" value="${esc(P.notif.quietFrom)}" data-change="calmeSet" data-k="quietFrom"></label><label class="field"><span>à</span><input class="input" type="time" value="${esc(P.notif.quietTo)}" data-change="calmeSet" data-k="quietTo"></label></div>
    <p class="muted small" style="margin:6px 0 0">Aucune alerte pendant les heures calmes.</p>${typeof mascotteChoix === 'function' ? mascotteChoix() : ''}</div>`;
}
ACTIONS.themeSet = el => choisirTheme(el.dataset.v || el.dataset.t);
ACTIONS.senseSet = el => { const k = el.dataset.k; setPrefPath(['sense', k], k === 'motion' ? (el.checked ? 'reduced' : 'auto') : el.checked); PREFS_APPLIQUE = ''; };
ACTIONS.calmeSet = el => { if (/^\d\d:\d\d$/.test(el.value)) setPrefPath(['notif', el.dataset.k], el.value); };
