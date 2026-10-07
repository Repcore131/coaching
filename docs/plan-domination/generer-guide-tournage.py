# Guide de tournage RepCore — 4 vidéos (A4 portrait, à imprimer)
import re
src = open('gen.py').read()
exec(src[:src.index('# ───────────── 1 COUVERTURE')])   # CSS, polices, helpers (page, task, table, lines, cb)
IMG = 'img/'; V = 'vimg/'

CSS += """
.shot .row>div{font-size:15px;line-height:1.4;display:block;padding:9px 10px}
.shot .row.h>div{font-size:12.5px;display:flex;align-items:center}
.shot .row.h>div:last-child{background:var(--r);border-color:var(--r);color:#fff}
.shot .row>div:first-child{font-family:'Bebas Neue';font-size:26px;color:var(--r);line-height:1}
.shot .row>div:last-child{background:#FAFAFB}
.pitch{border-left:8px solid var(--r);background:var(--t);border-radius:0 14px 14px 0;padding:22px 26px}
.pitch p{font-size:21px}
.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:18px}
.meta .box{padding:14px 16px}
.meta .k{font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--g)}
.meta .v{font-family:'Bebas Neue';font-size:34px;line-height:1.05;margin-top:4px}
.vo{font-size:19px;line-height:1.65;column-count:2;column-gap:40px}
.vo b{color:var(--r)}
.lex{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.lex .box{padding:16px 18px}
.lex h3{font-size:20px}
.lex p{font-size:16px;color:#3A3A40;margin-top:4px}
"""

def shots(rows, h=96):
    return '<div class="shot">' + table(['#','Temps','Image · cadrage','Voix · texte à l\'écran','Effet · son · IA','✎ Modification'],
        rows, ['.38fr','.72fr','2.05fr','2.2fr','1.65fr','1.45fr'], h) + '</div>'

def meta(items):
    return '<div class="meta">' + ''.join(f'<div class="box"><div class="k">{k}</div><div class="v">{v}</div></div>' for k, v in items) + '</div>'

def mock(name, w=300, cap=''):
    return f'<div style="text-align:center"><img src="{V}m-{name}.png" style="width:{w}px">' + (f'<p class="mut" style="font-size:14px;margin-top:-6px">{cap}</p>' if cap else '') + '</div>'

# ═════════════════════════ COUVERTURE
page('', f'''
<img src="{IMG}bg-video-cover.jpg" style="position:absolute;left:0;top:0;width:1240px;height:1754px">
<div style="position:absolute;left:100px;top:90px;display:flex;align-items:center;gap:18px">
 <img src="{IMG}logo.png" style="width:86px;height:86px;border-radius:16px">
 <div style="font-family:'Bebas Neue';font-size:40px;letter-spacing:.08em;color:#fff">REPCORE · LE PLATEAU</div></div>
<div style="position:absolute;left:100px;right:100px;top:900px">
 <div class="kick" style="font-size:20px">Guide de tournage · 4 vidéos · format paysage 16:9</div>
 <h1 style="font-size:170px;line-height:.86;color:#fff">Silence.<br><em>On tourne.</em></h1>
 <p style="font-size:30px;color:#fff;font-weight:700;margin-top:30px">Motivation · Vente du coaching · Tuto diète stricte · Tuto diète flexible</p>
 <p style="font-size:24px;color:#C8C8CE;margin-top:8px">Pitchs, scripts plan par plan, lumière, cadrages, effets et IA. Avec une colonne pour réécrire au crayon.</p>
 <div style="margin-top:50px;border:2px solid #fff;border-radius:16px;padding:24px 30px;color:#fff;font-size:21px;display:grid;grid-template-columns:1fr 1fr;gap:20px">
  <div>Tournage prévu le : <span class="fl" style="border-color:#fff;min-width:200px"></span></div>
  <div>Lieu(x) : <span class="fl" style="border-color:#fff;min-width:240px"></span></div></div>
</div>
<div style="position:absolute;left:100px;bottom:60px;color:#A0A0A8;font-weight:700;font-size:16px;letter-spacing:.24em">KEVIN GUELLEC · GUELLEC COACHING PRO</div>
''', 'cover')

# ═════════════════════════ LA RÈGLE DU JEU
page('Avant de tourner', f'''
<div class="kick">00 · La règle du jeu</div>
<h1>4 vidéos, <em>un seul message</em></h1>
<p class="lead">Les gens ne te connaissent pas encore. Tu n'as pas des dizaines d'avant/après. Ce qui doit sauter aux yeux dans chaque image : <b>le sérieux</b>. Quelqu'un de passionné, qui mesure tout, et qui a construit son propre outil parce qu'aucun ne suffisait.</p>
<div class="grid" style="grid-template-columns:1fr 1fr;margin-top:30px">
 <div class="box r"><span class="tag">Vidéo 1</span><h3 style="margin-top:10px">« Personne ne viendra te chercher »</h3><p class="mut" style="font-size:17px">Motivation · 55 s · Instagram, YouTube, page de vente. Donne envie d'ouvrir l'app.</p></div>
 <div class="box r"><span class="tag">Vidéo 2</span><h3 style="margin-top:10px">« Comment je coache »</h3><p class="mut" style="font-size:17px">Vente · 2 min 40 · envoyée en message privé à chaque demande d'info. Donne envie de payer.</p></div>
 <div class="box"><span class="tag o">Vidéo 3</span><h3 style="margin-top:10px">« Bienvenue dans ton coaching » · diète stricte</h3><p class="mut" style="font-size:17px">Tuto · 4 min · envoyée juste après le 1er bilan.</p></div>
 <div class="box"><span class="tag o">Vidéo 4</span><h3 style="margin-top:10px">« Bienvenue dans ton coaching » · diète flexible</h3><p class="mut" style="font-size:17px">Tuto · 4 min · même tronc commun, module nutrition différent.</p></div>
</div>
<h2>Les 5 règles anti-kitsch</h2>
{task('<b>3 couleurs, pas une de plus :</b> noir, blanc, rouge RepCore #E02020. Étalonnage contrasté, noirs profonds.','')}
{task('<b>Un effet toutes les 5 secondes maximum.</b> Un flash, un glitch ou un éclair dure 2 à 4 images, jamais plus.','')}
{task('<b>Les effets viennent de l’app :</b> l’éclair du record, le rang, le Wrapped. On ne colle pas d’effet « stock » qui n’existe pas dans le produit.','')}
{task('<b>Le son fait 50 % de la vidéo :</b> respiration, disques qui claquent, un silence avant chaque révélation.','')}
{task('<b>Rien de faux :</b> pas de chiffre inventé, pas de client sans accord écrit, pas de promesse de résultat.','')}
<h2>✎ Mes intentions pour ces vidéos</h2>
{lines(3)}
''')

