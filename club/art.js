/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — visuels sur mesure ═════════════════════════════════════════
// Traits réguliers, aplats neutres ; l'accent du club (--accent) ne colore que les
// parties actives (barres d'un niveau, parties bleues des états vides).
const svgWrap = (size, body, label, vb = '0 0 64 64') => `<svg class="art" width="${size}" height="${size}" viewBox="${vb}" role="img" aria-label="${esc(label)}">${body}</svg>`;

// ── Niveaux : Recrue, Confirmé, Expert, Référent (planche assets/brand/level1..4.png) ──
// Hexagone neutre, 1 à 3 barres en accent ; Référent ajoute un anneau extérieur.
const HEXA = (r, cx = 32, cy = 32) => [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 180 * (60 * i - 90); return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
function zoneBadge(z, size = 24, { dim = false } = {}) {
  const n = Math.max(1, Math.min(4, (z && z.rang) || 1)); const label = (z && z.label) || TXT.zones.liste[n - 1].label; const nb = Math.min(3, n);
  const bars = Array.from({ length: nb }, (_, i) => { const w = 8, g = 3, x0 = 32 - (nb * w + (nb - 1) * g) / 2, h = [10, 16, 22][3 - nb + i]; return `<rect x="${(x0 + i * (w + g)).toFixed(1)}" y="${43 - h}" width="${w}" height="${h}" rx="2" fill="var(--accent)"/>`; }).join('');
  const body = `${n === 4 ? `<polygon points="${HEXA(31)}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>` : ''}<polygon points="${HEXA(n === 4 ? 25 : 28)}" fill="var(--surface-2)" stroke="var(--text)" stroke-width="3.5" stroke-linejoin="round"/>${bars}`;
  return `<span class="lvl-badge${dim ? ' dim' : ''}" title="${esc(label)}">${svgWrap(size, body, label)}</span>`;
}
const levelBadge = zoneBadge;

// ── Paliers d'équipe P1, P2, P3 : pastille pleine une fois atteint ──────────
function palierBadge(n, size = 24, reached = true) {
  const body = `<circle cx="32" cy="32" r="27" fill="${reached ? 'var(--text)' : 'none'}" stroke="${reached ? 'var(--text)' : 'var(--line)'}" stroke-width="4"/><text x="32" y="41" text-anchor="middle" class="art-t" fill="${reached ? 'var(--surface)' : 'var(--muted)'}">P${n}</text>`;
  return `<span class="pal-badge${reached ? '' : ' dim'}">${svgWrap(size, body, `Palier ${n}${reached ? ' atteint' : ''}`)}</span>`;
}

// ── Trophées : cercle au trait et pictogramme ; rang 1, 2, 3 en chiffre ─────
function trophyArt(t, size = 48, locked = false) {
  const lab = t && t.label ? t.label : 'Trophée'; const k = t && t.kind, icon = t && t.icon;
  const rang = icon === 'medal' || k === 'week' ? ({ gold: 1, silver: 2, bronze: 3 }[t.tone] || 1) : null;
  const pict = rang ? `<text x="32" y="42" text-anchor="middle" class="art-t art-t-l" fill="var(--text)">${rang}</text>` : `<g transform="translate(18 18) scale(1.17)" fill="none" stroke="var(--text)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[icon === 'crown' || k === 'season' ? 'flag' : icon === 'bolt' || k === 'flash' ? 'pouls' : icon === 'trophy' || k === 'month' ? 'ranking' : 'target']}</g>`;
  return svgWrap(size, `<g opacity="${locked ? 0.35 : 1}"><circle cx="32" cy="32" r="28" fill="var(--surface)" stroke="${locked ? 'var(--line)' : 'var(--text)'}" stroke-width="3"/>${pict}</g>`, lab + (locked ? ' (à obtenir)' : ''));
}

// ── États vides : une image de 160 px (traits neutres, parties en accent), une phrase, un bouton ──
// Images : assets/brand/empty-1..8.png (traits) et empty-N-a.png (parties en accent), en masques CSS.
const EMPTY_IMG = { done: 1, todo: 2, eur: 3, cal: 4, import: 5, board: 6, chat: 7, pouls: 7, target: 8, challenge: 8 };
function emptyState(o) {
  if (o === undefined) return etatInitial(); // sans argument : état initial de la base (core.js)
  const { img = 1, title, text = '', action = '' } = o;
  const n = typeof img === 'number' ? img : EMPTY_IMG[img] || 1;
  return `<div class="empty empty-state"><span class="empty-img e${n}" aria-hidden="true"><i></i><i></i></span><div class="empty-t">${title}</div>${text ? `<p>${text}</p>` : ''}${action ? `<div class="empty-a">${action}</div>` : ''}</div>`;
}
// Ancien nom : art (clé d'image), cta (bouton).
function emptyBox({ art = 'done', img, title, text = '', cta = '', action = '' }) { return emptyState({ img: img || art, title, text, action: action || cta }); }
