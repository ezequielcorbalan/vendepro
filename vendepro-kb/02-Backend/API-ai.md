# 🤖 API-ai

Worker que envuelve a **Gemini** (proveedor único) para las tareas de IA. Modelo: `gemini-3.5-flash-lite` en todas (benchmark en `doc/ia-auditoria-2026-09-02.md`).

| Campo | Valor |
|---|---|
| Path | `packages/api-ai/` |
| Subdominio | `ai.api.vendepro.com.ar` |
| Bindings | D1 |
| Secrets | `JWT_SECRET`, `GEMINI_API_KEY` |
| Middleware | cors, error-handler, auth |

## Endpoints

Todos por Gemini `3.5-flash-lite`. Contrato uniforme: JSON in / JSON out — **nada viaja como multipart** (los archivos van en base64).

| Método | Path | Use case | Entrada → salida |
|---|---|---|---|
| POST | `/extract-metrics` | ExtractPropertyMetricsUseCase | `{imageBase64, mimeType}` → `{metrics}` de portal |
| POST | `/extract-entity` | ExtractLeadFromTextUseCase | `{text}` → `{fields}` de lead |
| POST | `/extract-image` | ExtractLeadFromImageUseCase | `{imageBase64, mimeType}` → `{fields}` de lead |
| POST | `/extract-comparable` | ExtractComparableFromScreenshotUseCase | `{imageBase64, mimeType}` → `{fields}` de comparable |
| POST | `/extract-comparable-url` | ExtractComparableFromUrlUseCase | `{url}` → `{fields}` de comparable (2026-09-08) |
| POST | `/extract-kiteprop` | ExtractPortalReportFromPdfUseCase | `{pdfBase64}` → `{portals[], total_visits_presenciales, market_comparison}` (2026-09-08) |
| POST | `/suggest-report-conclusion` | GenerateReportConclusionUseCase | `{periodLabel, periodStart, periodEnd, metrics[], competitors[]}` → `{conclusion, price_reference}` (2026-09-08) |
| POST | `/suggest-appraisal-pricing` | SuggestAppraisalPricingUseCase | `{property, comparables[], swot}` → `{suggested_price, test_price, expected_close_price, usd_per_m2, rationale}` (2026-09-09) |
| POST | `/generate-email-campaign` | GenerateEmailCampaignContentUseCase | `{brief, kind, audience_description}` → contenido brandeado |
| POST | `/generate-email-sequence` | GenerateAutomationSequenceUseCase | `{brief, step_count}` → `{steps}` |
| POST | `/landings/:id/edit-block` | EditBlockWithAIUseCase | `{prompt, scope, blockId}` → bloque modificado |

## Casos de uso

### `/extract-metrics`
Agente sube screenshot de estadísticas de Zonaprop / Argenprop / MercadoLibre. Extrae: impresiones, visitas, consultas, llamadas, WhatsApp, posición de ranking. Resultado precarga `report_metrics` (ver [[Dominio-Reportes]]).

### `/extract-comparable` y `/extract-comparable-url`
El mismo comparable por dos caminos: captura del aviso, o **el link del aviso**. El de URL baja la página con `HttpListingPageFetcher` (lista blanca de portales — sin ella sería un proxy abierto), reduce el HTML a texto (conserva el JSON-LD) y extrae con el mismo prompt del benchmark. **Cuando el portal bloquea por anti-bot devuelve 422 con mensaje que empuja a la captura** — Zonaprop usa DataDome y las IPs de Workers son datacenter, así que ese camino degrada por diseño, no por bug. Lo usan tasaciones (`ComparableCard`) y el paso Competencia del wizard de reportes.

### `/extract-kiteprop`
PDF de reporte de KiteProp → métricas por portal para el paso 2 del wizard de reportes. Única llamada por la **API nativa** de Gemini (`inline_data` con `application/pdf`): el dialecto OpenAI no acepta documentos. Tope 10 MB; fuentes desconocidas caen a `manual`.

### `/suggest-report-conclusion`
Paso 3 del wizard de reportes, botón "Sugerir con IA": manda las métricas y comparables ya cargados y la IA redacta la "Conclusión y recomendación" para el propietario (rioplatense, 2-3 párrafos, sin inventar números). El semáforo MG se calcula en el use case con `report-health-rules` y viaja al modelo ya resuelto — el LLM no conoce la metodología. `price_reference` sólo se completa si hay datos de mercado, y el frontend no pisa ese campo si el agente ya escribió algo.

### `/suggest-appraisal-pricing`
Editor de tasaciones, botón "Sugerir con IA" en la sección Precios: los comparables cargados + datos de la propiedad → los 3 precios (sugerido/prueba/cierre) y la justificación. **La matemática es del código**: el use case calcula USD/m² por comparable (con el precio de CIERRE cuando es una venta), mediana, rango duro y valor base por superficie ponderada; el modelo posiciona dentro del rango y el use case re-valida con clamps + orden cierre ≤ sugerido ≤ prueba. El botón se deshabilita sin comparables.

### `/extract-entity` y `/extract-image`
Agente pega texto de WhatsApp o screenshot del cliente. Devuelve `LeadIntent`: nombre, teléfono, email, barrio, tipo propiedad, operación, presupuesto. Pre-llena el formulario de nuevo lead.

### `/landings/:id/edit-block`
Bloque actual + prompt → bloque actualizado validado contra el schema Zod del tipo (`domain/value-objects/block-schemas.ts`). Si falla la validación → `schema_mismatch`. Rate limit: **30 ediciones IA por minuto** (`AI_EDITS_PER_MINUTE` en `domain/rules/landing-rules.ts`).

## Manejo de errores

- Falta `GEMINI_API_KEY` → **503** con mensaje explícito (guard en el constructor del adapter).
- 401/403 del proveedor → **502**, nunca 401 (un 401 nuestro desloguea al usuario — ver `provider-error.ts`).
- 400/413/415/422 del proveedor → se propagan (son del input del usuario).

## Servicios

`infrastructure/src/services/gemini-ai-service.ts` (adapter único) y `http-listing-page-fetcher.ts` (fetch de avisos). Ver [[Servicios-externos]].
