---
name: vendepro-design-system
description: "Contrato del design system de VendéPro: qué componente de src/components/ui usar para cada cosa, las reglas visuales del proyecto y cómo verificar antes de commitear. Usala SIEMPRE que vayas a crear o modificar una pantalla, un formulario, un modal, un drawer, una tabla, una card, un botón, un badge o cualquier pedazo de UI del frontend — incluso si el pedido parece chico (\"agregale un botón\", \"cambiale el color\", \"un modal para confirmar\") y aunque nadie mencione el design system. También cuando toques estilos, colores, spacing o tipografía en vendepro-frontend, cuando armes una feature nueva que tenga pantalla, o cuando un lint:ds falle."
---

# Design system de VendéPro

Antes de escribir UI en `vendepro-frontend`, este archivo te dice **qué usar** y
**qué evitar**. No es una guía de estilo: es el contrato que el repo verifica en CI.

## Por qué existe

El proyecto tiene 46 componentes en `src/components/ui` y 25 reglas escritas en
`doc/ds-visual-rules.md`. Nada de eso cabe en la cabeza mientras escribís una
feature, así que lo que pasa en la práctica es esto — dos casos reales del repo:

- Alguien escribió `text-red-500` en un archivo que **tres líneas más arriba** ya
  tenía `<Button variant="ghost" className="text-danger">`. No fue descuido: copió
  el patrón que tenía delante, y el viejo estaba primero.
- Un panel modal se dibujó a mano con `fixed inset-0`. Se veía perfecto y no se
  podía cerrar con Escape. Había 18 así en la app.

El ratchet (`npm run lint:ds`) caza esto **después**, en CI. Esta skill existe para
cazarlo **antes**, cuando todavía es una línea y no un PR.

## El procedimiento

**1. Antes de escribir un `<div>` con clases, preguntate qué componente hace esto.**
La tabla de abajo cubre el 90% de los casos. Si no encontrás el tuyo, mirá
`references/componentes.md`, que tiene los 46 con cuándo usar cada uno.

