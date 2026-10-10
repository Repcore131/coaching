# Publier RepCore sur Google Play : la check-list

*Préparée le 10/10/2026.* Dans l'ordre. ☐ à cocher au fur et à mesure.

Fichiers prêts dans `docs/play/` :
- `FICHE.md` : titre, descriptions, catégorie ;
- `captures/` : 8 captures 1080 × 1920 ;
- `icone-512.png` ;
- `banniere-1024x500.png` ;
- `SIGNATURE.md` : la clé (Play App Signing) ;
- `verif/abonnement-version-play.png`.

---

## A. Le compte développeur (Kevin)

☐ **1.** Ouvre **https://play.google.com/console** avec le compte Google qui
   publiera (idéalement guellec.coachingpro@gmail.com).

☐ **2.** Type de compte :
   - **« Particulier »** si tu publies en ton nom, y compris en
     auto-entreprise sans société.
   - **« Organisation »** seulement si tu as une société (SAS, SARL…). Il
     faut alors un numéro D-U-N-S.

☐ **3.** Paie les frais d'inscription (25 $, une fois).

☐ **4.** Vérifie ton identité : pièce d'identité, adresse (justificatif) et
   téléphone. Compte quelques jours de délai.

☐ **5.** **Compte personnel créé récemment** : Google impose un **test fermé
   avec au moins 12 testeurs inscrits pendant 14 jours d'affilée** avant
   d'autoriser la production (voir E).

## B. Créer l'application (Kevin)

☐ **6.** Clique « Créer une application ».
   - **Nom** : RepCore.
   - **Langue par défaut** : Français (France).
   - **Application** (et non « Jeu »).
   - **Gratuite**. ⚠ Une app gratuite ne peut plus devenir payante, mais elle
     peut proposer des achats plus tard (option 2).
   - Coche les déclarations (règles du programme, lois sur l'exportation).

## C. Le contenu de l'application (Kevin, réponses ci-dessous)

Dans Play Console : **Règles et programmes → Contenu de l'application**.

☐ **7. Politique de confidentialité** : `https://repcore-sync.web.app/privacy.html`

☐ **8. Accès à l'application.** L'app demande un compte, donc Google a besoin
   d'identifiants de test.
   - Crée un compte dans l'app, par exemple `revue.play@…` (une adresse à
     toi).
   - Mets-le en **accès complet** : essai, ou accès que tu poses comme créateur.
   - Donne l'e-mail et le mot de passe dans « Toutes les fonctionnalités ou
     certaines d'entre elles sont limitées ».
   - Instruction pour le relecteur : « Se connecter avec ces identifiants ;
     l'accès complet est ouvert ».

☐ **9. Annonces** : **Non**, l'app ne contient pas d'annonces.

☐ **10. Classification du contenu** (questionnaire IARC). Adresse :
   guellec.coachingpro@gmail.com. Catégorie : **« Toutes les autres
   applications »** (pas jeu, pas réseau social).
   - Violence, sexualité, langage grossier, jeux d'argent : **Non**.
   - **Drogues, alcool, tabac** : **Non**. L'app permet de noter en privé des
     compléments et des produits, sans aucune promotion. Si Google pose une
     question précise sur la « référence » à des substances, réponds
     franchement et envoie-moi la question.
   - **Les utilisateurs peuvent-ils interagir ou échanger du contenu ?**
     **Oui** : messagerie coach-athlète, défis entre amis.
   - **Partage de la position** : Non.
   - **Achats numériques** : Non, aucun dans la version Play (option 1).

☐ **11. Public cible et contenu** : **18 ans et plus** uniquement. « Attrait
   pour les enfants » : **Non**.
   *L'app admet 16 ans révolus (politique de confidentialité, point 4 bis) ;
   cibler 18+ sur Play est plus restrictif, donc compatible.*

☐ **12. Sécurité des données** : voir la section F, réponse par réponse.

