# Landings de agente (Feature 07) — Diseño

> Estado: aprobado para plan de implementación · Fecha: 2026-09-01
> Roadmap: Feature 07 — hoy 🔴 en [[Roadmap-estado-implementacion]]

## 1. Problema

Un agente inmobiliario necesita una página propia donde venderse: quién es, qué
credenciales tiene, en qué zonas trabaja, cómo lo contactan. Hoy no existe. El
link que un agente pone en su bio de Instagram es un formulario de tasación
(`ficha_links` con `mode='open'`, `/f/<slug>`), no una presentación personal.

Referencias del negocio (landings reales de la inmobiliaria):
`marcelagenta.com.ar/andresgiunta.html` y `danilarealestate.netlify.app`. Ambas
comparten la misma espina dorsal: hero con foto y propuesta de valor →
credenciales y prueba social → servicios → por qué yo → FAQ → CTA de WhatsApp
repetida. Ninguna de las dos es una ficha de propiedad ni un formulario suelto.

El stack de landings ya está 🟢 en producción (tablas, ~27 use cases, editor con
bloques y versiones, flujo draft→published, tracking Meta/GA4, analytics). El
gap **no es de rendering: es de datos**. `users` tiene `full_name`, `phone`,
`photo_url`, `email` y nada más — no hay con qué llenar un perfil.

## 2. Alcance

**Entra**: perfil público del agente como dato de primera clase, kind
`agent_profile`, 4 bloques nuevos, binding vivo perfil→bloques, URL pública
`/a/<org>/<agente>`, template seedeado, UI de edición del perfil.

**No entra (Fase 2)**: propiedades activas del agente en vivo, testimonios,
guías descargables, blog. Se decidió explícitamente dejarlos afuera.

**Gating**: la landing de agente cuenta como una landing más del módulo
`landings` (plan PRO). No es un módulo nuevo.

## 3. Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Datos del agente | Tabla `agent_profiles` 1:1 con `users` | No mezcla identidad/auth con marketing; `users` la toca todo el sistema |
| Binding | **Vivo, en lectura pública** | El agente edita el perfil una vez y todas sus landings se actualizan |
| URL | `/a/<orgSlug>/<agentSlug>` | Linda para bio de Instagram; el org en el path hace que el slug solo deba ser único por org |
| Invariante lead-form | 0..1 para `agent_profile` | La landing de Andrés Giunta no tiene formulario, solo CTAs de WhatsApp |

Nota sobre el binding: en tasaciones `binding_mode` existe en el envelope del
bloque (`appraisal-block-schemas.ts:209`) pero se resuelve como **snapshot al
crear** (`create-appraisal.ts:63`), y por eso arrastra la deuda de
`data.agent = null` en la página pública. Acá el merge va **en lectura**, en el
use case público. Es la diferencia deliberada con el precedente.

## 4. Datos

### Migración `048_agent_profiles.sql`

```sql
CREATE TABLE IF NOT EXISTS agent_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  headline TEXT,               -- "Coordinador Comercial", "Martillera y Corredora"
  bio TEXT,
  license TEXT,                -- matrícula, ej "CUCICBA 3906"
  years_experience INTEGER,
  zones_json TEXT,             -- ["Villa Urquiza","Saavedra"]
  specialties_json TEXT,       -- ["Residencial","Venta"]
  whatsapp TEXT,
  instagram TEXT,
  tiktok TEXT,
  youtube TEXT,
  linkedin TEXT,
  website TEXT,
  cover_image_url TEXT,
  stats_json TEXT,             -- [{"label":"Seguidores TikTok","value":"170.000"}]
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_profiles_org_slug
  ON agent_profiles(org_id, slug);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_org
  ON agent_profiles(org_id, is_public);
```

No duplica `photo_url`, `phone` ni `email`: esos siguen en `users` y el binding
los lee de ahí. `is_public` es el kill-switch de la URL pública.

### Entidad y value object

