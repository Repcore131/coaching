// ══ LES CARTES DES CALCULS ALIMENTAIRES (build 1403) ══════════════════════
// Kevin, 22/09/2026, maquette a l'appui : « change la mise en page des
// tableaux comme l'image trois ». Chaque tableau devient une CARTE — pastille
// d'icone rouge, titre et sous-titre, lignes a icone, valeurs en cases, le
// resultat en rouge — et les macros passent en cinq cartes cote a cote.
// ⚠ LES TABLEAUX RESTENT DES <table> ET GARDENT LEUR <caption>, leurs id,
//   leurs data-m / data-cible et l'ordre de leurs cellules : tout ce qui les
//   relit (la suite de tests, saveClientNutriMacros, le calcul relu en
//   attribut) ne change pas. Seuls l'habillage et les icones s'ajoutent.
// Les pictogrammes qui manquaient au registre commun. Meme gabarit que
// ICONS (24 x 24, trait) : _tbkIco retombe sur ICONS pour les autres.
const TBK_ICO={
  poids:'<path d="M9 7a3 3 0 0 1 6 0"/><path d="M6.5 9h11l1.8 10.2a1.5 1.5 0 0 1-1.5 1.8H6.2a1.5 1.5 0 0 1-1.5-1.8z"/>',
  taille:'<line x1="12" y1="4" x2="12" y2="20"/><line x1="8" y1="4" x2="16" y2="4"/><line x1="8" y1="20" x2="16" y2="20"/>',
  course:'<circle cx="15" cy="4.5" r="1.8"/><path d="M8 21l3.2-5.2L14 17v4"/><path d="M11.2 15.8L12.5 10l-3.2 1.2L7.5 14"/><path d="M12.5 10l2.8 2.5H19"/>',
  calc:'<rect x="5" y="3" width="14" height="18" rx="2"/><rect x="8" y="6" width="8" height="3.5" rx=".5"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/>',
  canape:'<path d="M5 11V8.5A2.5 2.5 0 0 1 7.5 6h9A2.5 2.5 0 0 1 19 8.5V11"/><path d="M3 13.5a1.8 1.8 0 0 1 3.6 0V15h10.8v-1.5a1.8 1.8 0 0 1 3.6 0V18H3z"/><path d="M5 18v2M19 18v2"/>',
  sigma:'<path d="M17.5 5H6.5l6 7-6 7h11"/>',
  viande:'<path d="M15.4 3.6a5.2 5.2 0 0 1 0 7.4l-2.2 2.2a4.4 4.4 0 0 1-6.2-6.2l2.2-2.2a5.2 5.2 0 0 1 6.2-1.2z"/><path d="M8.6 15.4L5.2 18.8"/><circle cx="4.2" cy="19.8" r="1.6"/>'
};
function _tbkIco(n,taille){
  const p=TBK_ICO[n];
  if(!p) return icon(n,taille);
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" '
    +'stroke-linejoin="miter" style="width:'+taille+'px;height:'+taille+'px;display:inline-block;'
    +'vertical-align:middle;flex-shrink:0">'+p+'</svg>';
}
// Le libelle d'une ligne : l'icone dans sa case, puis le libelle et son aide.
// Le TEXTE de la cellule ne change pas — libelle puis aide —, seule
// l'enveloppe s'ajoute.
function _tbkLib(lbl,aide,ico){
  return '<span class="tbk-l">'
    +(ico?'<span class="tbk-ri" aria-hidden="true">'+_tbkIco(ico,16)+'</span>':'')
    +'<span class="tbk-lt">'+escapeHtml(lbl)
    +(aide?'<span class="tbk-aide">'+escapeHtml(aide)+'</span>':'')+'</span></span>';
}
// L'en-tete d'une carte : pastille d'icone, titre, sous-titre, et une
// etiquette a droite quand il y a lieu. C'est la <caption> du tableau.
function _tbkCap(ico,titre,sous,etiq){
  return '<caption><span class="tbk-cap">'
    +'<span class="tbk-cap-i" aria-hidden="true">'+_tbkIco(ico,19)+'</span>'
    +'<span class="tbk-cap-x"><span class="tbk-cap-t">'+escapeHtml(titre)+'</span>'
    +(sous?'<span class="tbk-cap-s">'+escapeHtml(sous)+'</span>':'')+'</span>'
    +(etiq?'<span class="tbk-cap-b">'+escapeHtml(etiq)+'</span>':'')
    +'</span></caption>';
}
function _tbkCarte(html,cls){
  return '<div class="tbk-carte'+(cls?' '+cls:'')+'">'+html+'</div>';
}
function _htmlTableauxTableur(c){
  let t=null;
  try{ t=cibleTableur(c,_tbOptsDe(c)); }catch(e){ return ''; }
  if(!t) return '';
  if(t.manque&&t.manque.length)
    return '<div style="background:var(--warning-bg);border:1px solid var(--warning-border);'
      +'border-radius:var(--r-3);padding:12px 14px;margin-bottom:14px;'
      +'font-size:var(--fs-xs);color:var(--text);line-height:1.6">'
      +escapeHtml('Calcul impossible : il manque '+t.manque.join(', ')
        +'. Rien n’est deviné : un chiffre inventé serait pire que pas de chiffre.')
      +'</div>';

  // ⚠ _cycT EST DECLAREE TOUT EN HAUT, et il le faut : TROIS tableaux la
  // lisent — les besoins (pour dire que leur total precede le cyclage), les
  // macros (pour ouvrir leur seconde colonne de saisie) et les journees.
  // Declaree plus bas, elle tombait dans la zone morte temporelle du `const` :
  // une ReferenceError qui coupe le rendu, pas une valeur fausse.
  const _cycT=(function(){ try{ return dieteCyclee(c); }catch(e){ return false; } })();
  const li=(lbl,val,aide,tot,ico)=>'<tr'+(tot?' class="tbk-tot"':'')+'><th>'+_tbkLib(lbl,aide,ico)
    +'</th><td>'+val+'</td></tr>';
  // Une valeur lue dans le dossier, dans sa case — elle ne se saisit pas ici.
  const vb=v=>'<span class="tbk-v">'+v+'</span>';
  const sel=(id,quoi,options,courant)=>'<select id="'+id+'" onchange="majTableauTableur(\''
    +quoi+'\',this.value)">'
    +options.map(o=>'<option value="'+escapeHtml(String(o.v))+'"'
      +(String(o.v)===String(courant)?' selected':'')+'>'+escapeHtml(o.lib)+'</option>').join('')
    +'</select>';
  // Meme enveloppe, mais les options viennent deja montees par
  // _optionsEchelle — qui pose lui-meme `selected`, la mention « suggere » et
  // la valeur hors bareme.
  const selEch=(id,quoi,optionsHtml)=>'<select id="'+id+'" onchange="majTableauTableur(\''
    +quoi+'\',this.value)">'+optionsHtml+'</select>';

  // ── TABLEAU 1 — LES FACTEURS ────────────────────────────────────────
  // Les trois premieres lignes ne se saisissent PAS : elles viennent du
  // dossier. Un poids retape a la main dans un coin finirait par contredire
  // la derniere pesee, et personne ne saurait laquelle fait foi.
  const _srcAge=(c&&c.birthdate)||_dernierChamp(c,'deb-birthdate')
    ? 'date de naissance' : 'âge saisi, pense à demander sa date de naissance';
  // ⚠ L'UNITE EST SUR LA VALEUR, PAS DANS LE LIBELLE. Kevin, 08/09/2026 :
  // « n'oublie pas de mettre les données, que ce soit centimètres, kilos, ans ».
  // « Poids en kg | 82 » oblige a relire l'intitule pour savoir ce que vaut le
  // nombre ; « Poids | 82 kg » se lit d'un coup, et c'est la valeur qu'on
  // parcourt du regard en descendant la colonne.
  let h='<table class="tbk">'+_tbkCap('user','Facteurs','Informations de base pour affiner ses besoins')+'<tbody>'
    +li('Poids',vb(_tbDec(t.poids)+' kg'),'dernière pesée enregistrée',false,'poids')
    +li('Taille',vb(_tbNb(t.taille)+' cm'),'premier bilan',false,'taille')
    +li('Âge',vb(_tbNb(t.age)+' ans'),_srcAge,false,'calendar')
    +li('Niveau d’activité hors sport',
        sel('tbk-naf','naf',NAF_ECHELLE.map(x=>({v:x.cle,lib:x.lib+nr(' (×'+String(x.f).replace('.',',')+')','')})),
          t.naf.cle),
        t.nafSource==='declare'?('déclaré par l’athlète dans son bilan'+(t.nafAlerte?' · '+NAF_ALERTE_METIER:''))
        :t.nafSource==='metier'?('déduit de « '+t.metier+' »')
          :(t.nafSource==='reglage'?'choisi par toi'
            :(t.metier?('« '+t.metier+' » non reconnue, choisis le niveau')
              :'aucune profession renseignée, choisis le niveau')),false,'course')
    // LA FORMULE DU METABOLISME, choisie ici (30/09/2026), l'ecart dit a cote.
    +li(nr('Formule du métabolisme','Méthode de calcul du métabolisme'),
        sel('tbk-formule','formuleMB',[
          {v:'',lib:'Auto · '+(nomsReels()?{harris:'Harris',mifflin:'Mifflin'}:{harris:'standard',mifflin:'prudente'})[(function(){ const x=Object.assign({},c,{nutrition:Object.assign({},c.nutrition||{},{tableur:Object.assign({},(c.nutrition||{}).tableur||{},{formuleMB:undefined})})}); return mbFormuleDe(x); })()]},
          {v:'harris',lib:mbNom('harris')},{v:'mifflin',lib:mbNom('mifflin')}],
          (((c.nutrition||{}).tableur||{}).formuleMB)||''),
        _htmlEcartFormules(t),false,'calc')
    +((currentUser&&currentUser.email===CREATOR_EMAIL)
      ?li('Noms réels des formules',
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="tbk-noms-reels" onchange="basculerNomsReels(this.checked)"'
            +(nomsReels()?' checked':'')+'> Afficher</label>',
          'Réservé à ton compte : les autres voient les libellés RepCore, jamais le nom des formules ni les coefficients.',false,'calc')
      :'')
    +li(nr('Coefficient d’objectif','Ajustement selon l’objectif'),
        sel('tbk-coef','coef',(OBJ_COEF_ECHELLE[t.phase]||[1]).map(v=>({v:v,
          lib:Math.round(v*100)+' % de la dépense'})),t.coef),
        (PHASES[t.phase]?PHASES[t.phase].lib:'Maintien')
          +' : s’applique au total avec le sport',false,'target')
    +'</tbody></table>';

  // ── TABLEAU 2 — LE SPORT ────────────────────────────────────────────
  // Repris du moteur existant, sans le recalculer : deux comptes du meme
  // sport finiraient par donner deux depenses.
  const dm=t.sportSemaine>0;
  // Mis de cote : il passe SOUS le duo Facteurs / Besoins, en pleine largeur —
  // c'est un releve a quatre colonnes, il ne tient pas dans une demi-largeur.
  let hSport='<table class="tbk tbk-4">'+_tbkCap('chart-bar','Dépense selon l’activité sportive',
      'Sa dépense énergétique liée à l’entraînement')
    +'<thead><tr><th>Discipline</th><th>Heures / sem.</th><th>Intensité</th><th>Dépense</th></tr></thead>'
    +'<tbody>';
  // ══ CHAQUE LIGNE SE REGLE (build 1405) ════════════════════════════════
  // Kevin : « donne la possibilité de rajouter un sport ou modifier heure et
  // intensité ». Le sport, les heures et l'intensite sont des champs ; la
  // croix retire la ligne ; « Ajouter un sport » en ouvre une a zero heure.
  // Les lignes sont CELLES QUE LE CALCUL COMPTE (kcalSportParJour().lignes),
  // chacune avec sa propre depense.
  // ⚠ LE TABLEAU MONTRAIT UNE SEULE LIGNE « Musculation » des qu'il y avait
  //   des creneaux, avec la depense de TOUS les sports dans sa case, et
  //   taisait les autres sports declares. Chaque sport a desormais sa ligne.
  const lignesSp=Array.isArray(t.sportLignes)?t.sportLignes:[];
  const spCoach=t.sportSource==='coach';
  const optSport=cur=>Object.keys(SPORTS_MET).filter(k=>k!=='Aucun')
    .concat(SPORTS_MET[cur]&&cur!=='Aucun'?[]:[cur])
    .map(k=>'<option value="'+escapeHtml(k)+'"'+(k===cur?' selected':'')+'>'
      +escapeHtml(k)+(SPORTS_MET[k]?'':' (hors barème)')+'</option>').join('');
  const optInt=cur=>SPORT_INTENSITES.map(x=>'<option value="'+x.cle+'"'+(x.cle===cur?' selected':'')+'>'
    +escapeHtml(x.lib)+'</option>').join('');
  hSport+=lignesSp.map((x,i)=>{
    const kh=(function(){ try{ return kcalHeureSport(String(x.sport),x.intensite,t.sportPoids); }catch(e){ return null; } })();
    const sem=(kh!=null)?Math.round(kh*Number(x.heures)):null;
    const aide=kh==null?'hors barème, choisis un sport'
      :(x.origine==='creneaux'?t.creneaux+' créneau'+(t.creneaux>1?'x':'')+' RepCore'
        :(x.origine==='bilan'?'déclaré au bilan':''));
    const nom=escapeHtml(String(x.sport));
    return '<tr class="tbk-sp"><th><span class="tbk-l"><span class="tbk-ri" aria-hidden="true">'
      +_tbkIco(_estMusculation(x.sport)?'haltere':'activity',16)+'</span><span class="tbk-lt">'
      +'<select class="tbk-sp-s" aria-label="Sport" onchange="majSportTableur('+i+',\'sport\',this.value)">'
      +optSport(String(x.sport))+'</select>'
      +(aide?'<span class="tbk-aide"'+(kh==null?' style="color:var(--orange)"':'')+'>'+escapeHtml(aide)+'</span>':'')
      +'</span></span></th>'
      +'<td style="text-align:left"><span class="tbk-sp-h"><input class="tbk-in tbk-sp-i" type="number" '
      +'min="0" max="60" step="0.5" inputmode="decimal" aria-label="Heures par semaine, '+nom+'" '
      +'value="'+escapeHtml(String(Number(x.heures)||0))+'" '
      +'onchange="majSportTableur('+i+',\'heures\',this.value)"><span>h</span></span></td>'
      +'<td style="text-align:left"><select class="tbk-sp-n tbk-sp-n-'+escapeHtml(String(x.intensite||'moderee'))+'" '
      +'aria-label="Intensité, '+nom+'" onchange="majSportTableur('+i+',\'intensite\',this.value)">'
      +optInt(x.intensite||'moderee')+'</select></td>'
      +'<td><span class="tbk-sp-d">'+(sem!=null?(_tbNb(sem)+' kcal')
        :'<span style="color:var(--orange);font-weight:700">hors barème</span>')+'</span>'
      +'<button type="button" class="tbk-sp-x" onclick="retirerSportTableur('+i+')" '
      +'aria-label="Retirer '+nom+'" title="Retirer ce sport">×</button></td></tr>';
  }).join('');
  if(!lignesSp.length)
    hSport+='<tr><th>'+_tbkLib(spCoach?'Aucun sport':'Aucune activité déclarée','','')
      +'</th><td></td><td></td><td>0 kcal</td></tr>';
  // L'AJOUT, et quand la liste est celle du coach, le retour a l'automatique.
  hSport+='<tr class="tbk-sp-add"><td colspan="4"><div class="tbk-sp-bas">'
    +'<button type="button" class="tbk-sp-plus" onclick="ajouterSportTableur()">+ Ajouter un sport</button>'
    +(spCoach?'<span class="tbk-sp-note">Réglés par toi : les créneaux RepCore et le bilan ne sont plus lus. '
      +'<button type="button" class="tbk-sp-auto" onclick="sportsTableurAuto()">Revenir au calcul automatique</button></span>'
      :'<span class="tbk-sp-note">Modifie une ligne ou ajoute un sport : la liste devient la tienne.</span>')
    +'</div></td></tr>';
  // LE LIBELLE PREND LES TROIS PREMIERES COLONNES : sur un tiers de la largeur
  // il se coupait en deux (« Dépense sportive / par jour »).
  hSport+='<tr class="tbk-tot"><th colspan="3">'+_tbkLib('Dépense sportive par jour','','zap')+'</th><td>'
    +_tbNb(t.sportJour)+' kcal</td></tr></tbody></table>';

  // ── TABLEAU 3 — LES BESOINS, LIGNE A LIGNE ──────────────────────────
  const libMB=t.mbSource==='katch'?nr('masse maigre mesurée (Katch-McArdle)','méthode RepCore, sur la masse maigre mesurée')
    :(t.mbSource==='harris'?nr('Harris-Benedict, poids taille âge sexe','méthode RepCore standard, poids taille âge sexe')
      :nr('Mifflin-St Jeor, poids taille âge sexe','méthode RepCore prudente, poids taille âge sexe'));
  // Le sous-titre NOMME LA FORMULE QUI A CALCULE, lue au meme endroit que la
  // premiere ligne : une maquette qui dirait « Harris-Benedict » pour un
  // calcul fait en Katch-McArdle mentirait.
  const nomMB=mbNom(t.mbSource);
  let hBesoins='<table class="tbk">'+_tbkCap('flame','Besoins caloriques',
      nr('Estimation basée sur la méthode '+nomMB,'Estimation : '+nomMB),'Estimation')+'<tbody>'
    +li('Besoins de base',_tbNb(t.mb)+' kcal',libMB
        +(t.correction!==1?' · corrigé de '+(t.correction>1?'+':'')
          +Math.round((t.correction-1)*100)+' % sur ta décision':''),false,'calc')
    +li('Besoins selon l’activité hors sport',_tbNb(t.horsSport)+' kcal',
        nr('base × '+String(t.naf.f).replace('.',',')+' : '+t.naf.lib.toLowerCase(),'niveau d’activité : '+t.naf.lib.toLowerCase()),false,'canape')
    +li('Besoins selon l’activité sportive',_tbNb(t.avecSport)+' kcal',
        '+ '+_tbNb(t.sportJour)+' kcal de sport par jour',false,'haltere')
    // ⚠ CETTE LIGNE N'EST PAS CE QUE L'ATHLETE MANGE UN JOUR D'ENTRAINEMENT,
    // et c'est exactement le piege que Kevin a releve le 08/09/2026 : il
    // comparait ce total au « APERCU · JOUR D'ENTRAINEMENT » du plan et
    // trouvait deux nombres. Le cyclage deplace ensuite les glucides de ±15 %
    // — le tableau « Journees », juste en dessous, donne les deux journees.
    // Un total qui ne dit pas qu'il est un total AVANT cyclage se fait
    // comparer a des chiffres d'apres.
    +li('Besoin selon l’objectif',_tbNb(t.brut)+' kcal',
        nr('× '+String(t.coef).replace('.',','),Math.round(t.coef*100)+' % de la dépense')
        +(_cycT?' · avant cyclage : voir « Journées » juste en dessous':''),true,'target')
    // LA LIGNE « SOUS LE PLANCHER DE SÉCURITÉ » EST RETIRÉE (Kevin, 27/09/2026) :
    //   « ça sert à rien comme indication, je veux pas avoir ça sous les yeux ».
    //   Elle citait un second total sous « Besoin selon l'objectif », et on ne
    //   savait plus lequel valait. Le total du jour est celui de « Journées ».
    +'</tbody>'
    // CE QUE DIT LA MAQUETTE, DIT AU COACH : ce sont des estimations. Une
    // formule de metabolisme se trompe de quelques centaines de kilocalories
    // d'une personne a l'autre — c'est la pesee qui tranche ensuite.
    +'<tfoot><tr><td colspan="2"><div class="tbk-note">'
    +'<span aria-hidden="true" style="display:flex;flex:0 0 auto">'+_tbkIco('info',16)+'</span>'
    +'<span>Ces valeurs sont des estimations : le métabolisme réel varie d’une personne '
    +'à l’autre et selon son mode de vie.</span></div></td></tr></tfoot>'
    +'</table>';
  // ⚠ LES FACTEURS ET LES BESOINS SE LISENT COTE A COTE, EN DEUX COLONNES.
  // Kevin, 08/09/2026 : « pour le poids, la taille, tu peux mettre ca sur une
  // colonne, et juste a cote me faire une deuxieme colonne avec les besoins
  // caloriques ». C'est la meme phrase du calcul lue dans les deux sens : a
  // gauche ce qu'on met dedans, a droite ce qui en sort. Empiles, il fallait
  // faire defiler pour verifier qu'un poids corrige avait bien bouge le total.
  // LA GRILLE RETOMBE SUR UNE COLONNE SOUS 700 px — voir .tbk-duo. Deux
  // tableaux de cinq lignes cote a cote sur un telephone rogneraient les
  // libelles jusqu'a l'illisible.
  // ── TABLEAU 4 — LES JOURNEES, ET LE CYCLAGE QUI LES COMMANDE ────────
  // (rendu a DROITE du sport : voir l'assemblage juste en dessous)
  // ⚠ IL A ETE SORTI DU TABLEAU DES MACROS le 08/09/2026. Kevin : « le total,
  // jour ON, jour OFF, tu me sautes une ligne, tu me mets ca dans un second
  // tableau avec la possibilite de mettre oui ou non ». Deux lignes de plus
  // sous les macros se lisaient comme deux macros de plus, alors qu'elles
  // disent autre chose : ce que le cyclage FAIT du total juste au-dessus.
  //
  // ET LE COMMUTATEUR EST DANS CE TABLEAU. Il vivait dans un menu deroulant
  // gris, quatre ecrans plus bas, loin des deux colonnes qu'il fait apparaitre
  // et disparaitre. Ici, on voit ce qu'on regle.
  //
  // SANS QUOI L'ECRAN MENTIRAIT PAR OMISSION : le bouton d'application cycle
  // les glucides de ±15 %, le tableau annoncait 3 139 et le dossier recevait
  // 3 360. Deux chiffres pour la meme decision, et le second n'apparaissait
  // nulle part.
  const _optCyc='<select id="tbk-cycle" onchange="saveClientNutriCycle(this.value)">'
    +'<option value="1"'+(_cycT?' selected':'')+'>Oui, jour ON et jour OFF</option>'
    +'<option value="0"'+(_cycT?'':' selected')+'>Non, mêmes valeurs tous les jours</option>'
    +'</select>';
  let hJournees='<table class="tbk tbk-jr">'+_tbkCap('calendar','Journées',
      'Ajustement de la répartition des glucides')+'<tbody>'
    +li('Cycler les glucides',_optCyc,
        '+'+Math.round(CYCLE_GLUC*100)
        +' % de glucides les jours d’entraînement, les jours de repos compensent : la semaine garde la cible',false,'refresh-cw')
    +(function(){
      // ⚠ LA JOURNEE ECRITE, PAS LE TOTAL AVANT ARRONDI. Mesure au banc a deux
      //   appareils : le tableau annoncait 3 411 kcal et l'athlete en recevait
      //   3 413 — les grammes sont arrondis, et la journee ecrite est recomptee
      //   depuis eux (_bloc). Deux chiffres pour la meme cible : on montre
      //   celui qui part.
      // SANS CYCLAGE, RIEN À AJOUTER ICI (Kevin, 27/09/2026 : « je n'arrive pas
      // à comprendre l'intérêt de le mettre là »). La ligne « Tous les jours »
      // répétait le total des Macronutriments, juste en dessous. Le tableau ne
      // montre des journées que quand elles diffèrent : jour ON, jour OFF.
      if(!_cycT) return '';
      let j=null; try{ j=_tbJournees(c,t,true); }catch(e){ j=null; }
      if(!j) return '';
      if(!j.cycle) return li('Journées','mêmes valeurs',
          (j.nOn>=7?'sept créneaux sur sept':'aucun créneau actif')+' : pas de jour à opposer',false,'calendar');
      return li('Jour ON',_tbNb(j.on.kcal)+' kcal',
          _tbNb(j.on.g)+' g de glucides, soit +'+j.pctOn+' % ('+j.nOn+' j)',true,'zap')
        +li('Jour OFF',_tbNb(j.off.kcal)+' kcal',
          _tbNb(j.off.g)+' g de glucides, soit −'+j.pctOff+' % ('+j.nOff+' j)',true,'moon');
    })()
    +'</tbody></table>';
  // ── L'ASSEMBLAGE ────────────────────────────────────────────────────
  // Demande de Kevin, 15/09/2026 : deux paires cote a cote, puis les macros.
  //   [ Facteurs | Besoins caloriques ]
  //   [ Depense selon l'activite sportive | Journees ]
  //   [ Macronutriments ]
  // Les deux paires disent la meme chose a deux niveaux : la premiere, ce
  // qu'on met dans le calcul et ce qui en sort ; la seconde, ce que le sport
  // ajoute et ce que le cyclage en fait. Empilees, il fallait defiler pour
  // relier les deux moities d'une meme phrase.
  // « Journees » ETAIT CONSTRUIT PLUS BAS, apres les macros. Il ne dependait
  // pourtant que de `t` et de `_cycT`, tous deux connus ici : le deplacer ne
  // change aucun calcul, seulement l'ordre du balisage.
  // LES DEUX GRILLES RETOMBENT SUR UNE COLONNE SOUS 700 px — voir .tbk-duo.
  h='<div class="tbk-duo">'+_tbkCarte(h)+_tbkCarte(hBesoins)+'</div>'
    +'<div class="tbk-duo tbk-duo-l">'+_tbkCarte(hSport)+_tbkCarte(hJournees)+'</div>';

  // ── TABLEAU 5 — LES MACROS, PLEINE LARGEUR ──────────────────────────
  let selG=null;
  try{ selG=cibleSodiumJour(c,localISODate(new Date()),
    {kcal:t.kcal,p:t.p,c:t.g,l:t.l}); }catch(e){ selG=null; }
  // ⚠ LES ECHELLES PAR ATHLETE, ET NON DEUX LISTES EN DUR. Ce tableau porte
  // desormais LE SEUL selecteur de g/kg — celui de « Point de depart » a ete
  // retire le 08/09/2026 — et il doit donc offrir ce que l'autre offrait :
  //   • protEchelle(c) et NON PROT_ECHELLE : l'echelle se decale vers le haut
  //     sous protocole partage, jusqu'a 3,0 g/kg. Figee sur la constante, la
  //     borne haute disparaissait pour les athletes concernees.
  //   • LIP_ECHELLE et NON [1.2 … 0.6] : la borne 1,5 manquait a la liste en
  //     dur, et c'est precisement celle qu'on va chercher.
  // ON REPREND _optionsEchelle TELLE QUELLE, et non une liste refabriquee :
  // elle porte deux comportements qu'on perdrait a la reecrire —
  //   • une valeur enregistree HORS BAREME reste offerte, marquee comme telle.
  //     Sans elle, aucune option n'est selectionnee et le coach lit un reglage
  //     qui n'est pas celui qui calcule ;
  //   • la valeur SUGGEREE porte sa mention. Les bonnes valeurs offertes avec
  //     la mauvaise suggestion, c'est le contraire du travail fait sur les
  //     echelles decalees.
  // Le suffixe des lipides les distingue des proteines dans le meme ecran :
  // deux listes de « g/kg » cote a cote ne se departagent pas autrement.
  const _phS=(function(){ try{ return typePhase(c); }catch(e){ return null; } })();
  const _sugProt=(function(){ try{ return protSuggeree(c,_phS); }catch(e){ return undefined; } })();
  const echProt=_optionsEchelle(protEchelle(c),t.protGkg,' g/kg',_sugProt);
  const echLip=_optionsEchelle(LIP_ECHELLE,t.lipGkg,' g/kg lip.',
    (function(){ try{ return lipSuggere(c); }catch(e){ return undefined; } })());
  // ⚠ CHAQUE MACRO PORTE SA COULEUR, ET C'EST UNE DEMANDE PRECISE de Kevin,
  // 08/09/2026 : « la ligne protéines vraiment rouge, la ligne lipides en vert,
  // glucides en jaune, fibres dans un vert un peu plus tiré marron, et le sel
  // sur un gris ». Ce ne sont pas quatre teintes decoratives : le coach lit ce
  // tableau en diagonale et vise UNE ligne, celle qu'il vient regler. Un
  // tableau monochrome de six lignes oblige a lire les six libelles.
  // La couleur voyage par --tbk-c, que .tbk-c th lit — pas de style en ligne
  // repete six fois.
  //
  // ══ ET LA SAISIE MANUELLE VIT ICI DEPUIS LE 08/09/2026 ═════════════════
  // Kevin : « donne la possibilité de cliquer sur manuel et changer soi-même
  // les infos, avec un curseur on/off ». Elle vivait dans un SECOND jeu de
  // cinq champs, trois ecrans plus bas, qui redisait les memes cibles : le
  // coach lisait 242 g ici et tapait 285 la-bas, sans que rien ne relie les
  // deux. Le commutateur et les champs sont maintenant DANS le tableau qu'ils
  // remplacent — on regle la ligne qu'on regarde.
  //
  // LES IDENTIFIANTS NE CHANGENT PAS : saveClientNutriMacros lit ccd-on-* et
  // ccd-off-* par leur id, et le mecanisme n'est pas touche.
  const _man=(function(){ try{ return saisieManuelle(c); }catch(e){ return false; } })();
  const _mac=((c&&c.nutrition&&c.nutrition.macros)||{});
  const _mOn=_mac.on||{}, _mOff=_mac.off||{};
  // ⚠ LA CELLULE PORTE LA CIBLE CALCULEE EN ATTRIBUT, et pas seulement en
  // texte. En saisie manuelle la valeur affichee est celle que le coach a
  // tapee ; le CALCUL, lui, reste ce que ce tableau existe pour montrer. Un
  // lecteur — la suite de tests, ou n'importe quel code futur — doit pouvoir
  // le relire sans deviner un format d'affichage, qui change avec la langue et
  // avec l'espace insecable des milliers.
  const liC=(coul,lbl,val,aide,tot,val2,cle,cible,ico)=>'<tr class="tbk-c'+(tot?' tbk-tot':'')
    +'" style="--tbk-c:'+coul+'"><th>'+_tbkLib(lbl,aide,ico)
    +'</th><td'+(cle?(' data-m="'+cle+'" data-cible="'+(cible==null?'':escapeHtml(String(cible)))+'"'):'')
    +'>'+val+'</td>'+(_man&&_cycT?('<td>'+(val2||'')+'</td>'):'')+'</tr>';
  // Un champ de saisie de macro. `min` a 0 : une cible negative n'existe pas,
  // et controlerMacros refuserait de toute facon — autant que le clavier du
  // telephone ne propose meme pas le signe.
  const _in=(id,v)=>'<input class="tbk-in" id="'+id+'" type="number" min="0" inputmode="numeric" '
    +'value="'+((v===undefined||v===null||v==='')?'':escapeHtml(String(v)))+'">';
  // LE COMMUTATEUR EST LA PREMIERE LIGNE DU TABLEAU. C'est lui qui decide de
  // ce que les cinq suivantes montrent : le mettre en dessous obligerait a le
  // chercher apres avoir constate que les champs ne repondent pas.
  const _swi='<label class="tbk-swi"><input type="checkbox"'+(_man?' checked':'')
    +' onchange="saveClientNutriManuel(this.checked)"><span class="tbk-swi-p"></span></label>';
  // LES CINQ MACROS EN CARTES (build 1403) : .tbk-mac les range en grille, le
  // commutateur remonte a droite de l'en-tete quand la carte est large.
  // mv : la valeur, en grand ; mi : un champ de saisie.
  const mv=v=>'<span class="tbk-mv">'+v+'</span>';
  // LE TOTAL CALORIQUE EST LA SOMME DES GRAMMES AFFICHES : sans cyclage, la
  // journee meme qui part chez l'athlete ; avec, la base avant cyclage, dont
  // « Journées » donne les deux jours. t.kcal, avant l'arrondi des grammes,
  // s'en ecartait de une a deux kilocalories.
  const totK=(function(){
    try{
      if(!_cycT){ const j=_tbJournees(c,t,false); if(j&&j.on&&isFinite(j.on.kcal)) return j.on.kcal; }
      const b=_bloc(t.p,t.l,t.g); if(b&&isFinite(b.kcal)) return b.kcal;
    }catch(e){}
    return t.kcal;
  })();
  const mi=v=>'<div class="tbk-mi">'+v+'</div>';
  // LES DEUX BOUTONS DE ±20, sur la ligne du total et de ce cote-ci aussi
  // (build 1412). Le meme pas, le meme champ et le meme ecrivain que le ±20
  // de l'athlete : voir appliquerDeltaKcal.
  const _d20='<span class="tbk-d20">'
    +'<button type="button" class="tbk-d20-b" onclick="tbkDelta(-1)" aria-label="Vingt calories de moins">−20</button>'
    +'<button type="button" class="tbk-d20-b" onclick="tbkDelta(1)" aria-label="Vingt calories de plus">+20</button>'
    +(libelleAjustKcal(c)?'<span class="tbk-d20-l">Mis à jour : '+libelleAjustKcal(c)+'</span>':'')
    +'</span>';
  h+=_tbkCarte('<table class="tbk tbk-mac'+(_man&&_cycT?' tbk-man':'')+'">'
    +_tbkCap('utensils','Macronutriments','Répartition de ses apports journaliers')
    +(_man&&_cycT?'<thead><tr><th></th><th>Jour ON</th><th>Jour OFF</th></tr></thead>':'')
    +'<tbody>'
    +'<tr class="tbk-c tbk-swi-r" style="--tbk-c:'+(_man?'#f59e0b':'var(--border)')+'"><th>'
      +_tbkLib('Saisie manuelle',_man
        ?'Tes chiffres priment : ils ne bougeront plus si tu changes les g/kg ou la vitesse.'
        :'Les cibles se recalculent seules. Bascule pour les écrire toi-même.')
      +'</th><td'+(_man&&_cycT?' colspan="2"':'')+'>'+_swi+'</td></tr>'
    // ⚠ LE MENU DE g/kg RESTE AFFICHE EN SAISIE MANUELLE, et ce n'est pas un
    // detail : saisieManuelle() rend VRAI des qu'un dossier porte des macros,
    // meme sans drapeau explicite — donc pour presque tous les athletes
    // existants. Le cacher dans ce mode aurait fait disparaitre le reglage du
    // calcul pour la quasi-totalite des dossiers.
    // ET C'EST LA BONNE LECTURE DE TOUTE FACON : le menu dit ce que le CALCUL
    // utilise, le champ dit ce que le coach IMPOSE. Voir les deux cote a cote,
    // c'est voir de combien on s'ecarte du calcul.
    +liC('#ff2d3f','Protéines',
        selEch('tbk-prot','protGkg',echProt)
          +(_man?mi(_in('ccd-on-p',_mOn.p)):mv(_tbNb(t.p)+' g')),
        _man?('le calcul donnerait '+_tbNb(t.p)+' g : tes chiffres priment')
            :(String(t.protGkg).replace('.',',')+' g par kilo de poids de corps'),
        false,_in('ccd-off-p',_mOff.p),'p',t.p,'viande')
    +liC('#22c55e','Lipides',
        selEch('tbk-lip','lipGkg',echLip)
          +(_man?mi(_in('ccd-on-l',_mOn.l)):mv(_tbNb(t.l)+' g')),
        _man?('le calcul donnerait '+_tbNb(t.l)+' g : tes chiffres priment')
            :(String(t.lipGkg).replace('.',',')+' g par kilo, plancher '
              +String(LIP_PLANCHER_G_KG).replace('.',',')+' g/kg'),
        false,_in('ccd-off-l',_mOff.l),'l',t.l,'droplet')
    +liC('#f5c518','Glucides',_man?_in('ccd-on-g',_mOn.g):mv(_tbNb(t.g)+' g'),
        _man?('en grammes, écrits par toi · le calcul donnerait '+_tbNb(t.g)+' g')
            :'ce qui reste une fois protéines et lipides posés',
        false,_in('ccd-off-g',_mOff.g),'g',t.g,'wheat')
    +liC('#7f9f4e','Fibres',_man?_in('ccd-on-f',_mOn.f):mv(_tbNb(t.f)+' g'),
        FIBRES_PAR_1000+' g pour 1 000 kcal',false,_in('ccd-off-f',_mOff.f),'f',t.f,'leaf')
    // LE SEL RESTE CALCULE, MEME EN MANUEL : il sort du moteur sodique, qui
    // derive d'un poids et d'un climat, pas d'une decision de repartition.
    // Rien a taper, donc rien a ouvrir.
    +liC('#9aa0a6','Sel',mv(selG?(_tbDec(selG.targetSaltG)+' g'):'-'),
        selG?'cible du moteur sodique':'cible indisponible',false,'',undefined,undefined,'salt')
    +liC('var(--red)','Total calorique',
        (_man?_in('ccd-on-kcal',_mOn.kcal):mv(_tbNb(totK)+' kcal'))+_d20,
        (_man?('en kilocalories, écrites par toi · le calcul donnerait '+_tbNb(totK))
            :(_tbNb(t.p)+' g de protéines · '+_tbNb(t.g)+' g de glucides · '
              +_tbNb(t.l)+' g de lipides'))
        // ⚠ LES DEUX JOURNEES SOUS LE TOTAL (24/09/2026). Avec cyclage, ce
        //   total est la base AVANT cyclage : il ne correspond a AUCUN jour de
        //   son assiette. Sa carte, elle, affiche la journee du jour. Sans ces
        //   deux chiffres ici, les deux ecrans se contredisent a l'oeil.
        +((function(){
          if(!_cycT) return '';
          try{
            const j=_tbJournees(c,t,true);
            if(!j||!j.on||!j.off) return '';
            return ' · jour d’entraînement '+_tbNb(j.on.kcal)
              +' kcal, jour de repos '+_tbNb(j.off.kcal)+' kcal';
          }catch(e){ return ''; }
        })()),
        true,_in('ccd-off-kcal',_mOff.kcal),'kcal',totK,'zap')
    +'</tbody></table>','tbk-mac-c');
  // Le poids de référence, les glucides très bas, le total dépassé (30/09/2026).
  h+=_htmlAlertesMacros(t,'coach');
  // LE BOUTON D'ENREGISTREMENT N'EXISTE QU'EN MANUEL. En automatique, ce sont
  // « Appliquer à l'athlète » et « Enregistrer les réglages », plus bas, qui
  // font le travail ; un troisieme bouton qui ecrirait la meme chose par un
  // autre chemin serait un troisieme comportement a comprendre.
  // ⚠ « PROPOSER UN POINT DE DEPART » A ETE RAMENE ICI le 08/09/2026. Il
  // vivait dans _htmlDepartCoach, retiree avec le curseur de vitesse — et il
  // serait parti avec elle sans un mot. Or il ne fait pas double emploi : il
  // PRE-REMPLIT les champs de saisie manuelle avec la proposition calculee,
  // que le coach corrige ensuite. Sa place est donc contre ces champs, pas
  // trois ecrans plus bas, et il ne s'offre qu'en manuel : en automatique il
  // remplirait des cases avec ce qu'elles portent deja.
  // ⚠ L'ENREGISTREMENT PASSAIT DEVANT DEPUIS LE 15/09/2026 — IL EST PASSE
  // DERRIERE le 22/09/2026 (build 1409, plus bas). Ce qui n'a pas change :
  // il est CENTRE SUR SA PROPRE LIGNE et il est le seul rouge. « Proposer un
  // point de depart », lui, se fait AVANT de remplir : il pre-remplit les
  // cases, et il ne s'offre qu'en manuel.
  // ══ TROIS BOUTONS, PLUS QUATRE (build 1408) ══════════════════════════
  // Kevin : « il y a trop de boutons similaires ». « Enregistrer ces
  // chiffres », « Enregistrer les réglages » et « Enregistrer pour l'athlète »
  // faisaient tous les trois la meme promesse ; il n'en reste qu'un, qui
  // attend la reponse du serveur et dit si l'athlete a recu. Les deux autres
  // ne s'enregistrent pas : ils proposent, et ils racontent.
  // ══ LES TROIS BLANCS SUR UNE LIGNE, LE ROUGE DESSOUS (build 1409) ═════
  // Kevin, 22/09/2026, capture a l'appui : « le bouton enregistrer et
  // transmettre a l'athlete doit se retrouver en bas des 4 boutons, les 3
  // autres se retrouvent en haut en blanc sur la meme ligne ».
  // LA REMISE AU POINT DE DEPART REMONTE DONC ICI : elle vivait dans
  // _reglages, sous les alertes, et elle etait rouge (build 1404). Les quatre
  // boutons se suivaient a l'ecran sans se ressembler — deux rouges, deux
  // blancs, quatre lignes. Ils forment maintenant un seul groupe : ce qui
  // PROPOSE, RACONTE ou DEFAIT en haut, en blanc, cote a cote ; ce qui
  // ENREGISTRE en dessous, seul et rouge. Le garde-fou de la remise reste sa
  // confirmation dans reinitialiserCalculs, pas sa couleur.
  const _nbH=histoCibles(c).length;
  h+='<div class="tbk-trio">'
    +(_man?('<button type="button" class="btn btn-outline tbk-trio-b" '
      +'onclick="proposerPointDepart()">Proposer un point de départ</button>'):'')
    +'<button type="button" class="btn btn-outline tbk-trio-b tbk-h-b" aria-expanded="'
      +(_histoOuvert?'true':'false')+'" onclick="basculerHistoTableur()">'
      +'Historique des modifications'+(_nbH?' ('+_nbH+')':'')+'</button>'
    +'<button type="button" class="btn btn-outline tbk-trio-b" '
      +'onclick="reinitialiserCalculs()">Remettre les calculs au point de départ</button>'
    +'</div>'
    +(_histoOuvert?_htmlHistoTableur(c):'')
    +'<button type="button" class="btn btn-red tbk-save-c" '
    +'onclick="enregistrerEtTransmettre()">Enregistrer et transmettre à l’athlète</button>';



  // ⚠ LA VITESSE VISEE A ETE RETIREE DE L'ECRAN le 08/09/2026, et c'est le
  // correctif de fond de ce lot. Kevin : « le seul calcul a prendre en compte
  // est celui-la », en montrant ces tableaux.
  //
  // ELLE N'ETAIT PAS UN AFFICHAGE DE PLUS, C'ETAIT UN SECOND MOTEUR.
  // besoinsProposes porte DEUX chemins : avec `opts.vitesse`, la cible vaut
  // « depense + deltaKcalJour(vitesse, poids) » ; sans, elle vaut
  // « depense x coefficient d'objectif » — celui de ces tableaux. Or
  // _propReglages passait TOUJOURS une vitesse : le curseur, ou le milieu de
  // la fourchette a defaut. Le chemin du coefficient n'etait donc jamais pris,
  // et l'ecran affichait un total que le dossier ne recevait pas.
  // C'est le troisieme et dernier ecart de la serie, apres le palier de
  // periodisation et le retard de la copie enregistree.
  //
  // LA FOURCHETTE DE VITESSE N'EST PAS SUPPRIMEE POUR AUTANT : cibleVitesse
  // continue de piloter les alertes de poids et le suivi de l'athlete. Ce qui
  // disparait, c'est son role d'ENTREE du calcul des cibles.

  // ⚠ « ENREGISTRER LES REGLAGES » ET « ENREGISTRER POUR L'ATHLETE » ONT ETE
  //   FONDUS DANS « ENREGISTRER ET TRANSMETTRE » le 22/09/2026 (build 1408).
  //   Kevin : « il y a trop de boutons similaires ». Les trois disaient la
  //   meme chose — j'enregistre — et aucun ne disait ce que le coach veut
  //   savoir : est-ce que c'est ARRIVE. Le bouton unique attend la reponse du
  //   serveur, et la ligne verte ci-dessous garde la date du dernier envoi
  //   confirme. En automatique, chaque menu ecrit et pousse toujours de
  //   lui-meme : la note verte le dit, juste en dessous.
  // LA DERNIERE TRANSMISSION CONFIRMEE, dite en clair : c'est la preuve que
  // Kevin demande — non pas « j'ai cliqué », mais « c'est parti, et le serveur
  // l'a pris ».
  const _tr=(function(){ try{ return _transmisLire()[c.email]||null; }catch(e){ return null; } })();
  if(_tr&&_tr.d>0) h+='<div class="tbk-tr">'+icon('check',14)
    +'<span>Transmis le '+escapeHtml(_histoDate(_tr.d))
    +(_tr.kcal>0?(', '+_tbNb(_tr.kcal)+' kcal'):'')+'</span></div>';
  h+=_man
    ? ''
    // ON DIT LE DELAI PLUTOT QUE « immédiatement ». La modification part a
    // l'instant ; l'application de l'athlete, elle, releve toutes les cinq
    // minutes et des qu'elle revient au premier plan. Promettre l'instantane
    // ferait douter du reste le jour ou elle mettrait deux minutes.
    : '<div style="display:flex;align-items:center;gap:10px;background:var(--surface-2);'
      +'border:1px solid var(--border);border-left:1px solid var(--border);'
      +'border-radius:var(--r-3);padding:10px 12px;font-size:var(--fs-2xs);'
      +'line-height:1.55;color:var(--sub)">'
      +'<span style="color:var(--green);flex:0 0 auto;display:flex">'+icon('check',15)+'</span>'
      +'<span>Chaque réglage ci-dessus part vers ton athlète dès que tu le changes, '
      +'en diète flexible comme en stricte. Son application les reçoit à sa prochaine '
      +'ouverture, et au plus tard dans les cinq minutes si elle est ouverte.</span>'
      +'</div>';
  return h;
}
// La date d'une ligne d'historique : « 22 sept. 18:41 ».
function _histoDate(d){
  try{
    const x=new Date(Number(d)||0);
    return x.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})
      +' '+x.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  }catch(e){ return ''; }
}
// LE PANNEAU D'HISTORIQUE. Kevin : le nombre de calories en gros, la date
// entre parentheses a cote, en dessous glucides, proteines et lipides, et de
// quoi remettre un ancien enregistrement en place — en pouvant annuler.
function _htmlHistoTableur(c){
  const l=histoCibles(c);
  const cyc=(function(){ try{ return dieteCyclee(c); }catch(e){ return false; } })();
  const cur=_histoBloc(((c.nutrition||{}).macros||{}).on||{});
  const annul=(_histoAnnul&&_histoAnnul.email===c.email)
    ? '<div class="tbk-h-an"><span>Remis en place : '+_tbNb(_histoAnnul.remis)+' kcal.</span>'
      +'<button type="button" class="tbk-h-x" onclick="histoAnnuler()">Annuler et revenir à l’état précédent</button></div>'
    : '';
  if(!l.length) return '<div class="tbk-histo">'+annul
    +emptyState('','Aucun enregistrement pour l’instant : les cibles enregistrées s’ajouteront ici, '
    +'et tu pourras en remettre une en place.',null,null,'padding:12px 0')+'</div>';
  // UNE SEULE LIGNE PORTE « EN COURS » : la plus recente qui a ces chiffres.
  // Deux lignes identiques — une remise en place puis son annulation — se
  // presentaient toutes les deux comme la cible du moment.
  let iCur=-1;
  for(let k=l.length-1;k>=0;k--) if(JSON.stringify(l[k].on)===JSON.stringify(cur)){ iCur=k; break; }
  const lignes=l.map((e,i)=>({e,i})).reverse().map(({e,i})=>{
    const enCours=(i===iCur);
    return '<div class="tbk-h-e'+(enCours?' tbk-h-cur':'')+'">'
      +'<div class="tbk-h-t"><span class="tbk-h-k">'+_tbNb(e.on.kcal)+' kcal</span>'
      +'<span class="tbk-h-d">('+escapeHtml(_histoDate(e.d))+')</span>'
      +(enCours?'<span class="tbk-h-b2">en cours</span>':'')
      +(e.src==='transmis'?'<span class="tbk-h-b3">transmis</span>':'')+'</div>'
      +'<div class="tbk-h-m">Glucides '+_tbNb(e.on.g)+' g · Protéines '+_tbNb(e.on.p)
      +' g · Lipides '+_tbNb(e.on.l)+' g'
      +(cyc&&e.off.kcal!==e.on.kcal?(' · jour OFF '+_tbNb(e.off.kcal)+' kcal'):'')+'</div>'
      +(enCours?'':'<button type="button" class="tbk-h-r" onclick="histoRemettre('+i+')">Remettre en place</button>')
      +'</div>';
  }).join('');
  return '<div class="tbk-histo">'+annul+lignes+'</div>';
}
/**
 * PURE. La grille du coach est-elle CONFIGUREE ?
 *
 * ⚠ UNE SEULE CLEF REPOND, ET C'EST `naf`. Le reflexe serait de lire aussi
 *   `protGkg`, `lipGkg` ou `coef` : ce serait faux, et dangereusement. Depuis
 *   le build 1330 les deux g/kg sont PARTAGES — `athGkg` les ecrit depuis
 *   l'ecran de l'athlete — et `coef` l'est depuis le 07/09, `athObjectif`
 *   l'ecrivant quand elle choisit « Seche ». Les compter ici aurait fait
 *   passer SES reglages pour une grille de coach, et verrouille hors de sa
 *   propre carte une athlete que personne n'avait jamais reglee.
 *
 *   `naf` — le niveau d'activite — n'est ecrit que par `majTableauTableur`,
 *   sur la fiche du coach. Il ne
 *   figure pas dans `manque` : le calcul tourne sans lui, avec un defaut.
 *   C'est donc bien un CHOIX, pas un passage oblige — et le poser, c'est dire
 *   « j'ai regle cette athlete ».
 * @param {any} c
 */
