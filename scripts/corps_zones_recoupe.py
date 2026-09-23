# -*- coding: utf-8 -*-
"""LE DETOURAGE DES MUSCLES SUR LES SILHOUETTES « EVOLUTION » (app/img/corps).

Kevin, 23/09/2026, la silhouette sous les yeux : « le detourage au niveau des
pecs est incomplet, tu peux monter en haut et selectionner correctement les
pecs ; les biceps, l'entourage est mauvais aussi, il englobe le triceps ; les
cuisses, il faut que ca soit en entier ».

Les quatre cartes z-*.png disent, pour chaque pixel de chair, a quel muscle il
appartient : la valeur vaut le rang du muscle dans CORPS_ZONES_ORDRE multiplie
par CORPS_ZONES_PAS (12), et 0 hors muscle. Elles ont ete calculees une fois
hors de l'application (build 1368) et le script qui les a produites n'a pas ete
garde. CELUI-CI NE LES REFAIT PAS : il RECOUPE trois territoires, et seulement
eux.

⚠ ON NE PEINT JAMAIS UN PIXEL QUI N'ETAIT PAS DEJA DE LA CHAIR. Chaque
  recoupe se limite aux pixels qui appartiennent deja a l'un des muscles
  « donneurs » nommes. Le fond, la tete, les mains, les genoux, les pieds, le
  short et — c'est le plus important — les traits du dessin, que la carte
  laisse a zero pour qu'ils restent lisibles sous la teinte, ne peuvent pas
  etre touches. Un detourage qui se tromperait de bord rendrait donc au pire
  un muscle a son voisin, jamais une tache sur le fond.

⚠ IDEMPOTENT. Relancer le script sur une carte deja recoupee ne la change pas :
  la recoupe des pecs n'a plus rien a convertir, et les deux partages rendent
  le meme trait sur le meme territoire. On peut donc le rejouer sur les cartes
  livrees pour verifier qu'elles sont bien celles qu'il produit.

    python scripts/corps_zones_recoupe.py [--sortie DOSSIER] [--verif]

`--verif` ne reecrit rien et sort non nul si une carte livree differe de ce que
le script produit : c'est ce que le controle de deploiement appelle.
"""
import io
import os
import sys

from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(RACINE, 'app', 'img', 'corps')

# L'ordre de CORPS_ZONES_ORDRE, dans rc-core : le rang FAIT la valeur du pixel.
ORDRE = ['TRAP_SUP', 'DELT_ANT', 'DELT_LAT', 'DELT_POST', 'PECTORAUX', 'BICEPS',
         'TRICEPS', 'AVANT_BRAS', 'ABDOS', 'DORSAUX', 'LOMBAIRES', 'FESSIERS',
         'ABDUCTEURS', 'ADDUCTEURS', 'QUADRICEPS', 'ISCHIOS', 'MOLLETS']
PAS = 12
VAL = dict((m, (i + 1) * PAS) for i, m in enumerate(ORDRE))

