# Backend — Guía de navegación

## Estructura de `vendepro-backend/`

```
vendepro-backend/
├── packages/
│   ├── core/                      # @vendepro/core — dominio + aplicación
│   │   ├── src/domain/
│   │   │   ├── entities/          # User, Lead, Contact, Property, Report...
│   │   │   ├── value-objects/     # LeadStage, PropertyStage, Money, Email
│   │   │   ├── errors/            # DomainError, NotFound, Unauthorized...
│   │   │   └── rules/             # lead-rules, property-rules, role-rules
│   │   ├── src/application/
│   │   │   ├── ports/
│   │   │   │   ├── repositories/  # 1 interface por entidad (15 total)
│   │   │   │   └── services/      # AuthService, AIService, StorageService...
│   │   │   └── use-cases/         # ~40 use cases organizados por dominio
│   │   └── tests/                 # Unit tests: domain + use cases
│   │
│   ├── infrastructure/            # @vendepro/infrastructure — adaptadores
│   │   ├── src/repositories/      # D1 implementations (d1-*-repository.ts)
│   │   ├── src/services/          # JWT, Groq, Anthropic, R2, Google Cal
│   │   └── src/middleware/        # auth-middleware, cors, error-handler
│   │
│   ├── api-auth/                  # Worker: vendepro-api-auth
│   ├── api-crm/                   # Worker: vendepro-api-crm
│   ├── api-properties/            # Worker: vendepro-api-properties
│   ├── api-transactions/          # Worker: vendepro-api-transactions
│   ├── api-analytics/             # Worker: vendepro-api-analytics
│   ├── api-ai/                    # Worker: vendepro-api-ai
│   ├── api-admin/                 # Worker: vendepro-api-admin
│   └── api-public/                # Worker: vendepro-api-public
├── migrations_v2/                 # SQL migrations aplicadas a vendepro-db (D1)
├── turbo.json                     # Orchestration: build, test, dev
└── vitest.workspace.ts            # Config raíz de Vitest

```

## Cómo agregar un endpoint nuevo

1. **Domain** (si es entidad nueva): `core/src/domain/entities/`
2. **Port** (si hay nueva operación de repo): `core/src/application/ports/repositories/`
3. **Use case**: `core/src/application/use-cases/{dominio}/`
4. **Test del use case**: `core/tests/use-cases/{dominio}/`
5. **D1 repo** (si es entidad nueva): `infrastructure/src/repositories/d1-*-repository.ts`
6. **Route en el API worker**: `api-{nombre}/src/index.ts`

## Cómo correr tests

```bash
cd vendepro-backend
npm test              # todos los tests (turbo)
npm test -- --filter @vendepro/core   # solo core
```

## Patrón de un route handler

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

## Variables de entorno por worker

| Variable | Workers que la usan |
|----------|---------------------|
| `DB` | todos (D1 binding) |
| `R2` | api-properties, api-admin (R2 binding) |
| `JWT_SECRET` | todos excepto api-public |
| `GROQ_API_KEY` | api-ai |
| `ANTHROPIC_API_KEY` | api-ai, api-properties |

Los bindings (DB, R2) van en `wrangler.jsonc`. Los secrets se setean con `wrangler secret put`.

## Recursos Cloudflare existentes (NO renombrar)

- D1 database activa: `vendepro-db` / ID: `45d18f94-807b-466f-8742-32bbc61fc7fb`
- D1 database legacy (deprecada, no se usa): `reportes-mg-db` / ID: `ca41dfff-cc50-45c7-a92a-424eebcabfb8`
- R2 bucket: `reportes-mg-assets`
- JWT salt: `reportes-mg-salt-2026` (cambiar invalida todas las contraseñas)
