# Recipe de migración — template de sistema

Un **template de sistema** se siembra con una migración SQL (no se crea por UI).
Característica: `org_id = NULL`, `agent_id = NULL`, `is_system = 1`. Es read-only en la app.

Carpeta: `vendepro-backend/migrations_v2/`. **Una migración por template** (ej: 018, 023, 028, 030).

## Convenciones (NO negociables)

- **Número**: usar el próximo entero libre. Mirá los archivos `NNN_*.sql` y tomá el mayor + 1.
  ⚠️ Hay números duplicados históricos (tres `018_*`, dos `017_*`). Para evitar colisión, elegí un
  número claramente por encima del máximo actual.
- **Nombre de archivo**: `NNN_appraisal_template_<slug>.sql` (snake_case).
- **`id` del template**: `sys-appraisal-<slug>-v1`.
- **Orden de columnas**: usar exactamente el de la migración 030 (incluye `agent_id`, agregada en la 025):
  `(id, org_id, agent_id, kind, name, description, preview_image_url, blocks_json, is_system, parent_template_id, active, sort_order, created_at, updated_at)`
- **`kind`**: uno de `casa | depto | terreno | corporativo | custom`.
- **`INSERT OR IGNORE`** (idempotente; no rompe si ya existe).
- **Fechas**: strings ISO literales (ej. `'2026-06-28T00:00:00Z'`). NO usar `datetime()`.
- **Valores fijos**: `org_id=NULL`, `agent_id=NULL`, `is_system=1`, `parent_template_id=NULL`, `active=1`.
- **`sort_order`** del template (último valor antes de las fechas): siguiente disponible entre los
  templates de sistema (los actuales usan 0–4). No confundir con el `sort_order` de cada bloque.

## Plantilla SQL

```sql
-- Migration NNN — Seeds 1 system appraisal template "<Nombre>".
-- <1-2 líneas describiendo el caso de uso y los bloques>.

INSERT OR IGNORE INTO appraisal_templates
  (id, org_id, agent_id, kind, name, description, preview_image_url, blocks_json, is_system, parent_template_id, active, sort_order, created_at, updated_at)
VALUES (
  'sys-appraisal-<slug>-v1', NULL, NULL, '<kind>',
  '<Nombre visible>',
  '<Descripción para el selector de templates>',
  NULL,
  '[
    { ...bloque 1... },
    { ...bloque 2... }
  ]',
  1, NULL, 1, <sort_order>, '<ISO>', '<ISO>'
);
```

## Escapado dentro de blocks_json

El `blocks_json` es un string SQL entre comillas simples. Si algún texto del JSON contiene una
comilla simple (`'`), **duplicala** (`''`) para no romper el SQL. Ej: `"body":"L''Hereu"`.
El JSON usa comillas dobles, así que esto solo aplica a apóstrofes dentro de los valores.

## Validación obligatoria (bloqueante)

Antes de dar el template por terminado, validá el `blocks_json` contra el Zod real:

```bash
# desde la raíz del repo
npx -y tsx .claude/skills/tasacion-template-creator/scripts/validate-blocks.ts <ruta-al-.sql-o-.json>
```

- Exit 0 ⇒ válido. Exit ≠0 ⇒ corregir y re-validar. **No se entrega sin pasar.**
- `npx -y tsx` descarga `tsx` solo si falta.
- Si falla por `Cannot find module 'zod'` / falta `node_modules`: `cd vendepro-backend && npm install`, después re-validar.

## Aplicar la migración

**NUNCA deploy/migrate desde la terminal** (regla de CLAUDE.md). Las migraciones se aplican por el
pipeline normal (GitHub Actions / Cloudflare Dashboard). El skill solo deja el `.sql` listo y validado.
