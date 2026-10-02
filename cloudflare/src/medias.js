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
// effacerait les médias de n'importe qui. RIEN N'EST PRIS SUR PAROLE :
//
//   • LE PROPRIÉTAIRE d'un « repcore/<id>/… » est lu dans /medias_proprio/<id>,
//     index que le compte écrit une seule fois (règle : !data.exists(), et
//     seulement à sa propre adresse). On exige en plus que users/<proprio>/id
//     vaille bien <id> — un id posé ne se modifie plus — et qu'AUCUN autre
//     dossier ne porte ce même id : un compte neuf qui aurait recopié l'id
//     d'un autre, puis réclamé l'index avant lui, tombe sur ce doublon.
//     Un dossier « repcore/<adresse>/… » (anciens envois) appartient à
//     l'adresse elle-même.
//   • L'APPELANT est ce propriétaire (adresse du jeton vérifié), ou son coach.
//     Le coach n'est PAS lu dans users/<proprio>/coachEmailKey seul : l'athlète
//     écrit ce champ lui-même, et pourrait y mettre n'importe qui. Il faut
//     aussi que le coach l'ait inscrit dans coachs/<coach>/clients/<proprio> —
//     liste qu'il est seul à écrire, et seulement pour un athlète qui le
//     désigne. Les deux, ou rien.
//
// LE COMPTE CLOUDINARY vient de la configuration du worker
// (CLOUDINARY_CLOUD_NAME), jamais de l'appel : un client ne choisit pas où
// la signature du service part.
//
// SECRETS : CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET (tableau de bord
// Cloudinary), CLOUDINARY_CLOUD_NAME facultatif. Sans les deux premiers,
// l'appel répond « indisponible » et la file attend.

import { ErreurAppel } from './appels.js';

// Le compte par défaut est celui de l'app ; la configuration du worker le remplace.
export const compteCloudinary = (env) =>
  String((env && env.CLOUDINARY_CLOUD_NAME) || 'dntu57ml').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60) || 'dntu57ml';
const cleEmail = (e) => String(e || '').toLowerCase().replace(/\./g, ',');
async function sha1Hex(texte) {
  const h = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(texte));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ══ LE CONTRÔLE D'APPARTENANCE, PARTAGÉ (suppression ET signature d'envoi) ══
