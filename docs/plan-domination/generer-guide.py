# Génère le guide RepCore au format portrait (1240 x 1754 px = A4 à 150 dpi)
import sys, html
MODE = sys.argv[1] if len(sys.argv) > 1 else 'print'   # 'print' (polices locales) ou 'canva'
BASE = 'https://raw.githubusercontent.com/Repcore131/coaching/claude/hopeful-faraday-pgtu0x/docs/plan-domination/img/'
IMG = (BASE if MODE == 'canva' else 'img/')

def esc(s): return s

CSS = """
@page{size:1240px 1754px;margin:0}
:root{--r:#E02020;--n:#141416;--g:#6B6B73;--l:#D4D4DA;--t:#FDEDED}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#888;font-family:'Montserrat',sans-serif;color:var(--n)}
section.p{width:1240px;height:1754px;position:relative;overflow:hidden;background:#fff;padding:150px 100px 120px;page-break-after:always;break-after:page}
.hd{position:absolute;left:100px;right:100px;top:52px;height:56px;display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid var(--n)}
.hd .l{display:flex;align-items:center;gap:14px;font-family:'Bebas Neue';font-size:28px;letter-spacing:.06em}
.hd img{width:40px;height:40px;border-radius:8px}
.hd .s{font-weight:800;font-size:15px;letter-spacing:.22em;text-transform:uppercase;color:var(--r)}
.ft{position:absolute;left:100px;right:100px;bottom:46px;display:flex;justify-content:space-between;font-size:14px;letter-spacing:.2em;text-transform:uppercase;font-weight:700;color:#A0A0A8}
.ft b{color:var(--n);font-family:'Bebas Neue';font-size:30px;letter-spacing:0;font-weight:400}
.kick{font-weight:800;font-size:18px;letter-spacing:.3em;color:var(--r);text-transform:uppercase;margin-bottom:14px}
h1{font-family:'Bebas Neue';font-weight:400;font-size:92px;line-height:.95;text-transform:uppercase}
h1 em,h2 em{font-style:normal;color:var(--r)}
h2{font-family:'Bebas Neue';font-weight:400;font-size:48px;line-height:1;text-transform:uppercase;margin:34px 0 16px}
h3{font-weight:800;font-size:23px;line-height:1.25}
p,.tx{font-size:21px;line-height:1.5}
.lead{font-size:24px;line-height:1.5;color:#3A3A40;margin-top:18px}
.mut{color:var(--g)}
.box{border:2px solid var(--n);border-radius:14px;padding:24px 26px}
.box.r{border-color:var(--r);background:var(--t)}
.box.d{background:var(--n);color:#fff;border-color:var(--n)}
.box.d p,.box.d .tx{color:#fff}
.tag{display:inline-block;font-weight:800;font-size:14px;letter-spacing:.14em;text-transform:uppercase;padding:5px 12px;border-radius:999px;background:var(--r);color:#fff}
.tag.o{background:#fff;color:var(--n);border:2px solid var(--n)}
.cb{display:inline-block;width:28px;height:28px;border:3px solid var(--n);border-radius:6px;flex:none;background:#fff}
.cb.s{width:22px;height:22px;border-width:2.5px;border-radius:5px}
.task{display:flex;align-items:flex-start;gap:16px;padding:12px 0;border-bottom:1.5px solid var(--l);font-size:21px;line-height:1.4}
.task .cb{margin-top:1px}
.task .d{margin-left:auto;white-space:nowrap;color:var(--g);font-size:17px;padding-left:16px}
.fl{display:inline-block;border-bottom:2px solid var(--n);min-width:150px;height:26px;vertical-align:bottom}
.ln{height:46px;border-bottom:1.5px solid var(--l)}
.grid{display:grid;gap:18px}
.row{display:grid;border-left:1.5px solid var(--l);border-top:1.5px solid var(--l)}
.row>div{border-right:1.5px solid var(--l);border-bottom:1.5px solid var(--l);padding:8px 10px;font-size:17px;min-height:46px;display:flex;align-items:center}
.row.h>div{background:var(--n);color:#fff;font-weight:800;font-size:14px;letter-spacing:.06em;text-transform:uppercase;border-color:var(--n)}
.big{font-family:'Bebas Neue';font-size:96px;line-height:.9}
.big.r{color:var(--r)}
.wk{border:2px solid var(--n);border-radius:14px;padding:20px 24px;margin-bottom:22px}
.wk .top{display:flex;align-items:center;gap:16px;margin-bottom:6px}
.wk .num{font-family:'Bebas Neue';font-size:56px;line-height:1;color:var(--r)}
.days{display:flex;gap:8px;align-items:center;font-size:15px;font-weight:700;color:var(--g)}
.days span{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:2.5px solid var(--n);border-radius:6px;color:var(--n)}
.leg{display:flex;gap:28px;flex-wrap:wrap;font-size:19px}
.pill{display:inline-block;padding:8px 16px;border-radius:999px;border:2px solid var(--n);font-weight:700;font-size:18px}
.mono{font-family:'Courier New',monospace;font-size:18px;line-height:1.55;color:#2A2A30}
"""

FONTS_PRINT = "@font-face{font-family:'Bebas Neue';src:url('BebasNeue-Regular.ttf')}" + "".join(
    f"@font-face{{font-family:'Montserrat';src:url('Montserrat-{n}.ttf');font-weight:{w}}}" for w, n in
    [(400,'Regular'),(500,'Medium'),(600,'SemiBold'),(700,'Bold'),(800,'ExtraBold')])
FONTS_CANVA = '<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">'

pages = []
TOC = []
def page(section, body, cls=''):
    pages.append((section, body, cls))
def part(title):
    TOC.append((title, len(pages) + 1))

def cb(s=''): return f'<span class="cb {s}"></span>'
def task(t, d='fait le __/__'):
    return f'<div class="task">{cb()}<div>{t}</div><div class="d">{d}</div></div>'
def lines(n): return ''.join('<div class="ln"></div>' for _ in range(n))
def table(cols, rows, widths, h=46):
    g = 'grid-template-columns:' + ' '.join(widths)
    out = f'<div class="row h" style="{g}">' + ''.join(f'<div>{c}</div>' for c in cols) + '</div>'
    for r in rows:
        out += f'<div class="row" style="{g};border-top:0">' + ''.join(f'<div style="min-height:{h}px">{c}</div>' for c in r) + '</div>'
    return out

# ───────────── 1 COUVERTURE
page('', f'''
<img src="{IMG}bg-guide-cover.jpg" style="position:absolute;left:0;top:0;width:1240px;height:1754px">
<div style="position:absolute;left:100px;top:90px;display:flex;align-items:center;gap:18px">
 <img src="{IMG}logo.png" style="width:86px;height:86px;border-radius:16px">
 <div style="font-family:'Bebas Neue';font-size:40px;letter-spacing:.08em;color:#fff">REPCORE</div></div>
<div style="position:absolute;left:100px;right:100px;top:930px">
 <div class="kick" style="font-size:20px">Le guide de lancement · édition octobre 2026</div>
 <h1 style="font-size:190px;line-height:.86;color:#fff">Plan de<br><em>domination</em></h1>
 <p style="font-size:34px;color:#fff;font-weight:700;margin-top:30px">50 000 € par mois en 12 mois.</p>
 <p style="font-size:28px;color:#C8C8CE;margin-top:6px">0 € de budget. Une app. Un coach. Instagram.</p>
 <div style="margin-top:56px;border:2px solid #fff;border-radius:16px;padding:26px 30px;color:#fff;font-size:22px;display:grid;grid-template-columns:1fr 1fr;gap:20px">
  <div>Ce guide appartient à : <span class="fl" style="border-color:#fff;min-width:220px"></span></div>
  <div>Démarrage le : <span class="fl" style="border-color:#fff;min-width:200px"></span></div></div>
</div>
<div style="position:absolute;left:100px;bottom:60px;color:#A0A0A8;font-weight:700;font-size:16px;letter-spacing:.24em">KEVIN GUELLEC · GUELLEC COACHING PRO</div>
''', 'cover')

