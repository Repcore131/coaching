/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — multi-salles : inscription autonome et invitations ═══════
// #/inscription : une salle crée son espace (société, premier club, premier
// manager) ; son code personnel s'affiche une fois.
// Invitation : un manager invite un commercial par e-mail ; le lien
// #/invitation/{org}/{jeton} sert une seule fois, pendant 7 jours. L'invité
// choisit rien : son code personnel est créé à l'ouverture du lien.
// Les règles de la base (outils/fitpulse-regles-orgs.mjs) vérifient tout.

const slug = (s, n = 24) => norm(s).replace(/ /g, '-').slice(0, n).replace(/-+$/, '') || 'club';
const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
const INVITE_JOURS = 7;
async function compteTechnique(email, code) {
  const key = await bootKeyOf(email, code); const ck = await codeKeyOf(code);
  await backend.fb.auth().createUserWithEmailAndPassword('fp-' + key + AUTH_DOMAIN_FP, normCode(code));
  return { key, ck };
}
function codeUneFois(code, email) {
  return `<h1>Votre code personnel</h1><p>Notez-le maintenant : il ne s’affichera plus. Vous en aurez besoin à chaque connexion, avec votre e-mail <b>${esc(email)}</b>.</p>
    <p class="code-once">${esc(code)}</p><button class="btn primary login-btn" id="mt-go">J’ai noté mon code, continuer</button>`;
}
// ── Inscription d'une salle ───────────────────────────────────────────────
function inscriptionPage(msg = '') {
  return `<div class="auth"><div class="auth-card">${brandBlock(true)}<h1>Créer l’espace de votre salle</h1>
    <p class="muted small">30 jours d’essai. Vos données sont hébergées en Europe (Belgique) et ne sont visibles que de votre équipe.</p>
    <form id="insf" class="grid" novalidate>
      <label class="field"><span>Société</span><input class="input" name="societe" required maxlength="80"></label>
      <label class="field"><span>Nom du club</span><input class="input" name="club" required maxlength="60"></label>
      <div class="form-grid"><label class="field"><span>Votre prénom</span><input class="input" name="first" required maxlength="40"></label><label class="field"><span>Votre nom</span><input class="input" name="last" required maxlength="40"></label></div>
      <label class="field"><span>E-mail</span><input class="input" type="email" name="email" required autocomplete="email"></label>
      <div class="login-msg" role="alert">${esc(msg)}</div>
      <button class="btn primary" type="submit" id="ins-btn">Créer l’espace</button>
    </form><p class="small"><a href="#/">J’ai déjà un accès</a></p></div></div>`;
}
document.addEventListener('submit', async e => {
  if (e.target.id !== 'insf') return; e.preventDefault();
  const f = formData(e.target); const email = cleanEmail(f.email);
  if (!f.societe.trim() || !f.club.trim() || !f.first.trim() || !f.last.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $('#app').innerHTML = inscriptionPage('Remplissez tous les champs.'); return; }
  const btn = $('#ins-btn'); btn.disabled = true; btn.textContent = 'Création…';
  try { const r = await creerSociete({ societe: f.societe.trim(), club: f.club.trim(), first: f.first.trim(), last: f.last.trim(), email }); montrerCode(r.code, email); }
  catch (err) { $('#app').innerHTML = inscriptionPage('Création impossible : ' + (err.message || err)); }
});
async function creerSociete({ societe, club, first, last, email }) {
  const rec = await newCodeRecord(); const { key, ck } = await compteTechnique(email, rec.code);
  const authUid = backend.fb.auth().currentUser.uid; const uid = newId(); const cid = slug(club, 30); const now = Date.now();
  for (let essai = 0; essai < 3; essai++) {
    const org = `${slug(societe)}-${hex(2)}`;
    const up = {
      [`orgs/${org}/info`]: { nom: societe, createdBy: authUid, creeLe: now, statut: 'essai', abonnement: { offre: 'essai', finEssai: now + 30 * 864e5 }, securite: { mfa: true }, region: 'europe-west1' },
      [`orgs/${org}/clubs/${cid}`]: { id: cid, name: club, address: '', city: '', createdAt: now },
      [`orgs/${org}/data/users/${uid}`]: { id: uid, first, last, email, role: 'manager', clubs: [cid], avatar: 'h1', status: 'active', salt: rec.salt, codeHash: rec.codeHash, bootKey: key, codeKey: ck, createdAt: now },
      [`orgs/${org}/data/meta`]: { version: 1, createdAt: now },
      [`orgs_boot/${key}`]: { org, uid, privilegie: true },
    };
    try { await backend.fb.database().ref().update(up); ORG = org; await backend.fb.database().ref(`orgs_boot/${ck}`).set(key); return { org, code: rec.code }; }
    catch (e) { if (essai === 2) throw e; }
  }
}
function montrerCode(code, email) {
  const app = $('#app'); app.innerHTML = `<div class="auth"><div class="auth-card">${brandBlock(true)}${codeUneFois(code, email)}</div></div>`;
  $('#mt-go').addEventListener('click', async () => { $('#mt-go').disabled = true; try { await backend.codeLogin(email, code); if (history.replaceState) history.replaceState(null, '', location.pathname + location.search + '#/home'); login(S.users[backend.userId]); } catch (err) { UI.loginErr = err.message; location.hash = '#/'; render(); } });
}
// ── Invitation : création (manager) ───────────────────────────────────────
ACTIONS.inviteMail = () => {
  if (!MULTI) return; openModal({ title: 'Inviter par e-mail', body: `<form id="invf" class="form-grid">
    <label class="field"><span>Prénom</span><input class="input" name="first" required maxlength="40"></label><label class="field"><span>Nom</span><input class="input" name="last" maxlength="40"></label>
    <label class="field full"><span>E-mail</span><input class="input" type="email" name="email" required></label>
    <label class="field"><span>Rôle</span><select class="input" name="role"><option value="membre">Commercial</option>${isCreator() ? '<option value="manager">Manager</option>' : ''}</select></label>
    <p class="full muted small">Le lien d’invitation sert une seule fois, pendant ${INVITE_JOURS} jours. Le code personnel est créé à l’ouverture du lien.</p></form>`,
  foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="inviteMailOk">Envoyer l’invitation</button>' });
};
ACTIONS.inviteMailOk = async () => {
  const f = formData($('#invf')); const email = cleanEmail(f.email); if (!f.first.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Prénom et e-mail obligatoires.'); return; }
  const t = hex(16); const uid = newId(); const now = Date.now(); const info = (await backend.fb.database().ref(`orgs/${ORG}/info/nom`).get()).val() || CLUB.name;
  const inv = { email, role: f.role === 'manager' && isCreator() ? 'manager' : 'membre', uid, first: f.first.trim(), last: (f.last || '').trim(), clubs: [CLUB.id], expiresAt: now + INVITE_JOURS * 864e5, orgNom: info, by: ME.id, at: now };
  try {
    await backend.fb.database().ref(`orgs_invites/${ORG}/${t}`).set(inv);
    const lien = `${location.origin}${location.pathname}#/invitation/${ORG}/${t}`;
    await backend.fb.database().ref(`orgs_mail/${ORG}`).push({ email, first: inv.first, last: inv.last, role: inv.role, club: CLUB.name, lien, expiresAt: inv.expiresAt, by: ME.id, at: now });
    db.set(['audit', newId()], { at: now, by: ME.id, action: 'invitation', club: CLUB.id, role: inv.role });
    closeModal(); openModal({ title: 'Invitation envoyée', body: `<p>${esc(inv.first)} reçoit un e-mail avec son lien. Vous pouvez aussi le lui transmettre :</p><p><input class="input" readonly value="${esc(lien)}" onclick="this.select()"></p><p class="muted small">Valable ${INVITE_JOURS} jours, une seule fois.</p>`, foot: '<button class="btn primary" data-close>Fermer</button>' });
  } catch (e) { toast('Invitation impossible : ' + e.message); }
};
// ── Invitation : ouverture du lien ────────────────────────────────────────
async function invitationPage(org, t) {
  const app = $('#app'); const carte = h => { app.innerHTML = `<div class="auth"><div class="auth-card">${brandBlock(true)}${h}</div></div>`; };
  if (!/^[a-z0-9-]{3,40}$/.test(org || '') || !/^[0-9a-f]{32}$/.test(t || '')) { carte('<h1>Lien invalide</h1><p>Demandez un nouveau lien à votre manager.</p>'); return; }
  let inv = null; try { const r = await fetch(restUrl(`orgs_invites/${org}/${t}`), { cache: 'no-store' }); inv = r.ok ? await r.json() : null; } catch (e) { carte('<h1>Pas de connexion internet</h1>'); return; }
  if (!inv) { carte('<h1>Lien invalide</h1><p>Demandez un nouveau lien à votre manager.</p>'); return; }
  if (inv.usedAt) { carte('<h1>Lien déjà utilisé</h1><p>Ce lien a déjà servi. Connectez-vous avec votre e-mail et votre code, ou demandez un nouveau lien.</p><a class="btn primary" href="#/">Se connecter</a>'); return; }
  if (inv.expiresAt < Date.now()) { carte('<h1>Lien expiré</h1><p>Les liens d’invitation sont valables 7 jours. Demandez-en un nouveau à votre manager.</p>'); return; }
  carte(`<h1>Rejoindre ${esc(inv.orgNom)}</h1><p>${esc(inv.first)}, votre accès <b>${inv.role === 'manager' ? 'Manager' : 'Commercial'}</b> est prêt. Votre identifiant : <b>${esc(inv.email)}</b>.</p><div class="login-msg" role="alert" id="inv-msg"></div><button class="btn primary login-btn" id="inv-go">Activer mon accès</button>`);
  $('#inv-go').addEventListener('click', async () => {
    $('#inv-go').disabled = true;
    try {
      const rec = await newCodeRecord(); const { key, ck } = await compteTechnique(inv.email, rec.code); const now = Date.now();
      await backend.fb.database().ref().update({
        [`orgs_boot/${key}`]: { org, uid: inv.uid, invite: t, ...(inv.role !== 'membre' ? { privilegie: true } : {}) },
        [`orgs/${org}/data/users/${inv.uid}`]: { id: inv.uid, first: inv.first, last: inv.last || '', email: inv.email, role: inv.role, clubs: inv.clubs || [], avatar: 'h1', status: 'active', salt: rec.salt, codeHash: rec.codeHash, bootKey: key, codeKey: ck, invite: t, createdAt: now },
        [`orgs_invites/${org}/${t}/usedAt`]: now, [`orgs_invites/${org}/${t}/usedBy`]: key,
      });
      ORG = org; await backend.fb.database().ref(`orgs_boot/${ck}`).set(key).catch(() => null);
      montrerCode(rec.code, inv.email);
    } catch (e) { $('#inv-go').disabled = false; $('#inv-msg').textContent = 'Activation impossible : ' + (e.message || e); }
  });
}
// Pages sans connexion du mode multi-salles (appelé par le routeur).
function multiPublic(r, args) {
  if (!MULTI) return false;
  if (r === 'inscription') { $('#app').innerHTML = inscriptionPage(); return true; }
  if (r === 'invitation') { invitationPage(args[0], args[1]); return true; }
  return false;
}
