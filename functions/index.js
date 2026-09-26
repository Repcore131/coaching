// Cloud Functions RepCore
//   - RCACCESS : signature/vérification serveur des codes d'accès élève (HMAC)
//   - PayPal   : vérification côté serveur de l'abonnement avant activation
//
// Déploiement : voir functions/README.md.

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.database();

// Région Europe par défaut pour toutes les fonctions de ce fichier (latence + résidence des données).
setGlobalOptions({ region: "europe-west1" });

const TOKEN_SECRET = defineSecret("RCACCESS_TOKEN_SECRET");
const PAYPAL_CLIENT_SECRET = defineSecret("PAYPAL_CLIENT_SECRET");
const CLOUDINARY_API_SECRET = defineSecret("CLOUDINARY_API_SECRET");
const CLOUDINARY_API_KEY = defineSecret("CLOUDINARY_API_KEY");
const OCR_SPACE_API_KEY = defineSecret("OCR_SPACE_API_KEY");
// L'identifiant du webhook PayPal, cree dans le tableau de bord PayPal et pose
// en secret : `firebase functions:secrets:set PAYPAL_WEBHOOK_ID`. Sans lui, la
// verification de signature est impossible et le webhook REFUSE tout — il ne
// fait jamais confiance a un appel qu'il ne peut pas verifier.
const PAYPAL_WEBHOOK_ID = defineSecret("PAYPAL_WEBHOOK_ID");

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// ══ LES DROITS, ECRITS ICI ET NULLE PART AILLEURS ════════════════════════
// database.rules.json pose ".write": false sur droits/ pour tout le monde.
// L'Admin SDK ne passe pas par les regles : ces fonctions sont donc le SEUL
// chemin d'ecriture, et c'est tout l'objet du lot.
//
// Quatre paliers, du plus ferme au plus ouvert :
//   'aucun'        rien n'a ete ouvert (ou tout est expire)
//   'essentielle'  l'abonnement de base
//   'ultime'       l'abonnement complet, ou un programme achete, ou l'essai
//   'suivi'        un coach s'occupe de la personne
const PALIERS = ["aucun", "essentielle", "ultime", "suivi"];
function palierValide(p) { return PALIERS.indexOf(String(p)) > 0 ? String(p) : "aucun"; }

// ECRIT droits/<cle>. `champs` porte palier, echeance, source, et ce que
// l'appelant veut y ajouter. `maj` est toujours pose par le serveur : c'est la
// seule date a laquelle le client peut se fier.
async function ecrireDroits(cle, champs) {
  if (!cle) throw new HttpsError("invalid-argument", "Clef de dossier manquante.");
  const patch = Object.assign({}, champs || {}, { maj: Date.now() });
  if (patch.palier !== undefined) patch.palier = palierValide(patch.palier);
  if (patch.echeance !== undefined) patch.echeance = Number(patch.echeance) || 0;
  await db.ref("droits/" + cle).update(patch);
  return patch;
}
// LIT droits/<cle>, ou null.
async function lireDroits(cle) {
  const s = await db.ref("droits/" + cle).get();
  return s.exists() ? s.val() : null;
}
// ⚠ UNE ECHEANCE NE RECULE JAMAIS SANS RAISON. Un renouvellement, un code de
// coach ou une revision PROLONGENT ; ils ne raccourcissent pas un droit deja
// paye. L'annulation, elle, passe par ecrireDroits directement.
function prolonger(echeanceActuelle, ms) {
  const base = Math.max(Number(echeanceActuelle) || 0, Date.now());
  return base + (Number(ms) || 0);
}
const CREATOR_EMAIL = "guellec.coachingpro@gmail.com";

// ── Constantes PayPal (valeurs publiques — déjà présentes dans index.html) ───
const PAYPAL_CLIENT_ID = "AS9pdM1fxqdyzKzvuiQB3mTPAIHZW12rW_KWAOKB8XkalJXV8kEyWWBzwHPUxCBZtMMzqjJNnAjfa1f1";
const PAYPAL_PLAN_ID   = "P-95N51603RD882780YNJKS2QA";
const PAYPAL_API       = "https://api.paypal.com";

// ── Helpers PayPal ────────────────────────────────────────────────────────────
async function getPaypalToken(clientSecret) {
  const creds = Buffer.from(`${PAYPAL_CLIENT_ID}:${clientSecret}`).toString("base64");
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: { "Authorization": `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new HttpsError("internal", `PayPal OAuth2 échoué (${res.status}).`);
  const j = await res.json();
  if (!j.access_token) throw new HttpsError("internal", "Token PayPal absent de la réponse.");
  return j.access_token;
}

async function fetchSubscription(subscriptionId, accessToken) {
  if (!/^I-[A-Z0-9]{16,}$/.test(subscriptionId)) {
    throw new HttpsError("invalid-argument", "Format d'identifiant d'abonnement invalide.");
  }
  const res = await fetch(`${PAYPAL_API}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { "Authorization": `Bearer ${accessToken}` },
  });
  if (res.status === 404) throw new HttpsError("not-found", "Abonnement PayPal introuvable.");
  if (!res.ok) throw new HttpsError("internal", `Erreur PayPal (${res.status}).`);
  return res.json();
}

function sign(payloadStr, secret) {
  return crypto.createHmac("sha256", secret).update(payloadStr).digest("hex");
}

function emailKey(email) {
  return String(email || "").toLowerCase().replace(/\./g, ",");
}

function buildToken(payload, secret) {
  const payloadStr = JSON.stringify(payload);
  const sig = sign(payloadStr, secret);
  const b64 = Buffer.from(payloadStr, "utf8").toString("base64");
  return "RCACCESS:" + b64 + "." + sig;
}

async function requireCoach(request) {
  if (!request.auth || !request.auth.token || !request.auth.token.email) {
    throw new HttpsError("unauthenticated", "Connecte-toi pour effectuer cette action.");
  }
  const email = request.auth.token.email.toLowerCase();
  const snap = await db.ref("users/" + emailKey(email)).get();
  const coach = snap.val();
  if (!coach || coach.role !== "coach") {
    throw new HttpsError("permission-denied", "Cette action est réservée à un compte coach.");
  }
  return { coach, email };
}

// ── generateAccessToken ──────────────────────────────────────────────────
// Appelée par un coach connecté pour créer un nouveau code d'accès élève.
// coachId/coachName/coachCode viennent TOUJOURS du profil coach authentifié côté serveur,
// jamais de ce que le client prétend — impossible de générer un code au nom d'un autre coach.
exports.generateAccessToken = onCall({ secrets: [TOKEN_SECRET] }, async (request) => {
  const { coach } = await requireCoach(request);

  const studentName = String(request.data && request.data.studentName || "").trim().slice(0, 100);
  if (!studentName) throw new HttpsError("invalid-argument", "Nom de l'élève requis.");
  const months = Math.min(Math.max(parseInt(request.data && request.data.months) || 3, 1), 24);
  const freeCode = !!(request.data && request.data.freeCode) &&
    request.auth.token.email.toLowerCase() === CREATOR_EMAIL;

  const expiry = Date.now() + months * MONTH_MS;
  const codeId = "sc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

  const payload = {
    coachId: coach.id,
    coachName: (coach.fname || "") + " " + (coach.lname || ""),
    coachCode: coach.code || null,
    studentName,
    expiry,
    months,
    codeId,
  };
  if (freeCode) payload.creatorFree = true;
  return { token: buildToken(payload, TOKEN_SECRET.value()), payload };
});

// ── extendAccessToken ────────────────────────────────────────────────────
// Prolonge un code existant (ex. bouton "+3 mois"). Si l'élève est déjà inscrit (athleteEmail
// connu), applique aussi la nouvelle expiration directement sur son compte, immédiatement —
// corrige le bug où "+3 mois" ne changeait jamais rien pour un élève déjà lié.
exports.extendAccessToken = onCall({ secrets: [TOKEN_SECRET] }, async (request) => {
  const { coach, email } = await requireCoach(request);
  const codeId = String(request.data && request.data.codeId || "");
  const codes = Array.isArray(coach.studentCodes) ? coach.studentCodes : [];
  const idx = codes.findIndex((c) => c.codeId === codeId);
  if (idx === -1) throw new HttpsError("not-found", "Code introuvable.");

  const c = codes[idx];
  const addMonths = Math.min(Math.max(parseInt(request.data && request.data.months) || 3, 1), 24);
  const base = Math.max(c.expiry || 0, Date.now());
  const expiry = base + addMonths * MONTH_MS;
  const months = (c.months || 0) + addMonths;

  const payload = {
    coachId: coach.id,
    coachName: (coach.fname || "") + " " + (coach.lname || ""),
    coachCode: coach.code || null,
    studentName: c.studentName,
    expiry,
    months,
    codeId,
  };
  const token = buildToken(payload, TOKEN_SECRET.value());
  codes[idx] = Object.assign({}, c, { expiry, months, token });

  const updates = {};
  updates["users/" + emailKey(email) + "/studentCodes"] = codes;
  let appliedImmediately = false;
  if (c.athleteEmail) {
    const athSnap = await db.ref("users/" + emailKey(c.athleteEmail)).get();
    if (athSnap.exists()) {
      updates["users/" + emailKey(c.athleteEmail) + "/accessExpiry"] = expiry;
      appliedImmediately = true;
    }
  }
  await db.ref().update(updates);
  return { token, payload, appliedImmediately };
});

