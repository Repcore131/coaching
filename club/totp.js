/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — double authentification (multi-salles) ═══════════════════
// Managers et créateurs saisissent un code à 6 chiffres de leur application
// d'authentification à chaque connexion. Le code est vérifié par le serveur
// (club/cloud : totpEtat, totpInscrire, totpValider) ; les règles de la base
// refusent tout accès tant que ce n'est pas fait. Rien n'est vérifié ici.

const fnUrl = nom => `https://${(CFG.firebase || {}).functionsRegion || 'europe-west1'}-${(CFG.firebase || {}).projectId}.cloudfunctions.net/${nom}`;
async function appelFonction(be, nom, data = {}) {
  const tk = await be.fb.auth().currentUser.getIdToken();
  let r; try { r = await fetch(fnUrl(nom), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk }, body: JSON.stringify({ data }) }); } catch (e) { throw new Error('Serveur injoignable : vérifiez la connexion internet.'); }
  const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error((j.error && j.error.message) || 'Erreur du serveur (' + r.status + ').');
  return j.result;
}
const mfaFaite = async be => { const t = await be.fb.auth().currentUser.getIdTokenResult(); return t.claims.mfaAt != null && t.claims.mfaAt === t.claims.auth_time; };
function totpEcran(html) { const app = $('#app'); if (app) app.innerHTML = `<div class="auth"><div class="auth-card totp-card">${brandBlock(true)}${html}</div></div>`; }
async function totpGate(be) {
  if (!MULTI || !be.privilegie) return;
  const exigee = (await be.fb.database().ref(`orgs/${ORG}/info/securite/mfa`).get().catch(() => null));
  if (!exigee || exigee.val() !== true || await mfaFaite(be)) return;
  const { configure } = await appelFonction(be, 'totpEtat');
  let ins = null; if (!configure) ins = await appelFonction(be, 'totpInscrire');
  await new Promise(ok => {
    const dessin = (msg = '') => totpEcran(`<h1>Double authentification</h1>
      ${ins ? `<p class="small">Première connexion : ajoutez Fit Pulse à votre application d’authentification (Google Authenticator, Microsoft Authenticator, 1Password…).</p>
        <p><a class="btn" href="${esc(ins.uri)}">Ouvrir l’application d’authentification</a></p>
        <p class="small">Ou saisissez cette clé à la main :<br><code class="totp-key">${esc(ins.secret.replace(/(.{4})/g, '$1 ').trim())}</code></p>` : '<p class="small">Saisissez le code à 6 chiffres affiché par votre application d’authentification.</p>'}
      <form id="totpf" class="login-form" novalidate><label class="field"><span>Code à 6 chiffres</span><input class="input" id="totp-code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" pattern="[0-9 ]*" required></label>
      <div class="login-msg" role="alert">${esc(msg)}</div><button class="btn primary login-btn" type="submit">Valider</button></form>
      <button class="btn ghost sm" id="totp-out" style="margin-top:10px">Se déconnecter</button>`);
    const brancher = () => {
      const f = $('#totpf'); if (!f) return; $('#totp-code').focus();
      $('#totp-out').addEventListener('click', async () => { await be.signOut(); location.reload(); });
      f.addEventListener('submit', async e => {
        e.preventDefault(); const code = $('#totp-code').value.replace(/\D/g, '');
        try { await appelFonction(be, 'totpValider', { code }); await be.fb.auth().currentUser.getIdToken(true); ok(); }
        catch (err) { dessin(err.message); brancher(); }
      });
    };
    dessin(); brancher();
  });
}
