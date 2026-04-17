# Diseño: Semáforo de visualizaciones sobre `/reportes`

**Fecha:** 2026-04-16
**Estado:** Propuesto
**Autor:** Gastón Corbalán (con Claude)
**Depende de:** PR #1 `feature/reportes-dashboard` (spec `2026-04-16-reportes-dashboard-design.md`)

---

## Resumen

Agrega una capa cualitativa al dashboard de reportes que acabamos de construir: un **semáforo** que clasifica cada aviso y cada barrio según qué tan buena es su performance en impresiones (visualizaciones por día). Se basa en la metodología interna de **Marcela Genta Operaciones Inmobiliarias** — umbrales empíricos definidos a partir del análisis de propiedades vendidas vs. no vendidas.

Sin esto, el agente ve números absolutos (11,012 impresiones en Marzo) y tiene que calcular mentalmente si eso está bien o mal para el aviso en particular. Con el semáforo, ve un círculo verde/amarillo/rojo y un número normalizado (visualizaciones/día) que le dice de un vistazo si el aviso está por encima o por debajo del mínimo para vender.

---

## Contexto — la metodología MG

Del PDF "**BÚSQUEDA — SEMÁFORO DE VISUALIZACIONES**" (material interno de Marcela Genta):

### Mínimo para vender en 4 meses

| Zona | Visualizaciones/día | Visitas presenciales/semana |
|------|---------------------|-----------------------------|
| CABA | **14** | **1.5** |
| GBA | **8** | **1** |

Propiedades que no alcanzan estos umbrales sostenidamente tienen muy baja probabilidad de venderse en ventana comercial razonable.

### Escala de colores (visualizaciones/día)

| Rango | Color | Diagnóstico |
|-------|-------|-------------|
| 0–9 | 🔴 Rojo | Aviso que no anda, revisar precio/fotos/portal |
| 10–13 | 🟠 Naranja | Mal — por debajo del mínimo |
| 14–22 | 🟡 Amarillo | Aceptable pero mejorable |
| 23–27 | 🟢 Verde claro | Bien |
| +28 | 🟢 Verde | Excelente |

### Evidencia del funnel (ventas MG, slide 7 del PDF)

- **Propiedades vendidas:** tasa exposición→visualización **9.9%**, visualización→consulta **3.1%**.
- **Propiedades NO vendidas:** tasa exposición→visualización **8.1%**, visualización→consulta **1.7%**.

---

## Arquitectura

### Enfoque elegido

**Agregar campos calculados sin cambiar entidades de dominio.** El cálculo del semáforo es pura lógica derivada de datos que ya tenemos (`impressions`, `in_person_visits`, `period_start`, `period_end`). Se mantiene todo en la capa analítica de `api-analytics`.

Los umbrales se exponen en el response como un objeto `benchmarks`, hardcodeados por ahora. Un futuro PR puede mover esto a una tabla de configuración por org (si algún colega pide otros umbrales).

### Cálculos

```typescript
days_in_period = daysBetween(period_start, period_end)
views_per_day = total_impressions / days_in_period
in_person_visits_per_week = in_person_visits / (days_in_period / 7)

health_status = 
  views_per_day <= 9      ? 'red'
  views_per_day <= 13     ? 'orange'
  views_per_day <= 22     ? 'yellow'
  views_per_day <= 27     ? 'light_green'
                          : 'green'
```

---

## Backend

### Cambios en `reports-queries.ts`

Agregar función:

```typescript
export type HealthStatus = 'red' | 'orange' | 'yellow' | 'light_green' | 'green'

export function computeHealthStatus(viewsPerDay: number): HealthStatus { /* ... */ }
export function daysBetween(startISO: string, endISO: string): number { /* ... */ }
```

### Cambios en `PerformanceKpis`

Agregar:
- `avg_views_per_day: number` — promedio calculado (total_impressions / reports_published_days).
- `avg_in_person_visits_per_week: number`
- `overall_health_status: HealthStatus` — semáforo del promedio global.

### Cambios en `NeighborhoodPerformance`

Agregar por barrio:
- `avg_views_per_day: number`
- `avg_in_person_visits_per_week: number`
- `health_status: HealthStatus` — semáforo del promedio del barrio.

### Cambios en `ReportListItem`

Agregar por reporte:
- `days_in_period: number`
- `views_per_day: number`
- `in_person_visits_per_week: number`
- `health_status: HealthStatus | null` — null si no hay datos aún.

### Cambios en el endpoint `GET /listings-performance`

Agregar al response:

```json
{
  "benchmarks": {
    "caba": { "min_views_per_day": 14, "min_in_person_visits_per_week": 1.5 },
    "gba":  { "min_views_per_day": 8,  "min_in_person_visits_per_week": 1.0 },
    "color_thresholds": {
      "red":          { "max_views_per_day": 9 },
      "orange":       { "max_views_per_day": 13 },
      "yellow":       { "max_views_per_day": 22 },
      "light_green":  { "max_views_per_day": 27 },
      "green":        { "min_views_per_day": 28 }
    },
    "source": "Marcela Genta Operaciones Inmobiliarias — Semáforo de visualizaciones"
  }
}
```

---

## Frontend

### Cambios en `/reportes/performance`

