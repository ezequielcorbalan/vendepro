# Spec: Testing completo del frontend en local

**Fecha:** 2026-04-15
**Autor:** Claude + Ezequiel
**Estado:** Aprobado

---

## Objetivo

Ejecutar un plan de testing completo del frontend de VendéPro corriendo todo en local (frontend + 8 backends + D1 local), a través de la interfaz gráfica en Chrome, cubriendo el flujo CRM de punta a punta y verificando responsivo en todas las pantallas.

---

## Sección 1 — Infraestructura local

### Puertos asignados

| Worker         | Puerto |
|----------------|--------|
| api-auth       | 8787   |
| api-crm        | 8788   |
| api-properties | 8789   |
| api-transactions | 8790 |
| api-analytics  | 8791   |
| api-ai         | 8792   |
| api-admin      | 8793   |
| api-public     | 8794   |
| Frontend (Next.js) | 3000 |

### Script `start-local.sh`

Ubicación: `vendepro-backend/start-local.sh`

Pasos en orden:
1. Corre migraciones D1 local (desde `vendepro-backend/`):
   ```
   npx wrangler d1 execute DB --local --file=migrations_v2/000_initial.sql         --config packages/api-auth/wrangler.jsonc
   npx wrangler d1 execute DB --local --file=migrations/001_add_inactive_and_sale_data.sql --config packages/api-auth/wrangler.jsonc
   npx wrangler d1 execute DB --local --file=migrations/002_price_history.sql               --config packages/api-auth/wrangler.jsonc
   npx wrangler d1 execute DB --local --file=migrations/003_organizations_appraisals_comparables.sql --config packages/api-auth/wrangler.jsonc
   npx wrangler d1 execute DB --local --file=migrations/004_tasacion_template_blocks.sql    --config packages/api-auth/wrangler.jsonc
   npx wrangler d1 execute DB --local --file=migrations/005_lead_tags_and_archive.sql       --config packages/api-auth/wrangler.jsonc
   npx wrangler d1 execute DB --local --file=migrations/006_ficha_tasacion.sql              --config packages/api-auth/wrangler.jsonc
   npx wrangler d1 execute DB --local --file=migrations/007_prefactibilidades.sql           --config packages/api-auth/wrangler.jsonc
   npx wrangler d1 execute DB --local --file=migrations/008_register_org_indexes.sql        --config packages/api-auth/wrangler.jsonc
   npx wrangler d1 execute DB --local --file=migrations_v2/001_appraisals_extra_cols.sql    --config packages/api-auth/wrangler.jsonc
   ```
2. Lanza los 8 workers en background con `wrangler dev --port {X} --local`
3. Health check: espera hasta que cada puerto responde (máx 30s por worker)
4. Genera `vendepro-frontend/.env.local` con las URLs locales
5. Lanza `npm run dev` en el frontend (puerto 3000)

### `.env.local` generado

```
NEXT_PUBLIC_API_AUTH_URL=http://localhost:8787
NEXT_PUBLIC_API_CRM_URL=http://localhost:8788
NEXT_PUBLIC_API_PROPERTIES_URL=http://localhost:8789
NEXT_PUBLIC_API_TRANSACTIONS_URL=http://localhost:8790
NEXT_PUBLIC_API_ANALYTICS_URL=http://localhost:8791
NEXT_PUBLIC_API_AI_URL=http://localhost:8792
NEXT_PUBLIC_API_ADMIN_URL=http://localhost:8793
NEXT_PUBLIC_API_PUBLIC_URL=http://localhost:8794
```

### Seed mínimo

Vía llamadas HTTP a `api-auth` local una vez levantado:
- Admin: `admin@test.com` / `Admin1234!` (rol: admin)
- Agente: `agente@test.com` / `Agente1234!` (rol: agent)

Todos los datos del flujo CRM se crean durante la ejecución del testing a través de la UI.

---

## Sección 2 — Inventario de pantallas

El testing sigue el orden del pipeline CRM para que los datos generados en pasos anteriores estén disponibles en los siguientes.

### Bloque 0 — Auth & Onboarding
- `/login` — login como admin
- `/register` — wizard de 3 pasos (nueva organización)

### Bloque 1 — Dashboard (empty states)
- `/dashboard` — KPIs, funnel, charts (vacío primero)
- `/dashboard/mi-performance` — métricas personales

### Bloque 2 — Leads *(mobile-first)*
- `/leads` — lista vacía → crear lead → lista con dato
- `/leads/[id]` — detalle, cambio de etapa

### Bloque 3 — Contactos *(mobile-first)*
- `/contactos` — vacío → contacto generado desde lead

### Bloque 4 — Tasaciones *(mobile-first)*
- `/tasaciones` — lista
- `/tasaciones/nueva` — crear
- `/tasaciones/[id]` — detalle
- `/tasaciones/[id]/editar` — editar

