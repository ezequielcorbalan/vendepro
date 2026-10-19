# 📊 Dominio: Prefactibilidades

> ⚠️ **Las pantallas internas se sacaron el 22-sep-2026** (pedido de Gastón).
> Ya no existen `/prefactibilidades` ni `/prefactibilidades/nueva`, ni el botón
> "Prefactibilidad" de Tasaciones. **Siguen vivos**: la página pública
> `/p/<slug>` (para que no se rompan los links ya compartidos), las rutas de
> api-properties/api-public, la entidad y la tabla `prefactibilidades`. O sea:
> no se pueden crear ni listar desde la app, pero nada se borró.

Análisis de viabilidad de proyectos inmobiliarios (terrenos para desarrollar). Output: reporte con TIR, payback, margen y comparables.

## Entidad

**`Prefactibilidad`** (`domain/entities/prefactibilidad.ts`) — entidad gigante con ~50 campos:

- Lote: `address`, `lot_area`, `lot_frontage`, `lot_depth`, `zoning`, `fot`, `fos`, `max_height`, `lot_price`, `lot_price_per_m2`, `lot_description`, `lot_photos` (JSON)
- Proyecto: `project_name`, `project_description`, `buildable_area`, `total_units`, `units_mix` (1A/2A/3A), `parking_spots`, `amenities`, `project_renders`
- Costos: `construction_cost_per_m2`, `total_construction_cost`, `professional_fees`, `permits_cost`, `commercialization_cost`, `other_costs`, `total_investment`
- Retorno: `avg_sale_price_per_m2`, `total_sellable_area`, `projected_revenue`, `gross_margin`, `margin_pct`, `tir`, `payback_months`
- Análisis: `comparables` (JSON), `timeline`, `executive_summary`, `recommendation`, `video_url`, `agent_notes`
- Workflow: `status` (draft|generated|sent), `public_slug`, `lead_id`, `agent_id`

## Tabla D1

`prefactibilidades` (ver [[DB-overview]]) — Índices: `org_id`, `agent_id`, `public_slug`.

## Use cases

- `CreatePrefactibilidad`, `GetPrefactibilidades`, `GetPrefactibilidadDetail`
- `GetPublicPrefactibilidad` (público)

## Endpoints

[[API-properties]]:
- `GET /prefactibilidades`, `POST /prefactibilidades`

[[API-public]]:
- `GET /public/prefact/:slug`

## Frontend

- ~~`/prefactibilidades` (lista)~~ — sacada 22-sep-2026
- ~~`/prefactibilidades/nueva` (formulario gigante)~~ — sacada 22-sep-2026
- `/p/<slug>` (pública) — sigue activa
- Página pública: `/p/[slug]`

## Relacionados

- [[Dominio-Leads]] (origen: lead de desarrollador/inversor)
