# Sources de données santé

Ce document sert au développement, pas à l'athlète. Il dit **quelles notices
sont vérifiées** et lesquelles attendent d'être remplies.

## La règle qui a présidé à cette table

Aucun chemin constructeur n'est inventé. Une notice ne porte un chemin que si
ce chemin a été **dicté ou vérifié**. Partout ailleurs, l'écran affiche la
recherche générique — « ouvre l'application et cherche *sommeil* » — qui est
vraie sur toutes les applications, y compris après une refonte de leurs menus.

Un chemin faux coûte plus cher que pas de chemin du tout : il envoie chercher
un menu qui n'existe pas, et la personne conclut que l'application se trompe.

## État actuel

| Marque | Application | Sommeil | Pas | Vérifié |
|---|---|---|---|---|
| Apple | Apple Santé | Santé → Parcourir → Sommeil | Santé → Parcourir → Activité → Pas | 2026-09 |
| Garmin | Garmin Connect | Plus → Statistiques de santé → Sommeil | générique | 2026-09 |
| Samsung | Samsung Health | générique | générique | — |
| Google / Pixel | Google Health Connect | générique | générique | — |
| Huawei | Huawei Santé | générique | générique | — |
| Fitbit | Fitbit | générique | générique | — |
| Xiaomi / Redmi | Mi Fitness | générique | générique | — |
| Amazfit | Zepp | générique | générique | — |
| Polar | Polar Flow | générique | générique | — |
| COROS | COROS | générique | générique | — |
| Suunto | Suunto | générique | générique | — |
| WHOOP | WHOOP | générique | **indisponible** | — |
| Oura | Oura | générique | générique | — |
| Withings | Withings Health Mate | générique | générique | — |
| OnePlus / OPPO | OHealth | générique | générique | — |
| Mobvoi / TicWatch | Mobvoi Health | générique | générique | — |
| HONOR | HONOR Health | générique | générique | — |
| realme | realme Link | générique | générique | — |
| CMF / Nothing | Nothing X | générique | générique | — |
| Fossil | Fossil Smartwatches | générique | générique | — |
| TAG Heuer | TAG Heuer Connected | générique | générique | — |
| Montblanc | Montblanc Summit | générique | générique | — |
| RingConn | RingConn | générique | générique | — |
| Ultrahuman | Ultrahuman | générique | générique | — |
| Circular | Circular | générique | générique | — |
| Casio | Casio Watches | générique | générique | — |

## Ajouter une marque

Un seul objet dans `TRACKERS`, dans `app/index.html`. Ni le graphique, ni la
recherche, ni les écrans ne bougent.

```
{id:'…', marque:'…', app:'…', modeles:['…'],
 sommeil:{chemin:['…','…'], alternatif:['…'], note:'…'},
 pas:{chemin:null},          // null = repli générique
 verifie:'2026-09'}
```

`chemin:null` est un choix, pas un oubli : c'est ce qui déclenche le repli
générique. `indisponible:true` sur un bloc dit que l'appareil ne mesure pas
cette donnée — l'écran l'annonce et propose la saisie manuelle.

## Ce qui n'existe pas, et ne doit pas être simulé

Aucune synchronisation automatique. Rien dans ce module ne parle à Garmin,
Apple ou Samsung. Le modèle porte `source`, `sourceDevice`, `dataStatus`,
`createdAt` et `updatedAt` pour le jour où une API existera ; en attendant,
chaque entrée est `dataStatus:'manual'`, et aucun texte ne laisse croire à une
synchronisation.

`estimated` n'est jamais posé : aucune estimation n'est calculée.
