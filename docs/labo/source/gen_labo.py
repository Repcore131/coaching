# Le Labo RepCore — idées tirées de la bibliothèque Drive + prompts Claude Code (A4 portrait)
import html
src = open('gen.py').read()
exec(src[:src.index('# ───────────── 1 COUVERTURE')])
exec(open('labo_ideas.py').read())
import morpho_svg as MS
IMG = 'img/'

FIG = {'camera': MS.svg_camera(), 'squat': MS.svg_squat()[0], 'bench': MS.svg_bench(), 'pull': MS.svg_pull(),
       'segments': MS.svg_segments(), 'joints': MS.svg_joints(), 'tree': MS.svg_tree()}

CSS += """
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 16px}
.chip{border:1.5px solid var(--n);border-radius:30px;padding:4px 12px;font-size:13px;font-weight:700}
.idee{border-left:8px solid var(--r);background:var(--t);border-radius:0 14px 14px 0;padding:18px 24px}
.idee p{font-size:18.5px;line-height:1.5}
.deja{margin-top:12px;font-size:15px;color:#3A3A40;background:#F2F2F4;border-radius:10px;padding:10px 16px}
.deja b{color:var(--n)}
.prompt{background:#0B0B0C;color:#E9E9EE;border-radius:14px;padding:18px 22px;margin-top:16px}
.prompt .k{font-family:'Bebas Neue';font-size:26px;color:#fff;letter-spacing:.04em;display:flex;justify-content:space-between;align-items:baseline}
.prompt .k span{font-family:Montserrat;font-size:12px;color:#A0A0A8;letter-spacing:.12em;font-weight:700}
.prompt pre{white-space:pre-wrap;font-family:'DejaVu Sans Mono',monospace;font-size:14px;line-height:1.5;margin:8px 0 0;color:#E9E9EE}
.fig{margin:14px auto 0;max-width:760px}
.fig svg{width:100%;height:auto;display:block}
.ctx pre{font-size:13.6px}
.prio .row>div{font-size:15px}
.cat{display:inline-block;background:var(--r);color:#fff;font-weight:800;font-size:12px;letter-spacing:.12em;text-transform:uppercase;border-radius:6px;padding:3px 9px;margin-right:8px}
"""

def esc(s): return html.escape(s, quote=False)

# ═════════ COUVERTURE
page('', f'''
<img src="{IMG}bg-guide-cover.jpg" style="position:absolute;left:0;top:0;width:1240px;height:1754px">
<div style="position:absolute;left:100px;top:90px;display:flex;align-items:center;gap:18px">
 <img src="{IMG}logo.png" style="width:86px;height:86px;border-radius:16px">
 <div style="font-family:'Bebas Neue';font-size:40px;letter-spacing:.08em;color:#fff">REPCORE · LE LABO</div></div>
<div style="position:absolute;left:100px;right:100px;top:820px">
 <div class="kick" style="font-size:20px">Ta bibliothèque Drive, passée au crible</div>
 <h1 style="font-size:150px;line-height:.88;color:#fff">Ce que tes livres<br><em>apprennent à l’app</em></h1>
 <p style="font-size:28px;color:#fff;font-weight:700;margin-top:30px">21 idées concrètes · 21 prompts prêts pour Claude Code · des schémas morpho originaux</p>
 <p style="font-size:22px;color:#C8C8CE;margin-top:10px">Morphologie, programmation, vidéo, calisthénie, nutrition, force, santé, coaching.</p>
</div>
<div style="position:absolute;left:100px;bottom:60px;color:#A0A0A8;font-weight:700;font-size:16px;letter-spacing:.24em">KEVIN GUELLEC · GUELLEC COACHING PRO · OCTOBRE 2026</div>
''', 'cover')

