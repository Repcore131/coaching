// ══════════════ PHRASE DU JOUR ══════════════════════════
// Une phrase par jour sous la date, 365 en tout : l'annee ecoulee, on
// recommence. Le choix est DETERMINISTE — meme jour, meme phrase pour tout
// le monde — donc rien a stocker, rien a synchroniser, et aucune surprise
// entre deux ouvertures de l'app dans la meme journee.
//
// 365 PHRASES DE KEVIN, ET NON DES CITATIONS. Jeu remplace le 24/08/2026 a sa
// demande, texte pour texte. Ce sont SES phrases, ecrites dans sa voix — le
// tutoiement, aucune familiarite, aucun emoji, et une trentaine d entre elles
// a la premiere personne : « Je ne suis pas la pour te menager, mais pour te
// faire progresser. »
//
// PLUS AUCUN AUTEUR, ET C EST LA CONSEQUENCE DIRECTE. Le jeu precedent portait
// 224 auteurs distincts et un champ `a` a cote de chaque texte, parce
// qu afficher la phrase d un autre sans sa source, c est se l approprier. Ici
// il n y a personne d autre : la liste redevient un tableau de CHAINES, la
// ligne d auteur disparait du gabarit, et les guillemets qui entouraient la
// phrase aussi — on ne se cite pas soi-meme.
//
// Les modifier demande l accord de Kevin, comme les trois reperes peri-seance.
const RC_PHRASES=Object.freeze([
  "Travaille tellement que réussir devienne la seule issue possible.",
  "Ton maximum est le minimum de quelqu'un d'autre.",
  "Le but est simple : meilleur qu'hier, chaque jour, sans exception.",
  "Je ne perds jamais. Soit je gagne, soit j'apprends.",
  "Les grandes choses viennent du travail et de la persévérance.",
  "La discipline te portera là où la motivation t'abandonne.",
  "Il est rare que quelqu'un veuille sincèrement te voir réussir. J'en fais partie.",
  "Ton corps peut presque tout. C'est ton esprit qu'il faut convaincre.",
  "Le succès n'appartient pas aux plus doués, mais aux plus constants.",
  "Tu es en train de devenir quelqu'un. Choisis qui.",
  "Ce que tu répètes en silence finit toujours par se voir.",
  "Deviens la personne que ta version d'il y a un an admirerait.",
  "Il n'existe pas de raccourci vers un endroit qui vaut la peine.",
  "Le talent te fait entrer. Le travail te fait rester.",
  "Ta seule concurrence porte ton nom.",
  "Tu ne trouveras jamais le bon moment. Crée-le.",
  "La constance transforme l'ordinaire en exceptionnel.",
  "Chaque séance est une promesse tenue envers toi-même.",
  "Ce que tu construis maintenant, personne ne pourra te le reprendre.",
  "Les excuses et les résultats ne cohabitent jamais.",
  "La douleur de la discipline pèse moins lourd que celle du regret.",
  "Personne ne se souviendra de tes intentions. Ton physique, si.",
  "Un an de constance vaut mieux que dix ans d'envie.",
  "Ce qui est rare se paie en années, pas en semaines.",
  "Accumule assez de travail pour que l'échec n'ait plus de place.",
  "Rends ta réussite mathématique : additionne les séances.",
  "Le travail finit toujours par rendre ce qu'on lui a donné.",
  "Personne n'a jamais volé un résultat. Il se paie comptant.",
  "Tu récolteras exactement ce que tu auras semé, avec du retard.",
  "Ce que tu fais aujourd'hui décide de ce que tu seras dans un an.",
  "Les résultats sont lents, mais ils sont fidèles.",
  "Le travail invisible produit tout ce qui devient visible.",
  "Personne ne verra tes séances. Tout le monde verra ton corps.",
  "La sueur d'aujourd'hui est la fierté de l'année prochaine.",
  "Un effort ordinaire, répété assez longtemps, devient un résultat rare.",
  "Tu n'as pas besoin d'être exceptionnel. Tu as besoin d'être constant.",
  "La régularité est un talent que personne ne peut te voler.",
  "Ce qui se construit lentement ne s'effondre jamais vite.",
  "Les fondations que tu poses maintenant tiendront des années.",
  "Empiler les séances, c'est empiler des certitudes.",
  "Il n'y a pas de secret, seulement un calendrier respecté.",
  "Le programme parfait n'existe pas. Le programme suivi, si.",
  "L'exécution vaut mille fois l'intention.",
  "Ton plan est bon. Ton exécution décidera de tout.",
  "Fais le travail, et le travail te transformera.",
  "Ce que tu commences aujourd'hui existera encore dans dix ans.",
  "La motivation est un invité. La discipline habite chez toi.",
  "La motivation te met en route. La discipline t'emmène au bout.",
  "Attendre d'avoir envie, c'est attendre indéfiniment.",
  "La discipline commence là où l'envie s'arrête.",
  "Décide une seule fois, puis exécute mille fois.",
  "Ne redécide pas chaque matin ce que tu as déjà décidé.",
  "L'habitude gagne contre la volonté, toujours.",
  "Ce qui est planifié se réalise. Ce qui est improvisé se reporte.",
  "Le rituel l'emporte sur l'humeur du jour.",
  "Ton humeur n'a pas son mot à dire dans ta progression.",
  "Les émotions passent. Le programme reste.",
  "Sois rigoureux surtout quand personne ne le remarque.",
  "La discipline se prouve un mardi de novembre, pas un premier janvier.",
  "Tout le monde est déterminé en janvier. On se retrouve en mars.",
  "Le sérieux ne prend jamais de vacances.",
  "Rends tes engagements non négociables et tu cesseras d'hésiter.",
  "La liberté vient de la discipline, jamais de l'improvisation.",
  "Ceux qui réussissent ne sont pas plus motivés. Ils sont plus réguliers.",
  "La discipline, c'est faire ce que tu as dit, même quand tout a changé.",
  "Une décision prise à l'avance ne se rediscute plus.",
  "Supprime les choix inutiles, garde ton énergie pour l'effort.",
  "Ta parole envers toi-même est ta première charge à soulever.",
  "Le respect de soi se construit séance après séance.",
  "Chaque promesse tenue renforce celle de demain.",
  "Chaque promesse trahie coûte plus cher que la séance manquée.",
  "La constance est une forme de fidélité à soi.",
  "Ton engagement se mesure les jours où rien ne va.",
  "Trois séances par semaine pendant dix ans changent une vie entière.",
  "Le seul programme qui fonctionne est celui que tu tiens.",
  "Tu n'as personne à rattraper. Tu as quelqu'un à dépasser.",
  "Bats la personne que tu étais hier, puis recommence demain.",
  "Ton record d'hier devient ton point de départ d'aujourd'hui.",
  "Le seul classement qui compte te compare à l'an dernier.",
  "Ta progression ne regarde personne d'autre que toi.",
  "Ne compare pas ton début à l'arrivée d'un autre.",
  "Chacun avance sur sa propre ligne. Reste sur la tienne.",
  "Personne ne peut te dépasser sur un chemin qui n'appartient qu'à toi.",
  "Ton adversaire le plus sérieux, c'est ta version confortable.",
  "Le plafond, c'est toi. La clé aussi.",
  "Ce que tu tolères aujourd'hui devient ton niveau de demain.",
  "Relève ton standard et tout le reste suivra.",
  "Le seul avis qui compte vraiment est celui de ton carnet.",
  "Les chiffres disent la vérité que les impressions déforment.",
  "Mesure, ajuste, recommence. C'est tout le métier.",
  "Ce qui n'est pas mesuré finit toujours par dériver.",
  "Tu ne peux pas améliorer ce que tu refuses de regarder.",
  "Sois honnête avec tes chiffres avant de l'être avec les autres.",
  "Une progression réelle se lit sur des mois, jamais sur une séance.",
  "Les résultats appartiennent à ceux qui n'ont rien lâché en février.",
  "Beaucoup commencent. Très peu restent. Reste.",
  "La sélection ne se fait pas par le talent, mais par la durée.",
  "Ceux qui restent finissent toujours par arriver quelque part.",
  "La différence se joue sur les mois où il ne se passe rien.",
  "Continue exactement là où les autres s'arrêtent.",
  "Chaque semaine complète te sépare un peu plus de celui que tu étais.",
  "Le cumul est la force la plus sous-estimée qui existe.",
  "Additionne les journées ordinaires, tu obtiendras une décennie remarquable.",
  "Le progrès arrive toujours en retard sur l'effort. Continue quand même.",
  "Aucune progression n'est linéaire. Aucune ne l'a jamais été.",
  "Les plateaux ne sont pas des murs, ce sont des passages.",
  "Continue quand plus rien ne bouge. C'est là que tout se joue.",
  "L'avancée invisible précède toujours le saut visible.",
  "Le travail s'accumule même quand tu ne le vois pas encore.",
  "Fais confiance au cumul, il n'a jamais trahi personne.",
  "La bascule arrivera sans prévenir. Sois encore là ce jour-là.",
  "Un jour, ton avant-après surprendra ceux qui doutaient.",
  "Ce qui te semble lent aujourd'hui te paraîtra rapide dans cinq ans.",
  "Le temps passera de toute façon. Autant qu'il travaille pour toi.",
  "Dans un an, tu voudras avoir commencé aujourd'hui.",
  "Il n'y a pas de ligne d'arrivée, seulement un niveau à tenir.",
  "Construis un corps capable de te porter pendant quarante ans.",
  "La vraie performance, c'est de durer sans s'abîmer.",
  "Durer est déjà une victoire que la plupart n'obtiennent pas.",
  "Une raison expliquée reste une raison de ne pas avoir avancé.",
  "Tu ne manques pas de temps. Tu manques de priorités assumées.",
  "Les conditions idéales n'arriveront jamais. Commence sans elles.",
  "Il y aura toujours une bonne raison de reporter. Trouves-en une d'avancer.",
  "Reporter, c'est décider de ne pas faire, en plus poli.",
  "Demain est le refuge préféré de ceux qui n'avancent pas.",
  "Le lundi n'a jamais transformé personne. La constance, si.",
  "Ce que tu évites aujourd'hui t'attendra en mars.",
  "La fatigue est une information, pas une autorisation.",
  "Être occupé n'a jamais empêché personne de progresser.",
  "On ne rattrape pas six mois d'inaction en une semaine d'intensité.",
  "Le corps ne comptabilise pas les intentions.",
  "Ta progression ne fait pas crédit.",
  "Personne ne viendra te chercher. C'est une excellente nouvelle.",
  "Tu es entièrement responsable, et c'est exactement ce qui te rend libre.",
  "Cesse d'attendre un signe. Ce jour en est un.",
  "Une séance imparfaite vaut infiniment mieux qu'une séance annulée.",
  "Trente minutes réelles battent deux heures imaginées.",
  "La version réduite reste une version. L'absence, non.",
  "Présent même à soixante pour cent. Absent, jamais.",
  "Le plus difficile n'est pas l'effort, c'est la décision de commencer.",
  "Commence, et l'envie te rejoindra en route.",
  "Le corps rattrape toujours la tête, à condition de partir.",
  "Aucune séance ne s'est jamais faite toute seule.",
  "Ce soir, tu seras reconnaissant d'y être allé.",
  "Personne n'a jamais regretté une séance accomplie.",
  "Le seul entraînement que tu regretteras est celui que tu n'auras pas fait.",
  "L'action dissout les doutes que la réflexion entretient.",
  "Le doute ne survit jamais à la première série.",
  "Réfléchis moins, charge la barre davantage.",
  "Aucun débat intérieur n'a jamais soulevé quoi que ce soit.",
  "Tu ne rateras jamais une séance que tu as déjà commencée.",
  "La dernière répétition est celle qui construit tout le reste.",
  "Contrôle la descente : c'est là que le muscle travaille vraiment.",
  "L'amplitude complète vaut mieux que le kilo supplémentaire.",
  "L'ego pèse lourd et ne soulève rien.",
  "Charge ce que tu maîtrises, maîtrise ce que tu charges.",
  "Une répétition propre vaut cinq répétitions approximatives.",
  "La technique d'abord, la charge ensuite. Jamais l'inverse.",
  "Arrête la série avant que la forme parte, pas après.",
  "Ralentis le mouvement et tu gagneras plus que du poids.",
  "Le muscle comptabilise la tension, pas les kilos affichés.",
  "Ce n'est pas censé être confortable. C'est censé être bien fait.",
  "Il te reste toujours une série de plus que tu ne le crois.",
  "Une série bâclée n'entraîne rien du tout.",
  "Le silence entre les séries fait partie intégrante du travail.",
  "Tu n'as pas fini. Tu as seulement envie de finir.",
  "Sors de cette séance en sachant que tu n'as rien laissé derrière toi.",
  "Les jambes ne se cachent pas éternellement sous un pantalon.",
  "Ce que tu négliges finira par se remarquer.",
  "Travaille tes points faibles quand tu es frais, pas en fin de séance.",
  "Le déséquilibre ignoré se rappelle toujours à toi un jour.",
  "La qualité de ton échauffement conditionne la qualité de ta séance.",
  "Cinq minutes de préparation évitent deux mois d'arrêt.",
  "Tes articulations, tu les gardes toute ta vie. Traite-les bien.",
  "Écoute la douleur, tolère l'inconfort, ne confonds jamais les deux.",
  "S'entraîner blessé n'est pas du courage, c'est du retard.",
  "Un corps qui récupère est un corps qui progresse.",
  "Le repos est une partie du programme, pas une faiblesse.",
  "Le muscle se construit pendant que tu dors, pas pendant que tu forces.",
  "Dors comme quelqu'un qui a réellement des objectifs.",
  "Sept heures de sommeil valent tous les compléments du monde.",
  "Mange comme une personne qui s'entraîne sérieusement.",
  "Ton assiette est un outil de performance, pas une punition.",
  "Ce que tu fais des vingt-deux autres heures compte autant que la séance.",
  "Tu ne peux pas t'entraîner comme un professionnel et vivre comme un touriste.",
  "La performance du jour se prépare la veille au soir.",
  "L'hygiène de vie n'est pas un supplément, c'est le socle.",
  "Marcher tous les jours ne coûte rien et change beaucoup.",
  "Le stress mal géré freine autant qu'une semaine sans entraînement.",
  "Un corps entraîné soutient un esprit plus clair.",
  "La santé passe avant l'esthétique. Toujours, sans discussion.",
  "Construis un physique que ton corps pourra assumer longtemps.",
  "Ce que tu fais quand personne ne regarde décide de qui tu es.",
  "Travaille en silence et laisse les résultats faire le bruit.",
  "Annonce moins, exécute davantage.",
  "Les projets se racontent, les résultats se constatent.",
  "Ne raconte pas ta séance. Note-la.",
  "Le sérieux se lit dans les détails que personne ne remarque.",
  "La façon dont tu ranges tes charges dit qui tu es.",
  "Sois professionnel bien avant qu'on te paie pour l'être.",
  "L'amateur attend l'inspiration. Le professionnel se met au travail.",
  "Ton exigence sur les détails détermine ton niveau sur l'ensemble.",
  "Fais-le correctement ou ne le fais pas du tout.",
  "Exigeant avec ton travail, juste avec toi-même.",
  "Personne ne récompense l'effort. Seul le travail répété paie.",
  "La rareté d'un résultat vient de la rareté de l'effort consenti.",
  "Tu ne peux pas viser un physique rare avec un engagement commun.",
  "Le prix à payer est élevé. Celui de ne rien faire l'est davantage.",
  "Il faut choisir : progresser ou avoir raison.",
  "Le confort d'aujourd'hui est le prix des résultats que tu n'auras pas.",
  "Choisis ta difficulté : celle de l'effort ou celle du regret.",
  "Rien de ce qui compte vraiment ne s'obtient facilement.",
  "Si c'était simple, tout le monde l'aurait déjà.",
  "L'échec n'existe pas tant que tu en tires une leçon.",
  "Une série ratée t'enseigne plus que dix séries réussies.",
  "Chaque erreur est une information. Note-la et corrige.",
  "Tombe, comprends pourquoi, puis reviens plus solide.",
  "La seule défaite définitive, c'est de ne pas revenir.",
  "Ton retour compte plus que ton interruption.",
  "On ne repart jamais de zéro : on repart avec de l'expérience.",
  "Le corps se souvient de tout ce que tu lui as appris.",
  "Chaque reprise est plus rapide que le premier départ.",
  "Un écart ne détruit rien. Un abandon, si.",
  "Reprends au repas suivant, pas au mois suivant.",
  "Rater une séance arrive. En rater deux devient une habitude.",
  "Ne romps jamais la chaîne deux fois de suite.",
  "La culpabilité ne fait progresser personne. Le retour, si.",
  "Personne ne te juge aussi durement que tu le fais toi-même.",
  "Tu es déjà revenu de situations plus difficiles que celle-ci.",
  "Un mauvais jour n'efface pas trois bons mois.",
  "Ce que tu as construit ne disparaît pas en une semaine.",
  "Baisse la charge s'il le faut, mais garde l'habitude intacte.",
  "Recommence proprement, autant de fois que nécessaire.",
  "Reviens demain. C'est tout ce qu'on te demande.",
  "Ton corps te suit. C'est ton mental qui décide du reste.",
  "Le mental se travaille exactement comme un muscle.",
  "Ce que ton esprit accepte, ton corps finit par exécuter.",
  "Tes limites sont plus souvent des croyances que des faits.",
  "La fatigue ment souvent. Vérifie avant de la croire.",
  "Le corps abandonne bien après l'esprit.",
  "Ta tête décidera toujours avant tes jambes.",
  "Ce que tu crois impossible aujourd'hui sera ton échauffement demain.",
  "Les limites que tu acceptes deviennent les limites que tu vis.",
  "Personne ne t'a assigné de plafond. Tu l'as choisi.",
  "La confiance ne précède pas l'action, elle en découle.",
  "Chaque preuve que tu te donnes rend la suivante plus facile.",
  "Tu deviens ce que tu fais de manière répétée.",
  "Chaque décision est un vote pour la personne que tu deviens.",
  "Ton identité se construit par les actes, jamais par les mots.",
  "Tu ne construis pas seulement un physique.",
  "Ce que la salle t'apprend te servira partout ailleurs.",
  "La rigueur acquise ici se transfère à toute ta vie.",
  "Apprends à tenir parole ici, tu tiendras parole partout.",
  "Le caractère se forge dans la répétition, pas dans l'exploit.",
  "Ce que tu répètes te construit, dans un sens ou dans l'autre.",
  "Les grandes vies sont faites de journées ordinaires bien vécues.",
  "Sois quelqu'un sur qui tu peux compter.",
  "Ta discipline te définira mieux que ton apparence.",
  "On te jugera sur ce que tu tiens, pas sur ce que tu annonces.",
  "La régularité est la forme la plus haute du sérieux.",
  "Le talent ouvre des portes, le caractère les garde ouvertes.",
  "Ce que tu deviens compte plus que ce que tu obtiens.",
  "Il n'y a pas de version finale de toi, seulement une version entretenue.",
  "Tu n'es pas en retard. Tu es en cours de construction.",
  "Il n'existe aucun âge pour décider de se prendre au sérieux.",
  "Le corps répond à tout âge, à condition qu'on lui demande.",
  "Chaque année compte double quand elle est complète.",
  "Le meilleur moment pour commencer était hier. Le deuxième est maintenant.",
  "Tu ne perds jamais le temps investi dans ton corps.",
  "Ton corps est le seul endroit où tu es obligé de vivre.",
  "La santé est le capital que tout le reste suppose.",
  "Ce que tu fais pour ton corps, tu le fais pour ta tête.",
  "Bouger règle davantage de problèmes qu'on ne l'imagine.",
  "Ta séance est aussi l'heure où tu reprends la main.",
  "La salle est un endroit où personne ne peut mentir.",
  "Ici, seuls les faits comptent.",
  "La barre ne connaît ni ton statut ni tes explications.",
  "Elle monte ou elle ne monte pas. Le reste est du récit.",
  "Aucun discours n'a jamais soulevé un kilo.",
  "La vérité de ton travail apparaît sous la charge.",
  "Le miroir pose la question, l'entraînement y répond.",
  "Il n'y a pas de public à convaincre, seulement un travail à faire.",
  "Ne travaille pas pour le regard des autres. Prends-le en supplément.",
  "Ce que tu fais t'appartient, y compris les jours où c'est difficile.",
  "Ta progression est ton affaire, ton sérieux aussi.",
  "Je ne te demande pas d'être motivé. Je te demande d'être présent.",
  "Je ne suis pas là pour te ménager, mais pour te faire progresser.",
  "Je crois en toi. Ce n'est pas une raison pour te reposer dessus.",
  "Tu peux beaucoup plus que ce que tu imagines. Démontre-le.",
  "Je ne peux pas vouloir à ta place. Le reste, je m'en charge.",
  "Suis le plan, fais-moi confiance, et fais-toi confiance.",
  "Ta séance d'aujourd'hui, c'est notre engagement commun.",
  "Tu n'es pas seul, mais tu restes responsable.",
  "Je te veux solide, pas confortable.",
  "Je préfère ta régularité à tes performances exceptionnelles.",
  "Montre-moi ce que tu fais quand personne ne compte tes répétitions.",
  "Ton potentiel ne m'intéresse pas. Ton travail, énormément.",
  "Le potentiel inexploité ne vaut strictement rien.",
  "J'attends de toi ce que tu attends de toi, en un peu plus haut.",
  "Si je te le demande, c'est que tu en es capable.",
  "Aujourd'hui, tu me montres où tu en es réellement.",
  "Va chercher la série que tu croyais hors de portée.",
  "Je n'ai jamais vu quelqu'un de constant échouer.",
  "Fais ta part, la progression fera la sienne.",
  "Continue. Je vois exactement ce que tu es en train de construire.",
  "Le travail que tu fournis finira par se voir. Il finit toujours par se voir.",
  "Tu tiens encore. C'est déjà plus que la plupart.",
  "Un objectif sans date n'est qu'une intention.",
  "Écris ce que tu veux atteindre, puis découpe-le en semaines.",
  "Sache pourquoi tu fais chaque exercice, ou ne le fais pas.",
  "La clarté de ton objectif simplifie toutes tes décisions.",
  "Celui qui sait où il va trouve toujours le temps d'y aller.",
  "Un cap tenu vaut mieux qu'un plan parfait abandonné.",
  "Change de méthode quand elle ne produit plus, pas quand elle t'ennuie.",
  "Laisse au programme le temps de faire son travail.",
  "Six semaines minimum avant de juger quoi que ce soit.",
  "Une variable à la fois, sinon tu n'apprendras rien.",
  "Trop de changements tuent l'apprentissage.",
  "La patience est une compétence d'entraînement à part entière.",
  "Simplifie ton entraînement et renforce ton engagement.",
  "Fais moins de choses, mais fais-les complètement.",
  "Les bases exécutées sérieusement battent toutes les méthodes compliquées.",
  "Maîtrise ce qui est ennuyeux, c'est là que se trouvent les résultats.",
  "Ce que tu répètes mille fois devient une évidence.",
  "La maîtrise, c'est de l'ennui accepté longtemps.",
  "Les fondamentaux ne se démodent jamais.",
  "Ce que tu apprends maintenant t'évitera des années perdues.",
  "Il vaut mieux avancer lentement que reculer rapidement.",
  "À l'arrêt, tu ne progresses plus du tout.",
  "Une blessure évitée vaut plus qu'un record établi.",
  "La prudence coûte toujours moins cher que la réparation.",
  "Ce que tu gagnes en prudence, tu le conserves en longévité.",
  "Entraîne-toi aujourd'hui de façon à pouvoir t'entraîner à soixante ans.",
  "Rester dans le jeu est déjà une forme de victoire.",
  "La longévité est la performance que personne ne filme.",
  "Ce que tu construis doit tenir plus longtemps qu'une saison.",
  "Il n'y a pas de retour en arrière quand le travail est bien fait.",
  "Ce que tu apprends de toi ici vaut plus que les kilos soulevés.",
  "Ton entourage influence tes résultats plus que ton programme.",
  "Entoure-toi de gens qui te tirent vers le haut.",
  "Si tu es le plus sérieux de ton entourage, élargis ton entourage.",
  "Ce que tu admires finit par déteindre sur toi. Choisis bien.",
  "Les réseaux montrent l'arrivée, jamais les années de trajet.",
  "Ce que tu vois en photo a coûté des années à quelqu'un.",
  "Compare tes charges à celles d'hier, pas à celles des autres.",
  "La comparaison permanente est le plus court chemin vers l'abandon.",
  "Concentre-toi sur ta ligne, pas sur celle d'à côté.",
  "Ton parcours n'a aucune raison de ressembler à un autre.",
  "Ta morphologie est une donnée de départ, pas une condamnation.",
  "Adapte les mouvements à ton corps, pas ton corps aux mouvements.",
  "Ce qui fonctionne pour lui ne fonctionnera pas forcément pour toi.",
  "Teste, mesure, ajuste. C'est ainsi qu'on apprend son propre corps.",
  "La bonne méthode est simplement celle qui te fait progresser.",
  "Apprends ton corps : il ne ressemble à aucun autre.",
  "Sois humble sur les charges et ambitieux sur les années.",
  "La force se construit sur le long terme, sans aucune exception.",
  "Le raccourci le plus rapide consiste à bien faire dès le premier jour.",
  "Ce que tu fais bien tout de suite, tu n'auras pas à le corriger.",
  "La rigueur du début détermine la vitesse de la suite.",
  "Sois impatient sur l'effort, patient sur les résultats.",
  "Ceux qui n'ont pas d'excuses ont des progrès.",
  "Fais maintenant ce que tu remettrais volontiers à demain.",
  "Je ne juge personne sur une séance. Sur une année, oui.",
  "Rien à démontrer aux autres. Tout à construire pour toi.",
  "Aujourd'hui encore, meilleur qu'hier. Sans exception."
]);
// Le quantieme du jour, 1 au 1er janvier.
//
// Calcule sur DEUX reperes UTC construits depuis les composantes locales, et
// non par une soustraction de deux dates locales : le jour du changement
// d'heure ne dure pas 24 h, et une division par 86 400 000 y perd un jour.
// L'athlete qui ouvre l'app entre minuit et une heure, le dimanche du
// passage a l'heure d'ete, aurait relu la phrase de la veille.
function _rcQuantieme(d){
  const a=d.getFullYear();
  return Math.round((Date.UTC(a,d.getMonth(),d.getDate())-Date.UTC(a,0,1))/864e5)+1;
}
// Le 366e jour d'une annee bissextile reprend la premiere phrase.
// Rend la CHAINE, et plus un couple {t,a} : il n y a plus d auteur a rendre.
//
// LE QUANTIEME RESTE CALCULE PAR _rcQuantieme, sur deux reperes UTC. Les deux
// jeux de phrases sont arrives avec leur propre getDayOfYear, et les deux
// soustrayaient deux dates LOCALES avant de diviser par 86 400 000 : le jour
// du changement d heure ne dure pas 24 h, la division y perd un jour, et
// l athlete qui ouvre l app entre minuit et une heure ce dimanche-la relirait
// la phrase de la veille. On garde donc celui du depot.
function phraseDuJour(d){
  const j=_rcQuantieme(d instanceof Date?d:new Date());
  return RC_PHRASES[(j-1)%RC_PHRASES.length];
}
// LE JOUR QUE LE DERNIER RENDU D ACCUEIL A ECRIT A L ECRAN.
//
// clh-date n’est posée que par loadClientHome, et la boucle de 30 s ne
// repeint que si la synchro a rapporté un changement de DONNÉES. Minuit n’en
// est pas un : une app laissée ouverte affichait la date de la veille.
//
// On mémorise le jour AFFICHÉ plutôt que de comparer deux horloges : c’est
// l’écart entre ce qui est à l’écran et ce qu’il est vraiment qui compte.
let _jourAffiche=null;
// PURE au sens qui compte : elle ne décide que du repeint. localISODate est
// le même calcul que _jourLocal dans sw.js — jour LOCAL, jamais UTC, sans
// quoi le changement de date arriverait à 2 h du matin en été.
function _repeindreSiJourChange(){
  if(!currentUser) return false;
  if(_jourAffiche===localISODate(new Date())) return false;
  // MÊME GARDE DE SAISIE que la boucle de synchronisation : repeindre sous
  // les doigts fait perdre le focus et les caractères tapés. Le réveil
  // suivant s’en chargera — la date est en retard d’une minute, pas d’un jour.
  const _ae=document.activeElement;
  if(_ae&&_ae.matches&&_ae.matches('input,textarea,select')) return false;
  // Seulement si l’accueil est À L’ÉCRAN. Ailleurs, rien n’affiche cette date,
  // et y revenir passe de toute façon par le rendu qui la réécrit.
  if(currentUser.role==='athlete'
     &&document.getElementById('s-client-home')?.classList.contains('active')){
    loadClientHome(); return true;
  }
  if(currentUser.role==='coach'
     &&document.getElementById('s-coach-home')?.classList.contains('active')){
    loadCoachHome(); return true;
  }
  return false;
}
// ══ BUILD 1886 : LA CARTE DU MOMENT ═════════════════════════════════════════
// Une seule carte, sous le bonjour : l'action du jour, visible sans défiler.
// Elle ne fait que choisir et RÉUTILISER les gestes existants.
/**
 * PURE. env = {snap:{progName,heures,series}|null, draft:{type,etape,total}|null,
 *   retard:number (jours), seanceDuJour:{nom}|null, premiere:bool,
 *   prochaine:{nom,jour}|null}
 */
