# Plan: checklist de documentación leído desde Drive + vencimientos

Estado (15-oct-2026): **parte 1 mergeada** (PR #150; falta migración 062 + deploy de api-crm).
**Parte 2 implementada** en la rama `claude/documentacion-drive-sync`: backend completo, falta el
frontend, la migración 063, la cuenta de servicio y el deploy de api-properties. Parte 3 sin empezar.

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

## Parte 2 — Barrido de Drive → checklist ✅ implementada (15-oct-2026)

Rama `claude/documentacion-drive-sync`. Sin frontend todavía (ver "Pendiente" abajo).

### Datos — migración `063_documentacion_drive.sql`

- Tabla `drive_folders` (carpeta ↔ propiedad): `folder_id`, `area` (nombre de la carpeta de área),
  `name`, `web_url`, `property_id`, `match_status` (`auto` | `manual` | `ambiguous` | `none` |
  `ignored`), `last_scanned_at`.
- `property_documents` suma `valid_until`, `extracted_json`, `classified_by` (`nombre_n8n` | `ia` |
  `sin_leer`) y `drive_modified_at`. La 061 ya admite `source = 'drive'`.
- Va **después de la 061 y la 062**. Validada en SQLite sobre la 061.

El portal **no** usa las columnas nuevas (sus métodos del repo no las tocan), así que sigue andando
aunque la 063 todavía no esté aplicada. Sólo el barrido las necesita.

Config por org en `org_integrations`, `provider = 'google_drive_docs'`:
`{ shared_drive_id, read_only (default true), ignore: [] }`. Las áreas no se configuran: son las
carpetas que cuelgan de la raíz de la unidad. La clave de la cuenta de servicio es **una sola, de
VendéPro**: secret `GOOGLE_DRIVE_SA_KEY` del worker api-properties, sincronizado por CI. Cada org
agrega el mail de la cuenta de servicio como *Lector* de su unidad. Nada de Marcela en el código.

### Core

- Reglas (`domain/rules/drive-documents.ts`):
  - `parseN8nDocName`: "<Documento> - AAAA-MM-DD.pdf" → tipo + fecha, contra los labels de
    `DOC_TYPE_LABELS` sin el paréntesis aclaratorio y algunas variantes cortas.
  - `normalizeAddress` / `matchFolderToProperty`: el normalizador del brief §5. Número exacto, calle
    por primera palabra o inclusión, piso/unidad como subconjunto en algún sentido. Si quedan varias,
    gana la que coincide exacto en piso/unidad; si no, `ambiguous`. La coma **no** corta la
    dirección: en VendéPro separa piso y unidad.
  - `isIgnoredFolderName`: MODELOS, PLANTILLAS, REVISAR, VENDIDAS, CANCELADOS, Downloads,
    "Sin identificar", ALQUILERES, más lo que diga `ignore` en la config.
  - `documentValidUntil`: informes de dominio e inhibición, 30 días.
  - `planAuthorizationUpdate`: sólo completa vacíos; si la propiedad tiene otra fecha, devuelve un
    conflicto para avisar.
- Puertos: `DocumentStore` (sólo lectura: `listTree`, `download`), `DocumentClassifier`,
  `DriveFolderRepository`, y `PropertyDocumentRepository` suma `listDriveIndex`,
  `listByOrgAndSource`, `createFromDrive`, `updateFromDrive`.
- `SyncDriveDocumentsUseCase` (`use-cases/doc-portal/sync-drive-documents.ts`):
  1. Lista el árbol entero. Carpeta de propiedad = hija directa de un área; los archivos se asignan
     subiendo hasta ella (sirve para `informes/`, `escrituras/`…). Lo que está suelto en un área o
     dentro de una carpeta ignorada no se toca.
  2. Vincula carpetas por dirección. Lo `manual` y lo `ignored` no se recalculan.
  3. Registra archivos nuevos o con `modifiedTime` distinto. Lo ya registrado por cualquier vía
     (también el portal) no se vuelve a leer. Orden: nombre de n8n (sin IA, salvo la autorización,
     que necesita el plazo) → más de 15 MB o formato raro = `sin_leer`, sin descargar → IA. Si la IA
     falla, no registra nada y se reintenta en la próxima pasada.
  4. Si la org **no** está en sólo lectura: recalcula el checklist de cada propiedad con todo lo
     registrado desde Drive (idempotente, sólo `pending → done`), completa `cloud_url` con la carpeta
     y `auth_start_date`/`auth_duration_days` desde la autorización más nueva si estaban vacías. Si
     la fecha cargada no coincide con el documento, avisa al agente (campana, una vez por documento
     leído). Como se recalcula entero, apagar el sólo lectura aplica también lo registrado antes.
  - Tope de **25 archivos con IA por pasada** (10 en el botón de la ficha). En el cron, una org que
    falla no frena a las demás.
- Configuración (`drive-docs-settings.ts`): `Get/SaveDriveDocsSettingsUseCase` (admin; id de unidad
  validado; sólo lectura por defecto), `ListDriveFoldersUseCase`, `LinkDriveFolderUseCase` (admin:
  `manual`, `ignored` o volver a automático) y `SyncPropertyDriveDocumentsUseCase` (agente de la
  propiedad o admin).

### Infrastructure

- `GoogleDriveDocumentStore`: JWT RS256 firmado con WebCrypto → token `drive.readonly`;
  `files.list` con `corpora=drive` y `pageSize=1000`; los Google Docs se exportan a PDF; no descarga
  lo que pasa el tope.
- `GeminiDocumentClassifier`: API nativa de Gemini (`gemini-3.5-flash-lite`, el mismo modelo de
  api-ai), PDF/imagen inline, catálogo cerrado de 17 tipos, fechas y plazo validados (se descartan
  fechas imposibles y plazos de más de 10 años). Le pide no copiar datos personales en las
  observaciones.
- `D1DriveFolderRepository` y los métodos nuevos de `D1PropertyDocumentRepository`.
- `createDriveDocumentsSync(env)` / `runDriveDocumentsSync(env)`: sin `GOOGLE_DRIVE_SA_KEY` no corre;
  sin `GEMINI_API_KEY` registra sólo lo que trae nombre de n8n.

### api-properties

- Cron `0 7 * * *` (04:00 en Argentina) → `runDriveDocumentsSync`.
- `GET/PUT /doc-drive/settings` (el GET devuelve también el mail de la cuenta de servicio, para
  compartir la unidad), `GET /doc-drive/folders?status=`, `PUT /doc-drive/folders/:folderId`
  (`{ property_id | null, ignore }`), `POST /properties/:id/documents/sync`.
- CI: `deploy-api-properties.yml` pasa `GEMINI_API_KEY` y `GOOGLE_DRIVE_SA_KEY`; `_deploy-api.yml`
  sincroniza el secret nuevo.

### Pendiente

- **Frontend**: card "Drive de documentación" en Configuración → Integraciones (id de unidad,
  sólo lectura, mail de la cuenta de servicio), bandeja "Carpetas sin asignar" y botón "Revisar
  carpeta ahora" en la ficha. La API ya está.
- Si n8n no devuelve `file_id` en la subida del portal, el barrido registra ese mismo archivo otra
  vez con `source = 'drive'`. Queda una fila duplicada; el checklist no se ve afectado porque es
  idempotente.

## Parte 3 — Aviso de informes vencidos (sin empezar)

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

1. ✅ Parte 1 mergeada → aplicar migración 061, después 062; deploy de api-crm.
2. ✅ Portal mergeado (PR #151), con `'drive'` en el `CHECK` de `source`.
3. Parte 2: mergear, aplicar la **063** y deployar api-properties por CI.
4. Crear la cuenta de servicio en Google Cloud, compartirle la unidad como *Lector* y cargar su JSON
   como secret `GOOGLE_DRIVE_SA_KEY` del repo. **Verificar primero la política de Workspace** (ver
   Riesgo).
5. Cargar la config de la org (`PUT /doc-drive/settings` con el id de la unidad; queda en sólo
   lectura) y dejar correr un par de noches. Revisar `GET /doc-drive/folders` (las `ambiguous` y
   `none`) y lo registrado en `property_documents`.
6. Apagar el sólo lectura (`read_only: false`) para que tilde checklists y complete autorizaciones.
7. Frontend de la parte 2, y parte 3.
