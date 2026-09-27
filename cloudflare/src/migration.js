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