**2. Si no hay componente, avisá — no lo inventes.** Ver
[Cuando no hay componente](#cuando-no-hay-componente), abajo. Es la parte más
importante de este archivo.

**3. Antes de commitear, corré `npm run lint:ds`.** Son 7 ratchets con baseline: no
fallan por lo que ya existe, fallan si tu cambio *sube* el número. Si sube, el
reporte te dice el archivo y la línea exactos de tus hits.

## Cuando no hay componente

Va a pasar. El DS cubre mucho pero no todo, y cuando no cubre algo hay dos caminos:
inventar, o avisar. **Inventar es el que hace daño**, y no es obvio por qué, así que
vale explicarlo.

Cuando escribís un componente nuevo o una variante nueva sobre la marcha, no queda
registrado en ningún lado. Nadie lo revisó, nadie decidió que exista, y el DS ahora
tiene dos formas de hacer lo mismo sin que nadie lo sepa. Así aparecieron en este
repo: dos headers distintos para la misma ficha, dos pickers que eran la misma
pantalla, tres copias del mapa de orígenes, y 18 overlays a mano que no cerraban con
Escape. Ninguno de esos fue una mala decisión — fue **ninguna** decisión.

Entonces, cuando no encuentres el componente:

**1. Usá el más cercano que exista.** Casi siempre hay uno que sirve con un
`className` encima: `cn` usa `tailwind-merge`, así que podés pisar el estilo base sin
pelearte con la especificidad. Una `Card` con otro padding sigue siendo la `Card` del
DS. Un `Button variant="ghost"` con `px-0` sigue siendo un `Button`.

**2. Marcá la línea** con `{/* ds-todo: candidato a variante "X" */}`, para que
`grep ds-todo` la encuentre cuando se decidan las variantes en tanda.

**3. Y decíselo a quien te pidió el trabajo, en tu respuesta.** No sólo en el
código: un comentario en un archivo no lo ve nadie hasta que alguien grepea. Contá
qué necesitabas, qué usaste en su lugar, y qué le falta al DS. Así:

> El DS no tiene un control tri-estado (tengo / no aplica / pendiente) en 24px. Usé
> dos `Button variant="ghost" size="icon"` y lo marqué `ds-todo` en
> `DocChecklistWidget.tsx:250`. Si esto se repite en otra pantalla, vale promoverlo
> a componente del DS.

**Lo que NO hay que hacer**, aunque parezca más rápido:

- escribir un componente nuevo en `src/components/ui` sin que alguien lo pida
- agregarle una `variant` o un `size` nuevo a un componente existente
- resolverlo con un `<div>` o `<button>` y clases sueltas y seguir de largo
- copiar el markup de un componente del DS y modificarlo en el lugar

Las dos primeras son decisiones de diseño y no son tuyas. Las dos últimas son la
deuda que este repo viene pagando: son exactamente el patrón que dejó 186 botones a
mano y 258 usos de la escala de grises equivocada.

Si te piden explícitamente crear un componente del DS, eso sí es otra cosa — ahí el
pedido ES la decisión. Pero entonces escribilo en `src/components/ui`, con su
docblock explicando por qué existe y qué reemplaza, sumalo a la galería
`/design-system`, y si es un overlay dejalo bajo `overlayContract`.

## Qué usar para qué

| Vas a hacer | Usá |
|---|---|
| un botón, un link que parece botón | `Button` (con `href` renderiza `<Link>`) |
| encabezado de una **pantalla** | `PageHeader` |
| encabezado de una **ficha** de detalle | `DetailHeader` + `DetailMeta` |
| encabezado dentro de una **card** | `WidgetHeader` |
| modal / diálogo | `Modal` |
| panel lateral | `Drawer` |
| confirmar algo destructivo | `ConfirmDialog` o `useConfirm` |
| input, select, textarea, con label | `Field` + `Input` / `Select` / `Textarea` |
| checkbox, radio | `Checkbox`, `RadioGroup` |
| chips seleccionables en fila | `PillRadioGroup`, `PillCheckGroup` |
| switch on/off | `Switch` |
| tabla de datos | `Table` (con `rowHref` si la fila se abre) |
| tarjeta seleccionable de una grilla | `OptionCard` |
| estado / etiqueta de color | `Badge` (semántico) o `StatusBadge` (mapa de dominio) |
| etapa de lead / propiedad, tipo de evento | `StageBadge`, `PropertyStageBadge`, `EventChip` |
| KPI, número grande con label | `StatTile` |
| medallón con ícono | `IconMedallion` |
| lista vacía | `EmptyState` |
| aviso, error, advertencia | `Alert` |
| mensaje efímero de resultado | `useToast` — **nunca `alert()`** |
| menú contextual | `Dropdown` + `DropdownItem` |
| pasos de un wizard | `StepIndicator` |
| cambio de vista (mes/semana, texto/imagen) | `SegmentedControl` |
| navegación entre secciones | `Tabs` |
| llamar o escribir por WhatsApp | `CallButton`, `WhatsAppButton` |
| títulos y texto | `Heading` (level 1–4), `Text` (size/weight/tone) |

Los colores, labels y órdenes de **dominio** (etapas, tipos de evento, orígenes,
estados de tasación) salen de `src/lib/crm-config.ts`. No los escribas de nuevo:
que existan dos mapas del mismo dominio es cómo aparecieron badges del mismo estado
en dos colores distintos.

## Las reglas que más se rompen

Están las 25 en `doc/ds-visual-rules.md` con ❌/✅ y su grep de auditoría. Estas
seis son las que el repo ya vio fallar más de una vez:

**Color por token, nunca por paleta.** `text-danger`, no `text-red-500`.
`bg-primary/10`, no `bg-pink-100`. Un rojo suelto es un segundo rojo.

**El `primary` es de la PANTALLA, no de cada card.** Una pantalla tiene una acción
principal y vive en su encabezado. Las acciones dentro de una card son `outline`,
aunque sean el único botón de esa card. Cuatro primarios es ninguno.

**Los overlays van con `Modal` o `Drawer`.** Traen Portal, scroll-lock, focus-trap,
devolución de foco y Esc. Un `fixed inset-0` a mano se ve igual y no tiene nada de
eso. Si migrás uno, testealo con el contrato: ver más abajo.

**Una sola escala de grises: `gray`.** `slate` es la misma idea con tinte azulado.
Dos pantallas con escalas distintas no se ven parecidas: se ven de dos productos.

**Un ícono es un ícono, no un carácter.** `<Check className="w-4 h-4" />`, no `✓` en
el texto ni un emoji en un label.

**No escondas la única forma de entrar.** Una acción en hover es secundaria. Si es
la única señal de que una fila o card se abre, la lista queda sin affordance. Y un
`<Link>` en `text-ink` no cuenta: nadie lo lee como clickeable.

## Cómo verificar

**Siempre, antes de commitear:**

```bash
cd vendepro-frontend && npm run lint:ds && npx tsc --noEmit && npx vitest run
```

**Si tocaste un overlay** (modal, drawer, panel), el comportamiento no se ve en una
captura. Usá el contrato que ya existe:

```tsx
import { overlayContract } from '@/components/ui/__tests__/overlay-contract'

const contrato = overlayContract(onClose => <MiPanel open onClose={onClose} />)
it('cierra con Escape', contrato.cierraConEsc)
it('bloquea y restaura el scroll del body', contrato.bloqueaYRestauraElScroll)
it('mueve el foco adentro del panel al abrir', contrato.mueveElFocoAdentro)
it('devuelve el foco al disparador al cerrar', contrato.devuelveElFoco)
it('se monta en un Portal, no en el árbol local', contrato.seMontaEnPortal)
it('es un diálogo modal accesible', contrato.esDialogoModal)
```

**Si el cambio es visual**, mirálo en el navegador — pero medí, no sólo mires. Los
dos bugs que llegaron a producción en la última tanda se veían bien en una captura
y estaban funcionalmente mal: un chevron con `opacity: 0` y celdas de una barra que
medían 134px contra 102px. Preguntas que se responden midiendo: ¿navega?, ¿es
visible?, ¿miden igual?, ¿cierra con Escape?

La galería viva está en la ruta `/design-system` — ahí se ve cada componente con
sus variantes y el motivo de cada decisión en el `hint`.

## Archivos de referencia

- `references/componentes.md` — los 46 componentes con cuándo usar cada uno, y las
  trampas conocidas de los que tienen más filo (`Button`, `Table`, `ActionGroup`,
  `Modal`, `Drawer`, `IconMedallion`). **Miralo antes de concluir que algo no
  existe:** varios componentes resuelven casos que por el nombre no parecen — por
  ejemplo `OptionCard` para una grilla de templates, `PillRadioGroup` para filtros en
  fila, o `DetailMeta` para los datos de un encabezado.
- `doc/ds-visual-rules.md` en el repo — las 25 reglas con ❌/✅ y su grep de auditoría.
- `doc/ds-plan-fase6.md` — qué queda por migrar y en qué orden.
