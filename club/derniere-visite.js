/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
'use strict';
// ══ FIT PULSE : carte « Depuis ta dernière visite » ══════════════════════
// En haut de l'accueil, 4 lignes au plus, par ordre de priorité : rang,
// nouvelles relances à mon nom, palier d'équipe qui se rapproche, bravos
// reçus, défi en cours. Chaque ligne mène à l'écran concerné. Rien de neuf :
// une seule ligne, la prochaine micro-action. Pas de carte si la dernière
// visite date de moins de 20 minutes. « Vu » masque la carte jusqu'à la
// prochaine nouveauté. L'instantané (prefs.seen) est écrit 3 s après
// l'affichage : home, rank, dossiers, paliers.
const DELTA_MIN_MS = 20 * 60e3;
const DELTA_MAX = 4;

function mesDossiers() { const t = myToDo(); return [...t.res.map(r => 'r' + r.id), ...t.dun.map(c => 'd' + c.id)].sort(); }
function rangInstant() {
  const mk = curMonth(); const rk = ranking(CLUB.id, rangeOf('month', mk)).filter(x => x.score != null); const i = rk.findIndex(x => x.u.id === ME.id);
  return i < 0 ? null : { mk, club: CLUB.id, rank: i + 1, devant: rk.slice(0, i).map(x => x.u.id) };
}
function paliersInstant() { const mk = curMonth(); const o = {}; Object.keys(paliersFor(CLUB.id, mk)).forEach(k => { const s = palierState(CLUB.id, mk, k); if (s && s.next) o[k] = Math.ceil(s.next.target - s.real); }); return { mk, club: CLUB.id, ecarts: o }; }
const rangTexte = n => `${n}${n === 1 ? 'er' : 'e'}`;

function deltaLignes(seen) {
  const L = []; const last = Number(seen.home || 0);
  // 1. rang
  const R = rangInstant(); const R0 = seen.rank;
  if (R && R0 && R0.mk === R.mk && R0.club === R.club && R0.rank !== R.rank) {
    if (R.rank < R0.rank) L.push({ k: 'rang', t: `Tu passes ${rangTexte(R.rank)}`, href: '#/leaderboard' });
    else {
      const qui = R.devant.find(id => !(R0.devant || []).includes(id)); const cause = `${R.mk}|${qui || R.rank}`;
      if (cause !== seen.rankCause) L.push({ k: 'rang', cause, t: `Tu perds ${plur(R.rank - R0.rank, 'place', 'places')}${qui && S.users[qui] ? `, ${S.users[qui].first} est passé devant` : ''}`, href: '#/leaderboard' });
    }
  }
  // 2. nouvelles relances à mon nom
  const avant = new Set(seen.dossiers || []); const neufs = mesDossiers().filter(id => !avant.has(id));
  if (seen.dossiers && neufs.length) L.push({ k: 'relances', t: `${neufs.length} ${neufs.length > 1 ? 'nouvelles relances' : 'nouvelle relance'} à ton nom`, href: '#/relances' });
  // 3. palier d'équipe plus proche
  const P = paliersInstant(); const P0 = seen.paliers;
  if (P0 && P0.mk === P.mk && P0.club === P.club) {
    const k = Object.keys(P.ecarts).filter(id => P0.ecarts && P0.ecarts[id] != null && P.ecarts[id] < P0.ecarts[id]).sort((a, b) => P.ecarts[a] - P.ecarts[b])[0];
    if (k && S.kpis[k]) L.push({ k: 'palier', t: `Palier ${S.kpis[k].label.toLowerCase()} : encore ${fmtU(P.ecarts[k], S.kpis[k])}`, href: '#/home' });
  }
  // 4. bravos reçus sur mes ventes
  let bravos = 0;
  for (const [eid, rx] of Object.entries(S.reactions || {})) { const e = S.entries[eid]; if (!e || e.userId !== ME.id) continue; for (const [uid, v] of Object.entries((rx || {}).bravo || {})) if (uid !== ME.id && typeof v === 'number' && v > last) bravos++; }
  if (bravos) L.push({ k: 'bravo', t: `${plur(bravos, 'bravo reçu', 'bravos reçus')}`, href: '#/pouls' });
  // 5. défi en cours
  const ch = typeof defiEnCours === 'function' ? defiEnCours() : null;
  if (ch) { const rk = challengeRanking(ch); const i = rk.findIndex(x => x.u.id === ME.id); if (i >= 0) L.push({ k: 'defi', t: `Défi ${ch.title || ''} : tu es ${rangTexte(i + 1)}, fin dans ${finDans(ch.end)}`.replace(/\s+:/, ' :'), href: '#/leaderboard' }); }
  return L.slice(0, DELTA_MAX);
}
// Instantané écrit après l'affichage (et au bouton Vu).
function deltaEnregistrer(extra = {}) {
  if (!ME || !CLUB) return;
  const s = UI.deltaVisite; const cause = s && s.lignes.find(l => l.cause);
  setPrefPath(['seen'], { ...prefsOf().seen, home: Date.now(), rank: rangInstant(), dossiers: mesDossiers(), paliers: paliersInstant(), ...(cause ? { rankCause: cause.cause } : {}), ...extra });
}
function deltaCard() {
  if (!ME || !CLUB) return '';
  // Une ouverture de l'accueil = un calcul ; les rendus suivants de la même visite reprennent le même contenu.
  if (UI._lastRoute !== 'home' || !UI.deltaVisite || UI.deltaVisite.uid !== ME.id) {
    const seen = prefsOf().seen; const last = Number(seen.home || 0);
    const recent = last && Date.now() - last < DELTA_MIN_MS;
    const lignes = recent ? [] : deltaLignes(seen);
    const vu = Number(seen.homeVu || 0) >= last && last > 0;
    let affiche = !recent && (lignes.length || !vu);
    if (affiche && !lignes.length) { const m = prochaineMicroAction(); if (m) lignes.push({ k: 'action', t: m.label, href: m.link }); else affiche = false; }
    UI.deltaVisite = { uid: ME.id, lignes, affiche };
    // Carte masquée par « Vu » et rien de neuf : elle reste masquée à la visite suivante.
    if (!recent && !CFG.capture) setTimeout(() => { if (UI.deltaVisite && UI.deltaVisite.uid === ME.id) deltaEnregistrer(!affiche && vu ? { homeVu: Date.now() + 1 } : {}); }, 3000);
  }
  const V = UI.deltaVisite; if (!V.affiche || !V.lignes.length) return '';
  return `<div class="card col12 delta" id="delta"><div class="race-h"><div><h3>Depuis ta dernière visite</h3></div><span class="spacer"></span><button class="btn sm" data-act="deltaVu">Vu</button></div>
    <ul class="delta-l">${V.lignes.slice(0, DELTA_MAX).map(l => `<li data-ligne="${l.k}"><a href="${l.href}">${esc(l.t)}${ico('chevR', 'ico ico-xs')}</a></li>`).join('')}</ul></div>`;
}
ACTIONS.deltaVu = () => { if (UI.deltaVisite) UI.deltaVisite.affiche = false; deltaEnregistrer({ homeVu: Date.now() + 1 }); render(); };
