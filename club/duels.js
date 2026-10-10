/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
'use strict';
// ══ FIT PULSE : duels de clubs et défis d'équipe ═════════════════════════
// Duel : un manager propose à un autre club du réseau 7 jours sur un KPI ou
// sur le score global, avec une récompense en texte ; l'autre manager accepte
// ou refuse. Chaque club est noté sur son pourcentage : réalisé de la période
// divisé par la part d'objectif de la période (même logique que
// challengeRanking), moyenne de ses membres actifs. Un petit club et un grand
// club se comparent donc à égalité. D'un club à l'autre : le nom du club et
// son pourcentage, jamais un montant ni un nom de vendeur.
//   S.duels[id] = { id, clubs: [cidA, cidB], kpiId: 'contrats' | 'score', start, end, reward, createdBy, status: 'pending'|'live'|'done'|'refused' }
// Défi d'équipe : S.challenges[id] avec type 'team', objectif collectif chiffré, barre commune.
const DUEL_JOURS = 7;

const membresDuel = cid => clubMembers(cid).filter(u => !u.virtual && u.role !== 'createur');
const duelStatut = d => (d.status === 'live' && d.end <= Date.now() ? 'done' : d.status);
// Pourcentage d'un club : moyenne des membres de réalisé / part d'objectif (score : moyenne des KPI obligatoires).
function duelClub(d, cid) {
  return memo(`duel|${d.id}|${cid}|${d.start}|${d.end}`, () => {
    const kpis = d.kpiId === 'score' ? kpiList().filter(k => k.required && k.points > 0).map(k => k.id) : [d.kpiId];
    const parUser = {}; let contributeurs = new Set();
    for (const k of kpis) for (const x of challengeRanking({ clubId: cid, kpiId: k, start: d.start, end: d.end })) {
      if (x.u.virtual || x.u.role === 'createur') continue;
      (parUser[x.u.id] = parUser[x.u.id] || []).push(Math.min(x.norm, 2)); if (x.value > 0) contributeurs.add(x.u.id);
    }
    const n = membresDuel(cid).length || 1;
    const pct = Object.values(parUser).reduce((s, L) => s + L.reduce((a, b) => a + b, 0) / L.length, 0) / n;
    return { pct, n, contributeurs: [...contributeurs] };
  });
}
// Il manque combien pour repasser devant (KPI : en unités, score : en points de pourcentage).
function duelManque(d, moi, eux) {
  const a = duelClub(d, moi), b = duelClub(d, eux); if (a.pct >= b.pct) return null;
  if (d.kpiId === 'score' || !S.kpis[d.kpiId]) return `il manque ${Math.ceil((b.pct - a.pct) * 100)} points de pourcentage pour repasser devant`;
  const mk = isoOf(new Date(d.start)).slice(0, 7); const heures = (d.end - d.start) / 3600e3;
  const parts = membresDuel(moi).map(u => monthTarget(mk, u.id, d.kpiId)).filter(x => x > 0); const moy = parts.length ? parts.reduce((s, x) => s + x, 0) / parts.length : 0;
  const part = moy / (daysIn(mk) * 24) * heures; if (!(part > 0)) return null;
  const x = Math.max(1, Math.ceil((b.pct - a.pct) * a.n * part + 1e-9));
  return `il manque ${fmtU(x, S.kpis[d.kpiId])} pour repasser devant`;
}
const duelsDuClub = cid => Object.values(S.duels || {}).filter(d => d && (d.clubs || []).includes(cid));
const duelEnCours = cid => duelsDuClub(cid).filter(d => duelStatut(d) === 'live' && d.start <= Date.now()).sort((a, b) => a.end - b.end)[0] || null;
const duelLibelle = d => (d.kpiId === 'score' ? 'score global' : (S.kpis[d.kpiId] || {}).label || d.kpiId);
const duelGagnant = d => { const [a, b] = d.clubs; const A = duelClub(d, a).pct, B = duelClub(d, b).pct; return A === B ? null : A > B ? a : b; };

