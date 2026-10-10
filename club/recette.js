/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
'use strict';
// ══ RECETTE EXPÉRIENCE COMMERCIALE ═══════════════════════════════════════
// Dix vérifications, chacune exécutable dans la console (données de démo,
// ?demo=1 puis Lancer la démo) ; chaque fonction renvoie true ou false et
// ne laisse aucune trace : elle travaille sur une copie, puis rend l'état.
//   1. checkFilFiltrable()          le fil se filtre par type (puces et réglages)
//   2. checkBandeauReglable()       le bandeau en direct suit les réglages du fil
//   3. checkRangVoisin()            un membre voit ses voisins de classement
//   4. checkLigue()                 ligue de la semaine : groupes de 8 à 12, clubs mélangés
//   5. checkObjectifsJour()         toujours 3 objectifs du jour
//   6. checkSerieRepos()            un jour de repos ne casse pas la série
//   7. checkReordonnancementTactile() tri au doigt et au clavier sur le tableau de bord
//   8. checkPhoto()                 la photo s'affiche partout, 60 Ko au plus
//   9. checkImageSansEuro()         l'image du bilan ne contient aucun montant
//  10. checkPlafondNotifications()  6 alertes par jour, heures calmes 20 h 30 à 8 h
// recetteCommerciale() lance les dix et renvoie { ok, details }.

// Exécute fn sur une copie de l'état (écritures en mémoire seulement), puis rend l'état d'origine.
function avecCopie(fn) {
  const garde = { S, ME, CLUB, set: db.set, batch: db.batch, toast, UI: Object.assign({}, UI) };
  try {
    S = JSON.parse(JSON.stringify(S)); REV++;
    db.set = (p, v) => { setPath(S, p, v); REV++; }; db.batch = ops => { ops.forEach(([p, v]) => setPath(S, p, v)); REV++; }; toast = () => {};
    return !!fn();
  } catch (e) { console.warn('recette :', e && e.message); return false; }
  finally { S = garde.S; ME = garde.ME; CLUB = garde.CLUB; db.set = garde.set; db.batch = garde.batch; toast = garde.toast; for (const k of Object.keys(UI)) delete UI[k]; Object.assign(UI, garde.UI); REV++; }
}
// Un commercial de la démo (Centre), ou le premier commercial actif.
const vendeurRecette = () => S.users.v2 || Object.values(S.users).find(u => u.role === 'membre' && !u.virtual && isActive(u));
const commeVendeur = () => { ME = vendeurRecette(); CLUB = S.clubs[(ME.clubs || [])[0]]; };

