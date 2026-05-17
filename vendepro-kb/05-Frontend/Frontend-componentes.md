# 🧱 Catálogo de componentes — Frontend

Todos los componentes en `src/components/`, agrupados por carpeta.

## `auth/`

- **`AuthProvider.tsx`** — Provider de contexto de autenticación (client)

## `layout/`

- **`Sidebar.tsx`** — Barra lateral con secciones del menú (usa [[Frontend-lib|nav-config.ts]]). Filtra por rol.
- **`MobileHeader.tsx`** — Header responsive con drawer
- **`GlobalSearch.tsx`** — Búsqueda global cross-entity (usa `[[API-analytics]] /search`)
- **`NotificationBell.tsx`** — Badge + dropdown (usa `[[API-admin]] /notifications`)

## `ui/`

- **`Toast.tsx`** — `ToastProvider` + hook `useToast()`
- **`PhotoGallery.tsx`** — Lightbox de fotos
- **`ContactSelector.tsx`** — Dropdown con búsqueda de contactos
- **`PropertySelector.tsx`** — Dropdown con búsqueda de propiedades

## `ai/`

- **`AIChatPanel.tsx`** — Panel chat IA dentro de leads (puede editar el lead con IA)
- **`AIFloatingButton.tsx`** — Botón flotante para abrir el chat (en el `(dashboard)/layout`)

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