// ── Carte d'accueil « Duel en cours » (membres des deux clubs) ────────────
function duelCard() {
  const d = duelEnCours(CLUB.id); if (!d) return '';
  const moi = CLUB.id, eux = d.clubs.find(c => c !== moi); const A = duelClub(d, moi), B = duelClub(d, eux);
  const max = Math.max(1, A.pct, B.pct); const manque = duelManque(d, moi, eux);
  const barre = (cid, x, cote) => `<div class="duel-c ${cote}"><b>${esc((S.clubs[cid] || {}).name || 'Club')}</b><div class="duel-bar"><i style="width:${Math.round(Math.min(1, x.pct / max) * 100)}%"></i></div><span class="num">${Math.round(x.pct * 100)} %</span></div>`;
  return `<div class="card col6 duel" data-duel="${esc(d.id)}"><div class="race-h"><div><div class="eyebrow">Duel · ${esc(duelLibelle(d))} · fin dans ${esc(finDans(d.end))}</div><h3>Duel en cours</h3></div></div>
    <div class="duel-face">${barre(moi, A, 'nous')}${barre(eux, B, 'eux')}</div>
    <p class="small" style="margin:8px 0 0">${manque ? esc(manque[0].toUpperCase() + manque.slice(1)) + '.' : 'Vous êtes devant.'}${d.reward ? ` Récompense : ${esc(d.reward)}.` : ''}</p></div>`;
}
// ── Défi d'équipe (coopératif) ───────────────────────────────────────────
function defiEquipeEtat(ch) {
  let v = 0; for (const e of Object.values(S.entries)) { if (e.clubId !== ch.clubId || e.kpiId !== ch.kpiId || !entryCounts(e) || e.adjust) continue; const ts = e.source === 'manual' ? e.at : dateOf(e.date).getTime() + 12 * 3600e3; if (ts >= ch.start && ts <= ch.end) v += Number(e.value) || 0; }
  return { v, pct: ch.target > 0 ? v / ch.target : 0, reussi: v >= ch.target };
}
const defisEquipe = cid => Object.values(S.challenges || {}).filter(c => c && c.type === 'team' && c.clubId === cid);

