/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — notifications : cloche, boîte de réception, alertes locales ══
// Tout passe par notify(). La boîte est gardée sur l'appareil (30 jours, 60
// messages). Quand l'appli est ouverte en arrière-plan et que l'utilisateur a
// autorisé les notifications, un message système s'affiche aussi. Un envoi
// téléphone fermé demande un serveur d'envoi : non branché ici.
const NOTIF_RULES = {
  relances_jour: { label: 'Appels du jour, à 10 h', ex: '6 appels à passer aujourd’hui.' },
  res_new: { label: 'Nouvelle résiliation reçue', ex: 'Nouvelle résiliation reçue. Ouvrez Résiliations pour la prendre.' },
  res_j7: { label: 'Résiliation à votre nom à J-7', ex: 'Une résiliation à votre nom prend effet dans 5 jours.' },
  palier: { label: 'Palier d’équipe franchi', ex: 'Palier 2 atteint en Contrats signés pour l’équipe.' },
  live: { label: 'Saisies des collègues en direct', ex: 'Hugo Lefèvre : +1 Contrats signés, Club Centre' },
  alertes: { label: 'Signaux faibles de l’équipe, à 9 h', ex: '2 signaux faibles à regarder.', manager: true },
  digest: { label: 'Bilan de la semaine et brief du matin (7 h 30, managers)', ex: 'Votre bilan de la semaine est prêt.' },
  am_digest: { label: 'Votre journée, à 7 h 45', ex: '3 relances à votre nom aujourd’hui.' },
  pm_digest: { label: TXT.cloture.notif, ex: '4 saisies aujourd’hui. Équipe : 6 contrats.' },
  dun_promise: { label: 'Promesse de paiement non tenue', ex: 'Le paiement promis n’est pas arrivé. Relancez aujourd’hui.' },
  obj_late: { label: 'Objectif en retard (mardi et jeudi)', ex: 'Contrats signés en retard : 4 sur 12. 1 par jour pour finir.' },
  record: { label: 'Record personnel battu', ex: 'Votre meilleur mois en contrats signés : 14.' },
  dun_new: { label: 'Nouveaux impayés après un import', ex: '3 nouveaux dossiers, 180 € au total.', manager: true },
  res_noowner: { label: 'Résiliations sans responsable depuis 24 h', ex: '2 résiliations attendent depuis 24 h.', manager: true },
  anomalie: { label: 'Chiffre à vérifier', ex: 'Une saisie de Nutrition sort de l’ordinaire.', manager: true },
  mgr_silent: { label: 'Commercial sans saisie depuis 2 jours', ex: 'Lucas n’a rien saisi depuis 2 jours.', manager: true },
  rsm: { label: 'Imports Resamania à faire', ex: '4 sur 7 exports faits.', manager: true },
};
// Réglages du compte (prefs.notif, voir prefs.js) : mêmes valeurs pour l'appli et le serveur d'envoi.
const notifPrefs = () => { const n = prefsOf().notif; return { rules: n.rules || {}, quiet: { from: n.quietFrom, to: n.quietTo, sunday: n.sunday !== false }, max: Number(n.maxPerDay) || 6 }; };
const ruleOn = id => { const n = prefsOf().notif; return id === 'live' ? n.liveBanner !== false : id === 'digest' ? n.digest !== false && digestEnvoye() : (n.rules || {})[id] !== false; };
// TODO digest relié au moteur d'alertes : la case n'apparaît que si un envoi existe réellement.
// Bilan de la semaine : envoyé par le serveur d'envoi, seulement si sa messagerie est réglée et qu'il tourne.
const digestEnvoye = () => { const srv = (S && S.serveur) || {}; return !!(srv.mail && srv.at && Date.now() - srv.at < 3 * 3600e3); };
function inQuiet() { const q = notifPrefs().quiet; const d = new Date(); const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`; if (q.sunday && d.getDay() === 0) return true; return q.from > q.to ? (hm >= q.from || hm < q.to) : (hm >= q.from && hm < q.to); }

const inboxKey = () => 'fitpulse.inbox.' + (ME ? ME.id : '');
function inbox() { try { const L = JSON.parse(safeLS.get(inboxKey()) || '[]'); return Array.isArray(L) ? L.filter(x => x && Date.now() - x.at < 30 * 864e5) : []; } catch (_) { return []; } }
const saveInbox = L => safeLS.set(inboxKey(), JSON.stringify(L.slice(0, 50))); // les 50 dernières, même si le push est refusé
const unread = () => inbox().filter(x => !x.readAt).length;

function notify(kind, text, href = '', { title = 'Fit Pulse', key = '', toastIt = true } = {}) {
  if (!ME || !ruleOn(kind)) return;
  // Serveur d'envoi actif : il gère déjà cette alerte (cloche et téléphone), l'appli n'affiche que le message.
  const srv = (S && S.serveur) || {}; if (['relances_jour', 'res_j7', 'digest', 'res_new', 'defi', 'palier'].includes(kind) && srv.at && Date.now() - srv.at < 3600e3) { if (toastIt && !document.hidden && kind !== 'relances_jour' && kind !== 'digest' && kind !== 'res_j7') toast(text); return; }
  const L = inbox(); if (key && L.some(x => x.key === key)) return;
  title = title === 'Fit Pulse' ? (NOTIF_TITLE[kind] || title) : title;
  const id = newId(); L.unshift({ id, key, kind, title, body: String(text).slice(0, 200), url: href, at: Date.now() }); saveInbox(L);
  if (toastIt && !document.hidden) toast(text);
  sysNotify(title, text, href, key || kind);
  bellRefresh();
}
// Message système : seulement appli en arrière-plan, autorisation donnée, hors heures calmes, plafond du jour.
function sysNotify(title, body, url, tag) {
  try {
    if (!document.hidden || !('Notification' in window) || Notification.permission !== 'granted' || inQuiet()) return;
    const dk = 'fitpulse.sys.' + today(); const n = Number(safeLS.get(dk) || 0); if (n >= notifPrefs().max) return; safeLS.set(dk, String(n + 1));
    const opt = { body, tag, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: url || '#/home' } };
    if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(r => r.showNotification(title, opt)); else new Notification(title, opt);
  } catch (_) { /* navigateur sans notifications */ }
}

// ── Cloche (barre du haut) et badge de l'icône ───────────────────────────
function bellBtn() { const n = ME ? unread() : 0; queueMicrotask(appBadge); return `<button class="btn ghost icon bell" id="bell" data-act="bell" aria-label="Notifications${n ? ', ' + n + ' non lues' : ''}">${ico('bell')}${n ? `<i class="bell-n">${n > 99 ? '99+' : n}</i>` : ''}</button>`; }
function bellRefresh() { const b = $('#bell'); if (b) b.outerHTML = bellBtn(); else appBadge(); }
function appBadge() {
  try { if (!ME || !CLUB || !('setAppBadge' in navigator)) return; const t = myToDo(); const n = unread() + t.res.length + t.dun.filter(dunDue).length; n ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } catch (_) { /* badge non pris en charge */ }
}
ACTIONS.bell = () => {
  const L = inbox(); const t = today(), y = addDays(t, -1);
  const day = x => isoOf(new Date(x.at)); const groups = [['Aujourd’hui', L.filter(x => day(x) === t)], ['Hier', L.filter(x => day(x) === y)], ['Plus ancien', L.filter(x => day(x) < y)]];
  const td = myToDo(); const Q = relQueue(CLUB.id, 'mine');
  const todo = [[Q.now.length, 'appel à passer', 'appels à passer', '#/relances'], [td.res.length, 'résiliation à votre nom', 'résiliations à votre nom', '#/resiliations'], [td.dun.filter(dunDue).length, 'impayé à relancer', 'impayés à relancer', '#/impayes']].filter(x => x[0]);
  openModal({ title: 'Notifications', drawer: true, body: `${todo.length ? `<div class="nt-todo">${todo.map(([n, a, b, h]) => `<a href="${h}" data-close>${ico('chevR')}<b>${plur(n, a, b)}</b></a>`).join('')}</div>` : ''}
    ${L.length ? groups.filter(g => g[1].length).map(([l, g]) => `<div class="nt-g">${l}</div>${g.map(x => `<button class="nt-row ${x.readAt ? '' : 'unread'}" data-act="notifOpen" data-id="${esc(x.id)}"><span class="nt-ico">${ico(NOTIF_ICON[x.kind] || 'bell')}</span><span class="spacer"><b>${esc(x.title)}</b><span>${esc(x.body)}</span><small>${ago(x.at)}</small></span>${x.readAt ? '' : '<i class="nt-dot"></i>'}</button>`).join('')}`).join('') : emptyBox({ art: 'chat', title: 'Aucune notification', text: 'Les nouveautés de l’équipe et vos rappels apparaîtront ici.', cta: '<a class="btn sm" href="#/home">Retour à l’accueil</a>' })}`,
    foot: `<button class="btn" data-act="notifAllRead">Tout marquer comme lu</button><a class="btn ghost" href="#/profile" data-close data-act="ui" data-key="profTab" data-val="account">Réglages</a>` });
};
const NOTIF_TITLE = { am_digest: 'Votre journée', pm_digest: TXT.notifs.cloture, dun_promise: 'Promesse non tenue', obj_late: 'Objectif en retard', record: 'Record battu', dun_new: 'Nouvel impayé', res_noowner: 'Dossier sans responsable', anomalie: 'Chiffre à vérifier', mgr_silent: 'Commercial sans saisie', rsm: 'Imports Resamania', relances_jour: 'Appels du jour', res_new: 'Résiliation', res_j7: 'Résiliation à J-7', palier: 'Palier d’équipe', defi: TXT.mots.sprint, live: 'En direct', alertes: 'Signaux faibles', digest: 'Bilan de la semaine' };
const NOTIF_ICON = { dayStart: 'sun', dueFollowup: 'phone', overtaken: 'ranking', challengeStart: 'bolt', kudos: 'sparkle', palierNear: 'flag', dayWrap: 'chart', wrapReady: 'report', info: 'bell', am_digest: 'sun', pm_digest: 'chart', dun_promise: 'coins', obj_late: 'target', record: 'flag', dun_new: 'coins', res_noowner: 'door', anomalie: 'alert', mgr_silent: 'users', rsm: 'upload', relances_jour: 'phone', res_new: 'door', res_j7: 'door', palier: 'flag', defi: 'bolt', live: 'sparkle', alertes: 'alert', digest: 'chart' };
ACTIONS.notifOpen = el => { const L = inbox(); const x = L.find(m => m.id === el.dataset.id); if (!x) return; x.readAt = Date.now(); saveInbox(L); closeModal(); bellRefresh(); if (x.url) location.hash = x.url; };
ACTIONS.notifAllRead = () => { const L = inbox(); L.forEach(x => { x.readAt = x.readAt || Date.now(); }); saveInbox(L); closeModal(); bellRefresh(); };

// ── Rappels calculés sur l'appareil (appli ouverte, même en arrière-plan) ─
function notifTick() {
  try {
    if (!ME || !S || !CLUB || typeof relQueue !== 'function') return;
    const d = new Date(), h = d.getHours(), t = today();
    if (!isWorkday(t, CLUB.id)) return;
    if (h >= 10) { const n = relQueue(CLUB.id, 'mine').now.length; if (n) notify('relances_jour', `${plur(n, 'appel à passer', 'appels à passer')} aujourd’hui.`, '#/relances', { key: 'appels_' + t, toastIt: false }); }
    myToDo().res.filter(resUrgent).forEach(r => { const n = Math.max(0, daysTo(r.effective)); notify('res_j7', n ? `Une résiliation à votre nom prend effet dans ${plur(n, 'jour', 'jours')}.` : 'Une résiliation à votre nom prend effet aujourd’hui.', '#/resiliations', { key: 'res7_' + r.id, toastIt: false }); });
    if (isManager() && h >= 9 && typeof alertsFor === 'function') { const n = alertsFor(CLUB.id).filter(a => a.level !== 'info').length; if (n) notify('alertes', `${plur(n, 'signal faible', 'signaux faibles')} à regarder dans Pilotage équipe.`, '#/team', { key: 'alertes_' + t, toastIt: false }); }
    if (d.getDay() === 1 && h >= 8) notify('digest', 'Votre bilan de la semaine est prêt sur l’accueil.', '#/home', { key: 'digest_' + t, toastIt: false });
  } catch (_) { /* jamais bloquant */ }
}
setInterval(notifTick, 60000); setTimeout(notifTick, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) bellRefresh(); });

// ── Nouveautés de l'équipe (mode partagé, à chaque mise à jour de la base) ─
let PAL_SNAP = null;
function palierSnap() { const mk = curMonth(); const o = {}; Object.keys(paliersFor(CLUB.id, mk)).forEach(k => { const s = palierState(CLUB.id, mk, k); if (s) o[k] = s.reached; }); return o; }
function notifLive(before, after) {
  if (!ME || !CLUB) return;
  const mine = id => (ME.clubs || []).includes(id) || ME.role === 'createur';
  let byMe = false;
  for (const id of Object.keys(after.entries || {})) {
    if (before.entries[id]) continue; const e = after.entries[id];
    if (e.userId === ME.id || e.by === ME.id) { byMe = true; continue; }
    if (e.source !== 'manual' || Date.now() - e.at > 60000 || !mine(e.clubId)) continue;
    const u = after.users[e.userId], k = after.kpis[e.kpiId];
    const txt = u && k ? liveTexte(e) : null; if (txt) notify('live', txt, '#/pouls', { key: 'e_' + id });
  }
  // commentaires sur mes événements du fil
  for (const [cle, L] of Object.entries(after.comments || {})) for (const [id, c] of Object.entries(L || {})) {
    if (deepGet(before, ['comments', cle, id]) || !c || c.to !== ME.id || c.by === ME.id || Date.now() - c.at > 600000 || !after.users[c.by]) continue;
    notify('comment', `${after.users[c.by].first} a commenté : ${String(c.text).slice(0, 80)}`, '#/pouls', { key: 'com_' + id });
  }
  for (const id of Object.keys(after.kudos || {})) {
    if ((before.kudos || {})[id]) continue; const k = after.kudos[id];
    if (k && k.to === ME.id && k.from !== ME.id && Date.now() - k.at < 600000 && after.users[k.from]) notify('kudos', `${after.users[k.from].first} vous félicite : ${(typeof KUDOS_RAISONS === 'object' && KUDOS_RAISONS[k.reason]) || 'bravo'}.`, '#/profile', { key: 'kudos_' + id });
  }
  for (const id of Object.keys(after.resiliations || {})) {
    if ((before.resiliations || {})[id]) continue; const r = after.resiliations[id];
    if (!mine(r.clubId) || r.userId === ME.id || r.by === ME.id || (r.at && Date.now() - r.at > 600000)) continue;
    if (!resOpen(r)) continue; // seules les demandes à arbitrer déclenchent une alerte (pas les acceptées/rejetées déjà classées)
    notify('res_new', 'Nouvelle demande de résiliation à arbitrer. Ouvrez Résiliations pour la traiter.', '#/resiliations', { key: 'resnew_' + id });
  }

  const snap = palierSnap();
  if (PAL_SNAP && !byMe) Object.entries(snap).forEach(([k, n]) => { if (n > (PAL_SNAP[k] || 0) && S.kpis[k]) { notify('palier', `Palier ${n} atteint en ${S.kpis[k].label} pour l’équipe.`, '#/home', { key: `pal_${CLUB.id}_${curMonth()}_${k}_${n}`, toastIt: false }); if (!document.hidden) celebrate(`PALIER ${n} ATTEINT`, `${S.kpis[k].label} pour l’équipe`, { kind: 'team' }); } });
  PAL_SNAP = snap;
}

// ── Activer sur cet appareil, installer l'appli ──────────────────────────
let INSTALL_EVT = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); INSTALL_EVT = e; });
addEventListener('appinstalled', () => { INSTALL_EVT = null; toast('Fit Pulse installée sur 1 appareil'); });
const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
function notifState() { if (!('Notification' in window)) return ['Non prises en charge par ce navigateur', 'off']; return { granted: ['Activées sur cet appareil', 'on'], denied: ['Bloquées dans le navigateur', 'off'], default: ['Désactivées', 'off'] }[Notification.permission]; }
function notifCard() {
  const P = notifPrefs(); const [st] = notifState(); const mgr = isManager();
  return `<div class="card notif-card"><h3>Notifications</h3>
    <div class="row wrap" style="gap:8px;margin:6px 0 12px"><span class="tag ${'Notification' in window && Notification.permission === 'granted' ? 'is-ok' : ''}">${st}</span>${'Notification' in window && Notification.permission === 'default' ? '<button class="btn sm primary" data-act="notifEnable">Activer les alertes sur cet appareil</button>' : ''}</div>
    ${isStandalone() ? '' : INSTALL_EVT ? '<button class="btn sm" data-act="installApp">Installer Fit Pulse</button>' : isIos() ? '<p class="small">Pour recevoir les alertes sur iPhone : touchez Partager, puis Sur l’écran d’accueil, puis ouvrez Fit Pulse depuis l’icône.</p>' : ''}
    <p class="muted small">${deepGet(S, ['serveur', 'vapidPublic']) ? 'Une fois activées, les alertes arrivent même téléphone fermé (sur iPhone : appli installée sur l’écran d’accueil).' : 'Les alertes s’affichent quand Fit Pulse est ouverte, même en arrière-plan.'} Elles ne contiennent jamais le nom d’un client.</p>
    ${typeof NOTIF_TYPES === 'object' ? `<h4 class="t-16" style="margin:6px 0 4px">Commercial</h4><div class="nt-rules" id="nt-types">${Object.entries(NOTIF_TYPES).map(([id, T]) => { const n = prefsOf().notif; const pause = (n.pauses || {})[id] && (n.rules || {})[id] === false; return `<label class="row"><input type="checkbox" data-change="notifType" data-id="${id}" ${typeActif(ME.id, id) ? 'checked' : ''}><span class="spacer">${esc(T.label)}${T.priority === 'high' ? ' <span class="tag">prioritaire</span>' : ''}<small class="muted">Exemple : ${esc(T.ex)}${pause ? ' Mis en pause : rarement ouvert.' : ''}</small></span></label>`; }).join('')}</div><p class="muted small" style="margin:4px 0 10px">6 alertes par jour au plus, aucune pendant les heures calmes ni un jour de repos. Une alerte prioritaire décochée reste dans la boîte de réception.</p><h4 class="t-16" style="margin:6px 0 4px">Suivi du club</h4>` : ''}
    <div class="nt-rules">${Object.entries(NOTIF_RULES).filter(([id, r]) => (!r.manager || mgr) && (id !== 'digest' || digestEnvoye())).map(([id, r]) => `<label class="row"><input type="checkbox" data-change="notifRule" data-id="${id}" ${ruleOn(id) ? 'checked' : ''}><span class="spacer">${r.label}<small class="muted">${esc(r.ex)}</small></span></label>`).join('')}</div>
    <p class="muted small" style="margin:8px 0 0">Heures calmes : dans la carte Mon appli.</p>
    <label class="row small" style="margin-top:8px"><input type="checkbox" data-change="notifQuiet" data-k="sunday" ${P.quiet.sunday ? 'checked' : ''}> Silence le dimanche</label>
    <label class="field" style="margin-top:8px"><span>Au plus, par jour</span><select class="input" data-change="notifMax">${[3, 6, 10, 20].map(n => `<option value="${n}" ${P.max === n ? 'selected' : ''}>${n} alertes</option>`).join('')}</select></label></div>`;
}
ACTIONS.notifRule = el => { const id = el.dataset.id; if (id === 'live') return setPrefPath(['notif', 'liveBanner'], el.checked); if (id === 'digest') return setPrefPath(['notif', 'digest'], el.checked); setPrefPath(['notif', 'rules', id], el.checked); };
ACTIONS.notifType = el => { setPrefPath(['notif', 'rules', el.dataset.id], el.checked); if (el.checked) setPrefPath(['notif', 'pauses', el.dataset.id], null); };
ACTIONS.notifQuiet = el => { const k = { from: 'quietFrom', to: 'quietTo', sunday: 'sunday' }[el.dataset.k]; if (k) setPrefPath(['notif', k], el.type === 'checkbox' ? el.checked : el.value); };
ACTIONS.notifMax = el => setPrefPath(['notif', 'maxPerDay'], Number(el.value) || 6);
ACTIONS.notifEnable = async () => { try { const r = await Notification.requestPermission(); if (r === 'granted') pushSubscribe().catch(() => null); toast(r === 'granted' ? 'Alertes activées sur cet appareil.' : 'Alertes non autorisées.'); render(); } catch (_) { toast('Ce navigateur ne permet pas les alertes.'); } };
ACTIONS.installApp = async () => { if (!INSTALL_EVT) return; INSTALL_EVT.prompt(); await INSTALL_EVT.userChoice.catch(() => null); INSTALL_EVT = null; render(); };

// Ouverture d'une alerte poussée : mesurée (openedAt = readAt dans la boîte du serveur).
function notifOuverte(id) { if (!id || !ME || backend.mode !== 'firebase' || !backend.fb) return; backend.fb.database().ref(fbPath(`pulse_inbox/${ME.id}/${id}/readAt`)).set(Date.now()).catch(() => null); }
// Service worker : seulement en ligne (https), jamais en fichier local.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => null));
  navigator.serviceWorker.addEventListener('message', e => { if (!e.data || e.data.type !== 'notif-click') return; notifOuverte(e.data.id); if (e.data.url) location.hash = e.data.url.replace(/^.*#/, '#'); });
}

// ── Abonnement push de cet appareil (alertes téléphone fermé) ────────────
const b64uToBytes = s => { const p = '='.repeat((4 - s.length % 4) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
async function pushSubscribe() {
  if (!ME || backend.mode !== 'firebase' || !('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') return null;
  const key = deepGet(S, ['serveur', 'vapidPublic']); if (!key) return null;
  const reg = await navigator.serviceWorker.ready; let sub = await reg.pushManager.getSubscription();
  if (sub && safeLS.get('fitpulse.pushKey') !== key) { await sub.unsubscribe().catch(() => null); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(key) });
  const j = sub.toJSON(); const h = hkey(j.endpoint);
  await backend.fb.database().ref(fbPath(`pulse_push/${ME.id}/${h}`)).set({ endpoint: j.endpoint, keys: j.keys, at: Date.now(), ua: navigator.userAgent.slice(0, 120) });
  safeLS.set('fitpulse.pushKey', key); safeLS.set('fitpulse.pushId', `${ME.id}/${h}`);
  return sub;
}
async function pushForget() { if (INBOX_REF) { INBOX_REF.off(); INBOX_REF = null; } try { const id = safeLS.get('fitpulse.pushId'); if (id && backend.fb) await backend.fb.database().ref(fbPath(`pulse_push/${id}`)).remove(); safeLS.del('fitpulse.pushId'); const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch (_) { /* rien */ } }
// À chaque ouverture : abonnement remis à jour si les alertes sont autorisées.
setTimeout(() => { pushSubscribe().catch(() => null); }, 6000);

// ── Boîte de réception du serveur (notifications envoyées téléphone fermé) ─
let INBOX_REF = null;
function inboxListen() {
  // Appli ouverte depuis une alerte (?notif=…) : ouverture comptée une fois connecté.
  const q = new URLSearchParams(location.search); if (q.get('notif') && ME && backend.mode === 'firebase') { notifOuverte(q.get('notif')); q.delete('notif'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); }
  if (INBOX_REF || !ME || backend.mode !== 'firebase' || !backend.fb) return;
  INBOX_REF = backend.fb.database().ref(fbPath(`pulse_inbox/${ME.id}`)).orderByChild('at').limitToLast(50);
  INBOX_REF.on('value', snap => { const srv = snap.val() || {}; const L = inbox(); let changed = false;
    Object.entries(srv).forEach(([id, x]) => { const sid = 'srv_' + id; const cur = L.find(m => m.id === sid); if (!cur) { L.push({ id: sid, key: sid, kind: x.kind, title: x.title, body: x.body, url: x.url, at: x.at, readAt: x.readAt || null }); changed = true; } else if (x.readAt && !cur.readAt) { cur.readAt = x.readAt; changed = true; } });
    if (changed) { L.sort((a, b) => b.at - a.at); saveInbox(L); bellRefresh(); } }, () => { INBOX_REF = null; });
}
setInterval(inboxListen, 15000); setTimeout(inboxListen, 3000);
const _notifOpen = ACTIONS.notifOpen;
ACTIONS.notifOpen = el => { const id = el.dataset.id; if (id && id.startsWith('srv_') && backend.mode === 'firebase' && ME) backend.fb.database().ref(fbPath(`pulse_inbox/${ME.id}/${id.slice(4)}/readAt`)).set(Date.now()).catch(() => null); _notifOpen(el); };

// ── Manager : alertes envoyées ce mois, et pause pour le club ────────────
function alertsCard() {
  if (!isManager()) return ''; const mk = curMonth(); const st = deepGet(S, ['serveur', 'stats', mk]) || {}; const srv = S.serveur || {}; const paused = !!(S.clubs[CLUB.id] || {}).notifPaused;
  const alive = srv.at && Date.now() - srv.at < 3600e3;
  return `<div class="card"><h3>Alertes de l’équipe</h3><p class="small">${alive ? `Serveur d’envoi actif (dernier passage ${ago(srv.at)}). Messagerie ${srv.mail ? 'réglée : invitations envoyées automatiquement' : 'non réglée : invitations par le bouton Envoyer par e-mail'}.` : 'Serveur d’envoi pas encore passé, ou arrêté depuis plus d’une heure.'}</p>
    ${Object.keys(st).length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Alerte</th><th class="num">Envoyées ce mois</th></tr></thead><tbody>${Object.entries(st).sort((a, b) => b[1] - a[1]).map(([r, n]) => `<tr><td>${esc((NOTIF_RULES[r] || {}).label || r)}</td><td class="num">${fmtN(n)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Aucune alerte envoyée ce mois-ci.</p>'}
    <label class="row small" style="margin-top:10px"><input type="checkbox" data-change="notifPause" ${paused ? 'checked' : ''}> Mettre les alertes en pause pour ${esc(nomAffiche())} (elles restent dans la cloche)</label></div>`;
}
ACTIONS.notifPause = el => { db.set(['clubs', CLUB.id, 'notifPaused'], el.checked || null); toast(el.checked ? 'Alertes en pause' : 'Alertes réactivées'); };
