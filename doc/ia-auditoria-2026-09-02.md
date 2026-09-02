# Auditoría de las features de IA — 2026-09-02

> Estado: **hallazgos por lectura de código + pruebas contra la API de Groq**.
> Las pruebas end-to-end por la UI todavía NO se corrieron — el plan de prueba
> está en la sección final para ejecutarlo tal cual una vez aplicados los fixes.

## Inventario: 8 features de IA

| # | Feature | Endpoint | Proveedor / modelo | Entrada UI | Estado |
|---|---|---|---|---|---|
| 1 | Lead desde texto | `POST /extract-entity` | Groq `compound-mini` | `AIChatPanel` (botón flotante) | ⚠️ a verificar |
| 2 | Lead desde imagen | `POST /extract-image` | Groq `qwen/qwen3.8-27b` | `AIChatPanel` pestaña imagen | ⚠️ a verificar |
| 3 | Métricas desde screenshot de portal | `POST /extract-metrics` | Anthropic `claude-haiku-4-5-20251001` | `propiedades/[id]/reportes/nuevo` | 🔴 **ROTO** |
| 4 | Comparable desde screenshot | `POST /extract-comparable` | Anthropic `claude-haiku-4-5-20251001` | `tasaciones` → `ComparableCard` | ⚠️ a verificar |
| 5 | Borrador de campaña de email | `POST /generate-email-campaign` | Anthropic `claude-sonnet-5` | wizard de marketing → `ContentStep` | ⚠️ a verificar |
| 6 | Secuencia de automatización | `POST /generate-email-sequence` | Anthropic `claude-sonnet-5` | `configuracion/automatizaciones` | ⚠️ a verificar |
| 7 | Editar bloque de landing con IA | `POST /landings/:id/edit-block` | Groq `compound` | editor de landings → `AIChatPanel` | ⚠️ a verificar |
| 8 | Extraer contrato de alquiler | (api-rentals) `routes/contracts.ts` | Groq `qwen3.8` + `compound` | — | 🔴 **el worker no deploya** |

---

## 🔴 Feature 3 — `extract-metrics` está rota de tres formas distintas

Es la única feature cuyo contrato front↔back no cierra. **No se puede haber usado nunca desde que se escribió así.**

### 3.1 · CRÍTICO — el front manda `multipart/form-data` y el back parsea JSON

`vendepro-frontend/src/app/(dashboard)/propiedades/[id]/reportes/nuevo/page.tsx:237-244`

```ts
const formData = new FormData()
formData.append('screenshot', file)
formData.append('source', metricsList[index].source)
const response = await apiFetch('ai', '/extract-metrics', { method: 'POST', body: formData })
```

`vendepro-backend/packages/api-ai/src/index.ts:25-27`

```ts
const body = (await c.req.json()) as any            // ← el body es multipart, no JSON
const metrics = await useCase.execute({ imageBase64: body.imageBase64 || body.image })
```

`apiFetch` respeta el `FormData` a propósito (`lib/api.ts:62-68`: *"Don't override Content-Type for FormData"*), así que el request sale multipart. `c.req.json()` sobre un body multipart **tira excepción** → 500. Y aunque no tirara, `body.imageBase64` sería `undefined`: la imagen viaja en el campo `screenshot`, que el backend ni mira.

**Fix**: decidir un solo contrato. Lo barato y consistente con los otros 3 endpoints de imagen es que el front mande JSON con `imageBase64` + `mimeType`, reusando `fileToBase64()` de `components/tasaciones/shared/extract-comparable.ts` (ya existe y hace exactamente esto).

### 3.2 · CRÍTICO — el back devuelve `{ metrics }` y el front lee plano

Backend: `return c.json({ metrics })`.
Frontend: `const extracted: ExtractedMetrics = await response.json()` y después `extracted.impressions`.

O sea que `extracted.impressions` es `undefined` incluso si el request funcionara. Los otros endpoints usan `{ fields }` y el front lee `data.fields` — este quedó a mitad de camino entre las dos convenciones.

**Fix**: `const { metrics } = await response.json()` en el front (o devolver plano en el back; pero `{ metrics }` es más consistente con `{ fields }`).

