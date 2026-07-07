# Tasaciones — Edición inline de bloques preseteados + fondo en el canvas WYSIWYG

**Fecha:** 2026-07-07
**Autor:** Ezequiel Corbalán + Claude
**Estado:** Diseño aprobado, pendiente de plan de implementación
**Contexto previo:** `docs/superpowers/specs/2026-04-24-tasaciones-templates-frontend-design.md` (editor y canvas WYSIWYG originales)

---

## 1. Alcance y objetivo

Hoy el canvas WYSIWYG de una tasación (`EditableCanvas.tsx`) solo permite edición inline (texto contenteditable, imagen, reordenar) para los **bloques libres** (`heading`, `rich_text`, `image`, `gallery`, `divider`, `callout`, `button_link`). Los **17 bloques estructurados/preseteados** que vienen de un template (cover, market_stats, swot, methodology, comparables_list, etc.) son de solo lectura en el canvas — se editan desde un panel lateral separado (`BlockForm` vía botón "Editar campos").

Esta feature extiende el canvas para que los bloques preseteados también se editen ahí, unificando la experiencia, y agrega una capacidad nueva que hoy no existe en ningún tipo de bloque: **color de fondo libre por bloque**.

**Incluye:**
1. Edición inline de texto simple y de imágenes ya existentes en bloques estructurados, directo sobre el canvas.
2. Edición de listas/arrays y datos calculados de bloques estructurados vía popover anclado al bloque, sin salir del canvas.
3. Color de fondo (color picker libre) por bloque, para **todos** los tipos de bloque (libres y estructurados).
4. Preservar la semántica de candado/override por `binding_mode` — ahora disparada desde el canvas en vez del panel lateral.

**Fuera de alcance:**
- Imagen de fondo (solo color sólido).
- Agregar campo de imagen a bloques que hoy no tienen ninguno (swot, market_stats, comparables_list, funnel_chart, notary_charts, property_data, proposal_commercial, services_grid, price_projection, cta_whatsapp, agent_contact_card).
- Cambios al editor de templates en configuración (`admin/TemplateEditor.tsx`) — solo aplica al editor de una tasación puntual (`EditableCanvas.tsx` / `EditorShell.tsx`).
- Paleta de color acotada a marca — se usa un color picker libre (decidido explícitamente sobre limitar a brand colors).

---

## 2. Decisiones clave

| Decisión | Elegido | Razón |
|---|---|---|
| Dónde vive `background_color` | Dentro de `data` de cada bloque, no como campo nuevo en el wrapper `TemplateBlock` | `data` ya es `Record<string, unknown>` y ya tiene mecanismo de override (`block_overrides_json`) funcionando por bloque — cero cambios al modelo de override |
| Cómo se extiende el schema Zod | Extensión genérica aplicada una sola vez sobre los 24 schemas (`background_color: z.string().optional()`), no editado a mano en cada uno | Evita tocar 24 archivos/definiciones individualmente |
| Cómo se aplica visualmente | Un único wrapper compartido en `BlockRenderer.tsx`/`TemplateRenderer.tsx` lee `data.background_color` y setea `backgroundColor` inline | Funciona automáticamente en preview del editor, PDF y landing pública sin tocar cada componente de bloque |
| Edición de texto simple en bloques estructurados | `contenteditable` inline reusando `InlineEditable` (mismo componente que bloques libres) | Reuso total, sin componente nuevo |
| Edición de imágenes ya existentes (cover, methodology, zone_map, work_conditions) | Reusa `ImageEditControls` (mismo patrón que el bloque libre `image`) | Reuso total |
| Edición de listas/arrays y datos calculados (swot, services_grid, market_stats, comparables_list, price_projection, notary_charts, funnel_chart) | Popover anclado al bloque en el canvas, reutilizando el `BlockForm` existente de ese tipo | Evita reconstruir edición contenteditable para tablas/gráficos y datos que se hidratan desde `appraisal.*` — no es texto libre |
| Selector de color de fondo | Color picker libre (hex/RGB), sin restricción a paleta de marca | Decisión explícita del usuario — prioriza flexibilidad sobre consistencia forzada |
| Candado por `binding_mode` | Se mantiene. Blocks `system`/`org-static`/`org-variable` siguen mostrando candado; cualquier edición desde el canvas (texto, imagen, fondo) genera `block_overrides_json` en vez de tocar el template. Blocks `tasacion`/`default-override` editan directo el `data` del snapshot | Mismo mecanismo de hoy, solo cambia el punto de entrada (canvas en vez de panel lateral) |
| Bloques libres también reciben `background_color` | Sí, gratis, por ser una propiedad genérica de `data` + wrapper compartido | Consistencia sin costo adicional |

---