// ── verifyAccessToken ────────────────────────────────────────────────────
// Appelée côté élève au moment de saisir un code. Recalcule la signature HMAC et la compare en
// temps constant — un token modifié ou fabriqué à la main est rejeté ici, jamais accepté sur la
// seule foi du contenu décodé côté client. Vérifie aussi expiration + code désactivé + usage
// unique (un même codeId ne peut être redeemed que par un seul élève).
exports.verifyAccessToken = onCall({ secrets: [TOKEN_SECRET] }, async (request) => {
  const raw = String(request.data && request.data.token || "");
  if (!raw.startsWith("RCACCESS:")) {
    throw new HttpsError("invalid-argument", "Format de code invalide.");
  }
  const body = raw.slice("RCACCESS:".length);
  const dot = body.lastIndexOf(".");
  if (dot === -1) throw new HttpsError("invalid-argument", "Code invalide ou corrompu.");
  const b64 = body.slice(0, dot);
  const sig = body.slice(dot + 1);

  let payload;
  try {
    payload = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch (e) {
    throw new HttpsError("invalid-argument", "Code invalide ou corrompu.");
  }

  const expected = sign(JSON.stringify(payload), TOKEN_SECRET.value());
  const given = Buffer.from(sig || "", "hex");
  const wanted = Buffer.from(expected, "hex");
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) {
    throw new HttpsError("permission-denied", "Ce code n'a pas été émis par le serveur (signature invalide).");
  }
  if (!payload.coachId || !payload.expiry) {
    throw new HttpsError("invalid-argument", "Code invalide.");
  }
  if (Date.now() > payload.expiry) {
    throw new HttpsError("failed-precondition", "Ce code a expiré. Demande un nouveau code à ton coach.");
  }

  // Vérifie l'état réel du code chez le coach (actif / déjà consommé par quelqu'un d'autre).
  const coachSnap = await db.ref("users")
    .orderByChild("id")
    .equalTo(payload.coachId)
    .get();
  let coachEmailKey = null;
  let coach = null;
  coachSnap.forEach((child) => { coach = child.val(); coachEmailKey = child.key; });

  const callerEmail = request.auth && request.auth.token && request.auth.token.email
    ? request.auth.token.email.toLowerCase() : null;

  if (coach && Array.isArray(coach.studentCodes)) {
    const idx = coach.studentCodes.findIndex((c) => c.codeId === payload.codeId);
    if (idx !== -1) {
      const sc = coach.studentCodes[idx];
      if (sc.active === false) {
        throw new HttpsError("permission-denied", "Ce code a été désactivé par ton coach.");
      }
      if (sc.redeemed && sc.athleteEmail && callerEmail && sc.athleteEmail !== callerEmail) {
        throw new HttpsError("permission-denied", "Ce code a déjà été utilisé par un autre compte.");
      }
      if (!sc.redeemed && callerEmail) {
        const athleteName = String(request.data && request.data.athleteName || sc.usedBy || "").slice(0, 100);
        coach.studentCodes[idx] = Object.assign({}, sc, {
          redeemed: true,
          athleteEmail: callerEmail,
          usedBy: athleteName || sc.usedBy,
        });
        await db.ref("users/" + coachEmailKey + "/studentCodes").set(coach.studentCodes);
      }
    }
  }

  // ══ ET C'EST ICI QUE LE DROIT EST POSE, PAS SUR LE TELEPHONE ══════════
  // Jusqu'a ce lot, l'application ecrivait elle-meme status:'COACHING_SUIVI'
  // et accessExpiry dans le dossier de l'athlete — deux champs que son
  // titulaire peut reecrire depuis la console de son navigateur. Le code
  // etait verifie par le serveur, mais le DROIT qui en decoulait ne l'etait
  // pas : il suffisait de se le donner.
  //
  // Le client continue d'ecrire ces champs pour l'affichage et pour la fiche
  // du coach ; ils ne decident plus de rien.
  let droits = null;
  if (callerEmail) {
    const mois = Math.max(1, Math.min(24, Number(payload.mois) || 1));
    const cle = emailKey(callerEmail);
    const actuel = await lireDroits(cle);
    droits = await ecrireDroits(cle, {
      palier: "suivi",
      echeance: prolonger(actuel && actuel.echeance, mois * MONTH_MS),
      source: "code_coach",
      coachId: String(payload.coachId || "").slice(0, 64),
    });
  }
  return { valid: true, payload, droits };
});

// ── anonymizeCoach ───────────────────────────────────────────────────────────
// Appelée en self-service par un coach voulant supprimer son compte, ou par le
// créateur (CREATOR_EMAIL) pour offboarder un coach tiers via targetEmail.
//
// ── Choix RGPD — suppression dure avec archivage financier minimal ──────────
// Art. 17 RGPD (droit à l'effacement) :
//   • Données personnelles (fname, lname, phone, photo, programmes, codes…) :
//     SUPPRIMÉES — la clé users/{emailKey} est effacée intégralement.
//   • Compte Firebase Auth : SUPPRIMÉ via Admin SDK.
//   • Données financières (paypalSubscriptionId, paymentStatus, status) :
//     ARCHIVÉES 5 ans sans PII sous /deleted_accounts/{anonId}, obligation
//     légale de conservation des preuves contractuelles (art. L. 110-4 C. com.).
//   • Alternative "stub" rejetée : conserver l'email en clair sous users/
//     aurait maintenu une PII en base, contraire à l'esprit de l'Art. 17.
//   • Les coachId orphelins chez les athlètes sont tolérés : le code client
//     gère déjà find()===undefined sans planter ; offboardCoach() garantit
//     l'absence d'athlètes restants avant d'appeler cette fonction.
exports.anonymizeCoach = onCall(async (request) => {
  if (!request.auth || !request.auth.token || !request.auth.token.email) {
    throw new HttpsError("unauthenticated", "Connexion requise.");
  }
  const callerEmail = request.auth.token.email.toLowerCase();
  const CREATOR = "guellec.coachingpro@gmail.com";
  const isCreator = callerEmail === CREATOR;

  const rawTarget = request.data && request.data.targetEmail
    ? String(request.data.targetEmail).trim().toLowerCase()
    : callerEmail;

  if (rawTarget !== callerEmail && !isCreator) {
    throw new HttpsError("permission-denied", "Tu ne peux supprimer que ton propre compte.");
  }

  const key = emailKey(rawTarget);
  const snap = await db.ref("users/" + key).get();
  const user = snap.val();
  if (!user) throw new HttpsError("not-found", "Compte introuvable.");
  if (user.role === "deleted") throw new HttpsError("failed-precondition", "Ce compte a déjà été supprimé.");
  if (user.role !== "coach") throw new HttpsError("permission-denied", "Cette action concerne uniquement les comptes coach.");

  // Sécurité serveur : vérifier l'absence d'athlètes encore rattachés.
  const athSnap = await db.ref("users").orderByChild("coachId").equalTo(user.id).get();
  const remaining = [];
  athSnap.forEach((c) => remaining.push(c.key));
  if (remaining.length > 0) {
    throw new HttpsError(
      "failed-precondition",
      `${remaining.length} athlète(s) encore rattaché(s) à ce coach. Réassigne-les avant de supprimer le compte.`
    );
  }

  const anonId = "del_" + (user.id || key.slice(0, 16)) + "_" + Date.now();
  const now = Date.now();

  // Archive financière sans PII (conservation légale 5 ans).
  const financialArchive = {
    anonId,
    originalId: user.id || null,
    paypalSubscriptionId: user.paypalSubscriptionId || null,
    paymentStatus: user.paymentStatus || null,
    status: user.status || null,
    deletedAt: now,
    retainUntil: now + 5 * 365 * 24 * 60 * 60 * 1000,
  };

  const updates = {};
  updates["users/" + key] = null;
  updates["deleted_accounts/" + anonId] = financialArchive;
  await db.ref().update(updates);

  // Suppression du compte Firebase Auth (Admin SDK — ne plante pas si absent).
  try {
    const authUser = await admin.auth().getUserByEmail(rawTarget);
    await admin.auth().deleteUser(authUser.uid);
  } catch (e) {
    console.warn("anonymizeCoach: Auth deletion skipped for", rawTarget, "—", e.message);
  }

  return { ok: true, anonId };
});

// ── verifyPaypalSubscription ─────────────────────────────────────────────────
// Appelée par onApprove() dans index.html après que PayPal a approuvé l'abonnement.
// Le statut AUTONOMIE_PREMIUM n'est écrit dans la base QUE si PayPal confirme
// que l'abonnement est ACTIVE et correspond au bon plan — le client ne peut pas
// se l'attribuer lui-même en falsifiant l'appel JS.
exports.verifyPaypalSubscription = onCall({ secrets: [PAYPAL_CLIENT_SECRET] }, async (request) => {
  // 1. Auth obligatoire — l'email vient du token Firebase, pas du client.
  if (!request.auth || !request.auth.token || !request.auth.token.email) {
    throw new HttpsError("unauthenticated", "Connecte-toi pour activer l'abonnement.");
  }
  const userEmail = request.auth.token.email.toLowerCase();

  // 2. Paramètre subscriptionId transmis par le client.
  const subscriptionId = String(request.data && request.data.subscriptionId || "").trim();
  if (!subscriptionId) throw new HttpsError("invalid-argument", "subscriptionId manquant.");

  // 3. Vérification auprès de l'API PayPal.
  const ppToken = await getPaypalToken(PAYPAL_CLIENT_SECRET.value());
  const sub = await fetchSubscription(subscriptionId, ppToken);

  // 4. Contrôles métier — statut et plan.
  if (sub.status !== "ACTIVE") {
    throw new HttpsError(
      "failed-precondition",
      `Abonnement non actif côté PayPal (statut reçu : ${sub.status}).`
    );
  }
  if (sub.plan_id !== PAYPAL_PLAN_ID) {
    throw new HttpsError(
      "permission-denied",
      "Cet abonnement ne correspond pas au plan RepCore."
    );
  }

  // 5. Écriture dans RTDB via Admin SDK — le client n'écrit plus jamais ce bloc.
  const key = emailKey(userEmail);
  const updates = {
    [`users/${key}/status`]:               "AUTONOMIE_PREMIUM",
    [`users/${key}/paymentStatus`]:        "active",
    [`users/${key}/paypalSubscriptionId`]: subscriptionId,
    [`users/${key}/updatedAt`]:            Date.now(),
  };

  // Optionnel : rattachement à un coach transmis en session (non critique — pas de gain financier).
  const pendingCoachId   = request.data && request.data.coachId   ? String(request.data.coachId).slice(0, 64)   : null;
  const pendingCoachName = request.data && request.data.coachName ? String(request.data.coachName).slice(0, 120) : null;
  if (pendingCoachId) {
    updates[`users/${key}/coachId`]   = pendingCoachId;
    updates[`users/${key}/coachName`] = pendingCoachName || "";
  }

  await db.ref().update(updates);
  // LE DROIT, POSE PAR LE SERVEUR. users/ garde ses champs pour l'affichage et
  // pour la fiche du coach ; c'est droits/ que l'application lit pour ouvrir
  // ou fermer quoi que ce soit.
  const actuel = await lireDroits(key);
  const plans = await chargerPlans();
  const offre = offreDuPlan(sub.plan_id, plans);
  const champs = {
    palier: offre.palier,
    echeance: prolonger(actuel && actuel.echeance, offre.mois * MONTH_MS),
    source: "paypal",
    abonnement: subscriptionId,
  };
  // ⚠ UNE SEULE FOIS DANS LA VIE DU COMPTE. Le drapeau est pose ICI, au
  //   moment ou le demi-tarif est encaisse : pose ailleurs, il aurait pu
  //   l'etre sans qu'un euro soit passe.
  if (offre.demi) champs.demiPackUtilise = true;
  await ecrireDroits(key, champs);
  return { ok: true };
});

