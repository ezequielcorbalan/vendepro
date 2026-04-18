# Landings — DNS + Pages custom domain

## Objetivo
Habilitar `*.landings.vendepro.com.ar` para que las landings publicadas sean accesibles.

## Pre-requisitos
- Acceso a Cloudflare Dashboard de la cuenta VendéPro.
- `vendepro-frontend` ya deployado en Pages.

## Pasos

### 1. DNS wildcard
1. Dashboard → Websites → `vendepro.com.ar` → DNS → Records.
2. Add record:
   - Type: **CNAME**
   - Name: `*.landings`
   - Target: `vendepro-frontend.pages.dev` (o el hostname actual del proyecto Pages — confirmar en Workers & Pages → vendepro-frontend)
   - Proxy status: **Proxied** 🟧
   - TTL: Auto
3. Save.

### 2. Pages custom domain
1. Dashboard → Workers & Pages → `vendepro-frontend` → Custom domains.
2. Set up a custom domain → `*.landings.vendepro.com.ar` → Continue.
3. Esperar el cert SSL automático (puede tardar 1-5 min).
4. Status debe quedar: **Active**.

### 3. Verificar

```bash
# Desde terminal local (no es deploy, solo curl):
curl -I https://anything.landings.vendepro.com.ar/
# Esperado: 404 (porque el slug no existe) — pero responde el middleware → significa que el subdomain llega a Pages.

# Con una landing publicada:
curl https://<full_slug>.landings.vendepro.com.ar/
# Esperado: HTML con la landing renderizada.
```

### 4. CORS en api-public
Si el worker `api-public` ya fue deployado con el cambio de CORS (Fase A, Task 25, Step 5), los submits deberían funcionar. Verificar con un submit de prueba:

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "Origin: https://test.landings.vendepro.com.ar" \
  -d '{"name":"Smoke","phone":"111"}' \
  https://public.api.vendepro.com.ar/l/<full_slug>/submit
```

Debe responder 201 con `{ leadId, successMessage }`.

## Rollback
Si hay problemas:
1. Borrar el registro CNAME `*.landings` del DNS.
2. Remover el custom domain de Pages.
Las landings dejan de ser accesibles pero el CRM sigue funcionando normalmente.

## Notas
- CF emite cert wildcard automático al agregar el custom domain. No hace falta Advanced Certificate Manager (esa opción es paga y solo hace falta para dominios custom del cliente — fase 2).
- Si Pages no permite wildcard en el plan actual, alternativa: rebondear a un Worker dedicado con `routes` patrón `*.landings.vendepro.com.ar/*` que internamente proxea a Pages. Documentar si hay que ir por ese camino.