### 3.3 · ALTO — `media_type` hardcodeado a `image/png`

`packages/infrastructure/src/services/anthropic-ai-service.ts:49`

```ts
source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
```

Un screenshot JPEG — que es lo que sale de la mayoría de las herramientas de captura — se manda declarado como PNG y la API de Anthropic responde 400 por mismatch de media type. El método hermano `extractComparableFromScreenshot` (línea 96) **sí** normaliza y valida con `normalizeImageMediaType` + `ANTHROPIC_IMAGE_TYPES`.

Además el puerto no ayuda: `ExtractPropertyMetricsUseCase` solo acepta `{ imageBase64 }`, sin `mimeType`, así que la información se pierde antes de llegar al servicio.

**Fix**: agregar `mimeType` a `ExtractPropertyMetricsInput` y a `AIService.extractMetricsFromScreenshot`, y usar la misma validación que el método de comparables.

### 3.4 · MEDIO — el campo `whatsapp` no existe en el prompt

El front lee `extracted.whatsapp` (línea 261), pero el prompt de Anthropic pide
`impressions, portal_visits, inquiries, phone_calls, ranking_position`. Ese campo nunca se puede llenar.

**Fix**: agregarlo al prompt, o sacarlo del front. Decidir qué corresponde según lo que muestren los portales.

### 3.5 · MEDIO — la ruta no traduce `statusCode`, a diferencia de sus hermanas

`extract-entity`, `extract-image` y `extract-comparable` tienen `try/catch` que convierte
`e.statusCode` en la respuesta HTTP correcta. `extract-metrics` no: cualquier error se
propaga como 500 sin cuerpo útil.

### 3.6 · MEDIO — el `catch` del front tapa el error real

```ts
} catch (err) {
  setError('No se pudieron extraer los datos del screenshot. Cargalos manualmente.')
}
```

El mensaje es amable pero **come el error**, sin `console.error`. Es la razón de que
tres bugs convivan sin que nadie los reporte: el usuario ve "cargalos manualmente",
asume que la IA no pudo leer *su* captura, y carga los números a mano.

---

## ⚠️ Riesgos abiertos en las features de Groq (cambiadas hoy)

Contexto: los tres modelos que el código usaba (`llama3-8b-8192`,
`llama-3.3-70b-versatile`, `meta-llama/llama-4-scout-17b-16e-instruct`) **fueron
retirados del catálogo de Groq** — `GET /openai/v1/models` ya no los lista y la API
responde `model_not_found`. Cambiados hoy y desplegados (commit `897f30f`).

### G.1 — `qwen/qwen3.8-27b` nunca se probó con el prompt real de extracción

Probé que acepta imágenes y describe una imagen sólida correctamente, pero **no** con
el prompt de `extractLeadFromImage` (conversación de WhatsApp / tarjeta / captura de
portal → JSON de lead). Es el riesgo más alto de lo que se desplegó hoy.

### G.2 — `compound` acepta `response_format: json_object` pero no siempre lo honra

