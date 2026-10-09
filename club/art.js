/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — visuels sur mesure (vectoriels) ═══════════════════════════
// Couleur du club (--club, a defaut --brand) via currentColor, noir, blanc, gris.
// Formes inclinees de 8 degres, traits epais reguliers, lisibles a 20 px.
const ART_Y = 'currentColor', ART_K = '#0A0A0A', ART_G = '#9B9B9B', ART_W = '#FFFFFF';
const svgWrap = (size, body, label, vb = '0 0 120 140') => `<svg class="art" style="color:var(--fp)" width="${size}" height="${Math.round(size * (vb === '0 0 120 140' ? 140 / 120 : 1))}" viewBox="${vb}" role="img" aria-label="${esc(label)}">${body}</svg>`;

// ── Insignes de zone : Zone 1 a Zone 5 (mois valides) ─────────────────────
// Cinq barres montantes, remplies jusqu'a la zone atteinte, et le numero.
function zoneBadge(z, size = 40, { dim = false } = {}) {
  const n = Math.max(1, Math.min(5, (z && z.rang) || 1)); const label = (z && z.label) || TXT.zones.liste[n - 1].label;
  const bars = [0, 1, 2, 3, 4].map(i => { const h = 18 + i * 12, x = 16 + i * 18; return `<rect x="${x}" y="${92 - h}" width="12" height="${h}" rx="3" fill="${i < n ? ART_Y : ART_G}" opacity="${i < n ? 1 : 0.35}"/>`; }).join('');
  const body = `<rect x="4" y="4" width="112" height="112" rx="24" fill="${ART_K}" stroke="${ART_Y}" stroke-width="5"/>${bars}<text x="60" y="110" text-anchor="middle" font-family="Montserrat, sans-serif" font-weight="800" font-size="15" letter-spacing="1" fill="${ART_W}">ZONE ${n}</text>`;
  return `<span class="lvl-badge${dim ? ' dim' : ''}" title="${esc(label)}">${svgWrap(size, body, label, '0 0 120 120')}</span>`;
}

// ── Insignes de palier d'equipe P1, P2, P3 ────────────────────────────────
function palierBadge(n, size = 28, reached = true) {
  const full = n >= 2, rays = n >= 3;
  const body = `<g transform="skewX(-8) translate(8 0)">${rays ? `<path d="M60 2 v10 M20 14 l7 8 M100 14 l-7 8 M4 56 h12 M104 56 h12" stroke="${ART_Y}" stroke-width="6" stroke-linecap="round"/>` : ''}
    <path d="M16 24 L104 24 L104 92 L60 116 L16 92 Z" fill="${full ? ART_Y : ART_K}" stroke="${ART_Y}" stroke-width="7" stroke-linejoin="round"/>${rays ? `<path d="M26 32 L94 32 L94 88 L60 106 L26 88 Z" fill="none" stroke="${ART_K}" stroke-width="4"/>` : ''}
    <text x="60" y="48" text-anchor="middle" font-family="Montserrat, sans-serif" font-weight="800" font-size="12" letter-spacing="2" fill="${full ? ART_K : ART_Y}">PALIER</text>
    <text x="60" y="96" text-anchor="middle" font-family="Barlow Condensed, Impact, sans-serif" font-style="italic" font-weight="900" font-size="56" fill="${full ? ART_K : ART_Y}">${n}</text></g>`;
  return `<span class="pal-badge${reached ? '' : ' dim'}">${svgWrap(size, body, `Palier ${n}${reached ? ' atteint' : ''}`, '0 0 128 124')}</span>`;
}

