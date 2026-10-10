/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
'use strict';
// ══ FIT PULSE : félicitations du manager ═════════════════════════════════
// En 2 taps depuis l'accueil manager : « Féliciter » puis une raison (le texte
// est facultatif). Un kudos s'affiche dans le fil (épinglable 24 h), arrive en
// notification et se compte dans le profil du destinataire. Les collègues
// peuvent dire « Bravo » sur une vente, 3 fois par jour au plus ; seuls les
// kudos du manager comptent pour ses félicitations et pour le trophée
// mensuel « Coup de coeur du manager », choisi dans Membres > Carnets.
//   S.kudos[id] = { id, from, to, clubId, at, reason, text?, pinned, pinnedAt? }
//   S.clubs[cid].coeur[mk] = uid
const KUDOS_RAISONS = { vente: 'Belle vente', relance: 'Relances bien menées', sauvetage: 'Client sauvé', attitude: 'Belle attitude', autre: 'Merci pour ta journée' };
const BRAVO_MAX_JOUR = 3;
const KUDOS_EPINGLE_MS = 24 * 3600e3;

// « Bien joué aujourd'hui » : les 3 membres les plus actifs du jour (saisies et issues de relance).
function bienJoueAujourdhui(clubId = CLUB.id, n = 3) {
  const t = today();
  return clubMembers(clubId).filter(u => !u.virtual && u.role === 'membre').map(u => ({ u, n: Object.values(S.entries).filter(e => e.userId === u.id && e.clubId === clubId && e.date === t && e.source === 'manual' && entryCounts(e)).length + (typeof actionsDuJour === 'function' ? actionsDuJour(u.id, t) : 0) }))
    .filter(x => x.n > 0).sort((a, b) => b.n - a.n || fullName(a.u).localeCompare(fullName(b.u))).slice(0, n);
}
function bienJoueTile() {
  if (!isManager()) return '';
  const L = bienJoueAujourdhui();
  return `<div class="card col12 bien-joue" id="bien-joue"><div class="race-h"><div><div class="eyebrow">${dayLabel(today())}</div><h3>Bien joué aujourd’hui</h3></div></div>
    ${L.length ? L.map(x => `<div class="row bj-r"><span class="spacer">${avatar(x.u, 'xs')} <b>${esc(fullName(x.u))}</b> <small class="muted">${plur(x.n, 'action', 'actions')} aujourd’hui</small></span><button class="btn sm primary" data-act="kudosOuvrir" data-u="${x.u.id}">Féliciter</button></div>`).join('') : '<p class="muted small" style="margin:0">Aucune action enregistrée pour l’instant aujourd’hui.</p>'}</div>`;
}
ACTIONS.kudosOuvrir = el => {
  const u = S.users[el.dataset.u]; if (!u || u.id === ME.id) return;
  openModal({ title: `Féliciter ${u.first}`, body: `<p class="muted small" style="margin-top:0">Une raison suffit ; le mot est facultatif.</p>
    <div class="kudos-raisons">${Object.entries(KUDOS_RAISONS).map(([k, l]) => `<button class="btn" data-act="kudosEnvoyer" data-u="${u.id}" data-r="${k}">${esc(l)}</button>`).join('')}</div>
    <label class="field" style="margin-top:10px"><span>Un mot (facultatif)</span><input class="input" id="kudos-t" maxlength="140" placeholder="140 caractères au plus"></label>` });
};
function kudosOps(to, reason, text = '') {
  if (!ME || !S.users[to] || to === ME.id || !KUDOS_RAISONS[reason]) return [];
  const id = newId(); const club = (S.users[to].clubs || []).includes(CLUB.id) ? CLUB.id : (S.users[to].clubs || [])[0];
  return [[['kudos', id], { id, from: ME.id, to, clubId: club, at: Date.now(), reason, ...(text ? { text: String(text).trim().slice(0, 140) } : {}), pinned: false }]];
}
ACTIONS.kudosEnvoyer = el => { const t = ($('#kudos-t') || {}).value || ''; const ops = kudosOps(el.dataset.u, el.dataset.r, t); if (!ops.length) return; db.batch(ops); closeModal(); toast(`${S.users[el.dataset.u].first} félicité : ${KUDOS_RAISONS[el.dataset.r]}`); };
ACTIONS.kudosEpingler = el => { const k = (S.kudos || {})[el.dataset.id]; if (!k || !isManager()) return; const on = !(k.pinned && Date.now() - (k.pinnedAt || 0) < KUDOS_EPINGLE_MS); db.batch([[['kudos', k.id, 'pinned'], on], [['kudos', k.id, 'pinnedAt'], on ? Date.now() : null]]); toast(on ? '1 félicitation épinglée pour 24 h' : '1 félicitation désépinglée'); };
const kudosEpingle = k => !!(k && k.pinned && Date.now() - (k.pinnedAt || 0) < KUDOS_EPINGLE_MS);
const estManagerDe = (uid, clubId) => { const u = S.users[uid]; return !!u && (u.role === 'manager' || u.role === 'createur') && (u.role === 'createur' || (u.clubs || []).includes(clubId)); };
// Félicitations reçues ce mois (du manager seulement).
function kudosRecus(uid, mk = curMonth()) { return Object.values(S.kudos || {}).filter(k => k && k.to === uid && isoOf(new Date(k.at)).slice(0, 7) === mk && estManagerDe(k.from, k.clubId)); }
// Bravos donnés aujourd'hui (réactions « bravo » à heure de ce jour).
function bravosDonnes(uid = ME.id, d = today()) {
  let n = 0; for (const rx of Object.values(S.reactions || {})) { const v = ((rx || {}).bravo || {})[uid]; if (typeof v === 'number' && isoOf(new Date(v)) === d) n++; }
  for (const m of Object.values(S.chat || {})) { const v = (((m || {}).reactions || {}).bravo || {})[uid]; if (typeof v === 'number' && isoOf(new Date(v)) === d) n++; }
  return n;
}
// Événements du fil : félicitations du manager (épinglées en tête 24 h).
function kudosEvenements(clubIds) {
  return Object.values(S.kudos || {}).filter(k => k && clubIds.includes(k.clubId) && S.users[k.from] && S.users[k.to]).map(k => ({ id: 'kz_' + k.id, kudosId: k.id, type: 'kudos', at: k.at, userId: k.to, fromId: k.from, clubId: k.clubId, label: `${S.users[k.from].first} félicite ${S.users[k.to].first} : ${KUDOS_RAISONS[k.reason] || 'Bravo'}`, sub: k.text || '', pinned: kudosEpingle(k), link: '#/profile' }));
}
// Trophée mensuel « Coup de coeur du manager ».
function tropheesCoeur() {
  const out = [];
  for (const c of Object.values(S.clubs)) for (const [mk, uid] of Object.entries(c.coeur || {})) if (S.users[uid]) out.push({ userId: uid, kind: 'month', icon: 'heart', label: `Coup de coeur du manager, ${MOIS[Number(mk.slice(5)) - 1].toLowerCase()}`, mk, at: dateOf(addMonths(mk, 1) + '-01').getTime() + 8 * 3600e3, clubId: c.id });
  return out;
}
function coeurCard(mk) {
  if (!isManager()) return '';
  const cur = deepGet(S, ['clubs', CLUB.id, 'coeur', mk]) || '';
  const L = clubMembers(CLUB.id).filter(u => !u.virtual && u.role === 'membre');
  return `<div class="card" id="coeur" style="margin-bottom:14px"><h3>Coup de coeur du manager · ${monthLabel(mk)}</h3><p class="muted small" style="margin-top:-4px">Un membre par mois : il reçoit le trophée Coup de coeur du manager.</p>
    <div class="row wrap" style="gap:8px"><select class="input" id="coeur-u" style="max-width:280px"><option value="">Personne</option>${L.map(u => `<option value="${u.id}" ${u.id === cur ? 'selected' : ''}>${esc(fullName(u))} (${plur(kudosRecus(u.id, mk).length, 'félicitation', 'félicitations')})</option>`).join('')}</select><button class="btn primary" data-act="coeurChoisir" data-mk="${mk}">Enregistrer</button></div></div>`;
}
ACTIONS.coeurChoisir = el => { if (!isManager()) return; const v = ($('#coeur-u') || {}).value || null; db.set(['clubs', CLUB.id, 'coeur', el.dataset.mk], v); toast(v ? `Coup de coeur : ${S.users[v].first}` : 'Coup de coeur retiré : 0 membre'); };
const MEM_CARNETS = memCarnets;
memCarnets = function () { return coeurCard(UI.recMonth || addMonths(curMonth(), -1)) + MEM_CARNETS(); }; // eslint-disable-line no-func-assign
// Bravo des collègues : 3 par jour au plus et par personne (fil et chat).
for (const act of ['react', 'chatReact']) {
  const avant = ACTIONS[act];
  ACTIONS[act] = el => {
    const base = act === 'react' ? (S.reactions[el.dataset.id] || {}) : (((S.chat || {})[el.dataset.id] || {}).reactions || {});
    const ajout = !((base.bravo || {})[ME.id]);
    if (el.dataset.em === 'bravo' && ajout && bravosDonnes() >= BRAVO_MAX_JOUR) { toast(`${BRAVO_MAX_JOUR} bravos par jour au plus : ${bravosDonnes()} donnés aujourd’hui`); return; }
    return avant(el);
  };
}
