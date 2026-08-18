#!/usr/bin/env bash
# ============================================================
# Disaster-recovery restore script.
#
# Usage:
#   ./recovery/restore.sh "postgresql://postgres:PASSWORD@db.<new-ref>.supabase.co:5432/postgres"
#
# Runs every SQL file in order against the target database and stops on the
# first error. Safe to re-run: schema files fail loudly on an already-restored
# database, seed data is ON CONFLICT DO NOTHING.
# ============================================================
set -euo pipefail

DB_URL="${1:-${SUPABASE_DB_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "ERROR: pass the target database URL as the first argument." >&2
  exit 1
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/sql"

for f in \
  01_extensions.sql \
  02_schema.sql \
  03_functions.sql \
  04_triggers.sql \
  05_grants_rls.sql \
  06_storage.sql \
  07_seed_config.sql \
  99_verify.sql
do
  echo ""
  echo "=== running $f ==="
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$DIR/$f"
done

echo ""
echo "=== RESTORE COMPLETE ==="
echo "Next: set the new URL + keys in .env, redeploy edge functions, re-add secrets."
echo "See recovery/README.md."
