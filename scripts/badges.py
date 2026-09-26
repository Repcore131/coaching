#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""Convertit les visuels bruts de la collection de badges en médaillons webp.

ENTRÉE : badges-bruts/ à la racine du dépôt, des PNG carrés (1024 px ou plus)
à fond transparent, nommés d'après l'icône du badge (le champ `icone` de
BADGES_ACQUIS dans app/rc-core.*.js) :

    <clé>.png           un badge unique ou secret        (aube.png, verrouille.png)
    <clé>_<palier>.png  un palier d'une famille, 1 à 4   (assidu_3.png)

LES PLANCHES. Certains fichiers sont une planche 2×2 des quatre paliers d'une
famille, sur un fond noir opaque (#080808). Elles sont DÉTECTÉES — quatre
coins opaques et sombres, une croix centrale sombre — puis découpées en
<clé>_1.png … <clé>_4.png (lecture de gauche à droite, de haut en bas), fond
retiré, écrits à côté de la planche dans badges-bruts/. La planche elle-même
n'est pas convertie.

LE FOND NOIR se retire par REMPLISSAGE DEPUIS LES BORDS, comme les quinze
médaillons d'origine (voir app/img/badges/LISEZ-MOI.txt) : ce qui est sombre
ET joignable depuis l'extérieur devient transparent, la lueur arrête le
remplissage, l'intérieur de l'hexagone n'est jamais atteint. Sur la frange,
l'alpha suit la luminosité et la couleur est « dé-prémultipliée » depuis le
noir : la lueur rouge reste rouge en s'effaçant, au lieu de virer au gris.

SORTIE, dans app/img/badges/ :
    <clé>.webp        184×200, le format des médaillons existants (vitrine,
                      bannière) — il entre dans le cache du service worker ;
    <clé>-512.webp    512×512, pour la fiche du badge et le visuel de partage.

Et la liste MEDAILLONS_COLLECTION de app/sw.js est réécrite entre ses deux
marqueurs, avec les petites tailles : elles arrivent donc hors ligne, en salle,
là où la fin de séance les montre.

IDEMPOTENT : relancé, il réécrit les mêmes fichiers.

Usage :  python scripts/badges.py [--verifier]
         --verifier ne change rien : il dit ce qui serait fait.
Dépend de Pillow (pip install pillow), avec le support webp.
"""
import os
import re
import sys
from collections import deque

from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRUTS = os.path.join(RACINE, 'badges-bruts')
SORTIE = os.path.join(RACINE, 'app', 'img', 'badges')
SW = os.path.join(RACINE, 'app', 'sw.js')

PETIT = (184, 200)          # le format des quinze médaillons d'origine
GRAND = (512, 512)
# Le fond : sous SEUIL_BAS au-dessus de la couleur du fond, transparent ; au-
# delà de SEUIL_HAUT, opaque et le remplissage s'arrête ; entre les deux, la
# frange, en alpha progressif.
SEUIL_BAS = 6
SEUIL_HAUT = 48
NOM = re.compile(r'^([a-z0-9_-]+?)(?:_([1-4]))?\.png$')


def _sombre_opaque(px, x, y, fond):
    r, g, b, a = px[x, y]
    return a > 250 and max(r, g, b) - fond <= SEUIL_HAUT


def est_planche(im):
    """Une planche 2×2 : quatre coins opaques et sombres, le CENTRE de l'image
    sombre (il tombe entre les quatre médaillons), et du contenu au centre de
    chaque quart. Un badge seul a au contraire son emblème au centre.

    La croix centrale entière n'est PAS un critère : les ailes et les éclairs
    des paliers III et IV débordent sur la ligne du milieu."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    fond = min(max(px[2, 2][:3]), 16)
    for (x, y) in ((2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)):
        if not _sombre_opaque(px, x, y, fond):
            return False
    r = max(2, min(w, h) // 100)
    centre = [(w // 2 + dx, h // 2 + dy) for dx in range(-r, r + 1, max(1, r // 3))
              for dy in range(-r, r + 1, max(1, r // 3))]
    if sum(1 for (x, y) in centre if _sombre_opaque(px, x, y, fond)) < 0.8 * len(centre):
        return False
    for (x, y) in ((w // 4, h // 4), (3 * w // 4, h // 4), (w // 4, 3 * h // 4), (3 * w // 4, 3 * h // 4)):
        zone = [(x + dx, y + dy) for dx in range(-r * 4, r * 4 + 1, r) for dy in range(-r * 4, r * 4 + 1, r)]
        if all(_sombre_opaque(px, a, b, fond) for (a, b) in zone):
            return False
    return True


def retirer_fond(im):
    """Remplissage depuis les bords sur les pixels sombres ; alpha progressif
    sur la frange, couleur dé-prémultipliée depuis le noir."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    fond = min(max(px[0, 0][:3]), 16)
    vu = bytearray(w * h)
    file = deque()
    for x in range(w):
        file.append((x, 0)); file.append((x, h - 1))
    for y in range(h):
        file.append((0, y)); file.append((w - 1, y))
    while file:
        x, y = file.popleft()
        i = y * w + x
        if vu[i]:
            continue
        vu[i] = 1
        r, g, b, a = px[x, y]
        m = max(r, g, b) - fond
        if a > 0 and m > SEUIL_HAUT:
            continue                          # la lueur : on s'arrête
        if m <= SEUIL_BAS or a == 0:
            px[x, y] = (0, 0, 0, 0)
        else:
            k = (m - SEUIL_BAS) / float(SEUIL_HAUT - SEUIL_BAS)
            na = max(1, int(round(a * k)))
            # Vu sur du noir, le pixel valait couleur × k : on rend la couleur.
            px[x, y] = (min(255, int(r / k)), min(255, int(g / k)), min(255, int(b / k)), na)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not vu[ny * w + nx]:
                file.append((nx, ny))
    return im


def a_fond_opaque(im):
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    return all(px[x, y][3] > 250 for (x, y) in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)))


def ajuster(im, taille):
    """Rogné à son contenu, puis posé au centre d'un canevas transparent de
    `taille`, sans déformation."""
    bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if bb:
        im = im.crop(bb)
    W, H = taille
    k = min(W / im.width, H / im.height)
    nw, nh = max(1, round(im.width * k)), max(1, round(im.height * k))
    im = im.resize((nw, nh), Image.LANCZOS)
    c = Image.new('RGBA', taille, (0, 0, 0, 0))
    c.paste(im, ((W - nw) // 2, (H - nh) // 2), im)
    return c


def _couture(cout, n, m, fenetre):
    """La couture de coût minimal (programmation dynamique, comme le
    « seam carving ») : pour chaque indice i de 0 à n-1, une position p(i)
    dans `fenetre`, qui ne varie que d'un cran d'un i au suivant. `cout(i, p)`
    est le coût de traverser (i, p). Rend la liste des p."""
    lo, hi = fenetre
    larg = hi - lo
    INF = float('inf')
    tot = [cout(0, lo + k) for k in range(larg)]
    pere = []
    for i in range(1, n):
        nv, pr = [INF] * larg, [0] * larg
        for k in range(larg):
            best, bk = tot[k], k
            if k > 0 and tot[k - 1] < best:
                best, bk = tot[k - 1], k - 1
            if k < larg - 1 and tot[k + 1] < best:
                best, bk = tot[k + 1], k + 1
            nv[k] = best + cout(i, lo + k)
            pr[k] = bk
        tot = nv
        pere.append(pr)
    k = min(range(larg), key=lambda z: tot[z])
    chemin = [k]
    for pr in reversed(pere):
        k = pr[k]
        chemin.append(k)
    chemin.reverse()
    return [lo + z for z in chemin]


def decouper(chemin, cle, verifier):
    """Les quatre paliers d'une planche, sans couper ce qui déborde.

    Un découpage en quatre quarts ne marche pas : les ailes et les éclairs des
    paliers III et IV montent au-dessus de la ligne du milieu, si bien que les
    quarts du haut en ramassaient des morceaux et que ceux du bas étaient
    tranchés net. Et les quatre médaillons se touchent par leurs lueurs.

    On retire donc le fond de la planche entière, puis on trace trois
    COUTURES de moindre contenu (somme des alphas traversés) : une
    horizontale qui serpente entre les deux rangées, et une verticale dans
    chaque rangée. Elles suivent les vides entre les médaillons et
    contournent les ailes ; quand deux lueurs se touchent, elles passent là
    où elles sont le plus faibles."""
    im = retirer_fond(Image.open(chemin).convert('RGBA'))
    w, h = im.size
    A = im.getchannel('A').load()
    px = im.load()
    # Horizontale : une ligne par colonne, cherchée entre 30 % et 70 % de la
    # hauteur. Le +1 préfère la ligne droite à coût égal.
    hor = _couture(lambda x, y: A[x, y] + 1, w, h, (int(h * 0.3), int(h * 0.7)))
    # Verticales : dans chaque rangée, seuls comptent les pixels de la rangée.
    haut = _couture(lambda y, x: (A[x, y] if y < hor[x] else 0) + 1, h, w, (int(w * 0.3), int(w * 0.7)))
    bas = _couture(lambda y, x: (A[x, y] if y >= hor[x] else 0) + 1, h, w, (int(w * 0.3), int(w * 0.7)))
    proprio = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            if y < hor[x]:
                proprio[y * w + x] = 1 if x < haut[y] else 2
            else:
                proprio[y * w + x] = 3 if x < bas[y] else 4
    faits = []
    for q in range(4):
        dst = os.path.join(BRUTS, '%s_%d.png' % (cle, q + 1))
        faits.append(dst)
        if verifier:
            continue
        t = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        tp = t.load()
        for y in range(h):
            base = y * w
            for x in range(w):
                if proprio[base + x] == q + 1:
                    tp[x, y] = px[x, y]
        bb = t.getbbox()
        (t.crop(bb) if bb else t).save(dst, optimize=True)
    return faits


def convertir(chemin, nom, verifier):
    im = Image.open(chemin).convert('RGBA')
    if a_fond_opaque(im):
        im = retirer_fond(im)
    petit = os.path.join(SORTIE, nom + '.webp')
    grand = os.path.join(SORTIE, nom + '-512.webp')
    if not verifier:
        ajuster(im, PETIT).save(petit, 'WEBP', quality=84, alpha_quality=90, method=6)
        ajuster(im, GRAND).save(grand, 'WEBP', quality=86, alpha_quality=92, method=6)
    return petit, grand


def maj_sw(noms, verifier):
    s = open(SW, encoding='utf-8', newline='').read()
    deb, fin = '// badges.py:debut', '// badges.py:fin'
    if deb not in s or fin not in s:
        raise SystemExit('app/sw.js : marqueurs « %s » / « %s » introuvables' % (deb, fin))
    lignes = []
    ligne = ''
    for n in sorted(noms):
        mot = "'%s', " % n
        if len(ligne) + len(mot) > 72:
            lignes.append(ligne.rstrip())
            ligne = ''
        ligne += mot
    if ligne:
        lignes.append(ligne.rstrip().rstrip(','))
    elif lignes:
        lignes[-1] = lignes[-1].rstrip(',')
    corps = ('const MEDAILLONS_COLLECTION = [\n  ' + '\n  '.join(lignes) + '\n]'
             "\n  .map(n => './img/badges/' + n + '.webp');\n") if noms else \
            'const MEDAILLONS_COLLECTION = [];\n'
    i, j = s.index(deb) + len(deb), s.index(fin)
    neuf = s[:i] + '\n' + corps + s[j:]
    if neuf != s and not verifier:
        open(SW, 'w', encoding='utf-8', newline='').write(neuf)
    return neuf != s


def main():
    verifier = '--verifier' in sys.argv[1:]
    if not os.path.isdir(BRUTS):
        raise SystemExit('badges-bruts/ introuvable à la racine du dépôt')
    fichiers = sorted(f for f in os.listdir(BRUTS) if f.lower().endswith('.png'))
    # 1. Les planches d'abord : elles produisent des fichiers à convertir.
    planches = set()
    for f in fichiers:
        m = NOM.match(f)
        if not m or m.group(2):
            continue
        if est_planche(Image.open(os.path.join(BRUTS, f))):
            planches.add(f)
            for d in decouper(os.path.join(BRUTS, f), m.group(1), verifier):
                print('planche  %s -> %s' % (f, os.path.relpath(d, RACINE)))
    if not verifier:
        fichiers = sorted(f for f in os.listdir(BRUTS) if f.lower().endswith('.png'))
    # 2. Chaque visuel, deux tailles.
    noms = []
    for f in fichiers:
        if f in planches:
            continue
        m = NOM.match(f)
        if not m:
            print('ignoré   %s (nom attendu : <clé>.png ou <clé>_<1-4>.png)' % f)
            continue
        nom = f[:-4]
        p, g = convertir(os.path.join(BRUTS, f), nom, verifier)
        noms.append(nom)
        if not verifier:
            print('badge    %-24s %6d o  %6d o' % (nom, os.path.getsize(p), os.path.getsize(g)))
        else:
            print('badge    %s' % nom)
    # 3. Le cache du service worker : les petites tailles.
    if maj_sw(noms, verifier):
        print('sw.js    MEDAILLONS_COLLECTION : %d médaillon(s)%s' % (len(noms), ' (à écrire)' if verifier else ''))


if __name__ == '__main__':
    main()
