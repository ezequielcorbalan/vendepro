# Core Engineering Rules

- Server Components by default. Only add 'use client' when hooks/interactivity needed
- Strict typing — avoid `any` except for D1 query results cast
- All `await response.json()` → `(await response.json()) as any`
- Small, focused components. Max ~300 lines per file preferred
- Every page must handle: loading state, empty state, error state
- No unnecessary refactors during production hotfixes
- Imports: specific named imports, no barrel files
- Use lucide-react for icons — only import what you use
- Tailwind for all styling — no CSS modules, no styled-components
- File naming: kebab-case for routes, PascalCase for components
