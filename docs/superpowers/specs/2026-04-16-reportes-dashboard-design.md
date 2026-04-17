# Diseño: Sección `/reportes` con performance de avisos

**Fecha:** 2026-04-16
**Estado:** Propuesto
**Autor:** Gastón Corbalán (con Claude)

---

## Resumen

Recupera una vista que existía en el repo anterior de Gastón y que se perdió en la reestructura: un **dashboard agregado de métricas de avisos** (impresiones, visitas al portal, visitas presenciales, ofertas) con cortes por barrio y evolución temporal.

Los datos ya existen en la tabla `report_metrics` y llegan por cada reporte que se publica de cada propiedad. Hoy no hay ninguna pantalla ni endpoint que los consulte de forma agregada — solo se ven dentro del detalle de cada reporte de cada propiedad.

Esta vista es crítica para el **product owner** porque permite entender rápidamente "qué aviso va mal", "qué barrio está rindiendo bien" y "cómo evolucionó la performance en el tiempo", lo cual hoy se resuelve mirando reporte por reporte manualmente.

---

## Arquitectura

### Enfoque elegido

Crear una **nueva sección top-level `/reportes`** en el dashboard con **dos pestañas**:

1. **Listado** — tabla global de todos los reportes de la org (con filtros de propiedad, barrio, período, estado).
2. **Performance** — la vista agregada que pidió el usuario: KPIs globales + ranking por barrio + evolución temporal.

El backend expone **dos endpoints nuevos** en `api-analytics` (read-only, solo queries D1 con JOINs — no se agregan entidades ni use cases al dominio, siguiendo el patrón del endpoint `/dashboard` actual):

- `GET /reports` — listado paginado de reportes con sus métricas agregadas por reporte.
- `GET /listings-performance` — agregaciones globales + por barrio + serie temporal para una ventana de período configurable.

### Flujo completo

```
Agent / Admin en navegador
  → Sidebar "Reportes" (nuevo item en sección "Comercial")
  → /reportes → redirect a /reportes/performance
  → Tab "Performance": GET /listings-performance?period=month → KPIs + ranking barrios + evolución
  → Tab "Listado": GET /reports?page=1&neighborhood=X → tabla + filtros
```

Sin cambios en la estructura actual: los reportes siguen creándose y editándose dentro de cada propiedad (`/propiedades/[id]/reportes`). Esta sección es **solo lectura agregada**.

---

## Backend

### Endpoints nuevos (ambos en `api-analytics`, autenticados)

#### `GET /listings-performance`

Query params:
- `period` — `week` | `month` | `quarter` | `year` (default: `month`)
- `source` — opcional, filtra por `zonaprop` | `argenprop` | `mercadolibre` | `manual`

Response (200):
```json
{
  "period": "month",
  "start": "2026-03-16",
  "end": "2026-04-16",
  "kpis": {
    "reports_published": 24,
    "total_impressions": 18420,
    "total_portal_visits": 1832,
    "total_in_person_visits": 47,
    "total_offers": 12,
    "avg_impressions_per_report": 767,
    "avg_portal_visits_per_report": 76,
    "avg_in_person_visits_per_report": 2,
    "avg_offers_per_report": 0.5
  },
  "by_neighborhood": [
    {
      "neighborhood": "Villa Urquiza",
      "reports_count": 8,
      "avg_impressions": 920,
      "avg_portal_visits": 98,
      "avg_in_person_visits": 3,
      "avg_offers": 0.75,
      "total_offers": 6
    }
  ],
  "timeline": [
    {
      "period_label": "Marzo 2026",
      "period_start": "2026-03-01",
      "impressions": 8200,
      "portal_visits": 810,
      "in_person_visits": 22,
      "offers": 5
    }
  ]
}
```

Implementación: queries directas a D1 con `JOIN reports r ON r.id = rm.report_id JOIN properties p ON p.id = r.property_id WHERE p.org_id = ?` y `GROUP BY p.neighborhood` / `GROUP BY strftime('%Y-%m', r.period_start)`. Todo envuelto en `safe()` como ya hace `/dashboard`.

#### `GET /reports`

