# Plan: Portal de documentación del propietario (`/d/<token>`)

Estado: **fase 1 implementada** (15-oct-2026), falta migración 061 + deploy de api-properties
y api-public + cargar la integración `docs_n8n` en producción. Fases 2 y 3 sin empezar.

Decisiones tomadas: (1) sólo se mapean al checklist manual los documentos que son
exactamente el mismo, el resto entra como ítem propio `doc_<tipo>`; (2) el link no vence:
se revoca a mano, al regenerar, o cuando la propiedad pasa a vendida/archivada; (3) el
propietario no ve links de Drive; (4) el mapa de agentes se carga en Configuración →
Integraciones; (5) la fase 2 sigue pendiente de decidir porque toca n8n.
Origen: brief "automatización de documentación de propiedades" (workflow n8n `B6eghD1i1Sw2OldJ`, en producción).

## Idea en una línea

El agente genera desde la ficha de la propiedad un link `/d/<token>`. El propietario
ve qué le falta y sube los archivos. `api-public` reenvía cada archivo **tal cual** al
webhook de n8n que ya existe, lee qué documento reconoció la IA y guarda el resultado
en D1. n8n sigue siendo el motor (Drive, clasificación, planilla, mails) y **no se
toca en la fase 1**.

```
Propietario ──/d/<token>──▶ api-public ──multipart──▶ n8n /webhook/documentacion-subir
                              │  ◀── { documento reconocido, links Drive } ──┘
                              ▼
                     D1: property_documents + properties.doc_status_json
                              ▼
            Ficha de la propiedad (DocChecklistWidget) se tilda sola
```

## Qué resuelve (del brief, §11 y §14)

| Problema | Cómo |
|---|---|
| La página de n8n es abierta, cualquiera sube a cualquier dirección | El token lleva la propiedad; la dirección, la operación, el tipo y el agente salen de D1, no de lo que tipea el propietario |
| El propietario no ve su estado | `/d/<token>` muestra requeridos / opcionales / "lo pedimos nosotros" y lo ya recibido |
| No puede volver a entrar | El link es permanente hasta que se revoca o se cierra la propiedad |
| "Integrar con VendéPro" | El checklist de la propiedad se actualiza solo y el link a la carpeta se completa |
| Mails duplicados en dos casillas | Por el portal no pasa; para la vía mail, `drive_file_id` único (fase 2) |

---

## Paso 0 — Contrato real de n8n ✅ (15-oct-2026)

Leído del JS de la página pública `GET /webhook/documentacion` (no hizo falta la API key):

- **Subida** `POST /webhook/documentacion-subir`, multipart: `archivo` + `direccion`,
  `operacion` (`venta`|`alquiler`), `tipo` (`depto`|`ph`|`casa`|`local`|`otro`), `sucesion`
  (`no`|`si`|`nose`), `nombre`, `telefono`, `email`, `sid`, y `agente` opcional. No hay
  campo de estado civil: el casado lo detecta n8n leyendo los documentos.
- **Respuesta**: `{ ok, error?, tipo, tipo_label, reconocido }`. La página no usa más que eso;
  **no está confirmado** si además trae `file_id`, `link_archivo`, `link_carpeta` o
  `fecha_emision`. El gateway los lee si vienen (best-effort). Si no vienen, el link de
  Drive por archivo y la carpeta no se completan en VendéPro: agregarlos a `Responder
  Subida` es el único cambio de n8n que suma algo en fase 1.
- **Cierre** `POST /webhook/documentacion-listo`, `Content-Type: text/plain`, body `{"sid": "…"}`.
- **Límites**: 15 MB por archivo, `.pdf` e `image/*`.

Pendiente: una subida real de prueba con una propiedad "Inexistente 99999" (trampa #8 del
brief) para ver la respuesta completa. No se hizo porque escribe en Drive y en la planilla
de producción y entra en el recordatorio de las 12/16/20.

---

## Fase 1 — Portal (sin tocar n8n)

### 1. Migración `061_portal_documentacion.sql`

Número 061: en main la última es 054 y otras ramas abiertas ya usan 055–060. Si alguna de
esas no se mergea, el número igual sirve (las migraciones se aplican en orden y no hay huecos
que importen).

