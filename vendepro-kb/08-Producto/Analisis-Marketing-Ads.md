# 🔍 Análisis — Sección Marketing y el camino al reporte en vivo de anuncios

> Análisis del código de `/marketing` al 2026-09-03. Complementa [[Roadmap-estado-implementacion]] (auditoría general del 2026-08-29): acá el foco es **la sección de marketing como producto** — qué muestra, qué miente, y qué hace falta para que sea el reporte en vivo de la pauta.
> Rutas relativas a la raíz del repo.
>
> **Estado: F0 y F1 implementadas** (rama `claude/vendepro-marketing-analysis-e3b885`). Los hallazgos marcados ✅ ya están corregidos en código; el resto sigue abierto. Detalle en §§ 9-12.
> - **F0** (03-sep): el panel dice la verdad y está partido en Captación / Demanda.
> - **F1a — gasto de portales** (07-sep): tabla `portal_spend`, ABM, cotización automática y costo por lead y por visita de cada portal. ⚠️ **falta aplicar la migración 050** (va por CI).
> - **F1b — ingresos y honorarios** (08-sep): honorarios por operación cerrada, con ROI por portal. ⚠️ falta aplicar 052.
> - **Separación de campañas por objetivo** (08-sep): etiqueta manual + bandeja de sin clasificar. ⚠️ falta aplicar 051.

---

## 1. Qué es hoy la sección

### Pantallas

| Ruta | Módulo (plan PRO) | Qué hace |
|---|---|---|
| `/marketing` | `publicidad` | Panel único: integraciones, 4 KPIs, embudo, leads por fuente, campañas de Meta, eventos enviados, audiencias sugeridas, insights |
| `/marketing/emails` (+ `nueva`, `[id]`) | `emails` | Campañas de email por Resend |
| `/marketing/automations` | — | `redirect()` a `/configuracion/automatizaciones` (alias viejo) |
| `/configuracion/marketing` | — | Config: pixel, token, GA4, Ad Account, mapeo de eventos, log, settings de email |

O sea: **la sección tiene una sola pantalla propia de publicidad** (`marketing/page.tsx`, 484 líneas, client component) y todo lo demás son vecinos.

### De dónde salen los datos

```
/marketing (front)
├── GET analytics /marketing?period          → api-analytics/src/index.ts:216
│   ├── leads por fuente        (TODOS los leads de la org)
│   ├── leads por día           (TODOS los leads de la org)
│   ├── stage breakdown         (SOLO pipeline = 'vendedor')
│   ├── meta_event_log          (provider='meta', del período)
│   └── meta_integration        (WHERE org_id, .first())
└── GET analytics /marketing/campaigns?period → api-analytics/src/index.ts:275
    ├── Meta Marketing API live (level=campaign, cache CF 900s)
    └── match CRM: lower(leads.source_detail) == lower(campaign_name)
```

Salida hacia las plataformas: `SendMarketingEventUseCase` (Meta CAPI + GA4 Measurement Protocol), 8 hooks vivos, config **por agente** (`meta_integration.agent_id` PK desde la migración 040).

---

## 2. Diagnóstico en una frase

**Hoy `/marketing` es un panel de leads con una tabla de Meta pegada al costado, no un reporte de anuncios**: no tiene histórico, no baja de campaña, la atribución matchea por nombre y los números de la misma pantalla no cierran entre sí.

---

## 3. El problema de fondo — dos negocios en una misma pantalla

La sección está pensada para **captación** (conseguir propietarios que quieran vender: lead → tasación → captado). El embudo lo confirma: `stageBreakdown` filtra `COALESCE(pipeline,'vendedor') = 'vendedor'` (`api-analytics/src/index.ts:228`).

Pero **"Leads por fuente", "Leads por día", "Fuentes activas" y el sparkline no filtran nada** (`api-analytics/src/index.ts:224-226`). Y por ahí entran los compradores:

- El sync de KiteProp crea leads con `pipeline: 'comprador'`, `source = <portal>` y `source_detail = <código de propiedad>` (`sync-kiteprop-contacts.ts:340-352`).
- Los portales de ese `source` son justamente **ZonaProp, ArgenProp y MercadoLibre** (`core/src/shared/crm-config.ts:111-113`).

Consecuencias concretas:

1. **El KPI "Leads del período" (vendedor) no es la suma de "Leads por fuente" (todos).** Dos totales distintos, en la misma pantalla, sin explicación.
2. **El insight destacado miente**: `"ZonaProp es tu principal fuente con N leads"` (`marketing/page.tsx:158`) — ZonaProp no es un canal de pauta, no tiene gasto, no se optimiza y esos leads son compradores consultando una publicación, no propietarios.
3. **Los leads que sí vienen de la pauta se ven peor que el ruido**: los de landing quedan con `source = 'landing:<slug>'` (`submit-lead-from-landing.ts:44`), que no existe en `LEAD_SOURCES` ni en `SOURCE_COLORS` → se renderizan como texto crudo en gris (`marketing/page.tsx:299-301`).

### La corrección conceptual

No se trata de esconder a los compradores: **son dos objetivos de pauta distintos** y una inmobiliaria pauta los dos.

