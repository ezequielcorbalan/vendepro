# Spec: Integración Lead-Contacto + API Pública de Leads

**Fecha:** 2026-04-16  
**Estado:** Aprobado  

---

## 1. Objetivo

Todo lead debe estar vinculado a un contacto (persona en la base de datos). El lead representa el pipeline comercial; el contacto representa a la persona. Se agrega además un endpoint público para recibir leads desde sitios web externos autenticados por API key.

---

## 2. Arquitectura

```
Backend (api-crm):
  - Fix bug contacts: role → contact_type en use case y repositorio
  - POST /leads: acepta contact_id (existente) o contact_data (crear nuevo)
  - POST /api-key: genera/regenera API key de la org
  - GET  /api-key: obtiene la API key actual (maskeada)

Backend (api-public):
  - POST /public/leads: endpoint público autenticado con X-API-Key

Base de datos:
  - ALTER TABLE leads ADD COLUMN contact_id TEXT REFERENCES contacts(id)
  - ALTER TABLE organizations ADD COLUMN api_key TEXT
  - Migración: crear contactos desde leads existentes

Frontend:
  - Modal "Nuevo lead": 2 pasos (buscar/crear contacto → datos del pipeline)
  - /leads/[id]: bloque "Ver contacto →" en el header
  - /configuracion: sección "Integración web" con docs + gestión de API key
```

---

## 3. Base de datos

### 3.1 Migración principal (`010_leads_contact_id.sql`)

```sql
-- 1. Agregar contact_id a leads (nullable al inicio para migrar datos)
ALTER TABLE leads ADD COLUMN contact_id TEXT REFERENCES contacts(id);

-- 2. Agregar api_key a organizations
ALTER TABLE organizations ADD COLUMN api_key TEXT;

-- 3. Crear contactos desde leads existentes sin contact_id
-- (se ejecuta como script separado — ver sección 3.2)
```

### 3.2 Script de migración de datos

Para cada lead sin `contact_id`:
1. Crear contacto con: `full_name`, `phone`, `email`, `neighborhood`, `notes`, `source`, `agent_id = assigned_to`, `contact_type = 'propietario'`
2. Actualizar `leads.contact_id = contact.id`

Leads sin `full_name` se saltan (no deberían existir). La migración es idempotente: si ya tiene `contact_id`, se omite.

---

## 4. Fix bug `contacts` (previo a todo lo demás)

**Archivos afectados:**
- `packages/core/src/application/use-cases/contacts/create-contact.ts`
- `packages/infrastructure/src/repositories/d1-contact-repository.ts`

**Cambio:** reemplazar `role` → `contact_type` en `CreateContactInput`, `Contact.create()`, y la query SQL del repositorio. Actualmente los contactos no se guardan por este bug.

---

## 5. Backend — api-crm

### 5.1 `POST /leads` (actualizado)

```typescript
// Body
{
  // Contacto — uno de los dos es requerido:
  contact_id?: string          // vincular a contacto existente
  contact_data?: {             // crear contacto nuevo
    full_name: string
    phone?: string
    email?: string
    contact_type: string       // 'propietario' | 'comprador' | 'inversor' | 'inquilino' | 'otro'
  }
  
  // Pipeline (igual que antes):
  source: string
  source_detail?: string
  operation?: string
  neighborhood?: string
  property_address?: string
  estimated_value?: string
  assigned_to?: string
  next_step?: string
  next_step_date?: string
  notes?: string
}
```

Lógica: si viene `contact_data`, crear contacto primero (usando `CreateContactUseCase`), obtener el `id`, y usarlo como `contact_id` del lead. Si viene `contact_id`, usarlo directamente.

### 5.2 `POST /api-key` (nuevo)

- Auth: `getCurrentUser()`
- Genera key: `vp_live_` + 32 chars hex (`crypto.randomBytes(16).toString('hex')`)
- Guarda en `organizations SET api_key = ? WHERE id = orgId`
- Response: `{ api_key: string }`

### 5.3 `GET /api-key` (nuevo)

