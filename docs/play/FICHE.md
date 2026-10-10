# Fiche Google Play : RepCore

*Préparée le 10/10/2026.* Tout se copie-colle dans Play Console : **Développer
la présence → Fiche principale du Store**.

## Titre (29 / 30 caractères)

```
RepCore : Musculation & Cycle
```

## Description courte (80 / 80)

```
Programme musculation, suivi de charge et séances adaptées à ton cycle menstruel
```

## Description longue (2339 / 4000)

```
RepCore est un carnet d'entraînement de musculation qui suit tes charges séance après séance, et qui tient compte de ton cycle menstruel si tu le souhaites.

PROGRAMME DE MUSCULATION
• Construis ton programme semaine par semaine, ou reçois celui de ton coach.
• Pour chaque exercice : séries, répétitions, temps de repos, échauffement calculé.
• Une vidéo « comment l'exécuter » et les muscles travaillés, exercice par exercice.

SUIVI DE CHARGE
• La charge de ta première série est proposée d'après ta dernière séance et ton ressenti (RIR).
• Records battus, volume, tonnage : ta progression se lit sur des courbes simples.
• Historique complet de tes séances, consultable à tout moment.

CYCLE MENSTRUEL
• Si tu actives le suivi du cycle, RepCore te demande comment tu te sens avant la séance.
• Selon ta réponse, la charge suggérée et le nombre de séries peuvent être ajustés.
• Tu gardes la main : le suivi du cycle est facultatif, et tu peux l'arrêter quand tu veux.

NUTRITION ET RÉCUPÉRATION
• Diète flexible : objectifs de macros et journal alimentaire.
• Près de 3 500 aliments disponibles hors ligne.
• Check-in du matin : sommeil, énergie, courbatures.
• Synchronisation Health Connect (pas, sommeil, fréquence cardiaque au repos, variabilité cardiaque, poids, masse grasse), en lecture seule et seulement si tu l'autorises.

HORS LIGNE
• Tes séances fonctionnent en salle sans réseau : tout est gardé sur ton téléphone et se synchronise ensuite.

AVEC UN COACH
• Ton coach te transmet un code : il construit ton programme, lit tes bilans et te répond dans l'application.
• Tu choisis ce que ton coach voit. Certaines données (grossesse, constantes, analyses) ne lui sont jamais visibles.
• Coachs : suivi de tes athlètes, alertes (progression bloquée, inscrit sans première séance), bilans et messages.

MOTIVATION
• Badges, séries de semaines validées, défis entre amis.

TES DONNÉES
• Tes données de santé ne sont traitées qu'avec ton accord explicite.
• Export de toutes tes données (JSON) et suppression du compte, directement dans l'application.
• Politique de confidentialité : https://repcore-sync.web.app/privacy.html

Essai d'un mois de l'accès complet, sans carte bancaire.

RepCore ne remplace pas un avis médical. En cas de douleur, de grossesse ou de problème de santé, demande conseil à un professionnel de santé.
```

**Pourquoi ces textes :**
- Les trois expressions visées (« programme musculation », « suivi de
  charge », « cycle menstruel ») sont dans le titre ou la description courte,
  puis reprises en intertitres. Ce sont ces champs qui comptent le plus pour la
  recherche.
- **Aucune promesse de résultat**, et **aucun prix ni moyen de paiement**.
  Évoquer un paiement hors de Google Play dans la fiche serait refusé. L'essai
  d'un mois sans carte bancaire est vrai partout (`tarifs.json`).
- **Chaque fonction citée existe dans l'app** et apparaît sur les captures
  (échauffement calculé, vidéo d'exécution, alertes du coach…).

## Visuels

| Élément | Fichier | Format demandé par Play |
|---|---|---|
| Icône | `docs/play/icone-512.png` | 512 × 512 PNG 32 bits, 1 Mo maximum (136 Ko) |
| Bannière (« Image de présentation ») | `docs/play/banniere-1024x500.png` | 1024 × 500, JPG ou PNG 24 bits |
| Captures téléphone (8) | `docs/play/captures/1-accueil.png` à `8-badges.png` | 1080 × 1920, 2 à 8 captures |

Les captures viennent d'un **compte de démonstration fictif** (« Camille Démo »)
dans la **version Play** (`?src=play`). Pour les refaire après un changement
d'écran :

```
python3 -m http.server 8830 &
node scripts/play/captures.mjs
node scripts/play/banniere.mjs
```

`docs/play/verif/abonnement-version-play.png` montre l'écran d'abonnement de la
version Play : aucun prix, aucun bouton de paiement, le message seul. Garde-la
pour répondre à Google s'il pose la question.

## Catégorie, coordonnées

- **Catégorie** : Santé et remise en forme. **Tags** : Musculation, Suivi
  d'entraînement, Santé des femmes.
- **E-mail** : guellec.coachingpro@gmail.com. **Site web** :
  https://repcore-sync.web.app
- **Politique de confidentialité** : https://repcore-sync.web.app/privacy.html
