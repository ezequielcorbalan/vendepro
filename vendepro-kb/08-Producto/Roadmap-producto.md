# 🧭 Roadmap de producto — VendéPro

> **Fuente**: artifact "VendéPro Roadmap" (v1 · borrador, preparado por Gastón, para revisión del dev lead) — cargado al KB el 2026-08-29.
> **Estado de review**: pendiente — cada feature debe marcarse como `Viable / Complejo / Bloqueante / Duda / Ya está`.
> **Estado de implementación en código**: ver [[Roadmap-estado-implementacion]].

---

## El pivote

**El CRM base pasa a ser gratuito.** Lo que se cobra es el **módulo de marketing** — todo lo que ayuda a la inmobiliaria a medir campañas, ver qué anuncios convierten, atribuir ventas, ejecutar contenido, responder consultas con IA, y — el pilar diferencial — acceder a la **red compartida de cierres reales** para tasar mejor.

**Regla**: no se construye nada que no tenga cliente pidiéndolo. Este doc sirve para saber, cuando un cliente lo pida, cuánto cuesta. El orden final se decide después del review de viabilidad.

---

## 00 · Base — lo que ya está en producción

Piezas que hoy funcionan y no requieren desarrollo nuevo; son el apoyo de los features siguientes.

| Pieza | Estado según roadmap | Nota |
|---|---|---|
| **CRM operacional** — pipeline de leads, contactos, calendario | ✅ Ya está | El corazón que queda gratis: leads con etapas, historial, agenda, contactos, tags, actividad. Puerta de entrada al ecosistema. |
| **Meta CAPI + GA4 server-side vía Stape** | ⚠️ Requiere pulir | Cada avance del pipeline dispara conversiones a Meta y GA4 desde el servidor. Multi-tenant, `event_id` compartido con el Pixel. Pendiente: hardcodes que no capturan bien (source de portales, dedup de UTMs, mapeo de custom data) → ver feature 05. |
| **Tasaciones + landings públicas + carga manual de cierres** | 🟢 Base gratuita | Tasaciones con URL pública, reportes por propiedad, landings de agente, base de propiedades vendidas cargable a mano. Queda en el plan gratis. Pendiente: terminar la página de tasaciones (algunos bloques + preview de imágenes). La red compartida entre inmobiliarias va como feature paga → ver 06. |

---

## 01 · Prio 1 — el módulo de marketing pagable

Lo primero que se cobra: probarle a la inmobiliaria que sus campañas dan plata (o no), más lo que no consigue en ningún otro CRM (la red de cierres). Pitch mínimo para cerrar los primeros clientes pagos.

### Feature 01 — Dashboard de atribución por campaña + análisis de creativos
Vista única: leads por campaña, CPL, conversion rate hasta captación/reserva/venta, ROI por canal, y **ranking de creativos ganadores** (qué video/imagen/copy trajo los mejores leads).

- **Qué hace para el cliente**: gasto vs. leads por campaña · conversión por etapa · comparación de canales (Meta/Google/orgánico/WhatsApp) · preview de creativos con métricas · ranking por conversión y CPL · "modo grabar" (shortlist de creativos ganadores para replicar en contenido) · export PDF mensual.
- **Qué implica**: pull de spend+metrics desde **Meta Marketing API + Google Ads API** · cron CF diario · tablas `ad_campaigns`, `ad_creatives`, `ad_daily_metrics` · guardar `ad_creative_id` + preview URL · match UTM (`utm_content = ad_creative_id`) con leads · query agregada (potencial Analytics Engine).

### Feature 02 — UTM tracking y atribución multi-touch
Cada lead guarda su historial de UTMs y touches; la venta se atribuye por reglas (first/last/linear).

- **Cliente**: guarda `utm_source/medium/campaign/content` automáticamente · reconstruye el customer journey en el detalle del lead · modelo de atribución configurable.
- **Implica**: tabla `lead_touches` · SDK JS que captura UTMs desde landings (cookie/localStorage) · hook en `POST /leads` que linkea touches por `visitor_id` · query de attribution model por org.

### Feature 03 — Reportes automáticos mensuales al cliente
PDF mensual con leads, conversión, ROI por campaña, tasaciones cerradas y ventas. Marca VendéPro; sirve como material de venta.

- **Cliente**: PDF por mail el día 1 · comparativa mes anterior · insight destacado (best/worst campaign) · descargable del dashboard.
- **Implica**: cron mensual → generador PDF (reusar pipeline de tasaciones / `CfBrowserRenderingService`) · templating reutilizable · envío por Emblue/SES/equivalente.

