# Diseño: Benchmark comparativo Activos vs Vendidos

**Fecha:** 2026-04-17
**Estado:** Propuesto
**Autor:** Gastón Corbalán (con Claude)
**Depende de:** PR #2 `feature/semaforo-visualizaciones` (spec `2026-04-16-semaforo-visualizaciones-design.md`)

---

## Resumen

Cambia el norte del dashboard de `/reportes/performance`: en lugar de comparar avisos contra **umbrales fijos** de Marcela Genta (14 vis/día CABA, 8 GBA), los compara contra los **propios avisos vendidos de la misma org**, agrupados por barrio. Esto convierte el dashboard en una herramienta de **diagnóstico comercial**: "tu aviso está 40% por debajo del promedio de los avisos que se vendieron en Villa Urquiza, revisá precio o las fotos".

Los umbrales fijos siguen existiendo como referencia (para comparar contra la norma de mercado de MG), pero el semáforo cualitativo se calcula ahora contra el benchmark interno — que es mucho más ajustado a cada inmobiliaria y a cada barrio.

---

## Motivación

El semáforo estático del PR #2 tiene dos problemas:

1. **Todo da verde para inmobiliarias chicas.** Si una propiedad tiene 20 vis/día en Villa Urquiza, contra el mínimo CABA de 14 está "amarillo" = aceptable. Pero si el promedio de las vendidas en Villa Urquiza es 45 vis/día, ese aviso está muy por debajo: no se va a vender.

2. **No da diagnóstico accionable.** Ver "amarillo" no le dice al agente QUÉ hacer. Ver "estás 55% debajo del benchmark del barrio" le sugiere revisar precio, fotos, video, promoción. Cada inmobiliaria sabe sus benchmarks internos mejor que los de otra.

La metodología viene del PDF de MG (slide 10, "Los 5 pasos de comercialización"): los avisos que se vendieron tienen los 5 pasos cubiertos. Los que no, suelen fallar en algún paso.

---

## Arquitectura

### Enfoque elegido

**Extender el endpoint `/listings-performance`** con una nueva sección `comparison_by_neighborhood` que devuelve, por barrio, las métricas promedio tanto para **vendidas** como para **activas**, con su delta%.

**Sin cambios de schema** — todo se calcula de los campos existentes (`properties.status`, `reports`, `report_metrics`).

**El `health_status` del frontend pasa a calcularse contra el benchmark del barrio**, no contra los 14/8 MG. Los umbrales MG se muestran como referencia en la leyenda pero no se usan para colorear.

### Cálculos

Para cada barrio:
```
sold_views_per_day = SUM(portal_visits de reports de properties vendidas) / SUM(días de reports de properties vendidas)
active_views_per_day = SUM(portal_visits de reports de properties activas) / SUM(días de reports de properties activas)
delta_pct = (active - sold) / sold × 100
```

`health_status` del barrio basado en delta_pct:
- `delta_pct >= -10%`: verde (estás al nivel o mejor que los vendidos)
- `-10% > delta_pct >= -30%`: amarillo (por debajo pero cerca)
- `delta_pct < -30%`: rojo (muy por debajo, revisar comercialización)

Mismo criterio se aplica por reporte individual: su `views_per_day` vs el `sold_views_per_day` de su barrio.

---

## Backend

### Extender `reports-queries.ts`

Agregar interface:

```typescript
export interface NeighborhoodComparison {
  neighborhood: string
  sold: {
    reports_count: number
    avg_views_per_day: number
    avg_portal_visits_per_report: number
    avg_in_person_visits_per_week: number
    avg_inquiries_per_report: number
  }
  active: {
    reports_count: number
    avg_views_per_day: number
    avg_portal_visits_per_report: number
    avg_in_person_visits_per_week: number
    avg_inquiries_per_report: number
  }
  delta_views_per_day_pct: number | null  // null si sold_reports_count == 0
  delta_health_status: HealthStatus
}
```

