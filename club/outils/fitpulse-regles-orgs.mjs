/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
// ══ FIT PULSE — règles multi-salles (/orgs, /orgs_boot, /orgs_secret) ═══════
//
// Un compte (fp-{clé}@…) appartient à UNE société : /orgs_boot/{clé} = { org, uid }.
//  - lecture et écriture d'une société : ses membres seulement (aucun chemin
//    d'une autre société n'est lisible) ;
//  - objectifs, imports, fiches de l'équipe, réglages : managers et créateurs ;
//  - un membre n'écrit que ses propres saisies ;
//  - double authentification : si la société l'exige (info/securite/mfa), un
//    manager ou un créateur n'accède à rien sans un jeton dont mfaAt est égal à
//    auth_time (code TOTP vérifié par le serveur pour CETTE connexion) ;
//  - création d'une société : par le compte qui la crée, une seule fois ;
//  - invitation : lien à usage unique, 7 jours, rôle et e-mail imposés ;
//  - hors de /orgs/{org} (les droits de lecture descendent dans l'arbre) : invitations,
//    file d'e-mails, abonnements push, boîtes de réception, suivi produit.
// Assemblé dans le bloc Fit Pulse par fitpulse-serveur.mjs (avecRegle).

const DOM = '@fitpulse-niort.web.app';
const j = s => JSON.stringify(s);
const AUTHOK = `auth != null && auth.token.email.endsWith('${DOM}')`;
const KEY = `auth.token.email.replace('${DOM}', '').replace('fp-', '')`;
const BOOTV = `root.child('orgs_boot/' + ${KEY})`;
const UID = `${BOOTV}.child('uid').val()`;
const membre = org => `${AUTHOK} && ${BOOTV}.child('org').val() === ${org}`;
const role = org => `root.child('orgs/' + ${org} + '/data/users/' + ${UID} + '/role').val()`;
const actif = org => `root.child('orgs/' + ${org} + '/data/users/' + ${UID} + '/status').val() !== 'archived'`;
const mfaExigee = org => `root.child('orgs/' + ${org} + '/info/securite/mfa').val() === true`;
const MFA_OK = `(auth.token.mfaAt != null && auth.token.mfaAt === auth.token.auth_time)`;
// Accès à l'espace : membre actif ; manager et créateur avec la double authentification si exigée.
export const acces = org => `(${membre(org)} && ${actif(org)} && (${role(org)} === 'membre' || !(${mfaExigee(org)}) || ${MFA_OK}))`;
export const mgr = org => `(${acces(org)} && (${role(org)} === 'manager' || ${role(org)} === 'createur'))`;
export const crea = org => `(${acces(org)} && ${role(org)} === 'createur')`;
const O = '$org';
// Création d'une société : rien n'existe encore, et le compte qui écrit est celui qui crée.
const naissance = chemin => `!root.child('orgs/' + $org + '/info').exists() && ${AUTHOK} && newData${chemin}.child('info/createdBy').val() === auth.uid`;
// Invitation valide (lue dans les données existantes : un lien utilisé ou expiré est refusé).
const inv = (org, t) => `root.child('orgs_invites/' + ${org} + '/' + ${t})`;
const invOk = (org, t) => `${inv(org, t)}.exists() && !${inv(org, t)}.child('usedAt').exists() && ${inv(org, t)}.child('expiresAt').val() > now`;
const SAISIE = `${mgr(O)} || (${acces(O)} && (newData.exists() ? (newData.child('userId').val() === ${UID} || (newData.child('by').val() === ${UID} && (newData.child('kpiId').val() === 'sauvetage' || newData.child('kpiId').val() === 'impayes'))) : (data.child('userId').val() === ${UID} || data.child('by').val() === ${UID})))`;
const SOIMEME = `${acces(O)} && $uid === ${UID}`;
const FICHE = `${mgr(O)} && (${crea(O)} || (data.child('role').val() !== 'createur' && (!newData.exists() || newData.child('role').val() === 'membre' || newData.child('role').val() === data.child('role').val())))`;
// Fiche créée par l'invité lui-même, aux conditions de l'invitation.
const FICHE_INVITE = `!data.exists() && ${AUTHOK} && newData.child('invite').exists() && ${invOk(O, "newData.child('invite').val()")} && ${inv(O, "newData.child('invite').val()")}.child('uid').val() === $uid && newData.child('role').val() === ${inv(O, "newData.child('invite').val()")}.child('role').val() && newData.child('email').val() === ${inv(O, "newData.child('invite').val()")}.child('email').val()`;
const LIBRE = `${acces(O)}`;

