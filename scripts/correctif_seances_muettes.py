# -*- coding: utf-8 -*-
"""
Correctif : « Modifier les exercices » / « Gerer le programme » ne font rien.

REJOUABLE ET IDEMPOTENT. Une session Claude Code parallele ecrivait le meme
app/index.html et a efface ce correctif une premiere fois ; ce script le
repose en un geste. Il ne fait rien s'il est deja applique.

    cd RepCore-web && python scripts/correctif_seances_muettes.py

Ce qu'il ferme, tout est silencieux et tout est reproduit au navigateur :

  1. Firebase RTDB ne rend un TABLEAU que si les clefs forment une suite
     pleine depuis 0, et il supprime toute valeur nulle. Une case tombee et
     sessions_config revient en OBJET {0:..., 3:...}. Trois lecteurs faisaient
     alors une methode de tableau dessus :
       - _seancesCoachRendre -> sc.some(), AVANT go(), dans une fonction async
         donc en rejet de promesse non traite : « Gerer le programme » ne fait
         RIEN, sans un mot ;
       - loadCoachSessionSlots -> sessions.map() : la grille de l'athlete
         PRECEDENT reste a l'ecran ;
       - loadSessionManager, cote athlete, meme cause.
  2. renderProgEx leve sur trois formes d'exercice (entree nulle, reps non
     textuelles, exercises non-tableau), et les trois editeurs montent leur
     ecran AVANT go() : l'exception remonte au clic et le bouton est muet.
  3. Deux gardes de ce chemin sortaient sans rien dire.
"""
import io, sys, os

CR = '\r\n'
BS = chr(92)
Q = chr(39)
CIBLE = 'app/index.html'

