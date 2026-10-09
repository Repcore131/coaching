# RepCore — La machine : décisions, app, offres, visibilité, autonomie (A4 portrait)
import html, re
src = open('gen.py').read()
exec(src[:src.index('# ───────────── 1 COUVERTURE')])
exec(open('machine_app.py').read())
exec(open('machine_mkt.py').read())
exec(open('machine_msgs.py').read())
IMG = 'img/'

def esc(s): return html.escape(s, quote=False)

CSS += """
.fx-idee{border-left:8px solid var(--r);background:var(--t);border-radius:0 14px 14px 0;padding:16px 22px}
.fx-idee p,.fx-pq p{font-size:18px;line-height:1.5}
.fx-pq{border-left:8px solid var(--n);background:#F2F2F4;border-radius:0 14px 14px 0;padding:14px 22px;margin-top:12px}
.lab{font-family:'Bebas Neue';font-size:22px;letter-spacing:.05em;color:var(--r);display:block;margin-bottom:2px}
.fx-pq .lab{color:var(--n)}
.prompt{background:#0B0B0C;color:#E9E9EE;border-radius:14px;padding:16px 22px;margin-top:14px}
.prompt .k{font-family:'Bebas Neue';font-size:25px;color:#fff;letter-spacing:.04em;display:flex;justify-content:space-between;align-items:baseline}
.prompt .k span{font-family:Montserrat;font-size:12px;color:#A0A0A8;letter-spacing:.12em;font-weight:700}
.prompt pre{white-space:pre-wrap;font-family:'DejaVu Sans Mono',monospace;font-size:13.4px;line-height:1.5;margin:8px 0 0;color:#E9E9EE}
.qui{display:inline-block;border-radius:30px;padding:4px 12px;font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin-right:8px}
.qui.claude{background:var(--n);color:#fff}.qui.duo{background:var(--r);color:#fff}.qui.toi{border:2px solid var(--n)}
.meta2{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 14px}
.meta2 span{border:1.5px solid var(--l);border-radius:8px;padding:4px 10px;font-size:14px;font-weight:700}
.msg{background:#F2F2F4;border-radius:14px;padding:14px 18px;margin-top:10px;position:relative}
.msg .h{font-family:'Bebas Neue';font-size:22px;color:var(--n)}
.msg .h small{font-family:Montserrat;font-size:13px;color:var(--r);font-weight:800;letter-spacing:.06em;margin-left:8px;text-transform:uppercase}
.msg pre{white-space:pre-wrap;font-family:Montserrat;font-size:15.5px;line-height:1.5;margin:6px 0 0}
.dec{display:grid;grid-template-columns:44px 1fr;gap:12px;align-items:start;padding:11px 0;border-bottom:1.5px solid var(--l)}
.dec .n{font-family:'Bebas Neue';font-size:34px;color:var(--r);line-height:1}
.dec h3{font-size:19px}.dec p{font-size:15.5px;color:#3A3A40;margin-top:2px}
.part-h{font-family:'Bebas Neue';font-size:20px;letter-spacing:.2em;color:var(--r)}
.mot{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:8px 0 6px}
.mot div{border:1.5px solid var(--l);border-radius:10px;padding:8px 12px;font-size:14px}
.mot b{display:block;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--g)}
"""

QUI = {'claude':'Claude le fait seul','duo':'Claude + toi','toi':'Toi'}

def fiche_app(d):
    return f'''
<div class="kick">Fiche {d["id"]} · l’app avant d’ouvrir les vannes</div>
<h1 style="font-size:60px">{d["titre"]}</h1>
<div class="meta2"><span class="qui {d["qui"]}">{QUI[d["qui"]]}</span><span>Effort : {d["effort"]}</span><span>Gain : {d["gain"]}</span></div>
<div class="fx-idee"><span class="lab">L’idée</span><p>{d["idee"]}</p></div>
<div class="fx-pq"><span class="lab">Pourquoi</span><p>{d["pourquoi"]}</p></div>
<div class="prompt"><div class="k">Le prompt · {d["id"]} <span>APRÈS LE BLOC CONTEXTE</span></div><pre>{esc(d["prompt"])}</pre></div>'''

def fiche_moteur(d):
    return f'''
<div class="kick">Moteur {d["id"]} · Claude, ton équipe marketing</div>
<h1 style="font-size:60px">{d["titre"]}</h1>
<div class="mot"><div><b>Rythme</b>{d["rythme"]}</div><div><b>Ce que tu fais</b>{d["toi"]}</div><div><b>Ce que tu reçois</b>{d["sortie"]}</div></div>
<div class="fx-idee"><span class="lab">L’idée</span><p>{d["idee"]}</p></div>
<div class="fx-pq"><span class="lab">Pourquoi</span><p>{d["pourquoi"]}</p></div>
<div class="prompt"><div class="k">Le prompt · {d["id"]} <span>À ME DONNER UNE FOIS</span></div><pre>{esc(d["prompt"])}</pre></div>'''

def msgs(lst):
    return ''.join(f'<div class="msg"><div class="h">{t}<small>{w}</small></div><pre>{esc(x)}</pre></div>' for t, w, x in lst)

def bars(rows):
    mx = max(int(r[3].replace(' ', '').replace('€', '').replace(' ','')) for r in rows)
    out = '<svg viewBox="0 0 1040 %d" width="100%%">' % (len(rows)*46+10)
    for i, r in enumerate(rows):
        v = int(r[3].replace(' ', '').replace('€', '').replace(' ',''))
        w = 520 * v / mx; y = 8 + i*46
        out += f'<text x="0" y="{y+24}" font-family="Montserrat" font-size="16" font-weight="700" fill="#141416">{esc(r[0])}</text>'
        out += f'<rect x="330" y="{y+6}" width="{w:.0f}" height="26" rx="6" fill="{"#E02020" if i==0 else "#141416"}"/>'
        out += f'<text x="{340+w:.0f}" y="{y+25}" font-family="Bebas Neue" font-size="24" fill="#141416">{esc(r[3])}</text>'
    return out + '</svg>'

