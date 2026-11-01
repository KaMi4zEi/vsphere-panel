# vSphere Panel

Panel web responsive d’administration et de libre-service pour VMware vSphere 8.

Version actuelle : **1.3.5**.

## Fonctionnalités

- Assistant `/setup` pour créer le premier administrateur sans identifiants codés en dur.
- Gestion des comptes `ADMIN`, `MODERATOR` et `USER`.
- Import, synchronisation et enrichissement de l’inventaire vCenter.
- Espaces personnels et attributions de VM pour tous les rôles.
- Démarrage, arrêt invité et consultation des statistiques des VM autorisées.
- Isolation complète des VM d’infrastructure au rôle administrateur.
- Authentification TOTP, changement obligatoire du mot de passe et dérogations TOTP temporaires.
- Configuration vCenter, SMTP, identité visuelle et favicon depuis l’administration.
- Alertes email configurables par utilisateur, avec prévention des envois en double.
- Surveillance configurable des changements d’état effectués directement dans vCenter.
- Journal d’activité conservé après la suppression d’un compte ou d’une VM.
- Interface responsive adaptée aux ordinateurs, tablettes et mobiles.

## Permissions principales

| Action | ADMIN | MODERATOR | USER |
|---|:---:|:---:|:---:|
| Configuration du site, SMTP et vCenter | Oui | Non | Non |
| Synchronisation et import vCenter | Oui | Non | Non |
| Gestion des VM d’infrastructure | Oui | Non | Non |
| Gestion des utilisateurs standards | Oui | Oui | Non |
| Gestion des administrateurs et modérateurs | Oui | Non | Non |
| Attribution d’une VM normale | Tous les rôles | USER uniquement | Non |
| Utilisation d’une VM normale | Toutes | Toutes | Si attribuée |
| Utilisation d’une VM d’infrastructure | Oui | Non | Non |
| Consultation des journaux | Tous, y compris événements admin | Événements staff globaux | Non |

Les administrateurs et modérateurs conservent leurs attributions afin d’alimenter leur espace « Mes VMs ». Elles ne réduisent pas leurs droits globaux sur les VM normales.

## Stack technique

- Next.js 15, React 19 et TypeScript strict
- PostgreSQL 17 et Prisma ORM 7
- NextAuth.js avec sessions JWT
- bcrypt et TOTP `otplib`
- Nodemailer pour SMTP
- API REST et SOAP vCenter 8
- Docker Compose

## Démarrage rapide avec Docker

1. Copiez l’exemple d’environnement :

```bash
cp .env.example .env
```

Sous PowerShell :

```powershell
Copy-Item .env.example .env
```

2. Renseignez les secrets obligatoires :

```env
POSTGRES_PASSWORD=mot_de_passe_alphanumerique_robuste
NEXTAUTH_SECRET=une_valeur_aleatoire_distincte_de_32_caracteres_minimum
SETTINGS_ENCRYPTION_KEY=une_autre_valeur_aleatoire_de_32_caracteres_minimum
NEXTAUTH_URL=http://localhost:3000
APP_PORT=3000
```

Générez deux secrets distincts, par exemple avec `openssl rand -base64 32`.

`SETTINGS_ENCRYPTION_KEY` chiffre les secrets SMTP, vCenter et TOTP stockés en base. Elle doit rester stable : sa perte rend ces données illisibles.

3. Construisez et démarrez le projet :

```bash
docker compose up -d --build
```

Le service `db-init` attend PostgreSQL et applique directement le schéma consolidé 1.3.3 avec `prisma db push`. Le service web ne démarre qu’après la réussite de cette initialisation.

