# -*- coding: utf-8 -*-
"""LE SHORT S'ECLAIRCIT, POUR QUE LA COULEUR DES FESSIERS SE VOIE DESSUS.

Kevin, 23/09/2026 : « fessiers, essaie de mettre peut-etre plus blanc ton
calecon, pour qu'on puisse voir par-dessus la couleur ».

POURQUOI L'IMAGE ET PAS LE CODE. La teinte est peinte sur un <canvas> en
`mix-blend-mode: multiply` : elle MULTIPLIE la luminance du dessin. Sur le
short de l'homme de dos, cette luminance vaut 24 sur 255 — apres le
`brightness(1.55)` de la feuille de style, 37. Multipliee par un vert, elle
rend (5, 29, 14) : noir. AUCUN reglage de couleur ne peut rattraper ca, parce
que multiplier par presque zero rend presque zero. Le seul endroit ou ca se
repare, c'est la luminance du dessin.

⚠ ON N'ECLAIRCIT QUE CE QUI RECOIT LA TEINTE, et avec un bord fondu : la zone
  des fessiers de la carte, dilatee puis floutee. Un rectangle franc aurait
  colle une plaque grise sur le short quand la silhouette n'est pas teintee.
  La femme n'est pas touchee : son short est deja a 76 de luminance, et la
  couleur s'y voit.

⚠ IDEMPOTENT PAR MESURE. Le script releve la luminance moyenne sous la zone
  avant d'agir et ne fait rien si elle depasse deja la cible : le rejouer ne
  delave pas l'image un peu plus a chaque fois. C'est ce qui permet de le
  garder dans le depot a cote de corps_zones.py.

    python scripts/corps_short.py [--verif]
"""
import os
import sys

from PIL import Image, ImageFilter

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(RACINE, 'app', 'img', 'corps')

FESSIERS = 12 * 12  # le rang des fessiers dans CORPS_ZONES_ORDRE, fois le pas
CIBLE = 60          # la luminance moyenne visee sous la zone
SOCLE, PENTE = 62.0, 0.85   # neuf = SOCLE + PENTE * vieux, la ou le masque est plein
FLOU = 5

TRAVAUX = [('h-dos.webp', 'z-h-dos.png')]


def _masque(zc, taille):
    z = Image.open(os.path.join(IMG, zc)).convert('L')
    if z.size != taille:
        z = z.resize(taille)
    m = z.point(lambda v: 255 if v == FESSIERS else 0)
    # Dilate puis floute : le bord se fond dans le tissu au lieu de s'y decouper.
    m = m.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(FLOU))
    return m


def _moyenne(im, zc):
    z = Image.open(os.path.join(IMG, zc)).convert('L')
    pz, px = z.load(), im.convert('L').load()
    n = s = 0
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            if pz[x, y] == FESSIERS:
                n += 1
                s += px[x, y]
    return (s / n) if n else 0.0


def eclaircir(nom, zc, verif):
    chemin = os.path.join(IMG, nom)
    im = Image.open(chemin).convert('RGB')
    avant = _moyenne(im, zc)
    if avant >= CIBLE:
        print('  ok  %s : luminance %.1f sous les fessiers, rien a faire' % (nom, avant))
        return 0
    if verif:
        print('ECART %s : luminance %.1f sous les fessiers, la couleur ne s\'y verra pas'
              % (nom, avant))
        return 1
    m = _masque(zc, im.size)
    clair = im.point(lambda v: int(min(255, SOCLE + PENTE * v)))
    im = Image.composite(clair, im, m)
    im.save(chemin, format='WEBP', quality=92, method=6)
    print('%s : luminance %.1f -> %.1f sous les fessiers (%d octets)'
          % (nom, avant, _moyenne(Image.open(chemin).convert('RGB'), zc),
             os.path.getsize(chemin)))
    return 0


def main(argv):
    verif = '--verif' in argv
    n = 0
    for (nom, zc) in TRAVAUX:
        n += eclaircir(nom, zc, verif)
    return 1 if n else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