### Feature 04 — Envío de conversiones custom a Meta y Google Ads
La inmobiliaria define conversiones custom por etapa ("lead calificado", "reserva firmada") y las plataformas optimizan la pauta contra esas conversiones, no el clic.

- **Cliente**: mapea conversiones por etapa · Meta y Google reciben la conversión con valor asignable.
- **Implica**: extender `stage_event_mappings` para Google Ads Conversion Actions · nuevo port `GoogleAdsConversionsAPI` + adapter HTTP · config de `conversion_action_id` por evento · reuso del patrón multi-provider Meta/GA4.

### Feature 05 — Meta CAPI depurado + integración con CRMs externos (Tokko, etc.)
Arregla lo que hoy funciona con problemas: leads de portales (ZonaProp, MercadoLibre, ArgenProp) mezclan vendedores y compradores y hay mapeos hardcodeados. Además, permite que la inmobiliaria siga usando su CRM (Tokko Broker principalmente) e ingeste leads de portales desde ahí.

- **Cliente**: leads etiquetados solos como **vendedor/comprador** · pipeline separado captación vs. demanda · conversion events con `custom_data` correcto por tipo · import de leads desde Tokko · UI de mapeo de campos.
- **Implica**: campo `lead_kind: 'seller' | 'buyer'` con clasificador por reglas + IA fallback · refactor de `custom_data` en `SendMarketingEventUseCase` (eliminar hardcodes por portal) · módulo `lead_sources` con detección de portal por UTM/referrer/header · integración Tokko Broker (pull + mapping UI) · framework `ExternalCrmSource` para integraciones futuras · **riesgo**: limits de la API de Tokko, testear con org real.

### Feature 06 — Red compartida de cierres reales — **el moat**
Las inmobiliarias que comparten sus cierres (sin fotos: m², ambientes, tipo, dirección aproximada, precio final) acceden a los cierres de todas las demás. Al tasar, ven qué se cerró de verdad en la zona. El argumento de venta más fuerte de VendéPro.

- **Cliente**: cierres reales de la zona (6-12 meses) · filtros por m²/tipología/ambientes/distancia · precios agregados (promedio, mediana, USD/m²) · sistema de karma ("aportás X → accedés a Y") · siempre anonimizado.
- **Implica**: base ya existe (`sold_properties` con flag `shared_with_network`) · opt-in por cierre + default por org · endpoint para orgs que aportaron, con anonimización (bucket geohash, mínimo 3 registros por bucket) · tracker de karma (`network_contributions`, `network_access_grants`) · cache/materialización (query cross-org cara) · **legal**: T&C explícitos + retiro de datos con período.

---

## 02 · Prio 2 — ejecución: landings, contenido, mensajería

De "medís tu marketing" a "hacés tu marketing acá adentro". Se priorizan según demanda real de los primeros clientes de Prio 1.

### Feature 07 — Landings por agente
Mini-página profesional por agente (foto, bio, propiedades activas, form de contacto). Para bio de Instagram, WhatsApp, tarjeta digital.
- **Implica**: reuso del stack de landings · template kind `agent_profile` · slug único por agente · sync automático de propiedades activas · form que crea leads asignados al agente.

### Feature 08 — Landings por propiedad + link ads-ready
Landing individual por propiedad con galería, tour 360 y UTMs pre-armados para pautar; la landing genera leads con atribución completa.
- **Implica**: template kind `property_landing` · bloques nuevos (galería lightbox, tour 360, mapa) · UTM builder en el detalle de propiedad · QR para impresos · extender `RecordLandingEventUseCase`.

### Feature 09 — Automatizaciones simples de email marketing (estilo Emblue)
Referencia: **Emblue, no HubSpot**. Tres automatizaciones cubren el 90%: **bienvenida**, **follow-up por inactividad**, **nurture por etapa**. Templates prehechos + editor simple (variables: nombre, propiedad, agente) + open/click tracking con hook a atribución.
- **Implica**: tablas `email_automations` + `email_templates` + `email_sends` · cron que evalúa triggers · provider Emblue (validar volumen; fallback SES/Postmark) · pixel + click tracking con redirect · reuso de `fireMarketingEvent` para atribuir aperturas/clicks.

### Feature 10 — Agente conversacional IA multi-canal (WhatsApp + Instagram + Messenger)
No es un inbox: es un **vendedor IA** que responde consultas de compradores 24hs, agenda visitas y escala a humano con resumen por mail al agente. Ahorra las ~50 respuestas repetitivas por semana.
- **Cliente**: responde solo en 3 canales · conoce el stock y contesta preguntas concretas · agenda visitas leyendo el calendario · escalation configurable (precio final y negociación siempre a humano) · cada conversación linkeada al lead.
- **Implica**: WhatsApp Business Cloud API (fee por conversación + verificación) · Instagram Graph API + Messenger (aprobación business Meta) · LLM con function calling (`search_properties`, `get_availability`, `book_visit`, `escalate_to_human`) · RAG sobre propiedades + FAQ por org · tablas `conversations`, `messages`, `agent_actions` · **riesgos**: costo variable (LLM + WhatsApp), hallucinations, aprobaciones Meta lentas (2-6 semanas).

