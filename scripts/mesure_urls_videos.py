#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""QUELS LIENS DE VIDEO LA REGLE DU 30/09/2026 REFUSERAIT-ELLE ?

database.rules.json n'admet plus users/<cle>/videos/<i>/url que sur :
  https://res.cloudinary.com/   https://firebasestorage.googleapis.com/
  https://youtu.be/             https://www.youtube.com/
et en moins de 600 caracteres. Un seul lien hors liste fait rejeter le PUT
ENTIER du dossier. L'app (build 1752+) met les liens en conformite avant chaque
envoi (_videosConformes) ; ce script dit, sur un export, qui sera touche et
comment : « youtube » = converti en https://youtu.be/<id>, « retire » = le lien
part dans lienRefuse et n'est plus affiche comme lien.

Usage :
  python scripts/mesure_urls_videos.py export-rtdb.json
(Console Firebase > Realtime Database > menu > Exporter le JSON)
"""
import io
import json
import re
import sys

PREFIXES = ('https://res.cloudinary.com/', 'https://firebasestorage.googleapis.com/',
            'https://youtu.be/', 'https://www.youtube.com/')
YT = re.compile(r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})')


def conforme(u):
    return isinstance(u, str) and len(u) < 600 and u.startswith(PREFIXES)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    with open(sys.argv[1], encoding='utf-8') as f:
        racine = json.load(f)
    users = (racine or {}).get('users') or {}
    total = youtube = retire = 0
    for cle, d in sorted(users.items()):
        vids = (d or {}).get('videos') or []
        if isinstance(vids, dict):
            vids = list(vids.values())
        for v in vids:
            if not isinstance(v, dict) or v.get('url') is None:
                continue
            total += 1
            u = v['url']
            if conforme(u):
                continue
            if isinstance(u, str) and YT.search(u):
                youtube += 1
                print('youtube  %s  %s' % (cle, u[:120]))
            else:
                retire += 1
                print('RETIRE   %s  %s' % (cle, str(u)[:120]))
    print('\n%d liens · %d convertis en youtu.be · %d retires (hors liste)' % (total, youtube, retire))
    return 0


if __name__ == '__main__':
    sys.exit(main())
