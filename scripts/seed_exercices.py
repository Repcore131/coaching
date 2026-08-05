# -*- coding: utf-8 -*-
"""
Seeding de la banque d'exercices RepCore.

SOURCE DE VERITE : « Guide des methodes et des exercices de musculation.docx ».
Ce script en extrait, pour chaque exercice, son illustration, sa description
d'execution, son temps de repos et ses liens video, puis il croise ces donnees
avec la classification musculaire et le schema moteur DEJA presents dans
app/index.html (EX_GUIDE_BRUT, SCHEMAS_BRUT). Les deux moities se rejoignent
sur le nom normalise : la banque de l'application vient de ce guide, la
correspondance est exacte et non approximative.

IDEMPOTENT : la cle est le slug. Relance sans creer de doublon, et sans
reecrire un fichier dont le contenu n'a pas change (l'horodatage du depot
reste propre).

CE QU'IL PRODUIT
  app/exercices/<slug>.webp   les illustrations, versionnees dans le depot
  <sortie>/banque.json        les metadonnees, NON versionnees (voir plus bas)

POURQUOI banque.json N'EST PAS DANS LE DEPOT
  Le depot est public : tout ce qu'on y met est lisible par n'importe qui, y
  compris par un athlete. Le seul controle d'acces reel dont dispose ce projet
  est database.rules.json. Les metadonnees vont donc dans le noeud RTDB
  /exercices, en lecture reservee aux coachs, et ce fichier n'est qu'un
  intermediaire a televerser.
  Les IMAGES, elles, restent publiques et c'est assume : les proteger
  demanderait un serveur, que ce projet n'a pas.

Aucune dependance a installer : Pillow suffit, et il est deja present.
"""

import os, sys, io, re, json, zipfile, hashlib, unicodedata
from collections import Counter

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow est requis : pip install Pillow")

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST_IMG = os.path.join(RACINE, "app", "exercices")
DEFAUT_GUIDE = os.path.join(
    "C:\\Users\\kevin\\Desktop", "1) COACHING", "1) CREATION DE PROGRAMME",
    "4) GUIDE DES EXERCICES")

# Largeur maximale. Les sources font 279x183 px en moyenne : thumbnail() ne
# grandit jamais une image, ce plafond ne sert donc qu'aux quelques captures
# d'ecran de 1200 px du guide.
LARGEUR_MAX = 640
QUALITE = 82


# ────────────────────────────────────────────────────────────────────────────
# Normalisation
# ────────────────────────────────────────────────────────────────────────────
def cle(s):
    """Meme normalisation que exKey() cote application : c'est elle qui fait
    se rejoindre les deux moities des donnees."""
    s = unicodedata.normalize("NFD", str(s or "").upper())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9]+", " ", s)).strip()


def slugifier(nom):
    k = cle(nom).lower()
    return re.sub(r"\s+", "-", k)


# ────────────────────────────────────────────────────────────────────────────
# 1. Le guide
# ────────────────────────────────────────────────────────────────────────────
def trouver_guide(dossier):
    if os.path.isfile(dossier):
        return dossier
    cands = [f for f in os.listdir(dossier)
             if f.lower().endswith(".docx") and "exercices" in f.lower()
             and not f.startswith("~$") and "2024" not in f]
    if not cands:
        sys.exit("Aucun guide .docx trouve dans " + dossier)
    return os.path.join(dossier, sorted(cands)[0])


def _texte(x):
    t = "".join(re.findall(r"<w:t[^>]*>([\s\S]*?)</w:t>", x))
    for a, b in (("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"),
                 ("&#39;", "'"), ("&apos;", "'"), ("\u2019", "'")):
        t = t.replace(a, b)
    return t


