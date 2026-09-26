#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""Sort les gros blocs figes de app/index.html vers des fichiers versionnes par
leur nom, et les renomme au numero de build courant.

POURQUOI. app/index.html est servi en `no-cache` — il le DOIT : c'est lui qui
porte le numero de build et le squelette, et une page figee une heure a deja
coute quatre lots. Mais il pesait 2 101 Ko compresses, dont 5,2 Mo de code et
574 Ko de styles qui, eux, ne changent pas d'une ouverture a l'autre. Resultat :
chaque ouverture de l'app retelechargeait tout, et le plafond Hosting de
360 Mo/jour n'autorisait que 175 ouvertures par jour POUR TOUT LE MONDE.
Il en autorise 3 316 des lors que les deux actifs sont deja en cache.

CE QUE FAIT CE SCRIPT, et il est IDEMPOTENT :
  • premier passage  — il EXTRAIT le gros <style> et le gros <script> vers
    app/rc-style.<build>.css et app/rc-core.<build>.js, et les remplace dans
    index.html par un <link> et un <script src> ;
  • passages suivants — il RENOMME ces deux fichiers au numero de build courant
    et met les references a jour (index.html et la liste ASSETS du worker).

Les deux fichiers sont servis en `public, max-age=31536000, immutable` (voir
firebase.json) : leur nom change a chaque build, donc ils ne repartent JAMAIS
deux fois sur le reseau pour le meme appareil.

⚠ CRLF. app/index.html est integralement en CRLF et le depot les stocke tels
quels : on lit et on ecrit avec newline='' , on ne touche a rien d'autre, et on
verifie le compte avant/apres.

⚠ LES FICHIERS EXTRAITS, EUX, SONT EN LF — et ce n'est pas une coquetterie.
L'analyseur HTML NORMALISE les fins de ligne du document : le contenu d'un
<script> ou d'un <style> EN LIGNE arrive au moteur en LF, quoi qu'il y ait sur
le disque. Un fichier servi a part, non : il arrive tel quel. Sorti en CRLF,
`String(maFonction)` se met a rendre des \r\n dans toute l'application — et
une assertion dont le motif finissait par « \n\s*\}\n » ne trouvait plus rien :
l'envoi vers sante_privee semblait avoir disparu. On sort donc en LF, ce que la
page avait toujours vu. (Gain accessoire : 102 107 octets de moins avant gzip.)

Usage :  python scripts/versionner_actifs.py [--verifier]
         --verifier ne change rien : il dit ce qui serait fait, et les poids.
