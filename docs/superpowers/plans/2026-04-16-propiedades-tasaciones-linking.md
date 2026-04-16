# Propiedades ↔ Tasaciones — Linking, Edit & Photos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vincular tasaciones a propiedades existentes (FK), vincular propiedades a contactos (FK), agregar galería de fotos a propiedades, y crear página de edición de propiedades.

**Architecture:** Backend primero — 3 migraciones D1, luego extensión de la capa de dominio y repositorio de propiedades, luego endpoints nuevos/modificados en api-properties, finalmente 3 componentes reutilizables de frontend y cambios en 5 pantallas.

**Tech Stack:** Cloudflare D1 (SQLite), Cloudflare R2, Hono, TypeScript, Next.js 15 App Router, Tailwind CSS, @dnd-kit/sortable

---

## File Map

### Backend (modificar)
- `vendepro-backend/packages/core/src/domain/entities/property.ts` — agregar `contact_id` a PropertyProps
- `vendepro-backend/packages/core/src/application/use-cases/properties/create-property.ts` — agregar `contact_id` a CreatePropertyInput
- `vendepro-backend/packages/core/src/application/ports/repositories/property-repository.ts` — agregar `search` a PropertyFilters
- `vendepro-backend/packages/infrastructure/src/repositories/d1-property-repository.ts` — contact_id en INSERT/UPDATE, search, update general
- `vendepro-backend/packages/api-properties/src/index.ts` — nuevos endpoints + modificar existentes

### Frontend (crear)
- `vendepro-frontend/src/components/ui/PropertySelector.tsx` — autocomplete de propiedades
- `vendepro-frontend/src/components/ui/ContactSelector.tsx` — autocomplete de contactos
- `vendepro-frontend/src/components/ui/PhotoGallery.tsx` — galería con drag-and-drop
- `vendepro-frontend/src/app/(dashboard)/propiedades/[id]/editar/page.tsx` — nueva página

### Frontend (modificar)
- `vendepro-frontend/src/app/(dashboard)/tasaciones/nueva/page.tsx`
- `vendepro-frontend/src/app/(dashboard)/tasaciones/[id]/page.tsx`
- `vendepro-frontend/src/app/(dashboard)/propiedades/nueva/page.tsx`
- `vendepro-frontend/src/app/(dashboard)/propiedades/[id]/page.tsx`

---

## Task 1: D1 Schema Migrations

**Files:** Solo comandos wrangler — sin archivos de código.

- [ ] **Step 1: Agregar `property_id` a `appraisals`**

```bash
cd vendepro-backend/packages/api-properties
npx wrangler d1 execute vendepro-db --remote --command "ALTER TABLE appraisals ADD COLUMN property_id TEXT REFERENCES properties(id)"
```

Resultado esperado: `🌀 Executing on remote database vendepro-db ... ✅`

- [ ] **Step 2: Agregar `contact_id` a `properties`**

```bash
npx wrangler d1 execute vendepro-db --remote --command "ALTER TABLE properties ADD COLUMN contact_id TEXT REFERENCES contacts(id)"
```

Resultado esperado: `✅`

- [ ] **Step 3: Crear tabla `property_photos`**

```bash
npx wrangler d1 execute vendepro-db --remote --command "CREATE TABLE IF NOT EXISTS property_photos (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE, url TEXT NOT NULL, r2_key TEXT NOT NULL, sort_order INTEGER DEFAULT 0, created_at TEXT NOT NULL)"
```

Resultado esperado: `✅`

- [ ] **Step 4: Verificar las migraciones**

