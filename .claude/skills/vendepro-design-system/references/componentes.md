# Los 46 componentes de `src/components/ui`

Cuándo usar cada uno, y las trampas de los que tienen filo. Las firmas exactas
están en cada archivo y en la galería viva de `/design-system`.

## Índice

- [Acciones](#acciones)
- [Encabezados](#encabezados)
- [Overlays](#overlays)
- [Formulario](#formulario)
- [Datos y listas](#datos-y-listas)
- [Estado y etiquetas](#estado-y-etiquetas)
- [Navegación](#navegación)
- [Contenido y feedback](#contenido-y-feedback)
- [Dominio](#dominio)
- [Infraestructura](#infraestructura)

---

## Acciones

**`Button`** — todo lo clickeable. `variant`: `primary` | `outline` | `ghost` |
`success` | `danger`. `size`: `sm` | `md` | `lg` | `icon`. Con `href` renderiza un
`<Link>`, que es lo correcto cuando la acción es navegar: se puede abrir en pestaña
nueva y copiar el link.

> **Trampa:** el padding de `Button` cuenta para el ancho mínimo del flex. Si lo
> usás como celda de una barra `flex-1`, agregale `px-0` o las celdas dejan de medir
> igual. Pasó y no se veía en la captura.

**`ActionGroup`** — la fila de acciones de un encabezado, con desborde al menú de
tres puntos. Dos perillas, porque son dos preguntas: `max` (2) es **cuándo** aparece
el menú, `keep` (1) es **cuántas** quedan visibles. Los `Button` de adentro del menú
se vuelven ítems solos; `CallButton`/`WhatsAppButton` también, vía
`ActionMenuContext`.

**`CallButton`, `WhatsAppButton`** (`ContactButtons`) — llamar y escribir. Nunca
armes el `tel:` o el `wa.me` a mano. `WhatsAppButton` con `templateContext` abre el
selector de mensajes predeterminados de la org.

**`Dropdown`, `DropdownItem`, `DropdownSeparator`** — menú contextual.

> **Trampa:** `Dropdown` cierra con **cualquier** click adentro. Correcto para un
> menú; incorrecto para un panel donde se hacen varias acciones seguidas.

---

## Encabezados

Los tres son distintos y confundirlos es el error más común:

| | Dónde va | Anatomía |
|---|---|---|
| **`PageHeader`** | arriba de una **pantalla** | título + subtítulo + acciones (con desborde) |
| **`DetailHeader`** | arriba de una **ficha** (contacto, lead, propiedad, tasación) | avatar + título + badges + acciones → división → datos (`DetailMeta`) → footer |
| **`WidgetHeader`** | arriba del contenido de una **card** | medallón + título + subtítulo/badge + acción |

`DetailMeta` es cada dato del encabezado de ficha: ícono gris + texto. Todos los
datos se tratan igual — si uno lleva caja propia y el resto no, ése se lee como
flotando.

> **Trampa de `WidgetHeader`:** el medallón es **gris** por default. Un ícono de
> encabezado no se tiñe de marca; el rosa es para CTAs y estados activos. Pasá
> `tone` sólo si el ícono está ligado a algo con color propio (un canal, una
> integración).

---

## Overlays

**`Modal`** — diálogo centrado. `sheet` lo pega abajo en móvil y lo deja centrado
en desktop: es el molde de las pantallas de trabajo de campo (leads, calendario,
contactos). `padded={false}` para contenido a sangre (una banda de filtros con
borde, una lista que scrollea sola). `header` es el mismo slot que el del Drawer,
para encabezados que no son un título de una línea. `align="top"` ancla el panel
arriba, que es lo que pide una paleta de comandos (centrada salta de lugar según
cuántos resultados haya); si va junto con `sheet`, gana `sheet`.

> Sin `title` **ni** `header` no dibuja encabezado —  ni barra ni X. Es lo que
> necesita la paleta ⌘K, que trae su propia barra de búsqueda.

> **Trampa:** el panel ya es una columna acotada al 90% del alto de pantalla, con
> encabezado y `footer` fijos y el cuerpo scrolleando solo. No armes un
> `sticky top-0`/`sticky bottom-0` adentro del contenido (regla 24), y no intentes
> acotar el alto desde el `className` del panel: `children` va envuelto en el div
> del cuerpo, así que un `flex flex-col` de afuera no llega y el contenido se
> recorta en silencio.

**`Drawer`** — panel lateral. `header` (ReactNode) para encabezados que no son un
título de una línea; la X la sigue poniendo el Drawer. `footer` para acciones fijas
abajo. `padded` igual que en `Modal`. `side="left"` para el que entra por la
izquierda (hoy sólo el nav móvil). El `className` va al **scrim**, no al panel —
por eso `lg:hidden` funciona: esconde el fondo negro también.

**`ConfirmDialog`** / **`useConfirm`** — confirmar algo destructivo.

Los tres traen Portal, scroll-lock, focus-trap, devolución de foco y Esc, y el
z-index sale de `lib/z`. Eso es exactamente lo que un `fixed inset-0` a mano no
tiene, y no se ve en una captura: probalo con `overlayContract`.

> Un `fixed inset-0` **transparente** que sirve de atrapa-clicks de un dropdown
> **no** es un overlay y no se migra. El ratchet tampoco lo cuenta.

---

## Formulario

**`Field`** — label + hint + error. Genera el `id` y lo asocia solo; propaga el
estado de error al control por contexto.

**`Input`, `Textarea`, `Select`** — los tres aceptan `ref` (`forwardRef`), así que
no hay razón para usar el elemento nativo cuando necesitás enfocar por código.

**`Checkbox`, `RadioGroup`** (`Choice`) — selección con círculos/cajas verticales.

**`PillRadioGroup`, `PillCheckGroup`** (`ChoicePills`) — chips seleccionables en
fila. Para elegir UNO o VARIOS valores de una lista horizontal ("Disposición",
"Amenities"). Distinto de `RadioGroup` (vertical) y de `SegmentedControl` (cambio de
vista, no selección de datos).

**`Switch`** — on/off inmediato.

**`ContactSelector`, `LeadSelector`, `PropertySelector`** — buscar y elegir una
entidad del CRM.

> **Trampa:** nunca pongas `focus:outline-none` en un control. Se come el anillo de
> foco del teclado.

---

## Datos y listas

**`Table`** — tabla data-driven con `columns` + `data`. `sortable` por columna,
`renderMobileCard` para reemplazarla por cards abajo de `md`, `footer` para meter la
paginación en la misma superficie.

> **Trampa, y ya rompió producción:** `actions` aparece en hover, así que es sólo
> para acciones **secundarias** (eliminar, duplicar). Si la fila se abre, eso va en
> **`rowHref`**: la fila entera navega y el chevron queda siempre visible. Meter la
> navegación en `actions` deja la tabla sin affordance.

**`Card`, `CardHeader`, `CardTitle`** — superficie. `padded={false}` para media o
tablas a sangre.

**`OptionCard`** — tarjeta seleccionable. `row` (ícono + texto + chevron) o `stack`
(media o ícono arriba, texto abajo, para grillas de templates).

**`StatTile`** — KPI. Con `icon`: tile blanca y el `tone` colorea sólo la caja del
ícono. Sin `icon` y con `tone`: tiñe toda la tile, para resultados con significado
semántico. `emphasis` para el KPI destacado.

**`KanbanBoard`, `KanbanColumn`, `KanbanCard`** — board presentacional.

**`Timeline`** — historial de eventos.

**`PropertyCard`** — card de propiedad con foto, precio y metadatos.

**`PhotoGallery`** — grilla de fotos con lightbox.

**`BarChart`, `DonutChart`, `Funnel`** (`Charts`) — gráficos sobre Recharts.

**`ProgressBar`** (`Progress`) — barra de avance.

---

## Estado y etiquetas

**`Badge`** — pill de estado con tono **semántico**: `neutral` | `primary` |
`success` | `warning` | `danger` | `info`. `dot` agrega un punto de color.

**`StatusBadge`** — cuando el color viene de un **mapa de dominio**
(`crm-config.ts`). Recibe `label` y `color` ya resueltos: el mapa sigue siendo la
fuente, el pill unifica la forma.

**`Tag`** — chip de atributo. `solid` (pill blanco con borde) o `soft` (tinte
primario). `onRemove` agrega la X.

**`IconMedallion`** — caja con tinte + ícono del mismo color. `tone` **neutral por
default**: el color se pide, no se hereda. `size`: `sm` a `hero`. `shape`: `control`
o `circle`.

---

## Navegación

**`Tabs`** — navegación entre secciones. `items` con `value`, `label`, `count`,
`icon`; con `href` la tab renderiza un `<Link>` y marca `aria-current`.

**`SegmentedControl`** — cambio de **vista** (mes/semana/día, texto/imagen). No es
para seleccionar datos.

> **Trampa:** es `inline-flex`. En un contenedor con `space-y-*` los márgenes
> verticales no aplican y dos controles terminan en la misma línea. Usá
> `flex flex-col gap-*`.

**`StepIndicator`** — pasos de un wizard. `numbered` (círculo + label al lado, el
canónico) o `dots` (sólo puntos + contador, para cuando no hay lugar para labels).

**`NotificationBell`, `NotificationPanel`** (`Notifications`) — campana y panel. El
consumidor pone los datos; la forma sale de acá.

---

## Contenido y feedback

**`Heading`** (`level` 1–4) y **`Text`** (`size`/`weight`/`tone`) — nunca `<h1>` ni
`<p>` con clases sueltas. Los títulos de sección (Heading 2) van en semibold. Los
dos salen de `@/components/ui/Typography`.

**`EmptyState`** — lista vacía: ícono + título + descripción + acción.

> El CTA de un `EmptyState` que ocupa la **pantalla entera** va en `primary` (es la
> única acción posible ahí). El de un `EmptyState` **dentro de una card**, no: la
> pantalla ya tiene su primary.

**`Alert`** — aviso persistente. `tone`: `info` | `success` | `warning` | `danger` |
`brand`. `onDismiss` lo hace cerrable.

**`ToastProvider` / `useToast`** — mensaje efímero de resultado. **Reemplaza a
`alert()`**, que bloquea la pantalla y se ve como un error del navegador. Está
montado en `(dashboard)/layout.tsx`, así que cualquier pantalla del dashboard lo
tiene. Ojo: sin provider el hook no explota — se traga el mensaje en silencio.

**`Tooltip`** — aclaración en hover/focus.

---

## Dominio

Leen `src/lib/crm-config.ts` y son la única forma correcta de mostrar un estado de
negocio:

- **`StageBadge`** — etapa de un **lead** (por pipeline vendedor/comprador)
- **`PropertyStageBadge`** — etapa de una **propiedad**. Resuelve solo los alias
  legacy (`captacion` → `captada`, `con_ofertas` → `reservada`) y los estados
  alternativos (`alquilada`), así que el llamador no necesita mapa propio.
- **`OperationBadge`** — venta / alquiler
- **`EventChip`** — tipo de evento de calendario

---

## Infraestructura

**`Portal`** — renderiza en `document.body`. Sólo para overlays que se montan por
interacción: si se monta en el primer render hay error de hidratación.

**`useOverlay`** — el comportamiento base de un overlay (Esc, scroll-lock,
focus-trap, devolución de foco). Ya lo usan `Modal` y `Drawer`; no lo llames a mano
salvo que estés escribiendo un overlay nuevo del DS.

**`action-menu`** — el contexto que permite que un componente sepa que está
renderizándose dentro del menú de un `ActionGroup` y se dibuje como opción.

**`WhatsAppTemplatePicker`** — modal de selección de mensajes predeterminados; lo
abre `WhatsAppButton` cuando recibe `templateContext`.
