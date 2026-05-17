# 🛠️ Cómo agregar un endpoint nuevo

Caminito hexagonal completo. Adaptá según el caso (si la entidad ya existe, salteás los pasos de Domain).

## 1. Domain (si es entidad nueva)

`packages/core/src/domain/entities/<entidad>.ts`:

```typescript
export interface MiEntidadProps {
  id: string
  org_id: string
  // ...campos
  created_at: string
}

export class MiEntidad {
  constructor(public readonly props: MiEntidadProps) {}

  static create(input: Omit<MiEntidadProps, 'id' | 'created_at'> & { id: string }) {
    return new MiEntidad({
      ...input,
      created_at: new Date().toISOString(),
    })
  }
}
```

Si tiene transiciones de estado → value-object aparte (ej. ver `lead-stage.ts`).

## 2. Port (interface del repositorio)

`packages/core/src/application/ports/repositories/mi-entidad-repository.ts`:

```typescript
export interface MiEntidadRepository {
  findById(id: string, orgId: string): Promise<MiEntidad | null>
  findByOrg(orgId: string, filters?: { ... }): Promise<MiEntidad[]>
  save(entity: MiEntidad): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
```

## 3. Use case

`packages/core/src/application/use-cases/<dominio>/create-mi-entidad.ts`:

```typescript
export class CreateMiEntidadUseCase {
  constructor(
    private repo: MiEntidadRepository,
    private idGen: IdGeneratorPort,
  ) {}

  async execute(input: { orgId: string, ...campos }) {
    const entity = MiEntidad.create({
      id: this.idGen.generate(),
      org_id: input.orgId,
      // ...
    })
    await this.repo.save(entity)
    return entity.props
  }
}
```

## 4. Test del use case

`packages/core/tests/use-cases/<dominio>/create-mi-entidad.test.ts`:

```typescript
import { CreateMiEntidadUseCase } from '@vendepro/core/...'

it('crea entidad con id generado', async () => {
  const repo = mockRepo()  // in-memory
  const useCase = new CreateMiEntidadUseCase(repo, fixedIdGen('id_1'))
  const result = await useCase.execute({ orgId: 'org_test', ...})
  expect(result.id).toBe('id_1')
  expect(repo.savedEntities).toHaveLength(1)
})
```

## 5. D1 repo (adaptador concreto)

`packages/infrastructure/src/repositories/d1-mi-entidad-repository.ts`:

```typescript
export class D1MiEntidadRepository implements MiEntidadRepository {
  constructor(private db: D1Database) {}

  async findById(id: string, orgId: string) {
    const row = await this.db
      .prepare('SELECT * FROM mi_entidad WHERE id = ? AND org_id = ?')
      .bind(id, orgId)
      .first()
    return row ? new MiEntidad(row as any) : null
  }

  async save(entity: MiEntidad) {
    const { id, org_id, ...rest } = entity.props
    await this.db
      .prepare('INSERT OR REPLACE INTO mi_entidad (id, org_id, ...) VALUES (?, ?, ...)')
      .bind(id, org_id, ...)
      .run()
  }
  // ...
}
```

⚠️ Acordate de filtrar por `org_id` en TODA query (ver [[Reglas-criticas]]).

Exportá desde `infrastructure/src/index.ts`.

## 6. Migration (si tabla nueva)

Ver [[Como-agregar-migration]].

## 7. Route en el worker API

Elegí el worker que corresponde según dominio (ver [[Backend-overview]]):

`packages/api-<nombre>/src/index.ts`:

```typescript
app.post('/mi-entidad', async (c) => {
  const body = (await c.req.json()) as any
  const useCase = new CreateMiEntidadUseCase(
    new D1MiEntidadRepository(c.env.DB),
    new CryptoIdGenerator(),
  )
  const result = await useCase.execute({
    orgId: c.get('orgId'),
    // ...body
  })
  return c.json(result, 201)
})
```

## 8. Si requiere auth especial

- Endpoints públicos → van en `api-public` (sin auth middleware)
- Endpoints admin-only → validar `c.get('userRole')` contra `role-rules.ts`

## 9. Frontend

Ver [[Como-agregar-pagina]] si necesitás página nueva. Si solo es un fetch desde una página existente:

```typescript
const res = await apiFetch('crm', '/mi-entidad', { method: 'POST', body: JSON.stringify({...}) })
const data = (await res.json()) as any
```

## 10. Actualizá la KB

- Agregá el endpoint a la nota `[[API-X]]` correspondiente
- Si es nueva entidad, agregá `[[Dominio-...]]` y referenciala en `[[MOC]]`
