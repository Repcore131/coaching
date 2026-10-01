#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""LES EMOJIS DE L'INTERFACE DEVIENNENT DES ICONES (01/10/2026).

Un emoji est dessine par la POLICE DU SYSTEME : il change de forme et de
couleur d'un telephone a l'autre et ignore la palette. Dans l'interface, il
cede la place a une icone du jeu ICONS (src/core/002, viewBox 24, trait 1.75,
bouts carres) : icon('coche',14), icon('eclair',14)…

IL RESTE VOULU LA OU L'APP NE DESSINE PAS : le texte d'une notification push
(dessinee par le systeme), un texte de partage (Instagram, WhatsApp, presse-
papiers), un <option> ou un placeholder (du texte brut). Ceux-la sont dans la
LISTE BLANCHE ci-dessous, avec leur raison. app/tests.js porte la meme liste :
un emoji hors liste dans une chaine de rc-core fait echouer la suite.

CE QUI EST LU : les morceaux src/core/NNN-*.js et app/index.html, HORS
COMMENTAIRES (un commentaire peut citer l'emoji qu'il a remplace).

Usage : python3 scripts/emojis.py --rapport    fichier:ligne:fonction:contexte
        python3 scripts/emojis.py --appliquer  les cas surs (voir REMPLACE)
        python3 scripts/emojis.py --verifier   sort en 1 si un emoji est hors liste
