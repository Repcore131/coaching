/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
'use strict';
// ══ FIT PULSE : fil d'équipe, événements typés ═══════════════════════════
// feedEvents(clubIds, sinceTs) rassemble ce qui compte pour l'équipe :
//   sale       saisie manuelle d'une vente ;
//   import     résumé par vendeur et par import (« Lucas, 4 contrats signés importés ») ;
//   trophy     trophée gagné ;            palier     palier d'équipe franchi (une fois) ;
//   save       client sauvé ;             recovered  impayé récupéré (montant pour les managers seuls) ;
//   challenge  début et fin d'un défi ;   kudos      bravo donné sur une vente ;
//   manager    annonce publiée par un manager.
// Les réglages de chacun (prefs.feed) filtrent le fil, le bandeau en direct et le compteur de non-lus.
const FEED_LABELS = { sale: 'Ventes saisies', import: 'Ventes importées', trophy: 'Trophées', palier: 'Paliers d’équipe', save: 'Clients sauvés', recovered: 'Impayés récupérés', challenge: 'Défis', kudos: 'Bravos', manager: 'Annonces du manager' };
const FEED_PUCES = [['tout', 'Tout', null], ['ventes', 'Ventes', ['sale', 'import']], ['victoires', 'Victoires', ['trophy', 'palier', 'save', 'recovered', 'challenge']], ['bravo', 'Bravo', ['kudos']], ['annonces', 'Annonces', ['manager']]];
const FEED_VICTOIRES = ['trophy', 'palier', 'save', 'recovered', 'challenge'];
const FEED_BADGE = { sale: ['VENTE', 'chart'], import: ['IMPORT', 'upload'], trophy: ['TROPHÉE', 'trophy'], palier: ['VICTOIRE', 'users'], save: ['VICTOIRE', 'lifebuoy'], recovered: ['VICTOIRE', 'coins'], challenge: ['DÉFI', 'bolt'], kudos: ['BRAVO', 'sparkle'], manager: ['ANNONCE', 'bell'] };
const FEED_PAGE = 30;
const prenom = u => (u && (u.first || fullName(u))) || 'Un collègue';
const kpiTexte = (k, v) => fmtU(v, k); // « 4 contrats », « 45 € »