HELPERS = u'''// LES EXERCICES D'UNE SÉANCE, RENDUS RENDABLES.
//
// MÊME CLASSE DE BUG QUE _cptSeances juste en dessous, et même correctif.
// renderProgEx lève sur trois formes de données, et les TROIS éditeurs
// l'appellent AVANT go(). L'exception remonte donc jusqu'au clic : l'écran ne
// bouge pas, rien n'est écrit nulle part, et « Modifier les exercices »
// devient un bouton bien visible qui ne fait rien, sans un mot.
//
// Les trois formes, mesurées au navigateur :
//   • une entrée nulle dans le tableau — parseReps lit ex.reps sur null ;
//   • des reps qui ne sont pas du texte — isCardio fait .toLowerCase dessus ;
//   • un « exercises » qui n'est pas un tableau — _photographierProgEx fait
//     .map dessus, avant même le rendu.
//
// AUCUN CHEMIN D'ÉCRITURE DE L'APP NE LES PRODUIT : le champ reps n'est écrit
// qu'à un seul endroit, par un input, donc toujours en texte. Elles viennent
// du STOCKAGE ou d'un import ancien. On répare donc à la LECTURE : interdire
// une écriture qui n'existe déjà plus ne réparerait aucun dossier existant.
//
// RÉPARE EN MÉMOIRE, N'ENREGISTRE RIEN. C'est la règle de l'écran du coach :
// il valide par SAUVEGARDER, puis par PUBLIER. Rend le nombre d'entrées
// réparées — 0 quand il n'y avait rien à faire, et dans ce cas la séance
// n'est pas touchée du tout.
function _assainirExercices(seance){
  if(!seance||typeof seance!=='object') return 0;
  if(!Array.isArray(seance.exercises)){ seance.exercises=[]; return 0; }
  let repares=0;
  const propres=[];
  for(const ex of seance.exercises){
    if(!ex||typeof ex!=='object'||Array.isArray(ex)){ repares++; continue; }
    // `'reps' in ex` et non `ex.reps` : on ne CRÉE pas le champ chez un
    // exercice qui ne l'a jamais porté — son absence ne casse rien, tous les
    // lecteurs écrivent `(ex.reps||'')`. On ne réécrit que ce qui casse.
    if(('reps' in ex)&&typeof ex.reps!=='string'){
      ex.reps=(ex.reps==null)?'':String(ex.reps);
      repares++;
    }
    propres.push(ex);
  }
  if(propres.length!==seance.exercises.length) seance.exercises=propres;
  return repares;
}
// LA GRILLE DE SÉANCES, RENDUE PARCOURABLE.
//
// LE BUG QU'ELLE FERME, ET IL EST SILENCIEUX DE BOUT EN BOUT. Firebase RTDB
// ne stocke pas de tableaux : il stocke des objets à clefs numériques, et il
// ne rend un TABLEAU à la lecture que si les clefs forment une suite pleine
// à partir de 0. Une seule case tombée — Firebase supprime toute valeur
// nulle, et un jour de repos réduit à rien en est une — et le dossier
// revient avec `sessions_config` en OBJET, `{0:…, 3:…}`.
//
// Trois lecteurs faisaient alors une méthode de tableau sur un objet :
//   • _seancesCoachRendre → `sc.some(…)`, AVANT go() : le coach appuie sur
//     « Gérer le programme » et rien ne se passe. La fonction appelante est
//     `async`, donc l'exception part en rejet de promesse non traité — pas
//     même une ligne rouge visible selon le navigateur ;
//   • loadCoachSessionSlots → `sessions.map(…)` : l'écran s'ouvre mais la
//     grille n'est pas remplacée, et le coach lit les séances de l'athlète
//     PRÉCÉDENT en croyant lire celles de celui qu'il vient d'ouvrir ;
//   • loadSessionManager, côté athlète, pour la même raison.
//
// Et le dossier n'est pas abîmé pour autant : les séances sont toutes là,
// c'est leur EMBALLAGE qui a changé de forme en passant par le réseau. On le
// remet donc à l'endroit à la lecture, une fois, au plus près du dossier.
//
// GARANTIT SEPT CRÉNEAUX, comme _cptSeances le fait pour les modèles, et
// assainit chacun au passage. Rend le tableau, toujours.
//
// `rapport` est FACULTATIF : un objet dont .repares est incrémenté de ce qui a
// vraiment été réparé. L'appelant qui doit décider d'un enregistrement s'en
// sert au lieu de comparer deux sérialisations de la grille — celle-ci porte
// les photos de séance en base64, et la sérialiser deux fois à chaque
// ouverture d'écran coûterait plusieurs mégaoctets de travail pour rien.
function _normaliserSessionsConfig(dossier,rapport){
  const _noter=n=>{ if(rapport&&n) rapport.repares=(rapport.repares||0)+n; };
  if(!dossier||typeof dossier!=='object') return [];
  let cfg=dossier.sessions_config;
  if(!Array.isArray(cfg)){
    if(cfg&&typeof cfg==='object'){
      // Les clefs numériques REPRENNENT LEUR RANG : `{0:…,3:…}` redonne le
      // lundi et le jeudi, pas les deux premiers jours. Le jour est porté par
      // la POSITION dans toute l'app — DAYS[i], DAY_ICONS[i], l'index passé
      // aux boutons — et tasser les trous décalerait tout le programme d'un
      // athlète sans que rien ne le dise.
      const t=[];
      for(const k of Object.keys(cfg)){
        const i=parseInt(k,10);
        if(Number.isInteger(i)&&i>=0&&i<64) t[i]=cfg[k];
      }
      cfg=t;
    } else {
      cfg=[];
    }
    _noter(1);
  }
  DAYS.forEach((day,i)=>{
    if(!cfg[i]||typeof cfg[i]!=='object'){
      cfg[i]={day,name:'',photo:null,exercises:[],active:false,notes:'',warmup:''};
      _noter(1);
    }
    if(!cfg[i].day){ cfg[i].day=day; _noter(1); }
    _noter(_assainirExercices(cfg[i]));
  });
  // Au-delà des sept jours — un import ancien en portait parfois plus — on ne
  // JETTE rien : on assainit et on laisse. Supprimer une séance qu'un coach a
  // peut-être écrite serait une perte, et sept créneaux suffisent à l'écran.
  for(let i=DAYS.length;i<cfg.length;i++){
    if(!cfg[i]||typeof cfg[i]!=='object'){ cfg[i]={day:'',name:'',photo:null,exercises:[],active:false,notes:'',warmup:''}; _noter(1); }
    _noter(_assainirExercices(cfg[i]));
  }
  dossier.sessions_config=cfg;
  return cfg;
}
// CE QU'ON DIT QUAND L'ÉDITEUR NE S'OUVRE PAS.
//
// Les trois éditeurs montent leur écran — copie des exercices, champs du
// formulaire, contexte, titre, rendu — AVANT d'appeler go(). C'est voulu :
// entrer dans s-coach-program pour y trouver la séance précédente serait pire
// qu'un bouton qui ne répond pas. Mais tant que ce montage n'était protégé
// par rien, la moindre exception au milieu remontait jusqu'au gestionnaire de
// clic, et le bouton devenait muet.
//
// N'AVALE PAS L'ERREUR : la console garde la pile entière, le coach lit de
// quoi la rapporter.
function _echecOuvertureEditeur(e){
  try{ console.error("Ouverture de l'éditeur d'exercices impossible",e); }catch(_e){}
  try{ toast("Cette séance n'a pas pu être ouverte : "+((e&&e.message)||"erreur inconnue")
    +". Signale-le, la console en garde le détail.","var(--red)"); }catch(_e){}
}
'''