| | Captación (vendedor) | Demanda (comprador) |
|---|---|---|
| Objetivo del anuncio | Conseguir propietarios | Vender una propiedad puntual |
| Destino | Landing de tasación / ficha pública | Landing de propiedad / WhatsApp |
| Éxito | Captado (propiedad firmada) | Visita → oferta → reserva |
| Fuente NO pauteada | Referidos, cartel | **Portales (ZonaProp/ArgenProp/ML)** |

Los portales son **inventario de demanda**, no un canal de marketing: se pagan por publicación, no por resultado, y su performance ya se mide en otro lado (`/reportes/performance`, métricas por portal del reporte al propietario). Su lugar natural es ahí y en el pipeline comprador — no compitiendo contra Meta en el mismo gráfico de barras.

**Decisión tomada**: la sección se parte en dos vistas hermanas — **Captación** y **Demanda** — y los portales se mudan a Demanda con su propio gasto cargado a mano, para poder compararlos contra Meta con la misma vara. El detalle del diseño está en § 5.6.

---

## 4. Hallazgos

### 4.1 Números que no se sostienen

| # | Hallazgo | Dónde |
|---|---|---|
| 1 | Total del panel ≠ suma de fuentes (vendedor vs. todos) | ✅ **arreglado en F0** |
| 2 | **CPL con dos denominadores distintos en la misma columna**: si hay leads CRM usa esos, si no usa los de Meta — y la columna no lo aclara. Comparar filas entre sí no es válido. | ✅ **arreglado en F0** |
| 3 | **Las flechas de tendencia no son tendencias**: la de conversión compara contra un umbral fijo de 10%, no contra el período anterior | ✅ **arreglado en F0** |
| 4 | **El sparkline de "Tasa de conversión" es la diferencia día a día de leads**, no conversión | ✅ **arreglado en F0** |
| 5 | **Períodos inconsistentes**: mes = calendario (día 1), trimestre = últimos 3 meses (móvil), año = calendario. "Mes" y "Trimestre" no son comparables entre sí | ✅ **arreglado en F0** |
| 6 | No hay comparación contra período anterior en ningún indicador | ✅ **arreglado en F0** |

### 4.2 Atribución rota

| # | Hallazgo | Dónde |
|---|---|---|
| 7 | **La UTM real del click se pierde**: el lead de landing guarda `source_detail = lead_rules.campaign` (texto fijo de la landing), no la `utm_campaign` que trajo el click. La UTM sí se captura, pero muere en `landing_events` sin unirse nunca al lead | `submit-lead-from-landing.ts:45` vs `:70-77` |
| 8 | **El match campaña↔lead es string exacto** contra el nombre de la campaña en Meta. Si el nombre cambia en Ads Manager, la atribución histórica se rompe sola | `api-analytics/src/index.ts:315-331` |
| 9 | **Cero click ids**: `fbclid`/`fbc`/`fbp`/`gclid` no aparecen en ninguna parte del repo. Meta sólo puede matchear por email/teléfono hasheado, y nosotros nunca podemos decir *qué anuncio* trajo la captación | grep vacío en todo el repo |
| 10 | **GTM no cargaba en ninguna página pública.** `GtmScript` se montaba sólo en `/t/` y `/v/`: en `/t/` sin props (devolvía `null` siempre) y en `/v/` leyendo `data.org.gtm_container_id`, un campo que la API pública nunca devolvió. En `/l/[slug]` —la landing a la que apuntan los anuncios— no se montaba. Los `pushMarketingEvent` empujaban a un `dataLayer` que no leía nadie, en las tres | ✅ **arreglado en F0** |
| 11 | `ga4ClientId` sintético (`entity.<id>`) cuando no hay visitor_id → GA4 nunca arma sesión | `send-marketing-event.ts:220` |

### 4.3 Techo de la integración

| # | Hallazgo | Dónde |
|---|---|---|
| 12 | **Sólo nivel campaña**: el adapter pide `level=campaign` hardcodeado. No hay ad set, ni anuncio, ni creativo, ni thumbnail → "ver los anuncios desde acá" hoy es imposible con lo que se trae | `meta-ads-insights-http.ts:34` |
| 13 | **Cero histórico**: todo es fetch en vivo con cache de 15 min. Sin tablas `ad_*` ni cron de pull no hay serie temporal, no se puede ver cómo venía el CPL, y cada cambio de período es otra llamada contra un endpoint que ratelimitea fuerte | no existe |
| 14 | **Panel org-level, Ad Account por agente**: `/marketing/campaigns` usa `c.get('userId')` → cada usuario ve las campañas de *su* ad account, mientras el resto de la pantalla muestra los leads de *toda la org*. F0 alineó el badge de integración al mismo usuario; la solución de fondo (varias cuentas por org) es F2 | 🟡 parcial |
| 15 | 🐛 El badge "Meta activo" consulta `meta_integration WHERE org_id = ?` con `.first()` sobre una tabla cuya PK es `agent_id` → puede mostrar la config de otro agente | ✅ **arreglado en F0** |
| 16 | **Sin ingesta de Lead Ads**: no hay webhook `leadgen` de Meta. Un formulario nativo no entra al CRM salvo export manual o n8n contra `POST /v1/leads` | grep vacío |
| 17 | **Google Ads no existe**: cero código. GA4 Measurement Protocol ≠ Google Ads: sirve para analítica, no alimenta al optimizador de la pauta | grep vacío |
| 18 | Ninguna acción sobre la pauta: no se puede pausar, ajustar presupuesto, ni duplicar nada desde acá. El link "Abrir Meta Ads" es una salida, no una función | `marketing/page.tsx:344` |

