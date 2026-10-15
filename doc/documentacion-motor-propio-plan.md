# Motor propio de documentación: el Drive de cada inmobiliaria

Estado: **implementado, falta configurar Google** — 15-oct-2026. Sigue a `doc/portal-documentacion-plan.md` (PR #151).

## Por qué

El portal `/d/<token>` hoy depende de n8n: sólo sirve a quien tenga ese workflow. Para que
cualquier inmobiliaria lo use apenas lo activa, VendéPro tiene que guardar, clasificar y avisar
solo. Decisión del usuario: **los archivos van a la nube de cada inmobiliaria**, no a la nuestra.
Se empieza por Google Drive; OneDrive/Dropbox entran después por el mismo puerto.

## Cómo queda

En Configuración → Integraciones, la card de documentación tiene dos motores:

- **Google Drive de la inmobiliaria** (recomendado): un admin toca "Conectar Google Drive", acepta
  el permiso y listo. VendéPro crea en ese Drive la carpeta **"VendéPro — Documentación"** y adentro
  una carpeta por propiedad.
- **n8n (avanzado)**: lo que ya existe (URLs del webhook + mapa de agentes).

Por cada archivo que sube el propietario (motor Drive):

1. **Clasificar** con Gemini (PDF o imagen inline): tipo de documento del catálogo cerrado, fecha
   de emisión y, si es la autorización, inicio y plazo. El tipo que eligió el propietario en el
   escáner va como pista, no como verdad.
2. **Buscar o crear la carpeta de la propiedad** en el Drive, por `appProperties.vendepro_property_id`
   (etiqueta oculta). Sin tabla nueva: Drive es la fuente.
3. **Subir** con el nombre del documento reconocido ("Título de propiedad - 2010-08-10.pdf"; si no
   se reconoce, "A revisar - <nombre original>"). Subida reanudable: la simple corta en 5 MB.
4. Devolver tipo, fecha, links del archivo y de la carpeta → el portal y la ficha ya los usan.

"Ya mandé todo" con motor Drive: aviso al agente en la campana con lo que falta (el mail queda para
después; hoy el remitente por org está en email marketing).

## Permisos de Google

- Scope **`drive.file`**: VendéPro sólo ve y toca lo que crea él. No es un scope restringido, así que
  no pide la auditoría de seguridad de Google; sólo la verificación de marca de la pantalla de
  consentimiento. Consecuencia: **no puede leer carpetas que ya existían** en el Drive del cliente.
  Leer lo histórico es la "parte 2" de `doc/documentacion-drive-plan.md` (cuenta de servicio).
- Mismo OAuth client que Google Calendar y **el mismo redirect** (`/integrations/google/callback`
  en api-crm, el `state` lleva el propósito), así que en la consola de Google no hay URI nueva:
  sólo habilitar la **Google Drive API** y sumar el scope `drive.file` a la pantalla de consentimiento.
- Credenciales en `org_integrations` provider `google_drive` (refresh token cifrado con
  `JWT_SECRET`, como Calendar). Es **de la inmobiliaria**, no de un agente: la conecta un admin.

## Dónde corre

- **api-crm**: conectar/desconectar Drive (tiene el OAuth y su callback).
- **api-public**: la subida del portal (clasifica y sube). Necesita `GEMINI_API_KEY`,
  `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (para refrescar el token): se suman al sync de secrets
  de CI.
- **api-properties**: la configuración del motor (`/doc-portal/settings`).

## Puertos

- `DocumentClassifier` (core) → `{ docType, issuedAt, authorization?, observations }`;
  `GeminiDocumentClassifier` (infrastructure). **Es el mismo puerto que pide la parte 2 de
  `documentacion-drive-plan.md`**: el barrido de Drive lo reusa.
- `CloudDocumentStorage` (core): `ensurePropertyFolder`, `upload`. `GoogleDriveStorage`
  (infrastructure). OneDrive/Dropbox = otra implementación.
- `DocumentIntakeGateway` se mantiene; `NativeDocumentIntakeGateway` (clasificar + guardar) convive
  con `N8nDocumentIntakeGateway` y el use case elige por `engine` de la config.

## Sin migración

Todo entra en lo que ya existe: `org_integrations` (config y credenciales) y `property_documents`
(061). La carpeta por propiedad se encuentra por `appProperties` en Drive.

## Para producción

1. Google Cloud Console (el proyecto del OAuth de Calendar): habilitar **Google Drive API** y sumar
   `https://www.googleapis.com/auth/drive.file` a la pantalla de consentimiento.
2. Secrets del repo en GitHub: `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (si Calendar se configuró
   a mano en el worker, ahora pasan por CI) y verificar que `GEMINI_API_KEY` exista.
3. Deploy por CI de api-crm, api-public y api-properties.
