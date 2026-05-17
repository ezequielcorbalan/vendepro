# 📝 Dominio: Formularios de visita

Dos sistemas coexistentes para capturar visitas a propiedades:

## 1. `visit_forms` (dinámico, mig 008)

Formulario configurable con campos custom. Pensado para encuestas previas al show.

- **`VisitForm`** (`domain/entities/visit-form.ts`)
  - `id`, `org_id`, `property_id`, `public_slug`, `fields` (JSON array de `VisitFormField`: key, label, type, required, options)
- **`VisitFormResponse`** — respuesta del visitante

URL pública: `/v/[slug]` en frontend → [[API-public]] `GET /public/visit-form/:slug` y `POST /public/visit-form/:slug`.

## 2. `property_visit_forms` (fijo, mig 012)

Ficha post-visita estandarizada (un slug por visita, no por propiedad).

- Campos: `visitor_name/email/phone`, `liked`, `disliked`, `subjective_price_usd`, `buy_intention`, `observations`
- Auditoría: `sent_at`, `submitted_at`

URL pública: `/v/[slug]` → [[API-public]] `GET /public/property-visit-form/:slug` y `POST /public/property-visit-form/:slug/submit`.

## ¿Cuándo usar cada uno?

| Caso | Sistema |
|---|---|
| Encuesta previa custom con campos variables | `visit_forms` |
| Ficha estándar post-visita | `property_visit_forms` |

Frontend muestra ambos en `VisitFormsSection.tsx` dentro del detalle de propiedad.

## Endpoints (autenticados, gestión)

[[API-properties]]:
- `GET /visit-forms`, `POST /visit-forms`

## Use cases

- `CreateVisitFormUseCase`, `GetVisitFormBySlugUseCase`, `SubmitVisitFormUseCase`, `SubmitVisitFormResponseUseCase`, `ListVisitFormsByPropertyUseCase`, `GenerateVisitFormLinkUseCase`

## Relacionados

- [[Dominio-Propiedades]]
- [[Dominio-Reportes]] (las respuestas alimentan reportes)
