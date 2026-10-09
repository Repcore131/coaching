# Fit Pulse : fonctions planifiées (option Blaze)

Les traitements serveur de Fit Pulse tournent aujourd'hui dans GitHub Actions
(`.github/workflows/fitpulse-mail.yml`, toutes les 5 minutes, secrets GitHub).
Ce dossier en est la version Cloud Functions, pour un projet Firebase au forfait
Blaze : mêmes modules (`club/outils/*.mjs`, copiés dans `lib/`), secrets dans
Secret Manager, région `europe-west1`, fuseau `Europe/Paris`.

| Fonction | Planning | Module |
|---|---|---|
| `releveResiliations` | toutes les heures | `fitpulse-resmail.mjs` |
| `importsAutomatiques` | chaque heure de 6 h à 22 h | `fitpulse-autoimport.mjs` (code de l'appli copié dans `lib/app`) |
| `ingestResiliations` | HTTP, appelée par le script Apps Script de la boîte accueil | `src/ingestResiliations.ts` |
| `setMailSecret` | appelable, manager du club | `src/setMailSecret.ts` |
| `graphPoll` | toutes les heures (clubs `mailProvider: m365`) | `src/graphPoll.ts`, voir `../docs/m365.md` |

Mise en place :

    firebase functions:secrets:set GMAIL_CLIENT_ID
    firebase functions:secrets:set GMAIL_CLIENT_SECRET
    firebase functions:secrets:set GMAIL_TOKENS        # {"niort":"<refresh token du compte accueil>"}
    cd club/cloud && npm install && npm run copier && firebase deploy --only functions

Relève signée (`ingestResiliations`) : chaque requête porte `X-FP-Club`,
`X-FP-Time` et `X-FP-Signature` (HMAC SHA-256 du corps), vérifiés avec le secret
`FP_MAIL_SECRET_<CLUB>` lu dans Secret Manager ; écart d'horloge toléré 10 min,
corps limité à 1 Mo, réponse `{created, updated, ignored}`. Le secret est créé
depuis Réglages > Relève des résiliations > Générer le secret (fonction
`setMailSecret`) : le compte de service des fonctions doit avoir les rôles
Secret Manager Admin (création) et Secret Accessor (lecture).

Sources TypeScript dans `src/`, compilées dans `lib/ts` (`npm run build`).
Tests : `npm test` (Vitest, émulateur Realtime Database requis :
`npm run test:emul`).

Aucun jeton n'est jamais écrit dans la base ni dans le code de l'appli.
