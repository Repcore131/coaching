/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — modèles de messages des résiliations (RES_TEMPLATES) ════════
// Trois e-mails et trois SMS, modifiables par le manager (Réglages > Modèles de
// résiliation, stockés dans S.clubs[clubId].resTemplates). Une variable sans
// valeur reste « [à compléter] » en surbrillance et bloque le bouton « Copier ».

const RES_TEMPLATES = {
  email1: { label: 'E-mail 1 : accusé de réception', subject: 'Votre demande de résiliation', text: `Bonjour {prenom},
Nous avons bien reçu votre demande de résiliation le {date_demande}. Votre e-mail suffit, vous n'avez rien d'autre à nous envoyer.
Nous vous confirmerons très vite la date de fin de votre abonnement.
Avant cela, si quelque chose ne vous convient pas au club, j'aimerais le savoir. Parfois une solution simple existe : une pause, une autre formule, d'autres horaires de coaching. Si vous avez deux minutes, appelez-moi au {tel_club} ou répondez à ce message avec un créneau.
Bonne journée,
{commercial}, {club}` },
  email2: { label: 'E-mail 2 : confirmation de résiliation', subject: 'Confirmation de votre résiliation', text: `Bonjour {prenom},
Votre résiliation est enregistrée à la date du {date_demande}.
Conformément à votre contrat, votre abonnement prendra fin le {date_fin}, avec un dernier prélèvement le {dernier_prelevement}. Votre accès à la salle reste actif jusqu'à cette date.
Nous sommes sincèrement navrés de vous voir partir. Merci pour votre confiance, les portes du club vous restent ouvertes.
Cordialement,
{commercial}, {club}` },
  email3: { label: 'E-mail 3 : proposition', subject: 'Une solution avant de partir ?', text: `Bonjour {prenom},
Suite à votre demande, je vous propose une alternative : {offre}. Elle vous permet de garder vos avantages sans payer pour une période où vous ne venez pas.
Si cela vous intéresse, répondez simplement oui à ce message et je m'occupe de tout. Sinon, votre résiliation suit son cours normalement, sans démarche de votre part.
{commercial}, {club}` },
  sms1: { label: 'SMS 1 : premier contact', text: `Bonjour {prenom}, c'est {commercial} de {club}. J'ai bien reçu votre demande de résiliation. Avant de la traiter, auriez-vous 2 minutes pour en parler ? Je peux vous appeler quand ?` },
  sms2: { label: 'SMS 2 : après un appel sans réponse', text: `Bonjour {prenom}, {commercial} de {club}. Je n'ai pas réussi à vous joindre. Une pause de votre abonnement est possible si c'est une question de temps ou de santé. Dites-moi, sinon je confirme la résiliation par e-mail.` },
  sms3: { label: 'SMS 3 : après l’échange', text: `Merci pour notre échange {prenom}. Comme convenu : {offre}. Je reste disponible au {tel_club}. {commercial}, {club}` },
};
const RES_TPL_VARS = ['prenom', 'club', 'date_demande', 'date_fin', 'dernier_prelevement', 'offre', 'commercial', 'tel_club'];
const RES_SMS_MAX = 300;
const RES_A_COMPLETER = '[à compléter]';

