# Fase 6 — Estructura

Las fases 1 a 5 fueron **apariencia**: color, gradiente, escala de grises, radios,
tipografía. Esta es la primera de **estructura**: que ningún overlay ni control se
dibuje a mano cuando el design system ya lo resuelve.

El criterio que la ordena: **componentizar, no maquillar.** Un overlay armado a
mano se ve bien y pasa los cinco ratchets actuales. Se rompe cuando alguien
intenta cerrarlo con Escape.

## Estado al 08/09/2026 — cerrada como migración

Las seis tandas están hechas. Lo que queda no es trabajo de migración: son
**seis decisiones de diseño** (19 `ds-todo`) más una de producto (las páginas
públicas), listadas al final.

| Contador | Arrancó | Hoy |
|---|---|---|
| overlays armados a mano | 18 | **0** |
| diálogos nativos (`confirm`/`alert`/`prompt`) | 24 | **3** |
| botones nativos (`<button>`) | 161 | 22 |
| inputs nativos | 28 | 15 |

Los **overlays llegaron a 0 y ahí se quedan**: cualquier `inset-0` translúcido
nuevo hace fallar el lint. Los 3 diálogos, 22 botones y 15 inputs que quedan
están **fuera de alcance a propósito** — 30 de esos controles y los 3 diálogos
viven en archivos de la tanda de Ezequiel del 31/08–04/09, que se dejaron
afuera para no pisarnos, y el resto son las páginas públicas y los `ds-todo`.

Los nueve ratchets corren en `frontend-checks.yml` junto a `tsc`, `vitest` y
`eslint` (desde el 08/09/2026; antes los tests no corrían en ningún workflow).

## Por qué esta fase existe

Medido el 01/09/2026, después de migrar `AIChatPanel`:

| | |
|---|---|
| overlays armados a mano | **18** en 17 archivos |
| de ésos, cierran con Esc | **3** |
| de ésos, usan Portal | **0** |
| de ésos, tienen focus-trap / devuelven foco | **0** |
| archivos que usan `ui/Modal` o `ui/Drawer` | 14 |

O sea: **más de la mitad de los overlays de la app no se pueden cerrar con el
teclado**, y sin Portal cualquiera puede quedar recortado por un ancestro con
`overflow:hidden` o `transform` — un bug latente que aparece según dónde se monte.

`ui/Drawer` y `ui/Modal` ya resuelven Portal, scroll-lock, focus-trap, devolución
de foco, Esc y la escala de `lib/z`. El trabajo es adoptarlos, no escribirlos.

## Cómo se verifica cada migración

**Ya está automatizado.** El contrato vive en
`src/components/ui/__tests__/overlay-contract.tsx` y el test de un overlay
migrado son tres líneas:

```tsx
const contrato = overlayContract(onClose => <MiPanel open onClose={onClose} />)
it('cierra con Escape', contrato.cierraConEsc)
// …las otras cinco
```

El helper tiene su propio self-test (`overlay-contract.test.tsx`): afirma que las
seis aserciones **fallan** sobre un overlay armado a mano. Sin eso el contrato
sería decoración. De hecho la primera versión de `devuelveElFoco` pasaba sobre el
overlay roto —el foco "seguía" en el disparador porque nunca se había ido— y lo
cazó el self-test; ahora afirma el ciclo completo.

Las seis cosas que comprueba, ninguna visible en una captura:

1. cierra con **Esc**
2. `body` queda en `overflow: hidden` mientras está abierto y **restaura el valor
   previo** al cerrar (no un hardcode)
3. el foco entra al panel al abrir
4. salió del disparador al abrir **y** volvió al cerrar
5. el nodo es hijo de `body` (Portal), no del árbol donde se declaró
6. declara `aria-modal`

Aplicado ya a `Modal`, `Drawer` y `AIChatPanel` — el primer consumidor migrado.

---

## Tanda 1 — Pickers y modales puros ✅ HECHA

**5 archivos · riesgo bajo · migración casi mecánica**

Son "elegí algo y cerrá": no tienen estado compartido con la página.

- `components/tasaciones/shared/PropertiesPickerModal.tsx`
- `components/tasaciones/shared/SoldPropertiesPickerModal.tsx`
- `components/sold-properties/SoldPropertyPicker.tsx`
- `components/landings/PropertyPhotoPicker.tsx`
- `components/landings/NewLandingModal.tsx`

Los dos primeros ya se sabe que son **la misma pantalla duplicada** (se
tokenizaron juntos en `e39b3ed`). Al migrarlos, evaluar si colapsan en un solo
componente con una prop de origen — eso sí es una decisión de producto, no
mecánica.

## Tanda 2 — Drawers de landings ✅ HECHA

