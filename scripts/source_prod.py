#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""OU EST LE CODE DE L'APP, DEPUIS LE BUILD 1417.

Il n'est plus dans app/index.html. Le gros du JavaScript vit dans
app/rc-core.<build>.js et la feuille de styles dans app/rc-style.<build>.css,
servis `immutable` pour un an sous un nom qui porte le numero de build : c'est
ce qui evite de renvoyer 1,9 Mo compresses A CHAQUE OUVERTURE de l'app, et qui
fait passer le plafond Hosting de 175 a 3 316 ouvertures par jour.

HUIT OUTILS DU DEPOT LISAIENT `app/index.html` POUR Y CHERCHER DU CODE.
Sans ce module, ils cherchent dans un squelette de 434 Ko : les uns tombent en
disant « introuvable », les autres — les patcheurs — ecriraient dans un fichier
qui ne porte plus ce qu'ils patchent. On leur donne donc une porte unique :

    from source_prod import source_prod, fichier_code, lire, ecrire

  • source_prod()   la page RECONSTITUEE : index.html avec ses deux actifs
                    remis EN LIGNE, A LEUR PLACE. C'est exactement ce que voit
                    _prodSrc() dans la suite de tests, et c'est ce qu'il faut a
                    tout script qui DECOUPE du code ou des styles.
  • fichier_code()  le chemin du fichier qui porte le gros script — a viser
                    quand on ECRIT dans le code.
  • fichier_styles() idem pour la feuille de styles.

⚠ LES FINS DE LIGNE NE SE MELANGENT PAS. index.html est en CRLF et le depot
les stocke tels quels ; les deux actifs extraits sont en LF, parce que
l'analyseur HTML normalisait deja les blocs en ligne et que `String(maFonction)`
doit continuer de rendre des \n. `lire`/`ecrire` n'y touchent pas (newline='').
"""
import io
import os
import re

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(RACINE, 'app')
INDEX = os.path.join(APP, 'index.html')


def lire(chemin):
    with io.open(chemin, encoding='utf-8', newline='') as f:
        return f.read()


def ecrire(chemin, texte):
    with io.open(chemin, 'w', encoding='utf-8', newline='') as f:
        f.write(texte)


def _actif(motif):
    """Le chemin de l'actif reference par index.html, ou None avant le lot."""
    m = re.search(motif, lire(INDEX))
    if not m:
        return None
    p = os.path.join(APP, m.group(1))
    return p if os.path.exists(p) else None


def fichier_code():
    """Le fichier qui porte le gros script — rc-core.<build>.js, ou index.html."""
    return _actif(r'<script src="\./(rc-core\.\d+\.js)"></script>') or INDEX


def fichier_styles():
    """Le fichier qui porte la feuille — rc-style.<build>.css, ou index.html."""
    return _actif(r'<link rel="stylesheet" href="\./(rc-style\.\d+\.css)">') or INDEX


def source_prod():
    """index.html avec ses actifs REMIS EN LIGNE, A LEUR PLACE.

    A leur place, et pas concatenes en queue : des outils lisent cette source
    comme une PAGE — l'un verifie que rien ne suit </html>, un autre ne retire
    les commentaires qu'a l'interieur d'un <script>. Recollee bout a bout, elle
    n'est plus une page, et ces deux-la se trompent en silence.
    """
    s = lire(INDEX)
    for motif, ouvrant, fermant in (
            (r'<link rel="stylesheet" href="\./(rc-style\.\d+\.css)">', '<style>', '</style>'),
            (r'<script src="\./(rc-core\.\d+\.js)"></script>', '<script>', '</script>')):
        m = re.search(motif, s)
        if not m:
            continue
        p = os.path.join(APP, m.group(1))
        if not os.path.exists(p):
            raise SystemExit('actif introuvable : ' + p)
        s = s[:m.start()] + ouvrant + lire(p) + fermant + s[m.end():]
    return s


if __name__ == '__main__':
    s = source_prod()
    print('source reconstituee : %d o' % len(s))
    print('  code    : %s' % os.path.relpath(fichier_code(), RACINE))
    print('  styles  : %s' % os.path.relpath(fichier_styles(), RACINE))
    print('  index   : %d o' % len(lire(INDEX)))
