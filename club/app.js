/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — demarrage ════════════════════════════════════════════════
(async function boot() {
  if (window.PARKPULSE_BLOCKED) return; // copie hors adresse officielle : rien ne démarre
  const theme = safeLS.get('parkpulse.theme');
  if (theme) document.documentElement.dataset.theme = theme;
  try { await backend.start(); }
  catch (e) {
    const off = e.kind === 'offline' || !navigator.onLine;
    $('#app').innerHTML = `<div class="auth"><div class="auth-card" style="text-align:center">${brandBlock(true)}<h2>${off ? 'Pas de connexion internet' : 'Connexion impossible'}</h2><p class="muted">${off ? 'Fit Pulse a besoin d’internet pour charger les données de l’équipe. Vérifiez le Wi-Fi ou les données mobiles.' : esc(e.message || e)}</p><button class="btn primary" onclick="location.reload()">Réessayer</button></div></div>`;
    if (off) addEventListener('online', () => location.reload(), { once: true });
    return;
  }
  if (DEMO) demoStart();
  if (backend.mode === 'firebase' && backend.user && !S) { db.replace(emptyState()); }
  // Premier lancement avec des comptes declares : le club et les comptes sont
  // crees d'office, on arrive directement sur la connexion.
  if (!S && (window.PARKPULSE_ACCOUNTS || []).length && backend.mode === 'local') { S = emptyState(); backend.replaceAll(); }
  if (S) { const ops = bootstrapOps(); if (ops.length) db.batch(ops); }
  if (S) {
    if (backend.mode === 'local') {
      const sid = safeLS.get(SESSION_KEY);
      if (sid && S.users[sid] && S.users[sid].status !== 'archived') ME = S.users[sid];
    } else if (backend.user) {
      const u = S.users[backend.userId];
      ME = u && u.status !== 'archived' ? u : null;
      if (!ME) await backend.signOut();
    }
    const cid = safeLS.get('parkpulse.club');
    if (ME && cid && S.clubs[cid] && (inClub(ME, cid) || ME.role === 'createur')) CLUB = S.clubs[cid];
  }
  db.onChange(render);
  render();
})();
