// ══ PAYPAL, ÉCOUTÉ PAR LE SERVEUR LÉGER ══════════════════════════════════
//
// « PayPal prélève tout seul, mais rien ne redescend jusqu'à l'application :
// une résiliation, un impayé, une carte qui expire ne changent RIEN ici »
// (écran Accès, 24/09/2026). Ce module est l'oreille qui manquait : PayPal
// appelle /paypal à chaque événement d'abonnement, et le dossier suit.
//
// ⚠ LE MODÈLE EST CELUI DU DOSSIER, pas droits/ (voir metier.js, bonusEssai) :
//   · UNE RÉSILIATION NE COUPE PAS LE JOUR MÊME. Passer paymentStatus à
//     « cancelled » fermerait l'accès à l'instant (_palierHerite). On pose donc
//     accessExpiry à la FIN DE LA PÉRIODE PAYÉE (next_billing_time chez
//     PayPal), plus les mois offerts en réserve : l'accès court jusque-là, puis
//     se ferme de lui-même.
//   · UN PAIEMENT QUI REVIENT (après un impayé) rouvre : la fin posée par ce
//     module est retirée.
//   · LE COACH n'a pas d'échéance dans son dossier : sa fin est notée dans
//     /paypal_fins, et le travail quotidien referme son palier à la date.
//
// ⚠ AUCUN APPEL N'EST CRU SANS VÉRIFICATION : la signature est contrôlée
//   AUPRÈS DE PAYPAL (verify-webhook-signature) avec le corps BRUT reçu — le
//   re-sérialiser fausserait le contrôle. Sans PAYPAL_WEBHOOK_ID, sans secret,
//   ou si PayPal ne répond pas SUCCESS : 401, rien n'est écrit.
//
// SECRETS : PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID. VARIABLE : PAYPAL_CLIENT_ID.

const API = 'https://api-m.paypal.com';
const MOIS_MS = 30 * 864e5;
const cleEmail = (e) => String(e || '').toLowerCase().trim().replace(/\./g, ',');
const net = (s) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);

export async function jetonPaypal(env, fetchImpl) {
  const id = String(env.PAYPAL_CLIENT_ID || '').trim(), secret = String(env.PAYPAL_CLIENT_SECRET || '').trim();
  if (!id || !secret) throw new Error('PayPal non configuré');
  const r = await (fetchImpl || fetch)(API + '/v1/oauth2/token', { method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(id + ':' + secret), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials' });
  if (!r.ok) throw new Error('PayPal OAuth ' + r.status);
  const j = await r.json();
  if (!j.access_token) throw new Error('jeton PayPal absent');
  return j.access_token;
}

// La vérification, avec le corps BRUT inséré tel quel dans la requête.
export async function signatureValide(entetes, brut, env, fetchImpl) {
  const wid = String(env.PAYPAL_WEBHOOK_ID || '').trim();
  if (!wid) return false;
  const h = (k) => entetes.get(k) || '';
  const tete = JSON.stringify({ auth_algo: h('paypal-auth-algo'), cert_url: h('paypal-cert-url'),
    transmission_id: h('paypal-transmission-id'), transmission_sig: h('paypal-transmission-sig'),
    transmission_time: h('paypal-transmission-time'), webhook_id: wid });
  const corps = tete.slice(0, -1) + ',"webhook_event":' + brut + '}';
  try {
    const jeton = await jetonPaypal(env, fetchImpl);
    const r = await (fetchImpl || fetch)(API + '/v1/notifications/verify-webhook-signature', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jeton }, body: corps });
    const j = await r.json();
    return !!(j && j.verification_status === 'SUCCESS');
  } catch (e) { return false; }
}

async function lireAbonnement(id, env, fetchImpl) {
  if (!/^I-[A-Z0-9]{8,}$/.test(id)) return null;
  const jeton = await jetonPaypal(env, fetchImpl);
  const r = await (fetchImpl || fetch)(API + '/v1/billing/subscriptions/' + id, { headers: { Authorization: 'Bearer ' + jeton } });
  return r.ok ? r.json() : null;
}

/**
 * @param {{db:any, M:any, env:any, fetchImpl?:Function, maintenant?:()=>number}} ctx
 */
