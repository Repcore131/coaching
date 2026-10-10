/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
'use strict';
// ══ FIT PULSE : ligues hebdomadaires du réseau ═══════════════════════════
// Chaque lundi (à 6 h, ou au premier chargement de la semaine), les commerciaux
// des clubs qui participent sont répartis par division en groupes de 8 à 12,
// clubs mélangés, dans un ordre aléatoire à graine stable pour la semaine
// (deux appareils calculent la même chose). Score de la semaine : le score
// normalisé de statsFor plus les points d'action des relances (plafonnés).
// En fin de semaine, les 3 premiers de chaque groupe montent, les 2 derniers
// descendent (sauf en bronze). Un nouveau commence en bronze. Saison de 4 semaines.
//   S.leagues[lundi] = { divisions: { bronze: [[uid, ...], ...], ... }, results?: { uid: 'up'|'down'|'stay' } }
//   S.leagueMember[uid] = { division, since, optIn, hideName? }
//   S.clubs[cid].leagueOptIn (réglage du manager, coché par défaut)
const DIVISIONS = ['bronze', 'argent', 'or', 'platine'];
const DIV_LABEL = { bronze: 'Bronze', argent: 'Argent', or: 'Or', platine: 'Platine' };
const LIGUE_MIN = 8, LIGUE_MAX = 12, LIGUE_MONTENT = 3, LIGUE_DESCENDENT = 2, LIGUE_ACTION_MAX = 300;
const SAISON_SEMAINES = 4, SAISON_ORIGINE = '2026-01-05'; // un lundi : saison 1 = 4 semaines à partir de cette date

const clubEnLigue = cid => !!S.clubs[cid] && S.clubs[cid].leagueOptIn !== false;
const membreLigue = uid => ((S.leagueMember || {})[uid]) || null;
// Commerciaux qui participent : actifs, rôle commercial, d'un club inscrit, sans refus personnel.
function ligueParticipants() {
  return Object.values(S.users).filter(u => u && u.role === 'membre' && !u.virtual && isActive(u) && (u.clubs || []).some(clubEnLigue) && (membreLigue(u.id) || {}).optIn !== false);
}
const clubLigue = u => (u.clubs || []).find(clubEnLigue) || (u.clubs || [])[0];
function saisonDe(lundi) { const n = Math.floor((dateOf(lundi) - dateOf(SAISON_ORIGINE)) / (7 * 864e5)); return { num: Math.floor(n / SAISON_SEMAINES) + 1, semaine: (n % SAISON_SEMAINES + SAISON_SEMAINES) % SAISON_SEMAINES + 1 }; }
const graineTexte = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };

