# -*- coding: utf-8 -*-
"""LE DETOURAGE DES MUSCLES SUR LES SILHOUETTES « EVOLUTION » (app/img/corps).

Les quatre cartes z-*.png disent, pour chaque pixel de chair, a quel muscle il
appartient : la valeur vaut le rang du muscle dans CORPS_ZONES_ORDRE multiplie
par CORPS_ZONES_PAS (12), et 0 hors muscle. Le premier jet (build 1368) a ete
calcule hors de l'application, a partir de points poses muscle par muscle, et
son script n'a pas ete garde. CELUI-CI NE LES REFAIT PAS : il RECOUPE les
territoires que Kevin a contestes, un par un, et il est le seul endroit ou ce
decoupage se decide.

    python scripts/corps_zones.py [--sortie DOSSIER] [--verif]

⚠ ON NE PEINT JAMAIS UN PIXEL QUI N'ETAIT PAS DEJA DE LA CHAIR. Chaque decoupe
  se limite aux pixels qui appartiennent deja a l'un des muscles « donneurs »
  nommes. Le fond, la tete, les mains, les genoux, les pieds, le short et — le
  plus important — les traits du dessin, que la carte laisse a zero pour qu'ils
  restent lisibles sous la teinte, ne peuvent pas etre touches. Une decoupe qui
  se tromperait de bord rend au pire un muscle a son voisin, jamais une tache
  sur le fond.

⚠ IDEMPOTENT. Relancer le script sur une carte deja decoupee ne la change pas ;
  `--verif` le rejoue sur les cartes livrees et sort non nul si elles ont
  derive. C'est ce que le controle de deploiement appelle.

⚠ LES COORDONNEES SONT DES MESURES, PAS DES GOUTS. Chaque point a ete releve
  sur le dessin agrandi, grille en surimpression — la clavicule, le sillon
  delto-pectoral, l'epine de l'omoplate, le bord des erecteurs. Les relever de
  tete, c'est la faute que ce fichier existe pour empecher.

────────────────────────────────────────────────────────────────────────────
CE QUE KEVIN A DEMANDE, ET CE QUE CHAQUE DECOUPE REPOND (23/09/2026)

  « les pecs, tu ne montes pas jusqu'a la clavicule »
      → le bord haut du pectoral SUIT la clavicule, qui monte en allant vers
        l'epaule : y 198 au sternum, y 185 sous l'acromion. Une coupe
        horizontale laissait un bandeau gris sur le haut du thorax.

  « les biceps ne sont pas compris en entier, le triceps deborde enormement »
      → DE FACE, le biceps est la masse et le triceps une BANDE sur le bord
        exterieur : 22 % de la largeur du bras, pas 65 %. De dos, l'inverse.

  « les cuisses, il faut que ca soit en entier »
      → le quadriceps (l'ischio de dos) tient la cuisse du haut en bas ;
        l'abducteur garde une bande exterieure, l'adducteur une interieure.

  « les trapezes medians inferieurs, je ne les vois pas »
      → le trapeze se coupe en deux a l'epine de l'omoplate : TRAP_SUP au
        dessus (la pente cou-epaule), TRAP_MED en dessous (entre les
        omoplates). Ils ne recoivent pas les memes exercices — shrug contre
        rowing —, et confondus, le volume de l'un teintait le territoire de
        l'autre.

  « la delimitation des dorsaux touche aux lombaires, c'est pas le but »
      → la separation etait HORIZONTALE : dorsaux en haut, lombaires en bas
        sur toute la largeur. Elle devient VERTICALE, comme l'anatomie : les
        erecteurs tiennent la colonne du milieu, les dorsaux descendent de
        chaque cote jusqu'a la ceinture.
────────────────────────────────────────────────────────────────────────────
"""
import io
import os
import sys

from PIL import Image, ImageDraw

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(RACINE, 'app', 'img', 'corps')

