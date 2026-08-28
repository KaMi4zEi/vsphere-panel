#!/bin/sh
set -eu

fail() { echo "ERREUR: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "executez ce script avec sudo"
[ "$#" -ge 1 ] || fail "usage: sudo sh ./update.sh /chemin/archive.tar.gz [SHA256]"

APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ARCHIVE=$(readlink -f -- "$1")
EXPECTED_HASH=${2:-}
[ -f "$ARCHIVE" ] || fail "archive introuvable: $ARCHIVE"
[ -f "$APP_DIR/.env" ] || fail ".env introuvable dans $APP_DIR"
[ -f "$APP_DIR/docker-compose.yml" ] || fail "docker-compose.yml introuvable"

for command in docker tar sha256sum mktemp awk sed; do
  command -v "$command" >/dev/null 2>&1 || fail "commande requise absente: $command"
done
docker compose version >/dev/null 2>&1 || fail "Docker Compose est indisponible"

ACTUAL_HASH=$(sha256sum "$ARCHIVE" | awk '{print toupper($1)}')
if [ -z "$EXPECTED_HASH" ] && [ -f "$ARCHIVE.sha256" ]; then
  EXPECTED_HASH=$(awk 'NR == 1 { print $1 }' "$ARCHIVE.sha256")
fi
[ -n "$EXPECTED_HASH" ] || fail "SHA-256 requis en second argument ou dans $ARCHIVE.sha256"
if [ "$ACTUAL_HASH" != "$(printf '%s' "$EXPECTED_HASH" | tr '[:lower:]' '[:upper:]')" ]; then
  fail "SHA-256 incorrect (obtenu: $ACTUAL_HASH)"
fi

WORK_DIR=$(mktemp -d /opt/vsphere-panel-update.XXXXXX)
PAYLOAD_DIR="$WORK_DIR/payload"
LIST_FILE="$WORK_DIR/archive.list"
mkdir -p "$PAYLOAD_DIR"
cleanup() { rm -rf -- "$WORK_DIR"; }
trap cleanup EXIT INT TERM HUP

tar -tzf "$ARCHIVE" > "$LIST_FILE"
awk '
  /^\// { exit 1 }
  /(^|\/)\.\.($|\/)/ { exit 1 }
  /(^|\/)\.env($|\/)/ { exit 1 }
  END { if (NR == 0) exit 1 }
' "$LIST_FILE" || fail "archive dangereuse, vide ou contenant un .env"

ROOT_COUNT=$(awk -F/ 'NF { roots[$1]=1 } END { for (root in roots) count++; print count+0 }' "$LIST_FILE")
[ "$ROOT_COUNT" -eq 1 ] || fail "l'archive doit contenir un unique dossier racine"
tar -xzf "$ARCHIVE" -C "$PAYLOAD_DIR" --strip-components=1

for required in package.json package-lock.json docker-compose.yml Dockerfile prisma/schema.prisma; do
  [ -f "$PAYLOAD_DIR/$required" ] || fail "fichier absent de l'archive: $required"
done

NEW_VERSION=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$PAYLOAD_DIR/package.json" | head -n 1)
[ -n "$NEW_VERSION" ] || fail "version impossible a lire"

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR="/var/backups/vsphere-panel/$STAMP-before-$NEW_VERSION"
install -d -m 0700 "$BACKUP_DIR"

echo "Archive valide: v$NEW_VERSION ($ACTUAL_HASH)"
echo "Sauvegarde dans $BACKUP_DIR"
cd "$APP_DIR"
docker compose config --quiet
docker compose exec -T postgres pg_dump -U vsphere_user -d vsphere_panel -Fc > "$BACKUP_DIR/database.dump"
cp -a .env "$BACKUP_DIR/env.backup"
tar -czf "$BACKUP_DIR/application.tar.gz" --exclude=.env --exclude=node_modules --exclude=.next .
chmod 0600 "$BACKUP_DIR"/*

echo "Arret de l'application"
docker compose stop app

find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name .env -exec rm -rf -- {} +
cp -a "$PAYLOAD_DIR/." "$APP_DIR/"
chown -R vsphere-panel:vsphere-panel "$APP_DIR"
chmod 0600 "$APP_DIR/.env"
chmod 0750 "$APP_DIR/update.sh"

echo "Construction et mise a niveau"
cd "$APP_DIR"
if ! docker compose config --quiet || ! docker compose build --pull || ! docker compose up -d --remove-orphans; then
  echo "La mise a jour a echoue. Sauvegarde disponible: $BACKUP_DIR" >&2
  exit 1
fi

docker compose ps -a
docker compose logs db-init

HEALTHY=0
ATTEMPT=0
while [ "$ATTEMPT" -lt 30 ]; do
  if docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok||r.status===302?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    HEALTHY=1
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  sleep 2
done
[ "$HEALTHY" -eq 1 ] || fail "l'application ne repond pas; consultez docker compose logs app (sauvegarde: $BACKUP_DIR)"

echo "Mise a jour v$NEW_VERSION terminee. SHA-256: $ACTUAL_HASH"
