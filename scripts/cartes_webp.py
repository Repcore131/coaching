#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""LES GABARITS DE LA CARTE D'ATHLETE : cartes-bruts/ -> app/img/cartes/*.webp

Trois cadres, un par palier de la note globale (carteCadre dans rc-core) :
  standard    note de 1 a 69
  elite       70 a 84
  legendaire  85 a 99

DEPOSER dans cartes-bruts/ (a la racine du depot) un fichier par cadre, nomme
standard.*, elite.*, legendaire.* (png, jpg ou webp, n'importe quelle taille,
au format portrait 5:7 de preference). Puis :

    python3 scripts/cartes_webp.py

Chaque gabarit est recadre en 1080 x 1512 (remplissage, centre), converti en
webp qualite 88 et ecrit dans app/img/cartes/<cadre>.webp : c'est le fond de la
carte, sur lequel l'app ecrit la note, le prenom et les cinq notes. Le centre
doit donc rester sombre et lisible.

Tant qu'un gabarit manque, l'app DESSINE le cadre (_carteCadreDessine) : rien
ne casse. Idempotent ; --verifier sort en erreur si un gabarit brut est plus
recent que son webp.
"""
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
BRUTS = RACINE / 'cartes-bruts'
SORTIE = RACINE / 'app' / 'img' / 'cartes'
CADRES = ('standard', 'elite', 'legendaire')
TAILLE = (1080, 1512)


def source(cle):
    for ext in ('png', 'jpg', 'jpeg', 'webp', 'PNG', 'JPG', 'JPEG', 'WEBP'):
        f = BRUTS / (cle + '.' + ext)
        if f.exists():
            return f
    return None


def convertir(src, dst):
    from PIL import Image, ImageOps
    im = Image.open(src).convert('RGB')
    im = ImageOps.fit(im, TAILLE, method=Image.LANCZOS, centering=(0.5, 0.5))
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, 'WEBP', quality=88, method=6)


def main():
    verifier = '--verifier' in sys.argv
    faits, manquants, en_retard = [], [], []
    for cle in CADRES:
        src = source(cle)
        dst = SORTIE / (cle + '.webp')
        if not src:
            manquants.append(cle)
            continue
        if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
            continue
        if verifier:
            en_retard.append(cle)
            continue
        convertir(src, dst)
        faits.append(cle)
    if faits:
        print('Converti : ' + ', '.join(faits) + ' -> app/img/cartes/')
    if manquants:
        print('Sans gabarit (cadre dessine par l\'app) : ' + ', '.join(manquants))
    if en_retard:
        print('En retard : ' + ', '.join(en_retard) + ' - lance python3 scripts/cartes_webp.py')
        sys.exit(1)
    if not faits and not manquants and not en_retard:
        print('Les trois cadres sont a jour.')


if __name__ == '__main__':
    main()
