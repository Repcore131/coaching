/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
'use strict';
// ══ FIT PULSE : réactions, commentaires, bilan partagé ═══════════════════
// Réactions Bravo, Fort, Merci (core.js) : prénoms au survol et à l'appui long.
// Commentaire court sous un événement du fil : 140 caractères, un niveau,
// notifié à l'auteur. Bilan du mois : « Partager à l'équipe » publie une carte
// dans le fil (score, rang s'il est dans la moitié haute, meilleur indicateur
// en %, trophées) ; « Enregistrer l'image » produit une image sans aucun
// montant : seulement des pourcentages et des quantités.
//   S.comments[cle][id] = { id, evId, by, to, text, at }
const COMMENT_MAX = 140;
const cleCommentaire = evId => 'c' + graineTexte(evId).toString(36);

// ── Prénoms à l'appui long sur une réaction ───────────────────────────────
let REACT_APPUI = null; let REACT_LONG = false;
document.addEventListener('pointerdown', e => {
  const b = e.target.closest && e.target.closest('[data-noms]'); if (!b) return; REACT_LONG = false;
  REACT_APPUI = setTimeout(() => { REACT_LONG = true; toast(b.dataset.noms || 'Personne pour l’instant'); fx.tap(); }, 500);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => document.addEventListener(t, () => { clearTimeout(REACT_APPUI); }, true));
document.addEventListener('click', e => { if (REACT_LONG && e.target.closest && e.target.closest('[data-noms]')) { e.stopPropagation(); e.preventDefault(); REACT_LONG = false; } }, true);
// Prénoms de ceux qui ont réagi (titre et appui long).
function nomsReaction(rx, cle) { const L = (reactionsDe(rx)[cle] || []).map(u => (S.users[u] || {}).first || '?'); return L.length ? `${REACTIONS[cle][1]} : ${L.join(', ')}` : `${REACTIONS[cle][1]} : personne pour l’instant`; }

// ── Commentaires ──────────────────────────────────────────────────────────
const commentairesDe = evId => Object.values(((S.comments || {})[cleCommentaire(evId)]) || {}).filter(Boolean).sort((a, b) => a.at - b.at);
function commentairesBloc(ev) {
  const L = commentairesDe(ev.id);
  return `<div class="fil-com" data-com="${esc(ev.id)}">${L.map(c => `<div class="fil-com-l"><b>${esc((S.users[c.by] || {}).first || '?')}</b> ${esc(c.text)}</div>`).join('')}
    <form class="row fil-com-f" onsubmit="return false"><input class="input" name="t" maxlength="${COMMENT_MAX}" placeholder="Commenter" aria-label="Commenter"><button class="btn sm" data-act="commenter" data-ev="${esc(ev.id)}" data-to="${esc(ev.userId || '')}">Envoyer</button></form></div>`;
}
function commentOps(evId, to, text) {
  const t = String(text || '').trim().slice(0, COMMENT_MAX); if (!t || !ME) return [];
  const id = newId(); return [[['comments', cleCommentaire(evId), id], { id, evId, by: ME.id, to: to && S.users[to] ? to : null, text: t, at: Date.now() }]];
}
ACTIONS.commenter = el => { const f = el.closest('form'); const i = f && f.querySelector('[name=t]'); const ops = commentOps(el.dataset.ev, el.dataset.to, i && i.value); if (!ops.length) return; db.batch(ops); toast('1 commentaire publié'); };

// ── Bilan du mois : données partagées, sans montant ───────────────────────
function bilanPartage(uid, mk) {
  const u = S.users[uid]; const clubId = (u.clubs || []).includes(CLUB.id) ? CLUB.id : (u.clubs || [])[0];
  const r = rangeOf('month', mk); const st = statsFor(clubId, uid, r, { requiredOnly: true }); const all = statsFor(clubId, uid, r);
  const rk = ranking(clubId, r).filter(x => x.score != null); const me = rk.findIndex(x => x.u.id === uid);
  const best = all.rows.filter(x => x.pct != null && x.target > 0).sort((a, b) => b.pct - a.pct)[0];
  const act = wrapActions(uid, mk);
  return { mk, score: st.score == null ? null : Math.round(st.score * 100), rang: me >= 0 && me < Math.ceil(rk.length / 2) ? me + 1 : null, sur: rk.length, best: best ? { kpiId: best.k.id, label: best.k.label, pct: Math.round(best.pct * 100) } : null, trophees: trophies(uid).filter(t => t.mk === mk).length, relances: act.good, sauves: act.saved };
}
// Lignes de l'image et de la carte du fil : pourcentages et quantités seulement.
function bilanLignes(B) {
  return [B.score == null ? null : ['Score du mois', `${B.score} %`], B.rang ? ['Classement', `${B.rang}${B.rang === 1 ? 'er' : 'e'} sur ${B.sur}`] : null, B.best ? ['Meilleur indicateur', `${B.best.label} ${B.best.pct} %`] : null, ['Trophées', String(B.trophees)], ['Relances abouties', String(B.relances)], ['Clients sauvés', String(B.sauves)]].filter(Boolean);
}
ACTIONS.bilanPartager = el => {
  const mk = el.dataset.mk; const B = bilanPartage(ME.id, mk); const id = newId();
  db.set(['chat', id], { id, channel: CLUB.id, userId: ME.id, at: Date.now(), text: '', wrap: B });
  toast(`Bilan de ${MOIS[Number(mk.slice(5)) - 1].toLowerCase()} partagé à l’équipe`);
};
const bilanTexteFil = (u, B) => `${u.first} partage son bilan de ${MOIS[Number(B.mk.slice(5)) - 1].toLowerCase()}${B.score != null ? ` : ${B.score} %` : ''}${B.rang ? `, ${B.rang}${B.rang === 1 ? 'er' : 'e'}` : ''}${B.best ? `, meilleur indicateur ${B.best.label} ${B.best.pct} %` : ''}, ${plur(B.trophees, 'trophée', 'trophées')}`;
function bilanEvenements(clubIds) {
  return Object.values(S.chat || {}).filter(m => m && m.wrap && clubIds.includes(m.channel) && S.users[m.userId]).map(m => ({ id: 'wr_' + m.id, type: 'trophy', at: m.at, userId: m.userId, clubId: m.channel, label: bilanTexteFil(S.users[m.userId], m.wrap), icon: 'chart', link: `#/wrap/${m.wrap.mk}/${m.userId}` }));
}

// ── Image du bilan (canvas) : aucun symbole euro, aucun tiret long ─────────
function drawWrapCard(uid, mk, canvas = document.createElement('canvas')) {
  const B = bilanPartage(uid, mk); const u = S.users[uid]; const W = 1080, H = 1350; canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d'); const police = FONT_PAIR === 'plex' ? '"IBM Plex Sans"' : 'Geist';
  c.fillStyle = '#111317'; c.fillRect(0, 0, W, H); c.fillStyle = '#F2C500'; c.fillRect(0, 0, W, 16);
  const txt = (t, x, y, taille, coul = '#FFFFFF', poids = 600) => { c.fillStyle = coul; c.font = `${poids} ${taille}px ${police}, sans-serif`; c.fillText(String(t).replace(/[€\u2013\u2014]/g, ''), x, y); };
  txt('Fit Pulse', 80, 130, 40, '#F2C500', 700); txt(`Bilan de ${monthLabel(mk).toLowerCase()}`, 80, 200, 44, '#C9CCD3', 500);
  txt(fullName(u), 80, 290, 72, '#FFFFFF', 700);
  bilanLignes(B).forEach(([l, v], i) => { const y = 430 + i * 140; c.fillStyle = '#1C1F25'; c.fillRect(80, y - 70, W - 160, 112); txt(l, 120, y, 34, '#C9CCD3', 500); c.textAlign = 'right'; txt(v, W - 120, y + 8, 52, '#FFFFFF', 700); c.textAlign = 'left'; });
  txt('Chiffres en pourcentage et en quantité, sans aucun montant.', 80, H - 70, 28, '#8A8F99', 500);
  return { canvas, lignes: bilanLignes(B) };
}
ACTIONS.bilanImage = async el => {
  const ok = await confirmDlg('Cette image peut sortir du club. Elle ne contient aucun montant.', { ok: 'Enregistrer l’image' }); if (!ok) return;
  if (typeof policesPretes === 'function') await policesPretes();
  const { canvas } = drawWrapCard(ME.id, el.dataset.mk);
  canvas.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `bilan-${el.dataset.mk}.png`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast('1 image enregistrée, sans montant'); }, 'image/png');
};
// Boutons du bilan : Partager à l'équipe (principal), Enregistrer l'image.
const WRAP_RENDER = PAGES.wrap.render;
PAGES.wrap.render = function (args) {
  const h = WRAP_RENDER.call(this, args); const [mk, uid0] = args || []; const uid = uid0 && S.users[uid0] ? uid0 : ME.id;
  if (uid !== ME.id || !/^\d{4}-\d{2}$/.test(mk || '')) return h;
  return h.replace('<button class="btn primary sm" onclick="print()">', `<button class="btn primary sm" data-act="bilanPartager" data-mk="${mk}">${ico('share')} Partager à l’équipe</button><button class="btn sm" data-act="bilanImage" data-mk="${mk}">${ico('download')} Enregistrer l’image</button><button class="btn sm" onclick="print()">`);
};
