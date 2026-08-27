# Google Calendar — puesta en marcha

Cómo dejar operativo "Conectar con Google" en Configuración → Integraciones.

El código está completo: OAuth 2.0 por agente, refresh automático de tokens y
espejo de los eventos del CRM en el calendario del agente. Lo único que falta
para que funcione es la configuración que se describe acá.

## 1. Crear el cliente OAuth en Google Cloud

Console → **APIs & Services**

1. Crear un proyecto (o usar uno existente).
2. **Habilitar la Google Calendar API.** Sin esto el canje de tokens funciona
   pero las llamadas a eventos devuelven 403.
3. **OAuth consent screen** → tipo *External*. Agregar los scopes:
   - `https://www.googleapis.com/auth/calendar.events`
   - `openid`
   - `email`
4. **Credentials → Create OAuth client ID → Web application.**
5. **Authorized redirect URIs** — tienen que coincidir carácter por carácter con
   lo que manda el worker. La arma `googleRedirectUri()` en
   `api-crm/src/index.ts` como `origin + /integrations/google/callback`:

   | Entorno | URI |
   |---|---|
   | Producción | `https://crm.api.vendepro.com.ar/integrations/google/callback` |
   | Local | `http://localhost:8788/integrations/google/callback` |

   El 8788 es el puerto que `start-local.sh` le asigna a api-crm.

Mientras el consent screen esté en modo *Testing*, sólo pueden conectarse las
cuentas listadas en **Test users**. Para que cualquier agente de la inmobiliaria
pueda hacerlo, hay que publicar la app.

## 2. Cargar las credenciales

### Producción

Cloudflare Dashboard → Workers → **`vendepro-api-crm`** → Settings →
Variables and Secrets. Dos entradas de tipo **Secret**:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

No van en `wrangler.jsonc`: ese archivo va al repo. Mientras falte cualquiera de
las dos, `googleConfigured()` devuelve `false`, el botón de conectar responde
501 con un mensaje claro y el espejo de eventos simplemente no corre — nada se
rompe, sólo no sincroniza.

### Local

En `packages/api-crm/.dev.vars.local` (gitignoreado):

```
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

**No usar `.dev.vars`**: `start-local.sh` lo regenera en cada arranque y lo
pisaría. El `.dev.vars.local` se carga automáticamente y el script informa
cuántos overrides tomó de cada worker.

## 3. Conectar un agente

Cada agente conecta **su propia** cuenta: la integración es por usuario, no por
organización.

Configuración → Integraciones → *Conectar con Google* → consentimiento →
vuelve a `/configuracion/conexiones?google=ok`.

El flujo pide `access_type=offline` + `prompt=consent`, así que Google devuelve
un **refresh token**. Eso es lo que permite que el sistema escriba en el
calendario del agente sin que esté presente — necesario para que una
automatización agende una tarea desde el cron.

## Cómo funciona el sync

Es un **espejo de una sola dirección: VendéPro → Google**. No hay polling ni
webhooks entrantes.

| Qué pasa en el CRM | Qué pasa en Google |
|---|---|
| Se crea un evento | `createEvent`, se guarda el `google_event_id` |
| Se reprograma | `updateEvent` |
| Se borra | `deleteEvent` |

Todo es *best-effort*: si Google falla, la operación local ya se completó y no
se revierte. Un Google caído nunca impide agendar en el CRM.

**La invitación al cliente la manda Google, no VendéPro.** Las llamadas van con
`sendUpdates=all`: si el evento lleva al cliente como invitado, Google le envía
el mail y le aparece en su calendario cuando acepta. El agente puede apagar esto
con **auto_invite** en su configuración; con el switch en off el evento igual se
espeja, pero sin invitado.

## Limitaciones conocidas

- **Si el agente edita el evento en Google, VendéPro no se entera.** No hay
  `watch` de la Calendar API ni polling con `syncToken`; ante una divergencia
  gana la última escritura desde el CRM.
- **La zona horaria está fija en `America/Argentina/Buenos_Aires`**
  (`sync-event-to-google.ts`). Para white-label multi-tenant hay que sacarla a
  la configuración de la org.
- **Editar título o descripción no espeja.** Sólo espejan crear, reprogramar y
  borrar; `PUT /calendar` todavía no dispara el sync.
- **Consultar disponibilidad no está soportado.** La FreeBusy API pide un scope
  más amplio que `calendar.events`; ampliarlo obliga a re-consentir e invalida
  los tokens ya emitidos.

## Si algo falla

El callback vuelve al frontend con `?google=error&reason=<motivo>`:

| reason | Qué revisar |
|---|---|
| `no_configurado` | Faltan `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` en el worker |
| `canje_fallido` | El redirect URI no coincide con el registrado, o el secret es de otro cliente |
| `state_invalido` | El token de `state` expiró (dura 10 minutos) — reintentar |
| `access_denied` | El usuario canceló el consentimiento |

Si al conectar aparece *"Google no devolvió refresh token"*, es que la cuenta ya
había autorizado la app antes: revocá el acceso en
[myaccount.google.com/permissions](https://myaccount.google.com/permissions) y
volvé a conectar.
