# ⚙️ Backend Overview

Monorepo Turborepo en `vendepro-backend/` con arquitectura hexagonal y 8 Cloudflare Workers que comparten dos packages internos.

## Estructura

```
vendepro-backend/
├── packages/
│   ├── core/                   # @vendepro/core
│   │   ├── src/domain/         # entities, value-objects, errors, rules
│   │   ├── src/application/    # use-cases, ports
│   │   └── tests/              # unit tests del dominio + use cases
│   │
│   ├── infrastructure/         # @vendepro/infrastructure
│   │   ├── src/repositories/   # D1 repos (32 archivos)
│   │   ├── src/services/       # JWT, Groq, Anthropic, R2, GA4, Meta, etc.
│   │   └── src/middleware/     # auth, cors, error-handler
│   │
│   ├── api-auth/               # → auth.api.vendepro.com.ar
│   ├── api-crm/                # → crm.api.vendepro.com.ar
│   ├── api-properties/         # → properties.api.vendepro.com.ar
│   ├── api-transactions/       # → transactions.api.vendepro.com.ar
│   ├── api-analytics/          # → analytics.api.vendepro.com.ar
│   ├── api-ai/                 # → ai.api.vendepro.com.ar
│   ├── api-admin/              # → admin.api.vendepro.com.ar
│   └── api-public/             # → public.api.vendepro.com.ar
│
├── migrations_v2/              # SQL D1
├── turbo.json                  # build/test/dev orchestration
├── vitest.workspace.ts         # Vitest workspaces
└── wrangler.jsonc              # raíz (uno por worker también)
```

## Convención de cada worker

Cada `packages/api-{nombre}/src/index.ts`:

1. Importa Hono
2. Aplica middlewares globales: `corsMiddleware`, `errorHandler`
3. (Si requiere auth) aplica `createAuthMiddleware(JWT_SECRET)` a todas las rutas
4. Define routes con `app.get|post|put|delete|patch(path, handler)`
5. En cada handler:
   - Parsea body con `await c.req.json() as any`
   - Instancia repos D1 con `c.env.DB`
   - Instancia services concretos (Anthropic, R2, etc.)
   - Crea use case con todos los ports inyectados
   - `useCase.execute({ orgId: c.get('orgId'), userId: c.get('userId'), ...body })`
   - Devuelve `c.json(result, statusCode)`

Patrón típico:

```typescript
app.post('/leads', async (c) => {
  const body = (await c.req.json()) as any
  const useCase = new CreateLeadUseCase(
    new D1LeadRepository(c.env.DB),
    new CryptoIdGenerator()
  )
  const result = await useCase.execute({
    orgId: c.get('orgId'),
    agentId: c.get('userId'),
    ...body,
  })
  return c.json(result, 201)
})
```

## Bindings por worker (resumen)

| Worker | D1 | R2 | BROWSER | Secrets |
|---|---|---|---|---|
| api-auth | ✓ | | | `JWT_SECRET` |
| api-crm | ✓ | | | `JWT_SECRET` |
| api-properties | ✓ | ✓ | ✓ | `JWT_SECRET` |
| api-transactions | ✓ | | | `JWT_SECRET` |
| api-analytics | ✓ | | | `JWT_SECRET` |
| api-ai | ✓ | | | `JWT_SECRET`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY` |
| api-admin | ✓ | ✓ | | `JWT_SECRET` |
| api-public | ✓ | ✓ | | (sin JWT_SECRET) |

Todos comparten **la misma D1** (`vendepro-db`) y **el mismo R2** (`vendepro-assets`).

## Detalles

- [[Infraestructura]] — D1 repos, services, middleware
- [[Servicios-externos]] — Anthropic, Groq, Meta, GA4, R2, Browser Rendering
- 8 APIs: [[API-auth]] · [[API-crm]] · [[API-properties]] · [[API-transactions]] · [[API-analytics]] · [[API-ai]] · [[API-admin]] · [[API-public]]