### 4.4 Piezas muertas en pantalla

| # | Hallazgo | Dónde |
|---|---|---|
| 19 | Los 4 botones **"Exportar →"** de "Audiencias sugeridas" no tienen `onClick`. La tarjeta promete exportar a Meta y no hace nada | ✅ **la tarjeta se retiró en F0**; vuelve en F4 con export real |
| 20 | "Visitantes landing sin lead" está hardcodeado en `null` — nunca muestra un número | ✅ **se retiró en F0** (vivía en esa misma tarjeta) |
| 21 | `RetryFailedMetaEventsUseCase` existe con tests y no lo invoca ni un endpoint ni un cron: los eventos fallidos quedan fallidos | `use-cases/marketing/retry-failed-meta-events.ts` |
| 22 | Los mapeos recomendados viven sólo en el front (`RECOMMENDED_MAPPINGS`); sin seed en DB, una org nueva tiene todos los eventos en `noop` | `configuracion/marketing/page.tsx:64-69` |

---

## 5. El producto objetivo — "reporte en vivo de tus anuncios"

El objetivo declarado: *entrar acá y entender qué está pasando con la pauta, más rápido y con más criterio que abriendo Meta Business o esperando el reporte de un empleado*.

Eso exige tres capas que hoy no están: **histórico**, **granularidad hasta el anuncio** y **el resultado comercial pegado al anuncio**. Y una cuarta que es el diferencial real: **devolverle esa data a las plataformas**.

### 5.1 Lo que VendéPro puede decir y Meta no

Ese es el argumento de venta entero, y conviene tenerlo explícito:

- Meta sabe **lead**. VendéPro sabe **lead contactado, calificado, tasado, captado y vendido**.
- Meta te dice el CPL. VendéPro te dice el **costo por captación** y, con reservas, el **costo por operación cerrada**.
- Meta optimiza contra el evento que le mandes. Si le mandás *captado* en vez de *lead*, deja de traerte curiosos.

Todo lo demás del plan es la plomería para poder decir esas tres frases con números.

### 5.2 Modelo de datos (lo que falta)

```
ad_accounts        org_id, provider('meta'|'google'), external_id, currency, name, status
ad_campaigns       account_id, external_id, name, objective, status, daily_budget,
                   vp_goal('captacion'|'demanda'|null)   ← objetivo comercial, editable acá
ad_sets            campaign_id, external_id, name, status, targeting_summary
ads                ad_set_id, external_id, name, status, creative_id
ad_creatives       external_id, thumbnail_url, body, title, permalink
ad_daily_metrics   ad_id (o campaign_id), date, spend, impressions, clicks, reach,
                   frequency, leads, ctr, cpm            ← snapshot diario, PK (entity, date)
lead_touches       lead_id, visitor_id, occurred_at, source, medium, campaign, content,
                   term, click_id, click_id_type, landing_slug, referrer, position
```

`ad_daily_metrics` es la pieza que desbloquea todo lo demás: con un snapshot por día se puede comparar períodos, graficar la serie, calcular CPL/CPA rodante y dejar de depender de que Meta responda.

### 5.3 Ingesta

- **Cron diario** (tercer cron en api-crm, o worker propio) que baja `level=ad` con `fields=ad_id,adset_id,campaign_id,ad_name,spend,impressions,clicks,actions,...` para ayer y **re-escribe los últimos 7 días** (Meta reatribuye hacia atrás).
- **Refresh en vivo** (el de hoy, con cache corto) sólo para el día en curso.
- Creativos: `GET /act_X/ads?fields=creative{thumbnail_url,body,title,object_story_spec}` una vez por anuncio nuevo.
- Google Ads: mismo esquema con la Google Ads API (requiere developer token aprobado + OAuth).

### 5.4 Atribución de verdad (lead ← anuncio)

1. **Capturar el click id en la landing**: `fbclid`, `gclid`, `wbraid`/`gbraid`, y guardar `utm_content = <ad_id>` desde el URL builder.
2. **Persistir first-touch y last-touch** en cookie propia (hoy `tracker.ts` relee la URL en cada pageview: una segunda visita sin UTM pisa la atribución).
3. **Escribir `lead_touches` al crear el lead**, uniendo por `visitor_id` — hoy la UTM ni llega al lead.
4. **Match por `ad_id`, no por nombre**. El nombre queda como fallback.
5. **Filtrar por pipeline/objetivo** en toda la pantalla.

Con eso, la tabla deja de ser "gasto vs. leads que Meta dice" y pasa a ser **gasto vs. captaciones reales del CRM, por anuncio**.

### 5.5 Devolver data a las plataformas

Acá está el valor que ninguna herramienta de reporting da:

- **Meta CAPI con click id**: mandar `fbc`/`fbp` además del email/teléfono hasheado sube muchísimo el match quality y permite atribución a nivel anuncio.
- **Conversiones de etapa profunda**: hoy los mapeos ya existen (`captado → SubmitApplication`, `escriturada → Purchase`). Lo que falta es que lleguen con `value` real (precio de la operación) en lugar de `currency:'USD'` fijo — así Meta optimiza por valor.
- **Google Ads Offline Conversion Import**: subir `gclid + conversion_action + value` cuando el lead avanza. Es el equivalente Google de lo anterior y hoy no existe nada.
- **Lead Ads webhook** (`leadgen`): que el formulario nativo de Meta entre solo al CRM, con el `lead_id` de Meta guardado → atribución perfecta sin click id.
- **Audiencias reales**: reemplazar los botones muertos por push a Custom Audiences (Meta) / Customer Match (Google) con los segmentos que ya calcula el CRM: calificados sin cerrar, captados (semilla de lookalike), perdidos por precio.