# ───────────── 2 MODE D'EMPLOI
page('Mode d\'emploi', f'''
<div class="kick">Avant de commencer</div>
<h1>Comment utiliser <em>ce guide</em></h1>
<p class="lead">Ce guide n'est pas à lire, il est à <b>faire</b>. Chaque page te dit quoi faire, te laisse cocher ce qui est fait et noter tes vrais chiffres.</p>
<div class="grid" style="grid-template-columns:1fr 1fr;margin-top:40px">
 <div class="box"><div class="big r" style="font-size:72px">1</div><h3>Lis-le une fois en entier</h3><p class="mut" style="font-size:19px">Une heure, un stylo. Tu entoures ce qui te parle, tu barres ce qui ne te ressemble pas.</p></div>
 <div class="box"><div class="big r" style="font-size:72px">2</div><h3>Coche quand c'est fait</h3><p class="mut" style="font-size:19px">Pas quand c'est commencé. Une case cochée = un résultat, pas une intention.</p></div>
 <div class="box"><div class="big r" style="font-size:72px">3</div><h3>Le lundi, tes chiffres</h3><p class="mut" style="font-size:19px">15 minutes pour remplir le tableau de bord (partie 4). C'est lui qui décide de la semaine.</p></div>
 <div class="box"><div class="big r" style="font-size:72px">4</div><h3>Les portes ne se sautent pas</h3><p class="mut" style="font-size:19px">Une porte non franchie = on corrige avant d'avancer. C'est ce qui évite de brûler 3 mois.</p></div>
</div>
<h2>La légende</h2>
<div class="leg"><span>{cb('s')}</span><span>tâche à cocher</span><span>✎ &nbsp;à remplir</span><span><b style="color:var(--r)">▲</b> &nbsp;porte de passage</span><span><b style="color:var(--r)">★</b> &nbsp;priorité absolue</span></div>
<h2>Mon <em>engagement</em></h2>
<div class="box r">
 <p>✎ Mon objectif de chiffre d'affaires au mois 12 : <span class="fl" style="min-width:200px"></span> € par mois</p>
 <p style="margin-top:22px">✎ Pourquoi c'est important pour moi :</p>
 {lines(3)}
 <p style="margin-top:22px">✎ Ce que je suis prêt à arrêter pour y arriver :</p>
 {lines(2)}
 <div style="display:flex;gap:60px;margin-top:30px"><p>Date : <span class="fl"></span></p><p>Signature : <span class="fl" style="min-width:260px"></span></p></div>
</div>
''')

# placeholder sommaire (rempli plus tard)
page('Sommaire', '__TOC__')

# ───────────── PARTIE 1
part('Partie 1 · La stratégie')
page('Partie 1 · La stratégie', f'''
<div class="box d" style="padding:34px 36px;margin-bottom:34px"><div class="kick" style="margin:0">Partie 1</div><div style="font-family:'Bebas Neue';font-size:70px;line-height:1;margin-top:6px">La stratégie</div></div>
<div class="kick">01 · Le verdict</div>
<h1>Le produit est prêt.<br>Il manque des <em>gens qui le voient.</em></h1>
<p class="lead">Parrainage, codes ambassadeur, défis, duels, rangs, badges, Wrapped mensuel, export vidéo Instagram, relances automatiques : tout est déjà codé et tourne à 0 €. <b>La prochaine fonctionnalité qui rapportera le plus, c'est une vidéo publiée.</b></p>
<h2>Les 10 décisions <em>qui font tout</em></h2>
<p class="mut" style="font-size:18px;margin-bottom:6px">Coche chaque décision quand tu l'as vraiment prise.</p>
{task('<b>★ Geler le développement 90 jours.</b> Une mise en ligne par semaine, correctifs seulement.','')}
{task('<b>★ Supprimer l\'engagement de 12 mois</b> sur le mensuel ; annuel payé d\'avance à 2 mois offerts.','')}
{task('<b>Vendre le coaching avant l\'app</b> le premier mois : 10 places à 350 €.','')}
{task('<b>Lancer l\'Offre Fondateur</b> : Ultime annuel à 149 €, 300 places.','')}
{task('<b>Payer l\'influence au résultat</b> : 30 % pendant 12 mois, rien d\'avance.','')}
{task('<b>Me mettre face caméra</b> : une vidéo par jour.','')}
{task('<b>Publier l\'app sur le Play Store</b> (25 $, la seule dépense).','')}
{task('<b>Préparer Firebase Blaze</b> avant le premier pic viral.','')}
{task('<b>Confier à Claude</b> tout ce qui se répète et s\'écrit.','')}
{task('<b>Piloter chaque lundi</b> sur 6 chiffres, couper ce qui ne marche pas en 3 semaines.','')}
''')

page('Partie 1 · La stratégie', f'''
<div class="kick">02 · Le modèle</div>
<h1>D'où viennent <em>les 50 000 €</em></h1>
<p class="lead">Mois 12, scénario ambitieux. Quatre sources, aucune dépendance à une seule.</p>
<div style="display:flex;height:96px;border-radius:14px;overflow:hidden;margin-top:34px">
 <div style="flex:34500;background:#E02020;color:#fff;display:flex;align-items:center;padding-left:22px;font-family:'Bebas Neue';font-size:48px">34,5 K€</div>
 <div style="flex:6750;background:#9E1414;color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue';font-size:34px">6,75</div>
 <div style="flex:6000;background:#5E0E0E;color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue';font-size:34px">6</div>
 <div style="flex:2800;background:#141416;color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue';font-size:28px">2,8</div></div>
<div class="grid" style="grid-template-columns:1fr 1fr;margin-top:24px">
 <div class="box r"><span class="tag">69 %</span><h3 style="margin-top:12px">Abonnements athlètes</h3><p class="mut" style="font-size:19px">2 300 payants × 15 € moyen (Essentielle 9,50 € · Ultime 24,90 €)</p></div>
 <div class="box"><span class="tag o">13 %</span><h3 style="margin-top:12px">Abonnements coachs</h3><p class="mut" style="font-size:19px">250 coachs × 27 € moyen (19 € et 39 €)</p></div>
 <div class="box"><span class="tag o">12 %</span><h3 style="margin-top:12px">Coaching de Kevin</h3><p class="mut" style="font-size:19px">40 clients × 150 €, puis une équipe de coachs</p></div>
 <div class="box"><span class="tag o">6 %</span><h3 style="margin-top:12px">Programmes à l'unité</h3><p class="mut" style="font-size:19px">Boutique 14,90 € · programmes personnalisés 99 €</p></div></div>
<p class="mut" style="font-size:17px;margin-top:14px">Scénario prudent au même mois : 12 000 à 18 000 €. Montants TTC, avant commissions et frais.</p>
<h2>Les 3 moteurs</h2>
<div class="box d" style="text-align:center;font-family:'Bebas Neue';font-size:44px;padding:16px">50 K€ / mois au mois 12</div>
<div class="grid" style="grid-template-columns:1fr 1fr 1fr;margin-top:16px">
 <div class="box"><span class="tag">Mois 1</span><h2 style="margin:14px 0 8px;font-size:40px">Moteur <em>cash</em></h2><p style="font-size:19px">Coaching premium 150 à 600 €. Paie les premières semaines, fabrique les témoignages.</p></div>
 <div class="box r"><span class="tag">Mois 2</span><h2 style="margin:14px 0 8px;font-size:40px">Moteur <em>récurrent</em></h2><p style="font-size:19px">Abonnements 9,50 € et 24,90 €, annuel payé d'avance. Le gros du chiffre.</p></div>
 <div class="box"><span class="tag">Mois 3</span><h2 style="margin:14px 0 8px;font-size:40px">Moteur <em>distribution</em></h2><p style="font-size:19px">Coachs à 19 € et 39 € qui amènent 5 à 30 athlètes chacun.</p></div></div>
<div class="box" style="margin-top:16px;text-align:center;font-weight:800;font-size:19px;padding:16px">SOCLE · Instagram quotidien · Ambassadrices au résultat · Automatisation par Claude</div>
''')

