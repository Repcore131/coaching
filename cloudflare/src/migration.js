// ══ LE RATTRAPAGE DES ABONNÉS D'AVANT (ponctuel, 27/09/2026) ═════════════
//
// Deux registres du serveur léger n'existaient pas quand les premiers
// abonnés ont payé :
//   · paypal_premiers/<compte> : sans lui, un ancien payeur passe pour neuf —
//     il pourrait encore entrer un code parrain, et son prochain paiement
//     offrirait un mois à ce parrain (dejaPaye, premierPaiement) ;
//   · droits/<compte> : depuis que l'app ne croit plus l'abonnement écrit
//     dans le dossier, un abonné sans nœud trouverait l'accès fermé.
//
// RIEN N'EST CRU SUR LA FOI DU DOSSIER. Chaque abonnement est relu chez
// PayPal et n'est retenu que s'il appartient bien au compte : custom_id,
// adresse de l'abonné, ou index déjà posé par le serveur. Chaque programme,
// par sa commande, relue elle aussi. Ce qui existe déjà n'est pas réécrit.
//
// Rend { maj, rapport } : `maj` est une écriture multi-chemins, que le
// script n'applique qu'avec --ecrire (scripts/remplir-paiements.mjs).
import { OFFRES_PAYPAL, jetonPaypal } from './paypal.js';

const API = 'https://api-m.paypal.com';
const MOIS_MS = 30 * 864e5;
const cleEmail = (e) => String(e || '').toLowerCase().trim().replace(/\./g, ',');

