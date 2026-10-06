/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — pages regroupées ═════════════════════════════════════════
// Pilotage équipe = pilotage + Équipe & paliers ; Entreprise = entreprises
// + contrôle qualité + mes clubs (ces deux onglets pour les managers).
function groupPage(key, tabsList, cur, pages) {
  const t = tabsList.some(x => x[0] === cur) ? cur : tabsList[0][0];
  return { t, html: `<div class="group-tabs">${tabs(key, tabsList, t)}</div>${pages[t]()}` };
}
(() => {
  const team = PAGES.team, members = PAGES.members, b2b = PAGES.b2b, quality = PAGES.quality, clubs = PAGES.clubs;
  const teamRender = team.render.bind(team), teamMount = team.mount && team.mount.bind(team);
  team.render = args => groupPage('teamTab', [['pilotage', 'Pilotage'], ['membres', 'Équipe & paliers']], UI.teamTab, { pilotage: () => teamRender(args), membres: () => members.render(args) }).html;
  team.mount = args => { if ((UI.teamTab || 'pilotage') === 'membres') { if (members.mount) members.mount(args); } else if (teamMount) teamMount(args); };
  const b2bRender = b2b.render.bind(b2b), b2bMount = b2b.mount && b2b.mount.bind(b2b);
  b2b.render = args => {
    const L = [['entreprises', 'Entreprises'], ...(isManager() ? [['qualite', 'Contrôle qualité'], ['clubs', 'Mes clubs']] : [])];
    return groupPage('bizTab', L, UI.bizTab, { entreprises: () => b2bRender(args), qualite: () => quality.render(args), clubs: () => clubs.render(args) }).html;
  };
  b2b.mount = args => { const t = isManager() ? UI.bizTab || 'entreprises' : 'entreprises'; const p = { entreprises: { mount: b2bMount }, qualite: quality, clubs }[t] || {}; if (p.mount) p.mount(args); };
})();