page('Partie 1 · La stratégie', f'''
<div class="kick">03 · L'arme que personne n'a</div>
<h1>La bonne charge,<br><em>même pendant tes règles.</em></h1>
<div style="display:grid;grid-template-columns:1fr 340px;gap:40px;margin-top:30px;align-items:start">
 <div>
  <p class="lead" style="margin:0">RepCore ajuste charges et volume à la phase du cycle menstruel. <b>Aucune des 6 plateformes concurrentes étudiées ne le fait</b> : Trainerize, TrueCoach, Everfit, Hexfit, Synergy, Fitr.</p>
  <div class="box r" style="margin-top:26px"><h3>La promesse, en une ligne</h3><p style="font-size:24px;margin-top:8px;font-weight:700">« L'app qui te dit quelle charge mettre à chaque série — même pendant tes règles. »</p></div>
  <h2>Les 3 cibles</h2>
  <div class="box" style="margin-bottom:14px"><span class="tag">Priorité 1</span><h3 style="margin-top:10px">Femmes 18-34 ans, muscu en salle</h3><p class="mut" style="font-size:18px">« Je stagne, certaines semaines je suis vidée. » → charge proposée + cycle.</p></div>
  <div class="box" style="margin-bottom:14px"><span class="tag o">Priorité 2</span><h3 style="margin-top:10px">Pratiquants autonomes 18-40 ans</h3><p class="mut" style="font-size:18px">« Mon carnet, c'est le bazar. » → fiche papier importée en photo, courbes.</p></div>
  <div class="box"><span class="tag o">Priorité 3</span><h3 style="margin-top:10px">Coachs indépendants</h3><p class="mut" style="font-size:18px">« Je suis mes clients sur Excel et WhatsApp. » → espace coach.</p></div>
 </div>
 <div><div style="border:8px solid var(--n);border-radius:36px;overflow:hidden"><img src="{IMG}charge.jpg" style="display:block;width:100%"></div>
 <p class="mut" style="font-size:16px;margin-top:10px;text-align:center">L'écran de séance : la charge proposée</p></div>
</div>
<h2>✎ Ma promesse, avec mes mots</h2>
{lines(3)}
''')

page('Partie 1 · La stratégie', f'''
<div class="kick">04 · L'échelle d'offres</div>
<h1>Du gratuit <em>au premium</em></h1>
<p class="lead">Plus on monte, moins il y a de clients et plus chacun rapporte. Chaque marche prépare la suivante.</p>
<svg viewBox="0 0 1040 640" width="1040" height="640" style="margin-top:20px">
 <g font-family="Montserrat" font-weight="800" text-anchor="middle">
  <polygon points="420,0 620,0 680,110 360,110" fill="#E02020"/>
  <text x="520" y="48" fill="#fff" font-size="24">COACHING</text><text x="520" y="84" fill="#fff" font-size="19" font-weight="600">150 € · 350 € · 600 €</text>
  <polygon points="354,122 686,122 746,232 294,232" fill="#B01818"/>
  <text x="520" y="170" fill="#fff" font-size="24">PROGRAMMES</text><text x="520" y="206" fill="#fff" font-size="19" font-weight="600">Boutique 14,90 € · Perso 99 €</text>
  <polygon points="288,244 752,244 812,354 228,354" fill="#7E1414"/>
  <text x="520" y="292" fill="#fff" font-size="24">OFFRE FONDATEUR</text><text x="520" y="328" fill="#fff" font-size="19" font-weight="600">Ultime annuel 149 € · 300 places</text>
  <polygon points="222,366 818,366 878,476 162,476" fill="#3A1414"/>
  <text x="520" y="414" fill="#fff" font-size="24">ABONNEMENTS</text><text x="520" y="450" fill="#fff" font-size="19" font-weight="600">Essentielle 9,50 € · Ultime 24,90 €</text>
  <polygon points="156,488 884,488 944,598 96,598" fill="#141416"/>
  <text x="520" y="536" fill="#fff" font-size="24">ESSAI GRATUIT</text><text x="520" y="572" fill="#fff" font-size="19" font-weight="600">1 mois sans carte · 2 avec code ambassadrice</text>
 </g>
</svg>
<h2>✎ Mes prix validés</h2>
{table(['Offre','Prix prévu','Mon prix final','Validé'],[[o,p,'',cb('s')] for o,p in [('Essentielle (mois / an)','9,50 € / 114 €'),('Ultime (mois / an)','24,90 € / 298,80 €'),('Offre Fondateur (an)','149 €'),('Programme boutique','14,90 €'),('Programme personnalisé','99 €'),('Coaching mensuel','150 €'),('Transformation 3 mois','350 €'),('Évolution 6 mois','600 €')]],['2.2fr','1.4fr','1.4fr','.6fr'])}
''')

page('Partie 1 · La stratégie', f'''
<div class="kick">05 · Le tunnel de vente</div>
<h1>Ce qu'il faut chaque mois pour <em>400 nouveaux payants</em></h1>
<svg viewBox="0 0 1040 560" width="1040" height="560" style="margin-top:30px">
 <g font-family="Montserrat">
  <rect x="0" y="0" width="1040" height="92" rx="14" fill="#141416"/>
  <rect x="0" y="116" width="760" height="92" rx="14" fill="#3A1414"/>
  <rect x="0" y="232" width="520" height="92" rx="14" fill="#7E1414"/>
  <rect x="0" y="348" width="320" height="92" rx="14" fill="#B01818"/>
  <rect x="0" y="464" width="240" height="92" rx="14" fill="#E02020"/>
  <g font-family="Bebas Neue" font-size="58" fill="#fff"><text x="26" y="66">1 MILLION</text><text x="26" y="182">20 000</text><text x="26" y="298">2 000</text><text x="26" y="414">400</text><text x="26" y="530">300</text></g>
  <g font-family="Montserrat" font-weight="800" font-size="22" fill="#fff" text-anchor="end"><text x="1016" y="42">vues Instagram</text><text x="736" y="158">visiteurs</text><text x="496" y="274">essais</text><text x="300" y="390">payants</text></g>
  <g font-family="Montserrat" font-weight="600" font-size="18" fill="#C8C8CE" text-anchor="end"><text x="1016" y="70">Kevin + ambassadrices + membres</text><text x="736" y="186">clic : 1 à 2 %</text><text x="496" y="302">inscription : 10-15 %</text><text x="300" y="418">achat : 20-25 %</text></g>
  <g font-family="Montserrat" font-weight="800" font-size="22" fill="#141416"><text x="262" y="504">encore là après 3 mois</text></g>
  <g font-family="Montserrat" font-weight="600" font-size="18" fill="#6B6B73"><text x="262" y="532">rétention : 75 %</text></g>
 </g>
</svg>
<p class="mut" style="font-size:17px;margin-top:8px">Taux cibles = ordres de grandeur du secteur, à recaler sur tes vrais chiffres dès le mois 1.</p>
<h2>✎ Mes vrais chiffres</h2>
{table(['Étape','Cible / mois','Mois 1','Mois 2','Mois 3'],[[e,c,'','',''] for e,c in [('Vues Instagram','1 000 000'),('Visiteurs page','20 000'),('Essais gratuits','2 000'),('Nouveaux payants','400'),('Résiliation','< 8 %')]],['1.6fr','1.2fr','1fr','1fr','1fr'],52)}
''')

# ───────────── PARTIE 2
part('Partie 2 · Le lancement')
rows_ig = [('Abonnés','< 2 000','2 000 – 20 000','> 20 000'),('Comptes touchés / abonnés','< 30 %','30 – 100 %','> 100 %'),('Part non abonnés touchés','< 40 %','40 – 70 %','> 70 %'),('Taux d\'engagement','< 3 %','3 – 6 %','> 6 %'),('Vues moyennes d\'un Reel','< 1 000','1 000 – 10 000','> 10 000'),('Taux d\'enregistrement','< 1 %','1 – 3 %','> 3 %'),('Clics lien en bio','< 50','50 – 500','> 500'),('Messages privés reçus','< 10','10 – 100','> 100'),('Femmes 18-34 ans','< 30 %','30 – 55 %','> 55 %'),('Audience francophone','< 60 %','60 – 85 %','> 85 %')]
page('Partie 2 · Le lancement', f'''
<div class="box d" style="padding:34px 36px;margin-bottom:34px"><div class="kick" style="margin:0">Partie 2</div><div style="font-family:'Bebas Neue';font-size:70px;line-height:1;margin-top:6px">Le lancement</div></div>
<div class="kick">06 · Diagnostic Instagram</div>
<h1>Ton compte, <em>en 10 minutes</em></h1>
<p class="lead" style="font-size:21px">Instagram → Tableau de bord professionnel → Statistiques, 30 derniers jours. Entoure la colonne où tu tombes.</p>
<div style="margin-top:22px">{table(['Indicateur','✎ Ton chiffre','Faible','Correct','Fort'],[[a,'',b,c,d] for a,b,c,d in rows_ig],['2fr','1.2fr','1fr','1.2fr','1fr'],44)}</div>
<h2>Le profil, à corriger aujourd'hui</h2>
{task('Nom affiché : « Kevin | Coach muscu & app RepCore »')}
{task('Bio en 3 lignes : qui tu aides · le résultat · « ↓ 1 mois offert »')}
{task('Lien en bio : repcore-sync.web.app/?src=bio_ig')}
{task('5 stories à la une : L\'app · Résultats · Cycle & muscu · Coaching · FAQ prix')}
{task('3 posts épinglés : mon histoire · démo de l\'app · meilleure transformation')}
''')