# ═════════════════════════ LEXIQUE
def ang_svg():
    return '''<svg viewBox="0 0 1040 330" width="1040" height="330"><g font-family="Montserrat" font-size="17" font-weight="700" fill="#141416">
 <line x1="40" y1="300" x2="1000" y2="300" stroke="#141416" stroke-width="3"/>
 <circle cx="520" cy="118" r="34" fill="#141416"/><rect x="480" y="158" width="80" height="142" rx="18" fill="#141416"/>
 <g fill="#E02020"><rect x="150" y="30" width="70" height="44" rx="8"/><rect x="150" y="128" width="70" height="44" rx="8"/><rect x="150" y="236" width="70" height="44" rx="8"/>
 <rect x="830" y="128" width="70" height="44" rx="8"/></g>
 <g stroke="#E02020" stroke-width="3" stroke-dasharray="8 6"><line x1="222" y1="56" x2="480" y2="120"/><line x1="222" y1="150" x2="480" y2="128"/><line x1="222" y1="256" x2="480" y2="140"/><line x1="828" y1="150" x2="560" y2="128"/></g>
 <text x="40" y="24">PLONGÉE</text><text x="40" y="200" >NIVEAU DES YEUX</text><text x="40" y="326">CONTRE-PLONGÉE</text>
 <text x="760" y="110">CONTRE-CHAMP</text><text x="610" y="232" font-weight="600" fill="#6B6B73">le sujet</text>
 </g></svg>'''

def plans_svg():
    items = [('Plan large', .8, 0, 20, 'le décor + toi'), ('Plan moyen', 1.3, 0, -2, 'de la tête aux genoux'), ('Plan serré', 2.2, 0, -32, 'buste et visage'), ('Gros plan', 3.2, 0, -56, 'le visage'), ('Très gros plan', 8, 7, -63, 'un œil, une main')]
    fig = ('<line x1="-80" y1="95" x2="80" y2="95" stroke="#C8C8CE" stroke-width="2"/>'
           '<circle cx="0" cy="-60" r="18" fill="#141416"/><circle cx="7" cy="-63" r="2.6" fill="#fff"/><circle cx="-7" cy="-63" r="2.6" fill="#fff"/>'
           '<rect x="-28" y="-38" width="56" height="88" rx="9" fill="#141416"/><rect x="-26" y="50" width="22" height="45" rx="6" fill="#141416"/><rect x="4" y="50" width="22" height="45" rx="6" fill="#141416"/>')
    out = '<svg viewBox="0 0 1040 300" width="1040" height="300"><defs>'
    out += ''.join(f'<clipPath id="cp{i}"><rect x="{20+i*205}" y="20" width="185" height="200" rx="10"/></clipPath>' for i in range(5))
    out += '</defs><g font-family="Montserrat">'
    for i, (n, z, fx, fy, d) in enumerate(items):
        x = 20 + i * 205; cx, cy = x + 92, 120
        out += f'<rect x="{x}" y="20" width="185" height="200" rx="10" fill="#F2F2F4"/>'
        out += f'<g clip-path="url(#cp{i})"><g transform="translate({cx},{cy}) scale({z}) translate({-fx},{-fy})">{fig}</g></g>'
        out += f'<rect x="{x}" y="20" width="185" height="200" rx="10" fill="none" stroke="#E02020" stroke-width="4"/>'
        out += f'<text x="{x+92}" y="252" text-anchor="middle" font-weight="800" font-size="19" fill="#141416">{n}</text><text x="{x+92}" y="278" text-anchor="middle" font-size="15" fill="#6B6B73">{d}</text>'
    return out + '</g></svg>'

page('Avant de tourner', f'''
<div class="kick">00 · Le lexique du plateau</div>
<h1>Parler <em>comme un réalisateur</em></h1>
<p class="lead" style="font-size:20px">Les mots utilisés dans les tableaux de plans. Les cadrages découpent le sujet, les angles placent la caméra.</p>
<h2 style="margin-top:22px">Les cadrages</h2>
<div style="overflow:hidden">{plans_svg()}</div>
<h2 style="margin-top:6px">Les angles</h2>
{ang_svg()}
<div class="lex" style="margin-top:14px">
 <div class="box"><h3>Plongée</h3><p>Caméra au-dessus : le sujet paraît petit, seul, face à l'effort.</p></div>
 <div class="box"><h3>Contre-plongée</h3><p>Caméra en dessous : le sujet paraît fort, dominant. Parfait sous la barre.</p></div>
 <div class="box"><h3>Champ / contre-champ</h3><p>On filme une personne, puis ce qu'elle regarde (toi, puis l'écran).</p></div>
 <div class="box"><h3>Panoramique</h3><p>La caméra pivote sur place, de gauche à droite ou de haut en bas.</p></div>
 <div class="box"><h3>Travelling</h3><p>La caméra avance, recule ou glisse (stabilisateur, ou à pied, très lentement).</p></div>
 <div class="box"><h3>Plan sur l'épaule</h3><p>Caméra derrière ton épaule : on voit ce que tu vois (l'écran, la barre).</p></div>
 <div class="box"><h3>Ralenti</h3><p>Filmer en 50 ou 100 images/s, lire en 25 : magnésie, disques, sueur.</p></div>
 <div class="box"><h3>Rampe de vitesse</h3><p>Le plan accélère puis ralentit sur l'instant clé (la remontée du squat).</p></div>
 <div class="box"><h3>Raccord sur le geste</h3><p>Un mouvement commence dans un plan et finit dans le suivant : le montage devient fluide.</p></div>
</div>
''')

