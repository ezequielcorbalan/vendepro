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
| `variant` | **estilo** estructural/de relleno | según componente | Button `primary\|outline\|ghost\|danger` · Tag `solid\|soft` |
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

## Convenciones de trabajo

- Refactor y ajuste visual **en commits separados** (para poder revertir uno sin el otro).
- Nada de valores sueltos: si un color se repite, va como token en `globals.css @theme`.
- Cambios de color de dominio (etapas, eventos) → siempre en `lib/crm-config.ts`.
