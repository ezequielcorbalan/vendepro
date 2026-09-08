# 🧱 Catálogo de componentes — Frontend

Todos los componentes en `src/components/`, agrupados por carpeta.

## `auth/`

- **`AuthProvider.tsx`** — Provider de contexto de autenticación (client)

## `layout/`

- **`Sidebar.tsx`** — Barra lateral con secciones del menú (usa [[Frontend-lib|nav-config.ts]]). Filtra por rol; los ítems de módulos que la org no tiene en su plan se ven apagados y con candado.
- **`MobileHeader.tsx`** — Header responsive con drawer
- **`GlobalSearch.tsx`** — Búsqueda global cross-entity (usa `[[API-analytics]] /search`)
- **`NotificationBell.tsx`** — Badge + dropdown (usa `[[API-admin]] /notifications`)

## `ui/` — el design system (50 archivos)

> Galería viva en la ruta **`/design-system`** (pública, sin datos). Plan y
> decisiones de contrato en `doc/ds-plan.md` y `doc/ds-review.md`.
> Regla: color → token, texto → `Heading`/`Text`, dominio → `lib/crm-config.ts`.
>
> **Las 31 reglas con ❌/✅ y su grep de auditoría están en
> `doc/ds-visual-rules.md`** — es el documento operativo, más al día que este
> catálogo. Nueve ratchets con baseline en `scripts/.ds-*-baseline` las traban en
> CI (`npm run lint:ds`): no fallan por lo que ya existe, fallan si un cambio
> sube el número.

**Moldes de página y de card**
- **`PageHeader`** — header estándar de TODA pantalla (título + subtítulo + acciones).
  Si la pantalla tiene pestañas, la acción de una pestaña NO va acá: va adentro
  del panel que le corresponde (regla 30).
- **`DetailHeader`** (+ `DetailMeta`) — encabezado de una pantalla de DETALLE
  (un contacto, un lead, una propiedad). Es a la ficha lo que `PageHeader` es a
  un listado. Existe porque el detalle de contacto y el de lead habían quedado
  con dos diseños distintos del mismo objeto.
- **`ActionGroup`** — grupo de acciones de un header con desborde automático:
  con más de `max` quedan visibles las últimas `keep` y el resto va al menú de
  tres puntos. Lo usa `PageHeader` por dentro.
- **`WidgetHeader`** — el equivalente a escala de card: medallón + título + subtítulo/badge + acción
- **`Card`** (+ `CardHeader`, `CardTitle`) — superficie blanca estándar
- **`Typography`** — `Heading` (1–4) y `Text` (size/weight/tone)

**Acciones**
- **`Button`** — `variant`: `primary | outline | ghost | neutral | success | danger`.
  Con `href` renderiza un `<Link>` con el mismo estilo.
- **`ContactButtons`** — `CallButton` / `WhatsAppButton` (el color del canal vive acá)

**Formularios**
- **`Input`** — `Field` + `Input` / `Textarea` / `Select` (Field propaga el error por contexto)
- **`Choice`** — `Checkbox` / `RadioGroup` · **`ChoicePills`** — chips seleccionables
- **`Switch`** · **`OptionCard`** — tarjeta seleccionable (`row` | `stack`)

**Navegación y pasos**
- **`Tabs`** — subrayado inferior. Con `href` en el item, navega (`<Link>`)
- **`SegmentedControl`** — cambio de vista (soporta `icon`)
- **`StepIndicator`** — wizard HORIZONTAL, un paso por vez: `numbered` (canónica) | `dots` (compacta)
- **`StepCard`** — wizard VERTICAL, todos los pasos a la vista, cada uno en su
  `Card` con su número. Son dos componentes distintos a propósito:
  `StepIndicator` sirve cuando el orden es obligatorio, `StepCard` cuando podés
  leer los tres pasos y ejecutar el que quieras (regla 31).
- **`Progress`** — `ProgressBar`

**Datos**
- **`Table`** — `columns` + `actions` (hover-reveal) + `renderMobileCard` + `footer`
- **`StatTile`** — KPI (con `emphasis` y `badge`) · **`Charts`** — Bar / Donut / Funnel
- **`Timeline`** · **`Kanban`** · **`PropertyCard`**

**Badges y chips**
- **`Badge`** (tonos semánticos) · **`StatusBadge`** (genérico, color del mapa de dominio)
- **`StageBadge`** / **`PropertyStageBadge`** / **`OperationBadge`** / **`EventChip`** — leen de `crm-config`
- **`Tag`** · **`Avatar`** · **`IconMedallion`** (+ `BrandAccentBar`)

**Superposiciones**
- **`Modal`** · **`Drawer`** · **`Dropdown`** · **`Tooltip`** · **`Portal`** · **`useOverlay`**
- **`useConfirm`** (+ `ConfirmDialog`) — confirmación con la marca, basada en
  promesas. **Es obligatoria antes de algo destructivo: nunca `confirm()`
  nativo** (regla 29). `ConfirmDialog` ya no es legacy — se apoya en `Modal`
  desde el 04/09/2026, así que hereda Portal, scroll-lock, focus-trap y Esc, y
  está bajo `overlayContract`.
- **`Toast`** — `ToastProvider` + `useToast()` · **`Notifications`** — campana + panel

**Estados**
- **`Alert`** — callout con tonos `info | success | warning | danger | brand`
- **`EmptyState`** — ícono + título + descripción + acción

