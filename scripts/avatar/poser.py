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
IDX = os.path.join(APP, 'index.html')
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
