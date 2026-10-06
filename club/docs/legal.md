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

## Éditeur (vérifié au registre national des entreprises, le 6 octobre 2026)

FPN GESTION (FPNG), SASU au capital de 150 000 €, RCS Saint-Malo 934 823 055, TVA FR36934823055, siège Centre commercial Super U, 1 route de Saint-Cast, 22550 Matignon ; établissement de Niort : zone commerciale Mendès-France, 1 rue Jean-Baptiste Colbert, 79000 Niort, SIRET 934 823 055 00025 ; présidente HOLDING EROS (représentée par Mme Maria BORISOVA). Valeurs dans `club/legal.js`, objet `LEGAL`.

## Protections contre la copie

- Mentions de copyright dans chaque fichier, dans la page, dans la console ; fichier `club/LICENCE.md` (licence propriétaire).
- Code mis en ligne compressé et illisible (étape « Compresser le code » du déploiement).
- L'application refuse de fonctionner hors des adresses officielles (`LEGAL.domaines`) et affiche « Copie non autorisée ».
- `robots.txt` et balise `noindex` : le site n'est pas référencé.
- Les données restent protégées par les règles d'accès Firebase, même si le code est copié.

Limite : aucun moyen technique n'empêche totalement de copier le code d'une page web ; la protection repose sur le droit (preuve d'antériorité, mentions, poursuites) et sur la fermeture des données.

## Documents prêts (club/docs/legal/)

| Document | Usage |
|---|---|
| `convention-droits-fit-pulse.md` | Copropriété à parts égales Kévin GUELLEC / FPN GESTION, usage illimité par le club, accord des deux pour tout tiers. À imprimer et signer en deux exemplaires. |
| `information-salaries.md` | Note d'information à remettre et faire signer à chaque commercial ; paragraphe CSE si 11 salariés et plus. |
| `depot-anteriorite.md` | Dépôt e-Soleau à l'INPI (15 €). Le paquet se génère avec `node club/outils/paquet-anteriorite.mjs`. |

## Décisions

- **Dépôt GitHub laissé public** : il héberge aussi le site RepCore par GitHub Pages, qui s'arrêterait en privé sur l'offre gratuite. Le code mis en ligne est compressé, la licence est propriétaire et l'antériorité se prouve par l'e-Soleau.
- **Clé Firebase non restreinte** : elle est partagée avec RepCore (même projet) ; la restreindre au seul site Fit Pulse couperait RepCore. Les données restent protégées par les règles d'accès.
