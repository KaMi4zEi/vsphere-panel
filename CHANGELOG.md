# Changelog

Toutes les modifications notables de ce projet sont documentées ici. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet adopte le versionnage sémantique.

## [Non publié]

## [1.3.5] - 2026-11-01

### Sécurité

- Mise à jour de Next.js vers 15.5.28 et verrouillage de Sharp 0.35.5 pour corriger la vulnérabilité critique d'exécution de code à distance CVE-2026-96889.
- Mise à jour de Nodemailer et de `source-map-js` vers leurs versions corrigées ; l'audit des dépendances de production ne signale plus aucune vulnérabilité.
- Liaison du port applicatif Docker à `127.0.0.1` par défaut afin que le reverse proxy reste le seul point d'entrée public ; l'adresse reste configurable avec `APP_BIND_ADDRESS`.

## [1.3.4] - 2026-08-29

### Interface

- Utilisation du nom et de l’icône configurés sur les écrans de changement obligatoire du mot de passe et de première configuration TOTP.
- Affichage explicite de la clé TOTP manuelle dans un champ en lecture seule, avec validation de la réponse API et bouton de copie.

### Déploiement

- Documentation de l’amorçage unique de `update.sh` pour les installations antérieures qui ne possèdent pas encore ce programme.

## [1.3.3] - 2026-08-28

### Déploiement

- Ajout d’un programme de mise à jour en une commande avec validation SHA-256 obligatoire, contrôle anti-traversée de l’archive, sauvegarde PostgreSQL et applicative, conservation du `.env`, reconstruction et redémarrage automatisés.
- Confirmation du schéma Prisma consolidé comme source complète de la base ; conservation documentée de l’ancienne table `ActivityLog` pour la compatibilité avec les installations existantes.

## [1.3.2] - 2026-08-28

### Correction

- Correction de la détection de l’adresse cliente derrière Nginx Proxy Manager et Cloudflare : prise en charge des formats standards `CF-Connecting-IP`, `X-Real-IP` et `X-Forwarded-For` sans exiger que NPM ajoute sa propre adresse à la chaîne.
- Maintien du filtrage réseau du port applicatif comme frontière de confiance entre Nginx Proxy Manager et le panel.
- Consolidation du schéma et du conteneur d’initialisation : les nouvelles installations utilisent directement l’état final 1.3.2 sans rejouer le patch intermédiaire 1.3.1.

## [1.3.1] - 2026-08-28

### Sécurité

- Obligation de fournir un nouveau mot de passe lorsque l’hôte ou le compte vCenter change, ainsi que lorsque le serveur, le port ou l’utilisateur SMTP change.
- Ajout d’une configuration des adresses de reverse proxy de confiance avec conservation du mode compatible tant que la liste est vide.
- Remplacement de la CSP statique autorisant `unsafe-inline` par une CSP dynamique reposant sur un nonce par requête.
- Ajout explicite de `Cache-Control: no-store, private` aux réponses contenant un secret TOTP.
- Figeage des images Docker sur Node 22.23.2 Alpine 3.24, PostgreSQL 17.11 Alpine 3.24 et MailHog 1.0.1.

### Journal global

- Ajout d’un journal d’audit global pour les connexions, déconnexions, comptes, rôles, mots de passe, TOTP, notifications, attributions, tags, commandes VM et opérations administratives.
- Visibilité des événements opérationnels pour les administrateurs et modérateurs ; les opérations purement administratives restent réservées aux administrateurs.
- Reprise idempotente de l’ancien historique d’alimentation dans le nouveau journal.

### Interface

- Affichage de la clé TOTP manuelle sous le QR code pendant la première configuration.
- Ajout de la configuration des proxys de confiance dans la page Configuration du site.
- Adaptation de la page des logs aux événements globaux et à leur portée.

### Déploiement

- Passage à la version 1.3.1 et ajout d’un patch SQL additif compatible avec une base 1.3.0 existante.
- Ajout d’une procédure dédiée de sauvegarde, mise à jour, migration et retour arrière applicatif.

## [1.3.0] - 2026-08-28

### Alertes et supervision

- Application de la préférence `vmPowerAlert` à tous les destinataires, y compris à l'auteur d'une commande.
- Déduplication des destinataires afin qu'un acteur également attributaire ne reçoive qu'un seul courriel.
- Ajout d'une surveillance périodique configurable des états vCenter, de 30 secondes à une heure.
- Initialisation silencieuse de l'état connu et période de grâce après une commande du panel afin d'éviter les alertes en double.
- Déclenchement des alertes externes uniquement sur une transition d'état réellement observée ; les commandes du panel restent annoncées dès leur acceptation par vCenter.

### Sécurité

- Remplacement du contournement TOTP permanent par une dérogation expirant automatiquement entre 5 minutes et 7 jours.
- Révocation des sessions lors de l'activation, de l'arrêt ou de la réinitialisation d'une dérogation TOTP.
- Conservation des journaux d'alimentation après suppression d'un compte ou d'une VM grâce à des instantanés non modifiables.
- Limitation à 5 Mo des réponses REST/SOAP vCenter et validation de l'inventaire et des états d'alimentation reçus.
- Génération de mots de passe temporaires respectant la politique de complexité complète.

