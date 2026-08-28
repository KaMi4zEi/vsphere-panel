#!/bin/sh
set -eu

case "${NEXTAUTH_SECRET:-}" in ""|CHANGEZ_MOI*) echo "NEXTAUTH_SECRET invalide" >&2; exit 1;; esac
case "${SETTINGS_ENCRYPTION_KEY:-}" in ""|CHANGEZ_MOI*) echo "SETTINGS_ENCRYPTION_KEY invalide" >&2; exit 1;; esac
[ "${#NEXTAUTH_SECRET}" -ge 32 ] || { echo "NEXTAUTH_SECRET doit contenir au moins 32 caractères" >&2; exit 1; }
[ "${#SETTINGS_ENCRYPTION_KEY}" -ge 32 ] || { echo "SETTINGS_ENCRYPTION_KEY doit contenir au moins 32 caractères" >&2; exit 1; }
[ "$NEXTAUTH_SECRET" != "$SETTINGS_ENCRYPTION_KEY" ] || { echo "Les deux clés applicatives doivent être distinctes" >&2; exit 1; }

exec node server.js
