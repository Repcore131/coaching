// ══════════════════════════════════════════════════════════════════════════
//  ENVOYER UN COURRIEL, SANS DEPENDANCE
// ══════════════════════════════════════════════════════════════════════════
//
//  POURQUOI IL EST ECRIT A LA MAIN. Ce script recoit le mot de passe de la
//  messagerie de Kevin. Le confier a une action GitHub trouvee sur une place
//  publique, ou a un paquet npm et aux siens, c'est le confier a tout ce que
//  ces paquets embarquent — et une mise a jour suffit pour que ca change.
//  SMTP sur TLS tient en quatre-vingts lignes : on les ecrit, et rien
//  d'exterieur ne voit le mot de passe.
//
//  ⚠ LE MOT DE PASSE N'EST PAS CELUI DU COMPTE GOOGLE. C'est un « mot de
//    passe d'application » : myaccount.google.com > Securite > Validation en
//    deux etapes > Mots de passe des applications. Il ne donne acces qu'a
//    l'envoi de courriel, et se revoque d'un clic sans toucher au compte.
//
//  Usage :
//      node scripts/envoyer_mail.mjs <fichier> "<objet>"
//  Variables attendues :
//      MAIL_UTILISATEUR    l'adresse qui envoie (guellec.coachingpro@gmail.com)
//      MAIL_MOT_DE_PASSE   le mot de passe d'application
//      MAIL_DESTINATAIRE   facultatif, l'expediteur par defaut
//      MAIL_HOTE / MAIL_PORT  facultatifs (smtp.gmail.com / 465)
// ══════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import tls from 'node:tls';

const [fichier, objetBrut] = process.argv.slice(2);
const HOTE = process.env.MAIL_HOTE || 'smtp.gmail.com';
const PORT = Number(process.env.MAIL_PORT || 465);
const UTIL = process.env.MAIL_UTILISATEUR || '';
const MDP = process.env.MAIL_MOT_DE_PASSE || '';
const DEST = process.env.MAIL_DESTINATAIRE || UTIL;
const OBJET = objetBrut || 'Rapport payeur RepCore';

if (!fichier) {
  console.error('  Usage : node scripts/envoyer_mail.mjs <fichier> "<objet>"');
  process.exit(2);
}
if (!UTIL || !MDP) {
  console.error('\n  MAIL_UTILISATEUR et MAIL_MOT_DE_PASSE sont requis. Rien n\'a ete envoye.');
  console.error('  (Mot de passe d\'application Google, pas le mot de passe du compte.)\n');
  process.exit(2);
}

const corps = readFileSync(fichier, 'utf8');
// ⚠ TOUT EN BASE64, corps ET objet. Un rapport porte des accents et des
//   adresses ; le quoted-printable les coupe en fin de ligne et un objet
//   accentue non encode arrive en charabia chez la moitie des clients.
const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const objetEncode = '=?UTF-8?B?' + b64(OBJET) + '?=';
const corpsEncode = b64(corps).replace(/(.{76})/g, '$1\r\n');

const message = [
  'From: RepCore <' + UTIL + '>',
  'To: ' + DEST,
  'Subject: ' + objetEncode,
  'Date: ' + new Date().toUTCString(),
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=UTF-8',
  'Content-Transfer-Encoding: base64',
  '',
  corpsEncode,
].join('\r\n');

// ── LE DIALOGUE SMTP ────────────────────────────────────────────────────
//
// Une etape, une reponse attendue. Si le serveur repond autre chose, on
// s'arrete LA et on le dit : continuer aveuglement finirait par un « envoye »
// menteur, et c'est le pire retour possible sur un rapport mensuel.
function dialogue() {
  return new Promise((resolve, reject) => {
    const s = tls.connect({ host: HOTE, port: PORT, servername: HOTE }, () => {});
    s.setEncoding('utf8');
    s.setTimeout(30000, () => { s.destroy(); reject(new Error('le serveur ne repond plus')); });

    // ⚠ LE POINT SEUL SUR SA LIGNE TERMINE LES DONNEES : une ligne du corps
    //   qui commencerait par un point couperait le message en deux. On la
    //   double, comme le protocole l'exige.
    const donnees = message.split('\r\n').map(l => (l.startsWith('.') ? '.' + l : l)).join('\r\n');
    const etapes = [
      { attendu: 220, envoi: null },
      { attendu: 250, envoi: 'EHLO repcore' },
      { attendu: 334, envoi: 'AUTH LOGIN' },
      { attendu: 334, envoi: Buffer.from(UTIL, 'utf8').toString('base64') },
      { attendu: 235, envoi: Buffer.from(MDP, 'utf8').toString('base64'), muet: true },
      { attendu: 250, envoi: 'MAIL FROM:<' + UTIL + '>' },
      { attendu: 250, envoi: 'RCPT TO:<' + DEST + '>' },
      { attendu: 354, envoi: 'DATA' },
      { attendu: 250, envoi: donnees + '\r\n.' },
      { attendu: 221, envoi: 'QUIT' },
    ];
    let i = 0;
    let tampon = '';
    s.on('data', d => {
      tampon += d;
      // Une reponse SMTP peut tenir sur plusieurs lignes : la derniere porte
      // un espace apres le code, les autres un tiret. On attend la derniere.
      const lignes = tampon.split('\r\n').filter(Boolean);
      const fin = lignes[lignes.length - 1] || '';
      if (!/^\d{3} /.test(fin)) return;
      tampon = '';
      const code = Number(fin.slice(0, 3));
      const e = etapes[i];
      if (code !== e.attendu) {
        s.destroy();
        return reject(new Error('etape ' + i + ' : le serveur a repondu « ' + fin.trim()
          + ' » au lieu de ' + e.attendu
          + (e.attendu === 235 ? ' (mot de passe d\'application refuse)' : '')));
      }
      i++;
      if (i >= etapes.length) { s.end(); return resolve(true); }
      const suivant = etapes[i];
      if (suivant.envoi !== null) s.write(suivant.envoi + '\r\n');
    });
    s.on('error', e => reject(new Error('connexion a ' + HOTE + ' : ' + e.message)));
  });
}

dialogue()
  .then(() => console.log('  Courriel envoye a ' + DEST + ' (' + corps.length + ' caracteres).'))
  .catch(e => { console.error('\n  ECHEC DE L\'ENVOI : ' + e.message + '\n'); process.exitCode = 1; });