function checkFilFiltrable() {
  return avecCopie(() => {
    commeVendeur(); const types = new Set(feedEvents([CLUB.id]).map(e => e.type)); if (types.size < 3) return false;
    const v = filListe([CLUB.id], 'ventes', 200).html; const autres = (v.match(/data-type="([a-z]+)"/g) || []).map(x => x.slice(11, -1));
    if (!autres.length || autres.some(t => !['sale', 'import'].includes(t))) return false;
    S.prefs[ME.id] = { ...(S.prefs[ME.id] || {}), v: 2, feed: { ...prefsOf().feed, types: { ...prefsOf().feed.types, sale: false } } }; REV++;
    return !/data-type="sale"/.test(filListe([CLUB.id], 'tout', 200).html);
  });
}
function checkBandeauReglable() {
  return avecCopie(() => {
    commeVendeur(); const e = Object.values(S.entries).find(x => x.source === 'manual' && x.userId !== ME.id && x.clubId === CLUB.id && x.kpiId === 'contrats'); if (!e) return false;
    const t = liveTexte(e); if (!t || /[–—]|\p{Extended_Pictographic}/u.test(t)) return false;
    S.prefs[ME.id] = { ...(S.prefs[ME.id] || {}), v: 2, feed: { ...prefsOf().feed, kpis: { contrats: false } } }; REV++;
    return liveTexte(e) === null;
  });
}
function checkRangVoisin() {
  return avecCopie(() => {
    const r = rangeOf('month', curMonth()); const club = (vendeurRecette().clubs || [])[0]; const rk = ranking(club, r).filter(x => !x.u.virtual);
    const cible = rk.find(x => x.rank >= 5 && x.u.role === 'membre') || rk.find(x => x.rank >= 4 && x.u.role === 'membre'); if (!cible) return rk.length > 0;
    ME = cible.u; CLUB = S.clubs[club]; UI.lbTab = 'classement'; UI.lbPeriod = 'month'; UI.lbAnchor = null; UI.lbAll = null;
    const h = PAGES.leaderboard.render(); const voisin = rk.find(x => x.rank === cible.rank - 1 && x.rank > 3);
    return h.includes(esc(fullName(cible.u))) && (!voisin || h.includes(esc(fullName(voisin.u))));
  });
}
function checkLigue() {
  return avecCopie(() => {
    commeVendeur(); if (!deepGet(S, ['leagues', weekStart(today()), 'divisions'])) db.batch(repartitionOps());
    const G = Object.values(deepGet(S, ['leagues', weekStart(today()), 'divisions']) || {}).flat(); if (!G.length) return false;
    const plusieursClubs = new Set(ligueParticipants().map(u => clubLigue(u))).size > 1;
    return G.every(g => g.length >= LIGUE_MIN && g.length <= LIGUE_MAX && (!plusieursClubs || new Set(g.map(id => clubLigue(S.users[id]))).size > 1));
  });
}
function checkObjectifsJour() { return avecCopie(() => { commeVendeur(); return [0, 1, 2, 3, 4, 5, 6].every(i => dailyGoals(ME.id, addDays(weekStart(today()), i), CLUB.id).length === 3); }); }
function checkSerieRepos() {
  return avecCopie(() => {
    commeVendeur(); let dim = today(); while (dateOf(dim).getDay() !== 0) dim = addDays(dim, -1);
    if (!jourNeutre(ME.id, CLUB.id, dim)) return false;
    // un jour travaillé manqué, puis déclaré en repos : la série ne baisse pas
    let d = addDays(today(), -1); while (!isWorkday(d, CLUB.id) || estFerie(d)) d = addDays(d, -1);
    // jour vraiment manqué : ni vente ni relance notée, appli ouverte
    const jour = x => x && isoOf(new Date(x)) === d;
    Object.keys(S.entries).forEach(id => { const e = S.entries[id]; if (e.userId === ME.id && e.date === d) delete S.entries[id]; });
    Object.keys(S.loyalty || {}).forEach(id => { const a = S.loyalty[id]; if (a.userId === ME.id && jour(a.at)) delete S.loyalty[id]; });
    Object.keys(S.touches || {}).forEach(id => { const a = S.touches[id]; if (a.by === ME.id && jour(a.at)) delete S.touches[id]; });
    Object.values(S.resiliations || {}).forEach(r => Object.keys(r.log || {}).forEach(k => { if (r.log[k].by === ME.id && jour(r.log[k].at)) delete r.log[k]; }));
    Object.values(S.clients || {}).forEach(c => { if (c.dunning && c.dunning.history) c.dunning.history = c.dunning.history.filter(h => !(h && h.by === ME.id && jour(h.at))); });
    S.usage = { ...(S.usage || {}), [ME.id]: { ...((S.usage || {})[ME.id] || {}), [d]: { opens: 1 } } }; REV++;
    if (jourNeutre(ME.id, CLUB.id, d) || jourCompte(ME.id, CLUB.id, d)) return false; // le jour doit compter comme manqué
    const manque = serieJours(ME.id, CLUB.id);
    S.absences = { ...(S.absences || {}), [ME.id]: { ...((S.absences || {})[ME.id] || {}), [d]: 'conge' } }; REV++;
    const repos = serieJours(ME.id, CLUB.id);
    // en repos : jour neutre, le joker reste disponible et la série ne baisse pas
    return jourNeutre(ME.id, CLUB.id, d) && repos.n >= manque.n && (repos.jokerDispo || !manque.jokerDispo);
  });
}
function checkReordonnancementTactile() {
  return avecCopie(() => {
    commeVendeur(); S.prefs[ME.id] = { ...(S.prefs[ME.id] || {}), v: 2 }; UI.dashSort = null; REV++;
    const r = rangeOf('month', curMonth()); const st = statsFor(CLUB.id, ME.id, r); const h = kpiTable(st.rows, 0.5, r, ME.id);
    if (!/data-tri="kpi"/.test(h) || !/class="tri-poignee"/.test(h) || TRI_APPUI_MS !== 350) return false;
    const avant = kpiOrdreMoi(CLUB.id); const ids = [avant[1], avant[0], ...avant.slice(2)]; TRI_CIBLES.kpi(ids);
    return kpiOrdreMoi(CLUB.id)[0] === avant[1] && typeof triDemarrer === 'function';
  });
}
function checkPhoto() {
  return avecCopie(() => {
    commeVendeur(); S.users[ME.id].photo = 'data:image/jpeg;base64,' + 'A'.repeat(200); ME = S.users[ME.id]; REV++;
    const img = h => /<img src="data:image\/jpeg;base64,A/.test(h);
    const e = Object.values(S.entries).find(x => x.userId === ME.id && x.source === 'manual');
    UI.chatCh = CLUB.id; S.chat.recette = { id: 'recette', channel: CLUB.id, userId: ME.id, at: Date.now(), text: 'Recette' }; REV++;
    return PHOTO_MAX_OCTETS === 60 * 1024 && img(avatar(ME)) && (!e || img(filCarte(feedEvents([CLUB.id]).find(x => x.id === e.id)))) && img(PAGES.chat.render()) && !/<img/.test(avatar({ first: 'A', last: 'B', photo: 'javascript:alert(1)' }));
  });
}
function checkImageSansEuro() {
  return avecCopie(() => {
    commeVendeur(); const T = []; const ctx = new Proxy({}, { get: (o, k) => (k === 'fillText' ? (t => T.push(String(t))) : k === 'measureText' ? () => ({ width: 10 }) : () => {}), set: () => true });
    drawWrapCard(ME.id, addMonths(curMonth(), -1), { getContext: () => ctx });
    return T.length > 4 && T.every(t => !/€|[–—]/.test(t));
  });
}
function checkPlafondNotifications() {
  return avecCopie(() => {
    commeVendeur(); const P = notifPrefs();
    return P.max === 6 && P.quiet.from === '20:30' && P.quiet.to === '08:00' && Object.values(NOTIF_TYPES).every(t => typeof t.cooldownMin === 'number' && typeof t.build === 'function')
      && Object.values(NOTIF_TYPES).every(t => !/€/.test(t.ex));
  });
}
const RECETTE = { checkFilFiltrable, checkBandeauReglable, checkRangVoisin, checkLigue, checkObjectifsJour, checkSerieRepos, checkReordonnancementTactile, checkPhoto, checkImageSansEuro, checkPlafondNotifications };
function recetteCommerciale() { const details = Object.fromEntries(Object.entries(RECETTE).map(([k, f]) => [k, f()])); return { ok: Object.values(details).every(Boolean), details }; }