// ══ QUEL PLAN PAYPAL OUVRE QUOI ══════════════════════════════════════════
// ⚠ LES IDENTIFIANTS SE REMPLISSENT DANS LE TABLEAU DE BORD PAYPAL, PAS ICI.
//   Trois des quatre plans n'existent pas encore (lot 5 : Essentielle annuel,
//   Ultime mensuel, Ultime annuel). Tant qu'un identifiant manque, son entree
//   reste vide et le plan tombe dans le repli ci-dessous.
//
// ET ILS SE LISENT AUSSI DANS LA BASE, sous config/plans : Kevin peut donc
// declarer un plan cree ce matin sans attendre un deploiement de fonctions.
// La table du fichier sert de repli quand la base ne dit rien.
const PLANS_CONNUS = {
  // planId PayPal                 palier          mois   ce que c'est
  "P-95N51603RD882780YNJKS2QA": { palier: "essentielle", mois: 1 },  // Essentielle, mensuel
  // Crees le 24/09/2026 par scripts/paypal_plans.mjs, sur le compte reel.
  "P-92T09491KF550281RNK2LZWY": { palier: "essentielle", mois: 12 }, // Essentielle, annuel
  "P-2W777608239063532NK2LZXA": { palier: "ultime", mois: 1 },       // Ultime, mensuel
  "P-16Y44630WF304553UNK2LZXI": { palier: "ultime", mois: 12 },      // Ultime, annuel
  // ⚠ CELUI-CI PORTE `demi` : c'est le premier mois a moitie prix apres un
  //   pack, et ce drapeau est ce qui le marque comme consomme dans droits/.
  //   Sans lui, il se reprendrait a chaque sortie de pack.
  "P-57P40267XP026613FNK2LZXQ": { palier: "ultime", mois: 1, demi: true },
};
let _plansBase = null;
async function chargerPlans() {
  if (_plansBase) return _plansBase;
  try {
    const s = await db.ref("config/plans").get();
    _plansBase = (s.exists() && s.val()) || {};
  } catch (e) { _plansBase = {}; }
  return _plansBase;
}
// ⚠ LE REPLI EST LE PALIER LE PLUS BAS QUI NE CASSE RIEN, JAMAIS LE PLUS HAUT.
//   Un plan inconnu ouvre Essentielle pour un mois : la personne a paye, elle
//   doit entrer ; mais on ne lui donne pas Ultime sur la foi d'un identifiant
//   qu'on ne reconnait pas.
function offreDuPlan(planId, table) {
  const t = Object.assign({}, PLANS_CONNUS, table || {});
  const o = t[String(planId || "")];
  if (o && o.palier) {
    return {
      palier: palierValide(o.palier),
      mois: Math.max(1, Number(o.mois) || 1),
      // LE PREMIER MOIS A MOITIE PRIX NE SE DONNE QU'UNE FOIS (lot 10). Le
      // plan qui le porte est declare `demi` dans config/plans ; c'est ce
      // drapeau qui fait marquer le dossier, et le marquage qui ferme la
      // porte a une seconde sortie de pack.
      demi: o.demi === true,
    };
  }
  return { palier: "essentielle", mois: 1, demi: false };
}

// ── getCloudinarySignature ───────────────────────────────────────────────────
// Génère une signature SHA1 Cloudinary pour un upload signé côté serveur.
// L'API secret ne quitte jamais le serveur — seul le hash est renvoyé au client.
// Tout utilisateur authentifié Firebase peut obtenir une signature (coaches et
// athlètes uploadent tous via Cloudinary).
exports.getCloudinarySignature = onCall(
  { secrets: [CLOUDINARY_API_SECRET, CLOUDINARY_API_KEY] },
  async (request) => {
    if (!request.auth || !request.auth.token || !request.auth.token.email) {
      throw new HttpsError("unauthenticated", "Connecte-toi pour effectuer cette action.");
    }
    const folder = String(request.data && request.data.folder || "").trim();
    const uploadPreset = String(request.data && request.data.uploadPreset || "").trim();
    const timestamp = parseInt(request.data && request.data.timestamp);
    if (!folder.startsWith("repcore/") || folder.length > 200) {
      throw new HttpsError("invalid-argument", "Dossier de destination invalide.");
    }
    if (!uploadPreset || uploadPreset.length > 100) {
      throw new HttpsError("invalid-argument", "Upload preset invalide.");
    }
    if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) {
      throw new HttpsError("invalid-argument", "Timestamp invalide ou expiré (fenêtre ±5 min).");
    }
    // Signature Cloudinary : SHA1(params triés par clé + api_secret)
    // Les paramètres qui entrent dans la signature sont exactement ceux envoyés
    // dans le FormData, hors file, resource_type, cloud_name et api_key.
    const params = { folder, timestamp, upload_preset: uploadPreset };
    const paramStr = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
    const signature = crypto.createHash("sha1")
      .update(paramStr + CLOUDINARY_API_SECRET.value())
      .digest("hex");
    return { signature, timestamp, apiKey: CLOUDINARY_API_KEY.value() };
  }
);