# ── CE QUI EST RECOUPE, CARTE PAR CARTE ────────────────────────────────────
#
# `pecs`    La boite du THORAX, en pixels de la carte. Tout ce que le trapeze
#           et le deltoide anterieur y tiennent revient au pectoral. Le trapeze
#           descendait en coin sur le haut du thorax (le pec ne commencait qu'a
#           mi-hauteur, sur les cotes) et le deltoide anterieur mordait le bas
#           du thorax pres de l'aisselle : c'est ce que Kevin voit comme un
#           « detourage incomplet ». La boite s'arrete AVANT l'epaule — le
#           sillon delto-pectoral —, sans quoi le pectoral deborderait sur le
#           moignon de l'epaule.
#
# `bras`    Le partage du bras entre biceps et triceps, ligne par ligne, en
#           fraction de la largeur du bras a cette hauteur. DE FACE, le biceps
#           est la masse ; le triceps ne se voit qu'en bande, sur le bord
#           EXTERIEUR. La carte de l'homme disait l'inverse (triceps 5 092 px,
#           biceps 1 865) — celle de la femme, elle, etait deja juste, et n'est
#           pas touchee.
#
# `cuisses` Le partage de la cuisse entre abducteurs, muscle du milieu et
#           adducteurs, en fractions de sa largeur. L'abducteur prenait TOUTE
#           la largeur du haut de la cuisse et le quadriceps ne commencait qu'a
#           mi-cuisse : « il faut que ca soit en entier ». Il garde une bande
#           exterieure, l'adducteur une bande interieure, et la cuisse tient du
#           haut en bas.
#           `milieu` : le quadriceps de face, l'ischio de dos. MEME DEFAUT DES
#           DEUX COTES, et la meme correction : Kevin n'a vu que la vue avant
#           (le bouton « Vue arriere » ne rendait rien, corrige au meme build),
#           mais une cuisse est une cuisse, et livrer la carte arriere avec le
#           defaut qu'il vient de faire corriger devant n'aurait aucun sens.
#           `mince` : sous cette part de la largeur maximale, la ligne revient
#           entiere au muscle du milieu. Ce sont les rangs que l'ourlet du short
#           n'entaille qu'a moitie : trois bandes sur vingt pixels ne
#           voudraient rien dire, et la bande « interieure » y tomberait au
#           milieu de la cuisse.
RECOUPES = {
    'z-h-face.png': {
        'pecs':    {'y': (194, 276), 'x': (112, 251)},
        'bras':    {'y': (255, 356), 'exterieur': 0.35},
        'cuisses': {'y': (498, 636), 'milieu': 'QUADRICEPS',
                    'exterieur': 0.15, 'interieur': 0.17, 'mince': 0.6},
    },
    'z-f-face.png': {
        'pecs':    {'y': (193, 269), 'x': (114, 209)},
        'cuisses': {'y': (465, 600), 'milieu': 'QUADRICEPS',
                    'exterieur': 0.15, 'interieur': 0.17, 'mince': 0.6},
    },
    'z-h-dos.png': {
        'cuisses': {'y': (525, 646), 'milieu': 'ISCHIOS',
                    'exterieur': 0.15, 'interieur': 0.17, 'mince': 0.6},
    },
    'z-f-dos.png': {
        'cuisses': {'y': (497, 614), 'milieu': 'ISCHIOS',
                    'exterieur': 0.15, 'interieur': 0.17, 'mince': 0.6},
    },
}


def _charger(chemin):
    im = Image.open(chemin)
    if im.mode != 'L':
        im = im.convert('L')
    return im


def _muscle(v):
    return ORDRE[int(round(v / float(PAS))) - 1] if v else None


def _centre(px, W, H, muscles):
    """L'abscisse qui separe le cote gauche du cote droit : le milieu de la
    boite des muscles nommes. Elle se mesure, elle ne se suppose pas — les deux
    silhouettes n'ont ni la meme largeur ni le meme centre."""
    a, b = W, 0
    for y in range(H):
        for x in range(W):
            if _muscle(px[x, y]) in muscles:
                if x < a:
                    a = x
                if x > b:
                    b = x
    return (a + b) / 2.0 if b >= a else W / 2.0


def _plages(px, W, y, muscles):
    """Les x du rang `y` qui appartiennent a l'un des muscles nommes."""
    return [x for x in range(W) if _muscle(px[x, y]) in muscles]


def recouper_pecs(px, W, H, o):
    """Le thorax revient au pectoral, sauf ce que le dessin laisse a zero."""
    y0, y1 = o['y']
    x0, x1 = o['x']
    n = 0
    for y in range(max(0, y0), min(H, y1)):
        for x in range(max(0, x0), min(W, x1)):
            if _muscle(px[x, y]) in ('TRAP_SUP', 'DELT_ANT'):
                px[x, y] = VAL['PECTORAUX']
                n += 1
    return n


