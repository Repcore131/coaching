# Sources des exports Resamania de Fit Pulse

Document de cadrage, sans code applicatif. Il reprend les 17 exports des routines
`ROUTINE_WEEK` (7) et `ROUTINE_MONTH` (10) de `club/pages-resamania.js`, décrits
dans `RSM_DEFS` (`club/resamania.js`), et indique pour chacun la source cible
d'une future automatisation.

Doc publique lue le 10/10/2026 :

- index : https://doc.resamania.com/llms.txt
- webhooks : https://doc.resamania.com/webhooks/webhooks.html
- limites d'appels : https://doc.resamania.com/general/rate-limiting.html
- incidents et clôtures : https://doc.resamania.com/contacts/incidents-and-closures.html
- référence de l'API, par domaine : https://doc.resamania.com/api-reference/contact.html,
  https://doc.resamania.com/api-reference/sale.html,
  https://doc.resamania.com/api-reference/accounting.html,
  https://doc.resamania.com/api-reference/club.html

## Règles de lecture

- **Source cible** : « API » si un domaine de la doc (Contact, Sale, Accounting, Club) couvre
  les données de l'export ; « Webhook » si un événement de la page Webhooks les signale ;
  « Export BI » sinon. Quand un webhook complète l'API, les deux sont indiqués.
- **Statut** : « confirmé » seulement quand un endpoint exact, avec le filtre utile, est cité
  dans la doc publique ; le lien de la page est alors donné. Partout ailleurs :
  « à confirmer avec api@resamania.fr ».
- Un statut « confirmé » veut dire que l'endpoint existe dans la doc. La correspondance
  colonne par colonne avec l'export reste à vérifier en sandbox.
- Les pages de référence de l'API s'affichent dans le navigateur ; les chemins cités viennent
  de la spécification publiée avec ces pages (même méthode et même résumé que la page).

## Les 17 exports

