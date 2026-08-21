# -*- coding: utf-8 -*-
"""Transpose les gabarits de muscles sur les 28 planches et sort les contours.

Le gabarit donne une fraction de membre ; la planche donne la largeur reelle
de ce membre a chaque ligne. Le produit des deux, c'est la forme du muscle sur
CE dessin-la. Rien n'est partage entre les niveaux sauf le gabarit.
"""
import numpy as np
from chart import chart, files, xseg, ytop
import muscles as MU

SUB = 8          # points interpoles entre deux points de controle
DEC = 1          # decimales conservees dans le chemin exporte
AR = 118.0 / 56.0  # rapport hauteur/largeur de la vignette affichee


def _catmull(p0, p1, p2, p3, n):
    """Spline fermee de Catmull-Rom entre p1 et p2."""
    out = []
    for i in range(n):
        t = i / float(n)
        t2, t3 = t * t, t * t * t
        out.append(tuple(
            0.5 * ((2 * a1) + (-a0 + a2) * t + (2 * a0 - 5 * a1 + 4 * a2 - a3) * t2
                   + (-a0 + 3 * a1 - 3 * a2 + a3) * t3)
            for a0, a1, a2, a3 in zip(p0, p1, p2, p3)))
    return out


def lisse(pts, n=SUB):
    """Arrondit le polygone de controle. Un muscle n'a pas d'angle vif."""
    k = len(pts)
    out = []
    for i in range(k):
        out += _catmull(pts[(i - 1) % k], pts[i], pts[(i + 1) % k],
                        pts[(i + 2) % k], n)
    return out


def mirror(pts):
    return [(v, MU.MIROIR[s], 1.0 - t) for (v, s, t) in pts]


def enpixels(c, pts):
    """(v, segment, t) -> (x, y) en pixels de la planche."""
    vt = lisse([(v, t) for (v, s, t) in pts])
    seg = pts[0][1]
    # Un bras s'arrete au bout des doigts : au-dela les releves ne veulent
    # plus rien dire et prolongeraient l'avant-bras jusqu'au sol.
    ymin, ymax = 0, c['H'] - 1
    if seg in ('AL', 'AR'):
        ymin, ymax = c['ySh'], c['yArmBot']
    out = []
    for (v, t) in vt:
        y = max(ymin, min(ymax, ytop(c, v)))
        out.append((xseg(c, y, seg, t), y))
    return out


def formes(c):
    """{muscle: [polygone en % de la vignette, ...]} pour une planche."""
    tab = MU.VUE[c['v']]
    res = {}
    for nom, d in sorted(tab.items()):
        jeux = [d['pts']] + ([mirror(d['pts'])] if d['mir'] else [])
        res[nom] = [enpixels(c, p) for p in jeux]
    return res


def pct(c, poly, eps=0.0):
    """Vers le repere de la vignette, en centiemes, allege.

    La spline est echantillonnee finement pour etre rasterisee juste ; le
    chemin exporte, lui, n'a pas besoin d'un point tous les demi-pixels.
    Douglas-Peucker enleve tout ce qui ne se voit pas a la taille d'affichage.
    """
    import cv2
    W, H = float(c['W']), float(c['H'])
    a = np.array([[x / W * 100.0, y / H * 100.0] for (x, y) in poly], np.float32)
    if eps > 0:
        # La vignette est affichee 56 px de large pour 118 de haut : un
        # centieme de hauteur pese deux fois un centieme de largeur A L'ECRAN.
        # On simplifie donc dans le repere de l'affichage, pas dans celui du
        # fichier, sinon le contour se casse en escalier sur la verticale.
        b = a.copy(); b[:, 1] *= AR
        # Le meme ecart absolu ne coute pas la meme chose a une masse et a une
        # bandelette : sur le trapeze, large de trois centiemes, un demi-
        # centieme mange un sixieme du muscle. La tolerance suit donc
        # l'EPAISSEUR de la forme (2 x aire / perimetre).
        cnt = b.reshape(-1, 1, 2).astype(np.float32)
        aire = abs(cv2.contourArea(cnt)); per = cv2.arcLength(cnt, True)
        ep = (2.0 * aire / per) if per > 0 else 1.0
        e = min(eps, max(0.18, ep * 0.13))
        b = cv2.approxPolyDP(cnt, e, True).reshape(-1, 2)
        b[:, 1] /= AR
        a = b
    return [(round(float(x), DEC), round(float(y), DEC)) for (x, y) in a]


def build(eps=0.5):
    out = {}
    for g, v, n, f in files():
        c = chart(g, v, n, f)
        out.setdefault(g, {}).setdefault(v, {})[str(n)] = {
            m: [pct(c, p, eps) for p in polys] for m, polys in formes(c).items()}
    return out


if __name__ == '__main__':
    import json
    d = build()
    s = json.dumps(d, separators=(',', ':'))
    print('octets JSON :', len(s))
    for g in d:
        for v in d[g]:
            ms = d[g][v]['4']
            print(g, v, len(ms), 'muscles,',
                  sum(len(p) for m in ms.values() for p in m), 'points (niveau 4)')