A veces devuelve el JSON dentro de un bloque markdown ```` ```json ````. El regex de
`safeParseJson` (`/\{[\s\S]*\}/`) lo tolera, así que hoy no rompe — pero es una
dependencia implícita que conviene tener anotada.

### G.3 — `compound` es un sistema agéntico con herramientas propias

Puede decidir hacer búsqueda web. En las pruebas respondió en ~1.7s (los timeouts del
código son 15s y 20s), pero con un prompt que lo tiente a buscar podría pasarse.
Vale medir la latencia p95 real cuando haya tráfico.

### G.4 — el catálogo de Groq rompe en silencio

No hay alerta: el modelo desaparece, la API responde `model_not_found`, el use case
devuelve `provider_error` y la UI muestra un mensaje genérico. **Nadie se entera.**
Ya quedó anotado en `vendepro-kb/02-Backend/Servicios-externos.md` con el `curl` para
chequearlo al rotar la key, pero un chequeo automático sería mejor.

---

## Otros hallazgos

| # | Severidad | Hallazgo |
|---|---|---|
| O.1 | Media | **`transcribeAudio` es código muerto.** Está en el puerto `AIService`, implementado en `GroqAIService` (whisper-large-v3) y stubbeado en `AnthropicAIService`, pero **ningún caller en todo el repo**. No hay endpoint ni UI. O se expone o se saca. |
| O.2 | Alta | **`api-rentals` no deploya desde el 2026-08-27.** `wrangler.jsonc:15` tiene `"database_id": "REPLACE_WITH_ACTUAL_D1_ID"`. Su feature de IA (extracción de contratos) es inverificable hasta que se arregle. |
| O.3 | Media | **El smoke de producción casi no corre.** Los 9 workflows comparten `concurrency.group: prod-smoke`; GitHub **cancela** los waiters en vez de encolarlos, así que de 9 deploys sólo el último corre el smoke. El comentario del workflow dice "hacen cola y corren de a uno" — no es lo que pasa. El rollback automático sólo dispara con smoke en `failure`, no en `cancelled`, así que un deploy malo puede quedar arriba. |
| O.4 | Baja | **`scripts/ds-color-lint.mjs` no normaliza separadores de path.** Arma los paths con `join()` (backslashes en Windows) y los compara contra prefijos con `/`, así que las exclusiones no matchean y el lint es inutilizable localmente (reporta ~150 falsos positivos, incluidos los primitivos de `ui/`). En el CI de Linux anda bien. |
| O.5 | Baja | **`doc/ds-visual-rules.md:119-120` quedó desactualizado.** Sigue listando `landings/InspectorPanel.tsx` como excepción a la regla 9, pero `main` ya migró sus inputs a `Input`/`Textarea` del DS. |
| O.6 | Media | **`packages/api-public` arrastra ~89 errores de typecheck preexistentes.** Explica cómo sobrevivió un import duplicado que rompía el bundle entero: el typecheck de ese paquete no está limpio, así que no se corre como gate. |
| O.7 | Baja | **Los fakes de `LandingRepository` se pasan con `as any`** en los tests de use cases, así que TypeScript no fuerza conformidad de interfaz: agregar un método al puerto no rompe ningún fake. |
| O.8 | Media | **`packages/infrastructure` da rojo en `npm test` en máquinas normales.** `vitest.config.ts` usa `maxThreads: 4`; cada test levanta su propio Miniflare y corre 31 migraciones, y los hooks se pasan del techo de 30s. Con `maxThreads=1` pasa todo. Entrena a ignorar el rojo. |
| O.9 | Baja | **`vendepro-kb/04-Base-de-datos/DB-overview.md`**: la tabla de migraciones se corta en la 020 y dice "51 tablas en 24 migrations", pero hay 58 archivos hasta la 049. |

---

## Plan de prueba (correr tal cual después de los fixes)

App: **https://app.vendepro.com.ar** · API de IA: `https://ai.api.vendepro.com.ar`
Token: `localStorage.getItem('vendepro_token')` → header `Authorization: Bearer <token>`.

> ⚠️ **Es la base de producción del cliente.** Las pruebas pueden *generar* propuestas
> de la IA, pero NO confirmar altas, NO enviar emails y NO activar automatizaciones.

Para cada feature registrar: **status HTTP · latencia · campos extraídos bien / inventados / perdidos · errores de consola · qué ve el usuario**.

### 1. Lead desde texto — `extract-entity`
Botón flotante de IA → pestaña texto. Pegar:
> "Hola, soy Martín Pérez, mi cel es 11 5555-4444. Busco un 3 ambientes en Palermo para comprar, hasta USD 180.000. Me lo pasaron por un aviso."

Esperado: nombre, teléfono, barrio, tipo, operación y presupuesto; `email` ausente (el prompt pide no inventar).
*Ya probado contra la API directa: OK, 1.3s, extracción correcta. Falta probarlo por la UI.*

### 2. Lead desde imagen — `extract-image`
Mismo panel, pestaña imagen. Pegar (Ctrl+V) una captura de una conversación de WhatsApp con datos de un lead. **El de mayor riesgo** (modelo de visión nuevo).

### 3. Métricas desde screenshot — `extract-metrics`
`/propiedades/<id>/reportes/nuevo` → subir un screenshot de estadísticas de Zonaprop.
**Hoy falla seguro** (ver sección 3). Reprobar después de los 3 fixes, y probar con **JPEG y PNG** para cerrar el 3.3.