"""
import io
import os
import re
import sys
import gzip

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(RACINE, 'app', 'index.html')
SW = os.path.join(RACINE, 'app', 'sw.js')
SEUIL = 50 * 1024          # au-dela, un bloc en ligne merite de sortir


def lire(chemin, binaire=False):
    if binaire:
        with open(chemin, 'rb') as f:
            return f.read()
    with io.open(chemin, encoding='utf-8', newline='') as f:
        return f.read()


def ecrire(chemin, texte):
    with io.open(chemin, 'w', encoding='utf-8', newline='') as f:
        f.write(texte)


def poids(octets):
    return '%d o (%s Ko gzip)' % (len(octets), round(len(gzip.compress(octets, 9)) / 1024))


def build_de(html):
    m = re.search(r"window\.RC_BUILD='(\d+)'", html)
    if not m:
        raise SystemExit('RC_BUILD introuvable dans index.html')
    return m.group(1)


def bloc(html, ouvrant, fermant, mini):
    """Le premier bloc <balise>…</balise> dont le CONTENU depasse `mini`."""
    i = 0
    while True:
        d = html.find(ouvrant, i)
        if d < 0:
            return None
        deb = html.index('>', d) + 1
        fin = html.find(fermant, deb)
        if fin < 0:
            return None
        if fin - deb >= mini:
            return (d, deb, fin, fin + len(fermant))
        i = fin + len(fermant)


def main():
    verifier = '--verifier' in sys.argv
    html = lire(INDEX)
    crlf_avant = html.count('\r\n')
    build = build_de(html)
    # LA DATE DE MISE A JOUR affichee dans les reglages (« Mis à jour le … ») :
    # posee ici, au meme geste que le numero de build, pour qu'elles ne
    # divergent jamais. Heure de Paris.
    import datetime, zoneinfo
    jour = datetime.datetime.now(zoneinfo.ZoneInfo('Europe/Paris')).strftime('%Y-%m-%d')
    html = re.sub(r"window\.RC_MAJ='[0-9-]*';", "window.RC_MAJ='%s';" % jour, html)
    avant = lire(INDEX, binaire=True)
    faits = []

    # ── LE CSS ───────────────────────────────────────────────────────────
    css_nom = 'rc-style.%s.css' % build
    b = bloc(html, '<style', '</style>', SEUIL)
    if b:
        d, deb, fin, apres = b
        contenu = html[deb:fin]
        if not verifier:
            ecrire(os.path.join(RACINE, 'app', css_nom), contenu)
        html = html[:d] + '<link rel="stylesheet" href="./%s">' % css_nom + html[apres:]
        faits.append('CSS extrait vers app/%s (%d o)' % (css_nom, len(contenu)))
    else:
        m = re.search(r'<link rel="stylesheet" href="\./(rc-style\.\d+\.css)">', html)
        if m and m.group(1) != css_nom:
            ancien = os.path.join(RACINE, 'app', m.group(1))
            if os.path.exists(ancien) and not verifier:
                os.rename(ancien, os.path.join(RACINE, 'app', css_nom))
            html = html.replace(m.group(1), css_nom)
            faits.append('CSS renomme %s en %s' % (m.group(1), css_nom))

    # ── LE CODE ──────────────────────────────────────────────────────────
    js_nom = 'rc-core.%s.js' % build
    b = bloc(html, '<script', '</script>', SEUIL)
    if b:
        d, deb, fin, apres = b
        contenu = html[deb:fin]
        if not verifier:
            ecrire(os.path.join(RACINE, 'app', js_nom), contenu)
        html = html[:d] + '<script src="./%s"></script>' % js_nom + html[apres:]
        faits.append('code extrait vers app/%s (%d o)' % (js_nom, len(contenu)))
    else:
        m = re.search(r'<script src="\./(rc-core\.\d+\.js)"></script>', html)
        if m and m.group(1) != js_nom:
            ancien = os.path.join(RACINE, 'app', m.group(1))
            if os.path.exists(ancien) and not verifier:
                os.rename(ancien, os.path.join(RACINE, 'app', js_nom))
            html = html.replace(m.group(1), js_nom)
            faits.append('code renomme %s en %s' % (m.group(1), js_nom))

    # ── LES DEUX FICHIERS SORTENT EN LF ──────────────────────────────────
    # Toujours, y compris au passage de renommage : c'est ce que la page
    # voyait quand ces blocs etaient en ligne (voir l'avertissement en tete).
    for nom in (css_nom, js_nom):
        chemin = os.path.join(RACINE, 'app', nom)
        if os.path.exists(chemin):
            t = lire(chemin)
            if '\r\n' in t:
                if not verifier:
                    ecrire(chemin, t.replace('\r\n', '\n'))
                faits.append('%s remis en LF (%d fins de ligne)' % (nom, t.count('\r\n')))

    # ── LE WORKER : il doit connaitre les deux noms courants ─────────────
    sw = lire(SW)
    sw2 = re.sub(r"'\./rc-core\.\d+\.js'", "'./%s'" % js_nom, sw)
    sw2 = re.sub(r"'\./rc-style\.\d+\.css'", "'./%s'" % css_nom, sw2)
    if sw2 != sw and not verifier:
        ecrire(SW, sw2)
        faits.append('sw.js : ASSETS mis a jour')

    if not verifier:
        if html.count('\n') - html.count('\r\n') != 0:
            raise SystemExit('REFUS : des fins de ligne LF seules sont apparues')
        ecrire(INDEX, html)

    apresb = html.encode('utf-8')
    print('build %s' % build)
    for f in faits:
        print('  ' + f)
    print('  index.html AVANT : ' + poids(avant))
    print('  index.html APRES : ' + poids(apresb))
    print('  CRLF : %d -> %d' % (crlf_avant, html.count('\r\n')))
    for n in sorted(os.listdir(os.path.join(RACINE, 'app'))):
        if re.match(r'rc-(core|style)\.\d+\.(js|css)$', n):
            print('  app/%s : %s' % (n, poids(lire(os.path.join(RACINE, 'app', n), binaire=True))))


if __name__ == '__main__':
    main()
