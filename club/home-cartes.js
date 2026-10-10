/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
'use strict';
// ══ FIT PULSE : accueil personnalisable ══════════════════════════════════
// Chaque commercial choisit les cartes de son accueil et leur ordre
// (prefs.home.cards, voir prefs.js). La bannière reste en tête. Une carte
// absente de la liste n'est pas rendue ; un membre ne voit jamais le cockpit.
// render(ctx) reçoit les chiffres du mois calculés une fois (homeContexte).

// Semaine ISO « 2026-W41 » (défi perso de la semaine).
function semaineIso(iso = today()) {
  const d = dateOf(iso); const j = (d.getDay() + 6) % 7; d.setDate(d.getDate() - j + 3);
  const an = d.getFullYear(); const premier = new Date(an, 0, 4); const n = 1 + Math.round(((d - premier) / 864e5 - 3 + ((premier.getDay() + 6) % 7)) / 7);
  return `${an}-W${pad(n)}`;
}

const carte = (cls, eyebrow, titre, corps, extra = '') => `<div class="card ${cls}"><div class="race-h"><div>${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<h3>${titre}</h3></div><span class="spacer"></span>${extra}</div>${corps}</div>`;

const HOME_CARDS = {
  delta: { label: 'Depuis ta dernière visite', icon: 'chart', roles: ['membre', 'manager'], default: true, render: () => (typeof deltaCard === 'function' ? deltaCard() : '') },
  cockpit: { label: 'Cockpit du manager', icon: 'dashboard', roles: ['manager'], default: true, render: ctx => `${typeof bienJoueTile === 'function' ? bienJoueTile() : ''}<div class="col12">${managerCockpit()}</div>${ctx.manager ? `<div class="card col6"><div class="race-h"><div><div class="eyebrow">${MOIS[Number(ctx.mk.slice(5)) - 1]}</div><h3>Résiliations</h3></div></div>${resFunnel(CLUB.id, ctx.mk)}</div>
      <div class="card col6"><div class="race-h"><div><div class="eyebrow">Tous canaux</div><h3>Impayés récupérés</h3></div></div>${stackRows(ctx.recovRows, Object.entries(RECOV_CHANNELS).map(([key, c]) => ({ key, label: c.label, color: c.color })))}</div>` : ''}` },
  day: { label: 'Ma journée', icon: 'cal', roles: ['membre', 'manager'], default: true, render: ctx => (typeof maJourneeCard === 'function' ? maJourneeCard(ctx) : '') },
  todo: { label: 'À faire maintenant', icon: 'clock', roles: ['membre', 'manager'], default: true, render: () => `${typeof appelsDuJour === 'function' && appelsDuJour(3) ? `<div class="col12">${appelsDuJour(3)}</div>` : ''}${carte('col6', 'Classé en euros attendus', 'À faire maintenant', oppHomeList(5), '<a class="btn ghost sm" href="#/opportunites">Tout voir</a>')}` },
  quick: { label: 'Saisir', icon: 'edit', roles: ['membre', 'manager'], default: true, render: () => carte('col6', 'Saisie rapide', 'Saisir', quickPad()) },
  duel: { label: 'Duel en cours', icon: 'bolt', roles: ['membre', 'manager'], default: true, render: () => (typeof duelCard === 'function' ? duelCard() : '') },
  challenge: { label: 'Défi en cours', icon: 'target', roles: ['membre', 'manager'], default: true, render: () => defiEnCoursCard() },
  goal: { label: 'Mon défi perso', icon: 'flag', roles: ['membre', 'manager'], default: false, render: () => defiPersoCard() },
  top: { label: 'Top 5', icon: 'users', roles: ['membre', 'manager'], default: true, render: ctx => carte('col6', 'Ce mois-ci', 'Les 5 premiers', ctx.top5.map(x => { const h = healthOf(x.score != null && x.st.expected ? x.score / x.st.expected : null); return `<div class="top-r ${x.u.id === ME.id ? 'me' : ''}"><b class="top-n">${x.rank}</b>${avatar(x.u, 'xs')}<span class="spacer">${esc(fullName(x.u))}</span>${ctx.manager || x.u.id === ME.id ? `<i class="hdot ${h.cls}" title="${h.label}"></i>` : ''}<b>${fmtP(x.score)}</b></div>`; }).join('') || '<p class="muted small">Pas encore de classement.</p>', '<a class="btn ghost sm" href="#/leaderboard">Classement</a>') },
  paliers: { label: 'Paliers d’équipe', icon: 'chart', roles: ['membre', 'manager'], default: true, render: ctx => `<div class="card col6 paliers"><div class="race-h"><div><div class="eyebrow light">Prime d’équipe</div><h3>Paliers du mois</h3></div><span class="spacer"></span>${ctx.manager ? '<a class="btn ghost sm light" href="#/members" data-act="goPaliers">Régler</a>' : ''}</div>${ctx.palierKeys.map(k => palierBlock(CLUB.id, ctx.mk, k, false)).join('') || '<p class="muted">Aucun palier collectif.</p>'}</div>` },
  race: { label: 'Course au palier', icon: 'ranking', roles: ['membre', 'manager'], default: false, render: ctx => `<div class="card col12">${ctx.palierKeys.includes('contrats') ? palierRace(CLUB.id, ctx.mk, 'contrats') : ctx.palierKeys[0] ? palierRace(CLUB.id, ctx.mk, ctx.palierKeys[0]) : '<p class="muted">Aucun palier ce mois-ci.</p>'}</div>` },
  feed: { label: TXT.pages.pouls, icon: 'pouls', roles: ['membre', 'manager'], default: false, render: () => (typeof filAccueilCard === 'function' ? filAccueilCard(3) : '') },
};
// Accueil conseillé, dans cet ordre (la dernière visite d'abord).
const HOME_CONSEILLE = { membre: ['delta', 'day', 'duel', 'todo', 'quick', 'challenge', 'top', 'paliers'], manager: ['delta', 'cockpit', 'day', 'duel', 'todo', 'quick', 'challenge', 'top', 'paliers'] };
const roleAccueil = () => (isManager() ? 'manager' : 'membre');
const carteVisible = id => HOME_CARDS[id] && HOME_CARDS[id].roles.includes(roleAccueil());
function homeCartes() {
  const h = prefsOf().home || {};
  const L = Array.isArray(h.cards) ? h.cards : HOME_CONSEILLE[roleAccueil()];
  return [...new Set(L)].filter(carteVisible);
}
// Toutes les cartes de mon rôle, celles affichées d'abord (pour la feuille Personnaliser).
function homeToutes() { const on = homeCartes(); return [...on, ...Object.keys(HOME_CARDS).filter(id => carteVisible(id) && !on.includes(id))]; }

