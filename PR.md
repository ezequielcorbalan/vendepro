## Qué es esto

Pasada de consistencia y componentización del frontend contra el design system.
Sin cambios de backend. Dos fases:

- **Fase 5 — apariencia**: color, gradiente, escala de grises, radios, tipografía.
- **Fase 6 — estructura** (a medias): que ningún overlay ni control se dibuje a
  mano cuando el DS ya lo resuelve. Plan completo en
  [`doc/ds-plan-fase6.md`](doc/ds-plan-fase6.md).

## Lo más importante que salió

**Había dos definiciones del mismo objeto en varios lugares, y ninguna era "la
decisión" — era que no había componente.**

- El detalle de **contacto** y el de **lead** tenían dos headers distintos del
  mismo objeto. Ahora los dos (y **propiedad**, y **tasación**) usan
  `ui/DetailHeader`.
- Los **dos pickers de propiedades** eran la misma pantalla escrita dos veces
  (218 y 197 líneas). Ahora la pantalla vive una vez en
  `ComparablePickerModal` y cada fuente aporta lo suyo.
- El picker de propiedades tenía **su propia copia de `PROPERTY_STAGES`**, con
  drift real: `reservada` en ámbar cuando el canónico es violeta. Y aparecieron
  **tres copias** del mapa de orígenes de cierres reales.
- El módulo de **tasaciones estaba escrito entero con la escala `slate`** en vez
  de la `gray` del DS: 258 usos en 30 archivos. Por eso "se veía de otro
  producto" sin que se pudiera señalar qué.

## Accesibilidad: 7 overlays que no se podían cerrar con el teclado

Medido: **19 overlays armados a mano**, de los que 3 cerraban con Esc y **0**
usaban Portal, focus-trap o devolución de foco. `ui/Modal` y `ui/Drawer` ya
resuelven todo eso.

Migrados en este PR: los 2 pickers de comparables, `SoldPropertyPicker`,
`PropertyPhotoPicker`, `NewLandingModal`, `ConfigDrawer`, `VersionsDrawer` y
`AIChatPanel`. **Ratchet de overlays: 19 → 12.**

`AIChatPanel` es el caso que dio nombre a la fase: el pedido fue cambiarle un
color al header, y abajo había un panel modal sin Esc, sin scroll-lock, sin foco,
y un `<textarea>` a mano **con `focus:outline-none`** — que se come el anillo de
foco del teclado. La causa de fondo era del DS: `Input`/`Textarea`/`Select` no
aceptaban `ref`, así que empujaban a escribir el nativo. Ahora usan `forwardRef`.

## Bugs reales encontrados de paso

| | |
|---|---|
| **12 `alert()` nativos** | bloquean la pantalla y se ven como error del navegador. Quedan 0 |
| Un `<button>` dentro de un `<a>` | HTML inválido, rompe la navegación por teclado |
| `line-clamp-2` que no recortaba | `block` le pisaba el `display:-webkit-box` |
| Dos `SegmentedControl` en la misma línea | `space-y` no aplica a elementos `inline-flex` |
| Una clase Tailwind interpolada | `sm:grid-cols-${n}` — Tailwind no genera lo que arma el runtime |
| 4 columnas de 174px en la tasación pública | el bloque saltaba a 4 columnas en `lg` dentro de un contenedor de 1024px |
| Un botón "con IA" sin `onClick` | no había panel detrás |
| Un tercer botón redundante en el checklist de docs | los otros dos ya eran toggle |
| `npm run lint` nunca había funcionado | no existía `eslint.config.mjs` |

## Verificación

- `tsc --noEmit` limpio
- **196 tests** en 23 archivos (arrancó en 147)
- `npm run lint`: 0 errores
- 7 ratchets en baseline, y `ds-color-lint` corre en CI

**El contrato de overlay** (`ui/__tests__/overlay-contract.tsx`) afirma las seis
cosas que un panel modal tiene que hacer y que no se ven en una captura. Tiene su
propio self-test: comprueba que las seis aserciones **fallan** sobre un overlay
armado a mano. Sin eso sería decoración — y sirvió: la primera versión de la
aserción de foco pasaba sobre el overlay roto, porque el foco "seguía" en el
disparador. Nunca se había ido.

## Enforcement: de 1 ratchet a 7

| Ratchet | Valor |
|---|---|
| colores Tailwind sueltos | 106 |
| medallones de gradiente a mano | 12 |
| íconos escritos como carácter/emoji | 2 |
| escala `slate` en vez de `gray` | **0** |
| radios pre-token (`rounded-lg`/`xl`) | **0** |
| overlays armados a mano | 12 |

**Ojo:** el contador de color venía **mal medido**. Sólo miraba
emerald/green/red/blue/amber/yellow, y eso dejaba afuera 58 casos — `rose-500` es
un segundo rojo, `pink-*` un segundo primary. Al corregir el patrón el número
saltó de 94 a 152 sin que nadie escribiera una línea. De ahí bajó a 106.

## Reglas

`doc/ds-visual-rules.md` pasó de 11 a 22 reglas, cada una con ❌/✅ y su grep de
auditoría.

## Pendiente de decisión — para Ezequiel

**¿Las páginas públicas siguen el DS o tienen identidad propia?** `/r/` (14
colores sueltos), `/v/` (5) y `/u/` (2) son documentos que ve el cliente. Hoy
sólo `/r/` está excluida del ratchet, así que quedó incoherente. Detalle en
`doc/ds-plan-fase6.md`. **No bloquea nada de este PR.**

## Sobre los formularios de tasación

Se cambiaron 67 controles nativos por los del DS. El layout se verificó en
pantalla; el **guardado con datos reales lo probó Paula de punta a punta en el
wizard, y funciona**.

Queda anotado que los tests no cubren esos formularios: la verificación fue
manual, no automatizada. Es candidato a tests de la tanda 6.
