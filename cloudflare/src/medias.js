// ══ SUPPRIMER POUR DE BON UN MÉDIA CHEZ CLOUDINARY ════════════════════════
//
// Porté de functions/index.js (cloudinaryDestroy), qui n'a jamais tourné faute
// de plan Blaze : « rien ne supprime jamais une vidéo chez Cloudinary », et
// une révocation de photos de progression laissait les originaux en place.
// L'app met en file ce qu'elle n'a pas pu détruire et la rejoue à chaque
// ouverture : dès que ce serveur répond, la file se vide d'elle-même.
//
// LE CONTRÔLE D'APPARTENANCE EST LE CŒUR. Un identifiant Cloudinary est
// public (il est dans l'URL) : sans contrôle, n'importe quel compte connecté
// effacerait les médias de n'importe qui. On exige que le média appartienne à
// l'appelant (segment « repcore/<qui>/… »), ou à un athlète dont l'appelant
// est LE coach désigné par le dossier — lu dans la base, jamais sur parole.
//
// SECRETS : CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET (tableau de bord
// Cloudinary). Sans eux, l'appel répond « indisponible » et la file attend.

import { ErreurAppel } from './appels.js';

const cleEmail = (e) => String(e || '').toLowerCase().replace(/\./g, ',');
async function sha1Hex(texte) {
  const h = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(texte));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function cloudinaryDestroy({ auth, data }, ctx) {
  const { db, env, fetchImpl } = ctx;
  if (!env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET)
    throw new ErreurAppel(503, 'La suppression distante n’est pas encore configurée : le média reste à purger.');
  const moi = auth.email;
  const publicId = String((data && data.publicId) || '').trim();
  const type = String((data && data.resourceType) || '').trim();
  const proprietaire = String((data && data.proprietaire) || '').toLowerCase().trim();
  if (!publicId.startsWith('repcore/') || publicId.length > 300 || publicId.indexOf('..') >= 0 || /[\r\n]/.test(publicId))
    throw new ErreurAppel(400, 'Identifiant de média invalide.');
  if (type !== 'image' && type !== 'video') throw new ErreurAppel(400, 'Type de média invalide.');
  const jeton = publicId.split('/')[1] || '';
  if (!jeton) throw new ErreurAppel(400, 'Identifiant de média sans propriétaire.');

  const lire = async (c) => (await db.ref(c).get()).val();
  const kMoi = cleEmail(moi);
  const [monId, monRole] = await Promise.all([lire('users/' + kMoi + '/id'), lire('users/' + kMoi + '/role')]);
  if (monId === null && monRole === null) throw new ErreurAppel(403, 'Dossier introuvable.');
  const aMoi = jeton === monId || jeton === moi || jeton === kMoi;
  if (!aMoi) {
    if (!proprietaire) throw new ErreurAppel(403, 'Ce média n’est pas le tien.');
    const kCible = cleEmail(proprietaire);
    const [idCible, coachCible] = await Promise.all([lire('users/' + kCible + '/id'), lire('users/' + kCible + '/coachId')]);
    if (idCible === null && coachCible === null) throw new ErreurAppel(404, 'Dossier du propriétaire introuvable.');
    if (jeton !== idCible && jeton !== proprietaire && jeton !== kCible)
      throw new ErreurAppel(403, 'Ce média n’appartient pas au dossier annoncé.');
    if (monRole !== 'coach' || !coachCible || coachCible !== monId)
      throw new ErreurAppel(403, 'Cet athlète n’est pas dans ta liste.');
  }

  // `invalidate` purge aussi les copies du réseau de diffusion ; il entre dans la signature.
  const cloud = String((data && data.cloudName) || 'dntu57ml').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60) || 'dntu57ml';
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { invalidate: 'true', public_id: publicId, timestamp };
  const chaine = Object.keys(params).sort().map((k) => k + '=' + params[k]).join('&');
  const signature = await sha1Hex(chaine + String(env.CLOUDINARY_API_SECRET).trim());
  const corps = new URLSearchParams({ public_id: publicId, invalidate: 'true', timestamp: String(timestamp),
    api_key: String(env.CLOUDINARY_API_KEY).trim(), signature });
  let r;
  try {
    r = await (fetchImpl || fetch)('https://api.cloudinary.com/v1_1/' + cloud + '/' + type + '/destroy',
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: corps.toString() });
  } catch (e) { throw new ErreurAppel(503, 'Cloudinary est injoignable : le média reste à purger.'); }
  let d = null;
  try { d = await r.json(); } catch (e) { d = null; }
  const res = d && d.result;
  // « not found » EST UN SUCCÈS : le fichier n'est plus là, c'est ce qu'on voulait.
  if (res === 'ok' || res === 'not found') return { result: res, publicId };
  if (r.status === 401 || r.status === 403)
    throw new ErreurAppel(403, 'Ce média est hébergé sur un autre compte Cloudinary que celui du service.');
  throw new ErreurAppel(502, 'Cloudinary a refusé la suppression' + (res ? ' (' + res + ')' : ' (' + r.status + ')') + '.');
}
