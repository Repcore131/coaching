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