// ── Défi en cours (sprint du club) ────────────────────────────────────────
function defiEnCours() { const n = Date.now(); return Object.values(S.challenges || {}).filter(ch => ch.clubId === CLUB.id && ch.start <= n && ch.end > n && ch.type !== 'team').sort((a, b) => a.end - b.end)[0] || null; }
function finDans(ts) { const h = Math.max(0, Math.round((ts - Date.now()) / 3600e3)); return h < 48 ? plur(h, 'heure', 'heures') : plur(Math.round(h / 24), 'jour', 'jours'); }
function defiEnCoursCard() {
  const ch = defiEnCours();
  // pas de sprint : le défi d'équipe en cours, barre commune
  if (!ch) { const t = typeof defisEquipe === 'function' ? defisEquipe(CLUB.id).find(c => c.start <= Date.now() && c.end > Date.now()) : null; if (!t) return ''; const s = defiEquipeEtat(t); const k = S.kpis[t.kpiId]; return carte('col6', `Défi d’équipe · fin dans ${finDans(t.end)}`, esc(t.title), `${progressBar(Math.min(1, s.pct))}<p class="small" style="margin:6px 0 0">${esc(fmtU(s.v, k))} sur ${esc(fmtU(t.target, k))} ensemble</p>`, '<a class="btn ghost sm" href="#/challenges">Défis</a>'); }
  const R = challengeRanking(ch); const moi = R.findIndex(x => x.u.id === ME.id);
  return carte('col6', `Fin dans ${finDans(ch.end)}`, esc(ch.title || 'Défi'), `${moi >= 0 ? `<p style="margin:0 0 8px">Vous êtes <b>${moi + 1}<sup>${moi ? 'e' : 'er'}</sup></b> sur ${R.length}.</p>` : ''}${R.slice(0, 3).map((x, i) => `<div class="top-r ${x.u.id === ME.id ? 'me' : ''}"><b class="top-n">${i + 1}</b>${avatar(x.u, 'xs')}<span class="spacer">${esc(fullName(x.u))}</span></div>`).join('')}`, '<a class="btn ghost sm" href="#/leaderboard">Classement</a>');
}