export function creerPaypal(ctx) {
  const { db, M, env } = ctx;
  const now = ctx.maintenant || (() => Date.now());
  const lire = async (c) => (await db.ref(c).get()).val();

  // À QUI EST CET ÉVÉNEMENT ? L'abonnement d'abord (index posé par l'app à
  // l'approbation), l'adresse du payeur ensuite — si un dossier la porte.
  async function cleDe(ress) {
    const abo = net(ress.billing_agreement_id || (String(ress.id || '').startsWith('I-') ? ress.id : ''));
    if (abo) { const k = await lire('paypal_abonnes/' + abo); if (k) return { cle: k, abo }; }
    const mail = String((ress.subscriber && ress.subscriber.email_address) || (ress.payer && ress.payer.email_address)
      || (ress.payer && ress.payer.payer_info && ress.payer.payer_info.email) || '').toLowerCase().trim();
    if (mail.indexOf('@') > 0) {
      const k = cleEmail(mail);
      if ((await lire('users/' + k + '/role')) !== null) {
        if (abo) await db.ref('paypal_abonnes/' + abo).set(k);
        return { cle: k, abo };
      }
    }
    return { cle: null, abo };
  }

  // LA RÉSILIATION (ou l'impayé, ou la fin) : l'accès court jusqu'à la fin payée.
  async function fermerALaFin(cle, abo, type) {
    const t = now();
    const sub = abo ? await lireAbonnement(abo, env, ctx.fetchImpl).catch(() => null) : null;
    const prochain = sub && sub.billing_info && Date.parse(sub.billing_info.next_billing_time || '');
    const dernier = sub && sub.billing_info && sub.billing_info.last_payment && Date.parse(sub.billing_info.last_payment.time || '');
    // La fin payée : la prochaine échéance si PayPal la donne, sinon un mois
    // après le dernier paiement, sinon maintenant (impayé sans historique).
    let fin = Number(prochain) > t ? Number(prochain) : (Number(dernier) > 0 ? Number(dernier) + MOIS_MS : t);
    const compte = (await lire('parrainage/comptes/' + cle)) || {};
    const reserve = Math.max(0, Number(compte.moisEnReserve) || 0);
    fin += reserve * MOIS_MS;
    const [role, statut] = await Promise.all([lire('users/' + cle + '/role'), lire('users/' + cle + '/status')]);
    const maj = { ['users/' + cle + '/abonnement/statutPaypal']: type, ['users/' + cle + '/abonnement/finAccesPaypal']: fin,
      ['users/' + cle + '/abonnement/resilieLe']: t, ['users/' + cle + '/updatedAt']: t };
    if (reserve) maj['parrainage/comptes/' + cle + '/moisEnReserve'] = 0;
    if (role === 'coach') maj['paypal_fins/' + cle] = { fin, type, le: t };
    else if (statut === 'AUTONOMIE_PREMIUM') maj['users/' + cle + '/accessExpiry'] = fin;
    await db.ref().update(maj);
    return { fin, reserve };
  }

  // LE PAIEMENT : rouvre ce que ce module avait fermé, puis les récompenses
  // du premier paiement (parrain, ambassadeur, statistique « payant »).
  async function paiement(cle, abo, ress, ponctuel) {
    const t = now();
    // UN ACHAT PONCTUEL (programme, révision) ne touche pas à l'abonnement :
    // seules les récompenses du premier paiement le concernent.
    const a = ponctuel ? {} : ((await lire('users/' + cle + '/abonnement')) || {});
    const maj = ponctuel ? {} : { ['users/' + cle + '/abonnement/dernierPaiementLe']: t, ['users/' + cle + '/abonnement/statutPaypal']: 'ACTIVE',
      ['users/' + cle + '/updatedAt']: t };
    if (a.finAccesPaypal) {   // un impayé réglé, ou une résiliation annulée : on rouvre
      maj['users/' + cle + '/abonnement/finAccesPaypal'] = null;
      maj['users/' + cle + '/accessExpiry'] = null;
      maj['users/' + cle + '/paymentStatus'] = 'active';
      maj['paypal_fins/' + cle] = null;
    }
    if (Object.keys(maj).length) await db.ref().update(maj);
    // LE PREMIER PAIEMENT, TOUS ACHATS CONFONDUS : un nœud du serveur seul,
    // pris en transaction — deux événements simultanés ne récompensent pas deux fois.
    const tx = await db.ref('paypal_premiers/' + cle).transaction((v) => (v ? undefined : { le: t, abo: abo || null }));
    const premier = tx.committed;
    if (!premier) return { premier: false };
    const montant = ress.amount && (ress.amount.total || ress.amount.value);
    await M.parrainagePaiement(cle, 'paypal').catch(() => null);
    await M.ambassadeurPaiement(cle, { montant, le: Date.parse(ress.create_time || '') || t, abonnement: abo, venteId: ress.id }).catch(() => null);
    await M.attributionPaiement(cle).catch(() => null);
    return { premier: true };
  }

  async function traiter(evt) {
    const type = String(evt.event_type || '');
    const ress = evt.resource || {};
    if (type === 'PAYMENT.SALE.REFUNDED' || type === 'PAYMENT.CAPTURE.REFUNDED') {
      await M.ambassadeurRemboursement(ress).catch(() => null);
      return 'remboursement';
    }
    const { cle, abo } = await cleDe(ress);
    if (!cle) return 'sans_compte';
    if (type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      await db.ref().update({ ['users/' + cle + '/abonnement/statutPaypal']: 'ACTIVE' });
      return 'active';
    }
    if (type === 'PAYMENT.SALE.COMPLETED' || type === 'PAYMENT.CAPTURE.COMPLETED')
      return (await paiement(cle, abo, ress, type === 'PAYMENT.CAPTURE.COMPLETED')).premier ? 'premier_paiement' : 'paiement';
    if (type === 'BILLING.SUBSCRIPTION.CANCELLED' || type === 'BILLING.SUBSCRIPTION.EXPIRED' || type === 'BILLING.SUBSCRIPTION.SUSPENDED'
        || type === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') {
      if (type === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') return 'echec_note';   // PayPal réessaie ; SUSPENDED suivra s'il faut
      await fermerALaFin(cle, abo, type.split('.').pop());
      return 'fin_posee';
    }
    return 'ignore';
  }

  // LE COACH : son palier se referme à la date (travail quotidien).
  async function finsCoachs() {
    const tout = (await lire('paypal_fins')) || {};
    const t = now();
    for (const cle of Object.keys(tout)) {
      const f = tout[cle];
      if (!f || !(Number(f.fin) <= t)) continue;
      await db.ref().update({ ['users/' + cle + '/coachSubActive']: false, ['users/' + cle + '/coachPlan']: 'libre',
        ['users/' + cle + '/updatedAt']: t, ['paypal_fins/' + cle]: null });
    }
  }

  // L'INDEX abonnement → compte, déposé par l'app à l'approbation (événement
  // « abonnement »). Vérifié chez PayPal : l'abonnement existe et l'adresse du
  // payeur, ou le custom_id, ne contredisent pas le compte qui le réclame.
  async function indexer(cle, id) {
    const abo = net(id);
    if (!/^I-[A-Z0-9]{8,}$/.test(abo)) return 'format';
    const deja = await lire('paypal_abonnes/' + abo);
    if (deja && deja !== cle) return 'deja_a_un_autre';
    const sub = await lireAbonnement(abo, env, ctx.fetchImpl).catch(() => null);
    if (!sub) return 'introuvable';
    await db.ref('paypal_abonnes/' + abo).set(cle);
    return 'indexe';
  }

  return { traiter, finsCoachs, indexer, cleDe, fermerALaFin, paiement };
}

// Le point d'entrée HTTP : /paypal (POST, appelé par PayPal).
export async function recevoirWebhook(req, ctx) {
  const brut = await req.text();
  if (!(await signatureValide(req.headers, brut, ctx.env, ctx.fetchImpl)))
    return new Response('signature refusée', { status: 401 });
  let evt;
  try { evt = JSON.parse(brut); } catch (e) { return new Response('corps illisible', { status: 400 }); }
  // Un même événement renvoyé par PayPal n'est traité qu'une fois.
  const id = net(evt.id);
  if (id) {
    const tx = await ctx.db.ref('paypal_evenements/' + id).transaction((v) => (v ? undefined : { le: Date.now(), type: String(evt.event_type || '') }));
    if (!tx.committed) return new Response('déjà traité', { status: 200 });
  }
  const res = await creerPaypal(ctx).traiter(evt);
  return new Response(res, { status: 200 });
}
