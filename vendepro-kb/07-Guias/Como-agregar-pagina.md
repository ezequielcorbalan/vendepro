# 📄 Cómo agregar una página al frontend

## 1. Crear el archivo

Para una página autenticada:
```
src/app/(dashboard)/<seccion>/page.tsx
```

Para rutas dinámicas:
```
src/app/(dashboard)/<seccion>/[id]/page.tsx
```

Para rutas públicas (sin auth):
```
src/app/<letra-corta>/[slug]/page.tsx
```
(Recordá agregarla al allowlist del middleware si es nueva — ver [[Frontend-rutas]].)

## 2. Decidir Server vs Client

**Server Component** (sin `'use client'`):
- Si solo renderiza data fetcheada server-side
- Si no necesita state ni effects
- Si necesita leer cookies

**Client Component** (`'use client'`):
- Si usa `useState`, `useEffect`, `apiFetch`
- Si tiene event handlers
- Casi todas las páginas internas son client

## 3. Esqueleto base de página client

```typescript
'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

export default function MiPagina() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    apiFetch('crm', '/mi-recurso')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed')
        return (await res.json()) as any
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonLoader />
  if (error) return <ErrorState message={error} />
  if (!data.length) return <EmptyState />

  return (
    <div className="p-4 md:p-6">
      {/* ... */}
    </div>
  )
}
```

Recordá: SIEMPRE manejar **loading**, **empty** y **error**. Ver [[Reglas-criticas]].

## 4. Tipos

Si es entidad existente, importá de `@/lib/types`. Si es nueva, agregar tipo a `lib/types.ts` y compartir con backend si aplica.

## 5. Layout

Si necesitás header con título + acciones, copiá el patrón de páginas vecinas. El sidebar y mobile header son automáticos (vienen del `(dashboard)/layout.tsx`).

## 6. Responsive

Decidí el approach según el contexto (ver [[Reglas-criticas]]):
- **Mobile-first**: leads, contactos, calendario, actividades, tasaciones públicas
- **Desktop-first**: dashboards, reportes, admin, **creación de tasaciones**

Patrón:
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

## 7. Agregar al sidebar (si aplica)

`src/lib/nav-config.ts` define el menú. Agregá tu link a la sección que corresponda (Principal | CRM | Comercial | adminSection).

```typescript
{
  href: '/mi-pagina',
  label: 'Mi Página',
  icon: MiIcono,   // import específico de lucide-react
}
```

## 8. Tests

`vitest` con `@testing-library/react`. Patrón:
```typescript
import { render, screen } from '@testing-library/react'
import MiPagina from './page'

it('renderiza el loader', () => {
  render(<MiPagina />)
  expect(screen.getByTestId('loading')).toBeInTheDocument()
})
```

## 9. Actualizá la KB

- Agregá la ruta a [[Frontend-rutas]]
- Si introducís un patrón nuevo de UI, considerar agregar componente reusable a `components/ui/`
