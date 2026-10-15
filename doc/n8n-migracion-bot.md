# Migrar los flujos de n8n de Onetalk a la bandeja de VendéPro

Revisado contra los flujos reales de n8n (15-oct-2026). VendéPro ya imita lo que esos flujos usan de Onetalk (Chatwoot): mismas rutas, mismo header, mismos formatos. Lo que queda es **cambiar host y token**, más dos cosas que en Onetalk usaban ids propios.

## Qué flujos le hablan a Onetalk

| Flujo | Nodos que llaman a Onetalk |
|---|---|
| **Asistente IA Inmobiliaria** (el bot, webhook `/webhook/kiteprop-mensajes`) | Enviar WhatsApp, Pull Historial, Toggle Status Open, Add Label Pausado, Add Label Off Topic, Add Label Prensa, Auto Pause Conversation, Assign Conversation, Assign To Gaston, Send PDF Attachment, Get Conv Meta, Get Meta FU, Get Msgs FU, Get Msgs Pausado, Onetalk Send Caida, Onetalk Aviso Falla |
| **VendePro → EMBLUE Enrichment** | Onetalk WA Check, Onetalk Search Contact |

El resto (KiteProp, Anthropic, EMBLUE, Sheets, Gmail) no cambia.

## Pasos

### 1. Token de VendéPro
Configuración → API → **Nuevo token**, con permisos **inbox:read** e **inbox:write**.

### 2. Credencial nueva en n8n
Credentials → New → **Header Auth**:
- Name del header: `api_access_token` (el mismo que usa Onetalk)
- Value: el token del paso 1

### 3. Cambiar el host en los nodos de la tabla
En cada nodo, en la URL, reemplazar:

```
https://inbox.embluemail.com
```
por
```
https://public.api.vendepro.com.ar
```

El resto de la URL **queda igual** (`/api/v1/accounts/161/conversations/…`, `/contacts/search?q=…`). Y en cada uno, elegir la credencial del paso 2.

### 4. Asignaciones (bot)
En Onetalk se asignaba con ids de usuario de Onetalk (ej. `320`). VendéPro no los conoce, pero **acepta el id del agente de KiteProp**, y lo traduce con el mapeo que ya está en Configuración → Conexiones → KiteProp.
- **Map to Onetalk User**: en vez de traducir con la tabla `KP_TO_ONETALK`, mandar directamente el id de KiteProp:
  `const mappedId = kpOwnerId || '<id de VendéPro de Gastón>'`
- **Assign To Gaston**: cambiar `320` por el id de VendéPro de Gastón.
- Que cada agente esté mapeado en Configuración → Conexiones → KiteProp. Un id que no se puede traducir responde **422** (y la conversación queda sin asignar).

### 5. Que VendéPro le avise al bot
Configuración → API → **Webhooks** → nuevo webhook con el evento **`message_created`** apuntando al webhook del bot.

**Para probar en paralelo sin tocar lo que anda**: duplicar el flujo del bot, cambiarle el path del webhook (ej. `vendepro-mensajes`) y apuntar el webhook de VendéPro a ese. Onetalk sigue usando `kiteprop-mensajes` hasta el corte.

## Lo que VendéPro ya hace igual que Onetalk (no hay que tocar)
- Webhook `message_created` con `message_type: "incoming"` / `"outgoing"` (texto), `sender.phone_number` en E.164, `sender.identifier`, `conversation.id`, `conversation.channel`, `content`, `id`.
- Historial: `{payload: [...]}` con `message_type` 0/1, `private`, `content` y `created_at` en segundos; respeta `?per_page=`.
- Conversación: `labels` (y `meta.sender` / `meta.assignee`).
- Mandar texto (`content` + `message_type: "outgoing"`) y archivo (multipart `attachments[]`), etiquetas (lista completa) y `toggle_status` con `{status: "open"}`.
- Búsqueda de contactos por teléfono, con `last_activity_at` en segundos y el mismo sentido que Onetalk: sólo personas que escribieron.

## Diferencias que conviene saber
- **El PDF de presentación**: con WAHA gratuito sale como **texto con el link** al PDF (WAHA Core no manda archivos). Con WAHA Plus, o por Instagram/Messenger, sale como archivo.
- **Ventana de 24 h**: en Instagram y Messenger, fuera de la ventana VendéPro rechaza el mensaje (400) en vez de dejar que Meta lo pierda.
- Los ids de conversación son texto, no números. El bot no asume números (revisado).

## Antes de hacerlo (seguridad)
La api key de KiteProp está escrita **en la URL** de varios nodos (`mcp.kiteprop.com/mcp?api_key=…`), en los dos flujos. Cualquiera con acceso a n8n, o a un export, la ve. Conviene moverla a una credencial y rotarla en KiteProp.