### 4. Comparable desde screenshot — `extract-comparable`
Tasaciones → agregar comparable → pegar captura de una publicación. Verificar dirección, superficies, precio, antigüedad.

### 5. Campaña de email — `generate-email-campaign`
Wizard de marketing → paso de contenido → brief corto. Verificar que devuelve `subject`/`preheader`/`html`/`text`, que el HTML **no** trae `<!DOCTYPE>`/`<html>`/`<body>` (el system prompt lo prohíbe porque el template ya los pone) y que no inventa precios ni direcciones. **No enviar.**

### 6. Secuencia de automatización — `generate-email-sequence`
`configuracion/automatizaciones` → generar secuencia. Verificar que devuelve `steps` como array del largo pedido. **No activar la automatización.**

### 7. Editar bloque de landing — `landings/:id/edit-block`
Editor de una landing → panel de IA → "hacé el copy del hero más urgente". Verificar que la propuesta respeta el schema Zod del bloque, que no cambia `id`/`type` ni URLs de imágenes, y que el scope global preserva el largo y el orden del array.
*Ya probado contra la API directa con un bloque `agent-hero`: OK, ~1.7s, claves exactas. Falta por la UI.*

### 8. Contrato de alquiler — api-rentals
**Bloqueada** hasta que `wrangler.jsonc` tenga un `database_id` real (O.2).

---

# Resultados de la verificación en producción

Corrida el 2026-09-02 con 3 sesiones en paralelo contra `app.vendepro.com.ar`, por la
UI real (los requests los emitió el `apiFetch` de la app, con la sesión del admin).
Todo lo de abajo está **verificado en runtime** salvo donde diga lo contrario.

## Veredicto por feature

| # | Feature | Proveedor | Veredicto |
|---|---|---|---|
| 1 | `extract-entity` | Groq `compound-mini` | ✅ **anda** — 200 en 1.2–1.5 s, extracción exacta |
| 2 | `extract-image` | Groq `qwen3.8-27b` | ✅ **anda** — PNG 0.85 s / JPEG 1.16 s, 8/8 campos |
| 3 | `extract-metrics` | Anthropic | 🔴 **rota** — bug 3.1 confirmado, y además la key |
| 4 | `extract-comparable` | Anthropic | 🔴 **bloqueada** por la key + **desloguea al usuario** |
| 5 | `generate-email-campaign` | Anthropic | 🔴 **caída** — 500 por la key |
| 6 | `generate-email-sequence` | Anthropic | 🔴 **caída** — 500 por la key |
| 7 | `edit-block` | Groq `compound` | ⏳ sin probar por UI (por API: OK, ~1.7 s) |
| 8 | contratos (api-rentals) | Groq | ⏸️ bloqueada, el worker no deploya |

**Groq ✅ / Anthropic ❌.** Los 3 modelos nuevos de Groq quedan validados y el riesgo
G.1 (el modelo de visión sin probar con el prompt real) **queda descartado**.

## 🔴 V.1 · CRÍTICO — la `ANTHROPIC_API_KEY` del worker `api-ai` no sirve

Cuerpo textual devuelto por `/extract-comparable`:

```
401 {"error":"No se pudo procesar la imagen. Probá con otra captura (formato JPG/PNG/WEBP).
 [anthropic 401: {"type":"error","error":{"type":"authentication_error",
 "message":"invalid x-api-key"},"request_id":"req_011Ceeo1FsMT1uow6ZEZcXQq"}]"}
```

Reproducido 5 veces, estable, ~300 ms. request_ids: `req_011Ceeo1FsMT1uow6ZEZcXQq`,
`req_011Ceeo79TZKugkdXxUMD6tj`, `req_011Ceeo7AezdSASLa8GP393z`. Mata las **4** rutas que
la usan (`api-ai/src/index.ts` líneas 27, 47, 67, 84).

Control de que no es red ni token: `/extract-entity` (Groq, misma app, mismo JWT) → 200
en 1195 ms.

### La key está AUSENTE, no vencida — probado

