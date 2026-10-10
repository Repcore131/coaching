/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — mise en route d'un club (accueil manager) ═════════════════
// Sept étapes cochées d'après les données, chacune avec un bouton « Faire » qui
// ouvre le bon écran et une durée indicative. La carte se masque à la main ;
// une fois les sept étapes faites, elle ne revient plus (préférence du manager).

function miseEnRouteEtapes(clubId = CLUB.id) {
  const routine = deepGet(S, ['rsm', 'routine', clubId]) || {}; const mk = curMonth();
  const equipe = Object.values(S.users || {}).filter(u => u && !u.virtual && (u.clubs || []).includes(clubId) && u.status !== 'archived');
  const membres = equipe.filter(u => u.role === 'membre' && u.status === 'active');
  const kpis = kpiList().filter(k => k.required);
  const objectifs = membres.length > 0 && membres.every(u => kpis.some(k => Number(deepGet(S, ['targets', mk, u.id, k.id])) > 0));
  const nr = deepGet(S, ['rsm', 'nonRattaches', clubId]);
  return [
    { cle: 'club', label: 'Club créé avec nom et logo', fait: !!(tenant().name || (S.clubs[clubId] || {}).name), detail: clubLogo() ? '' : 'Ajoutez votre logo dans Réglages', min: 2, go: ['clubs', 'clubTab', 'settings'] },
    { cle: 'equipe', label: 'Au moins 3 membres invités', fait: equipe.filter(u => u.id !== ME.id).length >= 3, detail: `${equipe.filter(u => u.id !== ME.id).length} sur 3`, min: 3, go: ['members', 'memTab', 'org'] },
    { cle: 'objectifs', label: 'Objectifs du mois pour chaque membre', fait: objectifs, detail: membres.length ? `${membres.filter(u => kpis.some(k => Number(deepGet(S, ['targets', mk, u.id, k.id])) > 0)).length} sur ${membres.length}` : 'aucun membre actif', min: 5, go: ['members', 'memTab', 'targets'] },
    { cle: 'ventes', label: 'Premier export « ventes » importé', fait: !!routine.ventes, min: 3, go: ['imports', 'impTab', 'rsm'] },
    { cle: 'clients', label: 'Export « clients » importé : la rétention génère ses tâches', fait: !!routine.clients, min: 3, go: ['imports', 'impTab', 'rsm'] },
    { cle: 'incidents', label: 'Export « clients en incident » importé : la page Impayés se remplit', fait: !!routine['clients-incident'], min: 2, go: ['imports', 'impTab', 'rsm'] },
    { cle: 'correspondances', label: 'Correspondances Resamania complètes', fait: !!nr && nr.n === 0, detail: nr ? (nr.n ? `${plur(nr.n, 'vendeur non rattaché', 'vendeurs non rattachés')} au dernier import` : '') : 'après le premier import', min: 2, go: ['members', 'memTab', 'aliases'] },
  ];
}
function miseEnRouteCard() {
  if (!isManager() || pref('miseEnRouteMasquee', false) || pref('miseEnRouteFinie', false)) return '';
  const E = miseEnRouteEtapes(); const n = E.filter(e => e.fait).length;
  if (n === E.length) { setTimeout(() => { if (!pref('miseEnRouteFinie', false)) setPref('miseEnRouteFinie', true); }, 0); return ''; }
  const reste = E.filter(e => !e.fait).reduce((s, e) => s + e.min, 0); const total = E.reduce((s, e) => s + e.min, 0);
  return `<div class="card mise-en-route" data-faites="${n}"><div class="row wrap"><div class="spacer"><div class="eyebrow">Mise en route</div><h3>${n} étape${n > 1 ? 's' : ''} sur ${E.length}</h3></div><span class="muted small">${reste} minutes restantes sur ${total}</span><button class="btn ghost sm" data-act="miseEnRouteMasquer">Masquer</button></div>
    <div class="bar" style="margin:8px 0 10px"><i style="width:${Math.round(n / E.length * 100)}%;background:var(--fp)"></i></div>
    <ol class="mer-l">${E.map((e, i) => `<li class="${e.fait ? 'fait' : ''}" data-etape="${e.cle}">${e.fait ? ico('check', 'ico ico-xs') : `<i class="pc-rond">${i + 1}</i>`}<span class="spacer">${esc(e.label)}${e.detail ? `<small class="muted"> · ${esc(e.detail)}</small>` : ''}</span><span class="muted small nowrap">${e.min} min</span>${e.fait ? '' : `<button class="btn sm" data-act="miseEnRouteFaire" data-go="${e.go.join('|')}">Faire</button>`}</li>`).join('')}</ol></div>`;
}
ACTIONS.miseEnRouteMasquer = () => setPref('miseEnRouteMasquee', true);
ACTIONS.miseEnRouteFaire = el => { const [route, k, v] = el.dataset.go.split('|'); if (k) UI[k] = v; location.hash = '#/' + route; };
