# -*- coding: utf-8 -*-
"""
Mise a jour des illustrations PECS depuis le guide PDF du 26/08/2026.

POURQUOI UN SCRIPT A PART, et non une passe de seed_exercices.py : celui-ci lit
un .docx, ou chaque exercice est une LIGNE DE TABLEAU — l'image et le nom sont
dans la meme cellule, la correspondance est structurelle et exacte. Le PDF n'a
pas cette structure : il faut apparier une image et un texte par leur POSITION
sur la page. C'est une heuristique, elle peut se tromper, et elle n'a donc rien
a faire dans le chemin qui alimente les 432 fiches. Ici elle est bornee aux
sept pages des pectoraux, et chaque appariement est IMPRIME pour etre relu.

LA REGLE D'APPARIEMENT, mesuree sur le document : l'image commence JUSTE SOUS
son nom — nom en y 155-166, image en y 152-219 — et avant le nom suivant.
Pour chaque nom, on prend donc la premiere image dont le haut tombe dans sa
fenetre [haut du nom - MARGE, haut du nom suivant - MARGE].
  • un nom sans image dans sa fenetre est SAUTE, pas apparie au hasard : le
    guide repete parfois un exercice sans le reillustrer ;
  • deux images dans la meme fenetre — l'ecarte machine en a deux, comme il a
    deux videos — la premiere gagne : l'application ne stocke qu'une
    illustration par exercice.
Un appariement par RANG se decalerait de tout ce qui suit des le premier nom
sans image, et c'est exactement ce qu'il faut eviter : on ecrirait la photo
d'un exercice sur la fiche d'un autre, sans que rien ne le dise.

IDEMPOTENT, comme seed_exercices.py : le fichier n'est reecrit que si son
contenu change, et le script dit lesquels ont bouge.

MEME SORTIE, MEMES REGLAGES : app/exercices/<slug>.webp, largeur 640, qualite
82 — sans quoi les nouvelles illustrations ne ressembleraient pas aux autres.
"""

import io, os, re, sys, hashlib, unicodedata

try:
    import pymupdf
except ImportError:
    sys.exit("pymupdf est requis : pip install pymupdf")
try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow est requis : pip install Pillow")

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST_IMG = os.path.join(RACINE, "app", "exercices")
LARGEUR_MAX = 640
QUALITE = 82
PAGES_PECS = range(26, 33)          # 0-indexe : pages 27 a 33 du guide
MARGE = 8                           # px : l'image peut commencer juste au-dessus du nom

# LES QUATRE ECARTES QUE LE GUIDE A RENOMMES, du nouveau nom vers l'ancien. Les
# deux fichiers existent depuis le seed : l'ancien reste sur les programmes deja
# ecrits, et doit recevoir la meme photo que le nouveau.
MIROIRS = {
    "ecarte-poulie-basse": ["ecarte-poulie-basse-elastique-bas"],
    "ecarte-poulie-basse-en-unilateral": ["ecarte-poulie-basse-elastique-bas-en-unilateral"],
    "ecarte-poulie-haute": ["ecarte-poulie-haute-elastique-haute"],
    "ecarte-poulie-haut-en-unilateral": ["ecarte-poulie-haut-elastique-haut-en-unilateral"],
}


def cle(nom):
    """La MEME normalisation que exKey cote application : sans accents, en
    majuscules, espaces simples. Le slug en decoule directement."""
    s = unicodedata.normalize("NFD", nom)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join(re.sub(r"[^A-Z0-9 ]", " ", s.upper()).split())


def slug(nom):
    return cle(nom).lower().replace(" ", "-")


def encoder(brut):
    im = Image.open(io.BytesIO(brut))
    if im.mode in ("P", "LA", "RGBA"):
        fond = Image.new("RGB", im.size, (255, 255, 255))
        im = im.convert("RGBA")
        fond.paste(im, mask=im.split()[-1])
        im = fond
    else:
        im = im.convert("RGB")
    im.thumbnail((LARGEUR_MAX, LARGEUR_MAX), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=QUALITE, method=6)
    return buf.getvalue()


# LE NOM EST LA PREMIERE LIGNE DE LA CELLULE DE DESCRIPTION, et rien d'autre :
# meme colonne pour toutes les pages (x = 232,9), et entierement en capitales,
# ce que ne sont ni la description, ni « Repos : 02 min », ni la ligne du lien.
#
# NE PAS EXIGER LE PREFIXE « 0) ». Le guide l'oublie parfois — « BUTTERFLY
# UNILATERAL » page 33 —, et un nom manque decale alors tout ce qui suit : cet
# oubli-la donnait sept noms pour huit images, et la video de l'un se serait
# retrouvee sur l'autre.
X_DESCRIPTION = (225, 240)