4. Ouvrez [http://localhost:3000/setup](http://localhost:3000/setup) et créez le premier administrateur.

Une fois le premier compte créé, l’assistant et son API se verrouillent automatiquement. Configurez ensuite vCenter et SMTP depuis **Administration → Configuration du site**.

## Configuration vCenter

La connexion vCenter n’est pas lue depuis le `.env`. Elle est enregistrée depuis l’administration et son mot de passe est chiffré en base.

Le compte de service doit disposer au minimum des permissions nécessaires pour :

- lire l’inventaire et la configuration des VM ;
- créer une session API ;
- démarrer et arrêter une VM ;
- demander l’arrêt du système invité ;
- lire les métriques nécessaires aux statistiques.

La vérification TLS est activée par défaut. Sa désactivation doit rester limitée à un environnement isolé avec certificat autosigné.

La surveillance périodique des états peut être activée dans la même section avec un intervalle de 30 secondes, 1 minute, 5 minutes, 15 minutes ou 1 heure.

## Alertes email

SMTP se configure uniquement depuis **Configuration du site**. Aucune variable SMTP du `.env` n’est utilisée.

- Une commande du panel est annoncée dès son acceptation par vCenter.
- Aucun email n’est envoyé à un compte qui n’a pas activé la préférence correspondante.
- Un même compte reçoit au maximum un email par événement, même lorsqu’il est à la fois auteur de l’action et attributaire de la VM.
- Le moniteur vCenter détecte les changements réalisés hors du panel.
- La première observation initialise l’état de référence sans envoyer d’alerte.
- Une période de grâce évite qu’une commande du panel soit ensuite annoncée une seconde fois par le moniteur.

Pour tester SMTP avec MailHog :

```bash
docker compose --profile dev up -d
```

Configurez l’hôte `mailhog`, le port `1025` et STARTTLS. L’interface MailHog est accessible sur [http://localhost:8025](http://localhost:8025).

## Développement local

```bash
npm ci
npx prisma generate
npm run dev
```

Commandes de contrôle :

```bash
npm run typecheck
npm test
npm run check
npx prisma validate
npm audit
```

`node_modules`, `.next`, la couverture et les caches TypeScript ne doivent pas être conservés dans une copie propre du projet. `node_modules` est recréé avec `npm ci` grâce à `package-lock.json`.

## Commandes Make

```text
make help            Afficher toutes les commandes
make install         Installer les dépendances
make dev             Démarrer Next.js en développement
make build           Construire l’application
make docker-build    Construire les images sans cache
make docker-up       Démarrer PostgreSQL, db-init et le panel
make docker-down     Arrêter le projet
make docker-logs     Suivre les journaux du panel
make docker-dev      Démarrer également MailHog
make docker-migrate  Réappliquer le schéma avec db-init
make db-studio       Ouvrir Prisma Studio en local
make update ARCHIVE=/chemin/version.tar.gz HASH=SHA256
```

## Mise à jour en une commande

À partir de cette version, une archive ultérieure peut être installée avec :

```bash
sudo sh ./update.sh ./vsphere-panel-vX.Y.Z.tar.gz SHA256_ATTENDU
```

Si le fichier `archive.tar.gz.sha256` accompagne l’archive dans le même dossier, le hash peut être omis :

```bash
sudo sh ./update.sh ./vsphere-panel-vX.Y.Z.tar.gz
```

Le script vérifie le hash et la structure de l’archive, refuse tout `.env` embarqué, sauvegarde PostgreSQL, `.env` et les fichiers applicatifs, conserve les secrets locaux, reconstruit les images, applique le schéma puis redémarre les services. Les sauvegardes sont placées dans `/var/backups/vsphere-panel`.

Si `update.sh` est absent d’une installation antérieure, amorcez-le une seule fois depuis l’archive téléchargée :

```bash
mkdir -p /tmp/vsphere-panel-bootstrap
tar -xzf ./vsphere-panel-vX.Y.Z.tar.gz -C /tmp/vsphere-panel-bootstrap --strip-components=1
sudo install -m 0750 /tmp/vsphere-panel-bootstrap/update.sh /opt/vsphere-panel/update.sh
sudo sh /opt/vsphere-panel/update.sh ./vsphere-panel-vX.Y.Z.tar.gz
```

Les mises à jour suivantes utilisent directement le programme installé dans `/opt/vsphere-panel`.

## Organisation du dépôt

```text
prisma/                 Schéma de données
update.sh               Mise à jour sécurisée et automatisée
src/
  app/
    api/                Routes HTTP et contrôles serveur
    admin/              Interfaces ADMIN et MODERATOR
    dashboard/          Espace personnel
  components/           Composants partagés
  lib/                  Auth, permissions, SMTP, vCenter et validations
  styles/               Styles React centralisés
  types/                Extensions TypeScript
  instrumentation.ts    Démarrage du moniteur vCenter
tests/                  Tests automatisés
docs/                   Documentation technique et audit
```

## Sécurité et mise en production

- Les mots de passe sont hachés avec bcrypt, coût 12.
- Les secrets applicatifs stockés en base sont chiffrés en AES-256-GCM.
- Les mutations authentifiées vérifient leur origine.
- Les actions sensibles disposent de limites de débit.
- Les sessions sont révoquées après un changement de rôle, de mot de passe ou de dérogation TOTP.
- Les réponses vCenter sont bornées et validées avant utilisation.
- Les erreurs internes SMTP et vCenter ne sont pas exposées au navigateur.

La version 1.3.3 constitue le schéma de référence consolidé. Les nouvelles installations le créent directement avec `prisma db push`. Les installations existantes déjà mises à niveau restent compatibles avec ce schéma ; une sauvegarde PostgreSQL demeure obligatoire avant chaque évolution.

Initialisez `/setup` avant d’exposer le service sur un réseau non fiable. En production, placez le panel derrière un reverse proxy qui remplace les en-têtes d’adresse source et n’expose pas directement le conteneur web.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Développement](docs/DEVELOPMENT.md)
- [Sécurité](docs/SECURITY.md)
- [Rapport d’audit](docs/AUDIT.md)
- [Historique des versions](CHANGELOG.md)
