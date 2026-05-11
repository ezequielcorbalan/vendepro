#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# VendéPro — Stack de desarrollo local
#
# USO:
#   ./dev.sh           → stack completo (8 APIs + frontend)
#   ./dev.sh frontend  → solo frontend contra APIs de producción
#   ./dev.sh setup     → primera vez: instala deps + aplica migraciones D1
# ─────────────────────────────────────────────────────────────────────────────

set -e

BACKEND="$(pwd)/vendepro-backend"
FRONTEND="$(pwd)/vendepro-frontend"
SHARED_STATE="$(pwd)/.wrangler-local-state"

# ── Colores ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}▶${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC}  $1"; }
error()   { echo -e "${RED}✗${NC} $1"; }

# ── migraciones D1 locales ───────────────────────────────────────────────────
# Aplica migraciones de todas las bases D1 contra el state compartido local.
# Se invoca tanto en `setup` como antes de levantar el fullstack.
apply_local_migrations() {
  mkdir -p "$SHARED_STATE"

  info "  → vendepro-db (migrations_v2)"
  (cd "$BACKEND" && npx wrangler d1 migrations apply vendepro-db --local \
    --persist-to "$SHARED_STATE" 2>&1 | tail -5) \
    || warning "    falló vendepro-db (revisar wrangler.jsonc raíz)"

  if [ -d "$BACKEND/packages/api-rentals/migrations" ]; then
    info "  → vendepro-rentals-db (api-rentals/migrations)"
    (cd "$BACKEND/packages/api-rentals" && \
      npx wrangler d1 migrations apply vendepro-rentals-db --local \
      --persist-to "$SHARED_STATE" 2>&1 | tail -5) \
      || warning "    falló vendepro-rentals-db (puede que el database_id aún sea placeholder)"
  fi
}

# ── .dev.vars guard ──────────────────────────────────────────────────────────
# Verifica que cada paquete del backend tenga su .dev.vars. Si falta uno se
# regenera con valores dev-only (mismo JWT_SECRET en todos, placeholders en el
# resto). Esto evita que un clon fresco o un `git clean` arruine el stack.
DEV_JWT_SECRET='dev-local-jwt-secret-do-not-use-in-production-0123456789abcdef'

write_dev_vars() {
  local pkg_dir="$1"
  local extra="$2"
  local target="$pkg_dir/.dev.vars"
  local pkg_name
  pkg_name="$(basename "$pkg_dir")"
  cat > "$target" <<EOF
# VendéPro — $pkg_name — Variables de desarrollo local
# ⚠️  SOLO PARA LOCAL. Producción usa Cloudflare Worker secrets.
# Regenerado automáticamente por dev.sh — overrides personales en .dev.vars.local.

JWT_SECRET=$DEV_JWT_SECRET
$extra
EOF
}

ensure_frontend_env() {
  local target="$FRONTEND/.env.local"
  local example="$FRONTEND/.env.local.example"
  if [ -f "$target" ]; then
    info "  → vendepro-frontend/.env.local presente"
    return 0
  fi
  if [ ! -f "$example" ]; then
    warning "  → falta $example (no puedo crear .env.local)"
    return 1
  fi
  cp "$example" "$target"
  info "  → vendepro-frontend/.env.local creado desde el .example (APIs locales)"
}

ensure_dev_vars() {
  local missing=0
  for pkg in api-auth api-crm api-properties api-transactions api-analytics api-ai api-admin api-public api-rentals; do
    local pkg_dir="$BACKEND/packages/$pkg"
    [ -d "$pkg_dir" ] || continue
    if [ ! -f "$pkg_dir/.dev.vars" ]; then
      missing=1
      info "  → creando .dev.vars en $pkg"
      case "$pkg" in
        api-auth)
          write_dev_vars "$pkg_dir" $'EMBLUE_API_KEY=dev-placeholder-emblue-key' ;;
        api-ai)
          write_dev_vars "$pkg_dir" $'ANTHROPIC_API_KEY=dev-placeholder-anthropic-key\nGROQ_API_KEY=dev-placeholder-groq-key' ;;
        api-properties)
          write_dev_vars "$pkg_dir" $'R2_PUBLIC_URL=http://localhost:8703/r2-local' ;;
        *)
          write_dev_vars "$pkg_dir" "" ;;
      esac
    fi
  done
  if [ "$missing" -eq 0 ]; then
    info "  → todos los .dev.vars presentes"
  fi
}