function carteDuMoment(u,maintenant,env){
  const e=env||{};
  if(e.snap) return {type:'reprise_seance',titre:e.snap.heures>6?'Séance non terminée':'Reprends ta séance',
    sousTitre:(e.snap.progName||'Séance en pause')+(e.snap.series?' · '+e.snap.series+' série'+(e.snap.series>1?'s':'')+' faite'+(e.snap.series>1?'s':''):''),action:'woResumeAndGo()'};
  if(e.draft) return {type:'reprise_bilan',titre:e.draft.type==='depart'?'Reprends ton questionnaire':'Reprends ton bilan',
    sousTitre:'Étape '+e.draft.etape+'/'+e.draft.total+' : là où tu t’es arrêté',action:'bilResumeAndGo()'};
  if(Number(e.retard)>0) return {type:'bilan_retard',titre:'Ton bilan est à faire',
    sousTitre:'En retard de '+e.retard+' jour'+(e.retard>1?'s':''),action:"openBilan('coaching')"};
  if(e.seanceDuJour) return {type:'seance_du_jour',titre:'Démarrer ma séance',sousTitre:e.seanceDuJour.nom||'Séance du jour',action:'openSessionPicker()'};
  if(e.premiere) return {type:'premiere_seance',titre:'Ta première séance',sousTitre:'Ton programme est prêt',action:'openSessionPicker()'};
  return {type:'repos',titre:'Jour de repos',sousTitre:e.prochaine?('Prochaine séance '+e.prochaine.jour+' : '+(e.prochaine.nom||'séance')):'Récupère bien',action:null};
}
// L'environnement, lu sur le dossier local (hors ligne compris).
function _envMoment(u,t){
  const env={};
  try{
    const sn=_woLoadSnap();
    if(sn&&_woSnapAMoi(sn)){
      let ob=null; try{ ob=seanceOubliee(sn,t); }catch(e){ ob=null; }
      env.snap={progName:sn.progName,heures:ob?ob.heuresDepuis:0,series:ob?ob.series:0};
    }
  }catch(e){}
  try{
    const d=_bilLoadDraft();
    if(d&&_bilDraftRempli(d)>0){
      const steps=_etapesUtiles(d.bilType==='depart'?DEB_STEPS:BIL_STEPS);
      env.draft={type:d.bilType,etape:Math.min(steps.length,(Number(d.bilStep)||0)+1),total:steps.length};
    }
  }catch(e){}
  try{ const ec=echeanceBilan(u,t); if(_bilTexteRetard(ec.retardJours)) env.retard=ec.retardJours; }catch(e){}
  try{ const s=seancePrevueDuJour(u,t); if(s&&!((u.sessions||[]).some(x=>x&&localISODate(new Date(x.date))===localISODate(new Date(t))))) env.seanceDuJour={nom:s.name}; }catch(e){}
  try{ env.premiere=!(u.sessions||[]).length&&(u.sessions_config||[]).some(x=>x&&x.active&&(x.exercises||[]).length); }catch(e){}
  try{
    for(let k=1;k<=7;k++){ const s=seancePrevueDuJour(u,t+k*864e5); if(s){ env.prochaine={nom:s.name,jour:k===1?'demain':new Date(t+k*864e5).toLocaleDateString('fr-FR',{weekday:'long'})}; break; } }
  }catch(e){}
  return env;
}
let _momentDernier=0;
// Anti-rebond : un double toucher n'ouvre pas deux écrans.
const MOMENT_GESTES=Object.freeze({reprise_seance:()=>woResumeAndGo(),reprise_bilan:()=>bilResumeAndGo(),
  bilan_retard:()=>openBilan('coaching'),seance_du_jour:()=>openSessionPicker(),premiere_seance:()=>openSessionPicker()});
