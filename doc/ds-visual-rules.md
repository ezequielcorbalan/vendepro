# Reglas visuales — pase de consistencia (Fase 5)

Checklist concreta para la Fase 5 de [`ds-plan.md`](./ds-plan.md). Cada regla salió
de un ajuste ya hecho en Dashboard/Leads/Contactos (commit real referenciado) —
no son criterios nuevos, son los que ya aplicamos ahí, puestos por escrito para
poder auditar el resto de la app contra ellos.

Formato: regla → qué se ve mal (❌) → cómo se ve bien (✅) → excepciones.

---

## 1. Tamaño de botón
Los botones/acciones de página usan el tamaño default (`md`). `size="sm"` es
sólo para contexto denso: card de kanban, fila de tabla, acción inline chica.

- ❌ `<Button size="sm" onClick={openEdit}>Editar</Button>` en un header o toolbar de página
- ✅ `<Button onClick={openEdit}>Editar</Button>` (sin `size`, default `md`)
- Excepción: dentro de una `KanbanCard`, fila de `Table`, o al lado de un input chico → `sm`/`icon` está bien.

Ref: `5f5adcf` — sacó `size="sm"` explícito de 15 pantallas.

## 2. Link estilado como botón
Cuando hace falta un `<Link>` (navegación) en vez de `<Button>` (no acepta `href`),
las clases a mano deben igualar la escala `md` de Button: `text-sm px-4 py-2 gap-2
rounded-control`, íconos `w-4 h-4`. Nada de `text-xs`, `py-1.5`, `gap-1.5`, `w-3.5 h-3.5`.

- ❌ `className="text-xs px-3 py-1.5 gap-1.5 rounded-control"` + `<Icon className="w-3.5 h-3.5" />`
- ✅ `className="text-sm px-4 py-2 gap-2 rounded-control"` + `<Icon className="w-4 h-4" />`

Ref: `413eaf3` — botones-link de headers que habían quedado en la escala vieja.

## 3. Ícono de encabezado de sección
Ícono chico al lado de un `Heading` de sección: GRIS. El rosa de marca se
reserva para CTAs y estados activos, no para decorar títulos.

- ❌ `<Heading level={4}><Target className="w-4 h-4 text-primary" /> Objetivos</Heading>`
- ✅ `<Heading level={4}><Target className="w-4 h-4 text-gray-600" /> Objetivos</Heading>`
- En un header de card el ícono va en `WidgetHeader`, cuyo medallón es gris por
  default. Vale para `IconMedallion` suelto: el default es `neutral`.
- ❌ `<WidgetHeader tone="primary" ...>` / `<IconMedallion tone="primary">` en un encabezado
- ✅ `<WidgetHeader icon={...} title={...} />` — el gris se hereda
- Excepción: ícono ligado a una integración externa a propósito (azul de Meta/Facebook, verde de WhatsApp) — mismo criterio que los botones de canal. Ahí sí se pasa `tone`.
- Excepción: el medallón `hero` de onboarding/éxito, que es un momento de marca y pide `tone="primary"` explícito.

Ref: `bacb6f4` — 17 encabezados corregidos, con las 2 excepciones de Meta
documentadas. Y una recaída: `IconMedallion` nació con `tone='primary'` de
default, así que al migrar los encabezados a `WidgetHeader` el rosa volvió solo.
El default es gris justamente para que la regla no dependa de que cada llamador
se acuerde.

## 4. Barra de búsqueda + filtros (listados)
Una sola fila compacta: sin `Card`/contenedor gris envolvente, sin botón
"Filtros" colapsable con badge de conteo. `Select` con `aria-label` (sin
`<label>` visible al lado) y opción por defecto con pista de contexto
("Etapa: todas", no sólo "Todas"). Link de texto "Limpiar" al final de la fila.

- ❌ Card con grid de `Field`+`Select` debajo de la búsqueda, o botón "Filtros (3)" que colapsa selects en mobile
- ✅ `<div className="flex flex-wrap items-center gap-2">` con `Input` de búsqueda + `Select aria-label="Etapa"` (`<option value="">Etapa: todas</option>`) uno al lado del otro + `Limpiar`

