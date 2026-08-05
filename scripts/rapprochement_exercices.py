# -*- coding: utf-8 -*-
"""
Rapprochement des exercices HISTORIQUES avec la banque.

CE SCRIPT NE MODIFIE RIEN. Il lit un export de dossier (ou la banque seule) et
produit un rapport : pour chaque nom d'exercice ecrit en texte libre dans les
seances deja enregistrees, la meilleure correspondance dans la banque, avec un
SCORE DE CONFIANCE. C'est tout.

POURQUOI AUCUNE ECRITURE AUTOMATIQUE
  Un rapprochement a 0,72 sur « TIRAGE HORIZONTAL » peut aussi bien designer
  « TIRAGE HORIZONTAL MACHINE » que « TIRAGE HORIZONTAL SERRE » — deux
  exercices differents, deux illustrations differentes, deux consignes
  differentes. Appliquer d'office reviendrait a montrer a un athlete le guide
  d'execution d'un mouvement qu'il ne fait pas, sous une barre chargee.
  Le rapport se lit, se corrige, et c'est un humain qui tranche.

USAGE
  python scripts/rapprochement_exercices.py <banque.json> [export.json]

  Sans export : le script rapproche les noms deja connus de l'application
  (EX_GUIDE_BRUT et SCHEMAS_BRUT dans app/index.html), ce qui donne la couverture
  theorique de la banque.
  Avec un export F-10 : il rapproche les noms REELLEMENT ecrits dans les
  seances de ce dossier.

SORTIE
  Un tableau trie par score croissant — les cas douteux EN PREMIER, parce que
  ce sont eux qu'il faut regarder. Et un fichier CSV a cote, pour annoter.
"""

import os, re, sys, json, csv, unicodedata
from difflib import SequenceMatcher

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Au-dessus : correspondance sure, le nom normalise est identique.
SEUIL_SUR = 1.0
# Entre les deux : a valider a la main.
SEUIL_DOUTE = 0.72


def cle(s):
    """Meme normalisation que exKey() cote application."""
    s = unicodedata.normalize("NFD", str(s or "").upper())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9]+", " ", s)).strip()


def mots(s):
    return [m for m in cle(s).split(" ") if len(m) > 1]


def score(a, b):
    """Combinaison volontairement simple, et EXPLIQUEE :
      - la similarite de sequence attrape les fautes de frappe et les accents ;
      - le recouvrement de mots attrape les inversions (« BARRE CURL » vs
        « CURL BARRE ») que la premiere note mal.
    On garde la plus GENEREUSE des deux, puis on penalise l'ecart de longueur :
    « SQUAT » et « SQUAT BULGARE HALTERE UNILATERAL » se ressemblent beaucoup
    trop pour une mesure de sequence seule.
    """
    ka, kb = cle(a), cle(b)
    if not ka or not kb:
        return 0.0
    if ka == kb:
        return 1.0
    seq = SequenceMatcher(None, ka, kb).ratio()
    ma, mb = set(mots(a)), set(mots(b))
    rec = (len(ma & mb) / max(len(ma), len(mb))) if (ma and mb) else 0.0
    brut = max(seq, rec)
    # Penalite de longueur : 1,0 a longueur egale, 0,6 quand l'un fait le
    # double de l'autre.
    la, lb = len(ka), len(kb)
    ratio = min(la, lb) / max(la, lb)
    return round(brut * (0.6 + 0.4 * ratio), 3)


def noms_historiques(export):
    """Les noms d'exercice REELLEMENT ecrits dans les seances d'un export."""
    out = {}
    def visiter(o):
        if isinstance(o, dict):
            # Une seance de programme : sessions_config[].exercises[].name
            if "name" in o and ("series" in o or "reps" in o):
                n = str(o.get("name") or "").strip()
                if n:
                    out[cle(n)] = n
            # Une seance realisee : sessions[].data{<nom>: {...}}
            if "data" in o and isinstance(o["data"], dict):
                for n in o["data"]:
                    if str(n).strip():
                        out[cle(n)] = str(n)
            for v in o.values():
                visiter(v)
        elif isinstance(o, list):
            for v in o:
                visiter(v)
    visiter(export)
    return out