# ── seed de desarrollo ───────────────────────────────────────────────────────
# Inserta el usuario dev@dev.com (admin) y 4 propiedades de muestra en la base
# local. NUNCA se ejecuta contra producción — usa wrangler d1 execute --local.
# El SQL es idempotente (INSERT OR IGNORE), así que correrlo varias veces es OK.
apply_dev_seed() {
  local seed_file="$BACKEND/seeds/dev_seed.sql"
  if [ ! -f "$seed_file" ]; then
    warning "  → seed no encontrado: $seed_file (omitiendo)"
    return 0
  fi
  info "  → dev_seed.sql (usuario dev@dev.com + 4 properties)"
  (cd "$BACKEND" && npx wrangler d1 execute vendepro-db --local \
    --persist-to "$SHARED_STATE" \
    --file "$seed_file" 2>&1 | tail -5) \
    || warning "    falló el seed local (revisar seeds/dev_seed.sql)"
}

# ── setup ────────────────────────────────────────────────────────────────────
cmd_setup() {
  info "Instalando dependencias del backend..."
  (cd "$BACKEND" && npm install)

  info "Instalando dependencias del frontend..."
  (cd "$FRONTEND" && npm install)

  info "Verificando .env.local del frontend..."
  ensure_frontend_env

  info "Verificando .dev.vars del backend..."
  ensure_dev_vars

  info "Aplicando migraciones D1 locales..."
  apply_local_migrations

  info "Aplicando seed de desarrollo..."
  apply_dev_seed

  echo ""
  info "Setup completo. Corré ./dev.sh para iniciar el stack."
  echo ""
  info "Login local:  dev@dev.com  /  123456"
  echo ""
  warning "Las keys externas (EMBLUE, ANTHROPIC, GROQ) están como placeholders."
  echo "   Si necesitás probar flujos que las usan, ponelas en .dev.vars.local"
  echo "   en el paquete correspondiente (queda fuera de git)."
}

# ── frontend only ─────────────────────────────────────────────────────────────
cmd_frontend() {
  info "Iniciando frontend contra APIs de producción..."
  warning "Asegurate de que vendepro-frontend/.env.local tenga las URLs de prod activas."
  echo ""
  (cd "$FRONTEND" && npm run dev)
}

# ── full stack ────────────────────────────────────────────────────────────────
cmd_fullstack() {
  info "Iniciando stack completo local..."
  echo ""

  # Asegurar que las deps existan antes de arrancar workers/frontend
  if [ ! -d "$BACKEND/node_modules" ]; then
    info "Instalando dependencias del backend (primera vez)..."
    (cd "$BACKEND" && npm install)
  fi
  if [ ! -d "$FRONTEND/node_modules" ]; then
    info "Instalando dependencias del frontend (primera vez)..."
    (cd "$FRONTEND" && npm install)
  fi

  # Verificar/crear .dev.vars de cada paquete (JWT_SECRET compartido)
  info "Verificando .dev.vars del backend..."
  ensure_dev_vars

  # Verificar/crear vendepro-frontend/.env.local (apunta a localhost:8701-8708)
  info "Verificando .env.local del frontend..."
  ensure_frontend_env

  # Aplicar migraciones D1 locales antes de levantar los workers
  info "Aplicando migraciones D1 locales..."
  apply_local_migrations

  # Seed de desarrollo (idempotente — solo local)
  info "Aplicando seed de desarrollo..."
  apply_dev_seed
  echo ""

  # Trap para matar todos los hijos al salir
  trap 'info "Deteniendo servicios..."; kill $(jobs -p) 2>/dev/null; exit 0' INT TERM EXIT

  APIS=(
    "api-auth:8701"
    "api-crm:8702"
    "api-properties:8703"
    "api-transactions:8704"
    "api-analytics:8705"
    "api-ai:8706"
    "api-admin:8707"
    "api-public:8708"
  )

  for entry in "${APIS[@]}"; do
    pkg="${entry%%:*}"
    port="${entry##*:}"
    info "  → $pkg en :$port"
    (cd "$BACKEND/packages/$pkg" && \
      npx wrangler dev --port "$port" \
        --persist-to "$SHARED_STATE" \
        2>&1 | sed "s/^/[$pkg] /") &
  done

  # Esperar a que los workers arranquen
  sleep 4

  info "  → frontend en :3000"
  (cd "$FRONTEND" && npm run dev 2>&1) &

  echo ""
  info "Stack levantado:"
  echo "  Frontend  →  http://localhost:3000"
  echo "  api-auth  →  http://localhost:8701"
  echo "  api-crm   →  http://localhost:8702"
  echo "  ...y el resto en :8703–:8708"
  echo ""
  echo "  Login local:  dev@dev.com  /  123456"
  echo ""
  echo "  Ctrl+C para detener todo."

  wait
}

# ── main ──────────────────────────────────────────────────────────────────────
case "${1:-fullstack}" in
  setup)    cmd_setup ;;
  frontend) cmd_frontend ;;
  *)        cmd_fullstack ;;
esac
