# Revisión y refactor del Design System — VendéPro

Metodología para (1) revisar los componentes de `src/components/ui`, (2) migrar la
app a usarlos, y (3) pulir el aspecto al final. Galería viva: `/design-system`.

Regla de oro: **el estilo vive en el componente**. Por eso los cambios visuales se
propagan gratis y se hacen mejor *después* de migrar. Lo que conviene congelar
antes del refactor es el **contrato/API** (variantes, props, estructura).

---

## Fase 1 — Revisión (componente por componente)

Para cada componente, pasá esta rúbrica de 6 puntos y anotá los hallazgos en la
tabla de abajo. Clasificá cada hallazgo en un balde:

- 🔴 **API / contrato** — falta una variante, un prop, un estado, o hay que
  cambiar la estructura. **Se resuelve ANTES de migrar** (tocar esto después es caro).
- 🟡 **Estético** — se ve, pero se puede mejorar (aire, tono, sombra, tamaño).
  **Se aplica en el pase visual final** (o al toque si es trivial).

Rúbrica:
1. **Variantes/estados** — ¿están todos los que la app necesita? (default, hover, focus, disabled, loading, error, vacío)
2. **Anatomía** — spacing interno, alineación, íconos, truncado de texto.
3. **Tokens** — ¿usa `primary`, radios, sombras y colores de `crm-config`, sin valores sueltos?
4. **Accesibilidad** — foco visible, contraste, target táctil ≥ 44px, labels/roles.
5. **Responsive** — ¿se banca mobile (sin scroll horizontal, texto que corta bien)?
6. **Consistencia** — ¿es coherente con sus hermanos (radio, padding, pesos)?

### Tabla de hallazgos

| Componente | Estado | Hallazgo | Balde | Prioridad |
|---|---|---|---|---|
| Button |  |  |  |  |
| Badge |  |  |  |  |
| StageBadge |  |  |  |  |
| EventChip |  |  |  |  |
| Card |  |  |  |  |
| Input / Field / Select / Textarea |  |  |  |  |
| Avatar |  |  |  |  |
| Tabs |  |  |  |  |
| SegmentedControl |  |  |  |  |
| Switch |  |  |  |  |
| Checkbox / RadioGroup |  |  |  |  |
| Tag |  |  |  |  |
| Modal |  |  |  |  |
| Dropdown |  |  |  |  |
| Tooltip |  |  |  |  |
| Drawer |  |  |  |  |
| Table |  |  |  |  |
| Timeline |  |  |  |  |
| Progress (bar + steps) |  |  |  |  |
| EmptyState |  |  |  |  |
| Notifications |  |  |  |  |
| Kanban |  |  |  |  |
| PropertyCard |  |  |  |  |
| Charts (Bar/Donut/Funnel) |  |  |  |  |

Estado sugerido: ⬜ pendiente · 🔍 en revisión · ✅ ok · 🔴 tiene API pendiente · 🟡 tiene estético pendiente

---

## Fase 2 — Congelar APIs

Aplicar sólo los hallazgos 🔴 (contrato). Después de esto, los nombres de
variantes y props no deberían cambiar. Verificar con `npx tsc --noEmit`.

---

## Fase 3 — Refactor del front (migración)

Reemplazar los usos inline de Tailwind por los componentes. Un **commit chico por
pantalla/módulo**, sin mezclar cambios visuales.

**Inventario (para dimensionar):**
```bash
# botones inline (gradiente / rosa sólido)
grep -rn "from-brand-pink to-brand-orange\|bg-brand-pink" src/app src/components --include=*.tsx | wc -l
```

**Orden sugerido** (de más usado / menos riesgo → menos usado):
1. `Button` (es el de mayor impacto y más repetido)
2. `Badge` / `StageBadge` / `EventChip`
3. `Input` / `Field` / `Select`
4. `Card`
5. El resto según aparezcan (Modal, Tabs, Table, Drawer, etc.)