# L'ordre de CORPS_ZONES_ORDRE, dans rc-core : le rang FAIT la valeur du pixel.
# ⚠ TRAP_MED EST EN QUEUE, ET IL DOIT Y RESTER. Inserer un muscle au milieu
#   decalerait la valeur de tous les suivants et rendrait les cartes livrees
#   illisibles d'un seul coup.
ORDRE = ['TRAP_SUP', 'DELT_ANT', 'DELT_LAT', 'DELT_POST', 'PECTORAUX', 'BICEPS',
         'TRICEPS', 'AVANT_BRAS', 'ABDOS', 'DORSAUX', 'LOMBAIRES', 'FESSIERS',
         'ABDUCTEURS', 'ADDUCTEURS', 'QUADRICEPS', 'ISCHIOS', 'MOLLETS',
         'TRAP_MED']
PAS = 12
VAL = dict((m, (i + 1) * PAS) for i, m in enumerate(ORDRE))

# ── LES DECOUPES, CARTE PAR CARTE, DANS L'ORDRE OU ELLES S'APPLIQUENT ───────
#
# `polygone` : tout ce que les `donneurs` tiennent a l'interieur du contour
#              revient a `cible`. Les points sont en pixels de la carte.
# `bandes`   : le partage d'un MEMBRE, ligne par ligne, en fraction de sa
#              largeur a cette hauteur — 0 au bord exterieur, 1 au bord
#              interieur. Le territoire n'est pas invente : c'est exactement
#              ce que les muscles de `territoire` tiennent deja, ce qui laisse
#              les bords — durement acquis — intacts. `mince` : sous cette part
#              de la largeur maximale, la ligne revient entiere a `defaut` (les
#              rangs que l'ourlet du short n'entaille qu'a moitie ; trois
#              bandes sur vingt pixels ne voudraient rien dire).
DECOUPES = {
    # ══════════════ HOMME, VUE AVANT ═══════════════════════════════════════
    'z-h-face.png': [
        # LE THORAX, JUSQUE SOUS LA CLAVICULE. Le trapeze descendait en coin
        # sur le haut du thorax et le deltoide anterieur mordait le bas, pres
        # de l'aisselle. Le bord haut suit la clavicule relevee sur le dessin :
        # (115,183) a l'acromion, (185,196) au creux sternal.
        {'quoi': 'pectoraux', 'type': 'polygone', 'cible': 'PECTORAUX',
         'donneurs': ['TRAP_SUP', 'DELT_ANT'],
         'points': [(108, 193), (122, 186), (150, 189), (180, 199), (210, 189),
                    (238, 186), (252, 193), (252, 292), (108, 292)]},
        # L'EPAULE DE FACE SE PARTAGE EN DEUX MOITIES. La carte coupait sur une
        # VERTICALE fixe, et le pectoral rendu a sa taille n'a plus laisse au
        # deltoide anterieur qu'un liseré de seize pixels — alors que c'est LUI
        # qu'on voit de face, le lateral n'apparaissant qu'au bord externe.
        {'quoi': 'epaules', 'type': 'bandes', 'territoire': ['DELT_ANT', 'DELT_LAT'],
         'y': (177, 272), 'bandes': [('DELT_LAT', 0.5), ('DELT_ANT', 1.0)]},
        # LE BRAS DE FACE : le biceps est la masse, le triceps une bande.
        {'quoi': 'bras', 'type': 'bandes', 'territoire': ['BICEPS', 'TRICEPS'],
         'y': (255, 356), 'bandes': [('TRICEPS', 0.22), ('BICEPS', 1.0)]},
        # LA CUISSE ENTIERE AU QUADRICEPS.
        {'quoi': 'cuisses', 'type': 'bandes',
         'territoire': ['ABDUCTEURS', 'QUADRICEPS', 'ADDUCTEURS'],
         'y': (498, 636), 'mince': 0.6, 'defaut': 'QUADRICEPS',
         'bandes': [('ABDUCTEURS', 0.15), ('QUADRICEPS', 0.83), ('ADDUCTEURS', 1.0)]},
    ],
    # ══════════════ FEMME, VUE AVANT ═══════════════════════════════════════
    'z-f-face.png': [
        # Meme thorax, meme clavicule : (92,187) a l'acromion, (154,196) au
        # creux sternal — elle est plus plate que chez l'homme.
        {'quoi': 'pectoraux', 'type': 'polygone', 'cible': 'PECTORAUX',
         'donneurs': ['TRAP_SUP', 'DELT_ANT'],
         'points': [(110, 190), (124, 187), (140, 191), (155, 197), (170, 191),
                    (186, 187), (202, 190), (206, 269), (110, 269)]},
        {'quoi': 'epaules', 'type': 'bandes', 'territoire': ['DELT_ANT', 'DELT_LAT'],
         'y': (190, 260), 'bandes': [('DELT_LAT', 0.5), ('DELT_ANT', 1.0)]},
        {'quoi': 'bras', 'type': 'bandes', 'territoire': ['BICEPS', 'TRICEPS'],
         'y': (250, 340), 'bandes': [('TRICEPS', 0.22), ('BICEPS', 1.0)]},
        {'quoi': 'cuisses', 'type': 'bandes',
         'territoire': ['ABDUCTEURS', 'QUADRICEPS', 'ADDUCTEURS'],
         'y': (465, 600), 'mince': 0.6, 'defaut': 'QUADRICEPS',
         'bandes': [('ABDUCTEURS', 0.15), ('QUADRICEPS', 0.83), ('ADDUCTEURS', 1.0)]},
    ],
    # ══════════════ HOMME, VUE ARRIERE ═════════════════════════════════════
    'z-h-dos.png': [
        # LE TRAPEZE SE COUPE A L'EPINE DE L'OMOPLATE, relevee a y 225 sur le
        # dessin : au-dessus la pente cou-epaule, en dessous le losange entre
        # les omoplates, qui descend en pointe jusqu'a y 300.
        {'quoi': 'trapeze moyen', 'type': 'polygone', 'cible': 'TRAP_MED',
         'donneurs': ['TRAP_SUP'],
         'points': [(96, 225), (264, 225), (264, 305), (96, 305)]},
        # LES LOMBAIRES DEVIENNENT UNE COLONNE. D'abord tout le bas du dos
        # revient aux dorsaux — ils descendent jusqu'a la ceinture, de chaque
        # cote —, puis la colonne des erecteurs se reprend au milieu.
        {'quoi': 'flancs', 'type': 'polygone', 'cible': 'DORSAUX',
         'donneurs': ['LOMBAIRES'],
         'points': [(60, 316), (300, 316), (300, 432), (60, 432)]},
        {'quoi': 'lombaires', 'type': 'polygone', 'cible': 'LOMBAIRES',
         'donneurs': ['DORSAUX'],
         'points': [(158, 318), (202, 318), (210, 360), (214, 428), (146, 428),
                    (150, 360)]},
        # LE BRAS DE DOS : le triceps est la masse, le biceps une bande
        # interieure — l'inverse de la vue avant, et c'est ce qu'on voit.
        {'quoi': 'bras', 'type': 'bandes', 'territoire': ['BICEPS', 'TRICEPS'],
         'y': (246, 348), 'bandes': [('TRICEPS', 0.74), ('BICEPS', 1.0)]},
        {'quoi': 'cuisses', 'type': 'bandes',
         'territoire': ['ABDUCTEURS', 'ISCHIOS', 'ADDUCTEURS'],
         'y': (525, 646), 'mince': 0.6, 'defaut': 'ISCHIOS',
         'bandes': [('ABDUCTEURS', 0.15), ('ISCHIOS', 0.83), ('ADDUCTEURS', 1.0)]},
    ],
    # ══════════════ FEMME, VUE ARRIERE ═════════════════════════════════════
    'z-f-dos.png': [
        # Epine de l'omoplate a y 213. Le trapeze de la carte s'arretait a 235 :
        # le losange entre les omoplates etait compte dans les dorsaux, et le
        # trapeze moyen n'avait nulle part ou s'afficher. Deux decoupes, donc :
        # la moitie basse du trapeze, puis ce que les dorsaux tenaient au
        # milieu du haut du dos.
        {'quoi': 'trapeze moyen', 'type': 'polygone', 'cible': 'TRAP_MED',
         'donneurs': ['TRAP_SUP'],
         'points': [(86, 213), (224, 213), (224, 290), (86, 290)]},
        {'quoi': 'losange interscapulaire', 'type': 'polygone', 'cible': 'TRAP_MED',
         'donneurs': ['DORSAUX'],
         'points': [(122, 232), (188, 232), (178, 268), (155, 292), (132, 268)]},
        {'quoi': 'flancs', 'type': 'polygone', 'cible': 'DORSAUX',
         'donneurs': ['LOMBAIRES'],
         'points': [(50, 306), (260, 306), (260, 412), (50, 412)]},
        {'quoi': 'lombaires', 'type': 'polygone', 'cible': 'LOMBAIRES',
         'donneurs': ['DORSAUX'],
         'points': [(136, 308), (174, 308), (181, 346), (185, 408), (125, 408),
                    (129, 346)]},
        {'quoi': 'bras', 'type': 'bandes', 'territoire': ['BICEPS', 'TRICEPS'],
         'y': (252, 342), 'bandes': [('TRICEPS', 0.74), ('BICEPS', 1.0)]},
        {'quoi': 'cuisses', 'type': 'bandes',
         'territoire': ['ABDUCTEURS', 'ISCHIOS', 'ADDUCTEURS'],
         'y': (497, 614), 'mince': 0.6, 'defaut': 'ISCHIOS',
         'bandes': [('ABDUCTEURS', 0.15), ('ISCHIOS', 0.83), ('ADDUCTEURS', 1.0)]},
    ],
}


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


