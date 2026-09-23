# -*- coding: utf-8 -*-
"""Regenere la table des zones et la repose dans index.html, en place.

Rejouable : elle remplace le bloc entre « const WO_ZONES = { » et le
commentaire qui le suit, sans toucher a une ligne de plus.

  python poser.py
"""
import io, os
from export import js, EPS
from build import build

APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'app')
# LE CODE N'EST PLUS DANS index.html (build 1417) : il vit dans
# app/rc-core.<build>.js, servi immuable pour un an. On passe par le lecteur
# partage, qui rend la page RECONSTITUEE — voir scripts/source_prod.py.
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', '..', 'scripts'))
from source_prod import source_prod, fichier_code
IDX = fichier_code()
FIN = '// Les six groupes'

s = io.open(IDX, encoding='utf-8', newline='').read()
i = s.index('const WO_ZONES = {')
j = s.index(FIN, i)
neuf = js(build(EPS)).replace('\n', '\r\n') + '\r\n'
if s[i:j] == neuf:
    print('deja a jour')
else:
    io.open(IDX, 'w', encoding='utf-8', newline='').write(s[:i] + neuf + s[j:])
    print('index.html : table reposee (%d octets)' % len(neuf))