// Le propriétaire du segment « repcore/<segment>/… » : une adresse (anciens
// envois), ou un identifiant de dossier vérifié par medias_proprio/<id>,
// users/<proprio>/id et l'absence de doublon. Voir l'en-tête du fichier.
async function proprietaireDuSegment(db, segment, suite) {
  const lire = async (c) => (await db.ref(c).get()).val();
  if (segment.indexOf('@') >= 0) {
    if (/[#$\[\]?\s/]/.test(segment) || segment.length > 200) throw new ErreurAppel(400, 'Identifiant de média invalide.');
    return cleEmail(segment);
  }
  if (!/^[A-Za-z0-9_-]{1,39}$/.test(segment)) throw new ErreurAppel(400, 'Identifiant de média invalide.');
  const k = await lire('medias_proprio/' + segment);
  // 409 ET NON 403 : un compte d'avant l'index ne l'écrit qu'à sa prochaine
  // ouverture. D'ici là, l'opération attend dans la file de l'app.
  if (typeof k !== 'string' || !k) throw new ErreurAppel(409, 'Le propriétaire de ce dossier n’est pas encore indexé : ' + suite + '.');
  const [idProprio, memes] = await Promise.all([lire('users/' + k + '/id'), db.ref('users').parChamp('id', segment, 2)]);
  if (idProprio !== segment) throw new ErreurAppel(403, 'Ce média n’appartient pas au dossier annoncé.');
  if (Object.keys(memes || {}).some((c) => c !== k))
    throw new ErreurAppel(403, 'Cet identifiant est porté par plusieurs dossiers.');
  return k;
}
// L'appelant est le propriétaire, ou son coach — DÉSIGNÉ par le dossier ET
// inscrit dans sa propre liste (coachs/<coach>/clients/<proprio>).
async function verifierAcces(db, kMoi, kProprio, message) {
  if (kProprio === kMoi) return;
  const lire = async (c) => (await db.ref(c).get()).val();
  const [coachDeclare, inscrit] = await Promise.all([
    lire('users/' + kProprio + '/coachEmailKey'), lire('coachs/' + kMoi + '/clients/' + kProprio)]);
  if (String(coachDeclare || '').toLowerCase() !== kMoi || inscrit !== true) throw new ErreurAppel(403, message);
}

// ══ SIGNER UN ENVOI (01/10/2026) ═══════════════════════════════════════════
// Les envois partaient NON SIGNÉS (upload_preset public) : quiconque lisait le
// code pouvait déposer n'importe quoi, n'importe où, sur le compte Cloudinary
// de RepCore. L'app demande désormais une signature ICI, avant chaque envoi :
//   · le jeton Firebase est vérifié (appels.js) ;
//   · le DOSSIER est imposé : « repcore/<id ou adresse du compte>[/<rubrique>] »,
//     ou celui d'un athlète dont l'appelant est le coach (même contrôle que la
//     suppression), ou « repcore/audio/<clé de l'athlète> » (commentaire audio
//     d'un bilan) ;
//   · les FORMATS sont signés (allowed_formats) : Cloudinary refuse le reste ;
//   · 30 signatures par heure et par compte (cloudinary_signatures/<clé>).
// La taille maximale, elle, se règle sur le preset (cloudflare/README.md).
export const LIMITE_SIGNATURES_HEURE = 30;
export const FORMATS_ENVOI = Object.freeze({ image: 'jpg,png,webp', video: 'mp4,mov,webm', audio: 'webm,mp4,ogg,m4a' });
// PURE (à SHA-1 près). La signature Cloudinary : les paramètres triés,
// « clé=valeur » joints par &, suivis du secret, en SHA-1 hexadécimal.
export async function signatureCloudinary(params, secret) {
  const chaine = Object.keys(params).filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort().map((k) => k + '=' + params[k]).join('&');
  return sha1Hex(chaine + String(secret).trim());
}
export async function cloudinarySigner({ auth, data }, ctx) {
  const { db, env } = ctx;
  if (!env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET)
    throw new ErreurAppel(503, 'L’envoi signé n’est pas encore configuré : le média reste en file.');
  const t = (ctx.maintenant || Date.now)();
  const kMoi = cleEmail(auth.email);
  const type = String((data && data.type) || '');
  if (!FORMATS_ENVOI[type]) throw new ErreurAppel(400, 'Type de média invalide.');
  const dossier = String((data && data.dossier) || '').trim();
  if (dossier.length > 220 || dossier.indexOf('..') >= 0 || /[\r\n\s]/.test(dossier)) throw new ErreurAppel(400, 'Dossier invalide.');
  let kProprio;
  const audio = dossier.match(/^repcore\/audio\/([A-Za-z0-9_@,.-]{1,200})$/);
  const normal = dossier.match(/^repcore\/([A-Za-z0-9_@.,-]{1,200})(?:\/([a-z]{1,20}))?$/);
  if (audio) kProprio = cleEmail(audio[1].replace(/,/g, '.'));
  else if (normal && normal[1] !== 'audio') kProprio = await proprietaireDuSegment(db, normal[1].replace(/,/g, '.'), 'l’envoi reste en file');
  else throw new ErreurAppel(400, 'Dossier refusé : il doit être « repcore/<ton dossier> ».');
  await verifierAcces(db, kMoi, kProprio, 'Ce dossier n’est pas le tien.');
  const publicId = data && data.publicId != null ? String(data.publicId) : '';
  if (publicId && !/^[A-Za-z0-9_-]{1,80}$/.test(publicId)) throw new ErreurAppel(400, 'Identifiant de média invalide.');
  // LA LIMITE HORAIRE, en transaction : deux envois simultanés ne la doublent pas.
  const h = Math.floor(t / 3600e3);
  const tx = await db.ref('cloudinary_signatures/' + kMoi).transaction((cur) => {
    const n = cur && cur.h === h ? Number(cur.n) || 0 : 0;
    return n >= LIMITE_SIGNATURES_HEURE ? undefined : { h, n: n + 1 };
  });
  if (!tx.committed) throw new ErreurAppel(429, 'Trop d’envois cette heure-ci : réessaie un peu plus tard.');
  const params = { allowed_formats: FORMATS_ENVOI[type], folder: dossier, timestamp: Math.floor(t / 1000),
    // Un preset d'images à part (plafond 10 Mo, voir README), s'il est posé.
    upload_preset: String((type === 'image' && env.CLOUDINARY_UPLOAD_PRESET_IMAGE) || env.CLOUDINARY_UPLOAD_PRESET || 'repcore_videos').trim() };
  if (publicId) params.public_id = publicId;
  const signature = await signatureCloudinary(params, env.CLOUDINARY_API_SECRET);
  return Object.assign({}, params, { signature, api_key: String(env.CLOUDINARY_API_KEY).trim(),
    cloud_name: compteCloudinary(env), resource_type: type === 'image' ? 'image' : 'video' });
}

export async function cloudinaryDestroy({ auth, data }, ctx) {
  const { db, env, fetchImpl } = ctx;
  if (!env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET)
    throw new ErreurAppel(503, 'La suppression distante n’est pas encore configurée : le média reste à purger.');
  const moi = auth.email;
  const publicId = String((data && data.publicId) || '').trim();
  const type = String((data && data.resourceType) || '').trim();
  if (!publicId.startsWith('repcore/') || publicId.length > 300 || publicId.indexOf('..') >= 0 || /[\r\n]/.test(publicId))
    throw new ErreurAppel(400, 'Identifiant de média invalide.');
  if (type !== 'image' && type !== 'video') throw new ErreurAppel(400, 'Type de média invalide.');
  const segment = publicId.split('/')[1] || '';
  if (!segment) throw new ErreurAppel(400, 'Identifiant de média sans propriétaire.');

  const kMoi = cleEmail(moi);
  const kProprio = await proprietaireDuSegment(db, segment, 'le média reste à purger');
  await verifierAcces(db, kMoi, kProprio, 'Ce média n’est pas le tien.');

  // `invalidate` purge aussi les copies du réseau de diffusion ; il entre dans la signature.
  const cloud = compteCloudinary(env);
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