# ═════════════════════════ LUMIÈRE + MATÉRIEL
def light_svg(title, items, note):
    out = f'<svg viewBox="0 0 500 400" width="500" height="400"><g font-family="Montserrat"><rect x="4" y="4" width="492" height="392" rx="16" fill="#F7F7F8" stroke="#141416" stroke-width="2"/>'
    out += f'<text x="24" y="40" font-weight="800" font-size="20" fill="#141416">{title}</text>'
    out += '<circle cx="250" cy="200" r="30" fill="#141416"/><text x="250" y="252" text-anchor="middle" font-size="14" font-weight="700" fill="#141416">TOI</text>'
    out += '<rect x="225" y="330" width="50" height="34" rx="6" fill="#141416"/><text x="250" y="384" text-anchor="middle" font-size="13" font-weight="700" fill="#141416">CAMÉRA</text>'
    for (x, y, lab, col) in items:
        out += f'<circle cx="{x}" cy="{y}" r="22" fill="{col}"/><line x1="{x}" y1="{y}" x2="250" y2="200" stroke="{col}" stroke-width="3" stroke-dasharray="7 6"/>'
        out += f'<text x="{x}" y="{y + (44 if y > 200 else -32)}" text-anchor="middle" font-size="14" font-weight="800" fill="#141416">{lab}</text>'
    out += f'<text x="24" y="{372}" font-size="13" fill="#6B6B73">{note}</text>'
    return out + '</g></svg>'

page('Avant de tourner', f'''
<div class="kick">00 · Lumière et matériel</div>
<h1>Deux décors, <em>deux lumières</em></h1>
<div class="grid" style="grid-template-columns:1fr 1fr;gap:40px;margin-top:24px">
 <div>{light_svg('MAISON · le bureau du coach', [(110,110,'LUMIÈRE PRINCIPALE 45°','#F2C230'),(395,140,'CONTRE-JOUR ROUGE','#E02020'),(400,300,'LAMPE DÉCOR','#A0A0A8')], 'Fond sombre, 2 m derrière toi. Rideaux fermés.')}
 <p style="font-size:17px;margin-top:10px"><b>Principale</b> : lampe LED ou fenêtre, à 45° devant, un peu au-dessus des yeux. <b>Contre-jour</b> : ruban LED ou ampoule rouge derrière toi, qui découpe épaules et cheveux. <b>Lampe décor</b> : une lampe allumée dans le fond, pour la profondeur.</p></div>
 <div>{light_svg('SALLE · clair-obscur', [(100,200,'LUMIÈRE LATÉRALE DURE','#F2C230'),(400,110,'NÉON / ROUGE','#E02020')], 'Éteindre la moitié des néons si possible.')}
 <p style="font-size:17px;margin-top:10px"><b>Une seule lumière forte sur le côté</b> : la moitié du visage dans l'ombre, les muscles dessinés. <b>Une touche rouge</b> dans le fond (LED RGB posée au sol). Tourner tôt le matin ou en heure creuse, avec l'accord écrit de la salle.</p></div>
</div>
<h2>Le matériel (déjà dans ta poche)</h2>
{table(['Quoi','Réglage','✎ J’ai / à trouver'],[
 ['Smartphone récent (caméra principale)','4K, 25 i/s pour la parole · 50 ou 100 i/s pour les ralentis · mode pro, exposition et mise au point verrouillées',''],
 ['Trépied + support téléphone','Caméra à hauteur des yeux pour la parole, au sol pour les contre-plongées',''],
 ['Micro-cravate (filaire ou sans fil)','Indispensable pour les vidéos 2, 3 et 4 : le son compte plus que l’image',''],
 ['1 lampe LED + 1 ruban LED rouge','Lumière principale et contre-jour (voir schémas)',''],
 ['Enregistrement d’écran','Téléphone : enregistreur natif. Mode avion, notifications coupées, compte de démo propre',''],
 ['Montage','CapCut (sous-titres auto, effets, rampes de vitesse) · Canva (mock-ups, titres)','']],['1.6fr','3fr','1.1fr'],62)}
''')

# ═════════════════════════ IA
page('Avant de tourner', f'''
<div class="kick">00 · L'IA au service du montage</div>
<h1>Ce que l'IA fait, <em>ce qu'elle ne fait pas</em></h1>
<p class="lead" style="font-size:20px">L'IA sert à <b>prolonger</b> tes images : un plan d'ambiance, une transition, un mock-up. Elle ne remplace jamais toi, tes clients ou l'app : ce sont eux, la preuve.</p>
{table(['Besoin','Outil','Comment','✎ Note'],[
 ['Plans d’ambiance (ville de nuit, salle vide, magnésie)','Higgsfield (connecté) · génération vidéo','Prompt court et précis, 5 s, 16:9, « film photography, no text »',''],
 ['Mock-up 3D du téléphone qui tourne','Higgsfield ou Canva (mock-ups)','Capture d’écran réelle de l’app, jamais un écran inventé',''],
 ['Agrandir une image ou une vidéo floue','Higgsfield · upscale','Pour les anciens rushes et les captures',''],
 ['Sous-titres, rampes de vitesse, flashs','CapCut','Sous-titres blancs, mot-clé en rouge, police Montserrat Bold',''],
 ['Scripts, accroches, variantes','Claude','« Donne-moi 5 accroches pour la vidéo 1 »','']],['2fr','1.4fr','2.4fr','1fr'],66)}
<h2>4 prompts prêts (vidéo IA, 16:9, 5 s)</h2>
<div class="box"><span class="tag">Salle vide</span><p class="mono" style="margin-top:10px">Cinematic wide shot of an empty dark gym at dawn, single red neon light, dust in the air, barbell on the floor, slow dolly forward, film grain, high contrast, no people, no text.</p></div>
<div class="box" style="margin-top:12px"><span class="tag">Magnésie</span><p class="mono" style="margin-top:10px">Extreme close-up of chalk dust falling from hands in slow motion, black background, hard side light, red rim light, 100 fps look, no text.</p></div>
<div class="box" style="margin-top:12px"><span class="tag">Ville de nuit</span><p class="mono" style="margin-top:10px">Aerial establishing shot of a French city at 5 am, blue hour, a few lit windows, slow push-in, moody, cinematic, no text.</p></div>
<div class="box" style="margin-top:12px"><span class="tag">Téléphone</span><p class="mono" style="margin-top:10px">Smartphone floating and slowly rotating in a dark studio, red rim light, reflections, the screen shows the provided app screenshot exactly, product shot, no text.</p></div>
''')

