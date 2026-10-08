#!/usr/bin/env node
// well-known/assetlinks.json, CONTRÔLÉ (série 6, lot 15, 08/10/2026).
//
// Deux empreintes au plus et dans cet ordre : la clé actuelle (APK hors store,
// celle que apk.yml compare à l'APK signé — la PREMIÈRE), puis celle de Play
// App Signing quand android/play/empreinte-play.txt la porte. Une empreinte
// mal formée, un paquet faux, une clé actuelle absente : rouge.
import { readFileSync } from 'node:fs';

export const EMPREINTE_RE = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
export const PAQUET = 'com.repcore.app';
// PURE. {ok, erreurs[], empreintes[]}.
export function verifierAssetlinks(texte, empreinteActuelle, empreintePlay) {
  const erreurs = [];
  let l; try { l = JSON.parse(texte); } catch (e) { return { ok: false, erreurs: ['JSON illisible'], empreintes: [] }; }
  const t = Array.isArray(l) && l.find((x) => x && x.target && x.target.package_name === PAQUET);
  if (!t) return { ok: false, erreurs: ['aucune cible ' + PAQUET], empreintes: [] };
  if (!(t.relation || []).includes('delegate_permission/common.handle_all_urls')) erreurs.push('relation handle_all_urls absente');
  const e = t.target.sha256_cert_fingerprints || [];
  for (const x of e) if (!EMPREINTE_RE.test(x)) erreurs.push('empreinte mal formée : ' + x);
  if (new Set(e).size !== e.length) erreurs.push('empreinte en double');
  if (e.length > 2) erreurs.push(e.length + ' empreintes : deux au plus (clé actuelle, Play App Signing)');
  if (empreinteActuelle && e[0] !== empreinteActuelle) erreurs.push('la clé actuelle doit être la PREMIÈRE (apk.yml la compare à l’APK)');
  if (empreintePlay && EMPREINTE_RE.test(empreintePlay) && e[1] !== empreintePlay) erreurs.push('empreinte Play App Signing posée dans android/play/empreinte-play.txt mais absente (2ᵉ position) de assetlinks.json');
  return { ok: !erreurs.length, erreurs, empreintes: e };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const texte = readFileSync('well-known/assetlinks.json', 'utf8');
  const play = readFileSync('android/play/empreinte-play.txt', 'utf8').trim();
  // La clé actuelle : la première empreinte publiée aujourd'hui (celle de l'APK 3).
  const actuelle = '9E:55:AE:95:8A:99:DC:55:22:8B:8F:CD:8A:9C:FD:81:2E:90:25:02:51:ED:B3:57:55:A6:AF:2A:0C:6A:98:FA';
  const r = verifierAssetlinks(texte, actuelle, play);
  if (!r.ok) { console.error('assetlinks.json : ' + r.erreurs.join(' ; ')); process.exit(1); }
  console.log('assetlinks.json : ' + r.empreintes.length + ' empreinte(s)' + (EMPREINTE_RE.test(play) ? '' : ' — Play App Signing pas encore posée (android/play/empreinte-play.txt)'));
}