def lire_guide(chemin):
    """Un exercice = une ligne de tableau. Cellule gauche l'illustration,
    cellule droite le nom puis la description, le repos et les liens."""
    z = zipfile.ZipFile(chemin)
    doc = z.read("word/document.xml").decode("utf-8", "replace")
    rels = z.read("word/_rels/document.xml.rels").decode("utf-8", "replace")

    R = {}
    for m in re.finditer(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels):
        if "media/" in m.group(2):
            R[m.group(1)] = m.group(2).rsplit("media/", 1)[-1]

    exos, vus = [], set()
    for tr in re.finditer(r"<w:tr\b[\s\S]*?</w:tr>", doc):
        bloc = tr.group(0)
        imgs = [R[i] for i in re.findall(r'r:embed="([^"]+)"', bloc) if i in R]
        # .wdp est la variante HD de Word, .emf un numero de page decoratif :
        # ni l'une ni l'autre ne sont des illustrations d'exercice.
        imgs = [f for f in imgs if not re.search(r"\.(wdp|emf)$", f, re.I)]
        lignes = [_texte(p.group(0)).strip()
                  for p in re.finditer(r"<w:p\b[\s\S]*?</w:p>", bloc)]
        lignes = [l for l in lignes if l]

        nom, reste = None, []
        for l in lignes:
            c = re.sub(r"^\d+\)\s*", "", l)
            if nom is None:
                # Le nom est en capitales ; il arrive qu'il soit colle a la
                # premiere phrase de la description (« MUSCLE UPCommencer… »).
                m = re.match(r"^([A-Z0-9'\-\s/()\u00C0-\u00DC]{3,}?)(?=[A-Z\u00C0-\u00DC][a-z\u00E0-\u00FC]|$)", c)
                if m and len(m.group(1).strip()) > 2 and re.search(r"[A-Z\u00C0-\u00DC]{3}", m.group(1)):
                    nom = re.sub(r"\s+", " ", m.group(1).strip())
                    suite = c[len(m.group(1)):].strip()
                    if suite:
                        reste.append(suite)
                    continue
            reste.append(c)

        if not nom or re.match(r"^(IMAGE|DESCRIPTION|NOM DE)", nom):
            continue
        k = cle(nom)
        if k in vus:
            continue
        vus.add(k)

        desc, repos, videos = [], "", []
        for l in reste:
            v = re.findall(r"https?://(?:youtu\.be/|www\.youtube\.com/watch\?v=)([A-Za-z0-9_-]{6,})", l)
            if v:
                lib = (re.findall(r"\(([^)]+)\)", l) or [""])[0]
                for x in v:
                    videos.append({"id": x, "lib": lib})
                continue
            if re.match(r"^Repos\s*:", l, re.I):
                repos = re.sub(r"^Repos\s*:\s*", "", l, flags=re.I).strip()
                continue
            if re.match(r"^Lien vid", l, re.I):
                continue
            if len(l) > 15:
                desc.append(l)

        exos.append({"nom": nom, "cle": k, "image": imgs[0] if imgs else None,
                     "desc": " ".join(desc).strip(), "repos": repos,
                     "videos": videos})
    return z, exos


# ────────────────────────────────────────────────────────────────────────────
# 2. La classification, deja dans l'application
# ────────────────────────────────────────────────────────────────────────────
def _bloc_const(src, nom):
    i = src.find("\nconst " + nom + "=")
    if i < 0:
        return ""
    j, prof = i, 0
    while j < len(src):
        c = src[j]
        if c in "{[":
            prof += 1
        elif c in "}]":
            prof -= 1
            if prof == 0:
                return src[i:j + 1]
        j += 1
    return ""


def _signatures(bloc):
    """Rend {nom_exercice: signature} depuis un dictionnaire signature→'A~B~C'."""
    out = {}
    for m in re.finditer(r"""['"]([^'"]+)['"]\s*:\s*['"]([^'"]*~[^'"]*)['"]""", bloc):
        sig, liste = m.group(1), m.group(2)
        for x in liste.split("~"):
            n = x.split("|")[0].strip()
            if n:
                out.setdefault(cle(n), sig)
    return out


def lire_classification():
    src = open(os.path.join(RACINE, "app", "index.html"), encoding="utf-8").read()
    src = src[:src.find("function testExercices")]
    muscles = _signatures(_bloc_const(src, "EX_GUIDE_BRUT"))
    schemas = _signatures(_bloc_const(src, "SCHEMAS_BRUT"))
    for nom_const, sig in (("EX_GUIDE_CARDIO", "CARDIO"), ("EX_GUIDE_POSING", "POSING")):
        m = re.search(r"\nconst " + nom_const + r"='([^']*)'", src)
        if m:
            for x in m.group(1).split("~"):
                if x.strip():
                    muscles.setdefault(cle(x), sig)
    return muscles, schemas


