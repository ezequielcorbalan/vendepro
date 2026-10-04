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

Abrí `http://localhost:3000`, escaneá el QR y mandale un mensaje al número
desde otro teléfono: tiene que aparecer en `conversations`.

## Qué falta para que esto sea el inbox de verdad

Este tramo recibe y guarda. Todavía no están:

- Responder desde VendéPro (port `WhatsAppGateway` + adapter WAHA).
- Los endpoints REST que consume el bot de n8n (asignar, labels, toggle_status).
- La UI de la bandeja con delegación a agentes.

El plan completo y el contrato que el bot espera están en el brief del equipo.
