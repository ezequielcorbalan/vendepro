# Diseño: Filtros por tipo de producto y rango de precio

**Fecha:** 2026-04-17
**Estado:** Propuesto
**Autor:** Gastón Corbalán (con Claude)
**Depende de:** PR #3 `feature/benchmark-comparativo`

---

## Resumen

Hoy la pantalla `/reportes/performance` mezcla **todas las propiedades de una org en el mismo benchmark**, independientemente del tipo (depto, casa, local, terreno, oficina, PH) y del rango de precio. Esto distorsiona los promedios:

- Un local comercial de USD 500k tiene naturalmente menos visualizaciones que un departamento de USD 90k, aunque ambos estén "bien posicionados" para su producto.
- Un terreno comportarse estadísticamente muy distinto de un departamento.

Gastón lo señaló claramente: "en productos más caros, las visualizaciones son menos, más que el tipo de producto, a veces".

Este PR agrega **dos filtros opcionales** al endpoint y a la UI: `property_type` y `price_range`. Todos los cálculos del dashboard (KPIs, benchmark por barrio, active listings, comparison sold vs active) respetan los filtros.

---

## Arquitectura

### Enfoque elegido

Filtros como **query params del endpoint `/listings-performance`**, aplicados uniformemente en **todas** las queries SQL de los helpers. Si no se pasan, el comportamiento actual se mantiene (todos los tipos, todos los precios).

Sin cambios de schema — los campos `property_type` y `asking_price` ya existen en `properties`.

### Parámetros nuevos del endpoint

- `property_type`: `departamento` | `casa` | `ph` | `local` | `terreno` | `oficina` (opcional).
- `price_min`: número, USD (opcional).
- `price_max`: número, USD (opcional).

Los filtros se combinan con AND. Si no se pasan, no se aplica filtro.

---

## Backend

### Helpers que reciben los filtros

Agregamos un tipo compartido:

```typescript
export interface ListingFilters {
  property_type?: string | null
  price_min?: number | null
  price_max?: number | null
}
```

Y las 4 funciones principales de `reports-queries.ts` reciben `filters: ListingFilters`:

- `getPerformanceKpis`
- `getNeighborhoodPerformance`
- `getComparisonByNeighborhood`
- `getActiveListingsWithBenchmark`

Cada función construye un fragmento de WHERE adicional:

```typescript
function buildPropertyFilter(filters: ListingFilters): { sql: string; binds: unknown[] } {
  const sql: string[] = []
  const binds: unknown[] = []
  if (filters.property_type) { sql.push('p.property_type = ?'); binds.push(filters.property_type) }
  if (filters.price_min != null) { sql.push('p.asking_price >= ?'); binds.push(filters.price_min) }
  if (filters.price_max != null) { sql.push('p.asking_price <= ?'); binds.push(filters.price_max) }
  return { sql: sql.length > 0 ? ' AND ' + sql.join(' AND ') : '', binds }
}
```

### Cambio en el endpoint

```typescript
app.get('/listings-performance', async (c) => {
  // ... existing period/source logic
  const filters: ListingFilters = {
    property_type: c.req.query('property_type') ?? null,
    price_min: c.req.query('price_min') ? parseFloat(c.req.query('price_min')!) : null,
    price_max: c.req.query('price_max') ? parseFloat(c.req.query('price_max')!) : null,
  }
  // pasar filters a las 4 funciones
})
```

---

## Frontend

### Nueva sección de filtros arriba de todo

Entre el selector de período y la tabla de benchmark:

```
┌──────────────────────────────────────────────────────────┐
│ Tipo: [Todos ▼]   Precio: [Desde] [Hasta]   [Mes ▼]     │
└──────────────────────────────────────────────────────────┘
```

- **Tipo de producto**: dropdown con los tipos permitidos (departamento, casa, ph, local, terreno, oficina) + "Todos".
- **Rango de precio**: dos inputs numéricos con placeholder en USD.
- **Período**: el que ya existe, al lado.

Los filtros se persisten en **query params de la URL** (`?property_type=departamento&price_min=50000`) para que se puedan compartir links con filtros aplicados y sobrevivan a refresh.

### Indicador de filtros activos

Debajo de los selectores, un chip: "Mostrando 5 propiedades que cumplen los filtros" (o "Mostrando todo" cuando no hay filtros). Incluye botón "Limpiar filtros" si hay alguno activo.

---

## Manejo de errores

| Situación | Comportamiento |
|-----------|---------------|
| Filtro deja 0 propiedades activas y 0 vendidas | Empty state "Ningún aviso cumple estos filtros. Probá quitar alguno." |
| Solo hay vendidas con esos filtros, ninguna activa | Se muestra el benchmark pero la tabla de active listings queda vacía con mensaje "No tenés avisos activos en este segmento". |
| Filtros inválidos (price_max < price_min) | Se muestra warning arriba de los selectores pero no se bloquea (el backend devuelve lista vacía y el empty state se activa). |

---

## Base de datos

**Sin cambios.** Campos `property_type` y `asking_price` ya existen.

---

## Archivos a crear / modificar

### Modificar
- `vendepro-backend/packages/api-analytics/src/reports-queries.ts` — agregar `ListingFilters` + parámetro a las 4 funciones + `buildPropertyFilter` helper.
- `vendepro-backend/packages/api-analytics/src/index.ts` — leer query params y pasar filters.
- `vendepro-backend/packages/api-analytics/tests/listings-performance.test.ts` — test con filtros.
- `vendepro-backend/seed-demo-reports.sql` — agregar propiedades de otros tipos (casa, local) para probar.
- `vendepro-frontend/src/app/(dashboard)/reportes/performance/page.tsx` — UI de filtros con query params.
