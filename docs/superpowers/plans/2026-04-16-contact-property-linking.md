# Contact–Property Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al crear una propiedad, se puede vincular un contacto existente del CRM; si se llega desde un lead o contacto, ese contacto se pre-selecciona automáticamente. Incluye pantalla de detalle de contacto con botón "Crear propiedad".

**Architecture:** Se agregan columnas `contact_id` y `lead_id` a la tabla `properties`; la entidad `Property` y el repositorio se actualizan para persistirlas. La API CRM suma un endpoint `GET /contacts/:id` que devuelve el contacto con sus leads y propiedades. El form de nueva propiedad lee `?lead_id` o `?contact_id` de la URL y muestra un selector de contacto con debounce.

**Tech Stack:** Hono + Cloudflare D1 (backend), Next.js 15 App Router + Tailwind (frontend), TypeScript, lucide-react

---

## File Map

| Archivo | Acción |
|---|---|
| `vendepro-backend/migrations/010_contact_lead_properties.sql` | Crear |
| `vendepro-backend/packages/core/src/domain/entities/property.ts` | Modificar |
| `vendepro-backend/packages/core/src/application/use-cases/properties/create-property.ts` | Modificar |
| `vendepro-backend/packages/infrastructure/src/repositories/d1-property-repository.ts` | Modificar |
| `vendepro-backend/packages/api-crm/src/index.ts` | Modificar |
| `vendepro-frontend/src/lib/types.ts` | Modificar |
| `vendepro-frontend/src/app/(dashboard)/propiedades/nueva/page.tsx` | Modificar |
| `vendepro-frontend/src/app/(dashboard)/contactos/[id]/page.tsx` | Crear |

---

## Task 1: Migración SQL — contact_id y lead_id en properties

**Files:**
- Create: `vendepro-backend/migrations/010_contact_lead_properties.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- Vincular propiedades a contactos y leads del CRM
ALTER TABLE properties ADD COLUMN contact_id TEXT REFERENCES contacts(id);
ALTER TABLE properties ADD COLUMN lead_id TEXT REFERENCES leads(id);

CREATE INDEX IF NOT EXISTS idx_properties_contact_id ON properties(contact_id);
CREATE INDEX IF NOT EXISTS idx_properties_lead_id ON properties(lead_id);
```

- [ ] **Step 2: Verificar que el archivo existe**

```bash
ls vendepro-backend/migrations/010_contact_lead_properties.sql
```

- [ ] **Step 3: Commit**

```bash
git add vendepro-backend/migrations/010_contact_lead_properties.sql
git commit -m "feat(db): add contact_id and lead_id to properties table"
```

---

## Task 2: Property entity — agregar contact_id y lead_id

**Files:**
- Modify: `vendepro-backend/packages/core/src/domain/entities/property.ts`

- [ ] **Step 1: Agregar los campos a PropertyProps**

En `property.ts`, en la interface `PropertyProps`, después de `commercial_stage: string | null`:

```typescript
  contact_id?: string | null
  lead_id?: string | null
```

La interface completa del bloque de campos nuevos (insertar después de la línea `commercial_stage: string | null`):

```typescript
  commercial_stage: string | null
  contact_id?: string | null
  lead_id?: string | null
  created_at: string
```

- [ ] **Step 2: Verificar que `Property.create` los acepta sin cambios**

El método `static create` usa `...props` — como los campos son opcionales en `PropertyProps`, no requiere cambio. Verificar visualmente que el spread funciona.

- [ ] **Step 3: Commit**

```bash
git add vendepro-backend/packages/core/src/domain/entities/property.ts
git commit -m "feat(core): add contact_id and lead_id to Property entity"
```

---

## Task 3: CreatePropertyUseCase — aceptar contact_id y lead_id

**Files:**
- Modify: `vendepro-backend/packages/core/src/application/use-cases/properties/create-property.ts`

- [ ] **Step 1: Agregar los campos al input y pasarlos a Property.create**

