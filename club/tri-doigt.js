/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
'use strict';
// ══ FIT PULSE : réordonner au doigt, à la souris et au clavier ════════════
// Pointer Events (le glisser HTML5 ne marche pas au toucher) :
//  - appui long de 350 ms sur une ligne (ou appui direct sur la poignée à la
//    souris), puis on déplace un clone flottant ; une place vide montre où la
//    ligne va tomber ; on lâche pour enregistrer ;
//  - au clavier : flèches haut et bas quand la poignée a le focus.
// Un conteneur porte data-tri="<nom>" ; ses lignes portent data-tri-id.
// TRI_CIBLES[nom](ids) enregistre le nouvel ordre.
const TRI_CIBLES = {};
const TRI_APPUI_MS = 350;
let TRI = null; // geste en cours

function triIds(root) { return [...root.querySelectorAll('[data-tri-id]')].filter(x => x.closest('[data-tri]') === root && !x.classList.contains('tri-cache')).map(x => x.dataset.triId); }
function triFin(root, ids) { const f = TRI_CIBLES[root.dataset.tri]; if (f) f(ids); }

function triDemarrer() {
  const t = TRI; if (!t || t.actif) return;
  t.actif = true; fx.tap();
  const r = t.it.getBoundingClientRect(); t.dx = t.x - r.left; t.dy = t.y - r.top;
  const place = document.createElement(t.it.tagName === 'TR' ? 'tr' : t.it.tagName === 'LI' ? 'li' : 'div'); place.className = 'tri-place';
  if (t.it.tagName === 'TR') { const td = document.createElement('td'); td.colSpan = t.it.children.length; place.appendChild(td); }
  place.style.height = r.height + 'px';
  const clone = document.createElement('div'); clone.className = 'tri-clone'; clone.setAttribute('aria-hidden', 'true');
  clone.textContent = (t.it.querySelector('[data-tri-label]') || t.it).textContent.trim().replace(/\s+/g, ' ').slice(0, 60);
  Object.assign(clone.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: Math.min(r.height, 72) + 'px' });
  t.it.parentNode.insertBefore(place, t.it); t.it.classList.add('tri-cache'); document.body.appendChild(clone); document.body.classList.add('tri-en-cours');
  t.place = place; t.clone = clone;
}
function triBouger(x, y) {
  const t = TRI; if (!t || !t.actif) return;
  t.clone.style.top = (y - t.dy) + 'px';
  const L = [...t.root.querySelectorAll('[data-tri-id]')].filter(e => e.closest('[data-tri]') === t.root && e !== t.it);
  const avant = L.find(e => { const r = e.getBoundingClientRect(); return y < r.top + r.height / 2; });
  if (avant) { if (t.place.nextSibling !== avant) avant.parentNode.insertBefore(t.place, avant); }
  else if (L.length) { const der = L[L.length - 1]; if (der.nextSibling !== t.place) der.parentNode.insertBefore(t.place, der.nextSibling); }
}
function triArreter(valider) {
  const t = TRI; TRI = null; if (!t) return;
  clearTimeout(t.timer);
  if (!t.actif) return;
  t.place.parentNode.insertBefore(t.it, t.place); t.place.remove(); t.clone.remove(); t.it.classList.remove('tri-cache'); document.body.classList.remove('tri-en-cours');
  if (valider) { const ids = triIds(t.root); if (ids.join() !== t.avant.join()) triFin(t.root, ids); }
}
document.addEventListener('pointerdown', e => {
  if (e.button > 0 || TRI) return;
  const it = e.target.closest && e.target.closest('[data-tri-id]'); if (!it) return;
  const root = it.closest('[data-tri]'); if (!root || (e.target.closest('button,a,input,select,textarea') && !e.target.closest('.tri-poignee'))) return;
  const poignee = !!e.target.closest('.tri-poignee');
  TRI = { root, it, x: e.clientX, y: e.clientY, id: e.pointerId, actif: false, avant: triIds(root) };
  if (poignee && e.pointerType === 'mouse') { e.preventDefault(); triDemarrer(); return; }
  TRI.timer = setTimeout(triDemarrer, TRI_APPUI_MS);
});
document.addEventListener('pointermove', e => {
  if (!TRI || e.pointerId !== TRI.id) return;
  if (!TRI.actif) { if (Math.hypot(e.clientX - TRI.x, e.clientY - TRI.y) > 8) triArreter(false); return; } // le doigt défile : pas d'appui long
  e.preventDefault(); triBouger(e.clientX, e.clientY);
});
document.addEventListener('pointerup', e => { if (TRI && e.pointerId === TRI.id) triArreter(true); });
document.addEventListener('pointercancel', e => { if (TRI && e.pointerId === TRI.id) triArreter(false); });
// Pendant un déplacement au doigt, la page ne défile pas.
document.addEventListener('touchmove', e => { if (TRI && TRI.actif) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', e => { if (TRI || (e.target.closest && e.target.closest('[data-tri] [data-tri-id]'))) e.preventDefault(); });
document.addEventListener('keydown', e => {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  const h = e.target.closest && e.target.closest('.tri-poignee'); if (!h) return;
  const it = h.closest('[data-tri-id]'); const root = it && it.closest('[data-tri]'); if (!root) return;
  e.preventDefault();
  const ids = triIds(root); const i = ids.indexOf(it.dataset.triId), j = i + (e.key === 'ArrowUp' ? -1 : 1);
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]]; triFin(root, ids);
});
// Poignée : un bouton focalisable, nommé, qui garde le focus après le rendu.
const triPoignee = (id, label) => `<button type="button" class="tri-poignee" data-focus="tri-${esc(id)}" aria-label="Déplacer ${esc(label)}, flèches haut et bas" title="Appui long ou flèches pour déplacer">${ico('menu', 'ico ico-xs')}</button>`;
