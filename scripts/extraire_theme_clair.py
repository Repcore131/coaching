#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""LE THEME CLAIR, DANS SON PROPRE FICHIER (01/10/2026).

POURQUOI. app/rc-style.<build>.css pesait 1,6 Mo, dont ~707 Ko de regles
prefixees par :root[data-theme="clair"] — la plupart des [style*="..."] qui
rattrapent les couleurs ecrites en ligne par le code. Le theme par defaut est
SOMBRE : chacun telechargeait et analysait ces 707 Ko pour rien. Ils vivent
desormais dans app/rc-theme.<build>.css, lie APRES rc-style par index.html
avec media="not all" — telecharge, jamais applique — et passe a media="all"
seulement quand le theme clair est actif (premier script d'index.html,
themeAppliquer dans rc-core).

CE QUE FAIT CE SCRIPT, et il est IDEMPOTENT :
  - chaque regle de rc-style dont TOUS les selecteurs commencent par
    :root[data-theme="clair"] (ou html[data-theme="clair"], le meme) part dans
    rc-theme ; les regles MIXTES restent dans rc-style ;
  - un bloc @media/@supports qui en contient : ses regles claires partent dans
    un bloc identique de rc-theme, le reste demeure (le bloc disparait de
    rc-style s'il est vide) ;
  - les commentaires colles a une regle deplacee partent avec elle ;
  - le bloc genere par scripts/theme_clair.py (entre ses deux marqueurs) part
    tel quel et REMPLACE celui de rc-theme.
  rc-theme garde l'ORDRE d'origine : les regles d'avant le bloc genere, le
  bloc, puis celles d'apres. Un second passage ne trouve plus rien a deplacer.

L'ORDRE DE CASCADE : rc-theme vient APRES rc-style (index.html). Une regle
claire, plus specifique de (0,2,0) que sa regle sombre, l'emporte comme avant.

ETAPE SUIVANTE (pas ici) : remplacer, ecran par ecran, les
style="color:#000;background:..." ecrits par rc-core par des classes et des
jetons (var(--text), var(--surface-1)…), et supprimer l'exception [style*=…]
correspondante de rc-theme. C'est ce qui fera fondre le fichier.

Usage : python3 scripts/extraire_theme_clair.py   (theme_clair.py l'appelle)
"""
import glob, os, re, sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEBUT = '/* ═══ THEME CLAIR — GENERE PAR scripts/theme_clair.py, NE PAS MODIFIER A LA MAIN ═══ */'
FIN = '/* ═══ FIN DU THEME CLAIR GENERE ═══ */'
ENTETE = """/* ══ LE THEME CLAIR DE REPCORE — rc-theme.<build>.css ═══════════════════
   Sorti de rc-style par scripts/extraire_theme_clair.py (01/10/2026). Lie APRES
   rc-style dans index.html, avec media="not all" : il n'est applique que si le
   theme clair est actif (data-theme="clair" ; premier script d'index.html,
   themeAppliquer dans rc-core). Le bloc entre les deux marqueurs est REGENERE
   par scripts/theme_clair.py a chaque build : ne pas le modifier a la main.
   ETAPE SUIVANTE : remplacer, ecran par ecran, les style="color:…;background:…"
   de rc-core par des classes et des jetons, et retirer ici l'exception
   [style*=…] correspondante. */
"""
# LE REPERE laisse dans rc-style a la place du bloc genere. theme_clair.py ne
# lit, comme avant l'extraction, que ce qui le PRECEDE : les regles posees apres
# (maquettes Masse grasse, Volume…) n'ont jamais eu de copie generee, et ne
# doivent pas en recevoir une par la bande.
REPERE = '/* ═══ THEME CLAIR : sorti dans rc-theme.<build>.css (scripts/extraire_theme_clair.py). theme_clair.py ne lit que ce qui precede ce repere. ═══ */'
CLAIR = re.compile(r'^(?::root|html)\[data-theme="clair"\]')
GROUPES = ('@media', '@supports')


def elements(css):
    """[(genre, texte, prelude)] au premier niveau, le texte d'origine intact."""
    out, i, n = [], 0, len(css)
    while i < n:
        if css[i].isspace():
            j = i
            while j < n and css[j].isspace():
                j += 1
            out.append(('ws', css[i:j], '')); i = j; continue
        if css.startswith('/*', i):
            j = css.find('*/', i + 2)
            j = n if j < 0 else j + 2
            out.append(('com', css[i:j], '')); i = j; continue
        j, prof = i, 0
        while j < n:
            ch = css[j]
            if css.startswith('/*', j):
                k = css.find('*/', j + 2); j = n if k < 0 else k + 2; continue
            if ch in '"\'':
                q = ch; j += 1
                while j < n and css[j] != q:
                    j += 2 if css[j] == '\\' else 1
                j += 1; continue
            if ch in '([':
                prof += 1
            elif ch in ')]':
                prof -= 1
            elif prof == 0 and ch in '{;':
                break
            j += 1
        if j >= n:
            out.append(('reste', css[i:], '')); break
        if css[j] == ';':
            out.append(('stmt', css[i:j + 1], css[i:j])); i = j + 1; continue
        k, prof = j + 1, 1
        while k < n and prof:
            ch = css[k]
            if css.startswith('/*', k):
                m = css.find('*/', k + 2); k = n if m < 0 else m + 2; continue
            if ch in '"\'':
                q = ch; k += 1
                while k < n and css[k] != q:
                    k += 2 if css[k] == '\\' else 1
                k += 1; continue
            if ch == '{':
                prof += 1
            elif ch == '}':
                prof -= 1
            k += 1
        out.append(('bloc', css[i:k], css[i:j]))
        i = k
    return out


def sans_com(s):
    return re.sub(r'/\*[\s\S]*?\*/', '', s)


def selecteurs(prelude):
    parts, cur, prof, q = [], '', 0, None
    for ch in prelude:
        if q:
            cur += ch
            if ch == q:
                q = None
            continue
        if ch in '"\'':
            q = ch
        elif ch in '([':
            prof += 1
        elif ch in ')]':
            prof -= 1
        if ch == ',' and prof == 0:
            parts.append(cur); cur = ''
        else:
            cur += ch
    parts.append(cur)
    return [p.strip() for p in parts if p.strip()]


def tout_clair(prelude):
    p = sans_com(prelude).strip()
    if not p or p.startswith('@'):
        return False
    s = selecteurs(p)
    return bool(s) and all(CLAIR.match(x) for x in s)


def separer(css):
    """(garde, deplace) : deux textes CSS, l'ordre d'origine conserve dans chacun."""
    els = elements(css)
    garde, depl = [], []
    attente = []          # commentaires (et blancs) en suspens : ils suivent la regle qui vient
    def vider(vers):
        vers.extend(attente); attente.clear()
    for genre, texte, prelude in els:
        if genre in ('ws', 'com'):
            attente.append(texte); continue
        if genre == 'bloc' and tout_clair(prelude):
            # Les commentaires colles (sans ligne vide) partent avec la regle.
            colles = []
            while attente and (attente[-1].startswith('/*') or (attente[-1].isspace() and attente[-1].count('\n') <= 1)):
                colles.insert(0, attente.pop())
            vider(garde)
            depl.append(''.join(colles).lstrip() + texte + '\n')
            continue
        if genre == 'bloc' and sans_com(prelude).strip().lower().startswith(GROUPES):
            p = sans_com(prelude).strip()
            corps = texte[texte.index('{') + 1:texte.rindex('}')]
            g2, d2 = separer(corps)
            if d2.strip():
                vider(garde)
                depl.append(p + '{\n' + d2 + '}\n')
                if elements_utiles(g2):
                    garde.append(texte[:texte.index('{') + 1] + g2 + '}')
                continue
        vider(garde)
        garde.append(texte)
    vider(garde)
    return ''.join(garde), ''.join(depl)


def elements_utiles(css):
    return any(g not in ('ws', 'com') for g, _, _ in elements(css))


def fichiers():
    st = sorted(glob.glob(os.path.join(RACINE, 'app', 'rc-style.*.css')))
    if len(st) != 1:
        sys.exit('un seul app/rc-style.*.css attendu')
    build = re.search(r'rc-style\.(\d+)\.css$', st[0]).group(1)
    th = sorted(glob.glob(os.path.join(RACINE, 'app', 'rc-theme.*.css')))
    if len(th) > 1:
        sys.exit('plusieurs app/rc-theme.*.css : ' + ', '.join(th))
    cible = os.path.join(RACINE, 'app', 'rc-theme.%s.css' % build)
    # Un rc-theme d'un autre numero (build monte sans versionner) : renomme.
    if th and th[0] != cible:
        os.rename(th[0], cible)
    return st[0], cible


def morceaux_theme(texte):
    """(avant, bloc, apres) d'un rc-theme existant ; bloc = '' s'il n'y en a pas."""
    texte = texte.replace(ENTETE, '', 1)
    i = texte.find(DEBUT)
    if i < 0:
        return texte, '', ''
    j = texte.find(FIN, i)
    j = len(texte) if j < 0 else j + len(FIN)
    return texte[:i], texte[i:j], texte[j:]


def extraire(verbeux=True):
    f_style, f_theme = fichiers()
    css = open(f_style, encoding='utf-8').read()
    avant_taille = len(css.encode('utf-8'))
    theme_avant_taille = os.path.getsize(f_theme) if os.path.exists(f_theme) else 0
    # Le bloc genere : tel quel.
    bloc = ''
    i = css.find(DEBUT)
    if i >= 0:
        j = css.find(FIN, i)
        j = len(css) if j < 0 else j + len(FIN)
        bloc = css[i:j]
        haut, bas = css[:i], css[j:]
    elif REPERE in css:
        k = css.index(REPERE)
        haut, bas = css[:k], css[k + len(REPERE):]
    else:
        haut, bas = css, ''
    g_haut, d_haut = separer(haut)
    g_bas, d_bas = separer(bas)
    if not bloc and not d_haut.strip() and not d_bas.strip():
        if verbeux:
            print('theme clair : rien a deplacer — rc-style %d Ko, rc-theme %d Ko' % (avant_taille // 1024, theme_avant_taille // 1024))
        return False
    t_avant, t_bloc, t_apres = morceaux_theme(open(f_theme, encoding='utf-8').read()) if os.path.exists(f_theme) else ('', '', '')
    # Sans bloc genere dans rc-style, une regle claire ecrite a la main depuis
    # va a la fin : derniere dans la cascade, comme une regle ajoutee en queue.
    if not bloc and REPERE not in css:
        d_bas, d_haut = d_haut + d_bas, ''
    nouveau = (ENTETE + t_avant.strip('\n') + ('\n' if t_avant.strip() else '') + d_haut
               + (bloc or t_bloc) + '\n' + t_apres.strip('\n') + ('\n' if t_apres.strip() else '') + d_bas)
    style = (g_haut.rstrip('\n') + '\n' + REPERE + '\n' + g_bas.lstrip('\n')).rstrip('\n') + '\n'
    open(f_style, 'w', encoding='utf-8').write(style)
    open(f_theme, 'w', encoding='utf-8').write(nouveau)
    if verbeux:
        print('theme clair extrait : rc-style %d Ko -> %d Ko ; rc-theme %d Ko -> %d Ko (%s)' % (
            avant_taille // 1024, len(style.encode('utf-8')) // 1024, theme_avant_taille // 1024,
            len(nouveau.encode('utf-8')) // 1024, os.path.basename(f_theme)))
    return True


if __name__ == '__main__':
    extraire()
