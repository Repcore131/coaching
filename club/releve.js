/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — Réglages > Relève des résiliations (manager) ════════════════
// Règles de détection du club (S.clubs[id].mailRules), lues par la fonction serveur
// ingestResiliations et recopiées dans le script Apps Script par « Copier la configuration ».
// Banc d'essai : testMailRules (moteur-mail.js), rien n'est enregistré.
// Secret de signature : 32 octets tirés ici, affichés une fois, rangés par la fonction
// setMailSecret dans Secret Manager ; aucune copie dans la base.

const releveRegles = (clubId = CLUB.id) => ({ ...MAIL_ENGINE.REGLES_DEFAUT, ...(deepGet(S, ['clubs', clubId, 'mailRules']) || {}) });
const RELEVE_ENDPOINT = () => (CFG.firebase && CFG.firebase.projectId ? fnUrl('ingestResiliations') : 'https://europe-west1-VOTRE-PROJET.cloudfunctions.net/ingestResiliations');
// Une règle par ligne : « poids expression » (par exemple « 3 resili » ou « -3 newsletter|unsubscribe »).
const reglesEnTexte = R => [...(R.keywords || []), ...(R.negatives || [])].map(r => `${r.w} ${r.re}`).join('\n');
function reglesDepuisTexte(t) {
  const L = String(t || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const m = /^(-?\d+)\s+(.+)$/.exec(l); return m ? { re: m[2].trim(), w: Number(m[1]) } : null; });
  const ok = L.filter(r => r && r.w && (() => { try { new RegExp(r.re); return true; } catch (e) { return false; } })());
  return { keywords: ok.filter(r => r.w > 0), negatives: ok.filter(r => r.w < 0), rejetees: L.length - ok.length };
}
const lignes = t => String(t || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 30);