El mensaje `invalid x-api-key` no distingue entre key revocada y key ausente: si el
secret no existe, `c.env.ANTHROPIC_API_KEY` es `undefined`, y `undefined` en un header
no tira excepción — se manda como el string literal `"undefined"`, Anthropic lo recibe
y responde exactamente el mismo 401. Por eso hubo desacuerdo entre las sesiones.

Lo cierra `wrangler secret list` (read-only, sólo nombres, no es un deploy):

```
$ npx wrangler secret list --name vendepro-api-ai
[ { "name": "GROQ_API_KEY" }, { "name": "JWT_SECRET" }, { "name": "RESEND_API_KEY" } ]
```

**Tres secrets. `ANTHROPIC_API_KEY` no está.** Nunca estuvo: tampoco aparece en
`.github/workflows/`, ni como secret del repo, ni en `api-ai/wrangler.jsonc`.
`.claude/rules/auth-security.md` dice *"ANTHROPIC_API_KEY stored as Cloudflare Worker
secret"*, o sea que el diseño previsto **nunca se implementó**.

Corolario importante: **500 vs 401 no dice nada sobre la key.** Con la key ausente el
request igual sale a Anthropic y vuelve 401 (hay request_ids de Anthropic, que no se
generan sin que el request llegue), y `/generate-email-campaign` dio 500 en 480 ms —
muy por encima del piso de 43 ms sin salida de red. Los cuatro caminos fallan por la
misma causa; lo que cambia es qué helper de error usa cada uno (ver V.6).

**Fix, en dos partes:**
1. **CI** (se puede desde el repo, mismo patrón que `f0204d3` para api-rentals/GROQ):
   declarar `ANTHROPIC_API_KEY` en `_deploy-api.yml` → `workflow_call.secrets` y en el
   paso `Sync app secrets to worker`, y pasarla desde `deploy-api-ai.yml`.
2. **Manual**: cargar el valor como secret del repo (`gh secret set ANTHROPIC_API_KEY`).
   Sin esto el punto 1 sincroniza un valor vacío.

**Bloquea todo lo demás de Anthropic**: arreglar el multipart de `extract-metrics` sin
esto sólo cambia un 500 por otro 500.

## 🔴 V.2 · ALTO — una falla de credencial de Anthropic DESLOGUEA al usuario

Bug nuevo, no estaba en la auditoría, y es **independiente de la key**: con la key
arreglada, un rate-limit o un vencimiento lo vuelve a disparar.

```
Anthropic 401 (invalid x-api-key)
  → anthropicError(): statusCode = status para todo 4xx   (anthropic-ai-service.ts:16)
  → la ruta: if (typeof e?.statusCode === 'number') c.json({error}, e.statusCode) → 401
  → apiFetch: if (status === 401) { clearToken(); location.href = '/login' }  (lib/api.ts:70)
  → USUARIO DESLOGUEADO
```

Reproducido por la UI: al pegar un screenshot en un comparable, la pestaña saltó a
`/login` con `vendepro_token` borrado de localStorage **y** de la cookie — o sea **todas
las pestañas del dominio**. Se pierde el trabajo no guardado del editor de tasación.

### Dónde va el fix (esto se discutió y quedó resuelto)

**No** en `apiFetch`. Su premisa —un 401 de *nuestra* API significa JWT inválido— es
correcta. Lo que está mal es que el worker emita 401 por un motivo que no es ése.

El fix va en `anthropicError` (`anthropic-ai-service.ts:16`). Su comentario asume que
*"4xx de Anthropic suele ser culpa del input (imagen inválida/grande)"*, premisa válida
para 400 y 413 pero **no** para 401/403/429, que hablan de nuestras credenciales o
nuestra cuota. Passthrough sólo para 400/413; 401/403 → 502; 429 → 429 o 503.

**El patrón correcto ya existe en el mismo repo**: `/extract-entity` y `/extract-image`
hacen whitelist (`if (e.statusCode === 400 || e.statusCode === 413)`) y re-tiran el
resto al `errorHandler`. Por eso **no pueden desloguear a nadie** aunque Groq devuelva
401. `/extract-comparable` es la única con passthrough genérico.

## 🔴 V.3 · el bug 3.1 queda CONFIRMADO con evidencia de runtime

Request real capturado del browser (hookeando `window.fetch`):

