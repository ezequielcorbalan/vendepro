# 🏠 Dominio: Propiedades

Listing inmobiliario gestionado: captación, publicación, comercialización, venta/alquiler.

## Pipeline comercial (commercial_stage)

```
captada → documentacion → publicada → reservada → vendida
                                    ↘ suspendida ↘ vencida → archivada
```

Definido en `domain/value-objects/property-stage.ts` con transiciones validadas.

Para **alquileres** los stages son: captacion, publicada, con_interesados, alquilada, suspendida.

## Status (estado operativo)

`active | sold | suspended | archived | inactive` — independiente del commercial_stage. Definido en `domain/rules/property-rules.ts` con `canTransitionPropertyStatus(from, to)`.

## Entidad

- **`Property`** (`domain/entities/property.ts`)

Campos principales:
- Identificación: `id`, `org_id`, `public_slug`, `address`, `neighborhood`, `city`, `property_type` (departamento|casa|ph|local|terreno|oficina)
- Comerciales: `asking_price`, `currency` (USD|ARS), `operation_type` + `operation_type_id`, `commercial_stage` + `commercial_stage_id`, `status` + `status_id`
- Datos: `rooms`, `size_m2`
- Propietario: `owner_name`, `owner_phone`, `owner_email`, `contact_id`
- Origen: `lead_id` (de qué lead vino), `agent_id` (responsable)
- Mandato: `auth_start_date`, `auth_duration_days` (default 180). Vencimiento = inicio + plazo
  (`authorizationExpiry` en `core/src/domain/rules/authorization-rules.ts`, misma cuenta que el
  barrido cron). El aviso "Autorización por vencer" (trigger `property.publicacion_vencida`, la
  clave quedó con el nombre viejo) **vuelve a avisar tras una renovación** desde el 15-oct-2026:
  la fecha de vencimiento entra como *ocurrencia* en el `dedupe_key`. Variables para el mensaje:
  `{{property.auth_expires_at}}` y `{{property.auth_days_left}}` (migración 062).
- Documentación: `doc_status_json` (checklist de documentos)
- Resultado: `sold_price`, `sold_date`, `days_on_market`
- Media: `cover_photo`
- External tracking: `last_external_report_at`

## Catálogos normalizados (D1)

Tres tablas catálogo creadas en migration 005:
- `operation_types` (venta, alquiler)
- `commercial_stages` (por operation_type)
- `property_statuses` (por operation_type)

Se exponen vía `GET /property-config` en [[API-properties]].

## Sub-entidades

- **`property_photos`** — galería con orden, key R2
- **`property_price_history`** — historial de cambios de precio con razón (también la tabla legacy `price_history`)
- **`competitor_links`** — links a propiedades competidoras
- **`property_visit_forms`** — ficha post-visita (ver [[Dominio-Visit-forms]])
- **`doc_portal_links`** / **`property_documents`** — portal de documentación del propietario (migración 061, ver abajo)

## Use cases

`packages/core/src/application/use-cases/properties/`:
- CRUD: `CreateProperty`, `GetProperties`, `GetPropertyDetail`, `UpdateProperty`, `DeleteProperty`
- Status/stage/price: `UpdatePropertyStage`, `UpdatePropertyStatus`, `UpdatePropertyPrice`
- Catálogos: `GetPropertyCatalogs`
- Fotos: `UploadPropertyPhoto`, `DeletePropertyPhoto`, `ReorderPropertyPhotos`
- External: `MarkExternalReport`, `ClearExternalReport`

## Endpoints

[[API-properties]]:
- `GET/POST /properties`, `GET/PUT/DELETE /properties/:id`
- `PUT /properties/:id/{stage,price,status}`
- `GET /properties/:id/price-history`, `POST /properties/:id/price-change`
- `POST/DELETE /properties/:id/external-report`
- `GET /photo/:key` (público), `POST /photos`, `DELETE /photos/:id`, `PUT /photos/reorder`
- `GET /property-config`

## Frontend

- `/propiedades` — tabla con filtros
- `/propiedades/nueva`
- `/propiedades/[id]` — detalle + fotos + autorización + checklist docs + reportes
- `/propiedades/[id]/editar`
- `/propiedades/[id]/reportes`, `/propiedades/[id]/reportes/nuevo`
- `/propiedades/pipeline` — kanban drag-drop
- `/reservas`, `/vendidas`, `/alquiladas` — vistas filtradas
- Página pública: `/r/[slug]` (reporte público)

