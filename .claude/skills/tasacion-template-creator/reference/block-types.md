# Tipos de bloque — referencia de schemas

Fuente de verdad: `vendepro-backend/packages/core/src/domain/value-objects/appraisal-block-schemas.ts`
(+ `appraisal-block-type.ts`, `appraisal-binding-mode.ts`). Si algo de acá no coincide con esos
archivos, **mandan los archivos** y hay que actualizar esta referencia.

Cada bloque del array `blocks_json` tiene esta forma:

```json
{ "id": "b-xxx", "type": "<tipo>", "binding_mode": "<modo>", "include_in_pdf": true, "sort_order": 0, "data": { ... } }
```

- `id`: string único dentro del template (convención: `b-<algo>`, ej. `b-cover`, `b-comparables-pub`).
- `sort_order`: entero, define el orden de render (0, 1, 2, …). Debe ser coherente con la posición en el array.
- `include_in_pdf`: boolean. **Web-only ⇒ obligatoriamente `false`** (el Zod lo rechaza si no).
- `data`: shape específico por `type` (abajo).

## binding_mode (cómo se llena el dato)

| modo | cuándo usarlo |
|------|---------------|
| `system` | dato fijo escrito en el template (ej. el funnel de ejemplo). No depende de org ni tasación. |
| `org-static` | contenido fijo de la inmobiliaria (propuesta comercial, servicios, metodología, condiciones por defecto). |
| `org-variable` | referencia a `org_variables` por key; se resuelve en vivo. Usar en `market_stats` (`vars`) y `notary_charts` (`chart_*_var`). |
| `tasacion` | se completa con datos de la tasación concreta vía `source`. En el template solo va el título. Usar en `cover`, `property_data`, `swot`, `zone_map`, `comparables_list`, `price_projection`. |
| `default-override` | valor por defecto que el asesor puede editar por tasación. Usar en `work_conditions`. |

## include_in_pdf — reglas

- **Web-only (`video_gallery`, `extra_media`, `cta_whatsapp`, `agent_contact_card`)**: SIEMPRE `false`.
- **PDF-locked** (el usuario no puede cambiar el flag en UI, pero en el seed va `true`): `cover`, `property_data`, `swot`, `price_projection` + los web-only.
- El resto: normalmente `true` en templates de sistema.

---

## Estructurales

### `cover`
```json
"data": { "title": "...", "subtitle": "...", "cover_image_url": "https://...", "agent_display": { "name": "...", "phone": "...", "email": "...", "avatar_url": "https://..." } }
```
Todos opcionales. Sin `cover_image_url` ⇒ cae al degradado de marca (logo + título + dirección + ficha asesor). `binding_mode` habitual: `tasacion`. `title` ≤200, `subtitle` ≤300.

### `proposal_commercial`
```json
"data": { "title": "...", "subtitle": "...", "items": [ { "icon": "target", "title": "SEGUIMIENTO", "body": "..." } ] }
```
`items` ≤8; cada item: `title` (req, ≤120), `body` (req, ≤600), `icon` opcional (≤40). `binding_mode`: `org-static`.

### `services_grid`
```json
"data": { "title": "...", "services": [ { "icon": "camera", "label": "Fotografía HDR" } ], "portals_logos": ["https://..."], "badge_text": "Anunciante Premier" }
```
`services` ≤12 (cada uno `label` req ≤120, `icon` opcional). `portals_logos` ≤8 (URLs). `badge_text` ≤80. `binding_mode`: `org-static`.

### `market_stats`
```json
"data": { "title": "...", "vars": ["market.properties_on_sale", "market.properties_sold", "market.conversion_rate", "market.reference_period"] }
```
`vars` ≤8, cada key matchea `/^[a-zA-Z][a-zA-Z0-9_.]*$/` y debe existir como `org_variable`. `binding_mode`: `org-variable`.

### `funnel_chart`
```json
"data": { "title": "...", "funnel": [ { "label": "Clics diarios", "value": 22 } ], "ranges": [ { "label": "Zona de prueba", "from": 10, "to": 30, "color": "#9ca3af" } ] }
```
`funnel` ≤10 (`label`, `value` número). `ranges` ≤6 opcional (`label`, `from`, `to`, `color` opcional). `binding_mode`: `system`.

### `methodology`
```json
"data": { "title": "...", "body": "...", "image_url": "https://...", "highlight_text": "..." }
```
`body` requerido (≤2000). `image_url` opcional, `highlight_text` ≤400. `binding_mode`: `org-static`.

### `notary_charts`
```json
"data": { "title": "...", "chart_1_var": "notary.sales_chart", "chart_2_var": "notary.semester_chart" }
```
`chart_*_var` opcionales, son keys de `org_variables`. `binding_mode`: `org-variable`.

---

## Dinámicos (se llenan con la tasación; en el template solo título)

### `property_data`
```json
"data": { "title": "...", "source": "appraisal.*" }
```
`source` opcional pero si va debe ser literal `"appraisal.*"`. `binding_mode`: `tasacion`.

### `swot`
```json
"data": { "title": "FODA", "source": "appraisal.swot" }
```
`source` literal `"appraisal.swot"`. `binding_mode`: `tasacion`.

### `zone_map`
```json
"data": { "title": "...", "map_image_url": "https://...", "neighborhood_name": "...", "min_m2_price": 0, "avg_m2_price": 0, "median_m2_price": 0, "published_count": 0 }
```
Todos opcionales. En sistema suele ir solo `title` (el resto lo completa la tasación). `binding_mode`: `tasacion`.

### `comparables_list`
```json
"data": { "title": "...", "source": "appraisal.comparables", "variant": "published" }
```
**`variant` es OBLIGATORIO**: `"published"` o `"reserved"`. `source` literal `"appraisal.comparables"` (opcional). `binding_mode`: `tasacion`. Para mostrar publicados y reservados, usar DOS bloques con ids distintos.

### `price_projection`
```json
"data": { "title": "Tasación proyectada", "source": "appraisal.prices" }
```
`source` literal `"appraisal.prices"`. `binding_mode`: `tasacion`.

### `work_conditions`
```json
"data": { "title": "...", "honorarios_pct": 3, "exclusividad_dias": 120, "required_docs": ["Escritura","DNIs"], "extras": [], "legal_text": "...", "signature_image_url": "https://..." }
```
`honorarios_pct` 0–100. `exclusividad_dias` 0–365. `required_docs`/`extras` ≤20 cada uno. `legal_text` ≤2000. `binding_mode`: `default-override`.

---

## Web-only (include_in_pdf SIEMPRE false)

### `video_gallery`
```json
"data": { "title": "...", "videos": [ { "url": "https://...", "caption": "...", "provider": "youtube" } ] }
```
`videos` ≤12; cada uno `url` (req), `provider` ∈ `youtube|vimeo|r2` (req), `caption` opcional ≤200.

### `extra_media`
```json
"data": { "title": "...", "media": [ { "type": "image", "url": "https://...", "caption": "..." } ] }
```
`media` ≤24; `type` ∈ `image|video`, `url` req, `caption` opcional.

### `cta_whatsapp`
```json
"data": { "text": "Hablemos", "phone": "5491100000000", "pre_filled_message": "Hola..." }
```
`text` req (≤200), `phone` req (6–30), `pre_filled_message` opcional ≤500.

### `agent_contact_card`
```json
"data": { "name": "...", "avatar_url": "https://...", "phone": "...", "email": "a@b.com", "whatsapp_link": "https://wa.me/..." }
```
`name` req (≤120). `email` debe ser email válido o `""`. Resto opcional.