// Moment où un trophée est gagné (fin de la période qu'il récompense).
function tropheeAt(t) {
  if (t.at) return t.at;
  if (t.week) return dateOf(addDays(t.week, 7)).getTime() + 8 * 3600e3;
  return dateOf(addMonths(t.mk, 1) + '-01').getTime() + 8 * 3600e3;
}
// Paliers franchis : instant de la saisie qui a fait passer le seuil. Un palier = un événement.
function palierEvenements(clubId, mk) {
  const out = [];
  for (const [kpiId, tiers] of Object.entries(paliersFor(clubId, mk))) {
    const k = S.kpis[kpiId]; const st = palierState(clubId, mk, kpiId); if (!k || !st || !st.reached) continue;
    // Même total que palierState (sumRange, dédoublonnage import et saisie) : jour par jour ;
    // dans le jour, l'heure de la saisie qui fait passer le seuil.
    const T = (st.tiers || tiers || []).map(x => Number(x.target)).filter(x => x > 0).sort((a, b) => a - b);
    const E = Object.values(S.entries).filter(e => e.clubId === clubId && e.kpiId === kpiId && e.date && e.date.slice(0, 7) === mk && entryCounts(e)).sort((a, b) => (a.at || 0) - (b.at || 0));
    let cum = 0, n = 0;
    for (let d = mk + '-01'; d <= `${mk}-${daysIn(mk)}` && n < st.reached; d = addDays(d, 1)) {
      const total = sumRange(clubId, null, kpiId, d, d); if (!total) continue;
      const J = E.filter(e => e.date === d); let dans = 0;
      for (const e of J.length ? J : [{ at: dateOf(d).getTime() + 12 * 3600e3, value: total }]) {
        dans = Math.min(total, dans + (Number(e.value) || 0)); const c = cum + dans;
        while (n < T.length && n < st.reached && c >= T[n] - 1e-9) { n++; out.push({ id: `pal_${clubId}_${mk}_${kpiId}_${n}`, type: 'palier', at: e.at || dateOf(d).getTime(), clubId, kpiId, value: T[n - 1], label: `Palier ${n} atteint, ${kpiTexte(k, T[n - 1])}`, link: '#/home' }); }
      }
      cum += total;
      while (n < T.length && n < st.reached && cum >= T[n] - 1e-9) { n++; const der = J[J.length - 1]; out.push({ id: `pal_${clubId}_${mk}_${kpiId}_${n}`, type: 'palier', at: (der && der.at) || dateOf(d).getTime(), clubId, kpiId, value: T[n - 1], label: `Palier ${n} atteint, ${kpiTexte(k, T[n - 1])}`, link: '#/home' }); }
    }
  }
  return out;
}
function feedEvents(clubIds, sinceTs = 0) {
  const clubs = [...clubIds].sort();
  const all = memo(`feed|${clubs.join(',')}|${ME ? ME.id + isManager() : ''}`, () => {
    const C = new Set(clubs); const mgr = isManager(); const out = [];
    const imports = new Map();
    for (const e of Object.values(S.entries)) {
      if (!C.has(e.clubId) || !entryCounts(e)) continue;
      const k = S.kpis[e.kpiId]; const u = S.users[e.userId]; if (!k || !u) continue;
      const at = e.at || dateOf(e.date).getTime();
      if (isImported(e)) {
        if (e.kpiId === 'impayes' && !mgr) continue;
        const cle = `${e.importId || 'imp'}|${e.userId}`; const g = imports.get(cle) || { id: 'imp_' + cle, type: 'import', at: 0, userId: e.userId, clubId: e.clubId, parts: {}, kpiIds: new Set() };
        g.parts[e.kpiId] = (g.parts[e.kpiId] || 0) + (Number(e.value) || 0); g.kpiIds.add(e.kpiId);
        const imp = S.imports[e.importId]; g.at = Math.max(g.at, (imp && imp.at) || at); imports.set(cle, g);
        continue;
      }
      if (e.source !== 'manual') continue;
      if (e.kpiId === 'impayes') { out.push({ id: e.id, type: 'recovered', at, userId: e.userId, clubId: e.clubId, kpiId: e.kpiId, value: mgr ? e.value : null, label: mgr ? `${prenom(u)} a récupéré un impayé de ${fmtE(Number(e.value))}` : `${prenom(u)} a récupéré un impayé`, link: '#/impayes' }); continue; }
      if (e.kpiId === 'sauvetage') { out.push({ id: e.id, type: 'save', at, userId: e.userId, clubId: e.clubId, kpiId: e.kpiId, label: `${prenom(u)} a sauvé un client`, link: '#/resiliations' }); continue; }
      out.push({ id: e.id, type: 'sale', at, userId: e.userId, clubId: e.clubId, kpiId: e.kpiId, value: e.value, label: `${prenom(u)} · ${kpiTexte(k, Number(e.value))}`, link: '#/leaderboard' });
    }
    for (const g of imports.values()) {
      const parts = Object.entries(g.parts).filter(([, v]) => v).map(([kid, v]) => kpiTexte(S.kpis[kid], v)); if (!parts.length) continue;
      out.push({ id: g.id, type: 'import', at: g.at, userId: g.userId, clubId: g.clubId, kpiIds: [...g.kpiIds], kpiId: g.kpiIds.size === 1 ? [...g.kpiIds][0] : null, label: `${prenom(S.users[g.userId])}, ${parts.join(', ')} importés`, sub: 'de Resamania', link: '#/imports' });
    }
    for (const t of allTrophies()) if (C.has(t.clubId)) { const at = tropheeAt(t); if (at <= Date.now()) out.push({ id: `tr_${t.userId}_${t.kind}_${t.label}`, type: 'trophy', at, userId: t.userId, clubId: t.clubId, label: `${prenom(S.users[t.userId])} · ${t.label}`, icon: t.icon, link: '#/profile' }); }
    for (const c of clubs) for (const mk of [addMonths(curMonth(), -1), curMonth()]) out.push(...palierEvenements(c, mk));
    for (const ch of Object.values(S.challenges || {})) {
      if (!C.has(ch.clubId)) continue;
      if (ch.start <= Date.now()) out.push({ id: `chs_${ch.id}`, type: 'challenge', at: ch.start, clubId: ch.clubId, label: `Défi lancé : ${ch.title || 'défi'}`, sub: `fin dans ${finDans(ch.end)}`, link: '#/leaderboard' });
      if (ch.end <= Date.now()) { const w = challengeRanking(ch)[0]; out.push({ id: `che_${ch.id}`, type: 'challenge', at: ch.end, userId: w && w.value > 0 ? w.u.id : null, clubId: ch.clubId, label: `Défi terminé : ${ch.title || 'défi'}${w && w.value > 0 ? `, gagné par ${prenom(w.u)}` : ''}`, link: '#/leaderboard' }); }
    }
    // Bravos : l'heure est gardée depuis cette version (les anciens, sans heure, ne remontent pas).
    for (const [eid, rx] of Object.entries(S.reactions || {})) {
      const e = S.entries[eid]; if (!e || !C.has(e.clubId)) continue;
      for (const [uid, v] of Object.entries((rx || {}).bravo || {})) if (typeof v === 'number' && S.users[uid]) out.push({ id: `kd_${eid}_${uid}`, type: 'kudos', at: v, userId: uid, toUserId: e.userId, clubId: e.clubId, kpiId: e.kpiId, label: `${prenom(S.users[uid])} : bravo à ${prenom(S.users[e.userId])}`, link: '#/pouls' });
    }
    for (const m of Object.values(S.chat || {})) if (m && m.annonce && C.has(m.channel)) out.push({ id: `an_${m.id}`, type: 'manager', at: m.at, userId: m.userId, clubId: m.channel, label: 'Annonce du manager', sub: m.text, link: '#/pouls' });
    return out.sort((a, b) => b.at - a.at);
  });
  return sinceTs ? all.filter(e => e.at > sinceTs) : all;
}
// Réglages du fil (prefs.feed) : type, sourdine par KPI.
function feedAccepte(ev, F = prefsOf().feed) {
  if (F.types && F.types[ev.type] === false) return false;
  const k = ev.kpiIds || (ev.kpiId ? [ev.kpiId] : []);
  if (k.length && k.every(id => (F.kpis || {})[id] === false)) return false;
  return true;
}
const feedClubs = () => (myClubs().length > 1 && prefsOf().feed.scope === 'all' ? myClubs().map(c => c.id) : [CLUB.id]);
const feedEnPause = () => Number(prefsOf().feed.muteUntil || 0) > Date.now();
// Compteur de non-lus : les événements des autres, acceptés par mes réglages, depuis ma dernière lecture.
function unseenFeed() {
  if (!ME || !CLUB || feedEnPause()) return 0;
  // Jamais lu : seulement les 7 derniers jours (un compte neuf ne démarre pas à 99).
  const depuis = Math.max(Number(prefsOf().seen.feed) || 0, Date.now() - 7 * 864e5);
  return feedEvents(feedClubs(), depuis).filter(e => e.userId !== ME.id && feedAccepte(e)).length;
}