☐ **13. Applications de santé et Health Connect.** RepCore lit Health
   Connect. Google demande une **déclaration par type de donnée** (formulaire
   « Autorisations Health Connect »). Justifications à copier :
   - **Pas, sommeil, fréquence cardiaque au repos, variabilité de la fréquence
     cardiaque** : « Afficher à l'utilisateur sa récupération (pas, sommeil,
     fréquence cardiaque au repos, variabilité) à côté de ses séances de
     musculation, et l'aider à doser sa charge d'entraînement. Lecture seule. »
   - **Poids, masse grasse** : « Suivre l'évolution de la composition
     corporelle de l'utilisateur dans son tableau de progression. Lecture
     seule. »
   - **Lecture en arrière-plan** (`READ_HEALTH_DATA_IN_BACKGROUND`) : « Faire
     arriver la nuit et les pas de la veille sans que l'utilisateur ouvre
     l'app, toutes les 6 heures ; l'utilisateur peut couper la synchronisation
     à tout moment. »
   - **Lien de justification** : la politique de confidentialité, que l'app
     ouvre déjà depuis l'écran des autorisations.
   - Catégorie de l'app santé : **Remise en forme / suivi d'activité**.
     **Pas un dispositif médical.**

☐ **14. Applications gouvernementales, financières, actualités** : Non.

☐ **15. Suppression des données** :
   - URL : `https://repcore-sync.web.app/privacy.html#suppression`
   - Suppression **dans l'app** : **Oui** (« Supprimer mon compte »).
   - Suppression d'une partie des données sans supprimer le compte : **Oui**
     (retrait du consentement santé, suppression d'une photo).

## D. La version à envoyer (Claude, puis Kevin)

☐ **16.** (Claude, fait) Le workflow GitHub **APK Android** compile, à chaque
   changement d'`android/` sur main :
   - `RepCore-<v>.apk` pour GitHub ;
   - **`RepCore-play-<v>.aab`** pour Play : versionCode 5, canal `play`, signé.

   Ces fichiers sont dans la release GitHub `apk-5` et en artefact du travail.

☐ **17.** (Kevin) Télécharge `RepCore-play-5.aab` depuis
   **https://github.com/Repcore131/coaching/releases/tag/apk-5**.

☐ **18.** (Kevin) **Signature d'application** : suis `docs/play/SIGNATURE.md`.
   **Option A recommandée** (garder la clé actuelle, outil PEPK) : elle se
   choisit **avant** le premier envoi, et ne se change plus ensuite.

## E. Test fermé : 12 testeurs, 14 jours (Kevin)

☐ **19.** **Tester et publier → Tests → Test fermé → Créer un canal** (nom :
   « Testeurs RepCore »).

☐ **20.** Testeurs : crée une **liste d'adresses e-mail**, celles des
   comptes Google des testeurs, ou un **groupe Google**. Il en faut **au moins
   12**. Vise 15 à 20, car certains décrochent.

☐ **21.** Crée une version : importe `RepCore-play-5.aab`, ajoute la note de
   version « Première version de test », envoie en examen.

☐ **22.** Une fois la version validée, copie le **lien d'inscription**
   (« Rejoindre sur le Web ») et envoie-le avec le message de la section G.

☐ **23.** Les 12 testeurs doivent **rester inscrits 14 jours d'affilée**.
   Garder l'app installée et l'ouvrir de temps en temps compte aussi pour
   Google.

☐ **24.** Au bout de 14 jours : **Tableau de bord → Demander l'accès à la
   production**. Google pose quelques questions sur le test ; réponds avec ce
   que les testeurs t'ont dit.

☐ **25.** Après l'installation de la version de test :
   - vérifie que l'app s'ouvre **sans barre d'adresse** (sinon :
     `SIGNATURE.md`, option B) ;
   - vérifie que l'écran d'abonnement affiche le message Play, sans bouton.

## F. Sécurité des données : les réponses

