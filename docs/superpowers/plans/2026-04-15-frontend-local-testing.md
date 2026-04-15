# Frontend Local Testing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levantar frontend + 8 backends localmente con D1 local y ejecutar testing completo E2E via Chrome automation cubriendo todas las pantallas del CRM con verificación de responsivo.

**Architecture:** Un script bash levanta los 8 Workers (wrangler dev, puertos 8787–8794) desde `vendepro-backend/` compartiendo la misma D1 local, genera `.env.local` para el frontend, un script Node.js siembra admin + agente, y luego Claude ejecuta el testing completo via `mcp__claude-in-chrome__`.

**Tech Stack:** Next.js 15, Cloudflare Workers (Hono), D1 SQLite local, wrangler v3, mcp__claude-in-chrome__ browser automation

---

## Archivos a crear / modificar

| Acción | Archivo |
|--------|---------|
| Crear | `vendepro-backend/start-local.sh` |
| Crear | `vendepro-backend/stop-local.sh` |
| Crear | `vendepro-backend/seed-local.js` |
| Generar (por script) | `vendepro-frontend/.env.local` |

---

## Task 1: Crear `start-local.sh`

**Files:**
- Create: `vendepro-backend/start-local.sh`

- [ ] **Step 1: Escribir el script**

Crear `vendepro-backend/start-local.sh` con el siguiente contenido exacto:

```bash
#!/usr/bin/env bash
set -e

BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$BACKEND_DIR/../vendepro-frontend"
PIDS_FILE="$BACKEND_DIR/.local-pids"

echo "=== VendéPro — Local Dev Setup ==="
cd "$BACKEND_DIR"

# ── 1. Migraciones D1 local ──────────────────────────────────────
echo ""
echo "--- Corriendo migraciones D1 local ---"
npx wrangler d1 execute DB --local \
  --file=migrations_v2/000_initial.sql \
  --config packages/api-auth/wrangler.jsonc

npx wrangler d1 execute DB --local \
  --file=migrations/001_add_inactive_and_sale_data.sql \
  --config packages/api-auth/wrangler.jsonc

npx wrangler d1 execute DB --local \
  --file=migrations/002_price_history.sql \
  --config packages/api-auth/wrangler.jsonc

npx wrangler d1 execute DB --local \
  --file=migrations/003_organizations_appraisals_comparables.sql \
  --config packages/api-auth/wrangler.jsonc

npx wrangler d1 execute DB --local \
  --file=migrations/004_tasacion_template_blocks.sql \
  --config packages/api-auth/wrangler.jsonc

npx wrangler d1 execute DB --local \
  --file=migrations/005_lead_tags_and_archive.sql \
  --config packages/api-auth/wrangler.jsonc

npx wrangler d1 execute DB --local \
  --file=migrations/006_ficha_tasacion.sql \
  --config packages/api-auth/wrangler.jsonc

npx wrangler d1 execute DB --local \
  --file=migrations/007_prefactibilidades.sql \
  --config packages/api-auth/wrangler.jsonc

npx wrangler d1 execute DB --local \
  --file=migrations/008_register_org_indexes.sql \
  --config packages/api-auth/wrangler.jsonc

npx wrangler d1 execute DB --local \
  --file=migrations_v2/001_appraisals_extra_cols.sql \
  --config packages/api-auth/wrangler.jsonc

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
npx next dev --port 3000 > "$BACKEND_DIR/logs/frontend.log" 2>&1 &
echo $! >> "$PIDS_FILE"
echo "  ↑ frontend  →  http://localhost:3000  (PID $!)"

wait_for_port 3000 frontend

echo ""
echo "=== Setup completo ==="
echo "Frontend:  http://localhost:3000"
echo "Para detener todo: bash $BACKEND_DIR/stop-local.sh"
echo "PIDs guardados en: $PIDS_FILE"
```

- [ ] **Step 2: Dar permisos de ejecución**

```bash
cd C:/proyectos/vendepro/vendepro-backend
chmod +x start-local.sh
```

- [ ] **Step 3: Commit**

```bash
cd C:/proyectos/vendepro
git add vendepro-backend/start-local.sh
git commit -m "feat(local): script start-local.sh para levantar 8 workers + frontend"
```

---

## Task 2: Crear `stop-local.sh`

**Files:**
- Create: `vendepro-backend/stop-local.sh`

- [ ] **Step 1: Escribir el script**

Crear `vendepro-backend/stop-local.sh`:

