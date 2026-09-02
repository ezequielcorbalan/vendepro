# 🌐 Servicios externos

Adaptadores en `packages/infrastructure/src/services/` que envuelven dependencias externas. Implementan ports definidos en `@vendepro/core`.

## JWT — `jwt-auth-service.ts`

- Lib: `jose`
- Implementa `AuthService`
- Métodos:
  - `hashPassword(password)` → SHA-256 + salt `reportes-mg-salt-2026`
  - `verifyPassword(password, hash)` → compara
  - `createToken(payload)` → JWT firmado con `JWT_SECRET`
  - `verifyToken(token)` → decode + verify firma + check exp
- Ver [[Auth-flow]] y [[Reglas-criticas]]

## R2 Storage — `r2-storage-service.ts` + `r2-pdf-storage.ts`

- Implementa `StorageService` y `PdfStorageService`
- Métodos: `upload(key, data, contentType)`, `delete(key)`, `getUrl(key)`, `put(...)`, `get(...)`
- Bucket: `vendepro-assets` (binding `R2` en wrangler.jsonc)
- Usado por: api-properties (fotos), api-admin (logos org), api-properties (PDFs de tasaciones)

## Anthropic Claude — `anthropic-ai-service.ts`

- Lib: `@anthropic-ai/sdk`
- Modelo: **claude-haiku-4-5-20251001**
- Método principal:
  - `extractMetricsFromScreenshot(imageBase64)` → extrae métricas de Zonaprop/Argenprop/etc. desde captura de portal
- Usado por: [[API-ai]] (`POST /extract-metrics`)
- Secret: `ANTHROPIC_API_KEY`

## Groq — `groq-ai-service.ts`

- Modelos (constante `GROQ_MODELS` arriba del servicio — un solo lugar donde tocarlos):
  - `groq/compound-mini` → extracción de leads de texto
  - `groq/compound` → edición de bloques de landings con IA (texto + JSON)
  - `qwen/qwen3.8-27b` → extracción multimodal (imagen → lead)
  - `whisper-large-v3` → transcripción de audio

> ⚠️ **El catálogo de Groq se mueve y rompe en silencio.** Los tres `llama-*`
> anteriores (`llama3-8b-8192`, `llama-3.3-70b-versatile`,
> `meta-llama/llama-4-scout-17b-16e-instruct`) fueron **retirados**: la API
> responde `model_not_found` y las tres features quedaron caídas sin que nada
> avisara. Al rotar la key, chequear con
> `curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"`
> que los modelos del código sigan en la lista.
>
> **`groq/compound` y `groq/compound-mini` no tienen visión**: son sistemas
> agénticos que exigen `messages[].content` como string y responden
> `"messages[0].content must be a string"` ante un array con `image_url`. Por eso
> la visión va por `qwen/qwen3.8-27b` y no por compound. Tampoco honran siempre
> `response_format: json_object` (a veces devuelven el JSON en un bloque
> markdown); el regex de `safeParseJson` lo tolera.
- Métodos:
  - `extractLeadIntent(text)` → parsea texto a `LeadIntent`
  - `extractLeadFromImage(imageBase64, mimeType)` → idem desde imagen (Zonaprop screenshot, etc.)
  - `transcribeAudio(audioBuffer, mimeType)` → speech-to-text
  - `editLandingBlock({ blockType, currentData, prompt })` → modifica un bloque siguiendo instrucción del agente
  - `editLandingGlobal({ landing, prompt })` → edita varios bloques de una landing en bloque
- Usado por: [[API-ai]]
- Secret: `GROQ_API_KEY`

## Meta Conversion API — `meta-conversion-api-http.ts`

- HTTP directo a Graph API v17.0 (sin SDK)
- Implementa `MetaConversionApiService`
- `sendEvent({ pixelId, accessToken, eventName, eventId, userData, customData, testEventCode? })`
- Encripta tokens con [[#Token Encryption]]
- Usado dentro de `marketing-sender-factory.ts`

## GA4 Measurement Protocol — `ga4-measurement-protocol-http.ts`

- HTTP directo a `https://www.google-analytics.com/mp/collect`
- `sendEvent({ measurementId, apiSecret, clientId, eventName, params })`
- Usado dentro de `marketing-sender-factory.ts`

## Marketing Factory — `marketing-sender-factory.ts`

Orquesta los providers de marketing para una org:

```
stage change → MarketingSenderFactory.execute({ org_id, stage_key, entity_id, ... })
  ├── busca StageEventMapping (qué eventos disparar)
  ├── busca MetaIntegration (config pixel + GA4 + stape)
  ├── envía a Meta CAPI (si enabled)
  ├── envía a GA4 (si ga4_enabled)
  ├── envía a Stape sGTM (si stape_endpoint)
  └── loguea cada intento en meta_event_log
```

Ver [[Dominio-Marketing]].

## Token Encryption — `token-encryption.ts`

- Encripta/desencripta access tokens almacenados en `meta_integration` y `ga4_api_secret_encrypted`
- Usa AES-GCM con key derivada de `JWT_SECRET`

## emBlue Email — `emblue-email-service.ts`

- Implementa `EmailService`
- `send({ to, from, subject, html, text })`
- Usado por: password reset emails

## Cloudflare Browser Rendering — `cf-browser-rendering-service.ts`

- Binding `BROWSER` (solo api-properties)
- Implementa `BrowserRenderingService`
- `renderPdf(url, opts)` → recibe URL pública de la tasación renderizada y devuelve `Uint8Array`
- Opciones: `format` (A4|Letter), `margin`, `waitUntil`, `timeoutMs` (default 30s)
- Usado por `GenerateAppraisalPdfUseCase`. Si supera el timeout → `RenderTimeoutError` (503)

## PDF Download Token Signer — `pdf-download-token-signer.ts`

- Genera y verifica JWTs cortos para descargar PDFs de tasaciones públicas
- Endpoint protegido: `GET /public/pdf/:orgId/:appraisalId/:filename?token=...` en [[API-public]]

## Crypto ID Generator — `crypto-id-generator.ts`

- Implementa `IdGeneratorPort`
- `generate()` → 32 chars hex random