def decouper_polygone(px, W, H, o):
    """Le contour rend son interieur a `cible`, sur les seuls donneurs."""
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon([tuple(p) for p in o['points']], fill=255)
    mp = m.load()
    cible, donneurs, n = VAL[o['cible']], set(o['donneurs']), 0
    for y in range(H):
        for x in range(W):
            if mp[x, y] and _muscle(px[x, y]) in donneurs:
                px[x, y] = cible
                n += 1
    return n


def decouper_bandes(px, W, H, o, cx):
    """Le partage d'un membre, ligne par ligne et cote par cote.

    ⚠ LE TERRITOIRE NE BOUGE PAS, seul son partage change : on reprend
      exactement les pixels que les muscles de `territoire` tiennent deja.
    """
    y0, y1 = o['y']
    terr = set(o['territoire'])
    bandes = o['bandes']
    mince = o.get('mince')
    defaut = o.get('defaut')
    large = {'g': 1.0, 'd': 1.0}
    rangs = []
    for y in range(max(0, y0), min(H, y1)):
        xs = [x for x in range(W) if _muscle(px[x, y]) in terr]
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
            if mince is not None and part < mince:
                m = defaut
            else:
                m = bandes[-1][0]
                for (mus, f) in bandes:
                    if t < f:
                        m = mus
                        break
            if m and px[x, y] != VAL[m]:
                px[x, y] = VAL[m]
                n += 1
    return n


