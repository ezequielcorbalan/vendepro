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
Ícono chico al lado de un `Heading` de sección: `text-gray-600` (no `text-primary`).
El rosa de marca se reserva para CTAs y estados activos, no para decorar títulos.

- ❌ `<Heading level={4}><Target className="w-4 h-4 text-primary" /> Objetivos</Heading>`
- ✅ `<Heading level={4}><Target className="w-4 h-4 text-gray-600" /> Objetivos</Heading>`
- Excepción: ícono ligado a una integración externa a propósito (azul de Meta/Facebook, verde de WhatsApp) — mismo criterio que los botones de canal.

Ref: `bacb6f4` — 17 encabezados corregidos, con las 2 excepciones de Meta documentadas.

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
```

## Enforcement existente
El ratchet de color (`scripts/ds-color-lint.mjs` + `scripts/.ds-color-baseline`)
ya evita que SUBA el uso de colores Tailwind sueltos. Mismo espíritu: cuando una
pantalla se corrige acá, el baseline baja y queda trabado el retroceso.

---

## 12. Superficies públicas: subsistema propio

Las pantallas que ve alguien que **no** es agente —landings de propiedad
(`/l`, `/p`), reporte al propietario (`/r`), tasación compartida (`/t`), ficha
de visita (`/v`), link de unsubscribe (`/u`), la home y términos— **no siguen el
design system de la app**. Son un subsistema aparte.

**Por qué:** el DS está calibrado para trabajo denso y repetido (leer, filtrar,
comparar, decidir en pocos clics). Una landing tiene otro objetivo —una sola
acción, primera impresión, marca al frente— y otra tipografía de titulares. Si
las dos superficies comparten los mismos componentes, una de las dos pierde:
o la app se vuelve decorativa, o la landing se vuelve un formulario.

**Qué comparten y qué no:**

| Comparten | No comparten |
|---|---|
| Tokens de marca (`brand-pink`, `brand-orange`, `ink`) | Componentes de `ui/` |
| Tipografía (Poppins) | Escala de tamaños y pesos |
| Logo y assets | Radios, sombras y densidad |
| El gradiente como acento | Los mapas de dominio (`crm-config`) |

**Consecuencias prácticas:**

- Están excluidas del lint de color (`EXCLUDE_PATH_PREFIXES` en
  `scripts/ds-color-lint.mjs`): `landings/public`, `landings/blocks`,
  `tasaciones/renderer`, `tasaciones/legacy`.
- No se marcan con `ds-todo`: no son deuda, son otro sistema.
- Un componente de `ui/` puede usarse ahí si encaja, pero **no es obligatorio**
  y no se fuerza el retrofit.
- Si un patrón de landing se repite (hero, bloque de galería, CTA de contacto),
  se abstrae **dentro** de ese subsistema, no en `ui/`.

**Lo que sí aplica siempre**, en cualquier superficie: el foco visible por
teclado, el `alt` de las imágenes, el contraste de texto, y que el color no sea
el único portador de información.