### 5.6 Las dos secciones — Captación y Demanda

Decisión tomada (03-sep-2026): `/marketing` se parte en **dos vistas hermanas**, misma anatomía, distinta fuente de gasto y distinto resultado. Se pautea para vendedores y para compradores, y las dos cosas se miden — lo que no se hace es sumarlas en el mismo gráfico.

| | Captación (vendedores) | Demanda (compradores) |
|---|---|---|
| Gasto | Meta Ads + Google Ads (API) | Meta + Google **y portales, cargados a mano** |
| Leads | pipeline vendedor | pipeline comprador (ya entran etiquetados por portal desde KiteProp) |
| Costo | costo por lead → **costo por captación** | costo por lead → **costo por visita / oferta** |
| Retorno | honorarios de esa captación cuando se vende | honorarios de la operación donde cerró ese comprador |

#### Gasto de portales — la pieza nueva

Los portales no tienen API de facturación, así que el gasto se carga a mano. Es poco trabajo — una vez por mes, tres o cuatro filas — y desbloquea una métrica que hoy no tiene nadie:

```
portal_spend   id, org_id, provider('zonaprop'|'argenprop'|'mercadolibre'|'otro'),
               provider_label, period_month ('2026-09'), amount, currency,
               fx_to_usd, plan_notes, created_by, created_at
```

Cruzado con los leads comprador que ya llegan con `source` = portal:

- **Costo por lead de portal** = gasto del mes ÷ leads comprador de ese portal en el mes.
- **Costo por visita** = gasto ÷ leads que llegaron a `visita_agendada`.
- **ROI** = honorarios de las operaciones cerradas con compradores de ese portal ÷ gasto.

Y por primera vez se puede poner en la misma tabla: *ZonaProp me sale $X el lead, Meta me sale $Y, y los de Meta convierten el doble*. Hoy esa decisión de plata se toma a ojo.

⚠️ **Moneda**: los portales facturan en pesos, la pauta puede estar en pesos o dólares, y los honorarios son en dólares. Hay que guardar siempre `amount` + `currency` + `fx_to_usd` de la fecha de carga y dejar que la org elija en qué moneda mira el reporte. Sin eso el ROI mezcla peras con manzanas, y en Argentina eso se nota en un mes.

### 5.7 Ingresos — el número que cierra el ROI

Hoy el CRM sabe cuánto salió la propiedad, no cuánto entró a la inmobiliaria:

- `properties.sold_price` y `sold_date` existen. **No hay honorarios.**
- `reservations` tiene `offer_amount`. **No hay comisión.**
- `honorarios_pct` sólo vive dentro del bloque `work_conditions` de la tasación — el 3% que se le prometió al propietario. Es el mejor default posible y no se usa para nada más.

**Y hay un corte peor**: `reservations` no tiene `property_id`, ni `lead_id`, ni `contact_id`. Guarda `property_address`, `buyer_name` y `seller_name` como **texto libre** (`000_initial.sql:168-182`, sin ningún `ALTER` posterior). La cadena *anuncio → lead → captación → reserva → venta* **se corta justo en el último eslabón**, y ninguna cantidad de tracking de pauta lo va a arreglar.

Propuesta, una sola migración:

```
reservations   + property_id, + lead_id, + contact_id           ← reconecta la cadena
               + commission_pct, + commission_amount,
               + commission_currency, + fx_to_usd
properties     + commission_amount_usd, + income_at             ← ventas sin reserva cargada
```

- `commission_pct` se prefillea con el `honorarios_pct` de la tasación de esa propiedad; el agente lo confirma o corrige.
- El momento natural de carga es el pase de la reserva a **escriturada**: es un campo más en un formulario que ya se abre.
- Salen solas tres métricas que hoy no existen: **ingreso por captación**, **ROI por campaña** y **ROI por portal**.

Además, este es el número que hay que mandarle a Meta y a Google como `value` de la conversión (decisión 5): con honorarios reales, las plataformas optimizan por plata y no por volumen de formularios.

### 5.8 La pantalla

Tres vistas por sección (Captación y Demanda comparten anatomía):

**a) Resumen** — el reporte en vivo
- Selector de rango con **comparación contra el período anterior** en todos los KPIs (esto arregla los hallazgos 3, 5 y 6 de una).
- Fila de KPIs: Gasto · Leads · CPL · **Captaciones · Costo por captación** · ROI cuando haya reserva.
- Serie temporal gasto vs. leads vs. captaciones (ya se puede con `ad_daily_metrics`).
- Bloque de alertas operativas, que es lo que reemplaza al empleado: *"Campaña X gastó $Y sin un solo lead en 5 días"*, *"El CPL de Z subió 60% vs. la semana pasada"*, *"3 leads de la campaña W sin contactar hace 48h"*.

