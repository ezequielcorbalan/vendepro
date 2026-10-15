# Plan: checklist de documentación leído desde Drive + vencimientos

Estado (15-oct-2026): **plan decidido; parte 1 (aviso de autorización) implementada** en la
rama `claude/admiring-blackburn-73afbb`, falta migración 062 + deploy de api-crm. Partes 2 a 4
sin empezar: dependen del portal (`doc/portal-documentacion-plan.md`, migración 061), que todavía
no está commiteado.

Objetivo: que nadie tilde a mano el checklist de documentación ni cargue a mano las fechas de la
autorización. Si el papel está en la carpeta de Drive de la propiedad, VendéPro lo sabe; si tiene
fecha que importa, VendéPro avisa antes de que venza.

---

## Lo que encontramos (datos, no supuestos)

**En el Drive** (unidad compartida "Documentación propiedades", leída el 15-oct-2026):

- **~55 carpetas de propiedad** en las tres áreas (OFICINA ~40, ANDY y DANILA el resto), más
  carpetas de servicio (`MODELOS`, `CANCELADOS`, `📦 VENDIDAS-CERRADAS`, `🔍 REVISAR ESTADO`,
  `ALQUILERES`, `Downloads`) y **5 carpetas duplicadas "Sin identificar"** creadas el 13-oct
  (un mismo mail procesado varias veces: es la trampa de los mails duplicados del brief).
- **Dos poblaciones de archivos muy distintas:**
  - Lo que entró por n8n ya viene **clasificado en el nombre y la descripción**:
    `Autorizacion de venta firmada - 2026-10-08.pdf`, descripción
    `Original: <nombre que puso el propietario>.pdf | <observaciones de la IA>`.
    Tipo y fecha de emisión salen del nombre **sin IA**.
  - Lo migrado de las cuentas viejas (4-oct) es un rejunte: fotos exportadas de WhatsApp,
    PDFs con el nombre de una persona (son DNIs), boletas sueltas, Google Docs nativos,
    subcarpetas (`informes/`, `escrituras/`, `Dnis/`) y PDFs de **hasta 60 MB** (una escritura
    escaneada). Esto sí necesita IA, y una parte no entra en ningún modelo de una pasada.
- Muestra de 3 carpetas: ~25 archivos. Estimación del backfill: **500–800 archivos**, de los que
  hay que leer con IA los que no tienen nombre de n8n.

**En VendéPro:**

- El aviso de vencimiento de la autorización **ya existe**: trigger `property.publicacion_vencida`
  del barrido cron (`auth_start_date + auth_duration_days`), receta `sysauto-publicacion-vence`.
  Tenía tres problemas (los arregla la parte 1, ver abajo).
- El checklist vive en `properties.doc_status_json` (`{ status, cloud_url, custom, hidden }`); el
  link a la carpeta es texto libre (`cloud_url`) — no hay `drive_folder_id`.
- La IA de VendéPro es **Gemini 3.5 flash-lite** (`GEMINI_API_KEY`, sólo en api-ai); el clasificador
  de n8n es **Claude Sonnet 5** por HTTP.
- n8n **no** extrae el plazo de la autorización: devuelve tipo, fecha de emisión, casado, sucesión
  y observaciones. Cualquiera de las dos opciones necesita un prompt nuevo para eso.

No pude consultar D1 de producción (cuántas propiedades activas tienen `auth_start_date` vacío):
la lectura de prod quedó bloqueada por permisos. Query para correr a mano:

```sql
SELECT status, COUNT(*) total,
  SUM(auth_start_date IS NULL OR auth_start_date = '') sin_autorizacion,
  SUM(doc_status_json LIKE '%drive.google.com%') con_link_drive
FROM properties GROUP BY status;
```

---

## Decisión: VendéPro lee Drive directo (opción b), n8n no se toca