function carteMomentAgir(type){
  const t=Date.now();
  if(t-_momentDernier<800) return false;
  _momentDernier=t;
  const f=MOMENT_GESTES[type];
  if(!f) return false;
  try{ f(); }catch(e){ return false; }
  return true;
}
function _rendreCarteMoment(u){
  const z=document.getElementById('clh-moment');
  if(!z||!u||u.role==='coach') return null;
  const t=Date.now();
  const c=carteDuMoment(u,t,_envMoment(u,t));
  z.innerHTML='<div class="gv-carte clh-moment" data-type="'+c.type+'"'+(c.action?' role="button" tabindex="0" onclick="carteMomentAgir(\''+c.type+'\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click()}"':'')+' style="margin-bottom:14px;padding:14px 16px;cursor:'+(c.action?'pointer':'default')+'">'
    +'<div style="font-weight:800;font-size:var(--fs-md)">'+escapeHtml(c.titre)+'</div>'
    +'<div class="sub" style="font-size:var(--fs-xs);margin-top:2px">'+escapeHtml(c.sousTitre||'')+'</div></div>';
  // Pas de doublon plus bas.
  const cache=(id,oui)=>{ const el=document.getElementById(id); if(el&&oui) el.style.display='none'; };
  cache('clh-resume-workout',c.type==='reprise_seance');
  cache('clh-resume-bilan',c.type==='reprise_bilan');
  cache('clh-bilan-alert',c.type==='bilan_retard');
  return c;
}
function loadClientHome(){
  try{ _majRappelVerification(); }catch(e){}
  // LE BLOC SUIVANT DÉMARRE CE LUNDI (06/10/2026) : il devient le programme.
  try{ if(currentUser&&currentUser.role!=='coach'&&basculerBlocSuivant(currentUser,Date.now())){ saveUser(); CLOUD.pushOne(currentUser.email,currentUser); } }catch(e){}
  // LA DÉCHARGE D'UN CRÉNEAU EST DATÉE (06/10/2026) : un ancien `deload:true`
  // reçoit sa fin de semaine à la première lecture ; une décharge échue
  // s'efface. Même chemin d'écriture que la bascule de bloc.
  // Phase et objectif nutrition réconciliés chez l'athlète sans coach (build 1833).
  try{ if(currentUser&&syncPhaseObjectif(currentUser)){ currentUser.updatedAt=Date.now(); saveUser(); CLOUD.pushOne(currentUser.email,currentUser); } }catch(e){}
  try{ if(currentUser&&currentUser.role!=='coach'&&migrerDechargesCreneaux(currentUser,Date.now())){ currentUser.updatedAt=Date.now(); saveUser(); CLOUD.pushOne(currentUser.email,currentUser); } }catch(e){}
  // ⚠ LES DEUX ACCUEILS DE NOUVEL INSCRIT NE SONT PLUS ICI. Ils y ont vecu
  // quelques heures le 15/09/2026, et c'etait la mauvaise couche :
  // loadClientHome est un RENDU, appele par la boucle de synchronisation, par
  // chaque retour d'onglet, par la fleche de retour et par une dizaine de
  // tests. Un garde qui sort en `return` avant de peindre y transforme chaque
  // appelant en aiguillage sans le lui dire — deux assertions de ce depot sont
  // tombees en le montrant, et c'est exactement ce qu'elles devaient faire.
  // Ils vivent desormais dans routeUser, le seul endroit qui decide OU un
  // athlete atterrit. Voir _aiguillerNouvelInscrit.
  // Posé À CHAQUE rendu : c’est lui qui vient d’écrire la date.
  _jourAffiche=localISODate(new Date());
  // La santé synchronisée (Health Connect, Raccourci iPhone) : au plus une
  // lecture par 10 minutes, voir sanSyncTirer.
  try{ setTimeout(()=>{ sanSyncTirer().catch(()=>{}); },4000); }catch(e){}
  // RATTRAPAGE DE L'ANNUAIRE, une fois par session. Les athlètes déjà
  // rattachés avant l'existence de ce nœud n'y figurent pas : sans cette
  // ligne, leur coach ne les découvrirait qu'après un nouveau rattachement,
  // c'est-à-dire jamais. Une seule fois : loadClientHome est rappelée par la
  // boucle de synchronisation et par chaque retour sur l'accueil.
  if(!window._annuairePose){ window._annuairePose=true;
    try{ CLOUD.pushAnnuaire(currentUser); }catch(e){} }
  // LES SEMAINES REVOLUES SE RATTRAPENT ICI, une fois par session : l'athlete
  // qui ouvre l'app le lundi doit trouver ses reperes a jour sans avoir rien a
  // faire. appliquerRetourMuscle refuse de rejouer une semaine deja traitee,
  // donc un second passage ne deplace rien.
  if(!window._retoursAppliques){ window._retoursAppliques=true;
    try{ appliquerRetoursEnAttente(currentUser); }catch(e){} }
  // LES BADGES DÉJÀ MÉRITÉS, rendus une fois par session : un athlète ancien
  // retrouve toute sa collection à la mise à jour, datée, sans attendre sa
  // prochaine séance — et une seule bannière récapitulative.
  // LES JOKERS AVANT LE COMPTEUR : une série sauvée s'affiche sauvée.
  try{ _streakRattrapage(); }catch(e){}
  // LE PARCOURS « MISE SOUS TENSION » : avant le rattrapage, pour que sa fin
  // soit fêtée en écran plein et pas noyée dans le récapitulatif.
  try{ parcoursAvancer(); }catch(e){}
  _rattraperBadges();
  // LE WRAPPED du mois (1er-7) ou de l'année (décembre), s'il y a de quoi.
  try{ _rendreCarteWrapped(); }catch(e){}
  try{ rcRendreRetourAccueil(); }catch(e){}
  // LE MOT AU COACH. Repeint a chaque retour sur l'accueil : l'edition en
  // cours est portee par _motEdition, elle ne se perd donc pas au passage.
  try{ renderMotCoach(); }catch(e){}
  try{
    // #clh-echeance-prepa, PAS #clh-echeance : le premier est le bandeau de
    // fin d'acces, en tete d'ecran, et il ne nous appartient pas. Voir le
    // commentaire pose sur le noeud.
    const _z=document.getElementById('clh-echeance-prepa');
    const _l=ligneEcheance(currentUser);
    if(_z){
      _z.innerHTML=_l
        ? '<div onclick="ouvrirEcheanceEcran()" role="button" tabindex="0" '
          +'onkeydown="if(event.key===&quot;Enter&quot;||event.key===&quot; &quot;){event.preventDefault();this.click()}" '
          +'style="background:color-mix(in srgb,var(--red) 7%,transparent);border:1px solid var(--red);border-radius:var(--r-3);'
          +'padding:12px 14px;cursor:pointer;font-size:var(--fs-sm);color:var(--text);font-weight:700">'
          +escapeHtml(_l)+'</div>'
        : '';
      _z.style.display=_l?'block':'none';
    }
  }catch(e){}
  go('s-client-home');
  // ANIMATION 12. Armé ici, et l'action est loadClientHome elle-même : tirer
  // rejoue EXACTEMENT ce que fait déjà l'arrivée sur l'accueil — la même
  // synchronisation, les mêmes rappels, les mêmes rendus. Aucune logique
  // métier n'est écrite pour l'occasion, c'est un chemin existant qu'on rend
  // atteignable au doigt. La garde interne empêche le réarmement à chaque
  // passage. Une autre zone se branche en une ligne, sur le même modèle.
  try{ arcTirerPourRafraichir(document.querySelector('#s-client-home .scroll-area'),
       loadClientHome); }catch(e){}
  // COULOIR DE RETOUR. La synchronisation vient AVANT les rappels : elle
  // décide s'ils ont le droit de partir. Elle n'écrit que si l'état a changé,
  // et re-désarme la copie du service worker dans ce cas.
  try{
    if(suspensionSynchroniser(currentUser)){ saveUser(); scheduleWoNotif(); }
  }catch(e){}
  // Vérification rappel bilan (samedi toutes les 2 semaines, 7h)
  setTimeout(checkBilanNotifToday, 800);
  // REGLE 2, troisieme porte : passage en arriere-plan. Pose une seule
  // fois, et idempotent — _scanVisPose empeche l empilement d ecouteurs.
  try{
    if(!window._scanVisPose){
      window._scanVisPose=true;
      document.addEventListener('visibilitychange',()=>{
        if(document.visibilityState!=='visible') try{ scanArreter(); }catch(e){}
      });
    }
  }catch(e){}
  setTimeout(checkWoReminderToday, 1100);
  setTimeout(()=>{ try{ verifierRappelAvantSeance(); }catch(e){} }, 1300);
  // Rite de fin de cycle : il s AFFICHE, il ne notifie pas, et il ne bloque
  // jamais l acces. riteAAfficher decide seule.
  setTimeout(()=>{ try{ riteAfficherSiBesoin(); }catch(e){} },1400);
  const u=currentUser;
  // clh-avatar replaced by logo badge
  document.getElementById('clh-name').textContent=((u.fname||'')+' '+(u.lname||'')).trim()||'Profil incomplet';
  // Le rang et la jauge des volts, sous le prénom. majXp y tourne : c'est
  // aussi le rattrapage d'un dossier ancien à la mise à jour.
  try{ _rendreRang(u); }catch(e){}
  // MA LIGUE, sous le rang (le classement du serveur, relu toutes les 10 min).
  try{ _rendreLigue(u); }catch(e){}
  // LA MISSION DU JOUR, sous l'en-tête : trois cases relues dans les faits.
  try{ _rendreMission(u); }catch(e){}
  // La carte d'athlète : recalculée le lundi, montrée quand la note monte.
  try{ _rendreCarteAccueil(u); }catch(e){}
  // Le record à portée de la séance du jour, dans la carte Entraînement.
  // « RECORD À PORTÉE » QUITTE L'ACCUEIL (Kevin, 28/09/2026) : la carte
  // Entraînement garde ses trois boutons. Il reste en tête de séance.
  // Le check-in du matin (jusqu'à 14 h) ou la batterie du jour ; la reprise
  // en douceur après 30 jours sans séance.
  try{ _rendreCheckin(u); }catch(e){}
  try{ _rendreMobilisation(u); }catch(e){}
  try{ _rendreRelanceAthlete(u).catch(()=>{}); }catch(e){}
  // « Demander à RepCore » : autonome en Ultime seulement.
  try{ renderEntreeAssistant(u); }catch(e){}
  // LOT M2 : « Mon coach », le fil privé.
  try{ _rendreEntreeMessagesAthlete().catch(()=>{}); }catch(e){}
  try{ _afficherRepriseDouce(u); }catch(e){}
  // Le résumé d'activité (rétention agrégée par le serveur), une fois par jour.
  try{ setTimeout(()=>{ activitePublier(u).catch(()=>{}); },6000); }catch(e){}
  // Le tonnage cumulé, posé une fois pour un dossier d'avant ce champ.
  try{ const _tt=tonnageTotalDe(u); if(u.role!=='coach'&&u.tonnageTotal!==_tt){ u.tonnageTotal=_tt; saveUser(); } }catch(e){}
  // Le rappel du défi en cours.
  try{ renderDefiAccueil(); }catch(e){}
  // Les duels (l'invitation reçue, ceux en cours) et le défi RepCore du mois.
  try{ _rendreDuelsAccueil(); }catch(e){}
  // Le carnet d'amis n'est plus sur l'accueil : il vit dans la feuille
  // « Mes défis » (ouvrirDuelsHub), là où l'on cherche à défier un pote.
  try{ renderDefiMoisAccueil(); }catch(e){}
  // L'événement saisonnier : la bannière (et la valeur de l'athlète, écrite).
  try{ renderSaisonAccueil(); }catch(e){}
  // Une fois par jour : défis bouclés et parrainage (badges et mois gagnés).
  try{ majRecompensesServeur(); }catch(e){}
  try{ majPagePublique(); }catch(e){}
  // Avatar athlète
  const avatar=document.getElementById('clh-athlete-avatar');
  if(avatar) avatar.innerHTML=u.athletePhoto?`<img src="${escapeHtml(u.athletePhoto)}" style="width:100%;height:100%;object-fit:cover">`:ini(u.fname,u.lname);
  const s=streakSemaines(u);
  // Le compteur de l'en-tete subsiste, reduit. La case « Semaines » a quitte
  // les metriques : elle reste consultable dans l'onglet Perfs.
  _rendreStreak(u,s);
  try{ _rendreSerieAssiette(u); }catch(e){}
  document.getElementById('clh-greeting').textContent=salutation()+' '+u.fname+'.';
  // textContent et non innerHTML : ces phrases n'ont aucune raison de
  // traverser l'analyseur HTML.
  // NI GUILLEMETS NI AUTEUR depuis le 24/08/2026 : les 365 phrases sont
  // desormais celles de Kevin, pas des citations. Les guillemets annonçaient
  // une parole rapportee, et la ligne d auteur n a plus rien a porter — elle a
  // quitte le gabarit avec ce lot.
  // textContent et non innerHTML : ces textes n ont aucune raison de traverser
  // l analyseur HTML.
  const _phr=document.getElementById('clh-phrase');
  if(_phr) _phr.textContent=phraseDuJour();
  // ── Trois chiffres d'entraînement ──
  // Le total de séances et le poids ont quitté cet écran : le premier compte
  // des présences, le second est déjà porté par la carte « Pesée du jour »
  // juste en dessous. Total et Semaines restent dans l'onglet Perfs.
  _majMetriquesAccueil(u);
  // ⚠ APRES les trois chiffres, jamais avant : c'est _rendreReprise qui decide
  // de les MASQUER, et les masquer avant que _majMetriquesAccueil les remplisse
  // les laisserait remplis puis caches — le meme travail, fait pour rien, et un
  // ordre qui se lit a l'envers.
  // ET AVANT les blocs de sante, qui sont rendus juste apres et qu'il ne touche
  // pas : l'echeance d'acces, les signes a faire examiner et la douleur gardent
  // leur place et leur priorite.
  try{ _rendreReprise(); }catch(e){}
  // R36 — « Pour démarrer », APRES la reprise : pendant qu'il est affiche, la
  // feuille masque la carte de reprise, dont sa deuxieme ligne tient lieu.
  try{ _rendreDemarrage(); }catch(e){}
  // ⚠ LE POINT DU JOUR AVANT LA CARTE DE PESEE. renderCartePesee se tait
  // quand la question du jour est celle du poids, et elle lit pdjEtat pour le
  // savoir : l'ordre n'est donc pas ce qui empeche le doublon, c'est la garde.
  // Il reste que rendre la question d'abord evite de peindre une carte de
  // pesee pour l'effacer dans la ligne suivante.
  // ET APRES _rendreReprise, dont il depend : pdjEtat se tait quand le bloc de
  // reprise occupe le haut de l'ecran.
  _rendrePointDuJour();
  // LOT N1 : le point de la semaine, le jour du rendez-vous seulement.
  try{ _rendrePointSemaine(); }catch(e){}
  _rendreEssai();
  renderCartePesee();
  renderContraintesAthlete();
  renderDouleurAthlete();
  renderEpingleAccueil();
  // La réponse du coach à un bilan de fin de cycle : à côté du mot du coach,
  // parce que c’est la même chose — sa parole, adressée à cet athlète-là.
  renderRiteReponse();
  renderBandeauPhase();renderRelancePhase();renderCartePhase();
  renderSuspension();
  renderHabitudes();
  renderNutriDots();renderNotifs();renderWoReminderCard();
  const _hasDepart=(currentUser.bilans||[]).some(b=>b.type==='depart');
  const _firstCard=document.getElementById('clh-first-bilan-card');
  if(_firstCard) _firstCard.style.display=(!_hasDepart)?'block':'none';
  const _snap=_woLoadSnap();
  const _resumeEl=document.getElementById('clh-resume-workout');
  const _resumeName=document.getElementById('clh-resume-name');
  if(_resumeEl){_resumeEl.style.display=_snap?'block':'none';}
  if(_resumeName&&_snap) _resumeName.textContent=_snap.progName||'Reprendre ma séance';
  // BUILD 1862 : plus de 6 h sans activité — « Séance de <jour> non terminée ·
  // N séries », et un second bouton « L'enregistrer », de la même taille.
  try{
    const _ob=_snap?seanceOubliee(_snap,Date.now()):null;
    const _oub=!!(_ob&&_ob.heuresDepuis>SEANCE_OUBLIEE_H);
    const _btn=_resumeEl&&_resumeEl.querySelector('.gv-btn:not(.gv-btn-enr)');
    let _enr=_resumeEl&&_resumeEl.querySelector('.gv-btn-enr');
    const _sous=_resumeEl&&_resumeEl.querySelector('.gv-sous');
    if(_oub&&_resumeName){
      const _j=_libJourSeance(_ob.fin);
      _resumeName.textContent='Séance '+(_j==='aujourd’hui'||_j==='hier'?'d’':'de ')+_j+' non terminée · '+_ob.series+' série'+(_ob.series>1?'s':'');
    }
    if(_sous) _sous.textContent=_oub?'Tu as oublié de la terminer':'Ta séance est en pause';
    if(_btn){ const sp=_btn.querySelector('span'); if(sp) sp.textContent=_oub?'Reprendre':'Reprendre maintenant'; }
    if(_oub&&_btn&&!_enr){
      _enr=document.createElement('button'); _enr.type='button'; _enr.className='gv-btn gv-btn-enr';
      _enr.innerHTML='<span>L’enregistrer</span>';
      _enr.onclick=ev=>{ ev.stopPropagation(); enregistrerSeanceOubliee(); };
      _btn.insertAdjacentElement('afterend',_enr);
    }
    if(_enr) _enr.style.display=_oub?'':'none';
  }catch(e){}
  // Reprise de bilan — même mécanique que la reprise de séance ci-dessus.
  const _bilDraft=_bilLoadDraft();
  const _bilEl=document.getElementById('clh-resume-bilan');
  if(_bilEl){
    const montrer=!!_bilDraft&&_bilDraftRempli(_bilDraft)>0;
    _bilEl.style.display=montrer?'block':'none';
    if(montrer){
      const nom=document.getElementById('clh-resume-bilan-name');
      const sub=document.getElementById('clh-resume-bilan-sub');
      const steps=_etapesUtiles(_bilDraft.bilType==='depart'?DEB_STEPS:BIL_STEPS);
      if(nom) nom.textContent=_bilDraft.bilType==='depart'
        ?'Reprendre mon questionnaire de début':'Reprendre mon bilan coaching';
      if(sub) sub.textContent='Étape '+(_bilDraft.bilStep+1)+'/'+steps.length
        +' : reprendre là où tu t\'es arrêté →';
    }
  }
  // LE RAPPEL DE BILAN, TOUS LES JOURS ET PLUS SEULEMENT LE SAMEDI. Cette
  // carte était dans le DOM depuis toujours en display:none et rien ne
  // l'allumait ; le seul rappel restant, showBilanNotifBanner, ne sort que le
  // samedi après 7 h. Un athlète qui n'ouvre pas l'app ce jour-là n'entendait
  // plus parler de son bilan pendant deux semaines.
  //
  // getNextBilanSaturday rend null sans aucun bilan : le premier questionnaire
  // a sa propre carte, clh-first-bilan-card, juste au-dessus.
  const _alerte=document.getElementById('clh-bilan-alert');
  if(_alerte){
    let _h='';
    try{
      // La même échéance que le coach (needsAlert) : echeanceBilan.
      const _e=echeanceBilan(currentUser,Date.now());
      const _n=_e.retardJours;
      if(_bilTexteRetard(_n)){
        const _der=dernierBilan(currentUser);
        _h=_htmlBilanRetard({retard:_n,echeance:_e.echeance||0,dernier:_der?_der.date:0,freq:_e.freq});
      }
    }catch(e){ _h=''; }
    _alerte.innerHTML=_h;
    _alerte.style.display=_h?'block':'none';
  }
  // BUILD 1886 : la carte du moment (et les doublons masqués plus bas).
  try{ _rendreCarteMoment(currentUser); }catch(e){}
  try{ setTimeout(_infoBulleNouvelleBarre,1500); }catch(e){}
  // BUILD 1861 : « Photos du bilan n°N à ajouter → », tant que le bilan
  // envoyé sans elles les attend (photosAVenir).
  try{
    let _pa=document.getElementById('clh-photos-avenir');
    const _ph=_htmlPhotosAVenir(currentUser);
    if(!_pa&&_ph&&_alerte){ _pa=document.createElement('div'); _pa.id='clh-photos-avenir'; _alerte.insertAdjacentElement('afterend',_pa); }
    if(_pa){ _pa.innerHTML=_ph; _pa.style.display=_ph?'block':'none'; }
  }catch(e){}
  // BUILD 1868 : la demande du coach de compléter un bilan, en haut.
  try{
    let _ac=document.getElementById('clh-a-completer');
    const _hc=_htmlCarteACompleter(currentUser);
    if(!_ac&&_hc&&_alerte){ _ac=document.createElement('div'); _ac.id='clh-a-completer'; _alerte.insertAdjacentElement('beforebegin',_ac); }
    if(_ac){ _ac.innerHTML=_hc; _ac.style.display=_hc?'block':'none'; }
  }catch(e){}
  // `users` sert plus bas à _applyCoachData : il reste, la carte PDF non.
  const users=DB.get('users')||{};
  _majBandeauDispo('clh-dispo');
  // L'échéance d'accès : rien à afficher la plupart du temps, un bandeau dans
  // les sept derniers jours.
  try{ _rendreEcheanceAcces(); }catch(e){}
  // ⚠ LE LIEN UNIQUE EST DEVENU TROIS BOUTONS, et le rendu a donc quitte
  // cette fonction pour _rendreContactCoach. Le garde reste le meme : sans
  // coach rattache, rien n'est rendu.
  const contactLink=document.getElementById('clh-contact');
  // R34 — sans coach, aucune banniere : celles d'un compte precedent, sur le
  // meme appareil, ne restent pas affichees. Avec un coach, _applyCoachData
  // les repeint juste en dessous, dans le meme tour.
  try{ _renderPromoBanners(null); }catch(e){}
  if(contactLink&&u.coachId){
    // Déclarée AVANT _applyCoachData : le rapatriement plus bas s'en sert
    // aussi, et il vit hors de cette fonction.
    const _cle=cleCoachDe(u);
    const _applyCoachData=(usrs)=>{
      // Le dossier complet du coach n'est PAS lisible par l'athlète : sur son
      // téléphone, Object.values(usrs) ne contient que son propre dossier. Le
      // profil public est donc la seule source, et le dossier local ne sert
      // que sur l'appareil du coach.
      const _pub=profilCoachLocal(_cle);
      // MEME LECTURE QUE LES DEUX ECRANS DE NUTRITION, depuis coachAffichable :
      // trois resolutions du meme dossier finissaient par diverger, et deux
      // d entre elles ne trouvaient jamais la photo.
      const coachUser=coachAffichable(u,usrs)||{};
      // Calcul déporté dans _coachContactHref, partagé avec l'écran d'accès
      // expiré : deux écrans qui proposent de joindre le même coach ne doivent
      // pas pouvoir diverger sur le numéro retenu ni sur le repli email.
      // Les trois canaux, et l'athlete choisit. Le consentement, le
      // journal de renvoi et la mention de sortie n'ont pas bouge : ils
      // vivent desormais dans _rendreContactCoach.
      try{ _rendreContactCoach(u,usrs); }catch(e){}
      _renderCoachBanner(coachUser, u.coachName);
      // R34 — les bannieres du coach, au bas de l'accueil.
      _renderPromoBanners(coachUser);
    };
    _applyCoachData(users);
    if(CLOUD.ok()&&_cle){
      // Le dossier complet du coach est refuse a l athlete par les regles :
      // c est ce nud public qui porte photo, team, phrase et bannieres.
      CLOUD.pullProfilCoach(_cle).then(p=>{ if(p) _applyCoachData(DB.get("users")||{}); });
    }
    if(CLOUD.ok()){
      const coachEmail=Object.keys(users).find(k=>users[k]?.id===u.coachId);
      // Snapshot des données coach AVANT le sync (pour récupérer les champs que le sync pourrait écraser)
      const _preSync=coachEmail?(JSON.parse(localStorage.getItem('rc_users')||'{}')[coachEmail]||null):null;
      // Après sync : fusionner les champs de profil locaux manquants et pousser vers Firebase
      const _afterCoachSync=()=>{
        const mu=DB.get('users')||{};
        const ce=Object.keys(mu).find(k=>mu[k]?.id===u.coachId);
        if(ce){
          const mc=mu[ce]||{};
          // Si le sync a écrasé des champs de profil présents avant, les restaurer depuis le snapshot
          if(_preSync){
            if(!mc.coachPhoto&&_preSync.coachPhoto) mc.coachPhoto=_preSync.coachPhoto;
            if(!mc.teamName&&_preSync.teamName) mc.teamName=_preSync.teamName;
            if(!mc.catchphrase&&_preSync.catchphrase) mc.catchphrase=_preSync.catchphrase;
            if(!mc.phone&&_preSync.phone) mc.phone=_preSync.phone;
            // N3.3 — ON N'ENVOIE PLUS LE DOSSIER DU COACH DEPUIS L'ATHLETE.
            // La regle .write de /users/$emailKey refuse cette ecriture PAR
            // CONSTRUCTION : l'echec enfilait la clef du coach dans
            // rc_sync_queue, et viderFile sortait par break au premier refus —
            // le dossier de l'athlete lui-meme cessait alors d'etre renvoye.
            // La restauration locale, elle, reste : elle repare l'affichage de
            // cet appareil. La vitrine du coach a son propre noeud, coach_public,
            // publie par le coach seul.
            if(mc.coachPhoto||mc.teamName||mc.catchphrase){
              mu[ce]=mc;
              // DB.setLocal ET NON localStorage.setItem : lui seul reconnait le
              // depassement de quota et le DIT. Ecrite en direct, cette ligne
              // levait sur un stockage sature — et comme elle restaure une
              // PHOTO de coach en base64, c'est precisement l'ecriture la plus
              // grosse du lot, donc la plus exposee. setLocal et non set : on
              // repare l'affichage de cet appareil, on ne republie rien.
              DB.setLocal('users',mu);
            }
          }
        }
        _applyCoachData(DB.get('users')||{});
      };
      if(coachEmail){
        CLOUD.syncUser(coachEmail).then(_afterCoachSync).catch(()=>{});
      } else {
        _afterCoachSync();
      }
    }
  } else if(!u.coachId){
    // Tout le bloc ci-dessus est conditionné à u.coachId : sans coach, la
    // bannière n'était jamais rendue, donc jamais masquée non plus — elle
    // gardait l'état du dernier athlète affiché. C'est aussi le seul moment
    // où proposer le rattrapage a un sens.
    _renderCoachBanner(null,'');
  }
  function _renderCoachBanner(coach, fallbackName){
    const el=document.getElementById('clh-coach-banner');
    if(!el) return;
    const team=coach?.teamName||'';
    const name=((coach?.fname||'')+' '+(coach?.lname||'')).trim()||fallbackName||'';
    const phrase=coach?.catchphrase||'';
    const photo=coach?.coachPhoto||'';
    // TOUCHER LA CARTE OUVRE LA VITRINE. Le gestionnaire est pose sur le
    // CONTENEUR : il survit au remplacement de son contenu, quelques lignes
    // plus bas, ce qu'un handler pose sur les enfants ne ferait pas.
    // Rien n'est cliquable tant que le coach n'a pas rempli sa vitrine — une
    // carte qui s'ouvre sur du vide est pire qu'une carte inerte.
    try{
      const _vit=!!name;
      el.onclick=_vit?function(ev){
        // Le bouton de contact et les liens gardent leur action propre.
        if(ev.target&&ev.target.closest&&ev.target.closest('a,button')) return;
        ouvrirVitrineCoach();
      }:null;
      el.style.cursor=_vit?'pointer':'';
      if(_vit){ el.setAttribute('role','button'); el.setAttribute('tabindex','0'); }
      else { el.removeAttribute('role'); el.removeAttribute('tabindex'); }
    }catch(e){}
    // Aucun coach rattaché : cet emplacement était simplement masqué. C'est
    // pourtant le seul endroit de l'accueil où la question « et mon coach ? »
    // se pose. Depuis que le code s'applique automatiquement à l'inscription,
    // s-client-code n'est plus sur le chemin de personne — il lui faut donc
    // une porte d'entrée visible pour l'athlète qui a perdu sa session, changé
    // d'appareil, ou reçu son code après s'être inscrit.
    if(!name){
      if(accueilMasque('code')){ el.innerHTML=''; el.style.display='none'; return; }
      el.style.display='block';
      el.innerHTML=`<div data-acc onclick="go('s-client-code')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}" style="position:relative;display:flex;align-items:center;gap:12px;padding:14px 40px 14px 16px;border-radius:var(--r-3);background:var(--surface-0);border:1px dashed var(--border);cursor:pointer">${_accX('code')}
        <div style="flex-shrink:0;width:38px;height:38px;border-radius:var(--r-full);background:var(--surface-3);display:flex;align-items:center;justify-content:center;color:var(--sub)">${icon('user',18)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:var(--fs-md)">Tu as un code coach&nbsp;?</div>
          <div class="sub" style="font-size:var(--fs-xs);margin-top:2px">Entre-le pour être rattaché à ton suivi</div>
        </div>
        <div style="color:var(--sub);font-size:var(--fs-xl)">›</div>
      </div>`;
      return;
    }
    el.style.display='block';
    // BUILD 1886 : UNE LIGNE — l'avatar (32 px), le nom. (1888 : « Écrire » est
    // retiré, l'accueil n'a plus qu'une entrée « Écrire à mon coach ».) Mêmes
    // tailles de police ; la vitrine s'ouvre toujours au toucher de la carte.
    el.innerHTML=`<div class="clh-coach-ligne" style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:var(--r-3);background:var(--surface-0);border:1px solid var(--border)">
      ${photo
        ?`<span style="flex-shrink:0;width:32px;height:32px;border-radius:var(--r-full);overflow:hidden;border:1px solid rgba(210,0,0,0.55)"><img src="${escapeHtml(photo)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"></span>`
        :`<span class="avatar" style="flex-shrink:0;width:32px;height:32px;font-size:12px;display:inline-flex;align-items:center;justify-content:center">${escapeHtml(ini(coach&&coach.fname||name,coach&&coach.lname||''))}</span>`}
      <span style="flex:1;min-width:0;font-weight:800;font-size:var(--fs-sm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span class="sub" style="font-weight:700;font-size:var(--fs-2xs);letter-spacing:1.5px;margin-right:6px">COACH</span>${escapeHtml(name.trim())}${team?' · '+escapeHtml(team):''}</span>
    </div>`;
  }
  _selDay=null;_nettoyerFondationPosee();
  const progEl=document.getElementById('clh-prog-exercises');
  if(progEl) _renderProgExercisesInto(progEl);
}
async function _openPdfSrc(raw){
  if(!raw) return;
  if(raw.startsWith('data:')){
    try{
      const blob=await fetch(raw).then(r=>r.blob());
      const url=URL.createObjectURL(blob);
      window.open(url,'_blank');
      setTimeout(()=>URL.revokeObjectURL(url),15000);
    }catch{toast('Impossible d\'ouvrir le PDF.','var(--orange)');}
  } else {
    // URL passée à window.open, pas à du HTML : il faut la forme brute, sinon
    // un & devenu &amp; casserait les paramètres de l'adresse.
    const url=safeUrlRaw(raw);
    if(url!=='#') window.open(url,'_blank');
  }
}
async function uploadAthletePdf(input){
  const f=input.files[0];if(!f) return;
  if(f.size>20*1024*1024){toast('PDF trop lourd (max 20 Mo)','var(--orange)');return;}
  const emailKey=currentUser.email.toLowerCase().replace(/\./g,',');
  toast('Envoi en cours…');
  try{
    const storageUrl=await CLOUD.uploadPdf(emailKey,f);
    currentUser.programPdf=null;
    currentUser.programPdfStorageUrl=storageUrl;
    currentUser.programPdfLink=null;
    currentUser.programPdfName=f.name.replace(/\.pdf$/i,'');
    currentUser.programPdfSize=Math.round(f.size/1024)+'Ko';
    currentUser.programPdfDate=Date.now();
    currentUser.programPdfVersion=(currentUser.programPdfVersion||0)+1;
    toastEcriture(saveUser(),'Programme importé : v'+(currentUser.programPdfVersion),'le programme est');
    loadClientHome();
  }catch(e){
    toast('Échec : '+(e.message||'Réessaie.'),'var(--orange)');
  }
}
function getProgram(){
  const users=DB.get('users')||{};
  const u=users[currentUser.email];
  if(u?.program) return{name:u.programName||'Mon programme',exercises:u.program,notes:u.programNotes};
  // ⚠ LE REPLI NE FABRIQUE PLUS UN PROGRAMME. Il rendait « SÉANCE 1 : DOS &
  // ABDOS » et six exercices tires de defEx : un athlete sans programme en
  // voyait un, et pouvait le derouler en croyant que c'etait le sien.
  // _isDefault reste, c'est lui que les appelants lisent pour savoir qu'il n'y
  // a rien.
  return{name:'',exercises:[],notes:'',_isDefault:true};
}
// Les trois anneaux sur l'accueil. Le DESSIN est celui de la diète flexible,
// à la fonction près ; c'est ce qu'ils comptent qui change selon la diète.
//
// FLEXIBLE : l'athlète tient son journal, les anneaux se remplissent au fur et
// à mesure de ses saisies — même source que l'écran Nutrition.
//
// STRICTE : il ne saisit rien, il suit le plan du coach. Son journal est donc
// vide, et des anneaux à zéro donneraient l'impression qu'il n'a rien mangé
// alors qu'il n'a simplement rien à saisir.
//
// Ce qui commande ici, c'est le COACH, pas la validation quotidienne de
// l'athlète : dès que la stricte lui est ouverte (accesDieteStricte), ses
// apports SONT ceux du plan, et la carte affiche donc les objectifs atteints.
// Sans accès ouvert, on n'affiche pas des chiffres qui ne s'appuient sur rien.
// LES JAUGES PARTENT DE ZERO ET REJOIGNENT LEUR VALEUR. Le html les pose a
// l arret — anneau entierement masque, barre a zero — et cette fonction leur
// donne leur cible AU TOUR SUIVANT : une transition ne demarre que si la
// valeur de depart a ete peinte au moins une fois. Deux requestAnimationFrame,
// parce qu un seul tombe encore dans la meme passe de style que l innerHTML.
//
// Elle traite aussi [data-arc-off] tout court, pour les arcs qui n ont pas la
// classe .rc-anneau — l anneau de cafeine, notamment.
// LA MARQUE DE FRANCHISSEMENT. Elle tombe A LA FIN de la course de l'arc, pas
// a son depart — sinon on celebre avant d'etre arrive. L'element anime doit
// etre le <svg> conteneur et jamais le <circle> : un transform sur un <circle>
// SVG s'applique dans le repere du viewBox et ferait deriver l'anneau hors de
// son centre.
function _arcPalierAtteint(el){
  if(!el||!el.animate||arcReduit()) return null;
  // Le noeud a pu quitter le document avant l'echeance du setTimeout.
  if(el.isConnected===false) return null;
  try{ el.style.transformBox='fill-box'; el.style.transformOrigin='center'; }catch(e){}
  const a=_animer(el,
    [{transform:'scale(1)'},{transform:'scale(1.10)',offset:.42},{transform:'scale(1)'}],
    {duration:260,easing:'cubic-bezier(.2,1.5,.4,1)',fill:'none'});
  try{ arcHaptique('legere'); }catch(e){}
  return a;
}
function _animerJauges(root){
  if(!root) return;
  const red=arcReduit();
  const pose=()=>{
    root.querySelectorAll('.rc-anneau,[data-arc-off]').forEach(c=>{
      if(c.dataset.arcOff!=null) c.style.strokeDashoffset=c.dataset.arcOff;
    });
    // Les elements qui doivent CHANGER DE COULEUR : ils sont rendus a la
    // couleur du palier precedent, on leur pose la nouvelle ici.
    root.querySelectorAll('[data-caff-col]').forEach(e=>{
      const c=e.dataset.caffCol;
      if(!c) return;
      if(e.tagName==='SPAN') e.style.color=c; else e.style.stroke=c;
    });
    root.querySelectorAll('.rc-barre').forEach(b=>{
      if(b.dataset.barW!=null) b.style.width=b.dataset.barW+'%';
    });
    // LES BARRES VERTICALES. Meme motif que .rc-barre, sur la hauteur : le
    // gabarit les rend a 4 px et la valeur est posee ici, une frame plus tard.
    // Le decalage est plafonne a six colonnes : la derniere finit a 690 ms.
    root.querySelectorAll('.rc-barre-v').forEach((b,i)=>{
      if(b.dataset.barH==null) return;
      if(!b.style.getPropertyValue('--rcb-d')) b.style.setProperty('--rcb-d',Math.min(i,6)*45+'ms');
      b.style.height=b.dataset.barH+'%';
    });
    // LES CHIFFRES MONTENT. arcChiffre respecte deja arcReduit() — elle pose
    // alors la valeur d'arrivee — et annule une interpolation en cours sur le
    // meme element via sa WeakMap : un second rendu pendant l'animation ne
    // produit pas deux boucles concurrentes.
    root.querySelectorAll('[data-num]').forEach(e=>{
      const v=parseFloat(e.dataset.num);
      if(!isFinite(v)) return;
      const d=parseFloat(e.dataset.numDuree);
      arcChiffre(e,0,v,{duree:isFinite(d)?d:ARC.afterglow,format:x=>String(Math.round(x))});
    });
    // LE FRANCHISSEMENT, temporise sur l'arrivee de l'arc. 620 ms est la duree
    // de la transition stroke-dashoffset des anneaux de macros ; 320 ms celle
    // du cadran de cafeine. Les anneaux qui passent 100 % le meme jour sont
    // decales de 90 ms : trois impulsions simultanees ne designeraient rien.
    root.querySelectorAll('svg[data-atteint="1"]').forEach((s,i)=>{
      setTimeout(()=>_arcPalierAtteint(s),ARC.afterglow+i*90);
    });
    root.querySelectorAll('svg[data-palier-neuf="1"]').forEach(s=>{
      setTimeout(()=>_arcPalierAtteint(s),320);
    });
  };
  if(red){ pose(); return; }
  let fait=false;
  const une=()=>{ if(fait) return; fait=true; pose(); };
  requestAnimationFrame(()=>requestAnimationFrame(une));
  setTimeout(une,300);
}
// Le raccourci de la carte Nutrition vers son onglet.
// IL NE VOLE PAS LE CLIC DES COMMANDES QU'ELLE CONTIENT. Le sélecteur d'unité
// vit dans cette carte : sans ce garde, un clic sur « % » remonterait jusqu'ici
// et emmènerait l'athlète sur un autre écran alors qu'il changeait d'unité.
function _nutRaccourci(ev){
  const t=ev&&ev.target;
  if(t&&t.closest&&t.closest('button,a,input,select,textarea,label')) return;
  clientTab('nutrition');
}
function renderNutriAnneaux(){
  const el=document.getElementById('clh-nutri-rings');
  if(!el) return;
  const nut=currentUser.nutrition||{};
  const today=localISODate(new Date());
  let isOn=false; try{ isOn=nutIsOnDay(today); }catch(e){}
  const m=_getEffectiveMacros(nut,isOn,today)||{};
  // Sans objectifs, il n'y a rien à dessiner : trois anneaux vides sans cible
  // ne renseignent sur rien.
  // L'emplacement du selecteur, dans l'en-tete. Il se vide EN MEME TEMPS que
  // les anneaux : un selecteur d'unite seul, sous un titre et au-dessus de
  // rien, ne selectionnerait l'unite de personne.
  const elU=document.getElementById('clh-nutri-unite');
  if(!m.p&&!m.g&&!m.l){ el.innerHTML=''; if(elU) elU.innerHTML=''; return; }
  let tot;
  if(typeDiete(nut)==='strict'){
    let ouvert=false;
    try{ ouvert=!!accesDieteStricte(currentUser).ok; }catch(e){}
    tot=ouvert?{p:m.p||0,c:m.g||0,l:m.l||0,kcal:m.kcal||0}:{p:0,c:0,l:0,kcal:0};
  } else {
    const entries=(nut.log?.[today]?.entries)||[];
    tot=entries.reduce((a,e)=>({kcal:a.kcal+(e.kcal||0),p:a.p+(e.p||0),
      c:a.c+(e.c||0),l:a.l+(e.l||0)}),{kcal:0,p:0,c:0,l:0});
  }
  const _pr=poidsReference(currentUser);
  // Le boitier monte dans l'en-tete SANS sa note ; la note se pose en tete du
  // bloc des anneaux, soit juste sous lui, a la ligne pres.
  if(elU) elU.innerHTML=htmlMacroUnite(currentUser,null,true);
  el.innerHTML=htmlMacroUniteNote(currentUser)
    +htmlAnneauxMacros(tot,m,'12px',macroUnite(),_pr)+htmlLigneCalories(tot,m)
    +(macroNoteGlucidesZero(m)?`<div style="font-size:var(--fs-2xs);color:var(--orange);line-height:1.55;margin-top:6px">${escapeHtml(macroNoteGlucidesZero(m))}</div>`:'');
  _animerJauges(el);
}
// PURE. Une ligne de sept pastilles, lundi -> dimanche.
// `vals` : true (vert), false (rouge), null/undefined (neutre).
// Extrait de renderNutriDots pour etre partage — pas reecrit : le balisage est
// celui d origine, octet pour octet, seule la taille est parametrable.
const _DOTS_JOURS=['L','M','M','J','V','S','D'];
// L etoile, en SVG et non en caractere : le glyphe « ★ » n a pas le meme
// dessin d une police a l autre, et sur les appareils qui ne l ont pas il
// tombe en carre vide. Le trace est ici, il est le meme partout.
// `currentColor` : l etat vit sur le conteneur, une seule fois, et le trace
// n a pas a le connaitre.
function _svgEtoile(t){
  return '<svg viewBox="0 0 24 24" width="'+t+'" height="'+t+'" fill="currentColor" aria-hidden="true" style="display:block">'
    +'<path d="M12 1.6l3.09 6.9 7.41.62-5.6 4.85 1.7 7.28L12 17.3l-6.6 3.95 1.7-7.28-5.6-4.85 7.41-.62z"/></svg>';
}
function _htmlLigneDots(vals,taille,libelles){
  const t=taille>0?taille:28;
  const lib=Array.isArray(libelles)?libelles:_DOTS_JOURS;
  const rond=Math.round(t*1.5), etoile=Math.round(t*0.72);
  return (vals||[]).map((val,i)=>{
    // L'ETAT EST ECRIT DEUX FOIS, ET CE N'EST PAS UNE REDONDANCE : `color`
    // pour le rendu -- le trace est rempli en currentColor et le halo se
    // calcule sur la meme teinte -- et [data-etat] pour qui doit le LIRE.
    // La suite de tests lisait la couleur ; une couleur est une decision de
    // mise en forme, elle a le droit de changer, et elle vient de changer.
    const etat=val===true?'v':val===false?'r':'g';
    // var(--border) donnait 1,4:1 sur ce fond : le rond disparaissait purement.
    const c=val===true?'var(--red)':val===false?'#6d0000':'#3b3232';
    // Seule la journee TENUE brille. Sans quoi il n'y aurait plus de
    // difference entre tenir sa journee et ne rien avoir fait.
    const halo=val===true
      ?`box-shadow:0 0 ${Math.round(t*0.42)}px rgba(224,32,32,.55),inset 0 0 ${Math.round(t*0.32)}px rgba(224,32,32,.35);`
      :'';
    const lueur=val===true
      ?`filter:drop-shadow(0 0 ${Math.round(t*0.22)}px rgba(255,60,60,.95));`
      :'';
    // La lettre ne prend jamais var(--border) : a 1,4:1 sur le fond de carte
    // elle serait invisible. Un jour sans reponse garde le gris de sous-titre.
    const cl=val===true?'var(--red)':val===false?'#a35a5a':'var(--sub)';
    return `<div class="nut-j" style="--nut-d:${i*55}ms"><div class="nut-j-rond" data-etat="${etat}" style="--nut-r:${rond}px;color:${c};${halo}${lueur}">${_svgEtoile(etoile)}</div><div class="nut-j-lbl" style="color:${cl}">${lib[i]}</div></div>`;
  }).join('');
}
function renderNutriDots(){
  renderNutriAnneaux();
  const today=new Date(),wk=new Date(today);
  // Lundi de la semaine courante — même formule que _renderStrictDiet.
  // (l'ancien calcul -getDay()+1 renvoyait le lundi SUIVANT le dimanche)
  wk.setDate(today.getDate()-((today.getDay()+6)%7));
  const days=['L','M','M','J','V','S','D'],nut=currentUser.nutrition||{};
  const weekKeys=days.map((_,i)=>{const dt=new Date(wk);dt.setDate(wk.getDate()+i);return localISODate(dt);});
  // ══ LE VERDICT SE CALCULE, IL NE SE LIT PAS ══════════════════════════
  //
  // ⚠ CETTE LIGNE LISAIT nutrition.days[k].respected, ET C'ETAIT FAUX EN DIETE
  // FLEXIBLE. `respected` est la reponse a une question quotidienne — « as-tu
  // tenu ta diete ? » — et personne ne pose cette question a un athlete en
  // flexible : il enregistre ce qu'il mange, et c'est le journal qui repond.
  // Les sept pastilles restaient donc grises toute la semaine, et le score
  // affichait 0/7 a quelqu'un qui tenait ses macros tous les jours.
  //
  // jourDieteTenu SAIT LES DEUX REGIMES, et c'est le meme predicat qui sert
  // deja au camembert de diete, au calendrier du journal et a la fenetre
  // glissante. Une seule definition : recopier la regle ici aurait fabrique un
  // cinquieme jugement, et le jour ou la tolerance bougerait, la pastille
  // aurait contredit le pourcentage qui la resume.
  //
  // ⚠ ET ON N'ECRIT RIEN DANS nutrition.days. Le verdict flexible se CALCULE a
  // la lecture. Le figer reviendrait a graver un jugement que l'ajout d'un
  // aliment doit pouvoir corriger : l'athlete qui complete son journal le soir
  // verrait sa journee rester rouge, sans comprendre pourquoi.
  //
  // En diete STRICTE, jourDieteTenu relit exactement `respected` et rend le
  // meme triplet qu'avant — true, false, null. Le rendu ne bouge pas d'un
  // pixel de ce cote-la ; c'est le meme code pour les deux, et non deux
  // chemins dont un seul serait teste.
  const verdicts=weekKeys.map(k=>{
    try{ return jourDieteTenu(currentUser,k); }catch(e){ return null; }
  });
  // Le balisage de la ligne est passe dans _htmlLigneDots, partage avec la
  // vue hebdomadaire des habitudes. Meme pastille, meme ordre, meme code —
  // deux rendus de la meme chose auraient diverge des la premiere retouche.
  // null -> etoile NEUTRE, jamais rouge : un jour sans saisie, ou sans cible a
  // quoi se comparer, n'est pas un jour rate.
  document.getElementById('clh-nutri-dots').innerHTML=
    _htmlLigneDots(verdicts,26,days);
  const tenus=verdicts.filter(v=>v===true).length;
  const juges=verdicts.filter(v=>v===true||v===false).length;
  const flexible=typeDiete(nut)==='flexible';
  const scoreEl=document.getElementById('clh-nutri-score');
  // LE DENOMINATEUR NE COMPTE QUE LES JOURS JUGEABLES, en flexible. Sur sept,
  // un athlete qui tient ses trois premiers jours de la semaine lirait 3/7 des
  // le mercredi — quatre jours comptes comme rates avant d'avoir eu lieu. Il
  // lit 3/3.
  //
  // LE DIVISEUR RESTE SEPT EN STRICTE, et c'est delibere : la question
  // quotidienne est posee chaque jour, une absence de reponse y est une
  // information, et changer ce cadran-la n'a pas ete demande.
  const denom=flexible?juges:7;
  // LA VALEUR PRECEDENTE VIENT DE data-valeur, JAMAIS DU TEXTE AFFICHE. Le
  // texte porte une fraction : le nettoyer retirait le « / » et collait le
  // numerateur au denominateur — voir arcCompteur.
  //
  // ZERO JOUR JUGEABLE : on rend le tiret de l'etat vide, pas « 0/0 ». Une
  // fraction nulle sur nulle se lit comme un echec, alors qu'il n'y a rien a
  // lire — c'est la meme regle que le taux d'installation de l'ecran mesures.
  arcCompteur(scoreEl,tenus,{duree:ARC.release,
    format:denom>0?(v=>Math.round(v)+'/'+denom):(()=>'-')});
  // LE VERT, PAS LE JAUNE DES GLUCIDES. Un score de 5/7 peint dans la couleur
  // exacte de l anneau glucides se lit comme une macro, pas comme un compte de
  // jours tenus. Le vert est la couleur de ce qui est fait, partout ailleurs.
  scoreEl.style.color='var(--red-text)';
}
// ══ LE LISERÉ DE BRAISE, EN GÉNÉRATEUR ═══════════════════════════════════
// Le badge « 7 SEM. » porte son liseré dans un SVG écrit à la main, calé sur
// sa forme à lui. La notification d'assiduité est cinq fois plus large et deux
// fois moins haute : réutiliser le même viewBox en preserveAspectRatio="none"
// l'étirerait, et le grain de la turbulence — qui est en unités du repère —
// donnerait des bosses tous les 40 px en haut et tous les 9 px sur les flancs.
// Soit exactement l'asymétrie entre côtés qu'on vient de supprimer sur le
// badge.
//
// D'où un repère où UNE UNITÉ VAUT UN PIXEL, quelle que soit la boîte. Le
// grain est alors le même partout et sur n'importe quelle forme, et les
// réglages ci-dessous sont ceux du badge convertis une fois pour toutes (son
// repère valait 0,61 px par unité).
//
// PURE : elle ne lit rien, ne pose rien, et rend une chaîne.
function _htmlBraise(id, L, H, m){
  const X0=m, X1=m+L, Y0=m, Y1=m+H, W=L+2*m, Ht=H+2*m;
  const PAS=28;      // px entre deux points du contour, LES QUATRE CÔTÉS
  const BRUIT=1.5;   // px, amplitude du désordre du contour
  // LE BIAIS SE MESURE, IL NE SE TRANSPORTE PAS. feDisplacementMap décale de
  // (canal − 0,5) × scale ; sur l'ensemble d'une fractalNoise ces canaux valent
  // 0,5, mais sur la petite fenêtre qu'occupe un contour la moyenne LOCALE n'y
  // est pas, et tout le tracé part d'un côté. Le badge porte sa propre
  // correction, prise sur SA géométrie ; reprise telle quelle ici elle
  // sur-corrigeait — une boîte d'une autre taille échantillonne une autre région
  // du champ. Celle-ci est mesurée sur cette boîte-ci : liseré du haut 1,1 px
  // contre 0,45 px en bas sur quatre instants, soit un tracé remonté de 0,33 px.
  // Négatif : il redescend d'autant.
  const BIAIS=-0.33;
  // Même mesure sur l'axe horizontal : 2,5 px à droite contre 1,4 à gauche, soit
  // un tracé poussé de 0,55 px vers la droite. Positif : il revient d'autant.
  const BIAIS_X=0.55;
  const FONDU=3.7;   // px de dissolution contre chaque bord du calque

  // LE CONTOUR EST UN RECTANGLE ARRONDI NU, et le froissé vient ENTIÈREMENT de
  // la turbulence. La version précédente passait une courbe de Catmull-Rom par
  // des points bruités : sur les côtés courts d'une boîte très allongée, les
  // poignées de la courbe — proportionnelles à l'écart entre points voisins —
  // devenaient énormes et faisaient bomber les angles. Le liseré mesurait alors
  // 4,5 px sur les flancs contre 2,4 px en haut. Un rectangle n'a pas de
  // poignées, et une turbulence à trois ou quatre octaves porte déjà plusieurs
  // échelles de désordre : on ne perd rien.
  const rect=(dd,r)=>{
    const x=X0-dd, y=Y0-dd-BIAIS, w=L+2*dd, h=H+2*dd;
    const k=Math.min(r, w/2, h/2);
    return 'M'+(x+k).toFixed(1)+','+y.toFixed(1)
      +'h'+(w-2*k).toFixed(1)+'a'+k+','+k+' 0 0 1 '+k+','+k
      +'v'+(h-2*k).toFixed(1)+'a'+k+','+k+' 0 0 1 '+(-k)+','+k
      +'h'+(-(w-2*k)).toFixed(1)+'a'+k+','+k+' 0 0 1 '+(-k)+','+(-k)
      +'v'+(-(h-2*k)).toFixed(1)+'a'+k+','+k+' 0 0 1 '+k+','+(-k)+'Z';
  };

  const turb=(k,fx,fy,oc,gr,amp,flou)=>
    `<filter id="${id}f${k}" x="-45%" y="-45%" width="190%" height="190%" color-interpolation-filters="sRGB">`
    +`<feTurbulence type="fractalNoise" baseFrequency="${fx} ${fy}" numOctaves="${oc}" seed="${gr}" result="n"/>`
    +`<feDisplacementMap in="SourceGraphic" in2="n" scale="${amp}" xChannelSelector="R" yChannelSelector="G" result="d"/>`
    +`<feGaussianBlur in="d" stdDeviation="${flou}"/></filter>`;

  // UN CONTOUR TRACÉ, PAS UNE MASSE REMPLIE — et c'est ce qui rend les quatre
  // côtés identiques sur une boîte de n'importe quelle forme. Une masse remplie
  // laisse le DÉGRADÉ décider jusqu'où le feu porte : étiré au rapport de la
  // boîte, il s'éteint onze fois plus vite en vertical qu'en horizontal, et sur
  // une notification longue le liseré faisait 0,6 px en haut contre 1,5 px sur
  // les flancs. Un trait d'épaisseur donnée porte la même distance partout, par
  // construction. Le dégradé ne fait alors plus que TEINTER : chaud au milieu
  // des côtés, sombre dans les angles — la braise du badge.
  const cx=(W/2).toFixed(1), cy=(Ht/2).toFixed(1);
  const ray=(H/2*1.49).toFixed(1), ech=(L/H).toFixed(3);
  const deg=(k,st)=>`<radialGradient id="${id}${k}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${ray}"`
    +` gradientTransform="translate(${cx},${cy}) scale(${ech},1) translate(-${cx},-${cy})">${st}</radialGradient>`;

  const fV=(FONDU/Ht).toFixed(4), fH=(FONDU/W).toFixed(4);
  return `<svg class="nb-flammes" viewBox="0 0 ${W.toFixed(0)} ${Ht.toFixed(0)}" preserveAspectRatio="none" aria-hidden="true"><defs>`
    + deg('a','<stop offset="0" stop-color="#fff2d8"/><stop offset=".46" stop-color="#ffa24a"/>'
            +'<stop offset=".57" stop-color="#ff4f14" stop-opacity=".96"/>'
            +'<stop offset=".71" stop-color="#ec1608" stop-opacity=".85"/>'
            +'<stop offset=".87" stop-color="#8e0403" stop-opacity=".4"/>'
            +'<stop offset="1" stop-color="#3a0000" stop-opacity="0"/>')
    + deg('b','<stop offset="0" stop-color="#ff7a28" stop-opacity=".8"/>'
            +'<stop offset=".52" stop-color="#e82a0c" stop-opacity=".72"/>'
            +'<stop offset=".74" stop-color="#a80d04" stop-opacity=".5"/>'
            +'<stop offset="1" stop-color="#200000" stop-opacity="0"/>')
    // FREQUENCES ISOTROPES. Celles du badge ne le sont pas — sa verticale est
    // 3,7 fois plus basse, heritage de l'epoque ou les langues devaient s'etirer
    // vers le haut. Or le canal ROUGE, qui porte le deplacement horizontal, varie
    // alors si lentement en y qu'il est quasi CONSTANT le long d'un bord
    // vertical : le cote entier part en bloc vers l'interieur ou vers
    // l'exterieur, au hasard de la graine. Mesure : liseré droit 0,0 px contre
    // 1,9 px a gauche, aux quatre instants. Avec des frequences egales, chaque
    // bord traverse plusieurs periodes de bruit et aucun ne peut plus partir
    // d'un bloc.
    + turb(1,'0.075','0.075',3,11,'5.5','0.34')
    + turb(2,'0.105','0.105',4,37,'4.9','0.18')
    + turb(3,'0.145','0.145',4,73,'3.7','0.12')
    + `<linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="${fV}" stop-color="#fff"/>`
    + `<stop offset="${(1-fV).toFixed(4)}" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`
    + `<linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="0">`
    + `<stop offset="0" stop-color="#000"/><stop offset="${fH}" stop-color="#fff"/>`
    + `<stop offset="${(1-fH).toFixed(4)}" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>`
    + `<mask id="${id}m"><rect width="${W.toFixed(0)}" height="${Ht.toFixed(0)}" fill="url(#${id}v)"/>`
    + `<rect width="${W.toFixed(0)}" height="${Ht.toFixed(0)}" fill="url(#${id}h)" style="mix-blend-mode:multiply"/></mask></defs>`
    + `<g mask="url(#${id}m)" fill="none" stroke-linejoin="round">`
    + `<g class="sk-n1 fx-loop"><path d="${rect(1.2,12)}" stroke="url(#${id}b)" stroke-width="6" filter="url(#${id}f1)"/></g>`
    + `<g class="sk-n2 fx-loop"><path d="${rect(0,11)}" stroke="url(#${id}a)" stroke-width="5" filter="url(#${id}f2)"/></g>`
    + `<g class="sk-n3 fx-loop"><path d="${rect(-1.2,10)}" stroke="url(#${id}a)" stroke-width="4" filter="url(#${id}f3)"/></g>`
    + `</g></svg>`;
}