Ref: `4e977be` (Leads, original) y `fec2b46` (Contactos migrada al mismo layout).

## 5. Kanban
Columnas anchas (`w-72` / mínimo 300px por columna, no `w-64`/260px). Header de
columna con fondo blanco + punto de color (`<span className="w-2 h-2 rounded-full"
style={{ backgroundColor: stage.dot }} />`), no el fondo sólido de color de la
etapa. Contador en pill chica con el color de la etapa (`stage.color`, el par
`-100/-800`), no un número pelado. Sin borde ni tinte de color en la card por
urgencia — la urgencia va únicamente como badge, la card mantiene
`border-gray-200` siempre.

- ❌ Header de columna `className={stage.color}` (fondo sólido), contador pelado, card con `border-red-200 bg-red-50/30` cuando hay urgencia
- ✅ Header `bg-white` + punto de color + label, contador en `<span className={stage.color}>`, card siempre `border-gray-200` (la urgencia es un `StatusBadge`, no un tinte)

Ref: `4e977be` — rediseño completo del kanban de Leads.

## 6. KPI / stat tiles locales
Cualquier patrón "ícono en caja de color + valor grande + label" se arma con
`StatTile`, no se recrea a mano por pantalla.

- ❌ Un `<div>` local con ícono en caja de color, valor y label armado a mano (`KPICard`, tiles de `alquiladas`/`vendidas`, etc.)
- ✅ `<StatTile icon={...} tone="..." value={...} label="..." />`

Ref: `ddc9afb` — 3 componentes locales duplicando el patrón, retrofit a `StatTile`.

## 7. Pills de color de estado/urgencia
Par `bg-{color}-100 text-{color}-800` (gris/slate: `-700`, por legibilidad).
Una sola función/mapa de origen en `crm-config`, no una implementación por pantalla
(ej. lista vs. kanban con dos `urgencyText()` distintos).

- ❌ `bg-red-100 text-red-700`, o dos funciones que arman el mismo badge con textos/colores distintos
- ✅ `bg-red-100 text-red-800`, una sola `getUrgencyBadge(lead)` en `crm-config` consumida desde todos lados

Ref: `5056834` — unificó lista y kanban en una sola fuente.

## 8. Radio y sombra
`rounded-card` + `shadow-card` para superficies (cards, tiles). `rounded-control`
para inputs/botones. `rounded-full` para pills/avatares/chips. `shadow-pop` para
flotantes (dropdown, menú contextual). Nunca `rounded-xl`, `shadow-sm` o
`shadow-lg` sueltos — son el equivalente pre-tokens de `rounded-card`/`shadow-card`/`shadow-pop`.

- ❌ `rounded-xl shadow-sm`, dropdown con `rounded-xl shadow-lg`
- ✅ `rounded-card shadow-card`, dropdown con `rounded-card shadow-pop`

Ref: `c8d75d2` — `PropertyFilters` tenía `rounded-xl`/`shadow-sm` por vivir fuera de `src/app` (nunca pasó por la migración grande).

## 9. Empty state / alert / input a mano
Nada de `<input>` nativo, callouts con color suelto (`bg-orange-50 border-orange-200
text-orange-800`), o empty states armados con `<div>` + ícono + texto a mano.
Van `Input`, `Alert tone="..."`, `EmptyState`.

- ❌ `<input className="... border-gray-200 rounded-xl ...">`, `<div className="bg-orange-50 border-orange-200 rounded-xl p-3">⚠ texto</div>`
- ✅ `<Input />`, `<Alert tone="warning">texto</Alert>`, `<EmptyState icon={...} title="..." />`

Ref: `c8d75d2` — mismo commit, `PropertyFilters` migrado a los 4 componentes.

