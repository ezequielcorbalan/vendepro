# Spec: Propiedades ↔ Tasaciones — Vinculación, Edición y Fotos

**Fecha:** 2026-04-16  
**Estado:** Aprobado

## Resumen

Tres mejoras relacionadas para cerrar el ciclo propiedad ↔ tasación en el CRM:

1. **Tasaciones** pueden vincularse a una propiedad existente (FK permanente `property_id`)
2. **Propiedades** pueden tener un contacto como dueño (FK permanente `contact_id`)
3. **Propiedades** tienen galería de fotos múltiples (R2 + tabla `property_photos`)
4. **Propiedades** tienen página de edición completa (`/propiedades/[id]/editar`)

## Enfoque elegido

**Backend primero** — todos los cambios de schema y endpoints en una sola pasada, luego el frontend módulo por módulo.

---

## Schema D1

### 1. `appraisals` — agregar FK

```sql
ALTER TABLE appraisals ADD COLUMN property_id TEXT REFERENCES properties(id);
```

### 2. `properties` — agregar FK

```sql
ALTER TABLE properties ADD COLUMN contact_id TEXT REFERENCES contacts(id);
```

### 3. Nueva tabla `property_photos`

```sql
CREATE TABLE IF NOT EXISTS property_photos (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  r2_key      TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL
);
```

**R2 key:** `cuentas/{org_id}/propiedades/{property_id}/fotos/{photo_id}`  
El `photo_id` es el mismo `id` de la tabla (generado con `generateId()` antes del upload).

---

## API — api-properties

Todas las rutas en `vendepro-backend/packages/api-properties/src/index.ts`.

### Endpoints modificados

**`GET /properties`**  
- Nuevo query param `q` (texto libre): busca por `address LIKE %q%` o `neighborhood LIKE %q%`  
- Usado por el autocomplete `PropertySelector` en el formulario de tasación

**`POST /properties`**  
- Acepta `contact_id` opcional en el body  
- Si se provee, se guarda en la columna `contact_id` de la tabla

**`GET /properties/:id`**  
- Agrega JOIN con `contacts` para traer `contact_name`, `contact_phone`, `contact_email` del dueño cuando `contact_id` está seteado  
- Agrega subquery / segundo query para traer `photos[]` ordenados por `sort_order`

**`POST /appraisals`**  
- Acepta `property_id` opcional en el body  
- Si se provee, guarda la FK en `appraisals.property_id`

**`PUT /appraisals`**  
- Acepta `property_id` opcional en el body  
- Actualiza la FK si se provee

**`GET /appraisals?id=X`**  
- Cuando `property_id` existe en la fila, hace JOIN con `properties` para traer `property_address`, `property_neighborhood`, y el `property_id` en la respuesta

### Endpoints nuevos

**`PUT /properties/:id`**  
- Edición general de la propiedad: todos los campos actuales + `contact_id`  
- Protegido con `getCurrentUser()` + filtro `org_id`

**`POST /property-photos`**  
- Recibe `multipart/form-data` con `file` + `property_id`  
- Genera `photo_id` con `generateId()` antes del upload  
- Sube a R2 bajo `cuentas/{org_id}/propiedades/{property_id}/fotos/{photo_id}`  
- Inserta en `property_photos` y devuelve la fila creada

**`DELETE /property-photos/:id`**  
- Busca la fila por `id` + `org_id`  
- Borra el objeto de R2 usando `r2_key`  
- Borra la fila de `property_photos`

**`PUT /property-photos/reorder`**  
- Recibe `[{ id, sort_order }]`  
- Actualiza `sort_order` de cada foto en batch  
- ⚠️ Debe registrarse **antes** de `DELETE /property-photos/:id` en Hono para evitar que `reorder` sea interpretado como un `:id`

### api-crm — sin cambios de endpoints

El `GET /contacts` existente acepta filtros y devuelve la lista. El frontend lo usa para el autocomplete del selector de contacto.

---

## Frontend

### Componentes nuevos compartidos

**`PropertySelector`** (`components/ui/PropertySelector.tsx`)  
- Input de búsqueda que llama `GET /properties?q=texto` con debounce 300ms  
- Dropdown con resultados: dirección + barrio + tipo  
- Al seleccionar: emite `{ id, address, neighborhood, city, property_type, size_m2 }`  
- Link "＋ Crear nueva propiedad" → `/propiedades/nueva`  
- Estado vacío: "No se encontraron propiedades"

**`ContactSelector`** (`components/ui/ContactSelector.tsx`)  
- Input de búsqueda que llama `GET /contacts?q=texto` (api-crm) con debounce 300ms  
- Dropdown con resultados: nombre + teléfono + email  
- Al seleccionar: emite `{ id, full_name, phone, email }`  
- Link "＋ Crear nuevo contacto" → `/contactos/nuevo`