// Le liseré a besoin de la TAILLE RÉELLE du cadre, qui dépend de la largeur de
// l'écran : il ne peut donc pas être écrit dans le gabarit, seulement posé une
// fois la mise en page faite. Un observateur le repose si la boîte change de
// taille — rotation du téléphone, notamment — car un SVG en
// preserveAspectRatio="none" s'étirerait sinon jusqu'au rendu suivant.
function _poserBraise(n){
  const c=n&&n.querySelector('.nb-cadre'); if(!c) return;
  const r=c.getBoundingClientRect();
  const L=Math.round(r.width), H=Math.round(r.height);
  if(!(L>0&&H>0)) return;
  // On ne redessine pas pour un pixel : regenerer le contour le fait sauter.
  if(Math.abs((n._braiseL||0)-L)<8 && Math.abs((n._braiseH||0)-H)<4) return;
  n._braiseL=L; n._braiseH=H;
  const a=n.querySelector('.nb-flammes'); if(a) a.remove();
  c.insertAdjacentHTML('beforebegin', _htmlBraise('nb', L, H, 8));
}
function _armerBraises(racine){
  (racine||document).querySelectorAll('.nb-notif').forEach(n=>{
    _poserBraise(n);
    if(n._braiseObs||typeof ResizeObserver!=='function') return;
    n._braiseObs=new ResizeObserver(()=>_poserBraise(n));
    n._braiseObs.observe(n.querySelector('.nb-cadre'));
  });
}
function renderNotifs(){
  const notifs=[];
  // EN TÊTE — les retours du coach. C'est la seule entrée qui appelle une
  // action de l'athlète ; les rappels d'assiduité qui suivent ne sont que du
  // contexte. Une par vidéo corrigée non consultée.
  // Les réponses au bilan passent DEVANT les corrections vidéo : le bilan est
  // l'acte le plus coûteux du parcours, sa réponse est la plus attendue.
  bilansAvecReponseNonVue(currentUser).forEach(b=>notifs.push({
    icon:icon('message-circle',16),
    msg:(_nomCoachAffiche()||'Ton coach')+' a répondu à ton bilan du '+_dateBilanCourte(b),
    c:'var(--green)',act:"openReponseBilan('"+_idBilan(b)+"')"}));
  feedbacksNonVus(currentUser).forEach(v=>notifs.push({
    icon:icon('video',16),
    msg:'Ton coach a corrigé ta vidéo « '+escapeHtml(v.name||'sans nom')+' »',
    c:'var(--green)',act:'loadVideos()'}));
  if(!currentUser.sessions?.length) notifs.push({icon:'',msg:'Lance ta première séance dès maintenant !',c:'var(--red)'});
  else{
    const days=Math.floor((Date.now()-currentUser.sessions[currentUser.sessions.length-1].date)/864e5);
    // Un jour de repos prévu au programme n'est pas un oubli : on ne s'alarme
    // qu'au-delà de l'intervalle normal entre deux séances actives. Avec 3
    // séances par semaine l'intervalle vaut 3 jours, plus 1 de marge.
    const ecartNormal=ecartNormalJours(currentUser);
    if(days>ecartNormal) notifs.push({icon:'',msg:`${days} jours sans séance. Reprends le rythme !`,c:'var(--orange)'});
  }
  // UNE SEULE ENTREE NUTRITION, ET A CETTE PLACE-LA. Apres la relance de
  // seance : une seance manquee est un rendez-vous rate, un journal non tenu
  // est une trace manquante — le premier prime. Avant le badge d'assiduite :
  // un compteur ne prime sur rien, il felicite.
  // RETIRÉS DE L'ACCUEIL (Kevin, 28/09/2026 : « ils noient l'utilisateur ») :
  // la relance nutrition (« 40 jours sans suivi alimentaire »), le cadre
  // « 14 semaines d'assiduité · Continue ! » — le compte vit dans l'en-tête —
  // et « Bilan du … transmis à ton coach ». notifNutrition et
  // _htmlNotifAssiduite restent, sans appel ici.
  // `act` est facultatif : les entrées qui en portent une deviennent de vrais
  // boutons — curseur, rôle et clavier compris, pas seulement un onclick posé
  // sur un div muet.
  const _z=document.getElementById('clh-notifs');
  _z.innerHTML=notifs.map(n=>n.braise
    ? _htmlNotifAssiduite(n.sem)
    : n.act
    ? `<div class="notification" style="border-color:${n.c};cursor:pointer" onclick="${n.act}" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">${n.icon} ${n.msg}</div>`
    : `<div class="notification" style="border-color:${n.c}">${n.icon} ${n.msg}</div>`).join('');
  // Le liseré se pose APRES la mise en page : il lui faut la largeur reelle.
  _armerBraises(_z);
}
// PURE. Le cadre de l'assiduite — celui du badge « 7 SEM. », a la ligne pres,
// moins le cadran gradue : une notification n'a pas de course a montrer.
function _htmlNotifAssiduite(sem){
  const n=Math.max(0,Math.round(Number(sem)||0));
  return `<div class="nb-notif">
    <div class="nb-cadre">
      <svg class="nb-ico" viewBox="0 0 32 32" aria-hidden="true"><path d="M12.2 20.8A3.4 3.4 0 0 0 15.6 17.4c0-1.9-.7-2.7-1.4-4.1-1.5-2.9-.3-5.5 2.7-8.2.7 3.4 2.7 6.7 5.5 8.9 2.7 2.2 4.1 4.8 4.1 7.5a9.5 9.5 0 1 1-19 0c0-1.6.6-3.1 1.4-4.1a3.4 3.4 0 0 0 3.4 4.1z" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span class="nb-num">${n}</span>
      <span class="nb-lbl">semaines d'assiduité</span>
      <span class="nb-cta">Continue&nbsp;!</span>
    </div>
  </div>`;
}
function clientTab(tab){
  // Le surlignage n'est plus posé ici mais dans go(), à partir de l'écran
  // réellement affiché. Le faire aussi ici rouvrirait la désynchronisation que
  // ce déplacement corrige, et allumerait l'onglet AVANT de savoir si la
  // navigation aboutit — go() peut rediriger (filet de sécurité de rôle).
  if(tab==='home') loadClientHome();
  // BUILD 1887 : les cinq onglets ; les anciennes clés restent connues
  // (liens profonds, notifications) et ouvrent le même écran qu'avant.
  else if(tab==='entrainement') loadEntrainement();
  else if(tab==='progres') loadProgress();
  else if(tab==='coach'){
    if(!(currentUser&&(currentUser.coachEmailKey||currentUser.coachId))){ go('s-client-code'); return; }
    loadMonCoach();
  }
  else if(tab==='bilan'){
    bilanMarquerOngletVu();
    openBilanChoice();
    try{ _majPastilleBilan(); }catch(e){}
  }
  else if(tab==='nutrition') loadNutrition();
  else if(tab==='videos') loadVideos();
  else if(tab==='lifestyle') loadLifestyle();
  else if(tab==='evolution') loadProgress();
  else if(tab==='canal') loadCanal();
}