**b) Campañas → Ad sets → Anuncios** — drill-down
- Tabla jerárquica con las métricas de plataforma **y** las del CRM en las mismas filas.
- En el nivel anuncio: **miniatura del creativo, copy y link al post**. Ranking de creativos por costo por captación, no por CPL.
- Toggle de objetivo (captación / demanda) por campaña, guardado en `ad_campaigns.vp_goal`.

**c) Calidad de leads por anuncio**
- Del anuncio al resultado: leads → contactados → calificados → tasación → captados, con el % de cada paso.
- Es la vista que justifica el precio del módulo: dos campañas con el mismo CPL y una trae el triple de captaciones.

---

## 6. Plan por fases

Orden revisado tras las decisiones del 03-sep: **lo que da ROI primero, la maquinaria de ads después**. Es al revés de lo intuitivo, pero F1 no depende de ninguna aprobación de plataforma y produce el número que vende el módulo.

| Fase | Qué entra | Tamaño | Por qué en ese orden |
|---|---|---|---|
| **F0 — Que lo que se ve sea cierto, y partido en dos** | Filtro por pipeline en todas las queries · **partir en Captación y Demanda** · un solo total · CPL con denominador declarado · sacar flechas y sparklines falsos · períodos consistentes + comparación con el anterior · bug `org_id`/`agent_id` · sacar o implementar los botones muertos · GTM en `/l/` y `<GtmScript>` con props en `/t/` | S | Es corrección, no feature. El filtro por pipeline ya es el 80% del trabajo de partir la sección en dos. Mientras el panel muestre dos totales distintos, nada de lo que se construya arriba va a ser creíble. |
| **F1 — Portales e ingresos** | Tabla `portal_spend` + ABM mensual · migración que reconecta `reservations` (property/lead/contact) · honorarios en la reserva y en la propiedad · costo por lead y ROI por canal, con portales y pauta en la misma tabla | M | **No depende de ninguna API ni de ninguna aprobación.** Es la fase más barata y la que produce el número que justifica el módulo. Además desbloquea el `value` real de las conversiones que necesita F4. |
| **F2 — Histórico y anuncios** | Tablas `ad_*` · cron diario con re-escritura de 7 días · `level=ad` + creativos · Resumen con serie temporal · drill-down campaña → ad set → anuncio · selector de cuenta publicitaria | L | Base del reporte en vivo: sin histórico no hay comparación, sin nivel anuncio no hay creativos. Acá se estrena el modelo de `ad_accounts` de la decisión 2. |
| **F3 — Atribución real** | Captura de click ids + first/last touch · `lead_touches` · match por `ad_id` · calidad de leads por anuncio · costo por captación por anuncio | M | Depende de F2: necesita el `ad_id` del lado de la pauta para tener contra qué unir. |
| **F4 — Devolver data** | CAPI con `fbc`/`fbp` y `value` = honorarios · webhook de Lead Ads · Google Ads: OAuth + pull + Offline Conversions · push de audiencias | L | Depende de F1 (el valor) y de F3 (el click id). Acá aparece Google Ads. |
| **F5 — Acción y automatización** | Pausar/activar y ajustar presupuesto desde el panel · alertas por WhatsApp/email · reporte mensual PDF automático | M | Recién con la data confiable tiene sentido dejar que el panel toque la pauta. |

F0 y F1 son independientes de todo lo demás y se pueden hacer ya. **Los trámites de plataforma (Business Verification + App Review de Meta, developer token de Google Ads) se arrancan al mismo tiempo que F1**, no cuando empieza la fase que los necesita: tardan semanas y son el único camino crítico que no depende de nosotros.

---

## 7. Decisiones tomadas — 03-sep-2026

| # | Decisión | Qué implica |
|---|---|---|
| 1 | **Conexión con las plataformas: el camino más simple que aprueben.** | **Meta**: una sola app de VendéPro con *Facebook Login for Business*, Business Verification y App Review de `ads_read` (sumar `leads_retrieval` si se quiere ingesta de Lead Ads; `ads_management` recién en F5, cuando se quiera pausar desde el panel). Es un click para el cliente y es el camino que Meta aprueba para una herramienta de este tipo. **Mientras tanto se deja el token de system user que ya funciona como fallback**: no requiere aprobación de nadie y sirve para los primeros clientes. **Google Ads**: hace falta cuenta MCC + developer token con Basic Access (formulario y demo del producto); el OAuth por usuario ya tiene precedente en el repo con Google Calendar. Los dos trámites tardan semanas: se arrancan en F1. |
| 2 | ~~**Las cuentas publicitarias son varias por org**: la inmobiliaria tiene la suya y cada agente puede conectar la propia.~~ **Revisada el 08-sep — ver decisión 7.** | Tabla `ad_accounts` con `org_id` + `owner_user_id` (`NULL` = de la agencia). Admin ve todas con un selector arriba; el agente ve la de la agencia y la suya. Reemplaza el modelo actual de una fila por agente en `meta_integration`, y de paso mata los hallazgos 14 y 15. |
| 3 | **Los portales no se esconden: se mudan a la sección Compradores**, con su gasto cargado a mano (§ 5.6). | Deja de haber portales compitiendo contra Meta en el gráfico de canales de captación, y aparece la métrica que hoy no existe: cuánto cuesta un lead de ZonaProp. |
| 4 | **Sí se pautea demanda.** Dos secciones hermanas, Captación y Demanda. | `vp_goal` por campaña y dos embudos. Es parte del alcance de F0. |
| 5 | **El valor de conversión son los honorarios**, cargados cuando se vende. | Se resuelve con la migración de ingresos (§ 5.7) y habilita que Meta y Google optimicen por plata. |