- `core/src/domain/entities/agent-profile.ts` — `AgentProfile` con
  `create()` / `fromPersistence()` / `update()`, parseo de los `*_json` a
  arrays tipados.
- `core/src/domain/value-objects/agent-slug.ts` — mismas reglas de forma que
  `landing-slug.ts` (3-60 chars, `a-z0-9` y guiones) pero **sin sufijo**. La
  unicidad la garantiza el índice `(org_id, slug)`, no un sufijo cripto.
- Port `core/src/application/ports/repositories/agent-profile-repository.ts`:
  `findByUserId`, `findByOrgAndSlug`, `existsSlug(orgId, slug, exceptUserId?)`,
  `save`.
- Adapter `infrastructure/src/repositories/d1-agent-profile-repository.ts`.

## 5. Dominio de landings

### Kind

`LandingKind` (`landing.ts:6`) suma `'agent_profile'`. Actualizar también
`LandingFilters.kind` en `landing-repository.ts`, que hoy repite el union a mano
(`'lead_capture' | 'property'`) en vez de usar `LandingKind`.

### Invariante de lead-form por kind

Hoy `Landing.create()` (`landing.ts:59`) y `replaceBlocks()` (`landing.ts:124`)
exigen **exactamente un** `lead-form`. Se extrae a `landing-rules.ts`:

```ts
export function assertLeadFormInvariant(kind: LandingKind, blocks: Block[]): void
```

- `lead_capture` | `property` → exactamente 1 (comportamiento actual, tests intactos)
- `agent_profile` → 0 o 1

Ambos call-sites pasan a usarla.

### Bloques nuevos

Cuatro tipos nuevos en `block-schemas.ts` (sumar a `BLOCK_TYPES` y a
`BLOCK_DATA_SCHEMAS`; el `discriminatedUnion` se genera solo). Servicios y
"por qué yo" **reusan** `features-grid` y `benefits-list` — no se duplican.

- **`agent-hero`** — `{ name, headline?, bio?, photo_url, background_image_url?,
  ctas: [{label, href, style: 'primary'|'secondary'|'whatsapp'}] (0..3),
  accent_color: 'pink'|'orange'|'dark' }`
- **`agent-credentials`** — `{ title?, license?, years_experience?,
  zones: string[] (0..12), specialties: string[] (0..8),
  stats: [{label, value}] (0..4) }`
- **`faq`** — `{ title?, items: [{question, answer}] (2..12) }`
- **`cta-whatsapp`** — `{ title, subtitle?, phone, message_template?, button_label }`

### Binding vivo

Al **envelope** del bloque se le suma un campo opcional, al lado del
`is_variable` que ya existe (`block-schemas.ts:124`):

```ts
binding: z.literal('agent_profile').optional()
```

Un único mapa en core declara qué campo del perfil llena qué campo del bloque:

```ts
// core/src/domain/value-objects/agent-bindings.ts
export const AGENT_BINDINGS = {
  'agent-hero':        { name: 'user.full_name', headline: 'headline', bio: 'bio',
                         photo_url: 'user.photo_url', background_image_url: 'cover_image_url' },
  'agent-credentials': { license: 'license', years_experience: 'years_experience',
                         zones: 'zones', specialties: 'specialties', stats: 'stats' },
  'cta-whatsapp':      { phone: 'whatsapp' },
  'footer':            { phone: 'whatsapp', instagram: 'instagram',
                         agency_registration: 'license' },
} as const
```

Reglas del merge (`resolveAgentBindings(blocks, { user, profile })`):

1. Solo actúa sobre bloques con `binding === 'agent_profile'`.
2. Solo pisa el campo si el valor del perfil **no** es `null`, `undefined` ni
   array vacío. Si el perfil no tiene el dato, queda el del bloque — el bloque
   funciona como fallback editorial y la landing nunca se rompe.
3. El resultado se revalida contra el Zod del bloque antes de devolverse.