function releveCard() {
  if (!isManager()) return '';
  const R = releveRegles(); const club = S.clubs[CLUB.id] || {}; const ms = club.mailSync;
  const ta = (name, v, rows = 3) => `<textarea class="input num" rows="${rows}" name="${name}" spellcheck="false">${esc(v)}</textarea>`;
  return `<div class="card" id="releve"><div class="card-head"><h3>Relève des résiliations</h3><span class="spacer"></span><button class="btn sm" data-act="releveGuide">Guide d’installation</button></div>
    <p class="muted small" style="margin-top:-4px">La boîte accueil est relevée chaque heure ; les demandes trouvées arrivent dans Résiliations. ${ms && ms.at ? `Dernière relève : ${dmy(isoOf(new Date(ms.at)))} à ${timeOf(ms.at)}.` : 'Aucune relève reçue pour l’instant.'}</p>
    <form id="relf" class="form-grid">
      <label class="field"><span>Délai de réponse (heures)</span><input class="input" type="number" min="1" max="168" name="slaHours" value="${R.slaHours}"></label>
      <label class="field"><span>Seuil</span><input class="input" type="number" min="1" max="20" name="minScore" value="${R.minScore}"><small class="muted">Score à partir duquel un e-mail devient une demande.</small></label>
      <label class="field"><span>Messagerie de l’accueil</span><select class="input" name="mailProvider"><option value="gmail" ${club.mailProvider !== 'm365' ? 'selected' : ''}>Gmail (script Apps Script)</option><option value="m365" ${club.mailProvider === 'm365' ? 'selected' : ''}>Microsoft 365 (Outlook)</option></select></label>
      <label class="field"><span>Boîte Microsoft 365</span><input class="input" type="email" name="m365Mailbox" value="${esc(club.m365Mailbox || '')}" placeholder="accueil@votreclub.fr"></label>
      <label class="field full"><span>Règles de détection</span>${ta('regles', reglesEnTexte(R), 7)}<small class="muted">Une règle par ligne : un poids puis une expression, sur le texte sans accents (par exemple « 3 resili » ou « -3 newsletter|unsubscribe »).</small></label>
      <label class="field"><span>Expéditeurs de notifications</span>${ta('notifSenders', (R.notifSenders || []).join('\n'))}</label>
      <label class="field"><span>Expéditeurs ignorés</span>${ta('ignoreSenders', (R.ignoreSenders || []).join('\n'))}</label>
      <label class="field full"><span>Adresses de la boîte accueil</span>${ta('ownAddresses', (R.ownAddresses || []).join('\n'), 2)}<small class="muted">Les messages envoyés depuis ces adresses comptent comme des réponses.</small></label>
    </form>
    <div class="row wrap" style="margin-top:10px;gap:8px"><button class="btn primary sm" data-act="releveSave">Enregistrer les règles</button><button class="btn sm" data-act="releveCopie">${ico('copy')} Copier la configuration</button><button class="btn sm" data-act="releveSecret">Générer le secret</button></div>
    <h3 style="margin-top:18px">Banc d’essai</h3>
    <label class="field"><span>Collez un e-mail anonymisé (expéditeur, objet, corps)</span><textarea class="input" rows="5" id="releve-essai" placeholder="De : Prénom Nom &lt;adresse@exemple.fr&gt;&#10;Objet : Résiliation&#10;Bonjour, je souhaite mettre fin à mon abonnement…"></textarea></label>
    <button class="btn sm" data-act="releveTest" style="margin-top:8px">Tester</button><div id="releve-resultat" aria-live="polite"></div></div>`;
}
function releveLire() {
  if (!$('#relf')) { const R = releveRegles(); return { rules: R, rejetees: 0, provider: (S.clubs[CLUB.id] || {}).mailProvider || 'gmail', boite: (S.clubs[CLUB.id] || {}).m365Mailbox || '' }; }
  const f = formData($('#relf')); const r = reglesDepuisTexte(f.regles);
  return { rules: { slaHours: Math.max(1, Math.min(168, Number(f.slaHours) || 24)), minScore: Math.max(1, Math.min(20, Number(f.minScore) || 3)), keywords: r.keywords, negatives: r.negatives,
    notifSenders: lignes(f.notifSenders), ignoreSenders: lignes(f.ignoreSenders), ownAddresses: lignes(f.ownAddresses).map(x => x.toLowerCase()) }, rejetees: r.rejetees, provider: f.mailProvider === 'm365' ? 'm365' : 'gmail', boite: (f.m365Mailbox || '').trim().toLowerCase() };
}
ACTIONS.releveSave = () => {
  if (!isManager()) return; const { rules, rejetees, provider, boite } = releveLire();
  if (boite && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(boite)) { toast('Adresse de la boîte Microsoft 365 invalide.'); return; }
  db.batch([[['clubs', CLUB.id, 'mailRules'], rules], [['clubs', CLUB.id, 'mailProvider'], provider], [['clubs', CLUB.id, 'm365Mailbox'], boite || null]]);
  toast(`Règles enregistrées : ${plur(rules.keywords.length + rules.negatives.length, 'règle', 'règles')}${rejetees ? `, ${plur(rejetees, 'ligne illisible écartée', 'lignes illisibles écartées')}` : ''}`);
};
ACTIONS.releveCopie = () => { const { rules } = releveLire(); copierTexte(MAIL_ENGINE.blocScript(rules, { endpoint: RELEVE_ENDPOINT(), clubId: CLUB.id }), 'Configuration copiée : 1 bloc CFG et RULES à coller dans Code.gs'); };
ACTIONS.releveTest = () => {
  const { rules } = releveLire(); const t = ($('#releve-essai') || {}).value || ''; const out = $('#releve-resultat'); if (!out) return;
  if (!t.trim()) { out.innerHTML = '<p class="muted small">Collez d’abord un e-mail.</p>'; return; }
  const x = testMailRules(t, rules); const KIND = { adherent: 'adhérent', notification: 'notification', formulaire: 'formulaire' };
  const ligne = (l, v) => `<tr><td>${l}</td><td class="num">${v == null || v === '' ? '<span class="muted">non trouvé</span>' : esc(String(v))}</td></tr>`;
  out.innerHTML = `<div class="alert ${x.retenu ? 'info' : ''}" style="margin-top:10px" data-score="${x.score}"><div><b>Score ${x.score} pour un seuil de ${x.seuil} : ${x.retenu ? 'la relève retiendrait cet e-mail' : 'la relève l’écarterait'}</b></div></div>
    <div class="table-wrap"><table class="t" style="margin-top:8px"><tbody>${ligne('Signaux trouvés', x.signals.join(', '))}${ligne('Expéditeur', KIND[x.kind])}${ligne('Demande', x.type === 'suspension' ? 'suspension' : 'résiliation')}${ligne('Nom', x.name)}${ligne('Numéro client', x.clientNum)}${ligne('Téléphone', x.phone)}${ligne('Motif', x.motif)}${ligne('Date d’effet', x.effective ? dmy(x.effective) : null)}</tbody></table></div>
    <p class="muted small">Rien n’est enregistré.</p>`;
};
// Secret de signature : 32 octets aléatoires, affichés une seule fois.
ACTIONS.releveSecret = async () => {
  if (!isManager()) return;
  if (!(await confirmDlg('Générer un nouveau secret ? L’ancien cessera de fonctionner : il faudra le remplacer dans le script de relève.', { ok: 'Générer le secret' }))) return;
  const b = crypto.getRandomValues(new Uint8Array(32)); const secret = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  let etat;
  if (backend.mode === 'firebase' && backend.fb && typeof appelFonction === 'function') {
    try { await appelFonction(backend, 'setMailSecret', { clubId: CLUB.id, secret }); etat = '<p class="ok small">Secret enregistré côté serveur (Secret Manager). Fit Pulse n’en garde aucune copie.</p>'; }
    catch (e) { etat = `<p class="bad small">Enregistrement impossible : ${esc(e.message)}. Ce secret n’est pas actif.</p>`; }
  } else etat = '<p class="warn small">Mode local ou démonstration : le secret n’est envoyé à aucun serveur.</p>';
  openModal({ title: 'Secret de la relève', body: `<p>Copiez ce secret maintenant dans la propriété <b>FP_SECRET</b> du script (Paramètres du projet, Propriétés du script). Il ne sera plus jamais affiché.</p>
    <p><code class="totp-key" id="releve-secret">${secret}</code></p>${etat}`, foot: `<button class="btn" data-act="releveSecretCopie">${ico('copy')} Copier</button><button class="btn primary" data-close>J’ai copié le secret</button>` });
};
ACTIONS.releveSecretCopie = () => { const c = $('#releve-secret'); if (c) copierTexte(c.textContent, '1 secret copié'); };

