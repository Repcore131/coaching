# Registre des traitements (article 30 RGPD) : Fit Pulse

| Rubrique | Contenu |
|---|---|
| Traitement | Pilotage commercial et fidélisation Fit Pulse |
| Responsable de traitement | Société exploitante du club Fitness Park (Niort) |
| Contact | Responsable du club |
| Finalités | Suivi de l'activité commerciale de l'équipe ; relances de fidélisation des adhérents (suivi J+15 et J+30, anniversaire, fin d'engagement, anciens membres) ; recouvrement amiable des impayés ; traitement des demandes de résiliation |
| Bases légales | Intérêt légitime (suivi commercial, fidélisation) ; exécution du contrat d'abonnement (impayés, résiliations) |
| Personnes concernées | Membres de l'équipe commerciale ; adhérents, anciens adhérents, prospects et invités du club |
| Données de l'équipe | Prénom, nom, e-mail professionnel, rôle, clubs, saisies de KPI, présences, notes de coaching |
| Données des adhérents | Nom, numéro Resamania, téléphone, e-mail, offre et prix, dates de début et de fin, jour et mois d'anniversaire (année supprimée), solde dû et date du plus ancien incident, demande et motif de résiliation, contacts notés (canal, issue, note), achats boutique rattachés au numéro, entreprise de rattachement |
| Données exclues | Pièces d'identité, RIB, données de santé (le motif « Santé » de résiliation est une catégorie, sans détail) |
| Source | Exports Resamania déposés par un manager ; saisies de l'équipe |
| Destinataires | L'équipe du club selon son rôle (membre, manager, créateur) |
| Sous-traitant | Google Firebase (authentification, base de données temps réel, hébergement) |
| Transferts hors UE | Selon la région du projet Firebase ; clauses contractuelles types de Google |
| Durées de conservation (constante `RETENTION`, club/donnees.js) | Anciens adhérents : 36 mois après la sortie. Impayés soldés : 24 mois. Résiliations : 24 mois. Messages du chat : 12 mois. Contacts notés : 36 mois. Journal d'erreurs : 30 jours. Purge lancée par le créateur depuis Mes clubs > Réglages > Conservation des données |
| Droits | Accès : export CSV depuis la fiche client. Effacement : bouton « Effacer cet adhérent » (manager), trace sans donnée personnelle dans l'audit. Opposition aux SMS et appels : cases sur la fiche, issue « Ne plus contacter » |
| Mesures de sécurité | Connexion par e-mail et code personnel (seule l'empreinte du code est stockée) ; règles d'accès par rôle côté serveur ; journal d'audit en création seule ; CSP stricte, bibliothèques hébergées par le club ; exports marqués CONFIDENTIEL et tracés ; neutralisation des formules dans les CSV ; aucune donnée d'adhérent dans le journal d'erreurs |

## Fiche : Suivi des demandes de résiliation

| Rubrique | Contenu |
|---|---|
| Traitement | Suivi des demandes de résiliation et de suspension d'abonnement |
| Finalités | Répondre à chaque demande dans le délai fixé par le club ; confirmer par écrit la résiliation validée (date de fin, dernier prélèvement) ; proposer, si l'adhérent le souhaite, une alternative (pause, autre formule) ; mesurer les délais de réponse et le taux de sauvetage |
| Base légale | Exécution du contrat d'abonnement (traitement de la demande, confirmation écrite) et obligation légale de confirmer la résiliation ; intérêt légitime pour la proposition d'alternative et les statistiques |
| Personnes concernées | Adhérents ayant demandé une résiliation ou une suspension ; expéditeurs d'e-mails écartés comme « faux positifs » (aucune donnée gardée au-delà de la fiche ignorée) |
| Données | Nom, numéro client, date de réception de la demande, motif (liste fermée : Prix, Déménagement, Santé, Manque de temps, Insatisfaction, Concurrence, Autre ; « Santé » sans aucun détail), date d'effet, état Resamania, objet de l'e-mail et dates des messages (reçus et réponses), actions de l'équipe (appel, offre proposée, validation). E-mail, téléphone et, si le club l'active, extrait de 280 caractères du premier message : rangés à part dans `/private/resiliations/{club}/{id}` |
| Données exclues | Corps complet des e-mails (il reste dans la boîte de l'accueil), pièces jointes, détail médical |
| Sources | Boîte e-mail de l'accueil (script Google Apps Script en lecture seule ou Microsoft Graph, permission Mail.Read limitée à cette boîte) ; exports Resamania ; saisies de l'équipe |
| Destinataires | Manager du club : tous les dossiers ; commercial : ses dossiers seulement. E-mail et téléphone : manager du club et responsable du dossier, contrôlé par les règles de la base. Notifications d'escalade et résumé du matin : prénom et initiale du nom seulement |
| Durée de conservation | 24 mois après la clôture du dossier (`RETENTION.resiliationMois`), puis suppression du dossier et de ses données privées par la purge |
| Sous-traitants | Google (Gmail et Apps Script de la boîte accueil, Cloud Functions, Secret Manager) ; Firebase (authentification, base de données temps réel, hébergement) ; Microsoft (Exchange Online) pour les clubs sur Microsoft 365 |
| Transferts hors UE | Fonctions et secrets en région europe-west1 ; base selon la région du projet Firebase ; clauses contractuelles types de Google et de Microsoft |
| Mesures de sécurité | Relève signée (HMAC SHA-256, horodatage à 10 minutes près, secret dans Secret Manager, jamais dans la base) ; rotation du secret avec 24 h de recouvrement ; écriture des dossiers relevés par le seul compte de service ; données de contact séparées et lues à l'ouverture du détail ; aucune donnée personnelle dans les journaux des fonctions ; contrôle de conformité « Confirmations envoyées » sur la page Résiliations et dans le résumé du matin |