// ── ocrParseImage ─────────────────────────────────────────────────────────────
// Proxy OCR.space — la clé API ne quitte jamais le serveur.
// Tout utilisateur Firebase authentifié peut appeler cette fonction (coaches
// et athlètes utilisent tous les deux l'import de fiche d'entraînement par photo).
exports.ocrParseImage = onCall(
  { secrets: [OCR_SPACE_API_KEY] },
  async (request) => {
    if (!request.auth || !request.auth.token || !request.auth.token.email) {
      throw new HttpsError("unauthenticated", "Connecte-toi pour effectuer cette action.");
    }
    const dataUrl = String(request.data && request.data.dataUrl || "");
    if (!dataUrl.startsWith("data:image/")) {
      throw new HttpsError("invalid-argument", "Format d'image invalide.");
    }
    // 1.5 MB base64 ≈ 1.1 MB binaire — cohérent avec la limite ~900 KB imposée côté client
    if (dataUrl.length > 1.5 * 1024 * 1024) {
      throw new HttpsError("invalid-argument", "Image trop volumineuse (max ~1 Mo après compression).");
    }
    const language = String(request.data.language || "fre").slice(0, 20);
    const isTable = request.data.isTable !== false;
    const engine = [1, 2].includes(Number(request.data.engine)) ? Number(request.data.engine) : 2;

    const body = new URLSearchParams({
      base64Image: dataUrl,
      language,
      isTable: isTable ? "true" : "false",
      scale: "true",
      OCREngine: String(engine),
      isCreateSearchablePDF: "false",
    });
    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        "apikey": OCR_SPACE_API_KEY.value(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (!res.ok) throw new HttpsError("internal", `Service OCR indisponible (${res.status}).`);
    const d = await res.json();
    if (d.IsErroredOnProcessing) {
      throw new HttpsError("internal", d.ErrorMessage?.[0] || "Erreur OCR.");
    }
    return { text: (d.ParsedResults?.[0]?.ParsedText || "").trim() };
  }
);

// ── togglePaymentStatus ───────────────────────────────────────────────────────
// Bascule paymentStatus (active ↔ cancelled) d'un abonné AUTONOMIE_PREMIUM.
// Autorisé uniquement pour CREATOR_EMAIL ou le coach propriétaire de l'athlète.
// Utilise l'Admin SDK pour contourner la règle RTDB (qui bloque cancelled→active
// côté client) tout en maintenant l'isolation par vérification serveur stricte.
exports.togglePaymentStatus = onCall(async (request) => {
  if (!request.auth || !request.auth.token || !request.auth.token.email) {
    throw new HttpsError("unauthenticated", "Connecte-toi pour effectuer cette action.");
  }
  const callerEmail = request.auth.token.email.toLowerCase();
  const isCreator = callerEmail === CREATOR_EMAIL;

  const athleteEmail = String(request.data && request.data.athleteEmail || "").toLowerCase().trim();
  if (!athleteEmail) throw new HttpsError("invalid-argument", "athleteEmail requis.");

  // Lecture autoritaire de l'athlète depuis RTDB (jamais depuis le cache client).
  const athKey = emailKey(athleteEmail);
  const athSnap = await db.ref("users/" + athKey).get();
  const athlete = athSnap.val();
  if (!athlete || athlete.status !== "AUTONOMIE_PREMIUM") {
    throw new HttpsError("not-found", "Abonné introuvable.");
  }

  if (!isCreator) {
    // Vérification d'appartenance : le coach appelant doit être celui référencé
    // dans le profil de l'athlète — lu depuis RTDB, pas depuis le cache client.
    const callerSnap = await db.ref("users/" + emailKey(callerEmail)).get();
    const caller = callerSnap.val();
    if (!caller || caller.role !== "coach") {
      throw new HttpsError("permission-denied", "Cette action est réservée aux coachs.");
    }
    if (!athlete.coachId || caller.id !== athlete.coachId) {
      throw new HttpsError("permission-denied", "Cet athlète n'est pas dans ta liste.");
    }
  }

  const newStatus = athlete.paymentStatus === "active" ? "cancelled" : "active";
  await db.ref().update({
    [`users/${athKey}/paymentStatus`]: newStatus,
    [`users/${athKey}/updatedAt`]: Date.now(),
  });
  return { paymentStatus: newStatus };
});

// ── cloudinaryDestroy ─────────────────────────────────────────────────────────
// SUPPRIME POUR DE BON un média chez Cloudinary. Calquée sur
// getCloudinarySignature : les deux mêmes secrets, le même refus sans
// authentification, et l'API secret ne quitte jamais le serveur.
//
// POURQUOI ELLE EXISTE. Jusqu'ici l'app ne pouvait effacer une copie distante
// que dans les DIX MINUTES suivant l'envoi, par le `delete_token` d'un upload
// non signé. Au-delà, « supprimer une vidéo » ne supprimait que la ligne dans
// le dossier : le fichier restait chez l'hébergeur, pour toujours, et le compte
// grossissait sans que personne ne puisse rien y faire depuis l'application.
// Une révocation de photos de progression — un droit, pas une option — laissait
// les originaux en place et l'écran devait le dire.
//
// ⚠ ELLE NE TOURNE PAS ENCORE. Le projet est en plan Spark : aucune fonction
//   n'est déployée (les trois autres répondent 404, mesuré le 23/09/2026).
//   Le client l'appelle quand même, et met en file d'attente locale tout ce
//   qu'elle n'a pas pu détruire — file qu'il REJOUE au démarrage et qu'il
//   AFFICHE. Le jour où le projet passe en Blaze, `firebase deploy --only
//   functions` suffit : la file se vide d'elle-même à la première ouverture.
//   Rien à changer dans l'app.
//
// CE QU'ELLE VÉRIFIE AVANT DE DÉTRUIRE, et c'est le cœur : un identifiant
// Cloudinary est PUBLIC (il est dans l'URL de la vidéo). Sans contrôle
// d'appartenance, n'importe quel compte connecté pourrait effacer les médias de
// n'importe qui. On exige donc que le média appartienne à l'appelant, ou à un
// athlète dont l'appelant est LE coach désigné PAR LE DOSSIER — lu dans la
// base, jamais d'après ce que le client prétend.
exports.cloudinaryDestroy = onCall(
  { secrets: [CLOUDINARY_API_SECRET, CLOUDINARY_API_KEY] },
  async (request) => {
    if (!request.auth || !request.auth.token || !request.auth.token.email) {
      throw new HttpsError("unauthenticated", "Connecte-toi pour effectuer cette action.");
    }
    const callerEmail = request.auth.token.email.toLowerCase();
    const publicId = String(request.data && request.data.publicId || "").trim();
    const resourceType = String(request.data && request.data.resourceType || "").trim();
    const proprietaire = String(request.data && request.data.proprietaire || "").toLowerCase().trim();

    // ── L'IDENTIFIANT ────────────────────────────────────────────────────────
    // Tout ce que l'app envoie chez Cloudinary part sous `repcore/<qui>/…`. Un
    // identifiant qui ne commence pas par là n'est pas à nous, et un `..` n'a
    // rien à faire dans un chemin.
    if (!publicId.startsWith("repcore/") || publicId.length > 300
        || publicId.indexOf("..") >= 0 || /[\r\n]/.test(publicId)) {
      throw new HttpsError("invalid-argument", "Identifiant de média invalide.");
    }
    if (resourceType !== "image" && resourceType !== "video") {
      throw new HttpsError("invalid-argument", "Type de média invalide.");
    }
    // Le segment qui suit « repcore/ » EST le propriétaire : l'app y met
    // `user.id` quand il existe, son adresse sinon.
    const jeton = publicId.split("/")[1] || "";
    if (!jeton) throw new HttpsError("invalid-argument", "Identifiant de média sans propriétaire.");

    // ── L'APPARTENANCE, LUE DANS LA BASE ─────────────────────────────────────
    const callerSnap = await db.ref("users/" + emailKey(callerEmail)).get();
    const caller = callerSnap.val();
    if (!caller) throw new HttpsError("permission-denied", "Dossier introuvable.");
    const aLui = jeton === caller.id || jeton === callerEmail || jeton === emailKey(callerEmail);

    if (!aLui) {
      // PAS DE PARCOURS DE TOUS LES DOSSIERS : l'appelant dit de QUI est le
      // média, et on vérifie les deux bouts — que le dossier annoncé porte bien
      // cet identifiant, et que l'appelant en est le coach désigné. Deux
      // lectures directes, et rien qui dépende du cache du client.
      if (!proprietaire) {
        throw new HttpsError("permission-denied", "Ce média n'est pas le tien.");
      }
      const cibleSnap = await db.ref("users/" + emailKey(proprietaire)).get();
      const cible = cibleSnap.val();
      if (!cible) throw new HttpsError("not-found", "Dossier du propriétaire introuvable.");
      if (jeton !== cible.id && jeton !== proprietaire && jeton !== emailKey(proprietaire)) {
        throw new HttpsError("permission-denied", "Ce média n'appartient pas au dossier annoncé.");
      }
      if (caller.role !== "coach" || !cible.coachId || cible.coachId !== caller.id) {
        throw new HttpsError("permission-denied", "Cet athlète n'est pas dans ta liste.");
      }
    }

    // ── LA DESTRUCTION ───────────────────────────────────────────────────────
    // `invalidate` purge aussi les copies du réseau de diffusion : sans lui, une
    // photo révoquée reste servie par les caches pendant des heures. Il entre
    // dans la signature, comme tout paramètre envoyé.
    const cloudName = String(request.data && request.data.cloudName || "dntu57ml")
      .trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || "dntu57ml";
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { invalidate: "true", public_id: publicId, timestamp };
    const paramStr = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
    const signature = crypto.createHash("sha1")
      .update(paramStr + CLOUDINARY_API_SECRET.value())
      .digest("hex");
    const body = new URLSearchParams({
      public_id: publicId,
      invalidate: "true",
      timestamp: String(timestamp),
      api_key: CLOUDINARY_API_KEY.value(),
      signature,
    });
    let res;
    try {
      res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch (err) {
      throw new HttpsError("unavailable", "Cloudinary est injoignable : le média reste à purger.");
    }
    let d = null;
    try { d = await res.json(); } catch (err) { d = null; }
    // « not found » EST UN SUCCÈS : le fichier n'est plus là, c'est tout ce
    // qu'on voulait. Le redire en échec ferait rejouer la file indéfiniment.
    const r = d && d.result;
    if (r === "ok" || r === "not found") return { result: r, publicId };
    if (res.status === 401 || res.status === 403) {
      // La clé ne couvre pas ce compte Cloudinary — cas d'un coach qui a
      // configuré le sien. On le DIT, au lieu de faire semblant.
      throw new HttpsError("permission-denied",
        "Ce média est hébergé sur un autre compte Cloudinary que celui du service.");
    }
    throw new HttpsError("internal",
      "Cloudinary a refusé la suppression" + (r ? ` (${r})` : ` (${res.status})`) + ".");
  }
);

// ══ LE WEBHOOK PAYPAL : LE SEUL CHEMIN D'ECRITURE AUTOMATIQUE ════════════
// Chaque paiement, chaque renouvellement et chaque annulation passe par ici.
// PayPal appelle cette adresse ; personne d'autre ne peut la faire mentir,
// parce que la signature est verifiee AUPRES DE PAYPAL avant toute ecriture.
//
// ⚠ UN APPEL QU'ON NE PEUT PAS VERIFIER EST REFUSE, jamais accepte par
//   defaut : sans PAYPAL_WEBHOOK_ID, sans signature, ou si PayPal repond
//   autre chose que SUCCESS, on rend 401 et on n'ecrit rien. Le contraire
//   aurait fait de cette adresse un distributeur d'abonnements.
//
// A DECLARER DANS PAYPAL (tableau de bord > Webhooks) :
//   URL   https://europe-west1-repcore-sync.cloudfunctions.net/paypalWebhook
//   Evenements : BILLING.SUBSCRIPTION.ACTIVATED, .CANCELLED, .EXPIRED,
//                .SUSPENDED, PAYMENT.SALE.COMPLETED,
//                PAYMENT.CAPTURE.COMPLETED, CHECKOUT.ORDER.APPROVED
exports.paypalWebhook = onRequest(
  { secrets: [PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID], cors: false },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("POST attendu"); return; }
    const webhookId = PAYPAL_WEBHOOK_ID.value();
    if (!webhookId) { res.status(401).send("webhook non configure"); return; }
    const h = req.headers || {};
    const corps = req.body || {};
    let verif = null;
    try {
      const token = await getPaypalToken(PAYPAL_CLIENT_SECRET.value());
      const r = await fetch(PAYPAL_API + "/v1/notifications/verify-webhook-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          auth_algo: h["paypal-auth-algo"],
          cert_url: h["paypal-cert-url"],
          transmission_id: h["paypal-transmission-id"],
          transmission_sig: h["paypal-transmission-sig"],
          transmission_time: h["paypal-transmission-time"],
          webhook_id: webhookId,
          webhook_event: corps,
        }),
      });
      verif = await r.json();
    } catch (e) { verif = null; }
    if (!verif || verif.verification_status !== "SUCCESS") {
      res.status(401).send("signature refusee"); return;
    }

    const type = String(corps.event_type || "");
    const ress = corps.resource || {};
    // L'ADRESSE DU PAYEUR, d'ou qu'elle vienne. PayPal la range a trois
    // endroits selon l'evenement ; on les essaie dans l'ordre, et si aucune
    // n'est lisible on ne fait rien plutot que d'ecrire au hasard.
    const mail = String(
      (ress.subscriber && ress.subscriber.email_address) ||
      (ress.payer && ress.payer.email_address) ||
      (ress.payer && ress.payer.payer_info && ress.payer.payer_info.email) ||
      (corps.summary_email || "")
    ).toLowerCase().trim();
    if (!mail || mail.indexOf("@") < 0) { res.status(200).send("sans adresse, rien a faire"); return; }
    const cle = emailKey(mail);
    const table = await chargerPlans();
    const actuel = await lireDroits(cle);

    try {
      if (type === "BILLING.SUBSCRIPTION.ACTIVATED" || type === "PAYMENT.SALE.COMPLETED") {
        const planId = String(ress.plan_id || (ress.billing_agreement_id ? "" : "") || "");
        const offre = offreDuPlan(planId, table);
        await ecrireDroits(cle, {
          palier: offre.palier,
          echeance: prolonger(actuel && actuel.echeance, offre.mois * MONTH_MS),
          source: "paypal",
          abonnement: String(ress.id || ress.billing_agreement_id || "").slice(0, 64),
        });
      } else if (type === "BILLING.SUBSCRIPTION.CANCELLED" || type === "BILLING.SUBSCRIPTION.EXPIRED"
              || type === "BILLING.SUBSCRIPTION.SUSPENDED") {
        // ⚠ ON NE COUPE PAS LE JOUR MEME. Un abonnement annule reste ouvert
        //   jusqu'a la fin de la periode deja payee : couper a l'instant de
        //   l'annulation, c'est reprendre un mois que la personne a regle.
        await ecrireDroits(cle, {
          source: "paypal_annule",
          annuleLe: Date.now(),
          echeance: Number((actuel && actuel.echeance) || 0) || Date.now(),
        });
      } else if (type === "PAYMENT.CAPTURE.COMPLETED" || type === "CHECKOUT.ORDER.APPROVED") {
        // Un achat ponctuel (programme, revision) : le montant dit la duree,
        // et le client la confirme ensuite par son propre appel. Ici on pose
        // le minimum : un mois d'Ultime, prolonge si besoin par l'appel dedie.
        await ecrireDroits(cle, {
          palier: "ultime",
          echeance: prolonger(actuel && actuel.echeance, MONTH_MS),
          source: "paypal_achat",
        });
      }
    } catch (e) {
      res.status(500).send("ecriture impossible"); return;
    }
    res.status(200).send("ok");
  }
);