// ── Guide d'installation (10 étapes, manager non technicien) ────────────────
const RELEVE_GUIDE = [
  ['Se connecter au compte Gmail de l’accueil', 'Ouvrez Gmail avec l’adresse de l’accueil du club, celle qui reçoit les demandes des adhérents.'],
  ['Créer un filtre Gmail', 'Dans la barre de recherche, ouvrez les options et indiquez dans « Contient les mots » : résiliation OR résilier OR resiliation OR résilie. Choisissez « Créer un filtre », cochez « Appliquer le libellé », créez le libellé FP-Resiliations, puis cochez « Appliquer aussi aux conversations correspondantes ».'],
  ['Créer le projet de script', 'Ouvrez script.google.com avec le même compte, choisissez « Nouveau projet » et nommez-le « Fit Pulse relève ».'],
  ['Afficher le fichier manifeste', 'Dans Paramètres du projet (roue dentée), cochez « Afficher le fichier manifeste appsscript.json ».'],
  ['Coller les deux fichiers', 'Remplacez le contenu de appsscript.json puis celui de Code.gs par les fichiers fournis ci-dessous. Collez ensuite dans Code.gs, à la place des blocs CFG et RULES, la configuration copiée depuis Fit Pulse.'],
  ['Vérifier le service Gmail', 'Dans la colonne Services, vérifiez que « Gmail API » est ajouté. Sinon, cliquez sur le signe plus et ajoutez-le.'],
  ['Ajouter le secret', 'Dans Paramètres du projet, Propriétés du script, ajoutez la propriété FP_SECRET avec la valeur affichée par Fit Pulse (bouton « Générer le secret », visible une seule fois).'],
  ['Faire un aperçu', 'Choisissez la fonction apercu puis Exécuter. Le journal liste les demandes trouvées ; rien n’est envoyé.'],
  ['Installer la relève', 'Choisissez la fonction installer puis Exécuter, et acceptez les autorisations : lecture des e-mails, connexion à un service externe, déclencheurs.'],
  ['Vérifier dans Fit Pulse', 'Revenez dans Fit Pulse, page Résiliations : « Dernière relève : il y a 1 min » doit s’afficher.'],
];
ACTIONS.releveGuide = () => openModal({ title: 'Installer la relève des résiliations', wide: true, body: `<p class="muted small" style="margin-top:0">Une quinzaine de minutes, une seule fois. Le script lit la boîte sans rien y modifier : aucun libellé posé par lui, aucun message déplacé ni envoyé.</p>
  <ol class="guide-releve">${RELEVE_GUIDE.map(([t, d], i) => `<li><b>${i + 1}. ${esc(t)}</b><p>${esc(d)}</p></li>`).join('')}</ol>
  <div class="row wrap" style="gap:8px"><a class="btn sm" href="apps-script/appsscript.json" download>${ico('download')} appsscript.json</a><a class="btn sm" href="apps-script/Code.gs" download>${ico('download')} Code.gs</a><button class="btn sm" data-act="releveCopie">${ico('copy')} Copier la configuration</button></div>` });