page('Partie 2 · Le lancement', f'''
<div class="kick">07 · Semaine 0</div>
<h1>Réparer les fuites <em>avant</em> d'ouvrir les vannes</h1>
<p class="lead">Chaque visiteur envoyé par une ambassadrice coûte une relation. On ne le gâche pas sur un tunnel qui fuit. Ces chantiers tiennent en 5 jours.</p>
<h2>Côté app</h2>
{task('<b>★ Supprimer l\'engagement de 12 mois</b> · créer l\'annuel à 2 mois offerts')}
{task('<b>★ Préparer Firebase Blaze</b> · alerte budget à 5 € · bascule à 70 % de quota')}
{task('<b>Carte bancaire sans compte PayPal</b> visible · testé sur iPhone et Android')}
{task('<b>Fiche Google Play</b> (TWA, 25 $) publiée')}
{task('<b>Une mise en ligne par semaine</b>, le lundi · correctifs seulement')}
{task('<b>Aligner les prix</b> (9,95 € lu par Google → 9,50 €)')}
{task('<b>Acter l\'offre coach</b> 19 € / 39 € · page coach dédiée')}
{task('<b>Créer le plan PayPal de l\'Offre Fondateur</b> (149 €/an)')}
<h2>Côté Instagram</h2>
{task('Profil corrigé (page précédente)')}
{task('10 Reels tournés d\'avance')}
{task('Liste de 100 comptes d\'ambassadrices potentielles')}
{task('Kit ambassadrice prêt (3 idées de vidéos, 5 accroches, mention légale)')}
<div class="box r" style="margin-top:28px"><p>✎ Semaine 0 terminée le <span class="fl"></span> · Ce qui a bloqué :</p>{lines(2)}</div>
''')

phases = [('Semaine 0','Réparer','Les correctifs, profil refait, 10 Reels d\'avance','0 €'),('Mois 1','Cash immédiat','10 coachings à 350 €, Offre Fondateur, salle, 50 bêta-testeurs','3 à 10 K€'),('Mois 2-3','Influence','30 ambassadrices au résultat, un défi par mois','3 à 8 K€'),('Mois 4-6','Coachs','Démarchage des coachs, défis inter-communautés','6 à 20 K€'),('Mois 7-12','Pilote auto','Équipe de coachs RepCore, SEO, résiliation sous 6 %','12 à 50 K€')]
tl = ''
for i,(w,t,d,ca) in enumerate(phases):
    tl += f'''<div style="display:grid;grid-template-columns:150px 50px 1fr;align-items:stretch;min-height:150px">
 <div style="font-family:'Bebas Neue';font-size:38px;padding-top:4px">{w}</div>
 <div style="position:relative"><div style="position:absolute;left:21px;top:0;bottom:0;width:6px;background:{'#E02020' if i==4 else '#141416'}"></div><div style="position:absolute;left:8px;top:6px;width:32px;height:32px;border-radius:50%;background:#E02020;border:5px solid #fff"></div></div>
 <div class="box{' r' if i==4 else ''}" style="margin-bottom:16px;padding:18px 22px;display:flex;justify-content:space-between;align-items:center;gap:20px"><div><h3>{t}</h3><p class="mut" style="font-size:18px">{d}</p></div><span class="tag" style="white-space:nowrap">{ca}</span></div></div>'''
page('Partie 2 · Le lancement', f'''
<div class="kick">08 · Feuille de route</div>
<h1>12 mois, <em>5 phases, 3 portes</em></h1>
<div style="margin-top:34px">{tl}</div>
<h2><span style="color:var(--r)">▲</span> Les 3 portes</h2>
<div class="grid" style="grid-template-columns:1fr 1fr 1fr">
 <div class="box"><span class="tag o">Fin mois 1</span><p style="font-size:19px;margin-top:10px">10 clients coachés <b>ou</b> 50 Offres Fondateur</p><p style="font-size:18px;margin-top:14px">{cb('s')} Franchie le __/__</p></div>
 <div class="box"><span class="tag o">Fin mois 3</span><p style="font-size:19px;margin-top:10px">20 ambassadrices actives, essai → payant ≥ 20 %</p><p style="font-size:18px;margin-top:14px">{cb('s')} Franchie le __/__</p></div>
 <div class="box r"><span class="tag">Fin mois 6</span><p style="font-size:19px;margin-top:10px">500 payants, résiliation &lt; 8 %, Blaze activé</p><p style="font-size:18px;margin-top:14px">{cb('s')} Franchie le __/__</p></div>
</div>
''')

weeks = [
 ('1','Amorcer','50 utilisateurs actifs, 10 témoignages',['Profil refait et bio en place','50 bêta-testeurs recrutés en DM : ___ / 50','10 témoignages vidéo de 20 s récoltés : ___ / 10'],'Utilisateurs actifs'),
 ('2','Cash','10 places Transformation à 350 €',['Annonce des 10 places en story et en Reel','10 DM par jour aux abonnés les plus engagés','Appels découverte réalisés : ___'],'Ventes ___ / 10 · CA'),
 ('3','Offre Fondateur','20 à 50 ventes à 149 €',['Post + Reel d\'annonce de l\'Offre Fondateur','Story compteur de places chaque jour','Relance des inscrits en essai'],'Ventes ___ / 300 · CA'),
 ('4','Communauté','100 participants au 1er défi',['Défi RepCore 30 jours lancé','Affiche QR au vestiaire (accord de la direction)','▲ Porte 1 vérifiée'],'Participants'),
 ('5','Influence','10 premiers « oui »',['15 DM ambassadrices par jour','Kit envoyé à chaque « oui »','Relance J+4 des sans-réponse'],'« Oui » reçus'),
 ('6','Influence','10 ambassadrices actives',['Repartage en story de chaque 1re vidéo','Codes ambassadeur créés et testés','15 DM par jour, toujours'],'Ambassadrices actives'),
 ('7','Défi n°2','Équipes par ambassadrice',['Défi 2 lancé, une équipe par ambassadrice','Classement public chaque vendredi','Nouvelle vague de 15 DM par jour'],'Payants cumulés'),
 ('8','Consolider','20 ambassadrices, 150 payants',['Premières commissions payées','Classement des ambassadrices publié','On coupe les 2 formats les plus faibles'],'Payants cumulés'),
 ('9','Coachs','15 coachs inscrits',['Vidéo démo coach de 60 s','10 DM coachs par jour','Offre 3 mois offerts aux 50 premiers'],'Coachs inscrits'),
 ('10','Coachs','Coachs actifs avec leurs athlètes',['Appel d\'accueil de 15 min avec chaque coach','Vitrine /c/ en bio de chaque coach','Contrat de sous-traitance RGPD signé'],'Coachs actifs'),
 ('11','Bilan','Doubler ce qui marche',['Top 3 des formats de Reels identifié','Top 5 des ambassadrices identifié','Plan du trimestre suivant écrit'],'CA du mois'),
 ('12','Porte 2','▲ Porte 2 franchie',['20 ambassadrices actives vérifié','Essai → payant ≥ 20 % vérifié','Sinon : plan de correction écrit'],'Porte franchie le'),
]
def wk(w):
    n,t,obj,tasks,res = w
    tk=''.join(f'<div class="task" style="padding:8px 0;font-size:19px">{cb("s")}<div>{x}</div></div>' for x in tasks)
    return f'''<div class="wk"><div class="top"><div class="num">S{n}</div><div style="flex:1"><h3 style="font-size:24px">{t}</h3><p class="mut" style="font-size:17px">Objectif : {obj}</p></div><div style="font-size:16px;color:var(--g)">du __/__ au __/__</div></div>
{tk}
<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:20px"><div style="display:flex;align-items:center;gap:14px"><div style="font-size:15px;font-weight:700;color:var(--g);width:120px">Reels publiés</div><div class="days"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div></div><div style="font-size:18px">✎ {res} : <span class="fl" style="min-width:150px"></span></div></div></div>'''
for i in range(0,12,3):
    first = '<div class="kick">09 · Les 90 premiers jours</div><h1 style="font-size:72px;margin-bottom:24px">Semaine par semaine</h1>' if i==0 else ''
    page('Partie 2 · Le lancement', first + ''.join(wk(w) for w in weeks[i:i+3]) + ('' if i else ''))

