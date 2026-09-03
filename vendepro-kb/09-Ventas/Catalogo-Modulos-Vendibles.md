# 📦 Catálogo de módulos vendibles

> Traduce [[Roadmap-producto]] (13 features en 3 prioridades, más "el moat") a lenguaje de venta: qué le resuelve cada módulo al cliente, y en qué estado real está según [[Roadmap-estado-implementacion]]. Es el material para conversaciones más profundas — con un prospecto que ya mostró interés, o para decidir qué mencionar según lo que le importa a cada segmento de [[Estrategia-Comercial]].

La regla del propio roadmap de producto aplica acá tal cual: *"no se construye nada que no tenga cliente pidiéndolo. Este doc sirve para saber, cuando un cliente lo pida, cuánto cuesta."* Por eso este catálogo no es una lista de features a esconder o a mostrar de golpe — es el menú del que se va sacando lo que cada conversación de venta valida como demanda real (ver [[Estrategia-Comercial]] §1.1 "Filosofía: vender la visión, construir con demanda real").

**Antes de usar este catálogo, un bloqueo real a tener siempre presente**: el propio roadmap marca "Planes y billing" como la pregunta técnica número 1, con impacto **"🔴 bloqueante para vender"** — hoy no hay cobro implementado (ver [[Estrategia-Comercial]] §6). Este catálogo sirve para vender la *visión* y capturar demanda, no para cerrar un contrato pago todavía.

## Módulo A — Marketing con ROI real (Prioridad 1: el primer módulo que se cobra)

*Pitch marco: "Este es el módulo que se paga. Es donde se le prueba a la inmobiliaria si sus campañas dan plata de verdad, y donde vive el diferencial más fuerte de VendéPro: la red de cierres reales."*

| Feature | Qué le resuelve al cliente (pitch) | Estado real | Cómo venderla hoy |
|---|---|---|---|
| Dashboard de atribución por campaña + ranking de creativos | "Vista única de cuánto gastás por campaña, qué conversión tiene hasta la reserva o la venta, y qué foto/video/copy te trae los mejores leads." | 🟡 El dashboard con campañas de Meta, CPL y leads por fuente ya está en producción. Falta histórico, nivel de creativo y Google Ads. | Demostrable hoy en una demo real (la parte de Meta). El ranking de creativos y Google Ads, como visión. |
| UTM tracking y atribución multi-touch | "Cada lead guarda de dónde vino realmente — el historial completo hasta la venta, no un texto suelto." | 🟠 Solo base — hoy la UTM se pierde al crear el lead. | Visión — explica por qué el dashboard de atribución va a mejorar. |
| Reportes automáticos mensuales al cliente | "Un PDF mensual armado solo, con leads, conversión, ROI por campaña y ventas, con tu marca — para mandarle al dueño o mostrar en una reunión." | 🔴 No existe, pero la infraestructura de PDF ya existe (se reusa la de tasaciones) — candidato barato de construir si hay demanda. | Visión — buen candidato a preguntar "¿esto te ahorraría armar el informe a mano?" |
| Conversiones custom a Meta y Google Ads | "Definís qué paso del embudo es una conversión de verdad (ej. reserva firmada) y Meta/Google optimizan la pauta contra eso, no contra el clic." | 🔴 No existe (Meta CAPI ya envía eventos básicos, pero no personalizables por etapa; Google Ads, cero código). | Visión. |
| CAPI depurado + integración con CRMs externos (Tokko, etc.) | "Los leads de portales se etiquetan solos como vendedor o comprador — y podés seguir usando tu sistema actual mientras VendéPro ingesta los leads." | 🟡 KiteProp ya en producción. Tokko no existe. | KiteProp: vendible hoy. Tokko: visión — clave para Segmento 2. |
| Red compartida de cierres reales — **el moat** | Ver [[Estrategia-Comercial]] §4 y [[Guion-Venta-Segmento2-ConCRM]] — es el gancho principal de la estrategia. | 🟠 Solo el flag `shared_with_network` en `sold_properties`. | Visión activa — es el gancho más fuerte, no ocultarlo. |