# ═════════ MODE D'EMPLOI
page('Mode d’emploi', f'''
<div class="kick">00 · Mode d’emploi</div>
<h1>Une idée, <em>un prompt, une branche</em></h1>
<p class="lead" style="font-size:20px">Chaque fiche dit en 3 à 5 lignes ce que les livres enseignent, ce que RepCore fait déjà, puis donne un prompt prêt à coller dans Claude Code. Les prompts sont écrits pour <b>ton</b> code : ils citent les vrais fichiers et les vraies fonctions de RepCore.</p>
<div class="grid" style="grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px">
 <div class="box"><span class="tag">1</span><h3 style="margin-top:8px">Copie</h3><p class="mut" style="font-size:15px">Le fichier <b>docs/labo/PROMPTS.md</b> contient tous les prompts en texte (plus simple que le PDF).</p></div>
 <div class="box"><span class="tag">2</span><h3 style="margin-top:8px">Colle</h3><p class="mut" style="font-size:15px">Une session Claude Code par idée : le bloc contexte ci-dessous, puis le prompt de la fiche.</p></div>
 <div class="box"><span class="tag">3</span><h3 style="margin-top:8px">Vérifie</h3><p class="mut" style="font-size:15px">Tests app/tests.js, tsc, captures d’écran. Tu relis le résumé avant de fusionner.</p></div>
 <div class="box r"><span class="tag">4</span><h3 style="margin-top:8px">Coche</h3><p class="mut" style="font-size:15px">Une idée livrée = une case cochée dans le tableau des priorités.</p></div>
</div>
<div class="prompt ctx"><div class="k">Bloc contexte · à coller avant chaque prompt <span>COMMUN AUX 21 FICHES</span></div><pre>{esc(CTX)}</pre></div>
''')

# ═════════ PRIORITÉS
PRIO = {'N1':('★★★','faible',1),'K1':('★★★','faible',1),'M4':('★★★','moyen',1),'V1':('★★★','moyen',1),'M1':('★★★','moyen',1),
        'I1':('★★★','élevé',2),'M2':('★★★','moyen',2),'P4':('★★★','moyen',2),'N2':('★★★','moyen',2),'C1':('★★★','moyen',2),'P1':('★★★','moyen',2),
        'M3':('★★','faible',3),'S1':('★★','faible',3),'P2':('★★','faible',3),'P3':('★★','faible',3),'P5':('★★','faible',3),'N3':('★★','faible',3),
        'F1':('★★','moyen',3),'M6':('★★','moyen',3),'M5':('★★','moyen',3),'C2':('★★','moyen',3)}
order = sorted(IDEAS, key=lambda d: (PRIO[d['id']][2], -len(PRIO[d['id']][0])))
rows = [[f'<b>{d["id"]}</b>', d['titre'], PRIO[d['id']][0], PRIO[d['id']][1], f'Vague {PRIO[d["id"]][2]}', cb('s')] for d in order]
page('Mode d’emploi', f'''
<div class="kick">00 · Par où commencer</div>
<h1>Les 21 idées, <em>dans l’ordre</em></h1>
<p class="lead" style="font-size:19px"><b>Vague 1</b> : gros effet, peu de risque, visible tout de suite par tes élèves. <b>Vague 2</b> : les chantiers qui font de RepCore l’app morpho de référence. <b>Vague 3</b> : les finitions. Le prochain Ramadan commence vers mi-février 2027 : N1 est à livrer avant.</p>
<div class="prio">{table(['Fiche','Idée','Impact','Effort','Quand','✎ Livré'], rows, ['.5fr','3.4fr','.7fr','.7fr','.8fr','.6fr'], 50)}</div>
''')

# ═════════ PLANCHE SCHÉMAS
page('Les schémas', f'''
<div class="kick">00 · Les dessins de ce document</div>
<h1>Des schémas <em>calculés, pas recopiés</em></h1>
<p class="lead" style="font-size:19px">Les images des ebooks n’ont pas pu être téléchargées (fichiers trop lourds pour le connecteur Drive), et elles sont protégées par le droit d’auteur. J’ai donc construit des schémas <b>originaux</b>, dans la charte RepCore, à partir des règles des livres. Ils sont calculés : l’angle du buste sort vraiment de la longueur du fémur, et le même code peut dessiner le corps de chaque élève (fiches M2 et I1).</p>
<div class="grid" style="grid-template-columns:1fr 1fr;gap:16px;margin-top:18px">
 <div><div class="fig" style="margin:0">{FIG['squat']}</div><p class="mut" style="font-size:14px;margin-top:6px">Squat à la parallèle : même tronc, même tibia, seul le fémur change. L’épaule reste à l’aplomb du milieu du pied, le buste se penche de 22° à 47°.</p></div>
 <div><div class="fig" style="margin:0">{FIG['bench']}</div><p class="mut" style="font-size:14px;margin-top:6px">Développé couché vu depuis les pieds, avant-bras verticaux : la profondeur du coude sous la ligne des épaules dépend du bras et du thorax.</p></div>
 <div><div class="fig" style="margin:0">{FIG['pull']}</div><p class="mut" style="font-size:14px;margin-top:6px">Tractions : le menton au-dessus de la barre dépend des segments et de la mobilité de l’épaule, pas seulement de la force.</p></div>
 <div><div class="fig" style="margin:0">{FIG['joints']}</div><p class="mut" style="font-size:14px;margin-top:6px">Tests articulaires : valgus du coude (choix de la barre), genoux en X ou en O (placement des pieds).</p></div>
</div>
''')