// Score de ligue : score normalisé de la semaine (statsFor) en points, plus les points d'action plafonnés.
function scoreLigue(uid, lundi) {
  return memo(`lg|${uid}|${lundi}`, () => {
    const u = S.users[uid]; if (!u) return 0; const cid = clubLigue(u); const r = rangeOf('week', lundi);
    const sc = statsFor(cid, uid, r, { requiredOnly: true }).score || 0;
    return Math.round(sc * 1000) + Math.min(LIGUE_ACTION_MAX, actionPoints(uid, r.from, r.to));
  });
}
// Groupes d'une division : ordre aléatoire stable, puis distribution qui alterne les clubs.
function groupesDivision(uids, lundi, div) {
  const n = uids.length; if (!n) return [];
  let k = Math.max(1, Math.ceil(n / LIGUE_MAX)); if (k > 1 && n / k < LIGUE_MIN) k = Math.max(1, Math.floor(n / LIGUE_MIN)); if (Math.ceil(n / k) > LIGUE_MAX) k++;
  const r = rng(graineTexte(lundi + '|' + div)); const L = uids.slice().sort().map(id => [r(), id]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  // clubs mélangés : on prend tour à tour un commercial de chaque club
  const parClub = {}; L.forEach(id => { const c = clubLigue(S.users[id]); (parClub[c] = parClub[c] || []).push(id); });
  const files = Object.values(parClub).sort((a, b) => b.length - a.length); const ordre = [];
  while (files.some(f => f.length)) for (const f of files) if (f.length) ordre.push(f.shift());
  const G = [...Array(k)].map(() => []); ordre.forEach((id, i) => G[i % k].push(id));
  return G;
}
// Classement d'un groupe pour une semaine (meilleur score d'abord, puis nom).
function classementGroupe(groupe, lundi) { return groupe.map(uid => ({ uid, pts: scoreLigue(uid, lundi) })).sort((a, b) => b.pts - a.pts || fullName(S.users[a.uid] || {}).localeCompare(fullName(S.users[b.uid] || {}))); }
// Résultat d'une semaine terminée : 3 montent, 2 descendent (pas sous le bronze, pas au-dessus du platine).
function resultatsSemaine(lundi) {
  const L = (S.leagues || {})[lundi]; if (!L) return {};
  const out = {};
  for (const div of DIVISIONS) for (const g of (L.divisions || {})[div] || []) {
    const C = classementGroupe(g, lundi);
    C.forEach((x, i) => { out[x.uid] = i < LIGUE_MONTENT && div !== 'platine' ? 'up' : i >= C.length - LIGUE_DESCENDENT && div !== 'bronze' && C.length > LIGUE_MONTENT + LIGUE_DESCENDENT ? 'down' : 'stay'; });
  }
  return out;
}
const divisionApres = (div, r) => DIVISIONS[Math.max(0, Math.min(DIVISIONS.length - 1, DIVISIONS.indexOf(div) + (r === 'up' ? 1 : r === 'down' ? -1 : 0)))];

// Répartition de la semaine (idempotente) : écritures à faire, ou [] si déjà faite.
function repartitionOps(lundi = weekStart(today())) {
  if (deepGet(S, ['leagues', lundi, 'divisions'])) return [];
  const ops = []; const prec = addDays(lundi, -7); const res = (S.leagues || {})[prec] && !(S.leagues[prec].results) ? resultatsSemaine(prec) : ((S.leagues || {})[prec] || {}).results || {};
  if ((S.leagues || {})[prec] && !S.leagues[prec].results) ops.push([['leagues', prec, 'results'], res]);
  const div = {};
  for (const u of ligueParticipants()) {
    const m = membreLigue(u.id); const d0 = m && m.division ? m.division : 'bronze';
    const d = res[u.id] ? divisionApres(d0, res[u.id]) : d0;
    div[u.id] = d;
    if (!m || m.division !== d) ops.push([['leagueMember', u.id], { ...(m || {}), division: d, since: m && m.division === d ? m.since : lundi, optIn: true }]);
  }
  const divisions = {}; for (const d of DIVISIONS) { const G = groupesDivision(Object.keys(div).filter(id => div[id] === d), lundi, d); if (G.length) divisions[d] = G; }
  ops.push([['leagues', lundi, 'divisions'], divisions], [['leagues', lundi, 'at'], Date.now()]);
  return ops;
}
// Lundi à 6 h, ou au premier chargement de la semaine.
function liguesAJour() {
  if (!S || !ME || CFG.capture) return;
  const lundi = weekStart(today()); if (deepGet(S, ['leagues', lundi, 'divisions'])) return;
  if (today() === lundi && new Date().getHours() < 6) return;
  if (!ligueParticipants().length) return;
  const ops = repartitionOps(lundi); if (ops.length) db.batch(ops);
}
function monGroupe(uid = ME.id, lundi = weekStart(today())) {
  const L = deepGet(S, ['leagues', lundi, 'divisions']) || {};
  for (const d of DIVISIONS) for (const [i, g] of ((L[d] || []).entries())) if (g.includes(uid)) return { division: d, index: i, groupe: g };
  return null;
}
// Nom affiché : mon club en entier ; ailleurs prénom, initiale et club, ou rien si la personne l'a masqué.
function nomLigue(uid) {
  const u = S.users[uid] || {}; const c = S.clubs[clubLigue(u)] || {}; const memeClub = (u.clubs || []).some(id => (ME.clubs || []).includes(id));
  if (memeClub || uid === ME.id) return { nom: fullName(u), club: c.name || '' };
  if ((membreLigue(uid) || {}).hideName) return { nom: 'Commercial', club: c.name || '' };
  return { nom: `${u.first || ''} ${(u.last || '').slice(0, 1)}.`.trim(), club: c.name || '' };
}
function tempsRestantSemaine() { const fin = dateOf(addDays(weekStart(today()), 7)).getTime(); return finDans(fin); }

// ── Écran « Ma ligue » (Classement) ───────────────────────────────────────
function ligueEcran() {
  if (!clubEnLigue(CLUB.id)) return `<div class="card"><p style="margin:0">${esc(CLUB.name)} ne participe pas aux ligues du réseau.${isManager() ? ' Réglage : Réglages, Participer aux ligues du réseau.' : ''}</p></div>`;
  const G = monGroupe(); const s = saisonDe(weekStart(today()));
  if (!G) return `<div class="card"><p style="margin:0">${isManager() ? 'Les ligues réunissent les commerciaux du réseau.' : 'Vous rejoindrez une ligue lundi prochain.'} Saison ${s.num}, semaine ${s.semaine} sur ${SAISON_SEMAINES}.</p></div>`;
  const C = classementGroupe(G.groupe, weekStart(today())); const n = C.length;
  const zone = i => (i < LIGUE_MONTENT && G.division !== 'platine' ? 'monte' : i >= n - LIGUE_DESCENDENT && G.division !== 'bronze' && n > LIGUE_MONTENT + LIGUE_DESCENDENT ? 'descend' : '');
  return `<div class="card ligue" id="ma-ligue"><div class="race-h"><div><div class="eyebrow">Saison ${s.num} · semaine ${s.semaine} sur ${SAISON_SEMAINES}</div><h3>Ligue ${DIV_LABEL[G.division]}, groupe ${G.index + 1}</h3></div><span class="spacer"></span><span class="tag">Fin dans ${esc(tempsRestantSemaine())}</span></div>
    <div class="ligue-l">${C.map((x, i) => { const N = nomLigue(x.uid); return `<div class="ligue-r ${zone(i)} ${x.uid === ME.id ? 'moi' : ''}" data-zone="${zone(i) || 'reste'}"><b class="ligue-n">${i + 1}</b>${avatar(S.users[x.uid], 'xs')}<span class="spacer"><b>${esc(N.nom)}</b><small class="muted"> ${esc(N.club)}</small></span><b class="num">${fmtN(x.pts)} pts</b></div>`; }).join('')}</div>
    <p class="muted small" style="margin:8px 0 0">En jaune : montée (${LIGUE_MONTENT} premiers). En gris : descente (${LIGUE_DESCENDENT} derniers${G.division === 'bronze' ? ', pas en bronze' : ''}). Points : score de la semaine rapporté aux objectifs, plus les relances notées (${LIGUE_ACTION_MAX} au plus).</p>
    <label class="row small" style="margin-top:10px"><input type="checkbox" data-change="ligueMasquer" ${(membreLigue(ME.id) || {}).hideName ? 'checked' : ''}> Masquer mon nom hors de mon club</label></div>`;
}
ACTIONS.ligueMasquer = el => db.set(['leagueMember', ME.id, 'hideName'], el.checked || null);
ACTIONS.ligueOptIn = el => { if (!isManager()) return; db.set(['clubs', CLUB.id, 'leagueOptIn'], el.checked); toast(el.checked ? `${CLUB.name} participe aux ligues du réseau` : `${CLUB.name} ne participe plus aux ligues : 0 groupe`); };
function ligueReglageCard() {
  if (!isManager()) return '';
  return `<div class="card" id="ligue-reglage"><h3>Ligues du réseau</h3><label class="row"><input type="checkbox" data-change="ligueOptIn" ${clubEnLigue(CLUB.id) ? 'checked' : ''}> Participer aux ligues du réseau</label><p class="muted small" style="margin:6px 0 0">Groupes de 8 à 12 commerciaux de niveau comparable, clubs mélangés. Les autres clubs ne voient que le prénom, l’initiale et le club, jamais un montant.</p></div>`;
}
// Badges de saison : chaque montée, et le maintien en platine à la fin d'une saison.
function tropheesLigue() {
  const out = []; const L = S.leagues || {};
  for (const [lundi, x] of Object.entries(L)) {
    const res = x.results; if (!res) continue; const s = saisonDe(lundi); const at = dateOf(addDays(lundi, 7)).getTime() + 6 * 3600e3;
    for (const [d, groupes] of Object.entries(x.divisions || {})) for (const g of groupes) for (const uid of g) {
      const u = S.users[uid]; if (!u) continue; const cid = clubLigue(u);
      if (res[uid] === 'up') out.push({ userId: uid, kind: 'season', icon: 'ranking', label: `Montée en ${DIV_LABEL[divisionApres(d, 'up')]}, saison ${s.num}`, mk: lundi.slice(0, 7), week: lundi, at, clubId: cid, ligue: true });
      if (d === 'platine' && res[uid] !== 'down' && s.semaine === SAISON_SEMAINES) out.push({ userId: uid, kind: 'season', icon: 'crown', label: `Maintien en Platine, saison ${s.num}`, mk: lundi.slice(0, 7), week: lundi, at, clubId: cid, ligue: true });
    }
  }
  return out;
}
// Écran Classement : onglet « Ma ligue » à côté du classement du club.
const LB_RENDER = PAGES.leaderboard.render;
PAGES.leaderboard.render = function (...a) {
  setTimeout(liguesAJour, 0);
  const t = UI.lbTab || 'classement';
  const onglets = tabs('lbTab', [['classement', 'Classement'], ['ligue', 'Ma ligue']], t);
  if (t !== 'ligue') return LB_RENDER.apply(this, a).replace('</div></div>\n      <div class="row wrap"', `</div></div>${onglets}\n      <div class="row wrap"`);
  return `<div class="page-head"><div><h1>Classement</h1><p>Ligues du réseau</p></div></div>${onglets}${ligueEcran()}`;
};
