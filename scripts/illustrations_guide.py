# -*- coding: utf-8 -*-
"""
LES ILLUSTRATIONS D'EXERCICES, REPRISES DU GUIDE DU COACH — ET SEULEMENT ELLES.

Kevin, 25/09/2026 : « gros bug, les photos des exos sont celles de l'ancienne
version du guide alors que c'est celles-là qu'on utilise ; corrige et optimise
leur qualité ». Constat au moment d'écrire ce script : sur 436 fiches, une
bonne part montrait encore les dessins de catalogue de l'ancien guide, et les
autres ses photos à 248 px de large (médiane) — alors que le guide actuel,
« Guide des méthodes et des exercices de musculation.docx » (6/09/2026),
porte les photos filmées par le coach à 940 px (médiane).

CE QUE FAIT CE SCRIPT, ET RIEN D'AUTRE
  - lit le guide (même lecteur que seed_exercices.py : une ligne de tableau =
    un exercice, l'image dans la cellule de gauche) ;
  - réécrit app/exercices/<slug>.webp pour chaque fiche DÉJÀ connue de l'app
    dont le guide fournit une photo — sous le MÊME nom de fichier ;
  - traite les exercices RENOMMÉS dans le guide par la table RENOMMES : la
    fiche de l'app garde son nom, elle reçoit la photo du nouveau nom ;
  - réécrit app/exercices/index.json (format 2 : dimensions RÉELLES).
  Il ne crée aucune fiche, ne touche ni à la banque (RTDB) ni aux descriptions :
  seed_exercices.py reste l'outil de ce travail-là.

LA QUALITÉ
  - plus grand côté porté à 1000 px (la fiche s'affiche dans une modale de
    480 px : 1000 px couvrent un écran à densité 2) ;
  - réduction LANCZOS puis accentuation légère (masque flou) : la réduction
    adoucit toujours, l'accentuation rend la netteté des contours ;
  - une source de moins de 520 px de large est AGRANDIE jusqu'à 520 px (×2 au
    plus) avant accentuation : affichée à sa taille réelle, elle paraissait
    minuscule, et étirée par le navigateur, pixelisée. Rien n'est inventé,
    c'est une interpolation ;
  - WebP qualité 84, méthode 6.

  Usage : python scripts/illustrations_guide.py [chemin du guide]
  Après : monter CACHE ET PURGE_EXERCICES = CACHE dans app/sw.js — les photos
  changent sous le même nom de fichier, sans purge elles resteraient masquées
  par le cache des appareils déjà équipés.
"""
import os, sys, io, json, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import seed_exercices as SEED
from PIL import Image, ImageFilter

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOSSIER = os.path.join(RACINE, "app", "exercices")
COTE_MAX = 1000
LARGEUR_MIN = 520
QUALITE = 84

# Fiche de l'app (ancien nom) ← ligne du guide (nouveau nom). Vérifiées à
# l'œil le 25/09/2026 sur une planche ancienne image / nouvelle image.
# « extension-de-buste-sur-banc-avec-rowing » n'y est PAS : la ligne « -2 » du
# guide montre une extension simple, pas le rowing.
RENOMMES = {
    "abduction-debout-poulie-elastique": "abduction-debout-poulie",
    "adduction-debout-poulie-elastique": "adduction-debout-poulie",
    "elevation-laterale-poulie-elastique-unilateral": "elevation-laterale-poulie-unilateral",
    "flexion-lateral-de-buste-poulie-elastique": "flexion-lateral-de-buste-poulie",
    "rotation-de-buste-poulie-elastique-haute": "rotation-de-buste-poulie-haute",
    "tirage-horizontal-machine-convergente": "tirage-horizontal-machine-convergente-neutre",
    "tirage-horizontal-machine-unilateral": "tirage-horizontal-machine-unilateral-neutre",
    "extension-de-buste-sur-banc": "extension-de-buste-sur-banc-1",
    "squat-au-belt-squat": "squat-au-belt-squat-version-quads",
    "leg-extention-allonge-haltere": "leg-curl-allonge-haltere",
}


def optimiser(brut):
    im = Image.open(io.BytesIO(brut))
    try:
        im.seek(0)
    except Exception:
        pass
    if im.mode in ("P", "LA", "RGBA", "PA"):
        fond = Image.new("RGB", im.size, (255, 255, 255))
        im = im.convert("RGBA")
        fond.paste(im, mask=im.split()[-1])
        im = fond
    else:
        im = im.convert("RGB")
    w, h = im.size
    if max(w, h) > COTE_MAX:
        k = COTE_MAX / float(max(w, h))
        im = im.resize((round(w * k), round(h * k)), Image.LANCZOS)
        im = im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=55, threshold=2))
    elif w < LARGEUR_MIN:
        k = min(2.0, LARGEUR_MIN / float(w))
        im = im.resize((round(w * k), round(h * k)), Image.LANCZOS)
        im = im.filter(ImageFilter.UnsharpMask(radius=1.4, percent=70, threshold=2))
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=QUALITE, method=6)
    return buf.getvalue(), im.size


def main():
    guide = SEED.trouver_guide(sys.argv[1] if len(sys.argv) > 1 else SEED.DEFAUT_GUIDE)
    print("guide :", os.path.basename(guide))
    zf, exos = SEED.lire_guide(guide)
    parGuide = {SEED.slugifier(e["nom"]): e for e in exos if e["image"]}
    chemin_index = os.path.join(DOSSIER, "index.json")
    idx = json.load(open(chemin_index, encoding="utf-8"))
    fiches = idx["fiches"] if isinstance(idx, dict) else {s: None for s in idx}

    ecrites, inchangees, gardees = 0, 0, []
    avant = apres = 0
    for slug in sorted(fiches):
        source = parGuide.get(slug) or parGuide.get(RENOMMES.get(slug, ""))
        dest = os.path.join(DOSSIER, slug + ".webp")
        if os.path.exists(dest):
            avant += os.path.getsize(dest)
        if not source:
            gardees.append(slug)
            if os.path.exists(dest):
                apres += os.path.getsize(dest)
            continue
        data, _ = optimiser(zf.read("word/media/" + source["image"]))
        apres += len(data)
        if os.path.exists(dest) and hashlib.sha1(open(dest, "rb").read()).digest() == hashlib.sha1(data).digest():
            inchangees += 1
            continue
        with open(dest, "wb") as f:
            f.write(data)
        ecrites += 1

    # L'index porte les dimensions RÉELLES de chaque fichier présent.
    neuf = {}
    for slug in sorted(fiches):
        p = os.path.join(DOSSIER, slug + ".webp")
        if os.path.exists(p):
            with Image.open(p) as im:
                neuf[slug] = [im.size[0], im.size[1]]
    with open(chemin_index, "w", encoding="utf-8") as f:
        f.write(json.dumps({"format": 2, "fiches": neuf}, ensure_ascii=False, separators=(",", ":")))

    ws = sorted(v[0] for v in neuf.values())
    print("photos réécrites     :", ecrites)
    print("déjà à jour          :", inchangees)
    print("sans photo au guide  :", len(gardees), "(image actuelle conservée)")
    print("  ", ", ".join(gardees))
    print("largeur médiane      :", ws[len(ws) // 2], "px")
    print("poids du dossier     : %.1f Mo -> %.1f Mo" % (avant / 1048576.0, apres / 1048576.0))


if __name__ == "__main__":
    main()