Nueva función `getComparisonByNeighborhood(db, orgId, start, end, source?)`:
- Hace 2 queries en paralelo: una por `p.status = 'sold'`, otra por `p.status = 'active'`.
- Cada query agrupa por `p.neighborhood` y devuelve totales de portal_visits, in_person_visits, inquiries, report_count.
- Y una 3ra query paralela con SELECT DISTINCT para sumar días únicos por barrio (como ya se hace).
- Combina los resultados en memoria para armar el array `NeighborhoodComparison[]`.

Nueva función `computeDeltaHealthStatus(activePct: number | null): HealthStatus`:
- Si `activePct >= -10`: green
- Si `activePct >= -30`: yellow
- Si `activePct < -30`: red
- Si `null` (no hay vendidas): light_green (no-data)

### Cambios en el endpoint `/listings-performance`

Agregar al response:

```json
{
  "comparison_by_neighborhood": [
    {
      "neighborhood": "Villa Urquiza",
      "sold": { "reports_count": 8, "avg_views_per_day": 45, "avg_in_person_visits_per_week": 2.8, ... },
      "active": { "reports_count": 12, "avg_views_per_day": 22, "avg_in_person_visits_per_week": 1.2, ... },
      "delta_views_per_day_pct": -51.1,
      "delta_health_status": "red"
    }
  ]
}
```

### Cambios en `/reports` (listado)

Por cada reporte, agregar:
```typescript
neighborhood_sold_avg_views_per_day: number | null  // benchmark del barrio
delta_vs_neighborhood_pct: number | null
delta_health_status: HealthStatus | null
```

El `health_status` del reporte individual se mantiene (vs umbral MG), pero ahora también viene `delta_health_status` (vs barrio).

---

## Frontend

### Nueva sección en `/reportes/performance` — arriba de todo

**"Tus activos vs tus vendidos"** (el bloque principal, más arriba que los KPIs globales):

```
┌──────────────────────────────────────────────────────────────┐
│  Tus activos vs vendidos                                     │
│  (¿cómo vienen tus avisos contra los que se vendieron?)      │
├──────────────────────────────────────────────────────────────┤
│  Barrio         │ Activos ∅ │ Vendidos ∅ │ Δ%   │ Diagnóstico│
│ Villa Urquiza   │ 22 vis/día│ 45 vis/día │ -51% │ 🔴 Revisar │
│ Belgrano        │ 32 vis/día│ 28 vis/día │ +14% │ 🟢 Bien    │
│ Caballito       │ 15 vis/día│ —          │ —    │ Sin data   │
└──────────────────────────────────────────────────────────────┘
```