Componentes: `PropertyFilters`, `AuthorizationWidget`, `DocPortalCard`, `DocChecklistWidget`, `PriceHistoryWidget`, `ReportsListWidget`, `VisitFormsSection`, `PropertySelector`.

## Portal de documentación del propietario (`/d/<token>`) — 15-oct-2026

> **Portal ampliado (15-oct-2026)**: además de la documentación, el propietario ve la **reserva**
> con cuenta regresiva del próximo hito (aceptación → boleto → escritura → entrega; reglas en
> `core/domain/rules/reservation-milestones.ts`, sin datos del comprador), la **autorización de
> venta** (`authorizationExpiry`, aviso visual a 15 días) y los **reportes publicados** (`/r/<slug>`).
> La reserva se carga en la ficha con `ReservationCard` (migración **064**: `reservations.property_id`
> + fechas de hitos + `accepted_at`). El escáner tiene **recorte semiautomático**: detecta los bordes
> de la hoja (Otsu + mancha clara más grande), el propietario ajusta las 4 esquinas y se endereza con
> una homografía (`lib/doc-crop.ts`, sin OpenCV).

> **Dos motores** (config `engine` en `org_integrations` provider `docs_n8n`):
> - **`google_drive` (motor propio, default para orgs nuevas)**: VendéPro clasifica con Gemini
>   (`GeminiDocumentClassifier`, PDF/imagen inline, catálogo cerrado + fecha + plazo de autorización) y
>   guarda en el **Google Drive de la inmobiliaria** (`GoogleDriveStorage`, scope `drive.file`: sólo ve lo
>   que crea). Carpeta raíz "VendéPro — Documentación" y una por propiedad, encontradas por
>   `appProperties` (sin tabla). Subida reanudable (la simple corta en 5 MB). Archivo renombrado con el
>   documento reconocido; si no, "A revisar - …". La autorización leída completa `auth_start_date` /
>   `auth_duration_days` **sólo si estaban vacíos**. "Ya mandé todo" → aviso en la campana del agente
>   con lo que falta. Conexión de la ORG (la hace un admin) en api-crm: `GET|DELETE
>   /integrations/google-drive`, `GET /integrations/google-drive/auth-url`; mismo OAuth client y callback
>   que Calendar (`state.purpose = 'google_drive_oauth'`). Credenciales en `org_integrations` provider
>   `google_drive`. Sin migración. Plan: `doc/documentacion-motor-propio-plan.md`.
> - **`n8n`**: el webhook del workflow de n8n (lo que tiene Marcela). Filas viejas sin `engine` = n8n.
>
> Puertos nuevos en core: `DocumentClassifier` (lo reusa el barrido de Drive de
> `doc/documentacion-drive-plan.md`), `CloudDocumentStorage`; `EngineRoutingIntakeGateway` elige por motor.

El agente genera desde la ficha un link por propiedad; el dueño lo abre en el celular, ve qué
le falta y sube PDF o fotos. **VendéPro no guarda los archivos**: `api-public` los reenvía tal
cual al workflow de n8n "Documentacion de propiedades", que los guarda en la unidad compartida
de Drive, los clasifica con IA y los anota en su planilla. VendéPro se queda con el registro
(`property_documents`) y tilda solo el checklist manual.

- **Tablas** (migración 061): `doc_portal_links` (un link vivo por propiedad; token de 32 hex,
  operación, tipo, sucesión, casado, `session_id` = `sid` de n8n) y `property_documents` (un
  archivo recibido: `doc_type` = `tipo_id` de n8n, `recognized`, links de Drive si n8n los manda;
  único por `drive_file_id`).
- **Configuración**: `org_integrations` con `provider = 'docs_n8n'`; `config_json` =
  `{ upload_url, done_url, agent_map }`. Se edita en Configuración → Integraciones (admin). Sin
  integración activa no se puede generar el link.
- **Checklist** (`core/domain/rules/document-checklist.ts`): `computeDocChecklist` es el mismo
  cálculo de la página de n8n (venta/alquiler × tipo × sucesión × casado). Los informes de
  dominio e inhibición van aparte, como trámite de la inmobiliaria, **nunca** como tarea del
  propietario. La de alquiler es provisoria.
- **Puente con `doc_status_json`**: `applyDocumentToDocStatus` sólo tilda claves que son
  exactamente el mismo documento (`titulo→title`, `dni→dni_propietario`…); el resto entra como
  ítem propio `doc_<tipo>`. Nunca pisa un `na`, un ítem oculto ni un `cloud_url` cargado a mano.
