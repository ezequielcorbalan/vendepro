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
1. Métricas (paso 2): tres caminos
   a. screenshot de Zonaprop/Argenprop/MercadoLibre → POST /extract-metrics
   b. PDF de reporte de KiteProp → POST /extract-kiteprop (base64, precarga
      todos los portales del PDF + visitas presenciales + precio de zona)
   c. carga manual
2. Competencia (paso 4): tres caminos
   a. link del aviso → POST /extract-comparable-url (si el portal bloquea
      por anti-bot, la API devuelve 422 y se cae al camino b)
   b. screenshot del aviso (subir o Ctrl+V) → POST /extract-comparable
   c. carga manual
3. Contenido (paso 3): "Sugerir con IA" redacta la conclusión y la referencia
   de precio desde las métricas cargadas → POST /suggest-report-conclusion
4. Agente revisa, edita comparables y secciones
5. Publica → genera public_slug
6. Cliente accede via /r/[slug]
```

Todo lo de IA va por [[API-ai]] (Gemini) como JSON con base64 — nada multipart.

## Historial de bugs del circuito (auditoría 2026-09-08)

Corregidos en la misma tanda que los endpoints de IA:
- **Las fotos nunca se guardaban**: `/upload-photo` subía a R2 e ignoraba el
  `reportId` — jamás escribió `report_photos`, así que el reporte público
  nunca mostró una foto. Ahora `AddReportPhotoUseCase` hace ambas cosas, y
  hay `DELETE /report-photos/:id` para el modo edición del wizard.
- **Editar perdía la competencia**: el PUT ignoraba `competitors`.
- **El listado perdió el semáforo**: en el refactor hexagonal,
  `ListReportsWithMetricsUseCase` dejó de calcular `views_per_day`,
  `days_in_period` y `health_status` — la columna Vis/día salía vacía y el
  semáforo decía "Sin datos" en todas las filas. El cálculo volvió al use case
  (regla de dominio `report-health-rules`).
- **Cross-org write**: crear un reporte con un `propertyId` ajeno lo escribía
  en la org de esa propiedad. Ahora 404.
- **Wizard sin red**: se podía publicar sin período ni conclusión.

Pendiente operativo: **migración 051** (`report_photos.r2_key`) — el código
tolera que no esté (insert con fallback), pero sin ella la baja de fotos no
limpia el objeto exacto de R2.

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
- `POST /extract-metrics` — métricas desde screenshot
- `POST /extract-kiteprop` — métricas desde el PDF de KiteProp (2026-09-08)
- `POST /extract-comparable` — comparable desde screenshot
- `POST /extract-comparable-url` — comparable desde el link del aviso (2026-09-08)

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