```json
{"url":"…/extract-metrics","method":"POST","bodyCtor":"FormData",
 "formFields":[{"k":"screenshot","file":{"name":"zonaprop-stats.png","type":"image/png","size":61051}},
               {"k":"source","value":"zonaprop"}],
 "ms":83,"status":500,"resBody":"{\"error\":\"Internal server error\"}"}
```

Sin `Content-Type` propio ⇒ el browser pone `multipart/form-data; boundary=…`. Lleva
`screenshot`, **no** lleva `imageBase64`. **83 ms** ⇒ muere en `c.req.json()` y **nunca
sale a Anthropic**. Las dos causas quedan separadas: el bug de contrato es real y
anterior al problema de la key.

Escala de latencias de este worker, útil para diagnosticar a futuro:

| Latencia | Significa |
|---|---|
| ~43 ms | corta en la validación del use case (`imageBase64 is required`) |
| ~83 ms | explota parseando el body (bug 3.1) |
| ~300 ms | salió a Anthropic y volvió 401 |
| ~470 ms | ídem, ruta de generación de emails |
| 1–2 s | Groq respondiendo bien |
| 10–25 s | generación real de Sonnet (nunca observada todavía) |

Los bugs **3.2** (`{metrics}` vs plano) y **3.3** (`media_type` hardcodeado) siguen
**sin confirmar en runtime**: el 401 los tapa. Válidos por lectura de código.

## 🔴 V.4 · ALTO — el textarea del panel de IA es intipeable

`useOverlay.ts:44` lleva `onClose` en las deps del efecto y `AIChatPanel.tsx:200` se lo
pasa como arrow inline (`onClose={() => onClose?.()}`): identidad nueva en cada render.
Cada tecla re-corre el focus-trap — el cleanup hace `prevActive?.focus?.()` y el re-run
hace `(first ?? panel)?.focus()`, donde `first` es el primer focusable del panel = **el
botón Cerrar**.

Escribís `Hola, ` y queda sólo la `H`; los caracteres siguientes van al botón y el
primer **espacio** lo activa (space = click en un `<button>`) → `onClose()` → drawer
cerrado y texto perdido.

**Por qué nadie lo reportó**: la UI dice *"Pegá el texto del lead"* y pegar funciona
perfecto (un solo update de estado, el texto entra antes del salto de foco). El camino
documentado esquiva el bug. Una sesión llegó a descartarlo como artefacto de la
automatización antes de que otra lo root-causeara: **un humano tipeando pierde el texto
igual**.

**Alcance**: `Modal.tsx:38` usa el mismo `useOverlay`, así que cualquier Modal/Drawer con
un input adentro que reciba `onClose` inline tiene el mismo problema.
`landings/[id]/page.tsx:184` también pasa arrow inline (hoy no muerde: ese drawer no
tiene inputs de texto). `ConfigDrawer` y `VersionsDrawer` pasan referencia estable.

**Fix**: guardar `onClose` en un ref dentro de `useOverlay` y sacarlo de las deps; correr
el foco inicial sólo al montar (`[open]`). Arregla los dos consumidores de una.

## ⚠️ V.5 · MEDIO — `estimated_value` se guarda como `NaN`

`AIChatPanel.tsx:168` manda `estimated_value: fields.budget ?? ''`. Desde imagen el
modelo devuelve frases (`"hasta $650.000 por mes"`), y `create-lead.ts:52` hace:

```ts
estimated_value: input.estimated_value ? parseFloat(String(input.estimated_value)) : null
```

El string es truthy ⇒ pasa el guard ⇒ `parseFloat` da **`NaN`** ⇒ se bindea a D1. Desde
texto no muerde (vino el número `180000`); desde imagen muerde casi siempre.

Relacionado: **no hay validación en runtime de la forma del JSON del LLM en ningún
lado.** `extractLeadIntent` devuelve el `JSON.parse` crudo tipado como `LeadIntent`, y
`ExtractedFields` declara `budget?: string` mientras la API devolvió un `number`.

## ⚠️ V.6 · MEDIO — la misma causa falla de tres formas distintas

Una sola key rota produce tres síntomas incompatibles, y eso es un defecto en sí:

| Ruta | Cómo tira el error | Qué ve el front |
|---|---|---|
| `extract-metrics` | `new Error('Anthropic API error: 401')` pelado (`anthropic-ai-service.ts:69`), ruta sin try/catch | **500 mudo** |
| `extract-comparable` | `anthropicError(status, body)` con statusCode | **401 → desloguea** |
| `generate-email-*` | `new Error(...)` pelado, rutas sin try/catch | **500 mudo** |

`anthropic-ai-service.ts:69` tira un `Error` sin `statusCode` ni cuerpo, mientras su
hermano usa `anthropicError(status, body)` que adjunta los dos. **Esa asimetría es la
razón de que la key rota se haya podido diagnosticar**: `extract-comparable` cantó
`invalid x-api-key`; las otras tres dieron 500 sin información.

## ⚠️ V.7 · los dos system prompts de email se contradicen sobre el HTML

`generate()` **prohíbe** `<!DOCTYPE>`/`<html>`/`<head>`/`<body>` y cualquier tarjeta o
fondo propio, porque el template base ya los pone. `generateSequence()`, en el mismo
archivo, pide lo contrario: *"ancho máx 600px… fondo #f7f7f8, tarjeta blanca, font
Poppins/Arial"*. Si el envío de la automatización usa el mismo template base, la
secuencia produce justo la tarjeta-dentro-de-tarjeta que el prompt de campaña existe
para evitar. Revisar qué envuelve `body_html` en el path de envío antes de tocar nada.

## ⚠️ V.8 · la vista previa de `ContentStep` miente

Renderiza `<iframe srcDoc={content.html}>` con el fragmento crudo, **sin** el template
base. Si el modelo obedece bien el prompt (fragmento pelado, sin tarjeta), el usuario ve
texto sin estilos sobre blanco y parece roto — y el placeholder del tab HTML dice
`<html>…</html>`, contradiciendo el prompt. Una generación *correcta* se ve mal, y el
usuario la va a "arreglar" pegando un documento completo. Pega apenas se restablezca la key.

## ⚠️ V.9 · otros, sin confirmar en runtime

- **Límites no validados**: nada chequea `subject` ≤60 ni `preheader` ≤90 fuera del prompt.
- **Largo de secuencia no validado**: el prompt pide "exactamente N" pero el código sólo
  chequea `Array.isArray && length > 0`. Si el modelo devuelve 2 cuando pediste 5, la UI
  arma 2 acciones sin avisar.
- **`max_tokens` vs thinking adaptativo**: el código no manda `thinking`, y en Sonnet 5
  omitirlo corre adaptive thinking, cuyos tokens cuentan contra `max_tokens`. Con 8000
  para una secuencia de 5 emails HTML queda ajustado; una respuesta truncada rompe
  `parseJsonLoose`. Medir cuando la key funcione.
- **Nota sobre 3.3**: `image/gif` **sí** está en `ANTHROPIC_IMAGE_TYPES`, así que un
  mimeType gif no rebota por validación — no sirve como caso de test.
- **La consola siempre sale limpia.** Confirmado en las tres sesiones: `ContentStep.tsx:59-61`,
  `GenerateSequence.tsx:88-90` y el catch de métricas se comen la excepción en un toast
  sin `console.error`. Para diagnosticar cualquier cosa acá hay que mirar la red, no la consola.

## Orden de fixes

0. **Revisar `ANTHROPIC_API_KEY` en el dashboard de Cloudflare** (manual; bloquea 4 features).
1. **V.2** — que `anthropicError` no emita 401/403/429. Independiente de todo lo demás y
   evita que un fallo del proveedor desloguee usuarios y les borre trabajo.
2. **V.4** — `useOverlay`, que arregla el panel de IA y de paso todos los modales.
3. **3.1 + 3.2** — contrato JSON de `extract-metrics` y leer `{ metrics }`.
4. **V.6 + 3.5** — `anthropicError` en el método de métricas, y try/catch en las 3 rutas
   que no lo tienen.
5. **3.6** — `console.error` en los catch del front.
6. **V.5** — `estimated_value` no debe mandar `NaN`.
7. Recién con 0–6 hechos se pueden probar 3.2, 3.3, la calidad de extracción del
   comparable, y V.7/V.8/V.9.