**`PhotoGallery`** (`components/ui/PhotoGallery.tsx`)  
- Grid de fotos (3 columnas en desktop, 2 en mobile)  
- Modo readonly: solo muestra fotos  
- Modo editable: botón "Agregar foto" (input file), X para borrar, drag-and-drop para reordenar  
- Upload inmediato al seleccionar archivo → `POST /property-photos`  
- Borrado inmediato → `DELETE /property-photos/:id`  
- Reordenamiento → `PUT /property-photos/reorder`

### Cambios por pantalla

**`/tasaciones/nueva`** (`app/(dashboard)/tasaciones/nueva/page.tsx`)  
- Agrega `PropertySelector` arriba del bloque "Datos de la propiedad"  
- Al seleccionar propiedad: pre-llena `property_address`, `neighborhood`, `city`, `property_type`, `covered_area`, `total_area` y guarda `property_id` en el estado  
- Al guardar, envía `property_id` en el payload  
- Si viene `?property_id=X` en la URL (desde propiedades), pre-carga la propiedad y pre-llena automáticamente

**`/tasaciones/[id]`** (`app/(dashboard)/tasaciones/[id]/page.tsx`)  
- Si `property_id` existe, muestra card "Propiedad vinculada" debajo del header con: dirección, barrio, link → `/propiedades/{property_id}`

**`/propiedades/[id]`** (`app/(dashboard)/propiedades/[id]/page.tsx`)  
- Agrega botón "Nueva tasación" en el header → `/tasaciones/nueva?property_id={id}`  
- Agrega card "Dueño" que muestra datos del contacto vinculado con link → `/contactos/{contact_id}` (si existe `contact_id`)  
- Agrega sección `PhotoGallery` en modo readonly con las fotos de la propiedad  
- Agrega botón "Editar" en el header → `/propiedades/{id}/editar`

**`/propiedades/[id]/editar`** (`app/(dashboard)/propiedades/[id]/editar/page.tsx`)  
- **Página nueva**  
- Carga los datos actuales de la propiedad al montar  
- Campos editables: address, neighborhood, city, property_type, rooms, size_m2, asking_price, currency, status, commercial_stage  
- `ContactSelector` para dueño (pre-selecciona el contacto actual si `contact_id` existe)  
- `PhotoGallery` en modo editable  
- Botón "Guardar" → `PUT /properties/:id`

**`/propiedades/nueva`** (`app/(dashboard)/propiedades/nueva/page.tsx`)  
- Agrega `ContactSelector` para dueño antes del submit  
- Envía `contact_id` en el payload al crear

---

## Reglas de negocio

- `property_id` en tasaciones es opcional — una tasación puede existir sin propiedad vinculada (datos legacy)  
- `contact_id` en propiedades es opcional — el dueño puede seguir siendo texto libre (`owner_name/phone/email`) si no se vincula un contacto  
- Cuando se vincula un contacto, los campos `owner_name/phone/email` se rellenan automáticamente desde el contacto pero NO se sincronizan en tiempo real (snapshot al momento de vincular)  
- Las fotos se pueden borrar individualmente; borrar la propiedad borra las fotos en cascade (DB) pero hay que borrar los objetos R2 manualmente o con un job  
- El reordenamiento de fotos se hace client-side con drag-and-drop y se persiste al soltar

---

## Archivos a crear/modificar

### Backend
- `vendepro-backend/packages/api-properties/src/index.ts` — modificar endpoints existentes + agregar nuevos
- `vendepro-backend/packages/infrastructure/src/repositories/d1-property-repository.ts` — agregar `contact_id`, `photos`, búsqueda por texto, update general

### Frontend
- `vendepro-frontend/src/components/ui/PropertySelector.tsx` — nuevo
- `vendepro-frontend/src/components/ui/ContactSelector.tsx` — nuevo
- `vendepro-frontend/src/components/ui/PhotoGallery.tsx` — nuevo
- `vendepro-frontend/src/app/(dashboard)/tasaciones/nueva/page.tsx` — modificar
- `vendepro-frontend/src/app/(dashboard)/tasaciones/[id]/page.tsx` — modificar
- `vendepro-frontend/src/app/(dashboard)/propiedades/[id]/page.tsx` — modificar
- `vendepro-frontend/src/app/(dashboard)/propiedades/[id]/editar/page.tsx` — nuevo
- `vendepro-frontend/src/app/(dashboard)/propiedades/nueva/page.tsx` — modificar
