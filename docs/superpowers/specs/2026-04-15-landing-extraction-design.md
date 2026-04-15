# Spec: Extracción de Landing → vendepro-landing

**Fecha:** 2026-04-15  
**Estado:** Aprobado

## Objetivo

Separar la landing pública (`vendepro.com.ar`) de la app autenticada (`app.vendepro.com.ar`) en dos apps independientes dentro del monorepo.

## Resultado final

```
vendepro/
├── vendepro-backend/       # sin cambios
├── vendepro-frontend/      # → app.vendepro.com.ar (solo app autenticada)
├── vendepro-landing/       # NUEVO → vendepro.com.ar (landing pública)
└── .github/workflows/
    └── deploy-landing.yml  # NUEVO
```

## vendepro-landing

### Stack
- Next.js 15 + `@opennextjs/cloudflare` (igual que el frontend)
- Sin D1, sin auth, sin cookies — contenido 100% estático/SSG
- Dominio: `vendepro.com.ar` vía custom_domain en wrangler.jsonc

### Archivos a crear

| Archivo | Origen |
|---|---|
| `src/app/page.tsx` | Copiado de `vendepro-frontend/src/app/page.tsx` con links actualizados |
| `src/app/terminos/page.tsx` | Copiado de `vendepro-frontend/src/app/terminos/page.tsx` |
| `src/app/layout.tsx` | Versión simplificada (sin AuthProvider, sin Sidebar) |
| `src/app/globals.css` | Igual al frontend |
| `next.config.ts` | Minimal (sin headers de iframe) |
| `open-next.config.ts` | Igual al frontend |
| `wrangler.jsonc` | custom_domain: vendepro.com.ar |
| `package.json` | Minimal: next, lucide-react, tailwindcss |
| `tsconfig.json` | Igual al frontend |
| `postcss.config.mjs` | Igual al frontend |

### Cambio clave en page.tsx
Todos los `href="/login"` se convierten en `href="https://app.vendepro.com.ar/login"` (links absolutos al dominio de la app).

El link a `/terminos` permanece relativo (mismo dominio de landing).

## vendepro-frontend (cambios)

- `src/app/page.tsx` → redirect permanente a `/dashboard`
- El middleware ya protege `/dashboard`, así que no requiere cambios adicionales

## CI/CD

Nuevo workflow `deploy-landing.yml` con:
- Trigger: push a `main` en paths `vendepro-landing/**` o `_deploy-api.yml`
- Job: `npx wrangler pages deploy` (o `wrangler deploy` con opennextjs)
- Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

## Dependencias del token CF

El mismo API token usado en los backends necesita permiso:
- `Zone:Workers Routes:Edit` (ya corregido en sesión anterior)