**2 archivos · riesgo bajo**

- `components/landings/ConfigDrawer.tsx`
- `components/landings/VersionsDrawer.tsx`

Van a `ui/Drawer`, que ya tiene los slots `header` y `padded` agregados en
`716510f`. Si alguno necesita un footer fijo, `Drawer` ya lo soporta.

## Tanda 3 — Modales embutidos en pantallas ✅ HECHA (02/09/2026)

Los 5 archivos usan `ui/Modal`; cero overlays a mano. Los `fixed inset-0`
transparentes del atrapa-clicks siguen ahí, como dice el plan: no son modales.

**4 archivos · 6 overlays · riesgo medio**

- `app/(dashboard)/leads/page.tsx` (2)
- `app/(dashboard)/leads/[id]/page.tsx` (2)
- `app/(dashboard)/contactos/[id]/page.tsx` (1)
- `app/(dashboard)/calendario/page.tsx` (1)
- `app/(dashboard)/admin/objetivos/page.tsx` (1)

Más delicado porque el markup del modal está mezclado con el de la página y
comparte estado. Conviene extraer cada uno a su propio componente **antes** de
migrarlo: dos pasos chicos y verificables en vez de uno grande.

**Ojo:** `leads/page.tsx` y `leads/[id]` también tienen un `fixed inset-0`
transparente que es el atrapa-clicks del selector de etiquetas. **Ése no se
migra** — no es un modal. Lo mismo en `components/properties/PropertyFilters.tsx`.

## Tanda 4 — Casos especiales ✅ HECHA (03–04/09/2026)

Los 5 usan `ui/Modal` o `ui/Drawer`. Los tres que el plan marcaba como
delicados necesitaron un prop que el DS no tenía, y por eso mismo estaban
armados a mano: `Drawer side="left"` (nav móvil), `Modal align="top"` (paleta
⌘K) y `Modal header` (onboarding).

**El onboarding perdió su fade de entrada.** Ningún overlay del DS tiene
transición, y meterle una toca todos los overlays de la app, así que se decidió
aparte y se aceptó la pérdida.

**4 archivos · riesgo alto, decidir uno por uno**

- `components/layout/GlobalSearch.tsx` — paleta de comandos con atajo de teclado
- `components/layout/MobileHeader.tsx` — menú lateral de navegación
- `components/onboarding/OnboardingModal.tsx` — alto fijo por paso, footer
  condicional (ver reglas 17 y 12)
- `components/configuracion/WebhooksSection.tsx`
- `components/tasaciones/admin/TemplateEditor.tsx`

Los tres primeros ya manejan Esc a mano, así que la ganancia es Portal +
focus-trap + una sola definición. Pero tienen comportamiento propio y hay que
mirar si `Modal`/`Drawer` los cubre sin inventar variantes — si no, se marca
`ds-todo` y se decide en tanda (ver regla del proyecto en `.claude/CLAUDE.md`).

Aparte: `tasaciones/editor/EditorShell.tsx` y `EditableCanvas.tsx` tienen
`fixed inset-0` sin scrim (el preview móvil y la barra flotante). Revisar qué son
antes de decidir si migran.

## Tanda 5 — Botones ✅ HECHA (04/09/2026)

**Resultado: 0 botones nativos sin resolver en nuestros archivos** (de 161).
Los 22 que sigue contando el ratchet son 19 de archivos que Ezequiel tocó esta
semana —afuera a pedido de Paula— y 3 de páginas públicas.

Tres cosas no eran botones y fueron a donde correspondía:

| Era | En realidad era | Dónde |
|---|---|---|
| `<button role="switch">` con `bg-green-500` | `Switch` | WebhooksSection |
| `<button role="switch">` con `focus:outline-none` | `Switch` | StepVariableBlocks |
| fila de chips con estado activo | `PillCheckGroup` | configuracion/objetivos |

Y un CTA con degradado rosa→naranja pasó a `Button variant="primary"` (rosa
sólido): el gradiente de marca sólo sigue permitido como superficie dentro de
`components/ui`. **Es un cambio visible.**

### Las tres trampas del conversor, para el próximo que automatice esto
1. `Button size="icon"` trae `p-2`. Un botón sin padding propio CRECE y corre el
   espaciado de su fila: hay que ponerle `p-0`.
2. Un regex `<button[^>]*>` se corta en el `>` de las arrow functions
   (`onClick={() => x}`). Hay que recorrer la etiqueta balanceando llaves y
   comillas, o el `p-0` no se aplica y no te enterás.
3. `bg-danger/10` es un tinte sobre un botón fantasma, NO la variante
   destructiva. Confundirlos convierte un ícono con matiz rojo en un botón rojo
   macizo.

## Tanda 5 — Botones (plan original)