**Collecte et sécurité**
- L'application collecte ou partage-t-elle des données ? **Oui**.
- Les données sont-elles **chiffrées en transit** ? **Oui** (HTTPS partout).
- Les utilisateurs peuvent-ils **demander la suppression** ? **Oui** (dans l'app
  et via `privacy.html#suppression`).
- **Partage avec des tiers** : **Non**. Les hébergeurs (Google Firebase,
  Cloudflare, Cloudinary) sont des **prestataires de services**, ce qui ne
  compte pas comme un partage selon Google. Ce que l'utilisateur choisit de
  montrer à **son coach** est un transfert qu'il déclenche lui-même : ce n'est
  pas un partage au sens de Google non plus.

| Catégorie Google | Type | Collecté | Obligatoire ? | Finalités |
|---|---|---|---|---|
| Informations personnelles | Nom | Oui | Obligatoire | Fonctionnalités de l'app, gestion du compte |
| Informations personnelles | Adresse e-mail | Oui | Obligatoire | Gestion du compte, communications |
| Informations personnelles | ID utilisateur | Oui | Obligatoire | Gestion du compte |
| Informations personnelles | Autres infos (date de naissance, genre) | Oui | Facultatif | Fonctionnalités de l'app (repères, cycle) |
| Santé et remise en forme | Informations de santé (cycle, poids, mensurations, douleurs, traitements) | Oui | **Facultatif** (consentement explicite) | Fonctionnalités de l'app |
| Santé et remise en forme | Informations sur l'activité physique (séances, pas, sommeil, fréquence cardiaque) | Oui | Facultatif | Fonctionnalités de l'app |
| Photos et vidéos | Photos (bilans, progression) | Oui | Facultatif | Fonctionnalités de l'app |
| Photos et vidéos | Vidéos (analyse d'exécution) | Oui | Facultatif | Fonctionnalités de l'app |
| Fichiers audio | Enregistrements vocaux (réponses audio aux bilans) | Oui | Facultatif | Fonctionnalités de l'app |
| Messages | Autres messages dans l'application (coach-athlète) | Oui | Facultatif | Fonctionnalités de l'app |
| Activité dans l'application | Interactions avec l'application (résumé d'activité, présence) | Oui | Obligatoire | Statistiques (agrégées), fonctionnalités de l'app |
| Informations financières | Historique des achats (abonnement souscrit sur le web) | Oui | Facultatif | Fonctionnalités de l'app (accès ouvert) |

**Non collectés** : position, contacts, agenda, SMS, fichiers et documents
(l'export JSON est un fichier que l'utilisateur crée lui-même), navigation
web, identifiants publicitaires.

**Traitement éphémère** : non. **Données collectées sans être stockées** : non.

## G. Le message pour recruter 12 testeurs

À publier en story et en message privé à tes abonnés les plus actifs.
Remplace `[LIEN]` par le lien d'inscription au test (étape 22).

> 🔥 **J'ai besoin de toi pour sortir RepCore sur le Play Store**
>
> Pour publier une nouvelle app, Google demande **12 testeurs sur Android
> pendant 14 jours**. Je cherche 15 personnes motivées 🙏
>
> Ce que tu fais :
> 1️⃣ Tu m'envoies en privé **l'adresse Gmail de ton téléphone Android**
>    (c'est elle que Google reconnaît).
> 2️⃣ Je t'ajoute, puis tu cliques sur ce lien : [LIEN] → « Devenir testeur »
>    → « Télécharger sur Google Play ».
> 3️⃣ Tu **gardes l'app installée 14 jours** et tu t'en sers quand tu
>    t'entraînes. Un retour honnête, même court, m'aide énormément.
>
> Ce que tu y gagnes : tu testes avant tout le monde, et tes remarques
> façonnent l'app.
>
> ⚠️ Android uniquement (pas iPhone). Réponds « TEST » en privé 👇

Ce message ne promet ni résultat ni contrepartie financière. Si tu offres une
contrepartie (mois d'accès, etc.), dis-le clairement dans le message. Vérifie
aussi qu'elle respecte les règles de Google sur les avis : un avis ne s'achète
pas.