| 6 | **El tipo de cambio se busca solo**, referencia dólar Argentina, y se congela con la fila. | Cada importe guarda `amount` + `currency` + `fx_to_usd` + `fx_at`. El valor se resuelve al cargar y no se recalcula: un gasto de julio tiene que seguir valiendo lo que valía en julio. ⚠️ **dolarhoy.com no expone API pública** — leer su HTML desde un Worker es frágil y bloqueable. La misma cotización sale en JSON de `dolarapi.com/v1/dolares/blue` (o `api.bluelytics.com.ar`), que es lo que conviene consumir, dejando "DolarHoy" como el nombre de referencia que se muestra. Fallback si la API no responde: se guarda la fila con `fx_to_usd = null` y se marca para completar a mano, nunca se inventa un número. |

| 7 | **Todo el marketing es POR USUARIO** *(08-sep, revisa la decisión 2)*. Cada agente maneja su propio presupuesto y sus propias cuentas publicitarias, y el panel le cruza SU gasto contra SUS leads y SUS captaciones. | Migración 054: `portal_spend` gana dueño y su unicidad pasa a ser por (org, dueño, portal, mes) — dos agentes pueden cargar su ZonaProp del mismo mes sin pisarse. Se cae el candado de admin para cargar gasto y clasificar campañas: cada uno administra lo suyo. Admin y owner siguen viendo la inmobiliaria entera, con el mismo criterio que ya usaba el log de eventos. Deja de haber cuentas publicitarias "de la agencia": si la inmobiliaria tiene una común, la conecta quien la administra. |

### Lo que queda abierto

- ~~**Quién carga el gasto de portales.**~~ Resuelto por la decisión 7: lo carga cada agente, el suyo.

- 🔴 **Quién puede VER la plata.** *(planteado el 08-sep-2026 — resolver antes de vender el módulo)*

  Hoy la visibilidad del dinero no está restringida: **cualquier agente de una org con el módulo `publicidad` ve honorarios y ROI** en la pestaña Demanda, y los honorarios cobrados en la ficha de cualquier propiedad vendida. Lo único que hoy pide admin/owner es *escribir* (cargar gasto de portales, etiquetar campañas), no *leer*.

  Es una exposición real: en una inmobiliaria, cuánto factura la agencia por operación no es información de todo el equipo.

  ⚠️ **Achicado por la decisión 7 (marketing por usuario, 08-sep)**: ahora cada agente ve su propia plata, no la de los demás. Lo que queda del problema es más chico — el admin ve la de todos, y un agente sigue viendo los honorarios de sus propias operaciones en la ficha de la propiedad.

  **Alcance a cubrir** (lo que sale sin filtro de rol):
  - `/marketing` → Demanda: columnas Honorarios y ROI, y el total del pie
  - `/marketing` → Captación: gasto por campaña y CPL
  - Ficha de propiedad → `IncomeWidget` (honorarios cobrados)

  **Opciones sobre la mesa**, de menor a mayor:
  1. **Tapón inmediato** (≈10 min): esconder las columnas y la tarjeta de plata a quien no sea `admin`/`owner`, con el mismo chequeo de rol que ya usa la escritura. No resuelve el caso intermedio, pero corta la exposición.
  2. **Rol nuevo** (ej. `asistente` o un permiso `ver_finanzas`): hoy el rol vive sólo en `users.role` — no hay tabla de permisos (ver [[Dominio-Usuarios-Org]]). Sumar un permiso granular es la solución de fondo y toca auth, middleware y UI.
  3. **Código/PIN para revelar**: idea del usuario. Sirve para "que lo vea alguien puntual sin darle el rol", pero es una barrera de UI, no de seguridad — la API sigue devolviendo el dato. Si se hace, el filtro tiene que estar igual en el backend.

  ⚠️ **Que el filtro vaya en el backend, no sólo en la UI.** El gating de módulos ya arrastra este problema — está documentado como "barrera de producto, no de seguridad" en [[Roadmap-estado-implementacion]]. Esconder columnas en el front deja el número saliendo por la API igual.

---

## 8. Qué conviene NO hacer

- **No sumar más tarjetas al panel actual.** El problema no es que falte información: es que la que hay no es confiable ni comparable.
- **No usar GA4 como sustituto de Google Ads.** Measurement Protocol alimenta analítica, no al optimizador de la pauta.
- **No seguir atribuyendo por nombre de campaña.** Es frágil por diseño: renombrar una campaña en Ads Manager rompe el histórico en silencio.
- **No construir el reporte mensual (Feature 03) antes de F1.** Un PDF automático que reparte números que no cierran multiplica el problema en vez de resolverlo.

---

## 9. Qué cambió en F0 — implementado el 03-sep-2026

Las secciones 1 a 4 describen el estado **anterior** a este trabajo, que es el punto de partida del diagnóstico. Esto es lo que ya está en código:

**Backend**

