#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""COMBIEN LES PHOTOS DE BILAN PESENT-ELLES ENCORE DANS LA BASE ?

POURQUOI. Jusqu'au build 1421, une photo de bilan etait ecrite EN CLAIR dans le
dossier, en base64. Mesure du 23/09/2026 sur une photo de corps plausible :
374 Ko a la prise (1080x1440), et 8 835 caracteres apres la recompression que
_doPushOne faisait a CHAQUE envoi (220x293). Or le document part EN ENTIER a
chaque synchronisation : vingt-quatre photos, c'est 212 Ko renvoyes sur le
reseau a chaque ecriture du dossier, et vingt-quatre images reencodees sur le
telephone au passage.

Depuis le build 1421, le document ne porte plus qu'une reference
({cle,w,h,octets} puis {url,publicId}) et la migration tourne au demarrage, par
paquets de six, SANS JAMAIS remplacer une chaine avant que la reference soit
valide.

CE SCRIPT EST LE JUGE DE PAIX DE CETTE MIGRATION. Il lit un export JSON de la
base — Console Firebase > Realtime Database > (menu) Exporter le JSON — et dit,
dossier par dossier, ce qui reste en base64. C'est LUI qui autorise a activer la
regle de validation commentee dans database.rules.json : tant qu'un seul dossier
porte encore une chaine, activer la regle ferait rejeter son PUT ENTIER, ce qui
est le defaut definitif et silencieux qu'on connait par coeur ici.

Usage :
  python scripts/mesure_photos_bilan.py export-rtdb.json
  python scripts/mesure_photos_bilan.py export-rtdb.json --detail
"""
import io
import json
import re
import sys

SEUIL = 600          # au-dela, c'est une image, pas une reference


def octets(n):
    return format(int(n), ',d').replace(',', ' ') + ' o'


def ko(n):
    return format(int(round(n / 1024.0)), ',d').replace(',', ' ') + ' Ko'


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    detail = '--detail' in sys.argv
    if not args:
        raise SystemExit('Usage : python scripts/mesure_photos_bilan.py <export-rtdb.json> [--detail]')
    with io.open(args[0], encoding='utf-8') as f:
        base = json.load(f)
    users = (base or {}).get('users') or {}
    if isinstance(users, list):
        users = {str(i): u for i, u in enumerate(users) if u}

    total_base64 = 0
    total_refs = 0
    n_photos = 0
    n_refs = 0
    coupables = []
    poids_dossiers = []

    for cle, u in users.items():
        if not isinstance(u, dict):
            continue
        try:
            poids_dossiers.append((len(json.dumps(u, ensure_ascii=False)), u.get('email') or cle))
        except Exception:
            pass
        reste = 0
        combien = 0
        bl = u.get('bilans') or []
        if isinstance(bl, dict):
            bl = [v for v in bl.values() if v]
        for b in bl:
            if not isinstance(b, dict):
                continue
            for k, v in b.items():
                if 'photo' not in k:
                    continue
                if isinstance(v, str) and len(v) > SEUIL:
                    reste += len(v)
                    combien += 1
                    n_photos += 1
                    total_base64 += len(v)
                elif isinstance(v, dict):
                    n_refs += 1
                    total_refs += len(json.dumps(v, ensure_ascii=False))
        if reste:
            coupables.append((reste, combien, u.get('email') or cle))

    coupables.sort(reverse=True)
    poids_dossiers.sort(reverse=True)
    med = poids_dossiers[len(poids_dossiers) // 2][0] if poids_dossiers else 0

    print('DOSSIERS LUS                     : %d' % len(users))
    print('PHOTOS ENCORE EN BASE64          : %d, %s' % (n_photos, ko(total_base64)))
    print('PHOTOS DEVENUES DES REFERENCES   : %d, %s' % (n_refs, octets(total_refs)))
    if n_refs:
        print('   soit %s par reference en moyenne' % octets(total_refs / float(n_refs)))
    print('POIDS MEDIAN D UN DOSSIER        : %s' % ko(med))
    if poids_dossiers:
        print('   le plus lourd : %s (%s)' % (ko(poids_dossiers[0][0]), poids_dossiers[0][1]))
    print('')
    if not coupables:
        print('AUCUN DOSSIER NE PORTE PLUS DE PHOTO EN BASE64.')
        print('La regle de validation commentee dans database.rules.json peut etre activee,')
        print('puis deployee : firebase deploy --only database')
        return
    print('%d DOSSIER(S) PORTENT ENCORE DES PHOTOS EN BASE64 :' % len(coupables))
    for reste, combien, qui in (coupables if detail else coupables[:12]):
        print('  %-42s %2d photo(s)  %s' % (qui, combien, ko(reste)))
    if not detail and len(coupables) > 12:
        print('  … et %d autre(s) ( --detail pour tout voir )' % (len(coupables) - 12))
    print('')
    print('NE PAS ACTIVER LA REGLE MAINTENANT : leur PUT ENTIER serait rejete, definitivement')
    print('et sans un mot. La migration tourne a chaque ouverture de l app, par paquets de six.')


if __name__ == '__main__':
    main()