mois = [('4','Coachs + défis inter-communautés','6 000'),('5','30 coachs payants','7 500'),('6','▲ Porte 3','9 000'),('7','Premiers coachs RepCore','10 000'),('8','SEO : 2 articles par mois','11 000'),('9','Équipe de coaching','12 500'),('10','Résiliation sous 6 %','14 000'),('11','250 coachs en vue','15 500'),('12','Machine en pilote auto','17 000')]
page('Partie 2 · Le lancement', f'''
<div class="kick">10 · Mois 4 à 12</div>
<h1>Le suivi <em>mois par mois</em></h1>
<p class="lead">Objectif prudent en chiffres, objectif ambitieux en tête. Remplis la ligne le dernier jour du mois.</p>
<div style="margin-top:26px">{table(['Mois','Priorité du mois','Objectif CA','✎ CA réel','✎ Payants','✎ Coachs','OK'],[[m,p,o+' €','','','',cb('s')] for m,p,o in mois],['.6fr','2.4fr','1.1fr','1.1fr','1fr','1fr','.5fr'],78)}</div>
<h2>✎ Ce que j'ai appris ce trimestre</h2>
{lines(5)}
''')

# ───────────── PARTIE 3
part('Partie 3 · Les machines')
fmts=[('La charge','« Tu sais pas quoi mettre sur la barre ? Mon app te le dit à chaque série. »'),('Le cycle','« Pourquoi tu es plus faible certaines semaines du mois. »'),('La fiche papier','« J\'ai pris en photo mon vieux programme. 10 secondes plus tard… »'),('Avant / après','« 12 semaines. Même salle. Mêmes horaires. » (accord écrit)'),('Le défi','« 30 jours, 400 personnes, une seule équipe gagne. »'),('Le record','La vidéo exportée par l\'app, telle quelle.')]
page('Partie 3 · Les machines', f'''
<div class="box d" style="padding:34px 36px;margin-bottom:34px"><div class="kick" style="margin:0">Partie 3</div><div style="font-family:'Bebas Neue';font-size:70px;line-height:1;margin-top:6px">Les machines</div></div>
<div class="kick">11 · La machine Instagram</div>
<h1>1 Reel par jour, <em>6 formats</em></h1>
<div class="grid" style="grid-template-columns:1fr 1fr;margin-top:26px">
{''.join(f'<div class="box{" r" if i==1 else ""}"><span class="tag">{t}</span><p style="font-weight:700;font-size:20px;margin-top:12px">{h}</p></div>' for i,(t,h) in enumerate(fmts))}
</div>
<h2>Les règles</h2>
{task('7 à 20 secondes, accroche dans les 2 premières secondes','')}
{task('Sous-titres incrustés, un seul message par vidéo','')}
{task('Commentaire épinglé : « Écris <b>REPCORE</b> et je t\'envoie 2 mois gratuits »','')}
{task('Batch du dimanche : 2 heures pour tourner les 7 Reels','')}
{task('Chaque jour, 3 stories : un sondage, une preuve, une offre','')}
''')

days=[('Lundi','Le cycle'),('Mardi','La charge'),('Mercredi','Avant / après'),('Jeudi','La fiche papier'),('Vendredi','Le record'),('Samedi','Coulisses'),('Dimanche','Récap + appel à l\'action')]
dr=''.join(f'''<div style="display:grid;grid-template-columns:200px 1fr 120px;border:2px solid var(--n);border-radius:12px;margin-bottom:14px;overflow:hidden">
<div style="background:{'#E02020' if i==2 else '#141416'};color:#fff;padding:16px 18px"><div style="font-family:'Bebas Neue';font-size:38px;line-height:1">{d}</div><div style="font-size:15px;font-weight:700;margin-top:6px">{f}</div></div>
<div style="padding:10px 18px"><div style="font-size:15px;color:var(--g);font-weight:700">✎ ACCROCHE / IDÉE</div><div class="ln" style="height:38px"></div><div class="ln" style="height:38px"></div></div>
<div style="border-left:2px solid var(--n);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:700">{cb()}<span>PUBLIÉ</span></div></div>''' for i,(d,f) in enumerate(days))
page('Partie 3 · Les machines', f'''
<div class="kick">12 · Planificateur · à photocopier</div>
<h1 style="font-size:76px">Ma semaine de contenu</h1>
<p style="font-size:19px;margin:10px 0 22px" class="mut">Semaine du __/__ au __/__ · Rempli le samedi avec Claude, tourné le dimanche.</p>
{dr}
''')

page('Partie 3 · Les machines', f'''
<div class="kick">13 · Programme ambassadrices</div>
<h1>L'influence payée <em>uniquement au résultat</em></h1>
<svg viewBox="0 0 1040 300" width="1040" height="300" style="margin-top:28px">
 <defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#E02020"/></marker></defs>
 <g font-family="Montserrat">
  <rect x="0" y="20" width="290" height="170" rx="16" fill="#fff" stroke="#141416" stroke-width="3"/>
  <rect x="375" y="20" width="290" height="170" rx="16" fill="#fff" stroke="#141416" stroke-width="3"/>
  <rect x="750" y="20" width="290" height="170" rx="16" fill="#FDEDED" stroke="#E02020" stroke-width="3"/>
  <g font-weight="800" font-size="24" fill="#141416" text-anchor="middle"><text x="145" y="84">L'AMBASSADRICE</text><text x="520" y="84">SA COMMUNAUTÉ</text><text x="895" y="84">REPCORE ENCAISSE</text></g>
  <g font-weight="600" font-size="18" fill="#6B6B73" text-anchor="middle"><text x="145" y="124">5 000 à 60 000 abonnés</text><text x="145" y="152">poste avec son code</text><text x="520" y="124">2 mois d'essai offerts</text><text x="520" y="152">sans carte bancaire</text><text x="895" y="124">puis reverse 30 %</text><text x="895" y="152">pendant 12 mois</text></g>
  <path d="M296 105 H366" stroke="#E02020" stroke-width="4" marker-end="url(#a)"/><path d="M671 105 H741" stroke="#E02020" stroke-width="4" marker-end="url(#a)"/>
  <path d="M895 196 V250 H145 V200" fill="none" stroke="#E02020" stroke-width="3" stroke-dasharray="10 8" marker-end="url(#a)"/>
  <text x="520" y="284" text-anchor="middle" font-weight="800" font-size="19" fill="#E02020">30 % DE CHAQUE PAIEMENT + ULTIME GRATUIT À VIE</text>
 </g>
</svg>
<h2>Le parcours d'une ambassadrice</h2>
{task('<b>Jour 0</b> · DM personnalisé (script ci-dessous)','')}
{task('<b>Jour 0-2</b> · si oui : Ultime offert + code ambassadeur créé','')}
{task('<b>Jour 3</b> · kit envoyé : 3 idées de vidéos, 5 accroches, mention « collaboration commerciale », lien ?src=','')}
{task('<b>Jour 7-14</b> · 1re vidéo publiée, repartagée en story','')}
{task('<b>Chaque 1er du mois</b> · récap des inscrits et paiement de la commission','')}
<h2>Le premier message</h2>
<div class="box r"><p style="font-size:21px">« Salut [prénom], j'ai vu ta vidéo sur [sujet précis]. Je suis coach et j'ai créé RepCore : l'app de muscu qui te dit quelle charge mettre à chaque série, et qui l'ajuste à ton cycle si tu l'actives. Je te l'offre à vie. Si elle te plaît et que tu en parles, ta commu a 2 mois gratuits et toi 30 % de ce qu'ils paient pendant un an. Je t'envoie l'accès ? »</p>
<p style="font-size:18px;margin-top:14px" class="mut"><b>Relance J+4, une seule :</b> « Je me permets de remonter mon message, je sais que tes DM débordent. Toujours partante pour tester ? »</p></div>
''')