// Texte du club (personnalisé) ou texte par défaut.
function resTpl(key, clubId = CLUB && CLUB.id) {
  const perso = deepGet(S, ['clubs', clubId, 'resTemplates', key]) || {}; const d = RES_TEMPLATES[key];
  return { ...d, subject: perso.subject || d.subject, text: perso.text || d.text, perso: !!perso.text };
}
// Valeurs des variables pour un dossier (extra : offre choisie, date de fin saisie…).
function resTplValeurs(r, extra = {}) {
  const club = S.clubs[r.clubId] || CLUB || {}; const owner = S.users[r.ownerId] || ME || {};
  const prenom = /^demande /i.test(r.client || '') ? '' : String(r.client || '').trim().split(/\s+/)[0] || '';
  const rec = resReceivedAt(r); const fin = extra.date_fin || r.dateFin || r.effective; const der = extra.dernier_prelevement || r.dernierPrelevement;
  const offre = extra.offre || (resActions(r).map(a => a.offer).filter(Boolean).pop() || '');
  return { prenom, club: nomAffiche(club), date_demande: rec ? dmy(isoOf(new Date(rec))) : (r.date ? dmy(r.date) : ''), date_fin: fin ? dmy(fin) : '', dernier_prelevement: der ? dmy(der) : '',
    offre: offre ? offre.charAt(0).toLowerCase() + offre.slice(1) : '', commercial: owner.first || '', tel_club: club.phone || '', ...Object.fromEntries(Object.entries(extra).filter(([k]) => RES_TPL_VARS.includes(k) && !['date_fin', 'dernier_prelevement', 'offre'].includes(k))) };
}
// Remplissage : { text, subject, html (variables manquantes surlignées), manquantes }.
function resRemplir(key, r, extra = {}, tplOverride = null) {
  const t = tplOverride || resTpl(key, r.clubId); const v = resTplValeurs(r, extra); const manquantes = new Set();
  const sub = (s, html) => String(s || '').replace(/\{([a-z_]+)\}/g, (m, k) => { if (!RES_TPL_VARS.includes(k)) return m; const x = v[k]; if (x) return html ? esc(x) : x; manquantes.add(k); return html ? `<mark class="tpl-manque">${RES_A_COMPLETER}</mark>` : RES_A_COMPLETER; });
  const htmlTxt = String(t.text || '').split(/(\{[a-z_]+\})/).map(p => /^\{[a-z_]+\}$/.test(p) ? sub(p, true) : esc(p)).join('');
  return { key, text: sub(t.text, false), subject: t.subject ? sub(t.subject, false) : null, html: htmlTxt, manquantes: [...manquantes] };
}
// Contrôle d'un texte saisi : longueur des SMS, emoji, tirets longs, capitales criardes, tutoiement.
function resTplErreurs(key, text) {
  const e = []; const t = String(text || '');
  if (key.startsWith('sms') && t.length > RES_SMS_MAX) e.push(`${t.length} caractères pour ${RES_SMS_MAX} au plus`);
  if (/\p{Extended_Pictographic}/u.test(t.replace(/[\u00a9\u00ae\u2122]/g, ''))) e.push('emoji interdit');
  if (/[\u2013\u2014]/.test(t)) e.push('tiret long interdit');
  if (/\b[A-ZÀ-Ý]{5,}\b/.test(t.replace(/\{[a-z_]+\}/g, ''))) e.push('pas de mot en capitales');
  if (/\b(tu|te|ton|ta|tes|toi)\b/i.test(t)) e.push('vouvoiement obligatoire');
  if (key === 'email2' && /\{offre\}|offre|promotion|remise|gratuit/i.test(t)) e.push('aucune offre commerciale dans la confirmation');
  return e;
}
// Bloc d'aperçu avec Copier (désactivé s'il manque une valeur).
function resTplBloc(f, { fil = null } = {}) {
  return `<div class="tpl-apercu" data-tpl="${f.key}">${f.subject ? `<div class="small"><span class="muted">Objet :</span> ${esc(f.subject)}</div>` : ''}<div class="tpl-texte">${f.html.replace(/\n/g, '<br>')}</div>
    <div class="row wrap" style="gap:8px;margin-top:8px"><button class="btn sm" data-act="resTplCopie" data-tpl="${f.key}" ${f.manquantes.length ? 'disabled title="Complétez les valeurs surlignées"' : ''}>${ico('copy')} Copier</button>${fil ? `<button class="btn sm" data-act="resFil" data-id="${fil}">Ouvrir le fil</button>` : ''}${f.key.startsWith('sms') ? `<span class="muted small">${f.text.length} sur ${RES_SMS_MAX} caractères</span>` : ''}${f.manquantes.length ? `<span class="small bad">À compléter : ${f.manquantes.map(k => '{' + k + '}').join(', ')}</span>` : ''}</div></div>`;
}
// Dernier texte affiché (le bouton Copier le recopie tel quel).
const RES_TPL_COURANT = {};
function resTplMontrer(f, opts = {}) { RES_TPL_COURANT[f.key] = f; return resTplBloc(f, opts); }
ACTIONS.resTplCopie = el => { const f = RES_TPL_COURANT[el.dataset.tpl]; if (!f || f.manquantes.length) return; copierTexte((f.subject ? 'Objet : ' + f.subject + '\n\n' : '') + f.text, 'Message copié'); };