"""
import collections, glob, os, re, subprocess, sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RACINE, 'scripts'))
import couleurs as C  # masque_commentaires

# Ce qu'on compte comme emoji : pictogrammes, symboles divers, dingbats,
# fleches doubles. Les fleches simples (→ ←) et les puces typographiques
# (· • …) sont de la typographie, pas des emojis.
RE_EMOJI = re.compile('[\U0001F000-\U0001FAFF☀-➿⌀-⏿⬀-⯿⇄]️?')

# L'emoji -> l'icone du jeu (nom, taille par defaut).
REMPLACE = {
    '✓': 'coche', '✔': 'coche', '✕': 'croix', '✗': 'croix', '⚡': 'eclair',
    '💪': 'muscle', '📏': 'regle', '🔥': 'flamme', '☕': 'cafe', '🍵': 'the',
    '💊': 'gelule', '🛡': 'bouclier', '🎯': 'cible',
}

# LA LISTE BLANCHE : les emojis qui restent, et pourquoi. Tenue a l'identique
# dans app/tests.js (test « emojis de rc-core dans la liste blanche »).
LISTE_BLANCHE = {
    # Textes de PARTAGE (legendes Instagram, messages WhatsApp, invitations) et
    # textes DESSINES sur les visuels a partager (canvas) : l'emoji y est voulu.
    '⚡': 'legendes et visuels de partage', '💪': 'messages WhatsApp, invitation',
    '🔥': 'legendes #defi', '🛡': 'visuel de serie (joker)', '👇': 'message d invitation',
    # Les equivalences de tonnage (« = 2 elephants ») : visuels de fin de seance
    # et recapitulatif a partager.
    '🐈': 'equivalence', '🧍': 'equivalence', '🎹': 'equivalence', '🚗': 'equivalence',
    '🦏': 'equivalence', '🐘': 'equivalence', '🦖': 'equivalence', '🚌': 'equivalence',
    '🐋': 'equivalence', '🗽': 'equivalence', '🗼': 'equivalence',
    # Les reactions : ce que l'athlete ENVOIE, stocke tel quel dans la base.
    '👍': 'reaction du canal', '❤': 'reaction du canal', '👏': 'reaction entre amis',
    '😮': 'reaction entre amis',
    # L'apercu de la barre d'outils d'une story Instagram (maquette).
    '☺': 'apercu Instagram', '♫': 'apercu Instagram', '✦': 'apercu Instagram',
    # Les signes du sexe : de la typographie colorée, pas des pictogrammes.
    '♀': 'signe', '♂': 'signe',
}


def fichiers():
    return sorted(glob.glob(os.path.join(RACINE, 'src', 'core', '[0-9][0-9][0-9]-*.js'))) \
        + [os.path.join(RACINE, 'app', 'index.html')]


RE_FONC = re.compile(r'(?m)^\s*(?:async\s+)?function\s+([\w$]+)|^\s*(?:const|let|var)\s+([\w$]+)\s*=')


def fonction_de(s, i):
    nom = '?'
    for m in RE_FONC.finditer(s, 0, i):
        nom = m.group(1) or m.group(2)
    return nom


def occurrences(f):
    s = open(f, encoding='utf-8', newline='').read()
    masque = C.masque_commentaires(s, f.endswith('.js'))
    # index.html : ses <script> en ligne ont aussi leurs lignes de commentaire //.
    masque = re.sub(r'(?m)^[ \t]*//[^\n]*', lambda m: ' ' * len(m.group()), masque)
    # Un commentaire HTML dans un gabarit JS n'est pas affiche non plus.
    masque = re.sub(r'<!--[\s\S]*?-->', lambda m: re.sub(r'[^\n]', ' ', m.group()), masque)
    for m in RE_EMOJI.finditer(masque):
        ligne = s.count('\n', 0, m.start()) + 1
        deb = s.rfind('\n', 0, m.start()) + 1
        fin = s.find('\n', m.start())
        yield m.group().rstrip('\uFE0F'), ligne, fonction_de(s, m.start()), s[deb:fin].strip()


def chaines(s):
    """Pour chaque position : le delimiteur de la chaine JS qui la contient
    (' " `) ou None. Lexeur simple : commentaires, chaines, gabarits et leurs
    ${…} imbriques, litteraux regex (devines au caractere qui precede)."""
    out = [None] * len(s)
    pile = []          # gabarits ouverts : profondeur d'accolades de chacun
    i, n = 0, len(s)
    prec = ''
    while i < n:
        c = s[i]
        if c == '/' and s.startswith('//', i):
            j = s.find('\n', i); i = n if j < 0 else j; continue
        if c == '/' and s.startswith('/*', i):
            j = s.find('*/', i + 2); i = n if j < 0 else j + 2; continue
        if c == '/' and (prec == '' or prec in '(,=:[!&|?{};+-*%<>~^' or s[max(0, i - 6):i].rstrip().endswith('return')):
            j = i + 1; classe = False
            while j < n and s[j] != '\n':
                if s[j] == '\\': j += 2; continue
                if s[j] == '[': classe = True
                elif s[j] == ']': classe = False
                elif s[j] == '/' and not classe: break
                j += 1
            i = j + 1; prec = '/'; continue
        if c in '\'"':
            j = i + 1
            while j < n and s[j] != c and s[j] != '\n':
                if s[j] == '\\': j += 1
                out[j] = c; j += 1
            i = j + 1; prec = c; continue
        if c == '`' or (c == '}' and pile and pile[-1] == 0):
            if c == '}': pile.pop()
            j = i + 1
            while j < n and s[j] != '`':
                if s[j] == '\\': out[j] = '`'; out[j + 1 if j + 1 < n else j] = '`'; j += 2; continue
                if s.startswith('${', j): pile.append(0); j += 2; break
                out[j] = '`'; j += 1
            else:
                i = j + 1; prec = '`'; continue
            if j < n and s[j - 2:j] == '${':
                i = j; prec = '{'; continue
            i = j + 1; prec = '`'; continue
        if c == '{' and pile: pile[-1] += 1
        elif c == '}' and pile: pile[-1] -= 1
        if not c.isspace(): prec = c
        i += 1
    return out


RE_TOAST = re.compile(r'\btoast(?:Sync|Ecriture)?\(')
TOAST_ICO = {'✓': 'coche', '✔': 'coche', '👍': 'coche', '⚡': 'eclair', '🛡': 'bouclier'}


def appliquer(f):
    """Les cas surs : un emoji d'un message de toast (marqueur ICO), un ✓ ou
    un ✕ d'un balisage (icon()). Le reste est laisse au rapport, a la main."""
    s = open(f, encoding='utf-8', newline='').read()
    ch = chaines(s)
    edits = []
    for m in RE_EMOJI.finditer(s):
        e = m.group().rstrip('\uFE0F'); q = ch[m.start()]
        if q is None:
            continue
        deb = s.rfind('\n', 0, m.start()) + 1; fin = s.find('\n', m.start())
        ligne = s[deb:fin]
        if RE_TOAST.search(ligne) and '.textContent' not in ligne and e in TOAST_ICO:
            expr = 'ICO.' + TOAST_ICO[e]
        elif ('<' in ligne and '>' in ligne and 'toast' not in ligne and '.textContent' not in ligne
              and e in REMPLACE and not re.search(r'(title|placeholder|aria-label|alt)="[^"]*$', s[deb:m.start()])):
            expr = "icon('%s',14)" % REMPLACE[e]
        else:
            continue
        a, b = m.start(), m.end()
        if q == '`':
            rep = '${%s}' % expr
        else:
            # Au bord de la chaine, la quote est absorbee : 'Copie ✓' -> 'Copie '+ICO.coche
            debut = s[a - 1] == q and ch[a - 1] is None
            bout = b < len(s) and s[b] == q and ch[b] is None
            rep = ('' if debut else q + '+') + expr + ('' if bout else '+' + q)
            a, b = a - debut, b + bout
        edits.append((a, b, rep))
    for a, b, r in sorted(edits, reverse=True):
        s = s[:a] + r + s[b:]
    open(f, 'w', encoding='utf-8', newline='').write(s)
    return len(edits)


def main():
    mode = 'rapport' if '--rapport' in sys.argv else 'verifier' if '--verifier' in sys.argv else 'appliquer' if '--appliquer' in sys.argv else 'rapport'
    if mode == 'appliquer':
        n = sum(appliquer(f) for f in fichiers() if f.endswith('.js'))
        subprocess.run(['node', os.path.join(RACINE, 'scripts', 'assembler_core.mjs')], check=True)
        print('%d emoji(s) remplace(s) ; le reste : python3 scripts/emojis.py --rapport' % n)
        return
    total = collections.Counter()
    hors = []
    for f in fichiers():
        nom = os.path.relpath(f, RACINE)
        for e, ligne, fonc, ctx in occurrences(f):
            total[e] += 1
            if mode == 'rapport':
                i = ctx.find(e)
                print('%s:%d:%s:%s  %s' % (nom, ligne, fonc, e, ctx[max(0, i - 60):i + 50]))
            if e not in LISTE_BLANCHE or nom.endswith('index.html'):
                hors.append((nom, ligne, e))
    print('\n%d emojis, %d distincts : %s' % (sum(total.values()), len(total), ' '.join(e for e, _ in total.most_common())))
    if mode == 'verifier' and hors:
        for nom, ligne, e in hors[:20]:
            print('  hors liste : %s:%d %s' % (nom, ligne, e))
        sys.exit('%d emoji(s) hors de la liste blanche' % len(hors))


if __name__ == '__main__':
    main()