Query params:
- `page` — número de página (default: 1)
- `page_size` — items por página (default: 20, max: 100)
- `neighborhood` — opcional
- `status` — opcional, `draft` | `published`
- `property_id` — opcional
- `from` / `to` — fechas ISO opcionales sobre `period_end`

Response (200):
```json
{
  "page": 1,
  "page_size": 20,
  "total": 87,
  "results": [
    {
      "id": "abc123...",
      "property_id": "xyz789...",
      "property_address": "Pampa 1234",
      "property_neighborhood": "Villa Urquiza",
      "period_label": "Marzo 2026",
      "period_start": "2026-03-01",
      "period_end": "2026-03-31",
      "status": "published",
      "published_at": "2026-04-01T10:00:00Z",
      "impressions": 820,
      "portal_visits": 95,
      "in_person_visits": 3,
      "offers": 1
    }
  ]
}
```

Las métricas del reporte se obtienen agregando `report_metrics` (un reporte puede tener múltiples rows si tiene datos de varias fuentes; se suman).

### Sin cambios en domain / use-cases

Estos endpoints son analíticos puros — mismo patrón que `/dashboard`, `/search`, `/agent-stats`, `/export` del mismo worker. No se agrega use case al `core` porque la lógica es SQL agregada, no reglas de negocio. Esto mantiene el dominio limpio.

---

## Frontend

### Carpeta nueva

**`vendepro-frontend/src/app/(dashboard)/reportes/`**

- `layout.tsx` — shell de la sección con las dos pestañas (`Listado` y `Performance`).
- `page.tsx` — redirige a `/reportes/performance`.
- `listado/page.tsx` — tabla con filtros.
- `performance/page.tsx` — vista agregada con KPIs + ranking barrios + evolución.

### Tab "Performance" (lo principal)

Estructura mobile-first pero con layout que expande bien en desktop:

```
┌─────────────────────────────────────────────────────────┐
│  Performance de avisos            [Sem][Mes][Trim][Año] │
├─────────────────────────────────────────────────────────┤
│  ┌──KPI──┐ ┌──KPI──┐ ┌──KPI──┐ ┌──KPI──┐               │
│  │Reports│ │Impres.│ │Visits │ │Ofertas│                │
│  │  24   │ │ 18.4k │ │ 1.8k  │ │  12   │                │
│  └───────┘ └───────┘ └───────┘ └───────┘                │
│                                                         │
│  Promedio por aviso: 767 impresiones · 76 visitas...    │
├─────────────────────────────────────────────────────────┤
│  Ranking por barrio                                     │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Barrio         │ # │ ∅ Impr. │ ∅ Vis. │ Ofertas  │  │
│  │ Villa Urquiza  │ 8 │  920    │  98    │    6     │  │
│  │ Belgrano       │ 5 │  1200   │  140   │    4     │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Evolución temporal (Recharts LineChart)                │
│  [gráfico de líneas con impresiones/visitas/ofertas]    │
└─────────────────────────────────────────────────────────┘
```

- Selector de período: `week` | `month` | `quarter` | `year` (default `month`), igual al que usa `/dashboard`.
- KPIs en grid `grid-cols-2 sm:grid-cols-4`.
- Ranking de barrios como tabla responsiva (colapsa en cards en mobile).
- Evolución temporal con **Recharts LineChart** (`impresiones`, `visitas portal`, `visitas presenciales`, `ofertas` — cuatro líneas con colores consistentes).
- Colores: `#ff007c` (primario), `#ff8017` (secundario), azules/verdes para las otras series.
- Estados: loading (skeleton como `/dashboard`), empty (mensaje "Todavía no hay reportes publicados"), error.

### Tab "Listado"

Tabla paginada con columnas: Propiedad, Barrio, Período, Estado, Impresiones, Visitas portal, Visitas presenciales, Ofertas, Fecha publicación.

Filtros arriba:
- Dropdown barrio (poblado desde las propiedades).
- Dropdown estado (draft/published).
- Rango de fechas.
- Input de búsqueda por propiedad (futuro; para este PR basta con neighborhood + status + date range).

