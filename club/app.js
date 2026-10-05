'use strict';
// ══ PARK PULSE — demarrage ════════════════════════════════════════════════
(async function boot() {
  const theme = safeLS.get('parkpulse.theme');
  if (theme) document.documentElement.dataset.theme = theme;
  try { await backend.start(); }
  catch (e) { $('#app').innerHTML = `<div class="auth"><div class="auth-card"><h2>Connexion impossible</h2><p class="muted">${esc(e.message || e)}</p></div></div>`; return; }
  // Premier lancement avec des comptes declares : le club et les comptes sont
  // crees d'office, on arrive directement sur la connexion.
  if (!S && (window.PARKPULSE_ACCOUNTS || []).length && backend.mode === 'local') { S = emptyState(); backend.replaceAll(); }
  if (S) { const ops = bootstrapOps(); if (ops.length) db.batch(ops); }
  if (S) {
    if (backend.mode === 'local') {
      const sid = safeLS.get(SESSION_KEY);
      if (sid && S.users[sid] && S.users[sid].status !== 'archived') ME = S.users[sid];
    } else if (backend.user) {
      const email = (backend.user.email || '').toLowerCase();
      ME = Object.values(S.users).find(u => (u.email || '').toLowerCase() === email && u.status !== 'archived') || null;
    }
    const cid = safeLS.get('parkpulse.club');
    if (ME && cid && S.clubs[cid] && (inClub(ME, cid) || ME.role === 'createur')) CLUB = S.clubs[cid];
  }
  db.onChange(render);
  render();
})();