```bash
#!/usr/bin/env bash
BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDS_FILE="$BACKEND_DIR/.local-pids"

if [ ! -f "$PIDS_FILE" ]; then
  echo "No hay procesos locales registrados (.local-pids no encontrado)"
  exit 0
fi

echo "Deteniendo procesos locales..."
while IFS= read -r pid; do
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    echo "  ✓ PID $pid detenido"
  fi
done < "$PIDS_FILE"

rm -f "$PIDS_FILE"
echo "Listo."
```

- [ ] **Step 2: Permisos + commit**

```bash
cd C:/proyectos/vendepro/vendepro-backend
chmod +x stop-local.sh
cd ..
git add vendepro-backend/stop-local.sh
git commit -m "feat(local): script stop-local.sh para detener workers"
```

---

## Task 3: Crear `seed-local.js`

**Files:**
- Create: `vendepro-backend/seed-local.js`

- [ ] **Step 1: Escribir el script**

Crear `vendepro-backend/seed-local.js`:

```javascript
// seed-local.js — Crea org + admin + agente en D1 local
const BASE_AUTH  = 'http://localhost:8787'
const BASE_ADMIN = 'http://localhost:8793'

async function seed() {
  console.log('=== VendéPro Seed Local ===\n')

  // ── 1. Crear organización + admin ──────────────────────────────
  console.log('1. Creando organización y usuario admin...')
  const orgRes = await fetch(`${BASE_AUTH}/register-org`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      org_name:    'Inmobiliaria Test',
      org_slug:    'test-local',
      admin_name:  'Admin Test',
      email:       'admin@test.com',
      password:    'Admin1234!',
      brand_color: '#ff007c',
    }),
  })

  if (!orgRes.ok) {
    const err = await orgRes.text()
    // Si ya existe, no es error crítico
    if (orgRes.status === 409) {
      console.log('   ↳ Org ya existente, continuando...')
    } else {
      console.error('   ✗ Error al crear org:', err)
      process.exit(1)
    }
  } else {
    const orgData = await orgRes.json()
    console.log('   ✓ Org ID:', orgData.org?.id ?? orgData.user?.org_id ?? '(ver respuesta)')
  }

  // ── 2. Login como admin para obtener token ─────────────────────
  console.log('2. Obteniendo token de admin...')
  const loginRes = await fetch(`${BASE_AUTH}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: 'Admin1234!' }),
  })

  if (!loginRes.ok) {
    console.error('   ✗ Login fallido:', await loginRes.text())
    process.exit(1)
  }

  const loginData = await loginRes.json()
  const token = loginData.token
  console.log('   ✓ Token obtenido')

  // ── 3. Crear agente ────────────────────────────────────────────
  console.log('3. Creando usuario agente...')
  const agentRes = await fetch(`${BASE_ADMIN}/create-agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      email:    'agente@test.com',
      password: 'Agente1234!',
      name:     'Agente Test',
      phone:    '+54 11 9999-8888',
      role:     'agent',
    }),
  })

  if (!agentRes.ok) {
    const err = await agentRes.text()
    if (agentRes.status === 409) {
      console.log('   ↳ Agente ya existente, continuando...')
    } else {
      console.error('   ✗ Error al crear agente:', err)
      process.exit(1)
    }
  } else {
    const agentData = await agentRes.json()
    console.log('   ✓ Agente ID:', agentData.id ?? '(ver respuesta)')
  }

  console.log('\n=== Seed completo ===')
  console.log('Admin:  admin@test.com  /  Admin1234!')
  console.log('Agente: agente@test.com /  Agente1234!')
  console.log('URL frontend: http://localhost:3000')
}

seed().catch((e) => {
  console.error('Error inesperado:', e)
  process.exit(1)
})
```

- [ ] **Step 2: Commit**

```bash
cd C:/proyectos/vendepro
git add vendepro-backend/seed-local.js
git commit -m "feat(local): script seed-local.js para crear org + admin + agente"
```

---

## Task 4: Ejecutar setup y verificar servicios

- [ ] **Step 1: Limpiar estado previo (si existe)**

```bash
cd C:/proyectos/vendepro/vendepro-backend
# Borrar D1 local previo si existe
rm -rf .wrangler/state/v3/d1/
# Borrar .env.local previo
rm -f ../vendepro-frontend/.env.local
```

- [ ] **Step 2: Ejecutar start-local.sh**

```bash
cd C:/proyectos/vendepro/vendepro-backend
bash start-local.sh
```

Salida esperada (extracto):
```
=== VendéPro — Local Dev Setup ===
--- Corriendo migraciones D1 local ---
✓ Migraciones aplicadas
--- Levantando Workers ---
  ↑ api-auth         →  http://localhost:8787
  ↑ api-crm          →  http://localhost:8788
  ...
--- Esperando que los Workers estén listos ---
  ✓ api-auth (8787)
  ✓ api-crm (8788)
  ...
  ✓ frontend (3000)
=== Setup completo ===
```

Si algún worker da timeout, revisar `vendepro-backend/logs/<nombre>.log`.

- [ ] **Step 3: Ejecutar seed**

```bash
cd C:/proyectos/vendepro/vendepro-backend
node seed-local.js
```

Salida esperada:
```
=== VendéPro Seed Local ===
1. Creando organización y usuario admin...
   ✓ Org ID: <id generado>
2. Obteniendo token de admin...
   ✓ Token obtenido
3. Creando usuario agente...
   ✓ Agente ID: <id generado>

=== Seed completo ===
Admin:  admin@test.com  /  Admin1234!
Agente: agente@test.com /  Agente1234!
```

- [ ] **Step 4: Verificar que el frontend carga en Chrome**

Cargar la herramienta de Chrome:
```
ToolSearch: select:mcp__claude-in-chrome__tabs_context_mcp
ToolSearch: select:mcp__claude-in-chrome__navigate
ToolSearch: select:mcp__claude-in-chrome__read_console_messages
ToolSearch: select:mcp__claude-in-chrome__resize_window
ToolSearch: select:mcp__claude-in-chrome__get_page_text
ToolSearch: select:mcp__claude-in-chrome__find
ToolSearch: select:mcp__claude-in-chrome__form_input
ToolSearch: select:mcp__claude-in-chrome__gif_creator
```

Crear nueva pestaña y navegar a `http://localhost:3000`. Debe redirigir a `/login`.
Verificar que NO hay errores de consola tipo `Failed to fetch` ni `ERR_CONNECTION_REFUSED`.

---

## Task 5: Testear Bloque 0 — Auth

**Pantallas:** `/login`, `/register`

- [ ] **Step 1: Test `/login` desktop (1280×800)**

```
resize_window: 1280 × 800
navigate: http://localhost:3000/login
```

Verificar:
- Título "Iniciar sesión" o equivalente visible
- Campo email y campo contraseña presentes
- Botón "Ingresar" / "Login" presente
- Sin errores de consola
- Colores de marca (#ff007c / #ff8017) aplicados

- [ ] **Step 2: Test `/login` mobile (375×812)**

```
resize_window: 375 × 812
```

Verificar:
- Formulario ocupa el ancho completo sin overflow horizontal
- Botón tiene al menos 44px de alto (verificar visualmente)
- Sin scroll horizontal

- [ ] **Step 3: Login como admin**

```
resize_window: 1280 × 800
navigate: http://localhost:3000/login
form_input: campo email → "admin@test.com"
form_input: campo password → "Admin1234!"
find + click: botón de submit
```

Esperar navegación. Debe llegar a `/dashboard`. Verificar:
- URL cambia a `/dashboard`
- Dashboard vacío visible (empty states, no errores 500)
- Sin errores de consola JavaScript

- [ ] **Step 4: Test `/register` desktop**

```
navigate: http://localhost:3000/register
resize_window: 1280 × 800
```

Verificar:
- Wizard de 3 pasos visible (paso 1: datos de la org)
- Campos: nombre de la inmobiliaria, slug
- Sin errores de consola

- [ ] **Step 5: Test `/register` mobile**

```
resize_window: 375 × 812
```

Verificar:
- Pasos del wizard visibles y navegables en mobile
- Sin overflow horizontal
- Botones accesibles

---

## Task 6: Testear Bloque 1 — Dashboard

**Pantallas:** `/dashboard`, `/dashboard/mi-performance`

- [ ] **Step 1: Test `/dashboard` desktop — empty state**

```
resize_window: 1280 × 800
navigate: http://localhost:3000/dashboard
```

Verificar:
- KPI cards visibles (con 0 o "—" como valores)
- Funnel de conversión renderiza (aunque vacío)
- Charts de Recharts renderizan sin errores
- Sin errores de consola

- [ ] **Step 2: Test `/dashboard` mobile**

```
resize_window: 375 × 812
```

Verificar:
- Sidebar oculto, MobileHeader visible con ícono hamburguesa
- KPI cards apiladas verticalmente (grid 1 columna)
- Sin scroll horizontal

- [ ] **Step 3: Test `/dashboard/mi-performance` desktop**

```
resize_window: 1280 × 800
navigate: http://localhost:3000/dashboard/mi-performance
```

Verificar:
- Página carga sin 404 ni error 500
- Métricas personales visibles (vacías pero sin crash)
- Sin errores de consola

- [ ] **Step 4: Test `/mi-performance` (ruta alternativa)**

```
navigate: http://localhost:3000/mi-performance
```

Verificar que carga correctamente (misma página o redirige).

---

## Task 7: Testear Bloque 2 — Leads

**Pantallas:** `/leads`, `/leads/[id]`

- [ ] **Step 1: Test `/leads` desktop — empty state**

```
resize_window: 1280 × 800
navigate: http://localhost:3000/leads
```

Verificar:
- Empty state con mensaje descriptivo ("No hay leads" o similar)
- Botón "Nuevo lead" / "+" visible
- Sin errores de consola

- [ ] **Step 2: Test `/leads` mobile**

```
resize_window: 375 × 812
```

Verificar:
- Vista lista (no tabla/kanban)
- Filtros no inline (en drawer o no visibles por defecto)
- Botón de nuevo lead accesible

- [ ] **Step 3: Crear primer lead**

```
resize_window: 1280 × 800
navigate: http://localhost:3000/leads
find + click: botón "Nuevo lead" o "+"
```

Completar el formulario de creación:
- Nombre: "Juan Pérez"
- Tipo/interés: "comprador" (o equivalente)
- Fuente: "web" / "sitio web"
- Teléfono: "+54 11 5555-1234"
- Email: "juan.perez@example.com"
- Observaciones: "Interesado en 3 ambientes zona Palermo"

Submittear. Verificar:
- Toast de éxito aparece
- Lead aparece en la lista

- [ ] **Step 4: Test `/leads/[id]` desktop**

```
find + click: lead "Juan Pérez" en la lista
```

Verificar:
- Detalle del lead carga correctamente
- Información visible: nombre, etapa, teléfono, email, fuente
- Timeline de actividad visible (vacío)
- Botones de acción: cambiar etapa, asignar agente, nueva actividad
- Sin errores de consola

- [ ] **Step 5: Cambiar etapa del lead**

En `/leads/[id]`, cambiar etapa de "nuevo" a "contactado":
- Encontrar el selector de etapa / botón de avanzar etapa
- Hacer clic para avanzar a "contactado"
- Verificar que la etapa cambió en la UI

- [ ] **Step 6: Asignar al agente**

En `/leads/[id]`, asignar lead a "Agente Test":
- Buscar selector "Agente asignado"
- Seleccionar "Agente Test"
- Verificar que se guardó

- [ ] **Step 7: Test `/leads/[id]` mobile**

```
resize_window: 375 × 812
```

Verificar:
- Información del lead visible en cards
- Botones de acción accesibles (min 44px)
- Sin overflow horizontal

---

## Task 8: Testear Bloque 3 — Contactos

**Pantallas:** `/contactos`

- [ ] **Step 1: Test `/contactos` desktop**

```
resize_window: 1280 × 800
navigate: http://localhost:3000/contactos
```

Verificar:
- Lista de contactos (puede incluir "Juan Pérez" si la conversión es automática)
- O empty state si la conversión es manual
- Sin errores de consola

- [ ] **Step 2: Crear contacto (si no se creó desde lead)**

Si la lista está vacía, buscar botón "Nuevo contacto" y crear:
- Nombre: "María García"
- Email: "maria.garcia@example.com"
- Teléfono: "+54 11 4444-5678"
- Tipo: "propietario"

- [ ] **Step 3: Test `/contactos` mobile**

```
resize_window: 375 × 812
```

Verificar:
- Cards apiladas
- Sin scroll horizontal
- Acciones visibles

---

## Task 9: Testear Bloque 4 — Tasaciones

**Pantallas:** `/tasaciones`, `/tasaciones/nueva`, `/tasaciones/[id]`, `/tasaciones/[id]/editar`

- [ ] **Step 1: Test `/tasaciones` desktop — empty state**

```
resize_window: 1280 × 800
navigate: http://localhost:3000/tasaciones
```

Verificar empty state, botón "Nueva tasación".

- [ ] **Step 2: Crear tasación**

```
find + click: "Nueva tasación"
navigate o verificar: http://localhost:3000/tasaciones/nueva
```

Completar formulario:
- Dirección: "Av. Santa Fe 1234, Palermo, CABA"
- Propietario: "Juan Pérez" (buscar en el selector)
- Tipo: "Departamento"
- Superficie cubierta: "75"
- Ambientes: "3"

Guardar. Verificar toast de éxito y redirección al detalle.

- [ ] **Step 3: Test `/tasaciones/[id]` desktop**

Verificar en el detalle:
- Datos de la tasación cargados
- Secciones de la ficha visibles
- Botones: "Editar", avanzar etapa
- Sin errores de consola

- [ ] **Step 4: Avanzar etapa de la tasación**

Avanzar la tasación hasta "presentada":
- Buscar selector de etapa
- Avanzar por las etapas disponibles hasta llegar a "presentada"
- Verificar que cada cambio se refleja en la UI

- [ ] **Step 5: Test `/tasaciones/[id]/editar`**

```
find + click: botón "Editar"
```

Verificar:
- Formulario de edición carga con los datos actuales
- Modificar observaciones: "Tasación presentada al propietario. Precio sugerido $120,000 USD"
- Guardar
- Verificar que los cambios se reflejan en el detalle

- [ ] **Step 6: Test tasaciones mobile**

```
resize_window: 375 × 812
navigate: http://localhost:3000/tasaciones
```

Verificar cards, sin overflow horizontal. Abrir detalle en mobile.

---

## Task 10: Testear Bloque 5 — Propiedades

**Pantallas:** `/propiedades`, `/propiedades/nueva`, `/propiedades/[id]`, `/propiedades/[id]/reportes/nuevo`, `/propiedades/pipeline`

- [ ] **Step 1: Test `/propiedades` desktop — empty state**

```
resize_window: 1280 × 800
navigate: http://localhost:3000/propiedades
```

Verificar empty state, botón "Nueva propiedad".

- [ ] **Step 2: Crear propiedad**

```
find + click: "Nueva propiedad"
```

Completar formulario:
- Dirección: "Av. Santa Fe 1234, Palermo, CABA"
- Tipo: "Departamento"
- Operación: "Venta"
- Precio: "120000" (USD)
- Superficie: "75"
- Ambientes: "3"
- Descripción: "Hermoso departamento a estrenar en Palermo. Luminoso, piso 8, con balcón."
- Propietario: "Juan Pérez"

Guardar. Verificar redirección a `/propiedades/[id]`.

- [ ] **Step 3: Test `/propiedades/[id]` desktop**

Verificar:
- Datos de la propiedad visibles
- Galería de imágenes (vacía, con opción de subir)
- Secciones: descripción, características, propietario, pipeline
- Botones: "Editar", avanzar pipeline
- Sin errores de consola

- [ ] **Step 4: Test `/propiedades/[id]/reportes/nuevo`**

```
find + click: botón "Generar reporte" o "Nuevo reporte"
navigate o verificar: http://localhost:3000/propiedades/[id]/reportes/nuevo
```

Verificar:
- Formulario de generación de reporte visible
- Generar el reporte
- Obtener slug del reporte generado (guardar para Task 14)

- [ ] **Step 5: Test `/propiedades/pipeline` desktop**

```
navigate: http://localhost:3000/propiedades/pipeline
resize_window: 1280 × 800
```

Verificar:
- Kanban con columnas de etapas visible
- La propiedad creada aparece en su columna
- Sin errores de consola

- [ ] **Step 6: Test `/propiedades/pipeline` mobile**

```
resize_window: 375 × 812
```

Verificar:
- Vista lista vertical (no kanban con scroll horizontal)
- Propiedades listadas por etapa

- [ ] **Step 7: Avanzar propiedad a "publicada"**

Desde `/propiedades/pipeline` o `/propiedades/[id]`, avanzar la propiedad hasta el estado "publicada":
- Buscar botón de avanzar estado / selector de pipeline
- Avanzar hasta "publicada"
- Verificar que se refleja en el kanban

---

## Task 11: Testear Bloque 6 — Transacciones

**Pantallas:** `/reservas`, `/vendidas`

- [ ] **Step 1: Test `/reservas` desktop — empty state**

```
resize_window: 1280 × 800
navigate: http://localhost:3000/reservas
```

Verificar empty state, botón "Nueva reserva".

- [ ] **Step 2: Crear reserva**

```
find + click: "Nueva reserva"
```

Completar formulario:
- Propiedad: seleccionar "Av. Santa Fe 1234" (la creada en Task 10)
- Comprador: "Juan Pérez"
- Monto de reserva: "5000"
- Fecha: hoy
- Observaciones: "Reserva aceptada, pendiente escritura"

Guardar. Verificar que aparece en la lista.

- [ ] **Step 3: Completar reserva → Vendida**

En el detalle de la reserva:
- Buscar botón "Completar" / "Marcar como vendida"
- Confirmar la acción
- Verificar que la propiedad pasa a "vendida"

- [ ] **Step 4: Test `/vendidas` desktop**

```
navigate: http://localhost:3000/vendidas
```

Verificar:
- La propiedad "Av. Santa Fe 1234" aparece en vendidas
- Datos de la venta visibles (fecha, precio, comprador)

- [ ] **Step 5: Test mobile ambas pantallas**

```
resize_window: 375 × 812
navigate: http://localhost:3000/reservas
```
Verificar cards, sin overflow.
```
navigate: http://localhost:3000/vendidas
```
Verificar idem.

---

## Task 12: Testear Bloque 7 — Actividades & Calendario

**Pantallas:** `/actividades`, `/calendario`

- [ ] **Step 1: Test `/actividades` desktop**

```
resize_window: 1280 × 800
navigate: http://localhost:3000/actividades
```

Verificar:
- Feed de actividades visible (con las acciones registradas durante el testing)
- Filtros de tipo / fecha disponibles
- Sin errores de consola

- [ ] **Step 2: Test `/actividades` mobile**

```
resize_window: 375 × 812
```

Verificar cards de actividad, sin overflow.

- [ ] **Step 3: Test `/calendario` desktop — vista semana**

```
resize_window: 1280 × 800
navigate: http://localhost:3000/calendario
```

Verificar:
- Vista semana visible por defecto en desktop (7 columnas, franjas 08–20h)
- Botones de navegación: anterior/siguiente semana
- Botones de cambio de vista: mes / semana / día / agenda
- Sin errores de consola

- [ ] **Step 4: Test calendario — vista mes**

Hacer clic en botón "Mes". Verificar:
- Grid mensual con días del mes
- Sin overflow horizontal

- [ ] **Step 5: Test `/calendario` mobile — vista agenda**

```
resize_window: 375 × 812
```

Verificar:
- Vista agenda visible por defecto en mobile
- Sin scroll horizontal

---

## Task 13: Testear Bloque 8 — Prefactibilidades

**Pantallas:** `/prefactibilidades`, `/prefactibilidades/nueva`

- [ ] **Step 1: Test `/prefactibilidades` desktop — empty state**

```
resize_window: 1280 × 800
navigate: http://localhost:3000/prefactibilidades
```

Verificar empty state, botón "Nueva prefactibilidad".

- [ ] **Step 2: Crear prefactibilidad**

```
find + click: "Nueva prefactibilidad"
navigate o verificar: http://localhost:3000/prefactibilidades/nueva
```

El formulario tiene 5 pasos. Completar el mínimo para guardar:

**Paso 1 — Terreno:**
- Dirección: "Av. Córdoba 3500, CABA"
- Barrio: "Palermo"
- Superficie del lote: "500"
- Precio del lote: "350000"

**Paso 2 — Proyecto:**
- Nombre del proyecto: "Edificio Córdoba 3500"
- Superficie construible: "2500"
- Total de unidades: "20"

**Paso 3 — Economía:**
- Costo construcción/m²: "1200"
- Precio venta promedio/m²: "3000"
- Superficie total vendible: "2000"

**Paso 4 — Comparables:**
- Dejar la fila por defecto vacía o completar: Proyecto "Torre Palermo", precio/m² "3200"

**Paso 5 — Conclusión:**
- Resumen ejecutivo: "Proyecto viable en zona de alta demanda"
- Recomendación: "Proceder con estudio de suelo"

Guardar. Verificar toast de éxito y aparición en la lista.

- [ ] **Step 3: Test mobile**

```
resize_window: 375 × 812
navigate: http://localhost:3000/prefactibilidades
```

Verificar cards/lista sin overflow.

---

## Task 14: Testear Bloque 9 — Páginas públicas

**Pantallas:** `/r/[slug]`, `/t/[slug]`, `/v/[slug]`, `/p/[slug]`, `/terminos`

Para estas pantallas se necesitan los slugs generados durante el testing.
Obtenerlos con los siguientes comandos (ejecutar desde `vendepro-backend/`):

```bash
# Slug de la propiedad para /r/[slug]:
npx wrangler d1 execute DB --local \
  --command "SELECT public_slug FROM properties LIMIT 5" \
  --config packages/api-auth/wrangler.jsonc

# ID de la tasación para /t/[slug] (usa el ID como slug):
npx wrangler d1 execute DB --local \
  --command "SELECT id FROM appraisals LIMIT 5" \
  --config packages/api-auth/wrangler.jsonc

# Slug de prefactibilidad para /p/[slug]:
npx wrangler d1 execute DB --local \
  --command "SELECT public_slug FROM prefactibilidades WHERE public_slug IS NOT NULL LIMIT 5" \
  --config packages/api-auth/wrangler.jsonc
```

Nota: `/v/[slug]` (visit_forms) puede no tener datos si la tabla `visit_forms` no se creó en las migraciones actuales. Testar la URL y documentar el resultado (404 esperado si no hay datos).

- [ ] **Step 1: Test `/r/[slug]` — reporte público de propiedad**

```
resize_window: 1280 × 800
navigate: http://localhost:3000/r/<public_slug de la propiedad creada>
```

Verificar:
- Página pública carga sin requerir auth (no redirige a /login)
- Datos de la propiedad visibles: dirección, tipo, precio, descripción
- Sin errores de consola

Mobile:
```
resize_window: 375 × 812
```
Verificar layout responsive.

- [ ] **Step 2: Test `/terminos`**

```
resize_window: 1280 × 800
navigate: http://localhost:3000/terminos
```

Verificar que carga el contenido de términos sin auth.

```
resize_window: 375 × 812
```
Verificar responsive.

- [ ] **Step 3: Test `/t/[slug]` — tasación pública**

```
resize_window: 1280 × 800
navigate: http://localhost:3000/t/<id de la tasación>
```

Verificar:
- Página carga sin auth
- Ficha de tasación visible con los datos cargados
- Sin errores de consola

- [ ] **Step 4: Test `/p/[slug]` — prefactibilidad pública**

```
resize_window: 1280 × 800
navigate: http://localhost:3000/p/<public_slug de la prefactibilidad>
```

Si `public_slug` es NULL (la prefactibilidad no generó slug al guardarse), navegar directamente y documentar el resultado.

Verificar:
- Página carga sin auth
- Datos de la prefactibilidad visibles

- [ ] **Step 5: Test `/v/[slug]` — formulario de visita**

```
navigate: http://localhost:3000/v/test-slug
```

Documentar si retorna 404 (tabla `visit_forms` puede no estar en el schema actual). Si retorna 404, anotar como "funcionalidad pendiente de implementación".

---

## Task 15: Testear Bloque 10 — Perfil & Configuración

**Pantallas:** `/perfil`, `/perfil/objetivos`, `/perfil/tasaciones`, `/configuracion`, `/configuracion/objetivos`, `/configuracion/tasacion`

- [ ] **Step 1: Test `/perfil` desktop**

```
resize_window: 1280 × 800
navigate: http://localhost:3000/perfil
```

Verificar:
- Datos del admin visibles: nombre, email, rol
- Formulario de edición disponible
- Sin errores de consola

- [ ] **Step 2: Test `/perfil/objetivos` y `/perfil/tasaciones`**

```
navigate: http://localhost:3000/perfil/objetivos
```
Verificar que carga (empty state si no hay objetivos).

```
navigate: http://localhost:3000/perfil/tasaciones
```
Verificar que carga configuración de tasaciones.

- [ ] **Step 3: Test `/configuracion` desktop**

```
navigate: http://localhost:3000/configuracion
```

Verificar:
- Nombre de la org visible: "Inmobiliaria Test"
- Campo slug editable: "test-local"
- Sin errores de consola

- [ ] **Step 4: Test `/configuracion/objetivos` y `/configuracion/tasacion`**

```
navigate: http://localhost:3000/configuracion/objetivos
```
Verificar carga correcta.

```
navigate: http://localhost:3000/configuracion/tasacion
```
Verificar carga de configuración de tasaciones de la org.

- [ ] **Step 5: Test Perfil & Config mobile**

```
resize_window: 375 × 812
```

Navegar por cada pantalla de este bloque y verificar sin overflow.

---

## Task 16: Testear Bloque 11 — Admin

**Pantallas:** `/admin/agentes`, `/admin/agentes/nuevo`, `/admin/auditoria`, `/admin/objetivos`
*(Solo disponible con rol admin — ya estás logueado como admin)*

- [ ] **Step 1: Test `/admin/agentes` desktop**

```
resize_window: 1280 × 800
navigate: http://localhost:3000/admin/agentes
```

Verificar:
- Lista de agentes con "Agente Test" visible
- Botón "Nuevo agente"
- Sin errores de consola

- [ ] **Step 2: Test `/admin/agentes/nuevo`**

```
navigate: http://localhost:3000/admin/agentes/nuevo
```

Completar formulario:
- Nombre: "Segundo Agente"
- Email: "segundo@test.com"
- Contraseña: "Segundo1234!"
- Teléfono: "+54 11 7777-6666"

Guardar. Verificar que aparece en la lista.

- [ ] **Step 3: Test `/admin/auditoria` desktop**

```
navigate: http://localhost:3000/admin/auditoria
```

Verificar:
- Log de auditoría con las acciones realizadas durante el testing
- Filtros disponibles
- Sin errores de consola

- [ ] **Step 4: Test `/admin/objetivos` desktop**

```
navigate: http://localhost:3000/admin/objetivos
```

Verificar carga correcta (empty state o formulario de objetivos).

- [ ] **Step 5: Test Admin mobile**

```
resize_window: 375 × 812
navigate: http://localhost:3000/admin/agentes
```

Verificar cards/tabla responsive.

---

## Task 17: Flujo E2E Golden Path + GIF

- [ ] **Step 1: Iniciar grabación GIF**

```
ToolSearch: select:mcp__claude-in-chrome__gif_creator
gif_creator start: nombre "vendepro-e2e-golden-path.gif"
```

- [ ] **Step 2: Ejecutar el golden path completo**

Ejecutar en orden, con resize_window: 1280 × 800 como tamaño base:

```
1.  navigate: http://localhost:3000/login
    → login como admin@test.com / Admin1234!
    → verificar llegada a /dashboard con KPIs

2.  navigate: http://localhost:3000/leads
    → verificar que "Juan Pérez" está en la lista
    → abrir detalle del lead
    → verificar etapa "contactado" y agente asignado

3.  navigate: http://localhost:3000/contactos
    → verificar contacto existente

4.  navigate: http://localhost:3000/tasaciones
    → abrir detalle de la tasación de Av. Santa Fe 1234
    → verificar etapa "presentada"

5.  navigate: http://localhost:3000/propiedades
    → abrir detalle de la propiedad "Av. Santa Fe 1234"
    → verificar estado "publicada"
    → verificar reporte generado

6.  navigate: http://localhost:3000/reservas
    → verificar reserva creada y completada

7.  navigate: http://localhost:3000/vendidas
    → verificar propiedad "Av. Santa Fe 1234" en vendidas

8.  navigate: http://localhost:3000/dashboard
    → verificar KPIs actualizados:
      - Leads: 1
      - Tasaciones: 1
      - Propiedades captadas: 1
      - Ventas: 1
    → verificar funnel con datos

9.  navigate: http://localhost:3000/mi-performance
    → verificar métricas del agente

10. navigate: http://localhost:3000/admin/auditoria
    → verificar log completo del flujo
```

- [ ] **Step 3: Resize a mobile y verificar pantallas clave del E2E**

```
resize_window: 375 × 812
navigate: http://localhost:3000/leads     → verificar cards
navigate: http://localhost:3000/dashboard → verificar KPIs apilados
navigate: http://localhost:3000/calendario → verificar vista agenda
resize_window: 1280 × 800
```

- [ ] **Step 4: Cerrar GIF y guardar**

```
gif_creator stop
```

El GIF se guarda con el nombre "vendepro-e2e-golden-path.gif".

- [ ] **Step 5: Reporte final de issues**

Listar todos los problemas encontrados durante el testing en el siguiente formato:

```
## Issues encontrados

### Críticos (bloquean el flujo)
- [pantalla] [descripción del problema]

### Responsivo (visual, no bloquean)
- [pantalla] [tamaño] [descripción]

### Menores (UX, no funcionales)
- [pantalla] [descripción]
```

- [ ] **Step 6: Commit del reporte**

```bash
cd C:/proyectos/vendepro
git add docs/ vendepro-backend/start-local.sh vendepro-backend/stop-local.sh vendepro-backend/seed-local.js
git commit -m "docs: reporte de testing local completo frontend E2E"
```

---

## Notas de implementación

### Si un worker no levanta
Revisar `vendepro-backend/logs/<nombre>.log`. Causas comunes:
- Puerto en uso: matar el proceso existente o cambiar puerto
- Error de migración: la migración puede ya existir (ignorar errores "table already exists")
- Falta `.dev.vars`: todos los packages ya tienen `.dev.vars` con `JWT_SECRET`

### Si el seed falla con 409
Es normal — significa que el seed ya se corrió antes. Los usuarios ya existen.

### Si wrangler dev no comparte D1
Todos los comandos deben ejecutarse desde `vendepro-backend/` (no desde cada package).
Verificar con:
```bash
ls vendepro-backend/.wrangler/state/v3/d1/vendepro-db/
# Debe mostrar db.sqlite
```
