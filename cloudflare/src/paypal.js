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
//     module est retirée — mais seulement si l'abonnement, relu chez PayPal,
//     est ACTIVE et que c'est le courant du dossier (paypalSubscriptionId).
//   · LE COMPTE SE LIT DANS custom_id, posé par l'app à la création de
//     l'abonnement (et de la commande d'un programme) : jamais d'après
//     l'adresse du payeur. Un événement encore sans compte est rangé dans
//     paypal_orphelins, et rejoué dès que le lien est fait.
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
const EN_COURS_MAX_MS = 10 * 60 * 1000;
const PROGRAMME_MS = 3 * MOIS_MS;          // OFFRES.boutique_prog.mois de l'app
const cleEmail = (e) => String(e || '').toLowerCase().trim().replace(/\./g, ',');
const net = (s) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
const centimes = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };

// ══ LES OFFRES QUE PAYPAL ENCAISSE ════════════════════════════════════════
// Le MIROIR de OFFRES et des PAYPAL_PLAN_ID* de l'app (rc-core) : un test
// (paypal.test.mjs) relit l'app et refuse tout écart. Un paiement n'est
// compté comme « premier paiement » (parrain, ambassadeur, statistique) que
// si son plan est ici, en euros, et pour l'un de ces montants.
// ⚠ PLUSIEURS MONTANTS PAR PLAN : un prix qui a changé chez PayPal laisse des
//   abonnés à l'ancien tarif (9,95 puis 9,50 ; 99 puis 114 ; 249 puis 298,80),
//   et le plan « demi » facture 12,45 le premier mois puis 24,90.
export const OFFRES_PAYPAL = Object.freeze({
  'P-95N51603RD882780YNJKS2QA': { formule: 'essentielle', montants: ['9.50', '9.95'] },
  'P-92T09491KF550281RNK2LZWY': { formule: 'essentielle', montants: ['114.00', '99.00'] },
  'P-2W777608239063532NK2LZXA': { formule: 'ultime', montants: ['24.90'] },
  'P-16Y44630WF304553UNK2LZXI': { formule: 'ultime', montants: ['298.80', '249.00'] },
  'P-57P40267XP026613FNK2LZXQ': { formule: 'ultime', montants: ['12.45', '24.90'] },
  'P-9JD300001T4718058NK2RF5Q': { coachPlan: 'coach', montants: ['19.00'] },
  'P-1WS20264K4576284KNK2RF5Y': { coachPlan: 'pro', montants: ['39.00'] },
});
function montantValide(plan, montant, devise, role) {
  if (!plan || String(devise || '').toUpperCase() !== 'EUR') return false;
  if ((role === 'coach') !== !!plan.coachPlan) return false;
  const c = centimes(montant);
  return plan.montants.some((m) => centimes(m) === c);
}

