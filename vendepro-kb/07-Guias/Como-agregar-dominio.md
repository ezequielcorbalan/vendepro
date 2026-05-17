# 🧱 Cómo agregar un dominio nuevo

Suma de [[Como-agregar-migration]] + [[Como-agregar-endpoint]] + [[Como-agregar-pagina]] + decisiones de diseño.

## 1. Diseño previo

Antes de tocar código, definir:

1. **Entidad**: ¿qué representa? ¿qué campos? ¿qué métodos de negocio?
2. **Estados**: ¿tiene stages/transiciones? Si sí, modelar value-object con tabla de transiciones válidas (mirá `lead-stage.ts` como referencia)
3. **Relaciones**: ¿qué entidades existentes referencia? ¿qué FKs?
4. **Multi-tenant**: confirmá `org_id`
5. **Permisos**: ¿qué roles pueden hacer qué? (usar `role-rules.ts`)
6. **Side effects**: ¿hay que disparar marketing event? ¿notificación? ¿historial en `stage_history`?
7. **Frontend**: ¿lista? ¿detalle? ¿kanban? ¿mobile/desktop-first?

## 2. Estructura de archivos backend

```
packages/core/src/
├── domain/
│   ├── entities/mi-entidad.ts
│   ├── value-objects/mi-entidad-status.ts   # si tiene transiciones
│   └── rules/mi-entidad-rules.ts            # si tiene reglas de negocio
├── application/
│   ├── ports/repositories/mi-entidad-repository.ts
│   └── use-cases/mi-entidad/
│       ├── create-mi-entidad.ts
│       ├── get-mi-entidades.ts
│       ├── update-mi-entidad.ts
│       └── delete-mi-entidad.ts

packages/core/tests/use-cases/mi-entidad/
   ├── create-mi-entidad.test.ts
   └── ...

packages/infrastructure/src/repositories/
   └── d1-mi-entidad-repository.ts
```

## 3. Elegir el worker

Según el dominio, va a un worker existente o requiere uno nuevo. **Casi siempre va a uno existente** (típicamente [[API-crm]]).

Si tu dominio es comercial puro → [[API-crm]] o [[API-properties]] o [[API-transactions]].
Si es analítico → [[API-analytics]].
Si es admin → [[API-admin]].

⚠️ Crear un worker nuevo es **caro**: nuevo subdominio, nuevo workflow, nueva binding config. Solo si es una superficie totalmente nueva (ej. nuevo producto).

## 4. Migration

Ver [[Como-agregar-migration]]. Crear tabla(s) + índices + seeds si aplica.

## 5. Frontend

- Página(s) en `src/app/(dashboard)/<seccion>/`
- Tipos en `lib/types.ts`
- Helper de fetch específico si tiene mucha lógica (ej. patrón `landings/api.ts`)
- Componentes reutilizables en `components/<dominio>/`
- Link en `lib/nav-config.ts`

## 6. KB

Crear:
- `03-Dominios/Dominio-Mi-entidad.md` siguiendo el patrón de los existentes:
  - Pipeline / estados (si aplica)
  - Entidad(es)
  - Tablas D1
  - Use cases
  - Endpoints
  - Frontend
  - Reglas de negocio
  - Relacionados (wikilinks)

Actualizar:
- `[[MOC]]` — agregar a la lista de dominios
- `[[DB-overview]]` — agregar tabla(s)
- `[[API-X]]` — agregar endpoints
- `[[Frontend-rutas]]` — agregar páginas

## 7. Marketing integration (opcional)

Si los cambios de stage deben disparar eventos a Meta/GA4:
- Pasar el `MarketingSenderFactory` al use case
- Llamar `factory.execute({ org_id, stage_key, entity_type, entity_id })` después de guardar
- Configurar `stage_event_mappings` en runtime (UI en `/configuracion/marketing`)

Ver [[Dominio-Marketing]].

## 8. Tests

- Unit tests del use case (mockear repos)
- Smoke test del endpoint (opcional pero recomendado)
- Si hay UI compleja, test con `@testing-library/react`

## 9. PR checklist

- [ ] Migration aplicable y reversible mentalmente
- [ ] Repo + Use case + Test
- [ ] Endpoint en el worker correcto
- [ ] Frontend con loading/empty/error
- [ ] Sidebar link (si aplica)
- [ ] Tipos compartidos
- [ ] KB actualizada
- [ ] Tests pasan en CI
