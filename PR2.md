## Por qué este PR existe ahora y no al final de la fase 6

Contiene **un fix de una regresión que ya está en producción**, así que conviene
que salga antes que el resto de la fase 6.

## 1. Fix: no se podía entrar a un contacto desde la tabla

Reporte de Paula sobre producción: *"al hacer click en un contacto no puedo entrar
desde esta tabla"*.

Es una regresión introducida en la fase 5. Cuando `Table` ganó el slot `actions`,
lo puse en hover-reveal (`md:opacity-0 md:group-hover:opacity-100`) para bajar
ruido visual. Para eliminar o duplicar eso está bien. Pero en `/contactos` el
chevron de "Ver detalle" vivía en ese mismo slot, y era **la única señal visible
de que la fila se podía abrir**. Al esconderlo, la tabla quedó sin affordance: el
nombre es un `<Link>` pero va en `text-ink`, así que no se lee como link.

**El arreglo:**

- `Table` gana `rowHref`. La fila entera navega —cursor de mano, hover marcado— y
  el chevron queda **siempre visible** al final. Un click sobre un `<a>` o
  `<button>` de adentro de la fila no dispara la navegación.
- `actions` queda explícitamente para acciones **secundarias** y sigue en hover.
  El contrato está escrito en el docblock del componente y en el hint de la
  galería, con el motivo, para que no se repita.
- Auditadas las demás tablas de la app: `/contactos` era la única con navegación
  metida en `actions`.

**6 tests nuevos**, que es justo la cobertura que faltaba: que el chevron no
tenga `opacity-0`, que apunte a la URL de la fila, que la fila navegue, que un
botón de adentro **no** navegue, que las acciones secundarias **sí** se escondan,
y que sin `rowHref` la fila no sea clickeable.

## 2. Fase 6, tanda 5 — los botones a mano de `leads`

`leads` era el peor de la app: **24 `<button>` a mano** entre sus dos archivos, en
la pantalla que más se usa. La fase 5 le había tocado las cards y el header; el
resto seguía a mano.

Clasifiqué antes de migrar, porque no todos estaban mal. **Quedan 7 a propósito**:
filas de lista seleccionables, ítems de menú de dropdown, y chips de etiqueta cuyo
color viene del dato por `style`. Ahí un `<button>` es lo correcto.

De arrastre salieron colores sueltos escondidos en esos botones: `bg-pink-600` en
un CTA a mano, `text-green-700`, y cinco `text-brand-pink` en links de teléfono,
mail y "Volver".

También el modal "Cerrar comprador" de `/leads/[id]` pasa a `ui/Modal` — es de la
tanda 3, pero estaba en el mismo archivo y hacer dos pasadas era peor.

**Una regresión que introduje y corregí antes de commitear:** al pasar las celdas
de la barra de acciones de la card a `Button`, su `px-4` cuenta para el ancho
mínimo del flex, así que las celdas de texto quedaban 32px más anchas que las de
`CallButton`/`WhatsAppButton` y la barra dejaba de estar repartida en partes
iguales. Medido: 134px vs 102px; con `px-0`, las cuatro miden 118. No se notaba en
una captura.

## Verificación

- `tsc --noEmit` limpio
- **202 tests** en 24 archivos
- `npm run lint`: 0 errores
- 7 ratchets en baseline. Overlays 12 → 11, colores 106 → 104

## Dónde queda la fase 6

| Tanda | Estado |
|---|---|
| 1 · Pickers y modales puros | hecha (en `main`) |
| 2 · Drawers de landings | hecha (en `main`) |
| 3 · Modales embutidos | 1 de 5 acá; quedan `contactos/[id]`, `calendario`, `admin/objetivos` y 2 en `leads/page.tsx` |
| 5 · Botones | `leads` hecho acá |
| 4 y 6 | pendientes |

Plan completo en [`doc/ds-plan-fase6.md`](doc/ds-plan-fase6.md).