### Déploiement et qualité

- Isolation de `prisma db push` dans un conteneur Compose d'initialisation ; l'image web finale ne contient plus les dépendances de développement.
- Ajout de tests sur l'expiration TOTP et la conformité des mots de passe temporaires.
- Typage renforcé des permissions, de la navigation et des mises à jour de configuration.
- Réécriture du README avec la procédure de déploiement 1.3.0, la matrice des rôles, les alertes, la supervision et l'organisation actuelle du projet.
- Adaptation de `make docker-migrate` au service d'initialisation Prisma dédié.
- Isolation Node.js de l'instrumentation vCenter et externalisation des bibliothèques serveur afin de rendre le build Next.js de production compatible avec le bundle Edge du middleware.
- Résolution du conflit de dépendance optionnelle NextAuth/Nodemailer lors des installations npm reproductibles.

### Interface

- Utilisation de l’icône configurée comme logo de la page de connexion et de la navigation, avec le favicon local par défaut comme repli.
- Revalidation du cache de l’icône afin que son remplacement soit visible après rechargement.

## [1.2.0] - 2026-08-28

### Interface

- Ajout d'une navigation responsive : menu rabattable en icônes sur ordinateur, compact automatique sur tablette et panneau latéral escamotable sur mobile.
- Amélioration des vues mobiles « Machines virtuelles » et « Configuration du site », avec fiches VM lisibles, formulaires empilés et correction du bouton de repli du menu.
- Passage des actions VM et de leurs fenêtres en pleine largeur sur mobile afin qu'aucune commande ne soit masquée hors écran.
- Refonte responsive de « Mon profil » avec sélecteur de section et de « Utilisateurs » avec fiches et actions mobiles.
- Alignement de l’historique du profil sur les marges mobiles communes et amélioration de ses filtres et du défilement du tableau.

### Sécurité

- Ajout d'une politique de mot de passe commune imposant longueur, minuscules, majuscules, chiffres et caractères spéciaux sur tous les parcours de création et de changement.
- Déplacement de la configuration vCenter vers l'administration, avec chiffrement du mot de passe en base et retrait des secrets vCenter de l'environnement.
- Prise en charge des favicons SVG avec validation du contenu et isolation CSP lors de leur affichage.
- Révocation des sessions existantes après un changement de rôle ou de mot de passe.
- Renforcement des limites de débit sur le TOTP, le changement de mot de passe et les lectures vCenter, avec plafonnement de la mémoire du limiteur.
- Validation stricte des secrets de chiffrement au démarrage et refus des corps JSON déclarés au-delà de 1 Mo.
- Réduction des différences temporelles lors d'une tentative de connexion visant un compte inexistant.

### Fiabilité

- Correction de l’ordre des obligations de première connexion : le changement du mot de passe temporaire est désormais autorisé avant d’imposer la configuration TOTP.
- Ajout de la modification de rôle après création, réservée aux administrateurs et protégée contre l’auto-rétrogradation et la rétrogradation du dernier administrateur.
- Conservation des attributions personnelles lors des changements de rôle : un administrateur peut attribuer une VM normale à un utilisateur, un modérateur ou un autre administrateur ; un modérateur reste limité aux utilisateurs standards.
- Correction des faux succès dans l'interface lors d'une suppression de VM/utilisateur, d'une désactivation TOTP ou d'un enregistrement de préférences refusé par l'API.
- Utilisation d'attributions idempotentes afin qu'un double clic ou une requête répétée ne provoque pas d'erreur de doublon.

## [1.1.0] - 2026-08-27

### Déploiement initial

- Remplacement des identifiants administrateur du `.env` par un assistant sécurisé accessible sur `/setup` lorsque la base est vide.
- Création atomique du premier administrateur avec une transaction sérialisable et verrouillage automatique de l’assistant après initialisation.
- Retrait de `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_USERNAME` et `INITIAL_ADMIN_PASSWORD` du Compose, de l’exemple d’environnement et du seed.
- Suppression du seed et de sa dépendance `ts-node` ; le démarrage Docker synchronise uniquement le schéma avant de lancer l’application.

### Sécurité