**Excepción — panel de edición denso.** `Input`/`Field` del DS son de densidad
estándar (`px-4 py-2.5`); en un panel angosto tipo Figma para editar props de
un bloque (`tasaciones/editor/block-forms/**`, `tasaciones/admin/BlockAdminForm.tsx`
—panel por bloque dentro de una lista, mismo criterio—, `landings/InspectorPanel.tsx`
+ `landings/ImageUpload.tsx` que comparte con ella, `landings/AIChatPanel.tsx` —vive
en la misma columna de 340px, es la pestaña "IA" del mismo panel—, popover de edición inline),
forzar esa escala rompe el layout compacto. Mismo criterio que el `size="sm"`
de la regla 1: ahí se permite un input a mano más chico (`px-2 py-1`/`px-3
py-2`), siempre que sea consistente entre todos los campos del panel — típicamente
ya con su propia abstracción local (`inputClass`, `TextInput` interno) que
cumple ese rol. No aplica a formularios de página completa (wizards, modales
de tamaño normal) — esos sí van con `Input`/`Field`.

**Excepción — input embebido sin marco.** Un buscador tipo Cmd+K/command-palette
(`layout/GlobalSearch.tsx`) usa un `<input>` sin borde/fondo insertado directo
en la fila de la toolbar, y necesita `ref` para el autofocus del overlay —
`Input` del DS no es `forwardRef`, así que ni technically ni visualmente encaja
ahí. Se deja nativo.

## 10. Color dinámico por dato (hex) — nunca por nombre
Cuando el color de un ítem viene de **configuración dinámica** (catálogo por
org/tenant, no un token estático) y se guarda como **hex** (`#3b82f6`), se
aplica con **estilo inline**. Nunca se lo busca como key de un diccionario de
clases Tailwind por nombre (`COLOR_CLASS['blue']`) — el nombre y el hex no son
intercambiables, el lookup falla en silencio y todo cae al mismo gris de
fallback sin ningún error visible.

- ❌ `className={COLOR_CLASS[stage.color] || 'bg-gray-100'}` cuando `stage.color` vale `'#22c55e'`
- ✅ `style={stagePillStyle(stage.color)}` — helper que arma `{ backgroundColor: hex+alpha, color: hex }` a partir del hex real

Ref: bug encontrado en `PropertyFilters.tsx`/`property-config.ts` — todo el
catálogo de etapas de propiedad se veía gris porque la DB guarda hex y el
código buscaba nombres. Si un mapa de clases por nombre no matchea NUNCA
(0 hits reales), sospechá que la fuente de datos cambió de formato.

## 11. El control de filtro es neutro; el color vive en el dato
Un botón/chip/tab que sirve para **filtrar** una lista por categoría (etapa,
tipo, origen) nunca lleva el color de esa categoría — mismo tratamiento
neutro para todas las opciones sin importar qué representen (gris inactivo,
oscuro o `primary` activo). El color de la categoría se muestra **solo en el
dato** (badge de la card, punto de color junto al label), nunca en el control
que filtra. Además: si ya existe un `Select` de filtro para el mismo tipo de
dato en otra pantalla (regla 4), usar el mismo patrón — no inventar un chip
de colores como mecanismo de filtro alternativo.

- ❌ Chip de filtro con `style={{ backgroundColor: stage.color }}` activo o inactivo
- ✅ Chip/`Select` con estilo neutro fijo (`bg-gray-100 text-gray-600` inactivo, `bg-gray-800 text-white` activo) igual para todas las opciones; el color solo aparece en el badge/punto de cada item de la lista

Ref: `PropertyFilters.tsx` — el filtro de etapas heredaba el color de cada
etapa (verde/azul/rosa por chip); se unificó a neutro y se reemplazó por un
`Select aria-label="Etapa"` igual al de Leads/Contactos.

---

## 12. Encabezado de una pantalla de detalle
Toda ficha (contacto, lead, propiedad) usa `DetailHeader`. No se arma a mano el
avatar + título + badges + acciones + datos, porque cada pantalla que lo armó por
su cuenta terminó con un diseño distinto del mismo objeto.

Anatomía fija: avatar + título + badges | acciones a la derecha → división →
datos (`DetailMeta`) → footer opcional.