// ══ BUILD 1887 : LES RACINES ENTRAÎNEMENT ET COACH ══════════════════════════
function _ligneEntree(titre,sous,action,pastille){
  return '<button type="button" class="hb-l" onclick="'+action+'" style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:12px 14px;margin-bottom:8px;cursor:pointer;color:var(--text);font:inherit">'
    +'<span style="flex:1;min-width:0"><b style="display:block">'+escapeHtml(titre)+'</b>'+(sous?'<span class="sub" style="font-size:var(--fs-xs)">'+escapeHtml(sous)+'</span>':'')+'</span>'
    +(pastille?'<span class="badge badge-orange">'+pastille+'</span>':'')+'<span class="sub">›</span></button>';
}
function loadEntrainement(){
  go('s-entrainement');
  const z=document.getElementById('ent-corps');
  if(!z||!currentUser) return false;
  let s=null; try{ s=seancePrevueDuJour(currentUser,Date.now()); }catch(e){ s=null; }
  const nv=(function(){ try{ return feedbacksNonVus(currentUser).length; }catch(e){ return 0; } })();
  z.innerHTML=(s?'<div class="gv-carte" role="button" tabindex="0" onclick="openSessionPicker()" style="padding:14px 16px;margin-bottom:14px;cursor:pointer"><div style="font-weight:800">Séance du jour</div><div class="sub" style="font-size:var(--fs-xs)">'+escapeHtml(s.name||'Séance')+' · '+(s.exercises||[]).length+' exercices</div></div>'
      :'<div class="sub" style="font-size:var(--fs-xs);margin-bottom:14px">Pas de séance prévue aujourd’hui.</div>')
    +'<div id="ent-semaine" style="margin-bottom:14px"></div>'
    +_ligneEntree('Mes séances','Ton programme de la semaine','loadSessionManager()')
    +_ligneEntree('Historique','Les séances faites','loadHistoriqueSeances()')
    +_ligneEntree('Mes records','Tes meilleures charges, exercice par exercice','ouvrirMesRecords()')
    +_ligneEntree('Corrections vidéo','Tes vidéos et les retours du coach','loadVideos()',nv||'');
  try{ const w=document.getElementById('ent-semaine'); if(w) _renderProgExercisesInto(w); }catch(e){}
  return true;
}
function loadMonCoach(){
  go('s-mon-coach');
  const z=document.getElementById('mc-corps');
  if(!z||!currentUser) return false;
  let prochain=''; try{ const e=echeanceBilan(currentUser,Date.now()); if(e&&e.echeance) prochain='Prochain bilan le '+new Date(e.echeance).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}); }catch(e){}
  const rep=(function(){ try{ return bilansAvecReponseNonVue(currentUser).length; }catch(e){ return 0; } })();
  let ann=0; try{ ann=canalAccessible(currentUser)?canalNonLusCompte(currentUser,profilCoachLocal(canalCle(currentUser)),_canalVus()):0; }catch(e){ ann=0; }
  z.innerHTML=_ligneEntree('Messages','Écrire à ton coach','msgOuvrirFil()')
    +_ligneEntree('Bilans',prochain||'Faire, relire ou corriger un bilan','bilanMarquerOngletVu();openBilanChoice()',rep||'')
    +_ligneEntree('Annonces','Ce que ton coach partage à tous','loadCanal()',ann||'');
  return true;
}
// Une seule fois : « Corrections est maintenant dans Entraînement ».
function _infoBulleNouvelleBarre(){
  try{
    if(!currentUser||currentUser.role!=='athlete'||!(currentUser.videos||[]).length) return false;
    if(localStorage.getItem('rc_info_barre_5')) return false;
    localStorage.setItem('rc_info_barre_5','1');
    toast('Corrections est maintenant dans Entraînement.','var(--sub)',4500);
    return true;
  }catch(e){ return false; }
}
// ======= SESSION MANAGER =======
const DAYS=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const DAY_ICONS=['L','Ma','Me','J','V','S','D'];

