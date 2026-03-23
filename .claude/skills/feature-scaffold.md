# Skill: Feature Scaffolding

## Workflow
1. Identify the entity/module
2. Think data flow: DB schema → API route → Server Component → Client Component
3. Create file structure:
   - `src/app/api/{feature}/route.ts` — CRUD API
   - `src/app/(dashboard)/{feature}/page.tsx` — List page
   - `src/app/(dashboard)/{feature}/[id]/page.tsx` — Detail page
   - `src/app/(dashboard)/{feature}/nuevo/page.tsx` — Create page (if needed)
4. Add to sidebar navigation (Sidebar.tsx + MobileHeader.tsx)
5. Add D1 table migration SQL
6. Handle loading, empty, error states
7. Verify mobile + desktop
