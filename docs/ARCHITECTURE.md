# Architecture

## Vue d’ensemble

Le projet utilise Next.js App Router. Les pages et les routes HTTP vivent dans `src/app`, tandis que le code réutilisable reste dans `src/lib` et `src/components`.

```text
prisma/                 Schéma et initialisation de la base
src/
  app/
    api/                Contrats HTTP côté serveur
    admin/              Interface ADMIN/MODERATOR
    dashboard/          Interface utilisateur
  components/           Composants d’interface partagés
  lib/                  Auth, permissions, vCenter, SMTP et utilitaires
  styles/               Styles React centralisés
  types/                Extensions TypeScript des bibliothèques
tests/                  Tests automatisés
docs/                   Documentation technique
```

## Flux principaux

- `src/lib/auth.ts` authentifie les identifiants et produit une session JWT.
- `/setup` et `/api/setup` créent le premier administrateur uniquement lorsque la base ne contient aucun utilisateur.
- `src/middleware.ts` protège les pages et API, impose le changement de mot de passe/TOTP et vérifie l’origine des mutations.
- Chaque route API refait ses contrôles d’autorisation avant d’accéder à Prisma ou vCenter.
- `src/lib/vcenter.ts` est l’unique client REST/SOAP vCenter.
- `src/instrumentation.ts` démarre le moniteur d'état côté serveur ; `src/lib/vcenter-monitor.ts` compare périodiquement les états observés avec leur dernier état connu.
- La connexion vCenter est enregistrée dans `SiteSettings`; son mot de passe est chiffré avec `SETTINGS_ENCRYPTION_KEY` et n’est jamais renvoyé par l’API d’administration.
- `src/lib/mailer.ts` centralise le transport et les modèles de courriel.

## Rôles

- `ADMIN` : administration complète, identité, infrastructure et synchronisation vCenter.
- `MODERATOR` : utilisateurs et VM non-infrastructure, sans gestion des administrateurs.
- `USER` : uniquement les VM qui lui sont attribuées.

Les permissions serveur font autorité. Cacher une action dans l’interface ne remplace jamais une vérification dans l’API.

| Action | ADMIN | MODERATOR | USER |
|---|:---:|:---:|:---:|
| Configuration du site et SMTP | Oui | Non | Non |
| Synchronisation/import/actualisation vCenter | Oui | Non | Non |
| Gestion des VM d’infrastructure | Oui | Non | Non |
| Gestion des utilisateurs standards | Oui | Oui | Non |
| Gestion des administrateurs/modérateurs | Oui | Non | Non |
| Attribution de VM normales | À tous les rôles | Aux utilisateurs | Non |
| Utilisation d’une VM normale | Oui | Oui | Si attribuée |
| Utilisation d’une VM d’infrastructure | Oui | Non | Non |
| Consultation des journaux | Tous, y compris les événements administratifs | Événements opérationnels globaux | Non |

Une VM marquée comme infrastructure perd automatiquement ses attributions et ne peut pas être réattribuée.

Les attributions restent disponibles pour les administrateurs et modérateurs afin d'alimenter leur espace personnel. Elles ne limitent pas leurs droits globaux sur les VM normales. Une modification de rôle conserve donc les attributions existantes, mais révoque les sessions actives du compte concerné.

## Alertes d'alimentation

- Une commande émise depuis le panel est annoncée dès que vCenter l'accepte.
- Une préférence désactivée n'envoie aucun message, même à l'auteur de la commande.
- Les destinataires attributaires et l'auteur sont dédupliqués par compte.
- Le moniteur configurable détecte les transitions réalisées directement dans vCenter.
- La première observation sert de référence et ne génère pas d'alerte.
- Une période de grâce après les commandes du panel empêche le moniteur d'envoyer un doublon.

## Base de données

La version 1.3.3 est le schéma de référence consolidé. `db-init` applique ce schéma avec `prisma db push` aussi bien sur une base neuve que sur une installation existante déjà mise à niveau.

La création initiale utilise une transaction PostgreSQL `SERIALIZABLE` afin que deux requêtes concurrentes ne puissent pas créer deux premiers administrateurs.
