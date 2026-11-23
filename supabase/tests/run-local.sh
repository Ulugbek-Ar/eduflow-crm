#!/usr/bin/env bash
# Migratsiya va RLS'ni oddiy PostgreSQL 15+ da tekshirish (Supabase'siz):
#   PGHOST=... PGPORT=... PGUSER=postgres bash supabase/tests/run-local.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=${DB:-eduflow_rls_test}
psql -v ON_ERROR_STOP=1 -q -c "drop database if exists $DB" -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/stub_auth.sql
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"; done
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/rls_test.sql | grep RLS_OK