// ══ L APERCU D UNE SEANCE, DANS SON CRENEAU ═══════════════════════════════
// Demande de Kevin, 24/08/2026. Il remplace le depot de la photo de fiche
// programme : plutot que de coller une capture d ecran de son classeur,
// l athlete voit la seance telle que l app la connait deja — et peut la
// telecharger ou la partager.
//
// LE DESSIN EXISTE DEJA, ET C EST TOUT L INTERET. _dessinerStorySeance rend
// cette carte en PNG sur un canvas, telechargerSeanceDuJour l enregistre,
// partagerSeanceDuJour ouvre la feuille native. Ce bloc-ci n en est que
// l APERCU a l ecran : les memes donnees, la meme mise en page, et les deux
// memes boutons. Rien n est recalcule — un apercu qui ne montrerait pas ce que
// le fichier contient serait pire qu aucun apercu.
//
// LES DEUX BOUTONS PASSENT PAR _selDay, qui est le jour choisi pour la story.
// C est la seule variable qui commande _storyDonnees : la poser, c est dire
// « c est CETTE seance-la que je partage », et l apercu d a cote correspond
// alors exactement au fichier produit.
function _seanceStoryPour(i){
  _selDay=i;
  try{ if(window._weekProgEl) _renderProgExercisesInto(window._weekProgEl); }catch(e){}
}
function telechargerSeanceSlot(i){ _seanceStoryPour(i); return telechargerSeanceDuJour(); }
function partagerSeanceSlot(i){ _seanceStoryPour(i); return partagerSeanceDuJour(); }
// PURE. L apercu d un creneau. Rend '' quand il n y a rien a montrer : un
// creneau sans exercice ne se partage pas, et une carte vide avec deux boutons
// inertes serait une promesse non tenue.
function htmlCarteSeanceSlot(i,s){
  const ex=(s&&Array.isArray(s.exercises))?s.exercises:[];
  if(!ex.length) return '';
  // Le repos affiche est celui de la PREMIERE serie qui en porte un, comme
  // dans _storyDonnees : deux lectures du meme champ finiraient par diverger.
  const repos=(ex.map(e=>e&&e.repos).filter(Boolean)[0]||'');
  const titre=((DAYS[i]||'')+(s.name?' : '+s.name:'')).toUpperCase();
  // QUATORZE LIGNES, COMME LE DESSIN. Au-dela, la story coupe et compte le
  // reste ; l apercu doit couper au meme endroit, sinon il annonce des lignes
  // que le fichier n aura pas.
  const vis=ex.slice(0,14), coupes=Math.max(0,ex.length-14);
  const lignes=vis.map((e,n)=>`<li class="cs-li">
    <span class="cs-no">${n+1}</span>
    <span class="cs-nom">${escapeHtml(String(e.name||'').toUpperCase())}</span>
    <span class="cs-det">${escapeHtml(String(e.series||'')+'×'+String(e.reps||''))}</span>
  </li>`).join('');
  const part=(typeof navigator!=='undefined'&&navigator.share)
    ?`<button type="button" class="cs-btn cs-btn-plein" onclick="partagerSeanceSlot(${i})">${icon('share',14)}Partager ma séance</button>`:'';
  return `<div class="cs-carte">
    <div class="cs-tete">
      <span class="cs-sur">Séance du jour</span>
    </div>
    <div class="cs-titre">${escapeHtml(titre)}</div>
    <div class="cs-meta">${ex.length} exercice${ex.length>1?'s':''}${repos?' · '+escapeHtml(repos)+' repos':''}</div>
    <ol class="cs-liste">${lignes}</ol>
    ${coupes?`<div class="cs-plus">+ ${coupes} autre${coupes>1?'s':''}</div>`:''}
    <div class="cs-actions">
      <button type="button" class="cs-btn" onclick="telechargerSeanceSlot(${i})">${icon('download',14)}Télécharger</button>
      ${part}
    </div>
    <!-- CE QUI SORT DE L'APPLICATION SE DIT AVANT LE GESTE, pas apres. La carte
         porte le nom du coach et une adresse : quelqu'un a le droit de le
         savoir avant de la poster, pas de le decouvrir sur sa story. -->
    <div class="cs-mention">Ta carte porte le nom de ton coach et un QR vers sa vitrine.</div>
  </div>`;
}
// ══ LA BOUTIQUE : RENDU ET APPLICATION ═══════════════════════════════════
function ouvrirBoutique(){
  _rendreBoutique();
  go('s-boutique');
  // Le rafraichissement arrive APRES l'affichage : la boutique s'ouvre sur le
  // cache — donc tout de suite, et hors ligne — puis se corrige si le reseau
  // repond. Un prix d'hier vaut mieux qu'une page blanche.
  rafraichirBoutique();
}
// PURE. Le genre a utiliser pour un programme qui en porte deux jeux.
// Meme lecture que partout ailleurs : le bilan d'abord, la fiche ensuite.
function _genreProgramme(u){
  const b=(u&&(u._evol_gender||u.gender))||'';
  return isFemale(b)?'F':(b?'H':null);
}
function _rendreBoutique(){
  // btq-liste : voir le balisage de #s-boutique — bq-liste est celle du coach.
  const z=document.getElementById('btq-liste');
  if(z) z.innerHTML=programmesBoutique().map(_htmlCarteProgramme).join('')
    ||'<div class="sub" style="text-align:center;padding:28px 0">Aucun programme pour le moment.</div>';
  try{ _rendreEntreeVente(); }catch(e){}
  const c=document.getElementById('bq-contact');
  if(!c) return;
  const lien=lienWhatsApp('Bonjour Kevin, je te contacte depuis RepCore '
    +'pour une demande de coaching.');
  // PAS DE NUMERO, PAS DE BOUTON. Un bouton de contact qui n'ouvre rien est
  // pire que pas de bouton : il fait croire qu'on a ecrit.
  c.innerHTML=lien
    ?'<div style="background:var(--surface-1);border:1px solid var(--border);'
      +'border-radius:var(--r-4);padding:20px;margin-top:6px;text-align:center">'
      +'<div style="font-size:var(--fs-sm);color:var(--sub);line-height:1.6;margin-bottom:14px">'
      +'Tu cherches un suivi sur mesure plutôt qu\'un programme tout fait ?</div>'
      +'<a class="btn btn-outline btn-sm" style="width:100%;margin:0;text-decoration:none" '
      +'href="'+escapeHtml(lien)+'" target="_blank" rel="noopener noreferrer">'
      +'TOUTE DEMANDE DE COACHING</a></div>'
    :'';
}
// PURE. La carte d'un programme. La devanture est une IMAGE quand le fichier
// existe, et un dessin CSS sinon — voir le commentaire de RC_PROGRAMMES.
function _htmlCarteProgramme(p){
  if(!p) return '';
  const nom=escapeHtml(p.nom||''), prix=prixProgramme(p);
  // ⚠ L'IMAGE SE RETIRE ELLE-MEME SI ELLE MANQUE. Une devanture cassee — le
  // rectangle gris a l'icone brisee — abime plus la page que son absence.
  // Le dessin CSS est DESSOUS, pas a la place : il apparait quand l'image
  // s'efface, sans qu'il y ait a choisir a l'avance.
  const dev='<div class="bq-dev">'
    +'<div class="bq-dev-fond"><span class="bq-dev-nom">'+nom+'</span>'
    +(p.phase?'<span class="bq-dev-phase">'+escapeHtml(p.phase)+'</span>':'')+'</div>'
    +(p.image?'<img class="bq-dev-img" src="'+escapeHtml(p.image)+'" alt="" '
      +'loading="lazy" onerror="this.remove()">':'')
    +'</div>';
  return '<div class="bq-carte">'+dev
    +'<div class="bq-corps">'
    +'<div class="bq-tete"><span class="bq-nom">'+nom+'</span>'
    +(prix?'<span class="bq-prix">'+prix+'</span>':'')+'</div>'
    +(p.accroche?'<div class="bq-accroche">'+escapeHtml(p.accroche)+'</div>':'')
    +((p.tags&&p.tags.length)
      ?'<div class="bq-tags">'+p.tags.map(t=>'<span>'+escapeHtml(t)+'</span>').join('')+'</div>':'')
    +(p.description?'<div class="bq-desc">'+escapeHtml(p.description)+'</div>':'')
    // ══ CE QU'ON ACHETE, AVANT DE PAYER (lot 8) ══════════════════════════
    +(()=>{
      const g=(()=>{ try{ return _genreProgramme(currentUser)||'H'; }catch(e){ return 'H'; } })();
      const faits=faitsProgrammeNeufs(p);
      const mat=materielProgramme(p,g);
      const ap=apercuProgramme(p,g);
      let h='';
      if(faits.length) h+='<div class="bq-faits">'+faits.map(escapeHtml).join(' · ')+'</div>';
      if(mat.length) h+='<div class="bq-mat">Matériel : '+escapeHtml(mat.join(', '))+'</div>';
      if(ap){
        h+='<div class="bq-apercu"><div class="bq-apercu-t">Aperçu'
          +(ap.seance?' · '+escapeHtml(ap.seance):'')+'</div><ol class="bq-apercu-l">'
          +ap.exercices.map(x=>'<li>'+escapeHtml(x)+'</li>').join('')+'</ol>'
          +(ap.total>ap.exercices.length
            ?'<div class="bq-apercu-s">et '+(ap.total-ap.exercices.length)+' autre'
              +((ap.total-ap.exercices.length)>1?'s':'')+' dans cette séance</div>':'')
          +'</div>';
      }
      return h;
    })()
    +_htmlActionProgramme(p)
    +'</div></div>';
}
// ══ METTRE SES PROGRAMMES EN VENTE ═══════════════════════════════════════
//
// ⚠ RESERVE AU CREATEUR, ET C'EST LA REGLE RTDB QUI LE TIENT — pas cet ecran.
// Un autre coach qui l'atteindrait ne pourrait rien ecrire : le noeud
// /boutique n'accepte que l'adresse du createur. L'interface se contente de
// ne pas proposer ce qu'elle sait refuse.
function estVendeur(u){
  const uu=u||currentUser;
  return !!(uu&&uu.email===CREATOR_EMAIL);
}
function _rendreEntreeVente(){
  const z=document.getElementById('bq-vendeur');
  if(!z) return false;
  z.innerHTML=estVendeur()
    ?'<button class="btn btn-outline btn-sm" style="width:100%;margin:0 0 20px" '
      +'onclick="ouvrirMesProgrammes()">Gérer mes programmes en vente</button>'
    :'';
  return true;
}
// LA GESTION DES VENTES VIT DANS « MES PROGRAMMES ». Un second ecran du meme
// nom, derriere la boutique, listait les memes modeles sous d'autres boutons :
// deux endroits pour la meme chose. Le bouton de la boutique y mene donc.
function ouvrirMesProgrammes(){
  if(!estVendeur()){ toast('Réservé au coach.','var(--orange)'); return false; }
  openCoachPrograms();
  return true;
}
// La fiche. `id` pour retoucher une entree existante, `idxModele` pour
// publier un de ses propres programmes.
//
// ⚠ UN MODELE DEJA PUBLIE SE RETOUCHE, IL NE SE REPUBLIE PAS SOUS UN AUTRE
// NOM. L'identifiant venait du titre : changer le titre creait une seconde
// fiche, et la premiere restait en vente avec les anciennes seances. Le
// modele garde donc `boutiqueId`, pose a la premiere publication.
//
// `_venteImageDeja` : le visuel qu'on garde si on n'en choisit pas d'autre.
let _venteId=null, _venteModele=null, _venteImage=null, _venteImageDeja='';
const VENTE_PITCH_MAX=219;
function ouvrirFicheVente(id,idxModele){
  if(!estVendeur()){ toast('Réservé au coach.','var(--orange)'); return false; }
  _venteModele=(typeof idxModele==='number')
    ?((currentUser&&currentUser.coachPrograms)||[])[idxModele]||null:null;
  _venteId=id||(_venteModele&&_venteModele.boutiqueId)||null;
  _venteImage=null;
  const p=_venteId?programmeDuCatalogue(_venteId):null;
  const m=_venteModele||{};
  // PREMIERE MISE EN VENTE D'UN MODELE : on part de ce qu'il porte deja — son
  // nom, et ce qu'une ancienne fiche de vitrine y a laisse.
  const nom=p?(p.nom||''):(m.name||'');
  const pitch=p?(p.accroche||''):String(m.pitch||'');
  const cts=p?p.prixCts:prixEnCentimes(m.prix);
  _venteImageDeja=p?String(p.image||''):String(m.visuel||'');
  const t=document.getElementById('vn-titre');
  if(t) t.textContent=(p&&!p.masque)?'Modifier la vente':'Mettre en vente';
  const z=document.getElementById('vn-corps');
  if(!z) return false;
  // CE QUI SE PASSE A L'ACHAT, DIT AU MOMENT DE PUBLIER. Et si une version est
  // vide, qui recevra quoi : _seancesPubliees retombe sur l'autre.
  let mention='Paiement par PayPal dans l’application. Dès l’achat, le programme '
    +'s’installe chez la personne, dans sa version Homme ou Femme.';
  if(_venteModele){
    const h=_cplSeancesPleines(m,'H').length, f=_cplSeancesPleines(m,'F').length;
    if(h&&!f) mention+=' Pas encore de version Femme : une acheteuse recevra la version Homme.';
    if(f&&!h) mention+=' Pas encore de version Homme : un acheteur recevra la version Femme.';
  }
  const ea=s=>escapeHtml(String(s==null?'':s));
  z.innerHTML='<label class="vn-lab" for="vn-nom" style="margin-top:0">Titre</label>'
    +'<input id="vn-nom" class="vn-in" maxlength="79" autocomplete="off" value="'+ea(nom)+'" '
      +'placeholder="Ex. : Programme débutant" oninput="_venteApercu()">'
    // ⚠ LE PRIX SE SAISIT EN EUROS ET SE STOCKE EN CENTIMES. Un champ en
    // centimes serait une invitation a la faute de frappe a deux zeros pres.
    +'<label class="vn-lab" for="vn-prix">Prix</label>'
    +'<div class="vn-prix"><input id="vn-prix" class="vn-in" inputmode="decimal" autocomplete="off" '
      +'value="'+((typeof cts==='number'&&cts>0)?(cts/100).toFixed(2).replace('.',','):'')+'" '
      +'placeholder="14,90" oninput="_venteApercu()"><span aria-hidden="true">€</span></div>'
    +'<label class="vn-lab" for="vn-acc">Pitch</label>'
    +'<textarea id="vn-acc" class="vn-in" rows="3" maxlength="'+VENTE_PITCH_MAX+'" '
      +'placeholder="Ce que ce programme apporte, en deux phrases" oninput="_venteApercu()">'
      +ea(pitch.slice(0,VENTE_PITCH_MAX))+'</textarea>'
    +'<div class="cpv-compte" id="vn-reste"></div>'
    // MEME DEFAUT, MEME CAUSE : `input[type=file]{display:none}` est global, et
    // un champ fichier nu ne s'affiche pas. C'est le LABEL qui ouvre le selecteur.
    +'<div class="vn-lab">Visuel</div>'
    +'<label class="btn btn-outline btn-sm" style="display:block;text-align:center;cursor:pointer;margin:0">Choisir une image'
    +'<input type="file" id="vn-img" accept="image/*" style="display:none" onchange="_venteChoisirImage(this)">'
    +'</label>'
    // RETIRER N'EST PAS SUPPRIMER : la fiche reste lisible par ceux qui l'ont
    // payee. La case n'existe que pour ce qui est deja dans la boutique.
    +(p?('<label class="vn-cb"><input type="checkbox" id="vn-off"'+(p.masque?' checked':'')
        +'> Retirer de la vente : ceux qui l’ont acheté le gardent</label>'):'')
    +'<div class="cpv-mention">'+mention+'</div>'
    +'<div class="vn-lab">Ce que verra l’acheteur</div>'
    +'<div id="vn-apercu" class="vn-apercu" inert></div>';
  const e=document.getElementById('vn-err'); if(e){ e.style.display='none'; e.textContent=''; }
  _venteApercu();
  _feuilleOuvrir('rc-vente');
  return true;
}
function fermerFicheVente(tout_de_suite){
  _feuilleFermer('rc-vente',tout_de_suite);
  _venteId=null; _venteModele=null; _venteImage=null; _venteImageDeja='';
}
// L'APERCU EST LA CARTE DE LA BOUTIQUE ELLE-MEME, pas une imitation :
// _htmlCarteProgramme dessine les deux. Seul le bouton du coach en est retire
// — l'acheteur ne le verra jamais.
function _venteApercu(){
  const z=document.getElementById('vn-apercu');
  if(!z) return false;
  const val=id=>{ const e=document.getElementById(id); return e?String(e.value||''):''; };
  const base=_venteId?programmeDuCatalogue(_venteId):null;
  const cts=prixEnCentimes(val('vn-prix'));
  z.innerHTML=_htmlCarteProgramme({id:'apercu-vente',
    nom:val('vn-nom').trim()||'Titre du programme',
    prixCts:(cts===null)?NaN:cts,
    accroche:val('vn-acc').trim(),
    description:(base&&base.description)||'',
    tags:(base&&base.tags)||null, phase:base&&base.phase,
    image:_venteImage||_venteImageDeja||''});
  z.querySelectorAll('button').forEach(b=>{
    if(/offrirProgramme/.test(b.getAttribute('onclick')||'')) b.remove();
    else b.removeAttribute('onclick');
  });
  // Le compteur passe a l'orange au dernier dixieme : on previent avant la
  // butee, pas au moment ou la frappe cesse de repondre.
  const r=document.getElementById('vn-reste');
  if(r){
    const reste=VENTE_PITCH_MAX-val('vn-acc').length;
    r.textContent=reste+' caractère'+(reste>1?'s':'')+' restant'+(reste>1?'s':'');
    r.dataset.plein=(reste<=22)?'1':'0';
  }
  return true;
}
// ⚠ L'IMAGE EST REDIMENSIONNEE AVANT D'ETRE GARDEE. Elle part dans un noeud
// PUBLIC que chaque athlete relit a chaque ouverture de la boutique : une
// photo de telephone non reduite y couterait plusieurs megaoctets par lecture,
// et le plan Spark compte les octets descendus.
async function _venteChoisirImage(input){
  const f=input&&input.files&&input.files[0];
  if(!f) return false;
  try{
    _venteImage=await _resizeImage(f,900,1200,.82);
    _venteApercu();
  }catch(e){ _venteImage=null; }
  return true;
}
function _venteErreur(m){
  const e=document.getElementById('vn-err');
  if(e){ e.textContent=m; e.style.display=''; }
  return false;
}
// PURE. « 14,90 » ou « 14.90 » → 1490. Rend null sur une saisie qui n'est pas
// un prix : mieux vaut refuser que publier un programme a zero euro.
function prixEnCentimes(txt){
  const brut=String(txt==null?'':txt).trim();
  // ⚠ LE SIGNE SE REFUSE AVANT LE NETTOYAGE, PAS APRES. Retirer « tout ce qui
  // n'est pas un chiffre » transformait « -3 » en « 3 » : un prix negatif
  // devenait un prix positif, en silence. Trouve par son assertion.
  if(/-/.test(brut)) return null;
  // ⚠ TOUTES LES VIRGULES, PAS LA PREMIERE. `replace(',','.')` n'en remplace
  // qu'une : « 12,3,4 » devenait « 12.3,4 », le nettoyage retirait la seconde
  // virgule et rendait « 12.34 » — une saisie manifestement fautive devenait
  // un prix, en silence. Trouve par son assertion.
  const t=brut.replace(/,/g,'.').replace(/[^\d.]/g,'');
  if(!t||!/^\d+(\.\d+)?$/.test(t)) return null;
  const v=Number(t);
  if(!isFinite(v)||v<0||v>5000) return null;
  return Math.round(v*100);
}
async function enregistrerFicheVente(){
  if(!estVendeur()) return _venteErreur('Réservé au coach.');
  const val=id=>{ const e=document.getElementById(id); return e?String(e.value||'').trim():''; };
  const nom=val('vn-nom');
  if(!nom) return _venteErreur('Donne un titre au programme.');
  const cts=prixEnCentimes(val('vn-prix'));
  if(cts===null) return _venteErreur('Prix invalide. Exemple : 14,90');
  const m=_venteModele;
  const id=_venteId||_idBoutiqueLibre(nom);
  if(!id) return _venteErreur('Titre inutilisable : il faut au moins une lettre ou un chiffre.');
  const dejà=_programmePublie(id);
  const obj={nom:nom.slice(0,79),prixCts:cts,maj:Date.now()};
  const acc=val('vn-acc');
  if(acc) obj.accroche=acc.slice(0,VENTE_PITCH_MAX);
  // LA DESCRIPTION NE SE SAISIT PLUS ICI, MAIS ELLE NE S'EFFACE PAS : le PUT
  // remplace la fiche entiere, et une description deja publiee tomberait.
  if(dejà&&dejà.description) obj.description=String(dejà.description).slice(0,1399);
  const off=document.getElementById('vn-off');
  if(off) obj.masque=!!off.checked;
  // L'image : la nouvelle si on en a choisi une, sinon celle deja publiee, ou
  // pour une premiere mise en vente celle qu'une fiche de vitrine avait posee.
  const img=_venteImage||(dejà&&dejà.image)||(!dejà&&m&&m.visuel)||'';
  if(img) obj.image=String(img);
  // LES SEANCES. Celles du modele qu'on publie, ou celles deja en ligne. Un
  // programme du catalogue livre avec l'application n'en a pas besoin : sa
  // fiche ne sert qu'a retoucher prix et textes, et programmeDuCatalogue
  // retombe alors sur les seances du code.
  if(m){
    obj.seances=_venteSeancesJson(m);
    if(!obj.seances) return _venteErreur('Ce programme n’a aucune séance : remplis au moins une version avant de le vendre.');
  } else if(dejà&&dejà.seances) obj.seances=dejà.seances;
  if(obj.image&&obj.image.length>=420000) return _venteErreur('Image trop lourde, même réduite.');
  if(obj.seances&&obj.seances.length>=240000) return _venteErreur('Programme trop volumineux à publier.');
  if(!CLOUD.ok()) return _venteErreur('Hors ligne : la publication a besoin du réseau.');
  const ok=await CLOUD.ecrireProgrammeBoutique(id,obj);
  if(!ok) return _venteErreur('La publication a échoué. Réessaie.');
  // LE LIEN MODELE → FICHE, pose une fois. C'est lui qui fait retoucher la
  // meme fiche la prochaine fois, et suivre les seances a chaque sauvegarde.
  if(m&&m.boutiqueId!==id){ m.boutiqueId=id; try{ saveUser(); }catch(e){ rcErreurMuette('enregistrerFicheVente',e); } }
  // On relit le noeud plutot que de recopier ce qu'on croit avoir ecrit : la
  // base a pu normaliser, et c'est elle qui fait foi.
  await rafraichirBoutique();
  fermerFicheVente(true);
  try{ loadCoachProgramsList(); }catch(e){}
  toast(obj.masque?'« '+nom+' » est retiré de la vente.':'« '+nom+' » est en vente dans la boutique.','var(--green)');
  return true;
}
// PURE. Les seances d'un modele telles qu'elles partent dans la boutique, en
// chaine JSON — null s'il n'y en a aucune.
//
// ⚠ UNE VERSION SANS SEANCE PART VIDE. Sept creneaux eteints forment un
// tableau NON vide : _seancesPubliees l'aurait pris, et une acheteuse aurait
// recu sept jours de repos au lieu de la version Homme.
// ⚠ LES PHOTOS DE SEANCE RESTENT CHEZ LE COACH : du base64 dans un noeud que
// chaque athlete relit, et qui ferait refuser la publication pour sa taille.
function _venteSeancesJson(m){
  const jeu=g=>{
    const l=_cptSeances(m,g)||[];
    if(!l.some(s=>s&&s.active&&Array.isArray(s.exercises)&&s.exercises.length)) return [];
    return l.map(s=>(s&&typeof s==='object')
      ?Object.assign(JSON.parse(JSON.stringify(s)),{photo:null,photo2:null}):null);
  };
  const H=jeu('H'), F=jeu('F');
  return (H.length||F.length)?JSON.stringify({H:H,F:F}):null;
}
// PURE. Un identifiant stable a partir d'un nom. Sans accents ni espaces :
// il devient une clef de base, et une clef ne se renomme pas.
function _slugProgramme(nom){
  return String(nom||'').normalize('NFD').replace(/[̀-ͯ]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50);
}
// PURE (au cache pres). Un identifiant NEUF. Le titre seul ne suffit pas : un
// programme intitule « Fondations » aurait pris la cle de la Fondation, et sa
// publication aurait remplace celle qui est deja en vente.
function _idBoutiqueLibre(nom){
  const base=_slugProgramme(nom);
  if(!base) return null;
  const pris=id=>RC_PROGRAMMES.some(p=>p.id===id)||!!_programmePublie(id);
  if(!pris(base)) return base;
  for(let n=2;n<10;n++) if(!pris(base+'-'+n)) return base+'-'+n;
  return base+'-'+Date.now().toString(36);
}
// L'ACTION DE LA CARTE. Trois etats, et un seul bouton a la fois : on achete,
// on applique, ou — pour le coach — on offre. Deux boutons cote a cote
// obligeraient a choisir avant d'avoir compris ce qu'on achete.
function _htmlActionProgramme(p){
  const id=escapeHtml(p.id);
  const acquis=programmeAcquis(currentUser,p.id);
  const createur=!!(currentUser&&currentUser.email===CREATOR_EMAIL);
  let h='';
  if(acquis){
    h+='<button class="btn btn-red btn-sm" style="width:100%;margin-top:16px" '
      +'onclick="appliquerProgramme(\''+id+'\')">Enregistrer dans mes séances</button>';
    if(!RC_BOUTIQUE_GRATUITE&&p.prixCts){
      // UN ACHAT QUE LE SERVEUR N'A PAS OUVERT (02/10/2026) : pas un cadenas
      // muet, une phrase qui dit quoi faire.
      h+=(()=>{ try{ return achatEnVerification(currentUser,p.id); }catch(e){ return false; } })()
        ?'<div class="bq-note" data-verif="1">Achat en cours de vérification, écris à '
          +'<a href="mailto:'+escapeHtml(CREATOR_EMAIL)+'?subject='+encodeURIComponent('Achat RepCore : '+(p.nom||p.id))+'">'
          +escapeHtml(CREATOR_EMAIL)+'</a>.</div>'
        :'<div class="bq-note">Programme acquis.</div>';
    }
  } else {
    h+='<button class="btn btn-red btn-sm" style="width:100%;margin-top:16px" '
      +'onclick="ouvrirAchatProgramme(\''+id+'\')">Acheter, '+prixProgramme(p)+'</button>';
    // ⚠ LE COACH L'APPLIQUE SANS PAYER, et c'est un pouvoir, pas un raccourci :
    // il vend ses propres programmes. La porte est fermee a tout autre compte.
    if(createur)
      h+='<button class="btn btn-outline btn-sm" style="width:100%;margin-top:10px" '
        +'onclick="offrirProgramme(\''+id+'\')">L\'enregistrer sans payer (coach)</button>';
  }
  return h;
}
// ══ L'ACHAT ══════════════════════════════════════════════════════════════
//
// UN ACHAT UNIQUE, PAS UN ABONNEMENT. Le flux d'abonnement charge le SDK avec
// `vault=true&intent=subscription` et passe par createSubscription ; celui-ci
// demande `intent=capture` et createOrder. Les deux SDK ne peuvent pas
// cohabiter sous le meme nom — d'ou le data-namespace, et le script porte son
// propre identifiant.
let _achatProgId=null;
function ouvrirAchatProgramme(id){
  const p=programmeDuCatalogue(id);
  if(!p){ toast('Programme introuvable.','var(--orange)'); return; }
  if(!currentUser){
    toast('Crée ton compte avant d\'acheter.','var(--orange)');
    // Un programme s'achete en athlete : le role est pose (QA du 27/09/2026).
    go('s-register'); try{ selectRole('athlete',true); }catch(e){} return;
  }
  _achatProgId=id;
  const z=document.getElementById('ach-corps');
  if(z) z.innerHTML='<div class="rci-t">'+escapeHtml(p.nom||'')+'</div>'
    +'<div class="bq-tete" style="margin-top:4px"><span class="bq-accroche" style="margin:0">'
    +escapeHtml(p.accroche||'')+'</span><span class="bq-prix">'+prixProgramme(p)+'</span></div>'
    // ⚠ CE QU'ON ACHETE EST ECRIT AVANT DE PAYER (lot 9). Pour une revision,
    //   c'est la phrase qui evite la soiree d'allers-retours : elle dit ce que
    //   l'ajustement fait, ET ce qu'il n'est pas.
    +(p.description?'<p class="bq-desc" style="margin-top:8px;line-height:1.6">'
      +escapeHtml(p.description)+'</p>':'');
  const b=document.getElementById('ach-paypal');
  if(b) b.innerHTML='<div class="skeleton fx-loop" style="height:55px;border-radius:var(--r-2)"></div>';
  const c=document.getElementById('ach-cgv');
  // ⚠ LA CASE EST REPOSEE A CHAQUE OUVERTURE. Une renonciation cochee lors
  // d'un achat precedent ne vaut pas pour celui-ci : elle porte sur CE
  // contenu-la, et un consommateur doit la donner pour chaque achat.
  if(c) c.checked=false;
  _majBoutonAchat();
  _feuilleOuvrir('rc-achat');
  _chargerPaypalAchat();
}
function fermerAchatProgramme(tout_de_suite){
  _feuilleFermer('rc-achat',tout_de_suite);
}
// Le bouton PayPal n'est pas seulement masque : createOrder refuse aussi, pour
// qu'aucun chemin ne contourne la case. Meme discipline que l'abonnement.
function _majBoutonAchat(){
  const c=document.getElementById('ach-cgv'), b=document.getElementById('ach-paypal');
  if(b) b.style.display=(c&&c.checked)?'':'none';
}
function _chargerPaypalAchat(){
  const rendre=()=>_rendreBoutonAchat();
  if(document.getElementById('paypal-sdk-achat')){ rendre(); return; }
  const sc=document.createElement('script');
  sc.id='paypal-sdk-achat';
  // ⚠ UN ESPACE DE NOMS PROPRE. Le SDK de l'abonnement occupe deja `paypal` ;
  // charger celui-ci par-dessus ecraserait l'un des deux selon l'ordre
  // d'arrivee, et le defaut ne se verrait que sur l'ecran qu'on n'a pas teste.
  sc.setAttribute('data-namespace','paypalAchat');
  // ⚠ LA CARTE ETAIT FERMEE PAR NOUS (corrige au lot 5). Le SDK etait charge
  //   avec `disable-funding=credit,card` : personne ne pouvait payer par carte
  //   sans compte PayPal, et ca se voyait dans les ventes.
  //   'credit' = le CREDIT PayPal, une offre de financement qui ne concerne
  //   pas la France : le desactiver est normal.
  //   'card'   = le paiement par carte SANS compte PayPal : c'est exactement
  //   ce qu'on veut ouvrir.
  // L'ARGENT ARRIVE SUR LE MEME COMPTE DANS LES DEUX CAS : c'est PayPal qui
  // encaisse la carte et qui reverse. Il n'y a rien a changer cote
  // encaissement, uniquement l'affichage.
  sc.src='https://www.paypal.com/sdk/js?client-id='+PAYPAL_CLIENT_ID
    +'&currency=EUR&intent=capture&components=buttons&enable-funding=card&disable-funding=credit';
  sc.onload=rendre;
  sc.onerror=()=>{ const b=document.getElementById('ach-paypal');
    if(b) b.innerHTML='<button class="btn btn-outline btn-sm" style="width:100%" '
      +'onclick="_chargerPaypalAchat()">Erreur de chargement : réessayer</button>'; };
  document.head.appendChild(sc);
}
function _rendreBoutonAchat(){
  const z=document.getElementById('ach-paypal');
  if(!z) return;
  const sdk=window.paypalAchat;
  if(!sdk||!sdk.Buttons){ z.innerHTML='<div class="bq-note">PayPal n\'a pas pu se charger.</div>'; return; }
  // ══ DEUX BOUTONS, DEUX CHEMINS, AUCUNE AMBIGUITE (lot 5) ═══════════════
  // Le bouton carte n'est plus cache derriere « autres moyens de paiement » :
  // il a sa place, sous celui de PayPal, avec son propre intitule.
  z.innerHTML='<div id="ach-pp"></div>'
    +'<div id="ach-carte-lib" class="bq-note" style="margin:10px 0 6px;display:none">'
    +'Payer par carte bancaire, sans compte PayPal</div><div id="ach-carte"></div>';
  sdk.Buttons(Object.assign({},_paiementPayPalOptions(sdk),{
    style:{layout:'vertical',color:'black',shape:'rect',label:'pay'},
    createOrder:(data,actions)=>{
      const c=document.getElementById('ach-cgv');
      // DEUXIEME VERROU : masquer ne suffit pas, un clic programmatique
      // contournerait l'affichage.
      if(!c||!c.checked){ toast('Coche la case avant de payer.','var(--orange)'); return null; }
      const p=programmeDuCatalogue(_achatProgId);
      if(!p) return null;
      return actions.order.create({
        purchase_units:[{
          description:('RepCore : '+(p.nom||'Programme')).slice(0,127),
          custom_id:_cleComptePaypal()+'|'+p.id,
          // ⚠ LE MONTANT SE CONSTRUIT DEPUIS LES CENTIMES. Passer un flottant
          // ici est le chemin le plus court vers un ordre a 14.899999999999999.
          amount:{currency_code:'EUR',value:(p.prixCts/100).toFixed(2)}
        }]
      });
    },
    onApprove:(data,actions)=>actions.order.capture().then(d=>{
      _enregistrerAchat(_achatProgId,(d&&d.id)||(data&&data.orderID)||'');
    }),
    onError:()=>{ toast('Le paiement n\'a pas abouti.','var(--orange)'); }
  })).render('#ach-pp');
  // LE BOUTON CARTE, EXPLICITE. `isEligible` decide : si le compte marchand
  // ou le pays ne l'accepte pas, on n'affiche RIEN plutot qu'un cadre vide.
  try{
    const carte=sdk.Buttons(Object.assign({},_paiementCarteOptions(sdk),{
      createOrder:(data,actions)=>{
        const c=document.getElementById('ach-cgv');
        if(!c||!c.checked){ toast('Coche la case avant de payer.','var(--orange)'); return null; }
        const p=programmeDuCatalogue(_achatProgId);
        if(!p) return null;
        return actions.order.create({purchase_units:[{
          description:('RepCore : '+(p.nom||'Programme')).slice(0,127),
          custom_id:_cleComptePaypal()+'|'+p.id,
          amount:{currency_code:'EUR',value:(p.prixCts/100).toFixed(2)}
        }]});
      },
      onApprove:(data,actions)=>actions.order.capture().then(d=>{
        _enregistrerAchat(_achatProgId,(d&&d.id)||(data&&data.orderID)||'');
      }),
      onError:()=>{ toast('Le paiement n\'a pas abouti.','var(--orange)'); }
    }));
    if(carte.isEligible&&carte.isEligible()){
      const lib=document.getElementById('ach-carte-lib');
      if(lib) lib.style.display='';
      carte.render('#ach-carte');
    }
  }catch(e){}
}
// ⚠ LE MEME HABILLAGE POUR LES DEUX ECRANS. Le bouton carte de PayPal porte
//   SON libelle, que nous ne choisissons pas : le notre est la ligne au-dessus.
//   `fundingSource: FUNDING.CARD` est ce qui le fait sortir de « autres moyens
//   de paiement », ou personne ne va le chercher.
function _paiementCarteOptions(sdk){
  return {fundingSource:(sdk&&sdk.FUNDING&&sdk.FUNDING.CARD)||'card',
    style:{layout:'vertical',color:'black',shape:'rect',height:45}};
}
// ⚠ ET LA PILE DU HAUT EST EPINGLEE SUR PAYPAL (24/09/2026). Sans ce reglage,
//   elle rendait TOUT ce que le compte accepte — donc PayPal ET la carte,
//   puisque enable-funding=card la reclame. L'ecran montrait alors trois
//   boutons : « Payer avec PayPal », « Carte bancaire », puis notre libelle et
//   une SECONDE « Carte bancaire ». Constate en production le 24/09/2026, sur
//   l'abonnement comme sur l'achat d'un programme.
//
//   Deux boutons identiques a deux centimetres l'un de l'autre, au moment
//   precis de payer, c'est une hesitation de plus la ou il n'en faut aucune —
//   et la moitie des gens cherche lequel est le bon.
//
//   ON GARDE LE NOTRE plutot que celui de la pile : c'est le seul dont on
//   choisisse le libelle (« Payer par carte bancaire, sans compte PayPal »),
//   et le seul qu'on puisse cacher quand isEligible dit non.
//
//   ⚠ SI UN JOUR ON VEUT LE PAIEMENT EN QUATRE FOIS ou un moyen local, il
//     faudra l'ajouter ICI, en bouton nomme : cette epingle empeche PayPal de
//     l'ajouter tout seul dans la pile.
function _paiementPayPalOptions(sdk){
  return {fundingSource:(sdk&&sdk.FUNDING&&sdk.FUNDING.PAYPAL)||'paypal'};
}
// L'ACHAT EST ECRIT, PUIS LE PROGRAMME S'APPLIQUE. Dans cet ordre : si
// l'application echoue ou si l'athlete refuse d'ecraser ses seances, il a
// PAYE et doit garder son programme — il le retrouvera dans la boutique.
// LA CLÉ DU COMPTE, DANS custom_id (127 caractères au plus chez PayPal) : le
// serveur léger relit l'abonnement ou la commande chez PayPal pour savoir qui
// a payé — « <clé>|<programme> » pour un achat. Jamais l'adresse du payeur.
function _cleComptePaypal(){
  return String((currentUser&&currentUser.email)||'').toLowerCase().replace(/\./g,',').slice(0,100);
}
function _enregistrerAchat(id,ordre){
  const p=programmeDuCatalogue(id);
  if(!p||!currentUser) return false;
  if(!currentUser.programmesAchetes||typeof currentUser.programmesAchetes!=='object')
    currentUser.programmesAchetes={};
  const t=Date.now();
  // ⚠ UN PROGRAMME ACHETE OUVRE ULTIME PENDANT SA DUREE (lot 8). Quelqu'un qui
  //   paie un programme de huit a douze semaines doit pouvoir l'utiliser
  //   jusqu'au bout : la bibliotheque, la charge du bloc, la diete calculee.
  //   L'ECHEANCE SERIEUSE EST CELLE DU SERVEUR — verifierAchatProgramme (le
  //   Worker) la pose dans droits/ apres avoir relu l'ordre chez PayPal. Celle-ci
  //   est le repli tant que droits/ n'est pas relu, et elle vaut ce que
  //   vaut un champ du dossier : le meme arbitrage, deja assume, que pour
  //   `status` et `programmesAchetes` eux-memes.
  // LA DURÉE DE L'OFFRE (02/10/2026) : 3 mois pour un programme, 1 mois pour
  // une révision — la même table que le serveur (PRIX_EMBARQUES).
  const mois=(offre(p.service?'revision_prog':'boutique_prog')||{}).mois||(p.service?1:3);
  paiementRecentNoter(currentUser,'programme');
  currentUser.programmesAchetes[p.id]={le:t,prixCts:p.prixCts,
    ordre:String(ordre||'').slice(0,64),ouvertJusqu:t+mois*30*86400000};
  saveUser();
  // LE SERVEUR, SANS QU'ON L'ATTENDE : s'il repond, son echeance prend la main
  // a la premiere lecture de droits/.
  try{
    if(fonctionWorker('verifierAchatProgramme')&&CLOUD&&CLOUD._callFn&&ordre)
      CLOUD._callFn('verifierAchatProgramme',{orderId:String(ordre),programmeId:p.id})
        .then(()=>{ try{ rafraichirDroits(currentUser,true); }catch(e){} }).catch(()=>{});
  }catch(e){}
  fermerAchatProgramme(true);
  // UN SERVICE NE S'INSTALLE PAS DANS LES SEANCES (lot 9) : il n'a rien a y
  // ecrire, et « Programme applique » serait un mensonge poli.
  if(p.service){
    if(!Array.isArray(currentUser.revisions)) currentUser.revisions=[];
    currentUser.revisions.push({le:t,prixCts:p.prixCts,ordre:String(ordre||'').slice(0,64)});
    saveUser();
    try{ _rendreOutilsSeances(); }catch(e){}
    try{ setTimeout(()=>{ try{ ouvrirMerciRevision(); }catch(e){} },300); }catch(e){}
    return true;
  }
  _rendreBoutique();
  appliquerProgramme(p.id);
  // ══ LE REMERCIEMENT, ET LA SUITE QU'IL PROPOSE ═══════════════════════
  // Kevin : « C'est le bon moment, la carte est encore chaude. » Il arrive
  // APRES l'application du programme : la personne voit d'abord ce qu'elle a
  // achete, la proposition vient par-dessus.
  try{ setTimeout(()=>{ try{ ouvrirMerciAchat(p.id); }catch(e){} },400); }catch(e){}
  return true;
}
// L'ECRAN DE REMERCIEMENT. Il dit ce qui vient d'arriver, ce que l'achat
// ouvre, et propose UNE seule suite : le programme ecrit pour soi.
function ouvrirMerciAchat(id){
  const p=programmeDuCatalogue(id);
  if(!p) return false;
  const mois=(offre('boutique_prog')||{}).mois||3;
  const html='<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;'
    +'background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" style="background:var(--surface-2);'
    +'border-radius:var(--r-4) var(--r-4) 0 0;padding:20px 20px 24px;width:100%;max-width:480px;'
    +'max-height:90vh;overflow-y:auto">'
    +'<h2 style="margin-bottom:6px;font-size:var(--fs-lg)">« '+escapeHtml(p.nom||'Programme')+' » est à toi.</h2>'
    +'<p class="sub" style="font-size:var(--fs-sm);line-height:1.6;margin-bottom:14px">'
    +'Il est installé dans tes séances. Et pendant '+mois+' mois, tu as aussi le catalogue '
    +'d’exercices, la charge de ton bloc et ta diète calculée.</p>'
    +'<div style="background:var(--surface-1);border:1px solid var(--border);border-left:1px solid var(--border);'
    +'border-radius:var(--r-3);padding:14px 16px;margin-bottom:14px">'
    +'<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.65">'
    +'Tu veux que j’adapte ce programme à toi&nbsp;? Le programme personnalisé, c’est '
    +escapeHtml(prixOffre('programme_perso'))+'.</div>'
    +'<a class="vrr-b" href="https://beacons.ai/kevin.gllc" target="_blank" rel="noopener">'
    +'Voir les formules de coaching</a></div>'
    +'<button class="btn btn-red" style="width:100%" onclick="closeModal();loadSessionManager()">'
    +'Voir mes séances</button>'
    +'<button class="btn btn-outline" style="width:100%;margin-top:10px" onclick="closeModal()">Plus tard</button>'
    +'</div></div>';
  closeModal();
  document.body.insertAdjacentHTML('beforeend',html);
  return true;
}
// LE COACH OFFRE SON PROPRE PROGRAMME. Aucun ordre PayPal, et le dossier le
// dit : `offert` plutot qu'un identifiant de transaction.
async function offrirProgramme(id){
  if(!currentUser||currentUser.email!==CREATOR_EMAIL){
    toast('Réservé au coach.','var(--orange)'); return false;
  }
  const p=programmeDuCatalogue(id);
  if(!p) return false;
  if(!currentUser.programmesAchetes||typeof currentUser.programmesAchetes!=='object')
    currentUser.programmesAchetes={};
  currentUser.programmesAchetes[p.id]={le:Date.now(),prixCts:0,ordre:'offert'};
  saveUser();
  _rendreBoutique();
  return appliquerProgramme(p.id);
}
// L'APPLICATION D'UN PROGRAMME.
//
// ⚠ ON DEMANDE AVANT D'ECRASER, ET SEULEMENT SI IL Y A QUELQUE CHOSE A
// ECRASER. Arbitre par Kevin le 16/09/2026 : une grille vide se remplit sans
// question — il n'y a rien a perdre —, une grille qui porte du travail ne se
// remplace pas en silence. C'est la meme regle que la migration Fondation qui
// a deja coute le travail d'un coach, et qui a ete supprimee pour ca.
async function appliquerProgramme(id){
  const p=programmeDuCatalogue(id);
  if(!p){ toast('Programme introuvable.','var(--orange)'); return false; }
  if(!currentUser){ toast('Connecte-toi pour appliquer un programme.','var(--orange)'); return false; }
  // ⚠ LE DERNIER VERROU EST ICI, ET NON DANS LE BOUTON. La carte n'affiche
  // « Appliquer » que sur un programme acquis, mais un appel direct
  // contournerait l'affichage — c'est la meme discipline que la case de
  // renonciation, verrouillee deux fois elle aussi.
  if(!programmeAcquis(currentUser,id)){
    ouvrirAchatProgramme(id); return false;
  }
  let g=_genreProgramme(currentUser);
  if(!g){
    // Genre inconnu : on DEMANDE plutot que de trancher. Poser la version
    // Homme par defaut serait un choix arbitraire sur le corps de quelqu'un.
    g=(await rcConfirm('Quelle version de « '+(p.nom||'ce programme')+' » ?',
      null,'Homme','Femme'))?'H':'F';
  }
  // LE CONTENU N'EST PLUS DANS LA FICHE (01/10/2026) : on le lit s'il manque.
  // Juste apres un achat, il n'est lisible qu'une fois le paiement confirme
  // par PayPal au serveur : on reessaie quelques secondes.
  let pc=p;
  const _fiche=_programmePublie(id);
  if(_fiche&&_fiche.aContenu&&!_fiche.seances){
    for(let k=0;k<20;k++){
      if(await chargerContenuBoutique(id)) break;
      if(k===0) toast('Paiement reçu, installation du programme…','var(--info)');
      await new Promise(r=>setTimeout(r,3000));
    }
    pc=programmeDuCatalogue(id)||p;
  }
  const seances=(typeof pc.seances==='function')?pc.seances(g):null;
  if(!Array.isArray(seances)||!seances.length){
    toast((_fiche&&_fiche.aContenu)
      ?'Le programme s’installera dès que ton paiement sera confirmé : retrouve-le dans la boutique dans un instant.'
      :'Ce programme n\'a aucune séance.','var(--orange)'); return false;
  }
  const sc=currentUser.sessions_config;
  const porte=Array.isArray(sc)&&sc.some(x=>x&&x.active&&((x.exercises||[]).length||String(x.name||'').trim()));
  if(porte){
    const nl=String.fromCharCode(10);
    if(!await rcConfirm('Remplacer tes séances par « '+(p.nom||'ce programme')+' » ?',
      'Tes séances actuelles seront écrasées.'+nl+'Cette action ne peut pas être annulée.',
      'Remplacer')) return false;
  }
  // COPIE PROFONDE. Le fichier a deja eu ce bug deux fois — voir
  // saveCoachSessionsAsTemplate et cptReporterGenre : sans clone, le programme
  // applique reste attache a la constante, et le premier exercice modifie par
  // l'athlete modifie le catalogue pour tout le monde jusqu'au rechargement.
  currentUser.sessions_config=seances.map(x=>({...x,
    exercises:(x.exercises||[]).map(e=>({...e}))}));
  // CE N'EST PLUS UN EXEMPLE : quelqu'un l'a choisi. Les deux marqueurs
  // tombent, comme dans _personnaliserSeance.
  currentUser.sessions_config.forEach(x=>{ delete x._essai; delete x._foundation; });
  currentUser.programmeApplique={id:p.id,nom:p.nom||'',genre:g,le:Date.now()};
  toastEcriture(saveUser(),'« '+(p.nom||'Programme')+' » appliqué','le programme est');
  loadSessionManager();
  return true;
}
// ══════ LES FICHES DE SES EXERCICES, ET RIEN DU CATALOGUE (lot 3) ════════
//
// Un athlete suivi ne parcourt pas le catalogue : il recoit les mouvements que
// son coach a poses, et c'est devant CEUX-LA qu'il se demande comment faire.
// Sans reponse, il repose la question par message, une fois par semaine.
//
// LA LISTE EST CONSTRUITE DEPUIS SES PROPRES SEANCES, jamais depuis la banque :
// aucun exercice qui ne soit pas dans son programme n'y apparait. C'est le
// filtre demande, et c'est aussi ce qui la rend lisible — douze mouvements, pas
// quatre cent trente-six.
//
// TOUT EST LOCAL, ET C'EST CE QUI LA REND POSSIBLE. L'illustration vient de
// l'index des images, les videos d'EX_VIDEOS, les muscles du guide : les memes
// tables qui habillent deja sa seance. La fiche ECRITE par le coach dans la
// banque n'y est pas, et ce n'est pas un oubli — /exercices ne se lit qu'avec
// un compte coach, et rien ne justifie de recopier quatre cents fiches dans le
// dossier d'un athlete pour les lui montrer.
let _mesExos=[];
// PURE. Les exercices du programme, une fois chacun, dans l'ordre alphabetique.
// La clef de dedoublonnage est exKey : « Developpe couche » et « DEVELOPPE
// COUCHE » sont le meme mouvement, et il ne doit apparaitre qu'une fois.
function exercicesDeMonProgramme(user){
  const u=user||currentUser;
  if(!u) return [];
  const jours=Array.isArray(u.sessions_config)?u.sessions_config
    :(u.sessions_config&&typeof u.sessions_config==='object')?Object.keys(u.sessions_config).map(k=>u.sessions_config[k])
    :[];
  const vus=new Map();
  for(const j of jours){
    if(!j||typeof j!=='object') continue;
    const exs=Array.isArray(j.exercises)?j.exercises:[];
    for(const ex of exs){
      const nom=String((ex&&ex.name)||'').trim();
      if(!nom) continue;
      let k=''; try{ k=exKey(nom)||''; }catch(e){ k=nom.toUpperCase(); }
      if(!k||vus.has(k)) continue;
      vus.set(k,{nom:nom,ex:ex});
    }
  }
  return [...vus.values()].sort((a,b)=>a.nom.localeCompare(b.nom,'fr'));
}
// L'INDEX DES ILLUSTRATIONS SE CHARGE A LA DEMANDE, et il n'est pas la au
// premier dessin : sans lui, _slugIllustre ne rend rien et la fiche s'affiche
// sans image. Meme conduite que la banque du coach : on montre tout de suite
// ce qu'on a, et on redessine quand l'index arrive. UNE SEULE FOIS — le
// drapeau `rejoue` de la fiche interdit la boucle.
function _meRejouer(fn){
  try{
    const p=chargerIndexIllustrations();
    if(p&&p.then) p.then(()=>{ try{ fn(); }catch(e){} }).catch(()=>{});
  }catch(e){}
}
// LA LISTE. Un bouton par mouvement, et la vignette quand elle existe : c'est
// l'image qu'on reconnait, pas le nom.
function ouvrirMesExercices(){
  _mesExos=exercicesDeMonProgramme();
  const vign=x=>{
    let sl=''; try{ sl=_slugIllustre(exSlug(x.nom))||''; }catch(e){ sl=''; }
    return sl?'<img src="'+escapeHtml(EXO_IMG_DOSSIER+sl+'.webp')+'" alt="" decoding="async" '
      +'onerror="_illusAbsente(this)" style="width:44px;height:44px;object-fit:contain;'
      +'background:#fff;border-radius:var(--r-2);flex-shrink:0">'
      :'<span style="width:44px;height:44px;border-radius:var(--r-2);background:var(--surface-2);flex-shrink:0"></span>';
  };
  const corps=()=>_mesExos.length
    ?_mesExos.map((x,i)=>'<button type="button" onclick="ouvrirFicheMonExercice('+i+')" '
      +'style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;'
      +'background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);'
      +'padding:8px 10px;margin-bottom:8px;cursor:pointer;font-family:inherit">'
      +vign(x)
      +'<span style="font-size:var(--fs-sm);font-weight:800;color:var(--text);letter-spacing:0">'
      +escapeHtml(x.nom)+'</span></button>').join('')
    :'<p class="sub" style="font-size:var(--fs-sm);line-height:1.6">Tes séances sont encore vides. '
      +'Dès qu\'un exercice y est posé, sa fiche apparaît ici.</p>';
  const html='<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;'
    +'background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" style="background:var(--surface-2);'
    +'border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 24px;width:100%;max-width:480px;'
    +'max-height:90vh;overflow-y:auto">'
    +'<h2 style="margin-bottom:4px;font-size:var(--fs-lg)">Mes exercices</h2>'
    +'<p class="sub" style="font-size:var(--fs-xs);margin-bottom:12px;line-height:1.6">'
    +'Les mouvements de ton programme, avec l\'image et la vidéo quand elles existent.</p>'
    +'<div id="me-liste">'+corps()+'</div>'
    +'<button class="btn btn-outline" style="margin-top:14px" onclick="closeModal()">Fermer</button>'
    +'</div></div>';
  document.body.insertAdjacentHTML('beforeend',html);
  _meRejouer(()=>{ const z=document.getElementById('me-liste'); if(z) z.innerHTML=corps(); });
  return true;
}
// LA FICHE. Ce que le guide sait du mouvement, et ce que le coach a ecrit
// dessus : deux choses differentes, et la seconde prime a l'oeil parce qu'elle
// vise cet athlete-la.
function ouvrirFicheMonExercice(i,rejoue){
  const x=_mesExos[Number(i)];
  if(!x) return false;
  const nom=x.nom, ex=x.ex||{};
  let sl=''; try{ sl=_slugIllustre(exSlug(nom))||''; }catch(e){ sl=''; }
  const img=sl?(EXO_IMG_DOSSIER+sl+'.webp'):'';
  let d=null; try{ d=_dimsParSlug(exSlug(nom)); }catch(e){ d=null; }
  let g=null; try{ g=_exGuide().get(resoudreAlias(exKey(nom)))||null; }catch(e){ g=null; }
  const muscles=g?[].concat(g.p||[],g.s||[]).map(m=>(MUSCLES[m]||{}).lib||m).join(', '):'';
  const l=(t,v)=>v?'<div style="display:flex;justify-content:space-between;gap:10px;'
    +'font-size:var(--fs-sm);padding:4px 0"><span style="color:var(--sub)">'+escapeHtml(t)+'</span>'
    +'<span style="color:var(--text);text-align:right">'+escapeHtml(v)+'</span></div>':'';
  let pastilles=''; try{ pastilles=htmlVideosExo(ex)||''; }catch(e){ pastilles=''; }
  const html='<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;'
    +'background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div id="me-fiche" onclick="event.stopPropagation()" style="background:var(--surface-2);'
    +'border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 24px;width:100%;max-width:480px;'
    +'max-height:90vh;overflow-y:auto">'
    +'<h2 style="margin-bottom:10px;font-size:var(--fs-lg)">'+escapeHtml(nom)+'</h2>'
    +(img?'<img src="'+escapeHtml(img)+'" alt="'+escapeHtml(nom)+'" decoding="async"'
      +(d?' width="'+d[0]+'" height="'+d[1]+'"':'')+' onerror="_illusAbsente(this)" '
      +'style="display:block;margin:0 auto 12px;width:100%;'+(d?'max-width:'+d[0]+'px;':'')
      +'height:auto;max-height:260px;object-fit:contain;background:#fff;border-radius:var(--r-3)">'
      :'<div class="sub" style="font-size:var(--fs-xs);text-align:center;padding:16px;'
      +'background:var(--surface-1);border-radius:var(--r-3);margin-bottom:12px">'
      +'Pas d\'image pour ce mouvement.</div>')
    +l('Muscles',muscles)
    +l('Matériel',ex.materiel||'')
    +(ex.description?'<div style="margin-top:12px"><div style="font-size:var(--fs-xs);'
      +'color:var(--red-text);letter-spacing:1.5px;font-weight:800;text-transform:uppercase;'
      +'margin-bottom:6px">Ce que ton coach a écrit</div><div style="font-size:var(--fs-sm);'
      +'color:#bbb;line-height:1.65;white-space:pre-wrap">'+escapeHtml(ex.description)+'</div></div>':'')
    +pastilles
    +(pastilles?'':'<p class="sub" style="font-size:var(--fs-xs);margin-top:12px;line-height:1.6">'
      +'Aucune vidéo pour ce mouvement. Demande-la à ton coach dans le canal : il peut la filmer '
      +'pour toi.</p>')
    +'<button class="btn btn-outline" style="margin-top:16px" onclick="closeModal();ouvrirMesExercices()">Retour à mes exercices</button>'
    +'<button class="btn btn-outline" style="margin-top:10px" onclick="closeModal()">Fermer</button>'
    +'</div></div>';
  closeModal();
  document.body.insertAdjacentHTML('beforeend',html);
  // SANS IMAGE, ON REDEMANDE L'INDEX UNE FOIS : au premier passage il n'est
  // pas encore charge, et la fiche vaut surtout pour son dessin.
  if(!img&&!rejoue) _meRejouer(()=>{
    if(document.getElementById('me-fiche')) ouvrirFicheMonExercice(i,true);
  });
  return true;
}
function loadSessionManager(){
  go('s-session-manager');
  _renderSessionManager();
}
// ══ LES PORTES DU BLOC, ET LA REVISION ═══════════════════════════════════
//
// La charge du bloc pour qui planifie, les fiches de ses exercices pour qui
// est suivi, et la revision pour qui a un plan ecrit pour lui. NOMMEE plutot
// qu'ecrite dans _renderSessionManager : un achat de revision doit changer ce
// bloc sans repeindre tout l'ecran, et donc sans fermer une saisie en cours.
function _rendreOutilsSeances(){
  const z=document.getElementById('sm-outils');
  if(!z) return false;
  const b=[];
  const bouton=(lib,act,rouge)=>'<button type="button" class="btn '
    +(rouge?'btn-red':'btn-outline')+'" onclick="'+act+'" '
    +'style="flex:1 1 46%;min-width:150px;font-size:var(--fs-xs);padding:10px 10px">'+lib+'</button>';
  try{
    // ⚠ PLUS DE CONDITION DE CAPACITE DEPUIS LE LOT 4 : l'ecran s'ouvre pour
    //   tout le monde et porte son verrou. La seule condition qui reste est
    //   qu'il y ait un bloc date a regarder.
    if(semainesDuBloc(currentUser).length)
      b.push(bouton('Charge du bloc','ouvrirGrilleCharge()'));
  }catch(e){}
  try{
    if(peut(currentUser,'programmeRecu')&&exercicesDeMonProgramme(currentUser).length)
      b.push(bouton('Mes exercices en images','ouvrirMesExercices()'));
  }catch(e){}
  // LA REVISION N'EST OFFERTE QU'A QUI A UN PLAN ECRIT POUR LUI : reviser un
  // plan qu'on n'a pas ne veut rien dire, et le bouton serait une question.
  let rev='';
  try{
    if(programmePersoLivre(currentUser)){
      const p=offreRevision();
      b.push(bouton('Faire réviser mon programme, '+prixProgramme(p),
        'ouvrirAchatProgramme(\''+REVISION_ID+'\')',true));
      rev=_htmlRelanceTransformation(currentUser);
    }
  }catch(e){}
  z.innerHTML=(b.length?'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:'
    +(rev?'10px':'14px')+'">'+b.join('')+'</div>':'')+rev;
  return true;
}
// LA TROISIEME REVISION, ET SEULEMENT LA. Kevin : « C'est le profil le plus
// chaud du fichier : il revient tout seul. » Avant la troisieme, on se tait —
// proposer 350 € a quelqu'un qui vient d'en payer 40 ferait fuir.
//
// LE CHIFFRE EST CALCULE, JAMAIS ECRIT : le plan ecrit pour soi, plus autant
// de revisions qu'il y en a eu. Les deux montants vivent dans OFFRES, et le
// total suit tout seul le jour ou l'un des deux bouge.
function _htmlRelanceTransformation(u){
  const n=revisionsPayees(u).length;
  if(n<3) return '';
  const total=_euros(totalPlanPerso(u));
  const t=offre('coaching_transfo')||{prix:350,mois:3};
  return '<div class="vrr" style="margin-bottom:14px">'
    +'<div class="vrr-t">Tu en es à '+escapeHtml(total)+' de révisions. Transformation, '
    +'c’est '+escapeHtml(_euros(t.prix))+' pour trois mois où je te suis vraiment.</div>'
    +'<a class="vrr-b" href="https://beacons.ai/kevin.gllc" target="_blank" rel="noopener">'
    +'Voir les formules de coaching</a></div>';
}
// LE REMERCIEMENT D'UNE REVISION. Il dit ce qui se passe ensuite, parce que
// ce qui se passe ensuite n'est pas dans l'application : c'est le coach qui
// ecrit, et la personne doit savoir quand.
function ouvrirMerciRevision(){
  const n=revisionsPayees(currentUser).length;
  const html='<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;'
    +'background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" style="background:var(--surface-2);'
    +'border-radius:var(--r-4) var(--r-4) 0 0;padding:20px 20px 24px;width:100%;max-width:480px;'
    +'max-height:90vh;overflow-y:auto">'
    +'<h2 style="margin-bottom:6px;font-size:var(--fs-lg)">Révision demandée.</h2>'
    +'<p class="sub" style="font-size:var(--fs-sm);line-height:1.6;margin-bottom:12px">'
    +'Ton coach ajuste ton plan et te le renvoie dans l’application. Dis-lui dans le canal '
    +'ce qui coince en ce moment : c’est ce qui rend la révision utile.</p>'
    +'<p class="sub" style="font-size:var(--fs-xs);line-height:1.6;margin-bottom:14px">'
    +'Ton accès complet est rouvert pour un mois.</p>'
    +_htmlRelanceTransformation(currentUser)
    +'<button class="btn btn-red" style="width:100%" onclick="closeModal()">J’ai compris</button>'
    +'</div></div>';
  closeModal();
  document.body.insertAdjacentHTML('beforeend',html);
  return (n>=3);
}
// LE RENDU SEUL, SANS go() : c'est lui que la descente rejoue — voir
// _repeindreSeancesAthlete. go() fermerait une saisie ouverte.
function _renderSessionManager(){
  setTimeout(_majLiensClasser,0);
  if(!currentUser.sessions_config) initSessionsConfig();
  // Migration : sept créneaux, un TABLEAU même si Firebase a rendu un objet,
  // et des exercices rendables. `repares` retient s'il y avait vraiment
  // quelque chose à réparer : lui seul déclenche l'enregistrement.
  const _rapport={repares:0};
  _normaliserSessionsConfig(currentUser,_rapport);
  const changed=_rapport.repares>0;
  if(changed) saveUser();
  const sessions=currentUser.sessions_config;
  const container=document.getElementById('session-slots');
  // LA STRUCTURE DU BLOC, UNE FOIS EN TETE D'ECRAN.
  //
  // ⚠ PAS DANS htmlCarteSeanceSlot, et c'est delibere : cette carte est
  // l'apercu EXACT de l'image de story, et son propre commentaire dit qu'un
  // apercu ne montrant pas ce que le fichier contient serait pire qu'aucun
  // apercu. Une ligne de plus a l'ecran ferait diverger les deux.
  //
  // UNE FOIS, ET NON PAR JOUR : la phrase est la meme pour les sept creneaux.
  // Repetee sept fois, elle deviendrait un motif de fond qu'on ne lit plus.
  // ══ LES DEUX PORTES DU BLOC (lot 3) ══════════════════════════════════
  // La charge semaine par semaine pour qui planifie, les fiches de ses propres
  // exercices pour qui est suivi. CHACUNE NE S'AFFICHE QUE POUR QUI ELLE
  // S'OUVRE : un bouton qui repond « reserve » est un bouton mort, et le verrou
  // du lot 4 se poste sur les ecrans, pas sur les portes d'entree.
  try{ _rendreOutilsSeances(); }catch(e){}
  const _zStruct=document.getElementById('sm-structure');
  if(_zStruct){
    let _l=''; try{ _l=ligneStructureBloc(currentUser); }catch(e){ _l=''; }
    _zStruct.innerHTML=_l
      ?'<div style="background:var(--surface-1);border:1px solid var(--border);'
        +'border-left:1px solid var(--border);border-radius:var(--r-3);padding:10px 14px;'
        +'margin-bottom:14px;font-size:var(--fs-sm);color:var(--text);line-height:1.6">'
        +escapeHtml(_l)+'</div>'
      :'';
  }
  // R36 — le bandeau d'essai, meme predicat que le selecteur : il suit les
  // badges « Exemple », et se tait sur sept creneaux vides.
  const _zEssai=document.getElementById('sm-essai');
  if(_zEssai){
    let _e=false; try{ _e=programmeEstEssai(currentUser); }catch(e){ _e=false; }
    _zEssai.innerHTML=_e?_bandeauEssai(currentUser):'';
  }

  container.innerHTML=sessions.map((s,i)=>`
    <div style="background:var(--surface-1);border-radius:var(--r-4);margin-bottom:14px;overflow:hidden;border:1.5px solid ${s.active?'var(--red)':'var(--border)'}">

      <!-- En-tête jour -->
      <div style="background:${s.active?'linear-gradient(135deg,#1a0000,#2a0000)':'var(--surface-2)'};padding:14px 16px;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;background:${s.active?'var(--red)':' var(--surface-2)'};border-radius:var(--r-1);display:flex;align-items:center;justify-content:center;font-size:var(--fs-xs);font-weight:900;letter-spacing:.5px;flex-shrink:0">${DAY_ICONS[i]}</div>
          <div>
            <div style="font-weight:800;font-size:var(--fs-lg)">${escapeHtml(s.day)}</div>
            <div class="sub" style="font-size:var(--fs-xs);margin-top:1px" id="sm-sub-${i}">${s.active?escapeHtml(s.name||'Séance sans nom'):' Jour de repos'}</div>
          </div>
        </div>
        <label class="reg-ligne reg-ligne--nue" style="display:flex;align-items:center;gap:8px;cursor:pointer;margin:0">
          <span class="sub" style="font-size:var(--fs-xs)">${s.active?'Actif':'Repos'}</span>
          <div onclick="toggleDayActive(${i})" style="width:44px;height:24px;border-radius:var(--r-3);background:${s.active?'var(--red)':'var(--border)'};position:relative;cursor:pointer;transition:background var(--t-3);flex-shrink:0" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
            <div style="position:absolute;width:18px;height:18px;border-radius:var(--r-2);background:#fff;top:3px;left:3px;transition:transform var(--t-3);transform:translateX(${s.active?'20px':'0px'})"></div>
          </div>
        </label>
      </div>

      <!-- Contenu (si actif) -->
      ${s.active?`
      <div style="padding:14px 16px">
        <!-- Nom de la séance -->
        <div style="margin-bottom:12px">
          <label style="margin-top:0">Nom de la séance</label>
          <input value="${escapeHtml(s.name||'')}" placeholder="Ex: DOS & ABDOS" onchange="renameSession(${i},this.value)" style="margin-top:4px">
        </div>

        <!-- L APERCU DE LA SEANCE, A LA PLACE DE LA PHOTO DE FICHE.
             Demande de Kevin, 24/08/2026. Il deposait une capture d ecran de
             son classeur pour l avoir sous les yeux ; l app connait deja la
             seance, et sait deja la dessiner, c est la meme carte que la
             story, en apercu, avec ses deux memes boutons.
             LE DEPOT DE PHOTO PART AVEC, cote athlete : uploadSessionPhoto et
             removeSessionPhoto n ont plus d appelant et sont retires. La voie
             du COACH reste ouverte, il attache la fiche en composant le
             programme, et elle continue de s afficher pendant la seance. -->
        ${htmlCarteSeanceSlot(i,s)}

        <!-- Exercices + actions -->
        <div style="display:flex;gap:8px">
          <button class="btn btn-blanc btn-sm" style="flex:1" onclick="openSessionExercises(${i})">Modifier ma séance (${s.exercises?.length||0})</button>
          <button class="btn btn-red btn-sm" style="flex:1" onclick="startWorkoutSession(${i})">Démarrer</button>
        </div>
        <!-- ══ ALTERNER : ECHANGER DEUX CRENEAUX ═══════════════════════
             Demande de Kevin, 08/09/2026. Il arrive qu'une seance tombe le
             mauvais jour, un empechement, une salle pleine, et la seule
             facon de la deplacer etait de retaper les deux seances.
             SUR SA PROPRE LIGNE, et non a cote des deux autres : trois
             boutons sur une rangee font 33 % de largeur chacun, et
             « Modifier ma séance » ne tient plus. -->
        <button class="btn btn-blanc btn-sm" style="width:100%;margin-top:8px"
          onclick="alternerSeance(${i})">${icon('echange',14)} Alterner ma séance</button>
        <div id="alt-${i}"></div>
      </div>`:
      `<div style="padding:10px 16px;text-align:center"><span class="sub" style="font-size:var(--fs-sm)">Active ce jour pour y mettre une séance</span></div>`}
    </div>`).join('');
}