- Verrouillage complet des VM d’infrastructure au rôle ADMIN : alimentation, statistiques, tags, listes, pages et attributions.
- Suppression atomique des attributions lorsqu’une VM devient une VM d’infrastructure.
- Interdiction pour un modérateur de lire directement les comptes ou attributions ADMIN/MODERATOR.
- Restriction des notifications d’infrastructure aux administrateurs, y compris au moment de l’envoi.
- Expiration après dix minutes des secrets TOTP en attente de confirmation.
- Limitation du débit des commandes d’alimentation et des lectures de statistiques vCenter.
- Migration d’`otplib` 12 vers 13.5 et remplacement de l’ancien preset TOTP par l’API fonctionnelle auditée de la v13.
- Chiffrement des secrets TOTP au repos et conservation côté serveur du secret provisoire pendant l’activation.
- Limitation des connexions par compte et par adresse source, avec nettoyage périodique des compteurs expirés.
- Vérification de l’origine des mutations API authentifiées pour renforcer la protection CSRF.
- Validation des identifiants vCenter, de l’URL vCenter, des paramètres SMTP, des favicons et des données de VM.
- Échappement des données dynamiques injectées dans les courriels HTML et neutralisation des retours de ligne dans leurs sujets.
- Suppression de la route de diagnostic SOAP qui exposait des données internes vCenter.
- Protection contre la suppression du dernier administrateur et les actions de verrouillage sur son propre compte.
- Application de l’obligation de changement de mot de passe et de configuration TOTP aux routes API.
- Interdiction pour un compte soumis au TOTP obligatoire de désactiver lui-même ce facteur.
- Génération locale des QR codes TOTP afin que le secret ne soit jamais envoyé à un service tiers.
- Limitation des tentatives de connexion et de pré-vérification TOTP.
- Génération cryptographiquement sûre des mots de passe temporaires.
- Suppression des comptes et mots de passe de démonstration du seed.
- Chiffrement AES-256-GCM des mots de passe SMTP stockés et suppression de leur exposition par l’API.
- Durcissement des en-têtes HTTP, validation des favicons et fermeture des droits en cas de panne de la base.
- Restriction des attributions réalisées par les modérateurs à leurs rôles autorisés.
- Filtrage strict des préférences de notification et normalisation des comptes créés.
- Ajout de délais d’expiration aux échanges REST et SOAP vCenter.
- Masquage des erreurs vCenter internes dans les réponses publiques.
- Correction de la politique CSP afin d’autoriser l’hydratation React/Next.js sans ouvrir de source externe.

### Fiabilité

- Correction du comptage des VM attribuées/libres lorsqu’une VM possède plusieurs utilisateurs.
- Initialisation cohérente de l’obligation TOTP selon le rôle lors de la création d’un compte.
- Validation uniforme des corps JSON et des confirmations de suppression vCenter.
- Suppression des préférences d’alerte de charge qui n’avaient aucun moteur d’exécution.
- Refus de réutiliser le mot de passe temporaire lors du changement obligatoire.
- Redirection de déconnexion relative à l’origine courante, compatible avec localhost et le domaine public sans dépendre de `NEXTAUTH_URL`.
- Suppression de toutes les sources SMTP issues de l’environnement ; la configuration en base depuis l’administration est désormais l’unique source.
- Correction des données TOTP absentes de l’API profil et des erreurs de chargement lors de l’activation TOTP.
- Refus d’une réinitialisation de mot de passe administrative si aucun transport SMTP ne peut remettre le mot de passe temporaire.
- Validation robuste de la pagination et des corps JSON sur les opérations sensibles.
- Invalidation automatique de la session REST vCenter après une réponse non autorisée.
- Synchronisation vCenter transactionnelle, refus des inventaires vides et confirmation requise au-delà de 25 % de suppressions.
- Conservation de `prisma db push` pour l'initialisation tant qu'aucune installation persistante ne nécessite de migrations versionnées.
- Installation npm reproductible avec lockfile dans les images Docker.
- Inclusion explicite des outils Prisma nécessaires à l’initialisation du schéma dans l’image d’exécution.
- Régénération du client Prisma après l’installation finale des dépendances Docker.
- Passage du démarrage Docker à un entrypoint avec propagation correcte des signaux Unix.

### Interface

- Redirection de la racine vers le tableau de bord lorsqu’une session existe déjà.
- Harmonisation à 12 caractères de l’aide et des contraintes du formulaire de changement de mot de passe.
- Masquage des VM d’infrastructure et de leurs statistiques pour les modérateurs.
- Extraction des styles locaux de 18 pages et composants vers `src/styles/index.ts`.
- Conservation des variables visuelles et du thème clair/sombre dans la feuille globale.
- Ajout d’un favicon local de secours et redirection de `/favicon.ico` vers la route de favicon configurable.

### Qualité

- Ajout d’une extension TypeScript centralisée pour les sessions et jetons NextAuth.
- Ajout d’un utilitaire commun de lecture des corps JSON et des réponses d’erreur.
- Suppression des dossiers parasites, artefacts générés et de la configuration Prisma dupliquée.
- Ajout de guides dédiés à l’architecture, au développement et à la sécurité.
- Chargement explicite du `.env` par Prisma et durcissement du conteneur applicatif (`no-new-privileges`, capacités supprimées).
- Ajout des commandes `typecheck` et `test`.
- Ajout de tests unitaires sur le chiffrement des secrets et la limitation de débit.
- Ajout d’un `.gitignore` protégeant les fichiers d’environnement et sorties de build.

## [1.0.0] - 2026-03-16

### Ajouté

- Première version du panneau vSphere : authentification, rôles, TOTP, inventaire de VMs, actions d’alimentation, statistiques, notifications et personnalisation du site.