def flux_coach():
    B = lambda x, y, w, h, t, s, red=False: (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="{"#E02020" if red else "#141416"}"/>'
        f'<text x="{x+w/2}" y="{y+h/2-4}" text-anchor="middle" font-family="Bebas Neue" font-size="30" fill="#fff">{t}</text>'
        f'<text x="{x+w/2}" y="{y+h/2+20}" text-anchor="middle" font-family="Montserrat" font-size="14" font-weight="600" fill="#ddd">{s}</text>')
    A = lambda x1, y1, x2, y2, t, tx, ty: (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#E02020" stroke-width="4" marker-end="url(#ar)"/>'
        f'<text x="{tx}" y="{ty}" text-anchor="middle" font-family="Montserrat" font-size="15" font-weight="800" fill="#141416">{t}</text>')
    s = ('<svg viewBox="0 0 1040 380" width="100%"><defs><marker id="ar" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#E02020"/></marker></defs>'
         '<rect width="1040" height="380" rx="16" fill="#F2F2F4"/>')
    s += B(40, 40, 260, 90, 'LE COACH', 'utilise RepCore avec ses élèves')
    s += B(740, 40, 260, 90, 'REPCORE', 'toi, Kevin', True)
    s += B(40, 250, 260, 90, ' SES ÉLÈVES', 'gratuits pendant le coaching')
    s += B(740, 250, 260, 90, 'ABONNÉS', '9,50 € ou 24,90 € / mois')
    s += A(300, 70, 735, 70, '① licence 19 € ou 39 € par mois', 520, 58)
    s += A(170, 130, 170, 245, '② code d’accès', 230, 195)
    s += A(300, 295, 735, 295, '③ fin du coaching : ils gardent l’app', 520, 283)
    s += A(870, 245, 870, 135, '④ abonnements', 945, 195)
    s += A(735, 110, 305, 110, '⑤ 30 % pendant 12 mois', 520, 140)
    return s + '</svg>'

# ═══════ PAGES
page('', f'''
<img src="{IMG}bg-cover.jpg" style="position:absolute;left:0;top:0;width:1240px;height:1754px">
<div style="position:absolute;left:100px;top:90px;display:flex;align-items:center;gap:18px">
 <img src="{IMG}logo.png" style="width:86px;height:86px;border-radius:16px">
 <div style="font-family:'Bebas Neue';font-size:40px;letter-spacing:.08em;color:#fff">REPCORE · LA MACHINE</div></div>
<div style="position:absolute;left:100px;right:100px;top:760px">
 <div class="kick" style="font-size:20px">Le guide de vente · édition du 9 octobre 2026</div>
 <h1 style="font-size:150px;line-height:.88;color:#fff">Le produit est prêt.<br><em>Maintenant, on vend.</em></h1>
 <p style="font-size:28px;color:#fff;font-weight:700;margin-top:30px">12 décisions · 18 changements dans l’app · 10 moteurs qui tournent sans toi · tous les messages prêts</p>
 <p style="font-size:22px;color:#C8C8CE;margin-top:10px">Chaque fiche : l’idée, pourquoi, et le prompt pour la mettre en place de A à Z.</p>
</div>
<div style="position:absolute;left:100px;bottom:60px;color:#A0A0A8;font-weight:700;font-size:16px;letter-spacing:.24em">KEVIN GUELLEC · GUELLEC COACHING PRO</div>
''', 'cover')

page('Mode d’emploi', f'''
<div class="kick">Avant de commencer</div>
<h1>Toi, moi, <em>et la machine</em></h1>
<p class="lead" style="font-size:20px">Ce guide n’est pas un plan à suivre semaine par semaine. C’est une boîte à outils : chaque fiche se lit en une minute et se lance avec un prompt. On fonce, dans l’ordre des priorités, et tu notes ce que tu as fait dans le compte rendu de fin de guide.</p>
<div class="grid" style="grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px">
 <div class="box"><span class="qui claude">Claude le fait seul</span><p class="mut" style="font-size:15px;margin-top:8px">Tu colles le prompt, je code, je teste, je te montre le résultat. Tu valides d’un mot.</p></div>
 <div class="box r"><span class="qui duo">Claude + toi</span><p class="mut" style="font-size:15px;margin-top:8px">Il faut un clic de ta part (PayPal, Play Console, une clé API). Je te guide écran par écran, tu réponds « fait ».</p></div>
 <div class="box"><span class="qui toi">Toi</span><p class="mut" style="font-size:15px;margin-top:8px">Ce qui demande ta tête, ta caméra ou ta signature : tourner, appeler, décider, envoyer un DM.</p></div>
</div>
<h2>Le format de chaque fiche</h2>
<div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:12px">
 <div class="fx-idee" style="margin:0"><span class="lab">L’idée</span><p style="font-size:15px">3 à 5 lignes : ce qu’on change.</p></div>
 <div class="fx-pq" style="margin:0"><span class="lab">Pourquoi</span><p style="font-size:15px">Ce que ça rapporte ou ce que ça évite.</p></div>
 <div class="prompt" style="margin:0"><div class="k">Le prompt</div><p style="font-size:14px;color:#ddd;margin-top:4px">À coller dans Claude Code, après le bloc contexte.</p></div>
</div>
<div class="prompt"><div class="k">Bloc contexte · à coller avant chaque prompt de code <span>COMMUN À TOUTES LES FICHES</span></div><pre>{esc(CTX)}</pre></div>
<p class="mut" style="font-size:15px;margin-top:10px">Tous les prompts et tous les messages sont aussi dans <b>docs/machine/PROMPTS.md</b> : plus simple à copier que le PDF.</p>
''')

