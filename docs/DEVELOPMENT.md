# Développement

## Préparation

1. Copier `.env.example` vers `.env`.
2. Renseigner toutes les variables marquées obligatoires.
3. Installer avec `npm ci`.
4. Synchroniser une base de développement avec `npm run db:push`.
5. Lancer le projet puis ouvrir `/setup` pour créer le premier administrateur.

Les paramètres applicatifs par défaut sont créés par l’assistant. Aucun seed utilisateur n’est exécuté au démarrage.

Le dossier `node_modules` contient les dépendances locales résolues par `package-lock.json` ; ce n’est pas une sortie d’un ancien build. Il peut être supprimé puis recréé avec `npm ci`. Il est exclu du contexte Docker par `.dockerignore`, puis réinstallé proprement dans chaque étape de l’image.

En Docker, le service Compose `db-init` applique le schéma puis s'arrête. Le service `app` attend sa réussite et utilise une image d'exécution minimale sans dépendances de développement. `--include=dev` reste donc limité aux étapes de compilation et d'initialisation Prisma.

L’image `node:22-alpine` conserve la version npm fournie avec Node 22. Ne pas installer automatiquement une nouvelle version majeure globale à partir du simple message `npm notice` : npm 12 cible des versions Node plus récentes/précises et modifie plusieurs comportements d’installation.

## Vérifications

```bash
npm run check
npm audit
```

`npm run check` exécute le contrôle TypeScript et les tests sans produire de build. Un build de production reste obligatoire avant une livraison.

## Conventions

- Utiliser `@/` pour les imports internes.
- Garder les routes API minces et placer le code partagé dans `src/lib`.
- Valider les données reçues avant Prisma ou vCenter.
- Ne jamais renvoyer une erreur interne, une réponse SOAP ou un secret au navigateur.
- Ajouter tout changement visible dans `CHANGELOG.md`, section `Non publié`.
- Ne jamais versionner `.env`, `.next`, les journaux, la couverture ou les fichiers `*.tsbuildinfo`.

## Versionnement et publication

Le projet suit le versionnement sémantique `MAJEUR.MINEUR.CORRECTIF` :

- `npm run version:patch` pour une correction rétrocompatible ;
- `npm run version:minor` pour une fonctionnalité rétrocompatible ;
- `npm run version:major` pour une rupture de compatibilité.

Ces commandes synchronisent `package.json` et `package-lock.json` sans créer de commit ni de tag Git. Avant une publication, déplacer les entrées concernées de `Non publié` vers une section `X.Y.Z` datée au format `AAAA-MM-JJ`, exécuter `npm run check`, puis créer le commit et le tag Git `vX.Y.Z`.