Reemplazar el bloque de `CreatePropertyInput` y el interior de `execute()`:

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
  contact_id?: string | null
  lead_id?: string | null
}
```

En `Property.create({...})` dentro de `execute()`, agregar después de `commercial_stage: null`:

```typescript
      commercial_stage: null,
      contact_id: input.contact_id ?? null,
      lead_id: input.lead_id ?? null,
```

- [ ] **Step 2: Commit**

```bash
git add vendepro-backend/packages/core/src/application/use-cases/properties/create-property.ts
git commit -m "feat(core): CreatePropertyUseCase accepts contact_id and lead_id"
```

---

## Task 4: D1PropertyRepository — persistir y leer contact_id y lead_id

**Files:**
- Modify: `vendepro-backend/packages/infrastructure/src/repositories/d1-property-repository.ts`

- [ ] **Step 1: Actualizar el INSERT en `save()`**

Reemplazar el bloque `INSERT INTO properties` completo:

```typescript
  async save(property: Property): Promise<void> {
    const o = property.toObject()
    await this.db.prepare(`
      INSERT INTO properties (id, org_id, address, neighborhood, city, property_type, rooms, size_m2,
        asking_price, currency, owner_name, owner_phone, owner_email, public_slug, cover_photo,
        agent_id, status, commercial_stage, contact_id, lead_id, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        address=excluded.address, neighborhood=excluded.neighborhood, rooms=excluded.rooms,
        size_m2=excluded.size_m2, asking_price=excluded.asking_price, currency=excluded.currency,
        owner_name=excluded.owner_name, owner_phone=excluded.owner_phone, owner_email=excluded.owner_email,
        cover_photo=excluded.cover_photo, status=excluded.status, commercial_stage=excluded.commercial_stage,
        contact_id=excluded.contact_id, lead_id=excluded.lead_id,
        updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.address, o.neighborhood, o.city, o.property_type, o.rooms, o.size_m2,
      o.asking_price, o.currency, o.owner_name, o.owner_phone, o.owner_email, o.public_slug,
      o.cover_photo, o.agent_id, o.status, o.commercial_stage, o.contact_id ?? null, o.lead_id ?? null,
      o.created_at, o.updated_at
    ).run()
  }
```

- [ ] **Step 2: Actualizar `toEntity()` para leer los nuevos campos**

En el objeto pasado a `Property.create({...})` dentro de `toEntity()`, agregar después de `commercial_stage`:

```typescript
      commercial_stage: row.commercial_stage ?? null,
      contact_id: row.contact_id ?? null,
      lead_id: row.lead_id ?? null,
```

- [ ] **Step 3: Commit**

```bash
git add vendepro-backend/packages/infrastructure/src/repositories/d1-property-repository.ts
git commit -m "feat(infra): persist and read contact_id/lead_id in D1PropertyRepository"
```

---

## Task 5: API CRM — endpoint GET /contacts/:id

**Files:**
- Modify: `vendepro-backend/packages/api-crm/src/index.ts`

- [ ] **Step 1: Agregar el endpoint después de `GET /contacts`**

Insertar después del bloque `app.get('/contacts', ...)` (línea ~106), antes de `app.post('/contacts', ...)`:

```typescript
app.get('/contacts/:id', async (c) => {
  const id = c.req.param('id')
  const orgId = c.get('orgId')
  const repo = new D1ContactRepository(c.env.DB)
  const contact = await repo.findById(id, orgId)
  if (!contact) return c.json({ error: 'Contacto no encontrado' }, 404)

  const [leadsResult, propertiesResult] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, full_name, stage, created_at FROM leads WHERE contact_id = ? AND org_id = ? ORDER BY created_at DESC LIMIT 20`
    ).bind(id, orgId).all(),
    c.env.DB.prepare(
      `SELECT id, address, status, asking_price, currency FROM properties WHERE contact_id = ? AND org_id = ? ORDER BY created_at DESC LIMIT 20`
    ).bind(id, orgId).all(),
  ])

  return c.json({
    ...contact.toObject(),
    leads: leadsResult.results ?? [],
    properties: propertiesResult.results ?? [],
  })
})
```

- [ ] **Step 2: Verificar que el endpoint se registra antes de `app.post('/contacts')`**

Leer el archivo y confirmar el orden de rutas en la sección de contactos:
1. `GET /contacts` (lista)
2. `GET /contacts/:id` (nuevo)
3. `POST /contacts`
4. `DELETE /contacts`

- [ ] **Step 3: Commit**

```bash
git add vendepro-backend/packages/api-crm/src/index.ts
git commit -m "feat(api-crm): add GET /contacts/:id with leads and properties"
```

---

## Task 6: Frontend types — actualizar Property y Contact

**Files:**
- Modify: `vendepro-frontend/src/lib/types.ts`

- [ ] **Step 1: Agregar contact_id y lead_id a la interface Property**

En `types.ts`, en la interface `Property` (líneas 34-56), agregar después de `owner_email: string | null`:

```typescript
  owner_email: string | null
  contact_id?: string | null
  lead_id?: string | null