page('Partie 3 · Les machines', f'''
<div class="kick">14 · Suivi · à photocopier</div>
<h1 style="font-size:76px">Mes ambassadrices</h1>
<p class="mut" style="font-size:19px;margin:10px 0 22px">Objectif : 15 DM par jour · ~10 % de « oui » · ~50 % d'actives.</p>
{table(['Compte','Abonnés','DM le','Oui','Code','1re vidéo','Inscrits'],[['','','',cb('s'),'','',''] for _ in range(22)],['2.2fr','1fr','.9fr','.6fr','1.1fr','1fr','.9fr'],54)}
''')

page('Partie 3 · Les machines', f'''
<div class="kick">15 · Les coachs</div>
<h1>Un coach = <em>5 à 30 athlètes</em> d'un coup</h1>
<div class="grid" style="grid-template-columns:repeat(4,1fr);margin-top:26px">
 <div class="box"><span class="tag o">Libre</span><div class="big" style="font-size:60px;margin-top:8px">0 €</div><p class="mut" style="font-size:17px">1 athlète</p></div>
 <div class="box"><span class="tag o">Coach</span><div class="big" style="font-size:60px;margin-top:8px">19 €</div><p class="mut" style="font-size:17px">par mois</p></div>
 <div class="box"><span class="tag o">Pro</span><div class="big" style="font-size:60px;margin-top:8px">39 €</div><p class="mut" style="font-size:17px">par mois</p></div>
 <div class="box r"><span class="tag">Lancement</span><div class="big r" style="font-size:60px;margin-top:8px">3 mois</div><p class="mut" style="font-size:17px">offerts aux 50 premiers</p></div></div>
<h2>Le message aux coachs</h2>
<div class="box r"><p style="font-size:20px">« Salut [prénom], je suis coach comme toi. Tu suis tes clients comment aujourd'hui, Excel ou WhatsApp ? J'ai créé RepCore pour arrêter ça : tes clients ont l'app, toi tu vois leurs charges, leurs bilans et même leur cycle, sans rien ressaisir. Je t'offre 3 mois pour tester avec tes clients. Je t'envoie l'accès ? »</p></div>
<h2>✎ Suivi des coachs</h2>
{table(['Coach','Contact le','Démo','Inscrit','Athlètes','Payant le'],[['','',cb('s'),cb('s'),'',''] for _ in range(12)],['2.4fr','1fr','.7fr','.7fr','1fr','1fr'],52)}
''')

auto=[('7 scripts de Reels','Samedi','3 h'),('15 DM personnalisés','Chaque matin','3 h'),('Carrousels et stories Canva','Chaque semaine','2 h'),('Rapport du lundi','Lundi','1 h'),('Emails bienvenue / fin d\'essai','Une fois','2 h'),('2 articles SEO','Chaque mois','3 h'),('Récap des commissions','Le 1er du mois','1 h')]
page('Partie 3 · Les machines', f'''
<div class="kick">16 · L'automatisation</div>
<h1>Claude, ton équipe <em>marketing à 0 €</em></h1>
<p class="lead">Tout ce qui se répète et s'écrit passe par Claude. Toi, tu gardes ce qui demande ta tête et ta caméra : tourner, appeler, décider.</p>
<div style="margin-top:24px">{table(['Tâche confiée à Claude','Rythme','Temps gagné','En place'],[[a,b,c,cb('s')] for a,b,c in auto],['2.4fr','1.3fr','1fr','.8fr'],56)}</div>
<h2>Les routines programmées</h2>
{task('<b>Lundi 7 h 45</b> · rapport de pilotage de la semaine','routine créée ☐')}
{task('<b>Chaque matin 7 h 30</b> · script du Reel du jour + 15 DM à envoyer','routine créée ☐')}
{task('<b>Samedi 10 h</b> · scripts de la semaine suivante','routine créée ☐')}
{task('<b>Le 1er du mois</b> · récap des commissions par ambassadrice','routine créée ☐')}
<div class="box" style="margin-top:24px"><h3>Ce qu'on n'automatise pas</h3><p class="mut" style="font-size:19px;margin-top:6px">L'envoi des DM eux-mêmes (Instagram sanctionne les envois automatiques), les réponses aux clients coachés, toute publication sans relecture.</p></div>
''')

page('Partie 3 · Les machines', f'''
<div class="kick">17 · Prêts à coller</div>
<h1>3 prompts qui <em>travaillent pour toi</em></h1>
<div class="box" style="margin-top:30px"><span class="tag">Scripts de la semaine</span><p class="mono" style="margin-top:14px">Tu es mon directeur de contenu RepCore. Écris 7 scripts de Reels de 15 s pour des femmes 18-34 ans en muscu, un par format : charge, cycle, fiche papier, avant/après, défi, record, coulisses. Pour chacun : accroche des 2 premières secondes, 4 plans, texte à l'écran, légende, 5 hashtags, appel à l'action « écris REPCORE ».</p></div>
<div class="box" style="margin-top:22px"><span class="tag">DM ambassadrices</span><p class="mono" style="margin-top:14px">Voici 15 comptes avec, pour chacun, le sujet de leur dernière vidéo : [liste]. Écris un premier message privé personnalisé pour chacun, 60 mots maximum, en citant leur vidéo, avec l'offre : app offerte à vie, 2 mois gratuits pour leur commu, 30 % pendant 12 mois. Une seule question à la fin.</p></div>
<div class="box r" style="margin-top:22px"><span class="tag">Rapport du lundi</span><p class="mono" style="margin-top:14px">Voici mes chiffres de la semaine : [captures Instagram + essais, payants, résiliations, ambassadrices, coachs]. Compare à la semaine dernière et aux cibles du plan, dis-moi les 3 contenus qui ont le mieux marché et pourquoi, ce que je coupe, et mes 5 priorités de la semaine.</p></div>
<h2>✎ Mes propres prompts</h2>
{lines(6)}
''')

acts=[('Préparer','15 min'),('Tourner','20 min'),('Publier','15 min'),('Prospecter','20 min'),('Vendre','20 min')]
grid=''
for a,t in acts:
    grid+=f'<div style="display:grid;grid-template-columns:170px repeat(30,1fr);align-items:center;margin-bottom:8px"><div style="font-weight:800;font-size:18px">{a}<div class="mut" style="font-size:14px;font-weight:600">{t}</div></div>' + ''.join('<div style="height:26px;border:2px solid #141416;border-radius:4px;margin:0 2px"></div>' for _ in range(30)) + '</div>'
nums='<div style="display:grid;grid-template-columns:170px repeat(30,1fr);margin-bottom:6px"><div></div>'+''.join(f'<div style="text-align:center;font-size:12px;font-weight:700;color:#6B6B73">{i}</div>' for i in range(1,31))+'</div>'
page('Partie 3 · Les machines', f'''
<div class="kick">18 · La discipline</div>
<h1>La routine de <em>90 minutes</em></h1>
<div style="display:flex;height:110px;margin-top:30px;border-radius:14px;overflow:hidden">
 <div style="flex:15;background:#5E0E0E;color:#fff;padding:14px 16px"><div class="big" style="font-size:44px">15'</div><div style="font-weight:800;font-size:16px">Préparer</div></div>
 <div style="flex:20;background:#E02020;color:#fff;padding:14px 16px"><div class="big" style="font-size:44px">20'</div><div style="font-weight:800;font-size:16px">Tourner</div></div>
 <div style="flex:15;background:#9E1414;color:#fff;padding:14px 16px"><div class="big" style="font-size:44px">15'</div><div style="font-weight:800;font-size:16px">Publier</div></div>
 <div style="flex:20;background:#B01818;color:#fff;padding:14px 16px"><div class="big" style="font-size:44px">20'</div><div style="font-weight:800;font-size:16px">Prospecter</div></div>
 <div style="flex:20;background:#141416;color:#fff;padding:14px 16px"><div class="big" style="font-size:44px">20'</div><div style="font-weight:800;font-size:16px">Vendre</div></div></div>
<p class="mut" style="font-size:18px;margin-top:12px">Préparer = Claude sort le script et les 15 DM · Tourner en salle · Publier + répondre · Envoyer les DM · Appels découverte coaching.</p>
<h2>✎ Mon suivi sur 30 jours</h2>
<p class="mut" style="font-size:18px;margin-bottom:14px">Une case cochée par bloc fait. Mois du __/__ au __/__.</p>
{nums}{grid}
<div class="box r" style="margin-top:30px"><h3>Gel du développement pendant 90 jours</h3><p style="font-size:19px;margin-top:6px">Une mise en ligne par semaine, correctifs seulement. Chaque heure de code est une heure sans vendre.</p><p style="font-size:19px;margin-top:14px">✎ Jours sans code ce mois : <span class="fl"></span> / 30</p></div>
''')