```sql
-- Link por propiedad que se le manda al propietario.
CREATE TABLE IF NOT EXISTS doc_portal_links (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  property_id TEXT NOT NULL REFERENCES properties(id),
  agent_id TEXT REFERENCES users(id),         -- quién lo generó / a quién se avisa
  token TEXT NOT NULL,                         -- 32 bytes random, hex
  operation TEXT NOT NULL CHECK (operation IN ('venta','alquiler')),
  property_kind TEXT NOT NULL CHECK (property_kind IN ('depto','ph','casa','local','otro')),
  succession TEXT NOT NULL DEFAULT 'no' CHECK (succession IN ('si','no','no_sabe')),
  married INTEGER,                             -- NULL = no se sabe
  session_id TEXT NOT NULL,                    -- `sid` que se le pasa a n8n
  files_count INTEGER NOT NULL DEFAULT 0,
  last_upload_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_portal_links_token ON doc_portal_links(token);
-- Un solo link vivo por propiedad: regenerar = revocar el anterior.
CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_portal_links_active
  ON doc_portal_links(property_id) WHERE revoked_at IS NULL;

-- Un registro por archivo recibido (espejo en D1 de la planilla de n8n).
CREATE TABLE IF NOT EXISTS property_documents (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  property_id TEXT NOT NULL REFERENCES properties(id),
  link_id TEXT REFERENCES doc_portal_links(id),  -- NULL si entró por mail (fase 2)
  source TEXT NOT NULL CHECK (source IN ('portal','email')),
  original_name TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'otro',         -- tipo_id de n8n
  recognized INTEGER NOT NULL DEFAULT 0,
  issued_at TEXT,
  drive_file_id TEXT,
  drive_file_url TEXT,
  drive_folder_url TEXT,
  observations TEXT,
  size_bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_property_documents_property ON property_documents(property_id, created_at);
-- Idempotencia: el mismo archivo de Drive no se registra dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS idx_property_documents_drive
  ON property_documents(drive_file_id) WHERE drive_file_id IS NOT NULL;
```

Configuración por org en la tabla existente `org_integrations`, `provider = 'docs_n8n'`:
`config_json = { upload_url, done_url, agent_map: { <user_id>: 'andres' | 'danila' | 'oficina' } }`,
`credentials_encrypted` = secreto compartido para el callback de la fase 2. Sin integración
habilitada → no se puede generar el link (el botón lo explica). Esto mantiene multi-tenant:
nada de Marcela queda en el código.

### 2. Core (`packages/core`) — reglas puras, con tests

- `domain/rules/document-checklist.ts`
  - `DOC_TYPES`: catálogo de los 17 `tipo_id` del brief con label en castellano.
  - `computeDocChecklist({ operation, kind, succession, married })` →
    `{ required, optional, internal }`, portado literal del brief §7 (venta, alquiler
    provisorio, sucesión, matrimonio, AySA sólo en casa/local, dominio + inhibición
    siempre en `internal`).
  - `checklistProgress(checklist, receivedTypes)` → qué está, qué falta.
  - `toN8nKind(property_type)`: departamento→depto, ph, casa, local, terreno/oficina→otro.
- `domain/rules/doc-status-mapping.ts`: `tipo_id` → clave de `DocChecklistWidget`
  (ver **Decisión 1**). Los tipos sin clave (factura_luz, factura_gas, testimonio,
  caratula_sucesorio, usufructo) se agregan como ítems `custom` del `doc_status_json`.
- Puerto `DocumentIntakeGateway` (`upload(file, fields)`, `finish(sessionId)`), así el use
  case se testea con un fake y el adapter de n8n vive en infrastructure.