// ── Carte d'un événement ─────────────────────────────────────────────────
function filCarte(ev) {
  const u = ev.userId ? S.users[ev.userId] : null; const win = FEED_VICTOIRES.includes(ev.type); const [badge, ic] = FEED_BADGE[ev.type];
  const rx = ev.type === 'sale' || ev.type === 'recovered' || ev.type === 'save' ? S.reactions[ev.id] || {} : null;
  const multi = myClubs().length > 1; const c = S.clubs[ev.clubId];
  return `<div class="fil-c ${win ? 'fil-win' : ''}" data-type="${ev.type}" data-ev="${esc(ev.id)}"><div class="fil-h">${u && !win ? avatar(u) : `<span class="fil-ic">${ico(ev.icon && ev.type === 'trophy' ? ev.icon : ic)}</span>`}
    <div class="spacer"><b class="fil-t">${esc(ev.label)}</b>${ev.sub ? `<div class="fil-s">${esc(ev.sub)}</div>` : ''}<div class="muted small">${ago(ev.at)}${multi && c ? ` · ${esc(c.name)}` : ''}</div></div><span class="fil-b">${badge}</span></div>
    ${rx ? `<div class="reacts">${reactBtns('react', ev.id, rx)}</div>` : ''}</div>`;
}
function filListe(clubIds, puce, n) {
  const P = FEED_PUCES.find(x => x[0] === puce) || FEED_PUCES[0];
  const L = feedEvents(clubIds).filter(e => feedAccepte(e) && (!P[2] || P[2].includes(e.type)));
  let jour = '';
  const html = L.slice(0, n).map(e => { const d = isoOf(new Date(e.at)); const sep = d !== jour ? `<div class="day-sep">${d === today() ? 'Aujourd’hui' : d === addDays(today(), -1) ? 'Hier' : dayLabel(d)}</div>` : ''; jour = d; return sep + filCarte(e); }).join('');
  return { html, total: L.length };
}
// Accueil : les 3 derniers événements.
function filAccueilCard(n = 3) {
  const L = feedEvents(feedClubs()).filter(e => feedAccepte(e)).slice(0, n);
  return `<div class="card col6"><div class="race-h"><div><div class="eyebrow">Équipe</div><h3>Fil d’équipe</h3></div><span class="spacer"></span><a class="btn ghost sm" href="#/pouls">Tout voir</a></div>${L.length ? L.map(filCarte).join('') : '<p class="muted small">Rien de neuf pour l’instant.</p>'}</div>`;
}

