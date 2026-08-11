# CRM Inmobiliario — Marcela Genta

## Purpose
Real estate CRM for managing the full commercial pipeline: leads → contacts → appraisals → listings → reservations → sales. Built for Marcela Genta Operaciones Inmobiliarias (Buenos Aires) with multi-tenant architecture for future white-label.

## Stack
- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Cloudflare Workers + D1 (SQLite) + R2 (storage)
- @opennextjs/cloudflare for deployment
- Claude API (Haiku) for screenshot/PDF extraction
- Recharts for charts
- Brand: #ff007c (pink), #ff8017 (orange), Poppins font

## Product Priorities
1. Operational clarity — every screen must be useful for daily work
2. Commercial traceability — full pipeline visibility from lead to sale
3. Mobile-first for field operations (leads, calendar, activity, appraisals)
4. Desktop-first for dashboards and reports
5. Multi-tenant ready — org_id on all entities

## Critical Rules
- Server Components by default, 'use client' only when needed
- All `await res.json()` must be cast as `(await res.json()) as any`
- No barrel imports — import specific icons from lucide-react
- Always handle loading, empty, and error states
- Protect all API routes with getCurrentUser()
- Filter by org_id on all queries

## Design System (UI nueva) — OBLIGATORIO
Al crear o modificar CUALQUIER pantalla/UI, usar el design system. No maquetar con clases sueltas.
- **Componentes**: usar los de `src/components/ui` (Button, Badge, Card, Input/Field/Select/Textarea, Avatar, Heading, Text, Tabs, Modal, Drawer, Dropdown, Table, Tooltip, Timeline, Progress, EmptyState, StageBadge, EventChip, Kanban, PropertyCard, Charts…). No recrear con `<button>`/`<div>` + clases.
- **Texto**: `Heading` (level 1–4) y `Text` (size/weight/tone). Nunca `<h1>`/`<p>` con clases sueltas. Default: títulos de sección (Heading 2) van en **semibold**.
- **Color**: tokens — `primary`, `success/warning/danger/info/neutral`, o la paleta genérica. NUNCA color Tailwind suelto (`bg-emerald-100`, etc.) en UI nueva.
- **Radio/sombra**: `rounded-control` (8px) / `rounded-card` (12px) / `rounded-full`; `shadow-card` / `shadow-pop`.
- **Dominio** (etapas, eventos, colores de negocio): desde `src/lib/crm-config.ts`.
- **Canales de contacto**: WhatsApp/llamada → usar `WhatsAppButton`/`CallButton` de `ui/ContactButtons`. NUNCA armar el link `wa.me`/`tel:` a mano ni el botón verde suelto.
- **Al migrar/crear**: usar SOLO componentes/variantes que ya existen. Si algo no encaja, migralo a la variante más cercana y marcalo `{/* ds-todo: candidato a variante "X" */}` — NO crear variantes nuevas sobre la marcha. Las variantes se deciden después, en tanda, con `grep ds-todo`.
- **Overrides**: `cn` usa `tailwind-merge`, así que un `className` puede pisar el estilo base sin problema.
- Referencia viva: ruta `/design-system`. Plan y contrato: `doc/ds-plan.md`, `doc/ds-review.md`.

## Rules
See `rules/` for detailed guidelines per domain.