- Use cases (`application/use-cases/doc-portal/`):
  - `CreateDocPortalLinkUseCase` — revoca el link vivo si hay, crea uno nuevo, valida que la
    org tenga `docs_n8n` habilitado y que el agente sea el dueño de la propiedad o admin.
  - `RevokeDocPortalLinkUseCase`.
  - `GetPropertyDocumentsUseCase` — link vivo + archivos + progreso (para el CRM).
  - `GetPublicDocPortalUseCase` — por token: dirección, nombre y teléfono del agente, marca de
    la org, checklist con progreso, archivos recibidos (nombre, tipo, fecha). **Sin links de
    Drive** (ver Decisión 3).
  - `UploadPortalDocumentUseCase` — valida token vivo, tamaño y mime, límite diario por token;
    arma los campos desde D1 (`dir` = `properties.address`, `op`, `tipo`, `suc`, `casado`,
    `nombre`/`telefono`/`email` del propietario, `agente` desde `agent_map`, `sid`); llama al
    gateway; guarda `property_documents`; actualiza `doc_status_json` (sólo `pending → done`,
    nunca pisa un `done`/`na` manual) y completa `cloud_url` con la carpeta si estaba vacío;
    devuelve el documento reconocido.
  - `FinishDocPortalSessionUseCase` — llama a `documentacion-listo` con el `sid`.
    Debounce: si ya se llamó en los últimos 2 minutos, no repite (el resumen de n8n se arma
    leyendo la planilla, así que repetir sólo genera un mail de más).

### 3. Infrastructure

