/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
// Récepteur e-mail des adresses d'import par club : {slugClub}-{4 caractères}@import.fitpulse.app
// (Cloudflare Email Routing, règle « catch-all » vers ce Worker).
//  1. refuse un message de plus de 25 Mo ;
//  2. vérifie SPF et DKIM (en-tête Authentication-Results posé par Cloudflare) : au moins un des deux
//     doit être « pass », sinon le message est refusé ;
//  3. extrait les pièces jointes .csv, .zip, .xlsx et les liens https du corps ;
//  4. relaie le tout, signé HMAC, à la fonction ingestMail, qui retrouve le club par l'adresse
//     (relue au plus tard toutes les 60 s : une adresse régénérée est refusée sous 1 minute),
//     contrôle la liste blanche d'expéditeurs d'origine et appelle ingestFile, comme les autres canaux.
// L'expéditeur d'origine : l'en-tête From (conservé par une redirection ou un transfert automatique),
// ou la ligne « De : » / « From: » d'un transfert manuel.
export const TAILLE_MAX = 25 * 1024 * 1024;
const EXT = /\.(csv|zip|xlsx)$/i;

export function verdicts(authResults) {
  const t = String(authResults || '').toLowerCase();
  const spf = (/\bspf=(\w+)/.exec(t) || [])[1] || 'none'; const dkim = (/\bdkim=(\w+)/.exec(t) || [])[1] || 'none';
  return { spf, dkim };
}
export function expediteurOrigine(from, texte) {
  const m = /^(?:>?\s*)(?:de|from)\s*:\s*(?:.*<)?([^\s<>"]+@[^\s<>"]+)>?/im.exec(String(texte || ''));
  return m ? m[1].toLowerCase() : String(from || '').toLowerCase();
}
export const liensHttps = texte => [...new Set((String(texte || '').match(/https:\/\/[^\s"'<>)]+/g) || []).map(u => u.replace(/&amp;/g, '&')))].slice(0, 5);
const b64 = u8 => { let s = ''; const B = 0x8000; for (let i = 0; i < u8.length; i += B) s += String.fromCharCode(...u8.subarray(i, i + B)); return btoa(s); };
async function hmacHex(secret, data) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)))].map(x => x.toString(16).padStart(2, '0')).join('');
}

export function creerRecepteur({ analyser, envoyer = fetch, maintenant = () => Date.now() }) {
  return async function email(message, env) {
    if (Number(message.rawSize) > TAILLE_MAX) { message.setReject('Message de plus de 25 Mo'); return 'trop lourd'; }
    const { spf, dkim } = verdicts(message.headers.get('authentication-results'));
    if (spf !== 'pass' && dkim !== 'pass') { message.setReject('SPF et DKIM en échec'); return 'refusé'; }
    const mail = await analyser(message.raw);
    const texte = [mail.text || '', mail.html || ''].join('\n');
    const pieces = (mail.attachments || []).filter(a => EXT.test(a.filename || '')).map(a => ({ name: a.filename, b64: b64(a.content instanceof Uint8Array ? a.content : new Uint8Array(a.content)) }));
    const corps = JSON.stringify({ to: String(message.to).toLowerCase(), from: String(message.from).toLowerCase(), origFrom: expediteurOrigine((mail.from || {}).address || message.from, mail.text), spf, dkim, subject: String(mail.subject || '').slice(0, 200), messageId: String(mail.messageId || message.headers.get('message-id') || '').slice(0, 200), size: Number(message.rawSize) || 0, attachments: pieces, links: pieces.length ? [] : liensHttps(texte) });
    const t = String(maintenant());
    const r = await envoyer(env.INGEST_MAIL_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'x-fp-time': t, 'x-fp-signature': await hmacHex(env.FP_INGEST_MAIL_SECRET, t + '.' + corps) }, body: corps });
    if (r.status === 404) { message.setReject('Adresse d’import inconnue'); return 'inconnue'; }
    return r.status === 202 ? 'quarantaine' : r.ok ? 'transmis' : 'erreur ' + r.status;
  };
}

export default {
  async email(message, env, ctx) {
    const { default: PostalMime } = await import('postal-mime');
    return creerRecepteur({ analyser: raw => PostalMime.parse(raw) })(message, env, ctx);
  },
};