- `domain/value-objects/marketing-period.ts` (nuevo): los tres períodos pasan a ser de calendario hasta hoy, y el período anterior es **la misma cantidad de días transcurridos** contada desde el arranque del anterior — comparar 3 días de septiembre contra los 30 de agosto daba siempre una caída. Los límites son fechas `YYYY-MM-DD` porque `created_at` convive en dos formatos y sólo la comparación por día ordena bien en los dos. 16 tests.
- `domain/rules/lead-rules.ts`: `computeFunnelForPipeline` y `computeConversionRateForPipeline` — embudo y etapa-objetivo por pipeline (`captado` para vendedor, `cerrado` para comprador). La conversión conserva un decimal: el entero anterior escondía movimientos en bases chicas. 10 tests nuevos.
- `GET /marketing`: toma `pipeline`, y **todas** las series se filtran por el mismo (antes el embudo era vendedor y las fuentes traían todo). Devuelve `totals`, `previous`, `deltas` y el rango de las dos ventanas. La integración se lee por `agent_id` y no por `org_id` — que era el bug 15.
- `GET /marketing/campaigns`: toma `pipeline`, y el CPL sale partido en `cpl_crm` y `cpl_meta`, cada uno con su base declarada.
- `GetPublicTagConfigUseCase` (nuevo) + `tag` en las tres respuestas públicas (`/l/:slug`, `/public/property-visit-form/:slug`, `/public/appraisal/:slug`): el contenedor de GTM del agente dueño de la página. Es lo único de `meta_integration` que sale sin auth — el ID de contenedor termina igual en el HTML; los tokens no salen.

**Frontend**

- `/marketing`: dos tabs, **Captación** y **Demanda**, que cambian el pipeline de todo lo que se muestra.
- KPIs con variación real contra el período anterior. La conversión se compara **en puntos**, no en variación porcentual: "la conversión subió 50%" cuando pasa de 2% a 3% no le dice nada a nadie.
- Se fueron el sparkline falso de conversión y las flechas contra umbral fijo.
- Los leads de landing se leen (`Landing · <slug>`) en vez de salir como texto crudo gris.
- La tabla de campañas pasa a la `Table` del DS, con `CPL (CRM)` y `CPL (Meta)` en columnas separadas. Se listan sólo en Captación, porque las campañas todavía no guardan objetivo comercial y mostrarlas en las dos contaría el mismo gasto dos veces.
- Se retiró la tarjeta "Audiencias sugeridas": los cuatro botones no hacían nada. Vuelve en F4 con export real.
- GTM montado en `/l/[slug]` con el contenedor del agente, y con props reales en `/t/` y `/v/`.
- 11 tests de la pantalla (`marketing/__tests__/page.test.tsx`).

**Lo que F0 no toca**: sigue sin haber histórico, nivel anuncio, click ids ni ingresos.

---

## 10. Qué cambió en F1a — gasto de portales, 07-sep-2026

La mitad de F1 que responde "cuánto me sale un lead de ZonaProp". Sin dependencias de ninguna API ni aprobación de plataforma.

**Migración `050_portal_spend.sql`** — ⚠️ pendiente de aplicar (va por CI, nunca desde la terminal).

**Dominio**

- `PortalSpend` (entidad): valida período `YYYY-MM`, importe, moneda, y congela la cotización con la fila. En USD la conversión es la identidad y no se sale a buscar nada.
- `portal-cost-rules.ts`: el cruce gasto ↔ leads, con cuatro decisiones que valen más que el cálculo:
  1. **El gasto mensual se prorratea por los días del rango.** La factura del portal es de 30 días pero el panel muestra "mes a hoy": el día 7, comparar la factura entera contra una semana de leads daría un costo por lead 4 veces más alto del real.
  2. **La tabla muestra las dos mitades sueltas** — el portal con leads y sin gasto cargado, y el gasto cargado que no trajo un solo lead — cada uno con el motivo. Esconderlos deja al usuario creyendo que la foto está completa.
  3. **Sin cotización no hay costo**: la celda queda vacía con el motivo, no se convierte con un número inventado.
  4. **Lo que no se pudo convertir no suma al total**, y se dice cuántas filas quedaron afuera.
  45 tests entre las reglas y la entidad.

**Backend**

- `D1PortalSpendRepository` (upsert por org + portal + mes: recargar septiembre corrige la fila, no la duplica) y `D1PortalLeadCountRepository` (leads comprador por fuente, con las etapas que implican visita).
- `DolarApiFxRate`: cotización del dólar blue desde dolarapi.com — ver [[Servicios-externos]] para por qué no se scrapea DolarHoy.
- Use cases `ListPortalSpend` / `SavePortalSpend` / `DeletePortalSpend` / `GetPortalCosts`.
- Rutas en [[API-crm]] (escribir es admin/owner) y `portalCosts` dentro de `GET /marketing?pipeline=comprador`.

**Frontend**

- `PortalCosts.tsx` en la sección Demanda: tabla con gasto, leads, **costo por lead**, visitas, costo por visita y cerrados por portal, más el ABM del gasto mensual. Cuando falta algo, la celda dice qué falta en vez de mostrar un guión mudo. 9 tests.

**F1 cerrada** con los ingresos: ver § 12.

---

## 11. Separación de campañas por objetivo — 08-sep-2026

Quedaba un agujero: las campañas de Meta se listaban sólo en Captación, porque nada decía a qué objetivo comercial apuntaban. Resuelto con **una etiqueta manual por campaña** (migración `051_campaign_goals.sql`).

**Por qué no se puede deducir sola:**