```

- [ ] **Step 2: Agregar leads y properties a la interface Contact para el detalle**

En `types.ts`, en la interface `Contact` (líneas 185-197), agregar después de `created_at: string`:

```typescript
  created_at: string
  // Populated in GET /contacts/:id
  leads?: Array<{ id: string; full_name: string; stage: string; created_at: string }>
  properties?: Array<{ id: string; address: string; status: string; asking_price: number | null; currency: string }>
```

- [ ] **Step 3: Commit**

```bash
git add vendepro-frontend/src/lib/types.ts
git commit -m "feat(types): add contact_id/lead_id to Property, leads/properties to Contact"
```

---

## Task 7: Form de nueva propiedad — selector de contacto

**Files:**
- Modify: `vendepro-frontend/src/app/(dashboard)/propiedades/nueva/page.tsx`

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

```typescript
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, Search, X, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import type { Contact } from '@/lib/types'

const PROPERTY_TYPES = [
  { value: 'departamento', label: 'Departamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'ph', label: 'PH' },
  { value: 'local', label: 'Local' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'oficina', label: 'Oficina' },
]

const CONTACT_TYPES = [
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'comprador', label: 'Comprador' },
  { value: 'inversor', label: 'Inversor' },
  { value: 'inquilino', label: 'Inquilino' },
  { value: 'otro', label: 'Otro' },
]