export async function planifierMigration({ db, env, fetchImpl, maintenant, journal }) {
  const F = fetchImpl || fetch;
  const t = (maintenant || Date.now)();
  const dire = journal || (() => {});
  const lire = async (c) => (await db.ref(c).get()).val();
  const lirePaypal = async (chemin) => {
    const r = await F(API + chemin, { headers: { Authorization: 'Bearer ' + (await jetonPaypal(env, F)) } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('PayPal ' + r.status + ' sur ' + chemin);
    return r.json();
  };
  const [cles, index, premiers] = await Promise.all([db.ref('users').shallow(), lire('paypal_abonnes'), lire('paypal_premiers')]);
  const parCompte = {};
  for (const [abo, c] of Object.entries(index || {})) (parCompte[c] = parCompte[c] || new Set()).add(abo);
  const maj = {};
  const rapport = { comptes: 0, premiers: 0, droits: 0, index: 0, programmes: 0, refuses: [] };
  for (const cle of cles) {
    const [role, sid, achats, droits] = await Promise.all([lire('users/' + cle + '/role'), lire('users/' + cle + '/paypalSubscriptionId'),
      lire('users/' + cle + '/programmesAchetes'), lire('droits/' + cle)]);
    const abos = new Set(parCompte[cle] || []);
    if (/^I-[A-Z0-9]{8,}$/.test(String(sid || ''))) abos.add(String(sid));
    if (!abos.size && !(achats && typeof achats === 'object')) continue;
    rapport.comptes++;
    let premier = (premiers || {})[cle] || null;
    let d = droits ? Object.assign({}, droits) : null;
    const courant = String(sid || '');
    for (const abo of abos) {
      const sub = await lirePaypal('/v1/billing/subscriptions/' + abo);
      if (!sub) { rapport.refuses.push(cle + ' ' + abo + ' : introuvable chez PayPal'); continue; }
      const aLui = sub.custom_id === cle || cleEmail(sub.subscriber && sub.subscriber.email_address) === cle || (index || {})[abo] === cle;
      if (!aLui) { rapport.refuses.push(cle + ' ' + abo + ' : l’abonnement ne lui appartient pas'); continue; }
      if (!(index || {})[abo]) { maj['paypal_abonnes/' + abo] = cle; rapport.index++; }
      const bi = sub.billing_info || {};
      const execs = Array.isArray(bi.cycle_executions) ? bi.cycle_executions : [];
      const paye = !!bi.last_payment || execs.some((x) => Number(x && x.cycles_completed) > 0);
      if (paye && !premier) {
        premier = { le: Date.parse((bi.last_payment && bi.last_payment.time) || sub.start_time || '') || t, abo, source: 'migration' };
        maj['paypal_premiers/' + cle] = premier; rapport.premiers++;
      }
      // droits/ : pour l'abonnement COURANT seulement, et s'il n'y a rien.
      if (role !== 'coach' && !droits && (!courant || courant === abo)) {
        const plan = OFFRES_PAYPAL[sub.plan_id];
        const palier = (plan && plan.formule) || 'essentielle';
        const prochain = Date.parse(bi.next_billing_time || '') || 0;
        if (sub.status === 'ACTIVE') d = { palier, echeance: 0, source: 'paypal', abo, maj: t };
        else if (prochain > t) d = { palier, echeance: prochain, source: 'paypal', abo, maj: t };
      }
    }
    // LES PROGRAMMES : chaque commande relue, au compte (custom_id) ou à l'adresse du payeur.
    for (const [prog, a] of Object.entries(achats && typeof achats === 'object' ? achats : {})) {
      const ordre = String((a && a.ordre) || '');
      if (!/^[A-Z0-9]{8,40}$/.test(ordre) || !(Number(a.prixCts) > 0)) continue;
      const cmd = await lirePaypal('/v2/checkout/orders/' + ordre);
      const pu = cmd && Array.isArray(cmd.purchase_units) ? cmd.purchase_units[0] : null;
      const payeur = cleEmail(cmd && cmd.payer && cmd.payer.email_address);
      const custom = String((pu && pu.custom_id) || '');
      const aLui = custom === cle + '|' + prog || ((custom === prog || !custom) && payeur === cle);
      if (!cmd || cmd.status !== 'COMPLETED' || !aLui) { rapport.refuses.push(cle + ' programme ' + prog + ' : commande ' + ordre + ' non vérifiée'); continue; }
      if (!premier) { premier = { le: Number(a.le) || t, abo: null, source: 'migration' }; maj['paypal_premiers/' + cle] = premier; rapport.premiers++; }
      const fin = Math.min(Number(a.ouvertJusqu) || 0, (Number(a.le) || t) + 3 * MOIS_MS);
      if (fin > t && role !== 'coach' && !(droits && Number(droits.ultimeJusqu) >= fin)) {
        d = Object.assign({ palier: 'aucun', echeance: 0, source: 'paypal', maj: t }, d || {}, { ultimeJusqu: Math.max(fin, Number(d && d.ultimeJusqu) || 0) });
        rapport.programmes++;
      }
    }
    if (d && JSON.stringify(d) !== JSON.stringify(droits)) { maj['droits/' + cle] = d; rapport.droits++; }
    dire(cle);
  }
  return { maj, rapport };
}

// ══ LE RATTRAPAGE DES DROITS ET DU REGISTRE DES COACHS (30/09/2026) ═══════
//
// Avant que l'app ne lise plus QUE droits/ et coachs_registre/
// (reglages_publics/droitsServeur/v = 2), il faut que ceux qui y ont droit y
// soient. planifierMigration couvre les abonnés PayPal (relus chez PayPal) ;
// ceci couvre le reste :
//   · coachs_registre/<clé> pour chaque coach RÉEL : role 'coach' ET au moins
//     un athlète qui le désigne, ou un code émis (ou tous les dossiers coach,
//     avec tousCoachs). Son plan payant n'est retenu que si PayPal atteste un
//     abonnement ACTIVE à un plan coach ; sinon 'libre'.
//   · droits/<clé> 'suivi' pour chaque athlète COACHING_SUIVI dont un code
//     CONSOMMÉ par lui existe, émis par un coach retenu ci-dessus (ou le
//     créateur). L'échéance : son accessExpiry s'il en a un à venir, plafonnée
//     à 12 mois pour un code d'affilié ; un accès passé ne se rouvre pas.
// Ce qui existe déjà n'est pas écrasé : un palier payé en cours garde sa
// place, le suivi passe par-dessus (suiviJusqu).
const CLE_CREATEUR = 'guellec,coachingpro@gmail,com';
export async function planifierDroitsCoachs({ db, env, fetchImpl, maintenant, journal, tousCoachs, droitsDeja }) {
  const F = fetchImpl || fetch;
  const t = (maintenant || Date.now)();
  const dire = journal || (() => {});
  const lire = async (c) => (await db.ref(c).get()).val();
  const lirePaypal = async (chemin) => {
    const r = await F(API + chemin, { headers: { Authorization: 'Bearer ' + (await jetonPaypal(env, F)) } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('PayPal ' + r.status + ' sur ' + chemin);
    return r.json();
  };
  const [cles, codes, registre] = await Promise.all([db.ref('users').shallow(), lire('rc_codes'), lire('coachs_registre')]);
  const dossiers = {};
  for (const cle of cles) {
    const champs = ['role', 'status', 'coachEmailKey', 'accessExpiry', 'coachPlan', 'paypalSubscriptionId', 'essai'];
    const v = await Promise.all(champs.map((c) => lire('users/' + cle + '/' + c)));
    dossiers[cle] = Object.fromEntries(champs.map((c, i) => [c, v[i]]));
  }
  // Qui est désigné comme coach, qui a émis un code, qui a consommé quoi.
  const designe = new Set(), emetteurs = new Set(), consommes = {};
  for (const d of Object.values(dossiers)) if (d.coachEmailKey) designe.add(String(d.coachEmailKey));
  for (const c of Object.values(codes || {})) {
    if (!c || typeof c !== 'object') continue;
    const k = String(c.coachEmailKey || cleEmail(c.coachEmail));
    if (k) emetteurs.add(k);
    if (c.redeemed === true && c.athleteEmail && (c.type || 'athlete') === 'athlete') (consommes[cleEmail(c.athleteEmail)] = consommes[cleEmail(c.athleteEmail)] || []).push(c);
  }
  const maj = {};
  const rapport = { coachs: 0, coachsPayants: 0, coachsEcartes: [], suivis: 0, suivisSansCode: [], essais: 0, refuses: [] };
  const retenus = new Set(Object.keys(registre || {}));
  retenus.add(CLE_CREATEUR);
  for (const [cle, d] of Object.entries(dossiers)) {
    if (d.role !== 'coach' || (registre || {})[cle]) continue;
    if (!tousCoachs && !designe.has(cle) && !emetteurs.has(cle)) { rapport.coachsEcartes.push(cle); continue; }
    let plan = 'libre', actifJusqu = 0;
    const sid = String(d.paypalSubscriptionId || '');
    if (d.coachPlan && d.coachPlan !== 'libre' && /^I-[A-Z0-9]{8,}$/.test(sid)) {
      const sub = await lirePaypal('/v1/billing/subscriptions/' + sid);
      const p = sub && OFFRES_PAYPAL[sub.plan_id];
      const aLui = sub && (sub.custom_id === cle || cleEmail(sub.subscriber && sub.subscriber.email_address) === cle);
      if (sub && sub.status === 'ACTIVE' && p && p.coachPlan && aLui) {
        plan = p.coachPlan;
        actifJusqu = Math.max(Date.parse((sub.billing_info || {}).next_billing_time || '') || 0, t + MOIS_MS) + 7 * 864e5;
        rapport.coachsPayants++;
      } else rapport.refuses.push(cle + ' : plan ' + d.coachPlan + ' non attesté par PayPal → libre');
    }
    maj['coachs_registre/' + cle] = Object.assign({ plan, le: t, source: 'migration' }, actifJusqu ? { actifJusqu } : {});
    retenus.add(cle);
    rapport.coachs++;
    dire(cle);
  }
  for (const [cle, d] of Object.entries(dossiers)) {
    if (d.role === 'coach' || d.status !== 'COACHING_SUIVI') continue;
    const valables = (consommes[cle] || []).filter((c) => retenus.has(String(c.coachEmailKey || cleEmail(c.coachEmail))));
    if (!valables.length) { rapport.suivisSansCode.push(cle); continue; }
    const createur = valables.some((c) => String(c.coachEmailKey || cleEmail(c.coachEmail)) === CLE_CREATEUR);
    const plafond = createur ? Infinity : t + 12 * MOIS_MS;
    const exp = Number(d.accessExpiry) || 0;
    let fin;
    if (exp > 0) { if (exp <= t) { rapport.refuses.push(cle + ' : accès échu'); continue; } fin = Math.min(exp, plafond); }
    else fin = createur ? 0 : plafond;
    const avant = (droitsDeja && droitsDeja[cle]) || await lire('droits/' + cle);
    if (avant && ['main', 'suspension'].indexOf(String(avant.source)) >= 0) { rapport.refuses.push(cle + ' : accès posé à la main, inchangé'); continue; }
    const ouvert = avant && ['essentielle', 'ultime'].indexOf(String(avant.palier)) >= 0 && !(Number(avant.echeance) > 0 && Number(avant.echeance) <= t);
    maj['droits/' + cle] = ouvert
      ? Object.assign({}, avant, { suiviJusqu: fin === 0 ? t + 120 * MOIS_MS : fin, maj: t })
      : Object.assign({}, avant || {}, { palier: 'suivi', echeance: fin, source: 'code_coach', maj: t });
    rapport.suivis++;
    dire(cle);
  }
  // LES ESSAIS OUVERTS PAR L'APP. Jusqu'ici l'essai ne vivait que dans le
  // dossier (users/<clé>/essai) : le Worker n'était jamais appelé. Après la
  // bascule, seul droits/ compte. On reporte :
  //   · essaiOuvertLe, pour TOUT compte qui a eu un essai — ouvrirEssai ne
  //     doit pas en rouvrir un second ;
  //   · l'Ultime de l'essai, s'il court encore, borné à 60 jours depuis
  //     l'ouverture (30 + le mois du parrainage) : une fin plus lointaine
  //     écrite à la main dans un dossier n'est pas crue.
  for (const [cle, d] of Object.entries(dossiers)) {
    const e = d.essai;
    if (d.role === 'coach' || !e || typeof e !== 'object' || !(Number(e.ouvertLe) > 0)) continue;
    const ouvert = Number(e.ouvertLe);
    const fin = Math.min(Number(e.finit) || ouvert + 30 * 864e5, ouvert + 60 * 864e5);
    const avant = maj['droits/' + cle] || (droitsDeja && droitsDeja[cle]) || await lire('droits/' + cle);
    if (avant && ['main', 'suspension'].indexOf(String(avant.source)) >= 0) continue;
    if (avant && Number(avant.essaiOuvertLe) > 0) continue;
    const n = Object.assign({}, avant || {}, { essaiOuvertLe: ouvert, essaiFinit: fin, maj: t });
    const p = String((avant && avant.palier) || 'aucun');
    const pOuvert = p !== 'aucun' && !(Number(avant.echeance) > 0 && Number(avant.echeance) <= t);
    if (fin > t && !pOuvert) Object.assign(n, { palier: 'ultime', echeance: fin, source: 'essai' });
    if (!n.palier) n.palier = 'aucun';
    maj['droits/' + cle] = n;
    rapport.essais++;
  }
  return { maj, rapport };
}