function toggleDayActive(i){
  if(!currentUser.sessions_config) initSessionsConfig();
  const s=currentUser.sessions_config[i];
  s.active=!s.active;
  // ALLUMER UN JOUR, C'EST CREER LA SEANCE : elle arrive avec cinq
  // emplacements vides plutot qu'avec rien du tout. On n'en garnit QUE les
  // creneaux vides — voir _garnirSeanceVierge.
  if(s.active) _garnirSeanceVierge(s);
  _personnaliserSeance(i);
  saveUser();loadSessionManager();
}


// ══ BUILD 1890 : LA RECHERCHE LOCALE ══════════════════════════════════════
//
// Une loupe sur l'accueil : « pesée », « PR », « squat », « octobre »… Tout se
// cherche dans le dossier déjà sur le téléphone, rien ne part sur le réseau.
// Les destinations d'abord (les écrans), puis les séances, les exercices (et
// leur meilleure charge), les aliments du plan et les bilans.
// ⚠ PAS D'ÉCRAN s-coach-* : la recherche est celle de l'athlète.
// ⚠ L'ACTION EST UN NOM DE FONCTION (window) ET SES ARGUMENTS, jamais une
//   chaîne à évaluer : la CSP interdit eval.
const RECHERCHE_DESTINATIONS=Object.freeze([
  {id:'pesee',libelle:'Pesée du jour',motsCles:['pesee','poids','peser','balance'],action:'ouvrirPeseeAccueil'},
  {id:'records',libelle:'Mes records',motsCles:['records','pr','record','max','meilleures charges'],action:'ouvrirMesRecords'},
  {id:'seance',libelle:'Séance du jour',motsCles:['seance','entrainement','programme','training'],action:'loadEntrainement'},
  {id:'historique',libelle:'Historique des séances',motsCles:['historique','seances passees'],action:'loadHistoriqueSeances'},
  {id:'corrections',libelle:'Mes corrections',motsCles:['corrections','video','technique'],action:'loadVideos'},
  {id:'nutrition',libelle:'Nutrition',motsCles:['nutrition','repas','calories','macros','manger','journal alimentaire'],action:'loadNutrition'},
  {id:'bilan',libelle:'Faire mon bilan',motsCles:['bilan','photos','mensurations','mesures'],action:'clientTab',args:['bilan']},
  {id:'messages',libelle:'Écrire à mon coach',motsCles:['message','coach','ecrire','contact','question'],action:'msgOuvrirFil'},
  {id:'annonces',libelle:'Annonces du coach',motsCles:['annonces','canal','defi'],action:'loadCanal'},
  {id:'evolution',libelle:'Évolution',motsCles:['evolution','progres','courbe','graphique'],action:'loadProgress'},
  {id:'pas',libelle:'Pas et sommeil',motsCles:['pas','sommeil','nuit','lifestyle','marche'],action:'loadLifestyle'},
  {id:'profil',libelle:'Mon profil',motsCles:['profil','photo','nom','medical','sante'],action:'openAthleteProfile'},
  {id:'trophees',libelle:'Trophées',motsCles:['trophees','badges','parrainage','page publique','volts','rang'],action:'ouvrirTrophees'},
  {id:'reglages',libelle:'Réglages',motsCles:['reglages','parametres','notifications','theme','unite','son'],action:'ouvrirReglagesAthlete'},
  {id:'abonnement',libelle:'Mon abonnement',motsCles:['abonnement','paiement','resilier','facture'],action:'ouvrirEcranAbonnement'},
  {id:'export',libelle:'Exporter mes données',motsCles:['exporter','donnees','rgpd','telecharger'],action:'exporterMesDonnees'},
  {id:'deconnexion',libelle:'Se déconnecter',motsCles:['deconnexion','deconnecter','logout','quitter'],action:'logout'}
]);
const RECHERCHE_MAX=12;
const RECHERCHE_USAGE_CLE='rc_recherche_usage';
/** PURE. Minuscules, sans accents ni apostrophes, espaces réduits. */
function normRecherche(x){
  return String(x==null?'':x).normalize('NFD').replace(/[̀-ͯ]/g,'')
    .toLowerCase().replace(/[’'`\-_.,;:!?()]/g,' ').replace(/\s+/g,' ').trim();
}
// PURE. Distance d'édition bornée à 1 (une lettre en trop, en moins ou changée).
function _uneFaute(a,b){
  if(a===b) return true;
  const la=a.length, lb=b.length;
  if(Math.abs(la-lb)>1) return false;
  let i=0; while(i<la&&i<lb&&a[i]===b[i]) i++;
  if(la===lb) return a.slice(i+1)===b.slice(i+1);
  return la>lb?a.slice(i+1)===b.slice(i):a.slice(i)===b.slice(i+1);
}
// PURE. Le rang d'un texte pour une requête : 0 mot exact, 1 début de mot,
// 2 sous-chaîne, 3 une faute (requête de plus de 4 lettres), null sinon.
function _rangRecherche(q,textes){
  let best=null;
  for(const t0 of textes){
    const t=normRecherche(t0); if(!t) continue;
    const mots=t.split(' ');
    let r=null;
    if(t===q||mots.indexOf(q)>=0) r=0;
    else if(t.indexOf(q)===0||mots.some(m=>m.indexOf(q)===0)||(' '+t).indexOf(' '+q)>=0) r=1;
    else if(t.indexOf(q)>=0) r=2;
    else if(q.length>4&&(mots.some(m=>_uneFaute(q,m)||(m.length>q.length&&_uneFaute(q,m.slice(0,q.length))))||_uneFaute(q,t))) r=3;
    if(r!==null&&(best===null||r<best)) best=r;
    if(best===0) break;
  }
  return best;
}
/** PURE. Au plus 12 résultats {type,id,libelle,sous,action,args}. */
function rechercher(u,requete,maintenant){
  const q=normRecherche(requete);
  if(!q) return [];
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const trier=l=>l.sort((a,b)=>a._r-b._r||a._o-b._o);
  const dest=[];
  RECHERCHE_DESTINATIONS.forEach((d,o)=>{
    const r=_rangRecherche(q,[d.libelle].concat(d.motsCles));
    if(r!==null) dest.push({type:'destination',id:d.id,libelle:d.libelle,sous:'',action:d.action,args:d.args||[],_r:r,_o:o});
  });
  const autres=[];
  const fmtJ=d=>{ try{ return new Date(d).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); }catch(e){ return ''; } };
  // Les séances : leur nom et leur date en toutes lettres (« octobre »).
  ((u&&u.sessions)||[]).filter(s=>s&&s.date>0&&s.date<=t+864e5).slice().sort((a,b)=>b.date-a.date).forEach((s,o)=>{
    const jour=fmtJ(s.date);
    const r=_rangRecherche(q,[s.name||'Séance',jour]);
    if(r!==null) autres.push({type:'seance',id:String(s.id!=null?s.id:s.date),libelle:s.name||'Séance',sous:jour,
      action:'ouvrirSeanceHistorique',args:[String(s.id!=null?s.id:s.date)],_r:r+0.1,_o:o});
  });
  // Les exercices, avec leur meilleure charge, dans l'unité de l'athlète.
  let rec=[]; try{ rec=meilleursRecordsPublics(u,200); }catch(e){ rec=[]; }
  rec.forEach((x,o)=>{
    const r=_rangRecherche(q,[x.exo]);
    if(r===null) return;
    let kg=x.kg; try{ const a=kgVersAffiche(x.kg,u); if(a!=null) kg=a; }catch(e){}
    let un='kg'; try{ un=uniteCharge(u); }catch(e){}
    autres.push({type:'exercice',id:x.exo,libelle:x.exo,sous:'Record : '+String(kg).replace('.',',')+' '+un,
      action:'ouvrirHistoriqueExoNom',args:[x.exo],_r:r,_o:o});
  });
  // Les aliments du plan (squelette et catalogues posés par le coach).
  const vus={};
  try{
    const p=u&&u.nutrition&&u.nutrition.plan;
    if(p){
      const lignes=[].concat(_tabBloc(planSquelette(p)),_tabBloc(planCatalogue(p,'p')),_tabBloc(planCatalogue(p,'c')),_tabBloc(planCatalogue(p,'l')));
      lignes.forEach((l,o)=>{
        const lib=String((l&&(l.lib||l.nom))||'').trim();
        if(!lib||vus[normRecherche(lib)]) return;
        vus[normRecherche(lib)]=1;
        const r=_rangRecherche(q,[lib]);
        if(r!==null) autres.push({type:'aliment',id:lib,libelle:lib,sous:'Dans ton plan',action:'loadNutrition',args:[],_r:r+0.2,_o:o});
      });
    }
  }catch(e){}
  // Les bilans : « bilan », le type et la date.
  ((u&&u.bilans)||[]).filter(b=>b&&b.date>0).slice().sort((a,b)=>b.date-a.date).forEach((b,o)=>{
    const jour=fmtJ(b.date);
    const lib=b.type==='depart'?'Bilan de départ':'Bilan';
    const r=_rangRecherche(q,['bilan',lib,jour]);
    if(r!==null) autres.push({type:'bilan',id:String(b.date),libelle:lib,sous:jour,action:'clientTab',args:['bilan'],_r:r+0.3,_o:o});
  });
  return trier(dest).concat(trier(autres)).slice(0,RECHERCHE_MAX)
    .map(x=>({type:x.type,id:x.id,libelle:x.libelle,sous:x.sous,action:x.action,args:x.args}));
}
// L'historique d'un exercice, depuis son nom (la feuille rc-histo).
function ouvrirHistoriqueExoNom(nom){
  const z=document.getElementById('rc-histo-corps');
  if(!z||!currentUser) return null;
  z.innerHTML=htmlHistoriqueExo(currentUser,nom);
  return _feuilleOuvrir('rc-histo');
}
// ══ BUILD 1891 : MES RECORDS ════════════════════════════════════════════════
// PURE. La meilleure série de chaque exercice (alias résolus) : la charge la
// plus lourde, à charge égale le plus de répétitions puis la plus ancienne.
// ASSISTÉ (dips, tractions guidés) : MOINS d'assistance vaut mieux.
// Séances de décharge et séries non validées exclues ; au-delà de 1 000 kg,
// une saisie fautive.
function recordsParExercice(u){
  const best={};
  const cle=nm=>{ try{ return _resoudreAliasChaine(exKey(nm),u&&u.exAlias); }catch(e){ return String(nm); } };
  for(const s of ((u&&u.sessions)||[])){
    if(!s||!(s.date>0)||s.deload) continue;
    const exos=(s.data&&typeof s.data==='object'&&Object.keys(s.data).length)
      ?Object.keys(s.data).map(nm=>({nom:nm,sets:((s.data[nm]||{}).sets)||[]}))
      :((s.exercises)||[]).filter(e=>e&&(e.name||e.nm)).map(e=>({nom:e.name||e.nm,sets:e.sets||[]}));
    for(const e of exos){
      let assiste=false; try{ assiste=typeCharge(_exPourCharge(e.nom,u))==='assiste'; }catch(x){}
      for(const st of e.sets){
        if(!st||st.done===false) continue;
        const w=parseFloat(st.weight);
        if(!(w>0)||w>1000) continue;
        const reps=parseInt(st.repsDone!=null?st.repsDone:st.reps)||0;
        const k=cle(e.nom), b=best[k];
        const mieux=!b||(assiste?w<b.kg:w>b.kg)||(w===b.kg&&(reps>b.reps||(reps===b.reps&&s.date<b.date)));
        if(mieux) best[k]={cle:k,exo:String(e.nom).trim().slice(0,60),kg:Math.round(w*100)/100,reps,
          date:Number(s.date),seance:String(s.id!=null?s.id:s.date),assiste};
      }
    }
  }
  return Object.values(best).sort((a,b)=>b.date-a.date||a.exo.localeCompare(b.exo));
}
function ouvrirMesRecords(){
  go('s-records');
  const f=document.getElementById('rec-filtre'); if(f) f.value='';
  return rendreMesRecords();
}
function rendreMesRecords(){
  const z=document.getElementById('rec-liste');
  if(!z||!currentUser) return false;
  const tous=recordsParExercice(currentUser);
  const q=normRecherche((document.getElementById('rec-filtre')||{}).value||'');
  const l=q?tous.filter(r=>normRecherche(r.exo).indexOf(q)>=0):tous;
  if(!tous.length){ z.innerHTML=emptyState('trophy','Tes records apparaîtront après ta première séance',null,null,'padding:24px 8px'); return true; }
  if(!l.length){ z.innerHTML='<div class="sub" style="font-size:var(--fs-xs);padding:12px 2px">Aucun exercice ne correspond.</div>'; return true; }
  z.innerHTML=l.map(r=>'<button type="button" class="rch-l" onclick="ouvrirSeanceHistorique('+_attrArg(r.seance)+')">'
    +'<span class="rch-l-t">'+escapeHtml(r.exo)+'</span>'
    +'<span class="rch-l-s">'+escapeHtml(String(_kgAff(r.kg)).replace('.',',')+_uniteTxt(r.exo)+(r.reps?' × '+r.reps:'')+(r.assiste?' d’assistance':'')
      +' · '+new Date(Number(r.date)).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}))+'</span></button>').join('');
  return true;
}
// ── La feuille ───────────────────────────────────────────────────────────
function _rechUsage(){ try{ return JSON.parse(localStorage.getItem(RECHERCHE_USAGE_CLE)||'{}')||{}; }catch(e){ return {}; } }
/** Les six destinations les plus utilisées (compteur local), à défaut l'ordre de la liste. */
function rechercheFavorites(usage){
  const c=usage||_rechUsage();
  return RECHERCHE_DESTINATIONS.map((d,o)=>({d,o,n:Number(c[d.id])||0}))
    .sort((a,b)=>b.n-a.n||a.o-b.o).slice(0,6)
    .map(x=>({type:'destination',id:x.d.id,libelle:x.d.libelle,sous:'',action:x.d.action,args:x.d.args||[]}));
}
let _rechRes=[];
function ouvrirRecherche(){
  const i=document.getElementById('rch-q');
  if(i) i.value='';
  rechercheMaj();
  const f=_feuilleOuvrir('rc-recherche');
  try{ if(i) i.focus({preventScroll:true}); }catch(e){}
  return f;
}
function fermerRecherche(tout_de_suite){ _feuilleFermer('rc-recherche',tout_de_suite); }
function rechercheMaj(){
  const z=document.getElementById('rch-res'); if(!z) return false;
  const q=(document.getElementById('rch-q')||{}).value||'';
  let l=q.trim()?rechercher(currentUser,q,Date.now()):[];
  let tete='';
  if(!q.trim()) tete='<div class="rch-t">Les plus utilisées</div>';
  else if(!l.length){
    tete='<div class="rch-t">Rien trouvé pour « '+escapeHtml(q.trim())+' ».</div>';
    const ecrire=RECHERCHE_DESTINATIONS.find(d=>d.id==='messages');
    l=[{type:'destination',id:'messages',libelle:ecrire.libelle,sous:'Pose-lui la question',action:ecrire.action,args:[]}]
      .concat(rechercheFavorites().filter(x=>x.id!=='messages'));
  }
  if(!q.trim()) l=rechercheFavorites();
  _rechRes=l;
  z.innerHTML=tete+l.map((r,i)=>'<button type="button" class="rch-l" onclick="rechercheAgir('+i+')">'
    +'<span class="rch-l-t">'+escapeHtml(r.libelle)+'</span>'
    +(r.sous?'<span class="rch-l-s">'+escapeHtml(r.sous)+'</span>':'')+'</button>').join('');
  return true;
}
function rechercheEntree(){ return _rechRes.length?rechercheAgir(0):false; }
function rechercheAgir(i){
  const r=_rechRes[i]; if(!r) return false;
  const f=window[r.action];
  if(typeof f!=='function') return false;
  if(r.type==='destination'){
    try{ const c=_rechUsage(); c[r.id]=(Number(c[r.id])||0)+1; localStorage.setItem(RECHERCHE_USAGE_CLE,JSON.stringify(c)); }catch(e){}
  }
  fermerRecherche(true);
  try{ f.apply(null,r.args||[]); }catch(e){ rcErreurMuette('rechercheAgir',e); }
  return true;
}
