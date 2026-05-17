# 🌍 API-public

Worker para rutas públicas (sin autenticación). Sirve reportes, tasaciones, prefactibilidades, formularios de visita y landings al público externo.

| Campo | Valor |
|---|---|
| Path | `packages/api-public/` |
| Subdominio | `public.api.vendepro.com.ar` |
| Bindings | D1, R2 |
| Secrets | (sin `JWT_SECRET`) |
| Middleware | cors, error-handler (**sin** auth) |

## Endpoints

### Recursos públicos por slug

| Método | Path | Use case |
|---|---|---|
| GET | `/public/report/:slug` | GetPublicReportUseCase — reporte de propiedad |
| GET | `/public/appraisal/:slug` | GetPublicAppraisalUseCase — tasación pública |
| GET | `/public/visit-form/:slug` | GetPublicVisitFormUseCase — formulario dinámico |
| POST | `/public/visit-form/:slug` | SubmitVisitFormResponseUseCase |
| GET | `/public/property-visit-form/:slug` | GetVisitFormBySlugUseCase — ficha post-visita |
| POST | `/public/property-visit-form/:slug/submit` | SubmitVisitFormUseCase |
| GET | `/public/prefact/:slug` | GetPublicPrefactibilidadUseCase |

### Captura de leads pública (API-key gated)

| Método | Path | Use case | Auth |
|---|---|---|---|
| POST | `/public/leads` | CreatePublicLeadUseCase + marketing event | Header `X-API-Key` (de `organizations.api_key`) |

Body: `{full_name, phone, email, source_detail, operation, notes, visitorId, ga4_client_id}`.

Usado por integraciones externas (formularios en otros sitios, scripts de captura) para crear leads sin necesidad de un usuario logueado.

### Landings públicas — [[Dominio-Landings]]

| Método | Path | Use case |
|---|---|---|
| GET | `/l/:slug` | GetPublicLandingUseCase (slug = `full_slug` = `slug_base-slug_suffix`) |
| POST | `/l/:slug/submit` | SubmitLeadFromLandingUseCase + marketing event `landing_lead_submitted` |
| POST | `/l/:slug/event` | RecordLandingEventUseCase (pageview, cta_click, form_start, form_submit) |

### Descarga de PDFs (JWT-gated)

| Método | Path | Auth |
|---|---|---|
| GET | `/public/pdf/:orgId/:appraisalId/:filename?token=...` | JWT corto firmado por [[Servicios-externos|PdfDownloadTokenSigner]] |

El token corto se genera al pedir el PDF de una tasación y permite descargarlo sin estar logueado.

## Notas

- Esta API resuelve `org_id` desde el recurso (ej. `appraisals.org_id`), no desde un JWT, porque no hay sesión.
- Multi-tenant funciona porque cada recurso tiene su `org_id` propio.
- El cliente potencial (visitor) puede ser identificado vía `visitorId` (cookie del frontend) y `ga4_client_id` para attribution.
- Submit de formularios dispara eventos a Meta CAPI + GA4 si la org tiene la integración habilitada.