# ═════════════════════════ VIDÉO 1
V1A = [
 ['1','0:00 – 0:03','<b>Noir total.</b> Puis un néon rouge qui s\'allume en grésillant au fond de la salle.','Texte blanc qui s\'écrit lettre par lettre : <b>« 5 h 47. »</b>','Son : respiration lente, grésillement. Clignotement du néon (2 images).',''],
 ['2','0:03 – 0:06','<b>Très gros plan</b> : un œil s\'ouvre, éclairé par l\'écran d\'un téléphone.','VO : « Personne ne viendra te chercher. »','Lumière d\'écran qui passe du bleu au rouge.',''],
 ['3','0:06 – 0:09','<b>Plan serré, ralenti</b> : des mains serrent des lacets, puis la sangle d\'un sac.','VO : « Personne ne verra les séances que tu ne rates pas. »','Ralenti 50 %. Son des lacets amplifié.',''],
 ['4','0:09 – 0:13','<b>Plan large en plongée</b> (coin haut de la salle) : une silhouette entre en contre-jour, la porte laisse passer la lumière.','—','<b>IA</b> : plan « salle vide » (prompt 1) si la vraie salle n\'est pas disponible.',''],
 ['5','0:13 – 0:16','<b>Gros plan ralenti</b> : la magnésie tombe des mains, les disques s\'emboîtent sur la barre.','—','Ralenti 100 i/s. Coup de basse sur le disque.',''],
 ['6','0:16 – 0:20','<b>Plan sur l\'épaule</b> : le téléphone posé sur le banc affiche « 48,75 kg · charge pour la première série ».','VO : « Mais quelque chose sait exactement ce que tu peux soulever aujourd\'hui. »','Remplacer l\'écran par la vraie capture (suivi d\'écran CapCut).',''],
 ['7','0:20 – 0:24','<b>Contre-plongée sous la barre</b> : une répétition lourde, visage dans l\'effort.','—','<b>Rampe de vitesse</b> : rapide à la descente, ralenti à la remontée. La musique décolle ici.',''],
]
V1B = [
 ['8','0:24 – 0:27','<b>Insert écran</b> : la série est validée, le chiffre monte, l\'éclair du record frappe le chiffre.','Texte : <b>« NOUVEAU RECORD »</b>','Utiliser la vidéo exportée par l\'app (record). Flash blanc 2 images.',''],
 ['9','0:27 – 0:31','<b>Plan moyen</b> : il repose la barre, regarde l\'écran, hoche la tête.','VO : « Séance après séance. Série après série. »','Silence d\'une demi-seconde avant la VO.',''],
 ['10','0:31 – 0:36','<b>Montage rythmé</b> : 8 micro-plans de 0,5 s (squat, tirage, presse, écran de badges, chrono, poignée de main).','—','Coupe sur chaque temps fort de la musique. <b>Raccords sur le geste</b>.',''],
 ['11','0:36 – 0:41','<b>Plan serré</b> sur une athlète (accord écrit) qui regarde l\'écran du cycle activé.','VO : « Même les semaines où ton corps dit autre chose. »','Aucune promesse chiffrée : l\'app adapte, l\'athlète garde la main.',''],
 ['12','0:41 – 0:46','<b>Travelling arrière</b> : sortie de la salle au lever du jour. L\'écran affiche le Wrapped « Ton mois en chiffres ».','VO : « Tu ne t\'entraînes plus au hasard. »','Lumière chaude du matin : seul moment non rouge de la vidéo.',''],
 ['13','0:46 – 0:51','<b>Noir.</b> Un éclair rouge dessine le logo RepCore.','Texte : <b>« La bonne charge, à chaque série. »</b>','Silence total, puis impact. <b>IA</b> : téléphone en rotation (prompt 4).',''],
 ['14','0:51 – 0:55','<b>Mock-up</b> : le téléphone avec l\'écran de séance.','Texte : <b>« 1 mois offert · lien en bio »</b>','Musique qui retombe, dernier battement de cœur.',''],
]
page('Vidéo 1 · Motivation', f'''
<div class="box d" style="padding:30px 34px;margin-bottom:28px"><div class="kick" style="margin:0">Vidéo 1 · motivation</div><div style="font-family:'Bebas Neue';font-size:66px;line-height:1;margin-top:6px">« Personne ne viendra te chercher »</div></div>
<div class="pitch"><p><b>Le pitch.</b> 5 h 47, une salle vide, un néon qui s'allume. Personne ne regarde, personne ne félicite. Et pourtant, quelque chose sait exactement quelle charge mettre, et fait vibrer le moindre record. RepCore n'est pas une app de plus : c'est le partenaire de ceux qui viennent quand personne ne les voit.</p></div>
{meta([('Durée','55 s'),('Format','16:9 · 4K'),('Lieu','Salle + noir'),('Diffusion','Insta · YouTube')])}
<h2>Structure</h2>
<div class="grid" style="grid-template-columns:repeat(4,1fr);gap:12px">
 <div class="box"><span class="tag o">0-13 s</span><h3 style="margin-top:8px">La solitude</h3><p class="mut" style="font-size:16px">L'effort que personne ne voit</p></div>
 <div class="box"><span class="tag o">13-24 s</span><h3 style="margin-top:8px">La révélation</h3><p class="mut" style="font-size:16px">L'app sait ce que tu peux soulever</p></div>
 <div class="box r"><span class="tag">24-41 s</span><h3 style="margin-top:8px">La montée</h3><p class="mut" style="font-size:16px">Records, badges, régularité</p></div>
 <div class="box"><span class="tag o">41-55 s</span><h3 style="margin-top:8px">L'identité</h3><p class="mut" style="font-size:16px">Logo, promesse, appel à l'action</p></div></div>
<div class="grid" style="grid-template-columns:1fr 1fr 1fr;margin-top:24px;align-items:end">{mock('charge',250,'Plan 6 : la charge proposée')}{mock('apercu',250,'Plan 10 : la séance du jour')}{mock('evo',250,'Plan 12 : la progression')}</div>
<p class="mut" style="font-size:16px;margin-top:10px">Musique : hybride « bande-annonce » (basses, cordes, montée), libre de droits. Elle décolle au plan 7 et se tait juste avant le logo.</p>
''')
page('Vidéo 1 · Motivation', f'''<div class="kick">Vidéo 1 · plan par plan (1/2)</div><h1 style="font-size:64px;margin-bottom:20px">La solitude, puis la révélation</h1>{shots(V1A,150)}''')
page('Vidéo 1 · Motivation', f'''<div class="kick">Vidéo 1 · plan par plan (2/2)</div><h1 style="font-size:64px;margin-bottom:20px">La montée, puis l'identité</h1>{shots(V1B,150)}''')

