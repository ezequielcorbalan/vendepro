# 🪪 Trámites de plataforma para el módulo de Publicidad

> Preparado el 08-sep-2026. Es el **camino crítico que no depende del código**: Meta y Google tardan semanas y no se pueden apurar. Arrancarlos ahora, aunque las fases que los necesitan estén lejos.
>
> ⚠️ Los requisitos exactos de las dos plataformas cambian seguido. Esta guía dice **qué preparar y en qué orden**; los formularios concretos hay que confirmarlos contra la documentación oficial al momento de presentar.

---

## Lo primero: ¿para vos o para vender?

La respuesta cambia todo el trámite, y conviene tenerla clara antes de empezar.

| | Sólo para Marcela Genta | Para vender a otras inmobiliarias |
|---|---|---|
| Meta App Review | **No hace falta** | Obligatorio |
| Business Verification | **No hace falta** | Obligatorio |
| Google Ads developer token | Basic access | Basic → Standard |
| Cuánto tarda | Días | **Semanas a meses** |

**Con tus propios activos podés operar sin review.** Una app de Meta en modo desarrollo accede a las cuentas publicitarias, páginas y pixels de la gente que tiene rol en esa misma app. Para el uso interno de la inmobiliaria eso alcanza y se puede empezar mañana.

El review es el precio de que **una tercera inmobiliaria conecte su cuenta**. Si el plan es vender el módulo, hay que arrancarlo ya — pero se puede desarrollar y usar todo mientras el trámite corre.

---

## Meta

### 1. Business Manager verificado

Es el prerrequisito de casi todo lo demás y lo más lento del lado burocrático, porque lo revisa una persona.

**Qué tener listo:**
- La empresa dada de alta con su CUIT y razón social exacta como figura en AFIP
- Un comprobante a nombre de esa razón social (constancia de inscripción sirve)
- Sitio web con el dominio de la empresa y un email en ese dominio
- Teléfono de la empresa alcanzable

**El error caro**: que el nombre en Meta no coincida *exactamente* con el del comprobante. Rechazan y hay que volver a empezar con los tiempos de cola.

### 2. La app

Una sola app de VendéPro, tipo Business. No una por cliente: la app es tuya, los clientes le dan permiso sobre sus cuentas.

**Permisos a pedir, y para qué sirve cada uno** — pedir sólo los que se usan; los de más alargan el review:

| Permiso | Para qué | ¿Ya hace falta? |
|---|---|---|
| `ads_read` | Leer campañas, gasto, insights. **Es el que sostiene todo el panel.** | Sí, desde F2 |
| `business_management` | Listar las cuentas publicitarias del cliente para que elija cuál conectar | Sí |
| `leads_retrieval` | Bajar los leads de los formularios nativos de Meta | Cuando se haga el webhook de Lead Ads (F4) |
| `pages_show_list` | Ver las páginas del cliente (los formularios cuelgan de una página) | Junto con el anterior |
| `ads_management` | **Escribir**: pausar campañas, cambiar presupuesto | Recién en F5. No pedirlo antes — es el permiso más escrutado |

### 3. El review

Se presenta cuando la funcionalidad ya anda. Lo que piden, en la práctica:

- **Un video** mostrando el flujo completo, desde el login del cliente hasta la pantalla donde se ve el dato. Tiene que verse *por qué* la app necesita ese permiso.
- **Instrucciones para reproducirlo**, con un usuario de prueba que funcione.
- **Política de privacidad** publicada en el dominio, que diga qué datos se leen y para qué.
- **URL de eliminación de datos** — cómo un usuario pide que borres lo suyo.

**Lo que más rechazos genera**: el video no muestra el permiso en uso, o el revisor no puede entrar con el usuario de prueba. Los dos son evitables.

### 4. Orden recomendado

1. Verificar el Business Manager **ya** (es lo más lento y no bloquea el desarrollo).
2. Crear la app y construir el OAuth contra tu propia cuenta publicitaria, en modo desarrollo.
3. Cuando el panel funcione de punta a punta con tu cuenta, grabar el video.
4. Presentar el review con `ads_read` + `business_management`.
5. Los otros permisos, en tandas separadas, cuando se implemente lo que los usa. **Un review por permiso es más rápido que uno con cinco.**

---

## Google Ads

### El developer token

Sale de una cuenta **Manager (MCC)**, no de una cuenta publicitaria común. Si no existe, crearla es gratis y toma minutos.

Tres niveles, y el salto entre ellos es el trámite:

| Nivel | Qué permite | Cómo se consigue |
|---|---|---|
| **Test** | Sólo cuentas de prueba. Cero datos reales. | Sale automático al pedir el token |
| **Basic** | Cuentas reales, con un tope diario de operaciones | Se solicita con un formulario |
| **Standard** | Sin ese tope | Se pide después, con volumen demostrado |

**Basic alcanza de sobra** para leer métricas y subir conversiones offline de un puñado de inmobiliarias. Standard es un problema de más adelante.

### Qué pide la solicitud

- Qué hace la herramienta y quién la usa
- **Capturas o video de la herramienta funcionando** — no aceptan una descripción a secas
- Aceptar los términos de la API
- Cumplir la política de funcionalidad mínima: una herramienta que sólo lee y muestra números suele pasar; una que sólo hace una cosa trivial, no

**El bloqueo típico**: pedir el token antes de tener algo que mostrar. Conviene tener la pantalla andando —aunque sea con datos de una cuenta de prueba— antes de presentar.

### Además del token

- **OAuth propio** para Google, separado del de Meta. Buena noticia: **ya hay precedente en el repo** — el OAuth de Google Calendar por usuario (migración 035). Se reusa el patrón.
- Los secrets van como Worker secrets, sincronizados por CI, igual que `GEMINI_API_KEY`.

---

## Checklist para arrancar esta semana

- [ ] Decidir: ¿esto es sólo para Marcela Genta o se vende a otras inmobiliarias? **Todo lo demás depende de esa respuesta.**
- [ ] Iniciar la verificación del Business Manager de Meta (lo más lento)
- [ ] Crear la cuenta Manager (MCC) de Google Ads y pedir el developer token en nivel Test
- [ ] Publicar política de privacidad y URL de eliminación de datos en el dominio
- [ ] Definir el dominio y el email de empresa que se van a usar en los dos trámites

Lo demás —crear la app, el OAuth, los reviews— va enganchado al desarrollo y se hace cuando haya pantalla que mostrar.

---

## Relacionado

- [[Analisis-Marketing-Ads]] — el plan por fases; estos trámites destraban F4
- [[Servicios-externos]] — cómo se guardan los tokens hoy (AES-GCM derivado de `JWT_SECRET`)
- [[Dominio-Usuarios-Org]] — el OAuth de Google Calendar por usuario, que es el patrón a reusar
