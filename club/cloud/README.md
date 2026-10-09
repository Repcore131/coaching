# Fit Pulse : fonctions planifiées (option Blaze)

Les traitements serveur de Fit Pulse tournent aujourd'hui dans GitHub Actions
(`.github/workflows/fitpulse-mail.yml`, toutes les 5 minutes, secrets GitHub).
Ce dossier en est la version Cloud Functions, pour un projet Firebase au forfait
Blaze : mêmes modules (`club/outils/*.mjs`, copiés dans `lib/`), secrets dans
Secret Manager, région `europe-west1`, fuseau `Europe/Paris`.

| Fonction | Planning | Module |
|---|---|---|
| `releveResiliations` | toutes les heures | `fitpulse-resmail.mjs` |

Mise en place :

    firebase functions:secrets:set GMAIL_CLIENT_ID
    firebase functions:secrets:set GMAIL_CLIENT_SECRET
    firebase functions:secrets:set GMAIL_TOKENS        # {"niort":"<refresh token du compte accueil>"}
    cd club/cloud && npm install && npm run copier && firebase deploy --only functions

Aucun jeton n'est jamais écrit dans la base ni dans le code de l'appli.