- **Endpoints**: `GET /properties/:id/documents`, `POST|DELETE /properties/:id/doc-portal-link`,
  `GET|PUT /doc-portal/settings` (api-properties); `GET /public/docs/:token`,
  `POST /public/docs/:token/upload` (multipart, un archivo), `POST /public/docs/:token/done`
  (api-public).
- **Reglas**: 15 MB por archivo, PDF o imagen, 60 archivos por link por día; token revocado o
  propiedad `sold`/`archived` → 410; sin reintentos hacia n8n (un reintento duplica en Drive);
  "Ya mandé todo" tiene un debounce de 2 minutos y también sale por `sendBeacon` al cerrar la página.
- **Escáner con la cámara** (`app/d/[token]/DocScanner.tsx` + `lib/doc-scan.ts`): el propietario elige qué documento es, saca una foto por página (cámara trasera, o desde la galería) y sale UN PDF con el nombre del documento ("Título de propiedad.pdf"). Todo en el celular, sin dependencias: el PDF se arma a mano con las JPEG tal cual (DCTDecode). "Mejorar como escaneo" divide cada píxel por el fondo estimado (la foto achicada 1/32 y desenfocada) para emparejar la luz y después estira niveles: papel blanco y tinta negra aunque la foto tenga sombra. Hasta 30 páginas; ~300 KB por página. Recorte automático de bordes/perspectiva: pendiente. El portal también le indica la alternativa nativa (Notas/Archivos en iPhone, Google Drive en Android).
- **Pendiente**: la vía mail de n8n (fase 2) todavía no avisa a VendéPro; confirmar si la
  respuesta de n8n trae `file_id` / `link_carpeta`. Plan completo en `doc/portal-documentacion-plan.md`.

## Documentación desde Drive (backend implementado 15-oct-2026, falta 063 + deploy + frontend)

Plan y detalle en `doc/documentacion-drive-plan.md`. Decisión: **VendéPro lee la unidad
compartida de Drive directo** con una cuenta de servicio de sólo lectura (`drive.readonly`, *Lector*
de la unidad) y clasifica con Gemini; **n8n no se toca** (comparte instancia con el bot de WhatsApp).

- **Barrido** `SyncDriveDocumentsUseCase` (core), cron diario de **api-properties** (`0 7 * * *`) y
  botón a pedido `POST /properties/:id/documents/sync`. Lista el árbol entero, vincula cada carpeta
  de propiedad (hija de una carpeta de área) con su propiedad por dirección (`drive_folders`; nunca
  adivina: dos candidatas = `ambiguous`), y registra cada archivo en `property_documents` con
  `source = 'drive'`, idempotente por `drive_file_id`.
- **Clasificación de lo barato a lo caro**: los archivos que subió n8n ya traen tipo y fecha en el
  nombre (`<Documento> - AAAA-MM-DD.pdf`) y no gastan IA; más de 15 MB queda `sin_leer` para revisión
  humana; el resto va a `GeminiDocumentClassifier`. Tope de 25 lecturas con IA por noche.
- **Reflejo en la propiedad** (sólo con `read_only: false` en la config `google_drive_docs`): tilda el
  checklist (`pending → done`, nunca pisa lo manual), completa `cloud_url` con la carpeta y
  `auth_start_date`/`auth_duration_days` desde la autorización si estaban vacías. Si la fecha cargada
  difiere, avisa al agente por la campana. Los informes de dominio e inhibición quedan con
  `valid_until` (30 días) para el trigger futuro `property.documento_por_vencer` (parte 3).
- Rutas: `GET/PUT /doc-drive/settings`, `GET /doc-drive/folders`, `PUT /doc-drive/folders/:folderId`.
- Falta: migración **063** (después de 061 y 062), deploy de api-properties, secret
  `GOOGLE_DRIVE_SA_KEY` (y verificar que Workspace deje sumar la cuenta de servicio), y el frontend.

## Relacionados

- [[Dominio-Contactos]] (`contact_id` = propietario)
- [[Dominio-Leads]] (`lead_id` origen)
- [[Dominio-Tasaciones]] (una tasación puede preceder o seguir a la captación)
- [[Dominio-Reportes]] (reportes mensuales de portales por propiedad)
- [[Dominio-Visit-forms]] (formularios y fichas de visita)
- [[Dominio-Reservas]] (cuando se reserva)