// ══ LA MIGRATION, UNE FOIS ═══════════════════════════════════════════════
// Elle lit ce que users/ porte aujourd'hui — status, paymentStatus,
// accessExpiry — et ECRIT le droit correspondant dans droits/. Sans elle, le
// jour ou les regles sont deployees, tous les comptes existants retombent au
// palier le plus bas : ils n'ont jamais eu de ligne dans droits/.
//
// ⚠ ELLE NE DONNE QUE CE QUE LE DOSSIER PORTE DEJA, et jamais plus. Un dossier
//   trafique avant ce lot garde ce qu'il s'etait donne : c'est le prix d'une
//   bascule sans coupure, et la fraude s'arrete la — plus aucune ecriture
//   client n'a d'effet apres.
//
//   `simulation: true` (defaut) ne fait que compter. Il faut la rappeler avec
//   `simulation: false` pour ecrire quoi que ce soit.
// ══ UN PROGRAMME ACHETE OUVRE ULTIME (lot 8) ══════════════════════════════
//
// LE CLIENT NE DECIDE PAS DE SON PALIER. Il envoie l'identifiant de l'ordre
// PayPal ; c'est PayPal qui dit si l'argent est arrive, et c'est l'Admin SDK
// qui ecrit droits/. Meme chemin que verifyPaypalSubscription, pour un ordre
// ponctuel au lieu d'un abonnement.
//
// ⚠ UN ORDRE NE SERT QU'UNE FOIS. Sans ce garde-fou, le meme identifiant
//   rouvrirait trois mois autant de fois qu'on le renvoie. Le noeud achats/
//   est ferme a tout le monde sauf a l'Admin SDK.
async function fetchOrder(orderId, token) {
  const r = await fetch(PAYPAL_API + "/v2/checkout/orders/" + encodeURIComponent(orderId), {
    headers: { Authorization: "Bearer " + token },
  });
  if (!r.ok) throw new HttpsError("not-found", "Commande PayPal introuvable (" + r.status + ").");
  return r.json();
}
exports.verifierAchatProgramme = onCall({ secrets: [PAYPAL_CLIENT_SECRET] }, async (request) => {
  if (!request.auth || !request.auth.token || !request.auth.token.email) {
    throw new HttpsError("unauthenticated", "Connecte-toi pour acheter.");
  }
  const mail = String(request.auth.token.email).toLowerCase();
  const cle = emailKey(mail);
  const orderId = String((request.data && request.data.orderId) || "").trim().slice(0, 64);
  const programmeId = String((request.data && request.data.programmeId) || "").trim().slice(0, 64);
  if (!orderId) throw new HttpsError("invalid-argument", "Commande manquante.");

  // UN ORDRE, UNE FOIS. On pose le drapeau AVANT d'ecrire le droit : deux
  // appels simultanes ne doivent pas ouvrir deux fois.
  const ref = db.ref("achats/" + orderId);
  const pose = await ref.transaction((v) => (v === null ? { cle, programmeId, le: Date.now() } : undefined));
  if (!pose.committed) {
    const deja = pose.snapshot && pose.snapshot.val();
    return { ouvert: false, raison: "deja", pour: deja && deja.cle === cle };
  }

  let ordre = null;
  try {
    const token = await getPaypalToken(PAYPAL_CLIENT_SECRET.value());
    ordre = await fetchOrder(orderId, token);
  } catch (e) {
    // La verification n'a pas abouti : on relache le drapeau, sinon un incident
    // reseau brulerait l'ordre d'un client qui a paye.
    await ref.remove().catch(() => {});
    throw e;
  }
  if (!ordre || ordre.status !== "COMPLETED") {
    await ref.remove().catch(() => {});
    throw new HttpsError("failed-precondition",
      "Paiement non capture cote PayPal (statut : " + ((ordre && ordre.status) || "inconnu") + ").");
  }

  // COMBIEN DE MOIS S'OUVRENT. Une revision rouvre UN mois (lot 9) : sans
  // cela, quelqu'un qui revient au huitieme mois paie 40 € pour un programme
  // qu'il ne peut pas ouvrir. Un programme de la boutique en ouvre trois.
  const mois = programmeId === "revision-programme" ? 1 : 3;
  const actuel = await lireDroits(cle);
  const droits = await ecrireDroits(cle, {
    palier: "ultime",
    echeance: prolonger(actuel && actuel.echeance, mois * MONTH_MS),
    source: programmeId === "revision-programme" ? "revision" : "programme",
    programme: programmeId,
  });
  return { ouvert: true, echeance: droits.echeance };
});

// ══ L'ESSAI D'UN MOIS, POSE PAR LE SERVEUR (lot 6) ════════════════════════
//
// POURQUOI ELLE EXISTE. L'essai vivait dans le dossier, et database.rules.json
// accorde au titulaire l'ecriture sans restriction sur users/<sa cle> : on
// remettait `essai` a zero depuis la console du navigateur, et on recommencait
// un mois, indefiniment. L'echeance posee ICI vit dans droits/, ou personne
// n'ecrit sauf l'Admin SDK.
//
// UNE SEULE FOIS PAR COMPTE, ET C'EST LE SERVEUR QUI LE SAIT : si droits/
// porte deja un essaiOuvertLe, la fonction rend l'echeance existante sans rien
// reecrire. Un second appel ne prolonge rien.
//
// ⚠ ELLE N'OUVRE PAS DE DROIT A QUI EN A DEJA UN. Un athlete suivi par un
//   coach, ou un abonne, n'a pas besoin d'un essai : lui en poser un
//   laisserait un mois dormant a consommer le jour ou son acces s'arrete.
exports.ouvrirEssai = onCall(async (request) => {
  const mail = request.auth && request.auth.token && request.auth.token.email
    ? String(request.auth.token.email).toLowerCase() : "";
  if (!mail) throw new HttpsError("unauthenticated", "Connexion requise.");
  const cle = mail.replace(/\./g, ",");
  const jours = Math.min(90, Math.max(1, Math.round(Number(request.data && request.data.jours) || 30)));
  const deja = await lireDroits(cle);
  if (deja && Number(deja.essaiOuvertLe) > 0) {
    return { ouvert: false, raison: "deja", essaiFinit: Number(deja.essaiFinit) || 0 };
  }
  if (deja && deja.palier && deja.palier !== "aucun") {
    return { ouvert: false, raison: "acces", palier: deja.palier };
  }
  const t = Date.now();
  const fin = t + jours * 86400000;
  await ecrireDroits(cle, {
    palier: "ultime", echeance: fin, essaiOuvertLe: t, essaiFinit: fin, source: "essai",
  });
  return { ouvert: true, essaiFinit: fin };
});

exports.migrerDroits = onCall(async (request) => {
  const mail = request.auth && request.auth.token && request.auth.token.email
    ? String(request.auth.token.email).toLowerCase() : "";
  if (mail !== CREATOR_EMAIL) throw new HttpsError("permission-denied", "Reserve au createur.");
  const simulation = !(request.data && request.data.simulation === false);
  const snap = await db.ref("users").get();
  const tous = snap.val() || {};
  const compte = { total: 0, suivi: 0, ultime: 0, essentielle: 0, aucun: 0, coachs: 0,
    ecrits: 0, protocoles: 0 };
  for (const cle of Object.keys(tous)) {
    const u = tous[cle] || {};
    compte.total++;
    if (u.role === "coach") { compte.coachs++; continue; }
    const st = String(u.status || "FREE");
    let palier = "aucun", echeance = Number(u.accessExpiry) || 0;
    if (st === "COACHING_SUIVI") palier = "suivi";
    else if (st === "AUTONOMIE_PREMIUM" && u.paymentStatus === "active") palier = "essentielle";
    if (palier !== "aucun" && echeance && echeance < Date.now()) { palier = "aucun"; }
    compte[palier]++;
    if (!simulation && palier !== "aucun") {
      await ecrireDroits(cle, { palier, echeance, source: "migration" });
      compte.ecrits++;
    }
    // LE DROIT ACQUIS DES PROTOCOLES (lot 3). La bibliotheque de protocoles
    // etait ouverte a tout le monde : la fermer pour Essentielle retirerait
    // quelque chose a des gens qui s'en servent. Le drapeau est donc pose une
    // fois, sur les dossiers QUI EXISTENT DEJA, et seuls les comptes crees
    // apres voient le verrou. Personne ne perd rien du jour au lendemain.
    //
    // ⚠ IL NE FERME RIEN, IL N'OUVRE QUE. Un dossier qui le porte garde
    //   l'acces ; un dossier qui ne le porte pas est juge par sa date de
    //   creation, cote client (protocolesHerites). Les deux chemins disent la
    //   meme chose, et le second tient meme si cette fonction ne tourne jamais.
    if (!simulation && u.protocolesHerites !== true) {
      await db.ref("users/" + cle + "/protocolesHerites").set(true);
      compte.protocoles++;
    }
  }
  return { simulation, compte };
});