# ═════════════════════════ VIDÉO 2
page('Vidéo 2 · Vente', f'''
<div class="box d" style="padding:30px 34px;margin-bottom:28px"><div class="kick" style="margin:0">Vidéo 2 · vente du coaching</div><div style="font-family:'Bebas Neue';font-size:66px;line-height:1;margin-top:6px">« Je ne vais pas te raconter. Je vais te montrer. »</div></div>
<div class="pitch"><p><b>Le pitch.</b> Le prospect t'a demandé « comment ça marche ». Il ne te connaît pas et n'a pas vu des dizaines d'avant/après. Alors on ne lui promet rien : on lui <b>montre</b> un coach diplômé d'État, passionné depuis 2020, qui a passé plus d'un an à construire son propre outil parce qu'aucune application ne pensait à l'élève. À la fin, il doit se dire : « ce mec est au-dessus, et il va vraiment s'occuper de moi ».</p></div>
{meta([('Durée','2 min 40'),('Format','16:9 · 4K'),('Lieu','Maison + salle'),('Diffusion','Message privé')])}
<h2>Le choix du décor : les deux, chacun son rôle</h2>
<div class="grid" style="grid-template-columns:1fr 1fr">
 <div class="box r"><h3>La maison = la parole (75 %)</h3><p style="font-size:17px;margin-top:6px">Ton bureau de coach dans le noir : ordinateur ouvert sur l'espace coach RepCore, carnet, livres, contre-jour rouge. C'est là que tu analyses, que tu prépares. Ça dit « expert sérieux », et le son y est propre.</p></div>
 <div class="box"><h3>La salle = la preuve (25 %)</h3><p style="font-size:17px;margin-top:6px">Uniquement des plans d'illustration sans parole : tu corriges un placement, tu filmes une série, tu regardes l'écran. Ça dit « sur le terrain, pas derrière un écran ».</p></div></div>
<h2>Les 7 temps du discours de vente</h2>
<div class="grid" style="grid-template-columns:repeat(7,1fr);gap:8px">
 {''.join(f'<div class="box" style="padding:12px;text-align:center"><div class="big r" style="font-size:44px">{i+1}</div><p style="font-size:14px;font-weight:700">{t}</p></div>' for i,t in enumerate(['L\'accroche','Son problème','Mon histoire','Le déclic','L\'outil','La méthode','L\'appel']))}</div>
<div class="grid" style="grid-template-columns:1fr 1fr;margin-top:22px;align-items:end">{mock('correction',200,'Insert : la correction vidéo')}{mock('mens',200,'Insert : les bilans mesurés')}</div>
''')
V2A = [
 ['1','0:00 – 0:08','<b>Maison, plan serré</b> face caméra, contre-jour rouge.','« Si tu regardes cette vidéo, c\'est que tu m\'as demandé comment je travaille. Alors je ne vais pas te raconter. Je vais te montrer. »','Sous-titre mot à mot. Léger zoom avant (5 %).',''],
 ['2','0:08 – 0:28','<b>Plan moyen</b> au bureau. Inserts : un PDF de programme générique, un téléphone sans réponse.','« Tu as peut-être déjà eu un programme en PDF, deux messages, et puis plus rien. Toi tout seul en salle, à te demander quoi mettre sur la barre. Ce n\'est pas un manque de motivation : c\'est un manque de suivi. »','Inserts en noir et blanc, désaturés : le « avant ».',''],
 ['3','0:28 – 0:50','<b>Plan serré</b>. Inserts : photos de 2020 (salle fermée, séances maison avec des proches).','« J\'ai commencé en 2020, pendant le Covid. Les salles fermaient, et j\'ai voulu aider ceux qui se retrouvaient sans repère. C\'est là que j\'ai vu une chose : chacun a des besoins différents. Le même programme ne marche pas pour deux personnes. »','Photos d\'archives avec léger mouvement (effet Ken Burns). ✎ Vérifier la formulation de ton histoire.',''],
 ['4','0:50 – 1:05','<b>Plan moyen</b>. Inserts : diplôme, livres, carnets annotés, séance de coaching en salle.','« Depuis, je suis devenu coach diplômé d\'État, j\'ai suivi des formations, lu des centaines de livres, et surtout coaché des gens réels, avec des vies réelles. »','✎ Intitulé exact du diplôme à confirmer.',''],
 ['5','1:05 – 1:25','<b>Champ / contre-champ</b> : toi qui fais défiler des apps concurrentes, puis ton visage qui dit non.','« J\'ai testé beaucoup d\'applications de coaching. Aucune ne m\'a convaincu. Elles étaient toutes pensées pour faire gagner du temps au coach. Aucune n\'était pensée pour l\'élève. »','Écrans concurrents floutés (pas de marque visible). Petit son de « refus ».',''],
]
V2B = [
 ['6','1:25 – 1:45','<b>Plan sur l\'épaule</b> : l\'ordinateur, le code, puis l\'app sur le téléphone. Inserts rapides d\'écrans RepCore.','« Alors on a construit la nôtre. Plus d\'un an de développement. Des tests, des retests, encore des retests. Une application pensée pour toi : le pratiquant, débutant ou confirmé. »','<b>Mock-ups</b> qui apparaissent l\'un après l\'autre (charge, bilans, nutrition). Clignotement rouge discret.',''],
 ['7','1:45 – 2:00','<b>Salle, plans sans parole</b> : l\'élève regarde l\'écran avant sa série, toi qui corriges un placement.','VO : « Avant chaque série, tu sais quelle charge mettre. Tu filmes un exercice, je te corrige. Tu fais un bilan, je le vois. »','Raccords sur le geste entre salle et écran.',''],
 ['8','2:00 – 2:20','<b>Maison, plan moyen</b>. Les 4 étapes apparaissent en titres à côté de toi.','« Ça marche en 4 temps. Un questionnaire et un appel pour te comprendre. Ton programme sur mesure, dans l\'app. Ton suivi séance par séance. Et un bilan régulier, où on ajuste tout. »','Titres animés 1-2-3-4 (apparition par la gauche).',''],
 ['9','2:20 – 2:30','<b>Plan serré</b>. Insert : courbes de bilans réels (accord écrit) ou ta propre progression mesurée.','« Je ne vais pas te montrer des avant/après retouchés. Je te montre ce que je mesure. Chaque kilo, chaque centimètre, chaque série. »','✎ Choisir la preuve : ta propre progression ou un client qui accepte.',''],
 ['10','2:30 – 2:40','<b>Plan serré</b>, regard caméra, puis noir et logo.','« Réponds à ce message avec ton objectif et le nombre de séances que tu peux faire par semaine. Je te réponds moi-même, et je te dis exactement ce que je ferais pour toi. »','Fin : logo + « Guellec Coaching Pro × RepCore ».',''],
]
page('Vidéo 2 · Vente', f'''<div class="kick">Vidéo 2 · plan par plan (1/2)</div><h1 style="font-size:64px;margin-bottom:20px">L'accroche, l'histoire, le déclic</h1>{shots(V2A,170)}''')
page('Vidéo 2 · Vente', f'''<div class="kick">Vidéo 2 · plan par plan (2/2)</div><h1 style="font-size:64px;margin-bottom:20px">L'outil, la méthode, l'appel</h1>{shots(V2B,170)}''')
page('Vidéo 2 · Vente', f'''
<div class="kick">Vidéo 2 · le texte d'une traite</div>
<h1 style="font-size:64px;margin-bottom:18px">À lire au prompteur</h1>
<p class="mut" style="font-size:17px;margin-bottom:18px">Lis-le à voix haute 3 fois avant de tourner. Garde le sens, pas forcément les mots : la sincérité vend plus que la perfection.</p>
<div class="box"><div class="vo">
Si tu regardes cette vidéo, c'est que tu m'as demandé comment je travaille. Alors je ne vais pas te raconter. Je vais te <b>montrer</b>.<br><br>
Tu as peut-être déjà eu un programme en PDF, deux messages, et puis plus rien. Toi tout seul en salle, à te demander quoi mettre sur la barre. Ce n'est pas un manque de motivation : c'est un <b>manque de suivi</b>.<br><br>
J'ai commencé en 2020, pendant le Covid. Les salles fermaient, et j'ai voulu aider ceux qui se retrouvaient sans repère. C'est là que j'ai vu une chose : chacun a des besoins différents.<br><br>
Depuis, je suis devenu coach diplômé d'État, j'ai suivi des formations, lu des centaines de livres, et surtout coaché des gens réels.<br><br>
J'ai testé beaucoup d'applications de coaching. Aucune ne m'a convaincu : elles étaient toutes pensées pour faire gagner du temps au coach. <b>Aucune n'était pensée pour l'élève.</b><br><br>
Alors on a construit la nôtre. Plus d'un an de développement, des tests, des retests. Une application pensée pour toi.<br><br>
Avant chaque série, tu sais quelle charge mettre. Tu filmes un exercice, je te corrige. Tu fais un bilan, je le vois.<br><br>
Ça marche en 4 temps : un questionnaire et un appel, ton programme sur mesure, ton suivi séance par séance, et un bilan régulier où on ajuste tout.<br><br>
Je ne vais pas te montrer des avant/après retouchés. Je te montre ce que je mesure.<br><br>
Réponds à ce message avec ton objectif et ton nombre de séances par semaine. <b>Je te réponds moi-même.</b>
</div></div>
<h2>✎ Mes mots à moi</h2>
{lines(5)}
''')

