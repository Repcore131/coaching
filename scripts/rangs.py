#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""Convertit les emblèmes des dix rangs (les « volts ») en webp.

ENTRÉE : rangs-bruts/ à la racine du dépôt.
    rang_1.png … rang_10.png   un emblème par rang, ÉTINCELLE (1) à LÉGENDE (10),
                               fond transparent ou noir opaque ;
    planche.png                OU la planche d'origine : dix emblèmes sur fond
                               noir, en trois rangées de 3, 4 et 3, lus de gauche
                               à droite et de haut en bas. Elle est découpée en
                               rang_1.png … rang_10.png, écrits à côté d'elle,
                               quand ceux-ci manquent.

LE DÉCOUPAGE suit celui des planches de badges (scripts/badges.py) : le fond
est retiré sur la planche entière, puis des COUTURES de moindre contenu
séparent les rangées, et, dans chaque rangée, les emblèmes. Elles serpentent
entre les lueurs au lieu de trancher une corne ou une aile.

SORTIE, dans app/img/rangs/ :
    rang_<n>.webp       256×256 — l'accueil, le Canal, la fin de séance ;
                        elles entrent dans le cache du service worker ;
    rang_<n>-512.webp   512×512 — l'écran de passage de rang et la carte
                        1080×1920.
    rang_<n>-og.jpg     1200×630 — l'aperçu Open Graph de la page publique
                        /@<pseudo> (DM Instagram, WhatsApp) : JPEG, que les
                        deux lisent partout, sur un fond sombre et rouge.

Et la liste EMBLEMES_RANGS de app/sw.js est réécrite entre ses deux marqueurs
(// rangs.py:debut … // rangs.py:fin), avec les deux tailles : l'écran de
passage de rang peut tomber en salle, hors ligne.

IDEMPOTENT. Usage :  python scripts/rangs.py [--verifier]
Dépend de Pillow (support webp).
"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from badges import retirer_fond, ajuster, a_fond_opaque, _couture  # noqa: E402

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRUTS = os.path.join(RACINE, 'rangs-bruts')
SORTIE = os.path.join(RACINE, 'app', 'img', 'rangs')
SW = os.path.join(RACINE, 'app', 'sw.js')
N = 10
RANGEES = (3, 4, 3)
PETIT = (256, 256)
GRAND = (512, 512)


def decouper_planche(chemin):
    im = retirer_fond(Image.open(chemin).convert('RGBA'))
    w, h = im.size
    A = im.getchannel('A').load()
    px = im.load()
    # Les deux coutures horizontales, cherchées autour du tiers et des deux
    # tiers. Le +1 préfère la ligne droite à coût égal.
    hs = []
    for c in (1 / 3.0, 2 / 3.0):
        lo, hi = int(h * (c - 0.07)), int(h * (c + 0.05))
        hs.append(_couture(lambda x, y: A[x, y] + 1, w, h, (lo, hi)))
    bornes = [[0] * w] + hs + [[h] * w]
    rangee = []
    for r, n in enumerate(RANGEES):
        haut, bas = bornes[r], bornes[r + 1]
        vs = []
        for k in range(1, n):
            c = k / float(n)
            vs.append(_couture(lambda y, x: (A[x, y] if haut[x] <= y < bas[x] else 0) + 1,
                               h, w, (int(w * (c - 0.06)), int(w * (c + 0.06)))))
        rangee.append((haut, bas, [[0] * h] + vs + [[w] * h]))
    faits = []
    idx = 0
    for (haut, bas, vs) in rangee:
        for k in range(len(vs) - 1):
            idx += 1
            t = Image.new('RGBA', (w, h), (0, 0, 0, 0))
            tp = t.load()
            g, d = vs[k], vs[k + 1]
            for y in range(h):
                for x in range(g[y], d[y]):
                    if haut[x] <= y < bas[x]:
                        tp[x, y] = px[x, y]
            bb = t.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
            dst = os.path.join(BRUTS, 'rang_%d.png' % idx)
            (t.crop(bb) if bb else t).save(dst, optimize=True)
            faits.append(dst)
    return faits


def apercu_og(im):
    """1200×630 : un halo rouge sur fond presque noir, l'emblème au centre."""
    W, H = 1200, 630
    fond = Image.new('RGB', (W, H), (11, 11, 12))
    halo = Image.new('L', (W, H), 0)
    hp = halo.load()
    cx, cy, r = W / 2, H / 2, 420.0
    for y in range(H):
        for x in range(0, W):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / r
            if d < 1:
                hp[x, y] = int(150 * (1 - d) ** 2)
    rouge = Image.new('RGB', (W, H), (224, 32, 32))
    fond = Image.composite(rouge, fond, halo)
    e = ajuster(im, (540, 540))
    fond.paste(e, ((W - 540) // 2, (H - 540) // 2), e)
    return fond


def maj_sw(verifier):
    s = open(SW, encoding='utf-8', newline='').read()
    deb, fin = '// rangs.py:debut', '// rangs.py:fin'
    if deb not in s or fin not in s:
        raise SystemExit('app/sw.js : marqueurs « %s » / « %s » introuvables' % (deb, fin))
    corps = ("const EMBLEMES_RANGS = Array.from({ length: %d }, (_, i) => i + 1)\n"
             "  .flatMap(n => ['./img/rangs/rang_' + n + '.webp', './img/rangs/rang_' + n + '-512.webp']);\n" % N)
    i, j = s.index(deb) + len(deb), s.index(fin)
    neuf = s[:i] + '\n' + corps + s[j:]
    if neuf != s and not verifier:
        open(SW, 'w', encoding='utf-8', newline='').write(neuf)
    return neuf != s


def main():
    verifier = '--verifier' in sys.argv[1:]
    if not os.path.isdir(BRUTS):
        raise SystemExit('rangs-bruts/ introuvable à la racine du dépôt')
    manquent = [n for n in range(1, N + 1) if not os.path.exists(os.path.join(BRUTS, 'rang_%d.png' % n))]
    planche = os.path.join(BRUTS, 'planche.png')
    if manquent and os.path.exists(planche):
        if verifier:
            print('planche  à découper en rang_1 … rang_%d' % N)
            return
        for d in decouper_planche(planche):
            print('planche  -> %s' % os.path.relpath(d, RACINE))
    os.makedirs(SORTIE, exist_ok=True)
    for n in range(1, N + 1):
        src = os.path.join(BRUTS, 'rang_%d.png' % n)
        if not os.path.exists(src):
            raise SystemExit('%s manquant' % os.path.relpath(src, RACINE))
        im = Image.open(src).convert('RGBA')
        if a_fond_opaque(im):
            im = retirer_fond(im)
        p = os.path.join(SORTIE, 'rang_%d.webp' % n)
        g = os.path.join(SORTIE, 'rang_%d-512.webp' % n)
        if not verifier:
            ajuster(im, PETIT).save(p, 'WEBP', quality=84, alpha_quality=90, method=6)
            ajuster(im, GRAND).save(g, 'WEBP', quality=86, alpha_quality=92, method=6)
            o = os.path.join(SORTIE, 'rang_%d-og.jpg' % n)
            apercu_og(im).save(o, 'JPEG', quality=85, optimize=True, progressive=True)
            print('rang %-2d  %6d o  %6d o  %6d o' % (n, os.path.getsize(p), os.path.getsize(g), os.path.getsize(o)))
    if maj_sw(verifier):
        print('sw.js    EMBLEMES_RANGS : %d emblèmes × 2 tailles' % N)


if __name__ == '__main__':
    main()