function grilleCoachPosee(c){
  const naf=(((c&&c.nutrition&&c.nutrition.tableur)||{}).naf);
  return naf!=null&&naf!=='';
}
/**
 * Remet les cibles ecrites en accord avec la grille du coach, a l'ouverture de
 * sa fiche. Rend true si quelque chose a bouge.
 *
 * ⚠ POURQUOI A L'OUVERTURE, ET PAS SEULEMENT AU GESTE. Kevin, 20/09/2026 :
 *   « toujours pas les memes prot, glucides et lipides qui s'affichent ».
 *   Mesure faite sur son cas, au banc : sa grille portait deja 1,9 g/kg — son
 *   tableau affichait donc 192 / 81 / 367 — pendant que `nutrition.macros`
 *   tenait encore le bloc que l'athlete avait ecrit la veille, 222 / 81 / 616.
 *   SES ANNEAUX LISAIENT CELUI-LA. Depuis le build 1317 chaque menu du tableur
 *   ecrit, et depuis le 1331 l'origine `'tableur'` verrouille ; mais tant que
 *   le coach ne touchait AUCUN menu, l'ancien bloc survivait sous une grille
 *   qui disait autre chose. Les deux ecrans se contredisaient en silence, et
 *   le seul moyen de les reconcilier etait un geste que rien ne reclamait.
 *
 * ⚠ LE VERROU SEUL N'AURAIT PAS SUFFI. Marquer l'athlete verrouillee ferme sa
 *   carte, mais ses anneaux continuent de lire `nutrition.macros` : il fallait
 *   REECRIRE le bloc, pas seulement retirer les boutons.
 *
 * ⚠ ELLE NE S'APPLIQUE PAS EN SAISIE MANUELLE — `_tbEcrireCibles` refuse deja,
 *   et c'est le contrat affiche sous l'interrupteur : les grammes tapes par le
 *   coach sont la prescription, les recalculer serait les effacer.
 *
 * ⚠ NI QUAND SA GRILLE N'EST PAS POSEE : une athlete que le coach n'a jamais
 *   reglee garde la main sur ses cibles, c'est la demande du 14/09/2026.
 *
 * ⚠ ET ELLE N'ECRIT QUE SI LES CHIFFRES CHANGENT. `renderCoachNutriSection`
 *   est appelee a chaque repeinture — une vingtaine d'appels dans le fichier.
 *   Ecrire a chaque passage aurait fait partir une poussee par clic. La
 *   comparaison ignore DELIBEREMENT `origineDate`, que `_tbEcrireCibles`
 *   rafraichit a chaque fois : la comparer aurait rendu tout different, tout
 *   le temps, et la garde n'aurait jamais retenu personne.
 * @param {any} c  le dossier de l'athlete, deja sorti de DB
 */
