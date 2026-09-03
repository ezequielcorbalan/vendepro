# VendéPro — Guía para Claude

## Estructura del repo

```
vendepro/
├── vendepro-backend/   # Monorepo hexagonal — 8 Cloudflare Worker APIs
├── vendepro-frontend/  # Next.js 15 standalone — consume las APIs via HTTP
├── doc/                # Documentación de arquitectura y navegación
└── .github/workflows/  # CI/CD — un workflow por API
```

Leer `doc/backend.md` antes de tocar el backend.
Leer `doc/frontend.md` antes de tocar el frontend.
Leer `doc/architecture.md` para entender la arquitectura hexagonal.

## Reglas críticas

- **Regla #1 — KB primero**: antes de implementar cualquier feature, consultar la KB (`vendepro-kb/`, arrancar por `00-Indice/MOC.md` y `08-Producto/Roadmap-estado-implementacion.md`) para saber qué existe y en qué instancia está. Al terminar un feature, documentarlo en la KB: actualizar el dominio afectado (`03-Dominios/`) y el estado en `08-Producto/`. Un feature no está terminado hasta que la KB lo refleja.
- El backend NO es Next.js — es Hono sobre Cloudflare Workers
- El frontend NO tiene rutas API propias — todo va a las APIs externas
- Nunca tocar `vendepro-mg-salt-2026` ni `reportes-mg-db` (recursos CF existentes)
- Los tests siempre deben pasar antes de mergear a main
- **NUNCA hacer deploys desde la terminal** — todos los deploys van por GitHub Actions o Cloudflare Dashboard