// ── Mon défi perso de la semaine (prefs.goal) ─────────────────────────────
function defiPerso() { const g = prefsOf().goal; return g && g.week === semaineIso() && S.kpis[g.kpiId] ? g : null; }
function defiPersoFait(g = defiPerso()) { if (!g) return null; return sumRange(CLUB.id, ME.id, g.kpiId, weekStart(today()), addDays(weekStart(today()), 6)); }
function defiPersoCard() {
  const g = defiPerso();
  if (!g) return carte('col6', 'Cette semaine', 'Mon défi perso', `<p class="muted small" style="margin-top:0">Fixez-vous un objectif pour la semaine.</p><div class="row wrap" style="gap:6px"><select class="input" id="dp-k" aria-label="Indicateur">${kpiList().filter(k => k.unit === 'qty').map(k => `<option value="${k.id}">${esc(k.label)}</option>`).join('')}</select><input class="input" id="dp-n" type="number" min="1" max="200" value="5" style="width:90px" aria-label="Objectif"><button class="btn primary" data-act="defiPersoSet">Valider</button></div>`);
  const k = S.kpis[g.kpiId]; const fait = defiPersoFait(g);
  return carte('col6', 'Cette semaine', 'Mon défi perso', `<p style="margin:0 0 8px"><b>${esc(fmtU(fait, k))}</b> sur ${esc(fmtU(g.target, k))} en ${esc(k.label)}</p>${progressBar(Math.min(1, g.target ? fait / g.target : 0))}`, '<button class="btn ghost sm" data-act="defiPersoRaz">Changer</button>');
}
ACTIONS.defiPersoSet = () => { const k = ($('#dp-k') || {}).value; const n = Math.round(Number(($('#dp-n') || {}).value)); if (!S.kpis[k] || !(n > 0)) return; setPrefPath(['goal'], { week: semaineIso(), kpiId: k, target: n }); toast(`Défi de la semaine : ${n} ${S.kpis[k].label}`); };
ACTIONS.defiPersoRaz = () => setPrefPath(['goal'], null);

// ── Feuille « Personnaliser » ─────────────────────────────────────────────
function homeEditListe() {
  const E = UI.homeEdit; const n = E.ordre.length;
  return `<ol class="hc-liste" id="hc-liste" data-tri="homeEdit">${E.ordre.map((id, i) => { const c = HOME_CARDS[id]; const on = E.on[id]; return `<li class="hc-l ${on ? '' : 'off'}" data-tri-id="${id}">${triPoignee(id, c.label)}<span class="hc-ic">${ico(c.icon)}</span><span class="spacer" data-tri-label>${esc(c.label)}</span>
    <button class="btn icon hc-b" data-act="homeEditMove" data-id="${id}" data-d="-1" aria-label="Monter ${esc(c.label)}" ${i ? '' : 'disabled'}>${ico('chevU')}</button><button class="btn icon hc-b" data-act="homeEditMove" data-id="${id}" data-d="1" aria-label="Descendre ${esc(c.label)}" ${i < n - 1 ? '' : 'disabled'}>${ico('chevD')}</button>
    <label class="switch hc-sw"><input type="checkbox" data-change="homeEditOn" data-id="${id}" ${on ? 'checked' : ''} aria-label="Afficher ${esc(c.label)}"><i></i></label></li>`; }).join('')}</ol>`;
}
function homeEditRedessiner(focus) { const l = $('#hc-liste'); if (l) l.outerHTML = homeEditListe(); if (focus) { const f = $(`[data-focus="${focus}"]`) || $(`[data-act=homeEditMove][data-id="${focus}"]`); if (f) f.focus(); } }
ACTIONS.homePerso = () => {
  const on = homeCartes(); UI.homeEdit = { ordre: homeToutes(), on: Object.fromEntries(homeToutes().map(id => [id, on.includes(id)])) };
  openModal({ title: 'Mon accueil', body: `<p class="muted small" style="margin-top:0">Choisissez les cartes de votre accueil et leur ordre : appui long pour déplacer, ou boutons Monter et Descendre.</p>${homeEditListe()}`,
    foot: '<button class="btn ghost" data-act="homeConseille">Revenir à l’accueil conseillé</button><span class="spacer"></span><button class="btn primary" data-act="homeEditSave">Enregistrer</button>' });
};
TRI_CIBLES.homeEdit = ids => { if (!UI.homeEdit) return; UI.homeEdit.ordre = ids; const a = document.activeElement; homeEditRedessiner(a && a.dataset ? a.dataset.focus : null); };
ACTIONS.homeEditMove = el => { const E = UI.homeEdit; const i = E.ordre.indexOf(el.dataset.id), j = i + Number(el.dataset.d); if (i < 0 || j < 0 || j >= E.ordre.length) return; [E.ordre[i], E.ordre[j]] = [E.ordre[j], E.ordre[i]]; homeEditRedessiner(el.dataset.id); };
ACTIONS.homeEditOn = el => { UI.homeEdit.on[el.dataset.id] = el.checked; const li = el.closest('li'); if (li) li.classList.toggle('off', !el.checked); };
ACTIONS.homeEditSave = () => { const E = UI.homeEdit; if (!E) return; const cards = E.ordre.filter(id => E.on[id]); setPrefPath(['home'], { cards, hidden: E.ordre.filter(id => !E.on[id]) }); closeModal(); toast(`Accueil enregistré : ${plur(cards.length, 'carte', 'cartes')}`); };
ACTIONS.homeConseille = () => { setPrefPath(['home'], { cards: null, hidden: [] }); closeModal(); toast(`Accueil conseillé rétabli : ${plur(HOME_CONSEILLE[roleAccueil()].length, 'carte', 'cartes')}`); };
