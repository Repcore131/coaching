/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Reproduction interdite. */
'use strict';
// ══ FIT PULSE — partie légale ════════════════════════════════════════════
// Mentions légales, propriété intellectuelle, conditions d'utilisation et
// charte des utilisateurs, politique de confidentialité (RGPD), stockage
// local. Lisible sans être connecté (#/legal), acceptation des conditions à
// la première connexion sur la base partagée, protections contre la copie.

// Informations de l'éditeur. Les champs vides s'affichent « à compléter ».
const LEGAL = {
  version: '1.0', date: '6 octobre 2026',
  auteur: 'Kévin GUELLEC',
  societe: 'FPN Gestion', club: 'Fitness Park Niort',
  forme: '', capital: '', rcs: '', siret: '', adresse: '', tel: '',
  email: 'kevinguellec.pro@gmail.com',
  site: 'https://fitpulse-niort.web.app',
  domaines: ['fitpulse-niort.web.app', 'fitpulse-niort.firebaseapp.com', 'localhost', '127.0.0.1'],
};
const LEGAL_COPY = `© ${new Date().getFullYear() > 2026 ? '2026-' + new Date().getFullYear() : '2026'} ${LEGAL.auteur} et ${LEGAL.societe} (${LEGAL.club}). Tous droits réservés.`;
const lv = v => (v ? esc(v) : '<span class="legal-todo">à compléter</span>');

const LEGAL_TABS = [['mentions', 'Mentions légales'], ['propriete', 'Propriété et copyright'], ['cgu', 'Conditions et charte'], ['confidentialite', 'Confidentialité (RGPD)'], ['stockage', 'Stockage local']];