Caso borde a respetar: `agent-hero.photo_url` es **requerido** por Zod, pero
`users.photo_url` es nullable. Por la regla 2, un agente sin foto conserva el
valor del bloque, así que el template seedeado **debe traer una imagen
placeholder válida** en ese campo. Si no, la landing de un agente sin foto
falla la revalidación.

En el editor esos campos van **read-only** en el inspector, con el aviso "se
sincroniza con tu perfil", y `edit-block` de IA no los modifica.

## 6. Lectura pública

### Use case

`core/src/application/use-cases/landings/get-public-agent-landing.ts`

`execute({ orgSlug, agentSlug })`:

1. `organizations.findBySlug(orgSlug)` — ya existe en el port → `NotFound`
2. `agentProfiles.findByOrgAndSlug(org.id, agentSlug)` → `NotFound` si no está o `is_public = 0`
3. `users.findProfileById(profile.user_id)` → `NotFound` si `!active`, si
   `deleted_at`, o si `user.org_id !== org.id`. La verificación de org es
   obligatoria: `findProfileById` **no** filtra por org (a diferencia de
   `findById(id, orgId)`), así que sin ese chequeo un `user_id` de otra org
   pasaría la puerta.
4. `landings.findPublishedByAgentAndKind(org.id, profile.user_id, 'agent_profile')` → `NotFound`
5. `blocks = resolveAgentBindings(landing.blocks, { user, profile })`
6. Devuelve `{ landing_id, full_slug, blocks, seo_title, seo_description,
   og_image_url, org: { name, logo_url, brand_color, brand_accent_color },
   agent: { full_name, photo_url, headline } }`

`landing_id` y `full_slug` viajan en la respuesta para que el tracking de
eventos siga usando el mismo contrato que `/l/` — `landing_events` no cambia.

Método nuevo en `LandingRepository`:
`findPublishedByAgentAndKind(orgId, agentId, kind): Promise<Landing | null>`.

Esto salda, para este camino, la deuda documentada en
`vendepro-frontend/src/app/t/[slug]/page.tsx:20-30` (api-public no hace JOIN a
`users`).

### Endpoints

- **api-public**: `GET /a/:orgSlug/:agentSlug` — junto a `GET /l/:slug`
- **api-admin**: `GET /profile/public` y `PUT /profile/public` — leen/escriben
  `agent_profiles` del usuario autenticado. Validan slug (forma + unicidad por
  org vía `existsSlug`, excluyendo al propio usuario). Hoy
  `update-user-profile.ts:3-9` solo acepta `full_name/email/photo_url/phone`;
  el perfil público va en un use case aparte (`UpdateAgentProfileUseCase`) para
  no engordar el de identidad.

### Frontend público

`vendepro-frontend/src/app/a/[org]/[slug]/page.tsx` + `loading.tsx` +
`not-found.tsx`, calcados de `/l/[slug]` (server component, `generateMetadata`,
`export const revalidate = 60`, `notFound()`).

Reusa `PublicLandingShell`, así que tracking y submit de leads funcionan sin
tocarlos. Hereda branding de org igual que `/r/` y `/f/`.

`middleware.ts:17` — agregar `/a/` a `PUBLIC_PREFIXES`. **Sin esto el
middleware redirige la landing a `/login`.**

La misma fila sigue siendo alcanzable por `/l/<full_slug>`. Para no duplicar
SEO, `/a/` es la canónica y `/l/` emite `<link rel="canonical">` apuntando a
`/a/<org>/<slug>` cuando la landing es de kind `agent_profile`.

## 7. Template seedeado

Migración `049_landing_template_agent_profile.sql` — template global
(`org_id NULL`), `kind = 'agent_profile'`, `active = 1`. El kind de la landing
se hereda del template (`create-landing-from-template.ts:60`), así que no hace
falta tocar el use case de creación.

Orden de bloques (la espina dorsal común a las dos landings de referencia):