**~186 `<button>` a mano, de los que la mitad o dos tercios son deuda real**

No todos están mal: la barra flotante de `EditableCanvas` (18) es un componente
local legítimo, ya marcado `ds-todo`, y un atrapa-clicks también es un `<button>`
correcto. Antes de migrar, clasificar.

Orden por concentración:

| Archivo | `<button>` |
|---|---|
| `tasaciones/editor/EditableCanvas.tsx` | 18 — probablemente se quedan |
| `app/(dashboard)/leads/page.tsx` | 15 |
| `app/(dashboard)/leads/[id]/page.tsx` | 9 |
| `app/(dashboard)/calendario/page.tsx` | 9 |
| `components/configuracion/WebhooksSection.tsx` | 7 |
| `app/(dashboard)/configuracion/objetivos/page.tsx` | 6 |

**`leads` es la prioridad**: 24 entre sus dos archivos, y es la pantalla que más
se usa. La fase 5 le tocó las cards y el header; el resto de la página sigue a
mano.

## Tanda 6 — Inputs ✅ HECHA (04/09/2026)

**Resultado: 0 inputs nativos sin resolver en nuestros archivos.** De los 21 que
había, 3 se migraron (`Select` y `Checkbox` en BlockAdminForm, el título del
wizard de campañas y el buscador ⌘K) y **7 son huecos reales del DS**, marcados
con `ds-todo` en vez de forzados:

| Hueco | Dónde | Candidato |
|---|---|---|
| control de archivo | ImageUpload, SoldPropertyForm, ComparableCard | `FileInput` |
| selector de color | EditableCanvas, FunnelChartForm | `ColorInput` |
| campo sin caja sobre el lienzo | EditableCanvas | variante `inline` del Input |
| checkbox cuyo nombre accesible está afuera | StepVariableBlocks | `aria-label` en Checkbox |

Los 15 que sigue contando el ratchet son 7 de archivos que Ezequiel tocó esta
semana (afuera a pedido de Paula) y 8 de páginas públicas (`/v/`, `/f/`), que
esperan la decisión de si siguen el DS o tienen identidad propia.

Dos migraciones arreglaron algo de paso: el título del wizard y el buscador ⌘K
tenían `outline-none`, que se come el anillo de foco del teclado, y el buscador
además no tenía nombre accesible.

### Lo que NO se tocó, a propósito
El micro-label en mayúsculas (`uppercase tracking-wide`) tiene **82 usos** en la
app: es un patrón establecido, no drift, y el DS no tiene componente para él.
Migrar uno solo lo habría dejado distinto de los otros 81. Anotado como ítem
aparte, fuera de esta fase.

## Tanda 6 — Inputs (plan original)

**22 `<input>`, 3 `<select>`, 3 `<textarea>`**

Ahora es viable en todos los casos: `Input`, `Textarea` y `Select` pasaron a
`forwardRef` en `716510f`, así que ya no hay razón técnica para usar el nativo
cuando se necesita enfocar por código. Ésa era la causa real del textarea a mano
del `AIChatPanel`.

Buscar también `focus:outline-none`, que se come el anillo de foco del teclado.

---

## Enforcement: eran dos ratchets nuevos, terminaron siendo cuatro

Los cinco de antes miden apariencia y no detectan nada de esta fase. Sumados a
`scripts/ds-color-lint.mjs`, hoy son **nueve en total**:

**6. Overlays a mano** — hecho. `inset-0` con fondo translúcido, fuera de
`src/components/ui`. **Arrancó en 19; con las tandas 1 y 2 bajó a 12.**
Objetivo 0. No cuenta el `inset-0` transparente que sirve de atrapa-clicks de un
dropdown, que es un uso legítimo.

**7. Inputs nativos** — `<input>`/`<select>`/`<textarea>` fuera de
`src/components/ui` y de las superficies externas ya excluidas. Arrancó en 28,
hoy 15.

**8. Botones nativos** — el plan decía que "no conviene todavía: hay demasiados
usos legítimos y el número solo no distingue". Se puso **después** de clasificar
en la tanda 5, que es justo lo que el plan proponía. Arrancó en 161, hoy 22.

**9. Diálogos nativos** — `confirm`/`alert`/`prompt`. No estaba en el plan
original: apareció al migrar los overlays, porque `ConfirmDialog` armaba el suyo
a mano y el contador no lo veía —el chequeo excluía `components/ui`, exclusión
que tiene sentido para colores pero no para comportamiento—. Arrancó en 24, hoy
3 (regla 29).

**Los que NO se pusieron, y por qué importa.** Un ratchet sólo sirve sobre un
patrón que YA tiene alternativa en el DS y que se puede detectar sin falsos
positivos. Sobre uno que no la tiene, no protege nada: bloquea trabajo legítimo
hasta que alguien decida el componente. Quedaron sin ratchet a propósito:

- los **29 "Volver" armados a mano** y los **82 micro-labels**
  `uppercase tracking-wide` — no hay componente del DS que los reemplace;
- la **regla 30** (acción de pestaña vs de pantalla) — no hay patrón mecánico
  que las distinga;
- la **regla 31** (`StepCard`) — el patrón a cazar sería
  `rounded-full bg-primary text-white`, y choca con el "hoy" del calendario,
  donde `primary` sí corresponde porque es un estado;
- la **regla 32** (`getCurrentUser` en el render) — `getCurrentUser` sigue
  siendo correcto adentro de un handler o un efecto, así que contar llamados
  marcaría los usos buenos.

Esas cuatro se verifican con tests, no con contadores.

## Decisiones

Resueltas por Paula el 01/09/2026:

- **Los dos pickers de propiedades se unifican** en un componente con una prop de
  origen, en vez de migrarlos por separado. El motivo: comparten toda la
  estructura (buscador, filtros, lista, empty state) y difieren sólo en qué API
  llaman y qué campos muestran, así que hoy cada bug hay que arreglarlo dos veces.
- **La barra flotante de `EditableCanvas` queda como deuda**, no como componente
  local legítimo. Sigue contando en la tanda 5 y sigue marcada `ds-todo` como
  candidata a `BubbleToolbar`. Cuando llegue el turno, se decide si la variante
  entra al DS.

### Pendiente de Ezequiel — ¿las páginas públicas siguen el DS?

Las rutas cortas son documentos que ve el **cliente**, no la app interna:

| Ruta | Qué es | Colores sueltos |
|---|---|---|
| `/r/[slug]` | Reporte de propiedad | 14 |
| `/v/[slug]` | Ficha de visita | 5 |
| `/u/[token]` | Cancelar suscripción de mails | 2 |
| `/t/` `/f/` `/p/` `/l/` | tasación, ficha, prefactibilidad, landing | 0 |

Hoy **sólo `/r/` está excluida** del ratchet de color, por decisión del
01/09/2026. `/v/` y `/u/` son el mismo caso y siguen contadas: quedó incoherente.

La pregunta de fondo es de producto, no de código: **¿estas páginas se ven como
la app, o tienen identidad visual propia?** Los renderers de tasación
(`tasaciones/renderer`) y las landings públicas ya están excluidos porque tienen
identidad por org/propiedad. Si la respuesta es la misma, salen las tres y las 21
líneas quedan como deuda anotada. Si no, hay que volver a incluir `/r/` y migrar
las 21.

**No decidir esto no bloquea la fase 6** — ninguna tanda toca esas rutas.

## Sugerencia de secuencia (cumplida)

Se siguió el orden propuesto: tandas 1 y 2 primero (riesgo bajo, validaron el
checklist), después la 5 acotada a `leads`, y las 3 y 4 al final. El paso previo
de extraer cada overlay a su componente resultó innecesario en la mayoría: el
markup se pudo envolver en `Modal` en el lugar.

## Lo que queda — seis decisiones de diseño, no trabajo de migración

Quedan **14** `ds-todo` (`grep -rn ds-todo vendepro-frontend/src`) en cuatro
grupos. Los dos que eran "falta un componente" ya están hechos; los cuatro que
quedan son "¿esto merece existir en el DS o se queda local?", que es una
pregunta distinta:

| Decisión | Cuántos | Qué falta decidir |
|---|---|---|
| ~~`FileInput`~~ | ~~3~~ | ✅ **Hecho el 08/09/2026.** Creado y aplicado en los 3. De paso arregló dos bugs que los tres resolvían distinto: la misma foto no se podía elegir dos veces (`ImageUpload`) y el input quedaba fuera del tab order (los tres). Regla 33. |
| ~~`ColorInput`~~ | ~~2~~ | ✅ **Hecho el 08/09/2026.** `aria-label` obligatorio en el tipo: `FunnelChartForm` lo tenía sin ninguno. Regla 33. |
| Editor de tasación | 5 | `BubbleToolbar`, toggle de barra ×2, campo inline sobre el lienzo, inputs `size="sm"`. ¿Entran al DS o se quedan locales al editor? |
| Superficies oscuras de la tasación | 4 | 3 tonos sin mapeo + la portada legacy A4. |
| Sueltos | 5 | WhatsApp sin número, converger `ContactSelector`, `Modal initialFocus`, toggle de par en 24px, CTA sin destino. |

Más la de producto de la sección anterior (las páginas públicas), que desbloquea
11 controles nativos y **no bloquea nada** mientras no se decida.