def titre(ligne):
    txt = "".join(s["text"] for s in ligne.get("spans", [])).strip()
    x0 = ligne["bbox"][0]
    if not (X_DESCRIPTION[0] <= x0 <= X_DESCRIPTION[1]) or not txt or len(txt) > 80:
        return None
    nu = re.sub(r"^\d+\s*\)\s*", "", txt).strip()
    if len(nu) < 4 or nu != nu.upper():
        return None
    return nu


def apparier(page):
    """Rend [(nom, xref)] pour une page, par fenetre verticale."""
    noms = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            n = titre(l)
            if n:
                noms.append((l["bbox"][1], n))
    noms.sort()
    imgs = []
    for info in page.get_images(full=True):
        rects = page.get_image_rects(info[0])
        if rects:
            imgs.append((rects[0].y0, info[0]))
    imgs.sort()

    out, sans = [], []
    for i, (y, nom) in enumerate(noms):
        haut = y - MARGE
        bas = (noms[i + 1][0] - MARGE) if i + 1 < len(noms) else float("inf")
        dans = [x for (yi, x) in imgs if haut <= yi < bas]
        if not dans:
            sans.append(nom)
            continue
        out.append((nom, dans[0], len(dans)))
    return out, sans, len(imgs)


def main(chemin, ecrire):
    doc = pymupdf.open(chemin)
    apparies, sans_image, total_img = [], [], 0

    for ip in PAGES_PECS:
        p, s, n = apparier(doc[ip])
        total_img += n
        for nom, xref, k in p:
            apparies.append((ip + 1, nom, xref, k))
        for nom in s:
            sans_image.append("p%d %s" % (ip + 1, nom))

    print("%d images sur les pages des pectoraux, %d appariees"
          % (total_img, len(apparies)))
    if sans_image:
        print("%d noms sans image dans leur fenetre (sautes, pas devines) :" % len(sans_image))
        for x in sans_image:
            print("   " + x)

    change, identiques, vus = [], 0, set()
    doubles = []
    for page, nom, xref, k in apparies:
        if k > 1:
            doubles.append("p%d %s (%d images, la premiere retenue)" % (page, nom, k))
        sl = slug(nom)
        if sl in vus:
            continue                     # le guide cite deux fois le meme
        vus.add(sl)
        try:
            pix = pymupdf.Pixmap(doc, xref)
            if pix.n - pix.alpha >= 4:
                pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
            data = encoder(pix.tobytes("png"))
        except Exception as e:
            print("  ! %s : image illisible (%s)" % (nom, e))
            continue
        dest = os.path.join(DEST_IMG, sl + ".webp")
        ancien = None
        if os.path.exists(dest):
            with open(dest, "rb") as f:
                ancien = f.read()
        if ancien is not None and hashlib.sha1(ancien).digest() == hashlib.sha1(data).digest():
            identiques += 1
            continue
        change.append((sl, nom, page, len(ancien) if ancien else 0, len(data), ancien is None))
        if ecrire:
            with open(dest, "wb") as f:
                f.write(data)
        # LES ANCIENS NOMS SUIVENT. Le guide a raccourci quatre ecartes — « ECARTE
        # POULIE BASSE ELASTIQUE BAS » est devenu « ECARTE POULIE BASSE » —, et
        # les deux fichiers existent cote a cote depuis le seed. Ne reecrire que
        # le nouveau laisserait l'ancien avec la photo d'avant, sur des
        # programmes deja ecrits qui, eux, portent l'ancien nom.
        for sl2 in MIROIRS.get(sl, []):
            d2 = os.path.join(DEST_IMG, sl2 + ".webp")
            anc2 = open(d2, "rb").read() if os.path.exists(d2) else None
            if anc2 is not None and hashlib.sha1(anc2).digest() == hashlib.sha1(data).digest():
                continue
            change.append((sl2, nom + " (ancien nom)", page,
                           len(anc2) if anc2 else 0, len(data), anc2 is None))
            if ecrire:
                with open(d2, "wb") as f:
                    f.write(data)

    if doubles:
        print("\nplusieurs images pour un meme exercice :")
        for x in doubles:
            print("   " + x)
    print("\n%d inchangees" % identiques)
    print("%d %s :" % (len(change), "ecrites" if ecrire else "a ecrire (essai a blanc)"))
    for sl, nom, page, av, ap, neuf in change:
        print("   p%-3d %-46s %s  %s -> %s o"
              % (page, nom[:46], "NEUVE " if neuf else "maj   ", av or "-", ap))
    return 0


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--ecrire"]
    if not args:
        sys.exit("usage: maj_pecs_pdf.py <guide.pdf> [--ecrire]")
    sys.exit(main(args[0], "--ecrire" in sys.argv))