// ── Réglages > Modèles de résiliation (manager) ─────────────────────────────
function resModelesCard() {
  if (!isManager()) return '';
  const club = S.clubs[CLUB.id] || {}; const k = UI.resTplKey || 'email1'; const t = resTpl(k);
  const exemple = { id: 'exemple', clubId: CLUB.id, client: 'Claire Exemple', receivedAt: Date.now() - 2 * 864e5, effective: addDays(today(), 30), dernierPrelevement: addDays(today(), 25), ownerId: ME.id, actions: [{ at: Date.now(), offer: 'Suspension' }] };
  const f = resRemplir(k, exemple, {}, t); const err = resTplErreurs(k, t.text);
  return `<div class="card" id="res-modeles"><div class="card-head"><h3>Modèles de résiliation</h3></div>
    <p class="muted small">Variables : ${RES_TPL_VARS.map(v => `<code>{${v}}</code>`).join(' ')}. Une valeur absente s’affiche ${RES_A_COMPLETER} et bloque la copie.</p>
    <label class="field" style="max-width:280px"><span>Téléphone du club ({tel_club})</span><input class="input" id="res-tel-club" type="tel" value="${esc(club.phone || '')}"></label>
    <div class="row wrap" style="gap:6px;margin:10px 0">${Object.entries(RES_TEMPLATES).map(([key, d]) => `<button class="btn sm ${key === k ? 'primary' : ''}" data-act="resTplChoix" data-k="${key}">${esc(d.label.split(' : ')[0])}</button>`).join('')}</div>
    <div class="small muted" style="margin-bottom:6px">${esc(RES_TEMPLATES[k].label)}${t.perso ? ' · personnalisé' : ' · texte par défaut'}</div>
    ${t.subject != null && RES_TEMPLATES[k].subject ? `<label class="field"><span>Objet</span><input class="input" id="res-tpl-objet" value="${esc(t.subject)}"></label>` : ''}
    <label class="field"><span>Texte</span><textarea class="input" id="res-tpl-texte" rows="${k.startsWith('sms') ? 4 : 9}" data-input="resTplSaisie" data-k="${k}">${esc(t.text)}</textarea></label>
    <div class="small" id="res-tpl-compteur">${k.startsWith('sms') ? `<span class="${t.text.length > RES_SMS_MAX ? 'bad' : 'muted'}">${t.text.length} sur ${RES_SMS_MAX} caractères</span> ` : ''}${err.length ? `<span class="bad">${esc(err.join(', '))}</span>` : ''}</div>
    <div class="row wrap" style="gap:8px;margin-top:8px"><button class="btn primary sm" data-act="resTplSave" data-k="${k}">Enregistrer le modèle</button>${t.perso ? `<button class="btn sm" data-act="resTplReset" data-k="${k}">Revenir au texte par défaut</button>` : ''}</div>
    <h4 style="margin:14px 0 6px">Aperçu sur un dossier d’exemple</h4>${resTplMontrer(f)}</div>`;
}
ACTIONS.resTplChoix = el => { UI.resTplKey = el.dataset.k; render(); };
ACTIONS.resTplSaisie = el => { const k = el.dataset.k; const n = el.value.length; const e = resTplErreurs(k, el.value); const c = $('#res-tpl-compteur'); if (c) c.innerHTML = `${k.startsWith('sms') ? `<span class="${n > RES_SMS_MAX ? 'bad' : 'muted'}">${n} sur ${RES_SMS_MAX} caractères</span> ` : ''}${e.length ? `<span class="bad">${esc(e.join(', '))}</span>` : ''}`; };
ACTIONS.resTplSave = el => {
  const k = el.dataset.k; const text = ($('#res-tpl-texte') || {}).value || ''; const subject = ($('#res-tpl-objet') || {}).value;
  const e = resTplErreurs(k, text); if (e.length) { toast('Modèle non enregistré : ' + e.join(', ')); return; }
  const tel = ($('#res-tel-club') || {}).value; const ops = [[['clubs', CLUB.id, 'resTemplates', k], { text: text.trim(), ...(subject != null ? { subject: subject.trim() } : {}), at: Date.now(), by: ME.id }]];
  if (tel != null) ops.push([['clubs', CLUB.id, 'phone'], tel.trim() || null]);
  db.batch(ops); toast(`Modèle ${RES_TEMPLATES[k].label.split(' : ')[0]} enregistré`);
};
ACTIONS.resTplReset = el => { db.set(['clubs', CLUB.id, 'resTemplates', el.dataset.k], null); toast(`Modèle ${RES_TEMPLATES[el.dataset.k].label.split(' : ')[0]} rétabli`); };
