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

# ── setup ────────────────────────────────────────────────────────────────────
cmd_setup() {
  info "Instalando dependencias del backend..."
  (cd "$BACKEND" && npm install)

  info "Instalando dependencias del frontend..."
  (cd "$FRONTEND" && npm install)

  info "Copiando .env.local..."
  if [ ! -f "$FRONTEND/.env.local" ]; then
    cp "$FRONTEND/.env.local.example" "$FRONTEND/.env.local"
    info "  → .env.local creado (APIs locales activas)"
  else
    warning "  → .env.local ya existe, no se sobreescribió"
  fi

  info "Aplicando migraciones D1 locales..."
  mkdir -p "$SHARED_STATE"
  (cd "$BACKEND" && npx wrangler d1 migrations apply vendepro-db --local \
    --persist-to "$SHARED_STATE" 2>&1 | tail -5)

  echo ""
  info "Setup completo. Corré ./dev.sh para iniciar el stack."
  echo ""
  warning "Si api-auth o api-ai fallan con errores de keys,"
  echo "   editá los archivos .dev.vars en cada paquete del backend:"
  echo "   vendepro-backend/packages/api-auth/.dev.vars   → EMBLUE_API_KEY"
  echo "   vendepro-backend/packages/api-ai/.dev.vars     → ANTHROPIC_API_KEY, GROQ_API_KEY"
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
  echo "  Ctrl+C para detener todo."

  wait
}

# ── main ──────────────────────────────────────────────────────────────────────
case "${1:-fullstack}" in
  setup)    cmd_setup ;;
  frontend) cmd_frontend ;;
  *)        cmd_fullstack ;;
esac
