# 💾 Cómo agregar una migration D1

## 1. Numeración

Las migrations viven en `vendepro-backend/migrations_v2/`. Naming: `NNN_descripcion.sql`.

- Mirá la última migration aplicada (`ls migrations_v2/`)
- Tomá el siguiente número (3 dígitos con padding: `021`, `022`, etc.)
- Si trabajás en paralelo con otro desarrollador, está OK que haya 2 migrations con el mismo número — el workflow las aplica en orden alfabético

Naming ejemplos:
- `021_add_lead_estimated_close_date.sql`
- `022_create_email_templates_table.sql`

## 2. Estilo SQL

```sql
-- 021_descripcion_breve.sql
-- Propósito: agregar columna X a la tabla Y para Z

ALTER TABLE leads ADD COLUMN estimated_close_date TEXT;
CREATE INDEX IF NOT EXISTS idx_leads_estimated_close
  ON leads(estimated_close_date);
```

Buenas prácticas:
- Una migration = un cambio lógico
- Usá `IF NOT EXISTS` en CREATE TABLE / CREATE INDEX para idempotencia
- D1 (SQLite) no soporta DROP COLUMN bien — si necesitás removerla, mirá la migration `018` que usa el patrón RENAME + ADD + DROP

## 3. Restricciones D1 (vs Postgres)

- ❌ No hay ENUM nativo → usar TEXT + CHECK constraint, o validar en código
- ❌ No hay `ALTER TABLE ... DROP CONSTRAINT`
- ❌ DROP COLUMN solo en SQLite recientes — usar el workaround de RENAME + CREATE NEW + INSERT + DROP OLD si hace falta
- ✓ CHECK constraints sí funcionan
- ✓ FK constraints sí funcionan (pero no se enforcean a menos que actives `PRAGMA foreign_keys = ON` en cada conexión; en D1 generalmente no se hace)
- ✓ Triggers sí

Memoria: hay un fix reciente `5429878 fix(migrations): 018 ahora usa RENAME+ADD+DROP en lugar de DROP TABLE` — confirmación del patrón.

## 4. Catálogos seed

Si creás un catálogo (ej. nuevo tipo de actividad), agregá los seeds en la misma migration:

```sql
CREATE TABLE IF NOT EXISTS mi_catalogo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL
);

INSERT OR IGNORE INTO mi_catalogo (slug, label) VALUES
  ('opcion_a', 'Opción A'),
  ('opcion_b', 'Opción B');
```

## 5. Backfill

Si una columna nueva necesita valores para rows existentes:

```sql
ALTER TABLE leads ADD COLUMN urgency TEXT;
UPDATE leads
  SET urgency = 'ok'
  WHERE urgency IS NULL;
```

## 6. Multi-tenancy

Toda tabla nueva debe tener `org_id TEXT NOT NULL`. Considerá:
- Default si es para org única: `DEFAULT 'org_mg'`
- Índice típico: `(org_id, ...)`

Ver convenciones en [[DB-overview]] y [[Reglas-criticas]].

## 7. Aplicar (NO desde terminal)

⚠️ NO ejecutar `wrangler d1 migrations apply` desde tu máquina. Ver [[Reglas-criticas]].

Flujo:
1. Crear archivo en `migrations_v2/`
2. Commit + push a una rama
3. PR a `main`
4. Tests pasan → merge
5. Workflow `migrate.yml` se dispara al detectar cambios en `migrations_v2/**` y aplica las pendientes a `vendepro-db`

Memoria: `reference_migrations_deploy` — confirma este flujo.

## 8. Repos + Use cases

Si la migration introduce una tabla nueva:
- Crear D1 repo en `infrastructure/src/repositories/d1-...-repository.ts`
- Crear port en `core/src/application/ports/repositories/...`
- Crear use cases y routes (ver [[Como-agregar-endpoint]])

Si solo agregás una columna a tabla existente:
- Actualizar la entidad de dominio
- Actualizar el D1 repo (SELECT * automáticamente la trae, pero los INSERT/UPDATE hay que ampliarlos)

## 9. Actualizá la KB

- Documentá la tabla nueva en [[DB-overview]]
- Si es un dominio nuevo → crear nota `[[Dominio-...]]` y enlazar desde [[MOC]]