## 3. Modelo de datos

```ts
// Sin cambios en la forma del wrapper:
export interface TemplateBlock {
  id: string
  type: AppraisalBlockType
  binding_mode: BindingMode
  include_in_pdf: boolean
  sort_order: number
  data: Record<string, unknown>   // ahora puede incluir background_color?: string
}
```

- Backend: `appraisal-block-schemas.ts` — la función/mapa que construye el schema Zod por tipo se envuelve con una extensión compartida que agrega `background_color: z.string().optional()` a los 24 schemas (17 estructurados + 7 libres), en un solo lugar.
- Frontend: `renderer/types.ts` no cambia de forma (sigue siendo `Record<string, unknown>`); los componentes de bloque leen `data.background_color` opcionalmente.
- Compatibilidad: campo opcional, `undefined` = comportamiento actual (gradiente de marca fijo donde corresponda). No requiere migración de datos existentes.
- Overrides: `block_overrides_json` ya soporta parches parciales sobre `data` por `block.id` — no requiere cambios de mecanismo, solo que el nuevo UI de canvas dispare `patch_override({ background_color })` en vez de `patch_block_data` cuando el bloque está bloqueado.

---

## 4. Comportamiento en el canvas

Por cada bloque estructurado renderizado en `EditableCanvas.tsx`, según el campo:

- **Texto simple** (ej. párrafo de metodología, mensaje de `cta_whatsapp`, bio de `agent_contact_card`): click → `contenteditable` inline, mismo look & feel que bloques libres.
- **Imagen ya soportada** (`cover_image_url`, `methodology.image_url`, `zone_map.map_image_url`, `work_conditions.signature_image_url`, y las de `gallery`/`image` libres): click sobre la imagen → reemplazar, mismo patrón `ImageEditControls`.
- **Listas/arrays y datos calculados** (`swot`, `services_grid`, `market_stats`, `comparables_list`, `price_projection`, `notary_charts`, `funnel_chart`): click en el bloque → popover anclado (nuevo componente, ej. `BlockEditPopover`) que monta el `BlockForm` existente de ese tipo dentro de un contenedor flotante posicionado junto al bloque, en vez de navegar a un panel lateral separado. El preview sigue siendo el mismo canvas de fondo.
- **Fondo**: toolbar hover que ya existe sobre cada bloque (o se agrega si no existe para estructurados) suma un botón de color de fondo, abre un color picker libre; aplica a cualquier tipo de bloque.
- **Candado**: si `binding_mode` es `system`/`org-static`/`org-variable`, el candado se sigue mostrando como indicador visual; cualquier edición desde los puntos anteriores dispara `patch_override` (crea/actualiza `block_overrides_json[block.id]`) en vez de modificar el snapshot directamente. Si es `tasacion`/`default-override`, edita directo vía `patch_block_data`.
- El panel lateral "Editar campos" deja de ser necesario para estos casos pero no se elimina en este alcance salvo que el plan de implementación lo justifique (a evaluar en la etapa de plan).

---

## 5. Render

- `BlockRenderer.tsx` (o el wrapper compartido que envuelve cada bloque antes del switch por `type`) lee `data.background_color` y aplica `style={{ backgroundColor: data.background_color }}` al contenedor del bloque, si está presente.
- Este cambio es único y compartido — no requiere tocar cada uno de los 24 componentes de bloque individualmente.
- Aplica igual en: preview del editor (`editing=true`), PDF (`TemplateRenderer` en modo impresión) y landing pública `/t/[slug]`.
- No afecta `block-completeness.ts` — el fondo es cosmético, no se considera para determinar si un bloque está "completo".

---

## 6. Riesgos / cosas a validar en el plan de implementación

- Confirmar si existe hoy una toolbar hover genérica reusable para bloques estructurados en `EditableCanvas.tsx`, o si hay que crearla (afecta si el botón de fondo es una extensión o un componente nuevo).
- Confirmar qué `BlockForm` por tipo estructurado ya soportan edición de listas/arrays de forma aislada (para reusar dentro del popover) vs cuáles asumen estar dentro del layout completo del panel lateral (podrían necesitar ajuste de estilos, no de lógica).
- Verificar que `patch_override` soporte parches parciales de campos sueltos (incluyendo `background_color`) sin requerir el objeto `data` completo.
- Confirmar location exacta del wrapper compartido en `BlockRenderer.tsx` para aplicar el estilo de fondo sin duplicar lógica entre preview/PDF/landing pública.

---

## 7. No-goals explícitos (recordatorio)

- Sin imagen de fondo.
- Sin campos de imagen nuevos en los 11 bloques que no tienen ninguno.
- Sin cambios al editor de templates de configuración.
- Sin paleta de color restringida — color libre.
