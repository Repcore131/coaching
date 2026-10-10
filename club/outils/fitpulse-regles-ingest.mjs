// Règles partagées par /pulse et /orgs (fitpulse-serveur.mjs, fitpulse-regles-orgs.mjs).
const j = s => JSON.stringify(s);
// Arrivée des exports (S.ingestConfig[clubId]) : forme stricte, aucun secret possible
// (ni jeton ni mot de passe : seuls l'état, l'adresse d'import, le dossier Drive et la liste blanche).
const ETAT_CANAL = "newData.isString() && (newData.val() === 'actif' || newData.val() === 'en attente' || newData.val() === 'inactif')";
export const INGEST_CONFIG = (w) => `{ ".write": ${j(w)}, "$club": {
        "api": { "status": { ".validate": ${j(ETAT_CANAL)} }, "since": { ".validate": "newData.isNumber()" }, "$x": { ".validate": false } },
        "mail": { "address": { ".validate": "newData.isString() && newData.val().matches(/^[a-z0-9-]{2,60}@[a-z0-9.-]{3,80}$/)" }, "status": { ".validate": ${j(ETAT_CANAL)} }, "rotatedAt": { ".validate": "newData.isNumber()" }, "allow": { "$i": { ".validate": "newData.isString() && newData.val().length <= 120 && newData.val().matches(/^[^@ ]*@[^@ ]+$/)" } }, "$x": { ".validate": false } },
        "drive": { "folderId": { ".validate": "newData.isString() && newData.val().matches(/^[A-Za-z0-9_-]{10,100}$/)" }, "status": { ".validate": ${j(ETAT_CANAL)} }, "$x": { ".validate": false } },
        "manual": { ".validate": "newData.val() === true" },
        "$x": { ".validate": false } } }`;