- El `objective` de Meta (OUTCOME_LEADS, OUTCOME_TRAFFIC…) dice **cómo optimiza**, no para qué la usa la inmobiliaria: buscar propietarios y vender un departamento son las dos campañas de leads.
- Una convención de nombre ("CAP - …") repetiría el hallazgo 8: alguien renombra en Ads Manager y se rompe en silencio.
- Deducirlo del pipeline de los leads que trajo es circular — sin atribución no se sabe qué leads trajo, y la atribución es justo lo que falta arreglar.

**Las tres decisiones que la sostienen:**

1. **Se guarda contra el `campaign_id`, no contra el nombre.** Renombrar no la rompe, sobrevive a duplicar la campaña, y no depende de que nadie respete una convención de tipeo.
2. **Granularidad campaña.** Una campaña rara vez mezcla los dos objetivos y es un orden de magnitud menos de clicks que etiquetar ad sets. Si hiciera falta, se agrega `ad_set_id` con default NULL y la fila actual pasa a significar "toda la campaña".
3. **Sin etiqueta = sin clasificar, y no cuenta en ninguna de las dos secciones.** Repartirla en las dos duplicaría el gasto y dejaría el costo por captación a la mitad del real. Va a una bandeja aparte con el gasto suelto a la vista — fricción a propósito, para que se note que falta.

Cuando llegue el nivel anuncio (F2) esto se autocompleta: bajando el creativo viene el link de destino, así que el default sale del destino del anuncio (landing de tasación → captación; landing de propiedad o WhatsApp del aviso → demanda) y la etiqueta manual queda como override.

**También en esta tanda**: `HowItWorks.tsx`, un bloque colapsable al pie del panel que explica de dónde sale cada número — el prorrateo, las dos bases del CPL, el período comparado, el dólar congelado. Es distinto por sección porque las dos mitades se calculan distinto. Existe porque varios números de la pantalla son el resultado de una decisión de cálculo que no se adivina mirándolos: sin la explicación, o el usuario desconfía del panel o —peor— confía en un número que no significa lo que cree.

⚠️ **Falta aplicar las migraciones 050 y 051** (van por CI).

---

## 12. Ingresos y ROI — 08-sep-2026

La mitad que cierra F1: cuánto cobró la inmobiliaria por cada operación, y si el canal que la trajo se pagó solo.

### La corrección que apareció al implementarlo

El análisis original (§ 5.7) decía que la cadena se cortaba en `reservations` y proponía una migración para reconectarla. **Al ir a hacerlo apareció que el producto no usa `reservations` en absoluto**: ninguna pantalla la consume y la de "Reservas" en realidad lista propiedades en etapa reservada. La cadena real ya estaba completa por otro lado:

- `properties.lead_id` → el lead de captación que originó la propiedad (migración 004)
- `lead_properties` → el lead comprador que la compró (migración 039)

Así que el ingreso va en `properties` (migración `052_property_income.sql`) y `reservations` se deja como está. Terminó siendo bastante menos trabajo del presupuestado, y sin tocar una tabla muerta.

### Reglas de plata (`property-income-rules.ts`, 14 tests)

- **Sin gasto cargado el ROI es `null`, no 0%.** Mostrar cero haría parecer malo un canal al que sólo le falta el dato.
- **Los cierres sin fuente atribuida no se reparten ni se descartan**: van a un renglón aparte. Repartirlos inflaría el ROI de todos los canales; esconderlos haría que la tabla no sume el total real de lo que entró.
- La cotización de los honorarios viaja congelada, igual que en el gasto de portales.

### Atribución

- **Demanda** → el lead comprador **cerrado más antiguo** de esa propiedad (`LIMIT 1` explícito en la query: sin eso, una propiedad con dos compradores marcados como cerrados sumaría los honorarios dos veces y el ROI del portal saldría al doble).
- **Captación** → el `source_detail` del lead que originó la propiedad, contra el nombre de campaña. Es el mismo match frágil del resto de la tabla, mantenido a propósito: dos criterios distintos de atribución en la misma pantalla sería peor.

### Moneda en el ROI de campañas

El gasto de Meta viene en la moneda de la cuenta publicitaria y los honorarios en dólares. Si la cuenta no es en USD se convierte el gasto con el dólar del día; si no se consigue la cotización, el ROI queda en `null` con el motivo "Sin conversión" en vez de dividir pesos por dólares.

### Dónde se carga

`IncomeWidget` en la ficha de la propiedad, visible sólo cuando la operación está vendida. `PUT /properties/:id/income` — va aparte del cambio de etapa a propósito: corregir los honorarios no tiene por qué volver a disparar la máquina de estados ni el historial.

**Pendiente**: el honorario sugerido a partir del `honorarios_pct` de la tasación. La UI está lista pero la API de propiedades no expone ese dato todavía (vive dentro del bloque de condiciones del template).

⚠️ **Falta aplicar la migración 052** (va por CI).

---

## Relacionado

- [[Roadmap-estado-implementacion]] — auditoría general del código (Features 01, 02, 04, 05 son los que toca este análisis)
- [[Roadmap-producto]] — Feature 01 (dashboard + creativos), 02 (UTM multi-touch), 04 (conversiones Google Ads), 05 (CAPI depurado, vendedor/comprador)
- [[Dominio-Marketing]] · [[Dominio-Leads]] · [[Dominio-Landings]] · [[API-analytics]]