# ═════════════════════════ VIDÉOS 3 & 4 : TRONC COMMUN
page('Vidéos 3 et 4 · Tutos', f'''
<div class="box d" style="padding:30px 34px;margin-bottom:28px"><div class="kick" style="margin:0">Vidéos 3 et 4 · tutos d'accueil</div><div style="font-family:'Bebas Neue';font-size:66px;line-height:1;margin-top:6px">« Bienvenue dans ton coaching 2.0 »</div></div>
<div class="pitch"><p><b>Le pitch.</b> Ton élève vient de faire son premier bilan. Il est motivé, et un peu perdu. En 4 minutes, tu lui montres tout : où trouver sa séance, comment la noter, comment manger (strict ou flexible), comment se passent les bilans et comment on avance ensemble. Il doit finir en se disant : « je sais exactement quoi faire demain, et je ne suis plus seul ».</p></div>
{meta([('Durée','≈ 4 min'),('Format','16:9'),('Lieu','Bureau maison'),('Envoi','Après le 1er bilan')])}
<h2>Le principe : tourner une fois, monter deux fois</h2>
<div class="grid" style="grid-template-columns:1fr 1fr 1fr">
 <div class="box"><span class="tag o">Commun</span><h3 style="margin-top:8px">Intro, séance, bilans, progression, fonctionnement</h3><p class="mut" style="font-size:16px">≈ 3 min · tourné une seule fois</p></div>
 <div class="box r"><span class="tag">Vidéo 3</span><h3 style="margin-top:8px">Module diète stricte</h3><p class="mut" style="font-size:16px">≈ 50 s · page suivante</p></div>
 <div class="box r"><span class="tag">Vidéo 4</span><h3 style="margin-top:8px">Module diète flexible</h3><p class="mut" style="font-size:16px">≈ 50 s · page suivante</p></div></div>
<h2>La mise en scène</h2>
<p style="font-size:19px">Toi au bureau en plan moyen (lumière « maison »), et l'écran du téléphone en grand. Toi en petite incrustation ronde dans un coin quand l'écran parle. Un titre de chapitre rouge à chaque partie : l'élève peut revenir directement au bon moment.</p>
<div class="grid" style="grid-template-columns:1fr 1fr 1fr;margin-top:18px;align-items:end">{mock('apercu',230,'Ch. 2 : la séance')}{mock('tirage',230,'Ch. 2 : l’exercice filmé')}{mock('evo',230,'Ch. 5 : la progression')}</div>
''')
TC_A = [
 ['1','0:00 – 0:15','<b>Plan moyen</b> au bureau, sourire.','« Bravo, ton premier bilan est fait. Maintenant je te montre comment on va travailler ensemble, en 4 minutes. Garde cette vidéo : tu pourras y revenir. »','Titre : <b>« BIENVENUE DANS TON COACHING »</b>.',''],
 ['2','0:15 – 0:35','<b>Enregistrement d\'écran</b> : l\'accueil, la séance du jour, les messages. Incrustation ronde.','« Ici, ton accueil. Ta séance du jour est là. Tes messages avec moi, là. Tout part de cet écran. »','Chapitre 1 · <b>TON ACCUEIL</b>. Cercle rouge autour de chaque bouton cité.',''],
 ['3','0:35 – 1:20','<b>Écran</b> : aperçu de séance, charge proposée, saisie des répétitions et du RIR, vidéo d\'exécution, fin de séance.','« Avant chaque série, l\'app te propose une charge. Tu fais ta série, tu notes tes répétitions et ton RIR : combien tu en avais encore en réserve. Un doute sur un exercice ? La vidéo est là. Et quand tu bats un record, tu le sauras. »','Chapitre 2 · <b>TA SÉANCE</b>. Zoom sur le chiffre de charge. Petit éclair de record (de l\'app).',''],
 ['4','1:20 – 1:30','<b>Plan serré</b> sur toi.','« La règle d\'or : note tout, même une mauvaise séance. Une séance mal notée, c\'est une séance que je ne peux pas corriger. »','Titre : <b>« NOTE TOUT »</b>.',''],
 ['5','—','<b>Ici s\'insère le module nutrition</b> (stricte ou flexible).','Voir la page suivante.','Chapitre 3 · <b>TA NUTRITION</b>.',''],
]
TC_B = [
 ['6','2:20 – 3:00','<b>Écran</b> : l\'écran de bilan (poids, mensurations, photos, ressenti), puis ta réponse dans les messages.','« Tous les [X] jours, tu fais ton bilan : poids le matin à jeun, mensurations, photos dans la même lumière et ton ressenti. Je le reçois, je l\'analyse, et je te réponds avec les ajustements. »','Chapitre 4 · <b>TES BILANS</b>. ✎ Fréquence exacte et délai de réponse à confirmer.',''],
 ['7','3:00 – 3:25','<b>Écran</b> : courbes de poids, mensurations, historique de séances.','« Ici, tu vois tout ton chemin : tes courbes, tes records, ton historique. Les jours difficiles, regarde cette page. »','Chapitre 5 · <b>TA PROGRESSION</b>. Courbe qui se dessine.',''],
 ['8','3:25 – 3:50','<b>Plan moyen</b> au bureau, schéma en titres à côté de toi.','« On avance par blocs. Pendant un bloc, la charge monte. Au bilan, j\'ajuste. Quand ton corps a besoin de souffler, on programme une semaine plus légère. Et entre deux bilans, tu m\'écris quand tu veux. »','Chapitre 6 · <b>COMMENT ON AVANCE</b>. Schéma : bloc → bilan → ajustement.',''],
 ['9','3:50 – 4:05','<b>Plan serré</b>, regard caméra.','« 3 règles : tu notes tout, tu fais tes bilans à l\'heure, et tu me parles. Le reste, c\'est mon travail. Envoie-moi “c\'est parti” dans les messages. »','Titre final : les 3 règles + logo.',''],
]
page('Vidéos 3 et 4 · Tutos', f'''<div class="kick">Tronc commun · plan par plan (1/2)</div><h1 style="font-size:64px;margin-bottom:20px">L'accueil et la séance</h1>{shots(TC_A,170)}''')
page('Vidéos 3 et 4 · Tutos', f'''<div class="kick">Tronc commun · plan par plan (2/2)</div><h1 style="font-size:64px;margin-bottom:20px">Bilans, progression, méthode</h1>{shots(TC_B,180)}''')