// ══ LE JETON OAUTH, GARDÉ JUSQU'À SON EXPIRATION ══════════════════════════
// Deux sous-requêtes de moins par webhook (le plan gratuit en compte 50 par
// exécution). En mémoire de l'isolat : il vit tant que le worker reste chaud,
// et se redemande sinon. Rendu une minute avant son expiration.
let _jeton = null;          // { cle, valeur, expire }
let _jetonEnVol = null;     // { cle, promesse } : deux appels simultanés, une requête
export function oublierJetonPaypal() { _jeton = null; _jetonEnVol = null; }
export async function jetonPaypal(env, fetchImpl, maintenant) {
  const id = String(env.PAYPAL_CLIENT_ID || '').trim(), secret = String(env.PAYPAL_CLIENT_SECRET || '').trim();
  if (!id || !secret) throw new Error('PayPal non configuré');
  const cle = id + ':' + secret;
  const t = (maintenant || Date.now)();
  if (_jeton && _jeton.cle === cle && _jeton.expire > t) return _jeton.valeur;
  if (_jetonEnVol && _jetonEnVol.cle === cle) return _jetonEnVol.promesse;
  const promesse = (async () => {
    const r = await (fetchImpl || fetch)(API + '/v1/oauth2/token', { method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(id + ':' + secret), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials' });
    if (!r.ok) throw new Error('PayPal OAuth ' + r.status);
    const j = await r.json();
    if (!j.access_token) throw new Error('jeton PayPal absent');
    const duree = Math.max(0, (Number(j.expires_in) || 300) - 60) * 1000;
    _jeton = { cle, valeur: j.access_token, expire: (maintenant || Date.now)() + duree };
    return j.access_token;
  })();
  _jetonEnVol = { cle, promesse };
  try { return await promesse; } finally { if (_jetonEnVol && _jetonEnVol.promesse === promesse) _jetonEnVol = null; }
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

// UNE LECTURE CHEZ PAYPAL : null si l'objet n'existe pas (404), une ERREUR
// sinon — PayPal indisponible n'est pas « introuvable », et l'erreur remonte
// en 500 pour que PayPal renvoie l'événement plus tard.
async function lirePaypal(chemin, env, fetchImpl) {
  const jeton = await jetonPaypal(env, fetchImpl);
  const r = await (fetchImpl || fetch)(API + chemin, { headers: { Authorization: 'Bearer ' + jeton } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('PayPal ' + r.status + ' sur ' + chemin);
  return r.json();
}
const lireAbonnement = (id, env, f) => (/^I-[A-Z0-9]{8,}$/.test(id) ? lirePaypal('/v1/billing/subscriptions/' + id, env, f) : Promise.resolve(null));
const lireCommande = (id, env, f) => (/^[A-Z0-9]{8,40}$/.test(id) ? lirePaypal('/v2/checkout/orders/' + id, env, f) : Promise.resolve(null));
const lireVente = (id, env, f) => (/^[A-Z0-9]{8,40}$/.test(id) ? lirePaypal('/v1/payments/sale/' + id, env, f) : Promise.resolve(null));
const lireCapture = (id, env, f) => (/^[A-Z0-9]{8,40}$/.test(id) ? lirePaypal('/v2/payments/captures/' + id, env, f) : Promise.resolve(null));
const euros = (c) => (Number.isFinite(Number(c)) && c !== null && c !== '' ? (Number(c) / 100).toFixed(2).replace('.', ',') + ' €' : 'montant inconnu');
const dateFr = (t) => new Date(t).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric' });
const CREATEUR = 'guellec,coachingpro@gmail,com';

/**
 * @param {{db:any, M:any, env:any, fetchImpl?:Function, maintenant?:()=>number}} ctx
 */
export function creerPaypal(ctx) {
  const { db, M, env } = ctx;
  const now = ctx.maintenant || (() => Date.now());
  const lire = async (c) => (await db.ref(c).get()).val();
  const abonnement = (id) => lireAbonnement(id, env, ctx.fetchImpl);

  // ── À QUI EST CET ABONNEMENT ? ─────────────────────────────────────────
  // L'index paypal_abonnes d'abord. Sinon, l'abonnement lui-même, lu chez
  // PayPal : l'app le crée avec custom_id = clé du compte. PLUS D'ADRESSE DE
  // PAYEUR : celle du compte PayPal n'a aucune raison d'être celle du compte
  // RepCore, et une coïncidence rattachait l'argent d'un autre.
  async function compteDe(abo) {
    if (!abo) return { cle: null };
    const k = await lire('paypal_abonnes/' + abo);
    if (k) return { cle: k };
    const sub = await abonnement(abo);
    const c = sub && String(sub.custom_id || '');
    if (c && /^[^.#$\[\]\/]+$/.test(c) && (await lire('users/' + c + '/role')) !== null) {
      if (await lier(abo, c)) return { cle: c, sub };
    }
    return { cle: null, sub };
  }

  // RELIER, UNE SEULE FOIS, PUIS REJOUER CE QUI ATTENDAIT. Rendu faux si
  // l'abonnement appartient déjà à un autre compte.
  async function lier(abo, cle) {
    let autre = null;
    const tx = await db.ref('paypal_abonnes/' + abo).transaction((v) => { if (v) { autre = v; return undefined; } return cle; });
    if (!tx.committed && autre !== cle) return false;
    await rejouerOrphelins(abo);
    return true;
  }

  // ── LES ORPHELINS ──────────────────────────────────────────────────────
  // Un événement dont l'abonnement n'est encore relié à aucun compte (le
  // webhook arrive souvent AVANT que l'app ait signalé l'abonnement) est
  // RANGÉ, jamais perdu : paypal_orphelins/<abonnement>/<événement>. Il est
  // rejoué, dans l'ordre de PayPal, dès que le lien est fait.
  async function ranger(abo, evt) {
    const lot = abo || 'sans_abonnement';
    const id = net(evt.id) || ('x' + now());
    await db.ref('paypal_orphelins/' + lot + '/' + id).set({ evt, at: now() });
  }
  async function rejouerOrphelins(abo) {
    const tout = (await lire('paypal_orphelins/' + abo)) || {};
    const liste = Object.keys(tout).map((k) => ({ k, o: tout[k] })).filter((x) => x.o && x.o.evt)
      .sort((a, b) => (Date.parse(a.o.evt.create_time || '') || a.o.at || 0) - (Date.parse(b.o.evt.create_time || '') || b.o.at || 0));
    let n = 0;
    for (const { k, o } of liste) {
      await traiter(o.evt);               // une erreur remonte : le reste attend le prochain passage
      await db.ref('paypal_orphelins/' + abo + '/' + k).remove();
      n++;
    }
    return n;
  }

  // ── droits/<compte>, CE QUE L'APP LIT D'ABORD (27/09/2026) ──────────────
  // Chaque changement (paiement, résiliation, fin, remboursement, achat) y
  // est écrit EN PLUS du dossier : le dossier, son titulaire l'écrit ; ce
  // nœud, seul le créateur (et ce serveur, en administrateur). Les coachs
  // n'en ont pas : leur palier est coachPlan, et l'app ne lit pas droits/
  // pour eux. Un accès posé à la main par le créateur n'est pas réécrit
  // (voir majDroits, metier.js).
  const PALIERS_OUVERTS = ['essentielle', 'ultime', 'suivi'];
  const palierPaye = (x, plan) => (x && x.palier === 'suivi') ? 'suivi'
    : (plan && plan.formule) || (x && PALIERS_OUVERTS.indexOf(String(x.palier)) >= 0 ? String(x.palier) : 'essentielle');
  async function droitsOuverts(cle, abo, plan) {
    return M.majDroits(cle, (x) => ({ palier: palierPaye(x, plan), echeance: 0, source: 'paypal', abo: abo || (x && x.abo) || null }));
  }
  async function droitsJusqua(cle, abo, plan, fin) {
    return M.majDroits(cle, (x) => ({ palier: palierPaye(x, plan), echeance: fin, source: 'paypal', abo: abo || (x && x.abo) || null }));
  }

  // EST-CE L'ABONNEMENT COURANT DU DOSSIER ? Celui que paypalSubscriptionId
  // désigne ; à défaut d'en désigner un (l'app n'a pas encore envoyé le
  // dossier), celui dont PayPal atteste qu'il a été créé pour ce compte.
  const estCourant = (courant, abo, sub, cle) => (courant ? courant === abo : !!(sub && sub.custom_id === cle));

  // ── LA RÉSILIATION (ou la suspension, ou la fin) ───────────────────────
  // L'accès court jusqu'à la fin payée, plus les mois en réserve. La fin ne
  // RECULE JAMAIS : une suspension puis une annulation donnent la même date,
  // réserve comprise. La réserve, elle, n'est PAS remise à zéro ici : elle
  // n'est consommée qu'à la fin effective (fins(), en transaction), et un
  // abonnement qui repart avant garde ses mois.
  async function fermerALaFin(cle, abo, type) {
    const t = now();
    const [role, statut, courant, a, finNotee, compte] = await Promise.all([lire('users/' + cle + '/role'), lire('users/' + cle + '/status'),
      lire('users/' + cle + '/paypalSubscriptionId'), lire('users/' + cle + '/abonnement'), lire('paypal_fins/' + cle), lire('parrainage/comptes/' + cle)]);
    if (courant && abo && courant !== abo) return { ignore: 'ancien_abonnement' };
    const sub = abo ? await abonnement(abo) : null;
    const prochain = sub && sub.billing_info && Date.parse(sub.billing_info.next_billing_time || '');
    const dernier = sub && sub.billing_info && sub.billing_info.last_payment && Date.parse(sub.billing_info.last_payment.time || '');
    // La fin payée : la prochaine échéance si PayPal la donne, sinon un mois
    // après le dernier paiement, sinon maintenant (impayé sans historique).
    const payee = Number(prochain) > t ? Number(prochain) : (Number(dernier) > 0 ? Number(dernier) + MOIS_MS : t);
    const reserve = role === 'coach' ? 0 : Math.max(0, Number(compte && compte.moisEnReserve) || 0);
    const finAvant = Math.max(Number(a && a.finAccesPaypal) || 0, Number(finNotee && finNotee.fin) || 0);
    const calculee = payee + reserve * MOIS_MS;
    const fin = Math.max(finAvant, calculee);
    const reserveComptee = fin === calculee ? reserve : Number(finNotee && finNotee.reserve) || 0;
    const maj = { ['users/' + cle + '/abonnement/statutPaypal']: type, ['users/' + cle + '/abonnement/finAccesPaypal']: fin,
      ['users/' + cle + '/abonnement/resilieLe']: t, ['users/' + cle + '/updatedAt']: t,
      ['paypal_fins/' + cle]: Object.assign({}, finNotee || {}, { fin, type, le: t, role: role === 'coach' ? 'coach' : 'athlete', reserve: reserveComptee, abo: abo || null }) };
    if (role !== 'coach' && statut === 'AUTONOMIE_PREMIUM') maj['users/' + cle + '/accessExpiry'] = fin;
    await db.ref().update(maj);
    if (role !== 'coach') await droitsJusqua(cle, abo, sub && OFFRES_PAYPAL[sub.plan_id], fin);
    return { fin, reserve: reserveComptee };
  }

  // ── LE PAIEMENT D'UN ABONNEMENT ────────────────────────────────────────
  // N'OUVRE QUE SUR PREUVE : l'abonnement, relu chez PayPal, est ACTIVE et
  // c'est le courant du dossier. Un paiement arrivé après une annulation, ou
  // sur un ancien abonnement, ne rouvre rien.
  async function paiementAbonnement(cle, abo, ress, subConnu) {
    const t = now();
    const sub = subConnu || await abonnement(abo);
    const [role, statut, courant, a, finNotee] = await Promise.all([lire('users/' + cle + '/role'), lire('users/' + cle + '/status'),
      lire('users/' + cle + '/paypalSubscriptionId'), lire('users/' + cle + '/abonnement'), lire('paypal_fins/' + cle)]);
    const plan = sub && OFFRES_PAYPAL[sub.plan_id];
    const ouvrir = !!(sub && sub.status === 'ACTIVE' && estCourant(courant, abo, sub, cle));
    if (ouvrir) {
      const b = 'users/' + cle + '/';
      const maj = { [b + 'abonnement/dernierPaiementLe']: t, [b + 'abonnement/statutPaypal']: 'ACTIVE', [b + 'updatedAt']: t,
        [b + 'paymentStatus']: 'active', ['paypal_fins/' + cle]: null };
      if (a && a.finAccesPaypal) {    // un impayé réglé, ou une résiliation annulée : on rouvre
        maj[b + 'abonnement/finAccesPaypal'] = null;
        if (role !== 'coach') maj[b + 'accessExpiry'] = null;
      }
      if (role === 'coach') {
        // LE PALIER PAYÉ REVIENT : une résiliation l'avait refermé (fins()).
        if (plan && plan.coachPlan) { maj[b + 'coachPlan'] = plan.coachPlan; maj[b + 'coachSubActive'] = true; }
      } else if (plan && plan.formule && statut !== 'COACHING_SUIVI') {
        maj[b + 'status'] = 'AUTONOMIE_PREMIUM';
        maj[b + 'abonnement/formule'] = plan.formule;
      }
      await db.ref().update(maj);
      if (role !== 'coach') await droitsOuverts(cle, abo, plan);
      // Les mois offerts ajoutés à une fin qui disparaît retournent en réserve.
      const recules = Number(finNotee && finNotee.moisRecules) || 0;
      if (recules > 0) await db.ref('parrainage/comptes/' + cle + '/moisEnReserve').transaction((n) => (Number(n) || 0) + recules);
    }
    const valide = montantValide(plan, ress.amount && (ress.amount.total || ress.amount.value),
      ress.amount && (ress.amount.currency || ress.amount.currency_code), role);
    const premier = valide ? await premierPaiement(cle, abo, ress) : false;
    await noterTransaction(ress.id, { cle, abo, type: 'abonnement', premier,
      montant: centimes(ress.amount && (ress.amount.total || ress.amount.value)), devise: String((ress.amount && ress.amount.currency) || '') });
    return premier ? 'premier_paiement' : (ouvrir ? 'paiement' : 'paiement_sans_ouverture');
  }

  // ── L'ACHAT D'UN PROGRAMME ─────────────────────────────────────────────
  // Le compte est dans la commande (custom_id = « <clé>|<programme> », posé
  // par l'app), RELUE CHEZ PAYPAL. Le montant doit être le prix de la
  // boutique, en euros, sur la commande comme sur la capture.
  async function achat(evt) {
    const ress = evt.resource || {};
    const rel = ress.supplementary_data && ress.supplementary_data.related_ids;
    const idCommande = String((rel && rel.order_id) || '');
    const commande = idCommande ? await lireCommande(idCommande, env, ctx.fetchImpl) : null;
    const pu = commande && Array.isArray(commande.purchase_units) ? commande.purchase_units[0] : null;
    const [cle, prog] = String((pu && pu.custom_id) || '').split('|');
    if (!pu || !cle || /[.#$\[\]\/]/.test(cle) || (await lire('users/' + cle + '/role')) === null) {
      await ranger('commande_' + (net(idCommande) || 'inconnue'), evt);
      return 'orphelin';
    }
    const prixCts = prog && !/[.#$\[\]\/]/.test(prog) ? await lire('boutique/' + prog + '/prixCts') : null;
    const role = await lire('users/' + cle + '/role');
    const devise = (x) => String((x && x.currency_code) || '').toUpperCase();
    const valide = role !== 'coach' && Number.isFinite(Number(prixCts)) && Number(prixCts) > 0
      && devise(pu.amount) === 'EUR' && devise(ress.amount) === 'EUR'
      && centimes(pu.amount.value) === Number(prixCts) && centimes(ress.amount.value) === Number(prixCts);
    const premier = valide ? await premierPaiement(cle, null, ress) : false;
    // LE PROGRAMME OUVRE ULTIME TROIS MOIS, par-dessus le palier de
    // l'abonnement (ultimeJusqu), sans le remplacer.
    if (valide) {
      const t = now();
      await M.majDroits(cle, (x) => ({ palier: (x && x.palier) || 'aucun', echeance: Number(x && x.echeance) || 0, source: (x && x.source) || 'paypal',
        ultimeJusqu: Math.max(Number(x && x.ultimeJusqu) || 0, t) + PROGRAMME_MS }));
    }
    await noterTransaction(ress.id, { cle, prog: prog || null, commande: idCommande, type: 'programme', premier,
      montant: centimes(ress.amount && ress.amount.value), devise: String((ress.amount && ress.amount.currency_code) || '') });
    if (!valide) return 'achat_non_compte';
    return premier ? 'premier_paiement' : 'paiement';
  }

  // ── LE REGISTRE DES ENCAISSEMENTS ──────────────────────────────────────
  // paypal_transactions/<vente ou capture> : à qui, combien, et si c'était le
  // premier paiement du compte. C'est ce qu'un remboursement ou un litige
  // relit pour savoir quoi reprendre — PayPal ne le redit pas.
  async function noterTransaction(id, rec) {
    const k = net(id);
    if (!k) return;
    await db.ref('paypal_transactions/' + k).update(Object.assign({ le: now() }, rec));
  }

  // LE PREMIER PAIEMENT, TOUS ACHATS CONFONDUS : un nœud du serveur seul,
  // pris en transaction — deux événements simultanés ne récompensent pas deux fois.
  async function premierPaiement(cle, abo, ress) {
    const t = now();
    const tx = await db.ref('paypal_premiers/' + cle).transaction((v) => (v ? undefined : { le: t, abo: abo || null, vente: net(ress.id) || null }));
    if (!tx.committed) return false;
    const montant = ress.amount && (ress.amount.total || ress.amount.value);
    await M.parrainagePaiement(cle, 'paypal').catch(() => null);
    await M.ambassadeurPaiement(cle, { montant, le: Date.parse(ress.create_time || '') || t, abonnement: abo, venteId: ress.id }).catch(() => null);
    await M.attributionPaiement(cle).catch(() => null);
    return true;
  }

  async function traiter(evt) {
    const type = String(evt.event_type || '');
    const ress = evt.resource || {};
    if (type === 'PAYMENT.SALE.REFUNDED' || type === 'PAYMENT.CAPTURE.REFUNDED') return rembourse(evt);
    if (type === 'PAYMENT.SALE.REVERSED') return retrofacture(evt);
    if (type === 'CUSTOMER.DISPUTE.CREATED') return litigeOuvert(evt);
    if (type === 'CUSTOMER.DISPUTE.RESOLVED') return litigeClos(evt);
    if (type === 'PAYMENT.CAPTURE.COMPLETED') return achat(evt);
    const abo = net(ress.billing_agreement_id || (String(ress.id || '').startsWith('I-') ? ress.id : ''));
    const connus = ['BILLING.SUBSCRIPTION.ACTIVATED', 'PAYMENT.SALE.COMPLETED', 'BILLING.SUBSCRIPTION.CANCELLED',
      'BILLING.SUBSCRIPTION.EXPIRED', 'BILLING.SUBSCRIPTION.SUSPENDED', 'BILLING.SUBSCRIPTION.PAYMENT.FAILED'];
    if (connus.indexOf(type) < 0) return 'ignore';
    const { cle, sub } = await compteDe(abo);
    if (!cle) { await ranger(abo, evt); return 'orphelin'; }
    if (type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const courant = await lire('users/' + cle + '/paypalSubscriptionId');
      if (!estCourant(courant, abo, sub || ress, cle)) return 'ancien_abonnement';
      await db.ref().update({ ['users/' + cle + '/abonnement/statutPaypal']: 'ACTIVE' });
      // L'ACCÈS S'OUVRE DÈS L'ACTIVATION, sans attendre le paiement qui suit :
      // l'app ne donne plus l'abonnement sur la foi du dossier.
      const s2 = sub || ress;
      if (s2.status === 'ACTIVE' && (await lire('users/' + cle + '/role')) !== 'coach') await droitsOuverts(cle, abo, OFFRES_PAYPAL[s2.plan_id]);
      return 'active';
    }
    if (type === 'PAYMENT.SALE.COMPLETED') return paiementAbonnement(cle, abo, ress, sub);
    if (type === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') return 'echec_note';   // PayPal réessaie ; SUSPENDED suivra s'il faut
    const r = await fermerALaFin(cle, abo, type.split('.').pop());
    return r.ignore || 'fin_posee';
  }

  // ══ REMBOURSEMENTS, RÉTROFACTURATIONS, LITIGES ══════════════════════════
  //
  // CE QUI EST REPRIS, ET QUAND :
  //   · remboursement TOTAL, rétrofacturation, litige PERDU : la commission de
  //     l'ambassadeur est « annulée ». Et si c'était le PREMIER paiement du
  //     compte : le mois offert au parrain est repris (ou devient une dette),
  //     l'état « payant » de l'attribution est retiré, et l'accès du remboursé
  //     se ferme à la date du remboursement ;
  //   · remboursement PARTIEL : la commission seule, au prorata ;
  //   · litige ouvert : commission « suspendue » ; gagné : rétablie, rien d'autre.
  // Chaque cas laisse une ligne dans paypal_journal (écran Ambassadeurs de
  // l'administrateur) : qui, quoi, pourquoi, et ce qui a été fait. Chaque
  // litige, ouvert ou clos, envoie un push à l'administrateur.
  //
  // IDEMPOTENT PAR TRANSACTION : une rétrofacturation suit souvent un litige
  // perdu, et les deux annoncent la même chose. La seconde ne refait rien.

  // La transaction d'origine, depuis le registre ; à défaut (paiement d'avant
  // le registre), relue chez PayPal. null si elle reste inconnue.
  async function origine(id, genre) {
    const k = net(id);
    if (!k) return null;
    const rec = await lire('paypal_transactions/' + k);
    if (rec && rec.cle) return Object.assign({ id: k }, rec);
    let cle = null, abo = null, prog = null, montant = NaN, devise = '', le = 0, type = 'abonnement';
    const v = genre !== 'capture' ? await lireVente(k, env, ctx.fetchImpl) : null;
    if (v) {
      abo = net(v.billing_agreement_id); montant = centimes(v.amount && v.amount.total);
      devise = String((v.amount && v.amount.currency) || ''); le = Date.parse(v.create_time || '') || 0;
      if (abo) cle = await lire('paypal_abonnes/' + abo);
    } else {
      const c = genre !== 'vente' ? await lireCapture(k, env, ctx.fetchImpl) : null;
      if (!c) return null;
      type = 'programme';
      montant = centimes(c.amount && c.amount.value); devise = String((c.amount && c.amount.currency_code) || '');
      le = Date.parse(c.create_time || '') || 0;
      const rel = c.supplementary_data && c.supplementary_data.related_ids;
      const cmd = rel && rel.order_id ? await lireCommande(String(rel.order_id), env, ctx.fetchImpl) : null;
      const pu = cmd && Array.isArray(cmd.purchase_units) ? cmd.purchase_units[0] : null;
      [cle, prog] = String((pu && pu.custom_id) || '').split('|');
      if (!cle || /[.#$\[\]\/]/.test(cle)) cle = null;
    }
    if (!cle) return null;
    // Était-ce le premier ? Le registre des premiers le dit depuis qu'il note
    // la vente ; avant, par l'abonnement et la date (deux jours d'écart au plus).
    const p = await lire('paypal_premiers/' + cle);
    const premier = !!(p && (p.vente ? p.vente === k : (String(p.abo || '') === String(abo || '') && Math.abs((Number(p.le) || 0) - le) < 2 * 864e5)));
    const out = { cle, abo: abo || null, prog: prog || null, type, premier, montant, devise, le };
    await noterTransaction(k, out);
    return Object.assign({ id: k }, out);
  }

  const journal = (ligne) => db.ref('paypal_journal').push().set(Object.assign({ le: now() }, ligne));
  const qui = (cle) => String(cle || '').replace(/,/g, '.');

  // L'ACCÈS DU REMBOURSÉ, fermé à la date du remboursement.
  async function fermerAcces(rec, t) {
    const b = 'users/' + rec.cle + '/';
    if (rec.type === 'programme') {
      if (rec.prog && (await lire(b + 'programmesAchetes/' + rec.prog)) !== null) {
        await db.ref().update({ [b + 'programmesAchetes/' + rec.prog + '/ouvertJusqu']: t, [b + 'updatedAt']: t });
      }
      const d = await M.majDroits(rec.cle, (x) => (x && Number(x.ultimeJusqu) > t ? { ultimeJusqu: t } : null));
      return (d || rec.prog) ? 'programme fermé au ' + dateFr(t) : null;
    }
    const [role, statut] = await Promise.all([lire(b + 'role'), lire(b + 'status')]);
    const maj = { [b + 'abonnement/statutPaypal']: 'REMBOURSE', [b + 'abonnement/finAccesPaypal']: t, [b + 'updatedAt']: t,
      ['paypal_fins/' + rec.cle]: null };
    if (role === 'coach') { maj[b + 'coachPlan'] = 'libre'; maj[b + 'coachSubActive'] = false; }
    else if (statut === 'AUTONOMIE_PREMIUM') maj[b + 'accessExpiry'] = t;
    await db.ref().update(maj);
    if (role !== 'coach') await M.majDroits(rec.cle, (x) => ({ palier: (x && x.palier) || 'aucun', echeance: t, source: 'paypal', abo: rec.abo || (x && x.abo) || null }));
    return (role === 'coach' ? 'palier coach refermé' : 'accès fermé') + ' au ' + dateFr(t);
  }

  // L'ANNULATION D'UNE TRANSACTION (total, rétrofacturation, litige perdu).
  async function annuler(rec, quoi, pourquoi, extra) {
    const t = now();
    const garde = await db.ref('paypal_transactions/' + rec.id + '/annuleLe').transaction((v) => (v ? undefined : t));
    if (!garde.committed) return 'deja_annule';
    const actions = [];
    const c = await M.commissionVente(rec.id, 'annuler');
    if (c) actions.push('commission ' + c.code + ' annulée (' + euros(Math.round(c.avant * 100)) + ')' + (c.dejaPayee ? ' — déjà versée, à reprendre' : ''));
    if (rec.premier) {
      const m = await M.retirerMoisOffert(rec.cle, t);
      if (m) actions.push({ reserve_retiree: 'mois offert retiré de la réserve de ', mois_retire: 'mois offert retiré de l’accès de ',
        dette: 'mois offert déjà consommé : dette d’un mois pour ', rien: 'aucun mois à reprendre pour ' }[m.resultat] + qui(m.parrain));
      if (await M.annulerAttribution(rec.cle, t)) actions.push('état « payant » retiré de l’attribution');
      const a = await fermerAcces(rec, t);
      if (a) actions.push(a);
      await db.ref('paypal_premiers/' + rec.cle).remove();
    }
    if (!actions.length) actions.push('rien à reprendre');
    await journal(Object.assign({ quoi, qui: qui(rec.cle), transaction: rec.id, montant: euros(rec.montant), premier: !!rec.premier,
      pourquoi: String(pourquoi || '').slice(0, 300), actions }, extra || {}));
    return quoi;
  }

  async function rembourse(evt) {
    const ress = evt.resource || {};
    const capture = evt.event_type === 'PAYMENT.CAPTURE.REFUNDED';
    let id = String(ress.sale_id || '');
    if (!id && Array.isArray(ress.links)) {
      const up = ress.links.find((l) => l && l.rel === 'up');
      if (up && up.href) id = String(up.href).split('/').pop();
    }
    const rec = await origine(id, capture ? 'capture' : 'vente');
    const montant = centimes(ress.amount && (ress.amount.total || ress.amount.value));
    const pourquoi = ress.note_to_payer || ress.reason || ress.description || '';
    if (!rec) { await journal({ quoi: 'remboursement_inconnu', transaction: net(id), montant: euros(montant), pourquoi, actions: ['transaction introuvable : rien de repris'] }); return 'remboursement_inconnu'; }
    // Le cumul des remboursements de cette transaction décide total ou partiel.
    const ref = net(ress.id) || ('r' + now());
    await db.ref('paypal_transactions/' + rec.id + '/rembourses/' + ref).set(montant);
    const deja = (await lire('paypal_transactions/' + rec.id + '/rembourses')) || {};
    const cumul = Object.values(deja).reduce((a, b) => a + (Number(b) || 0), 0);
    if (Number.isFinite(rec.montant) && cumul < rec.montant) {
      const c = await M.commissionVente(rec.id, 'prorata', { ref, montant: montant / 100 });
      await journal({ quoi: 'remboursement_partiel', qui: qui(rec.cle), transaction: rec.id, montant: euros(montant), pourquoi,
        actions: [c ? 'commission ' + c.code + ' ramenée de ' + euros(Math.round(c.avant * 100)) + ' à ' + euros(Math.round(c.apres * 100))
          : 'aucune commission sur cette vente', 'accès et parrainage inchangés'] });
      return 'remboursement_partiel';
    }
    return annuler(rec, 'remboursement', pourquoi, { rembourse: euros(cumul) });
  }

  async function retrofacture(evt) {
    const ress = evt.resource || {};
    const id = String(ress.sale_id || ress.id || '');
    const rec = await origine(id, 'vente');
    const pourquoi = ress.reason_code || ress.reason || 'rétrofacturation';
    if (!rec) { await journal({ quoi: 'retrofacturation_inconnue', transaction: net(id), pourquoi, actions: ['transaction introuvable : rien de repris'] }); return 'retrofacturation_inconnue'; }
    // Une rétrofacturation PARTIELLE se traite comme un litige perdu pour une
    // partie : même clé (« contestation »), pour ne pas déduire deux fois le
    // même argent quand PayPal annonce les deux.
    const montant = Math.abs(centimes(ress.amount && (ress.amount.total || ress.amount.value)));
    if (Number.isFinite(montant) && montant > 0 && Number.isFinite(rec.montant) && montant < rec.montant) {
      const c = await M.commissionVente(rec.id, 'prorata', { ref: 'contestation', montant: montant / 100 });
      await journal({ quoi: 'retrofacturation_partielle', qui: qui(rec.cle), transaction: rec.id, montant: euros(montant), pourquoi,
        actions: [c ? 'commission ' + c.code + ' ramenée à ' + euros(Math.round(c.apres * 100)) : 'aucune commission sur cette vente'] });
      return 'retrofacturation_partielle';
    }
    return annuler(rec, 'retrofacturation', pourquoi);
  }

  const transactionsDuLitige = (ress) => (Array.isArray(ress.disputed_transactions) ? ress.disputed_transactions : [])
    .map((x) => net(x && (x.seller_transaction_id || x.transaction_id))).filter(Boolean);
  const pousserAdmin = (titre, corps, id) => M.envoyerPush(CREATEUR, { type: 'admin', url: './?paiements=1', tag: 'litige-' + id,
    title: titre, body: corps }, { urgent: true }).catch(() => null);

  async function litigeOuvert(evt) {
    const ress = evt.resource || {};
    const lid = net(ress.dispute_id || ress.id);
    const montant = centimes(ress.dispute_amount && ress.dispute_amount.value);
    const pourquoi = String(ress.reason || '').replace(/_/g, ' ').toLowerCase();
    const actions = [], gens = [];
    for (const id of transactionsDuLitige(ress)) {
      const rec = await origine(id);
      if (rec) gens.push(qui(rec.cle));
      const c = await M.commissionVente(id, 'suspendre');
      actions.push(c ? 'commission ' + c.code + ' suspendue (' + euros(Math.round(c.avant * 100)) + ')' : 'transaction ' + id + ' : aucune commission');
    }
    await journal({ quoi: 'litige_ouvert', qui: gens.join(', ') || null, litige: lid, montant: euros(montant), pourquoi, actions: actions.length ? actions : ['aucune transaction reconnue'] });
    await pousserAdmin('Litige PayPal ouvert : ' + euros(montant), (gens.join(', ') || 'client inconnu') + (pourquoi ? ' · ' + pourquoi : ''), lid);
    return 'litige_ouvert';
  }

  async function litigeClos(evt) {
    const ress = evt.resource || {};
    const lid = net(ress.dispute_id || ress.id);
    const issue = String((ress.dispute_outcome && ress.dispute_outcome.outcome_code) || '');
    const perdu = issue === 'RESOLVED_BUYER_FAVOUR' || issue === 'ACCEPTED';
    const rendu = centimes(ress.dispute_outcome && ress.dispute_outcome.amount_refunded && ress.dispute_outcome.amount_refunded.value);
    const pourquoi = issue.replace(/_/g, ' ').toLowerCase() || 'clos';
    const gens = [], resultats = [];
    for (const id of transactionsDuLitige(ress)) {
      const rec = await origine(id);
      if (rec) gens.push(qui(rec.cle));
      if (!perdu) {
        const c = await M.commissionVente(id, 'retablir');
        await journal({ quoi: 'litige_gagne', qui: rec ? qui(rec.cle) : null, litige: lid, transaction: id, pourquoi,
          actions: [c ? 'commission ' + c.code + ' rétablie' : 'rien à rétablir'] });
        resultats.push('gagne');
      } else if (rec && Number.isFinite(rendu) && Number.isFinite(rec.montant) && rendu > 0 && rendu < rec.montant) {
        // Perdu pour une partie seulement : comme un remboursement partiel.
        await M.commissionVente(id, 'retablir');
        const c = await M.commissionVente(id, 'prorata', { ref: 'contestation', montant: rendu / 100 });
        await journal({ quoi: 'litige_perdu_partiel', qui: qui(rec.cle), litige: lid, transaction: id, montant: euros(rendu), pourquoi,
          actions: [c ? 'commission ' + c.code + ' ramenée à ' + euros(Math.round(c.apres * 100)) : 'aucune commission sur cette vente'] });
        resultats.push('perdu_partiel');
      } else if (rec) {
        resultats.push(await annuler(rec, 'litige_perdu', pourquoi, { litige: lid }));
      } else {
        await journal({ quoi: 'litige_perdu', litige: lid, transaction: id, pourquoi, actions: ['transaction introuvable : rien de repris'] });
      }
    }
    await pousserAdmin('Litige PayPal ' + (perdu ? 'perdu' : 'clos en ta faveur'), (gens.join(', ') || 'client inconnu') + ' · ' + pourquoi, lid);
    return perdu ? 'litige_perdu' : 'litige_gagne';
  }

  // ── LES FINS ATTEINTES (travail quotidien) ─────────────────────────────
  // Le coach : son palier se referme. L'athlète : son accès se ferme tout
  // seul (accessExpiry) ; ici, les mois de réserve comptés dans cette fin
  // sont enfin consommés — en transaction, sans toucher à ceux gagnés depuis.
  async function fins() {
    const tout = (await lire('paypal_fins')) || {};
    const t = now();
    for (const cle of Object.keys(tout)) {
      const f = tout[cle];
      if (!f || !(Number(f.fin) <= t)) continue;
      const role = f.role || 'coach';          // les entrées d'avant ne portaient que les coachs
      if (role === 'coach') {
        await db.ref().update({ ['users/' + cle + '/coachSubActive']: false, ['users/' + cle + '/coachPlan']: 'libre',
          ['users/' + cle + '/updatedAt']: t });
      } else if (Number(f.reserve) > 0) {
        const r = Number(f.reserve);
        await db.ref('parrainage/comptes/' + cle + '/moisEnReserve').transaction((n) => Math.max(0, (Number(n) || 0) - r));
      }
      await db.ref('paypal_fins/' + cle).remove();
    }
  }

  // L'INDEX abonnement → compte, déposé par l'app à l'approbation (événement
  // « abonnement »). Vérifié chez PayPal : l'abonnement doit avoir été CRÉÉ
  // pour ce compte (custom_id). Ceux d'avant le custom_id sont reliés si
  // l'adresse de l'abonné est celle du compte, et à cette seule condition.
  async function indexer(cle, id) {
    const abo = net(id);
    if (!/^I-[A-Z0-9]{8,}$/.test(abo)) return 'format';
    const deja = await lire('paypal_abonnes/' + abo);
    if (deja && deja !== cle) return 'deja_a_un_autre';
    const sub = await abonnement(abo);
    if (!sub) return 'introuvable';
    if (sub.custom_id) { if (sub.custom_id !== cle) return 'autre_compte'; }
    else if (cleEmail(sub.subscriber && sub.subscriber.email_address) !== cle) return 'non_verifie';
    if (!(await lier(abo, cle))) return 'deja_a_un_autre';
    return 'indexe';
  }

  return { traiter, fins, finsCoachs: fins, indexer, fermerALaFin, rejouerOrphelins };
}

// ══ LE POINT D'ENTRÉE HTTP : /paypal (POST, appelé par PayPal) ═══════════
// L'IDEMPOTENCE TIENT EN DEUX ÉCRITURES. paypal_evenements/<id> passe à
// « en_cours » AVANT le traitement, et à « fait » APRÈS son succès seulement.
//   · un renvoi d'un événement « fait » : 200, rien ne se refait ;
//   · un renvoi pendant qu'il est « en_cours » depuis moins de dix minutes :
//     503, PayPal renverra plus tard ;
//   · un « en_cours » plus vieux (le worker est mort en route) est repris ;
//   · une erreur : l'état passe à « erreur », réponse 500, et PayPal renvoie.
export async function recevoirWebhook(req, ctx) {
  const now = ctx.maintenant || (() => Date.now());
  const brut = await req.text();
  if (!(await signatureValide(req.headers, brut, ctx.env, ctx.fetchImpl)))
    return new Response('signature refusée', { status: 401 });
  let evt;
  try { evt = JSON.parse(brut); } catch (e) { return new Response('corps illisible', { status: 400 }); }
  const id = net(evt.id);
  const type = String(evt.event_type || '').slice(0, 80);
  const ref = id ? ctx.db.ref('paypal_evenements/' + id) : null;
  if (ref) {
    const t = now();
    let vu = null;
    const tx = await ref.transaction((v) => {
      vu = v;
      if (v && (v.etat === 'fait' || !v.etat)) return undefined;              // sans état : l'ancien format, traité
      if (v && v.etat === 'en_cours' && t - (Number(v.at) || 0) < EN_COURS_MAX_MS) return undefined;
      return { etat: 'en_cours', at: t, type, essais: ((v && Number(v.essais)) || 0) + 1 };
    });
    if (!tx.committed) {
      if (vu && vu.etat === 'en_cours') return new Response('en cours', { status: 503 });
      return new Response('déjà traité', { status: 200 });
    }
  }
  let res;
  try {
    res = await creerPaypal(ctx).traiter(evt);
  } catch (e) {
    if (ref) await ref.set({ etat: 'erreur', at: now(), type, erreur: String((e && e.message) || e).slice(0, 200) }).catch(() => {});
    return new Response('erreur', { status: 500 });
  }
  if (ref) await ref.set({ etat: 'fait', at: now(), type, res: String(res).slice(0, 40) });
  return new Response(String(res), { status: 200 });
}
