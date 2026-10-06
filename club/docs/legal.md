# Fit Pulse : partie légale

Dans l'application : **#/legal** (lisible sans connexion), liens en pied de chaque page et de l'écran de connexion.

| Onglet | Contenu |
|---|---|
| Mentions légales | Éditeur FPN Gestion, directeur de la publication Kévin GUELLEC, hébergeurs (Google Ireland, Google LLC), marques |
| Propriété et copyright | Titulaires exclusifs : Kévin GUELLEC et FPN Gestion ; interdictions ; licence d'usage ; sanctions L335-2 / L335-3 CPI |
| Conditions et charte | Accès par rôle, code personnel, usage professionnel, confidentialité des données adhérents, règles de relance, information des salariés (L1221-9, L1222-4 C. trav.), sanctions |
| Confidentialité (RGPD) | Responsable, données, finalités et bases légales, destinataires, transfert États-Unis (DPF), durées, sécurité, droits, CNIL |
| Stockage local | Aucun cookie publicitaire ni traceur : pas de bandeau requis |

Acceptation : à la première connexion sur la base partagée, chaque utilisateur coche les conditions et la politique de confidentialité. L'acceptation est gardée dans ses préférences (`cguVersion`, `cguAt`) et dans le journal d'audit (`cgu_acceptees`). Changer `LEGAL.version` dans `club/legal.js` redemande l'acceptation à tous.

## À compléter (club/legal.js, objet `LEGAL`)

Forme juridique et capital de FPN Gestion, RCS, SIRET, adresse du siège, téléphone : ils s'affichent « à compléter » tant qu'ils sont vides.

## Protections contre la copie

- Mentions de copyright dans chaque fichier, dans la page, dans la console ; fichier `club/LICENCE.md` (licence propriétaire).
- Code mis en ligne compressé et illisible (étape « Compresser le code » du déploiement).
- L'application refuse de fonctionner hors des adresses officielles (`LEGAL.domaines`) et affiche « Copie non autorisée ».
- `robots.txt` et balise `noindex` : le site n'est pas référencé.
- Les données restent protégées par les règles d'accès Firebase, même si le code est copié.

Limite : aucun moyen technique n'empêche totalement de copier le code d'une page web ; la protection repose sur le droit (preuve d'antériorité, mentions, poursuites) et sur la fermeture des données.

## Recommandations à faire hors de l'application

1. **Rendre le dépôt GitHub privé** (aujourd'hui public : le code source y est lisible). Attention : en privé, les minutes gratuites de GitHub Actions sont limitées (2 000 par mois) ; le passage du serveur toutes les 5 minutes les dépasserait. Passer alors le serveur à toutes les 30 minutes.
2. **Restreindre la clé Firebase** aux adresses du site (Google Cloud Console > API et services > Identifiants > clé du navigateur > Restrictions HTTP).
3. **Preuve d'antériorité** : dépôt du code et des écrans (enveloppe e-Soleau à l'INPI, ou dépôt chez un huissier ou à l'APP) au nom de Kévin GUELLEC et FPN Gestion.
4. **Contrat** entre Kévin GUELLEC et FPN Gestion précisant la copropriété des droits (ou la cession) et l'usage par le club.
5. **Information des salariés** : remettre la charte (onglet Conditions) aux commerciaux et, s'il existe, informer et consulter le CSE avant la mise en service (art. L2312-38 C. trav.).
6. **Registre RGPD** : `club/docs/rgpd/registre-traitement.md` et l'analyse de risques sont à jour ; les garder avec les documents du club.
