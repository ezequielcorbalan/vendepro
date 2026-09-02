# 🤖 API-ai

Worker que envuelve LLMs (Anthropic + Groq) para tareas específicas.

| Campo | Valor |
|---|---|
| Path | `packages/api-ai/` |
| Subdominio | `ai.api.vendepro.com.ar` |
| Bindings | D1 |
| Secrets | `JWT_SECRET`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY` |
| Middleware | cors, error-handler, auth |

## Endpoints

| Método | Path | Use case | Provider |
|---|---|---|---|
| POST | `/extract-metrics` | ExtractPropertyMetricsUseCase | **Anthropic** Claude haiku 4.5 — `{imageBase64 \| image}` → métricas de portal |
| POST | `/extract-entity` | ExtractLeadFromTextUseCase | **Groq** `compound-mini` — `{text}` → campos de lead |
| POST | `/extract-image` | ExtractLeadFromImageUseCase | **Groq** `qwen3.8-27b` (visión) — `{imageBase64, mimeType}` → campos de lead |
| POST | `/landings/:id/edit-block` | EditBlockWithAIUseCase | **Groq** `compound` — `{prompt, scope, blockId}` → bloque modificado |

## Casos de uso

### `/extract-metrics` (Anthropic)
Agente sube screenshot de Zonaprop / Argenprop / MercadoLibre. Claude haiku extrae: impresiones, visitas, consultas, llamadas, posición de ranking, precio promedio. Resultado se guarda en `report_metrics` (ver [[Dominio-Reportes]]).

### `/extract-entity` y `/extract-image` (Groq)
Agente pega texto de WhatsApp o screenshot del cliente. El use case devuelve `LeadIntent`: nombre, teléfono, email, barrio, tipo propiedad, operación, presupuesto, timing. El frontend lo usa para pre-llenar el formulario de nuevo lead.

### `/landings/:id/edit-block` (Groq)
Agente edita una landing y escribe "haceme un copy más urgente para el hero". Groq `compound` recibe el bloque actual y el prompt, devuelve el bloque actualizado validado contra el schema Zod del tipo (ver `domain/value-objects/block-schemas.ts`). Si falla la validación → error `schema_mismatch`. Hay rate limit: **30 ediciones IA por minuto** (constante `AI_EDITS_PER_MINUTE` en `domain/rules/landing-rules.ts`).

## Servicios

Ver [[Servicios-externos]] para detalle de `anthropic-ai-service.ts` y `groq-ai-service.ts`.