**Selectores de entidad**
- **`ContactSelector`** / **`PropertySelector`** / **`LeadSelector`** — dropdown con búsqueda
- **`AgentSelector`** — elegir de quién mirar los números. Filtra en memoria, no
  contra la API: el equipo son decenas de personas y ya vienen cargadas.
- **`WhatsAppTemplatePicker`** — paso 2 del botón de WhatsApp: elegir el mensaje
  antes de abrir el chat. Modal y no popover, porque el botón vive dentro de
  cards y columnas de kanban con overflow.
- **`PhotoGallery`** — lightbox de fotos

## `ai/`

- **`AIChatPanel.tsx`** — Panel chat IA dentro de leads (puede editar el lead con IA)
- **`AIFloatingButton.tsx`** — Botón flotante para abrir el chat (en el `(dashboard)/layout`)

## `marketing/`

- **`wizard/EmailCampaignWizard.tsx`** — wizard de campaña (audiencia → contenido → revisión)
- **`GtmScript.tsx`** — inyección de Google Tag Manager
- El builder de automatizaciones ya NO vive acá: se reescribió en
  `app/(dashboard)/configuracion/automatizaciones/_components/`.

## `properties/`

Widgets que viven dentro del detalle de propiedad:

- `PropertyFilters.tsx` — Filtros tabla
- `AuthorizationWidget.tsx` — Mandato del propietario (fechas)
- `DocChecklistWidget.tsx` — Checklist de documentos requeridos
- `PriceHistoryWidget.tsx` — Gráfico Recharts del historial
- `ReportsListWidget.tsx` — Lista de reportes mensuales
- `VisitFormsSection.tsx` — Tabs de formularios de visita

## `reports/`

- `ActiveListingsTable.tsx` — Tabla de avisos activos
- `DiagnosisCard.tsx` — Card de diagnóstico (estado + recomendaciones)
- `HealthBadge.tsx` — Badge semáforo (red/orange/yellow/light_green/green) — usa [[Frontend-lib|semaforo.ts]]
- `NeighborhoodBenchmarkTable.tsx` — Benchmark de zona

## `marketing/`

- `GtmScript.tsx` — Inyecta script GTM client-side
- `dataLayer.ts` — Helpers para `window.dataLayer.push({...})`

## `landings/` — Builder de landings

Ver [[Frontend-editor-landings]].

### Editor

- `EditorToolbar.tsx`, `BlockListSidebar.tsx`, `BlockRenderer.tsx`, `InspectorPanel.tsx`
- `ConfigDrawer.tsx`, `VersionsDrawer.tsx`, `PublishReviewBanner.tsx`, `StatusBadge.tsx`
- `LandingCard.tsx`, `NewLandingModal.tsx`, `LandingMobileInfo.tsx`
- `ImageUpload.tsx`, `PropertyPhotoPicker.tsx`

### Bloques editables (`blocks/`)
HeroBlock, HeroSplitBlock, FeaturesGridBlock, AmenitiesChipsBlock, GalleryBlock, BenefitsListBlock, LeadFormBlock, FooterBlock.

### Renderer (`renderer/`)
- `BlockRenderer.tsx`, `TemplateRenderer.tsx`
- `renderer/blocks/*.tsx` — 25+ bloques para tasaciones también: cover, agent contact card, comparable list, funnel chart, market stats, methodology, etc.

### Public
- `public/PublicLandingShell.tsx` — Wrapper de landing pública
- `public/Tracker.tsx` — Tracker de eventos (envía a `[[API-public]] /l/:slug/event`)

### Analytics
- `analytics/AnalyticsDashboard.tsx`

## `tasaciones/` — Editor + Renderer

Ver [[Frontend-editor-tasaciones]].

### Editor (`editor/`)
- `BlockForm.tsx`, `BlockList.tsx`, `SyncBanner.tsx`
- Hooks: `useAutosave.ts`, `useEditorState.ts`
- `block-forms/` — **14 editores específicos** por tipo de bloque (cover, agent contact card, comparables list, cta whatsapp, methodology, work conditions, etc.)

### Renderer (`renderer/`)
- `BlockRenderer.tsx`, `TemplateRenderer.tsx`
- `block-utils.ts`, `hydrate-blocks.ts`, `types.ts`
- `blocks/` — **18 bloques** renderizables (cover, agent contact, comparables, cta whatsapp, funnel chart, market stats, methodology, notary charts, price projection, property data, proposal commercial, services grid, swot, video gallery, work conditions, zone map, unknown)

### Admin (`admin/`)
- `BlockAdminForm.tsx`, `OrgConfigForm.tsx`, `TemplateEditor.tsx`, `TemplatesHome.tsx`
- `VariableModal.tsx`, `VariablesHome.tsx`
- `MOCK_APPRAISAL.ts` — mock data

### Legacy / shared
- `legacy/PublicAppraisalShell.tsx`
- `shared/api.ts`

## `onboarding/` — Wizard 8 pasos

- `OnboardingModal.tsx`, `StepIndicator.tsx`
- `steps/`: `Step1Welcome`, `Step2Pipeline`, `Step3Leads`, `Step4Tasaciones`, `Step5Propiedades`, `Step6Calendario`, `Step7Reportes`, `Step8Ready`

Estado persistido en localStorage (`isOnboardingDone(userId)` en [[Frontend-lib|auth.ts]]).