opt=[('Mensuel sans engagement + annuel −2 mois','S','Semaine 0'),('Offre Fondateur (plan PayPal + compteur)','S','Semaine 0'),('« Thomas t\'invite » : prénom du parrain','S','Mois 1'),('Légende + #RepCore pré-remplies au partage','S','Mois 1'),('Écran de fin d\'essai « Ce que tu as construit »','M','Mois 1'),('Parcours des 7 premiers jours','M','Mois 2'),('Relance des inactifs J+5, J+10, J+20','M','Mois 2'),('Écran « Passer au coaching » après 3 mois','S','Mois 3'),('Carrousel Wrapped au format 4:5','S','Mois 3'),('Paiement Stripe en plus de PayPal','L','Mois 4+')]
page('Partie 3 · Les machines', f'''
<div class="kick">19 · Optimisations produit</div>
<h1>Ce qu'on code <em>(un peu)</em></h1>
<p class="lead">Pendant le gel, on ne code que ce qui fait vendre ou garder un abonné. Classé par argent rapporté par heure de code.</p>
<div style="margin-top:24px">{table(['#','Chantier','Effort','Quand','Fait le'],[[str(i+1),a,b,c,''] for i,(a,b,c) in enumerate(opt)],['.4fr','3fr','.7fr','1fr','1fr'],62)}</div>
<p class="mut" style="font-size:17px;margin-top:12px">Effort : S = moins d'une journée · M = quelques jours · L = plus d'une semaine.</p>
<h2>✎ Idées produit en attente (après le mois 4)</h2>
{lines(5)}
''')

# ───────────── PARTIE 4
part('Partie 4 · Le pilotage')
page('Partie 4 · Le pilotage', f'''
<div class="box d" style="padding:34px 36px;margin-bottom:34px"><div class="kick" style="margin:0">Partie 4</div><div style="font-family:'Bebas Neue';font-size:70px;line-height:1;margin-top:6px">Le pilotage</div></div>
<div class="kick">20 · La projection</div>
<h1>De 3 K€ à <em>50 K€</em> par mois</h1>
<svg viewBox="0 0 1040 520" width="1040" height="520" style="margin-top:26px">
 <g font-family="Montserrat" font-size="17" fill="#6B6B73" font-weight="600">
  <line x1="70" y1="460" x2="1030" y2="460" stroke="#141416" stroke-width="2"/>
  <line x1="70" y1="370" x2="1030" y2="370" stroke="#E4E4E8"/><line x1="70" y1="280" x2="1030" y2="280" stroke="#E4E4E8"/><line x1="70" y1="190" x2="1030" y2="190" stroke="#E4E4E8"/><line x1="70" y1="100" x2="1030" y2="100" stroke="#E4E4E8"/>
  <text x="58" y="466" text-anchor="end">0</text><text x="58" y="376" text-anchor="end">10 K€</text><text x="58" y="286" text-anchor="end">20 K€</text><text x="58" y="196" text-anchor="end">30 K€</text><text x="58" y="106" text-anchor="end">40 K€</text>
  <g text-anchor="middle"><text x="110" y="494">M1</text><text x="190" y="494">M2</text><text x="270" y="494">M3</text><text x="350" y="494">M4</text><text x="430" y="494">M5</text><text x="510" y="494">M6</text><text x="590" y="494">M7</text><text x="670" y="494">M8</text><text x="750" y="494">M9</text><text x="830" y="494">M10</text><text x="910" y="494">M11</text><text x="990" y="494">M12</text></g>
 </g>
 <polyline fill="none" stroke="#A0A0A8" stroke-width="5" points="110,433 190,428.5 270,419.5 350,406 430,392.5 510,379 590,370 670,361 750,347.5 830,334 910,320.5 990,307"/>
 <polyline fill="none" stroke="#E02020" stroke-width="6" points="110,370 190,397 270,379 350,343 430,307 510,271 590,226 670,181 750,145 830,100 910,55 990,10"/>
 <g font-family="Montserrat" font-weight="800" font-size="20"><text x="960" y="30" text-anchor="end" fill="#E02020">Ambitieux : 50 K€</text><text x="990" y="292" text-anchor="end" fill="#6B6B73">Prudent : 17 K€</text></g>
</svg>
<p class="mut" style="font-size:16px">Projection selon les hypothèses du plan, pas des données mesurées. Pic du mois 1 : coaching + annuels encaissés d'avance.</p>
<h2>✎ Mon CA réel, à reporter sur la courbe</h2>
{table(['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12'],[['']*12],['1fr']*12,64)}
''')

page('Partie 4 · Le pilotage', f'''
<div class="kick">21 · Les chiffres qui décident</div>
<h1>La résiliation <em>décide de tout</em></h1>
<div class="box r" style="margin-top:30px"><p class="mut" style="font-size:19px">À 8 % de résiliation mensuelle, 2 300 abonnés en perdent</p><div class="big" style="font-size:130px;margin-top:6px">184 / mois</div>
<p style="margin-top:10px">Il faut donc <b>≈ 380 nouveaux payants par mois</b> pour continuer à monter. Passer à 6 %, c'est <b>46 abonnés sauvés chaque mois</b>.</p></div>
<h2>Les 3 équations</h2>
<div class="box" style="margin-bottom:14px"><h3>Nouveaux payants nécessaires</h3><p style="font-size:20px;margin-top:6px">= abonnés × résiliation + croissance visée</p></div>
<div class="box" style="margin-bottom:14px"><h3>Valeur d'un abonné</h3><p style="font-size:20px;margin-top:6px">≈ prix moyen ÷ résiliation · 15 € ÷ 8 % ≈ 190 € · à 6 % ≈ 250 €</p></div>
<div class="box"><h3>Coût d'un abonné ramené par une ambassadrice</h3><p style="font-size:20px;margin-top:6px">30 % × 12 mois × 15 € ≈ 54 €, payé uniquement sur l'encaissé</p></div>
<h2>Ce qui sort chaque mois (M12 ambitieux)</h2>
{table(['Poste','Montant'],[['TVA (20 % du TTC)','≈ 8 300 €'],['Commissions ambassadrices','≈ 6 000 €'],['Frais PayPal (≈ 3 %)','≈ 1 500 €'],['Hébergement','100 à 400 €']],['3fr','1fr'],52)}
<p class="tx" style="margin-top:18px">{cb('s')} &nbsp;Rendez-vous expert-comptable pris dès 5 000 € de CA mensuel (TVA, statut)</p>
''')

ind=['Essais','Essai→payant','Résiliation','Ambassadrices','Coachs','Quota Firebase']
page('Partie 4 · Le pilotage', f'''
<div class="kick">22 · Le tableau de bord du lundi</div>
<h1>6 chiffres, <em>15 minutes</em></h1>
<div style="margin-top:20px">{table(['Indicateur','Cible','Alerte si','Action'],[['Nouveaux essais / semaine','+20 % / mois','2 semaines en baisse','Doubler les formats qui marchent'],['Essai → payant','≥ 20 %','< 15 %','Revoir fin d\'essai + 7 premiers jours'],['Résiliation mensuelle','< 6 %','> 8 %','Appeler 10 résiliants'],['Ambassadrices actives','10 → 40','< 50 % de la cible','Passer à 20 DM / jour'],['Coachs payants','30 → 250','< 50 % de la cible','Revoir démo et message'],['Quota Firebase','< 70 %','≥ 70 %','Basculer en Blaze le jour même']],['1.7fr','1fr','1.2fr','2fr'],56)}</div>
<h2>✎ Mes 12 premières semaines</h2>
{table(['Sem.']+ind,[[f'S{i}']+['']*6 for i in range(1,13)],['.6fr']+['1fr']*6,48)}
''')

