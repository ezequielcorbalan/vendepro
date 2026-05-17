# 📊 API-analytics

Worker de dashboards, búsqueda global, exports y reportes agregados.

| Campo | Valor |
|---|---|
| Path | `packages/api-analytics/` |
| Subdominio | `analytics.api.vendepro.com.ar` |
| Bindings | D1 |
| Secrets | `JWT_SECRET` |
| Middleware | cors, error-handler, auth |

## Endpoints

| Método | Path | Use cases |
|---|---|---|
| GET | `/dashboard` | GetDashboardStatsUseCase + GetAppraisalStatsUseCase + GetActivityStatsUseCase + GetTodayEventsUseCase + GetPendingFollowupsUseCase (`?agent_id`) |
| GET | `/search` | SearchEntitiesUseCase — búsqueda global cross-entity (`?q`) |
| GET | `/agent-stats` | GetAgentStatsUseCase — stats del agente logeado |
| GET | `/export` | ExportLeadsUseCase (`?type=leads`) — CSV |
| GET | `/listings-performance` | GetListingsPerformanceUseCase + GetNeighborhoodComparisonUseCase + GetActiveListingsWithBenchmarkUseCase (`?period, ?source, ?property_type, ?price_min, ?price_max`) |
| GET | `/reports` | ListReportsWithMetricsUseCase — paginado (`?page, ?page_size, ?neighborhood, ?status, ?property_id, ?from, ?to`) |
| GET | `/marketing` | Dashboard marketing — leads por fuente + historial Meta events + integración status (`?period=month/quarter/year`) |

## Notas

- `/dashboard` consolida 5 queries en una sola respuesta (KPIs + funnel + actividades + eventos del día + follow-ups pendientes). Útil para el home del CRM.
- `/search` busca cross-entity (leads, contacts, properties, appraisals). El use case `SearchEntitiesUseCase` distribuye la query a los repos correspondientes.
- `/listings-performance` compara avisos activos contra el benchmark del barrio — usa datos de [[Dominio-Reportes]] + agregaciones desde `properties`.

## Frontend que lo consume

- `/dashboard` (página principal)
- `/dashboard/mi-performance` y `/mi-performance`
- `/reportes/listado`, `/reportes/performance`
- `/marketing`
- Búsqueda global del Sidebar (componente `GlobalSearch`)
