# -*- coding: utf-8 -*-
"""Remplace le rendu des compléments par les cartes en grille."""
import io, os

HERE = os.path.dirname(os.path.abspath(__file__))
# LE CODE N'EST PLUS DANS index.html (build 1417) : il vit dans
# app/rc-core.<build>.js, servi immuable pour un an. On passe par le lecteur
# partage, qui rend la page RECONSTITUEE — voir scripts/source_prod.py.
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', '..', 'scripts'))
from source_prod import source_prod, fichier_code
IDX = fichier_code()


def lire(p):
    with io.open(p, encoding='utf-8', newline='') as f:
        return f.read()


def neuf(nom):
    return lire(os.path.join(HERE, nom)).replace('\r\n', '\n').replace('\n', '\r\n').rstrip('\r\n')


s = lire(IDX)

for fichier, entete in (('supp_new.js', 'function _renderSuppTable(list, isCoach, editFn){'),
                        ('supp_legende.js', 'function _htmlSuppLegende(isCoach){'),
                        ('supp_sourcing.js', 'function _htmlSuppSourcing(isCoach){')):
    i = s.index(entete)
    # La fonction se ferme sur une accolade seule en colonne 1 : c'est le style
    # du fichier, et aucune accolade imbriquee n'y est jamais posee.
    j = s.index('\r\n}\r\n', i) + len('\r\n}')
    assert s.count(entete) == 1, entete
    s = s[:i] + neuf(fichier) + s[j:]

with io.open(IDX, 'w', encoding='utf-8', newline='') as f:
    f.write(s)
print('index.html : trois fonctions remplacées')
