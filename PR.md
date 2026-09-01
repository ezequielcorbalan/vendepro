## Qué es esto

Pasada de consistencia y componentización del frontend contra el design system.
Sin cambios de backend y sin cambios de funcionalidad: lo que se movió es *cómo*
se ve y de *dónde* sale cada decisión visual.

## Lo más importante que salió

**Había dos definiciones del mismo objeto en varios lugares, y ninguna era "la
decisión" — era que no había componente.**

- El detalle de **contacto** y el de **lead** tenían dos headers distintos del
  mismo objeto: uno con avatar y división, el otro con los datos en un párrafo y
  cinco botones del mismo peso. Ahora los dos (y el de **propiedad**, y el de
  **tasación**) usan `ui/DetailHeader`.
- El picker de propiedades tenía **su propia copia de `PROPERTY_STAGES`**, con
  drift real: `reservada` en ámbar cuando el canónico es violeta. La resolución
  de alias legacy vivía como helper local de una pantalla, así que cualquier otra
  caía al gris. Subió a `resolvePropertyStage()` en `crm-config`.
- El módulo de **tasaciones estaba escrito entero con la escala `slate`** en vez
  de la `gray` del DS: 258 usos en 30 archivos. Por eso "se veía de otro
  producto" sin que se pudiera señalar qué.

## Bugs reales encontrados de paso

| | |
|---|---|
| **12 `alert()` nativos** | bloquean la pantalla y se ven como error del navegador. La app ya tenía `useToast`. Quedan 0 |
| Un `<button>` dentro de un `<a>` | HTML inválido, rompe la navegación por teclado (`NotificationBell`) |
| `line-clamp-2` que no recortaba | `block` le pisaba el `display:-webkit-box`, y por eso las filas de templates quedaban de distinto alto |
| Dos `SegmentedControl` en la misma línea | `space-y` no aplica a elementos `inline-flex` |
| Un botón "con IA" sin `onClick` | no había panel detrás. Dado de baja |
| Un tercer botón redundante en el checklist de docs | los otros dos ya eran toggle, así que "pendiente" era alcanzable. 48 botones → 32 |
| `npm run lint` nunca había funcionado | no existía `eslint.config.mjs`. Ahora corre: 0 errores |

## Enforcement: de 1 ratchet a 5

`scripts/ds-color-lint.mjs` ya evitaba que creciera el color suelto. Ahora también:

| Ratchet | Valor |
|---|---|
| colores Tailwind sueltos | 109 |
| medallones de gradiente a mano | 15 |
| íconos escritos como carácter/emoji | 2 |
| escala `slate` en vez de `gray` | **0** |
| radios pre-token (`rounded-lg`/`xl`) | **0** |

**Ojo con esto:** el contador de color venía **mal medido**. Sólo miraba
emerald/green/red/blue/amber/yellow, y eso dejaba afuera 58 casos — `rose-500` es
un segundo rojo, `pink-*` un segundo primary. El patrón ahora cubre toda la
paleta menos los neutros, así que el número saltó de 94 a 152 sin que nadie
escribiera una línea nueva. De ahí bajó a 109.

## Reglas nuevas (12 a 22)

`doc/ds-visual-rules.md` pasó de 11 a 22 reglas, cada una con ❌/✅ y su grep de
auditoría. Salieron del repaso visual: molde del header de detalle, cuántas
acciones quedan a la vista, medallón por tono, identidad ≠ estado, cards de una
fila, modal multi-paso, paginado, un ícono no es un carácter, una sola escala de
grises, y el `primary` es de la pantalla y no de cada card.

## Merge con main

Traje `main` a la rama y resolví los 3 conflictos **conservando las dos cosas**:
el selector de mensajes de WhatsApp y los filtros que se recuerdan (de #120)
siguen funcionando, sobre la estructura nueva de los headers.

## Verificación

- `tsc --noEmit` limpio
- 147 tests en 18 archivos, todos pasan
- `npm run lint`: 0 errores
- los 5 ratchets en baseline

**Lo que NO pude verificar:** que los formularios de tasación sigan guardando
bien después de cambiar 67 controles nativos por los del DS. Revisé el layout en
pantalla, pero no el guardado con datos reales, y los tests no cubren esos
formularios. **Conviene probar el wizard de tasación de punta a punta antes de
mergear.**
