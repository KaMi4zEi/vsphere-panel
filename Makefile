# Makefile — raccourcis pour vSphere Panel

.PHONY: install dev build start db-push \
        docker-build docker-up docker-down docker-logs \
        docker-dev docker-migrate update secret

## ── Développement local ──────────────────────────────────────

install:          ## Installer les dépendances npm
	npm ci

dev:              ## Lancer en mode développement
	npm run dev

build:            ## Build Next.js production
	npm run build

start:            ## Lancer le build de production
	npm run start

db-push:          ## Synchroniser le schéma Prisma avec la BDD de développement
	npx prisma db push

db-studio:        ## Ouvrir Prisma Studio (interface BDD)
	npx prisma studio

secret:           ## Générer un NEXTAUTH_SECRET
	@echo "NEXTAUTH_SECRET=$$(openssl rand -base64 32)"

## ── Docker ───────────────────────────────────────────────────

docker-build:     ## Build l'image Docker (sans cache)
	docker compose build --no-cache

docker-up:        ## Démarrer les conteneurs (production)
	docker compose up -d

docker-down:      ## Arrêter les conteneurs
	docker compose down

docker-logs:      ## Suivre les logs du conteneur app
	docker compose logs -f app

docker-migrate:   ## Synchroniser le schéma Prisma dans Docker
	docker compose run --rm db-init

docker-dev:       ## Démarrer avec MailHog (dev)
	docker compose --profile dev up -d
	@echo ""
	@echo "  Application : http://localhost:3000"
	@echo "  MailHog UI  : http://localhost:8025"
	@echo ""

docker-shell:     ## Shell dans le conteneur app
	docker compose exec app sh

update:           ## Mettre a jour depuis ARCHIVE=/chemin/version.tar.gz HASH=sha256
	@test -n "$(ARCHIVE)" || (echo "ARCHIVE est requis" >&2; exit 1)
	sudo sh ./update.sh "$(ARCHIVE)" "$(HASH)"

## ── Aide ──────────────────────────────────────────────────────

help:             ## Afficher cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
