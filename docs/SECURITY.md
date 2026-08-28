# Sécurité

## Secrets

- Les mots de passe utilisateurs sont hachés avec bcrypt (coût 12).
- Les mots de passe SMTP et secrets TOTP sont chiffrés en AES-256-GCM avant stockage.
- `SETTINGS_ENCRYPTION_KEY` doit être stable, unique et conservée hors du dépôt.
- L’accès vCenter doit utiliser un compte de service aux droits minimaux.
- La désactivation de la vérification TLS vCenter depuis l’administration est réservée aux environnements isolés utilisant un certificat auto-signé.

## Contrôles applicatifs

- Sessions JWT d’une durée maximale de huit heures.
- Révocation des sessions existantes après une modification de rôle ou de mot de passe.
- Dérogations TOTP administratives obligatoirement bornées dans le temps et révocation immédiate des sessions concernées.
- Limitation des tentatives de connexion par compte et par adresse source.
- Limitation dédiée des activations TOTP, vérifications TOTP, changements de mot de passe et appels vCenter coûteux.
- Refus des corps JSON annoncés au-delà de 1 Mo.
- Vérification de l’origine pour les mutations API authentifiées.
- Autorisations réévaluées sur chaque route sensible.
- Verrouillage irréversible de l’assistant initial dès la création du premier utilisateur.
- Réponses publiques sans détail des erreurs vCenter/SMTP.
- Journal global séparant les événements visibles par le staff des opérations réservées aux administrateurs.
- Journal global intégré au schéma consolidé 1.3.3.
- CSP dynamique avec nonce distinct à chaque requête, sans autorisation générale des scripts inline.
- Nouveau mot de passe obligatoire lorsque la destination ou l’identité SMTP/vCenter change.
- Taille des réponses vCenter bornée et structures critiques validées avant utilisation.

## Limites connues

Sur une base vide, le premier visiteur pouvant atteindre `/setup` peut créer l’administrateur. Effectuez donc l’initialisation avant d’exposer le service sur un réseau non fiable.

Le limiteur actuel est en mémoire du processus. Pour plusieurs réplicas, le remplacer par un stockage partagé (par exemple Redis) afin que les compteurs soient globaux.

La liste des proxys de confiance est vide après installation afin de ne pas bloquer le setup. La confiance accordée à `CF-Connecting-IP`, `X-Real-IP` et `X-Forwarded-For` suppose que le reverse proxy remplace ces en-têtes et que le conteneur ne soit pas directement exposé. Le filtrage réseau du port 3000 reste obligatoire car Next.js ne fournit pas ici l’adresse TCP du pair au code applicatif.

Le limiteur en mémoire constitue une défense complémentaire et non un pare-feu. Pour plusieurs réplicas, utiliser un stockage partagé.

## Signalement

Ne placez aucun secret, extrait de base ou réponse vCenter complète dans un ticket. Documentez le scénario, la route concernée et une reproduction expurgée.
