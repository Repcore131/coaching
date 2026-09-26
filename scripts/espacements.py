#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""LES ESPACEMENTS SUR UNE ECHELLE, et une seule.

Marges, rembourrages et ecarts (margin, padding, gap) ne prennent que ces
valeurs : 0 1 2 4 6 8 10 12 14 16 20 24 28 32 40 48 56 64, puis au-dela de 64
px la valeur telle quelle (tailles de mise en page, pas des espacements). Une
valeur hors echelle est ramenee a la plus proche (a egalite, la plus grande).

Pourquoi : 7, 9, 11, 13 px cote a cote se voient — deux cartes voisines qui
ne respirent pas pareil donnent une impression de bricolage. Une echelle
courte rend les ecarts previsibles.

Usage : python3 scripts/espacements.py [--verifier]
  --verifier : ne modifie rien, sort en erreur s'il reste une valeur hors echelle.
Traite app/rc-style.<build>.css (hors theme clair genere), app/rc-core.<build>.js
et app/index.html. Relancer scripts/theme_clair.py ensuite.
"""
import glob, os, re, sys
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ECHELLE = [0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64]
PROP = re.compile(r'((?<![-\w])(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|bottom|left|right|block|inline)(?:-start|-end)?)?\s*:\s*)([^;"\'`}{]+)')
PX = re.compile(r'(-?)(\d+(?:\.\d+)?)px')


def cale(v):
    if v > 64:
        return v
    return min(ECHELLE, key=lambda e: (abs(e - v), -e))


def traite(texte, compte):
    def val(m):
        def px(mm):
            v = float(mm.group(2))
            n = cale(v)
            if n != v:
                compte[0] += 1
            return mm.group(1) + ('%g' % n) + 'px'
        return m.group(1) + PX.sub(px, m.group(2))
    return PROP.sub(val, texte)


def main():
    verifier = '--verifier' in sys.argv
    total = 0
    css = glob.glob(os.path.join(RACINE, 'app', 'rc-style.*.css'))[0]
    js = glob.glob(os.path.join(RACINE, 'app', 'rc-core.*.js'))[0]
    for f in (css, js, os.path.join(RACINE, 'app', 'index.html')):
        s = open(f, encoding='utf-8', newline='').read()
        i = s.find('/* ═══ THEME CLAIR')
        base, gen = (s[:i], s[i:]) if (f == css and i >= 0) else (s, '')
        c = [0]
        n = traite(base, c)
        total += c[0]
        print(os.path.basename(f), c[0])
        if not verifier and c[0]:
            open(f, 'w', encoding='utf-8', newline='').write(n + gen)
    if verifier and total:
        sys.exit('%d espacements hors echelle' % total)


if __name__ == '__main__':
    main()