**Método: usar lo existente + marcar (no crear variantes sobre la marcha).**
Cuando algo no encaja en un componente, hay 3 baldes:
1. **Es equivalente a algo que ya existe** → usalo (la mayoría; mejora la consistencia).
2. **Es una diferencia funcional real** (color de canal, acción con color propio) → migralo al componente existente MÁS cercano y **marcalo** con `{/* ds-todo: candidato a variante "X" — por ahora <variante-actual> */}`. NO crear la variante todavía.
3. **Después de la pasada** → `grep -rn "ds-todo" src` y decidís, en una sola tanda, qué customs recurrentes se vuelven variante (la mínima cantidad, justificada por uso real).
Regla: las variantes se crean con datos (cuántas veces se repite), no adivinando. El custom marcado que se repite ES la señal de qué variante hace falta.

**Checklist por pantalla migrada:**
- [ ] Reemplacé los usos inline por el componente
- [ ] `npx tsc --noEmit` en verde
- [ ] Miré la pantalla en dev (mobile + desktop)
- [ ] Commit chico y descriptivo (solo migración, sin retoques visuales)

---

## Fase 4 — Pase visual final

Con la app ya usando los componentes, aplicar los hallazgos 🟡 editando **cada
componente una sola vez** → se propaga a todas las pantallas. Revisar en pantallas
reales (data real, densidad real), light/dark si aplica, mobile/desktop.

---

## Contrato de API (congelado — Fase 3)

Convención de props para todos los componentes (auditada: ya se cumple):

| Prop | Significado | Valores | Ejemplos |
|---|---|---|---|
| `variant` | **estilo** estructural/de relleno | según componente | Button `primary\|outline\|ghost\|success\|danger` · Tag `solid\|soft` |
| `tone` | **color** semántico | `neutral\|primary\|success\|warning\|danger\|info` (Text suma `muted`) | Badge, Text |
| `size` | **tamaño** | `sm\|md\|lg` (tipografía: `xs\|sm\|base\|lg`) | Button, Avatar, Text |
| booleanos | modificador de estado puntual | — | `loading`, `fullWidth`, `dot`, `danger`, `interactive`, `padded`, `hideIcon` |
| `className` | clases aditivas | — | siempre al final, no pisa el estilo base |

Reglas de contrato:
- **Color → token** (`primary`, `success`, …). Nunca color Tailwind suelto en un componente nuevo.
- **Texto → `Heading`/`Text`** (no `<h1>`/`<p>` con clases sueltas).
- **Radio/sombra → `rounded-control`/`rounded-card`/`rounded-full`, `shadow-card`/`shadow-pop`**.
- **Dominio (etapas, eventos, colores de negocio) → `lib/crm-config.ts`**.
- Sin barrels; `'use client'` sólo si hay interacción/estado.
- Componentes legacy a reemplazar en la migración: `ConfirmDialog` → `Modal`.

### Tanda de decisiones de variantes (cerrada)