- ❌ `<Card><div className="flex justify-between"><Heading .../>...<div className="flex gap-2"><CallButton/><WhatsAppButton/></div></Card>`
- ✅ `<DetailHeader avatar={<Avatar .../>} title={...} badges={...} meta={<><DetailMeta .../></>} actions={<>...</>} />`
- Los datos van TODOS con el mismo tratamiento (ícono gris + texto). Si uno lleva
  caja propia y el resto no, ese ítem se lee como flotando.
- Las notas/observaciones van al `footer`, no como una celda más de los datos.

Ref: `/contactos/[id]` y `/leads/[id]` tenían dos headers distintos del mismo
objeto (uno con avatar y división, el otro con los datos en un párrafo y tres
botones del mismo peso). No era una decisión: era que no había componente.

## 13. Acciones de un encabezado: cuántas quedan a la vista
Con más de 2 acciones aparece el menú de tres puntos (a la derecha de las
visibles). Por default queda visible sólo la última —la principal por
convención— y el resto va al menú.

- En una ficha de trabajo de campo se sube `visibleActions` para que llamar y
  WhatsApp no queden escondidos (`rules/ux-ui.md`: quick actions siempre
  accesibles). En `/leads/[id]` son 3: Llamar, WhatsApp, Agendar.
- ❌ Dos acciones del mismo color pegadas con significados distintos (un
  `variant="success"` al lado del verde de WhatsApp).
- ✅ Cada acción visible con un color que significa una sola cosa. Si sobra
  color, la acción va al menú.
- Dentro del menú TODO se ve como opción: fondo transparente, texto gris, ícono
  a la izquierda. Los canales conservan su color sólo en el ícono. Esto lo
  resuelve `ActionMenuContext`, no el llamador.

## 14. Medallón de ícono: tono, nunca gradiente
El gradiente de marca dejó de ser el color por default. Un medallón de ícono usa
`IconMedallion` con un `tone` semántico.

- ❌ `<div className="w-8 h-8 rounded-control bg-gradient-to-br from-brand-pink to-brand-orange"><User className="text-white" /></div>`
- ✅ `<IconMedallion tone="primary"><User className="w-4 h-4" /></IconMedallion>`
- Header de widget: `WidgetHeader`, que ya trae el medallón.
- El gradiente sobrevive sólo donde es una superficie, no un color de ícono:
  relleno de `ProgressBar`, punto activo del `StepIndicator`, placeholder de foto
  de `PropertyCard`.

## 15. Identidad no es estado
Un dato que identifica (nombre de persona, iniciales de avatar, nombre del agente
asignado) va en gris. El primary se reserva para acciones y estados.

- ❌ `<Avatar>` con fallback `bg-primary/20 text-primary`; `<span className="text-primary">{agentName}</span>`
- ✅ gris (`bg-gray-100 text-gray-600` / `text-gray-600`)
- El motivo: en una lista, una columna de círculos y nombres rosas compite con
  las señales que sí significan algo (etapa, urgencia, acción pendiente).

## 16. Cards de una fila miden igual
Dos cards lado a lado en una grilla terminan a la misma altura. La grilla ya
estira las celdas: no hay que fijar alto, hay que NO romper el estiramiento.

- ❌ `<div className="grid grid-cols-2 gap-4 items-start">` — cada card toma su alto natural y quedan desparejas.
- ✅ `<div className="grid grid-cols-2 gap-4">`
- Lo mismo al revés: si las cards van en un `flex`, el contenedor necesita
  `items-stretch`.

## 17. Un modal de varios pasos no cambia de tamaño
El alto fijo va en el PANEL, no en el contenido: si lo lleva el contenido, un
paso que oculta el footer cambia el tamaño del modal.

- ✅ panel con `h-[Xrem] max-h-[calc(100vh-2rem)]`, contenido `flex-1 min-h-0 overflow-y-auto`
- El alto se elige midiendo el paso más denso, no a ojo.
- El contenido corto se centra con `m-auto` (no `justify-center`, que recorta
  arriba cuando desborda).

## 18. Paginado
Con una sola página no se dibuja. Dos botones deshabilitados y un "1 / 1" no
informan nada.