**Agregar debajo del selector de período (panel de leyenda):**

```
┌──────────────────────────────────────────────────────────────┐
│ 🟢+28  🟢23-27  🟡14-22  🟠10-13  🔴0-9   ·  Visualiz./día  │
│ Mínimo para vender en 4 meses: 14 vis./día (CABA) ·          │
│ 8 vis./día (GBA) — Marcela Genta Op. Inmobiliarias           │
└──────────────────────────────────────────────────────────────┘
```

**Cambiar KPIs globales:** el KPI actual "Impresiones totales" se reemplaza por "**Visualizaciones/día ∅**" con el número grande y un borde/fondo suave del color del semáforo global.

Los otros KPIs quedan: Reportes publicados, Visitas al portal ∅, **Visitas presenciales/sem ∅**, Ofertas.

**Ranking de barrios:** agregar columna "∅ Vis/día" + círculo de color al final de cada fila.

### Cambios en `/reportes/listado`

- Reemplazar columna "Impres." por "Vis/día" (valor calculado).
- Agregar un círculo de color (12px) en la primera columna, antes del nombre de la propiedad.
- El hover de cada fila muestra un tooltip breve: "Este aviso tuvo X vis/día en Y días (semáforo YYY)".

### Componente reutilizable

Nuevo archivo `vendepro-frontend/src/components/reports/HealthBadge.tsx`:

```tsx
<HealthBadge status="yellow" size="sm" />  →  🟡
<HealthBadge status="green" size="lg" withLabel />  →  🟢 Excelente
```

### Helpers de cliente

Nuevo archivo `vendepro-frontend/src/lib/semaforo.ts`:

```typescript
export type HealthStatus = 'red' | 'orange' | 'yellow' | 'light_green' | 'green'

export const HEALTH_COLORS: Record<HealthStatus, { bg: string; text: string; border: string; label: string }> = {
  red:         { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300',    label: 'Crítico' },
  orange:      { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', label: 'Bajo' },
  yellow:      { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', label: 'Aceptable' },
  light_green: { bg: 'bg-lime-100',   text: 'text-lime-700',   border: 'border-lime-300',   label: 'Bien' },
  green:       { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300',  label: 'Excelente' },
}

export function healthStatusFromViewsPerDay(v: number): HealthStatus { /* ... */ }
```

---

## Manejo de errores

| Situación | Comportamiento |
|-----------|---------------|
| Reporte con `period_end == period_start` (0 días) | `days_in_period = 1` para evitar división por cero, pero `health_status = null` porque el dato no es confiable |
| Reporte sin `report_metrics` asociado | `views_per_day = 0`, `health_status = 'red'` (está en el peor grupo) |
| Reporte con fechas invalidadas | Skip cálculo, `health_status = null`, se muestra "—" |
| Barrio con 0 reportes | No aparece en ranking (ya era así) |

---

## Base de datos

**Sin cambios.** Todos los cálculos son derivados de campos existentes.

---

## Archivos a crear / modificar

### Crear
- `docs/superpowers/specs/2026-04-16-semaforo-visualizaciones-design.md` (este doc)
- `docs/superpowers/plans/2026-04-16-semaforo-visualizaciones.md`
- `vendepro-frontend/src/lib/semaforo.ts`
- `vendepro-frontend/src/components/reports/HealthBadge.tsx`

### Modificar (backend)
- `vendepro-backend/packages/api-analytics/src/reports-queries.ts` — nuevas funciones `computeHealthStatus`, `daysBetween` + campos derivados en las interfaces.
- `vendepro-backend/packages/api-analytics/src/index.ts` — agregar `benchmarks` al response.
- `vendepro-backend/packages/api-analytics/tests/listings-performance.test.ts` — actualizar mocks + test de `benchmarks`.
- `vendepro-backend/packages/api-analytics/tests/reports-list.test.ts` — actualizar mocks con los nuevos fields.

### Modificar (frontend)
- `vendepro-frontend/src/app/(dashboard)/reportes/performance/page.tsx` — panel de leyenda + KPI "Vis/día ∅" con color + columna semáforo en ranking.
- `vendepro-frontend/src/app/(dashboard)/reportes/listado/page.tsx` — columna vis/día + badge de color por fila.

---

## Decisiones pendientes / pedidos para Eze

1. **Umbrales configurables por org**: este PR los deja hardcodeados (14/8 CABA/GBA). En una iteración futura podrían moverse a una tabla `org_settings.benchmarks` para que inmobiliarias del interior (ej: Córdoba, Mendoza) puedan tener sus propios umbrales. No es bloqueante.

2. **Detección CABA vs GBA**: este PR no detecta automáticamente la zona de cada propiedad. Los umbrales se muestran ambos en la leyenda. Si quisiéramos aplicar el umbral correcto por barrio, habría que agregar un campo `zone` a `properties` (CABA / GBA / Interior) o inferirlo por el valor de `city`. Lo dejamos para un PR siguiente.

3. **Métrica "visitas presenciales/semana"**: se calcula al nivel de reporte. Puede generar valores raros para reportes muy cortos (ej: 1 visita en 3 días ≈ 2.3 visitas/sem). Dejo la métrica cruda — si molesta, se redondea o cambia a "visitas en el período" sin normalizar.