FILET_COACH = (u"  // TOUT LE MONTAGE EST SOUS FILET, et pas seulement le rendu : la copie" + CR +
               u"  // des exercices, les champs du formulaire, le titre et le rendu peuvent" + CR +
               u"  // chacun lever. Sans lui, l'exception remontait au gestionnaire de clic" + CR +
               u"  // et le bouton restait muet, quel que soit le maillon qui a cassé." + CR +
               u"  try{" + CR)

FILET_ATH = (u"  // TOUT LE MONTAGE EST SOUS FILET, comme dans les deux éditeurs du coach :" + CR +
             u"  // l'exception d'un seul maillon rendait le bouton muet." + CR +
             u"  try{" + CR)

RATTRAPE = u"  }catch(e){ return _echecOuvertureEditeur(e); }" + CR


def main():
    if not os.path.exists(CIBLE):
        sys.exit('Lance-moi depuis RepCore-web/ : %s introuvable.' % CIBLE)
    s = io.open(CIBLE, encoding='utf-8', newline='').read()

    if '_normaliserSessionsConfig' in s:
        print('Deja applique : rien a faire.')
        return

    modifs = []

    def rep(old, new, quoi):
        n = s.count(old)
        if n != 1:
            sys.exit('ANCRE INTROUVABLE (%d occurrences) pour %s :\n%s' % (n, quoi, old[:120]))
        modifs.append(quoi)
        return s.replace(old, new)

    # 1. Les trois helpers, juste avant le bloc de commentaire de _cptSeances.
    anc = u'// LES SEANCES D UN MODELE, PAR GENRE'
    s = rep(anc, HELPERS.replace('\r\n', '\n').replace('\n', CR) + anc, 'helpers')

    # 2. _cptSeances : assainir au lieu du seul test de tableau.
    s = rep(u"    if(!Array.isArray(t[i].exercises)) t[i].exercises=[];" + CR,
            u"    _assainirExercices(t[i]);" + CR, '_cptSeances')

    # 3. openCoachSessions : une exception dans une async part en rejet non traite.
    s = rep(u"  try{ await _proposerBrouillon(); }catch(e){}" + CR +
            u"  _seancesCoachRendre();" + CR,
            u"  try{ await _proposerBrouillon(); }catch(e){}" + CR +
            u"  // ELLE EST `async`, ET C'EST CE QUI RENDAIT LA PANNE INVISIBLE : une" + CR +
            u"  // exception dans _seancesCoachRendre ne remontait pas au clic, elle" + CR +
            u"  // partait en rejet de promesse non traité. Le coach appuyait sur" + CR +
            u"  // « Gérer le programme » et rien ne se passait — pas d'écran, pas de" + CR +
            u"  // message, et selon le navigateur pas même une ligne dans la console." + CR +
            u"  try{ _seancesCoachRendre(); }" + CR +
            u"  catch(e){" + CR +
            u'    try{ console.error("Ouverture des séances de l’athlète impossible",e); }catch(_e){}' + CR +
            u'    toast("Le programme de cet athlète n’a pas pu s’ouvrir : "+((e&&e.message)||"erreur inconnue")' + CR +
            u'      +". Signale-le, la console en garde le détail.","var(--red)");' + CR +
            u"  }" + CR, 'openCoachSessions')

    # 4. _seancesCoachPreparer : un garde qui sortait sans rien dire.
    s = rep(u"function _seancesCoachPreparer(){" + CR +
            u"  const c=getOwnedClient(currentClientId);" + CR +
            u"  if(!c) return false;" + CR,
            u"function _seancesCoachPreparer(){" + CR +
            u"  const c=getOwnedClient(currentClientId);" + CR +
            u"  // Ce garde sortait en silence, comme les autres de ce chemin : le coach" + CR +
            u"  // appuyait et rien ne se passait. Il se déclenche quand la fiche a été" + CR +
            u"  // ouverte puis le dossier remplacé par une synchronisation." + CR +
            u"  if(!c){" + CR +
            u"    try{ toast(" + Q + "Athlète introuvable : reviens à la liste et rouvre sa fiche." + Q +
            u"," + Q + "var(--orange)" + Q + "); }catch(_e){}" + CR +
            u"    return false;" + CR +
            u"  }" + CR, '_seancesCoachPreparer')

    # 5. _seancesCoachRendre : remettre la grille a l'endroit AVANT sc.some().
    s = rep(u"function _seancesCoachRendre(){" + CR +
            u"  const sc=_coachEditClient.sessions_config;" + CR,
            u"function _seancesCoachRendre(){" + CR +
            u"  // LA GRILLE REMISE À L'ENDROIT AVANT LA PREMIÈRE LECTURE. `sc.some` plus" + CR +
            u"  // bas est une méthode de TABLEAU, et Firebase rend parfois un OBJET :" + CR +
            u"  // elle levait alors ici, AVANT go(), et l'appelant est `async` — donc en" + CR +
            u"  // rejet de promesse non traité. Voir _normaliserSessionsConfig." + CR +
            u"  //" + CR +
            u"  // SEULEMENT SI QUELQUE CHOSE EST LÀ : sans cette condition, la grille" + CR +
            u"  // vide fabriquée ici passerait pour un programme, et la Fondation posée" + CR +
            u"  // juste en dessous ne le serait plus jamais pour un nouvel athlète." + CR +
            u"  if(_coachEditClient.sessions_config&&!Array.isArray(_coachEditClient.sessions_config))" + CR +
            u"    _normaliserSessionsConfig(_coachEditClient);" + CR +
            u"  const sc=_coachEditClient.sessions_config;" + CR, '_seancesCoachRendre')

    # 6. loadCoachSessionSlots : normaliser, et ne jamais laisser la grille du precedent.
    s = rep(u"  const c=_coachEditClient;" + CR +
            u"  if(!c?.sessions_config) return;" + CR +
            u"  const sessions=c.sessions_config;" + CR +
            u"  DAYS.forEach((day,i)=>{" + CR +
            u"    if(!sessions[i]) sessions[i]={day,name:'',photo:null,exercises:[],active:false,notes:'',warmup:''};" + CR +
            u"    if(!Array.isArray(sessions[i].exercises)) sessions[i].exercises=[];" + CR +
            u"  });" + CR,
            u"  const c=_coachEditClient;" + CR +
            u"  // LA GRILLE DU PRÉCÉDENT NE RESTE JAMAIS À L'ÉCRAN. Ce garde sortait sans" + CR +
            u"  // rien redessiner : le coach ouvrait l'athlète suivant et lisait encore" + CR +
            u"  // les séances de celui d'avant, en croyant lire les siennes. Vider est la" + CR +
            u"  // seule chose honnête à faire quand on n'a rien à montrer." + CR +
            u"  if(!c?.sessions_config){" + CR +
            u"    const _vide=document.getElementById('coach-session-slots');" + CR +
            u"    if(_vide) _vide.innerHTML='';" + CR +
            u"    return;" + CR +
            u"  }" + CR +
            u"  // Rend un TABLEAU de sept créneaux quoi qu'il arrive, même si Firebase a" + CR +
            u"  // rendu un objet : sans lui, le sessions.map plus bas levait et laissait," + CR +
            u"  // là encore, la grille du précédent en place." + CR +
            u"  const sessions=_normaliserSessionsConfig(c);" + CR, 'loadCoachSessionSlots')

    # 7. loadSessionManager, cote athlete.
    s = rep(u"  // Migration : garantir 7 slots avec toutes les propriétés requises" + CR +
            u"  let changed=false;" + CR +
            u"  DAYS.forEach((day,i)=>{" + CR +
            u"    if(!currentUser.sessions_config[i]){" + CR +
            u"      currentUser.sessions_config[i]={day,name:'',photo:null,exercises:[],active:false,notes:''};" + CR +
            u"      changed=true;" + CR +
            u"    }" + CR +
            u"    if(!Array.isArray(currentUser.sessions_config[i].exercises)){" + CR +
            u"      currentUser.sessions_config[i].exercises=[];" + CR +
            u"      changed=true;" + CR +
            u"    }" + CR +
            u"  });" + CR,
            u"  // Migration : sept créneaux, un TABLEAU même si Firebase a rendu un objet," + CR +
            u"  // et des exercices rendables. `repares` retient s'il y avait vraiment" + CR +
            u"  // quelque chose à réparer : lui seul déclenche l'enregistrement." + CR +
            u"  const _rapport={repares:0};" + CR +
            u"  _normaliserSessionsConfig(currentUser,_rapport);" + CR +
            u"  const changed=_rapport.repares>0;" + CR, 'loadSessionManager')

    # 8. Les trois editeurs : tout le montage sous filet.
    s = rep(u"  const s=c.sessions_config[idx];" + CR +
            u"  progEx=JSON.parse(JSON.stringify(s.exercises||[]));_photographierProgEx();" + CR,
            u"  const s=c.sessions_config[idx];" + CR + FILET_COACH +
            u"  _assainirExercices(s);" + CR +
            u"  progEx=JSON.parse(JSON.stringify(s.exercises||[]));_photographierProgEx();" + CR,
            'openCoachSessionExercises (ouverture)')
    s = rep(u"  if(title) title.textContent=(s.name||DAYS[idx])+' : Exercices';" + CR +
            u"  renderProgEx();go('s-coach-program');" + CR +
            u"  _progExDirty=false;" + CR + u"}" + CR,
            u"  if(title) title.textContent=(s.name||DAYS[idx])+' : Exercices';" + CR +
            u"  renderProgEx();go('s-coach-program');" + CR +
            u"  _progExDirty=false;" + CR + RATTRAPE + u"}" + CR,
            'openCoachSessionExercises (fermeture)')

    s = rep(u"  const s=sessions[idx];" + CR +
            u"  progEx=JSON.parse(JSON.stringify(s.exercises||[]));_photographierProgEx();" + CR,
            u"  const s=sessions[idx];" + CR + FILET_COACH +
            u"  _assainirExercices(s);" + CR +
            u"  progEx=JSON.parse(JSON.stringify(s.exercises||[]));_photographierProgEx();" + CR,
            'openProgTemplateSessionExercises (ouverture)')
    s = rep(u"  _progExDirty=false;" + CR + u"}" + CR + CR + u"// ─── Assignation ───",
            u"  _progExDirty=false;" + CR + RATTRAPE + u"}" + CR + CR + u"// ─── Assignation ───",
            'openProgTemplateSessionExercises (fermeture)')

    s = rep(u"  if(!cfg[idx]) return;" + CR +
            u"  if(!Array.isArray(cfg[idx].exercises)) cfg[idx].exercises=[];" + CR +
            u"  progEx=JSON.parse(JSON.stringify(cfg[idx].exercises));_photographierProgEx();" + CR,
            u"  if(!cfg[idx]) return;" + CR + FILET_ATH +
            u"  _assainirExercices(cfg[idx]);" + CR +
            u"  progEx=JSON.parse(JSON.stringify(cfg[idx].exercises));_photographierProgEx();" + CR,
            'openSessionExercises (ouverture)')
    s = rep(u"  renderProgEx();" + CR +
            u"  go('s-coach-program');" + CR +
            u"  _progExDirty=false;" + CR +
            u"  setTimeout(()=>{" + CR,
            u"  renderProgEx();" + CR +
            u"  go('s-coach-program');" + CR +
            u"  _progExDirty=false;" + CR + RATTRAPE +
            u"  setTimeout(()=>{" + CR,
            'openSessionExercises (fermeture)')

    io.open(CIBLE, 'w', encoding='utf-8', newline='').write(s)
    print('Correctif applique. %d points :' % len(modifs))
    for m in modifs:
        print('  - ' + m)