- Auth: `getCurrentUser()`
- Devuelve la key actual maskeada: muestra solo los últimos 4 chars
- Response: `{ api_key_masked: string, has_key: boolean }`

---

## 6. Backend — api-public

### 6.1 `POST /public/leads` (nuevo)

```
Header: X-API-Key: vp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

Body:
{
  full_name: string        // requerido
  phone?: string
  email?: string
  notes?: string
  operation?: string       // 'venta' | 'alquiler' | 'tasacion' | 'otro'
  source_detail?: string   // texto libre, ej: "Formulario Home"
}
```

Lógica:
1. Buscar org por `api_key`: `SELECT id FROM organizations WHERE api_key = ?`
2. Si no existe: 401
3. Crear contacto con `contact_type = 'otro'`, `agent_id` = primer admin de la org
4. Crear lead con `source = 'web'`, `stage = 'nuevo'`, `contact_id` del paso anterior
5. Response: `{ id: string, success: true }`

Sin middleware de auth de sesión — usa solo la API key del header.

---

## 7. Frontend

### 7.1 Modal "Nuevo lead" — 2 pasos

**Paso 1: Contacto**

- Campo de búsqueda único: escribe nombre, teléfono o email
- Búsqueda debounced (300ms) a `GET /contacts?search=X`
- Resultados como lista: `[👤 Nombre · Teléfono · Tipo]`
- Click en resultado → contacto seleccionado (campos readonly, badge con nombre)
- Si no hay resultados o el usuario quiere crear uno nuevo: formulario inline con Nombre*, Teléfono, Email, Tipo de contacto (dropdown)
- Botón "Siguiente →" habilitado cuando hay contacto seleccionado o formulario nuevo con nombre

**Paso 2: Pipeline**

- Campos: Fuente (dropdown), Operación (dropdown), Barrio, Dirección propiedad, Valor estimado (USD), Agente asignado, Próximo paso, Fecha próximo paso, Notas
- Botón "Crear lead"
- Botón "← Atrás" para volver al paso 1

**Mobile:** bottom sheet con scroll, pasos apilados (sin pestañas).

### 7.2 `/leads/[id]` — bloque contacto

En el header del detalle, siempre visible:

```
┌─────────────────────────────────────────┐
│ 👤 Juan Pérez · Propietario    Ver →    │
└─────────────────────────────────────────┘
```

- Link navega a `/contactos` (sin página de detalle de contacto todavía — queda para siguiente iteración)
- En edit mode: el bloque es readonly (el contacto no se edita desde el lead)

### 7.3 `/configuracion` — sección "Integración web"

Nueva sección al final de la página de configuración. Contiene:

**Gestión de API key:**
- Si no hay key: botón "Generar API key"
- Si hay key: muestra `vp_live_••••••••••••xxxx` + botón "Copiar" + botón "Regenerar" (con confirm)

**Snippet de ejemplo** (copiable):

```javascript
fetch('https://api-public.vendepro.com.ar/public/leads', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'TU_API_KEY'
  },
  body: JSON.stringify({
    full_name: 'Juan Pérez',
    phone: '1123456789',
    email: 'juan@email.com',
    operation: 'venta',
    source_detail: 'Formulario Home'
  })
})
```

**Tabla de campos aceptados** (nombre, tipo, requerido, descripción).

---

## 8. Orden de implementación

1. Fix bug `contacts` (role → contact_type)
2. Migración SQL (`010_leads_contact_id.sql`) + script de datos
3. Backend api-crm: `POST /leads` actualizado + `POST/GET /api-key`
4. Backend api-public: `POST /public/leads`
5. Frontend: modal "Nuevo lead" con 2 pasos
6. Frontend: bloque contacto en `/leads/[id]`
7. Frontend: sección "Integración web" en `/configuracion`

---

## 9. Fuera de scope

- Página de detalle de contacto con sus leads asociados
- Deduplicación avanzada de contactos (mismo teléfono/email)
- Editar el contacto vinculado desde el lead
- Rate limiting en el endpoint público
- Múltiples API keys por org
- Webhook de notificación al recibir lead externo
