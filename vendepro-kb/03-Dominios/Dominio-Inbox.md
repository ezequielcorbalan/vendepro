# 💬 Dominio: Inbox (conversaciones de WhatsApp / Instagram)

Bandeja propia para reemplazar Onetalk (Chatwoot white-label de EMBLUE). El número de la inmobiliaria entra a VendéPro, las conversaciones se atan a contactos y leads del CRM, y se delegan a mano como los leads (ver [[Dominio-Leads]]).

**Estado (15-oct-2026)**: 🟡 implementado en la rama `claude/inbox-delegar-conversacion`, probado de punta a punta en local. Falta: migraciones **059** y **060**, deploy de api-crm, api-public y frontend, y levantar el WAHA de la plataforma.

## Modelo

**Número central**: un número por inmobiliaria (no el WhatsApp personal de cada agente). Delegar un lead le pasa también sus conversaciones (`AssignLeadUseCase.seguirConversaciones`).

**Proveedor**: WAHA (no oficial) hoy; Meta Cloud API después. Los dos implementan el port `MessagingGateway` (`enforcesWindow` sólo en Meta: fuera de la ventana de 24 h no se manda texto libre — vale para WhatsApp Cloud, Instagram y Messenger). Instagram y **Facebook Messenger** entran por Meta (`/public/inbox/meta`, firma `X-Hub-Signature-256`); cada uno es una integración propia (`org_integrations.provider` = `instagram` / `facebook`, `config.account_id` = id de la cuenta de IG / id de la página) y el webhook se rutea por canal + cuenta. Se responde **por el canal de la conversación** (antes salía siempre por WhatsApp).

**WAHA compartido**: una instancia de la plataforma, una sesión por org (`org-<id>`). Cada sesión tiene su webhook con el token de integración de **su** org en el header, así el mensaje se atribuye solo. Conectar rota el token; si la sesión ya existía se le pisa la config con `PUT /api/sessions/{s}` (antes quedaba mandando el token revocado y la bandeja se quedaba muda).

## Entidades

- **`Conversation`** — `channel`, `contact_id`, `lead_id`, `external_id` (jid o id de Meta), `assignee_id`, `status` (`open|pending|resolved`), `labels` (incluye `bot_pausado`), `window_expires_at`.
- **`Message`** — `direction` (`in|out`), `sender_type` (`contact|agent|bot`), `content`, `attachments`, `external_id` (idempotencia: el proveedor reenvía).

Tablas: `conversations`, `messages` (migración 059); `contacts.meta_user_id`, `contacts.ig_username` (060).

## Entrada de mensajes

`POST /v1/inbox/messages` (api-public, token con scope `inbox:write`) acepta:
- el webhook **nativo de WAHA** (`{event, session, payload}`) — parser en `infrastructure/src/services/waha-webhook.ts`. Descarta `fromMe`, grupos (`@g.us`), estados, canales y listas de difusión; timestamp en segundos.
- el formato plano de los scripts de prueba (`chat_id`, `content`…).

Siempre 200 salvo body inválido (un 500 hace reintentar en loop; la ingesta es idempotente).

Después de guardar, igual para todos los canales (`trasIngerir`): emite `message_created` hacia n8n y avisa por campana si corresponde.

## Avisos (campana)

`NotifyInboxUseCase` (core), kind `system` (la tabla tiene CHECK sobre `kind`; un kind nuevo obliga a reconstruirla).

- **Mensaje nuevo**: sólo cuando el cliente **toma la palabra** (`abreTurno`): conversación nueva, o el último mensaje fue nuestro, o pasaron más de 30 min desde su último mensaje. Cinco mensajes seguidos = un aviso. Va al agente asignado; si está en la cola, a los admins. Link `/conversaciones?c=<id>` abre esa conversación.
- **WhatsApp desconectado**: la sesión se suscribe a `session.status`; en `FAILED`/`STOPPED` avisa a los admins con link a reconectar. `STARTING`/`SCAN_QR_CODE` no avisan (son pasos normales de conectar).

La campana consulta cada 60 s y la bandeja (lista + hilo abierto) cada 15 s, ambas pausadas con la pestaña oculta. No hay websockets todavía.

## Carpetas, filtros y etiquetas (15-oct-2026)

