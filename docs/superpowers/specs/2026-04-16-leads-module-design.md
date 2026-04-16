# Spec: Módulo Leads — VendéPro

**Fecha:** 2026-04-16  
**Estado:** Aprobado  
**Referencia:** Pantalla `leads/` de reportes-app, reescrita feature por feature  

---

## 1. Objetivo

Agregar un módulo `/leads` completo a VendéPro (nueva ruta, sin tocar `/contactos`). El módulo replica las funcionalidades de la pantalla de leads de reportes-app, adaptado a las convenciones y arquitectura existente de VendéPro.

---

## 2. Arquitectura

```
Frontend:
  src/app/(dashboard)/leads/page.tsx          — lista + kanban
  src/app/(dashboard)/leads/[id]/page.tsx     — detalle
  src/components/leads/                       — componentes del módulo

Backend (api-crm — extensión mínima):
  POST /tags                                  — crear tag de org
  DELETE /tags?id=X                           — eliminar tag
  GET  /stage-history?entity_id=X            — historial de etapas (auditoría)

Utilidades:
  src/lib/lead-utils.ts                       — urgencia, checklist, formatters

Tipos:
  src/lib/types.ts                            — Lead, LeadTag, LeadActivity, LeadStage, LeadUrgency

Navegación:
  src/lib/nav-config.ts                       — entrada "Leads" entre Dashboard y Contactos
```

El backend ya tiene implementados: entidad Lead (9 etapas), 5 use cases, tags system completo, activities (GET), stage history, y endpoints en api-crm. Solo se agregan 3 rutas menores.

---

## 3. Tipos (src/lib/types.ts)

```typescript
export type LeadStage =
  | 'nuevo' | 'asignado' | 'contactado' | 'calificado'
  | 'en_tasacion' | 'presentada' | 'seguimiento' | 'captado' | 'perdido'

export type LeadUrgency = 'ok' | 'warning' | 'danger' | 'lost'

export interface Lead {
  id: string
  org_id: string
  full_name: string
  phone: string | null
  email: string | null
  source: string | null
  source_detail: string | null
  property_address: string | null
  neighborhood: string | null
  property_type: string | null
  operation: string | null
  stage: LeadStage
  assigned_to: string | null
  assigned_name: string | null
  notes: string | null
  estimated_value: string | null
  budget: string | null
  timing: string | null
  personas_trabajo: string | null
  mascotas: string | null
  next_step: string | null
  next_step_date: string | null
  lost_reason: string | null
  first_contact_at: string | null
  created_at: string
  updated_at: string
  tags: LeadTag[]
  last_activity_at: string | null
}

export interface LeadTag {
  id: string
  org_id: string
  name: string
  color: string
  is_default: boolean
}

export interface LeadActivity {
  id: string
  activity_type: string
  description: string | null
  result: string | null
  agent_name: string | null
  created_at: string
}
```

---

## 4. Utilidades (src/lib/lead-utils.ts)

Funciones puras (sin dependencias externas):

| Función | Entrada | Salida | Descripción |
|---------|---------|--------|-------------|
| `getLeadUrgency(lead)` | `Lead` | `LeadUrgency` | danger si >7d sin update o nuevo >24h sin contacto; warning si >3d |
| `getLeadChecklist(lead)` | `Lead` | `Record<string, boolean>` | 6 ítems: contacto, necesidad, operacion, presupuesto, zona, proxima_accion |
| `getLeadChecklistScore(lead)` | `Lead` | `number` | 0–100 |
| `formatWhatsApp(phone)` | `string` | `string` | Convierte a formato internacional Argentina (+54) |
| `formatRelativeTime(date)` | `string` | `string` | "5m", "2h", "3d", "2s" |

---

## 5. Pantalla `/leads` (page.tsx)

### Estado
```typescript
leads: Lead[]
loading: boolean
search: string               // nombre, teléfono, email, dirección
stageFilter: LeadStage | ''
sourceFilter: string
operationFilter: string
agentFilter: string
sortBy: 'recent' | 'urgency' | 'name'
view: 'list' | 'kanban'
showCreateModal: boolean
```

### Features

**Stage tabs:** fila de pills (Todos + 8 etapas activas) con contadores. `perdido` oculto del pipeline principal (solo visible con filtro explícito). Click filtra la lista.

**Búsqueda:** debounced (300ms), parámetro `search` a la API. Busca por nombre, teléfono, email, dirección.

**Filtros:** 4 dropdowns en línea — Etapa, Fuente, Operación, Agente. Cada cambio dispara recarga.

**Sort:** dropdown — Recientes (created_at DESC), Urgencia (danger primero), Nombre A-Z.

**Vista Lista:** tarjetas con:
- Nombre + badge urgencia (URGENTE rojo, Atención amarillo)
- Tags (pills coloreadas)
- Operación + barrio
- Teléfono + acciones rápidas: `tel:`, `wa.me/`, avanzar etapa, eliminar
- Próximo paso (si existe)
- Tiempo desde última actividad (relativo)
- Checklist progress bar (6 segmentos)