// ══ LA RARETE DES BADGES, COMPTEE CHAQUE NUIT ═════════════════════════════
//
// L'ecran de celebration dit « possede par 4 % des athletes ». Ce chiffre ne
// peut PAS se calculer sur un telephone : il demanderait de lire le dossier de
// tout le monde. Il est donc compte ici, une fois par nuit, et ecrit dans
// /stats/badges — lecture publique, ecriture serveur seulement (voir
// database.rules.json). L'Admin SDK ne passe pas par les regles.
//
// CE QUI EST ECRIT, et rien de plus :
//   { maj: <ms>, total: <nombre d'athletes>, pct: { <idBadge>: 4.2, ... } }
// Aucun identifiant de personne, aucune liste : un pourcentage par badge.
//
// LE DENOMINATEUR : les dossiers ATHLETES (role different de « coach »). Un
// coach ne gagne aucun badge ; le compter ferait baisser tous les chiffres.
//
// ⚠ ON NE LIT PAS /users EN ENTIER. Un dossier porte ses seances, ses bilans,
// ses references de photos : tout lire chaque nuit ferait descendre la base
// entiere. On lit la LISTE des cles (?shallow=true, REST, jeton de service),
// puis, par paquets, deux petits noeuds par dossier : role et badges.
//
// ⚠ PLAN BLAZE. Les fonctions planifiees reposent sur Cloud Scheduler :
// comme les autres fonctions de ce fichier, celle-ci ne tourne pas sur Spark.
// Tant qu'elle ne tourne pas, /stats/badges reste vide et l'application
// n'affiche simplement pas la ligne de rarete.
const { onSchedule } = require("firebase-functions/v2/scheduler");

async function _clesUtilisateurs() {
  try {
    const jeton = await admin.credential.applicationDefault().getAccessToken();
    const racine = db.ref().toString().replace(/\/$/, "");
    const r = await fetch(racine + "/users.json?shallow=true&access_token=" +
      encodeURIComponent(jeton.access_token));
    if (r.ok) {
      const d = await r.json();
      if (d && typeof d === "object") return Object.keys(d);
    }
  } catch (e) { /* repli ci-dessous */ }
  // REPLI : la lecture complete. Plus lourde, mais juste.
  const s = await db.ref("users").get();
  return Object.keys(s.val() || {});
}

// PURE : les pourcentages, a un chiffre apres
// la virgule, depuis une liste de dossiers {role, badges}.
function calculerRareteBadges(dossiers) {
  let total = 0;
  const n = {};
  for (const d of dossiers) {
    if (!d || d.role === "coach") continue;
    total++;
    const b = (d.badges && typeof d.badges === "object") ? d.badges : {};
    for (const id of Object.keys(b)) {
      if (b[id] && Number(b[id].at) > 0) n[id] = (n[id] || 0) + 1;
    }
  }
  const pct = {};
  for (const id of Object.keys(n)) pct[id] = Math.round(n[id] / total * 1000) / 10;
  return { total, pct };
}

exports.statsBadges = onSchedule(
  { schedule: "every day 03:17", timeZone: "Europe/Paris", timeoutSeconds: 540, memory: "512MiB" },
  async () => {
    const cles = await _clesUtilisateurs();
    const dossiers = [];
    const PAQUET = 50;
    for (let i = 0; i < cles.length; i += PAQUET) {
      const lot = cles.slice(i, i + PAQUET);
      const lus = await Promise.all(lot.map(async (k) => {
        const [role, badges] = await Promise.all([
          db.ref("users/" + k + "/role").get(),
          db.ref("users/" + k + "/badges").get(),
        ]);
        return { role: role.val(), badges: badges.val() };
      }));
      dossiers.push(...lus);
    }
    const r = calculerRareteBadges(dossiers);
    // Aucun athlete : on n'ecrit rien plutot qu'un tableau de zeros, que
    // l'application afficherait comme « 0 % ».
    if (!r.total) return;
    await db.ref("stats/badges").set({ maj: Date.now(), total: r.total, pct: r.pct });
  });

// ══ WEB PUSH ═══════════════════════════════════════════════════════════════
//
// Les notifications SERVEUR : elles partent même quand l'application est
// fermée, iPhone compris (application installée, iOS 16.4+), là où la
// notification locale du service worker ne part que sur Android.
//
// LES CLÉS VAPID. La publique est ci-dessous et dans le client
// (VAPID_PUBLIQUE, app/rc-core.*.js) : elle est faite pour être publique. La
// PRIVÉE n'est JAMAIS dans le dépôt : c'est un secret Functions,
//   firebase functions:secrets:set VAPID_PRIVATE_KEY
// Changer de paire, c'est changer les deux, et tous les abonnés devront se
// réabonner (le client le fait seul quand la clé publique change).
//
// OÙ VIVENT LES ABONNEMENTS : /push/<cléEmail>/<id> = {endpoint, keys, cree,
// plateforme}. Pas sous /users/<cléEmail>/push : le dossier est réécrit EN
// ENTIER (PUT) à chaque synchronisation, et un nœud posé à côté par un autre
// chemin y serait effacé au premier envoi. Les réglages (types coupés),
// eux, sont dans le dossier : users/<cléEmail>/pushPrefs = {type: false}.
//
// LE PLAFOND : UN push par jour et par personne (journal /push_log), aucun
// entre 21 h et 8 h heure de Paris — un message tombé la nuit attend 8 h
// dans /push_attente (le plus récent seulement), puis part s'il reste de la
// place dans la journée.
const webpush = require("web-push");
const { onValueCreated, onValueWritten } = require("firebase-functions/v2/database");
const VAPID_PRIVATE_KEY = defineSecret("VAPID_PRIVATE_KEY");
const VAPID_PUBLIQUE = "BEQvHnCStyK010R_ETviq4nAcu5PPTktlDX3AW245J60sLsMZdxe50t1N7Xs3WlYdY5FkMNRxtC71cHKi2DtZw0";
const PUSH_TYPES = ["serie", "wrapped", "bilan", "badge", "coach", "filleul", "defi"];
// La base par défaut vit en us-central1 : ses déclencheurs doivent y être
// déployés, quel que soit setGlobalOptions.
const DB_REGION = "us-central1";

// PURE. L'heure, le jour et la date à Paris — l'heure du serveur est UTC.
function _paris(t) {
  const f = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false });
  const p = {};
  for (const x of f.formatToParts(new Date(t))) p[x.type] = x.value;
  return { jour: p.year + "-" + p.month + "-" + p.day, heure: Number(p.hour) % 24, minute: Number(p.minute),
    annee: Number(p.year), mois: Number(p.month), date: Number(p.day) };
}
// PURE. Heures calmes : de 21 h à 8 h, heure de Paris.
function heuresCalmes(t) { const h = _paris(t).heure; return h >= 21 || h < 8; }
// PURE. Le lundi (AAAA-MM-JJ, heure de Paris) de la semaine de t : même forme
// que streakWeek côté client.
function lundiParis(t) {
  const p = _paris(t);
  const d = new Date(Date.UTC(p.annee, p.mois - 1, p.date));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
// PURE. Peut-on envoyer ? {ok, raison}. prefs : users/<k>/pushPrefs ;
// log : /push_log/<k> = {jour}.
function pushAutorise(type, prefs, log, t) {
  if (PUSH_TYPES.indexOf(type) < 0) return { ok: false, raison: "type" };
  if (prefs && prefs[type] === false) return { ok: false, raison: "coupe" };
  if (heuresCalmes(t)) return { ok: false, raison: "calme" };
  if (log && log.jour === _paris(t).jour) return { ok: false, raison: "plafond" };
  return { ok: true, raison: null };
}

/**
 * Envoie UN push à une personne, sur tous ses appareils.
 * @param {string} uid  la clé email (points remplacés par des virgules)
 * @param {{type:string,title:string,body:string,url?:string,tag?:string}} message
 * @param {{attendre?:boolean}} [o]  attendre : mis de côté s'il tombe en heures calmes
 * @returns {Promise<{envoye:number,raison:?string}>}
 */
async function envoyerPush(uid, message, o) {
  const t = Date.now();
  const type = String((message && message.type) || "");
  const [prefsS, logS] = await Promise.all([
    db.ref("users/" + uid + "/pushPrefs").get(), db.ref("push_log/" + uid).get()]);
  const ok = pushAutorise(type, prefsS.val(), logS.val(), t);
  if (!ok.ok) {
    if (ok.raison === "calme" && (!o || o.attendre !== false))
      await db.ref("push_attente/" + uid).set(Object.assign({}, message, { at: t }));
    return { envoye: 0, raison: ok.raison };
  }
  const subsS = await db.ref("push/" + uid).get();
  const subs = subsS.val() || {};
  const ids = Object.keys(subs);
  if (!ids.length) return { envoye: 0, raison: "aucun_abonnement" };
  // LE JOURNAL D'ABORD, en transaction : deux déclencheurs simultanés ne
  // passent pas tous les deux sous le plafond.
  const jour = _paris(t).jour;
  const tx = await db.ref("push_log/" + uid).transaction(cur =>
    (cur && cur.jour === jour) ? undefined : { jour, at: t, type });
  if (!tx.committed) return { envoye: 0, raison: "plafond" };
  webpush.setVapidDetails("mailto:" + CREATOR_EMAIL, VAPID_PUBLIQUE, VAPID_PRIVATE_KEY.value());
  const charge = JSON.stringify({ title: message.title, body: message.body || "",
    url: message.url || "./", tag: message.tag || ("rc-" + type), type });
  let envoye = 0;
  await Promise.all(ids.map(async id => {
    const s = subs[id];
    if (!s || !s.endpoint || !s.keys) return;
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, charge, { TTL: 24 * 3600 });
      envoye++;
    } catch (e) {
      // 404 / 410 : l'abonnement n'existe plus (appli désinstallée, permission
      // retirée). On le supprime — sinon on y enverrait pour toujours.
      if (e && (e.statusCode === 404 || e.statusCode === 410)) await db.ref("push/" + uid + "/" + id).remove();
    }
  }));
  // Rien n'est parti : la place du jour est rendue.
  if (!envoye) await db.ref("push_log/" + uid).remove();
  return { envoye, raison: envoye ? null : "echec" };
}

