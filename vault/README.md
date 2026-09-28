# VAULT

Suivi d'épargne mensuelle. PWA mobile, hors connexion, données stockées uniquement sur l'appareil.

## Lancer

```bash
cd vault
npm install
npm run dev       # développement
npm test          # tests de la logique métier
npm run build     # version installable dans dist/ (publiable dans n'importe quel dossier)
```

## Structure

- `src/domain/` : logique pure (montants en centimes, dates, stats, récurrences, sauvegarde), testée.
- `src/data/` : accès aux données. L'UI ne parle qu'à l'interface `VaultRepository` ;
  passer à Firebase = écrire `firebaseRepository.ts` et changer une ligne dans `data/index.ts`.
- `src/hooks/`, `src/components/`, `src/screens/` : interface.
- Polices : Bebas Neue (chiffres, titres) et Montserrat (texte), les mêmes fichiers que RepCore.

## Règles

- Montants stockés en centimes entiers. Saisie : virgule ou point, espaces tolérés.
  Refusés : vide, 0, négatif, plus de 2 décimales, ambigu (« 1.250 »), plus de 1 000 000 €.
- « Tous les mois » crée une règle : l'opération est recréée chaque mois au même jour
  (31 → dernier jour du mois). Modifier ou supprimer une occurrence ne touche pas la règle.
  On arrête une règle depuis l'opération ou dans Réglages.
- Série : mois consécutifs où l'épargne ≥ objectif. Le mois en cours compte s'il est atteint,
  et ne casse pas la série tant qu'il n'est pas fini.
- Une catégorie n'est jamais supprimée, seulement masquée : l'historique reste lisible.
