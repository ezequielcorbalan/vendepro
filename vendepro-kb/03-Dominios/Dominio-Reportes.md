# 📈 Dominio: Reportes

Reportes mensuales de **performance de una propiedad publicada**: métricas de portales (Zonaprop, Argenprop, MercadoLibre) + benchmarks de zona + recomendaciones.

## Entidades

- **`Report`** (`domain/entities/report.ts`) — header del reporte
- `ReportMetric` — métricas por fuente (impresiones, visitas, consultas, llamadas, WhatsApp, visitas presenciales, ofertas, ranking, precio promedio de mercado, screenshot)
- `ReportContent` — secciones de texto (strategy | marketing | conclusion | benchmarks | price_reference)
- `ReportPhoto` — fotos asociadas
- `competitor_links` — links a propiedades comparables

## Tabla D1

5 tablas (ver [[DB-overview]]):
- `reports` — header con `period_label`, `period_start`, `period_end`, `status`, `public_slug`
- `report_metrics`
- `report_content`
- `report_photos`
- `competitor_links`

## Workflow

```
1. Agente sube screenshot de Zonaprop/Argenprop/MercadoLibre
2. POST /extract-metrics ([[API-ai]]) extrae métricas con Claude haiku
3. Agente revisa, edita comparables y secciones
4. Publica → genera public_slug
5. Cliente accede via /r/[slug]
```

## Reglas (`domain/rules/report-health-rules.ts`)

Define el **semáforo de salud** (`HealthStatus`) según `views_per_day`:
- 🔴 red (sin tracción)
- 🟠 orange
- 🟡 yellow
- 🟢 light_green
- 🟢 green (saludable)

Frontend (`components/reports/HealthBadge.tsx`) muestra el badge. La función `healthStatusFromViewsPerDay()` está en `lib/semaforo.ts`.

## Use cases

- `CreateReport`, `GetReports`, `GetReportDetail`, `UpdateReport`, `DeleteReport`
- `GetPublicReport` (público)
- `ListReportsWithMetrics` (analytics)
- `ExtractPropertyMetrics` (en [[API-ai]])
- `GetActiveListingsWithBenchmark`, `GetListingsPerformance`, `GetNeighborhoodComparison` (en [[API-analytics]])

## Endpoints

[[API-properties]]:
- `GET /reports`, `POST /reports`

[[API-analytics]]:
- `GET /reports` — paginado con métricas
- `GET /listings-performance` — KPIs cross-listings

[[API-public]]:
- `GET /public/report/:slug`

[[API-ai]]:
- `POST /extract-metrics`

## Frontend

- `/reportes` (hub)
- `/reportes/listado` (tabla)
- `/reportes/performance` (agentes vs benchmark)
- `/propiedades/[id]/reportes` y `/propiedades/[id]/reportes/nuevo`
- Componentes: `HealthBadge`, `DiagnosisCard`, `ActiveListingsTable`, `NeighborhoodBenchmarkTable`, `ReportsListWidget`

Página pública: `/r/[slug]`.

## Relacionados

- [[Dominio-Propiedades]]
- [[API-ai]] (extracción de métricas)