// Les clés des personnes qui ont au moins un abonnement : /push est petit, on
// le lit en shallow — jamais /users en entier.
async function _abonnes() {
  try {
    const jeton = await admin.credential.applicationDefault().getAccessToken();
    const racine = db.ref().toString().replace(/\/$/, "");
    const r = await fetch(racine + "/push.json?shallow=true&access_token=" + encodeURIComponent(jeton.access_token));
    if (r.ok) { const d = await r.json(); return d ? Object.keys(d) : []; }
  } catch (e) { /* repli */ }
  const s = await db.ref("push").get();
  return Object.keys(s.val() || {});
}
async function _lire(uid, champ) { return (await db.ref("users/" + uid + "/" + champ).get()).val(); }
const _optsPlanifie = { timeZone: "Europe/Paris", secrets: [VAPID_PRIVATE_KEY], timeoutSeconds: 540, memory: "512MiB" };

// ── SÉRIE EN DANGER : jeudi 18 h ───────────────────────────────────────────
// La semaine n'est pas validée (streakWeek n'est pas son lundi), et il y a
// une série à perdre. Hors suspension.
// ⚠ LE TAG EST CELUI DE LA NOTIFICATION LOCALE (sw.js, swCheckSerie :
// 'serie-<lundi>-jeu'), comme celui du Wrapped ('wrapped-<clé>') : si les deux
// arrivent, la seconde REMPLACE la première au lieu de s'y ajouter. Le rappel
// local reste le filet quand les Functions ne sont pas déployées.
exports.pushSerieEnDanger = onSchedule(Object.assign({ schedule: "0 18 * * 4" }, _optsPlanifie), async () => {
  const lundi = lundiParis(Date.now());
  for (const uid of await _abonnes()) {
    const [streak, semaine, susp, fname, jokers] = await Promise.all(["streak", "streakWeek", "suspension", "fname", "streakJokers"].map(c => _lire(uid, c)));
    if (!(Number(streak) > 0) || semaine === lundi || (susp && susp.actif)) continue;
    const n = Number(streak);
    await envoyerPush(uid, { type: "serie", url: "./?wo=1", tag: "serie-" + lundi + "-jeu",
      title: "Ta série de " + n + " semaine" + (n > 1 ? "s" : "") + " est en danger",
      body: (fname ? fname + ", il" : "Il") + " te reste jusqu’à dimanche pour valider ta semaine."
        + (Number(jokers) > 0 ? " Ton joker la sauverait, mais garde-le pour un vrai coup dur." : "") }, { attendre: false });
  }
});

// ── WRAPPED PRÊT : le 1er du mois, 10 h ───────────────────────────────────
// Seulement pour qui s'est entraîné le mois écoulé (lastSession).
exports.pushWrappedPret = onSchedule(Object.assign({ schedule: "0 10 1 * *" }, _optsPlanifie), async () => {
  const p = _paris(Date.now());
  const moisPrec = p.mois === 1 ? 12 : p.mois - 1, anPrec = p.mois === 1 ? p.annee - 1 : p.annee;
  const debut = Date.UTC(anPrec, moisPrec - 1, 1) - 2 * 3600e3;
  const cle = "m-" + anPrec + "-" + String(moisPrec).padStart(2, "0");
  const nom = new Date(Date.UTC(anPrec, moisPrec - 1, 15)).toLocaleDateString("fr-FR", { month: "long", timeZone: "Europe/Paris" });
  for (const uid of await _abonnes()) {
    const der = Number(await _lire(uid, "lastSession")) || 0;
    if (der < debut) continue;
    await envoyerPush(uid, { type: "wrapped", url: "./?wrapped=" + cle, tag: "wrapped-" + cle,
      title: "Ton mois de " + nom + " est prêt", body: "Tes chiffres, tes records et ton profil t’attendent." });
  }
});

// ── RAPPEL DE BILAN : samedi 10 h ─────────────────────────────────────────
// Le dernier bilan date de plus de 13 jours (quinzaine par défaut).
exports.pushRappelBilan = onSchedule(Object.assign({ schedule: "0 10 * * 6" }, _optsPlanifie), async () => {
  const t = Date.now();
  for (const uid of await _abonnes()) {
    const role = await _lire(uid, "role");
    if (role === "coach") continue;
    const s = await db.ref("users/" + uid + "/bilans").orderByKey().limitToLast(1).get();
    let der = 0; s.forEach(c => { der = Number((c.val() || {}).date) || 0; });
    if (der && t - der < 13 * 864e5) continue;
    const fname = await _lire(uid, "fname");
    await envoyerPush(uid, { type: "bilan", url: "./?bilan=1", tag: "bilan-" + _paris(t).jour,
      title: "C’est l’heure de ton bilan", body: (fname ? fname + ", 10" : "10") + " minutes quand tu as le temps ce week-end." });
  }
});

// ── BADGE PROCHE : dimanche 17 h ──────────────────────────────────────────
// ASSIDU (séances terminées) : à deux séances ou moins du palier suivant. Le
// nombre de séances se lit en shallow — jamais l'historique lui-même.
const ASSIDU_SEUILS = [10, 50, 100, 250];
exports.pushBadgeProche = onSchedule(Object.assign({ schedule: "0 17 * * 0" }, _optsPlanifie), async () => {
  const jeton = await admin.credential.applicationDefault().getAccessToken();
  const racine = db.ref().toString().replace(/\/$/, "");
  for (const uid of await _abonnes()) {
    let n = 0;
    try {
      const r = await fetch(racine + "/users/" + encodeURIComponent(uid) + "/sessions.json?shallow=true&access_token=" + encodeURIComponent(jeton.access_token));
      if (r.ok) n = Object.keys((await r.json()) || {}).length;
    } catch (e) { continue; }
    const seuil = ASSIDU_SEUILS.find(x => x > n);
    if (!seuil || seuil - n > 2) continue;
    const reste = seuil - n, palier = ["I", "II", "III", "IV"][ASSIDU_SEUILS.indexOf(seuil)];
    await envoyerPush(uid, { type: "badge", url: "./", tag: "badge-assidu-" + palier,
      title: "Encore " + reste + " séance" + (reste > 1 ? "s" : "") + " pour ASSIDU " + palier,
      body: "Le badge est à portée de main cette semaine." });
  }
});

// ── LES MESSAGES MIS DE CÔTÉ la nuit : 8 h 05 ─────────────────────────────
exports.pushApresHeuresCalmes = onSchedule(Object.assign({ schedule: "5 8 * * *" }, _optsPlanifie), async () => {
  const s = await db.ref("push_attente").get();
  const tout = s.val() || {};
  for (const uid of Object.keys(tout)) {
    const m = tout[uid];
    await db.ref("push_attente/" + uid).remove();
    // Au-delà de 12 h, le message a perdu son sens : on ne l'envoie pas.
    if (!m || Date.now() - (Number(m.at) || 0) > 12 * 3600e3) continue;
    await envoyerPush(uid, m, { attendre: false });
  }
});

// ── DÉCLENCHEURS ──────────────────────────────────────────────────────────
const _optsDecl = { region: DB_REGION, secrets: [VAPID_PRIVATE_KEY] };
// RÉPONSE DU COACH à un bilan : reponseCoach passe de vide à écrit.
exports.pushReponseCoachBilan = onValueWritten(Object.assign({ ref: "/users/{uid}/bilans/{i}/reponseCoach" }, _optsDecl), async (ev) => {
  const avant = ev.data.before.val(), apres = ev.data.after.val();
  if (!apres || avant) return;
  await envoyerPush(ev.params.uid, { type: "coach", url: "./", tag: "coach-bilan-" + ev.params.i,
    title: "Ton coach a répondu à ton bilan", body: String(apres).slice(0, 120) });
});
// … et à un bilan de fin de cycle (rite).
exports.pushReponseCoachRite = onValueWritten(Object.assign({ ref: "/users/{uid}/rites/{i}/reponseCoach" }, _optsDecl), async (ev) => {
  const avant = ev.data.before.val(), apres = ev.data.after.val();
  if (!apres || avant) return;
  await envoyerPush(ev.params.uid, { type: "coach", url: "./", tag: "coach-rite-" + ev.params.i,
    title: "Ton coach a répondu à ton bilan de cycle", body: String(apres).slice(0, 120) });
});
// FILLEUL INSCRIT : /parrainage/<parrain>/filleuls/<filleul>. ⚠ Le parrainage
// n'existe pas encore dans l'application : ce déclencheur attend son nœud, et
// ne coûte rien tant que rien n'y est écrit.
exports.pushFilleulInscrit = onValueCreated(Object.assign({ ref: "/parrainage/{parrain}/filleuls/{filleul}" }, _optsDecl), async (ev) => {
  const f = ev.data.val() || {};
  await envoyerPush(ev.params.parrain, { type: "filleul", url: "./", tag: "filleul-" + ev.params.filleul,
    title: "Ton filleul vient de s’inscrire", body: (f.fname ? f.fname + " a" : "Quelqu’un a") + " rejoint RepCore grâce à toi." });
});
// NOUVEAU DÉFI DANS LE CANAL : un message du coach marqué defi:true. Les
// destinataires sont ses athlètes, lus dans l'annuaire du coach.
exports.pushDefiCanal = onValueCreated(Object.assign({ ref: "/canaux/{coach}/messages/{msg}" }, _optsDecl), async (ev) => {
  const m = ev.data.val() || {};
  if (m.type !== "defi") return;
  const obj = require("./defis-calcul").texteObjectif(m);
  const fin = Number(m.fin) ? new Date(Number(m.fin)).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long" }) : "";
  const a = await db.ref("annuaire_coach/" + ev.params.coach).get();
  for (const uid of Object.keys(a.val() || {}))
    await envoyerPush(uid, { type: "defi", url: "./?canal=1", tag: "defi-" + ev.params.msg,
      title: "Nouveau défi : " + String(m.titre || "ton coach te lance un défi").slice(0, 60),
      body: (m.collectif ? "En équipe : " : "Objectif : ") + obj + (fin ? " d’ici le " + fin : "") + ". Tu le relèves ?" });
});