### Feature 11 — Asistente IA integrado al CRM
Chat interno: responde consultas del pipeline ("¿cuántos leads no contactados tengo?"), sugiere respuestas, genera copy, alerta leads calientes/fríos.
- **Implica**: base ya hay (`extract-lead-from-image`, `extract-lead-from-text`) · function calling contra los use cases existentes · tabla `ai_conversations` · rate limits + cost tracking por org · decidir provider (Anthropic/OpenAI/Groq/mix).

---

## 03 · Prio 3 — ecosistema alrededor del software

Requieren base de clientes activa (12+ meses) y trabajo comercial fuera del código. **Se planifican, no se codean todavía.**

### Feature 12 — Marketplace de servicios integrado
Contratar fotógrafo, video, drone, home staging virtual, tasador desde el CRM. Proveedores certificados, fee % por transacción.
- **Implica**: módulo `service_providers` + `service_orders` · pagos con split (MP marketplace / Stripe Connect) · UI dual cliente/proveedor · ratings.

### Feature 13 — Academia integrada — curso + comunidad
Videos del curso, foros, live streams, downloads dentro del CRM. Q&A con la instructora (Marcela), certificado de completado.
- **Implica**: video hosting (Bunny/Vimeo/CF Stream) · tablas `courses`, `lessons`, `enrollments`, `progress` · foro simple o Discourse embebido · gating por plan.

---

## Preguntas técnicas transversales

Decisiones de arquitectura que afectan a varios features. **Contestar antes de codear cualquiera de la Prio 1.**

| # | Pregunta | Impacto |
|---|---|---|
| 1 | **Planes y billing** — ¿Mercado Pago, Stripe, ambos según país? ¿Gating por feature o plan cerrado? | 🔴 Bloqueante para vender. Toda la Prio 1 lo necesita. |
| 2 | **Provider de email** — ¿Emblue aguanta el volumen (secuencias + reportes + notificaciones) o migrar a Postmark/SES? | Features 03 y 09. |
| 3 | **Integraciones Meta / Google Ads** — OAuth con business accounts: ¿integración directa por org o app intermediaria de VendéPro? | Features 01 y 04. |
| 4 | **Aprobaciones Meta (WA+IG+Messenger)** — ¿app-per-org o único VendéPro-app como BSP? Review Meta: 2-6 semanas por org. | Feature 10. Puede demorar go-live semanas. |
| 5 | **Costos de IA por org** — ¿fee fijo + límite, pay-per-use, o incluido en premium? El conversacional consume mucho más que el asistente interno. | Features 10 y 11. |
| 6 | **Multi-tenancy en la red compartida** — ¿alcanza el scope por `org_id` para agregar/anonimizar cross-org o hace falta capa aparte (Analytics Engine / warehouse)? Cuidado con reveal en buckets de 1-2 registros. | Feature 06. |
| 7 | **Integración con CRMs externos** — Tokko Broker: ¿API pública decente? ¿Pull, webhook o ambos? ¿Uni o bidireccional? | Feature 05. Bloqueante para inmobiliarias que ya usan Tokko. |
| 8 | **Video hosting** — Bunny vs. CF Stream: precio hora vs. egress, protección anti-download del curso. | Feature 13. |
| 9 | **Fee de marketplace** — MP marketplace vs. Stripe según país. ¿Solo AR al inicio? ¿Split automático o facturar y transferir? | Feature 12. |

---

## Numeración de referencia

El artifact numera los features de forma implícita; en este KB se usa: 01-06 (Prio 1), 07-11 (Prio 2), 12-13 (Prio 3). En el artifact original las preguntas transversales referencian: Feature 1=dashboard, 3=reportes, 4=conversiones custom, 5=CAPI+Tokko, 6=red compartida, 7=secuencias email, 08=agente conversacional, 09=asistente, 11=marketplace, 12=academia — ojo con ese offset al leer el original.

## Relacionado

- [[Roadmap-estado-implementacion]] — en qué instancia está cada proceso en el código
- [[Dominio-Marketing]] · [[Dominio-Tasaciones]] · [[Dominio-Landings]] · [[Dominio-Leads]]
- [[Servicios-externos]]