// ── #/demo-commerciale : 6 écrans en stories (managers et créateur seulement) ──
const STORIES = [
  ['Un accueil composé par chacun', () => `<div class="story-liste">${HOME_CONSEILLE.membre.map(id => `<div class="row"><span class="hc-ic">${ico(HOME_CARDS[id].icon)}</span><span class="spacer">${esc(HOME_CARDS[id].label)}</span><span class="switch"><input type="checkbox" checked disabled aria-label="${esc(HOME_CARDS[id].label)}"><i></i></span></div>`).join('')}</div><p class="muted small">Chaque commercial choisit et ordonne ses cartes, au doigt.</p>`],
  ['Ma journée : 3 objectifs', () => { const r = rangeOf('month', curMonth()); const rk = ranking(CLUB.id, r); return maJourneeCard({ myPct: statsFor(CLUB.id, ME.id, r, { requiredOnly: true }).score, me: rk.find(x => x.u.id === ME.id), rk }).replace('col6', ''); }],
  ['Le fil des victoires', () => filListe([CLUB.id], 'victoires', 4).html || '<p class="muted">Aucune victoire cette semaine.</p>'],
  ['La ligue de la semaine', () => ligueEcran()],
  ['Le duel de clubs', () => duelCard().replace('col6', '') || '<p class="muted">Aucun duel en cours.</p>'],
  ['Le bilan partagé à l’équipe', () => { const e = feedEvents([CLUB.id]).find(x => x.id.startsWith('wr_')); return e ? filCarte(e) : '<p class="muted">Aucun bilan partagé.</p>'; }],
];
PAGES['demo-commerciale'] = {
  title: 'Démonstration commerciale', manager: true,
  render() {
    const i = Math.max(0, Math.min(STORIES.length - 1, Number(UI.storyI) || 0)); let corps = '';
    const garde = { ME, CLUB }; try { commeVendeur(); corps = STORIES[i][1](); } catch (e) { corps = '<p class="muted">Écran indisponible sur ces données.</p>'; } finally { ME = garde.ME; CLUB = garde.CLUB; }
    return `<div class="stories" data-story="${i}"><div class="story-barres">${STORIES.map((_, j) => `<i class="${j < i ? 'vu' : j === i ? 'en-cours' : ''}"></i>`).join('')}</div>
      <div class="story-tete"><b>${esc(STORIES[i][0])}</b><span class="spacer"></span><span class="muted small">${i + 1} sur ${STORIES.length} · vue de ${esc(fullName(vendeurRecette()))}</span></div>
      <div class="story-corps">${corps}</div>
      <div class="row story-nav"><button class="btn" data-act="story" data-d="-1" ${i ? '' : 'disabled'}>Précédent</button><span class="spacer"></span><button class="btn primary" data-act="story" data-d="1">${i === STORIES.length - 1 ? 'Recommencer' : 'Suivant'}</button></div></div>`;
  },
};
ACTIONS.story = el => { const i = (Number(UI.storyI) || 0) + Number(el.dataset.d); UI.storyI = i >= STORIES.length ? 0 : Math.max(0, i); render(); };