// ── Trophees et medailles ─────────────────────────────────────────────────
const TONES = { gold: [ART_Y, ART_K], silver: ['#C9C9CC', ART_K], bronze: ['#C8834A', ART_K] };
function trophyArt(t, size = 48, locked = false) {
  const lab = t && t.label ? t.label : 'Trophée';
  if (locked) return svgWrap(size, `<g opacity=".45"><path d="M38 24 h44 v26 a22 22 0 0 1-44 0z M60 72 v18 M44 98 h32" fill="none" stroke="${ART_G}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/></g><rect x="66" y="78" width="34" height="28" rx="5" fill="${ART_G}"/><path d="M73 78 v-8 a10 10 0 0 1 20 0 v8" fill="none" stroke="${ART_G}" stroke-width="6"/>`, lab + ' (à débloquer)', '0 0 120 120');
  const k = t.kind, icon = t.icon;
  let body;
  if (icon === 'medal' || k === 'week') {
    const [c, ink] = TONES[t.tone] || TONES.gold; const num = { gold: 1, silver: 2, bronze: 3 }[t.tone] || 1;
    body = `<path d="M40 6 L60 44 L80 6 Z" fill="${ART_K}" stroke="${c}" stroke-width="5"/><circle cx="62" cy="74" r="38" fill="${ink}"/><circle cx="60" cy="72" r="36" fill="${c}" stroke="${ART_K}" stroke-width="6"/><text x="60" y="90" text-anchor="middle" font-family="Barlow Condensed, Impact, sans-serif" font-style="italic" font-weight="900" font-size="48" fill="${ART_K}">${num}</text>`;
  } else if (icon === 'crown' || k === 'season') {
    body = `<path d="M18 86 L28 34 L46 60 L60 26 L74 60 L92 34 L102 86 Z" fill="${ART_Y}" stroke="${ART_K}" stroke-width="7" stroke-linejoin="round"/><rect x="18" y="88" width="84" height="16" rx="3" fill="${ART_K}"/><circle cx="60" cy="70" r="7" fill="${ART_K}"/>`;
  } else if (icon === 'bolt' || k === 'flash') {
    body = `<path d="M60 8 L104 32 L104 84 L60 110 L16 84 L16 32 Z" fill="${ART_K}" stroke="${ART_Y}" stroke-width="6"/><path d="M66 22 L40 64 H58 L52 98 L80 52 H62 Z" fill="${ART_Y}"/>`;
  } else if (icon === 'trophy' || k === 'month') {
    body = `<path d="M34 16 H86 V48 A26 26 0 0 1 34 48 Z" fill="${ART_Y}" stroke="${ART_K}" stroke-width="7" stroke-linejoin="round"/><path d="M34 24 H18 V32 A16 16 0 0 0 36 50 M86 24 H102 V32 A16 16 0 0 1 84 50" fill="none" stroke="${ART_K}" stroke-width="7"/><path d="M60 74 V90 M40 104 H80 L76 90 H44 Z" fill="${ART_K}" stroke="${ART_K}" stroke-width="7" stroke-linejoin="round"/>`;
  } else {
    body = `<rect x="20" y="14" width="80" height="92" rx="8" fill="${ART_K}" stroke="${ART_Y}" stroke-width="6"/><circle cx="60" cy="56" r="26" fill="none" stroke="${ART_Y}" stroke-width="6"/><circle cx="60" cy="56" r="12" fill="${ART_Y}"/><rect x="34" y="88" width="52" height="8" rx="2" fill="${ART_Y}"/>`;
  }
  return svgWrap(size, `<g transform="skewX(-6) translate(6 0)">${body}</g>`, lab, '0 0 120 120');
}

// ── Etats vides illustres : une image, une phrase, un bouton ──────────────
const EMPTY_ART = {
  pouls: `<path d="M20 120 L60 20 M60 120 L82 20 M100 120 L104 20 M140 120 L126 20 M180 120 L148 20" stroke="currentColor" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M14 96 H186" stroke="var(--fp)" stroke-width="10" stroke-linecap="round"/>`,
  chat: `<path d="M30 30 H150 A14 14 0 0 1 164 44 V88 A14 14 0 0 1 150 102 H80 L52 124 V102 H30 A14 14 0 0 1 16 88 V44 A14 14 0 0 1 30 30 Z" fill="var(--fp)" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><path d="M46 60 H130 M46 78 H104" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`,
  todo: `<path d="M50 26 a12 12 0 0 1 12-12 h8 l10 26 -12 8 a64 64 0 0 0 30 30 l8-12 26 10 v8 a12 12 0 0 1-12 12 C76 96 50 70 50 26 Z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><circle cx="146" cy="44" r="26" fill="var(--fp)" stroke="currentColor" stroke-width="6"/><path d="M134 44 l8 8 16-16" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  challenge: `<circle cx="100" cy="74" r="46" fill="var(--fp)" stroke="currentColor" stroke-width="6"/><path d="M100 74 V44 M88 18 H112 M100 18 V28 M140 36 l8-8" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><text x="100" y="92" text-anchor="middle" font-family="Barlow Condensed, Impact" font-style="italic" font-weight="900" font-size="22" fill="currentColor">00:00</text>`,
  done: `<path d="M24 112 H176 M44 112 V62 M156 112 V62" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><rect x="34" y="40" width="20" height="44" rx="4" fill="var(--fp)" stroke="currentColor" stroke-width="6"/><rect x="146" y="40" width="20" height="44" rx="4" fill="var(--fp)" stroke="currentColor" stroke-width="6"/><path d="M54 62 H146" stroke="currentColor" stroke-width="8"/><circle cx="100" cy="28" r="18" fill="none" stroke="currentColor" stroke-width="6"/><path d="M91 28 l6 6 12-12" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  target: `<circle cx="90" cy="70" r="50" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="90" cy="70" r="30" fill="var(--fp)" stroke="currentColor" stroke-width="6"/><circle cx="90" cy="70" r="10" fill="currentColor"/><path d="M150 20 L170 40 L130 80 L110 86 L116 66 Z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>`,
};
function emptyBox({ art = 'done', title, text = '', cta = '' }) {
  return `<div class="empty empty-art"><svg class="empty-svg" width="200" height="140" viewBox="0 0 200 140" aria-hidden="true"><g transform="skewX(-8) translate(10 0)">${EMPTY_ART[art] || EMPTY_ART.done}</g></svg><div class="title">${title}</div>${text ? `<p>${text}</p>` : ''}${cta}</div>`;
}