TOC = [('1 · Les décisions','Les 12 décisions · D’où viennent les 50 000 € · Les prix à aligner'),
       ('2 · L’app avant d’ouvrir','Le sprint du gel · 18 fiches A1 à A18'),
       ('3 · Les offres','Coaching avec et sans suivi · La boutique : 10 programmes et 3 défis'),
       ('4 · Faire voir','Instagram en vrai · Collabs · Influence (messages femmes, hommes, MyProtein) · Coachs · LinkedIn · Systeme.io · Corona Gym · L’engouement'),
       ('5 · Claude, ton équipe marketing','10 moteurs autonomes · Les branchements · 3 prompts maîtres'),
       ('6 · Garder et protéger','La résiliation · Les risques et leurs parades · 50 leviers · Compte rendu de semaine')]
page('Sommaire', '<div class="kick">Sommaire</div><h1>Six parties, <em>une seule question</em></h1><p class="lead" style="font-size:20px">Est-ce que ça fait vendre, ou est-ce que ça garde un abonné ? Si la réponse est non, ça attend.</p>' +
     ''.join(f'<div class="dec"><div class="n">{i+1}</div><div><h3>{t.split(" · ",1)[1]}</h3><p>{s}</p></div></div>' for i, (t, s) in enumerate(TOC)))

# ── PARTIE 1
page('1 · Les décisions', '<div class="part-h">PARTIE 1</div><h1>Les 12 décisions <em>qui font tout</em></h1><p class="lead" style="font-size:19px">Coche quand la décision est prise, pas quand elle est commencée.</p>' +
     ''.join(f'<div class="dec"><div class="n">{i+1:02d}</div><div><h3>{cb("s")} {t}</h3><p>{x}</p></div></div>' for i, (t, x) in enumerate(DECISIONS)))

tot = sum(int(r[3].replace(' ', '').replace('€','')) for r in MODELE)
page('1 · Les décisions', f'''
<div class="kick">Le modèle</div><h1>D’où viennent <em>les 50 000 €</em></h1>
<p class="lead" style="font-size:19px">Huit sources, mois 12, scénario ambitieux. Les deux prix athlètes et les deux familles de coaching sont comptés à part. Plus de coaching de groupe, plus d’entreprises.</p>
{bars(MODELE)}
{table(['Source','Volume au mois 12','Prix moyen','CA / mois'], [[f'<b>{a}</b>',b,c,f'<b>{d}</b>'] for a,b,c,d in MODELE] + [['<b>Total</b>','','',f'<b>{tot:,} €</b>'.replace(',', ' ')]], ['1.6fr','2.6fr','.8fr','.9fr'], 44)}
<p class="mut" style="font-size:15px;margin-top:10px">Hypothèses, pas des mesures. Scénario prudent au même mois : 15 000 à 20 000 €. Les athlètes d’un coach sont gratuits pendant son coaching : ils comptent dans les abonnés quand ils restent (voir le schéma des coachs, partie 4).</p>
''')

INCOH = [['Essentielle lue par Google','9,95 € (JSON-LD) au lieu de 9,50 €'],['Engagement','12 mois partout, mais « sans engagement » sur /i'],['Essai d’un invité','1 mois (landing) contre 2 mois (CGV, /i, code)'],['Récompense du parrain','« au premier paiement » (landing) contre 4 séances (code)'],['Annuel','sans remise ; « 24,90 € en annuel ou 24,90 € au mois » en fin d’essai'],['Période par défaut','annuel dans l’app, mensuel sur la landing'],['Ultime à -50 %','« après un coach » (CGV) contre code ambassadeur (code)'],['Commission ambassadeur','20-25 % (code) contre 30 % (plan)'],['Vitrine d’un coach','affiche les prix de Kevin, pas les siens'],['Hébergeur','« GitHub Pages » dans les mentions légales, Firebase en réalité'],['CGV','muettes sur les programmes et le coaching']]
page('1 · Les décisions', f'''
<div class="kick">Les prix</div><h1>11 contradictions <em>à effacer</em></h1>
<p class="lead" style="font-size:19px">Relevées dans le code et les pages le 9 octobre 2026. La fiche A1 les corrige toutes ; les 3 lignes en gras attendent ta décision.</p>
{table(['#','Sujet','Ce qu’on trouve aujourd’hui','✎ Décision'], [[str(i+1), f'<b>{a}</b>' if i in (2,3,7) else a, b, ''] for i,(a,b) in enumerate(INCOH)], ['.3fr','1.3fr','2.6fr','1.1fr'], 50)}
<h2>Les prix validés</h2>
{table(['Offre','Prix','✎ OK'], [['Essentielle','9,50 € / mois · 95 € / an (proposé)',cb('s')],['Ultime','24,90 € / mois · 249 € / an (proposé)',cb('s')],['Fondateur (lancement)','149 € la 1re année · 300 places',cb('s')],['Programme boutique','9,90 € à 24,90 € selon le programme',cb('s')],['Coaching avec suivi','150 € (1 mois) · 350 € (3 mois) · 600 € (6 mois)',cb('s')],['Coaching sans suivi','99 € (programme) · 40 € (révision)',cb('s')],['Coachs externes','0 € · 19 € · 39 € par mois',cb('s')]], ['1.3fr','2.8fr','.4fr'], 44)}
''')

