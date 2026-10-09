# RepCore sur Google Play — le canal Play (série 6, lot 15)

- **Ce qui distingue l'app Play** : elle s'ouvre sur `/app/index.html?src=play` (`launchUrl`),
  que `LauncherActivity` retire quand l'installation ne vient pas du Store. L'app le garde pour la
  session (`sessionStorage.rc_canal = 'play'`, `canalPlay()`).
- **Aucun achat dans le canal Play** : l'écran d'abonnement, la boutique et les liens de paiement des
  coachs affichent « Les abonnements et les achats ne se font pas dans l'application Android. »
- **L'AAB** : `apk.yml` lance `bundleRelease` après l'APK et garde `RepCore-<v>.aab` en artefact
  (90 jours), signé avec la même clé d'envoi ; la Play Console le re-signe (Play App Signing).
- **assetlinks.json porte deux empreintes** : celle de la clé actuelle (APK hors store, en premier) et
  celle de Play App Signing (en second). Poser la seconde dans `empreinte-play.txt` (une ligne,
  `AA:BB:…`, 32 octets) puis dans `well-known/assetlinks.json` ; `scripts/verif/assetlinks.mjs`
  (joué par la CI) refuse un fichier où elle manque, une empreinte mal formée, ou un ordre inversé.
- **La fiche** (textes, captures, icône) : `android/fiche-store/`.
- **Aucune clé, aucun mot de passe ici.** Les secrets de signature restent ceux de `apk.yml`.