// ══ LES DÉFIS DU CANAL ═════════════════════════════════════════════════════
//
// Un défi est un message du Canal de type 'defi' :
//   /canaux/<coach>/messages/<id> = {at, type:'defi', titre, texte?, mesure,
//     objectif, collectif, debut, fin, recompense?}            (écrit par le coach)
// À côté, hors du message, ce que le coach n'écrit pas :
//   /canaux/<coach>/defis/<id>/participants/<athlète>/inscription  (l'athlète : {le, classement, pseudo?})
//   /canaux/<coach>/defis/<id>/participants/<athlète>/{valeur, metrique, termine, termineLe, place, maj}
//                                                                  (ICI SEULEMENT)
//   /canaux/<coach>/defis/<id>/public   le résumé que lisent les athlètes (ICI SEULEMENT)
//   /canaux/<coach>/defis/<id>/etat     paliers annoncés, dernier message système, clôture (ICI SEULEMENT)
//   /defis_resultats/<athlète>/<id>     un défi bouclé : de quoi dater les badges (ICI SEULEMENT)
// Le calcul lui-même vit dans defis-calcul.js, pur.
const D = require("./defis-calcul");

async function _defisDuCoach(coach) {
  const s = await db.ref("canaux/" + coach + "/messages").orderByChild("type").equalTo("defi").get();
  const out = [];
  s.forEach((c) => { const v = c.val(); if (v && v.type === "defi") out.push(Object.assign({}, v, { id: c.key })); });
  return out;
}
function _defiRef(coach, id, sous) { return db.ref("canaux/" + coach + "/defis/" + id + (sous ? "/" + sous : "")); }
// La valeur d'un athlète, relue dans SON dossier (séances et créneaux seulement).
async function _majParticipant(coach, defi, cle, t) {
  const [ses, cfg] = await Promise.all([_lire(cle, "sessions"), _lire(cle, "sessions_config")]);
  const u = { sessions: ses, sessions_config: cfg };
  const valeur = D.valeurDefi(u, defi);
  const metrique = D.metriqueClassement(defi, u).valeur;
  await _defiRef(coach, defi.id, "participants/" + cle).update({ valeur, metrique, maj: t });
}
async function _participants(coach, defi) {
  const s = await _defiRef(coach, defi.id, "participants").get();
  const brut = s.val() || {};
  const cles = Object.keys(brut).filter((k) => brut[k] && brut[k].inscription);
  const prenoms = await Promise.all(cles.map((k) => _lire(k, "fname")));
  return cles.map((k, i) => {
    const p = brut[k], ins = p.inscription || {};
    return { cle: k, nom: String(ins.pseudo || prenoms[i] || "").trim() || "Athlète", classement: ins.classement === true,
      valeur: Number(p.valeur) || 0, metrique: Number(p.metrique) || 0, termine: !!p.termine, termineLe: Number(p.termineLe) || 0 };
  });
}
// UN MESSAGE SYSTÈME dans le Canal, et la pastille des athlètes rallumée.
async function _publierSysteme(coach, defi, texte, t) {
  const id = "s" + t + "-" + String(defi.id).slice(-6).replace(/[^a-z0-9]/gi, "");
  await db.ref("canaux/" + coach + "/messages/" + id).set({ at: t, type: "systeme", texte: String(texte).slice(0, 1000), defiId: defi.id });
  await db.ref("coach_public/" + coach + "/canalDernier").set(t);
  return id;
}
// Tout ce qui découle des valeurs : qui a fini, les places, le résumé public,
// et l'annonce du jour s'il y en a une.
async function _recalculerDefi(coach, defi, t, o) {
  const parts = await _participants(coach, defi);
  const equipe = D.partEquipe(defi, parts.map((p) => p.valeur));
  for (const p of parts) {
    const fini = D.aTermine(defi, p.valeur, equipe);
    if (fini && !p.termineLe) p.termineLe = t;
    p.termine = fini;
  }
  const pl = D.places(parts);
  await Promise.all(parts.map((p) => _defiRef(coach, defi.id, "participants/" + p.cle)
    .update({ termine: p.termine, termineLe: p.termine ? p.termineLe : null, place: pl[p.cle] || null })));
  await _defiRef(coach, defi.id, "public").set(Object.assign(D.resumePublic(defi, parts), { maj: t }));
  if (!(o && o.sansAnnonce)) {
    const etat = (await _defiRef(coach, defi.id, "etat").get()).val() || {};
    const a = D.annonceSuivante(defi, etat, parts, equipe, _paris(t).jour);
    if (a) {
      await _publierSysteme(coach, defi, a.texte, t);
      await _defiRef(coach, defi.id, "etat").set(a.etat);
    }
  }
  return { parts, equipe };
}
async function _estClos(coach, id) { return (await _defiRef(coach, id, "etat/clos").get()).val() === true; }

// ── À CHAQUE SÉANCE TERMINÉE ─────────────────────────────────────────────
// Le dossier part en entier (PUT) : ce déclencheur ne se réveille que si
// `sessions` a changé. La valeur est RECALCULÉE depuis les séances, jamais
// incrémentée : une séance supprimée ou resynchronisée deux fois ne fausse rien.
exports.defiApresSeance = onValueWritten(Object.assign({ ref: "/users/{uid}/sessions" }, _optsDecl), async (ev) => {
  const uid = ev.params.uid;
  const coach = await _lire(uid, "coachEmailKey");
  if (!coach) return;
  const t = Date.now();
  for (const defi of await _defisDuCoach(coach)) {
    if (t < Number(defi.debut) || await _estClos(coach, defi.id)) continue;
    const ins = (await _defiRef(coach, defi.id, "participants/" + uid + "/inscription").get()).val();
    if (!ins) continue;
    await _majParticipant(coach, defi, uid, t);
    await _recalculerDefi(coach, defi, t);
  }
});
// ── À L'INSCRIPTION (et à la désinscription) ─────────────────────────────
// Les séances déjà faites depuis le début du défi comptent tout de suite.
exports.defiInscription = onValueWritten(Object.assign({ ref: "/canaux/{coach}/defis/{id}/participants/{uid}/inscription" }, _optsDecl), async (ev) => {
  const { coach, id, uid } = ev.params;
  const m = (await db.ref("canaux/" + coach + "/messages/" + id).get()).val();
  if (!m || m.type !== "defi" || await _estClos(coach, id)) return;
  const defi = Object.assign({}, m, { id });
  const t = Date.now();
  if (ev.data.after.val()) await _majParticipant(coach, defi, uid, t);
  await _recalculerDefi(coach, defi, t, { sansAnnonce: !ev.data.after.val() });
});

// ── LA TÂCHE DU MATIN : rappel des 48 h, annonces en attente, clôture ─────
async function _cloturer(coach, defi, t) {
  const parts = await _participants(coach, defi);
  for (const p of parts) await _majParticipant(coach, defi, p.cle, t);
  const r = await _recalculerDefi(coach, defi, t, { sansAnnonce: true });
  const g = D.gagnant(r.parts);
  await _publierSysteme(coach, defi, D.textePodium(defi, r.parts), t);
  for (const p of r.parts.filter((x) => x.termine)) {
    await db.ref("defis_resultats/" + p.cle + "/" + defi.id).set({
      titre: String(defi.titre || "").slice(0, 80), mesure: defi.mesure, collectif: !!defi.collectif,
      fin: Number(defi.fin), termineLe: p.termineLe || t, champion: !!(g && g.cle === p.cle), coach });
  }
  const etat = (await _defiRef(coach, defi.id, "etat").get()).val() || {};
  await _defiRef(coach, defi.id, "etat").set(Object.assign({}, etat, { clos: true, closLe: t, dernierSysteme: _paris(t).jour,
    champion: g ? g.cle : null }));
}
async function _coachsAvecCanal() {
  try {
    const jeton = await admin.credential.applicationDefault().getAccessToken();
    const racine = db.ref().toString().replace(/\/$/, "");
    const r = await fetch(racine + "/canaux.json?shallow=true&access_token=" + encodeURIComponent(jeton.access_token));
    if (r.ok) { const d = await r.json(); return d ? Object.keys(d) : []; }
  } catch (e) { /* repli */ }
  return Object.keys((await db.ref("canaux").get()).val() || {});
}
exports.defisQuotidien = onSchedule(Object.assign({ schedule: "0 9 * * *" }, _optsPlanifie), async () => {
  const t = Date.now(), jour = _paris(t).jour;
  for (const coach of await _coachsAvecCanal()) {
    for (const defi of await _defisDuCoach(coach)) {
      const etat = (await _defiRef(coach, defi.id, "etat").get()).val() || {};
      if (etat.clos || t < Number(defi.debut)) continue;
      if (t > Number(defi.fin)) {
        // Un message système est déjà parti aujourd'hui pour ce défi : la
        // clôture attend demain — un par jour, podium compris.
        if (etat.dernierSysteme !== jour) await _cloturer(coach, defi, t);
        continue;
      }
      if (Number(defi.fin) - t <= 48 * 3600e3 && !etat.rappel48) {
        const parts = await _participants(coach, defi);
        for (const p of parts.filter((x) => !x.termine))
          await envoyerPush(p.cle, { type: "defi", url: "./?canal=1", tag: "defi-48h-" + defi.id,
            title: "Plus que 48 h : " + String(defi.titre || "ton défi").slice(0, 60),
            body: "Objectif : " + D.texteObjectif(defi) + ". Tu en es à " + String(p.valeur).replace(".", ",") + "." }, { attendre: false });
        await _defiRef(coach, defi.id, "etat/rappel48").set(true);
      }
      // Les annonces restées en attente (plafond d'un message par jour).
      await _recalculerDefi(coach, defi, t);
    }
  }
});
