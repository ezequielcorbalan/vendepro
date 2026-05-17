# 📏 Convenciones

Compendio rápido de cómo escribir código en VendéPro. Ampliá leyendo [[Reglas-criticas]].

## Naming

| Caso | Convención |
|---|---|
| Rutas (carpetas + URL) | `kebab-case` (`/mi-pagina`, `propiedades/[id]/reportes`) |
| Componentes React | `PascalCase` (`LandingCard.tsx`) |
| Files de utilidades | `kebab-case` (`crm-config.ts`) |
| Use cases | `PascalCase` con sufijo `UseCase` |
| Repos D1 | `D1<Entidad>Repository` |
| Ports (interfaces) | `<Entidad>Repository`, `<Servicio>Service` |
| Variables JS | `camelCase` |
| Constantes config | `UPPER_SNAKE_CASE` (`LEAD_STAGES`) |
| Tablas D1 | `snake_case` plural (`lead_tags`) |
| Columnas D1 | `snake_case` |

## Estructura por capa (backend)

```
Hono route handler
  ↓ parsea HTTP
  ↓ instancia Use Case con repos/services inyectados
Use Case
  ↓ orquesta dominio + repos
Domain Entity / Rule / Value Object
  ↓ lógica pura
Repo (D1) / Service (Anthropic, R2, ...)
  ↓ I/O real
```

**No saltar capas.** Una route NUNCA habla directo con D1. Un use case NUNCA habla con Hono.

## Tipos y TypeScript

- **Strict mode**. Evitar `any` salvo en `(await res.json()) as any`
- Tipos compartidos backend/frontend: en backend están en domain; en frontend en `lib/types.ts`
- `unknown` para datos sin tipar inicial, luego type-guard

## Casts obligatorios

```typescript
// ✅ correcto
const data = (await res.json()) as any
const body = (await c.req.json()) as any

// ❌ incorrecto (Next 15 tipa como unknown, falla TS)
const data = await res.json()
```

## Imports

```typescript
// ✅ específico
import { Phone, Mail, Calendar } from 'lucide-react'

// ❌ barrel
import * as Icons from 'lucide-react'
```

## Colores / branding

Hardcoded inline:
```jsx
<button className="bg-[#ff007c] hover:bg-[#ff007c]/90">
<div className="text-[#ff8017]">
```

Para gradientes:
```jsx
className="bg-gradient-to-br from-[#ff007c] to-[#ff8017]"
```

## States obligatorios en cada página

```typescript
if (loading) return <Skeleton />
if (error) return <ErrorState message={error} />
if (!data?.length) return <EmptyState />
return <Real />
```

## Manejo de errores backend

Tirar `DomainError` y subclases (`NotFoundError`, `ValidationError`, etc.):
```typescript
if (!lead) throw new NotFoundError('lead', id)
```

El `error-handler` middleware traduce a JSON + status code adecuado. No `throw new Error('...')` con string genérico.

## D1 queries

```typescript
// ✅
const row = await db.prepare('SELECT * FROM leads WHERE id = ? AND org_id = ?')
  .bind(id, orgId)
  .first()

// ❌ template literal
const row = await db.prepare(`SELECT * FROM leads WHERE id = '${id}'`).first()
```

SIEMPRE filtrar por `org_id` salvo en rutas públicas.

## IDs y fechas

```typescript
// IDs
const idGen = new CryptoIdGenerator()
const id = idGen.generate()  // 32 hex chars

// Fechas en domain
new Date().toISOString()

// Fechas en D1
'datetime(\'now\')'  // dentro de SQL
```

## Comentarios

- **Por default no escribas comentarios.** El código bien nombrado se explica solo.
- Comentá solo el **POR QUÉ** no-obvio (constraint oculto, workaround, invariante).
- Nunca describir lo que el código hace.
- No referenciar "added for X" / "used by Y" / "issue #123".

## Archivos preferidos < 300 líneas

Si crece más, partir en sub-componentes o sub-files.

## Tests

- Unit tests para domain rules + use cases (sin mocks de D1)
- Repos de infra se testean integration con D1 en memoria
- Frontend: `@testing-library/react` para componentes con lógica

## PR / commits

- 1 PR = 1 feature acotado
- Sin refactors mezclados en hotfixes
- Tests pasan antes de mergear
- Commit por task NO — commit grande al final (ver `feedback_model_and_commits` en memoria)

## Verificación post-cambio

- Backend: `npx wrangler tail --format pretty`
- Frontend: browser console + DevTools network
- Si tocás UI: probá la golden path + 1 edge case ANTES de marcar como hecho
- Type-check ≠ feature correctness. Si no podés probar la UI, decilo explícitamente.