Resuelta con los datos de uso real, según la regla del método ("las variantes se
crean con datos, no adivinando"). Lo que se decidió NO hacer también queda
asentado, para no re-abrirlo:

| Marca `ds-todo` | Usos reales | Decisión |
|---|---|---|
| `OptionCard` (tarjeta seleccionable) | 6 en 3 módulos | ✅ **componente nuevo** `ui/OptionCard` (`orientation="row"\|"stack"`) |
| Medallón de ícono con gradiente | 24 inline | ✅ **componente nuevo** `ui/IconMedallion` (`size`, `shape`, `elevated`) |
| Barra de acento con gradiente | 10 inline | ✅ **componente nuevo** `BrandAccentBar` (en `ui/IconMedallion`) |
| Gradiente de marca escrito a mano | 74 inline, 2 direcciones | ✅ **utilidad** `bg-brand-gradient` / `bg-brand-gradient-r` en `globals.css` |
| `SegmentedControl` con ícono | 2 pantallas | ✅ **prop `icon`** en `SegmentedOption` (simetría con `TabItem.icon`, que ya lo tenía) |
| `StatusBadge` con ícono | 1 + habilita badges de dominio | ✅ **prop `icon`** |
| `StatTile` con borde de color + slot de badge | 1 (KPI del semáforo) | ✅ **props `emphasis` + `badge`** |
| `Button variant="success"` (verde crear/publicar) | 4 en 3 archivos | ✅ **variante nueva** |
| `Button variant="accent"` (naranja de marca) | **0 botones naranjas sólidos en toda la app** | ❌ **no se crea.** El contrato queda `primary\|outline\|ghost\|success\|danger`. Ese botón va `outline` |
| Chips de dominio sin mapeo (Alquilada cyan, KiteProp indigo, Tasación morada) | 3 | ✅ **al dominio**, no a componentes: `LEAD_FLAGS`, `PROPERTY_SOURCES`, `PROPERTY_ALT_STATUSES` en `crm-config.ts` |

### Segunda tanda (cerrada)

| Decisión | Resultado |
|---|---|
| **Gradiente como relleno de botón** (13 usos) | ❌ **Se aplana a `primary` sólido.** NO se crea `Button variant="brand"`. El gradiente queda para superficies (`IconMedallion`) y barras de acento (`BrandAccentBar`), nunca como relleno de un botón. Hoy quedan **0** botones con gradiente. |
| **`Table` con hover-reveal + responsive** | ✅ **Se extiende `Table`** con `actions` (celda de acciones por fila: hover-reveal en desktop, siempre visible en touch), `renderMobileCard` (abajo de `md` la tabla se reemplaza por cards) y `footer` (paginación dentro de la misma superficie), más `minWidth`. `renderMobileCard` a propósito NO proyecta las columnas automáticamente: el layout mobile de una lista nunca es "las mismas celdas apiladas". |
| **`Card` oscura/destacada** | ❌ No se crea — 1 uso (`tasaciones/[id]`). Queda marcado. |
| **`IntegrationBadge`** | ❌ No se crea — 1 uso local en `marketing`. Queda marcado. |

### Tercera tanda (cerrada) — las decisiones de diseño

Al medir en serio no eran tres steppers distintos: eran **seis**.

| # | Dónde vivía | Forma |
|---|---|---|
| 1 | `auth/register` | círculo numerado + label **debajo** + línea |
| 2 | `propiedades/[id]/reportes/nuevo` | círculo numerado + label **al lado** + línea · "hecho" en **verde** |
| 3 | `components/marketing/wizard` | idem 2 pero círculo de 20px en vez de 32px |
| 4 | `ui/Progress` → `Steps` (onboarding, `app/f/[slug]`) | dots + contador, sin labels |
| 5 | `components/tasaciones/wizard/WizardShell` | pastillas segmentadas full-width |
| 6 | `prefactibilidades/nueva` | `SegmentedControl` con ícono |

Los 1, 2 y 3 eran **el mismo dibujo con tres medidas distintas**.

| Decisión | Resultado |
|---|---|
| **`StepIndicator`** | ✅ **componente nuevo** `ui/StepIndicator`. Gana la anatomía "círculo numerado + label al lado + línea de unión" como `variant="numbered"` (canónica). `variant="dots"` sobrevive como la compacta, para cuando NO hay lugar para labels (header de un modal, página pública) — es un contexto distinto, no drift. Los seis diseños migraron. Props: `steps` (labels, o un número para `dots`; cada paso acepta `icon`), `current` (1-based), `onStepClick` (los pasos completados se vuelven clickeables), `allowForward`, `showCount`. |
| **"Hecho" en verde vs rosa** | ✅ gana el **rosa** (`primary`). El verde queda reservado para `success`. Afectaba sólo a `reportes/nuevo`. |
| **Mobile en `numbered`** | ✅ los labels se esconden abajo de `sm` y aparece una línea "Paso N de M · Label" debajo, en vez de que la fila scrollee fuera de la pantalla. Resuelto en el componente, una vez. |
| **`Button variant="neutral"`** | ✅ **variante nueva** (relleno oscuro sólido). Apareció al medir la Card oscura: había **5 botones** `gray-800`/`slate-900` inline en 5 módulos — más señal que la que tuvo `success`. Nadie lo había marcado. |
| **`Card tone="dark"`** | ❌ **no se crea** — 1 solo uso (el panel "Tasación proyectada"). Queda marcado con la decisión anotada al lado, para no re-abrirlo. |
| **`IntegrationBadge`** | ❌ **no se crea** — 1 solo uso. La marca se cerró y la función queda local a la pantalla de marketing. |

**Legacy reemplazado en esta tanda:**
- `Steps` (de `ui/Progress`) → `StepIndicator variant="dots"`. `Progress` queda
  sólo con `ProgressBar`.
- `components/onboarding/StepIndicator.tsx` **borrado**: era una copia casi
  idéntica de `Steps`. Ahora usa el del DS.

### Cuarta tanda (cerrada) — salió de migrar `components/properties`

| Decisión | Datos |
|---|---|
| **`WidgetHeader`** nuevo | ~25 usos inline. Es `PageHeader` a escala de card: medallón + título + subtítulo/badge + acción. Venía con drift real: medallones de w-7/w-9/w-10, `rounded-lg` vs `rounded-control`, y un gradiente distinto (`to-[#ff5e3a]`). Reusa `CardTitle` para el título en vez de inventar un segundo estilo de título de card. |
| **`Button` con `href`** | **22 usos en 14 archivos**: `<Link>` replicando a mano el relleno, padding y radio del botón. Con `href` renderiza `<Link>` con el mismo estilo; un `<a>` es lo correcto cuando la acción es navegar. Misma decisión que `Tabs.href`. Un link deshabilitado se renderiza como `<span>` inerte, porque en HTML no existe. |
| Colores de dominio a `crm-config` | `VISIT_BUY_INTENTIONS` / `VISIT_SITUATIONS` / `VISIT_SOURCES` (estaban duplicados en **3** archivos), `REPORT_FRESHNESS`. |
| **Control tri-estado de documentación** | ❌ no se crea — 1 uso (24px, tengo/no aplica/pendiente). Marcado. |

### El gradiente deja de ser el color por default

`IconMedallion` pasa de gradiente a **tonos**, con los mismos nombres que ya usan
`Badge` y `StatTile` (`primary` default, `info`, `success`, `warning`, `danger`,
`neutral`, o un par de clases crudas). Un solo vocabulario de tonos en todo el DS.

Se aplicó el mismo criterio a las cajas de ícono de `Modal` y `ConfirmDialog`,
que cumplen el mismo rol.

El gradiente **sobrevive sólo en tres lugares, y en otro rol**: el relleno de
`ProgressBar`, el dot activo del `StepIndicator`, y el placeholder de foto de
`PropertyCard`. Ninguno es una caja de ícono ni un botón.

Otros ajustes visuales de la misma pasada:
- `--color-success`: `#22c55e` → **`#16a34a`** (el 500 era demasiado fluo). Cambia
  en todo lo semántico: Badge, Alert, Button success, StatTile.
- `StatTile emphasis`: el borde pasa de 2px a **1px**.
- `ChoicePills`: pasa a la anatomía de `Tag variant="solid"` —`rounded-full`,
  `px-4 py-2`, `shadow-card`— porque es el mismo objeto visual (un chip) y `Tag`
  ya estaba resuelto. La única diferencia es que estos son seleccionables.

### Regla de acciones en headers (nueva)

`PageHeader` pasa a ser **superficie blanca** (la misma `Card` del DS) para
despegarse del fondo de página.

Y las acciones **desbordan solas**: hasta 2 quedan visibles; con 3 o más queda
sólo la última —la principal por convención— y el resto pasa a un menú de tres
puntos. Es automático, quien llama no hace nada. El menú va a la DERECHA de la acción visible.

El motivo: un header con cuatro botones del mismo peso no tiene acción
principal, y eso es peor que esconder tres detrás de un menú.

La lógica vive en **`ui/ActionGroup`**, no en `PageHeader`, porque hay cabeceras
que no son un PageHeader y necesitan la misma regla (el detalle de contacto
tiene avatar, badge y grilla de datos propios). `ActionGroup` acepta `max`
(default 2) pero **no se usa con otro valor en ningún lado**: si aparece la
necesidad, es una decisión de diseño, no un ajuste al pasar.

Aplicada en: `/tasaciones` (4 acciones → 1 + menú de 3) y `contactos/[id]`
(5 → 1 + menú de 4).

### Revertido por decisión de diseño (Paula)

Tres cosas que se crearon con datos de uso y se dieron de baja igual. La
distinción importa: **el dato responde "¿esto se repite?", no "¿esto debería
existir?"** — la segunda pregunta es de diseño y no la contesta un grep.

| Qué | Por qué se había creado | Por qué se dio de baja |
|---|---|---|
| **`Button variant="neutral"`** (oscura) | 5 botones `gray-800`/`slate-900` inline en 5 módulos | Sumaba un cuarto peso visual. En la cabecera de `contactos/[id]` convivía con dos botones rosa y uno verde: cuatro acciones al mismo nivel = ninguna es la principal. |
| **`BrandAccentBar`** | 10 barras de gradiente inline | Decorativa, no comunica nada. Se sacó de los **8** lugares donde estaba, no sólo de los 2 que usaban el componente. |
| **`icon` en `StepIndicator`** | `prefactibilidades` lo necesitaba | El círculo ya lleva el número (o el check); un ícono al lado del label es información repetida. |

Los 5 usos de `neutral` no fueron todos al mismo reemplazo:
- "Reintentar", "Usar", "Descargar PDF" y "Nuevo lead" → `outline` (secundarias)
- "Sí, darme de baja" y el "Siguiente" del wizard → `primary` (son el CTA de su pantalla)

La utilidad `bg-brand-gradient-r` **se queda**: la usan las barras de progreso y
el dot activo del stepper, que son otro rol.

## Hallazgos abiertos (encontrados al migrar, no resueltos)

Cosas que aparecieron migrando y que NO son decisiones de contrato pendientes,
pero conviene no perder:

1. **`ui/Notifications` no coincide con la realidad.** Sólo lo usa la galería. El
   que está en producción es `components/layout/NotificationBell`, y es bastante
   más rico: badge numérico (no un punto), color de campana según urgencia,
   items con link + ícono por urgencia + descartar individual. El del DS es una
   versión simplificada que se construyó desde el muestrario y nunca se validó
   contra la app. Hay que decidir si el DS se pone al día o si el de layout sube
   a `ui/`.
2. **`profile.full_name` viene vacío** en el layout del dashboard, así que el
   avatar del sidebar y del header caen al email (`dev@dev.com` → "D") en vez de
   mostrar las iniciales del nombre. No es del design system, pero se ve.
3. **`Badge` local que le hacía sombra al del DS** en `VisitFormsSection` (ya
   borrado) y **otro igual en `app/r/[slug]`** (un `Tag` local con
   `color="green"`). Ese archivo todavía no se migró; los mapas de dominio ya
   existen en `crm-config`, así que es directo.
4. **`Tabs` en modo ruta**: el match de ruta lo calcula quien llama, a propósito
   (a veces es exacto, a veces con `startsWith`). Si aparece un tercer patrón de
   match, evaluar si vale un helper.

## Convenciones de trabajo

- Refactor y ajuste visual **en commits separados** (para poder revertir uno sin el otro).
- Nada de valores sueltos: si un color se repite, va como token en `globals.css @theme`.
- Cambios de color de dominio (etapas, eventos) → siempre en `lib/crm-config.ts`.
