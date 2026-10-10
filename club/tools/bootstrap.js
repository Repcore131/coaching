#!/usr/bin/env node
/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// ══ FIT PULSE — données de départ d'UN déploiement (hors fichier livré) ════
// Ce fichier n'est jamais chargé par le navigateur ni copié dans fitpulse.html :
// il décrit le déploiement historique (base /pulse) et sert au serveur
// (outils/fitpulse-serveur.mjs : clés de connexion des comptes, identité du
// client posée si elle manque) et à la ligne de commande ci-dessous.
//   node club/tools/bootstrap.js            affiche ce qui serait posé
//   node club/tools/bootstrap.js --ecrire   pose /pulse/tenant et /pulse_public/legal s'ils manquent
// Accès : FIREBASE_SERVICE_ACCOUNT (ou le simulateur si FIREBASE_DATABASE_EMULATOR_HOST est défini).
// Seule l'EMPREINTE des codes est ici (SHA-256 salé) : les codes ne sont écrits nulle part.
'use strict';

const BOOTSTRAP = {
  club: { id: 'niort', name: 'Fitness Park Niort', address: '600 Av. de Paris', city: '79000 Niort' },
  accounts: [
    { id: 'kg-createur', first: 'Kévin', last: 'GUELLEC', email: 'guellec.coachingpro@gmail.com', role: 'createur', salt: 'c1e2c0f885e88133', codeHash: '18c5a02277b8bab8d72fa5eb511ae202b15025f066067d09208c3c4210c7b358', bootKey: 'bcb94d3b291bacdcdff6c95889640de19eca876a', codeKey: '1c293626e1688b3928e389927280ac6f85fad62e' },
    { id: 'kg-manager', first: 'Kévin', last: 'GUELLEC', email: 'guellec.coachingpro@gmail.com', role: 'manager', salt: 'd8a29558ba1fbce4', codeHash: '223ecb32cf76b5fe1560af2119eaf86285531e09858aee8b5f59c862142e7440', bootKey: 'b6b8b10beaaa9ffe3dd08b5d97efe10de1c6fd04', codeKey: '5368636c980e2b8a61e205a08b155b36efca0a4e' },
  ],
  // S.tenant : identité du client, modifiable ensuite dans Club et réglages.
  tenant: {
    name: 'Fitness Park Niort', brand: 'Fitness Park', logo: 'assets/logo-fitness-park.svg',
    colors: { primary: '#12B3A8', onPrimary: '#0B0B0C' }, entity: 'FPN GESTION', panierMoyen: 32,
    legal: {
      auteur: 'Kévin GUELLEC', societe: 'FPN Gestion', sigle: 'FPNG', club: 'Fitness Park Niort',
      forme: 'SASU (société par actions simplifiée unipersonnelle)', capital: '150 000 €', rcs: '934 823 055 R.C.S. Saint-Malo', siret: '934 823 055 00025 (établissement de Niort)', tva: 'FR36934823055',
      adresse: 'Centre commercial Super U, 1 route de Saint-Cast, 22550 Matignon', president: 'HOLDING EROS (SAS), présidente',
      etablissement: 'Zone commerciale Mendès-France, 1 rue Jean-Baptiste Colbert, 79000 Niort', tel: '', email: 'kevinguellec.pro@gmail.com',
      site: 'https://fitpulse-niort.web.app', tribunal: 'Niort', marque: 'Fitness Park',
    },
  },
  // Destinataire du rapport du lundi (Plan du trimestre), posé s'il manque.
  plan: { club: 'niort', id: '2026-Q4', directeur: 'kevinguellec.pro@gmail.com' },
  // Adresses où l'appli de ce déploiement peut tourner (protection contre la copie).
  domaines: ['fitpulse-niort.web.app', 'fitpulse-niort.firebaseapp.com'],
};
module.exports = { BOOTSTRAP };

// ── Ligne de commande ─────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    const ecrire = process.argv.includes('--ecrire');
    const EMU = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
    const base = EMU ? `http://${EMU}` : (process.env.FIREBASE_DB_URL || 'https://repcore-sync-default-rtdb.firebaseio.com').replace(/\/$/, '');
    const ns = EMU ? `?ns=${process.env.FIREBASE_NS || 'fitpulse-test'}` : '';
    const poser = { 'pulse/tenant': (({ legal, ...t }) => t)(BOOTSTRAP.tenant), 'pulse_public/legal': BOOTSTRAP.tenant.legal, [`pulse/plans/${BOOTSTRAP.plan.club}/${BOOTSTRAP.plan.id}/directeur`]: BOOTSTRAP.plan.directeur };
    if (!ecrire) { console.log(JSON.stringify(poser, null, 2)); console.log('Essai : rien n’est écrit (ajoutez --ecrire).'); return; }
    let tk = 'owner';
    if (!EMU) {
      const crypto = require('crypto'); const c = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}'); if (!c.client_email) throw new Error('FIREBASE_SERVICE_ACCOUNT absent');
      const b = s => Buffer.from(s).toString('base64url'); const iat = Math.floor(Date.now() / 1000);
      const t = b(JSON.stringify({ alg: 'RS256', typ: 'JWT' })), p = b(JSON.stringify({ iss: c.client_email, scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 }));
      const sig = crypto.createSign('RSA-SHA256').update(`${t}.${p}`).sign(c.private_key, 'base64url');
      tk = (await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${t}.${p}.${sig}` })).json()).access_token;
    }
    for (const [chemin, v] of Object.entries(poser)) {
      const url = `${base}/${chemin}.json${ns}`; const h = { authorization: `Bearer ${tk}` };
      const cur = await (await fetch(url, { headers: h })).json();
      if (cur) { console.log(`${chemin} : déjà présent, inchangé`); continue; }
      const r = await fetch(url, { method: 'PUT', headers: { ...h, 'content-type': 'application/json' }, body: JSON.stringify(v) });
      console.log(`${chemin} : ${r.ok ? 'posé' : 'refusé ' + r.status}`);
    }
  })().catch(e => { console.error('ÉCHEC :', e.message); process.exit(1); });
}
