# -*- coding: utf-8 -*-
"""Page de controle de l'ecran Complements.

Elle DECOUPE dans index.html les declarations dont le rendu depend, styles
compris, et les rejoue sur un dossier fictif. Rien n'est recopie a la main :
si le code de production change, la page change avec.

  python verif_supp.py   puis servir app/ et ouvrir _verif-supp.html
"""
import io, os, re, json

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', '..', 'app')
src = io.open(os.path.join(APP, 'index.html'), encoding='utf-8', newline='').read()

styles = '\n'.join(re.findall(r'<style[^>]*>(.*?)</style>', src, re.S))
script = max(re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', src, re.S), key=len)
script = script.replace('\r\n', '\n')

# Les declarations de premier niveau commencent toutes en colonne 1.
morceaux = re.split(r'\n(?=(?:function|const|let|var|class)\s)', script)
par_nom = {}
for m in morceaux:
    g = re.match(r'(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)', m.lstrip())
    if g and g.group(1) not in par_nom:
        par_nom[g.group(1)] = m

BESOINS = [
    'escapeHtml', 'icon', 'emptyState', '_planNb', 'planUnitePluriel',
    'SUPPLEMENTS_LIST', 'SUPP_PREUVE_COULEUR', 'SUPP_LEGENDE_PREUVE',
    'SUPP_LEGENDE_PIED', 'SUPP_LEGENDE_PIED_COACH', 'SUPP_SOURCING',
    'SUPP_SOURCING_COACH', 'TIMINGS_LIST', 'SUPP_ORDRE_JOURNEE',
    'SUPP_TIMING_META', '_rangMoment', '_suppNorm', '_suppFiche',
    '_suppPastille', '_suppTimingIcon', '_suppEcartMoment', '_suppInteractions',
    '_htmlSuppInteractions', '_htmlFormesFiche', '_libelleForme',
    'phraseDureeJugement', '_suppAssurerIds', '_htmlSuppLegende',
    '_htmlSuppSourcing', '_renderSuppTable',
]
manque = [n for n in BESOINS if n not in par_nom]
if manque:
    raise SystemExit('introuvable dans index.html : ' + ', '.join(manque))
# FERMETURE TRANSITIVE. Lister les dependances a la main, c'est decouvrir la
# suivante a chaque execution — et une constante oubliee ne casse pas la page,
# elle casse le rendu au milieu, ce qui se voit mal. On ramasse donc tout ce
# que le code cite et que le fichier declare, jusqu'a ce que plus rien ne
# manque.
retenus = list(BESOINS)
vus = set(retenus)
i = 0
while i < len(retenus):
    for ident in set(re.findall(r'[A-Za-z_$][\w$]*', par_nom[retenus[i]])):
        if ident in par_nom and ident not in vus:
            vus.add(ident); retenus.append(ident)
    i += 1
# L'ordre du fichier, pour que les constantes precedent ce qui les lit.
rang = {n: k for k, n in enumerate(par_nom)}
code = '\n'.join(par_nom[n] for n in sorted(retenus, key=lambda n: rang[n]))
print('declarations reprises :', len(retenus))

DOSSIER = [
    dict(id=1, name='Vitamine B', timings=['matin'], dosage_quantity=1, dosage_unit='comprimé'),
    dict(id=2, name='Vitamine C', timings=['matin'], dosage_quantity=1, dosage_unit='comprimé'),
    dict(id=3, name='Whey / Protéine en poudre',
         timings=['matin', 'apres-entrainement', 'soir'], dosage_quantity=2, dosage_unit='scoop(s)'),
    dict(id=4, name='Crème de riz', timings=['avant-entrainement'], dosage_quantity=80, dosage_unit='g'),
    dict(id=5, name='EAA', timings=['intra'], dosage_quantity=1, dosage_unit='scoop'),
    dict(id=6, name='Électrolytes', timings=['intra'], dosage_quantity=1, dosage_unit='scoop'),
    dict(id=7, name='Créatine monohydrate', timings=['midi', 'coucher'], dosage_quantity=6, dosage_unit='g'),
    dict(id=8, name='Glycine', timings=['coucher'], dosage_quantity=1, dosage_unit='scoop'),
    dict(id=9, name='Magnésium', timings=['coucher'], dosage_quantity=2, dosage_unit='comprimé'),
    dict(id=10, name='Oméga 3', timings=['coucher'], dosage_quantity=4, dosage_unit='gélule'),
    dict(id=11, name='Bêta-alanine', timings=['avant-entrainement'], dosage_quantity=3.5,
         dosage_unit='g', active=False),
]

page = """<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Controle - ecran Complements</title>
<style>%s
body{margin:0;padding:0;background:#08080a}
.bancs{display:flex;gap:22px;align-items:flex-start;padding:16px;overflow-x:auto}
.banc{flex:0 0 auto}
.banc h4{font:800 11px/1 Montserrat,sans-serif;letter-spacing:2px;color:#666;
  text-transform:uppercase;margin:0 0 8px}
.faux{background:var(--dark);border:1px solid var(--border);
  border-radius:var(--r-4);padding:14px}
</style></head><body>
<div class="bancs" id="bancs"></div>
<script>
%s
const DOSSIER=%s;
const LARGEURS=[360,430,640,900];
document.getElementById('bancs').innerHTML=LARGEURS.map(w=>
  '<div class="banc" style="width:'+w+'px"><h4>'+w+' px</h4>'
  +'<div class="faux">'+_renderSuppTable(DOSSIER.map(x=>Object.assign({},x)),false,'void')+'</div></div>'
).join('');
</script></body></html>""" % (styles, code, json.dumps(DOSSIER, ensure_ascii=False))

p = os.path.join(APP, '_verif-supp.html')
io.open(p, 'w', encoding='utf-8', newline='\n').write(page)
print(p, len(page), 'octets')
