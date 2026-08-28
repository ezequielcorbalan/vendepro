# Plan maestro — Design System de VendéPro

Roadmap de punta a punta: construir el design system y después migrar la app.
Detalle de la metodología de revisión/migración en [`ds-review.md`](./ds-review.md).
Muestrario estático (spec visual): [`design-system.html`](./design-system.html).
Galería viva (componentes reales): ruta `/design-system`.

## Idea de fondo (por qué este orden)
El estilo **vive en los tokens y los componentes**, no en cada pantalla. Por eso:
- Los **cambios de contrato** (tokens, nombres de props/variantes, qué componentes existen) se hacen **antes** de migrar — cambiarlos después toca cada pantalla.
- Los **cambios visuales** (padding, tono, sombra) se hacen **después** de migrar — viven en un solo lugar y se propagan gratis.

Regla para clasificar cualquier corrección:
- 🔴 **Estructural** → cambia cómo se *usa* (props/variantes) o el *inventario* de componentes/tokens. Se resuelve antes de migrar.
- 🟡 **Visual** → cambia cómo se *ve* algo que ya existe, sin tocar cómo se usa. Va al pase final.

## Dónde vive cada cosa
| Capa | Lugar | Ejemplo |
|---|---|---|
| Tokens (foundations) | `src/app/globals.css` (`@theme`) | color, primary, semánticos |
| Componentes | `src/components/ui/*.tsx` | Button, Badge, Card, Heading… |
| Config de dominio | `src/lib/crm-config.ts` | etapas del lead, tipos de evento |
| Galería viva | `src/app/design-system/page.tsx` (`/design-system`) | muestra los componentes reales |
| Spec visual | `doc/design-system.html` | referencia estática de 33 secciones |

---

## Fase 0 — Setup ✅ hecho
- [x] Muestrario estático como spec visual (`doc/design-system.html`).
- [x] Galería viva `/design-system` (pública en middleware, sin datos).
- [x] Convención: `cn` de `@/lib/utils`, variant maps, sin barrels, `'use client'` solo si hace falta.

## Fase 1 — Foundations / tokens ✅ hecho
- [x] **Color**: marca, `primary` (token semántico), paleta genérica por color, semánticos (`success/warning/danger/info/neutral`).
- [x] **Tipografía**: componentes `Heading` (1–4) y `Text` (size/weight/tone). Escala en un solo lugar.
- [x] **Radios**: tokens `--radius-control` (8px) y `--radius-card` (12px) → `rounded-control`/`rounded-card`. Componentes migrados. `rounded-full` queda para pills/círculos.
- [x] **Sombras**: tokens `--shadow-card` (superficies) y `--shadow-pop` (flotantes). Componentes migrados.
- [ ] **Espaciado**: documentar la escala base-4 oficial (no necesita tokens nuevos, Tailwind ya la trae). *(pendiente menor)*
- **Listo:** cambiar un token de foundation se refleja en toda la galería y la app. ✓

## Fase 2 — Componentes: construir + revisar ✅/🟡
- [x] Construidos (`src/components/ui`): Button, Badge, Card, Input/Field/Select/Textarea, Avatar, StageBadge, EventChip, Tabs, SegmentedControl, Switch, Checkbox/RadioGroup (Choice), Tag, Modal, Tooltip, Dropdown, Table, Drawer, Timeline, Progress, EmptyState, Notifications, Kanban, PropertyCard, Charts, Heading/Text.
- [x] Color migrado a tokens en todos los `ui/` (sin colores semánticos sueltos).
- [x] **Auditoría de APIs**: convención `variant` (estilo) / `tone` (color) / `size` (tamaño) / booleanos — ya se cumple en todos.
- [ ] **Revisión visual con rúbrica** componente por componente (en curso, la maneja Paula): hallazgos 🟡 para la Fase 5.
- [ ] **Inventario**: ¿falta alguno que la app use? (ej. Pagination, Accordion, Breadcrumb, DatePicker, FileUpload). *(revisar al migrar)*

## Fase 3 — Congelar el contrato (APIs) ✅ hecho
- [x] Convención de props auditada y **documentada** en `ds-review.md` (Contrato de API).
- [x] `variant`/`tone`/`size` consistentes; `className` aditivo; color→token, texto→Heading/Text, dominio→crm-config.
- [x] `npx tsc --noEmit` en verde.
- [x] Legacy a reemplazar identificado: `ConfirmDialog` → `Modal`.
- **Listo:** las APIs no cambian más. Ya se puede migrar. ✓

## Fase 4 — Refactor del front (migración) ⬜
Reemplazar los usos inline por los componentes/tokens. Escala real hoy: **~101 archivos** con color inline, **~107** con `<button` inline.
- [ ] Inventariar por módulo (grep). Ver comandos en `ds-review.md`.
- [ ] Orden sugerido (más usado / menos riesgo primero):
  1. `Button`  2. `Badge`/`StageBadge`/`EventChip`  3. `Input`/`Field`/`Select`  4. `Card`  5. `Heading`/`Text`  6. resto (Modal, Tabs, Table, Drawer…).
