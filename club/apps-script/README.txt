Fit Pulse : script de relève des résiliations (Google Apps Script, compte Gmail de l'accueil).
Installation pas à pas : Fit Pulse, Réglages, Relève des résiliations, bouton « Guide d'installation ».
Fichiers : appsscript.json (manifeste, trois portées) et Code.gs (le script). Collez dans Code.gs la configuration copiée depuis Fit Pulse.
Lecture seule : le script ne pose aucun libellé, ne modifie, ne déplace et n'envoie aucun e-mail.
Seuls les champs extraits partent vers Fit Pulse, signés (HMAC-SHA256) avec le secret FP_SECRET.
Quotas d'un compte Google gratuit : 6 minutes par exécution, 20 000 appels UrlFetch par jour.
Une relève par heure, soit 24 par jour : une exécution dure quelques secondes et fait un seul appel UrlFetch.
Les e-mails encodés en ISO-8859-1 peuvent perdre leurs accents à la lecture.
Sans effet sur la détection : le texte est normalisé (minuscules, sans accents) avant les règles.
Aperçu sans envoi : fonction apercu ; mise en service : fonction installer (déclencheur horaire).