- ❌ footer con `<Button disabled>Anterior</Button> 1 / 1 <Button disabled>Siguiente</Button>`
- ✅ `{totalPages > 1 && (...)}`, dejando siempre el contador de resultados.

## 19. El contenido va en contenedores, no flotando sobre el fondo
El fondo de página es gris. Todo lo que es contenido —no chrome de navegación—
vive sobre una superficie blanca. Si un bloque queda apoyado directo sobre el
gris, se lee como suelto.

- ❌ `PageHeader` en card blanca y abajo el stepper, el contenido y el footer de
  navegación sueltos sobre el fondo, cada uno con su propio `border-t`.
- ✅ `PageHeader` + una `Card padded={false}` que contiene progreso, contenido y
  navegación, separados entre sí con `border-gray-100` a sangre.
- Un wizard es UNA pieza: el paso, en qué paso estás y cómo seguís no son tres
  cosas distintas.
- Qué sí puede ir sobre el gris: el "Volver a X" de arriba, las tabs de sección
  y la grilla de cards de un listado (cada card ya es su propia superficie).
- El área de contenido lleva un `min-h`, para que el footer de navegación no
  salte de lugar entre un paso corto y uno largo.

Ref: `/tasaciones/nueva` — el único contenedor era el header; el resto flotaba.

## 20. Un ícono es un ícono, no un carácter
Nada de vistos, cruces ni emoji escritos dentro del texto. Van como ícono de
lucide: escalan, heredan el color, se alinean con la línea de base y se ven
igual en Windows, Mac y Android.

- ❌ `{saved ? '✓ Guardado' : 'Guardar'}` · `label: '📱 Móvil'` · `<button>✕</button>`
- ✅ `icon={saved ? <Check className="w-4 h-4" /> : undefined}` y el texto sin el carácter
- ✅ `SegmentedControl` y `Tabs` tienen prop `icon` en cada opción — para eso está
- Las flechas en prosa (→ ← ) NO son esto: son tipografía legítima
  ("Configuración → Ayuda", "lead → contacto"). El ratchet no las cuenta.
- Excepción: el `emoji` de un bloque de landing es contenido que carga el
  cliente, no UI nuestra.

Ref: la corrección "en el onboarding no usar emojis" la apliqué sólo en el
onboarding y nunca la escribí, así que el resto de la app siguió con 33 casos
sueltos. Ratchet: baseline 2.

---

## Cómo se audita
El alcance es **toda la app**, no solo `src/app`: `src/components/**` también
cuenta (`PropertyFilters.tsx` vive ahí y tuvo 3 de estas reglas rotas al
mismo tiempo). Excepción real: superficies que renderizan el documento/página
que un cliente EXTERNO ve (no la app interna) — `tasaciones/renderer/**`,
`tasaciones/legacy/PublicAppraisalShell.tsx`, `landings/public/**`,
`landings/blocks/**` — tienen identidad visual propia por org/propiedad, no
son parte del chrome del CRM.

Grep dirigido por regla (excluyendo `design-system/` que muestra colores a
propósito, y las superficies públicas de arriba):