PAGES.pouls = {
  title: TXT.pages.pouls,
  render() {
    const puce = UI.filPuce || 'tout'; const n = UI.filN || FEED_PAGE; const F = prefsOf().feed;
    const L = filListe(feedClubs(), puce, n);
    setTimeout(() => { if (ME && Date.now() - prefsOf().seen.feed > 1000) setPrefPath(['seen', 'feed'], Date.now()); }, 600);
    return `<div class="page-head"><div><h1>Fil d’équipe</h1><p>${TXT.pouls.sous}</p></div><span class="spacer"></span><button class="btn sm" data-act="filReglages">${ico('menu')} Réglages du fil</button></div>
      ${feedEnPause() ? `<div class="banner-info row" style="margin-bottom:12px"><span class="spacer">Fil en pause jusqu’à ${timeOf(F.muteUntil).replace(':', ' h ')} : ni bandeau ni compteur.</span><button class="btn sm" data-act="filReprendre">Reprendre</button></div>` : ''}
      <div class="fil-puces" role="tablist">${FEED_PUCES.map(([id, l]) => `<button class="fil-puce ${id === puce ? 'on' : ''}" role="tab" aria-selected="${id === puce}" data-act="filPuce" data-p="${id}">${l}</button>`).join('')}</div>
      ${isManager() ? `<form class="fil-annonce row" id="fil-an" onsubmit="return false"><input class="input spacer" name="t" maxlength="280" placeholder="Une annonce pour l’équipe" aria-label="Annonce"><button class="btn primary" data-act="filAnnonce">Publier</button></form>` : ''}
      <div class="pouls fil">${L.html || `<div class="card">${emptyBox({ art: 'pouls', title: TXT.pouls.videTitre, text: 'Les ventes et les victoires de l’équipe apparaissent ici.', cta: '<button class="btn primary sm" data-act="openSaisies">Nouvelle saisie</button>' })}</div>`}</div>
      ${L.total > n ? `<div class="center" style="margin:14px 0"><button class="btn" data-act="filPlus">Voir plus (${L.total - n})</button></div>` : ''}`;
  },
};
ACTIONS.filPuce = el => { UI.filPuce = el.dataset.p; UI.filN = FEED_PAGE; render(); };
ACTIONS.filPlus = () => { UI.filN = (UI.filN || FEED_PAGE) + FEED_PAGE; render(); };
ACTIONS.filAnnonce = () => { const i = $('#fil-an [name=t]'); const t = (i && i.value || '').trim().slice(0, 280); if (!t || !isManager()) return; const id = newId(); db.set(['chat', id], { id, channel: CLUB.id, userId: ME.id, at: Date.now(), text: t, annonce: true }); toast('1 annonce publiée'); };
ACTIONS.filReglages = () => {
  const F = prefsOf().feed; const multi = myClubs().length > 1;
  const sw = (act, k, on, label) => `<label class="row fil-r"><span class="spacer">${label}</span><span class="switch"><input type="checkbox" data-change="${act}" data-k="${k}" ${on ? 'checked' : ''} aria-label="${esc(label)}"><i></i></span></label>`;
  openModal({ title: 'Réglages du fil', body: `<p class="muted small" style="margin-top:0">Ces réglages valent aussi pour le bandeau en direct et le compteur de non-lus.</p>
    <h3 class="t-16">Types d’événements</h3>${FEED_TYPES.map(t => sw('filType', t, F.types[t] !== false, FEED_LABELS[t])).join('')}
    <h3 class="t-16" style="margin-top:14px">Indicateurs</h3>${kpiList().map(k => sw('filKpi', k.id, (F.kpis || {})[k.id] !== false, k.label)).join('')}
    ${multi ? `<h3 class="t-16" style="margin-top:14px">Portée</h3><div class="row" style="gap:6px">${[['club', 'Ce club'], ['all', 'Tous nos clubs']].map(([v, l]) => `<button class="btn sm ${F.scope === v ? 'primary' : ''}" data-act="filPortee" data-v="${v}">${l}</button>`).join('')}</div>` : ''}`,
    foot: `<button class="btn" data-act="${feedEnPause() ? 'filReprendre' : 'filPause'}">${feedEnPause() ? 'Reprendre maintenant' : 'Mettre en pause 1 h'}</button><span class="spacer"></span><button class="btn primary" data-close>Fermer</button>` });
};
ACTIONS.filType = el => setPrefPath(['feed', 'types', el.dataset.k], el.checked);
ACTIONS.filKpi = el => setPrefPath(['feed', 'kpis', el.dataset.k], el.checked ? null : false);
ACTIONS.filPortee = el => { setPrefPath(['feed', 'scope'], el.dataset.v === 'all' ? 'all' : 'club'); closeModal(); };
ACTIONS.filPause = () => { setPrefPath(['feed', 'muteUntil'], Date.now() + 3600e3); closeModal(); toast('Fil en pause pour 1 h'); };
ACTIONS.filReprendre = () => { setPrefPath(['feed', 'muteUntil'], 0); closeModal(); };

// Bandeau en direct : texte d'une saisie d'un collègue, si mes réglages l'acceptent.
// Format : « Inès · 1 contrats signés · Club Centre », ni emoji ni tiret.
function liveTexte(e) {
  if (!ME || feedEnPause()) return null;
  const u = S.users[e.userId], k = S.kpis[e.kpiId], c = S.clubs[e.clubId]; if (!u || !k) return null;
  const type = e.kpiId === 'impayes' ? 'recovered' : e.kpiId === 'sauvetage' ? 'save' : 'sale';
  if (!feedAccepte({ type, kpiId: e.kpiId })) return null;
  const quoi = type === 'recovered' ? (isManager() ? `impayé récupéré, ${fmtE(Number(e.value))}` : 'a récupéré un impayé') : type === 'save' ? 'a sauvé un client' : kpiTexte(k, Number(e.value));
  return [prenom(u), quoi, c && c.name].filter(Boolean).join(' · ');
}