- **Carpetas**: Mías / Sin asignar / Todas, con contador de abiertas (`GET /conversations/carpetas` → `countOpenByFolder` + etiquetas en uso). Un agente sólo tiene "Mías" y no se le dibujan las pestañas.
- **Filtros**: búsqueda (nombre, teléfono por dígitos, texto de cualquier mensaje), canal y etiqueta (`json_each` sobre `conversations.labels`).
- **Etiquetas**: libres, se agregan desde el hilo (existentes o nuevas, tope 40 caracteres) con `POST /conversations/:id/labels` (reemplazo completo, como el bot). "Pausar bot" = etiqueta `bot_pausado`, con botón propio.

## Respuestas rápidas

Las mismas plantillas de "Mensajes predeterminados de WhatsApp" (`whatsapp_templates`, migración 048, se editan en Configuración → WhatsApp). Botón ⚡ en el compositor, o el atajo **`/`** ("/seg" sugiere "Seguimiento"; flechas, Enter o Tab para elegir, Escape para cancelar; busca sin tildes en cualquier parte del nombre). Pega el texto con `{{nombre}}`, `{{agente}}`, `{{inmobiliaria}}` y `{{direccion}}` (la propiedad del lead de la conversación) resueltas para que el agente lo ajuste — no lo manda solo, y no deja enviar un "/algo" por error.

## Messenger e Instagram — conexión

`/configuracion/conexiones/meta`: id de la cuenta + page access token (cifrado, nunca vuelve), por canal. La misma cuenta no puede quedar en dos orgs. El nombre de quien escribe se pide a la Graph API al abrir la conversación (`obtenerPerfilMeta`, best-effort); sin respuesta queda "Cliente de Messenger 1234". **Falta**: app de Meta aprobada con `pages_messaging` / `instagram_manage_messages`, el botón "Continuar con Facebook" (OAuth) y los secrets `META_APP_SECRET` y `META_VERIFY_TOKEN` en api-public.

## Permisos

Reglas en `core/src/domain/rules/conversation-access.ts`, aplicadas en api-crm:
- admin / owner / supervisor ven y operan todo.
- el agente sólo lo que le delegaron: la bandeja se filtra en el servidor (no puede pedir la de otro ni la cola cambiando el query), y el hilo, responder, asignar y resolver una ajena devuelven **404** (no confirma que el id existe).
- delegar es de quien reparte; el agente sólo puede **devolver a la cola** lo suyo.

La API del bot (api-public, `/v1/conversations/*`) va con token de integración, no tiene rol.

## Contrato con n8n (bot)

`message_created` sale **crudo** (sin el envoltorio `{event,timestamp,data}` de los demás webhooks) imitando a Chatwoot: `sender.phone_number` en E.164, `sender.type` `contact|user|agent_bot`, `message_type` 0/1, `attachments[].file_type`, `contact_inbox.source_id` sólo dígitos. Un único builder: `core/src/domain/rules/inbox-webhook-payload.ts`. Las rutas `/v1/conversations/:id/messages|assignments|labels|toggle_status` copian las de Chatwoot.

## Pantallas

- `/conversaciones` — carpetas, filtros, bandeja, hilo, etiquetas, respuestas rápidas, responder, delegar / devolver a la cola, resolver, ver lead/contacto con etapa.
- `/configuracion/conexiones/whatsapp` — conectar en un botón + QR (refresca cada 8 s), opciones avanzadas para WAHA propio.

## Probar en local

`doc/inbox-local.md`. `scripts/local-inbox/fake-waha.mjs` simula WAHA (incluye `POST /simular/mensaje` y `/simular/estado` con el webhook nativo).

## Pendiente

- Websockets / push en vez de polling.
- OAuth de Meta ("Continuar con Facebook") en lugar de pegar el token; etiqueta `HUMAN_AGENT` de Messenger para responder hasta 7 días.
- Fachada compatible con la API de Chatwoot para importar los flujos de n8n sin tocarlos.
- Permisos por rol en leads, contactos y calendario (mismo problema que tenía la bandeja; otro PR).
- Lo que alguien escribe directo desde el teléfono no queda en el hilo (se descarta `fromMe` para que el bot no se conteste solo).

## Relacionados

- [[Dominio-Leads]] · [[Dominio-Contactos]] · [[Dominio-Notificaciones]] · [[Dominio-Usuarios-Org]]