# ── PARTIE 2
page('2 · L’app', '<div class="part-h">PARTIE 2</div><h1>Le sprint du gel : <em>ce week-end et la semaine prochaine</em></h1><p class="lead" style="font-size:19px">Pendant le gel, on ne code que ce qui fait vendre ou garder un abonné. Classé par argent rapporté par heure de travail. Ensuite, plus rien jusqu’au lancement, sauf les corrections.</p>' +
     table(['Fiche','Chantier','Temps (Claude)','Gain','Qui','Fait'], [[f'<b>{i}</b>', t, h, g, QUI[[a for a in APP if a['id']==i][0]['qui']], cb('s')] for i,t,h,g in GEL], ['.5fr','2.4fr','1.1fr','.8fr','1fr','.4fr'], 44) +
     '<p class="mut" style="font-size:15px;margin-top:10px">Ordre conseillé : de haut en bas. Les 6 premières lignes se font en un samedi.</p>')
for d in APP:
    page(f'2 · {d["id"]}', fiche_app(d))

# ── PARTIE 3
page('3 · Les offres', f'''
<div class="part-h">PARTIE 3</div><h1>Le coaching : <em>deux familles, pas trois</em></h1>
<p class="lead" style="font-size:19px">Pas de coaching de groupe. Deux promesses claires, vendues dans l’app (fiche A13), avec la source de chaque vente.</p>
<div class="grid" style="grid-template-columns:1fr 1fr;gap:16px;margin-top:10px">
 <div class="box r"><span class="tag">Avec suivi</span><h3 style="margin-top:10px">« Je te suis »</h3><p style="font-size:16px;margin-top:6px">Programme sur mesure, ajusté bloc après bloc, bilans dans l’app, réponses de Kevin.</p>
 {table(['Formule','Prix','Durée'],[['Coaching Essentiel','150 €','1 mois'],['Transformation','350 €','3 mois'],['Évolution','600 €','6 mois']],['1.6fr','.8fr','.8fr'],40)}
 <p class="mut" style="font-size:14px;margin-top:8px">Argument : la formule 3 mois revient à 117 € par mois, celle de 6 mois à 100 €.</p></div>
 <div class="box"><span class="tag o">Sans suivi</span><h3 style="margin-top:10px">« Je te crée ton programme »</h3><p style="font-size:16px;margin-top:6px">Un programme construit pour toi, puis tu avances seul(e) avec l’app.</p>
 {table(['Formule','Prix','Inclus'],[['Programme personnalisé','99 €','3 mois d’app'],['Révision de programme','40 €','1 mois d’app']],['1.6fr','.6fr','1fr'],40)}
 <p class="mut" style="font-size:14px;margin-top:8px">Argument : le prix de 4 mois d’Ultime, avec un programme fait par un coach.</p></div>
</div>
<h2>Où et quand on le propose</h2>
{table(['Moment','Message'],[['Fin d’essai','« Tu préfères qu’on le construise ensemble ? » (lien vers les deux familles)'],['Après 3 mois et 20 séances','« Prêt(e) pour la suite ? » : carte « passer au coaching »'],['Plateau détecté','« Tu stagnes depuis 3 semaines : je regarde ton programme ? » → révision à 40 €'],['Bio Instagram et e-mail 5 de bienvenue','Lien direct avec ?src='],['Après un défi gagné','« Tu veux aller plus loin ? »']],['1.2fr','3fr'],44)}
''')

def cat_rows(a, b):
    return table(['Programme','Promesse','Contenu','Durée','Prix','Comment le vendre'], [[f'<b>{c[0]}</b><br><span class="mut" style="font-size:13px">{c[5]}</span>', c[1], c[2], c[3], f'<b>{c[4]}</b>', c[6]] for c in CATALOGUE[a:b]], ['1.15fr','1.3fr','1.7fr','.45fr','.5fr','1.4fr'], 50)
page('3 · Boutique', '<div class="kick">La boutique</div><h1>10 programmes <em>qui se vendent seuls</em></h1><p class="lead" style="font-size:18px">Règle de nommage : un résultat + une durée + pour qui. Chaque programme = accès à vie + 30 jours d’app (fiche A3). La semaine 1 se voit gratuitement.</p>' + cat_rows(0, 5))
page('3 · Boutique', '<div class="kick">La boutique (suite)</div><h1>Les 5 suivants <em>et les défis payants</em></h1>' + cat_rows(5, 10) +
     '<h2>Les défis</h2>' + table(['Défi','Prix','Mécanique'], [[f'<b>{a}</b>', b, c] for a,b,c in DEFIS], ['1.3fr','.5fr','3.2fr'], 46) +
     '<p class="mut" style="font-size:15px;margin-top:8px">Ordre de création : Fessiers 8 semaines, Muscu & cycle, Débuter en salle, puis un nouveau programme par mois. Chaque lancement de programme = une campagne (prompt maître n° 2).</p>')

# ── PARTIE 4
page('4 · Instagram', '<div class="part-h">PARTIE 4</div><h1>Instagram, <em>en vrai</em></h1><p class="lead" style="font-size:19px">2 à 4 posts par mois, pas plus : c’est ton rythme réel. Donc chaque post compte, et chaque post est préparé par des stories. Le lancement se joue sur 10 jours.</p>' +
     table(['Quand','Format','Contenu'], [[f'<b>{a}</b>',b,c] for a,b,c in INSTA_LANCEMENT], ['.5fr','.9fr','4fr'], 46) +
     '<h2>Ensuite, chaque mois</h2>' + table(['Semaine','Post'], [['1','Exercice favori (ton format qui marche le mieux)'],['2','Séance ou collab (avec placement de l’app)'],['3','Je cuisine et je m’entraîne / coulisses'],['4 (si tu peux)','Motivation ou témoignage']], ['.8fr','4fr'], 42) +
     '<h2>Placer l’app sans que ça sente la pub</h2>' + ''.join(task(p, '') for p in PLACEMENT))