def decouper(nom, liste):
    im = Image.open(os.path.join(IMG, nom))
    if im.mode != 'L':
        im = im.convert('L')
    W, H = im.size
    px = im.load()
    faits = []
    for o in liste:
        if o['type'] == 'polygone':
            n = decouper_polygone(px, W, H, o)
        else:
            cx = _centre(px, W, H, set(o['territoire']))
            n = decouper_bandes(px, W, H, o, cx)
        faits.append('%s %d px' % (o['quoi'], n))
    return im, faits


def main(argv):
    sortie = IMG
    verif = '--verif' in argv
    if '--sortie' in argv:
        sortie = argv[argv.index('--sortie') + 1]
    ecarts = 0
    for nom in sorted(DECOUPES):
        im, faits = decouper(nom, DECOUPES[nom])
        tampon = io.BytesIO()
        im.save(tampon, format='PNG', optimize=True)
        if verif:
            with open(os.path.join(IMG, nom), 'rb') as f:
                vieux = f.read()
            # On compare les PIXELS, pas les octets : deux versions de zlib ne
            # compressent pas pareil, et ce n'est pas ce qu'on verifie.
            pareil = Image.open(io.BytesIO(vieux)).convert('L').tobytes() == im.tobytes()
            print('%s %s  (%s)' % ('  ok ' if pareil else 'ECART', nom, ', '.join(faits)))
            ecarts += 0 if pareil else 1
        else:
            with open(os.path.join(sortie, nom), 'wb') as f:
                f.write(tampon.getvalue())
            print('%s  %s  (%d octets)' % (nom, ', '.join(faits), len(tampon.getvalue())))
    if verif and ecarts:
        print('%d carte(s) ne sont pas celles que le script produit.' % ecarts)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
