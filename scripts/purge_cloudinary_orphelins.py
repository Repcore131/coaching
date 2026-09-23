#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""QUELS FICHIERS DORMENT CHEZ CLOUDINARY SANS QUE PLUS PERSONNE NE LES DEMANDE.

IL NE SUPPRIME RIEN TOUT SEUL. Il produit un RAPPORT : la liste des fichiers
presents chez l'hebergeur, celle des fichiers que les dossiers referencent
encore, et la difference — les orphelins. C'est cette liste qui se valide a la
main, et rien ne part avant.

POURQUOI. Jusqu'au 23/09/2026, « supprimer une video » retirait la ligne du
dossier et laissait le fichier chez Cloudinary pour toujours ; une photo de
progression transmise ne pouvait plus etre effacee passe les dix minutes du
delete_token. Le compte accumule donc des annees de fichiers que plus aucune
page ne demande. L'application sait maintenant demander leur destruction
(functions/index.js, cloudinaryDestroy) et tient une file de ce qu'elle n'a pas
pu detruire — mais cette fonction n'est PAS encore deployee : le projet est en
plan Spark. Tant qu'elle ne tourne pas, ce script est le seul outil qui voit
l'ensemble du compte, et il ne remplace pas le consentement de son proprietaire.

CE QU'IL LIT
  • Cloudinary, par l'API d'administration : tous les public_ids sous
    « repcore/ », images et videos. Cle et secret par variables
    d'environnement CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET (et
    CLOUDINARY_CLOUD_NAME, defaut dntu57ml) ;
  • les dossiers : un export JSON de la base temps reel — Console Firebase >
    Realtime Database > (menu) Exporter le JSON — passe en argument. C'est
    volontairement un FICHIER : brancher ce script sur la base en ecriture
    serait lui donner un pouvoir qu'il n'a pas besoin d'avoir.

CE QU'IL CROISE, cote dossiers — tout ce qui peut porter un public_id :
  videos[].cloudinaryPublicId, photosProgression.seances[].poses{}.publicId,
  photosProgression.aPurger[].publicId, et toute URL res.cloudinary.com trouvee
  ailleurs (memos audio du coach, photos de bilan partagees), dont on reconstruit
  l'identifiant. Un fichier reference par un dossier n'est JAMAIS un orphelin,
  meme s'il est dans aPurger : aPurger dit « a detruire », le rapport le range
  a part, sous son propre titre.

Usage :
  set CLOUDINARY_API_KEY=...   &  set CLOUDINARY_API_SECRET=...
  python scripts/purge_cloudinary_orphelins.py export-rtdb.json
  python scripts/purge_cloudinary_orphelins.py export-rtdb.json --rapport mon.txt

  --sans-cloudinary   n'interroge pas l'hebergeur : dit seulement ce que les
                      dossiers reclament et ce qu'ils declarent a purger.
"""
import base64
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

CLOUD = os.environ.get('CLOUDINARY_CLOUD_NAME', 'dntu57ml')
CLE = os.environ.get('CLOUDINARY_API_KEY', '')
SECRET = os.environ.get('CLOUDINARY_API_SECRET', '')
PREFIXE = 'repcore/'
TYPES = ('image', 'video')
# Une URL Cloudinary : .../<type>/upload/[v123/][transformations/]<public_id>.<ext>
RE_URL = re.compile(r'https?://res\.cloudinary\.com/[^/]+/(image|video)/upload/([^"\'\s)]+)')


def api(chemin, params):
    if not CLE or not SECRET:
        raise SystemExit('CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET sont requis '
                         '(ou --sans-cloudinary).')
    url = 'https://api.cloudinary.com/v1_1/%s/%s' % (CLOUD, chemin)
    if params:
        url += '?' + '&'.join('%s=%s' % (k, urllib.parse.quote(str(v), safe='')) for k, v in params.items())
    req = urllib.request.Request(url)
    jeton = base64.b64encode(('%s:%s' % (CLE, SECRET)).encode()).decode()
    req.add_header('Authorization', 'Basic ' + jeton)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        corps = e.read().decode('utf-8', 'replace')[:300]
        raise SystemExit('Cloudinary a repondu %s : %s' % (e.code, corps))


def lister_heberges():
    """Tous les public_ids sous repcore/, avec leur taille et leur date."""
    out = {}
    for t in TYPES:
        suite = None
        while True:
            p = {'prefix': PREFIXE, 'max_results': 500, 'type': 'upload'}
            if suite:
                p['next_cursor'] = suite
            d = api('resources/%s' % t, p)
            for r in d.get('resources', []):
                out[r['public_id']] = {
                    'type': t,
                    'octets': r.get('bytes', 0),
                    'cree': r.get('created_at', ''),
                    'format': r.get('format', ''),
                }
            suite = d.get('next_cursor')
            if not suite:
                break
            time.sleep(0.2)          # on ne bourrine pas l'API d'administration
    return out


def _id_depuis_url(chemin):
    """Retire la version, les transformations et l'extension."""
    bouts = chemin.split('/')
    # v1234567890 marque le debut du public_id ; avant, ce sont des transformations.
    for i, b in enumerate(bouts):
        if re.match(r'^v\d{6,}$', b):
            bouts = bouts[i + 1:]
            break
    else:
        # Pas de version : on retire les segments qui ressemblent a des
        # transformations (w_500, c_fill, f_auto/q_auto…).
        while bouts and re.match(r'^[a-z]{1,3}_[^/]+$', bouts[0]):
            bouts = bouts[1:]
    p = '/'.join(bouts)
    return re.sub(r'\.[A-Za-z0-9]{1,5}$', '', p)