### Bloque 5 — Propiedades
- `/propiedades` — lista
- `/propiedades/nueva` — formulario de alta
- `/propiedades/[id]` — detalle
- `/propiedades/[id]/reportes/nuevo` — generar reporte
- `/propiedades/pipeline` — kanban de estados

### Bloque 6 — Transacciones
- `/reservas` — crear y listar
- `/vendidas` — propiedades vendidas

### Bloque 7 — Actividades & Calendario *(mobile-first)*
- `/actividades` — feed de actividades
- `/calendario` — vistas mes/semana/día/agenda

### Bloque 8 — Prefactibilidades
- `/prefactibilidades` — lista
- `/prefactibilidades/nueva` — formulario

### Bloque 9 — Páginas públicas *(sin auth)*
- `/r/[slug]` — reporte público de propiedad
- `/t/[slug]` — tasación pública
- `/v/[slug]` — formulario de visita
- `/p/[slug]` — prefactibilidad pública
- `/terminos` — términos y condiciones

### Bloque 10 — Perfil & Configuración
- `/perfil` — datos personales
- `/perfil/objetivos` — objetivos del agente
- `/perfil/tasaciones` — config tasaciones del agente
- `/configuracion` — config general + slug
- `/configuracion/objetivos` — objetivos de la org
- `/configuracion/tasacion` — config tasación de la org

### Bloque 11 — Admin *(solo admin)*
- `/admin/agentes` — lista agentes
- `/admin/agentes/nuevo` — alta de agente
- `/admin/auditoria` — log de auditoría
- `/admin/objetivos` — objetivos globales
- `/mi-performance` — performance propia

### Verificaciones por pantalla
Para cada pantalla:
1. Carga sin errores de consola JavaScript
2. Loading state visible durante fetch
3. Empty state correcto cuando no hay datos
4. Filled state correcto cuando hay datos
5. Responsive en 375px (mobile) y 1280px (desktop)
6. Acciones principales funcionan (botones, formularios, navegación)

---

## Sección 3 — Criterios de responsivo

### Mobile — 375 × 812px (iPhone 14)
- Sidebar oculto; MobileHeader con hamburger visible
- Tablas → cards apiladas (sin scroll horizontal)
- Filtros → dentro de drawer/sheet, no inline
- Botones de acción mínimo 44px de alto
- Sin scroll horizontal en ninguna pantalla
- Kanban de propiedades → lista vertical
- Calendario → vista agenda por defecto

### Desktop — 1280 × 800px
- Sidebar visible y expandido
- Tablas con todas las columnas
- Filtros inline o en sidebar
- Grids de 3–4 columnas en cards
- Calendario → vista semana por defecto

### Criterios de falla
- Texto cortado sin recuperarse con `truncate` / `line-clamp`
- Botones que se salen del viewport
- Campos de formulario que se solapan
- Scroll horizontal inesperado
- Elementos que desaparecen o se rompen al redimensionar

---

## Sección 4 — Flujo E2E de punta a punta

El golden path que Claude ejecuta en orden usando Chrome:

```
1.  Login admin (admin@test.com) → verificar dashboard vacío
2.  Crear Lead "Juan Pérez" (tipo: comprador, fuente: web)
3.  Asignar lead al agente → cambiar etapa → marcar como contactado
4.  Convertir lead a Contacto
5.  Crear Tasación para una propiedad de Juan Pérez
6.  Avanzar tasación hasta etapa "presentada"
7.  Crear Propiedad captada desde la tasación
8.  Completar datos de la propiedad (dirección, precio, descripción)
9.  Generar Reporte público de la propiedad → verificar /r/[slug]
10. Avanzar propiedad en el pipeline → publicar
11. Crear Reserva sobre esa propiedad
12. Completar la reserva → marcar propiedad como Vendida
13. Verificar /dashboard con KPIs actualizados (leads, tasaciones, ventas)
14. Verificar /mi-performance del agente con métricas del flujo
15. Ir a /admin/auditoria → ver log del flujo completo
```

### Por cada paso del flujo
- Screenshot antes y después de la acción principal
- Verificación de que el estado cambió correctamente en la UI
- Chequeo responsive (resize a 375px) en las pantallas clave del flujo

---

## Artefactos a producir

| Artefacto | Ubicación |
|-----------|-----------|
| Script de inicio | `vendepro-backend/start-local.sh` |
| `.env.local` del frontend | `vendepro-frontend/.env.local` (generado por script) |
| Script de seed | `vendepro-backend/seed-local.sh` |
| GIF del flujo completo | Generado por `mcp__claude-in-chrome__gif_creator` |

---

## Criterios de éxito

- Todas las pantallas del inventario cargan sin errores de consola
- El flujo E2E de punta a punta se completa sin bloqueos
- Cada pantalla pasa la verificación responsive en 375px y 1280px
- El dashboard refleja correctamente los datos creados durante el flujo