export default function NuevaPropiedadPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)

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
  })

  // Contact linking state
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [contactSearch, setContactSearch] = useState('')
  const [contactResults, setContactResults] = useState<Contact[]>([])
  const [showNewContactForm, setShowNewContactForm] = useState(false)
  const [newContact, setNewContact] = useState({ full_name: '', phone: '', email: '', contact_type: 'vendedor' })
  const [creatingContact, setCreatingContact] = useState(false)
  const [linkedLeadId, setLinkedLeadId] = useState<string | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pre-load from URL params
  useEffect(() => {
    const leadId = searchParams.get('lead_id')
    const contactId = searchParams.get('contact_id')

    async function preload() {
      try {
        if (leadId) {
          setLinkedLeadId(leadId)
          const res = await apiFetch('crm', `/leads`)
          const leads = (await res.json()) as any[]
          const lead = leads.find((l: any) => l.id === leadId)
          if (lead?.contact_id) {
            const cRes = await apiFetch('crm', `/contacts/${lead.contact_id}`)
            const contact = (await cRes.json()) as any
            if (contact?.id) {
              setSelectedContact(contact)
              setForm(prev => ({
                ...prev,
                owner_name: contact.full_name || '',
                owner_phone: contact.phone || '',
                owner_email: contact.email || '',
                neighborhood: prev.neighborhood || lead.neighborhood || '',
              }))
            }
          }
        } else if (contactId) {
          const cRes = await apiFetch('crm', `/contacts/${contactId}`)
          const contact = (await cRes.json()) as any
          if (contact?.id) {
            setSelectedContact(contact)
            setForm(prev => ({
              ...prev,
              owner_name: contact.full_name || '',
              owner_phone: contact.phone || '',
              owner_email: contact.email || '',
            }))
          }
        }
      } catch {
        // preload failure is non-critical
      } finally {
        setInitializing(false)
      }
    }

    preload()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Contact search with debounce
  useEffect(() => {
    if (!contactSearch.trim() || selectedContact) {
      setContactResults([])
      return
    }
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch('crm', `/contacts?search=${encodeURIComponent(contactSearch)}`)
        const data = (await res.json()) as any
        setContactResults(Array.isArray(data) ? data.slice(0, 5) : [])
      } catch {
        setContactResults([])
      }
    }, 300)
  }, [contactSearch, selectedContact])

  function selectContact(contact: Contact) {
    setSelectedContact(contact)
    setContactSearch('')
    setContactResults([])
    setShowNewContactForm(false)
    setForm(prev => ({
      ...prev,
      owner_name: contact.full_name || prev.owner_name,
      owner_phone: contact.phone || prev.owner_phone,
      owner_email: contact.email || prev.owner_email,
    }))
  }

  function clearContact() {
    setSelectedContact(null)
    setContactSearch('')
    setContactResults([])
  }

  async function handleCreateContact() {
    if (!newContact.full_name.trim()) { toast('El nombre es requerido', 'error'); return }
    setCreatingContact(true)
    try {
      const res = await apiFetch('crm', '/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact),
      })
      const data = (await res.json()) as any
      if (data.id) {
        selectContact({ ...data, full_name: newContact.full_name, phone: newContact.phone || null, email: newContact.email || null } as Contact)
        setShowNewContactForm(false)
        setNewContact({ full_name: '', phone: '', email: '', contact_type: 'vendedor' })
        toast('Contacto creado y vinculado')
      } else {
        toast(data.error || 'Error al crear contacto', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setCreatingContact(false)
  }

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.address) { toast('La dirección es requerida', 'error'); return }
    if (!form.owner_name) { toast('El nombre del propietario es requerido', 'error'); return }
    setLoading(true)
    try {
      const payload: any = { ...form }
      if (form.rooms) payload.rooms = Number(form.rooms)
      if (form.size_m2) payload.size_m2 = Number(form.size_m2)
      if (form.asking_price) payload.asking_price = Number(form.asking_price)
      if (selectedContact) payload.contact_id = selectedContact.id
      if (linkedLeadId) payload.lead_id = linkedLeadId

      const res = await apiFetch('properties', '/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as any
      if (data.id) {
        toast('Propiedad creada')
        router.push(`/propiedades/${data.id}`)
      } else {
        toast(data.error || 'Error al crear', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setLoading(false)
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]'

  if (initializing) {
    return (
      <div className="max-w-2xl flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <Link href="/propiedades" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a propiedades
      </Link>

      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Nueva propiedad</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-4 sm:p-6 space-y-5 sm:space-y-6">

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección *</label>
            <input type="text" value={form.address} onChange={e => update('address', e.target.value)} required placeholder="Ej: Cervantes 3124" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Barrio *</label>
            <input type="text" value={form.neighborhood} onChange={e => update('neighborhood', e.target.value)} required placeholder="Ej: Villa Devoto" className={inputClass} />
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
            <input type="number" value={form.rooms} onChange={e => update('rooms', e.target.value)} placeholder="Ej: 3" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Superficie (m²)</label>
            <input type="number" value={form.size_m2} onChange={e => update('size_m2', e.target.value)} placeholder="Ej: 65" className={inputClass} />
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
            <input type="number" value={form.asking_price} onChange={e => update('asking_price', e.target.value)} placeholder="Ej: 85000" className={inputClass} />
          </div>
        </div>

        <hr className="border-gray-200" />

        <div>
          <h2 className="text-lg font-medium text-gray-800 mb-3">Datos del propietario</h2>

          {/* Contact selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Vincular a contacto del CRM</label>
            {selectedContact ? (
              <div className="flex items-center justify-between bg-pink-50 border border-pink-200 rounded-lg px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-800">{selectedContact.full_name}</p>
                  <p className="text-xs text-gray-500">{selectedContact.contact_type}{selectedContact.phone ? ` · ${selectedContact.phone}` : ''}</p>
                </div>
                <button type="button" onClick={clearContact} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={e => { setContactSearch(e.target.value); setShowNewContactForm(false) }}
                    placeholder="Buscar por nombre o teléfono..."
                    className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]"
                  />
                </div>
                {contactResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                    {contactResults.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectContact(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-800">{c.full_name}</p>
                          <p className="text-xs text-gray-500">{c.contact_type}{c.phone ? ` · ${c.phone}` : ''}</p>
                        </div>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { setShowNewContactForm(true); setContactResults([]) }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2 text-[#ff007c] border-t border-gray-100"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span className="text-sm">Crear nuevo contacto</span>
                    </button>
                  </div>
                )}
                {contactSearch.trim() && contactResults.length === 0 && !showNewContactForm && (
                  <button
                    type="button"
                    onClick={() => setShowNewContactForm(true)}
                    className="mt-1 flex items-center gap-2 text-sm text-[#ff007c] hover:underline"
                  >
                    <UserPlus className="w-4 h-4" />
                    No encontrado — crear nuevo contacto
                  </button>
                )}
              </div>
            )}

            {showNewContactForm && !selectedContact && (
              <div className="mt-3 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                <p className="text-sm font-medium text-gray-700">Nuevo contacto</p>
                <input type="text" placeholder="Nombre *" value={newContact.full_name} onChange={e => setNewContact(p => ({ ...p, full_name: e.target.value }))} className={inputClass} />
                <input type="tel" placeholder="Teléfono" value={newContact.phone} onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))} className={inputClass} />
                <input type="email" placeholder="Email" value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))} className={inputClass} />
                <select value={newContact.contact_type} onChange={e => setNewContact(p => ({ ...p, contact_type: e.target.value }))} className={inputClass}>
                  {CONTACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <div className="flex gap-2">
                  <button type="button" onClick={handleCreateContact} disabled={creatingContact} className="flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                    {creatingContact ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Crear y vincular
                  </button>
                  <button type="button" onClick={() => { setShowNewContactForm(false); setContactSearch('') }} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
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
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#ff007c] text-white px-6 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Guardando...' : 'Crear propiedad'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd vendepro-frontend && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores en este archivo.

- [ ] **Step 3: Commit**

```bash
git add vendepro-frontend/src/app/(dashboard)/propiedades/nueva/page.tsx
git commit -m "feat(frontend): contact selector in nueva propiedad with URL pre-fill"
```

---

## Task 8: Pantalla de detalle de contacto

**Files:**
- Create: `vendepro-frontend/src/app/(dashboard)/contactos/[id]/page.tsx`

- [ ] **Step 1: Crear el archivo**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Phone, Mail, MapPin, User, Home, Loader2,
  ExternalLink, MessageCircle, Building2, UserPlus
} from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import type { Contact } from '@/lib/types'

const STAGE_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  calificado: 'Calificado',
  visita: 'Visita',
  propuesta: 'Propuesta',
  negociacion: 'Negociación',
  cerrado: 'Cerrado',
  perdido: 'Perdido',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activa',
  inactive: 'Inactiva',
  sold: 'Vendida',
  rented: 'Alquilada',
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    apiFetch('crm', `/contacts/${id}`)
      .then(res => res.json())
      .then((data: any) => {
        if (data?.id) setContact(data)
        else setError(true)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  )

  if (error || !contact) return (
    <div className="max-w-3xl">
      <Link href="/contactos" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a contactos
      </Link>
      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <p className="text-gray-500">Contacto no encontrado.</p>
      </div>
    </div>
  )

  const contactTypeLabel: Record<string, string> = {
    vendedor: 'Vendedor', comprador: 'Comprador', inversor: 'Inversor',
    inquilino: 'Inquilino', otro: 'Otro',
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/contactos" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4" /> Volver a contactos
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-[#ff007c]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800">{contact.full_name}</h1>
              <span className="inline-block mt-0.5 text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {contactTypeLabel[contact.contact_type] ?? contact.contact_type}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors">
                <Phone className="w-3.5 h-3.5" /> Llamar
              </a>
            )}
            {contact.phone && (
              <a href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm bg-green-50 hover:bg-green-100 text-green-700 px-3 py-2 rounded-lg transition-colors">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>
            )}
            <Link href={`/leads?new=1&contact_id=${contact.id}`} className="flex items-center gap-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors">
              <UserPlus className="w-3.5 h-3.5" /> Nuevo lead
            </Link>
            <Link href={`/propiedades/nueva?contact_id=${contact.id}`} className="flex items-center gap-1.5 text-sm bg-[#ff007c] hover:opacity-90 text-white px-3 py-2 rounded-lg transition-opacity">
              <Home className="w-3.5 h-3.5" /> Crear propiedad
            </Link>
          </div>
        </div>

        {/* Contact data */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {contact.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span>{contact.phone}</span>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="truncate">{contact.email}</span>
            </div>
          )}
          {contact.neighborhood && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span>{contact.neighborhood}</span>
            </div>
          )}
          {contact.notes && (
            <div className="col-span-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
              {contact.notes}
            </div>
          )}
        </div>
      </div>

      {/* Leads vinculados */}
      <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          Leads vinculados
          {contact.leads && contact.leads.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{contact.leads.length}</span>
          )}
        </h2>
        {!contact.leads || contact.leads.length === 0 ? (
          <p className="text-sm text-gray-400">Sin leads vinculados.</p>
        ) : (
          <div className="space-y-2">
            {contact.leads.map(lead => (
              <Link key={lead.id} href={`/leads/${lead.id}`} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors group">
                <div>
                  <p className="text-sm font-medium text-gray-800">{lead.full_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{STAGE_LABELS[lead.stage] ?? lead.stage}</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Propiedades vinculadas */}
      <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400" />
          Propiedades vinculadas
          {contact.properties && contact.properties.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{contact.properties.length}</span>
          )}
        </h2>
        {!contact.properties || contact.properties.length === 0 ? (
          <p className="text-sm text-gray-400">Sin propiedades vinculadas.</p>
        ) : (
          <div className="space-y-2">
            {contact.properties.map(prop => (
              <Link key={prop.id} href={`/propiedades/${prop.id}`} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors group">
                <div>
                  <p className="text-sm font-medium text-gray-800">{prop.address}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {STATUS_LABELS[prop.status] ?? prop.status}
                    {prop.asking_price ? ` · ${prop.currency} ${prop.asking_price.toLocaleString('es-AR')}` : ''}
                  </p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd vendepro-frontend && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores en el nuevo archivo.

- [ ] **Step 3: Commit**

```bash
git add vendepro-frontend/src/app/(dashboard)/contactos/[id]/page.tsx
git commit -m "feat(frontend): contact detail page with leads and properties"
```

---

## Task 9: leads/page.tsx — abrir modal con contacto pre-seleccionado desde URL

**Files:**
- Modify: `vendepro-frontend/src/app/(dashboard)/leads/page.tsx`

El botón "Nuevo lead" en el detalle de contacto navega a `/leads?new=1&contact_id=X`. Este task hace que la página de leads detecte esos params y abra el modal en el paso 2 con el contacto ya seleccionado.

- [ ] **Step 1: Agregar useEffect para manejar los URL params**

En `leads/page.tsx`, dentro del componente `LeadsPage`, agregar este `useEffect` **después** del `useEffect` de `loadLeads()` (después de la línea que llama `loadLeads()` y agents):

```typescript
  // Auto-open create modal when coming from contact detail
  useEffect(() => {
    const newParam = searchParams.get('new')
    const contactIdParam = searchParams.get('contact_id')
    if (newParam !== '1' || !contactIdParam) return

    apiFetch('crm', `/contacts/${contactIdParam}`)
      .then(r => r.json() as Promise<any>)
      .then(data => {
        if (data?.id) {
          setSelectedContact(data as Contact)
          setCreateStep(2)
          setShowCreate(true)
        }
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd vendepro-frontend && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add vendepro-frontend/src/app/(dashboard)/leads/page.tsx
git commit -m "feat(leads): auto-open new lead modal from contact_id URL param"
```

---

## Task 10: Linkear contactos desde el listado de contactos

**Files:**
- Modify: `vendepro-frontend/src/app/(dashboard)/contactos/page.tsx`

- [ ] **Step 1: Agregar link al detalle desde cada card/fila de contacto**

Buscar en `contactos/page.tsx` dónde se renderiza cada contacto (la tarjeta o fila). Envolver el nombre del contacto (o agregar un icono de link) con:

```tsx
<Link href={`/contactos/${contact.id}`} className="font-medium text-gray-800 hover:text-[#ff007c] truncate">
  {contact.full_name}
</Link>
```

Si hay un botón de acciones por contacto, agregar la opción "Ver detalle" que navega a `/contactos/${contact.id}`.

- [ ] **Step 2: Verificar TypeScript**

```bash
cd vendepro-frontend && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add vendepro-frontend/src/app/(dashboard)/contactos/page.tsx
git commit -m "feat(frontend): link to contact detail from contacts list"
```

---

## Task 11: Verificación manual end-to-end

- [ ] **Step 1: Aplicar la migración en D1 local**

```bash
cd vendepro-backend
npx wrangler d1 execute reportes-mg-db --local --file=migrations/010_contact_lead_properties.sql
```

Esperado: `Executed 1 command(s). 0 errors.`

- [ ] **Step 2: Levantar el backend CRM local**

```bash
cd vendepro-backend/packages/api-crm && npx wrangler dev --port 8788
```

- [ ] **Step 3: Levantar el backend Properties local**

```bash
cd vendepro-backend/packages/api-properties && npx wrangler dev --port 8789
```

- [ ] **Step 4: Levantar el frontend**

```bash
cd vendepro-frontend && npm run dev
```

- [ ] **Step 5: Verificar flujo desde lead**

1. Ir a un lead que tenga contacto vinculado
2. Hacer click en "Crear propiedad"
3. Verificar que el formulario en `/propiedades/nueva?lead_id=X` pre-selecciona el contacto del lead
4. Verificar que `owner_name`, `owner_phone`, `owner_email` se pre-llenan con los datos del contacto
5. Crear la propiedad y verificar que redirige al detalle

- [ ] **Step 6: Verificar flujo desde contacto**

1. Ir al listado de contactos `/contactos`
2. Click en un contacto → debe abrir `/contactos/:id`
3. En la pantalla de detalle, verificar: datos del contacto, lista de leads, lista de propiedades
4. Click en "Crear propiedad" → debe ir a `/propiedades/nueva?contact_id=X` con contacto pre-seleccionado
5. Volver al detalle del contacto, click en "Nuevo lead" → debe abrir `/leads?new=1&contact_id=X` con el modal en paso 2 y el contacto ya seleccionado

- [ ] **Step 7: Verificar flujo directo**

1. Ir a `/propiedades/nueva` sin params
2. Escribir en el buscador de contacto → deben aparecer resultados con debounce
3. Seleccionar un contacto → campos owner se llenan, badge aparece con X para limpiar
4. Limpiar contacto → campos vuelven a manual
5. Buscar algo que no existe → aparece "Crear nuevo contacto"
6. Crear el contacto inline → queda vinculado automáticamente