# ═════════ FICHES
for d in IDEAS:
    fig = f'<div class="fig"{" style=\"max-width:520px\"" if d["fig"]=="segments" else ""}>{FIG[d["fig"]]}</div>' if d.get('fig') else ''
    chips = ''.join(f'<span class="chip">{esc(s.strip())}</span>' for s in d['sources'].split('·'))
    page(f'{d["id"]} · {d["cat"]}', f'''
<div class="kick"><span class="cat">{d["cat"]}</span>Fiche {d["id"]}</div>
<h1 style="font-size:62px">{d["titre"]}</h1>
<div class="chips">{chips}</div>
<div class="idee"><p>{d["idee"]}</p></div>
<div class="deja"><b>Déjà dans RepCore :</b> {d["existe"]}</div>
{fig}
<div class="prompt"><div class="k">Le prompt Claude Code · {d["id"]} <span>APRÈS LE BLOC CONTEXTE</span></div><pre>{esc(d["prompt"])}</pre></div>
''')

# ═════════ AUTRES PISTES + SOURCES
page('Pour plus tard', f'''
<div class="kick">Hors fiches</div>
<h1>Les autres pistes <em>repérées</em></h1>
<div class="grid" style="grid-template-columns:1fr 1fr;gap:14px;margin-top:10px">
{''.join(f'<div class="box"><h3>{t}</h3><p class="mut" style="font-size:15.5px;margin-top:4px">{x}</p></div>' for t, x in AUTRES)}
</div>
<h2>Ce qui a été lu, et ce qui ne l’a pas été</h2>
{table(['Source','Statut'],[
 ['Lesueur · Créer son programme selon son anatomie (2 versions) · 5 erreurs morpho','Lus (texte) ; la fin du chapitre 11 (programmes PPL, split) coupée par le connecteur ; images non récupérées'],
 ['Delavier · Guide des mouvements','Partiel : bras, épaules, pectoraux (les chapitres dos, jambes, fessiers, abdos manquent)'],
 ['Tractions de 0 · Kit du street · SAEX · NPNG 28 jours · Cours chapitre 1','Lus en entier'],
 ['Ramadan · Pro Sèche · BTS diététique · Bioénergétique','Lus ; Bioénergétique : tableaux vides dans le document (structure seule)'],
 ['eBook Coaching · Secrets du coaching en ligne','Lus'],
 ['Mobilité · Épaule sans douleur · Méthodologie FA · BEMOR · Posing · Compex · OPC','Lus (BEMOR bench : sommaire seul ; peaking Powerbuild : image)'],
 ['Guide ultime fessiers · NPNG Shred · Méthode Musculation 2 · Lombalgie','Non lus : PDF scannés sans texte (à passer en OCR)'],
 ['Vidéos (formation posing, mastercoach)','Non analysées : trop lourdes pour le connecteur'],
 ['Dossiers Dopages et Marketing','Volontairement écartés']],['2fr','2.4fr'],56)}
''')

out = ['<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>RepCore — Le Labo</title>']
out.append('<style>' + FONTS_PRINT + CSS + '</style></head><body>')
for i, (sec, body, cls) in enumerate(pages):
    n = i + 1
    hd = '' if cls == 'cover' else f'<div class="hd"><div class="l"><img src="{IMG}logo.png">REPCORE · LE LABO</div><div class="s">{sec}</div></div>'
    ft = '' if cls == 'cover' else f'<div class="ft"><span>Le Labo · idées et prompts 2026</span><b>{n}</b></div>'
    out.append(f'<section class="p">{hd}{body}{ft}</section>')
out.append('</body></html>')
open('labo.html', 'w').write('\n'.join(out))

# Markdown des prompts
md = ['# RepCore — Le Labo : les prompts\n', 'Colle le **bloc contexte** puis le prompt de la fiche dans une session Claude Code (une idée = une branche).\n',
      '## Bloc contexte (à coller avant chaque prompt)\n', '```text\n' + CTX + '\n```\n']
for d in order:
    md.append(f'## {d["id"]} · {d["titre"]}\n')
    md.append(f'*{d["cat"]} · Vague {PRIO[d["id"]][2]} · sources : {d["sources"]}*\n')
    import re
    md.append(re.sub('<[^>]+>', '', d['idee']) + '\n')
    md.append('```text\n' + d['prompt'] + '\n```\n')
open('PROMPTS.md', 'w').write('\n'.join(md))
print(len(pages), 'pages')