def _partager(px, W, H, o, muscles, cx, attribuer):
    """Le squelette des deux partages : pour chaque rang et chaque cote, on
    mesure le territoire EXISTANT, puis `attribuer` dit, pour une position
    donnee en fraction de cette largeur, quel muscle prend le pixel.

    ⚠ LE TERRITOIRE NE BOUGE PAS, seul son partage change. On ne mesure jamais
      le bras ou la cuisse sur le dessin : on reprend exactement les pixels que
      les muscles nommes tiennent deja, ce qui laisse les bords — durement
      acquis — intacts.
    """
    y0, y1 = o['y']
    large = {'g': 1.0, 'd': 1.0}
    rangs = []
    for y in range(max(0, y0), min(H, y1)):
        xs = _plages(px, W, y, muscles)
        for cote in ('g', 'd'):
            c = [x for x in xs if (x < cx if cote == 'g' else x >= cx)]
            if len(c) < 2:
                continue
            a, b = min(c), max(c)
            rangs.append((y, cote, a, b, c))
            if b - a > large[cote]:
                large[cote] = float(b - a)
    n = 0
    for (y, cote, a, b, c) in rangs:
        part = (b - a) / large[cote]
        for x in c:
            # t : 0 au bord EXTERIEUR du membre, 1 a son bord interieur.
            t = (x - a) / float(b - a)
            if cote == 'd':
                t = 1.0 - t
            m = attribuer(t, part)
            if m and px[x, y] != VAL[m]:
                px[x, y] = VAL[m]
                n += 1
    return n


def recouper_bras(px, W, H, o, cx):
    f = o['exterieur']
    return _partager(px, W, H, o, ('BICEPS', 'TRICEPS'), cx,
                     lambda t, part: 'TRICEPS' if t < f else 'BICEPS')


def recouper_cuisses(px, W, H, o, cx):
    fe, fi, mince, mi = o['exterieur'], o['interieur'], o['mince'], o['milieu']

    def attribuer(t, part):
        if part < mince:
            return mi
        if t < fe:
            return 'ABDUCTEURS'
        if t > 1.0 - fi:
            return 'ADDUCTEURS'
        return mi

    return _partager(px, W, H, o, ('ABDUCTEURS', mi, 'ADDUCTEURS'),
                     cx, attribuer)


def recouper(nom, o):
    im = _charger(os.path.join(IMG, nom))
    W, H = im.size
    px = im.load()
    faits = []
    if 'pecs' in o:
        faits.append('pecs %d px' % recouper_pecs(px, W, H, o['pecs']))
    if 'bras' in o:
        cx = _centre(px, W, H, ('BICEPS', 'TRICEPS'))
        faits.append('bras %d px' % recouper_bras(px, W, H, o['bras'], cx))
    if 'cuisses' in o:
        cx = _centre(px, W, H, ('ABDUCTEURS', 'QUADRICEPS', 'ADDUCTEURS'))
        faits.append('cuisses %d px' % recouper_cuisses(px, W, H, o['cuisses'], cx))
    return im, faits


def main(argv):
    sortie, verif = IMG, False
    if '--verif' in argv:
        verif = True
    if '--sortie' in argv:
        sortie = argv[argv.index('--sortie') + 1]
    ecarts = 0
    for nom in sorted(RECOUPES):
        im, faits = recouper(nom, RECOUPES[nom])
        tampon = io.BytesIO()
        im.save(tampon, format='PNG', optimize=True)
        neuf = tampon.getvalue()
        chemin = os.path.join(sortie, nom)
        if verif:
            with open(os.path.join(IMG, nom), 'rb') as f:
                vieux = f.read()
            # On compare les PIXELS, pas les octets : deux versions de zlib ne
            # compressent pas pareil, et ce n'est pas ce qu'on verifie.
            pareil = Image.open(io.BytesIO(vieux)).convert('L').tobytes() \
                == im.tobytes()
            print('%s %s  (%s)' % ('  ok ' if pareil else 'ECART',
                                   nom, ', '.join(faits)))
            ecarts += 0 if pareil else 1
        else:
            with open(chemin, 'wb') as f:
                f.write(neuf)
            print('%s  %s  (%d octets)' % (nom, ', '.join(faits), len(neuf)))
    if verif and ecarts:
        print('%d carte(s) ne sont pas celles que le script produit.' % ecarts)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