function _tbReconcilier(c){
  if(!c||!c.email) return false;
  // ⚠ DES CIBLES QUE LA GRILLE A ECRITES SUIVENT LA GRILLE, NAF CHOISI OU NON.
  //   Mesure au banc a deux appareils, 21/09/2026 : en automatique, le coach
  //   regle les proteines au tableau — les cibles s'ecrivent, origine
  //   « tableur » — puis passe en prise de masse. Sa fiche affiche le calcul,
  //   2 096 kcal ; l'athlete garde 1 892. Idem apres une pesee : le calcul du
  //   coach suit le nouveau poids, le dossier non. Le pied du tableau promet
  //   pourtant « chaque reglage part vers ton athlete des que tu le changes ».
  //   La garde n'acceptait qu'une grille au niveau d'activite CHOISI, et ce
  //   coach n'en avait pas choisi : le calcul tournait sur le defaut.
  //
  //   L'ORIGINE « tableur » SUFFIT, et c'est la meme regle que
  //   ciblesPoseesParCoach : ces chiffres, c'est le coach qui les a poses. Ce
  //   que l'athlete a ecrit elle-meme (origine « athlete ») reste a elle — la
  //   demande du 14/09/2026 tient.
  // ⚠ UNE CIBLE REMISE EN PLACE NE SE RECALCULE PAS DANS SON DOS (build 1408).
  //   Elle vaut prescription jusqu'au prochain reglage du tableau ; sans cette
  //   sortie, le rendu qui suit la remise en place la remplacait aussitot par
  //   le calcul courant, et le bouton « Remettre en place » n'avait aucun effet
  //   visible. MESURE AU BANC.
  if((((c.nutrition||{}).macros||{}).origine)==='histo') return false;
  const _duTableur=(((c.nutrition||{}).macros||{}).origine)==='tableur';
  if(!grilleCoachPosee(c)&&!_duTableur) return false;
  const chiffres=m=>JSON.stringify(m?{on:m.on,off:m.off,origine:m.origine}:null);
  const avant=chiffres((c.nutrition||{}).macros);
  if(!_tbEcrireCibles(c)) return false;
  if(chiffres((c.nutrition||{}).macros)===avant) return false;
  try{
    const users=DB.get('users')||{};
    c.updatedAt=Date.now(); users[c.email]=c;
    DB.set('users',users);
    CLOUD.pushOne(c.email,c);
  }catch(e){}
  return true;
}
function renderCoachNutriSection(c){
  // LES ANCIENS CLICS DU ±20 NE COMPTENT PLUS (voir ajustKcal) : retirés une
  // fois, ici, sur la fiche du coach, puis envoyés. Avant la réconciliation,
  // qui recalcule ensuite les cibles posées par la grille sans eux.
  // (06/10/2026) Jamais sur un APERÇU (clone du brouillon) : rien n'en part.
  if(c&&!c._apercu) try{
    if(_ajustMigrer(c)){
      const users=DB.get('users')||{};
      c.updatedAt=Date.now(); users[c.email]=c;
      DB.set('users',users);
      CLOUD.pushOne(c.email,c);
    }
  }catch(e){}
  // ⚠ AVANT LE RENDU, PAS APRES : les tableaux qu'on peint juste en dessous
  //   doivent montrer ce que l'athlete a REELLEMENT dans son dossier, pas ce
  //   qu'elle aurait si on reconciliait une fois l'ecran deja dessine.
  if(c&&!c._apercu) try{ _tbReconcilier(c); }catch(e){}
  // LA CARTE « CIBLES » (en tête de l'onglet), puis, s'il y a un brouillon,
  // tout l'onglet se peint sur l'APERÇU : le tableau suit l'écart en cours.
  try{ _rendreCiblesCoach(c); }catch(e){}
  if(c&&!c._apercu&&nutBrouillonDelta(c.id)){ try{ c=nutApercu(c,nutBrouillonDelta(c.id)); }catch(e){} }
  _plOublierSiAutreAthlete(c&&c.email);
  const el=document.getElementById('ccd-nutrition');
  if(!el||!c) return;
  const nut=c.nutrition||{};
  const dt=typeDiete(nut);
  // Le coach doit voir la meme chose que son athlete : c'est lui qui tranchera
  // le type de suivi.
  //
  // `c` EXPLICITE : la config de cycle vit dans `c.cycle`, et un porteur
  // deviné à partir de la seule nutrition la perdait — la bannière ne
  // sortait jamais ici.
  const _transi=_htmlDieteTransition(nut,c);
  // Les trois encarts de pause : proposition, pause en cours ou terminee, et
  // preavis de fin de phase. Fiche COACH uniquement — rien de ce module
  // n'atteint l'ecran de l'athlete.
  const _pauseHtml=_htmlPauseProposition(c)+_htmlPauseEnCours(c)+_htmlFinPrevue(c);
  const mon=nut.macros?.on||{};
  const moff=nut.macros?.off||{};
  // N2.16 — L'EXEMPLE SUIT LE MODE DE DIETE. « ex : 2200 / 1900 » donne la
  // valeur du jour ON puis celle du jour OFF ; en diete non cyclee une seule
  // colonne est rendue, et le coach lisait deux nombres dans un champ qui n'en
  // accepte qu'un. Le second exemple n'est ecrit que s'il y a un second champ.
  const _cyc=dieteCyclee(c);
  const _ph=(on,off)=>_cyc?('ex : '+on+' / '+off):('ex : '+on);
  const fields=[
    {k:'kcal',label:'KCAL',color:'var(--red)',ph:_ph(2200,1900)},
    {k:'p',label:'PROT g',color:'#60a5fa',ph:_ph(180,160)},
    {k:'g',label:'GLUC g',color:'var(--green)',ph:_ph(250,180)},
    {k:'l',label:'LIP g',color:'#fb923c',ph:_ph(70,65)},
    // Le sucre n'a plus de lecteur : Ciqual n'en porte aucune donnée, et la
    // tuile du journal a été retirée. Un objectif que rien ne compare ne se
    // saisit pas. Les valeurs déjà en base ne sont pas effacées.
    {k:'f',label:'FIBRES g ℹ',color:'#94a3b8',ph:'indicatif'},
  ];
  // UNE SEULE COLONNE QUAND LA DIÈTE N'EST PAS CYCLÉE. Le champ OFF n'est pas
  // rendu du tout, plutôt que masqué : saveClientNutriMacros le lit par son
  // identifiant, et un champ cache mais present aurait continue de fournir une
  // valeur que le coach ne voit plus.
  // EN AUTOMATIQUE, LES CHAMPS AFFICHENT LE CALCUL, pas ce qui est au dossier.
  // C'est ce qui les fait bouger des que le coach change les proteines, les
  // lipides, la correction du metabolisme ou la vitesse : chacun de ces
  // selecteurs rappelle deja renderCoachNutriSection.
  // N2.10 — la MEME lecture que le bloc « Proteines par prise », qui annoncait
  // un total different du champ PROT tant que rien n'etait enregistre.
  // _calcAffiche rend null en saisie manuelle : c'est ce qui fait que _vOn et
  // _vOff retombent sur ce qui est ENREGISTRE, et donc que le detecteur
  // d'ecart compare bien les deux ecrans et non le calcul avec lui-meme.
  const _calc=_calcAffiche(c);
  const _vOn =k=>_calc?_calc.on[k] :mon[k];
  const _vOff=k=>_calc?(_cyc?_calc.off[k]:_calc.on[k]):moff[k];
  // ⚠ macroRows, _champ, _ro, _fond, _teinte ET _cols ONT ETE RETIRES le
  // 08/09/2026 avec la grille qu'ils rendaient. Les dix champs vivent dans le
  // tableau « Macronutriments », ou ils remplacent les valeurs des que le
  // commutateur de saisie manuelle est allume — ids inchanges.
  // _vOn et _vOff RESTENT : le detecteur d'ecart les lit encore, et c'est lui
  // qui compare ce que le coach a sous les yeux a ce que son athlete recoit.
  // ⚠ _ecart A ETE RETIRE le 08/09/2026 avec le bloc « Aujourd'hui » qu'il
  // rendait. Voir la pierre tombale de ecartAthleteVu.
  // ══════ DEUX ENSEMBLES, ET L'ETAT CONSTATE D'ABORD ══════════════════════
  // L'assemblage placait dans cet ordre : les selecteurs de diete, le point de
  // depart, les dix champs, les boutons, l'acces au plan, et TOUT EN DERNIER le
  // journal alimentaire. Or le coach vient d'abord LIRE ce que son athlete a
  // mange, et ne regle les cibles qu'ensuite : l'ordre etait inverse par
  // rapport a l'usage.
  //
  // ET LE BLOC EST DECOUPE. Il empilait quatorze sous-blocs d'un seul tenant :
  // trois des vingt-cinq sections du dossier concentraient la moitie du volume
  // rendu. Chaque ensemble devient une SECTION de meme nature que les autres —
  // meme balisage .cc-sect / .cc-sect-t / .cc-sect-c — et herite donc du repli
  // deja en place, du chevron et de la memoire par section.
  //
  // AUCUN IDENTIFIANT DE CHAMP NE CHANGE : saveClientNutriMacros lit les dix
  // champs par leur id, et aucun calcul n'est touche. Les sous-blocs sont
  // deplaces, pas reecrits.
  const _sect=(id,titre,accent,corps)=>corps?`<section class="cc-sect" style="--cc-accent:${accent}">
      <div class="cc-sect-t"><span>${titre}</span></div>
      <div class="cc-sect-c" id="${id}">${corps}</div>
    </section>`:'';
  const _strict=dt==='strict'
    ? (_htmlStrictAccesCoach(c)+_htmlPlanResumeCoach(c)) : '';
  const _reglages=`
      <!-- N2.6, LE POIDS DE REFERENCE, DIT UNE FOIS. Tout ce qui est reglé
           en dessous en depend, les grammages, les g/kg, le plancher, et il
           etait invisible, alors que trois lectures concurrentes pouvaient en
           donner trois valeurs differentes sur le meme dossier. -->
      <!-- LE POIDS DE REFERENCE ET LES TABLEAUX DU CALCUL ONT QUITTE CETTE
           SECTION le 14/09/2026, sur demande de Kevin : « rends-les plus
           visibles, pas d'onglet deroulant pour ces tableaux, place-les
           directement sur la page nutrition sous le rectangle des phases ».
           Ils sont desormais rendus AVANT la section, sans repli : c'est le
           calcul, on le lit, on ne va pas le chercher. Voir _tableauxCalcul
           plus bas. Rien de leur contenu n'a change. -->
      <!-- LES DEUX MENUS DEROULANTS QUI ETAIENT ICI ONT DEMENAGE le
           08/09/2026, sur demande de Kevin, « diete flexible ou stricte, je
           veux que tu remontes beaucoup plus haut et de maniere plus
           stylisee ; cycler, non cycler, pareil ; supprime ce potentiel-la,
           sachant que tu l'as mis plus haut » :
             • LE TYPE DE DIETE ouvre l'onglet, en deux grosses tuiles,                #ccd-diete-choix, renderDieteChoixCoach ;
             • LE CYCLAGE est passe dans le tableau « Journees » du calcul,
               a cote des deux colonnes ON/OFF qu'il commande, c'est la
               qu'on voit ce qu'il produit.
           Les deux ecrivent toujours par saveClientNutriDiet et
           saveClientNutriCycle : seule leur place a change. -->
      <!-- ⚠ _htmlDepartCoach A ETE RETIREE le 08/09/2026. Il ne lui restait
           que le menu de correction du metabolisme et une phrase, « les
           cibles ci-dessous suivent ces reglages », qui parlait d'une grille
           deja retiree. Le menu partait avec le curseur de vitesse : les deux
           reglaient un moteur concurrent de celui des tableaux.
           LA BANNIERE SOPK, ELLE, RESTE : elle previent les athletes dont le
           plan a ete bati sous l'ancienne regle des lipides, et _htmlDepartCoach
           etait son SEUL point d'affichage. La retirer avec le reste aurait
           supprime un avertissement sans que personne le remarque. -->
      ${(()=>{ try{ return _htmlMigrationSopk(c); }catch(e){ return ''; } })()}
      <!-- LA GRILLE DE DIX CHAMPS, SON INTERRUPTEUR, LA LIGNE D'ORIGINE ET
           LE BOUTON D'ENREGISTREMENT ONT ETE RETIRES D'ICI le 08/09/2026, sur
           demande de Kevin : « supprime ces infos, mais donne la possibilité
           de cliquer sur manuel et de changer soi-même les infos, avec un
           curseur on/off », en pointant le tableau des macros.
           C'ETAIT UN SECOND AFFICHAGE DES MEMES CIBLES. Le tableau
           « Macronutriments », trois ecrans plus haut, montre deja protéines,
           lipides, glucides, fibres, sel et total ; cette grille les redisait
           en champs de saisie. Le coach lisait 242 g en haut et tapait 285 en
           bas, et rien a l'ecran ne reliait les deux.
           TOUT A DEMENAGE DANS CE TABLEAU : le commutateur en premiere ligne,
           les champs a la place des valeurs quand il est allume, et le bouton
           d'enregistrement juste dessous, il n'apparait qu'en manuel, seul
           cas ou il y a quelque chose de tape a enregistrer.
           CE QUI RESTE ICI est ce qui n'existe nulle part ailleurs : les
           violations, l'ajustement propose, la ligne d'origine quand elle
           alerte, et la remise au point de depart. -->
      ${(()=>{ try{ return htmlPointsSemaineCoach(c); }catch(e){ return ''; } })()}
      ${_htmlViolationsCoach(c)}
      ${_htmlAjustement(c,true)}
      <!-- ⚠ _htmlDepartHypotheses N'EST PLUS RENDUE ICI le 08/09/2026. C'etait
           le paragraphe que Kevin a pointe : « Mifflin-St Jeor · 2 222 kcal au
           repos · dépense estimée 3 711 kcal … déficit de 558 kcal par jour … ».
           Il disait en dix lignes ce que les tableaux « Facteurs » et
           « Besoins caloriques » disent maintenant ligne par ligne, chacune
           avec sa source et son menu de reglage. Deux expressions du meme
           calcul, dont une qu'on ne peut pas corriger.
           Elle n'avait qu'un appelant : celui-ci. Elle est retiree. -->
      <!-- L'ORIGINE DES CIBLES, MAIS SEULEMENT QUAND ELLE ALERTE. « Cibles
           posees automatiquement le 3 septembre » ne demande rien a personne ;
           « ajustement applique par l'athlete » dit que quelqu'un d'autre a
           bouge les chiffres du coach, et ca, il doit le voir.
           C'est le SEUL lecteur de nutrition.macros.origine du fichier : le
           retirer entierement aurait rendu ce champ purement decoratif, ecrit
           par quatre chemins et lu par aucun. -->
      ${(()=>{ try{
        const _o=((c.nutrition||{}).macros||{}).origine;
        return _o==='ajustement'?_htmlOrigineCibles(c):'';
      }catch(e){ return ''; } })()}
      <!-- LA REMISE AU POINT DE DEPART A QUITTE CETTE SECTION le 22/09/2026
           (build 1409). Elle etait ici, rouge et pleine largeur (build 1404),
           juste sous les alertes, donc collee aux trois boutons du tableau,
           sans faire groupe avec eux. Kevin : « les 3 autres se retrouvent en
           haut en blanc sur la meme ligne ». Elle est maintenant le troisieme
           bouton blanc de la barre de _htmlTableauxTableur, au-dessus du seul
           bouton rouge. Rien d'autre n'a bouge : meme appel, meme
           confirmation dans reinitialiserCalculs, meme garde-fou.
           CE QUI RESTE ICI, ce sont les alertes : violations, ajustement
           propose, et l'origine des cibles quand elle previent. -->`;
  // ⚠ DEUX BLOCS ONT QUITTE CETTE FONCTION le 08/09/2026.
  //   • LE TAUX DE DIETE RESPECTEE est remonte au-dessus de cette section,
  //     en camembert, juste sous le type de diete : c'est un CONSTAT, il n'a
  //     rien a faire au milieu de la machine a regler. renderDieteRespectCoach.
  //   • LE JOURNAL ALIMENTAIRE est descendu tout au fond de l'onglet, en
  //     calendrier, et seulement en diete flexible. renderJournalNutriCoach.
  // Les deux sont appeles par openClientDetail, comme les autres blocs de
  // l'onglet ; ils ne dependent plus du rendu de celui-ci.
  el.innerHTML=
    // ── CE QUI EST CONSTATE ────────────────────────────────────────────────
    `${_transi}${_pauseHtml}`
    // N5.11 — DEUX NIVEAUX ICI AUSSI. Ces cinq sections sont fabriquees par le
    // rendu et non par le balisage : elles echappaient au comptage, et leurs
    // quatre couleurs remettaient l'echelle qu'on venait de retirer. Aucune de
    // ces cinq n'attend une decision du coach — elles decrivent et elles se
    // reglent — donc toutes neutres.
    // ⚠ « CIBLES EN COURS » A ETE RETIREE le 08/09/2026 : elle redisait, en
    // pourcentages, les grammages que le tableau « Macronutriments » porte
    // trois ecrans plus haut. Deux affichages du meme chiffre, dont un
    // derive — et c'est celui qui derive qui se met a mentir en premier.
    //
    // ⚠ « CE QUE VOIT TON ATHLETE » N'EST PLUS UNE SECTION PERMANENTE, mais
    // elle n'est PAS supprimee : elle est devenue une ALERTE, rendue juste en
    // dessous et SEULEMENT quand les deux ecrans divergent. C'etait tout son
    // objet — le panneau du coach recalcule a chaque rendu pendant que
    // l'athlete lit ce qui est enregistre, et le cycle menstruel deplace
    // encore ce qu'il voit. Un bandeau permanent qui repete « tout va bien »
    // n'avertit plus de rien : celui-la ne parle que lorsqu'il a une nouvelle.
    // ── CE QUE LE COACH REGLE ──────────────────────────────────────────────
    // ── LE CALCUL, A DECOUVERT ─────────────────────────────────────
    // Sans cc-sect : pas de chevron, pas de repli, pas de memoire d'etat. La
    // classe tbk-serre resserre les hauteurs de ligne et fait passer les
    // quatre tableaux sur deux colonnes des que la fenetre le permet — ils
    // s'etiraient sur toute la longueur de l'ecran, et il fallait defiler
    // pour comparer deux chiffres qui se repondent.
    // LE CALCULATEUR, REPLIÉ une fois des cibles posées (06/10/2026) : la
    // carte « Cibles » en tête suffit au geste courant. L'état est gardé.
    + '<details class="nut-calc"'+(nutCalcOuvert(c)?' open':'')+' ontoggle="nutCalcMemoriser(this.open)"><summary class="nut-calc-t">Calcul détaillé : facteurs, sports, méthodes</summary>'
    + '<div class="tbk-serre">'
      // ⚠ LE BANDEAU « RÉGLÉ PAR L'ATHLÈTE » ET LE « POIDS DE RÉFÉRENCE » ONT
      //   ÉTÉ RETIRÉS le 22/09/2026 (build 1402), sur demande de Kevin :
      //   « supprime les trucs ». Le CALCUL n'a pas changé : il tient toujours
      //   compte de l'objectif réglé par l'athlète et du poids de référence
      //   (poidsNutritionnel). Seuls les deux encadrés qui le disaient
      //   au-dessus des tableaux ont disparu, avec leurs fonctions.
      + (()=>{ try{ return _htmlTableauxTableur(c); }catch(e){ return ''; } })()
      + '</div></details>'
    // ⚠ « RÉGLER LES OBJECTIFS » N'EST PLUS UN MENU DÉROULANT (build 1404).
    //   Kevin, 22/09/2026 : « mets pas de menu déroulant mais laisse le bouton
    //   en rouge ». Le contenu est rendu A DECOUVERT, sans titre ni repli :
    //   les alertes (violations, ajustement, origine) quand il y en a, et le
    //   bouton de remise au point de depart. L'id ccd-nut-reglages reste :
    //   hors .cc-sect, le repli ne le touche plus.
    + '<div class="ccd-nut-reglages" id="ccd-nut-reglages">'+_reglages+'</div>'
    + _sect('ccd-nut-strict','Diète stricte','var(--border)',_strict);
}