// ── Page Défis ───────────────────────────────────────────────────────────
function defisEcran() {
  const mgr = isManager(); const autres = Object.values(S.clubs).filter(c => c.id !== CLUB.id);
  const L = duelsDuClub(CLUB.id).sort((a, b) => (b.start || b.at || 0) - (a.start || a.at || 0));
  const ligneDuel = d => {
    const st = duelStatut(d); const eux = d.clubs.find(c => c !== CLUB.id); const nom = esc((S.clubs[eux] || {}).name || 'Club');
    const pct = st === 'live' || st === 'done' ? ` · ${Math.round(duelClub(d, CLUB.id).pct * 100)} % contre ${Math.round(duelClub(d, eux).pct * 100)} %` : '';
    const act = st === 'pending' && mgr && d.clubs[1] === CLUB.id ? `<button class="btn sm primary" data-act="duelAccepter" data-id="${esc(d.id)}">Accepter</button><button class="btn sm" data-act="duelRefuser" data-id="${esc(d.id)}">Refuser</button>` : '';
    const etat = { pending: d.clubs[0] === CLUB.id ? 'En attente de réponse' : 'Proposé à votre club', live: `En cours, fin dans ${finDans(d.end)}`, done: duelGagnant(d) === CLUB.id ? 'Gagné' : duelGagnant(d) ? 'Perdu' : 'Égalité', refused: 'Refusé' }[st];
    return `<div class="row duel-l" data-duel="${esc(d.id)}" data-statut="${st}"><span class="spacer"><b>Contre ${nom}</b> · ${esc(duelLibelle(d))}${pct}<small class="muted"> ${esc(etat)}${d.reward ? ` · ${esc(d.reward)}` : ''}</small></span>${act}</div>`;
  };
  const kOpts = kpiList().filter(k => k.points > 0).map(k => `<option value="${k.id}">${esc(k.label)}</option>`).join('');
  return `<div class="grid">
    ${duelCard() ? `<div class="g12">${duelCard().replace('col6', 'col12')}</div>` : ''}
    <div class="card"><h3>Duels de clubs</h3>${L.length ? L.map(ligneDuel).join('') : '<p class="muted small">Aucun duel pour l’instant.</p>'}
      ${mgr && autres.length ? `<form id="duel-f" class="form-grid" style="margin-top:12px" onsubmit="return false"><label class="field"><span>Club adverse</span><select class="input" name="club">${autres.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Sur</span><select class="input" name="kpi"><option value="score">Score global</option>${kOpts}</select></label>
        <label class="field" style="grid-column:1/-1"><span>Récompense (facultatif)</span><input class="input" name="reward" maxlength="80" placeholder="Petit déjeuner offert par le club perdant"></label>
        <button class="btn primary" data-act="duelProposer">Proposer un duel de 7 jours</button></form>` : ''}</div>
    <div class="card"><h3>Défis d’équipe</h3>${defisEquipe(CLUB.id).sort((a, b) => b.start - a.start).map(ch => { const s = defiEquipeEtat(ch); const k = S.kpis[ch.kpiId]; return `<div class="defi-e" data-defi="${esc(ch.id)}"><div class="row"><b class="spacer">${esc(ch.title)}</b><span class="small muted">${ch.end > Date.now() ? 'fin dans ' + esc(finDans(ch.end)) : s.reussi ? 'Réussi' : 'Terminé'}</span></div>${progressBar(Math.min(1, s.pct))}<small class="muted">${esc(fmtU(s.v, k))} sur ${esc(fmtU(ch.target, k))} ensemble</small></div>`; }).join('') || '<p class="muted small">Aucun défi d’équipe.</p>'}
      ${mgr ? `<form id="defi-f" class="form-grid" style="margin-top:12px" onsubmit="return false"><label class="field"><span>Indicateur</span><select class="input" name="kpi">${kOpts}</select></label><label class="field"><span>Objectif commun</span><input class="input" type="number" min="1" name="target" value="20"></label><label class="field"><span>Durée</span><select class="input" name="jours"><option value="7">7 jours</option><option value="3">3 jours</option><option value="14">14 jours</option></select></label><button class="btn primary" data-act="defiEquipeCreer">Lancer le défi d’équipe</button></form>` : ''}</div></div>`;
}
PAGES.challenges = { title: 'Défis', render() { return `<div class="page-head"><div><h1>Défis</h1><p>Duels de clubs et défis d’équipe</p></div></div>${defisEcran()}`; } };
ACTIONS.duelProposer = () => {
  if (!isManager()) return; const f = formData($('#duel-f')); if (!S.clubs[f.club] || f.club === CLUB.id) return;
  const id = newId(); db.set(['duels', id], { id, clubs: [CLUB.id, f.club], kpiId: f.kpi === 'score' || S.kpis[f.kpi] ? f.kpi : 'score', reward: (f.reward || '').trim().slice(0, 80) || null, createdBy: ME.id, at: Date.now(), status: 'pending' });
  toast(`1 duel proposé à ${S.clubs[f.club].name}`);
};
ACTIONS.duelAccepter = el => { const d = S.duels[el.dataset.id]; if (!d || !isManager() || d.clubs[1] !== CLUB.id || d.status !== 'pending') return; const t = Date.now(); db.batch([[['duels', d.id, 'status'], 'live'], [['duels', d.id, 'start'], t], [['duels', d.id, 'end'], t + DUEL_JOURS * 864e5], [['duels', d.id, 'acceptedBy'], ME.id]]); toast(`Duel accepté contre ${S.clubs[d.clubs[0]].name} : 7 jours`); };
ACTIONS.duelRefuser = el => { const d = S.duels[el.dataset.id]; if (!d || !isManager() || d.clubs[1] !== CLUB.id) return; db.set(['duels', d.id, 'status'], 'refused'); toast(`Duel refusé : 1 proposition de ${S.clubs[d.clubs[0]].name}`); };
ACTIONS.defiEquipeCreer = () => {
  if (!isManager()) return; const f = formData($('#defi-f')); const k = S.kpis[f.kpi]; const n = Math.round(Number(f.target)); if (!k || !(n > 0)) return;
  const id = newId(); const t = Date.now(); const jours = [3, 7, 14].includes(Number(f.jours)) ? Number(f.jours) : 7;
  db.set(['challenges', id], { id, clubId: CLUB.id, type: 'team', kpiId: f.kpi, target: n, start: t, end: t + jours * 864e5, title: `${fmtU(n, k)} ensemble en ${jours} jours`, by: ME.id });
  toast(`Défi d’équipe lancé : ${fmtU(n, k)}`);
};

// ── Fil et trophées ──────────────────────────────────────────────────────
function duelEvenements(clubIds) {
  const out = [];
  for (const d of Object.values(S.duels || {})) {
    if (!d || !d.start || !['live', 'done'].includes(d.status)) continue;
    for (const cid of d.clubs.filter(c => clubIds.includes(c))) {
      const eux = d.clubs.find(c => c !== cid); const nomEux = (S.clubs[eux] || {}).name || 'un club';
      if (d.start <= Date.now()) out.push({ id: `dl_${d.id}_${cid}`, type: 'challenge', at: d.start, clubId: cid, label: `Duel lancé contre ${nomEux}`, sub: `${duelLibelle(d)}, 7 jours`, link: '#/challenges' });
      if (d.end <= Date.now()) { const g = duelGagnant(d); out.push({ id: `df_${d.id}_${cid}`, type: 'challenge', at: d.end, clubId: cid, label: g === cid ? `Duel gagné contre ${nomEux}` : g ? `Duel perdu contre ${nomEux}` : `Duel à égalité contre ${nomEux}`, sub: `${Math.round(duelClub(d, cid).pct * 100)} % contre ${Math.round(duelClub(d, eux).pct * 100)} %`, link: '#/challenges' }); }
    }
  }
  for (const ch of Object.values(S.challenges || {})) if (ch && ch.type === 'team' && clubIds.includes(ch.clubId) && ch.end <= Date.now() && defiEquipeEtat(ch).reussi) out.push({ id: `te_${ch.id}`, type: 'challenge', at: ch.end, clubId: ch.clubId, label: `Défi d’équipe réussi : ${ch.title}`, link: '#/challenges' });
  return out;
}
// « Duel gagné » : membres du club vainqueur qui ont contribué au moins une fois ; défi d'équipe réussi : ses participants.
function tropheesDuels() {
  const out = [];
  for (const d of Object.values(S.duels || {})) {
    if (!d || !d.start || d.end > Date.now() || !['live', 'done'].includes(d.status)) continue; const g = duelGagnant(d); if (!g) continue;
    const eux = d.clubs.find(c => c !== g);
    for (const uid of duelClub(d, g).contributeurs) out.push({ userId: uid, kind: 'flash', icon: 'bolt', label: `Duel gagné contre ${(S.clubs[eux] || {}).name || 'un club'}`, mk: isoOf(new Date(d.end)).slice(0, 7), at: d.end, clubId: g, duel: d.id });
  }
  for (const ch of Object.values(S.challenges || {})) {
    if (!ch || ch.type !== 'team' || ch.end > Date.now() || !defiEquipeEtat(ch).reussi) continue;
    const part = new Set(Object.values(S.entries).filter(e => e.clubId === ch.clubId && e.kpiId === ch.kpiId && entryCounts(e) && (e.source === 'manual' ? e.at : dateOf(e.date).getTime() + 12 * 3600e3) >= ch.start && (e.source === 'manual' ? e.at : dateOf(e.date).getTime()) <= ch.end).map(e => e.userId));
    for (const uid of part) if (S.users[uid] && !S.users[uid].virtual) out.push({ userId: uid, kind: 'flash', icon: 'users', label: `Défi d’équipe réussi : ${ch.title}`, mk: isoOf(new Date(ch.end)).slice(0, 7), at: ch.end, clubId: ch.clubId });
  }
  return out;
}
