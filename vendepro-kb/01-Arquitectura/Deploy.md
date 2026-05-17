# 🚀 Deploy

> ⚠️ **Nunca deployar desde terminal**. Ver [[Reglas-criticas]].

## Backend (Workers)

Cada API tiene su propio workflow de GitHub Actions en `.github/workflows/`. Al pushear a `main`:

- Cambios en `packages/api-{nombre}/**` → dispara solo ese workflow
- Cambios en `packages/core/**` o `packages/infrastructure/**` → dispara **los 8 en paralelo** (porque todas dependen de esos packages)
- Cada workflow corre tests primero, luego `wrangler deploy`

## Frontend (Next.js)

- Hosting: **Cloudflare Pages**
- Trigger: push a `vendepro-frontend/**` en `main` (NO usa GitHub Actions, Pages lo detecta solo)
- Build: `@opennextjs/cloudflare` adapta Next a Workers runtime
- Env vars de runtime (configurar en CF Pages):
  - `NEXT_PUBLIC_API_AUTH_URL` … `NEXT_PUBLIC_API_PUBLIC_URL` (uno por API)
  - `NODE_VERSION=20`
- Tienen defaults hardcoded en `lib/api.ts`, pero conviene setearlos para poder cambiar sin redeploy

## Migrations D1

- Carpeta: `vendepro-backend/migrations_v2/`
- Trigger: push a `migrations_v2/**` en `main`
- Workflow: `migrate.yml` aplica todas las migrations pendientes a `vendepro-db`
- Naming: `NNN_descripcion.sql` (algunas tienen número duplicado por trabajo paralelo)

Ver [[Como-agregar-migration]] y [[DB-overview]].

## Landing estática

- Path: `vendepro-landing/`
- Deploy: `wrangler` via GitHub Actions o Dashboard
- `wrangler.jsonc` apunta a `assets.directory: "."` (sirve `index.html` y `terminos/index.html`)
- Custom domains: `vendepro.com.ar`, `www.vendepro.com.ar`

## Secrets

Los secrets de cada worker se setean con `wrangler secret put <NAME>` (vía Dashboard o CI):

| Worker | Secrets |
|---|---|
| api-auth | `JWT_SECRET` |
| api-crm, api-properties, api-transactions, api-analytics, api-ai, api-admin | `JWT_SECRET` |
| api-ai | `ANTHROPIC_API_KEY`, `GROQ_API_KEY` |
| api-properties | `ANTHROPIC_API_KEY` (uso eventual) |

Bindings (DB, R2, BROWSER) van en `wrangler.jsonc`, no son secrets.

## Verificación post-deploy

1. `npx wrangler tail --format pretty` para logs en vivo
2. Browser console para errores cliente
3. Endpoints de health: cada API responde a `GET /` (cuando aplica)

## Debug común

| Síntoma | Causa probable |
|---|---|
| 401 en todos los endpoints | JWT expirado o `JWT_SECRET` mal seteado |
| 500 con "no such table" | Migration no aplicada — verificar workflow `migrate.yml` |
| R2 upload falla | binding no configurado en `wrangler.jsonc` |
| Frontend no encuentra API | env var `NEXT_PUBLIC_API_*_URL` faltante |
| Build fallido `unknown` type | Falta cast `(await res.json()) as any` |
