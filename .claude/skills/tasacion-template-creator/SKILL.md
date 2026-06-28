---
name: tasacion-template-creator
description: "Crea templates de SISTEMA de tasación (appraisals) para VendéPro como migración SQL seed. Usar cuando el pedido sea crear/agregar/armar/seedear un nuevo template o plantilla de tasación de sistema, un appraisal template predefinido (org_id NULL, is_system=1), o una migración que inserte en appraisal_templates. Cubre los 17 tipos de bloque, sus binding_mode, y valida el blocks_json contra el Zod real del backend antes de entregar."
---

# Creador de templates de sistema para tasaciones

Genera una **migración SQL** que siembra un template de sistema en la tabla `appraisal_templates`
(`org_id=NULL`, `agent_id=NULL`, `is_system=1`), siguiendo las convenciones del repo y **validando**
el `blocks_json` contra el Zod real del backend antes de entregar.

## Cuándo usar este skill

**Usar cuando** el pedido sea:
- "crear / agregar / armar un template (o plantilla) de tasación de sistema"
- "seedear un appraisal template", "nueva migración de appraisal_templates"
- "quiero un template predefinido para <casa/depto/terreno/local/PH/…>"

**No usar para**:
- Crear templates de **org o de agente** (esos van por la UI / `POST /appraisal-templates`). Este skill
  es solo para templates de **sistema** (seed por migración).
- Editar el renderer, los componentes de bloque, o la lógica de hidratación.

## Archivos de referencia (leer según haga falta)

- `reference/block-types.md` — los 17 tipos de bloque, su `data`, límites Zod y `binding_mode` recomendado. **Leer siempre antes de armar los bloques.**
- `reference/migration-recipe.md` — convenciones de la migración: nombre, `id`, columnas, fechas, escapado, cómo validar. **Leer siempre antes de escribir el .sql.**
- `scripts/validate-blocks.ts` — validador (reusa el Zod real → cero drift).

## Flujo (seguir en orden)

### 1. Brief
Reunir lo mínimo para diseñar el template. Si falta algo clave, preguntar (1 ronda, conciso):
- ¿Para qué tipo de propiedad? → define `kind` (`casa|depto|terreno|corporativo|custom`).
- ¿Foco/longitud? (completo estilo Casa-Estándar vs reducido estilo Light/Corporativo).
- ¿Portada con foto o sin foto (degradado de marca)?
- ¿Honorarios % y días de exclusividad? ¿Docs requeridos?
- ¿Algún bloque a excluir o incluir sí o sí?

Si el usuario da un brief libre, inferir lo razonable y solo preguntar lo que realmente bloquea.

### 2. Diseñar los bloques
Leer `reference/block-types.md`. Elegir la lista de bloques y, para cada uno, su `binding_mode`
e `include_in_pdf` correctos. Reglas que más se olvidan:
- `comparables_list` **requiere `variant`** (`published`/`reserved`); usar dos bloques si querés ambos.
- Web-only (`video_gallery`, `extra_media`, `cta_whatsapp`, `agent_contact_card`) ⇒ `include_in_pdf: false`.
- Bloques `tasacion` (cover, property_data, swot, zone_map, comparables_list, price_projection): en el
  template va solo el título; los datos los pone cada tasación.
- `sort_order` de los bloques: 0,1,2… en el mismo orden del array.

Tomar como modelos los seeds existentes: `migrations_v2/018` (Casa/Terreno/Corp), `023` (demo con los 17 tipos), `030` (Light, 5 bloques).

### 3. Generar
Leer `reference/migration-recipe.md`. Escribir:
1. Primero el `blocks_json` como `.json` en el scratchpad (para validar limpio).
2. Luego la migración `vendepro-backend/migrations_v2/NNN_appraisal_template_<slug>.sql` con la plantilla
   del recipe (id `sys-appraisal-<slug>-v1`, columnas de la 030, fechas ISO, `INSERT OR IGNORE`).
Cuidar el escapado de apóstrofes (`'` → `''`) dentro del `blocks_json`.

### 4. Validar (BLOQUEANTE — no saltear)
```bash
npx -y tsx .claude/skills/tasacion-template-creator/scripts/validate-blocks.ts <ruta-al-.sql-o-.json>
```
- Exit 0 ⇒ seguir. Exit ≠0 ⇒ leer el error de Zod, corregir el bloque y **re-validar**. Repetir hasta pasar.
- **Si el validador no puede ejecutarse por falta de herramientas, instalarlas — NO entregar sin validar:**
  - `tsx` ausente → `npx -y tsx` ya lo descarga; si igual falla, instalar: `cd vendepro-backend && npm install -D tsx`.
  - `Cannot find module 'zod'` / sin `node_modules` → `cd vendepro-backend && npm install`, después re-validar.
  - Cualquier otra dependencia faltante para verificar ⇒ instalarla y reintentar. La validación es obligatoria.

### 5. Entregar
Resumir:
- Archivo creado y su ruta.
- `kind`, `id`, lista de bloques (tipo + binding_mode).
- Resultado de la validación (✓).

### 6. Preguntar si pushear a main (aplica la migración automática)
Una vez validado el template, **preguntar al usuario si quiere pushear a `main`** para que la
migración se aplique sola. Un push a `main` que toque `vendepro-backend/migrations_v2/**` dispara el
workflow `migrate.yml` (`wrangler d1 migrations apply vendepro-db --remote`) → la migración corre en
producción por el pipeline. Esto **no** viola "nunca deploy desde la terminal": el push es el camino
sancionado; quien aplica la migración es GitHub Actions, no la terminal.

- **Solo ofrecer pushear si la validación pasó (exit 0).** Nunca pushear una migración inválida.
- Si el usuario dice que **sí**: `git add` del `.sql`, commit con mensaje descriptivo
  (ej. `feat(tasaciones): template de sistema <nombre>`) y `git push` a `main`. Avisar que la
  migración se aplicará automáticamente vía `migrate.yml` y que puede seguir el run en Actions.
- Si dice que **no**: dejar el archivo listo y recordar que la migración se aplicará cuando se
  mergee/pushee a `main`.