page('4 · Collabs', '<div class="kick">Collabs et événements</div><h1>8 idées <em>(pas de rock)</em></h1><p class="lead" style="font-size:19px">Toujours en Collab (co-auteur) pour toucher l’audience de l’autre. À chaque fois : où l’app apparaît, naturellement.</p>' +
     table(['Idée','Où l’app apparaît','✎ Avec qui / quand'], [[f'<b>{a}</b>', b, ''] for a,b in COLLABS], ['1.4fr','3fr','1.1fr'], 64))

page('4 · Influence', f'''
<div class="kick">L’influence payée au résultat</div><h1>D’abord testeuses, <em>ensuite ambassadrices</em></h1>
<p class="lead" style="font-size:19px">On ne demande pas une pub : on demande un avis. Les créatrices testent, on améliore grâce à elles, et celles qui aiment deviennent ambassadrices. Elles sont payées uniquement sur ce qu’elles font encaisser.</p>
{table(['Étape','Quand','Ce qui se passe'],[['DM 1','Jour 0','Le premier contact : tu as vu sa vidéo, tu lui demandes son avis'],['DM 2','Jour 4','Une seule relance douce'],['DM 3','Dès le oui','L’accès Ultime offert et 3 choses à tester'],['DM 4','Jour 7','Le point à mi-parcours : qu’est-ce que tu changerais ?'],['DM 5','Jour 14 à 21','La proposition : code, 2 mois pour sa commu, 30 % pendant 12 mois'],['Kit','Dès le oui au partenariat','Contrat d’une page, 3 idées de vidéos, mention « collaboration commerciale »']],['.6fr','1fr','3.4fr'],46)}
<h2>Qui viser</h2>
{table(['Étage','Taille','Pourquoi'],[['1 · Les testeuses','5 000 à 50 000 abonnés','Elles répondent, elles testent vraiment, leur commu leur fait confiance'],['2 · Les ambassadrices','20 000 à 150 000','Une fois l’app peaufinée grâce à l’étage 1'],['3 · Les têtes d’affiche','plus de 500 000 (ex. Juju Fitcats, Sissy Mua)','Plus tard, avec des preuves chiffrées : elles sont souvent sous contrat avec des marques']],['1.1fr','1.2fr','3fr'],46)}
<p class="mut" style="font-size:15px;margin-top:10px">La liste des comptes n’est pas figée dans ce guide : le moteur M5 en trouve 15 nouveaux chaque lundi, vérifiés et actifs, avec leur DM déjà personnalisé. Niches : muscu en salle, fessiers, powerlifting féminin, HYROX, cycle et santé hormonale.</p>
''')
page('4 · Influence', '<div class="kick">Les messages · version femmes</div><h1>Mignon, humain, <em>sans pression</em></h1>' + msgs(DM_F))
page('4 · Influence', '<div class="kick">Les messages · version hommes</div><h1>Direct, <em>entre passionnés</em></h1>' + msgs(DM_H) +
     f'<h2>Les ambassadeurs MyProtein, sur WhatsApp</h2><div class="msg"><div class="h">Le message<small>un par un, jamais en groupe</small></div><pre>{esc(WA_MYPROTEIN)}</pre></div>')
page('4 · Influence', '<div class="kick">Suivi · à photocopier</div><h1>Mon vivier <em>d’influence</em></h1><p class="lead" style="font-size:18px">Une ligne par compte. Le moteur M5 tient la même liste dans Google Sheets ; celle-ci, c’est pour ton crayon.</p>' +
     table(['Compte','Abonnés','DM1','DM2','Oui','Accès','J+7','DM5','Code','1re vidéo','Inscrits'], [['']*11 for _ in range(22)], ['1.5fr','.7fr','.5fr','.5fr','.4fr','.5fr','.5fr','.5fr','.6fr','.7fr','.6fr'], 52))

page('4 · Coachs', f'''
<div class="kick">Les coachs</div><h1>Un coach = 5 à 30 athlètes <em>d’un coup</em></h1>
<p class="lead" style="font-size:19px">Comment un coach te fait gagner de l’argent, en 5 flèches :</p>
{flux_coach()}
<p style="font-size:16px;margin-top:8px">① Le coach paie sa licence. ② Il invite ses élèves avec un code : ils ont l’app gratuitement pendant son coaching. ③ Quand le coaching s’arrête, ils gardent leurs séances, leurs records, leurs bilans : la plupart veulent continuer. ④ Ils s’abonnent, c’est pour toi. ⑤ Le coach touche 30 % pendant 12 mois (fiche A17) : il a intérêt à recommander l’app.</p>
<h2>Pourquoi RepCore et pas les autres</h2>
{table(['App','Qui paie · prix','Charge proposée','Cycle','Vidéo','Jeu côté élève','Français'], [[f'<b>{r[0]}</b>' if r[0]=='RepCore' else r[0]]+list(r[1:]) for r in CONCURRENTS], ['.9fr','1.9fr','.8fr','.6fr','1fr','1.2fr','.8fr'], 40)}
<p class="mut" style="font-size:13.5px;margin-top:6px">Prix relevés sur les sites et comparateurs le 9/10/2026, indicatifs. « non vu » = absent des fiches consultées, pas forcément absent de l’app : à vérifier avant d’en faire un argument public (moteur M6).</p>
''')
page('4 · Coachs', '<div class="kick">Les coachs · les messages</div><h1>Sur Instagram, <em>de coach à coach</em></h1>' + msgs(DM_COACH_IG) +
     '<h2>Ce qu’un coach doit se dire en 10 secondes</h2>' +
     table(['Argument','Pourquoi ça touche'], [['« Mes élèves savent quoi mettre sur la barre sans m’écrire »','Moins de messages le soir'],['« Je vois tout sans rien ressaisir »','Fin d’Excel et des captures WhatsApp'],['« Je paie 19 €, pas 49 € »','Moitié prix des concurrents français'],['« Je gagne 30 % quand mes élèves restent »','Aucune autre app ne le fait'],['« Ma vitrine trouve mes prochains clients »','La page /c/ et le formulaire « ça m’intéresse »']], ['2.2fr','2fr'], 44))