1. `agent-hero` — `binding: 'agent_profile'`
2. `agent-credentials` — `binding: 'agent_profile'`
3. `features-grid` — servicios / plan de marketing
4. `benefits-list` — por qué trabajar conmigo
5. `gallery` — trabajos, equipo
6. `faq`
7. `cta-whatsapp` — `binding: 'agent_profile'`
8. `lead-form`
9. `footer` — `binding: 'agent_profile'`

El `blocks_json` debe validar contra `validateBlocks()` antes de commitear la
migración.

## 8. UI del dashboard

- **`/perfil`** — sección nueva "Perfil público": headline, bio, matrícula,
  años, zonas, especialidades, redes, cover, stats, slug (autopropuesto desde
  `full_name`, editable) y el toggle `is_public`. Muestra la URL final
  `/a/<org>/<slug>` con botón de copiar — es el link que va a la bio de
  Instagram.
- **`NewLandingModal`** — alta de la landing personal con el template de agente.
- **Editor** — campos bindeados en read-only con el aviso de sincronización.
- Todo con el design system (`src/components/ui`), según `.claude/CLAUDE.md`.

## 9. Testing

**Unit (core)**
- `assertLeadFormInvariant`: 0 y 1 válidos para `agent_profile`; 0 y 2 inválidos
  para `lead_capture` y `property` (protege el comportamiento actual).
- Zod de los 4 bloques nuevos: mínimos, máximos y campos requeridos.
- `AgentSlug`: forma válida / inválida.
- `resolveAgentBindings`: pisa cuando hay dato, respeta el fallback del bloque
  cuando el perfil está vacío, ignora bloques sin `binding`.

**Use cases**
- `GetPublicAgentLandingUseCase`: happy path con merge aplicado, y `NotFound` en
  cada una de las cuatro puertas (org inexistente, `is_public = 0`, usuario
  inactivo/borrado, landing no publicada).
- `UpdateAgentProfileUseCase`: rechaza slug con forma inválida y slug ya tomado
  en la org; acepta que el agente conserve el suyo.

**Verificación end-to-end**
1. `cd vendepro-backend && npm test` — toda la suite en verde antes de mergear
   (regla del proyecto).
2. `npx wrangler d1 migrations apply vendepro-db --local` y levantar
   api-public + frontend.
3. Crear perfil desde `/perfil`, crear la landing con el template, publicarla,
   abrir `/a/<org>/<slug>` y confirmar: datos del perfil renderizados, branding
   de la org, CTA de WhatsApp con el número del perfil, `pageview` registrado en
   `landing_events`, y submit del form creando un lead asignado al agente.
4. Cambiar la bio en `/perfil` y recargar la pública: el texto cambia sin tocar
   la landing. Esa es la prueba del binding vivo.
5. Poner `is_public = 0` y confirmar 404.

## 10. KB (regla #1 del proyecto)

Un feature no está terminado hasta que la KB lo refleja:

- `03-Dominios/Dominio-Landings.md` — kind nuevo, bloques nuevos, binding, ruta pública.
- `03-Dominios/Dominio-Usuarios-Org.md` — `agent_profiles`.
- `08-Producto/Roadmap-estado-implementacion.md` — Feature 07 de 🔴 a 🟢 (MVP),
  aclarando que propiedades en vivo y testimonios quedan en Fase 2.
- `02-Arquitectura/DB-overview.md`, `API-public.md`, `API-admin.md`,
  `Frontend-rutas.md`, `00-Indice/MOC.md`.

## 11. Riesgos

- **Middleware**: olvidar `/a/` en `PUBLIC_PREFIXES` manda la landing a `/login`.
  Es el error más probable y el más silencioso.
- **Agente dado de baja**: la landing queda pública si no se chequea `active` y
  `deleted_at` además de `is_public`. Las tres puertas son obligatorias.
- **Revalidate 60**: un cambio de perfil tarda hasta un minuto en verse. Es
  aceptable y consistente con `/l/`, pero hay que decirlo en la UI para que no
  se lea como bug.
- **Slug**: cambiar el slug rompe links ya repartidos. La UI debe advertirlo.