function legalBody(tab) {
  const R = typeof RETENTION !== 'undefined' ? RETENTION : { clientInactifMois: 36, impayeSoldeMois: 24, resiliationMois: 24, chatMois: 12, importsMois: 13, contactsMois: 36, logsJours: 30 };
  const S_ = {
    mentions: `<h2>Mentions légales</h2>
      <p class="muted small">Loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique (LCEN), article 6-III.</p>
      <h3>Éditeur</h3>
      <p><b>${esc(LEGAL.societe)}</b>, exploitant du club ${esc(LEGAL.club)}<br>Forme juridique : ${lv(LEGAL.forme)} · Capital social : ${lv(LEGAL.capital)}<br>RCS : ${lv(LEGAL.rcs)} · SIRET : ${lv(LEGAL.siret)}<br>Siège : ${lv(LEGAL.adresse)}<br>Téléphone : ${lv(LEGAL.tel)} · E-mail : <a href="mailto:${esc(LEGAL.email)}">${esc(LEGAL.email)}</a></p>
      <h3>Directeur de la publication</h3><p>${esc(LEGAL.auteur)}</p>
      <h3>Conception et développement</h3><p>${esc(LEGAL.auteur)}, auteur de l’application Fit Pulse.</p>
      <h3>Hébergement</h3>
      <p>Site : Firebase Hosting, <b>Google Ireland Limited</b>, Gordon House, Barrow Street, Dublin 4, Irlande.<br>Base de données et authentification : Firebase, <b>Google LLC</b>, 1600 Amphitheatre Parkway, Mountain View, CA 94043, États-Unis.</p>
      <h3>Nature du service</h3>
      <p>Fit Pulse est un outil <b>interne et privé</b> de pilotage commercial, réservé aux personnes habilitées du club ${esc(LEGAL.club)}. Il n’est ni vendu ni ouvert au public.</p>
      <h3>Marques</h3>
      <p>« Fitness Park » est une marque déposée appartenant à son titulaire et utilisée dans le cadre du contrat de franchise du club. « Fit Pulse » est un outil indépendant, édité par ${esc(LEGAL.societe)} : il n’est ni édité ni approuvé par le réseau Fitness Park. « Resamania » et « WhatsApp » sont des marques de leurs titulaires respectifs.</p>`,
    propriete: `<h2>Propriété intellectuelle et copyright</h2>
      <p><b>${esc(LEGAL_COPY)}</b></p>
      <h3>Titulaires des droits</h3>
      <p>L’application <b>Fit Pulse</b> et l’ensemble de ses éléments appartiennent exclusivement à <b>${esc(LEGAL.auteur)}</b>, auteur, et à <b>${esc(LEGAL.societe)}</b> (${esc(LEGAL.club)}) : son nom, son logo et son identité visuelle, son code source et objet, son architecture, ses interfaces et écrans, ses textes, modèles de messages, méthodes de calcul (scores, paliers, primes, prévisions), sa documentation et sa base de données.</p>
      <p>Ces éléments sont protégés par le Code de la propriété intellectuelle, notamment au titre du droit d’auteur (articles L111-1 et L112-2, 13° pour le logiciel) et du droit des producteurs de bases de données (articles L341-1 et suivants).</p>
      <h3>Ce qui est interdit</h3>
      <p>Sauf autorisation écrite et préalable des titulaires, sont strictement interdits, en tout ou partie et par quelque moyen que ce soit :</p>
      <ul><li>la reproduction, la copie ou le téléchargement du code, des écrans ou des textes ;</li><li>la représentation, la diffusion ou la mise à disposition à un tiers, y compris à un autre club ou réseau ;</li><li>l’adaptation, la modification, la traduction, la création d’une application dérivée ou imitant celle-ci ;</li><li>la décompilation ou l’ingénierie inverse, hors des cas strictement prévus par l’article L122-6-1 ;</li><li>l’extraction ou la réutilisation d’une partie substantielle de la base de données ;</li><li>la vente, la location, le prêt ou toute exploitation commerciale ;</li><li>la suppression ou la modification des mentions de propriété et de copyright.</li></ul>
      <h3>Licence d’utilisation</h3>
      <p>Chaque utilisateur habilité reçoit un droit d’usage <b>personnel, non exclusif, non cessible et révocable</b>, limité à la durée de ses fonctions au sein du club et aux seuls besoins de l’activité du club. Ce droit ne transfère aucune propriété.</p>
      <h3>Contrefaçon : poursuites</h3>
      <p>Toute exploitation non autorisée constitue une contrefaçon sanctionnée par les articles <b>L335-2 et L335-3</b> du Code de la propriété intellectuelle (jusqu’à <b>3 ans d’emprisonnement et 300 000 € d’amende</b>), sans préjudice des dommages et intérêts. Les titulaires poursuivront <b>systématiquement</b> toute copie, imitation ou utilisation illicite, par toutes voies civiles et pénales.</p>
      <h3>Protections techniques</h3>
      <p>L’application est marquée, horodatée et protégée : accès par code personnel, données réservées aux comptes habilités, fonctionnement limité aux adresses officielles, journal des actions. Contourner ces mesures est interdit (article L335-3-1).</p>
      <h3>Signaler une copie</h3><p>Écrivez à <a href="mailto:${esc(LEGAL.email)}">${esc(LEGAL.email)}</a>.</p>`,
    cgu: `<h2>Conditions d’utilisation et charte des utilisateurs</h2>
      <p class="muted small">Version ${esc(LEGAL.version)} du ${esc(LEGAL.date)}. Acceptées par chaque utilisateur à sa première connexion.</p>
      <h3>1. Objet et accès</h3>
      <p>Fit Pulse sert au pilotage commercial du club : saisies de ventes, objectifs, classement, relances des adhérents et prospects, impayés, résiliations, récapitulatifs. L’accès est réservé aux salariés et managers du club désignés par un manager, avec un <b>code personnel</b>. Les droits dépendent du rôle : <b>membre</b> (commercial : ses saisies, ses relances, la vue d’équipe), <b>manager</b> (pilotage de l’équipe, imports, objectifs, invitations), <b>créateur</b> (administration complète).</p>
      <h3>2. Compte et code personnel</h3>
      <p>Le code est strictement <b>personnel et confidentiel</b>. Il ne doit être ni communiqué, ni noté à la vue de tous, ni utilisé par un collègue. Toute action faite avec un code est réputée faite par son titulaire. En cas de perte ou de doute, prévenez immédiatement un manager, qui génère un nouveau code (l’ancien cesse aussitôt de fonctionner).</p>
      <h3>3. Usage professionnel uniquement</h3>
      <p>L’application et les données qu’elle contient ne peuvent servir qu’à l’activité du club. Il est interdit :</p>
      <ul><li>de copier, photographier, exporter ou transmettre des données d’adhérents ou de prospects hors du cadre du club, notamment vers un téléphone, un fichier ou un outil personnel ;</li><li>de contacter un adhérent ou un prospect à des fins personnelles ou pour le compte d’un autre employeur, pendant ou après le contrat de travail ;</li><li>de saisir des données sensibles (santé, origine, religion, opinions, vie sexuelle, condamnations), ou des pièces d’identité et coordonnées bancaires, y compris dans les notes et le chat ;</li><li>de saisir des informations fausses ou de gonfler ses résultats ;</li><li>de tenter d’accéder à des données ou fonctions non autorisées par son rôle.</li></ul>
      <h3>4. Relances des adhérents et prospects</h3>
      <p>Les appels et messages se font du lundi au samedi, entre 9 h et 20 h, avec courtoisie. Toute demande de ne plus être contacté (« STOP », refus oral) est notée aussitôt dans l’application (« Ne pas rappeler ») et respectée. Les SMS proposés contiennent la mention STOP. Un prospect n’est relancé que s’il a lui-même laissé ses coordonnées au club.</p>
      <h3>5. Suivi de l’activité commerciale (information des salariés)</h3>
      <p>Conformément aux articles L1221-9 et L1222-4 du Code du travail, chaque utilisateur est informé que l’application enregistre ses saisies, ses résultats par rapport aux objectifs, son score et son rang, ses relances et leurs issues, ainsi que la date de ses connexions. Finalités : pilotage commercial, animation de l’équipe, accompagnement individuel, calcul indicatif des primes selon les règles fixées par l’employeur. L’application ne fait <b>aucune géolocalisation, aucun enregistrement d’appel ni surveillance continue</b>. Le classement et les estimations de prime sont des aides : ils ne remplacent ni la décision de l’employeur, ni le contrat de travail. Les données de chaque salarié sont accessibles à lui-même et aux managers du club.</p>
      <h3>6. Fin des fonctions</h3>
      <p>Au départ d’un utilisateur, son accès est coupé (compte archivé) ; ses saisies restent dans l’historique du club pour la période travaillée. L’utilisateur ne conserve aucune donnée du club.</p>
      <h3>7. Manquements</h3>
      <p>Tout manquement à cette charte peut entraîner la suspension immédiate de l’accès et, le cas échéant, des sanctions disciplinaires prévues par le règlement intérieur, sans préjudice d’actions en justice (notamment pour violation de la confidentialité ou contrefaçon).</p>
      <h3>8. Disponibilité et responsabilité</h3>
      <p>L’application est fournie pour l’usage interne du club, sans garantie de disponibilité permanente. Les chiffres affichés dépendent des saisies et des exports importés : en cas d’écart, les données du logiciel de gestion du club font foi.</p>
      <h3>9. Droit applicable</h3><p>Ces conditions sont soumises au droit français. Tout litige relève des tribunaux compétents du ressort du siège de ${esc(LEGAL.societe)}.</p>`,
    confidentialite: `<h2>Politique de confidentialité</h2>
      <p class="muted small">Règlement (UE) 2016/679 (RGPD) et loi n° 78-17 du 6 janvier 1978 « Informatique et libertés ». Version ${esc(LEGAL.version)} du ${esc(LEGAL.date)}.</p>
      <h3>Responsable du traitement</h3>
      <p><b>${esc(LEGAL.societe)}</b>, exploitant du club ${esc(LEGAL.club)}, représentée par ${esc(LEGAL.auteur)}. Contact pour toute question ou demande : <a href="mailto:${esc(LEGAL.email)}">${esc(LEGAL.email)}</a>.</p>
      <h3>Personnes concernées et données</h3>
      <div class="table-wrap"><table class="t"><thead><tr><th>Personnes</th><th>Données</th><th>Origine</th></tr></thead><tbody>
        <tr><td>Utilisateurs (salariés, managers)</td><td>Nom, prénom, e-mail, rôle, club, empreinte du code (jamais le code en clair), saisies, objectifs, résultats, relances, préférences, date de dernière connexion, messages du chat</td><td>Le manager, l’utilisateur</td></tr>
        <tr><td>Adhérents et anciens adhérents</td><td>Nom, prénom, numéro client, téléphone, e-mail, jour et mois d’anniversaire (sans l’année), offre, dates de contrat, commercial, soldes d’impayés, résiliation et motif, échanges de relance</td><td>Exports du logiciel de gestion Resamania, saisies du club</td></tr>
        <tr><td>Prospects et invités</td><td>Nom, prénom, téléphone, e-mail, provenance, date de contact, température, relances et notes</td><td>Le prospect lui-même (club, site, réseaux), exports Resamania</td></tr>
      </tbody></table></div>
      <h3>Finalités et bases légales</h3>
      <div class="table-wrap"><table class="t"><thead><tr><th>Finalité</th><th>Base légale</th></tr></thead><tbody>
        <tr><td>Gérer les accès et la sécurité de l’application</td><td>Intérêt légitime (art. 6.1.f)</td></tr>
        <tr><td>Piloter l’activité commerciale, fixer et suivre les objectifs, calculer les primes indicatives</td><td>Exécution du contrat de travail et intérêt légitime de l’employeur</td></tr>
        <tr><td>Suivre et fidéliser les adhérents (accueil J+15 / J+30, fins de contrat, anniversaires), traiter les résiliations</td><td>Exécution du contrat d’abonnement et intérêt légitime</td></tr>
        <tr><td>Recouvrer les impayés</td><td>Exécution du contrat d’abonnement et intérêt légitime</td></tr>
        <tr><td>Rappeler les prospects qui ont demandé des informations</td><td>Mesures précontractuelles à leur demande et intérêt légitime ; opposition possible à tout moment</td></tr>
        <tr><td>Messages d’anniversaire et offres par SMS</td><td>Consentement ou relation client existante (art. L34-5 du Code des postes et communications électroniques) ; désinscription par STOP</td></tr>
      </tbody></table></div>
      <h3>Destinataires</h3>
      <p>Uniquement les personnes habilitées du club, selon leur rôle (un commercial voit ses relances et la vue d’équipe ; les managers voient l’ensemble du club). Aucune donnée n’est vendue, louée ni cédée. Sous-traitants techniques : <b>Google</b> (Firebase : hébergement, base de données, authentification ; Gmail : envoi des invitations), <b>GitHub</b> (Microsoft) pour le serveur automatique d’envoi des notifications et invitations. Lorsque l’utilisateur choisit d’envoyer un message, il passe par l’application téléphone, SMS ou WhatsApp de son appareil.</p>
      <h3>Transferts hors de l’Union européenne</h3>
      <p>La base de données Firebase est opérée par Google LLC aux États-Unis. Ce transfert est encadré par le <b>Data Privacy Framework UE–États-Unis</b> (décision d’adéquation du 10 juillet 2023), auquel Google LLC est certifiée, et par les clauses contractuelles types de la Commission européenne.</p>
      <h3>Durées de conservation</h3>
      <ul><li>Comptes utilisateurs : le temps des fonctions, puis archivage ; saisies conservées avec l’historique du club.</li><li>Anciens adhérents : ${R.clientInactifMois / 12} ans après la fin du contrat, sauf impayé en cours.</li><li>Impayés soldés : ${R.impayeSoldeMois / 12} ans ; résiliations : ${R.resiliationMois / 12} ans.</li><li>Échanges de relance et contacts : ${R.contactsMois / 12} ans ; chat : ${R.chatMois} mois ; imports : ${R.importsMois} mois ; journaux techniques : ${R.logsJours} jours.</li><li>Dates de naissance : seuls le jour et le mois sont gardés, jamais l’année.</li></ul>
      <p>Une purge automatique applique ces durées (Données et RGPD, réservé aux managers).</p>
      <h3>Sécurité</h3>
      <p>Connexion chiffrée (HTTPS), codes personnels jamais stockés en clair (empreinte salée), règles d’accès par rôle vérifiées côté serveur, journal des actions sensibles non effaçable, coupure immédiate d’un accès, sauvegarde et purge des données anciennes.</p>
      <h3>Vos droits</h3>
      <p>Vous disposez d’un droit d’<b>accès</b>, de <b>rectification</b>, d’<b>effacement</b>, de <b>limitation</b>, d’<b>opposition</b> (notamment à toute relance commerciale), de <b>portabilité</b> et du droit de définir des directives sur le sort de vos données après votre décès. Pour les exercer : <a href="mailto:${esc(LEGAL.email)}">${esc(LEGAL.email)}</a> ou à l’accueil du club ; une réponse vous est apportée sous un mois. Les managers disposent dans l’application de l’export et de l’effacement complet d’une fiche adhérent.</p>
      <p>Vous pouvez introduire une réclamation auprès de la <b>CNIL</b> : 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, <a href="https://www.cnil.fr" target="_blank" rel="noopener">www.cnil.fr</a>.</p>
      <h3>Décisions automatisées</h3><p>Aucune décision produisant des effets juridiques n’est prise de manière entièrement automatisée. Scores, classements, priorités de relance et primes estimées sont des aides à la décision.</p>`,
    stockage: `<h2>Stockage local et cookies</h2>
      <p>Fit Pulse n’utilise <b>aucun cookie publicitaire, aucun traceur de mesure d’audience et aucun réseau social intégré</b>. Aucun bandeau de consentement n’est donc nécessaire.</p>
      <p>Seuls des éléments <b>strictement nécessaires</b> au fonctionnement sont enregistrés sur votre appareil (stockage local du navigateur et IndexedDB), exemptés de consentement (article 82 de la loi Informatique et libertés) :</p>
      <ul><li>la session de connexion (pour rester connecté) et le dernier e-mail saisi ;</li><li>le thème clair ou sombre et le club choisi ;</li><li>une copie de travail des données pour fonctionner sans réseau, et les saisies en attente d’envoi ;</li><li>l’abonnement aux notifications, si vous l’avez activé.</li></ul>
      <p>La déconnexion efface la copie hors ligne. Vous pouvez tout supprimer à tout moment depuis les réglages de votre navigateur.</p>`,
  };
  return S_[tab] || S_.mentions;
}
function legalPage(tab) {
  const t = LEGAL_TABS.some(x => x[0] === tab) ? tab : 'mentions';
  return `<div class="legal"><div class="chips legal-tabs">${LEGAL_TABS.map(([k, l]) => `<a class="chip-radio ${k === t ? 'on' : ''}" href="#/legal/${k}"><span>${l}</span></a>`).join('')}</div>
    <article class="card legal-doc">${legalBody(t)}</article><p class="muted small legal-copy">${esc(LEGAL_COPY)} Fit Pulse version ${esc(typeof APP_VERSION !== 'undefined' ? APP_VERSION : '')}.</p></div>`;
}
PAGES.legal = { title: 'Informations légales', render(args) { return `<div class="page-head"><div><h1>Informations légales</h1><p>Mentions légales, propriété, conditions d’utilisation et confidentialité.</p></div></div>${legalPage(args && args[0])}`; } };
// Hors connexion : la même page, seule, avec un retour à l'écran de connexion.
function legalStandalone(tab) {
  return `<div class="legal-solo"><div class="row" style="margin-bottom:12px"><a class="btn ghost" href="#/">${ico('chevL')} Retour</a><span class="spacer"></span>${brandBlock()}</div><h1 class="title">Informations légales</h1>${legalPage(tab)}</div>`;
}
// Pied de page : liens légaux et copyright (écran de connexion, menu).
const legalFooter = () => `<div class="legal-foot"><a href="#/legal/mentions">Mentions légales</a> · <a href="#/legal/confidentialite">Confidentialité</a> · <a href="#/legal/cgu">Conditions</a> · <a href="#/legal/propriete">Copyright</a><div>${esc(LEGAL_COPY)}</div></div>`;