## Módulo B — Ejecución de marketing (Prioridad 2)

*Pitch marco: "Una vez que medís bien tu marketing, el siguiente paso es ejecutarlo sin salir del sistema."*

| Feature | Qué le resuelve al cliente (pitch) | Estado real | Cómo venderla hoy |
|---|---|---|---|
| Landings por agente | "Una mini-página profesional por agente — foto, bio, propiedades activas, formulario de contacto — para la bio de Instagram o WhatsApp." | 🔴 El motor de landings ya está en producción (ver [[Dominio-Landings]]); falta el template de perfil de agente. | Visión, pero de bajo esfuerzo relativo (se apoya en algo que ya existe). |
| Landings por propiedad con link listo para pautar | "Landing individual por propiedad con galería y UTMs pre-armados para pautar directo." | 🔴 Mismo motor en producción; falta vincularla a la propiedad real. | Visión. |
| Automatizaciones de email (bienvenida, nurture, follow-up) | "Mail de bienvenida automático a cada lead nuevo, y seguimiento según en qué etapa está — armado con ayuda de IA." | 🟡 Bienvenida y nurture por etapa **ya se disparan en producción**. Follow-up por inactividad todavía no corre (falta el barrido cron). | Bienvenida y nurture: prometé con toda confianza. Follow-up: "lo estamos terminando de conectar." |
| Agente conversacional de IA (WhatsApp + Instagram + Messenger) | Ver [[Guion-Venta-Segmento1-SinCRM]] y [[Guion-Venta-Segmento2-ConCRM]], sección "Vendiendo la visión". | 🔴 Cero código — 100% visión. | Visión activa, con pregunta de validación (¿lo pagarías? ¿cuánto te ahorraría?). |
| Asistente de IA interno al CRM | "Preguntale al sistema '¿cuántos leads sin contactar tengo?' y te responde, sugiere qué decir, genera copy." | 🟠 La extracción de datos por IA (de WhatsApp, imágenes, ver [[API-ai]]) **ya está en producción** — el chat conversacional no existe. | Mostrá la extracción de datos ya funcionando como prueba de que el equipo ya sabe meter IA en el producto; el chat, como visión. |

## Módulo C — Ecosistema (Prioridad 3, largo plazo — no vender activamente todavía)

Requieren una base de clientes activa (12+ meses) y trabajo comercial fuera del código — el propio [[Roadmap-producto]] dice "se planifican, no se codean todavía". Mencionar solo si un prospecto pregunta específicamente "¿qué más viene a futuro?", para mostrar visión de largo plazo, nunca como parte del pitch principal.

- **Marketplace de servicios integrado** (fotógrafo, drone, home staging, tasador) — 🔴
- **Academia integrada** — curso + comunidad — 🔴

## Cómo usar este catálogo en una conversación de venta

1. El pitch base de cada guión ya cubre lo esencial — este catálogo es para cuando el prospecto pregunta específicamente por algo más, o cuando la conversación deriva hacia "¿qué más tienen pensado?".
2. Nunca ofrecer un ítem 🔴 o 🟠 como si ya funcionara — siempre "estamos construyendo esto" (ver [[Estrategia-Comercial]] §1.1).
3. Cuando un módulo genera interés real, es la señal que decide qué se prioriza — anotarlo ([[Estrategia-Comercial]] §9).
4. El orden de prioridad (A → B → C) ya está decidido por el equipo de producto; solo se reordena dentro de cada módulo según lo que pidan los primeros clientes pagos.

## Relacionado

- [[Roadmap-producto]] — fuente de este catálogo, con el detalle técnico de qué implica cada feature
- [[Roadmap-estado-implementacion]] — estado real en código, feature por feature
- [[Estrategia-Comercial]] — dónde se usa este catálogo dentro de la estrategia comercial completa
- [[Guion-Venta-Segmento1-SinCRM]] · [[Guion-Venta-Segmento2-ConCRM]]
- [[Dominio-Marketing]] · [[Dominio-Landings]] · [[Dominio-Tasaciones]]