page('4 · LinkedIn', f'''
<div class="kick">LinkedIn · 1 500 relations</div><h1>Ton réseau <em>de salles et de coachs</em></h1>
<p class="lead" style="font-size:19px">Tes 1 500 relations sont des coachs, des gens de salles, des directions. Un post de lancement avec la vidéo, puis des messages un par un.</p>
<div class="msg"><div class="h">Le post de lancement<small>avec la vidéo motivation</small></div><pre>{esc(LI_POST)}</pre></div>
<div class="msg"><div class="h">Message à un coach<small>après la connexion</small></div><pre>{esc(LI_DM_COACH)}</pre></div>
<div class="msg"><div class="h">Message à un manager ou directeur de salle<small>jamais Fitness Park</small></div><pre>{esc(LI_DM_SALLE)}</pre></div>
''')
page('4 · Newsletter', f'''
<div class="kick">Systeme.io · 1 200 → 2 000 contacts</div><h1>Ce qu’on peut faire <em>(vérifié)</em></h1>
<p class="lead" style="font-size:19px">Chiffres de la grille officielle de Systeme.io, relevés le 9 octobre 2026. Ta question : peut-on segmenter ? <b>Pas sur le plan gratuit</b> : il n’autorise qu’un seul tag.</p>
<div class="grid" style="grid-template-columns:1fr 1fr;gap:14px">
 <div class="box"><h3>Gratuit : on peut</h3>{''.join(f'<p style="font-size:15.5px;margin-top:6px">✓ {x}</p>' for x in SYSTEME_PEUT)}</div>
 <div class="box r"><h3>Gratuit : on ne peut pas</h3>{''.join(f'<p style="font-size:15.5px;margin-top:6px">✗ {x}</p>' for x in SYSTEME_PEUT_PAS)}<p style="font-size:15.5px;margin-top:10px"><b>Startup, 17 €/mois</b> : 5 000 contacts, 10 tags, 10 séquences, 10 règles, 5 workflows.</p></div>
</div>
<h2>Le plan</h2>
{table(['Phase','Plan','Ce qui tourne'],[['Maintenant → 2 000 contacts','Gratuit','1 tag « repcore », 1 séquence = bienvenue, newsletter du jeudi à tout le monde'],['Mois du lancement','Startup 17 €','Tags par source et par statut, séquence fin d’essai, campagne de lancement'],['Après','Startup','Séquences par public : femmes, débutants, coachs']],['1.3fr','.8fr','3fr'],46)}
<h2>7 façons d’atteindre 2 000 contacts</h2>
{table(['Aimant','Comment'], [[f'<b>{a}</b>', b] for a,b in CROISSANCE_CONTACTS], ['1.6fr','3fr'], 42)}
''')
page('4 · Newsletter', '<div class="kick">Les e-mails, écrits</div><h1>La bienvenue <em>et le lancement</em></h1><h2 style="margin-top:6px">Séquence de bienvenue (la seule du plan gratuit)</h2>' +
     table(['Envoi','Objet','Le texte'], [[f'<b>{a}</b>', f'<b>{b}</b>', c] for a,b,c in EMAILS_BIENVENUE], ['.5fr','1.3fr','3.4fr'], 60) +
     '<h2>Campagne de lancement</h2>' + table(['Quand','Objet','Le contenu'], [[f'<b>{a}</b>', f'<b>{b}</b>', c] for a,b,c in EMAILS_LANCEMENT], ['.5fr','1.5fr','3.2fr'], 50) +
     '<p class="mut" style="font-size:15px;margin-top:8px">Les versions complètes (objets alternatifs, liens suivis, mise en page) sont générées par le moteur M7 dans docs/emails/.</p>')
