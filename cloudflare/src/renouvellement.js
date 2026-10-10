// ══ L'AVIS AVANT CHAQUE RENOUVELLEMENT ANNUEL (art. L215-1) ════════════════
//
// POURQUOI. Un abonnement annuel se reconduit tacitement : la loi impose
// d'informer l'abonné, AU PLUS TÔT TROIS MOIS ET AU PLUS TARD UN MOIS avant la
// date anniversaire, de la possibilité de ne pas le renouveler (CGV §4, qui
// l'annonce). Sans cet avis, l'abonné peut résilier à tout moment après la
// reconduction et se faire rembourser.
//
// COMMENT (09/10/2026).
//   · À chaque paiement d'un plan ANNUEL, paypal.js note la prochaine échéance
//     lue chez PayPal (billing_info.next_billing_time) dans
//     renouvellements/<clé> ; une résiliation retire l'entrée.
//   · Chaque jour (planif.js, travail « renouvellement »), le worker prévient
//     ceux dont l'échéance tombe dans moins de AVIS_JOURS jours : notification
//     (urgente : un avis légal ne dépend pas des préférences de notification)
//     ET e-mail par Systeme.io quand il est configuré. UNE fois par échéance.
//   · L'E-MAIL PASSE PAR LE WORKER, JAMAIS PAR L'APP (règle du projet). Il
//     n'est pas écrit ici : le worker pose l'étiquette SYSTEMEIO_TAG_RENOUVELLEMENT
//     sur le contact, et c'est la règle d'automatisation de Systeme.io (« tag
//     ajouté → envoyer l'e-mail ») qui l'envoie. La date et le montant vont
//     dans deux champs du contact si SYSTEMEIO_CHAMP_ECHEANCE /
//     SYSTEMEIO_CHAMP_MONTANT donnent leurs identifiants (slug).
//
// SECRETS (facultatifs : sans eux, la notification seule part, et l'entrée
// garde `email: 'non_configure'`) : SYSTEMEIO_API_KEY,
// SYSTEMEIO_TAG_RENOUVELLEMENT (identifiant numérique de l'étiquette).

const JOUR_MS = 864e5;
// Le milieu de la fenêtre légale (90 → 30 jours) : un avis qui échoue un jour
// a encore un mois de rattrapage avant la limite.
export const AVIS_JOURS = 60;
export const AVIS_MIN_JOURS = 30;
export const AVIS_MAX_JOURS = 90;
const SYSTEMEIO = 'https://api.systeme.io/api';

/**
 * PURE. Faut-il envoyer l'avis aujourd'hui ?
 * @param {number} echeance date anniversaire (ms)
 * @param {number} t maintenant (ms)
 * @param {number|null|undefined} dejaPour échéance pour laquelle l'avis est déjà parti
 * @returns {{envoyer:boolean, tardif:boolean, jours:number}}
 */
export function avisDu(echeance, t, dejaPour) {
  const e = Number(echeance) || 0;
  const jours = Math.ceil((e - t) / JOUR_MS);
  const envoyer = e > t && jours <= AVIS_JOURS && Number(dejaPour) !== e;
  return { envoyer, tardif: envoyer && jours < AVIS_MIN_JOURS, jours };
}

/**
 * PURE. Le texte de l'avis. Rien d'inventé : la date et le montant sont ceux
 * de PayPal (prochaine échéance, dernier paiement).
 * @param {{prenom?:string, formule?:string, echeance:number, montantCentimes?:number}} o
 * @returns {{title:string, body:string, date:string, montant:string}}
 */
export function texteAvis(o) {
  const date = new Date(Number(o.echeance)).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric' });
  const c = Number(o.montantCentimes);
  const montant = Number.isFinite(c) && c > 0 ? (c / 100).toFixed(2).replace('.', ',') + ' €' : '';
  const nom = o.formule === 'ultime' ? 'Ultime' : 'Essentielle';
  return {
    title: 'Ton abonnement annuel se renouvelle le ' + date,
    body: (o.prenom ? o.prenom + ', ton' : 'Ton') + ' abonnement ' + nom + ' sera reconduit pour un an le ' + date
      + (montant ? ' (' + montant + ' au dernier paiement)' : '') + '. Tu peux ne pas le renouveler : Réglages → Mon abonnement → Résilier, avant cette date.',
    date, montant,
  };
}

/**
 * L'e-mail par Systeme.io : contact retrouvé (ou créé), champs posés,
 * étiquette retirée puis remise (une automatisation « tag ajouté » se
 * redéclenche ainsi chaque année). Rend 'envoye', 'non_configure' ou lève.
 */
export async function etiqueterSystemeio(env, fetchImpl, { email, prenom, date, montant }) {
  const cle = String(env.SYSTEMEIO_API_KEY || '').trim(), tag = String(env.SYSTEMEIO_TAG_RENOUVELLEMENT || '').trim();
  if (!cle || !/^\d+$/.test(tag)) return 'non_configure';
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'sans_email';
  const f = fetchImpl || fetch;
  const appel = async (methode, chemin, corps, type) => {
    const r = await f(SYSTEMEIO + chemin, { method: methode,
      headers: Object.assign({ 'X-API-Key': cle, Accept: 'application/json' }, corps ? { 'Content-Type': type || 'application/json' } : {}),
      body: corps ? JSON.stringify(corps) : undefined });
    if (!r.ok && !(methode === 'DELETE' && r.status === 404)) throw new Error('Systeme.io ' + methode + ' ' + chemin.split('?')[0] + ' ' + r.status);
    return r.status === 204 || methode === 'DELETE' ? null : r.json();
  };
  const champs = [];
  if (env.SYSTEMEIO_CHAMP_ECHEANCE) champs.push({ slug: String(env.SYSTEMEIO_CHAMP_ECHEANCE), value: date });
  if (env.SYSTEMEIO_CHAMP_MONTANT && montant) champs.push({ slug: String(env.SYSTEMEIO_CHAMP_MONTANT), value: montant });
  const trouve = await appel('GET', '/contacts?email=' + encodeURIComponent(email));
  let contact = trouve && Array.isArray(trouve.items) ? trouve.items[0] : null;
  if (!contact) {
    contact = await appel('POST', '/contacts', { email, fields: [{ slug: 'first_name', value: prenom || '' }].concat(champs) });
  } else if (champs.length) {
    await appel('PATCH', '/contacts/' + contact.id, { fields: champs }, 'application/merge-patch+json');
  }
  if (!contact || !contact.id) throw new Error('Systeme.io : contact sans identifiant');
  await appel('DELETE', '/contacts/' + contact.id + '/tags/' + tag);
  await appel('POST', '/contacts/' + contact.id + '/tags', { tagId: Number(tag) });
  return 'envoye';
}
