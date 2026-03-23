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

## Rules
See `rules/` for detailed guidelines per domain.
