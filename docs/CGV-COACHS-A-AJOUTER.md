# CGV coachs : ce qu'il faut ajouter avant d'ouvrir le paiement direct

*Rédigé le 10/10/2026. À valider par Kevin (idéalement relu par un juriste)
avant de poser `PAIEMENTS_COACH = "oui"` dans `cloudflare/wrangler.toml` ([vars]).*

Tant que ces clauses ne sont pas publiées dans les CGV coach, le paiement
direct au coach (`cloudflare/src/paiements-coach.js`) reste **fermé** : le
serveur répond `{ouvert:false}`, l'app l'écrit au coach, et la vitrine
n'affiche pas de bouton « Payer ». Les formules à prix libres s'affichent
quand même, avec « Ça m'intéresse ».

La commission coach (section B) est **déjà active** côté serveur, comme celle
des ambassadeurs. Elle n'est versée qu'à la main, par Kevin, depuis le rapport
mensuel. Les clauses B doivent donc être publiées avant le premier versement.

---

## A. Les formules et leurs prix (paiement direct au coach)

Texte proposé :

> **A.1 Prix fixés par le coach.** Le coach fixe lui-même le nom, le prix
> (de 0 à 2 000 € TTC par formule), la durée (de 1 à 12 mois) et le contenu de
> chacune de ses formules, huit au plus. RepCore n'en fixe ni n'en conseille
> aucun.
>
> **A.2 RepCore n'est pas partie au contrat.** Le contrat de coaching est
> conclu directement entre le coach et son client. RepCore fournit l'outil
> (la page publique, le bouton de paiement, l'ouverture du suivi dans l'app).
> Ce n'est ni un vendeur, ni un intermédiaire de paiement.
>
> **A.3 Paiement sur le compte du coach.** Le client paie par PayPal,
> directement sur le compte PayPal Business du coach. RepCore n'encaisse rien,
> ne prélève aucune commission sur ces paiements et ne détient jamais les
> fonds. Les frais PayPal sont à la charge du coach, selon son contrat PayPal.
>
> **A.4 Obligations du coach vendeur.** Le coach est seul responsable :
> - de son statut (micro-entreprise, société…) et de son immatriculation ;
> - de la facturation et de la TVA éventuelle ;
> - de l'information précontractuelle de son client (prix, contenu, durée,
>   identité du vendeur) ;
> - du droit de rétractation de 14 jours (art. L221-18 du code de la
>   consommation) et du recueil de la demande expresse de démarrage immédiat
>   quand le suivi commence avant la fin de ce délai (art. L221-25) ;
> - des remboursements, des litiges et des rétrofacturations, qu'il traite
>   avec son client et avec PayPal.
>
> **A.5 Ce que fait l'app.** À la confirmation du paiement par PayPal, l'app
> ouvre le suivi du client pour la durée de la formule. Si le paiement est
> remboursé, le suivi se referme au prorata. Le prix payé est celui que le coach
> avait publié au moment de la commande. Un prix modifié ensuite ne change pas
> une commande déjà passée.
>
> **A.6 Contenu.** Le coach s'interdit toute promesse de résultat chiffrée ou
> garantie, et tout contenu médical. RepCore peut retirer une formule ou une
> page qui ne respecte pas ces conditions.

## B. La commission coach sur les athlètes devenus abonnés

Texte proposé :

> **B.1 Principe.** Quand un athlète que le coach suivait dans l'app (avec un
> code du coach) souscrit un abonnement RepCore payant (Essentielle ou Ultime)
> **dans les 90 jours qui suivent la fin de ce code**, ou avant cette fin, le
> coach reçoit une commission.
>
> **B.2 Taux et durée.** Ce sont ceux des ambassadeurs : 20 % du montant
> encaissé par RepCore, puis 25 % au-delà de 50 athlètes devenus payants,
> pendant les 12 mois qui suivent le premier paiement de l'athlète.
>
> **B.3 Échéance et versement.** Une commission est due 30 jours après le
> paiement qui la génère. Les commissions dues sont versées une fois par mois,
> sur le relevé mensuel. Le coach fournit pour cela son statut (SIRET ou
> équivalent) et ses coordonnées de versement. Sans ces informations, les
> commissions restent dues et sont versées dès qu'il les fournit.
>
> **B.4 Annulation.** Un paiement remboursé, rétrofacturé ou contesté annule
> ou suspend la commission correspondante, y compris après son versement.
> Dans ce cas, elle est déduite du versement suivant.
>
> **B.5 Une seule commission par athlète.** Un athlète déjà rattaché à un
> ambassadeur reste à cet ambassadeur, et le coach n'a pas de commission sur
> lui. L'achat d'un programme ou d'une formule de coaching n'est pas un
> abonnement et n'ouvre pas de commission coach.
>
> **B.6 Ce que le coach voit.** Son tableau de bord affiche le nombre de ses
> athlètes devenus abonnés et sa commission du mois. Il ne voit ni l'identité
> de l'abonné ni ses paiements.
>
> **B.7 Pas d'achat forcé.** Le coach ne peut pas conditionner son suivi à la
> souscription d'un abonnement RepCore, ni la présenter comme obligatoire.

## C. À faire par Kevin

1. Relire et ajuster A et B (taux, durée, fenêtre de 90 jours).
2. Les publier dans les CGV coach (page ou section dédiée). Ajouter dans
   `privacy.html` une ligne sur la commission coach : un compteur, sans
   identité d'abonné visible par le coach.
3. Prouver le parcours en sandbox PayPal (README, « Paiement direct au
   coach »), puis ouvrir le paiement direct : `PAIEMENTS_COACH = "oui"` dans
   `[vars]` de `cloudflare/wrangler.toml`, puis
   `cd cloudflare && npx -y wrangler@4 deploy`.
4. Chaque mois, dans l'écran Ambassadeurs (admin), les comptes de coach
   (code `CO…`, nom « Coach … ») apparaissent avec les ambassadeurs. Les
   commissions dues sont dans le même export CSV. Il faut les marquer payées
   comme pour un ambassadeur.
