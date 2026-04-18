#!/usr/bin/env bash
set -e

BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$BACKEND_DIR/../vendepro-frontend"
PIDS_FILE="$BACKEND_DIR/.local-pids"
PERSIST_DIR="$BACKEND_DIR/.wrangler-local"

echo "=== VendéPro — Local Dev Setup ==="
cd "$BACKEND_DIR"

# ── Cleanup trap ─────────────────────────────────────────────────
cleanup() {
  if [ -f "$PIDS_FILE" ]; then
    echo "" >&2
    echo "Deteniendo procesos..." >&2
    xargs kill < "$PIDS_FILE" 2>/dev/null || true
    rm -f "$PIDS_FILE"
  fi
}
trap cleanup EXIT

# ── 1. Migraciones D1 local ──────────────────────────────────────
echo ""
echo "--- Corriendo migraciones D1 local ---"

# 000_initial.sql usa CREATE TABLE IF NOT EXISTS — idempotente
npx wrangler d1 execute DB --local \
  --persist-to "$PERSIST_DIR" \
  --file=migrations_v2/000_initial.sql \
  --config packages/api-auth/wrangler.jsonc

# 001 y 002 usan ALTER TABLE ADD COLUMN — fallan si la columna ya existe.
# Toleramos el error para que re-ejecutar el script no rompa.
run_alter_migration() {
  local file=$1
  npx wrangler d1 execute DB --local \
    --persist-to "$PERSIST_DIR" \
    --file="$file" \
    --config packages/api-auth/wrangler.jsonc 2>&1 | tee /tmp/migration.log || true
  if grep -qi "duplicate column name" /tmp/migration.log; then
    echo "  (columna ya existía — ignorado)"
  fi
}

run_alter_migration migrations_v2/001_appraisals_extra_cols.sql
run_alter_migration migrations_v2/002_org_brand_accent_color.sql

echo "✓ Migraciones aplicadas"

# ── 2. Levantar 8 Workers en background ─────────────────────────
echo ""
echo "--- Levantando Workers ---"
> "$PIDS_FILE"

start_worker() {
  local name=$1
  local port=$2
  local config=$3
  npx wrangler dev --port "$port" \
    --config "$config" \
    --persist-to "$PERSIST_DIR" \
    --inspector-port $((port + 1000)) \
    > "$BACKEND_DIR/logs/${name}.log" 2>&1 &
  echo $! >> "$PIDS_FILE"
  echo "  ↑ $name  →  http://localhost:$port  (PID $!)"
}

mkdir -p "$BACKEND_DIR/logs"

start_worker api-auth         8787 packages/api-auth/wrangler.jsonc
start_worker api-crm          8788 packages/api-crm/wrangler.jsonc
start_worker api-properties   8789 packages/api-properties/wrangler.jsonc
start_worker api-transactions 8790 packages/api-transactions/wrangler.jsonc
start_worker api-analytics    8791 packages/api-analytics/wrangler.jsonc
start_worker api-ai           8792 packages/api-ai/wrangler.jsonc
start_worker api-admin        8793 packages/api-admin/wrangler.jsonc
start_worker api-public       8794 packages/api-public/wrangler.jsonc

# ── 3. Health check ─────────────────────────────────────────────
echo ""
echo "--- Esperando que los Workers estén listos ---"

wait_for_port() {
  local port=$1
  local name=$2
  local retries=40
  local i=0
  while [ $i -lt $retries ]; do
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/" 2>/dev/null || echo "000")
    if [ "$code" != "000" ]; then
      echo "  ✓ $name ($port)"
      return 0
    fi
    i=$((i+1))
    sleep 1
  done
  echo "  ✗ Timeout en $name ($port) — ver logs/$name.log" >&2
  return 1
}

wait_for_port 8787 api-auth
wait_for_port 8788 api-crm
wait_for_port 8789 api-properties
wait_for_port 8790 api-transactions
wait_for_port 8791 api-analytics
wait_for_port 8792 api-ai
wait_for_port 8793 api-admin
wait_for_port 8794 api-public

# ── 4. Generar .env.local ────────────────────────────────────────
echo ""
echo "--- Generando vendepro-frontend/.env.local ---"
cat > "$FRONTEND_DIR/.env.local" << 'ENVEOF'
NEXT_PUBLIC_API_AUTH_URL=http://localhost:8787
NEXT_PUBLIC_API_CRM_URL=http://localhost:8788
NEXT_PUBLIC_API_PROPERTIES_URL=http://localhost:8789
NEXT_PUBLIC_API_TRANSACTIONS_URL=http://localhost:8790
NEXT_PUBLIC_API_ANALYTICS_URL=http://localhost:8791
NEXT_PUBLIC_API_AI_URL=http://localhost:8792
NEXT_PUBLIC_API_ADMIN_URL=http://localhost:8793
NEXT_PUBLIC_API_PUBLIC_URL=http://localhost:8794
ENVEOF
echo "✓ .env.local generado"

# ── 5. Levantar frontend ─────────────────────────────────────────
echo ""
echo "--- Levantando frontend ---"
cd "$FRONTEND_DIR"
# Limpiar cache de Next.js para forzar recompilación fresca
rm -rf .next
echo "  ✓ Cache .next eliminado"
npx next dev --port 3000 > "$BACKEND_DIR/logs/frontend.log" 2>&1 &
echo $! >> "$PIDS_FILE"
echo "  ↑ frontend  →  http://localhost:3000  (PID $!)"

wait_for_port 3000 frontend

# Disable the cleanup trap — setup succeeded, don't kill processes on normal exit
trap - EXIT

echo ""
echo "=== Setup completo ==="
echo "Frontend:  http://localhost:3000"
echo "Para detener todo: bash $BACKEND_DIR/stop-local.sh"
echo "PIDs guardados en: $PIDS_FILE"
