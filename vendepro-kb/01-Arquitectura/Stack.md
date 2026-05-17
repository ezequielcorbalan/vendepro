# 🧱 Stack

## Backend (`vendepro-backend/`)

Monorepo Turborepo con 10 packages (2 librerías + 8 workers).

| Capa | Tecnología |
|---|---|
| Runtime | Cloudflare Workers |
| HTTP framework | **Hono** |
| Lenguaje | TypeScript (strict) |
| ORM/DB | D1 (SQLite) — queries con `.prepare().bind()` |
| Storage | R2 (binding `vendepro-assets`) |
| JWT | `jose` |
| Validación | `zod` (schemas de bloques landing/appraisal) |
| Tests | Vitest (workspace raíz) |
| Build/orchestration | Turborepo |
| AI | `@anthropic-ai/sdk` (Claude haiku 4.5) + Groq HTTP (llama 3, 3.3, 4-scout) |
| PDF | Cloudflare Browser Rendering binding |
| Marketing | Meta Conversion API (Graph v17) + GA4 Measurement Protocol + Stape sGTM |

## Frontend (`vendepro-frontend/`)

| Capa | Tecnología |
|---|---|
| Framework | **Next.js 15** (App Router) |
| React | 18.3 |
| Lenguaje | TypeScript |
| Estilos | **TailwindCSS 4** + Poppins via Google Fonts |
| Iconos | `lucide-react` (sin barrel imports) |
| Charts | `recharts` |
| Drag & drop | `@dnd-kit/core`, `sortable`, `utilities` |
| Export Excel | `xlsx` |
| Tests | Vitest + `@testing-library/react` + jsdom |
| Deploy | `@opennextjs/cloudflare` → Cloudflare Pages |
| State | No store global — `useState` + lifting + Context (Toast, Auth) |

Sin Redux/Zustand. Sin React Query. Fetch directo con `apiFetch` (ver [[Frontend-lib]]).

## Landing (`vendepro-landing/`)

| Capa | Tecnología |
|---|---|
| Tipo | HTML estático (1 archivo) |
| CSS | TailwindCSS via CDN (`cdn.tailwindcss.com`) |
| Fonts | Poppins via Google Fonts |
| Hosting | Cloudflare Workers con `assets` binding |
| Sin build | servido tal cual |

Ver [[Landing-publica]].

## Identidad visual

- Color primario: **#ff007c** (rosa)
- Color acento: **#ff8017** (naranja)
- Fuente: **Poppins** (400, 500, 600, 700, 800)
