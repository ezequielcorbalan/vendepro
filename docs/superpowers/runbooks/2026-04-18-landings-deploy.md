# Landings — Runbook de deploy Fase A

## Pre-requisitos
- Migrations `010_landings.sql` y `011_landings_seed_templates.sql` en `migrations_v2/`.
- `@vendepro/core` y `@vendepro/infrastructure` actualizados en main.
- Workers afectados: `api-crm`, `api-ai`, `api-public`.

## Pasos (en orden)

### 1. Aplicar migrations a D1 producción

Desde CF Dashboard → D1 → `vendepro-db` → Console:
- Pegar contenido de `010_landings.sql` y ejecutar.
- Pegar contenido de `011_landings_seed_templates.sql` y ejecutar.

Verificar con query: `SELECT id, name FROM landing_templates;` → 3 filas.

### 2. Setear secret GROQ_API_KEY en api-ai

**Vía GHA (preferido):** el workflow de `vendepro-api-ai` debe tener el paso `wrangler secret put GROQ_API_KEY` con el valor tomado desde GH Secrets.

**Vía CF Dashboard:** Workers → `vendepro-api-ai` → Settings → Variables and Secrets → Add `GROQ_API_KEY`.

**Never from local terminal.**

### 3. Deploy de workers

Los 3 workers se deployan por GHA pusheando a main. Validar en Actions que:
- `vendepro-api-crm` build y deploy OK.
- `vendepro-api-ai` build y deploy OK.
- `vendepro-api-public` build y deploy OK.

### 4. Smoke test post-deploy

Con un usuario admin autenticado:

```bash
# 1. Listar templates
curl -H "Cookie: session=..." https://crm.api.vendepro.com.ar/landing-templates

# 2. Crear una landing
curl -X POST -H "Cookie: ..." -H "Content-Type: application/json" \
  -d '{"templateId":"tpl_emprendimiento_premium","slugBase":"smoke-test"}' \
  https://crm.api.vendepro.com.ar/landings

# 3. Publicar (con userRole=admin en el JWT)
curl -X POST -H "Cookie: ..." https://crm.api.vendepro.com.ar/landings/<id>/publish

# 4. Consultar pública (slug retornado en paso 2 como `fullSlug`)
curl https://public.api.vendepro.com.ar/l/smoke-test-<suffix>

# 5. Submit
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"Smoke","phone":"111"}' \
  https://public.api.vendepro.com.ar/l/smoke-test-<suffix>/submit
```

### 5. Infra CF (Fase B/C — no bloquea Fase A)

- DNS wildcard `*.landings.vendepro.com.ar` → Pages `vendepro-frontend.pages.dev`. Status: Proxied.
- Pages Custom domain: agregar `*.landings.vendepro.com.ar` al proyecto `vendepro-frontend`.

Estos 2 pasos pueden quedar pendientes hasta que Fase C (público + editor) esté ready.

## Rollback

Si algo explota:
1. Revertir los commits de rutas en los 3 workers (generalmente deploys por GHA).
2. Migrations 010/011: NO revertir. Las tablas no rompen nada si no se usan.
3. Si un bug serio en shape-guard de Groq, deshabilitar la ruta `/landings/:id/edit-block` temporalmente retornando 503.