# ────────────────────────────────────────────────────────────────────────────
# 3. Deduction du materiel, du niveau, de l'unilateralite
# ────────────────────────────────────────────────────────────────────────────
# Ordre SIGNIFIANT : le premier motif qui repond gagne. « SMITH MACHINE »
# doit etre teste avant « MACHINE », sinon tout finit en machine guidee.
MATERIEL = [
    # Les poses de posing et le cardio ne se font PAS avec un materiel de
    # musculation. Les laisser vides melait « pas de materiel » et « materiel
    # non determine », qui ne veulent pas dire la meme chose.
    ("aucun",              r"\bPOSE\b|\bPOSING\b|\bVACUUM\b|\bMOST MUSCULAR\b|\bLAT SPREAD\b|"
                           r"\bDOUBLE BICEPS\b|\bABDOMINALS AND THIGHS\b|\bICARUS\b|\bMOON\b|"
                           r"\bPRIEST\b|\bSIDE CHEST\b|\bSIDE TRICEPS\b|\bTHE \w+\b|\bSITUATION\b"),
    ("cardio",             r"\bTAPIS\b|\bVELO\b|\bRAMEUR\b|\bCORDE A SAUTER\b|\bESCALIERS\b|"
                           r"\bSKIERG\b|\bBATTLE ROPE\b|\bELLIPTIQUE\b|\bPOWER RUN\b"),
    ("smith",              r"\bSMITH\b|\bHYPTRUST\b"),
    ("poulie",             r"\bPOULIE\b|\bCABLE\b|\bCROSSOVER\b|\bFACE PULL\b|\bPULL OVER\b|"
                           r"\bCHEST PRESS DEBOUT\b|\bTIRAGE\b(?!.*\bBARRE\b)|\bPULLDOWN\b"),
    ("elastique",          r"\bELASTIQUE\b|\bBANDE\b"),
    ("kettlebell",         r"\bKETTLEBELL\b"),
    ("machine convergente", r"\bCONVERGENTE\b|\bISO LATERAL\b|\bHAMMER STRENGTH\b"),
    # MACHINR : faute de frappe du guide, corrigee ici plutot que dans la
    # source — le guide reste le document du coach, pas un fichier de code.
    ("machine guidee",     r"\bMACHINES?\b|\bMACHINR\b|\bHACKSQUAT\b|\bPRESSE\b|\bBUTTERFLY\b|"
                           r"\bPENDULUM\b|\bLEG (EXTENSION|CURL)\b|\bBOOTYMIZER\b|\bGLUTEUS?\b|"
                           r"\b3D ABDUCTOR\b|\bABDUCTOR\b|\bADDUCTOR\b|\bCHEST PRESS\b"),
    ("halteres",           r"\bHALTERE|\bDUMBBELL\b|\bCURL\b|\bELEVATION (LATERALE|FRONTALE|Y|ARRIERE)\b|"
                           r"\bEXTEN(SION|TION)S? (VERTICALES? )?TRICEPS\b|\bSKULL CRUSHER\b|"
                           r"\bFLOOR PRESS\b|\bFRENCH PRESS\b|\bOISEAU\b|\bSUR BANC\b"),
    ("barre",              r"\bBARRE\b|\bBARBELL\b|\bLANDMINE\b|\bSOULEVE DE TERRE\b|\bSQUAT\b|"
                           r"\bDEVELOPPE COUCHE\b|\bCLEAN\b|\bSNATCH\b|\bJERK\b|\bTHUSTERS\b|"
                           r"\bGOOD MORNING\b|\bHIP THRUST\b|\bROWING\b"),
    ("poids du corps",     r"\bPOMPE|\bTRACTION|\bDIPS\b|\bGAINAGE\b|\bCRUNCH\b|\bBURPEES\b|"
                           r"\bPLANK\b|\bMUSCLE UP\b|\bAU SOL\b|\bBRIDGE\b|\bFIRE HYDRANT\b|"
                           r"\bABS ROLLER\b|\bRELEVE\b|\bEXTENSION DE BUSTE\b|\bSAUT|\bJUMPING\b|"
                           r"\bMONTE DE GENOUX\b|\bCHAISE\b|\bSUPERMAN\b|\bDONKEY KICK\b|\bFENTE"),
]
NIVEAU = [
    ("avance",       r"\bSNATCH\b|\bCLEAN\b|\bJERK\b|\bMUSCLE UP\b|\bSOULEVE DE TERRE\b(?!.*MACHINE)|\bTHUSTERS\b|\bPISTOL\b"),
    ("intermediaire", r"\bBARRE\b|\bHALTERE|\bTRACTION|\bDIPS\b|\bFENTE|\bSQUAT\b"),
]
TAGS = [
    ("echauffement", r"\bMOBILIT|\bETIREMENT|\bECHAUFF"),
    ("posing",       r"\bPOSE\b|\bPOSING\b|\bVACUUM\b|\bMOST MUSCULAR\b|\bLAT SPREAD\b"),
    ("cardio",       r"\bTAPIS\b|\bVELO\b|\bRAMEUR\b|\bCORDE A SAUTER\b|\bESCALIERS\b|\bSKIERG\b|\bBATTLE ROPE\b"),
    ("halterophilie", r"\bSNATCH\b|\bCLEAN\b|\bJERK\b"),
]