STRICT = [
 ['S1','1:30 – 1:45','<b>Écran</b> : ton plan alimentaire, repas par repas.','« Ta diète est stricte : c\'est moi qui compose ton plan, repas par repas, avec les quantités. Tu n\'as rien à calculer. »','Titre : <b>« DIÈTE STRICTE »</b>. Mise en avant des quantités.',''],
 ['S2','1:45 – 2:00','<b>Écran</b> : la case « diète respectée » du jour.','« Chaque jour, tu indiques si tu as respecté ton plan. Un écart ? Tu le notes, sans culpabiliser. Je préfère un écart noté qu\'un écart caché. »','Cercle rouge sur la case.',''],
 ['S3','2:00 – 2:10','<b>Plan serré</b> sur toi.','« Un aliment ne te convient pas, ou tu ne le trouves pas ? Écris-moi, on le remplace. »','—',''],
 ['S4','2:10 – 2:20','<b>Plan serré</b>.','« Et à chaque bilan, j\'ajuste les quantités selon tes résultats. Toi, tu suis. Moi, je pilote. »','Transition vers le chapitre 4.',''],
]
FLEX = [
 ['F1','1:30 – 1:45','<b>Écran</b> : tes objectifs du jour (anneaux calories, protéines, glucides, lipides).','« Ta diète est flexible : tu as des objectifs, et tu choisis ce que tu manges pour les atteindre. »','Titre : <b>« DIÈTE FLEXIBLE »</b>. Les anneaux se remplissent.',''],
 ['F2','1:45 – 2:00','<b>Écran</b> : recherche d\'aliment, scan de code-barres, photo d\'étiquette.','« Pour noter, tu cherches l\'aliment, tu scannes le code-barres ou tu prends l\'étiquette en photo. Ça marche même sans réseau. »','Raccord sur le geste : main qui scanne → écran.',''],
 ['F3','2:00 – 2:10','<b>Plan serré</b> sur toi.','« Pas besoin d\'être parfait. Vise d\'abord tes protéines et tes calories. Le reste suivra. »','Titre : <b>« PROTÉINES + CALORIES »</b>.',''],
 ['F4','2:10 – 2:20','<b>Écran</b> : le calendrier du journal (jours saisis et jours manquants).','« À chaque bilan, je regarde ton journal. Je vois les jours remplis et les jours oubliés : remplis-le, même les jours moins propres. »','Transition vers le chapitre 4.',''],
]
page('Vidéos 3 et 4 · Tutos', f'''
<div class="kick">Les modules nutrition</div>
<h1 style="font-size:64px;margin-bottom:16px">Stricte <em>ou</em> flexible</h1>
<h2 style="margin-top:0">Vidéo 3 · <em>diète stricte</em></h2>
{shots(STRICT,120)}
<h2 style="margin-top:34px">Vidéo 4 · <em>diète flexible</em></h2>
{shots(FLEX,120)}
''')