- [ ] **Un commit chico por pantalla/módulo**, solo migración (sin retoques visuales).
- [ ] Por cada pantalla: reemplazar → `tsc` verde → ver en dev (mobile + desktop) → commit.
- **Listo cuando:** las pantallas usan los componentes y no quedan clases inline equivalentes.

### Ensayo hecho — pantalla `perfil` (aprendizajes del método)
- [x] Migrada `src/app/(dashboard)/perfil/page.tsx` (Heading/Text, Card, Field+Input, Button). `tsc` verde.
- **`tsc` es la red de seguridad**: cachea props mal pasadas al reemplazar inline por componentes.
- **Pantallas con auth**: no se pueden screenshotear sin login; verificación = tsc + (opcional) login en el preview.
- **Override de utilidades base**: al pisar padding/otros, usar `padded={false}` (o el flag correspondiente) porque `cn` no mergea (sin `tailwind-merge`). Candidato futuro: sumar `tailwind-merge`.
- **Mapa de decisiones**: botón gris sólido → `variant="outline"` (no se agregó variante `secondary`; contrato queda primary/outline/ghost/danger).

## Fase 5 — Pase visual final 🟡 ⬜
- [ ] Aplicar los hallazgos 🟡 tocando **cada componente/token una sola vez** → se propaga a toda la app.
- [ ] Revisar en pantallas reales (data real, densidad real), mobile/desktop, dark mode si aplica.
- Checklist de reglas (extraídas de los ajustes ya hechos en Dashboard/Leads/Contactos): [`ds-visual-rules.md`](./ds-visual-rules.md).
- **Listo cuando:** el look quedó pulido y consistente en las pantallas de verdad.

## Fase 6 — Gobernanza / mantenimiento ⬜
- [ ] Reglas: color → token; texto → `Heading`/`Text`; dominio → `crm-config`; nada de valores sueltos.
- [ ] Si un patrón se repite (KPI card, fila de contacto), promoverlo a componente.
- [ ] `/design-system` como fuente viva; `design-system.html` como spec.

---

## Cómo trabajamos en cada iteración (el loop)
1. Mirás la galería `/design-system` y pedís un cambio.
2. Lo clasifico 🔴 API / 🟡 estético.
3. Lo aplico (🔴 ahora; 🟡 lo aplico o lo anoto para la Fase 5).
4. Verifico: `npx tsc --noEmit` + render en la galería.
5. Seguís.

## Estado actual (resumen)
- ✅ Foundations de **color**, **tipografía**, **radios** y **sombras** en tokens.
- ✅ **Todos los componentes** construidos y con color tokenizado.
- ✅ **Tanda de decisiones de variantes cerrada** — ver la tabla en [`ds-review.md`](./ds-review.md).
  Salieron: `IconMedallion`, `BrandAccentBar`, `OptionCard`, la utilidad
  `bg-brand-gradient`, `Button variant="success"`, `icon` en `SegmentedControl` y
  `StatusBadge`, `emphasis`/`badge` en `StatTile`.
- ✅ **Segunda tanda cerrada**: el gradiente deja de ser relleno de botón (se
  aplana a `primary`; quedan 0 botones con gradiente) y `Table` se extiende con
  `actions` / `renderMobileCard` / `footer` / `minWidth`.
- ✅ **Tercera tanda cerrada — las decisiones de diseño.** No eran tres steppers
  sino **seis**: se unificaron en `ui/StepIndicator` (`numbered` canónica +
  `dots` compacta), el "hecho" quedó en rosa y no verde, y se borró la copia
  duplicada de `components/onboarding/StepIndicator`. Salió además
  `Button variant="neutral"` (5 botones oscuros inline que nadie había marcado).
  `Card tone="dark"` e `IntegrationBadge` se decidieron **no crear** (1 uso cada
  uno). **No quedan decisiones de contrato pendientes.**
- 🟡 **Fase 4 en curso.** `lint:ds` bajó 198 → **176**.
- ✅ **`components/layout` migrado** (5 archivos que tenían cero adopción del DS
  y se ven en TODA la app): Sidebar, MobileHeader, GlobalSearch, NotificationBell
  y ActivityTabs. Cero `<button>` inline, cero `brand-pink` suelto, cero
  `rounded-lg` (el drift del token de radio). `Tabs` ganó `href` porque había
  **tres copias a mano** del componente sólo porque no sabía navegar. Migradas: las 4 pantallas de `auth/` (que tenían
  cero adopción), `contactos` (primera lista real sobre `Table`), y los 9 sitios
  que estaban marcados con `ds-todo`.
- ⚠️ **Ojo con el orden de la Fase 4**: el 64% de los botones y el 73% del color
  inline NO están en `src/app/` sino en `src/components/<feature>/`
  (`tasaciones/editor`, `landings`, `properties`, `marketing/wizard`, `layout`).
  Migrar "por pantalla" no mueve la aguja. Conviene ir **por carpeta de
  componentes**. Foco con cero adopción del DS: `components/layout`, las 4
  pantallas de `auth/`, y las públicas `app/v` y `app/r`.
- Rama de trabajo: `design/ui-consistency-pass`.