```bash
# 1 — size="sm" fuera de kanban/tabla (revisar caso por caso, no es 100% mecánico)
grep -rn 'size="sm"' src/app src/components --include=*.tsx

# 3 — íconos de header en primary
grep -rn '<Heading[^>]*>.*text-primary" />' src/app src/components --include=*.tsx
grep -rn 'text-primary" /> [A-ZÁÉÍÓÚÑ]' src/app src/components --include=*.tsx

# 5 — kanban con columnas angostas / header de color sólido
grep -rn 'w-64 shrink-0' src/app src/components --include=*.tsx

# 7 — pills con -700 en vez de -800 (fuera de gray/slate)
grep -rnE 'bg-(red|blue|green|yellow|amber|purple|pink|indigo|cyan|emerald)-100 text-\1-700' src/app src/components --include=*.tsx

# 8 — radios/sombras pre-tokens
grep -rn 'rounded-xl\|shadow-sm"\|shadow-lg' src/app src/components --include=*.tsx

# 10 — mapa de color por nombre que nunca matchea (0 hits reales) contra un campo que en realidad es hex
grep -rn 'COLOR_CLASS\[\|DOT_CLASS\[\|_CLASS\[.*\.color\]' src/app src/components --include=*.tsx

# 11 — chip/botón de filtro con color inline de la categoría
grep -rn 'style={{.*backgroundColor.*\.color' src/app src/components --include=*.tsx

# 12 — fichas de detalle que todavía arman el header a mano
grep -rln "padded={false}" src/app/\(dashboard\)/*/\[id\]/page.tsx | xargs grep -ln "DetailHeader" -L

# 14 — medallones de gradiente a mano (ratchet: scripts/ds-color-lint.mjs)
grep -rn "bg-gradient-to-br from-brand-pink" src/app src/components --include='*.tsx'

# 15 — identidad teñida de primary
grep -rn "text-primary" src/app --include='*.tsx' | grep -iE "agent|assigned|full_name|user_name"

# 16 — grillas de cards con items-start
grep -rn "grid.*items-start" src/app src/components --include='*.tsx'

# 18 — paginados sin guarda de una sola página
grep -rn "totalPages" src/app --include='*.tsx' | grep -v "totalPages > 1"

# 19 — footer de navegación con border-t pero sin Card que lo contenga
grep -rln "border-t" src/components/tasaciones src/components/marketing --include='*.tsx' | xargs grep -ln "ui/Card" -L
```

## Deuda anotada (fuera del ratchet, sin resolver)
Cosas que el ratchet dejó de contar por decisión, NO porque estén arregladas.
Están acá para que no se pierdan:

- **`src/app/r/[slug]` — 11 colores sueltos.** Es el reporte público de una
  propiedad: un documento para el cliente, del mismo tipo que
  `tasaciones/renderer` y `landings/public`, que ya estaban excluidos. Se sacó
  del conteo el 31/08/2026 para que no arrastre el número, pero no se migró.
  Cuando se decida si las superficies públicas siguen el DS o tienen identidad
  propia, esto entra en esa decisión.
- **`src/app/v/[slug]` (5) y `src/app/u/[token]` (2)** son el mismo caso —
  ficha de visita y baja de emails, ambas públicas— y hoy SÍ están contadas.
  Si `/r/` sale, la coherencia pide que salgan estas dos también, o que entren
  las tres. Pendiente de decisión.

## 24. Dentro de un `Modal` no se arma un header ni un footer pegajoso a mano

El panel del `Modal` ya es una columna acotada al 90% del alto de la pantalla:
el encabezado y el `footer` quedan fijos y **el cuerpo scrollea solo**. Los
overlays a mano resolvían eso con `sticky top-0` / `sticky bottom-0` adentro del
contenido, y al migrarlos hay que sacarlo: duplicado, el header pegajoso viaja
con el scroll del cuerpo y se ve doble borde.

❌
```tsx
<Modal open onClose={cerrar}>
  <div className="sticky top-0 bg-white border-b">…</div>
  <div className="p-4">…campos…</div>
  <div className="sticky bottom-0 border-t">…botones…</div>
</Modal>
```

✅
```tsx
<Modal open onClose={cerrar} title="Nuevo lead" footer={<><Button …/><Button …/></>}>
  …campos…
</Modal>
```

Y no intentes acotar el alto desde afuera: un `flex flex-col` en el `className`
del panel no llega al contenido, porque `children` va envuelto en el div del
cuerpo. Ese fue el bug: el `overflow-y-auto` quedó en un nieto, y como el panel
tiene `overflow-hidden`, un formulario largo **se recortaba** — en un teléfono el
final del form quedaba inalcanzable, y en una captura se veía perfecto.

Auditoría: `src/components/ui/__tests__/overlay-contract.test.tsx`, bloque
"un formulario largo no se corta" — tres aserciones que fallan sobre el `Modal`
de antes del arreglo (02/09/2026).


## 25. Una sheet no se pega al borde de abajo

`Modal sheet` nace con aire: 8px al borde inferior y a los costados, y las
**cuatro** esquinas redondeadas. Dos motivos, y el segundo no es estético:

- En un teléfono con barra de gestos, los últimos píxeles de la pantalla son
  zona muerta — y en una sheet ahí es justo donde cae el footer con los botones.
  El padding usa `env(safe-area-inset-bottom)`, así que respeta esa barra cuando
  existe y cae a 8px cuando no.
- Levantada con el borde inferior cuadrado se lee como un error de maquetado, no
  como una decisión. Si le das aire, redondeás las cuatro.

❌ `items-end p-0` + `rounded-t-2xl` → la sheet nace con `bottom` igual al alto
de la ventana: cero aire.

✅ Lo trae el componente: `items-end p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]`
+ `rounded-2xl`, y arriba de 640px vuelve al diálogo centrado con `rounded-card`.

No lo resuelvas por pantalla: son 8 sheets y el `className` del panel no puede
mover el scrim. Salió del repaso de Paula sobre pantalla el 04/09/2026, medido
antes y después (0px → 8px de aire).

Auditoría: `overlay-contract.test.tsx`, bloque "Modal · sheet".


## Enforcement existente
El ratchet de color (`scripts/ds-color-lint.mjs` + `scripts/.ds-color-baseline`)
ya evita que SUBA nada de esto: colores Tailwind sueltos, medallones de
gradiente a mano (regla 14), íconos escritos como carácter (regla 20), la escala
`slate` (regla 21), los radios pre-token `rounded-lg`/`xl` (regla 8) y los
overlays armados a mano (fase 6). Son seis ratchets, cada uno con su archivo de
baseline en `scripts/.ds-*-baseline`.

**El de overlays llegó a 0 el 04/09/2026** y ahí se queda: cualquier `inset-0` con
fondo translúcido nuevo hace fallar el lint. Los tres últimos necesitaron un prop
que el DS no tenía, y por eso mismo estaban armados a mano — `Drawer side="left"`
(nav móvil), `Modal align="top"` (paleta ⌘K) y `Modal header` (onboarding). El
onboarding perdió su fade de entrada: ningún overlay del DS tiene transición, y
meterle una toca todos los overlays de la app, así que se decidió aparte.

**Cerrado el 04/09/2026.** El chequeo de overlays ahora SÍ mira
`src/components/ui`, salvo `Modal.tsx` y `Drawer.tsx`, que son el overlay del DS.
La exclusión general de `ui` tiene sentido para colores (ahí viven los reales)
pero no para comportamiento: `ConfirmDialog` armaba el suyo a mano y el contador
no lo veía, justo en el componente que el DS manda usar antes de borrar algo.
Migrado a `Modal` y puesto bajo `overlayContract`: 5 de sus 10 tests fallan
sobre la versión de antes.

De paso, ese `ConfirmDialog` tenía un bug que nadie había visto: copió el
medallón del `Modal` y le dejó `text-white` sobre `bg-primary/10`, o sea **un
ícono blanco sobre rosa claro**. Es el ejemplo exacto de por qué copiar el markup
de un componente del DS es peor que usarlo.

**El contador de color estaba mal medido hasta el 31/08/2026.** Sólo miraba
emerald/green/red/blue/amber/yellow, y eso dejaba afuera 58 casos: `rose-500` es
un segundo rojo, `pink-*` un segundo primary, y además purple/cyan/orange/indigo.
El patrón ahora cubre toda la paleta menos los neutros, así que el número saltó
de 94 a 152 sin que nadie hubiera escrito una línea nueva. Los 2xl/3xl del radio
quedan afuera del ratchet a propósito: migrarlos SÍ cambia el tamaño, así que se
deciden a mano (quedan 16). Mismo espíritu: cuando una pantalla se corrige acá,
el baseline baja y queda trabado el retroceso.

Las reglas 12 a 25 salieron del repaso visual del 31/08 y 01/09/2026: cada una es una
corrección que se pidió sobre pantalla y que, en vez de quedar en la pantalla
donde se pidió, se movió al componente que la impone. La 12 es la que enseñó por
qué: el header de contacto se había arreglado inline, así que el de lead siguió
distinto.
