# Audit applicatif

## Périmètre

Cette revue couvre l'authentification, le premier démarrage, les rôles, les attributions, les VM d'infrastructure, les commandes vCenter, le TOTP, les secrets, SMTP, les notifications, les journaux, les routes API, les interfaces principales, Docker et l'organisation du dépôt.

Elle repose sur une lecture statique du code, la validation Prisma, le contrôle TypeScript, les tests unitaires et l'audit des dépendances. Le build et le démarrage du service sont volontairement exclus de cette passe.

## Matrice fonctionnelle vérifiée

| Parcours | ADMIN | MODERATOR | USER |
|---|:---:|:---:|:---:|
| Créer, supprimer ou changer le rôle d'un compte privilégié | Oui | Non | Non |
| Gérer un utilisateur standard | Oui | Oui | Non |
| Attribuer une VM normale à un ADMIN/MODERATOR/USER | Oui | USER uniquement | Non |
| Voir ses VM attribuées dans son espace personnel | Oui | Oui | Oui |
| Agir sur toutes les VM normales | Oui | Oui | Non |
| Agir sur une VM normale attribuée | Oui | Oui | Oui |
| Voir ou agir sur une VM d'infrastructure | Oui | Non | Non |
| Configurer vCenter, SMTP et l'identité du site | Oui | Non | Non |

### Conditions d'alerte vérifiées

| Événement | Destinataires | Moment |
|---|---|---|
| Commande panel sur VM normale | Auteur et attributaires ayant activé `vmPowerAlert`, dédupliqués | Acceptation vCenter |
| Commande panel sur VM infrastructure | Administrateurs ayant activé l'alerte correspondant au démarrage ou à l'arrêt | Acceptation vCenter |
| Transition externe sur VM normale | Attributaires ayant activé `vmPowerAlert` | Détection périodique |
| Transition externe sur VM infrastructure | Administrateurs ayant activé l'alerte correspondante | Détection périodique |
| Première observation ou état suspendu | Aucun | État de référence uniquement |

Les permissions sont recalculées côté serveur. Les contrôles visuels ne sont jamais considérés comme une barrière de sécurité.

## Garanties vérifiées

- Les sessions sont invalidées après une modification de rôle ou de mot de passe.
- Le dernier administrateur ne peut pas être supprimé ou rétrogradé et un administrateur ne peut pas se verrouiller lui-même.
- Les attributions sont atomiques et idempotentes ; les attributions personnelles des rôles privilégiés sont conservées.
- Les VM d'infrastructure sont exclues des attributions et restent réservées aux administrateurs.
- Les secrets TOTP, SMTP et vCenter sont chiffrés au repos avec une clé obligatoire distincte du secret de session.
- Les actions sensibles disposent de limites de débit et les erreurs internes des services externes ne sont pas renvoyées au navigateur.
- L'interface ne confirme plus une mutation lorsque l'API l'a refusée.

## Organisation retenue

- `src/app` contient uniquement les pages et contrats HTTP liés à App Router.
- `src/lib` centralise l'authentification, les permissions, les validations et les intégrations externes.
- `src/components` contient les éléments d'interface réutilisables.
- `src/styles` centralise les styles extraits des pages ; `globals.css` conserve les variables et règles responsive communes.
- `prisma`, `tests` et `docs` séparent respectivement le modèle de données, les contrôles automatisés et la documentation.

## Points de déploiement à respecter

- Initialiser `/setup` avant toute exposition à un réseau non fiable.
- Utiliser un reverse proxy qui écrase les en-têtes d'adresse source et ne pas exposer directement le conteneur applicatif.
- Conserver `SETTINGS_ENCRYPTION_KEY` de manière durable : sa perte rend les secrets configurés illisibles.
- La version 1.3.3 est désormais le schéma consolidé de référence ; sauvegarder PostgreSQL avant toute future évolution du modèle Prisma.
- Pour plusieurs réplicas, déplacer la limitation de débit vers un stockage partagé.

Un audit statique réduit fortement les risques identifiables mais ne constitue pas une preuve d'absence totale de vulnérabilité. Une recette dans l'environnement réel et un test d'intrusion restent nécessaires avant exposition publique.