# ═════════════════════════ PLANNING
page('Le tournage', f'''
<div class="kick">Le plan de tournage</div>
<h1>2 jours, <em>4 vidéos</em></h1>
<div class="grid" style="grid-template-columns:1fr 1fr;margin-top:24px">
 <div class="box r"><span class="tag">Jour 1 · maison</span><h3 style="margin-top:10px">Bureau du coach</h3><div class="tx" style="font-size:17px;margin-top:8px">
 {task('Matin : installer la lumière (schéma « maison »), tester le son','')}{task('Vidéo 2 : toutes les parties face caméra (plans 1 à 6, 8 à 10)','')}{task('Vidéos 3 et 4 : tronc commun face caméra + les 2 modules nutrition','')}{task('Après-midi : enregistrements d’écran sur un compte de démo propre','')}{task('Inserts : bureau, livres, diplôme, carnet, ordinateur','')}</div></div>
 <div class="box"><span class="tag o">Jour 2 · salle</span><h3 style="margin-top:10px">Heure creuse, accord écrit</h3><div class="tx" style="font-size:17px;margin-top:8px">
 {task('Lumière « clair-obscur », néons à moitié éteints si possible','')}{task('Vidéo 1 : tous les plans (1 à 14)','')}{task('Vidéo 2 : plans d’illustration (5, 7) sans parole','')}{task('Ralentis : magnésie, disques, lacets (50-100 i/s)','')}{task('Athlète filmée pour le plan 11 : accord écrit signé avant','')}</div></div></div>
<h2>Avant de dire « action »</h2>
{task('Mode avion, notifications coupées, batterie et stockage pleins','')}
{task('Exposition et mise au point verrouillées (appui long sur l’écran)','')}
{task('Objectif nettoyé, horizon droit, caméra stable','')}
{task('3 secondes de silence avant et après chaque prise (pour le montage)','')}
{task('Consentements signés (modèle : CONSENTEMENT-TEMOIGNAGE.md) et autorisation de la salle','')}
{task('Musique libre de droits choisie pour chaque vidéo','')}
<h2>✎ Ce qui manque / à acheter</h2>
{lines(4)}
''')

page('Le tournage', f'''
<div class="kick">Le montage</div>
<h1>La banque d'effets, <em>utilisés avec parcimonie</em></h1>
{table(['Effet','Où','Réglage','✎ Testé'],[
 ['<b>Apparition lettre par lettre</b>','V1 plan 1, titres de chapitre','Blanc, Bebas Neue, 2 images par lettre',cb('s')],
 ['<b>Clignotement néon</b>','V1 plan 1','Opacité 100 → 20 → 100 %, 2 fois, irrégulier',cb('s')],
 ['<b>Flash blanc</b>','Record (V1 plan 8)','2 images, jamais deux flashs à la suite',cb('s')],
 ['<b>Éclair rouge</b>','Record, logo','Exporté de l’app (vidéo de record ou de rang)',cb('s')],
 ['<b>Rampe de vitesse</b>','V1 plan 7, montage rythmé','200 % → 30 % sur l’instant clé',cb('s')],
 ['<b>Glitch court</b>','V2 passage « avant / après »','2 à 3 images, décalage rouge',cb('s')],
 ['<b>Mock-up qui apparaît</b>','V2 plan 6, tutos','Glissement par la gauche + ombre rouge',cb('s')],
 ['<b>Cercle rouge sur un bouton</b>','Tutos','Trait 6 px, apparition en 6 images',cb('s')],
 ['<b>Incrustation ronde</b>','Tutos','Coin bas droit, bord rouge 4 px',cb('s')],
 ['<b>Sous-titres</b>','Toutes','Montserrat Bold blanc, mot-clé en rouge, 2 lignes max',cb('s')],
 ['<b>Noir et blanc désaturé</b>','V2 plan 2 (le « avant »)','Saturation 0, contraste +20',cb('s')],
 ['<b>Effet Ken Burns</b>','V2 photos de 2020','Zoom lent 5 % sur 4 s',cb('s')]],['1.6fr','1.6fr','2.4fr','.7fr'],58)}
<h2>L'étalonnage RepCore</h2>
<p style="font-size:19px">Contraste +15 · noirs écrasés · saturation globale −10 · <b>rouges protégés</b> (seule couleur vive) · tons chair légèrement réchauffés · grain léger. Même réglage sur les 4 vidéos : on doit reconnaître RepCore en une image.</p>
<h2>✎ Notes de montage</h2>
{lines(4)}
''')

# ═════════════════════════ ASSEMBLAGE
out = ['<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>RepCore — Guide de tournage</title>']
out.append('<style>' + FONTS_PRINT + CSS + '</style></head><body>')
for i, (sec, body, cls) in enumerate(pages):
    n = i + 1
    hd = '' if cls == 'cover' else f'<div class="hd"><div class="l"><img src="{IMG}logo.png">REPCORE · LE PLATEAU</div><div class="s">{sec}</div></div>'
    ft = '' if cls == 'cover' else f'<div class="ft"><span>Guide de tournage 2026</span><b>{n}</b></div>'
    out.append(f'<section class="p">{hd}{body}{ft}</section>')
out.append('</body></html>')
open('tournage.html', 'w').write('\n'.join(out))
print(len(pages), 'pages')