risks=[('La panne','Un Reel viral sur un plan gratuit saturé : l\'app tombe pour les payants.','Blaze prêt, bascule à 70 %'),('Données de santé','Cycle, photos, mensurations : catégorie sensible RGPD.','Consentement explicite, rien montré sans accord écrit'),('Loi influence','Mention « collaboration commerciale » obligatoire (9 juin 2023).','Dans le kit ambassadrice, contrat d\'une page'),('Engagement 12 mois','Litiges et remboursements PayPal.','Supprimé en semaine 0'),('Coachs tiers','RepCore devient sous-traitant RGPD.','Contrat de sous-traitance signé'),('Mon temps','Coder, coacher 40 clients et prospecter : impossible.','Gel du code, routine 90 min, Claude')]
page('Partie 4 · Le pilotage', f'''
<div class="kick">23 · Les garde-fous</div>
<h1>Les risques <em>tenus en laisse</em></h1>
<div style="margin-top:28px">{''.join(f'<div class="box{" r" if i==5 else ""}" style="margin-bottom:16px;display:grid;grid-template-columns:90px 1fr 60px;gap:16px;align-items:center"><div class="big r" style="font-size:64px">0{i+1}</div><div><h3>{a}</h3><p class="mut" style="font-size:18px">{b}</p><p style="font-size:18px;margin-top:4px"><b>Parade :</b> {c}</p></div>{cb()}</div>' for i,(a,b,c) in enumerate(risks))}</div>
''')

ideas=['Offre Fondateur 149 € l\'an, 300 places, compteur public','Transformation 90 jours à 350 €, 10 places puis liste d\'attente','Mensuel sans engagement + annuel à 2 mois offerts','Commentaire épinglé « Écris REPCORE » sur chaque Reel','15 DM ambassadrices par jour','Un défi RepCore par mois, équipes par ambassadrice','Affiche QR code au vestiaire de la salle','50 bêta-testeurs contre un témoignage vidéo','« Thomas t\'invite » : prénom du parrain à l\'arrivée','Légende + #RepCore pré-remplies au partage','Live Instagram de 20 min le jeudi','Story quotidienne « places restantes »','Fiche Google Play (TWA)','Écran de fin d\'essai « Ce que tu as construit »','Parcours des 7 premiers jours','Relance des inactifs J+5, J+10, J+20','Programme « Fessiers 8 semaines » à 14,90 €','Programme « Force débutante » à 14,90 €','Programme « Muscu et cycle » à 14,90 €','Carrousel « Ton cycle, phase par phase »','Série « Je coache ma copine pendant 30 jours »','Reel en collab avec une ambassadrice','Ambassadrices élite à 40 % après 3 mois','Classement mensuel public des ambassadrices','Vitrine coach /c/ en bio de chaque coach','3 mois offerts aux 50 premiers coachs','Démo coach de 60 secondes en vidéo','Partenariat avec 3 salles locales','Défi inter-salles avec classement','Wrapped mensuel en carrousel 4:5','Newsletter mensuelle aux inscrits','Séquence email de bienvenue en 5 messages','Séquence de fin d\'essai (J-5, J-2, J0)','Email de réactivation des anciens essais','2 articles SEO par mois','Page pilier « Muscu et cycle menstruel »','Comparatif « RepCore vs carnet vs Excel »','Écran « Passer au coaching » après 3 mois','Carte cadeau « 3 mois d\'Ultime » pour Noël','Black Friday : annuel à −40 % pendant 72 h','Janvier « Nouvelle année, nouveau programme »','Témoignages clients en stories à la une','Live avec une sage-femme ou une médecin du sport','Kit presse pour les médias fitness','Formation de coachs RepCore en partage de revenus','Paiement Stripe en plus de PayPal','Version anglaise pour l\'international','Pack salle de sport (licence club)','Merch RepCore pour les gagnants des défis','Fit Pulse pour d\'autres clubs (après vérification de la propriété)']
imp=[3,3,3,3,3,3,2,3,2,2,2,2,3,3,3,3,2,2,3,3,2,3,2,2,2,3,3,2,2,2,1,2,3,2,2,3,1,2,2,3,3,2,2,1,3,2,2,2,1,2]
def idea_rows(a,b): return [[str(i+1),ideas[i],'★'*imp[i],cb('s')] for i in range(a,b)]
page('Partie 4 · Le pilotage', f'''
<div class="kick">24 · Banque d'idées</div>
<h1>50 leviers, <em>coche au fur et à mesure</em></h1>
<p class="mut" style="font-size:18px;margin:10px 0 18px">★★★ = fort impact sur le CA. Commence par les ★★★ les plus simples.</p>
{table(['#','Idée','Impact','Fait'],idea_rows(0,25),['.4fr','4fr','.8fr','.5fr'],44)}
''')
page('Partie 4 · Le pilotage', f'''
<div class="kick">24 · Banque d'idées (suite)</div>
<h1 style="font-size:72px;margin-bottom:22px">Leviers 26 à 50</h1>
{table(['#','Idée','Impact','Fait'],idea_rows(25,50),['.4fr','4fr','.8fr','.5fr'],46)}
''')

page('Notes', f'''
<div class="kick">Notes</div>
<h1 style="font-size:72px;margin-bottom:20px">Mes notes</h1>
{lines(28)}
''')

page('', f'''
<div style="position:absolute;inset:0;background:#0B0B0C"></div>
<div style="position:absolute;left:100px;right:100px;top:330px;text-align:center;color:#fff">
 <img src="{IMG}logo.png" style="width:150px;height:150px;border-radius:28px">
 <h1 style="font-size:190px;line-height:.9;margin-top:50px;color:#fff">On lance.<br><em>Maintenant.</em></h1>
 <p style="font-size:26px;color:#C8C8CE;margin-top:40px">Les 3 actions de demain matin :</p>
 <div style="margin:30px auto 0;max-width:640px;text-align:left">
  <div style="display:flex;gap:20px;align-items:center;font-size:30px;font-weight:700;padding:16px 0;border-bottom:2px solid #333"><span class="cb" style="border-color:#fff;background:transparent;width:36px;height:36px"></span>Refaire la bio</div>
  <div style="display:flex;gap:20px;align-items:center;font-size:30px;font-weight:700;padding:16px 0;border-bottom:2px solid #333"><span class="cb" style="border-color:#fff;background:transparent;width:36px;height:36px"></span>Tourner 3 Reels</div>
  <div style="display:flex;gap:20px;align-items:center;font-size:30px;font-weight:700;padding:16px 0"><span class="cb" style="border-color:#fff;background:transparent;width:36px;height:36px"></span>Envoyer 15 messages</div></div>
 <p style="font-size:30px;font-weight:800;color:#E02020;margin-top:70px">50 000 € par mois commence par une vidéo.</p>
</div>
''', 'cover')

# Sommaire
toc_html = '<div class="kick">Sommaire</div><h1 style="margin-bottom:36px">Ce que contient <em>ce guide</em></h1>'
idx = 0
entries = []
for i,(sec,body,cls) in enumerate(pages):
    pass
items = [('Mode d\'emploi et engagement',2)]
# repérer les pages par kicker
import re
for i,(sec,body,cls) in enumerate(pages):
    m = re.search(r'<div class="kick">(\d\d) · ([^<]+)</div>', body)
    if m and not body.startswith('\n<div class="kick">24 · Banque d\'idées (suite)'):
        items.append((f'{m.group(1)} · {m.group(2)}', i+1))
parts = dict((p,t) for t,p in TOC)
for name,pg in items:
    if pg in parts:
        toc_html += f'<div style="font-family:\'Bebas Neue\';font-size:34px;color:var(--r);margin:18px 0 2px">{parts[pg]}</div>'
    toc_html += f'<div class="task" style="padding:6px 0;font-size:20px"><div>{name}</div><div class="d" style="font-size:20px;color:var(--n);font-weight:800">p. {pg}</div></div>'
pages[2] = (pages[2][0], toc_html, '')

out = ['<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>RepCore — Le guide</title>']
if MODE == 'canva': out.append(FONTS_CANVA)
out.append('<style>' + (FONTS_PRINT if MODE != 'canva' else '') + CSS + '</style></head><body>')
for i,(sec,body,cls) in enumerate(pages):
    n = i+1
    hd = '' if cls=='cover' else f'<div class="hd"><div class="l"><img src="{IMG}logo.png">REPCORE · LE GUIDE</div><div class="s">{sec}</div></div>'
    ft = '' if cls=='cover' else f'<div class="ft"><span>Plan de domination 2026-2027</span><b>{n}</b></div>'
    role = ' data-document-role="page"' if MODE=='canva' else ''
    out.append(f'<section class="p"{role}>{hd}{body}{ft}</section>')
out.append('</body></html>')
open('guide-canva.html' if MODE=='canva' else 'guide.html','w').write('\n'.join(out))
print(len(pages),'pages')