| | (a) n8n lee Drive y llama a `POST /public/docs/callback` | (b) VendéPro lee Drive con una cuenta de servicio |
|---|---|---|
| **Costo IA** | Sonnet 5 para todo | Gemini flash-lite; ~10–20× más barato por documento. Con 500–800 archivos el backfill es de pocos dólares contra decenas. En régimen (decenas de archivos por mes) da igual |
| **Costo infra** | Ejecuciones de n8n Cloud (una por barrido, despreciable) | Cron de Workers, incluido en el plan |
| **Riesgo operativo** | El backfill corre en la **misma instancia que el bot de WhatsApp** (trampa #10: 233 ejecuciones encoladas demoraron a clientes reales). Hay que editar por API un workflow en producción sin tests | Nada de lo que está andando cambia. Un error en el barrido no afecta subidas, mails ni el bot |
| **Seguridad** | Reusa la credencial de Drive de n8n, que es **lectura y escritura sobre todo el Drive**. Suma un endpoint público con secreto compartido | Credencial nueva, pero **sólo lectura** (`drive.readonly`) y **sólo esa unidad** (la cuenta de servicio es *Lector* de la unidad compartida). Si se filtra, no puede borrar ni mover nada |
| **Mantenimiento** | Lógica partida: listar/clasificar en n8n (JSON editado por API, sin tests), matchear/aplicar en VendéPro. Dos prompts de clasificación que van a divergir | Todo en TypeScript con tests y CI. El matcheo carpeta→propiedad hay que hacerlo en VendéPro **en las dos opciones** (n8n no conoce las propiedades) |
| **Multi-tenant** | Específico de Marcela | Cualquier org que comparta una unidad con la cuenta de servicio |
| **Fase 2 del portal (vía mail)** | La resuelve con un nodo más | **La vuelve innecesaria**: todo lo que entra por mail termina en Drive, y el barrido lo levanta sin tocar n8n |

**Recomendación: (b).** Lo que inclina la balanza no es el costo (es chico en las dos) sino que
(b) no toca la instancia compartida con el bot, tiene una credencial de sólo lectura y deja toda la
lógica testeada en el repo. Y de yapa elimina la fase 2 del portal: el callback que n8n tenía que
mandar ya no hace falta.

Lo que se reusa de n8n sin tocarlo: **su trabajo**. Si el archivo tiene nombre de n8n
(`<Documento> - AAAA-MM-DD.pdf`), el tipo y la fecha salen del nombre y no se gasta IA.

**Riesgo a verificar antes de arrancar la parte 2:** que la política de Workspace de Marcela permita
agregar una cuenta de servicio (dominio `iam.gserviceaccount.com`, externo) como miembro de una
unidad compartida. Si no lo permite, alternativa: OAuth de un usuario de la organización con scope
`drive.readonly` (mismo patrón que la integración de Google Calendar), guardado en
`org_integrations`.

---

## Parte 1 — Aviso de autorización por vencer ✅ implementada

El trigger ya existía; estaba roto en tres cosas:

1. **Nunca volvía a avisar después de renovar.** La receta usa `dedupe_scope = 'once'` y la clave era
   `automation:propiedad:trigger`: avisaba una vez en la vida de la propiedad. Ahora el evento lleva
   una **ocurrencia** (la fecha de vencimiento) que entra en el `dedupe_key`, y el filtro SQL sólo
   cuenta corridas posteriores al `auth_start_date` vigente. Renovar = nuevo vencimiento = nuevo aviso.
2. **El mensaje decía "vence en 7 días" fijo**, aunque el umbral es configurable. Variables nuevas en
   el contexto de propiedad: `{{property.auth_expires_at}}` (DD/MM/AAAA) y
   `{{property.auth_days_left}}`.
3. **Se llamaba "Publicación por vencer"** pero mira la autorización. Label → "Autorización por
   vencer" (la clave `property.publicacion_vencida` no cambia: hay automatizaciones guardadas con ella).

Cambios: `AutomationRun.dedupeKey({ occurrence })`, `RunAutomationsForEventInput.occurrence`,
`SweepEvent.occurrence`, `AutomationSweepRepository.propiedadesPorVencer` devuelve
`{ id, occurrence }`, contexto de propiedad con las dos variables, migración
**`062_aviso_autorizacion.sql`** que reescribe el mensaje de la receta y de las copias de las orgs
que todavía tienen el texto original.

Deploy: migración 062 → api-crm (cron y motor) por CI. La receta sigue **inactiva por defecto**;
cada org la activa en Automatizaciones.

---

## Parte 2 — Barrido de Drive → checklist (depende de la migración 061)

### Datos — migración `063_documentacion_drive.sql`

```sql
-- Carpeta de Drive ↔ propiedad. Sale del matcheo por dirección o la fija un humano.
CREATE TABLE IF NOT EXISTS drive_folders (
  folder_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  area TEXT,                        -- 'oficina' | 'andy' | 'danila' (de la config, no del código)
  name TEXT NOT NULL,
  property_id TEXT REFERENCES properties(id),
  match_status TEXT NOT NULL DEFAULT 'none'
    CHECK (match_status IN ('auto', 'manual', 'ambiguous', 'none', 'ignored')),
  last_scanned_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_drive_folders_property ON drive_folders(property_id);

ALTER TABLE property_documents ADD COLUMN valid_until TEXT;       -- informes: issued_at + 30 días
ALTER TABLE property_documents ADD COLUMN extracted_json TEXT;    -- autorización: inicio, plazo, exclusiva
ALTER TABLE property_documents ADD COLUMN classified_by TEXT;     -- 'nombre_n8n' | 'ia' | 'manual'
ALTER TABLE property_documents ADD COLUMN drive_modified_at TEXT; -- reclasificar si cambió
```

**Hay que tocar la 061 antes de aplicarla** (todavía no está en prod): el `CHECK (source IN
('portal','email'))` de `property_documents` tiene que sumar `'drive'`. SQLite no permite cambiar un
CHECK con ALTER. Si la 061 ya se aplicó cuando se haga esto, la 063 reconstruye la tabla.

Config por org en `org_integrations`, `provider = 'google_drive_docs'`:
`{ shared_drive_id, areas: { <folder_id>: { name, agent_ids[] } }, ignore: ['MODELOS', …] }`.
La clave de la cuenta de servicio es **una sola, de VendéPro**: secret `GOOGLE_DRIVE_SA_KEY` del
worker, sincronizado por CI como `GEMINI_API_KEY`. Cada org comparte su unidad con el mail de la
cuenta de servicio como *Lector*. Nada de Marcela en el código.

### Core (reglas puras, con tests)

- `parseN8nDocName(title)` → `{ docType, issuedAt } | null`. Mapea los labels que usa n8n al
  renombrar (`Titulo de propiedad`, `Autorizacion de venta firmada`, `Reglamento de copropiedad`…)
  a los `tipo_id` del catálogo `DOC_TYPES` de `document-checklist.ts`. `A revisar` → `null`.
- `matchFolderToProperty(folderName, properties)` → `{ propertyId, status }`: el normalizador del
  brief §5 portado (número exacto, piso/unidad como subconjunto estricto, calle por primera palabra o
  inclusión). Dos candidatos → `ambiguous`, nunca adivina. Es el mismo que pedía la fase 2 del portal.
- `documentValidity(docType, issuedAt)` → `valid_until`: informe de dominio e inhibición, 30 días.
- `applyAuthorization(property, extracted)` → qué escribir. **Sólo completa vacíos**: si
  `auth_start_date` está vacío lo llena; si ya tiene otro valor no lo pisa, deja una notificación al
  agente ("En Drive la autorización arranca el X, en VendéPro figura Y").
- El paso `pending → done` del checklist ya lo define el portal (nunca pisa un `done`/`na` manual).

### Puertos y adapters

- `DocumentStore` (core) con `listTree(driveId)` y `download(fileId, maxBytes)`.
  `GoogleDriveDocumentStore` (infrastructure): JWT RS256 firmado con WebCrypto → token
  `drive.readonly`; `files.list` con `corpora=drive`, `driveId`, `supportsAllDrives`,
  `includeItemsFromAllDrives`, `pageSize=1000` → **todo el árbol en 1–3 requests**, no uno por carpeta.
  Las subcarpetas (`informes/`, `escrituras/`) se resuelven en memoria hasta la carpeta de propiedad.
- `DocumentClassifier` (core) → `{ docType, issuedAt, authorization?: { startDate, durationDays,
  endDate, exclusive }, observations }`. `GeminiDocumentClassifier` (infrastructure), PDF/imagen
  inline. Prompt con el catálogo cerrado de 17 tipos; para `autorizacion_venta` pide inicio y plazo.

### Use case `SyncDriveDocumentsUseCase`

Por org con la integración habilitada:

1. Lista el árbol. Carpetas nuevas → `drive_folders` + matcheo. Carpetas de servicio → `ignored`.
2. Por archivo de carpeta matcheada: si `drive_file_id` ya está y `modifiedTime` no cambió → nada.
   **Idempotente por `drive_file_id`** (índice único de la 061), así que reintentar es gratis.
3. Clasificación, de lo barato a lo caro:
   - nombre de n8n → tipo y fecha, `classified_by = 'nombre_n8n'`. Excepción: la autorización igual
     pasa por IA (el nombre trae la fecha de firma, no el plazo).
   - Google Docs nativo → export a PDF (tope 10 MB de la API).
   - más de 15 MB → `otro`, observación "muy grande para leer, revisalo a mano". No se descarga.
   - resto → IA.
4. Aplica: checklist, `cloud_url` si estaba vacío (link de la carpeta), `valid_until`, autorización.
5. **Tope por pasada** (ej. 25 archivos con IA): el backfill se completa en varias noches sin
   chocar con los límites de subrequests ni de CPU del worker. Lo pendiente queda para la próxima.

Dónde corre: **api-properties**, cron diario de madrugada (`0 7 * * *` UTC = 4 am ART) — el cron de
api-crm es del motor de automatizaciones y no tiene la IA. Más un botón "Revisar carpeta ahora" en
la ficha (`POST /properties/:id/documents/sync`) para no esperar a la noche.

### Frontend

- Ficha de la propiedad: los ítems tildados por el barrido muestran de dónde salió ("Drive, 12/10")
  con link al archivo; la autorización completada por IA aparece con un `StatusBadge` "Leída del
  documento" hasta que alguien la confirma.
- Configuración → Integraciones: card "Drive de documentación" (unidad, áreas, mail de la cuenta de
  servicio para compartir) y bandeja **"Carpetas sin asignar"** (`ambiguous`/`none`) para vincular a
  mano. Ahí van a aparecer las 5 "Sin identificar".

## Parte 3 — Aviso de informes vencidos (depende de la parte 2)

Trigger nuevo en el catálogo, por tiempo: `property.documento_por_vencer` (`dias_antes`, default 3;
`doc_types`, default `informe_dominio, informe_inhibicion`). Candidatos: `property_documents` con
`valid_until` en la ventana, de propiedades activas, y que no tengan un documento del mismo tipo más
nuevo. Ocurrencia = `drive_file_id`, así cada informe avisa una vez. Mismo barrido cron de
api-crm (`SweepTimeBasedAutomationsUseCase`), receta inactiva "Informe de dominio por vencer: pedir
uno nuevo".

## Parte 4 — Lo que queda afuera a propósito

- **Escribir en Drive** (renombrar lo migrado, mover a VENDIDAS). La credencial es de sólo lectura
  por diseño; si algún día se quiere, es otra decisión.
- **Tocar n8n.** Ni para el callback ni para el plazo de la autorización. Si más adelante se quiere
  que el resumen por mail de n8n incluya el plazo, es un cambio de prompt en `Clasificar con Claude`
  que hay que pedirle al usuario antes.
- **Partir PDFs grandes** para leer sólo las primeras páginas: en Workers no hay librería liviana
  confiable; los >15 MB quedan para revisión humana (son pocos y casi siempre escrituras).

## Orden de trabajo

1. Parte 1 (hecha) → migración 062 + deploy api-crm.
2. Commitear y mergear el portal (061), con el `CHECK` de `source` sumando `'drive'`.
3. Crear la cuenta de servicio, compartirle la unidad como *Lector*, cargar el secret por CI.
   **Verificar primero la política de Workspace** (ver Riesgo).
4. Parte 2 en modo "sólo lectura" un par de noches: registra y matchea pero no escribe en
   `properties` (flag en la config). Revisar la bandeja de carpetas sin asignar y lo clasificado.
5. Prender la escritura del checklist y la autorización.
6. Parte 3.
