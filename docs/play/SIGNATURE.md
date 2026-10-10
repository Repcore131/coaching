# La clé de signature et Google Play (Play App Signing)

*Rédigé le 10/10/2026.*

> **MISE À JOUR DU 10/10/2026 (après-midi) : l'ancienne clé est introuvable.**
> Une **nouvelle clé** a été créée : `repcore-2026.jks`, alias `repcore`,
> empreinte SHA-256
> `90:F6:4B:9B:3A:ED:04:F0:4B:4F:E6:4B:9F:21:8A:BC:9D:FF:65:04:4F:8E:65:72:19:12:13:6F:37:A6:EC:70`.
> Le fichier et son mot de passe ont été remis à Kevin (« coffre »), et ne
> sont **jamais** dans le dépôt. Les deux empreintes, l'ancienne et la
> nouvelle, figurent dans `assetlinks.json`.
> - **Pour Google Play** : à la première version, laisser Google gérer la clé
>   de signature (choix par défaut). Ensuite, copier l'empreinte SHA-256 de la
>   **clé de signature d'application** affichée par Play Console et l'ajouter
>   dans `assetlinks.json` (option B ci-dessous). `RepCore-play-5.aab` est
>   signé avec la clé de 2026, qui devient la clé d'importation.
> - **Pour l'APK GitHub** : `RepCore-5.apk` est signé avec la clé de 2026.
>   Les utilisateurs de l'APK 4 doivent le **désinstaller** avant d'installer
>   la version 5 (clé différente).
> - **Pour que GitHub compile seul les prochaines versions** : poser les
>   quatre secrets `RC_*` avec le contenu du coffre.

## Ce qui existe aujourd'hui

- L'APK RepCore (releases GitHub `apk-<versionCode>`) est signé avec **une
  seule clé**. Le fichier `.keystore` vit chez Kevin et dans les secrets du
  dépôt (`RC_KEYSTORE_B64`, `RC_KEYSTORE_PASS`, `RC_KEY_ALIAS`, `RC_KEY_PASS`).
  Il n'est jamais dans le dépôt.
- Son empreinte SHA-256 est publiée dans `well-known/assetlinks.json`
  (servi à `https://repcore-sync.web.app/.well-known/assetlinks.json`) :
  `9E:55:AE:95:8A:99:DC:55:22:8B:8F:CD:8A:9C:FD:81:2E:90:25:02:51:ED:B3:57:55:A6:AF:2A:0C:6A:98:FA`
- C'est elle qui permet à la TWA de s'ouvrir **en plein écran, sans barre
  d'adresse**. Une app signée par une autre clé, absente d'`assetlinks.json`,
  s'ouvre avec la barre d'adresse de Chrome.

## Ce que fait Google Play

Avec Play App Signing, Google signe lui-même l'app installée sur les
téléphones avec la **clé de signature d'application**. Kevin envoie le bundle
(AAB) signé avec une **clé d'importation**, que Google vérifie puis retire.

Le workflow `.github/workflows/apk.yml` produit `RepCore-play-<v>.aab`, signé
avec la clé ci-dessus. Il le joint à la release GitHub et le garde aussi en
artefact pendant 90 jours. **Cette clé sert donc de clé d'importation.**

## Le choix à faire à la première version (Play Console)

Dans Play Console, ouvre RepCore, puis **Tester et publier → Configuration →
Intégrité de l'application → Signature d'application**.

### Option A (recommandée) : garder la clé actuelle comme clé de signature

Google signe alors avec **la même clé** que l'APK GitHub.

- `assetlinks.json` ne change pas, et la TWA reste en plein écran.
- Un utilisateur de l'APK GitHub peut passer à la version Play sans
  désinstaller : même paquet, même clé.

Étapes :
1. Choisis **« Utiliser une autre clé de signature d'application »**, puis
   **« Exporter et importer une clé depuis un keystore Java »**.
2. Télécharge l'outil **PEPK** (`pepk.jar`) et la **clé publique de
   chiffrement** que la page fournit (`encryption_public_key.pem`).
3. Dans un terminal, sur le poste qui a le `.keystore` :
   ```
   java -jar pepk.jar --keystore=CHEMIN/repcore.keystore --alias=ALIAS \
     --output=repcore-cle-chiffree.zip --include-cert --rsa-aes-encryption \
     --encryption-key-path=encryption_public_key.pem
   ```
   L'outil demande les deux mots de passe : ne les écris nulle part.
4. Importe `repcore-cle-chiffree.zip` sur la page, puis enregistre.
5. Pour la **clé d'importation**, garde la même. Le workflow signe déjà les
   bundles avec elle.

### Option B : laisser Google créer la clé de signature

C'est plus simple le jour même, mais il y a deux conséquences :
- Il faut **ajouter l'empreinte SHA-256 de la clé de Google** dans
  `well-known/assetlinks.json`, à côté de l'actuelle : le tableau
  `sha256_cert_fingerprints` en accepte plusieurs. Cette empreinte est
  affichée sur la page « Signature d'application ». Ensuite, il faut
  redéployer le site. **Sans cela, la version Play s'ouvre avec la barre
  d'adresse.**
- Les utilisateurs de l'APK GitHub doivent **désinstaller** avant d'installer
  la version Play : la clé est différente.

## Vérifier après la première version

1. Sur la page « Signature d'application », copie l'empreinte **SHA-256 du
   certificat de la clé de signature d'application**.
2. Option A : elle doit être identique à celle d'`assetlinks.json`.
   Option B : ajoute-la dans `assetlinks.json` et redéploie.
3. Installe la version de test depuis le lien du test fermé. L'app doit
   s'ouvrir sans barre d'adresse.

## Si la clé est perdue

- **Clé d'importation perdue** (option A ou B) : Google peut la remplacer.
  Fais une demande dans Play Console, page « Intégrité de l'application ».
- **Option A, et le keystore est perdu partout** (poste de Kevin et secrets
  GitHub) : Google garde la clé de signature et continue de signer l'app Play.
  En revanche, plus aucun APK GitHub ne pourra être signé avec elle. **Garde
  une copie du `.keystore` et de ses mots de passe hors de l'ordinateur**, par
  exemple dans un gestionnaire de mots de passe.
