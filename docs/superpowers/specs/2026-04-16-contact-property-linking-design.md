# Spec: Vinculación Contacto–Propiedad

**Fecha:** 2026-04-16  
**Estado:** Aprobado

---

## Objetivo

Cuando se crea una propiedad desde un lead o contacto, el contacto vinculado debe pre-seleccionarse automáticamente en el formulario. Cuando se entra directo, el usuario puede buscar un contacto existente o completar los datos inline. La propiedad queda linkeada al contacto y, si aplica, al lead de origen.

---

## Alcance

1. Nueva pantalla de detalle de contacto (`/contactos/[id]`) con botón "Crear propiedad"
2. Selector de contacto en el form de nueva propiedad (`/propiedades/nueva`)
3. Backend: columnas `contact_id` y `lead_id` en tabla `properties`
4. Backend: endpoint `GET /contacts/:id` con leads y propiedades vinculadas

---

## Flujos de entrada al form `/propiedades/nueva`

| Origen | URL | Comportamiento |
|---|---|---|
| Desde lead | `?lead_id=X` | Fetch del lead → pre-selecciona su `contact_id` → pre-llena campos `owner_*` |
| Desde contacto | `?contact_id=X` | Pre-selecciona ese contacto → pre-llena campos `owner_*` |
| Entrada directa | sin params | Selector vacío, campos `owner_*` editables manualmente |

---

## Pantalla de detalle de contacto (`/contactos/[id]`)

### Fuente de datos

`GET /contacts/:id` — devuelve contacto + leads vinculados + propiedades vinculadas.

### Layout

**Header:**
- Nombre completo, badge de tipo (`vendedor`, `comprador`, etc.), fecha de creación
- Botón primario: **"Crear propiedad"** → `href="/propiedades/nueva?contact_id=:id"`
- Botón secundario: "Nuevo lead" (abre el modal existente de leads con contacto pre-seleccionado)
- Acciones rápidas: Llamar (si tiene teléfono), WhatsApp (si tiene teléfono), Editar

**Panel izquierdo — Datos del contacto:**
- Teléfono, email, barrio, notas, fuente, agente asignado

**Panel derecho — Actividad CRM:**
- Lista de leads vinculados: nombre del lead, etapa, fecha
- Lista de propiedades vinculadas: dirección, estado, precio
- Eventos de calendario relacionados (futuro, no en este sprint)

**Estados:** loading skeleton, empty state por sección, error genérico.

---

## Selector de contacto en `/propiedades/nueva`

### Posición en el form

Aparece en la sección "Propietario", antes de los campos `owner_name`, `owner_phone`, `owner_email`.

### Comportamiento

1. **Búsqueda con debounce 300ms** — llama `GET /contacts?search=...`, muestra hasta 5 resultados con nombre, teléfono, tipo de contacto.
2. **Selección:** guarda `contact_id`, auto-llena `owner_name`, `owner_phone`, `owner_email` con los datos del contacto. Los campos siguen editables (el propietario puede ser otra persona).
3. **Limpiar selección:** contacto se deselecciona, `contact_id = null`, campos vuelven a manual.
4. **Sin resultados:** muestra opción "+ Crear contacto nuevo" que abre mini-form inline (nombre, teléfono, email, tipo) — mismo patrón que `leads/page.tsx`.
5. **Pre-selección desde URL:** si hay `?lead_id=X`, se hace fetch del lead para obtener su `contact_id` y datos del contacto. Si hay `?contact_id=X`, se hace fetch directo del contacto.

### Payload POST `/properties`

Se agrega al body existente:
```json
{
  "contact_id": "string | null",
  "lead_id": "string | null"
}
```

---

## Cambios en backend

### 1. Migración SQL — tabla `properties`

```sql
ALTER TABLE properties ADD COLUMN contact_id TEXT REFERENCES contacts(id);
ALTER TABLE properties ADD COLUMN lead_id TEXT REFERENCES leads(id);
CREATE INDEX idx_properties_contact_id ON properties(contact_id);
CREATE INDEX idx_properties_lead_id ON properties(lead_id);
```

### 2. Endpoint nuevo: `GET /contacts/:id`

Devuelve el contacto con sus relaciones:

```json
{
  "id": "...",
  "full_name": "...",
  "phone": "...",
  "email": "...",
  "contact_type": "...",
  "neighborhood": "...",
  "notes": "...",
  "source": "...",
  "agent_id": "...",
  "created_at": "...",
  "leads": [
    { "id": "...", "title": "...", "stage": "...", "created_at": "..." }
  ],
  "properties": [
    { "id": "...", "address": "...", "status": "...", "asking_price": "...", "currency": "..." }
  ]
}
```

Implementación en `api-crm/src/index.ts`:
- Query principal: `SELECT * FROM contacts WHERE id = ? AND org_id = ?`
- Query leads: `SELECT id, title, stage, created_at FROM leads WHERE contact_id = ? AND org_id = ?`
- Query properties: `SELECT id, address, status, asking_price, currency FROM properties WHERE contact_id = ? AND org_id = ?`

### 3. Endpoint actualizado: `POST /properties`

Acepta y persiste `contact_id` y `lead_id` opcionales.

### 4. Endpoint actualizado: `GET /contacts` (lista)

Sin cambio — ya devuelve lo suficiente para el selector de búsqueda.

---

## Botón "Crear propiedad" en contacto detalle

En `/contactos/[id]`, header de la página:
```tsx
<Link href={`/propiedades/nueva?contact_id=${contact.id}`}>
  Crear propiedad
</Link>
```

---

## Archivos a crear / modificar

| Archivo | Acción |
|---|---|
| `vendepro-frontend/src/app/(dashboard)/contactos/[id]/page.tsx` | Crear — detalle de contacto |
| `vendepro-frontend/src/app/(dashboard)/propiedades/nueva/page.tsx` | Modificar — agregar selector contacto + leer URL params |
| `vendepro-frontend/src/lib/types.ts` | Modificar — agregar `contact_id`, `lead_id` a `Property`; `leads` y `properties` a `Contact` |
| `vendepro-backend/packages/api-crm/src/index.ts` | Modificar — agregar `GET /contacts/:id` |
| `vendepro-backend/packages/api-properties/src/index.ts` | Modificar — aceptar `contact_id` y `lead_id` en POST y GET |
| `vendepro-backend/migrations/` | Crear — migración SQL para columnas nuevas |

---

## Fuera de alcance (este sprint)

- Historial de eventos de calendario en detalle de contacto
- Edición inline de contacto desde la propiedad
- Relación many-to-many contactos–propiedades (un contacto puede tener interés en múltiples propiedades — por ahora solo el propietario vinculado)