def references(base):
    """Ce que les dossiers demandent encore, et ce qu'ils declarent a purger."""
    vivants, apurger = {}, {}
    users = (base or {}).get('users') or {}
    if isinstance(users, list):
        users = {str(i): u for i, u in enumerate(users) if u}
    for cle, u in users.items():
        if not isinstance(u, dict):
            continue
        qui = u.get('email') or u.get('id') or cle
        for v in (u.get('videos') or []):
            if isinstance(v, dict) and v.get('cloudinaryPublicId'):
                vivants.setdefault(v['cloudinaryPublicId'], []).append('%s · vidéo %s' % (qui, v.get('name') or ''))
        php = u.get('photosProgression') or {}
        for s in (php.get('seances') or []):
            if not isinstance(s, dict):
                continue
            for pose, x in (s.get('poses') or {}).items():
                if isinstance(x, dict) and x.get('publicId'):
                    vivants.setdefault(x['publicId'], []).append('%s · photo %s du %s' % (qui, pose, s.get('date')))
        for e in (php.get('aPurger') or []):
            if isinstance(e, dict) and e.get('publicId'):
                apurger.setdefault(e['publicId'], []).append('%s · déclaré à purger (%s, %s)'
                                                             % (qui, e.get('pose'), e.get('date')))
        # TOUTE AUTRE URL CLOUDINARY DU DOSSIER : memos audio, photos de bilan
        # partagees, et ce que j'aurais oublie. Un balayage du dossier entier
        # coute moins cher qu'une liste de chemins qui derive.
        try:
            brut = json.dumps(u, ensure_ascii=False)
        except Exception:
            brut = ''
        for t, chemin in RE_URL.findall(brut):
            pid = _id_depuis_url(chemin)
            if pid:
                vivants.setdefault(pid, []).append('%s · url dans le dossier' % qui)
    return vivants, apurger


def ko(n):
    return '%s Ko' % format(int(round(n / 1024.0)), ',d').replace(',', ' ')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    sans_cld = '--sans-cloudinary' in sys.argv
    sortie = None
    if '--rapport' in sys.argv:
        i = sys.argv.index('--rapport')
        if i + 1 < len(sys.argv):
            sortie = sys.argv[i + 1]
            if sortie in args:
                args.remove(sortie)
    if not args:
        raise SystemExit('Usage : python scripts/purge_cloudinary_orphelins.py <export-rtdb.json>'
                         ' [--rapport fichier.txt] [--sans-cloudinary]')
    with io.open(args[0], encoding='utf-8') as f:
        base = json.load(f)

    vivants, apurger = references(base)
    heberges = {} if sans_cld else lister_heberges()

    L = []
    W = L.append
    W('RAPPORT CLOUDINARY — %s' % time.strftime('%Y-%m-%d %H:%M'))
    W('compte %s, prefixe %s' % (CLOUD, PREFIXE))
    W('')
    W('CE QUE LES DOSSIERS DEMANDENT ENCORE : %d fichier(s)' % len(vivants))
    W('CE QUE LES DOSSIERS DECLARENT A PURGER : %d fichier(s)' % len(apurger))
    if sans_cld:
        W('')
        W("L'hebergeur n'a pas ete interroge (--sans-cloudinary) : pas de liste d'orphelins.")
    else:
        W('PRESENTS CHEZ L\'HEBERGEUR : %d fichier(s), %s'
          % (len(heberges), ko(sum(h['octets'] for h in heberges.values()))))
        orphelins = {k: v for k, v in heberges.items() if k not in vivants}
        # Un fichier declare a purger EST un orphelin, mais on le nomme
        # autrement : quelqu'un a demande sa suppression, et ne pas le dire
        # serait perdre l'information la plus utile du rapport.
        demandes = {k: v for k, v in orphelins.items() if k in apurger}
        muets = {k: v for k, v in orphelins.items() if k not in apurger}
        W('')
        W('── DEMANDES A LA SUPPRESSION PAR QUELQU\'UN (%d, %s) ─────────────────'
          % (len(demandes), ko(sum(h['octets'] for h in demandes.values()))))
        for k in sorted(demandes):
            W('  %-70s %-6s %10s  %s' % (k, demandes[k]['type'], ko(demandes[k]['octets']),
                                         '; '.join(apurger.get(k, []))[:80]))
        W('')
        W('── PLUS REFERENCES PAR AUCUN DOSSIER (%d, %s) ───────────────────────'
          % (len(muets), ko(sum(h['octets'] for h in muets.values()))))
        for k in sorted(muets):
            W('  %-70s %-6s %10s  cree %s' % (k, muets[k]['type'], ko(muets[k]['octets']),
                                              muets[k]['cree'][:10]))
        # ET L'INVERSE, qui compte autant : un dossier qui pointe sur un fichier
        # absent affiche une video morte. Ce n'est pas du stockage a gagner,
        # c'est un ecran casse.
        fantomes = {k: v for k, v in vivants.items() if k not in heberges}
        W('')
        W('── REFERENCES PAR UN DOSSIER MAIS ABSENTS DE L\'HEBERGEUR (%d) ──────' % len(fantomes))
        for k in sorted(fantomes):
            W('  %-70s %s' % (k, '; '.join(fantomes[k])[:90]))
        W('')
        W('RIEN N\'A ETE SUPPRIME. Pour effacer une ligne de ce rapport, la relire,')
        W('puis la donner a l\'application (elle passe par cloudinaryDestroy) ou la')
        W('supprimer depuis la console Cloudinary. Ce script ne detruit jamais.')

    texte = '\n'.join(L) + '\n'
    if sortie:
        with io.open(sortie, 'w', encoding='utf-8', newline='\n') as f:
            f.write(texte)
        print('rapport ecrit : %s (%d lignes)' % (sortie, len(L)))
    else:
        print(texte)


if __name__ == '__main__':
    main()