page('4 · Salles', f'''
<div class="kick">Les salles partenaires</div><h1>Corona Gym, <em>la première</em></h1>
{table(['','Vérifié le 9 octobre 2026'], [[f'<b>{a}</b>', b] for a,b in CORONA['faits']], ['1fr','3.4fr'], 40)}
<div class="fx-pq"><span class="lab">Attention</span><p style="font-size:16px">{CORONA['attention']}</p></div>
<div class="msg"><div class="h">Le mail au gérant<small>à envoyer depuis ton adresse</small></div><pre style="font-size:14.5px">{esc(CORONA['mail'])}</pre></div>
''')
page('4 · Salles', '<div class="kick">Les suivantes</div><h1>8 salles indépendantes <em>et Fit Pulse</em></h1>' +
     table(['Salle','Ville','Repère','✎ Contacté'], [[f'<b>{a}</b>',b,c,''] for a,b,c in SALLES], ['1.6fr','1.3fr','1.6fr','.7fr'], 44) +
     '<p class="mut" style="font-size:15px;margin-top:6px">Aucun e-mail générique trouvé pour la plupart : passer par leur site, Instagram ou une visite. Le moteur M3 complète cette liste chaque jour.</p>' +
     '<h2>Fit Pulse, OnePulse, et les autres réseaux</h2>' +
     '<p style="font-size:17px">Le même outil, habillé aux couleurs de chaque réseau : <b>Fit Pulse</b> pour Fitness Park, <b>OnePulse</b> pour On Air (le réseau que tu appelais « Honor » : aucune chaîne de ce nom n’existe en France, On Air ouvre d’ailleurs à Niort), d’autres noms ensuite. Fitness Park utilise Resamania (confirmé, 234 clubs) ; pour On Air, pas de preuve publique. On le garde en second plan : rien ne se vend avant un accord écrit sur la propriété de l’outil.</p>' +
     task('Accord écrit sur la propriété de Fit Pulse obtenu', '') + task('Démo sans aucune donnée réelle de membre', '') + task('Habillage OnePulse prêt (logo, couleurs, discours)', ''))
page('4 · Engouement', '<div class="kick">L’engouement</div><h1>Les gens doutent. <em>On leur donne des preuves.</em></h1><p class="lead" style="font-size:19px">« Trop douteux, trop chiant » : la réponse n’est pas plus de promesses, c’est plus de preuves, plus de visages et plus de simplicité.</p>' +
     ''.join(f'<div class="dec"><div class="n">{i+1:02d}</div><div><h3>{a}</h3><p>{b}</p></div></div>' for i,(a,b) in enumerate(ENGOUEMENT)))

# ── PARTIE 5
BRANCH = [['Gmail, Google Sheets, Drive, Agenda','connecté','Rapports, brouillons de mails, tableaux de suivi'],['PayPal','connecté','Ventes, abonnements, commissions'],['Outil de prospection B2B','connecté','Coachs et salles, e-mails professionnels publics'],['Outil vidéo (Higgsfield)','connecté','Variantes de pubs (crédits payants, toujours sur accord)'],['Zapier','connecté (Gmail, Typeform)','Ajouter Systeme.io si besoin'],['Dépôt GitHub de l’app','connecté','Code, articles SEO, pages de vente'],['Statistiques Instagram','à autoriser','Pour que le rapport lise tes vues et abonnés'],['Systeme.io','clé API à créer (fiche A11)','Contacts et tags automatiques'],['Statistiques RepCore','à créer (fiche A14)','Ventes, essais, résiliations par source'],['Routines planifiées','sur ton feu vert','Les 10 moteurs tournent seuls']]
page('5 · Autonomie', '<div class="part-h">PARTIE 5</div><h1>Claude, ton équipe marketing <em>à 0 €</em></h1><p class="lead" style="font-size:19px">Le produit est prêt : il reste à le vendre. Voici 10 moteurs qui tournent seuls, chacun avec une routine planifiée. Toi, tu valides en un mot ; Instagram reste à la main (les envois automatiques y sont sanctionnés).</p>' +
     table(['Moteur','Rythme','Ce que tu fais'], [[f'<b>{m["id"]} · {m["titre"]}</b>', m['rythme'], m['toi']] for m in MOTEURS], ['1.8fr','1.2fr','2.2fr'], 44) +
     '<h2>Les branchements</h2>' + table(['Outil','État','Pour quoi faire'], BRANCH, ['1.6fr','1.1fr','2.4fr'], 40))
for m in MOTEURS:
    page(f'5 · {m["id"]}', fiche_moteur(m))
page('5 · Autonomie', '<div class="kick">Prêts à coller</div><h1>3 prompts maîtres <em>qui travaillent pour toi</em></h1><p class="lead" style="font-size:19px">Quand tu ne sais pas quoi faire, tu colles l’un des trois. Chacun lit tes vrais chiffres et te rend du matériel prêt à envoyer.</p>' +
     ''.join(f'<div class="prompt"><div class="k">{t}</div><pre>{esc(p)}</pre></div>' for t,p in PROMPTS_MAITRES))

# ── PARTIE 6
page('6 · Garder', '<div class="part-h">PARTIE 6</div><h1>La résiliation <em>décide de tout</em></h1><p class="lead" style="font-size:19px">À 8 % de résiliation par mois, 2 000 abonnés en perdent 160 chaque mois. Passer à 6 %, c’est 40 abonnés gardés, soit environ 600 € de chiffre mensuel, sans un nouveau client.</p>' +
     table(['Levier','Comment','Fait'], [[f'<b>{a}</b>', b, cb('s')] for a,b in RETENTION], ['1.3fr','3.4fr','.4fr'], 46))
def risque_rows(lst):
    out = ''
    for i, (t, r, p, pr) in enumerate(lst):
        out += f'<div class="dec"><div class="n">{i+1:02d}</div><div><h3>{t}</h3><p><b>Le risque :</b> {r}</p><p><b>La parade :</b> {p}</p></div></div>'
        if pr:
            out += f'<div class="prompt" style="margin:6px 0 4px"><div class="k">Le prompt</div><pre>{esc(pr)}</pre></div>'
    return out
