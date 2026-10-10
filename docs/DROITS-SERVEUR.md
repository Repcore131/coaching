# Les droits, décidés par le serveur (10/10/2026)

## Avant

`rc-core` décidait de l'accès avec le dossier `users/<clé>`. Les règles
laissent son titulaire écrire ce dossier sans restriction de champ.

| Accès | Ce que l'app lisait | Comment on trichait |
|---|---|---|
| Essai | `essai.ouvertLe` / `essai.finit` (repli si `droits/` ne disait rien) | `essai.finit` dans un an, depuis la console |
| Programme | `programmesAchetes/<id>` | s'écrire une fiche d'achat |
| Abonnement | `status` + `paymentStatus` si `droits/` n'était pas lu, ou tant que la bascule (`reglages_publics/droitsServeur`) n'était pas posée, et 72 h après un paiement « sur cet appareil » | `status: 'AUTONOMIE_PREMIUM'` |

`FONCTIONS_SERVEUR = false` coupait les deux appels prévus pour les Cloud
Functions (`ouvrirEssai`, `verifierAchatProgramme`), faute de plan Blaze.

## Maintenant

`droits/<clé>` est la seule source. Les règles le ferment à tout client
(`".write": false`, créateur compris). Seul le Worker l'écrit, avec le compte
de service, qui ne passe pas par les règles.

```
droits/<clé> = {
  palier, echeance, source, abo, ultimeJusqu, …    // abonnement (inchangé)
  essaiOuvertLe, essaiFinit, essaiBonus            // l'essai, ouvert une fois
  programmes/<id> = {le, prixCts, source, ordre, rembourseLe?}   // à vie
  rattrapeLe                                       // compte d'avant, rattrapé
}
```

`/fn/droits` (jeton Firebase vérifié) — `cloudflare/src/droits-serveur.js` :

| Action | Ce que fait le serveur |
|---|---|
| `essai` | Ouvre l'essai une fois dans la vie du compte. La date d'ouverture est la plus ancienne des dates connues (`essai.ouvertLe`, `createdAt`, maintenant). Il compte 30 jours, plus le mois de l'ami si un lien de parrainage ou d'ambassadeur l'atteste. `essai.finit` n'est jamais lu. |
| `rattraper` | Pour un compte d'avant ce lot : reprend son essai (même calcul), relit chacune de ses commandes de programme chez PayPal et relit son abonnement (custom_id = le compte). Rien n'est cru sur la foi du dossier. |
| `verifierAchat` | Juste après un achat : relit la commande chez PayPal (payée, pour ce compte et ce programme, au prix de la boutique, en euros), puis inscrit le programme. |
| `poser` | L'écran Accès du créateur, lui seul. Seulement les champs d'accès, jamais l'essai ni les programmes. |

Le webhook PayPal écrit aussi `droits/<clé>/programmes` à chaque achat, et
`rembourseLe` au remboursement. Le parrainage ou le code ambassadeur accepté
après l'ouverture recule la fin de l'essai d'un mois, une fois (`bonusEssai`).

Côté app :
- `essaiFin`, `programmeAcquis`, `palierDe` et `checkAccess` ne lisent que
  `droits/`.
- L'inscription demande l'essai au serveur. Le paiement d'un abonnement
  demande au serveur de le confirmer. L'achat d'un programme attend la
  vérification avant de s'appliquer.
- Un compte d'avant est rattrapé à sa première session : il n'a pas de
  `rattrapeLe`, et l'app appelle `rattraper`.

## Tests

- Règles, sur l'émulateur : `cloudflare/test/regles-droits.emu.mjs`. Un client
  ne peut ni prolonger son essai, ni s'attribuer un programme ou un palier, ni
  effacer un remboursement. Le coach ne le peut pas non plus, ni le créateur
  depuis l'app.
- Worker : `cloudflare/test/droits-serveur.test.mjs`. Les cas couverts :
  - essai unique ;
  - dossier trafiqué ;
  - mois de l'ami ;
  - rattrapage vérifié (commande d'un autre compte, montant bradé, « offert »
    sans commande : refusés) ;
  - achat vérifié ;
  - écran Accès.
- App (`app/tests.js`, « DROITS SERVEUR ») : un dossier trafiqué n'ouvre rien,
  et le rattrapage se fait une fois par session.

## Ce qui reste décidé par le dossier

**Le suivi par un coach.** Le code d'accès du coach pose `status:
'COACHING_SUIVI'` et `accessExpiry` dans le dossier de l'athlète, côté client.
Un athlète peut donc encore s'écrire « suivi » depuis la console. Pour fermer
cette porte, il faut que le worker prenne en charge l'échange du code
(`rc_codes` → `droits/<clé>/suiviJusqu`), comme pour l'essai. C'est un lot à
part : il touche au parcours d'invitation des coachs.

## Ce que Kevin doit savoir

- Il n'y a rien à faire pour la transition. Chaque compte est rattrapé à sa
  première ouverture de la nouvelle version.
- Un abonné dont l'abonnement PayPal ne porte ni son compte (custom_id) ni son
  adresse verra l'accès fermé après le rattrapage. Cela concerne les très
  anciens abonnés. Il faut alors l'ouvrir à la main dans l'écran Accès, qui
  passe désormais par le serveur.
- Un programme « offert » écrit dans un dossier d'athlète, sans commande
  PayPal, n'est pas repris. Il faut le réoffrir à la main.