```bash
npx wrangler d1 execute vendepro-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Debe aparecer `property_photos` en la lista.

- [ ] **Step 5: Commit**

```bash
cd ../../..
git add -A
git commit -m "feat: D1 schema — property_id en appraisals, contact_id en properties, tabla property_photos"
```

---

## Task 2: Backend — Property domain layer

**Files:**
- Modify: `vendepro-backend/packages/core/src/domain/entities/property.ts`
- Modify: `vendepro-backend/packages/core/src/application/use-cases/properties/create-property.ts`
- Modify: `vendepro-backend/packages/core/src/application/ports/repositories/property-repository.ts`

- [ ] **Step 1: Agregar `contact_id` a PropertyProps**

En `vendepro-backend/packages/core/src/domain/entities/property.ts`, agregar después de `owner_email`:

```typescript
export interface PropertyProps {
  id: string
  address: string
  neighborhood: string
  city: string
  property_type: PropertyType
  rooms: number | null
  size_m2: number | null
  asking_price: number | null
  currency: Currency
  owner_name: string
  owner_phone: string | null
  owner_email: string | null
  contact_id: string | null  // ← agregar esta línea
  public_slug: string
  cover_photo: string | null
  agent_id: string
  org_id: string
  status: PropertyStatus
  commercial_stage: string | null
  created_at: string
  updated_at: string
  // Computed / Joined
  agent_name?: string
  report_count?: number
}
```

- [ ] **Step 2: Pasar `contact_id` en Property.create()**

En el mismo archivo, `Property.create()` ya usa `...props`, entonces `contact_id` se pasa automáticamente. Solo verificar que `Property.create()` no lance error si `contact_id` es null — no hay validación sobre él, así que está bien.

- [ ] **Step 3: Agregar `contact_id` a CreatePropertyInput**

En `vendepro-backend/packages/core/src/application/use-cases/properties/create-property.ts`:

```typescript
export interface CreatePropertyInput {
  org_id: string
  agent_id: string
  address: string
  neighborhood: string
  city: string
  property_type: string
  rooms?: number | null
  size_m2?: number | null
  asking_price?: number | null
  currency?: string
  owner_name: string
  owner_phone: string
  owner_email?: string | null
  cover_photo?: string | null
  contact_id?: string | null  // ← agregar esta línea
}
```

Y en el método `execute`, pasar `contact_id` a `Property.create()`:

```typescript
const property = Property.create({
  id,
  org_id: input.org_id,
  agent_id: input.agent_id,
  address: input.address,
  neighborhood: input.neighborhood,
  city: input.city,
  property_type: input.property_type as any,
  rooms: input.rooms ?? null,
  size_m2: input.size_m2 ?? null,
  asking_price: input.asking_price ?? null,
  currency: (input.currency ?? 'USD') as any,
  owner_name: input.owner_name,
  owner_phone: input.owner_phone,
  owner_email: input.owner_email ?? null,
  contact_id: input.contact_id ?? null,  // ← agregar esta línea
  public_slug: slug,
  cover_photo: input.cover_photo ?? null,
  status: 'active',
  commercial_stage: null,
})
```

- [ ] **Step 4: Agregar `search` a PropertyFilters**

En `vendepro-backend/packages/core/src/application/ports/repositories/property-repository.ts`:

```typescript
export interface PropertyFilters {
  status?: string
  agent_id?: string
  neighborhood?: string
  property_type?: string
  search?: string  // ← agregar esta línea
}
```

- [ ] **Step 5: Compilar para verificar sin errores**

```bash
cd vendepro-backend/packages/core
npx tsc --noEmit
```

Esperado: sin errores de TypeScript.

- [ ] **Step 6: Commit**

```bash
cd ../../..
git add packages/core
git commit -m "feat: domain — contact_id en Property, search en PropertyFilters"
```

---

## Task 3: Backend — D1PropertyRepository

**Files:**
- Modify: `vendepro-backend/packages/infrastructure/src/repositories/d1-property-repository.ts`

- [ ] **Step 1: Agregar `contact_id` al INSERT en `save()`**

Reemplazar el método `save()` completo:

```typescript
async save(property: Property): Promise<void> {
  const o = property.toObject()
  await this.db.prepare(`
    INSERT INTO properties (id, org_id, address, neighborhood, city, property_type, rooms, size_m2,
      asking_price, currency, owner_name, owner_phone, owner_email, contact_id, public_slug, cover_photo,
      agent_id, status, commercial_stage, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      address=excluded.address, neighborhood=excluded.neighborhood, rooms=excluded.rooms,
      size_m2=excluded.size_m2, asking_price=excluded.asking_price, currency=excluded.currency,
      owner_name=excluded.owner_name, owner_phone=excluded.owner_phone, owner_email=excluded.owner_email,
      contact_id=excluded.contact_id, cover_photo=excluded.cover_photo,
      status=excluded.status, commercial_stage=excluded.commercial_stage,
      updated_at=excluded.updated_at
  `).bind(
    o.id, o.org_id, o.address, o.neighborhood, o.city, o.property_type, o.rooms, o.size_m2,
    o.asking_price, o.currency, o.owner_name, o.owner_phone, o.owner_email, o.contact_id ?? null,
    o.public_slug, o.cover_photo, o.agent_id, o.status, o.commercial_stage, o.created_at, o.updated_at
  ).run()
}
```

- [ ] **Step 2: Agregar `contact_id` a `toEntity()`**

```typescript
private toEntity(row: any): Property {
  const validTypes = ['departamento', 'casa', 'ph', 'local', 'terreno', 'oficina']
  return Property.create({
    id: row.id, org_id: row.org_id,
    address: row.address || 'Sin dirección',
    neighborhood: row.neighborhood || 'Sin barrio',
    city: row.city || '',
    property_type: validTypes.includes(row.property_type) ? row.property_type : 'departamento',
    rooms: row.rooms ?? null,
    size_m2: row.size_m2 ?? null,
    asking_price: row.asking_price ?? null,
    currency: row.currency || 'USD',
    owner_name: row.owner_name || 'Sin propietario',
    owner_phone: row.owner_phone ?? null,
    owner_email: row.owner_email ?? null,
    contact_id: row.contact_id ?? null,  // ← agregar esta línea
    public_slug: row.public_slug || row.id,
    cover_photo: row.cover_photo ?? null,
    agent_id: row.agent_id,
    status: row.status, commercial_stage: row.commercial_stage ?? null,
    created_at: row.created_at, updated_at: row.updated_at,
  })
}
```

- [ ] **Step 3: Agregar filtro `search` a `findByOrg()`**

Agregar después de `if (filters?.property_type)`:

```typescript
if (filters?.search) {
  query += ' AND (p.address LIKE ? OR p.neighborhood LIKE ?)'
  binds.push(`%${filters.search}%`, `%${filters.search}%`)
}
```

- [ ] **Step 4: Compilar infrastructure sin errores**

```bash
cd vendepro-backend/packages/infrastructure
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd ../../..
git add packages/infrastructure
git commit -m "feat: d1-property-repository — contact_id, search filter"
```

---

## Task 4: Backend — api-properties endpoints

**Files:**
- Modify: `vendepro-backend/packages/api-properties/src/index.ts`

- [ ] **Step 1: Actualizar `GET /properties` para aceptar `?q=`**

Reemplazar:
```typescript
app.get('/properties', async (c) => {
  const { status, agent_id, neighborhood, property_type } = c.req.query()
```
Por:
```typescript
app.get('/properties', async (c) => {
  const { status, agent_id, neighborhood, property_type, q } = c.req.query()
```

Y actualizar la llamada al use-case:
```typescript
const items = await useCase.execute(c.get('orgId'), { status, agent_id, neighborhood, property_type, search: q })
```

- [ ] **Step 2: Actualizar `POST /properties` para pasar `contact_id`**

En el handler `app.post('/properties', ...)`, el body ya se pasa con `...body` al use-case. Verificar que `contact_id` fluya correctamente — el `CreatePropertyUseCase` ya acepta `contact_id` desde Task 2. Sin cambios adicionales necesarios.

- [ ] **Step 3: Actualizar `GET /properties/:id` para incluir fotos**

Reemplazar el handler completo:
```typescript
app.get('/properties/:id', async (c) => {
  const repo = new D1PropertyRepository(c.env.DB)
  const prop = await repo.findById(c.req.param('id'), c.get('orgId'))
  if (!prop) return c.json({ error: 'Not found' }, 404)
  const photos = (await c.env.DB.prepare(
    'SELECT id, url, sort_order FROM property_photos WHERE property_id = ? AND org_id = ? ORDER BY sort_order'
  ).bind(c.req.param('id'), c.get('orgId')).all()).results
  return c.json({ ...prop.toObject(), photos })
})
```

- [ ] **Step 4: Agregar `PUT /properties/:id` (edición general)**

Insertar después del handler anterior:
```typescript
app.put('/properties/:id', async (c) => {
  const body = (await c.req.json()) as any
  const id = c.req.param('id')
  const db = c.env.DB
  const orgId = c.get('orgId')
  const existing = await db.prepare('SELECT id FROM properties WHERE id = ? AND org_id = ?').bind(id, orgId).first()
  if (!existing) return c.json({ error: 'Not found' }, 404)
  const now = new Date().toISOString()
  await db.prepare(`
    UPDATE properties SET
      address=COALESCE(?,address), neighborhood=COALESCE(?,neighborhood),
      city=COALESCE(?,city), property_type=COALESCE(?,property_type),
      rooms=COALESCE(?,rooms), size_m2=COALESCE(?,size_m2),
      asking_price=COALESCE(?,asking_price), currency=COALESCE(?,currency),
      owner_name=COALESCE(?,owner_name), owner_phone=COALESCE(?,owner_phone),
      owner_email=COALESCE(?,owner_email), contact_id=COALESCE(?,contact_id),
      status=COALESCE(?,status), commercial_stage=COALESCE(?,commercial_stage),
      updated_at=?
    WHERE id = ? AND org_id = ?
  `).bind(
    body.address ?? null, body.neighborhood ?? null, body.city ?? null, body.property_type ?? null,
    body.rooms ?? null, body.size_m2 ?? null, body.asking_price ?? null, body.currency ?? null,
    body.owner_name ?? null, body.owner_phone ?? null, body.owner_email ?? null,
    body.contact_id ?? null, body.status ?? null, body.commercial_stage ?? null,
    now, id, orgId
  ).run()
  return c.json({ success: true })
})
```

- [ ] **Step 5: Actualizar `POST /appraisals` para incluir `property_id`**

Reemplazar el INSERT completo por:
```typescript
app.post('/appraisals', async (c) => {
  const body = (await c.req.json()) as any
  const db = c.env.DB
  const orgId = c.get('orgId')
  const agentId = body.agent_id || c.get('userId')
  const id = crypto.randomUUID().replace(/-/g, '')
  const now = new Date().toISOString()
  await db.prepare(`
    INSERT INTO appraisals (id, org_id, property_address, neighborhood, city, property_type,
      covered_area, total_area, semi_area, weighted_area,
      strengths, weaknesses, opportunities, threats, publication_analysis,
      suggested_price, test_price, expected_close_price, usd_per_m2,
      contact_name, contact_phone, contact_email, lead_id, property_id, agent_id, status, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id, orgId,
    body.property_address, body.neighborhood || '', body.city || 'Buenos Aires', body.property_type || 'departamento',
    body.covered_area ?? null, body.total_area ?? null, body.semi_area ?? null, body.weighted_area ?? null,
    body.strengths ?? null, body.weaknesses ?? null, body.opportunities ?? null, body.threats ?? null, body.publication_analysis ?? null,
    body.suggested_price ?? null, body.test_price ?? null, body.expected_close_price ?? null, body.usd_per_m2 ?? null,
    body.contact_name ?? null, body.contact_phone ?? null, body.contact_email ?? null,
    body.lead_id ?? null, body.property_id ?? null, agentId, 'draft', now, now
  ).run()
  return c.json({ id, status: 'draft' }, 201)
})
```

- [ ] **Step 6: Actualizar `PUT /appraisals` para incluir `property_id`**

En el UPDATE de `app.put('/appraisals', ...)`, agregar `property_id=COALESCE(?,property_id),` antes de `lead_id=COALESCE(...)`:

```typescript
await db.prepare(`
  UPDATE appraisals SET
    property_address=COALESCE(?,property_address), neighborhood=COALESCE(?,neighborhood),
    city=COALESCE(?,city), property_type=COALESCE(?,property_type),
    covered_area=?, total_area=?, semi_area=?, weighted_area=?,
    strengths=?, weaknesses=?, opportunities=?, threats=?, publication_analysis=?,
    suggested_price=?, test_price=?, expected_close_price=?, usd_per_m2=?,
    contact_name=?, contact_phone=?, contact_email=?,
    property_id=COALESCE(?,property_id), lead_id=COALESCE(?,lead_id),
    status=COALESCE(?,status), updated_at=?
  WHERE id = ? AND org_id = ?
`).bind(
  body.property_address ?? null, body.neighborhood ?? null,
  body.city ?? null, body.property_type ?? null,
  body.covered_area ?? null, body.total_area ?? null, body.semi_area ?? null, body.weighted_area ?? null,
  body.strengths ?? null, body.weaknesses ?? null, body.opportunities ?? null, body.threats ?? null, body.publication_analysis ?? null,
  body.suggested_price ?? null, body.test_price ?? null, body.expected_close_price ?? null, body.usd_per_m2 ?? null,
  body.contact_name ?? null, body.contact_phone ?? null, body.contact_email ?? null,
  body.property_id ?? null, body.lead_id ?? null, body.status ?? null, now,
  id, orgId
).run()
```

- [ ] **Step 7: Actualizar `GET /appraisals?id=X` para incluir datos de propiedad vinculada**

Reemplazar el bloque `if (id) { ... }` dentro de `app.get('/appraisals', ...)`:

```typescript
if (id) {
  const row = await db.prepare(
    `SELECT a.*, u.full_name as agent_name,
      p.address as linked_property_address, p.neighborhood as linked_property_neighborhood
     FROM appraisals a
     LEFT JOIN users u ON a.agent_id = u.id
     LEFT JOIN properties p ON a.property_id = p.id
     WHERE a.id = ? AND a.org_id = ?`
  ).bind(id, orgId).first()
  if (!row) return c.json({ error: 'Not found' }, 404)
  const comparables = (await db.prepare('SELECT * FROM appraisal_comparables WHERE appraisal_id = ? ORDER BY sort_order').bind(id).all()).results
  const r = row as any
  return c.json({
    ...r,
    comparables,
    linked_property: r.property_id
      ? { id: r.property_id, address: r.linked_property_address, neighborhood: r.linked_property_neighborhood }
      : null,
  })
}
```

- [ ] **Step 8: Agregar endpoints de property-photos (ANTES de cualquier ruta con `:id`)**

Agregar estos tres handlers en este orden, antes del `app.delete('/properties/:id', ...)`:

```typescript
// ⚠️ /reorder debe ir ANTES de /:id para que Hono no lo interprete como ID
app.put('/property-photos/reorder', async (c) => {
  const items = (await c.req.json()) as { id: string; sort_order: number }[]
  const db = c.env.DB
  const orgId = c.get('orgId')
  for (const item of items) {
    await db.prepare('UPDATE property_photos SET sort_order=? WHERE id=? AND org_id=?')
      .bind(item.sort_order, item.id, orgId).run()
  }
  return c.json({ success: true })
})

app.post('/property-photos', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const propertyId = formData.get('property_id') as string | null
  if (!file || !propertyId) return c.json({ error: 'file y property_id requeridos' }, 400)
  const db = c.env.DB
  const orgId = c.get('orgId')
  const id = crypto.randomUUID().replace(/-/g, '')
  const r2Key = `cuentas/${orgId}/propiedades/${propertyId}/fotos/${id}`
  const storage = new R2StorageService(c.env.R2, c.env.R2_PUBLIC_URL)
  const buffer = await file.arrayBuffer()
  const url = await storage.upload(r2Key, buffer, file.type)
  const now = new Date().toISOString()
  const count = (await db.prepare('SELECT COUNT(*) as n FROM property_photos WHERE property_id=? AND org_id=?').bind(propertyId, orgId).first()) as any
  const sortOrder = (count?.n ?? 0)
  await db.prepare('INSERT INTO property_photos (id, org_id, property_id, url, r2_key, sort_order, created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(id, orgId, propertyId, url, r2Key, sortOrder, now).run()
  return c.json({ id, url, r2_key: r2Key, sort_order: sortOrder })
})

app.delete('/property-photos/:id', async (c) => {
  const photoId = c.req.param('id')
  const db = c.env.DB
  const orgId = c.get('orgId')
  const row = await db.prepare('SELECT r2_key FROM property_photos WHERE id=? AND org_id=?').bind(photoId, orgId).first() as any
  if (!row) return c.json({ error: 'Not found' }, 404)
  const storage = new R2StorageService(c.env.R2, c.env.R2_PUBLIC_URL)
  try { await c.env.R2.delete(row.r2_key) } catch {}
  await db.prepare('DELETE FROM property_photos WHERE id=? AND org_id=?').bind(photoId, orgId).run()
  return c.json({ success: true })
})
```

- [ ] **Step 9: Compilar api-properties sin errores**

```bash
cd vendepro-backend/packages/api-properties
npx tsc --noEmit
```

- [ ] **Step 10: Commit**

```bash
cd ../../..
git add packages/api-properties packages/infrastructure packages/core
git commit -m "feat: api-properties — property_id en appraisals, contact_id en properties, endpoints fotos"
```

---

## Task 5: Frontend — PropertySelector component

**Files:**
- Create: `vendepro-frontend/src/components/ui/PropertySelector.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
'use client'

import { useState, useRef } from 'react'
import { Search, Building2, Plus } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

interface PropertyOption {
  id: string
  address: string
  neighborhood: string
  city: string
  property_type: string
  size_m2: number | null
}

interface PropertySelectorProps {
  value: PropertyOption | null
  onChange: (property: PropertyOption | null) => void
}

export function PropertySelector({ value, onChange }: PropertySelectorProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PropertyOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  async function search(q: string) {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await apiFetch('properties', `/properties?q=${encodeURIComponent(q)}`)
      const data = (await res.json()) as any
      setResults(Array.isArray(data) ? data.slice(0, 8) : [])
      setOpen(true)
    } catch { setResults([]) }
    setLoading(false)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(val), 300)
  }

  function select(p: PropertyOption) {
    onChange(p)
    setQuery(p.address)
    setOpen(false)
    setResults([])
  }

  function clear() {
    onChange(null)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="relative">
      {value ? (
        <div className="flex items-center gap-3 bg-[#ff007c]/5 border border-[#ff007c]/30 rounded-lg px-3 py-2">
          <Building2 className="w-4 h-4 text-[#ff007c] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{value.address}</p>
            <p className="text-xs text-gray-500">{value.neighborhood} · {value.property_type}</p>
          </div>
          <button type="button" onClick={clear} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={handleInput}
            onFocus={() => { if (query) setOpen(true) }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Buscar propiedad por dirección o barrio..."
            className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]"
          />
        </div>
      )}

      {open && !value && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-lg overflow-hidden">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-3">Buscando...</p>
          ) : results.length === 0 ? (
            <div className="p-3 text-center">
              <p className="text-sm text-gray-400 mb-2">Sin resultados</p>
              <Link href="/propiedades/nueva" className="inline-flex items-center gap-1 text-sm text-[#ff007c] hover:underline">
                <Plus className="w-3 h-3" /> Crear nueva propiedad
              </Link>
            </div>
          ) : (
            <>
              {results.map(p => (
                <button key={p.id} type="button" onMouseDown={() => select(p)}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b last:border-0">
                  <p className="text-sm font-medium text-gray-800">{p.address}</p>
                  <p className="text-xs text-gray-500">
                    {p.neighborhood} · {p.property_type}{p.size_m2 ? ` · ${p.size_m2} m²` : ''}
                  </p>
                </button>
              ))}
              <Link href="/propiedades/nueva"
                className="flex items-center gap-1 text-xs text-[#ff007c] hover:underline px-3 py-2 border-t">
                <Plus className="w-3 h-3" /> Crear nueva propiedad
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd vendepro-frontend
git add src/components/ui/PropertySelector.tsx
git commit -m "feat: componente PropertySelector con autocomplete"
```

---

## Task 6: Frontend — ContactSelector component

**Files:**
- Create: `vendepro-frontend/src/components/ui/ContactSelector.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
'use client'

import { useState, useRef } from 'react'
import { Search, User, Plus } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

interface ContactOption {
  id: string
  full_name: string
  phone?: string | null
  email?: string | null
}

interface ContactSelectorProps {
  value: ContactOption | null
  onChange: (contact: ContactOption | null) => void
}

export function ContactSelector({ value, onChange }: ContactSelectorProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ContactOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  async function search(q: string) {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await apiFetch('crm', `/contacts?search=${encodeURIComponent(q)}`)
      const data = (await res.json()) as any
      setResults(Array.isArray(data) ? data.slice(0, 8) : [])
      setOpen(true)
    } catch { setResults([]) }
    setLoading(false)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(val), 300)
  }

  function select(ct: ContactOption) {
    onChange(ct)
    setQuery(ct.full_name)
    setOpen(false)
    setResults([])
  }

  function clear() {
    onChange(null)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="relative">
      {value ? (
        <div className="flex items-center gap-3 bg-[#ff007c]/5 border border-[#ff007c]/30 rounded-lg px-3 py-2">
          <User className="w-4 h-4 text-[#ff007c] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800">{value.full_name}</p>
            <p className="text-xs text-gray-500">{[value.phone, value.email].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" onClick={clear} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={handleInput}
            onFocus={() => { if (query) setOpen(true) }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Buscar contacto por nombre o teléfono..."
            className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]"
          />
        </div>
      )}

      {open && !value && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-lg overflow-hidden">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-3">Buscando...</p>
          ) : results.length === 0 ? (
            <div className="p-3 text-center">
              <p className="text-sm text-gray-400 mb-2">Sin resultados</p>
              <Link href="/contactos/nuevo" className="inline-flex items-center gap-1 text-sm text-[#ff007c] hover:underline">
                <Plus className="w-3 h-3" /> Crear nuevo contacto
              </Link>
            </div>
          ) : (
            <>
              {results.map(ct => (
                <button key={ct.id} type="button" onMouseDown={() => select(ct)}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b last:border-0">
                  <p className="text-sm font-medium text-gray-800">{ct.full_name}</p>
                  <p className="text-xs text-gray-500">{[ct.phone, ct.email].filter(Boolean).join(' · ')}</p>
                </button>
              ))}
              <Link href="/contactos/nuevo"
                className="flex items-center gap-1 text-xs text-[#ff007c] hover:underline px-3 py-2 border-t">
                <Plus className="w-3 h-3" /> Crear nuevo contacto
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/ContactSelector.tsx
git commit -m "feat: componente ContactSelector con autocomplete"
```

---

## Task 7: Frontend — PhotoGallery component

**Files:**
- Create: `vendepro-frontend/src/components/ui/PhotoGallery.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
'use client'

import { useState } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Loader2, X, Upload, GripVertical } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface Photo {
  id: string
  url: string
  sort_order: number
}

interface PhotoGalleryProps {
  photos: Photo[]
  propertyId: string
  editable?: boolean
}

function SortablePhoto({ photo, onDelete }: { photo: Photo; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100">
      <img src={photo.url} alt="" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors">
        <button {...attributes} {...listeners}
          className="absolute top-2 left-2 bg-white/90 rounded p-1 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing">
          <GripVertical className="w-3 h-3 text-gray-600" />
        </button>
        <button type="button" onClick={() => onDelete(photo.id)}
          className="absolute top-2 right-2 bg-white/90 rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50">
          <X className="w-3 h-3 text-gray-600 hover:text-red-500" />
        </button>
      </div>
    </div>
  )
}

export function PhotoGallery({ photos: initialPhotos, propertyId, editable = false }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('property_id', propertyId)
      try {
        const res = await apiFetch('properties', '/property-photos', { method: 'POST', body: fd })
        const data = (await res.json()) as any
        if (data.id) setPhotos(prev => [...prev, { id: data.id, url: data.url, sort_order: data.sort_order }])
      } catch {}
    }
    setUploading(false)
    e.target.value = ''
  }

  async function handleDelete(id: string) {
    await apiFetch('properties', `/property-photos/${id}`, { method: 'DELETE' })
    setPhotos(prev => prev.filter(p => p.id !== id))
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = photos.findIndex(p => p.id === active.id)
    const newIdx = photos.findIndex(p => p.id === over.id)
    const reordered = arrayMove(photos, oldIdx, newIdx)
    setPhotos(reordered)
    await apiFetch('properties', '/property-photos/reorder', {
      method: 'PUT',
      body: JSON.stringify(reordered.map((p, i) => ({ id: p.id, sort_order: i }))),
    })
  }

  if (!photos.length && !editable) return null

  if (!editable) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {photos.map(p => (
          <div key={p.id} className="aspect-square rounded-xl overflow-hidden bg-gray-100">
            <img src={p.url} alt="" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={photos.map(p => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {photos.map(p => (
                <SortablePhoto key={p.id} photo={p} onDelete={handleDelete} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <label className={`flex items-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${uploading ? 'border-gray-200 opacity-60' : 'border-gray-300 hover:border-[#ff007c]/50'}`}>
        {uploading
          ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          : <Upload className="w-4 h-4 text-gray-400" />}
        <span className="text-sm text-gray-500">{uploading ? 'Subiendo...' : 'Agregar fotos'}</span>
        <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" disabled={uploading} />
      </label>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/PhotoGallery.tsx
git commit -m "feat: componente PhotoGallery con upload y drag-and-drop"
```

---

## Task 8: Frontend — /tasaciones/nueva (PropertySelector + pre-carga por URL)

**Files:**
- Modify: `vendepro-frontend/src/app/(dashboard)/tasaciones/nueva/page.tsx`

- [ ] **Step 1: Agregar imports y estado para propiedad vinculada**

Agregar al inicio del archivo (después de los imports existentes):
```typescript
import { useSearchParams } from 'next/navigation'
import { PropertySelector } from '@/components/ui/PropertySelector'
```

Dentro del componente, después de `const { toast } = useToast()`:
```typescript
const searchParams = useSearchParams()
const [linkedProperty, setLinkedProperty] = useState<{ id: string; address: string; neighborhood: string; city: string; property_type: string; size_m2: number | null } | null>(null)
```

- [ ] **Step 2: Pre-cargar propiedad si viene `?property_id` en la URL**

Agregar después de la declaración de estado del formulario:
```typescript
useEffect(() => {
  const pid = searchParams.get('property_id')
  if (!pid) return
  apiFetch('properties', `/properties/${pid}`)
    .then(r => r.json() as any)
    .then((p: any) => {
      if (!p.id) return
      const prop = { id: p.id, address: p.address, neighborhood: p.neighborhood, city: p.city, property_type: p.property_type, size_m2: p.size_m2 }
      setLinkedProperty(prop)
      setForm(f => ({
        ...f,
        property_address: p.address || '',
        neighborhood: p.neighborhood || '',
        city: p.city || f.city,
        property_type: p.property_type || f.property_type,
        total_area: p.size_m2 ? String(p.size_m2) : f.total_area,
      }))
    })
    .catch(() => {})
}, [])
```

- [ ] **Step 3: Manejar selección manual de propiedad**

Agregar función después de `useEffect`:
```typescript
function handlePropertySelect(p: typeof linkedProperty) {
  setLinkedProperty(p)
  if (p) {
    setForm(f => ({
      ...f,
      property_address: p.address,
      neighborhood: p.neighborhood,
      city: p.city,
      property_type: p.property_type,
      total_area: p.size_m2 ? String(p.size_m2) : f.total_area,
    }))
  }
}
```

- [ ] **Step 4: Incluir `property_id` en el payload de creación**

En `handleSave`, antes de `const res = await apiFetch(...)`:
```typescript
if (linkedProperty) payload.property_id = linkedProperty.id
```

- [ ] **Step 5: Agregar `PropertySelector` al JSX**

Agregar un nuevo bloque ANTES del bloque `{/* Propiedad */}`:
```tsx
{/* Propiedad vinculada */}
<div className="bg-white rounded-xl border p-6 space-y-3">
  <h2 className="font-semibold text-gray-800">Propiedad existente (opcional)</h2>
  <p className="text-sm text-gray-500">Seleccioná una propiedad del sistema para vincular esta tasación.</p>
  <PropertySelector value={linkedProperty} onChange={handlePropertySelect} />
</div>
```

- [ ] **Step 6: Verificar en el navegador**

1. Abrir `/tasaciones/nueva` — debe mostrar el selector de propiedad arriba del formulario
2. Escribir una dirección en el selector — debe mostrar resultados después de 300ms
3. Seleccionar una propiedad — debe pre-llenar los campos de dirección, barrio, ciudad y tipo
4. Crear la tasación — verificar en `/tasaciones/[id]` que `linked_property` aparece en la respuesta de la API (abrir DevTools > Network)

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/tasaciones/nueva/page.tsx
git commit -m "feat: tasaciones/nueva — selector de propiedad existente con pre-carga"
```

---

## Task 9: Frontend — /tasaciones/[id] (card de propiedad vinculada)

**Files:**
- Modify: `vendepro-frontend/src/app/(dashboard)/tasaciones/[id]/page.tsx`

- [ ] **Step 1: Mostrar card de propiedad vinculada**

En la respuesta de la API, `appraisal.linked_property` contiene `{ id, address, neighborhood }` si existe.

En el JSX, después del bloque `{/* Lead/Contact origin */}` (alrededor de la línea 86), agregar:

```tsx
{/* Propiedad vinculada */}
{a.linked_property && (
  <div className="flex flex-wrap items-center gap-3 mb-4">
    <Link
      href={`/propiedades/${a.linked_property.id}`}
      className="flex items-center gap-2 px-3 py-2 bg-[#ff007c]/5 border border-[#ff007c]/20 rounded-xl hover:bg-[#ff007c]/10 transition-colors"
    >
      <span className="text-xs font-medium text-[#ff007c]">Propiedad:</span>
      <span className="text-sm text-gray-800 font-semibold">{a.linked_property.address}</span>
      {a.linked_property.neighborhood && (
        <span className="text-xs text-gray-500">{a.linked_property.neighborhood}</span>
      )}
    </Link>
  </div>
)}
```

Agregar `Building2` a los imports de lucide-react si se quiere icono (opcional):
```typescript
import { ..., Building2 } from 'lucide-react'
```

Y cambiar el contenido del Link para incluir el icono:
```tsx
<Building2 className="w-4 h-4 text-[#ff007c]" />
```

- [ ] **Step 2: Verificar en el navegador**

1. Abrir una tasación que tenga `property_id` — debe mostrar la card rosa con la dirección de la propiedad
2. Hacer click en la card — debe navegar a `/propiedades/[id]`
3. Tasación sin propiedad vinculada — no debe mostrar nada

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/tasaciones/\[id\]/page.tsx
git commit -m "feat: tasaciones/[id] — card de propiedad vinculada"
```

---

## Task 10: Frontend — /propiedades/nueva (ContactSelector)

**Files:**
- Modify: `vendepro-frontend/src/app/(dashboard)/propiedades/nueva/page.tsx`

- [ ] **Step 1: Agregar imports y estado**

Agregar imports:
```typescript
import { ContactSelector } from '@/components/ui/ContactSelector'
```

Agregar estado dentro del componente:
```typescript
const [ownerContact, setOwnerContact] = useState<{ id: string; full_name: string; phone?: string | null; email?: string | null } | null>(null)
```

- [ ] **Step 2: Manejar selección de contacto**

Agregar función:
```typescript
function handleContactSelect(ct: typeof ownerContact) {
  setOwnerContact(ct)
  if (ct) {
    update('owner_name', ct.full_name)
    update('owner_phone', ct.phone || '')
    update('owner_email', ct.email || '')
  }
}
```

- [ ] **Step 3: Incluir `contact_id` en el payload**

En `handleSubmit`, antes del `apiFetch`:
```typescript
if (ownerContact) payload.contact_id = ownerContact.id
```

- [ ] **Step 4: Agregar ContactSelector al JSX**

Reemplazar la sección `<h2 className="text-lg font-medium text-gray-800">Datos del propietario</h2>` y sus campos por:

```tsx
<h2 className="text-lg font-medium text-gray-800">Datos del propietario</h2>

<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Contacto existente (opcional)</label>
  <ContactSelector value={ownerContact} onChange={handleContactSelect} />
  <p className="text-xs text-gray-400 mt-1">Seleccioná un contacto para auto-completar los campos</p>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div className="col-span-2">
    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
    <input type="text" value={form.owner_name} onChange={e => update('owner_name', e.target.value)} required placeholder="Nombre del propietario" className={inputClass} />
  </div>
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
    <input type="tel" value={form.owner_phone} onChange={e => update('owner_phone', e.target.value)} placeholder="Ej: +54 11 5890-5594" className={inputClass} />
  </div>
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
    <input type="email" value={form.owner_email} onChange={e => update('owner_email', e.target.value)} placeholder="propietario@email.com" className={inputClass} />
  </div>
</div>
```

- [ ] **Step 5: Verificar en el navegador**

1. Abrir `/propiedades/nueva`
2. Buscar un contacto — debe aparecer el dropdown con resultados
3. Seleccionar — debe auto-completar nombre, teléfono y email
4. Crear la propiedad — verificar que `contact_id` llega al backend (DevTools > Network > payload)

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/propiedades/nueva/page.tsx
git commit -m "feat: propiedades/nueva — selector de contacto como propietario"
```

---

## Task 11: Frontend — /propiedades/[id]/editar (nueva página)

**Files:**
- Create: `vendepro-frontend/src/app/(dashboard)/propiedades/[id]/editar/page.tsx`

- [ ] **Step 1: Crear la página completa**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { ContactSelector } from '@/components/ui/ContactSelector'
import { PhotoGallery } from '@/components/ui/PhotoGallery'

const PROPERTY_TYPES = [
  { value: 'departamento', label: 'Departamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'ph', label: 'PH' },
  { value: 'local', label: 'Local' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'oficina', label: 'Oficina' },
]

const COMMERCIAL_STAGES = [
  { value: 'captada', label: 'Captada' },
  { value: 'documentacion', label: 'En documentación' },
  { value: 'publicada', label: 'Publicada' },
  { value: 'reservada', label: 'Reservada' },
  { value: 'vendida', label: 'Vendida' },
  { value: 'suspendida', label: 'Suspendida' },
  { value: 'archivada', label: 'Archivada' },
]

export default function EditarPropiedadPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [photos, setPhotos] = useState<{ id: string; url: string; sort_order: number }[]>([])
  const [ownerContact, setOwnerContact] = useState<{ id: string; full_name: string; phone?: string | null; email?: string | null } | null>(null)
  const [form, setForm] = useState({
    address: '',
    neighborhood: '',
    city: 'Buenos Aires',
    property_type: 'departamento',
    rooms: '',
    size_m2: '',
    asking_price: '',
    currency: 'USD',
    owner_name: '',
    owner_phone: '',
    owner_email: '',
    commercial_stage: '',
  })

  useEffect(() => {
    if (!id) return
    apiFetch('properties', `/properties/${id}`)
      .then(r => r.json() as any)
      .then((p: any) => {
        if (p.error) { router.push('/propiedades'); return }
        setForm({
          address: p.address || '',
          neighborhood: p.neighborhood || '',
          city: p.city || 'Buenos Aires',
          property_type: p.property_type || 'departamento',
          rooms: p.rooms != null ? String(p.rooms) : '',
          size_m2: p.size_m2 != null ? String(p.size_m2) : '',
          asking_price: p.asking_price != null ? String(p.asking_price) : '',
          currency: p.currency || 'USD',
          owner_name: p.owner_name || '',
          owner_phone: p.owner_phone || '',
          owner_email: p.owner_email || '',
          commercial_stage: p.commercial_stage || '',
        })
        if (p.contact_id) {
          setOwnerContact({ id: p.contact_id, full_name: p.owner_name, phone: p.owner_phone, email: p.owner_email })
        }
        setPhotos(p.photos || [])
        setLoading(false)
      })
      .catch(() => router.push('/propiedades'))
  }, [id, router])

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleContactSelect(ct: typeof ownerContact) {
    setOwnerContact(ct)
    if (ct) {
      update('owner_name', ct.full_name)
      update('owner_phone', ct.phone || '')
      update('owner_email', ct.email || '')
    }
  }

  async function handleSave() {
    if (!form.address) { toast('La dirección es requerida', 'error'); return }
    if (!form.owner_name) { toast('El nombre del propietario es requerido', 'error'); return }
    setSaving(true)
    try {
      const payload: any = {
        ...form,
        rooms: form.rooms ? Number(form.rooms) : null,
        size_m2: form.size_m2 ? Number(form.size_m2) : null,
        asking_price: form.asking_price ? Number(form.asking_price) : null,
        contact_id: ownerContact?.id ?? null,
      }
      const res = await apiFetch('properties', `/properties/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as any
      if (data.success) {
        toast('Propiedad actualizada')
        router.push(`/propiedades/${id}`)
      } else {
        toast(data.error || 'Error al guardar', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setSaving(false)
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff007c]" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/propiedades/${id}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Editar propiedad</h1>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar
        </button>
      </div>

      {/* Datos del inmueble */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Datos del inmueble</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección *</label>
            <input type="text" value={form.address} onChange={e => update('address', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Barrio</label>
            <input type="text" value={form.neighborhood} onChange={e => update('neighborhood', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
            <input type="text" value={form.city} onChange={e => update('city', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select value={form.property_type} onChange={e => update('property_type', e.target.value)} className={inputClass}>
              {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ambientes</label>
            <input type="number" value={form.rooms} onChange={e => update('rooms', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Superficie (m²)</label>
            <input type="number" value={form.size_m2} onChange={e => update('size_m2', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
            <select value={form.currency} onChange={e => update('currency', e.target.value)} className={inputClass}>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio</label>
            <input type="number" value={form.asking_price} onChange={e => update('asking_price', e.target.value)} className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Etapa comercial</label>
            <select value={form.commercial_stage} onChange={e => update('commercial_stage', e.target.value)} className={inputClass}>
              <option value="">Sin etapa</option>
              {COMMERCIAL_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Propietario */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Propietario</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vincular contacto (opcional)</label>
          <ContactSelector value={ownerContact} onChange={handleContactSelect} />
          <p className="text-xs text-gray-400 mt-1">Seleccioná un contacto para auto-completar</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input type="text" value={form.owner_name} onChange={e => update('owner_name', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input type="tel" value={form.owner_phone} onChange={e => update('owner_phone', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.owner_email} onChange={e => update('owner_email', e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Fotos */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Fotos</h2>
        <PhotoGallery photos={photos} propertyId={id} editable />
      </div>

      <div className="flex justify-end pb-8">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-[#ff007c] text-white px-6 py-3 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar cambios
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar en el navegador**

1. Navegar a `/propiedades/[id]/editar` — debe pre-cargar todos los datos
2. Si la propiedad tiene `contact_id`, debe mostrar el contacto ya seleccionado en el ContactSelector
3. Editar dirección y guardar — debe redirigir al detalle con los datos actualizados
4. Subir una foto — debe aparecer en la grilla con X y asa de drag
5. Borrar una foto — debe desaparecer de la grilla
6. Reordenar por drag-and-drop — el nuevo orden debe persistir al recargar la página

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/propiedades/\[id\]/editar/page.tsx
git commit -m "feat: propiedades/[id]/editar — página de edición completa con fotos y contacto"
```

---

## Task 12: Frontend — /propiedades/[id] (botón tasación, card dueño, galería, editar)

**Files:**
- Modify: `vendepro-frontend/src/app/(dashboard)/propiedades/[id]/page.tsx`

- [ ] **Step 1: Agregar imports**

```typescript
import { ArrowLeft, Building2, Loader2, Phone, Mail, User, MapPin, DollarSign, Calendar, Plus, Pencil } from 'lucide-react'
import { PhotoGallery } from '@/components/ui/PhotoGallery'
```

- [ ] **Step 2: Actualizar estado para incluir photos**

Agregar al estado:
```typescript
const [photos, setPhotos] = useState<{ id: string; url: string; sort_order: number }[]>([])
```

En el `useEffect`, actualizar la asignación:
```typescript
.then((d: any) => {
  if (d?.error) { setError(true); setLoading(false); return }
  setProperty(d)
  setPhotos(d.photos || [])
  setLoading(false)
})
```

- [ ] **Step 3: Actualizar el header para agregar botones**

Reemplazar el header actual (el `div` con `flex items-start justify-between`) por:

```tsx
<div className="bg-white rounded-xl shadow-sm p-6 mb-6">
  <div className="flex items-start justify-between gap-4 flex-wrap">
    <div className="flex items-start gap-4">
      <div className="w-12 h-12 rounded-xl bg-[#ff007c]/10 flex items-center justify-center flex-shrink-0">
        <Building2 className="w-6 h-6 text-[#ff007c]" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-gray-800">{property.address}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {[property.neighborhood, property.city].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${stageColor[stage] || 'bg-gray-100 text-gray-600'}`}>
        {stageLabel[stage] || stage}
      </span>
      <Link href={`/tasaciones/nueva?property_id=${id}`}
        className="inline-flex items-center gap-1.5 bg-[#ff007c] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90">
        <Plus className="w-4 h-4" /> Nueva tasación
      </Link>
      <Link href={`/propiedades/${id}/editar`}
        className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50">
        <Pencil className="w-4 h-4" /> Editar
      </Link>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Actualizar la card de Propietario para mostrar link al contacto**

Reemplazar el div de "Propietario" por:

```tsx
<div className="bg-white rounded-xl shadow-sm p-6">
  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Propietario</h2>
  {property.owner_name && property.owner_name !== 'Sin propietario' ? (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
        {property.contact_id ? (
          <Link href={`/contactos/${property.contact_id}`} className="text-[#ff007c] hover:underline font-medium">
            {property.owner_name}
          </Link>
        ) : (
          <span className="text-gray-800 font-medium">{property.owner_name}</span>
        )}
      </div>
      {property.owner_phone && (
        <div className="flex items-center gap-2 text-sm">
          <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <a href={`tel:${property.owner_phone}`} className="text-[#ff007c] hover:underline">{property.owner_phone}</a>
        </div>
      )}
      {property.owner_email && (
        <div className="flex items-center gap-2 text-sm">
          <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <a href={`mailto:${property.owner_email}`} className="text-[#ff007c] hover:underline">{property.owner_email}</a>
        </div>
      )}
    </div>
  ) : (
    <p className="text-sm text-gray-400">Sin datos del propietario</p>
  )}
</div>
```

- [ ] **Step 5: Agregar sección de fotos al final del grid**

Después del cierre del `<div className="grid ...">`, agregar:

```tsx
{/* Galería de fotos */}
{photos.length > 0 && (
  <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Fotos</h2>
    <PhotoGallery photos={photos} propertyId={id} editable={false} />
  </div>
)}
```

- [ ] **Step 6: Verificar en el navegador**

1. Abrir `/propiedades/[id]` — debe mostrar botones "Nueva tasación" y "Editar" en el header
2. Si la propiedad tiene `contact_id`, el nombre del propietario debe ser un link a `/contactos/[contact_id]`
3. Si la propiedad tiene fotos, debe mostrar la galería readonly
4. Click en "Nueva tasación" → `/tasaciones/nueva?property_id=X` → formulario debe pre-llenarse
5. Click en "Editar" → `/propiedades/[id]/editar`

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/propiedades/\[id\]/page.tsx
git commit -m "feat: propiedades/[id] — botón nueva tasación, link a contacto, galería de fotos, botón editar"
```

---

## Self-Review

### Spec coverage
- ✅ `property_id` FK en appraisals (Task 1 + 4 + 8)
- ✅ `contact_id` FK en properties (Task 1 + 2 + 3 + 4)
- ✅ Galería de fotos en R2 con clave `cuentas/{org_id}/propiedades/{property_id}/fotos/{photo_id}` (Task 4 + 7)
- ✅ `property_photos` tabla (Task 1)
- ✅ PropertySelector en `/tasaciones/nueva` con pre-carga por `?property_id` (Task 8)
- ✅ Card de propiedad vinculada en `/tasaciones/[id]` (Task 9)
- ✅ Botón "Nueva tasación" en `/propiedades/[id]` (Task 12)
- ✅ ContactSelector en `/propiedades/nueva` (Task 10)
- ✅ Página de edición `/propiedades/[id]/editar` (Task 11)
- ✅ Fotos editables en página de edición (Task 11)
- ✅ Galería readonly en `/propiedades/[id]` (Task 12)
- ✅ Botón "Editar" en `/propiedades/[id]` (Task 12)
- ✅ `PUT /property-photos/reorder` antes de `DELETE /property-photos/:id` en Hono (Task 4 Step 8)