**Vista Kanban:** columnas por etapa (8 activas, excluyendo `perdido`), drag & drop con `@dnd-kit/core`. Al soltar: `POST /leads/stage`. Overlay personalizado al arrastrar. Conteo por columna. Indicador de urgencia en columna.

**Crear lead (modal):**
Campos: nombre* (required), teléfono, email, fuente, operación, barrio, dirección, valor estimado (USD), agente asignado (dropdown de agentes), próximo paso, fecha próximo paso, notas. Bottom sheet en mobile, modal centrado en desktop.

**Export CSV:** botón genera y descarga CSV de los leads filtrados actuales.

**Empty state:** ícono + mensaje + botón para crear primer lead.

---

## 6. Pantalla `/leads/[id]` (detalle)

### Secciones

**Header:**
- Nombre (editable en edit mode)
- Tags (pills clickeables para quitar; botón + para agregar)
- Badge etapa (color de etapa)
- Badge urgencia (si aplica)
- Botones: Llamar, WhatsApp, Editar, Eliminar

**Grid de información (2-3 cols):**
teléfono, email, operación, fuente, barrio, valor estimado, dirección, agente asignado

**Selector de etapa:**
9 botones (uno por etapa). Etapa activa resaltada con color + ring. Resto al 60% opacidad. En edit mode: deshabilitado. Al hacer click fuera de edit mode: `POST /leads/stage`.

**Callout Próximo paso** (amarillo): texto + fecha.

**Callout Notas** (gris): texto con whitespace preservado.

**Checklist de completitud:**
6 pills (Contacto, Necesidad, Operación, Presupuesto, Zona, Próxima acción). Verde si completo, gris si no.

**Timeline de actividad:**
Últimas 10. Cada item: punto (pink), tipo de actividad, descripción, nombre agente, tiempo relativo.

### Comportamiento de cambio de etapa

| Etapa destino | Comportamiento |
|---------------|----------------|
| `en_tasacion` | Modal: "¿Crear tasación vinculada?" — Sí (crea appraisal) o Solo avanzar |
| `perdido` | Prompt texto: "¿Por qué se pierde?" → guarda en `lost_reason` |
| `presentada` | Auto-crea evento de calendario tipo "seguimiento" a 7 días. Toast confirma. |

### Edit mode
Toggle Editar/Guardar/Cancelar. En modo edición: todos los campos son inputs. Guardar: `PUT /leads`. Cancelar: descarta cambios locales.

---

## 7. Componentes (`src/components/leads/`)

| Componente | Responsabilidad |
|------------|-----------------|
| `LeadCard` | Tarjeta en vista lista |
| `LeadKanbanBoard` | Tablero con dnd-kit (columnas + DragOverlay) |
| `LeadKanbanCard` | Tarjeta dentro de columna kanban |
| `LeadCreateModal` | Formulario de creación |
| `LeadStageSelector` | 9 botones visuales de etapa |
| `LeadChecklist` | 6 pills de completitud |
| `LeadActivityTimeline` | Lista de actividades |
| `LeadUrgencyBadge` | Badge URGENTE / Atención |
| `LeadTagsDisplay` | Pills de tags con acciones |

---

## 8. Backend — gaps a cubrir

Todos en `vendepro-backend/packages/api-crm/src/index.ts`:

### POST /tags
```
Body: { name, color }
Response: { id }
```
Crea tag de org usando repositorio existente.

### DELETE /tags
```
Query: ?id=X
Response: { success: true }
```

### GET /stage-history
```
Query: ?entity_id=X
Response: StageHistoryEntry[]
```
Delega a `StageHistoryRepository.findByEntity()`.

---

## 9. Navegación

Archivo: `src/lib/nav-config.ts`

Agregar entrada:
```typescript
{ label: 'Leads', href: '/leads', icon: 'Users' }
```
Posición: entre Dashboard y Contactos.

Opcional (fase 2): badge con conteo de leads `danger` si > 0.

---

## 10. Dependencias

Agregar al `vendepro-frontend/package.json`:
```json
"@dnd-kit/core": "^6.x",
"@dnd-kit/sortable": "^8.x"
```

---

## 11. Fuera de scope (esta iteración)

- Creación manual de actividades (el timeline de actividades existentes sí se muestra; crear nuevas actividades desde el detalle queda para siguiente iteración)
- Gestión de tags (crear/eliminar) — solo se usan los existentes
- Bulk operations (seleccionar múltiples leads)
- Analytics/reportes de leads
- Duplicados / merge de leads
- Notificaciones push de urgencia

---

## 12. Orden de implementación

1. Tipos + lead-utils.ts
2. Gaps de backend (3 rutas en api-crm: POST/DELETE /tags, GET /stage-history)
3. LeadCreateModal + LeadCard
4. `/leads/page.tsx` — vista lista
5. LeadKanbanBoard + `/leads/page.tsx` — toggle kanban
6. `/leads/[id]/page.tsx` — detalle + edit mode
7. Cambios de etapa (modales, auto-acciones)
8. LeadActivityTimeline
9. Tags (display + asignar/quitar)
10. Export CSV
11. Navegación sidebar