def deduire(nom_cle, signature_schema):
    mat = next((c for c, r in MATERIEL if re.search(r, nom_cle)), None)
    niv = next((c for c, r in NIVEAU if re.search(r, nom_cle)), "debutant")
    uni = bool(re.search(r"\bUNILATERAL|\bALTERNE|\bPAR (JAMBE|BRAS)\b|\bONE ARM\b", nom_cle))
    tags = [c for c, r in TAGS if re.search(r, nom_cle)]
    if signature_schema in ("posing", "cardio") and signature_schema not in tags:
        tags.append(signature_schema)
    return mat, niv, uni, tags


# ────────────────────────────────────────────────────────────────────────────
# 4. Images
# ────────────────────────────────────────────────────────────────────────────
def convertir(zf, nom_media, dest):
    """Rend (ecrit, octets). N'ecrit QUE si le contenu differe : relancer le
    script ne doit pas remuer 400 fichiers dans le depot pour rien."""
    brut = zf.read("word/media/" + nom_media)
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
    data = buf.getvalue()
    if os.path.exists(dest):
        with open(dest, "rb") as f:
            if hashlib.sha1(f.read()).digest() == hashlib.sha1(data).digest():
                return False, len(data)
    with open(dest, "wb") as f:
        f.write(data)
    return True, len(data)