page('6 · Risques', '<div class="kick">Les garde-fous</div><h1>Les risques <em>tenus en laisse</em></h1>' + risque_rows(RISQUES[:4]))
page('6 · Risques', '<div class="kick">Les garde-fous (suite)</div><h1>Et leurs <em>parades</em></h1>' + risque_rows(RISQUES[4:7]))
page('6 · Risques', '<div class="kick">Les garde-fous (fin)</div><h1>Les derniers <em>points de vigilance</em></h1>' + risque_rows(RISQUES[7:]))
page('6 · Leviers', '<div class="kick">Banque d’idées</div><h1>50 leviers, <em>coche au fur et à mesure</em></h1>' +
     table(['#','Levier','Comment le mettre en place','Impact','Fait'], [[str(i+1), f'<b>{a}</b>', b, c, cb('s')] for i,(a,b,c) in enumerate(LEVIERS[:25])], ['.3fr','2.1fr','2.2fr','.5fr','.35fr'], 44))
page('6 · Leviers', '<div class="kick">Banque d’idées (suite)</div><h1>Leviers <em>26 à 50</em></h1>' +
     table(['#','Levier','Comment le mettre en place','Impact','Fait'], [[str(i+26), f'<b>{a}</b>', b, c, cb('s')] for i,(a,b,c) in enumerate(LEVIERS[25:])], ['.3fr','2.1fr','2.2fr','.5fr','.35fr'], 44))
page('Compte rendu', '<div class="kick">À photocopier · une page par semaine</div><h1>Mon compte rendu <em>de la semaine</em></h1><p class="lead" style="font-size:18px">Pas de prévisions, pas d’objectifs à tenir : juste ce que tu as fait. Donne-le au prompt « Lance ma semaine ».</p>' +
     '<p style="font-size:18px;margin-top:10px">Semaine du ____ / ____ au ____ / ____</p>' +
     '<h2>Ce que j’ai fait</h2>' + lines(6) + '<h2>Ce qui a marché</h2>' + lines(3) + '<h2>Ce qui a bloqué</h2>' + lines(3) +
     '<h2>Mes chiffres (si je les ai)</h2>' + table(['Ventes','Essais','Abonnés','Coachs','Contacts e-mail','Ambassadrices'], [['']*6], ['1fr']*6, 60) +
     '<h2>La semaine prochaine, je veux surtout…</h2>' + lines(2))
page('', '''<div style="position:absolute;inset:0;background:#0B0B0C"></div>
<div style="position:absolute;left:100px;right:100px;top:600px;color:#fff">
<h1 style="font-size:160px;line-height:.88;color:#fff">On vend.<br><em>Maintenant.</em></h1>
<p style="font-size:28px;font-weight:700;margin-top:40px">Ce week-end :</p>
<p style="font-size:24px;margin-top:10px">1. Les 6 premières fiches du sprint (A1, A2, A3, A9, A8, A5).</p>
<p style="font-size:24px;margin-top:6px">2. Les décisions de la page 4, cochées.</p>
<p style="font-size:24px;margin-top:6px">3. Me dire « go » pour allumer les moteurs M1, M2, M3 et M5.</p></div>''', 'cover')

out = ['<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>RepCore — La machine</title>']
out.append('<style>' + FONTS_PRINT + CSS + '</style></head><body>')
for i, (sec, body, cls) in enumerate(pages):
    n = i + 1
    hd = '' if cls == 'cover' else f'<div class="hd"><div class="l"><img src="{IMG}logo.png">REPCORE · LA MACHINE</div><div class="s">{sec}</div></div>'
    ft = '' if cls == 'cover' else f'<div class="ft"><span>La machine · guide de vente 2026</span><b>{n}</b></div>'
    out.append(f'<section class="p">{hd}{body}{ft}</section>')
out.append('</body></html>')
open('machine.html', 'w').write('\n'.join(out))

# Markdown : tous les prompts et messages
md = ['# RepCore — La machine : prompts et messages\n', '## Bloc contexte (avant chaque prompt de code)\n', '```text\n' + CTX + '\n```\n', '## Partie 2 · Les fiches app\n']
for d in APP:
    md += [f'### {d["id"]} · {d["titre"]} ({QUI[d["qui"]]})\n', re.sub('<[^>]+>', '', d['idee']) + '\n', '**Pourquoi :** ' + d['pourquoi'] + '\n', '```text\n' + d['prompt'] + '\n```\n']
md.append('## Partie 4 · Les messages\n')
for titre, lst in (('Influence · femmes', DM_F), ('Influence · hommes', DM_H), ('Coachs · Instagram', DM_COACH_IG)):
    md.append(f'### {titre}\n')
    for t, w, x in lst: md += [f'**{t}** ({w})\n', '```text\n' + x + '\n```\n']
md += ['### Ambassadeurs MyProtein (WhatsApp)\n', '```text\n' + WA_MYPROTEIN + '\n```\n', '### LinkedIn · post\n', '```text\n' + LI_POST + '\n```\n', '### LinkedIn · coach\n', '```text\n' + LI_DM_COACH + '\n```\n', '### LinkedIn · salle\n', '```text\n' + LI_DM_SALLE + '\n```\n', '### Mail Corona Gym\n', '```text\n' + CORONA['mail'] + '\n```\n']
md.append('## Partie 5 · Les moteurs\n')
for m in MOTEURS:
    md += [f'### {m["id"]} · {m["titre"]} ({m["rythme"]})\n', '```text\n' + m['prompt'] + '\n```\n']
md.append('## Les 3 prompts maîtres\n')
for t, p in PROMPTS_MAITRES: md += [f'### {t}\n', '```text\n' + p + '\n```\n']
md.append('## Partie 6 · Prompts des risques\n')
for t, r, p, pr in RISQUES:
    if pr: md += [f'### {t}\n', '```text\n' + pr + '\n```\n']
open('PROMPTS-MACHINE.md', 'w').write('\n'.join(md))
print(len(pages), 'pages')