// ── Acceptation des conditions (base partagée) ────────────────────────────
function cguNeeded() { return backend.mode === 'firebase' && ME && pref('cguVersion', null) !== LEGAL.version; }
function cguGate() {
  if (!cguNeeded() || $('.cgu-gate') || /^#\/legal/.test(location.hash)) return;
  const el = document.createElement('div'); el.className = 'cgu-gate'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Conditions d’utilisation');
  el.innerHTML = `<div class="cgu-card"><h2>Avant de commencer</h2>
    <p>Fit Pulse est l’outil interne du club ${esc(LEGAL.club)}. Il contient des données personnelles d’adhérents et de prospects, et il suit votre activité commerciale.</p>
    <ul><li>Votre code est <b>personnel</b> : ne le partagez jamais.</li><li>Les données servent <b>uniquement</b> au club : pas de copie, de capture ni d’export personnel.</li><li>Relances du lundi au samedi, de 9 h à 20 h ; un « STOP » est respecté immédiatement.</li><li>Vos saisies, résultats, rang et relances sont visibles des managers, pour le pilotage et les primes. Aucune géolocalisation ni écoute.</li><li>L’application appartient à ${esc(LEGAL.auteur)} et ${esc(LEGAL.societe)} : toute copie est interdite et poursuivie.</li></ul>
    <p class="small" style="margin:0">À lire : <a href="#/legal/cgu" target="_blank" rel="noopener">conditions et charte</a> · <a href="#/legal/confidentialite" target="_blank" rel="noopener">politique de confidentialité</a> · <a href="#/legal/propriete" target="_blank" rel="noopener">propriété</a></p>
    <label class="pr-check"><input type="checkbox" id="cgu-1"><span>J’ai lu et j’accepte les conditions d’utilisation et la charte.</span></label>
    <label class="pr-check"><input type="checkbox" id="cgu-2"><span>J’ai pris connaissance de la politique de confidentialité et du suivi de mon activité.</span></label>
    <div class="row" style="gap:8px;margin-top:12px"><button class="btn" data-act="cguRefuse">Refuser et me déconnecter</button><span class="spacer"></span><button class="btn primary" id="cgu-ok" data-act="cguAccept" disabled>J’accepte</button></div></div>`;
  document.body.appendChild(el);
  const upd = () => { $('#cgu-ok').disabled = !($('#cgu-1').checked && $('#cgu-2').checked); };
  el.addEventListener('change', upd);
}
ACTIONS.cguAccept = () => {
  const now = Date.now();
  db.batch([[['prefs', ME.id, 'cguVersion'], LEGAL.version], [['prefs', ME.id, 'cguAt'], now], [['audit', newId()], { at: now, by: ME.id, action: 'cgu_acceptees', version: LEGAL.version }]]);
  const g = $('.cgu-gate'); if (g) g.remove(); toast('Merci. Bonne utilisation de Fit Pulse.');
};
ACTIONS.cguRefuse = () => { const g = $('.cgu-gate'); if (g) g.remove(); logout(); };

// ── Protections contre la copie ───────────────────────────────────────────
// Avertissement dans la console des outils de développement.
try {
  console.log('%cFIT PULSE', 'font:900 italic 28px Impact,sans-serif;color:#FFD600;background:#000;padding:4px 10px');
  console.log(`%c${LEGAL_COPY}\nLogiciel protégé par le Code de la propriété intellectuelle. Toute copie, reproduction, adaptation ou réutilisation, même partielle, est interdite et sera poursuivie (art. L335-2 et L335-3 CPI : 3 ans d’emprisonnement et 300 000 € d’amende).`, 'font:13px sans-serif;color:#d33');
} catch (e) { /* console indisponible */ }
// Fonctionnement limité aux adresses officielles : une copie hébergée ailleurs affiche un avertissement.
function legalDomainOk() {
  if (location.protocol === 'file:') return true;
  const h = location.hostname;
  return LEGAL.domaines.includes(h) || /^192\.168\.|^10\./.test(h);
}
if (!legalDomainOk()) {
  document.addEventListener('DOMContentLoaded', () => {
    document.body.innerHTML = `<div style="font-family:sans-serif;max-width:560px;margin:12vh auto;padding:24px;text-align:center;color:#eee;background:#111;border-radius:16px"><h1 style="color:#FFD600">Copie non autorisée</h1><p>Cette application est la propriété exclusive de ${esc(LEGAL.auteur)} et de ${esc(LEGAL.societe)} (${esc(LEGAL.club)}).</p><p>Sa reproduction ou son hébergement en dehors de l’adresse officielle est une contrefaçon (art. L335-2 et L335-3 du Code de la propriété intellectuelle) et fera l’objet de poursuites.</p><p>Signalement : ${esc(LEGAL.email)}</p></div>`;
  });
  window.PARKPULSE_BLOCKED = true;
}