export const REGLE_ORGS = `"orgs": {
      "$org": {
        ".read": ${j(acces(O))},
        "info": {
          ".read": ${j(membre(O))},
          ".write": ${j(naissance('.parent()'))},
          ".validate": "newData.hasChildren(['nom', 'createdBy', 'creeLe'])",
          "nom": { ".write": ${j(crea(O))}, ".validate": "newData.isString() && newData.val().length >= 2 && newData.val().length <= 80" },
          "couleur": { ".write": ${j(crea(O))}, ".validate": "newData.isString() && newData.val().matches(/^#[0-9a-fA-F]{6}$/)" },
          "statut": { ".validate": "data.exists() || newData.val() === 'essai'" },
          "securite": { "mfa": { ".validate": "data.exists() || newData.val() === true" } }
        },
        "clubs": {
          ".write": ${j(`${crea(O)} || ${naissance('.parent()')}`)},
          "$club": { ".write": ${j(`${mgr(O)} && data.exists()`)} }
        },
        "data": {
          ".write": ${j(`${crea(O)} || ${naissance('.parent()')}`)},
          "users": {
            "$uid": {
              ".write": ${j(`${FICHE} || ${FICHE_INVITE} || (!data.exists() && ${naissance('.parent().parent().parent()')})`)},
              "first": { ".write": ${j(SOIMEME)} }, "last": { ".write": ${j(SOIMEME)} }, "avatar": { ".write": ${j(SOIMEME)} },
              "salt": { ".write": ${j(SOIMEME)} }, "codeHash": { ".write": ${j(SOIMEME)} }, "bootKey": { ".write": ${j(SOIMEME)} },
              "role": { ".validate": "newData.val() === 'membre' || newData.val() === 'manager' || newData.val() === 'createur'" }
            }
          },
          "entries": { "$id": { ".write": ${j(SAISIE)}, ".validate": "newData.hasChildren(['userId', 'kpiId', 'date', 'value']) && newData.child('value').isNumber() && newData.child('value').val() > -1000000 && newData.child('value').val() < 1000000" } },
          "targets": { ".write": ${j(mgr(O))} },
          "imports": { ".write": ${j(mgr(O))} },
          "kpis": { ".write": ${j(crea(O))} },
          "prefs": { "$uid": { ".write": ${j(SOIMEME)} } },
          "usage": { "$uid": { ".write": ${j(SOIMEME)} } },
          "tasks": { "library": { ".write": ${j(mgr(O))} }, "plan": { ".write": ${j(mgr(O))} }, "done": { ".write": ${j(LIBRE)} } },
          "chat": { "$id": { ".write": ${j(`${acces(O)} && (${mgr(O)} || !data.exists() || data.child('userId').val() === ${UID} || newData.exists())`)} } },
          "clients": { ".write": ${j(LIBRE)} }, "loyalty": { ".write": ${j(LIBRE)} }, "transferts": { ".write": ${j(LIBRE)} }, "leagues": { ".write": ${j(LIBRE)} }, "leagueMember": { ".write": ${j(LIBRE)} }, "duels": { ".write": ${j(LIBRE)} }, "kudos": { ".write": ${j(LIBRE)} }, "comments": { ".write": ${j(LIBRE)} }, "resiliations": { ".write": ${j(LIBRE)} },
          "recov": { ".write": ${j(LIBRE)} }, "reactions": { ".write": ${j(LIBRE)} }, "celebrated": { ".write": ${j(LIBRE)} }, "relances": { ".write": ${j(LIBRE)} },
          "touches": { ".write": ${j(LIBRE)} }, "guests": { ".write": ${j(LIBRE)} }, "companies": { ".write": ${j(LIBRE)} },
          "prospects": { ".write": ${j(LIBRE)} }, "opps": { ".write": ${j(LIBRE)} }, "resRequests": { ".write": ${j(LIBRE)} },
          "audit": { "$id": { ".write": ${j(`${acces(O)} && !data.exists() && newData.exists()`)} } },
          "logs": { "$club": { "$day": { "$id": { ".write": ${j(`${acces(O)} && !data.exists() && newData.exists()`)} } } } },
          "coaching": { "$uid": { "actions": { ".write": ${j(LIBRE)} }, "$k": { ".write": ${j(mgr(O))} } } },
          "$autre": { ".write": ${j(mgr(O))} }
        }
      }
    },
    "orgs_invites": {
      "$org": {
        ".read": ${j(mgr(O))},
        "$t": {
          ".read": true,
          ".write": ${j(`${mgr(O)} && !data.exists()`)},
          ".validate": "$t.matches(/^[0-9a-f]{32}$/) && newData.hasChildren(['email', 'role', 'uid', 'expiresAt', 'orgNom']) && (newData.child('role').val() === 'membre' || newData.child('role').val() === 'manager') && newData.child('expiresAt').val() <= now + 7 * 86400000 + 60000",
          "usedAt": { ".write": ${j(`!data.exists() && newData.parent().parent().parent().parent().child('orgs_boot/' + ${KEY} + '/invite').val() === $t`)} },
          "usedBy": { ".write": ${j(`!data.exists() && newData.parent().parent().parent().parent().child('orgs_boot/' + ${KEY} + '/invite').val() === $t`)} }
        }
      }
    },
    "orgs_push": { "$org": { "$uid": { ".read": false, ".write": ${j(SOIMEME)} } } },
    "orgs_inbox": { "$org": { "$uid": { ".read": ${j(SOIMEME)}, "$id": { "readAt": { ".write": ${j(`${SOIMEME} && data.parent().exists()`)} } } } } },
    "orgs_mail": { "$org": { ".read": false, "$id": { ".write": ${j(`${mgr(O)} && !data.exists()`)} } } },
    "orgs_product": { "$org": { ".read": ${j(crea(O))}, ".write": ${j(crea(O))} } },
    // Données privées des dossiers de résiliation : manager, ou responsable du dossier.
    "orgs_private": { "$org": { "resiliations": { "$club": { "$id": {
      ".read": ${j(`${mgr(O)} || (${acces(O)} && root.child('orgs/' + $org + '/data/resiliations/' + $id).child('clubId').val() === $club && root.child('orgs/' + $org + '/data/resiliations/' + $id).child('ownerId').val() === ${UID})`)},
      ".write": ${j(`${mgr(O)} || (${acces(O)} && root.child('orgs/' + $org + '/data/resiliations/' + $id).child('clubId').val() === $club && (root.child('orgs/' + $org + '/data/resiliations/' + $id).child('ownerId').val() === ${UID} || !root.child('orgs/' + $org + '/data/resiliations/' + $id).child('ownerId').exists()) && newData.exists())`)},
      "email": { ".validate": "newData.isString() && newData.val().length <= 254" }, "phone": { ".validate": "newData.isString() && newData.val().length <= 30" },
      "excerpt": { ".validate": "newData.isString() && newData.val().length <= 300" }, "$autre": { ".validate": false } } } } } },
    "orgs_public": {
      "$org": {
        ".read": true,
        "legal": { ".write": ${j(mgr(O))}, "$c": { ".validate": "newData.isString() && newData.val().length <= 300" } },
        "$autre": { ".validate": false }
      }
    },
    "orgs_boot": {
      "$k": {
        ".read": true,
        ".write": ${j([
          // manager : clés des comptes de sa société (création, retrait)
          `${mgr("(newData.exists() ? newData.child('org').val() : data.child('org').val())")} && (!data.exists() || data.child('org').val() === ${BOOTV}.child('org').val())`,
          // le membre lui-même (changement de code), dans sa société
          `${AUTHOK} && newData.child('uid').val() === ${UID} && newData.child('org').val() === ${BOOTV}.child('org').val()`,
          // pointeur « code seul » vers une clé de la même société
          `${AUTHOK} && (newData.isString() ? root.child('orgs_boot/' + newData.val() + '/org').val() === ${BOOTV}.child('org').val() : !newData.exists() && data.isString())`,
          // création d'une société par ce compte
          `!data.exists() && auth != null && auth.token.email === 'fp-' + $k + '${DOM}' && !root.child('orgs/' + newData.child('org').val() + '/info').exists() && newData.parent().parent().child('orgs/' + newData.child('org').val() + '/info/createdBy').val() === auth.uid`,
          // acceptation d'une invitation (lien à usage unique, non expiré)
          `!data.exists() && auth != null && auth.token.email === 'fp-' + $k + '${DOM}' && newData.child('invite').exists() && ${invOk("newData.child('org').val()", "newData.child('invite').val()")} && newData.child('uid').val() === ${inv("newData.child('org').val()", "newData.child('invite').val()")}.child('uid').val()`,
        ].map(x => `(${x})`).join(' || '))},
        ".validate": "newData.isString() ? newData.val().matches(/^[0-9a-f]{40}$/) : newData.hasChildren(['org', 'uid']) && newData.child('org').isString() && newData.child('uid').isString()"
      }
    },
    "orgs_secret": { ".read": false, ".write": false }`;