# ────────────────────────────────────────────────────────────────────────────
# Programme principal
# ────────────────────────────────────────────────────────────────────────────
def main():
    guide = trouver_guide(sys.argv[1] if len(sys.argv) > 1 else DEFAUT_GUIDE)
    sortie = sys.argv[2] if len(sys.argv) > 2 else os.path.join(RACINE, "..", "banque_exercices")
    sortie = os.path.abspath(sortie)
    os.makedirs(DEST_IMG, exist_ok=True)
    os.makedirs(sortie, exist_ok=True)

    print("guide   :", os.path.basename(guide))
    print("images  :", DEST_IMG)
    print("donnees :", sortie)
    print()

    zf, guide_exos = lire_guide(guide)
    muscles, schemas = lire_classification()
    connus = set(muscles) | set(schemas)
    print("guide          :", len(guide_exos), "exercices")
    print("classification :", len(connus), "exercices connus de l'application")

    banque, cree, maj, inchange = [], 0, 0, 0
    sans_image, sans_desc, hors_app = [], [], []
    octets = 0
    utilisees = set()

    for e in guide_exos:
        k = e["cle"]
        if k not in connus:
            hors_app.append(e["nom"])
            continue
        slug = slugifier(e["nom"])
        sig_m = muscles.get(k)
        sig_s = schemas.get(k)
        mat, niv, uni, tags = deduire(k, sig_s)

        image = None
        if e["image"]:
            dest = os.path.join(DEST_IMG, slug + ".webp")
            neuf = not os.path.exists(dest)
            ecrit, taille = convertir(zf, e["image"], dest)
            octets += taille
            utilisees.add(e["image"])
            image = slug + ".webp"
            if neuf:
                cree += 1
            elif ecrit:
                maj += 1
            else:
                inchange += 1
        else:
            sans_image.append(e["nom"])
        if len(e["desc"]) < 20:
            sans_desc.append(e["nom"])

        banque.append({
            "slug": slug, "nom": e["nom"],
            "muscles": (sig_m.split(",") if sig_m else []),
            "schema": sig_s,
            "materiel": mat, "niveau": niv, "unilateral": uni, "tags": tags,
            "execution": e["desc"], "repos": e["repos"],
            "videos": e["videos"], "image": image,
            # Sans source : le guide n'a qu'un champ de description. Laisses
            # VIDES plutot qu'inventes — l'ecran ne les affiche pas tant
            # qu'ils le sont.
            "erreurs": [], "consignes": [],
        })

    banque.sort(key=lambda x: x["slug"])
    manquants = sorted(connus - {b["slug"].replace("-", " ").upper() and cle(b["nom"]) for b in banque})
    dans_banque = {cle(b["nom"]) for b in banque}
    manquants = sorted(connus - dans_banque)

    chemin_json = os.path.join(sortie, "banque.json")
    with open(chemin_json, "w", encoding="utf-8") as f:
        json.dump({"version": 1, "exercices": banque}, f, ensure_ascii=False, indent=1)

    # ── L'index des illustrations, LUI, est public ─────────────────────────
    # Un athlete doit voir l'illustration des exercices que son coach lui a
    # prescrits : c'est tout l'interet. Il n'a pas acces a la banque, mais il
    # a besoin de savoir QUELS slugs ont une image, sinon chaque exercice sans
    # illustration produirait une requete 404 et une image cassee.
    # Cette liste ne divulgue rien : les 416 noms d'exercices sont deja en
    # clair dans app/index.html depuis toujours.
    index = sorted(b["slug"] for b in banque if b["image"])
    chemin_index = os.path.join(DEST_IMG, "index.json")
    contenu = json.dumps(index, ensure_ascii=False, separators=(",", ":"))
    ancien = ""
    if os.path.exists(chemin_index):
        ancien = open(chemin_index, encoding="utf-8").read()
    if ancien != contenu:
        with open(chemin_index, "w", encoding="utf-8") as f:
            f.write(contenu)

    toutes = {n.rsplit("/", 1)[-1] for n in zf.namelist()
              if n.startswith("word/media/") and not re.search(r"\.(wdp|emf)$", n, re.I)}
    orphelines = sorted(toutes - utilisees)

    # ── Rapport ─────────────────────────────────────────────────────────────
    print()
    print("=" * 66)
    print("RAPPORT DE SEEDING")
    print("=" * 66)
    print("  exercices en banque      : %d" % len(banque))
    print("  images creees            : %d" % cree)
    print("  images mises a jour      : %d" % maj)
    print("  images inchangees        : %d" % inchange)
    print("  poids des illustrations  : %.2f Mo" % (octets / 1048576.0))
    print("  banque.json              : %.0f Ko" % (os.path.getsize(chemin_json) / 1024.0))
    print()
    print("  materiel deduit          : " + ", ".join(
        "%s=%d" % (k or "inconnu", v) for k, v in
        Counter(b["materiel"] for b in banque).most_common()))
    print("  niveau deduit            : " + ", ".join(
        "%s=%d" % (k, v) for k, v in Counter(b["niveau"] for b in banque).most_common()))
    print("  unilateraux              : %d" % sum(1 for b in banque if b["unilateral"]))
    print("  avec video               : %d" % sum(1 for b in banque if b["videos"]))
    print()
    print("  --- LES TROUS ---")
    print("  exercices SANS illustration (%d) :" % len(sans_image))
    for n in sans_image:
        print("      " + n)
    print("  exercices SANS description (%d) :" % len(sans_desc))
    for n in sans_desc:
        print("      " + n)
    print("  connus de l'app, ABSENTS du guide (%d) :" % len(manquants))
    for n in manquants:
        print("      " + n)
    print("  dans le guide, INCONNUS de l'app (%d) :" % len(hors_app))
    for n in hors_app:
        print("      " + n)
    print("  images du guide NON rattachees (%d)" % len(orphelines))
    if orphelines:
        print("      " + ", ".join(orphelines[:12]) + (" ..." if len(orphelines) > 12 else ""))
    print()
    print("  A FAIRE ENSUITE : televerser %s vers le noeud /exercices" % chemin_json)
    print("  (lecture reservee aux coachs par database.rules.json)")


if __name__ == "__main__":
    main()
