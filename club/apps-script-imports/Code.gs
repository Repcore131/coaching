/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
// Fit Pulse : exports Resamania reçus par e-mail, importés sans clic.
// Toutes les 15 minutes, les messages libellés FP-import des 3 derniers jours (pas encore
// FP-importé) sont relus :
//  - pièces jointes .csv, .zip, .xlsx envoyées à Fit Pulse (multipart, en-tête X-Club-Token) ;
//  - sans pièce jointe : liens https du message ouverts (redirections suivies) ; un fichier est
//    envoyé, une page de connexion pose FP-erreur et prévient le manager (« Export à ouvrir à la main »).
// L'id Gmail du message part avec chaque fichier : Fit Pulse refuse un message déjà traité.
// Chaque envoi est noté dans la feuille « Journal imports ».
// Le jeton du club est lu dans les propriétés du script (FP_CLUB_TOKEN), jamais écrit ici.

var LABEL_IN = 'FP-import';
var LABEL_OK = 'FP-importé';
var LABEL_KO = 'FP-erreur';
var INGEST_URL = 'https://europe-west1-VOTRE-PROJET.cloudfunctions.net/ingestRecevoir';
var CLUB_ID = 'votre-club';
var EXTENSIONS = /\.(csv|zip|xlsx)$/i;
var JOURNAL = 'Journal imports';
var RECHERCHE = 'label:' + LABEL_IN + ' -label:' + LABEL_OK + ' newer_than:3d';

// À lancer une fois : libellés et déclencheur toutes les 15 minutes.
function installer() {
  [LABEL_IN, LABEL_OK, LABEL_KO].forEach(function (l) { if (!GmailApp.getUserLabelByName(l)) GmailApp.createLabel(l); });
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'releverImports') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('releverImports').timeBased().everyMinutes(15).create();
}

function releverImports() {
  var verrou = LockService.getScriptLock(); if (!verrou.tryLock(5000)) return;
  try {
    var props = PropertiesService.getScriptProperties();
    var jeton = props.getProperty('FP_CLUB_TOKEN'); var manager = props.getProperty('FP_MANAGER_EMAIL');
    if (!jeton) throw new Error('Propriété FP_CLUB_TOKEN manquante');
    var ok = GmailApp.getUserLabelByName(LABEL_OK) || GmailApp.createLabel(LABEL_OK);
    var ko = GmailApp.getUserLabelByName(LABEL_KO) || GmailApp.createLabel(LABEL_KO);
    GmailApp.search(RECHERCHE).forEach(function (fil) {
      var bilan = { ok: 0, ko: 0 };
      fil.getMessages().forEach(function (msg) { traiterMessage(msg, jeton, manager, bilan); });
      if (bilan.ko) fil.addLabel(ko); else if (bilan.ok) fil.addLabel(ok);
    });
  } finally { verrou.releaseLock(); }
}

function traiterMessage(msg, jeton, manager, bilan) {
  var pj = msg.getAttachments().filter(function (a) { return EXTENSIONS.test(a.getName()); });
  if (pj.length) { pj.forEach(function (a) { envoyer(a.copyBlob().setName(a.getName()), msg, jeton, bilan); }); return; }
  extraireLiens(msg.getBody() || msg.getPlainBody() || '').forEach(function (lien) {
    var r; try { r = UrlFetchApp.fetch(lien, { followRedirects: true, muteHttpExceptions: true }); } catch (e) { bilan.ko++; noter(msg, lien, 0, 'lien injoignable'); return; }
    var h = r.getAllHeaders() || {}; var type = String(h['Content-Type'] || h['content-type'] || '').toLowerCase(); var dispo = String(h['Content-Disposition'] || h['content-disposition'] || '');
    if (r.getResponseCode() === 200 && (/attachment|filename=/i.test(dispo) || /zip|csv|octet-stream|spreadsheetml/.test(type))) {
      var nom = nomFichier(dispo, lien, type); envoyer(r.getBlob().setName(nom), msg, jeton, bilan);
    } else if (/text\/html/.test(type) && pageDeConnexion(r.getContentText())) {
      bilan.ko++; noter(msg, lien, 0, 'page de connexion : rien importé');
      if (manager) MailApp.sendEmail(manager, 'Export à ouvrir à la main', 'Fit Pulse n’a pas pu télécharger cet export Resamania : le lien demande une connexion.\n\nObjet : ' + msg.getSubject() + '\nLien : ' + lien + '\n\nOuvrez-le, téléchargez le fichier puis déposez-le dans Fit Pulse, page Imports.');
    }
  });
}

function envoyer(blob, msg, jeton, bilan) {
  var r = UrlFetchApp.fetch(INGEST_URL, { method: 'post', headers: { 'X-Club-Id': CLUB_ID, 'X-Club-Token': jeton }, payload: { gmailId: msg.getId(), file: blob }, muteHttpExceptions: true });
  var code = r.getResponseCode();
  if (code === 200 || code === 409) bilan.ok++; else bilan.ko++; // 409 : message déjà traité, rien de nouveau
  noter(msg, blob.getName(), blob.getBytes().length, code + ' ' + String(r.getContentText() || '').slice(0, 120));
}

function extraireLiens(texte) {
  var vus = {}; var out = [];
  (String(texte).match(/https:\/\/[^\s"'<>)]+/g) || []).forEach(function (u) { u = u.replace(/&amp;/g, '&'); if (!vus[u]) { vus[u] = true; out.push(u); } });
  return out.slice(0, 5);
}
function pageDeConnexion(html) { return /type=["']?password|mot de passe|se connecter|connexion|login|sign in/i.test(String(html).slice(0, 20000)); }
function nomFichier(dispo, lien, type) {
  var m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(dispo); if (m) return decodeURIComponent(m[1]);
  var base = String(lien).split('?')[0].split('/').pop() || 'export';
  return EXTENSIONS.test(base) ? base : base + (/zip/.test(type) ? '.zip' : /spreadsheetml/.test(type) ? '.xlsx' : '.csv');
}

// Journal : date, objet, fichier, taille, réponse du serveur.
function noter(msg, fichier, taille, reponse) {
  var props = PropertiesService.getScriptProperties(); var id = props.getProperty('FP_JOURNAL_ID'); var feuille;
  if (id) { try { feuille = SpreadsheetApp.openById(id).getSheets()[0]; } catch (e) { feuille = null; } }
  if (!feuille) { var classeur = SpreadsheetApp.create(JOURNAL); feuille = classeur.getSheets()[0]; feuille.appendRow(['Date', 'Objet', 'Fichier', 'Taille (octets)', 'Réponse du serveur']); props.setProperty('FP_JOURNAL_ID', classeur.getId()); }
  feuille.appendRow([new Date(), msg.getSubject(), fichier, taille, reponse]);
}