Click en una fila roja/amarilla → expand muestra un **cartel de diagnóstico genérico**:

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Tus activos en Villa Urquiza están 51% por debajo de los │
│    vendidos. Revisá los 5 pasos de comercialización:        │
│                                                              │
│  • Precio de publicación (¿está dentro de mercado?)          │
│  • Fotos profesionales                                       │
│  • Tour Virtual 360°                                         │
│  • Plano                                                     │
│  • Video                                                     │
│  • Redes sociales (Youtube)                                  │
│                                                              │
│  — Marcela Genta Operaciones Inmobiliarias                   │
└─────────────────────────────────────────────────────────────┘
```

### Actualizar KPIs globales

El KPI destacado "Visualizaciones/día ∅" ahora muestra dos números:
- Tu promedio actual (grande, con color del semáforo vs benchmark global).
- Debajo, en gris chico: "Benchmark interno: X vis/día · MG min: 14 CABA / 8 GBA".

### Actualizar ranking por barrio (en Performance)

Agregar una columna nueva "Benchmark barrio" con el vis/día de las vendidas del barrio, y cambiar el color del semáforo para que sea contra el benchmark del barrio (no contra los 14/8).

### Actualizar listado `/reportes/listado`

Cada reporte tiene **dos badges** en vez de uno:
- `health_status` (vs MG) → pequeño, gris/azul
- `delta_health_status` (vs barrio) → grande, destacado con el color

Columna nueva "vs barrio" con el delta%.

---

## Manejo de errores

| Situación | Comportamiento |
|-----------|---------------|
| Barrio con 0 propiedades vendidas | `sold = null`, `delta_pct = null`, `delta_health_status = 'light_green'` (sin-data), diagnóstico: "Sin benchmark — necesitamos más ventas históricas en este barrio". |
| Barrio solo con vendidas, sin activas | `active = null`, no se muestra en el ranking activo pero sí se usa como referencia para otros. |
| Org nueva sin ventas registradas | Mensaje informativo en el dashboard: "Todavía no podemos calcular tus benchmarks porque no hay propiedades vendidas. Se genera automáticamente cuando registres tu primera venta con sus reports." |
| `sold_views_per_day == 0` | Lo tratamos como "sin data" (no se compara). |

---

## Base de datos

**Sin cambios.**

---

## Archivos a crear / modificar

### Crear
- `docs/superpowers/specs/2026-04-17-benchmark-comparativo-design.md` (este doc)
- `docs/superpowers/plans/2026-04-17-benchmark-comparativo.md`
- `vendepro-frontend/src/components/reports/NeighborhoodBenchmarkTable.tsx`
- `vendepro-frontend/src/components/reports/DiagnosisCard.tsx` — cartel expandible con los 5 pasos MG.

### Modificar
- `vendepro-backend/packages/api-analytics/src/reports-queries.ts` — agregar `NeighborhoodComparison`, `getComparisonByNeighborhood`, `computeDeltaHealthStatus`, y enriquecer `ReportListItem` con delta vs barrio.
- `vendepro-backend/packages/api-analytics/src/index.ts` — extender response de `/listings-performance` con `comparison_by_neighborhood`.
- `vendepro-backend/packages/api-analytics/tests/listings-performance.test.ts` — tests de la nueva sección.
- `vendepro-backend/packages/api-analytics/tests/reports-list.test.ts` — tests con delta.
- `vendepro-backend/seed-demo-reports.sql` — agregar al menos 1 propiedad vendida con reports + métricas para probar el benchmark.
- `vendepro-frontend/src/app/(dashboard)/reportes/performance/page.tsx` — inyectar tabla comparativa arriba de todo, actualizar colores del ranking de barrios.
- `vendepro-frontend/src/app/(dashboard)/reportes/listado/page.tsx` — badges dobles y columna delta vs barrio.

---

## Decisiones pendientes / pedidos para Eze

1. **¿Considerar también `status='reserved'` como "vendido" para el benchmark?** En la práctica, una reserva es casi una venta. Este PR solo cuenta `status='sold'`. Si Eze quiere podemos incluir reservas.

2. **Tamaño mínimo de muestra**: si un barrio solo tiene 1 vendida, el benchmark no es estadísticamente robusto. Este PR usa la data disponible tal cual. En un PR futuro podríamos agregar "mínimo 3 ventas" y si no hay, mostrar "Sin benchmark estadísticamente robusto — necesitamos más data".

3. **Ventana temporal**: ¿comparamos contra vendidos de los **últimos 12 meses** o **todos los tiempos**? Este PR usa **todos los tiempos** (no filtra por fecha de venta). Conversable.

4. **PR #4 ("Checklist 5 pasos")**: queda pendiente para un siguiente PR. Agregará columnas a `properties` y UI de checks por aviso, para diagnóstico personalizado en lugar del texto genérico.

5. **Mediana vs promedio**: este PR usa promedio ponderado (total_visits / total_days del grupo). Con muestras chicas, la mediana de reports individuales sería más robusta. Lo dejamos para el PR #4 o PR #5 cuando tengamos volumen de datos.