| N° | Routine | id RSM_DEFS | Chemin Resamania (path) | Filtres | Fréquence | Alimente dans Fit Pulse (feeds) | Source cible | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | Semaine | `ventes` | Exports de gestion > Exporter > Membres & Ventes > Vente d'abonnements | 30 derniers jours | Chaque lundi | Contrats signés (commercial initial), nouveaux adhérents J+15 / J+30 | API (Sale) | confirmé : `GET /{client_token}/sales`, filtres `createdAt[...]`, `state`, `clubId` ; https://doc.resamania.com/api-reference/operations/getSaleCollection.html. Le commercial initial et le produit vendu restent à vérifier en sandbox. |
| 2 | Semaine | `clients-incident` | Exports de gestion > Exporter > Points d'attention > Clients en incident | Date de visualisation = ce lundi, Club | Chaque lundi | Impayés en cours : solde par client à une date | API (Accounting) et Webhook (`accounting_contact_tag.*`, étiquettes commençant par `blocking`) | à confirmer avec api@resamania.fr : la doc cite `/financial_summary?contactId=` et `/incidents?contact=` client par client, pas de liste des clients en incident à une date. |
| 3 | Semaine | `sans-mandat` | Exports de gestion > Exporter > Points d'attention > Clients abonnés sans prélèvement | Club | Chaque lundi | Adhérents sans mandat (tâche de relance) | API (Contact, mandats) | à confirmer avec api@resamania.fr : la doc cite le contrôle d'un mandat par contact, pas de liste des abonnés sans prélèvement. |
| 4 | Semaine | `incidents` | Données financières > Incidents > FILTRER (Statut, Date de régularisation, Club) > Exporter | Statut = Régularisé, Date de régularisation = la semaine passée, Club | Chaque lundi | Impayés récupérés par canal, impayés en cours | API (Accounting) | à confirmer avec api@resamania.fr : `/incidents?contact=` est cité par contact ; aucun filtre par date de régularisation ni canal de règlement n'est documenté. |
| 5 | Semaine | `paiements` | Données financières > Paiements > FILTRER (Période) > Exporter | Période = la semaine (moins de 2 000 lignes) | Chaque lundi | Contrôle : encaissements par moyen de paiement et par auteur | API (Accounting) | à confirmer avec api@resamania.fr : aucune liste des paiements n'est documentée (seulement la création d'un paiement sur une vente). |
| 6 | Semaine | `abonnements` | Clients > Abonnements > FILTRER (Fin d'engagement = 30 prochains jours, Masquer les résiliés) > Exporter | Fin d'engagement = 30 prochains jours, résiliés masqués | Chaque lundi | Fins de contrat (relances de renouvellement) | API (Contact) et Webhook (`subscription.deleted`) | confirmé : `GET /{client_token}/subscriptions`, filtres `engagedThrough[...]`, `isTerminated`, `clubId` ; https://doc.resamania.com/api-reference/operations/getSubscriptionCollection.html |
| 7 | Semaine | `clients` | Clients > Clients club > FILTRER (Statut = Client) > Exporter | Statut = Client | Chaque lundi | Base clients : anniversaires, statut, commercial | API (Contact) et Webhook (`contact.created`, `contact.updated`) | confirmé : `GET /{client_token}/contacts`, filtres `state=client`, `birthDate[...]`, `currentSalepersonId` ; https://doc.resamania.com/api-reference/operations/getContactCollection.html |
| 8 | Mois | `ventes` | Exports de gestion > Exporter > Membres & Ventes > Vente d'abonnements | Du 1er au dernier jour du mois | Début de mois | Contrats signés du mois | API (Sale) | confirmé : `GET /{client_token}/sales`, filtre `createdAt[...]` ; https://doc.resamania.com/api-reference/operations/getSaleCollection.html |
| 9 | Mois | `factures` | Exports de gestion > Exporter > Finance > Factures & avoirs | Mois, Entité = société d'exploitation, Club (ZIP) | Début de mois | Nutrition, accessoires, contrat B2B (société du client) | API (Accounting) | à confirmer avec api@resamania.fr : la doc cite `/invoices/{id}/financial` pour une facture donnée ; aucune liste de factures ou d'avoirs n'est documentée. |
| 10 | Mois | `evolution` | Exports de gestion > Exporter > Membres & Ventes > Évolution clients | Dates du mois, Club (ZIP) | Début de mois | Base adhérents : entrées et sortants du mois | API (Contact, Club) | à confirmer avec api@resamania.fr : `GET /{client_token}/network_stats` existe mais son contenu n'est pas décrit. |
| 11 | Mois | `tti` | Exports de gestion > Exporter > Membres & Ventes > Taux de transformation par commerciaux | Dates du mois | Début de mois | Taux de transformation des prospects par commercial (contrôle) | API (Contact, prospection) | à confirmer avec api@resamania.fr : le taux n'est pas documenté ; seuls les filtres `salePersonId` et `transformationDate` existent sur la prospection. |
| 12 | Mois | `web` | Exports de gestion > Exporter > Finance > Rapport détaillé des transactions Web | Mois, Club | Début de mois | Contrôle : impayés réglés en ligne | API (Accounting) | à confirmer avec api@resamania.fr : seuls `payable_objects` et `web_wallets` sont documentés, sans filtre « recouvrement ». |
| 13 | Mois | `perf` | Exports de gestion > Exporter > Spécifiques > Export des performances commerciales | Mois, Club | Début de mois | Contrôle : contrats par commercial | Export BI | à confirmer avec api@resamania.fr : aucun domaine ne décrit cet export. |
| 14 | Mois | `incidents` | Données financières > Incidents > FILTRER > Exporter | Statut = Régularisé, Date de régularisation = le mois | Début de mois | Impayés récupérés par canal | API (Accounting) | à confirmer avec api@resamania.fr : même limite que la ligne 4. |
| 15 | Mois | `resil` | Clients > Résiliations > FILTRER (Date de création = le mois) > Exporter | Date de création = le mois, tous les statuts | Début de mois | Demandes à arbitrer, acceptées, rejetées, annulées ; motifs techniques écartés | API (Contact) | à confirmer avec api@resamania.fr : `POST /{clientToken}/cancellations` est décrit en création ; aucune liste des demandes par statut n'est documentée. |
| 16 | Mois | `prospects` | Clients > Prospects > FILTRER (Date de création) > Exporter | Date de création = le mois | Début de mois | Prospects créés par commercial | API (Contact) et Webhook (`contact.created`) | confirmé : `GET /{client_token}/contacts`, filtres `state=prospect`, `createdAt[...]`, `initialSalepersonId` ; https://doc.resamania.com/api-reference/operations/getContactCollection.html |
| 17 | Mois | `paiements` | Données financières > Paiements > FILTRER (Période) > Exporter | Période = le mois, découpé en semaines si besoin | Début de mois | Contrôle : encaissements par moyen de paiement | API (Accounting) | à confirmer avec api@resamania.fr : même limite que la ligne 5. |

Bilan : 5 lignes confirmées (1, 6, 7, 8 et 16), 12 à confirmer.

## Ce que dit la doc et qui pèse sur le choix

- Les webhooks ne sont pas renvoyés en cas d'échec ; la page recommande une
  réconciliation périodique par l'API (https://doc.resamania.com/webhooks/webhooks.html).
- Aucun événement n'est documenté pour une vente, un paiement, une facture ou une demande de
  résiliation (même page).
- La page des limites d'appels déconseille l'API pour un projet de type BI et renvoie vers
  des « capacités d'export dédiées », sans en décrire le format
  (https://doc.resamania.com/general/rate-limiting.html).

## Questions à poser à Resamania

1. Quelles sont les « capacités d'export dédiées » citées sur la page des limites d'appels : format, fréquence, livraison (fichier, SFTP, entrepôt), coût ?
2. Existe-t-il une liste des incidents filtrable par statut, date de régularisation et club, avec le canal de règlement ?
3. Existe-t-il une liste des paiements et une liste des factures et avoirs (avec leurs lignes) filtrables par période et par club ?
4. Comment obtenir la liste des clients en incident et leur solde à une date, sans appeler `/financial_summary` client par client ?
5. Comment lister les demandes de résiliation par statut (à arbitrer, acceptée, rejetée, annulée) et par date de création ?
6. Le commercial initial d'une vente et le taux de transformation par commercial sont-ils exposés par l'API ?
7. Quels quotas s'appliquent à une synchronisation nocturne et horaire en lecture seule, en sandbox puis en production ?
8. Un événement de webhook est-il prévu pour la création d'abonnement, la vente, le paiement et la demande de résiliation, et une signature des envois est-elle possible ?