def tests():
    """Repose les verifications dans app/tests.js. Idempotent lui aussi."""
    p = 'app/tests.js'
    bloc_p = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          'correctif_seances_muettes_tests.js')
    if not os.path.exists(p) or not os.path.exists(bloc_p):
        print('tests.js ou le bloc de verifications est introuvable : rien de pose.')
        return
    lignes = io.open(p, encoding='utf-8', newline='').readlines()
    if any('OBJET par Firebase' in l for l in lignes):
        print('Verifications deja en place.')
        return
    # On se pose juste apres le test du premier tour, qui est deja commite.
    anc = [i for i, l in enumerate(lignes)
           if l.startswith("            currentUser=_sv;_coachEditClient=_se;_progEditorCtx=_sc; }})());")]
    if len(anc) != 1:
        print('ANCRE DES TESTS INTROUVABLE (%d) : pose le bloc a la main, il est dans %s'
              % (len(anc), bloc_p))
        return
    bloc = io.open(bloc_p, encoding='utf-8', newline='').read()
    bloc = bloc.replace('\r\n', '\n').replace('\n', CR)
    lignes.insert(anc[0] + 1, bloc)
    io.open(p, 'w', encoding='utf-8', newline='').write(''.join(lignes))
    print('Verifications posees dans app/tests.js.')


main()
tests()
