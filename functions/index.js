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
  const offre = offreDuPlan(sub.plan_id);
  await ecrireDroits(key, {
    palier: offre.palier,
    echeance: prolonger(actuel && actuel.echeance, offre.mois * MONTH_MS),
    source: "paypal",
    abonnement: subscriptionId,
  });
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
  // planId PayPal            palier         mois
  "P-95N51603RD882780YNJKS2QA": { palier: "essentielle", mois: 1 },
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
  if (o && o.palier) return { palier: palierValide(o.palier), mois: Math.max(1, Number(o.mois) || 1) };
  return { palier: "essentielle", mois: 1 };
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

  const mois = 3;   // OFFRES.boutique_prog.mois, cote application
  const actuel = await lireDroits(cle);
  const droits = await ecrireDroits(cle, {
    palier: "ultime",
    echeance: prolonger(actuel && actuel.echeance, mois * MONTH_MS),
    source: "programme",
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