- `D1DocPortalLinkRepository`, `D1PropertyDocumentRepository`.
- `N8nDocumentIntakeGateway`: arma `FormData` y hace `fetch` al `upload_url`. **Sin
  reintentos automáticos** (trampa #4: el reintento duplica en Drive); si falla, el error vuelve
  a la página y el propietario reintenta ese archivo.
- `D1PropertyRepository`: método `updateDocStatus(id, orgId, json)` si no hay uno.

### 4. APIs

`api-properties` (autenticado, nuevo `routes/doc-portal.ts`):

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/properties/:id/doc-portal-link` | Crea o regenera el link (`operation`, `property_kind`, `succession`, `married`) |
| `DELETE` | `/properties/:id/doc-portal-link` | Revoca |
| `GET` | `/properties/:id/documents` | Link vivo + archivos (con links de Drive) + progreso |

`GET`/`PUT /doc-portal/settings` (también en `api-properties`, admin): guardar/leer la
integración `docs_n8n`. Así el deploy toca sólo `api-properties` y `api-public`.

`api-public` (sin auth, por token):

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/public/docs/:token` | Estado para la página |
| `POST` | `/public/docs/:token/upload` | Un archivo por request (multipart `archivo`) |
| `POST` | `/public/docs/:token/done` | Cierra la sesión → resumen de n8n |

Límites de entrada: 15 MB por archivo (el mismo tope de n8n), PDF o imagen, 60 archivos por
token por día. Token revocado o inexistente → 404 genérico.

### 5. Frontend

- **Página pública `src/app/d/[token]/`** (Server Component que trae el estado +
  `DocPortalClient`), mobile-first, `robots: noindex`. Agregar `'/d/'` a los públicos de
  `src/middleware.ts`.
  - Cabecera: marca de la org, dirección, agente con `WhatsAppButton`/`CallButton`.
  - Progreso (`ProgressBar`) y tres bloques: *Te pedimos*, *Si los tenés*, *Lo pedimos
    nosotros* (con reloj y la leyenda; nunca como tarea del propietario).
  - Uploader: elige varios archivos y los sube **de a uno, en serie**; cada fila muestra
    subiendo / "Reconocido: Título de propiedad" / "Lo revisa tu agente" / error con reintentar.
    El ítem del checklist se tilda en vivo.
  - Botón "Ya mandé todo" → `/done`. También se llama solo al salir si hubo subidas
    (`sendBeacon`), para no depender de que lo toque.
  - Recibidos: lista de lo que ya mandó en visitas anteriores.
  - Estados de carga, vacío y error; link revocado → página "Este link ya no está activo,
    pedile uno nuevo a tu agente".
- **CRM, ficha de la propiedad**: card "Portal del propietario" junto a `DocChecklistWidget`.
  - Sin link: botón "Pedir documentación" → `Modal` con operación, tipo (prellenado desde la
    propiedad), sucesión y estado civil.
  - Con link: copiar, mandar por `WhatsAppButton` con mensaje armado, regenerar, revocar.
  - Tabla de archivos recibidos: tipo, fecha de emisión, origen, link a Drive; "A revisar"
    con `StatusBadge` de advertencia.
- **Configuración → Integraciones**: card "Documentación (n8n)" con URLs y mapa de agentes.
- Cargar la skill `vendepro-design-system` antes de maquetar; seguir lo que hace `/f/` para
  páginas públicas.

### 6. Tests

- Core: `computeDocChecklist` con todas las combinaciones del brief §7 (venta depto casado,
  venta casa con sucesión, alquiler PH, sucesión "no sabe"…), mapeo a `doc_status_json` (no
  pisa manuales), upload con gateway fake (no reconocido → `otro`, error de n8n → no escribe
  nada), revocación, límite diario.
- API: rutas públicas con token válido / revocado / inexistente.
- Manual: propiedad "Inexistente 99999" en local apuntando al n8n real, borrar la carpeta y
  las filas de prueba después.

### 7. Deploy (todo por CI, nunca desde terminal)

Migración → `api-properties`, `api-public` (y `api-admin` si toca) por GitHub Actions →
frontend se auto-deploya. Después: cargar la integración `docs_n8n` de la org de Marcela con
las URLs de producción y el mapa de agentes.

---

## Fase 2 — La vía mail también alimenta VendéPro

Hoy lo que entra por mail sólo queda en la planilla. Para que el CRM tenga el estado completo:

- `api-public`: `POST /public/docs/callback`, autenticado con el secreto de `docs_n8n` en un
  header. Body = la fila que n8n escribe en el registro (`direccion`, `tipo_id`, `file_id`,
  `link_archivo`, `link_carpeta`, `sesion`, …).
- Matcheo de propiedad: si `sesion` coincide con el `session_id` de un link, directo. Si no,
  por dirección con el mismo normalizador del brief §5 portado a core (número exacto,
  piso/unidad como subconjunto, calle por primera palabra o inclusión). Sin match o con dos
  candidatos → se guarda sin propiedad y aparece en una bandeja "Documentos sin asignar".
- Idempotente por `drive_file_id` → se puede reintentar sin miedo, y los mails duplicados en
  dos casillas quedan en una sola fila.
- **Cambio en n8n**: un nodo HTTP después de `Guardar en Registro` (`specifyBody: json`,
  trampa #1), referenciando nodos por nombre (trampa #5).

## Fase 3 — Después

- Recordatorio del plazo de 15 días: trigger por tiempo en el barrido cron de automatizaciones
  (`doc_portal.incomplete`), al agente y opcionalmente al propietario.
- Checklist de alquiler definitiva cuando la confirme la inmobiliaria (sólo cambia
  `computeDocChecklist`).
- Si alguna vez se quiere salir de n8n para orgs sin n8n: un `R2DocumentIntakeGateway` que
  guarda en R2 y clasifica con api-ai. El puerto ya lo permite.

---

## Decisiones abiertas

1. **Mapeo a las claves viejas del checklist.** Casi todo calza (`titulo→title`,
   `dni→dni_propietario`, `abl→libre_municipal`, `aysa→libre_aysa`…), pero
   `liquidacion_expensas` **no es** un libre deuda de expensas. Propuesta: mapear sólo lo que es
   lo mismo y agregar el resto como ítems `custom`. ¿O conviene que el widget pase a usar el
   catálogo de n8n directamente?
2. **Vencimiento del link.** Propuesta: no vence; se revoca a mano, al regenerar, o solo
   cuando la propiedad pasa a vendida o cancelada.
3. **¿El propietario ve los links de Drive?** Propuesta: no, sólo el nombre y el tipo de lo que
   mandó. La carpeta es interna (tiene los informes de dominio, notas, etc.).
4. **Mapa de agentes.** Los apodos de n8n (`andres`, `danila`, `oficina`) se cargan una vez en
   la integración, por usuario de VendéPro. Rocío y Belén → `oficina`.
5. **Fase 2 toca n8n.** Es un nodo nuevo, pero es un cambio en un workflow en producción que
   comparte instancia con el bot de WhatsApp.

## KB al terminar

Actualizar `03-Dominios/Dominio-Propiedades.md` (tablas nuevas, flujo, `/d/`) y
`08-Producto/Roadmap-estado-implementacion.md`; nota de integración en
`02-Backend/Servicios-externos.md`.