def noms_application():
    """Repli : les noms que l'application connait deja."""
    src = open(os.path.join(RACINE, "app", "index.html"), encoding="utf-8").read()
    src = src[:src.find("function testExercices")]
    out = {}
    for nom in ("EX_GUIDE_BRUT", "SCHEMAS_BRUT"):
        i = src.find("\nconst " + nom + "=")
        if i < 0:
            continue
        j, prof = i, 0
        while j < len(src):
            if src[j] in "{[":
                prof += 1
            elif src[j] in "}]":
                prof -= 1
                if prof == 0:
                    break
            j += 1
        for m in re.finditer(r"""['"]([^'"]*~[^'"]*)['"]""", src[i:j]):
            for x in m.group(1).split("~"):
                n = x.split("|")[0].strip()
                if n and n == n.upper() and len(n) > 2:
                    out[cle(n)] = n
    return out


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    banque = json.load(open(sys.argv[1], encoding="utf-8"))
    fiches = banque.get("exercices", banque if isinstance(banque, list) else [])
    if not fiches:
        sys.exit("Banque vide ou format inattendu.")

    if len(sys.argv) > 2:
        source = "export " + os.path.basename(sys.argv[2])
        hist = noms_historiques(json.load(open(sys.argv[2], encoding="utf-8")))
    else:
        source = "noms connus de l'application"
        hist = noms_application()

    par_cle = {cle(f["nom"]): f for f in fiches}
    lignes = []
    for k, nom in sorted(hist.items()):
        exact = par_cle.get(k)
        if exact:
            lignes.append((1.0, nom, exact["nom"], exact["slug"], "exact"))
            continue
        best, bs = None, 0.0
        for f in fiches:
            sc = score(nom, f["nom"])
            if sc > bs:
                bs, best = sc, f
        verdict = ("a valider" if bs >= SEUIL_DOUTE else "aucune")
        lignes.append((bs, nom, best["nom"] if best else "", best["slug"] if best else "", verdict))

    lignes.sort(key=lambda x: (x[0], x[1]))

    surs = [l for l in lignes if l[4] == "exact"]
    douteux = [l for l in lignes if l[4] == "a valider"]
    aucuns = [l for l in lignes if l[4] == "aucune"]

    print("=" * 74)
    print("RAPPROCHEMENT — AUCUNE MODIFICATION N'A ETE FAITE")
    print("=" * 74)
    print("  source          : %s" % source)
    print("  noms historiques: %d" % len(lignes))
    print("  banque          : %d fiches" % len(fiches))
    print()
    print("  exacts          : %d" % len(surs))
    print("  a valider (>=%.2f) : %d" % (SEUIL_DOUTE, len(douteux)))
    print("  sans correspondance: %d" % len(aucuns))
    print()
    if aucuns:
        print("  --- SANS CORRESPONDANCE : ils resteront en saisie libre ---")
        for sc, nom, cible, slug, _ in aucuns:
            print("      %-44s (meilleur : %s  %.2f)" % (nom[:44], cible[:28], sc))
        print()
    if douteux:
        print("  --- A VALIDER A LA MAIN, les moins surs d'abord ---")
        for sc, nom, cible, slug, _ in douteux:
            print("      %.2f  %-40s -> %s" % (sc, nom[:40], cible[:32]))
        print()

    dest = os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])),
                        "rapprochement.csv")
    with open(dest, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["score", "nom historique", "candidat banque", "slug", "verdict", "decision"])
        for sc, nom, cible, slug, v in lignes:
            w.writerow([("%.3f" % sc), nom, cible, slug, v, ""])
    print("  Tableau a annoter : %s" % dest)
    print("  La colonne « decision » est a toi. Ce script ne la relit pas :")
    print("  appliquer un rapprochement reste une decision, pas une execution.")


if __name__ == "__main__":
    main()
