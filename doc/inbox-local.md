# Inbox de WhatsApp — cómo probarlo en local

El inbox se construye **al lado** de Onetalk, sin tocarlo. Todo lo de acá corre
en tu máquina contra una base local: no toca producción ni el bot de n8n.

## 1. Base local y token

```bash
cd vendepro-backend
printf 'JWT_SECRET = "local-dev-secret"\n' > packages/api-public/.dev.vars
node scripts/local-inbox/seed-local.mjs
```

Aplica las migraciones a la D1 local, siembra una org con un admin y te imprime
un **token de integración** con scope `inbox:write`. Es idempotente: correlo
las veces que quieras. Usa el mismo `JWT_SECRET` de desarrollo que ya traen
commiteado todos los workers en su `.dev.vars`.

## 2. Levantar el worker

```bash
cd packages/api-public && npm run dev
```

Queda en `http://localhost:8708`.

## 3. Probar sin WhatsApp

```bash
export INBOX_TOKEN="<el token del paso 1>"
node scripts/local-inbox/fake-message.mjs "Hola, vi el depto de Cabildo"
```

Lo que tiene que pasar:

| Caso | Resultado |
| --- | --- |
| Primer mensaje de un número nuevo | `conversationCreated: true` y se crea el contacto |
| El mismo `--id` otra vez | `duplicate: true`, no se guarda de nuevo |
| Otro mensaje del mismo número | se agrega a la conversación que ya existía |

Para mirar la base:

```bash
npx wrangler d1 execute vendepro-db --local --command "SELECT * FROM conversations"
```

## 4. Conectar un número de verdad (WAHA)

Sólo cuando lo anterior ande. **Usá un número dedicado, nunca el de los
carteles**: WAHA habla con WhatsApp Web, va contra los términos de Meta y el
número se puede bloquear.

```bash
export INBOX_TOKEN="<el token del paso 1>"
export WAHA_PASSWORD="algo-tuyo"
docker compose -f scripts/local-inbox/docker-compose.yml up -d
```

Abrí `http://localhost:3001`, escaneá el QR y mandale un mensaje al número
desde otro teléfono: tiene que aparecer en `conversations`.

## 5. Responder desde VendéPro

Para que el envío funcione, la organización necesita su fila en
`org_integrations` con `provider = 'whatsapp'`:

```bash
cd packages/api-public
npx wrangler d1 execute vendepro-db --local --command "INSERT OR REPLACE INTO org_integrations (id, org_id, provider, config_json, enabled) VALUES ('int_local_wa', 'org_local', 'whatsapp', '{\"provider\":\"waha\",\"base_url\":\"http://localhost:3001\",\"session\":\"default\"}', 1)"
```

Después, desde el CRM: `POST /conversations/<id>/messages` con `{ "content": "..." }`.
Sin esa fila el endpoint devuelve 409 — una org sin WhatsApp configurado no es
un error, es el estado normal de casi todas.

La config vive por organización y no en el worker porque cada inmobiliaria
conecta su propio número. El día que una pase a la Cloud API oficial se cambia
su fila, no el código.

## Qué falta para que esto sea el inbox de verdad

- Los endpoints REST que consume el bot de n8n (asignar, labels, toggle_status).
- La UI de la bandeja con delegación a agentes.

El plan completo y el contrato que el bot espera están en el brief del equipo.

## Conectar WhatsApp sin tocar la base

Por defecto cada inmobiliaria usa el **WAHA de la plataforma**: una sola
instancia para todas, con una sesión por organización. Eso es lo que hace que
conectar sea autogestionable — si cada una necesitara su propio servidor, no lo
haría nadie.

En el worker `api-crm` hacen falta tres variables:

```
WAHA_BASE_URL=https://waha.vendepro.com.ar     # la instancia de la plataforma
WAHA_API_KEY=<la api key de esa instancia>
INBOX_WEBHOOK_URL=https://public.api.vendepro.com.ar/v1/inbox/messages
```

Con eso, el admin de la inmobiliaria entra a **Configuración → Conexiones →
WhatsApp**, toca *Conectar WhatsApp* y escanea el QR. Por detrás, el endpoint
`POST /integrations/whatsapp/connect`:

1. le asigna una sesión propia (`org-<id>`),
2. emite un token de integración con scope `inbox:write` y revoca el anterior,
3. crea la sesión en WAHA con un webhook que lleva **ese** token en el header.

Ese último punto es lo que permite compartir una instancia: cada sesión avisa
con el token de su organización, así el mensaje entrante se atribuye solo.

Una inmobiliaria que prefiera hospedar el suyo lo configura en *opciones
avanzadas*, y su `base_url` propia le gana a la de la plataforma.