// ══ DANS QUOI CET ATHLETE EST — LA PREMIERE CHOSE QU'ON LIT ══════════════
//
// Kevin, 08/09/2026 : « quand j'arrive en haut de la page, que je sache
// l'eleve, il est mis en quoi ». C'etait un <select> gris de plus, au milieu du
// bloc de reglages, quatre ecrans plus bas — indiscernable des six autres menus
// deroulants de la page, alors que c'est LA decision dont tout le reste depend :
// la stricte fait composer un plan par le coach, la flexible fait compter des
// macros par l'athlete, et le taux de respect ne se calcule pas de la meme
// facon dans les deux cas.
//
// DEUX TUILES, ET LA COULEUR PORTE LE SENS. Le vert de la flexible, le rouge de
// la stricte : ce sont les deux teintes que le reste de l'application emploie
// deja pour « l'athlete decide » et « le coach decide ». La tuile eteinte reste
// LISIBLE et cliquable — c'est un choix, pas un etat qu'on subit.
const DIETES=Object.freeze({
  flexible:{lib:'Flexible', c:'#22c55e',
    sous:'Il compte ses macros, il choisit ses aliments.'},
  strict:{lib:'Stricte', c:'#ff2d3f',
    sous:'Tu composes son plan, il le suit.'}
});
function _htmlDieteChoix(c){
  if(!c) return '';
  let dt='flexible';
  try{ dt=typeDiete(c.nutrition||{}); }catch(e){ dt='flexible'; }
  const tuile=k=>{
    const d=DIETES[k], on=(dt===k);
    return '<button type="button" class="dtc-t'+(on?' actif':'')+'" style="--dt:'+d.c+'"'
      +' aria-pressed="'+(on?'true':'false')+'"'
      +' onclick="saveClientNutriDiet('+JSON.stringify(k).replace(/"/g,'&quot;')+')">'
      +'<span class="dtc-nom">Diète '+escapeHtml(d.lib)+'</span>'
      +'<span class="dtc-sous">'+escapeHtml(d.sous)+'</span>'
      +'<span class="dtc-etat">'+(on?'en cours':'basculer')+'</span>'
      +'</button>';
  };
  // ⚠ LE BOUTON N'EXISTE QU'EN DIETE STRICTE, et c'est la demande exacte de
  // Kevin, 08/09/2026. En flexible il n'y a pas de plan a modifier : l'athlete
  // compte ses macros et choisit ses aliments. Un bouton qui ouvrirait un
  // composeur dont l'eleve ne verra jamais le resultat serait un piege.
  // IL EST ICI ET NON AU FOND DE LA SECTION « Diete stricte » : c'est le geste
  // qui decoule directement de la tuile qu'on vient d'allumer.
  const plan=(dt==='strict')
    ? '<button type="button" class="btn btn-red dtc-plan" onclick="ouvrirPlanCoach()">'
      +'Modifier le programme alimentaire</button>'
    : '';
  return '<div class="dtc">'+tuile('flexible')+tuile('strict')+'</div>'+plan;
}
function renderDieteChoixCoach(c){
  const z=document.getElementById('ccd-diete-choix');
  if(!z) return false;
  let h=''; try{ h=_htmlDieteChoix(c); }catch(e){ h=''; }
  z.innerHTML=h;
  return !!h;
}

// ══ EST-CE QUE CA TIENT — LE CAMEMBERT DE DIETE RESPECTEE ════════════════
//
// Kevin : « une sorte de petit graphique avec un pourcentage, plutot un cercle
// type camembert, avec du rouge pour le non et du vert pour le oui ». C'etait
// un nombre seul, en haut d'un cadre, sans rien pour le situer : 60 % se lit
// tres differemment selon qu'il porte sur cinq jours ou sur cinquante.
//
// UN ANNEAU SVG, ET NON UN conic-gradient : l'arc vert doit porter le decompte
// exact des jours tenus, et un degrade CSS ne se mesure pas. stroke-dasharray
// sur un cercle de circonference 100 fait que la longueur de l'arc EST le
// pourcentage — aucune conversion, donc aucune erreur d'arrondi a l'affichage.
// LE ROUGE EST DESSINE EN PREMIER, sur tout le tour : le vert se pose dessus.
// Deux arcs qui se partagent le cercle laisseraient un liseré entre eux.
// ══ LE JOURNAL ALIMENTAIRE, EN CALENDRIER ════════════════════════════════
//
// Kevin, 08/09/2026 : « tu vois le calendrier sur l'application Garmin, je peux
// cliquer sur chaque jour et avoir les donnees de chaque jour ? Eh ben mets-le
// moi comme ca. Mais mets-moi ca vraiment au fond du truc ».
//
// UN MOIS D'UN COUP D'OEIL. Ce qu'on vient chercher ici n'est pas le detail
// d'un jour — c'est la REGULARITE : est-ce qu'il saisit tous les jours, est-ce
// qu'il y a un trou du vendredi au dimanche, est-ce que ca tient ou pas. Une
// grille le dit sans un mot ; la navigation jour par jour d'avant ne le disait
// jamais.
//
// TROIS ETATS DE CASE, ET PAS QUATRE : tenu (vert), hors cible (rouge), saisi
// mais non jugeable (gris plein). Un jour SANS saisie reste vide — il ne
// porte aucun jugement, et le peindre en rouge accuserait de rate ce qui n'a
// simplement pas ete note. C'est la meme distinction que jourDieteTenu, dont
// ces couleurs sortent directement.
let _ccdCalMois=null;   // 'YYYY-MM' — le mois affiche
let _ccdCalJour=null;   // 'YYYY-MM-DD' — le jour ouvert sous la grille
// PURE. Le mois d'une date ISO.
function _calMois(iso){ return String(iso||'').slice(0,7); }
// PURE. Le mois voisin, sans passer par Date : 'YYYY-MM' + n mois.
// Les mois se comptent de 0 a 11 en interne pour que le report d'annee tombe
// juste dans les deux sens — decembre + 1 et janvier − 1.
function _calDecale(ym,n){
  const a=parseInt(String(ym).slice(0,4),10), m=parseInt(String(ym).slice(5,7),10);
  if(!isFinite(a)||!isFinite(m)) return ym;
  const t=(a*12+(m-1))+(Number(n)||0);
  const p2=x=>(x<10?'0':'')+x;
  return Math.floor(t/12)+'-'+p2((t%12)+1);
}
// PURE. Le nombre de jours du mois. Le jour 0 du mois SUIVANT est le dernier
// du mois demande — la regle bissextile vient du calendrier, pas de nous.
function _calNbJours(ym){
  const a=parseInt(String(ym).slice(0,4),10), m=parseInt(String(ym).slice(5,7),10);
  if(!isFinite(a)||!isFinite(m)) return 0;
  return new Date(a,m,0).getDate();
}
// PURE. La colonne du 1er du mois, LUNDI EN PREMIER (0 = lundi, 6 = dimanche).
// getDay() rend 0 pour dimanche : la semaine française commence six jours plus
// loin, d'ou le décalage.
function _calDecalage(ym){
  const a=parseInt(String(ym).slice(0,4),10), m=parseInt(String(ym).slice(5,7),10);
  if(!isFinite(a)||!isFinite(m)) return 0;
  return (new Date(a,m-1,1).getDay()+6)%7;
}
function ccdCalMois(ym){
  _ccdCalMois=ym; _ccdCalJour=null;
  try{ const c=getOwnedClient(currentClientId); if(c) renderJournalNutriCoach(c); }catch(e){}
  return ym;
}
function ccdCalJour(iso){
  // Recliquer sur le jour ouvert le referme : c'est le seul moyen de rendre la
  // grille entiere sans changer de mois.
  _ccdCalJour=(_ccdCalJour===iso)?null:iso;
  try{ const c=getOwnedClient(currentClientId); if(c) renderJournalNutriCoach(c); }catch(e){}
  return _ccdCalJour;
}
// ══ LE JOURNAL ALIMENTAIRE, MAQUETTE DU 23/09/2026 (build 1412) ══════════
// Kevin, trois captures a l'appui : « remplace-moi la version des images 1 et
// 2 par celle de l'image 3, a l'identique, et mets les fonctions visibles pour
// la completer ».
//
// CE QUI REMPLACE QUOI. La grille de trente cases muettes — un numero, un
// total, « Lecture seule » — devient une semaine de SEPT COLONNES ou chaque
// jour montre ce qu'il contient : son verdict, son total, et ses repas ligne
// par ligne avec leurs kilocalories. Au-dessus, la barre du mois et les
// chiffres du mois ; en dessous, la legende et l'astuce.
//
// ⚠ ET LE COACH PEUT DESORMAIS COMPLETER LE JOURNAL. C'est la demande : « mets
//   les fonctions visibles pour la completer ». Un repas ajoute ici porte
//   `par:'coach'` — l'athlete voit d'ou il vient, et c'est la SEULE chose que
//   le coach peut retirer : ce que l'athlete a journalise lui appartient.
//
// ⚠ AUCUN VERDICT INVENTE. La maquette portait quatre etats dont « à ajuster »
//   en orange ; il n'en existe que trois dans le calcul — jourDieteTenu rend
//   vrai, faux, ou rien quand aucune cible n'est posee. Un quatrieme etat
//   aurait demande un seuil sorti de nulle part, sur des cibles alimentaires.
//   La legende dit donc les trois vrais, plus les jours non saisis.
let _ccdCalVue='grille';    // 'grille' | 'liste'
let _ccdCalForm=null;       // 'YYYY-MM-DD' — le jour dont le formulaire est ouvert
const FJ_REPAS_ICO=Object.freeze({matin:'sun',dejeuner:'utensils',diner:'moon',
  collation:'coffee',coucher:'moon'});
// DANS LA CARTE D'UN JOUR, le libelle a une centaine de pixels a cote de son
// total : « Petit-déjeuner » s'y coupait en « Petit-déje… ». Le detail, lui,
// garde le libelle entier.
const FJ_REPAS_COURT=Object.freeze({matin:'Petit-déj.',dejeuner:'Déjeuner',
  diner:'Dîner',collation:'Collation',coucher:'Coucher'});
function ccdCalVue(v){
  _ccdCalVue=(v==='liste')?'liste':'grille';
  try{ const c=getOwnedClient(currentClientId); if(c) renderJournalNutriCoach(c); }catch(e){}
  return _ccdCalVue;
}
// LE FORMULAIRE D'AJOUT. Ouvert sur un jour precis quand on touche une case
// vide, sur aujourd'hui quand on passe par le bouton de la barre.
function ccdJournalAjout(iso){
  const j=String(iso||'')||localISODate(new Date());
  _ccdCalForm=(_ccdCalForm===j)?null:j;
  if(_ccdCalForm) _ccdCalMois=_calMois(_ccdCalForm);
  try{ const c=getOwnedClient(currentClientId); if(c) renderJournalNutriCoach(c); }catch(e){}
  try{ if(_ccdCalForm){ const e=document.getElementById('ccd-jr-nom'); if(e) e.focus(); } }catch(e){}
  return _ccdCalForm;
}
// ⚠ LES KILOCALORIES SE DEDUISENT DES MACROS QUAND ELLES MANQUENT, et jamais
//   l'inverse : 4 par gramme de proteines et de glucides, 9 par gramme de
//   lipides. Un repas sans aucun chiffre n'est pas enregistre — une ligne a
//   zero kcal fausserait la moyenne du mois et le verdict du jour.
function ccdJournalEnregistrer(){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  const v=id=>{ const e=document.getElementById(id); return e?String(e.value||'').trim():''; };
  const nb=id=>{ const x=parseFloat(v(id).replace(',','.')); return isFinite(x)&&x>=0?x:null; };
  const iso=v('ccd-jr-date');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)){ toast('Date incomplète','var(--orange)'); return false; }
  const repas=v('ccd-jr-repas')||'dejeuner';
  const nom=v('ccd-jr-nom');
  const p=nb('ccd-jr-p'), g=nb('ccd-jr-g'), l=nb('ccd-jr-l');
  let kcal=nb('ccd-jr-kcal');
  if(kcal==null&&(p!=null||g!=null||l!=null)) kcal=Math.round(4*(p||0)+4*(g||0)+9*(l||0));
  if(kcal==null||!(kcal>0)){ toast('Donne au moins les kilocalories, ou les macros','var(--orange)'); return false; }
  if(!c.nutrition) c.nutrition={};
  if(!c.nutrition.log) c.nutrition.log={};
  if(!c.nutrition.log[iso]) c.nutrition.log[iso]={entries:[]};
  if(!Array.isArray(c.nutrition.log[iso].entries)) c.nutrition.log[iso].entries=[];
  c.nutrition.log[iso].entries.push({id:'co'+Date.now().toString(36),
    nom:nom||(FJ_REPAS_LIB[repas]||'Repas'),repas:repas,
    kcal:Math.round(kcal),p:p||0,c:g||0,l:l||0,
    par:'coach',ajoutLe:Date.now()});
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  _ccdCalForm=null; _ccdCalJour=iso; _ccdCalMois=_calMois(iso);
  toastSync(ok,CLOUD.pushOne(c.email,c),'Repas ajouté au journal '+ICO.coche,'le repas est');
  try{ renderJournalNutriCoach(c); }catch(e){}
  return true;
}
// ⚠ LE COACH NE RETIRE QUE CE QU'IL A AJOUTE. Ce que l'athlete a journalise
//   est a lui : l'effacer depuis la fiche du coach serait reecrire son
//   journal dans son dos.
async function ccdJournalRetirer(iso,id){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  const e=(((c.nutrition||{}).log||{})[iso]||{}).entries||[];
  const i=e.findIndex(x=>x&&String(x.id)===String(id)&&x.par==='coach');
  if(i<0){ toast('Seuls les repas que tu as ajoutés peuvent être retirés','var(--orange)'); return false; }
  const ok=await rcConfirm('Retirer ce repas ?',
    escapeHtml(e[i].nom||'Repas')+' : '+Math.round(Number(e[i].kcal)||0)+' kcal. '
    +'Il disparaîtra du journal de ton athlète.','Retirer');
  if(!ok) return false;
  e.splice(i,1);
  c.updatedAt=Date.now(); users[c.email]=c;
  const _ok=DB.set('users',users);
  toastSync(_ok,CLOUD.pushOne(c.email,c),'Repas retiré','le retrait est');
  try{ renderJournalNutriCoach(c); }catch(e2){}
  return true;
}
// PURE. Les chiffres du mois affiche : moyenne par jour saisi, part de chaque
// macro dans cette moyenne, et jours saisis sur jours ECOULES — pas sur trente
// et un, sinon un mois en cours afficherait toujours un retard qui n'existe
// pas.
function journalMois(log,ym){
  const n=_calNbJours(ym);
  if(!n) return null;
  const p2=x=>(x<10?'0':'')+x;
  const auj=localISODate(new Date());
  const fin=(_calMois(auj)===ym)?parseInt(auj.slice(8,10),10):n;
  let jours=0,kcal=0,p=0,g=0,l=0;
  for(let j=1;j<=n;j++){
    const tj=journalTotalJour(log,ym+'-'+p2(j));
    if(!tj.n) continue;
    jours++; kcal+=tj.kcal; p+=tj.p; g+=tj.c; l+=tj.l;
  }
  if(!jours) return {jours:0,total:fin,kcal:0,p:0,g:0,l:0,pcP:0,pcG:0,pcL:0,pcJours:0};
  const mk=Math.round(kcal/jours), mp=Math.round(p/jours), mg=Math.round(g/jours), ml=Math.round(l/jours);
  const somme=4*mp+4*mg+9*ml;
  const pc=x=>somme>0?Math.round(x/somme*100):0;
  // ⚠ JAMAIS PLUS DE CENT POUR CENT. Un athlete qui journalise un jour a
  //   venir — un repas prepare la veille — donnait « 109 % · 25 / 23 jours ».
  //   Le denominateur suit alors le nombre de jours REELLEMENT saisis.
  const tot=Math.max(fin,jours);
  return {jours:jours,total:tot,kcal:mk,p:mp,g:mg,l:ml,
    pcP:pc(4*mp),pcG:pc(4*mg),pcL:pc(9*ml),
    pcJours:tot>0?Math.min(100,Math.round(jours/tot*100)):0};
}
function _htmlJournalCal(c){
  const log=((c||{}).nutrition||{}).log||{};
  const tous=journalJours(log,null,null);
  const nb=v=>Math.round(Number(v)||0).toLocaleString('fr-FR');
  const p2=x=>(x<10?'0':'')+x;
  const auj=localISODate(new Date());
  const ym=_ccdCalMois||_calMois(tous[0]||auj);
  const dec=_calDecalage(ym), n=_calNbJours(ym);
  const titre=(()=>{ const d=new Date(parseInt(ym.slice(0,4),10),parseInt(ym.slice(5,7),10)-1,1);
    const x=d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
    return x.charAt(0).toUpperCase()+x.slice(1); })();
  const fleche=(m,f,lib)=>'<button type="button" class="jr-nav" onclick="ccdCalMois('
    +JSON.stringify(m).replace(/"/g,'&quot;')+')" aria-label="'+lib+'">'+f+'</button>';
  // ── LA BARRE : le mois, les deux vues, et l'ajout ──────────────────────
  const barre='<div class="jr-bar">'
    +'<div class="jr-mois">'+fleche(_calDecale(ym,-1),'‹','Mois précédent')
      +'<span>'+escapeHtml(titre)+'</span>'
      +fleche(_calDecale(ym,1),'›','Mois suivant')+'</div>'
    +'<div class="jr-act">'
      +'<button type="button" class="jr-vb'+(_ccdCalVue==='grille'?' actif':'')+'" aria-pressed="'
        +(_ccdCalVue==='grille'?'true':'false')+'" title="Vue calendrier" onclick="ccdCalVue(\'grille\')">'
        +icon('calendar',16)+'</button>'
      +'<button type="button" class="jr-vb'+(_ccdCalVue==='liste'?' actif':'')+'" aria-pressed="'
        +(_ccdCalVue==='liste'?'true':'false')+'" onclick="ccdCalVue(\'liste\')">'
        +icon('clipboard',16)+'<span>Vue liste</span></button>'
      +'<button type="button" class="jr-add" onclick="ccdJournalAjout(\'\')">'
        +icon('plus-circle',16)+'<span>Ajouter un repas</span></button>'
    +'</div></div>';
  // ── LES CHIFFRES DU MOIS ───────────────────────────────────────────────
  const m=journalMois(log,ym)||{jours:0,total:0,kcal:0,p:0,g:0,l:0,pcP:0,pcG:0,pcL:0,pcJours:0};
  const bloc=(ico,coul,val,lib,sous)=>'<div class="jr-s">'
    +'<span class="jr-si" style="--jc:'+coul+'">'+icon(ico,17)+'</span>'
    +'<span class="jr-sx"><b>'+val+'</b><small>'+lib+(sous?' · '+sous:'')+'</small></span></div>';
  const R=52, C=2*Math.PI*R;
  const donut='<div class="jr-s jr-don">'
    +'<svg viewBox="0 0 120 120" width="42" height="42" aria-hidden="true">'
    +'<circle cx="60" cy="60" r="'+R+'" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="14"/>'
    +'<circle cx="60" cy="60" r="'+R+'" fill="none" stroke="#ff2d3f" stroke-width="14" stroke-linecap="round"'
    +' stroke-dasharray="'+(C*Math.min(1,m.pcJours/100)).toFixed(1)+' '+C.toFixed(1)+'"'
    +' transform="rotate(-90 60 60)"/></svg>'
    +'<span class="jr-sx"><b class="jr-rouge">'+m.pcJours+' %</b>'
    +'<small>jours saisis · '+m.jours+' / '+m.total+' jours</small></span></div>';
  const stats='<div class="jr-stats">'
    +bloc('flame','#ff5a5a',m.jours?(nb(m.kcal)+' kcal'):'-','moyenne / jour')
    +bloc('chart-bar','#ff2d3f',m.pcP+' %','protéines',nb(m.p)+' g')
    +bloc('wheat','#f5c518',m.pcG+' %','glucides',nb(m.g)+' g')
    +bloc('droplet','#22c55e',m.pcL+' %','lipides',nb(m.l)+' g')
    +donut
    +'<button type="button" class="jr-stats-b" onclick="ccdAller(\'ccd-diete-respect\')">'
      +icon('chart-bar',15)+'<span>Voir les statistiques</span></button>'
    +'</div>';
  // ── LE FORMULAIRE D'AJOUT ──────────────────────────────────────────────
  let form='';
  if(_ccdCalForm){
    const dl=new Date(_ccdCalForm+'T12:00:00');
    const lib=isNaN(dl.getTime())?_ccdCalForm:dl.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
    form='<div class="jr-form"><div class="jr-form-t">Ajouter un repas : '
      +escapeHtml(lib.charAt(0).toUpperCase()+lib.slice(1))+'</div>'
      +'<div class="jr-form-g">'
      +'<label>Jour<input type="date" id="ccd-jr-date" value="'+escapeHtml(_ccdCalForm)+'"></label>'
      +'<label>Repas<select id="ccd-jr-repas">'
        +Object.keys(FJ_REPAS_LIB).map(k=>'<option value="'+k+'"'+(k==='dejeuner'?' selected':'')+'>'
          +escapeHtml(FJ_REPAS_LIB[k])+'</option>').join('')+'</select></label>'
      +'<label class="jr-form-l">Aliment ou repas<input type="text" id="ccd-jr-nom" placeholder="Riz, poulet, légumes…"></label>'
      +'<label>kcal<input type="number" id="ccd-jr-kcal" min="0" inputmode="numeric" placeholder="620"></label>'
      +'<label>Protéines (g)<input type="number" id="ccd-jr-p" min="0" inputmode="numeric" placeholder="40"></label>'
      +'<label>Glucides (g)<input type="number" id="ccd-jr-g" min="0" inputmode="numeric" placeholder="70"></label>'
      +'<label>Lipides (g)<input type="number" id="ccd-jr-l" min="0" inputmode="numeric" placeholder="15"></label>'
      +'</div>'
      +'<div class="jr-form-b">'
      +'<button type="button" class="jr-form-x" onclick="ccdJournalAjout(\'\')">Annuler</button>'
      +'<button type="button" class="jr-add" onclick="ccdJournalEnregistrer()">'+icon('check',15)
      +'<span>Ajouter au journal</span></button></div>'
      +'<div class="jr-form-n">Sans kilocalories, elles se déduisent des macros (4 · 4 · 9). '
      +'Le repas apparaîtra dans le journal de ton athlète, marqué comme ajouté par toi.</div></div>';
  }
  // ── UN JOUR ────────────────────────────────────────────────────────────
  const repasDuJour=iso=>{
    const e=((log[iso]||{}).entries)||[];
    const par={};
    e.forEach(x=>{ const k=x&&x.repas&&FJ_REPAS_LIB[x.repas]?x.repas:'collation';
      par[k]=(par[k]||0)+(Number(x.kcal)||0); });
    return Object.keys(FJ_REPAS_LIB).filter(k=>par[k]!=null).map(k=>'<span class="jr-r">'
      +'<span class="jr-ri">'+icon(FJ_REPAS_ICO[k]||'utensils',13)+'</span>'
      +'<span class="jr-rl">'+escapeHtml(FJ_REPAS_COURT[k]||FJ_REPAS_LIB[k])+'</span>'
      +'<span class="jr-rk">'+nb(par[k])+' kcal</span></span>').join('');
  };
  const carteJour=(j)=>{
    const iso=ym+'-'+p2(j);
    const tj=journalTotalJour(log,iso);
    if(!tj.n) return '<button type="button" class="jr-j jr-vide'+(iso===auj?' jr-auj':'')+'"'
      +' onclick="ccdJournalAjout('+JSON.stringify(iso).replace(/"/g,'&quot;')+')"'
      +' aria-label="Ajouter un repas le '+j+'">'
      +'<span class="jr-t"><span class="jr-n">'+j+'</span></span>'
      +'<span class="jr-plus">'+icon('plus-circle',20)+'<span>Ajouter un repas</span></span></button>';
    let v=null; try{ v=jourDieteTenu(c,iso); }catch(e){ v=null; }
    const et=v===true?'oui':(v===false?'non':'neutre');
    const pastille=v===true?icon('check-circle',15):(v===false?icon('x-circle',15):icon('clock',15));
    return '<button type="button" class="jr-j jr-'+et+(iso===auj?' jr-auj':'')
      +(_ccdCalJour===iso?' jr-ouvert':'')+'" aria-pressed="'+(_ccdCalJour===iso?'true':'false')+'"'
      +' onclick="ccdCalJour('+JSON.stringify(iso).replace(/"/g,'&quot;')+')">'
      +'<span class="jr-t"><span class="jr-n">'+j+'</span>'
      +'<span class="jr-b" aria-hidden="true">'+pastille+'</span>'
      +'<span class="jr-k">'+nb(tj.kcal)+' kcal</span></span>'
      +repasDuJour(iso)+'</button>';
  };
  // ── LA GRILLE : sept colonnes, lundi en premier ────────────────────────
  let grille='';
  if(_ccdCalVue==='grille'){
    const prevYm=_calDecale(ym,-1), prevN=_calNbJours(prevYm);
    let cases='';
    for(let i=0;i<dec;i++) cases+='<div class="jr-j jr-hors" aria-hidden="true"><span class="jr-t">'
      +'<span class="jr-n">'+(prevN-dec+1+i)+'</span></span></div>';
    for(let j=1;j<=n;j++) cases+=carteJour(j);
    const reste=(7-((dec+n)%7))%7;
    for(let i=1;i<=reste;i++) cases+='<div class="jr-j jr-hors" aria-hidden="true"><span class="jr-t">'
      +'<span class="jr-n">'+i+'</span></span></div>';
    grille='<div class="jr-sem">'+['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']
      .map(x=>'<span>'+x+'</span>').join('')+'</div>'
      +'<div class="jr-grille">'+cases+'</div>';
  } else {
    // ── LA VUE LISTE : les jours saisis du mois, du plus recent au plus ancien.
    const lignes=[];
    for(let j=n;j>=1;j--){
      const iso=ym+'-'+p2(j);
      const tj=journalTotalJour(log,iso);
      if(!tj.n) continue;
      let v=null; try{ v=jourDieteTenu(c,iso); }catch(e){ v=null; }
      const et=v===true?'oui':(v===false?'non':'neutre');
      const d=new Date(iso+'T12:00:00');
      const lib=isNaN(d.getTime())?iso:d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
      lignes.push('<button type="button" class="jr-li jr-'+et+(_ccdCalJour===iso?' jr-ouvert':'')+'"'
        +' onclick="ccdCalJour('+JSON.stringify(iso).replace(/"/g,'&quot;')+')">'
        +'<span class="jr-li-d">'+escapeHtml(lib.charAt(0).toUpperCase()+lib.slice(1))+'</span>'
        +'<span class="jr-li-r">'+repasDuJour(iso)+'</span>'
        +'<span class="jr-li-k">'+nb(tj.kcal)+' kcal</span></button>');
    }
    grille='<div class="jr-liste">'+(lignes.join('')
      ||emptyState('','Aucun jour saisi ce mois-ci.',null,null,'padding:12px 0'))+'</div>';
  }
  // ── LE DETAIL D'UN JOUR ────────────────────────────────────────────────
  let detail='';
  if(_ccdCalJour&&_calMois(_ccdCalJour)===ym){
    const tj=journalTotalJour(log,_ccdCalJour);
    const entrees=((log[_ccdCalJour]||{}).entries)||[];
    const d=new Date(_ccdCalJour+'T12:00:00');
    const lib=isNaN(d.getTime())?_ccdCalJour
      :d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
    const lignes=entrees.map(e=>'<div class="cal-e">'
      +'<span class="cal-e-n">'+escapeHtml(e.nom||'-')
      +'<span class="cal-e-r"> · '+escapeHtml(FJ_REPAS_LIB[e.repas]||e.repas||'')+'</span>'
      +(e.par==='coach'?'<span class="jr-par">ajouté par toi</span>':'')+'</span>'
      +'<span class="cal-e-v">'+(e.qty?nb(e.qty)+' g · ':'')
      +(e.kcal!=null?nb(e.kcal)+' kcal':'-')
      +(e.par==='coach'?('<button type="button" class="jr-ret" title="Retirer ce repas"'
        +' aria-label="Retirer '+escapeHtml(e.nom||'ce repas')+'"'
        +' onclick="event.stopPropagation();ccdJournalRetirer('+JSON.stringify(_ccdCalJour).replace(/"/g,'&quot;')
        +','+JSON.stringify(String(e.id||'')).replace(/"/g,'&quot;')+')">×</button>'):'')
      +'</span></div>').join('');
    detail='<div class="cal-d">'
      +'<div class="cal-d-t">'+escapeHtml(lib.charAt(0).toUpperCase()+lib.slice(1))+'</div>'
      +'<div class="cal-d-m">'+nb(tj.kcal)+' kcal · '+nb(tj.p)+' P · '+nb(tj.c)+' G · '+nb(tj.l)+' L</div>'
      +(lignes||'<div class="cal-d-v">Aucun aliment ce jour-là.</div>')
      +'<button type="button" class="jr-add jr-add-j" onclick="ccdJournalAjout('
        +JSON.stringify(_ccdCalJour).replace(/"/g,'&quot;')+')">'+icon('plus-circle',15)
      +'<span>Ajouter un repas ce jour-là</span></button>'
      +'</div>';
  }
  const leg='<div class="jr-leg">'
    +'<span><i class="jr-p jr-p-oui"></i>Dans les cibles</span>'
    +'<span><i class="jr-p jr-p-non"></i>Hors cibles</span>'
    +'<span><i class="jr-p jr-p-neutre"></i>Saisi, sans cible</span>'
    +'<span><i class="jr-p jr-p-vide"></i>Non saisi</span>'
    +'</div>';
  const astuce='<div class="jr-astuce">'+icon('info',15)
    +'<span>Astuce : touche un jour pour voir le détail de ses repas, ou une case vide pour en ajouter un.</span></div>';
  return '<div class="jr">'
    +'<div class="jr-sous">Suivi · Discipline · Résultats</div>'
    +barre+stats+form+grille
    +'<div class="jr-bas">'+leg+astuce+'</div>'
    +detail+'</div>';
}
function renderJournalNutriCoach(c){
  const z=document.getElementById('ccd-cal');
  const sect=document.getElementById('ccd-cal-sect');
  if(!z) return false;
  let dt='flexible';
  try{ dt=typeDiete((c||{}).nutrition||{}); }catch(e){ dt='flexible'; }
  let h='';
  if(dt==='flexible'){ try{ h=_htmlJournalCal(c); }catch(e){ h=''; } }
  z.innerHTML=h;
  if(sect) sect.style.display=h?'':'none';
  return !!h;
}
// PURE. Les `n` derniers jours de calendrier, du plus ancien au plus recent,
// avec le verdict de chacun. TOUS les jours, y compris ceux ou rien n'a ete
// saisi : c'est precisement ce que la bande de carres apporte au pourcentage.
// Le pourcentage ne compte que les jours JUGEABLES — un athlete qui journalise
// trois jours par mois et les tient affiche 100 %. La bande, elle, montre les
// vingt-cinq trous.
// MIDI, comme partout ailleurs dans ce fichier : 'YYYY-MM-DD' seul s'interprete
// en UTC et decalerait d'un jour a l'ouest de Greenwich.
// ⚠ CENT CINQUANTE JOURS, EN CINQ LIGNES DE TRENTE. Demande de Kevin,
// 08/09/2026 — la fenetre etait de vingt-huit jours, en semaines de sept.
// LE DECOUPAGE EN SEMAINES EST DONC PERDU : une colonne ne designe plus un
// jour de la semaine, et un trou du vendredi au dimanche ne se lit plus comme
// une colonne. Ce qu'on gagne est d'un autre ordre — cinq mois d'un coup
// d'oeil, ou l'on voit les periodes ou l'athlete a tenu et celles ou il a
// lache, ce que quatre semaines ne montraient pas.
const DRS_JOURS=150;
const DRS_COLONNES=30;
function joursDieteRecents(c,n){
  const out=[];
  const nb=Math.max(1,Number(n)||DRS_JOURS);
  const p2=x=>(x<10?'0':'')+x;
  const base=new Date(); base.setHours(12,0,0,0);
  for(let i=nb-1;i>=0;i--){
    const d=new Date(base.getTime()); d.setDate(d.getDate()-i);
    const iso=d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());
    let v=null; try{ v=jourDieteTenu(c,iso); }catch(e){ v=null; }
    out.push({iso:iso,v:v});
  }
  return out;
}
// ══ DIETE RESPECTEE — LA MAQUETTE DE KEVIN, 21/09/2026 ═══════════════════
//
// Kevin, capture a l'appui : « fais de meme, remplace cette partie par le
// second design ». L'anneau, sa legende et la bande de cent cinquante carres
// deviennent un tableau de bord : titre, anneau, trois compteurs, et le
// calendrier des trente jours.
//
// ⚠ UNE CASE PAR JOURNEE, PAS PAR REPAS. La maquette avait quatre lignes de
// repas ; Kevin, le meme jour : « pas les repas mais les jours en entier ou la
// diete est respectee ». C'est aussi la seule lecture juste : les cibles sont
// journalieres (kcal et proteines a ±10 %) et jourDieteTenu juge le TOTAL du
// jour — il n'existe pas de verdict par repas.
//
// SEPT COLONNES, LUNDI EN PREMIER, comme le journal plus bas : un trou du
// vendredi au dimanche se lit comme une colonne. Diete flexible et stricte
// partagent la meme grille, puisque les deux jugent la journee.
//
// LE MENU « 30 DERNIERS JOURS » EST UN VRAI CHOIX : les cinq fenetres de
// trente jours des cent cinquante que la bande montrait jusqu'ici — Kevin
// tenait a voir cinq mois d'un coup (08/09/2026), on ne les perd pas. L'anneau
// et les compteurs suivent la fenetre choisie : un pourcentage qui ne resume
// pas le calendrier d'a cote le contredirait.
const _DRS_SVG=(p,t,plein)=>'<svg viewBox="0 0 24 24" width="'+t+'" height="'+t+'" aria-hidden="true"'
  +(plein?' fill="currentColor"':' fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter"')
  +'>'+p+'</svg>';
// Les couverts, en tracés bruts : le bloc les pose en SVG, l'image les
// redessine en Path2D. Une seule source, deux rendus identiques.
const _DRS_D_COUVERTS=Object.freeze([
  'M4 2h1.4v5.5h1.3V2h1.4v5.5h1.3V2h1.4v6.8c0 1.6-1.1 2.9-2.6 3.2V22H6.6V12C5.1 11.7 4 10.4 4 8.8z',
  'M14.5 2c3.1.4 5 3.6 5 8.5v3H17V22h-2.5z']);
const _DRS_P_COUVERTS=_DRS_D_COUVERTS.map(p=>'<path d="'+p+'"/>').join('');
let _drsFenetre=0;      // 0 = les trente derniers jours, 1 = les trente d'avant…
let _drsClient=null;    // le dossier pour lequel _drsFenetre a ete choisie
function drsFenetre(n){
  const nb=Math.floor(DRS_JOURS/DRS_COLONNES);
  _drsFenetre=Math.max(0,Math.min(nb-1,parseInt(n,10)||0));
  try{ const c=getOwnedClient(currentClientId); if(c) renderDieteRespectCoach(c); }catch(e){}
  return _drsFenetre;
}
// Toucher un jour note l'ouvre dans le journal alimentaire, plus bas : c'est
// le « je clique sur un jour et j'ai ses donnees » du calendrier.
function drsOuvrirJour(iso){
  _ccdCalMois=_calMois(iso); _ccdCalJour=iso;
  try{ const c=getOwnedClient(currentClientId); if(c) renderJournalNutriCoach(c); }catch(e){}
  drsVoirJournal();
  return iso;
}
function drsVoirJournal(){
  const s=document.getElementById('ccd-cal-sect');
  if(!s||s.style.display==='none') return false;
  try{ s.scrollIntoView({behavior:'smooth',block:'start'}); }catch(e){ try{ s.scrollIntoView(); }catch(e2){} }
  return true;
}
// PURE, a l'etat de fenetre pres. Tout ce que le bloc et l'image affichent,
// calcule une fois : deux calculs finiraient par montrer deux chiffres.
// null quand aucun jour n'est juge en cinq mois.
function _drsDonnees(c){
  const nut=(c&&c.nutrition)||{};
  let flexible=true; try{ flexible=typeDiete(nut)==='flexible'; }catch(e){ flexible=true; }
  let tous=[]; try{ tous=joursDieteRecents(c,DRS_JOURS); }catch(e){ tous=[]; }
  if(!tous.some(j=>j.v!==null)) return null;
  const nbF=Math.floor(DRS_JOURS/DRS_COLONNES);
  const fen=w=>tous.slice(DRS_JOURS-(w+1)*DRS_COLONNES,DRS_JOURS-w*DRS_COLONNES);
  // UN AUTRE DOSSIER : on repart des trente derniers jours — ou de la fenetre
  // la plus recente qui porte un jour juge, pour ne pas ouvrir sur un vide.
  const cid=(c&&(c.id||c.email))||null;
  if(cid!==_drsClient){
    _drsClient=cid; _drsFenetre=0;
    while(_drsFenetre<nbF-1&&!fen(_drsFenetre).some(j=>j.v!==null)) _drsFenetre++;
  }
  const w=Math.max(0,Math.min(nbF-1,_drsFenetre|0));
  const jours=fen(w);
  const log=nut.log||{};
  const note=iso=>flexible&&((((log[iso]||{}).entries)||[]).length>0);
  let tenus=0,hors=0,sansCible=0,rien=0;
  jours.forEach(j=>{
    if(j.v===true) tenus++;
    else if(j.v===false) hors++;
    else if(note(j.iso)) sansCible++;
    else rien++;
  });
  const juges=tenus+hors;
  // LES TRENTE DERNIERS JOURS PASSENT PAR _tauxDieteRespectee, comme avant :
  // c'est lui qui porte la tendance du sous-titre. Il compte les memes jours
  // par le meme jourDieteTenu — s'il divergeait, on garderait le compte du
  // calendrier, que l'anneau resume.
  let di=null;
  if(w===0){ try{ di=_tauxDieteRespectee(c); }catch(e){ di=null; } }
  if(di&&(di.tenus!==tenus||di.juges!==juges)) di=null;
  if(!di&&juges) di={pct:Math.round(tenus*100/juges),tenus:tenus,juges:juges,
    flexible:flexible,jours:DRS_COLONNES,tendance:null};
  let sub=''; try{ sub=_sousTitreDiete(di); }catch(e){ sub=''; }
  const jj=iso=>iso.slice(8,10)+'/'+iso.slice(5,7);
  const libF=(l,k)=>k?('Du '+jj(l[0].iso)+' au '+jj(l[l.length-1].iso)):(DRS_COLONNES+' derniers jours');
  const date=iso=>new Date(iso+'T12:00:00');
  const cases=jours.map((j,i)=>{
    const d=date(j.iso), lisible=!isNaN(d.getTime());
    const n=parseInt(j.iso.slice(8,10),10);
    return {iso:j.iso, n:n, note:note(j.iso), auj:w===0&&i===jours.length-1,
      et:j.v===true?'oui':(j.v===false?'non':(note(j.iso)?'neutre':'vide')),
      quand:lisible?d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}):j.iso,
      // Le mois s'ecrit sur le premier jour affiche et sur chaque 1er : sans
      // lui, « 3 » ne dit pas de quel mois.
      mois:((i===0||n===1)&&lisible)?d.toLocaleDateString('fr-FR',{month:'short'}):''};
  });
  return {flexible:flexible, w:w, periodes:Array.from({length:nbF},(_,k)=>libF(fen(k),k)),
    tenus:tenus, hors:hors, sansCible:sansCible, rien:rien, juges:juges,
    pct:di?Math.max(0,Math.min(100,Number(di.pct)||0)):0, sub:sub,
    // La colonne du premier jour : lundi = 0. getDay() rend 0 pour dimanche.
    dec:(date(jours[0].iso).getDay()+6)%7, cases:cases};
}
const _DRS_LIB={oui:'diète respectée',non:'hors cible',neutre:'noté, sans cible ce jour-là',vide:'non renseigné'};
function _htmlDieteRespect(c){
  const d=_drsDonnees(c);
  // '' et non « 0 % » : aucun jour juge en cinq mois n'est pas la meme chose
  // que zero jour tenu.
  if(!d) return '';
  _drsPrechargerPhoto();
  const cases=d.cases.map(k=>{
    const titre=escapeHtml(k.quand+' : '+_DRS_LIB[k.et]);
    const cl='drs-j drs-c-'+k.et+(k.auj?' drs-j-auj':'');
    const dedans='<b>'+k.n+'</b>'+(k.mois?'<small>'+escapeHtml(k.mois)+'</small>':'');
    // Un jour note s'ouvre dans le journal ; les autres ne menent a rien.
    return k.note
      ?'<button type="button" class="'+cl+'" title="'+titre+'" aria-label="'+titre+'"'
        +' onclick="drsOuvrirJour('+JSON.stringify(k.iso).replace(/"/g,'&quot;')+')">'+dedans+'</button>'
      :'<span class="'+cl+'" title="'+titre+'" role="img" aria-label="'+titre+'">'+dedans+'</span>';
  }).join('');
  const neutres=d.cases.some(k=>k.et==='neutre');
  const ligne=(cl,lib,n)=>'<div class="drs-l"><i class="drs-p drs-p-'+cl+'"></i><span>'+lib+'</span><b>'+n+'</b></div>';
  return '<div class="drs">'
    +'<div class="drs-photo" aria-hidden="true"></div>'
    +'<div class="drs-devise" aria-hidden="true"><i></i><span>Discipline, travail et résultats</span></div>'
    +'<div class="drs-cols"><div class="drs-gauche">'
    +'<div class="drs-tete"><span class="drs-ico">'+_DRS_SVG(_DRS_P_COUVERTS,32,true)+'</span>'
      +'<div><div class="drs-titre">Diète <em>respectée</em></div>'
      +'<div class="drs-sous">Suivi nutritionnel sur '+DRS_COLONNES+' jours</div></div></div>'
    +'<div class="drs-corps"><div class="drs-g">'
    // L'ANNEAU DE LA MAQUETTE, MAIS L'ARC EN VERT. Kevin, 21/09/2026 : « mets
    // l'arc en vert ». Rouge, il mesurait les jours RESPECTES a cote d'un
    // carre rouge qui dit « hors cible » : le vert est celui des jours tenus
    // dans la legende et dans le calendrier. Toujours un cercle de
    // circonference 100 : la longueur de l'arc EST le pourcentage.
    +'<svg viewBox="0 0 40 40" role="img" aria-label="'+(d.juges?d.pct+' % des jours notés respectés':'aucun jour noté')+'">'
    +'<defs><linearGradient id="drs-deg" x1="0" y1="0" x2="1" y2="1">'
      +'<stop offset="0" stop-color="#7ee39a"/><stop offset=".5" stop-color="#34c759"/><stop offset="1" stop-color="#1e9a41"/>'
    +'</linearGradient></defs>'
    +'<circle class="drs-piste" cx="20" cy="20" r="15.915" fill="none" stroke-width="3.4"/>'
    +(d.pct>0?'<circle class="drs-arc" cx="20" cy="20" r="15.915" fill="none" stroke-width="3.4" stroke="url(#drs-deg)"'
      +' stroke-dasharray="'+d.pct+' '+(100-d.pct)+'" stroke-dashoffset="25"/>':'')
    +'</svg>'
    +'<div class="drs-pct"><b>'+(d.juges?d.pct+'<small>%</small>':'-')+'</b><span>Jours respectés</span></div></div>'
    +'<div class="drs-leg-g">'
      +ligne('oui','Jours respectés',d.tenus)
      +ligne('non','Jours hors cible',d.hors)
      +ligne('vide','Jours non renseignés',d.rien)
      +(d.sansCible?ligne('neutre','Jours notés, sans cible',d.sansCible):'')
      +(d.sub?'<div class="drs-sub">'+escapeHtml(d.sub)+'</div>':'')
    +'</div></div>'
    // LE BOUTON TELECHARGE LE VISUEL. Kevin, 21/09/2026 : « donne plutot la
    // possibilite de telecharger le visuel avec ce bouton ». « Reste
    // régulier ! » passe dans l'image : c'est a l'athlete que la phrase parle,
    // et c'est lui qui la recevra.
    +'<button type="button" class="drs-dl" onclick="telechargerDieteRespectee()">'
    +'<span class="drs-dl-ico">'+_DRS_SVG('<path d="M12 3.5v11.5"/><path d="m7 10.5 5 5 5-5"/><path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17"/>',22)+'</span>'
    +'<span class="drs-dl-t"><b>Télécharger le visuel</b><span>Image PNG, prête à envoyer à ton athlète</span></span>'
    +'</button>'
    +'</div><div class="drs-droite">'
    +'<label class="drs-per"><span class="drs-per-ico">'+_DRS_SVG('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M8 13.5h3M8 16.5h6"/>',22)+'</span>'
      +'<select onchange="drsFenetre(this.value)" aria-label="Période affichée">'
      +d.periodes.map((p,k)=>'<option value="'+k+'"'+(k===d.w?' selected':'')+'>'+p+'</option>').join('')
      +'</select><span class="drs-per-fl">'+_DV_ICO_FLECHE+'</span></label>'
    +'<div class="drs-pan">'
    +'<div class="drs-cal">'
    +'<div class="drs-sem" aria-hidden="true">'+['L','M','M','J','V','S','D'].map(x=>'<span>'+x+'</span>').join('')+'</div>'
    +'<div class="drs-grille" role="group" aria-label="Les '+DRS_COLONNES+' jours, du plus ancien au plus récent">'
    +'<span class="drs-j drs-j-hors" aria-hidden="true"></span>'.repeat(d.dec)
    +cases+'</div></div>'
    +'<div class="drs-pied"><p class="drs-note">'
      +(d.flexible
        ?'Touche un jour noté pour l’ouvrir dans le journal.'
        :'La réponse de l’athlète, jour par jour.')
    +'</p><div class="drs-leg">'
      +'<span><i class="drs-c-oui"></i>Respecté</span>'
      +'<span><i class="drs-c-non"></i>Hors cible</span>'
      +(neutres?'<span><i class="drs-c-neutre"></i>Noté, sans cible</span>':'')
      +'<span><i class="drs-c-vide"></i>Non renseigné</span>'
    +'</div></div>'
    +'</div></div></div></div>';
}
// ══ LE VISUEL A TELECHARGER ══════════════════════════════════════════════
//
// Le bloc REDESSINE sur un canevas, comme la charge du bloc et la story de
// seance : un dessin ne depend d'aucune mise en page, il sort identique sur
// tous les ecrans, et il n'emporte ni le menu ni les boutons.
// AUCUN NOM D'ATHLETE, ni dans l'image ni dans le fichier : elle peut finir
// n'importe ou.
// TOUT EST SYNCHRONE — la photo est prechargee au rendu du bloc, les polices
// sont celles que le bloc affiche deja — : le moindre await consommerait le
// geste, et iOS refuserait la sortie.
const DRS_IMG_L=1000;   // largeur logique ; le fichier sort en double
let _drsPhoto=null;
function _drsPrechargerPhoto(){
  if(_drsPhoto||typeof Image==='undefined') return;
  try{ _drsPhoto=new Image(); _drsPhoto.src='./img/diete-respectee.webp'; }catch(e){ _drsPhoto=null; }
}
// L'espacement des lettres a la main : ctx.letterSpacing manque encore a
// plusieurs navigateurs. Rend la largeur ecrite.
function _drsTexteEspace(g,txt,x,y,esp,droite){
  const car=Array.from(String(txt));
  const larg=car.reduce((a,ch)=>a+g.measureText(ch).width+esp,0)-esp;
  let cx=droite?x-larg:x;
  const al=g.textAlign; g.textAlign='left';
  for(const ch of car){ g.fillText(ch,cx,y); cx+=g.measureText(ch).width+esp; }
  g.textAlign=al;
  return larg;
}
function _drsLignesTexte(g,txt,max){
  const out=[]; let l='';
  for(const m of String(txt).split(/\s+/)){
    const t=l?l+' '+m:m;
    if(l&&g.measureText(t).width>max){ out.push(l); l=m; } else l=t;
  }
  if(l) out.push(l);
  return out;
}
function _drsArrondi(g,x,y,w,h,r){
  g.beginPath();
  g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath();
}
function dessinerDieteRespectee(c){
  const d=_drsDonnees(c);
  if(!d||typeof document==='undefined') return null;
  const K=2, L=DRS_IMG_L, P=30;
  const ROUGE=_tok('--red',ROUGE_MARQUE), TXT='#efefef', SUB='#8a8a8a';
  const COUL={oui:'#34c759',non:'#ff3b47',neutre:'rgba(255,255,255,.36)',vide:'rgba(255,255,255,.1)'};
  const T="'Bebas Neue','Arial Narrow',Impact,sans-serif", M='Montserrat,sans-serif';
  // LES DEUX COLONNES : 380 a gauche, le reste a droite.
  const LG=380, xD=P+LG+34, lD=L-P-xD;
  const lignes=Math.ceil((d.dec+d.cases.length)/7);
  const TH=30, TG=6, PP=16;
  const hPan=PP+12+8+lignes*TH+(lignes-1)*TG+16+16+PP;
  // Le menu a 12 px du haut, le calendrier 12 px sous lui, la signature dessous.
  const pY=12, yP=pY+38+12;
  const hGauche=58+26+150+22+64;
  const H=Math.max(yP+hPan+20+24,P*2+hGauche);
  const cv=document.createElement('canvas'); cv.width=L*K; cv.height=H*K;
  const g=cv.getContext('2d');
  if(!g) return null;
  g.scale(K,K);
  // LE CADRE.
  _drsArrondi(g,.75,.75,L-1.5,H-1.5,18); g.fillStyle='#0b0b0b'; g.fill();
  g.strokeStyle='rgba(224,32,32,.6)'; g.lineWidth=1.5; g.stroke();
  // LA PHOTO, fondue a gauche, a droite et en bas — deux masques qui se
  // multiplient sur un canevas a part.
  if(_drsPhoto&&_drsPhoto.complete&&_drsPhoto.naturalWidth){
    try{
      const pw=L*0.18, ph=H*0.82, px=L*0.22;
      const o=document.createElement('canvas'); o.width=Math.round(pw*K); o.height=Math.round(ph*K);
      const og=o.getContext('2d');
      const r=Math.max(o.width/_drsPhoto.naturalWidth,o.height/_drsPhoto.naturalHeight);
      const iw=_drsPhoto.naturalWidth*r, ih=_drsPhoto.naturalHeight*r;
      og.drawImage(_drsPhoto,(o.width-iw)/2,0,iw,ih);
      og.globalCompositeOperation='destination-in';
      let gr=og.createLinearGradient(0,0,o.width,0);
      gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(.3,'#000'); gr.addColorStop(.72,'#000'); gr.addColorStop(1,'rgba(0,0,0,0)');
      og.fillStyle=gr; og.fillRect(0,0,o.width,o.height);
      gr=og.createLinearGradient(0,0,0,o.height);
      gr.addColorStop(0,'#000'); gr.addColorStop(.45,'#000'); gr.addColorStop(1,'rgba(0,0,0,0)');
      og.fillStyle=gr; og.fillRect(0,0,o.width,o.height);
      g.drawImage(o,px,0,pw,ph);
      o.width=0; o.height=0;
    }catch(e){}
  }
  g.textBaseline='alphabetic'; g.textAlign='left';
  // LA DEVISE, une phrase sur une ligne, a la hauteur du menu.
  g.font='600 8.5px '+M; g.fillStyle=SUB;
  const lDev=_drsTexteEspace(g,'DISCIPLINE, TRAVAIL ET RÉSULTATS',L-P,pY+22,2,true);
  let gr=g.createLinearGradient(L-P-lDev-50,0,L-P-lDev-12,0);
  gr.addColorStop(0,'rgba(224,32,32,0)'); gr.addColorStop(1,ROUGE);
  g.fillStyle=gr; g.fillRect(L-P-lDev-50,pY+18.5,38,1.5);
  // LE TITRE ET SA PASTILLE.
  _drsArrondi(g,P,P,58,58,11); g.fillStyle='rgba(224,32,32,.08)'; g.fill();
  g.strokeStyle='rgba(224,32,32,.45)'; g.lineWidth=1; g.stroke();
  if(typeof Path2D!=='undefined'){
    g.save(); g.translate(P+13,P+13); g.scale(32/24,32/24); g.fillStyle=ROUGE;
    for(const p of _DRS_D_COUVERTS) g.fill(new Path2D(p));
    g.restore();
  }
  const xT=P+58+18;
  g.font='40px '+T; g.fillStyle=TXT; g.fillText('DIÈTE ',xT,P+37);
  const wD=g.measureText('DIÈTE ').width; g.fillStyle=ROUGE; g.fillText('RESPECTÉE',xT+wD,P+37);
  g.font='600 10px '+M; g.fillStyle=SUB;
  _drsTexteEspace(g,'SUIVI NUTRITIONNEL SUR '+DRS_COLONNES+' JOURS',xT,P+55,3);
  // L'ANNEAU, vert comme dans le bloc.
  const yA=P+58+26, cx=P+75, cy=yA+75, R=63;
  g.lineWidth=12.5; g.strokeStyle='#1e1e1e';
  g.beginPath(); g.arc(cx,cy,R,0,Math.PI*2); g.stroke();
  if(d.pct>0){
    gr=g.createLinearGradient(cx-R,cy-R,cx+R,cy+R);
    gr.addColorStop(0,'#7ee39a'); gr.addColorStop(.5,'#34c759'); gr.addColorStop(1,'#1e9a41');
    g.strokeStyle=gr; g.lineCap='butt';
    g.beginPath(); g.arc(cx,cy,R,-Math.PI/2,-Math.PI/2+Math.PI*2*d.pct/100); g.stroke();
  }
  g.fillStyle=TXT;
  if(d.juges){
    const tn=String(d.pct);
    g.font='800 40px '+M; const wn=g.measureText(tn).width;
    g.font='700 20px '+M; const wp=g.measureText('%').width;
    const x0=cx-(wn+2+wp)/2;
    g.font='800 40px '+M; g.fillText(tn,x0,cy+8);
    g.font='700 20px '+M; g.fillText('%',x0+wn+2,cy+8);
  } else { g.font='800 40px '+M; g.textAlign='center'; g.fillText('-',cx,cy+8); }
  g.textAlign='center'; g.font='500 8px '+M; g.fillStyle='#dddddd';
  g.fillText('JOURS RESPECTÉS',cx,cy+26);
  // LES COMPTEURS.
  const xl=P+172, xr=P+LG;
  const cpt=[['oui','Jours respectés',d.tenus],['non','Jours hors cible',d.hors],['vide','Jours non renseignés',d.rien]];
  if(d.sansCible) cpt.push(['neutre','Jours notés, sans cible',d.sansCible]);
  let y=yA+(cpt.length>3?10:20);
  for(const [et,lib,n] of cpt){
    _drsArrondi(g,xl,y-12,16,16,4); g.fillStyle=COUL[et]; g.fill();
    g.textAlign='left'; g.font='500 14px '+M; g.fillStyle=TXT; g.fillText(lib,xl+26,y+1);
    g.textAlign='right'; g.font='700 14px '+M; g.fillText(String(n),xr,y+1);
    y+=30;
  }
  g.fillStyle='rgba(255,255,255,.12)'; g.fillRect(xl,y-12,xr-xl,1);
  g.textAlign='left'; g.font='400 11.5px '+M; g.fillStyle=SUB;
  _drsLignesTexte(g,d.sub,xr-xl).slice(0,3).forEach((l,k)=>g.fillText(l,xl,y+8+k*16));
  // « RESTE REGULIER ! » — la phrase est pour l'athlete, qui recoit l'image.
  const yC=yA+150+22;
  _drsArrondi(g,P,yC,LG,64,12); g.fillStyle='rgba(255,255,255,.035)'; g.fill();
  g.strokeStyle='rgba(255,255,255,.14)'; g.lineWidth=1; g.stroke();
  const ix=P+32, iy=yC+32;
  g.strokeStyle=ROUGE; g.lineWidth=1.8; g.lineCap='round';
  g.beginPath(); g.arc(ix,iy,10,0,Math.PI*2); g.stroke();
  g.beginPath(); g.moveTo(ix,iy-15); g.lineTo(ix,iy-11); g.moveTo(ix,iy+11); g.lineTo(ix,iy+15);
  g.moveTo(ix-15,iy); g.lineTo(ix-11,iy); g.moveTo(ix+11,iy); g.lineTo(ix+15,iy); g.stroke();
  g.fillStyle=ROUGE; g.beginPath(); g.moveTo(ix,iy-4); g.lineTo(ix+4,iy); g.lineTo(ix,iy+4); g.lineTo(ix-4,iy); g.closePath(); g.fill();
  g.lineCap='butt';
  g.fillStyle=TXT; g.font='800 14px '+M; g.fillText('Reste régulier !',P+60,yC+27);
  g.fillStyle=SUB; g.font='400 11.5px '+M; g.fillText('Plus tu es constant, plus les résultats suivent.',P+60,yC+46);
  // LA PERIODE : une etiquette, pas un menu — une image ne se deroule pas.
  const pl=Math.min(260,lD*0.47), pX=xD;
  _drsArrondi(g,pX,pY,pl,38,10); g.fillStyle='rgba(0,0,0,.55)'; g.fill();
  g.strokeStyle='rgba(255,255,255,.22)'; g.lineWidth=1; g.stroke();
  g.strokeStyle=TXT; g.lineWidth=1.5;
  _drsArrondi(g,pX+15,pY+11,18,16,2.5); g.stroke();
  g.fillStyle=TXT; g.fillRect(pX+15,pY+16,18,1.5);
  g.font='500 14px '+M; g.fillStyle=TXT; g.textAlign='left';
  g.fillText(d.periodes[d.w]||'',pX+46,pY+24);
  // LE CALENDRIER.
  _drsArrondi(g,xD,yP,lD,hPan,14); g.fillStyle='rgba(17,17,17,.86)'; g.fill();
  g.strokeStyle='rgba(255,255,255,.1)'; g.lineWidth=1; g.stroke();
  const cw=(lD-2*PP-6*TG)/7;
  g.textAlign='center'; g.font='700 10px '+M; g.fillStyle=SUB;
  ['L','M','M','J','V','S','D'].forEach((x,k)=>g.fillText(x,xD+PP+k*(cw+TG)+cw/2,yP+PP+10));
  const y0=yP+PP+12+8;
  d.cases.forEach((k,i)=>{
    const idx=d.dec+i, col=idx%7, lig=Math.floor(idx/7);
    const x=xD+PP+col*(cw+TG), yy=y0+lig*(TH+TG);
    _drsArrondi(g,x,yy,cw,TH,6); g.fillStyle=COUL[k.et]; g.fill();
    if(k.auj){ _drsArrondi(g,x-3,yy-3,cw+6,TH+6,8); g.strokeStyle='rgba(255,255,255,.8)'; g.lineWidth=1.5; g.stroke(); }
    const fonce=k.et!=='vide';
    g.font='700 12.5px '+M; const wn=g.measureText(String(k.n)).width;
    g.font='600 9px '+M; const wm=k.mois?g.measureText(k.mois).width+5:0;
    const x0=x+cw/2-(wn+wm)/2;
    g.textAlign='left'; g.fillStyle=fonce?'#0b0b0b':SUB;
    g.font='700 12.5px '+M; g.fillText(String(k.n),x0,yy+TH/2+4.5);
    if(k.mois){ g.font='600 9px '+M; g.fillText(k.mois,x0+wn+5,yy+TH/2+4); }
  });
  // LA LEGENDE, a droite ; la regle, a gauche si elle tient.
  const yL=yP+hPan-PP-3;
  const leg=[['oui','Respecté'],['non','Hors cible']];
  if(d.cases.some(k=>k.et==='neutre')) leg.push(['neutre','Noté, sans cible']);
  leg.push(['vide','Non renseigné']);
  g.font='500 11.5px '+M;
  let xg=xD+lD-PP;
  for(const [et,lib] of leg.slice().reverse()){
    const wl=g.measureText(lib).width;
    g.textAlign='left'; g.fillStyle='#dddddd'; g.fillText(lib,xg-wl,yL);
    _drsArrondi(g,xg-wl-22,yL-11,14,14,3); g.fillStyle=COUL[et]; g.fill();
    xg-=wl+22+20;
  }
  g.font='400 10px '+M; g.fillStyle='#828282';
  const regle=d.flexible?'Une case par journée · kcal et protéines à ±10 %':'Une case par journée, déclarée par l’athlète';
  if(g.measureText(regle).width<xg-(xD+PP)) g.fillText(regle,xD+PP,yL);
  // LA SIGNATURE.
  g.textAlign='right'; g.font='600 9.5px '+M; g.fillStyle='#5a5a5a';
  g.fillText('RepCore · '+new Date().toLocaleDateString('fr-FR'),xD+lD,yP+hPan+15);
  return cv;
}
function telechargerDieteRespectee(){
  let c=null; try{ c=getOwnedClient(currentClientId); }catch(e){ c=null; }
  let cv=null; try{ cv=c?dessinerDieteRespectee(c):null; }catch(e){ cv=null; }
  if(!cv){ toast('Rien à télécharger.','var(--orange)'); return false; }
  try{ return _storySortirTelechargement(cv,'repcore-diete-respectee-'+localISODate(new Date())+'.png'); }
  catch(e){ toast('Téléchargement impossible sur cet appareil.','var(--orange)'); return false; }
}
function renderDieteRespectCoach(c){
  const z=document.getElementById('ccd-diete-respect');
  if(!z) return false;
  let h=''; try{ h=_htmlDieteRespect(c); }catch(e){ h=''; }
  // LOT N8 : la bande des quatorze derniers jours, juste sous le constat.
  let o=''; try{ o=htmlObservanceCoach(c); }catch(e){ o=''; }
  z.innerHTML=h+o;
  return !!(h||o);
}
// ══ LOT N8 : LA BANDE D'OBSERVANCE SUR LA FICHE ATHLÈTE (29/09/2026) ══════
// Quatorze jours, une case par jour, la plus récente à droite, et UNE phrase
// qui cherche le motif (les week-ends, la fin de semaine) : c'est ce que le
// coach vient lire.
//
// ⚠ ELLE NE NOTE PERSONNE : pas de score, pas de pourcentage, pas de
//   classement. Des jours tenus, des écarts, des jours sans saisie.
// ⚠ AUCUNE DONNÉE DE SANTÉ : des calories et des protéines, rien d'autre (ni
//   poids, ni photo).
// ⚠ UN JOUR SANS CIBLE EST VIDE, JAMAIS UN ÉCART : on ne sait pas à quoi le
//   comparer. Un jour sans saisie aussi.
// Le jour « tenu » est celui du lot N2 (cibleTenue : kcal à ±7 %, protéines à
// 95 % au moins), le même que les volts et la série de l'assiette.
const OBS_JOURS=14;
const OBS_MIN_SAISIS=3;
const OBS_JOURS_NOMS=Object.freeze(['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi']);
/**
 * PURE. La bande : 14 entrées {date, etat, ecartKcal, ecartProt}, de la plus
 * ancienne à la plus récente (finISO), et les moyennes des jours SAISIS.
 * @param log     nutrition.log
 * @param cibles  {kcal, p}, ou une fonction jour → {kcal, p}
 * @param finISO  le dernier jour de la bande
 */
function observance14(log,cibles,finISO){
  const L=log||{}, jours=[];
  let n=0, sk=0, sp=0, nc=0, sek=0, sep=0, tenus=0, ecarts=0;
  for(let i=OBS_JOURS-1;i>=0;i--){
    const date=_jourPlus(finISO,-i);
    const tot=journalTotalJour(L,date);
    if(!tot.n){ jours.push({date,etat:'vide',ecartKcal:null,ecartProt:null}); continue; }
    n++; sk+=tot.kcal; sp+=tot.p;
    let c=null; try{ c=(typeof cibles==='function')?cibles(date):cibles; }catch(e){ c=null; }
    const ck=Number(c&&c.kcal), cp=Number(c&&c.p);
    if(!(ck>0&&cp>0)){ jours.push({date,etat:'vide',ecartKcal:null,ecartProt:null,saisi:true}); continue; }
    const r=cibleTenue(tot,{kcal:ck,p:cp});
    const ek=Math.round(tot.kcal-ck), ep=Math.round(tot.p-cp);
    nc++; sek+=ek; sep+=ep;
    if(r.tenue) tenus++; else ecarts++;
    jours.push({date,etat:r.tenue?'tenu':'ecart',ecartKcal:ek,ecartProt:ep});
  }
  return {jours,saisis:n,tenus,ecarts,
    moyennes:n?{kcal:Math.round(sk/n),p:Math.round(sp/n),
      ecartKcal:nc?Math.round(sek/nc):null,ecartProt:nc?Math.round(sep/nc):null}:null};
}
// PURE. Le motif des écarts, par jour de la semaine.
function motifEcarts(o){
  const l=((o&&o.jours)||[]).filter(j=>j.etat==='ecart');
  if(!l.length) return '';
  const jd=j=>{ const [a,m,d]=j.date.split('-').map(Number); return new Date(a,m-1,d,12).getDay(); };
  const par={}; for(const j of l){ const d=jd(j); par[d]=(par[d]||0)+1; }
  const ds=Object.keys(par).map(Number);
  const nom=d=>OBS_JOURS_NOMS[d];
  if(l.length>=2&&ds.every(d=>d===6||d===0))
    return ds.length===2?'les écarts sont le samedi et le dimanche':'les écarts sont le '+nom(ds[0]);
  if(l.length>=2&&ds.every(d=>d===5||d===6||d===0)) return 'les écarts tombent en fin de semaine, du vendredi au dimanche';
  const top=ds.sort((a,b)=>par[b]-par[a])[0];
  if(par[top]>=2&&par[top]*2>=l.length) return 'les écarts reviennent surtout le '+nom(top);
  if(l.length===1) return 'un seul écart, le '+nom(jd(l[0]));
  return 'les écarts sont répartis sur la semaine';
}
// PURE. La phrase de synthèse, une seule.
function phraseObservance(o){
  if(!o) return '';
  const vides=o.jours.filter(j=>j.etat==='vide').length;
  const base=o.tenus+' jour'+(o.tenus>1?'s':'')+' tenu'+(o.tenus>1?'s':'')+' sur '+OBS_JOURS
    +(vides?' ('+vides+' sans saisie ou sans cible)':'');
  const m=motifEcarts(o);
  return base+(m?', '+m:', aucun écart')+'.';
}
// Ce que dit un jour survolé (ou touché) : sa date, et ses écarts.
function _obsTexteJour(j){
  let d=j.date;
  try{ const [a,m,x]=j.date.split('-').map(Number); d=new Date(a,m-1,x,12).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}); }catch(e){}
  if(j.etat==='vide') return d+' : '+(j.saisi?'pas de cible ce jour-là':'pas de saisie');
  const s=v=>(v>0?'+':'')+v;
  return d+' : '+s(j.ecartKcal)+' kcal et '+s(j.ecartProt)+' g de protéines par rapport à sa cible'+(j.etat==='tenu'?' (tenu)':'');
}
// La fiche : la bande, ou ce qu'il faut demander à l'athlète.
function htmlObservanceCoach(c,finISO){
  const nut=(c&&c.nutrition)||{};
  try{ if(typeDiete(nut)!=='flexible') return ''; }catch(e){}
  if(!nut.macros) return '';
  const fin=finISO||localISODate(new Date());
  const cib=j=>{ const m=_getEffectiveMacros(nut,nutIsOnDay(j,c),j,c)||{};
    return {kcal:Number(m.kcal)>0?Number(m.kcal):_dieteKcal(m),p:Number(m.p)||0}; };
  const o=observance14(nut.log||{},cib,fin);
  const tete='<div class="obs-tete">Ses 14 derniers jours</div>';
  if(o.saisis<OBS_MIN_SAISIS)
    return '<div class="obs">'+tete+'<p class="obs-phrase">'
      +(o.saisis?'Seulement '+o.saisis+' jour'+(o.saisis>1?'s':'')+' saisi'+(o.saisis>1?'s':'')+' sur 14 : ':'Aucun jour saisi sur 14 : ')
      +'demande-lui de noter ses repas trois jours de suite, même approximativement, dont un jour de week-end. C’est assez pour voir un motif se dessiner.</p></div>';
  const cases=o.jours.map(j=>{
    const t=escapeHtml(_obsTexteJour(j));
    return '<button type="button" class="obs-j obs-'+j.etat+'" title="'+t+'" aria-label="'+t+'" data-t="'+t+'" onclick="obsMontrer(this)"></button>';
  }).join('');
  return '<div class="obs">'+tete
    +'<div class="obs-bande" role="group" aria-label="14 jours, du plus ancien au plus récent">'+cases+'</div>'
    +'<div class="obs-leg"><span><i class="obs-tenu"></i>tenu</span><span><i class="obs-ecart"></i>écart</span><span><i class="obs-vide"></i>sans saisie</span></div>'
    +'<div class="obs-detail" aria-live="polite"></div>'
    +'<p class="obs-phrase">'+escapeHtml(phraseObservance(o))+'</p></div>';
}
function obsMontrer(b){
  const z=b&&b.closest('.obs'); const d=z&&z.querySelector('.obs-detail');
  if(d) d.textContent=b.getAttribute('data-t')||'';
  if(z) z.querySelectorAll('.obs-j').forEach(x=>x.classList.toggle('obs-choisi',x===b));
}

function saveClientNutriDiet(type){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return;
  if(!c.nutrition) c.nutrition={};
  c.nutrition.dietType=type;
  c.updatedAt=Date.now();users[c.email]=c;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(c.email,c),'Type de diète enregistré '+ICO.coche,'la diète est');
  renderCoachNutriSection(c);
  // LES TROIS BLOCS QUI DEPENDENT DU TYPE DE DIETE. Le taux de respect ne se
  // calcule pas de la meme facon dans les deux modes — jours declares en
  // stricte, ecart aux cibles en flexible — et le journal ne s'affiche qu'en
  // flexible. Ne repeindre que la grille laissait un camembert calcule selon
  // l'ancienne regle, et un calendrier qui survivait au passage en stricte.
  try{ renderDieteChoixCoach(c); }catch(e){}
  try{ renderDieteRespectCoach(c); }catch(e){}
  try{ renderJournalNutriCoach(c); }catch(e){}
}

// L'ouverture de l'accès est un geste EXPLICITE du coach, et il est réversible.
// Il n'est pas déduit de la présence d'un plan : composer et publier sont deux
// moments différents, et le coach doit pouvoir travailler son plan pendant
// plusieurs jours sans que son athlète voie le chantier.
function saveClientStrictAcces(ouvert){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return;
  if(!c.nutrition) c.nutrition={};
  c.nutrition.strictAcces=!!ouvert;
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(c.email,c),
    ouvert?'Diète stricte ouverte à l\'athlète '+ICO.coche:'Diète stricte refermée','l\'accès est');
  renderCoachNutriSection(c);
}

function saveClientNutriMacros(malgrePlancher,transmettre){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return;
  if(!c.nutrition) c.nutrition={};
  const g=id=>{const v=parseFloat(document.getElementById(id)?.value);return isNaN(v)?undefined:v;};
  // EN AUTOMATIQUE, ON RECALCULE PLUTOT QUE DE RELIRE L'ECRAN. Les champs
  // portent bien le calcul, mais les relire ferait dependre le dossier de
  // l'etat du DOM — un rendu a moitie remplace, et on ecrirait des cases vides.
  const _auto=!saisieManuelle(c)&&(()=>{ try{ const b=besoinsProposes(c,_propReglages());
    return (b&&b.source!==null)?b:null; }catch(e){ return null; } })();
  const _on=_auto?Object.assign({},_auto.on)
    :{kcal:g('ccd-on-kcal'),p:g('ccd-on-p'),g:g('ccd-on-g'),l:g('ccd-on-l'),f:g('ccd-on-f')};
  // DIÈTE NON CYCLÉE : OFF REÇOIT LES MÊMES VALEURS QUE ON. Les champs OFF ne
  // sont pas rendus dans ce mode ; les lire donnerait undefined partout, et
  // l'athlète se retrouverait sans aucune cible les jours de repos. Le modèle
  // de données ne change pas — c'est ce qui permet à tout ce qui lit ces
  // cibles de continuer sans rien savoir de ce réglage.
  const _cyc=dieteCyclee(c);
  const saisie={
    on:_on,
    off:!_cyc?Object.assign({},_on)
      :(_auto?Object.assign({},_auto.off)
            :{kcal:g('ccd-off-kcal'),p:g('ccd-off-p'),g:g('ccd-off-g'),l:g('ccd-off-l'),f:g('ccd-off-f')}),
  };
  // ⚠ UNE JOURNEE VIDE N'EST JAMAIS ENREGISTREE (24/09/2026). Avec le cyclage,
  //   la saisie manuelle ecrit DEUX journees ; une colonne laissee vide partait
  //   telle quelle, et la carte de l'athlete restait muette les jours ou elle
  //   tombait dessus — elle avait pourtant recu le dossier. Trouve au banc a
  //   deux appareils, et c'est la plainte « elle ne recoit rien ».
  //   Remplir l'une des deux suffit donc : l'autre la recopie.
  const _jourVide=b=>!b||!(Number(b.kcal)>0);
  if(_jourVide(saisie.off)&&!_jourVide(saisie.on)) saisie.off=Object.assign({},saisie.on);
  if(_jourVide(saisie.on)&&!_jourVide(saisie.off)) saisie.on=Object.assign({},saisie.off);
  // CONTRÔLE AVANT ÉCRITURE. Rien n'est écrit tant que le coach n'a pas vu.
  const viol=controlerMacros(saisie,c);
  const pl=plancherEffectif(c);
  if(viol.length){
    // ⚠ LE DERNIER REFUS EST TOMBE LE 24/09/2026. Il refusait l'ecriture quand
    //   un antecedent alimentaire etait declare au bilan de depart, ou quand
    //   plusieurs signaux de deficit energetique se cumulaient : c'etait le seul
    //   endroit de l'application ou un professionnel ne pouvait pas passer
    //   outre. J'ai signale ce qu'il protegeait ; Kevin a tranche une seconde
    //   fois, en majuscules — « ENLEVE LE AUSSI ». C'est sa prescription et ses
    //   athletes.
    //
    //   CE QUI REMPLACE LE REFUS : un avertissement qui NOMME le motif, le
    //   plancher deja majore de 15 % dans ces deux cas (donc un avertissement
    //   plus precoce), le bloc rouge sous la grille, ce que l'athlete lit de son
    //   cote, et la trace de derogation dans le dossier.
    if(pl.tca||pl.deficit){
      try{ toast(pl.tca
        ?'Antécédent alimentaire déclaré : ces cibles sont enregistrées sous le plancher'
        :'Plusieurs signaux de déficit énergétique : ces cibles sont enregistrées sous le plancher',
        'var(--red)'); }catch(e){}
    }
    // ⚠ UN SEUL CLIC (24/09/2026). Il en fallait deux : le premier montrait les
    //   violations et refusait d'ecrire, le second — case cochee — enregistrait.
    //   Kevin : « supprime les blocage et limite ». Les chiffres s'ecrivent du
    //   premier coup ; les violations restent AFFICHEES sous la grille, et la
    //   derogation reste TRACEE dans le dossier, avec qui, quand et quoi.
    //
    //   ⚠ SANS EMAIL, LA TRACE N'A RIEN A QUOI S'ATTACHER. L'ecriture passe
    //     quand meme — c'est un dossier local — mais la trace le dit.
    window._plDerniereViol={email:c.email,liste:viol};
    // Confirmation explicite : on trace QUI, QUAND, et QUOI exactement.
    // L'email de l'athlete CONCERNE, pas seulement l'identifiant du coach :
    // deux homonymes se distinguent par lui, jamais par leur nom.
    saisie.confirmeSousPlancher={par:(currentUser&&currentUser.id)||null,
      email:c.email||null,
      date:Date.now(),violations:viol.map(v=>({champ:v.champ,valeur:v.valeur,plancher:v.plancher}))};
  }
  saisie.origine=_auto?'auto':'coach';
  saisie.origineDate=Date.now();
  c.nutrition.macros=saisie;
  _histoNoter(c,transmettre?'transmis':(_auto?'auto':'coach'));
  // LES REGLAGES QUI ONT SERVI AU CALCUL PARTENT AVEC LES GRAMMES. Les deux
  // decrivent la meme decision ; les separer ferait un dossier dont les
  // cibles ne correspondent plus a ses propres reglages, et le calcul
  // automatique repartirait des valeurs suggerees a la prochaine ouverture.
  _poserReglagesCalcul(c);
  c.updatedAt=Date.now();users[c.email]=c;
  const ok=DB.set('users',users);
  // Apres un echec d'ecriture AUSSI : une confirmation qui survit a un echec
  // s'appliquerait au clic suivant, sur des chiffres que le coach croit
  // enregistres.
  window._plDerniereViol=null; _plConfirme=null;
  // ⚠ L'ENVOI EST GARDE : « Enregistrer et transmettre » attend SA reponse pour
  //   dire au coach si l'athlete a bien recu. Sans cette ligne il aurait
  //   annonce un transfert sans jamais l'avoir vu aboutir.
  const envoi=CLOUD.pushOne(c.email,c);
  window._tbDernierEnvoi=envoi;
  if(!transmettre) toastSync(ok,envoi,
    viol.length?'Enregistré, confirmation tracée':'Objectifs enregistrés '+ICO.coche,'les objectifs sont');
  renderCoachNutriSection(c);
  return true;
}

// ======= SUPPLEMENTS =======
// Les 15 noms sont EXACTEMENT ceux d'avant, au caractère près : les dossiers
// existants stockent le nom saisi, pas un identifiant. Un accent déplacé et
// l'athlète perd sa fiche. Un test compare la liste caractère par caractère.
//
// `preuve` classe la SOLIDITÉ DES PREUVES, jamais l'utilité pour quelqu'un :
//   A — beaucoup d'études convergentes
//   B — des résultats encourageants, moins nombreux
//   C — peu de données, ou des résultats qui se contredisent
// La caféine a son propre écran (mg, équivalents, historique) : elle n'est pas
// dupliquée ici, et checkSuppCaffeineRedirect continue d'y renvoyer.
//
// Le contenu de ce tableau relève de la responsabilité professionnelle du
// coach : chiffres et notes sont à relire par lui, pas par le code.
const SUPPLEMENTS_LIST=Object.freeze([
  {nom:'Créatine monohydrate',dose:'3 à 5',unite:'g',momentsRecommandes:[],preuve:'A',
   note:"La régularité compte, l'horaire non : le stock se constitue sur plusieurs semaines.",
   dureeAvantJugement:4,
   formes:[
     {cle:'monohydrate',lib:'Monohydrate',
      note:"La forme sur laquelle porte la quasi-totalité des travaux."},
     {cle:'autres',lib:'Autres formes (chlorhydrate, tamponnée…)',
      note:"Rien ne montre qu'elles fassent mieux que le monohydrate."}],
   interactions:[]},
  {nom:'Whey / Protéine en poudre',dose:'20 à 30',unite:'g',
   momentsRecommandes:['apres-entrainement','matin'],preuve:'B',
   note:"Une façon pratique d'atteindre son total de protéines quand un repas n'est pas possible.",
   interactions:[
     {avec:'BCAA',message:"Whey et BCAA au même moment : la whey apporte déjà ces acides aminés. L'un des deux suffit."},
     {avec:'EAA',message:"Whey et EAA au même moment : la whey apporte déjà ces acides aminés. L'un des deux suffit."}]},
  {nom:'BCAA',dose:'5 à 10',unite:'g',momentsRecommandes:['intra','avant-entrainement'],preuve:'C',
   note:"Peu d'intérêt quand le total de protéines de la journée est déjà atteint.",
   interactions:[
     {avec:'EAA',message:"BCAA et EAA au même moment : les EAA contiennent déjà les BCAA. L'un des deux suffit."}]},
  {nom:'EAA',dose:'10 à 15',unite:'g',momentsRecommandes:['intra','avant-entrainement'],preuve:'C',
   note:"Plus complets que les BCAA, même remarque : redondants si le total de protéines est atteint.",
   interactions:[]},
  {nom:'Oméga-3',dose:'1 à 2',unite:'g',momentsRecommandes:['midi','soir'],preuve:'B',
   note:"Avec un repas qui contient du gras : c'est là qu'ils passent le mieux.",
   formes:[
     {cle:'triglycerides',lib:'Triglycérides (TG)',
      note:"Mieux absorbée que la forme ester éthylique."},
     {cle:'esters',lib:'Esters éthyliques (EE)',
      note:"La plus répandue. Elle passe nettement mieux prise pendant un repas gras."}],
   interactions:[]},
  {nom:'Vitamine D3',dose:'1000 à 2000',unite:'UI',momentsRecommandes:['matin','midi'],preuve:'B',
   note:"Avec un repas gras. Un dosage sanguin vaut mieux que de deviner : parles-en à un professionnel de santé.",
   formes:[
     {cle:'huileuse',lib:'Gouttes ou gélule huileuse',
      note:"Le support est déjà gras : le moment du repas compte moins."},
     {cle:'seche',lib:'Comprimé sec',
      note:"À placer pendant un repas qui contient du gras."}],
   interactions:[
     {avec:'Multivitamines',message:"Vitamine D3 et multivitamines au même moment : la plupart des multivitamines en contiennent déjà. Regarde l'étiquette avant de cumuler."}]},
  {nom:'Magnésium',dose:'200 à 400',unite:'mg',momentsRecommandes:['soir','coucher'],preuve:'B',
   note:"Ici, la forme compte au moins autant que la dose.",
   formes:[
     {cle:'bisglycinate',lib:'Bisglycinate',
      note:"La mieux supportée par l'estomac aux doses courantes."},
     {cle:'citrate',lib:'Citrate',
      note:"Bien absorbée. Elle accélère le transit chez certaines personnes."},
     {cle:'oxyde',lib:'Oxyde',
      note:"La plus répandue en rayon, et la moins bien absorbée."}],
   interactions:[
     {avec:'ZMA',message:"Magnésium et ZMA au même moment : le ZMA contient déjà du magnésium, les doses s'additionnent. Espace-les de deux heures, ou n'en garde qu'un."}]},
  {nom:'ZMA',dose:'1 à 2',unite:'gélule(s)',momentsRecommandes:['coucher'],preuve:'C',
   note:"Un mélange de zinc, magnésium et vitamine B6 : rien de plus que ses composants pris séparément.",
   interactions:[
     {avec:'Multivitamines',message:"ZMA et multivitamines au même moment : le zinc s'additionne. Espace-les de deux heures."}]},
  {nom:'Multivitamines',dose:'1',unite:'comprimé(s)',momentsRecommandes:['matin'],preuve:'C',
   note:"Un filet de sécurité quand l'alimentation tourne en rond, pas un remplacement des légumes.",
   interactions:[]},
  {nom:'Glutamine',dose:'5',unite:'g',momentsRecommandes:['coucher','apres-entrainement'],preuve:'C',
   note:"Chez le sportif qui mange assez, les données ne montrent pas grand-chose.",
   interactions:[]},
  {nom:'Bêta-alanine',dose:'3 à 6',unite:'g',momentsRecommandes:[],preuve:'B',
   note:"Elle s'accumule sur plusieurs semaines : l'horaire est indifférent, la régularité non. Des picotements sur la peau sont fréquents et passent en fractionnant les prises.",
   dureeAvantJugement:4,
   interactions:[]},
  {nom:'Citrulline malate',dose:'6 à 8',unite:'g',momentsRecommandes:['avant-entrainement'],preuve:'B',
   note:"40 à 60 minutes avant la séance, à distance d'un gros repas.",
   interactions:[]},
  {nom:'Ashwagandha',dose:'300 à 600',unite:'mg',momentsRecommandes:['soir','coucher'],preuve:'C',
   note:"Plante dite adaptogène : les données restent minces en contexte sportif.",
   dureeAvantJugement:4,
   interactions:[]},
  {nom:'Collagène',dose:'10 à 15',unite:'g',momentsRecommandes:['avant-entrainement'],preuve:'C',
   note:"Souvent associé à la vitamine C, une heure avant une séance qui charge les tendons.",
   interactions:[]},
  {nom:'Probiotiques',dose:'1',unite:'gélule(s)',momentsRecommandes:['jeun','matin'],preuve:'C',
   note:"Les souches et les quantités changent énormément d'un produit à l'autre : rien de général à en dire.",
   interactions:[]},
]);

// Ce que valent A, B et C, en une phrase et sans jargon. Affiché en permanence
// sous le tableau, sans bouton de fermeture.
const SUPP_LEGENDE_PREUVE=Object.freeze([
  ['A',"Beaucoup d'études sérieuses vont dans le même sens."],
  ['B',"Des résultats encourageants, mais moins d'études."],
  ['C',"Peu de données, ou des résultats qui se contredisent."],
]);
const SUPP_LEGENDE_PIED="Ce classement parle de la solidité des preuves, pas de ce qui te serait utile à toi. C'est une conversation à avoir avec ton coach.";
// La même légende côté coach, sans le tutoiement de l'athlète : lui lire
// « parles-en avec ton coach » dans son propre écran n'avait aucun sens.
const SUPP_LEGENDE_PIED_COACH="Ce classement parle de la solidité des preuves, pas de ce qui est utile à cet athlète. C'est ton appréciation qui tranche.";
const SUPP_PREUVE_COULEUR=Object.freeze({A:'#22c55e',B:'#f59e0b',C:'#94a3b8'});

// Rapprochement d'un nom saisi et d'une fiche. On coupe au premier « / » ou
// « ( » avant de comparer : « Whey » retrouve « Whey / Protéine en poudre », et
// l'entrée « Oméga-3 (EPA/DHA) » créée par _manageCycleSupplements retrouve la
// fiche « Oméga-3 ». Les quinze formes réduites sont distinctes — un test le
// vérifie, sans quoi deux fiches se marcheraient dessus.
function _suppNorm(s){
  return String(s||'').split('/')[0].split('(')[0]
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function _suppFiche(nom){
  if(!nom) return null;
  const exact=SUPPLEMENTS_LIST.find(f=>f.nom===nom);
  if(exact) return exact;
  const n=_suppNorm(nom);
  if(!n) return null;
  return SUPPLEMENTS_LIST.find(f=>_suppNorm(f.nom)===n)||null;
}
function _suppPastille(preuve){
  const c=SUPP_PREUVE_COULEUR[preuve];
  if(!c) return '';
  return `<span title="Niveau de preuve ${preuve}" style="flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;border-radius:var(--r-1);background:${c}1f;border:1px solid ${c}66;color:${c};font-size:var(--fs-2xs);font-weight:800;line-height:1">${preuve}</span>`;
}

// Moment de prise éloigné de celui de la fiche : on le DIT, on ne bloque rien.
// Une fiche sans moment recommandé (créatine, bêta-alanine) ne produit jamais
// cette ligne : l'horaire y est indifférent.
function _suppEcartMoment(s){
  const f=_suppFiche(s&&s.name);
  if(!f||!f.momentsRecommandes.length) return '';
  const pris=(s.timings||[]).filter(id=>TIMINGS_LIST.some(t=>t.id===id));
  if(!pris.length) return '';
  if(pris.some(id=>f.momentsRecommandes.includes(id))) return '';
  const lib=id=>{const t=TIMINGS_LIST.find(x=>x.id===id);return t?t.label.toLowerCase():id;};
  return 'Placé '+pris.map(lib).join(', ')+'. Le plus souvent, c\'est plutôt '
    +f.momentsRecommandes.map(lib).join(' ou ')+'.';
}

// Deux produits en interaction connue QUI PARTAGENT un moment. Sur des moments
// différents, rien : c'est justement la solution qu'on suggère.
function _suppInteractions(list){
  const out=[];
  const actifs=(list||[]).filter(s=>s&&s.active!==false);
  for(let i=0;i<actifs.length;i++){
    for(let j=i+1;j<actifs.length;j++){
      const a=actifs[i],b=actifs[j];
      const communs=(a.timings||[]).filter(t=>(b.timings||[]).includes(t));
      if(!communs.length) continue;
      const fa=_suppFiche(a.name),fb=_suppFiche(b.name);
      if(!fa||!fb||fa===fb) continue;
      // Le message est déclaré d'UN seul côté de la paire : on regarde les deux.
      const m=(fa.interactions.find(x=>_suppNorm(x.avec)===_suppNorm(fb.nom))
            ||fb.interactions.find(x=>_suppNorm(x.avec)===_suppNorm(fa.nom))||{}).message;
      if(m&&out.indexOf(m)<0) out.push(m);
    }
  }
  return out;
}
function _htmlSuppInteractions(list){
  const l=_suppInteractions(list);
  if(!l.length) return '';
  return `<div style="background:color-mix(in srgb,var(--amber) 7%,transparent);border:1px solid color-mix(in srgb,var(--amber) 25%,transparent);border-radius:var(--r-3);padding:10px 12px;margin-bottom:12px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--amber);text-transform:uppercase;margin-bottom:6px">Au même moment</div>
    ${l.map(m=>`<div style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.6;margin-bottom:4px">· ${escapeHtml(m)}</div>`).join('')}
  </div>`;
}
function _htmlSuppLegende(isCoach){
  // EMPILÉE, UNE LIGNE PAR NIVEAU. Demande de Kevin le 21/08/2026.
  //
  // ⚠ CECI RENVERSE UNE DÉCISION DOCUMENTÉE, et la trace reste ici. Le lot
  // d'origine avait choisi deux colonnes en écrivant : « les trois niveaux se
  // comparent : les lire l'un sous l'autre oblige à faire l'aller-retour,
  // côte à côte ils se répondent. » L'argument tenait pour comparer A et B.
  // Il tenait moins pour C, que la grille rejetait seul sur une troisième
  // ligne : la lecture n'était donc ni tout à fait en colonnes, ni tout à
  // fait en pile, et le déséquilibre se voyait. Une ligne par niveau rend un
  // rythme régulier, et l'ordre A puis B puis C porte déjà la comparaison.
  return `<div style="border-top:1px solid var(--border);margin-top:6px;padding-top:12px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:10px">Niveau de preuve</div>
    <div style="display:grid;grid-template-columns:1fr;gap:8px">
      ${SUPP_LEGENDE_PREUVE.map(([k,t])=>`<div style="display:flex;align-items:flex-start;gap:8px">
        ${_suppPastille(k)}<span style="font-size:var(--fs-xs);color:#ccc;line-height:1.5">${escapeHtml(t)}</span></div>`).join('')}
    </div>
    <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6;margin-top:10px">${escapeHtml(isCoach?SUPP_LEGENDE_PIED_COACH:SUPP_LEGENDE_PIED)}</div>
  </div>`;
}

const TIMINGS_LIST=[
  {id:'matin',          label:'Matin'},
  {id:'midi',           label:'Midi'},
  {id:'apres-midi',     label:'Après-midi'},
  {id:'soir',           label:'Soir'},
  {id:'coucher',        label:'Au coucher'},
  {id:'avant-entrainement', label:'Avant entraînement'},
  {id:'apres-entrainement', label:'Après entraînement'},
  {id:'intra',          label:'Intra (pendant)'},
  {id:'jeun',           label:'À jeun'},
  {id:'toutes-4h',      label:'Toutes les 4h'},
];

// L ordre de la JOURNEE, pour l affichage seul. Tout id absent d ici retombe
// a la fin, dans l ordre de TIMINGS_LIST : une valeur ajoutee plus tard
// s affiche donc quand meme, au lieu de disparaitre.
const SUPP_ORDRE_JOURNEE=['jeun','matin','avant-entrainement','intra',
  'apres-entrainement','midi','apres-midi','soir','coucher','toutes-4h'];
function _rangMoment(id){
  const i=SUPP_ORDRE_JOURNEE.indexOf(id);
  return i<0?(100+TIMINGS_LIST.findIndex(t=>t.id===id)):i;
}
function _suppStore(){
  if(!currentUser.nutrition) currentUser.nutrition={};
  if(!Array.isArray(currentUser.nutrition.supplements)) currentUser.nutrition.supplements=[];
  return currentUser.nutrition.supplements;
}

function _suppTimingOrder(supp){
  const first=supp.timings?.[0];
  const idx=TIMINGS_LIST.findIndex(t=>t.id===first);
  return idx===-1?99:idx;
}

function _suppTimingTags(timings,small){
  if(!timings?.length) return '<span style="color:var(--text-dim);font-size:var(--fs-xs)">-</span>';
  return timings.map(id=>{
    const t=TIMINGS_LIST.find(x=>x.id===id);
    const label=t?t.label:id;
    return `<span style="display:inline-block;background:#1a0000;border:1px solid #3a0000;border-radius:var(--r-3);padding:${small?'2px 7px':'3px 9px'};font-size:${small?'9':'10'}px;font-weight:700;color:var(--red-text);margin:2px 2px 2px 0;white-space:nowrap">${label}</span>`;
  }).join('');
}

// Métadonnées d'affichage par moment de prise : ordre chronologique, couleur, icône
// LES QUATRE CHAUDES S ECARTENT EN CLARTE, PAS EN TEINTE. Matin, midi,
// apres-midi et apres-entrainement etaient quatre jaunes-oranges voisins :
// sur une pastille de 10 px, rien ne les separait. Leur ORDRE DE JOURNEE est
// conserve — c est leur luminosite qui les distingue, du plus clair au plus
// sombre : #fde047, #fb923c, #d97706, #c2410c.
const SUPP_TIMING_META={
  'jeun':               {color:'#94a3b8',svg:'<circle cx="12" cy="15" r="4"/><line x1="12" y1="5" x2="12" y2="8"/><line x1="5.6" y1="8.6" x2="7.7" y2="10.7"/><line x1="18.4" y1="8.6" x2="16.3" y2="10.7"/><line x1="3" y1="20" x2="21" y2="20"/>'},
  'matin':              {color:'#fde047',svg:'<circle cx="12" cy="12" r="4.5"/><line x1="12" y1="2" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22"/><line x1="4.2" y1="4.2" x2="6" y2="6"/><line x1="18" y1="18" x2="19.8" y2="19.8"/><line x1="2" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22" y2="12"/><line x1="4.2" y1="19.8" x2="6" y2="18"/><line x1="18" y1="6" x2="19.8" y2="4.2"/>'},
  'midi':               {color:'#fb923c',svg:'<circle cx="12" cy="12" r="5.5"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="5" y1="5" x2="6.5" y2="6.5"/><line x1="17.5" y1="6.5" x2="19" y2="5"/>'},
  'apres-midi':         {color:'#d97706',svg:'<circle cx="12" cy="13" r="4"/><line x1="12" y1="4" x2="12" y2="6.5"/><line x1="18.5" y1="7.5" x2="16.7" y2="9.3"/><line x1="20" y1="14" x2="17.5" y2="14"/><line x1="3" y1="20" x2="21" y2="20"/>'},
  'soir':               {color:'#a78bfa',svg:'<circle cx="12" cy="14" r="4"/><line x1="12" y1="5" x2="12" y2="7.5"/><line x1="5.5" y1="8.5" x2="7.3" y2="10.3"/><line x1="4" y1="15" x2="6.5" y2="15"/><line x1="3" y1="20" x2="21" y2="20"/><polyline points="9 17.5 12 20.5 15 17.5"/>'},
  'coucher':            {color:'#60a5fa',svg:'<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'},
  'avant-entrainement': {color:ROUGE_MARQUE,svg:'<path d="M6.5 6.5h11M6.5 17.5h11M4 9v6M20 9v6M8 7v10M16 7v10"/>'},
  'intra':              {color:'#22c55e',svg:'<path d="M12 2.7 C12 2.7 5.5 10 5.5 14.2 a6.5 6.5 0 0 0 13 0 C18.5 10 12 2.7 12 2.7 Z"/>'},
  'apres-entrainement': {color:'#c2410c',svg:'<path d="M6.5 6.5h11M6.5 17.5h11M4 9v6M20 9v6"/><polyline points="8.5 12 11 14.5 15.5 9.5"/>'},
  'toutes-4h':          {color:'#94a3b8',svg:'<circle cx="12" cy="12" r="9"/><polyline points="12 6.5 12 12 15.8 14"/>'}
};