Click en una fila → navega a `/propiedades/[property_id]/reportes` (donde se ve el detalle del reporte, ya existente).

### Cambios en navegación

**`vendepro-frontend/src/lib/nav-config.ts`:**
Agregar en la sección `Comercial` (al final, después de `Vendidas`):
```typescript
{ href: '/reportes', label: 'Reportes', icon: FileBarChart }
```

El ícono `FileBarChart` de lucide ya está importado en el archivo (se usa para `/admin/auditoria`).

El `agentMobileLinks` se regenera automáticamente desde `menuSections` así que no hay cambios adicionales.

---

## Manejo de errores

| Situación | Comportamiento |
|-----------|---------------|
| Org sin ningún reporte publicado | Empty state con mensaje "Todavía no hay reportes publicados — cuando publiques el primer reporte, vas a ver acá las métricas agregadas" |
| Org sin reportes en el período seleccionado | Empty state parcial: KPIs en 0, ranking vacío, timeline vacío; mensaje "Sin datos para este período, probá un rango más amplio" |
| Error de conexión al backend | Toast/banner rojo "Error al cargar, reintentar" con botón retry |
| Falla query (tabla faltante, ej. migración no aplicada) | `safe()` retorna defaults (arrays vacíos, 0s); se muestra como "sin datos" — no se rompe la UI |
| Token expirado | Redirect a `/login` (middleware del frontend ya lo maneja) |
| Usuario con rol `agent` (no admin) | Ve sus propios reportes y las métricas de las propiedades que tiene asignadas. Admin ve todo de la org. (Para este PR: admin ve toda la org, agent ve todo también — filtrado por agent_id queda para un siguiente iteración) |

---

## Base de datos

**Sin cambios.** Se usan las tablas existentes:
- `properties` (para `neighborhood`, `org_id`)
- `reports` (para `period_start`, `period_end`, `status`, `published_at`)
- `report_metrics` (para `impressions`, `portal_visits`, `in_person_visits`, `offers`, `source`)

Todas ya tienen índices apropiados (`idx_reports_property`, `idx_report_metrics_report`). Para mejorar performance de los GROUP BY por barrio, quizás convenga agregar en un futuro un índice en `properties(org_id, neighborhood)`, pero no es bloqueante.

---

## Archivos a crear / modificar

### Crear
- `vendepro-backend/packages/api-analytics/src/reports-queries.ts` — helpers SQL
- `vendepro-backend/packages/api-analytics/tests/listings-performance.test.ts` — tests del endpoint
- `vendepro-backend/packages/api-analytics/tests/reports-list.test.ts` — tests del listado
- `vendepro-frontend/src/app/(dashboard)/reportes/layout.tsx`
- `vendepro-frontend/src/app/(dashboard)/reportes/page.tsx`
- `vendepro-frontend/src/app/(dashboard)/reportes/performance/page.tsx`
- `vendepro-frontend/src/app/(dashboard)/reportes/listado/page.tsx`

### Modificar
- `vendepro-backend/packages/api-analytics/src/index.ts` — agregar routes `GET /listings-performance` y `GET /reports`
- `vendepro-frontend/src/lib/nav-config.ts` — item "Reportes" en sección "Comercial"

---

## Decisiones pendientes / pedidos para Eze

1. **.dev.vars**: estos archivos no estaban en el repo ni en `.gitignore`. Los creamos en local para poder bootear el stack (JWT_SECRET falsedero). Sugerencia: documentar en `doc/backend.md` cómo setearlos, o crear un `setup-dev-vars.sh`. Agregamos `.dev.vars` al `.gitignore` en este PR (commit chore separado).

2. **start-local.sh idempotente**: las migraciones se ejecutan siempre y fallan en la segunda corrida (`duplicate column name`). Workaround en este PR: borrar `.wrangler-local/` antes de relanzar. Ticket separado: hacer las migraciones idempotentes con `IF NOT EXISTS` o registrar migraciones aplicadas.

3. **Filtrado por `agent_id` en Performance**: para este PR, admin y agent ven todo lo de la org. Siguiente iteración podría mostrar métricas personales al agent.
