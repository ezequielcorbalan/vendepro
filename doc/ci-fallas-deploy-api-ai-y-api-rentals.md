# Diagnóstico: fallas de "Deploy api-ai" y "Deploy api-rentals" en main

**Fecha de investigación:** 2026-07-02
**Estado:** api-ai destrabado con este PR (pendiente confirmar causa del secret sync); api-rentals requiere acción manual en Cloudflare Dashboard.

Son dos fallas distintas que comparten el workflow reusable `_deploy-api.yml` pero no la causa. Ninguna está relacionada con los cambios recientes de tags/dedup — el job de Tests pasa en ambos workflows.

---

## 1. Deploy api-ai — roto desde 2026-06-06

### Síntoma

| Historial | Detalle |
|---|---|
| Hasta 2026-05-21 | 51 runs exitosos |
| Desde 2026-06-06 21:06 UTC-3 | 15 runs fallidos consecutivos, todos en el mismo paso |

El paso que falla es **"Sync app secrets to worker"** del job Deploy:

```bash
printf '%s' "$GROQ_API_KEY" | npx wrangler secret put GROQ_API_KEY
```

Falla con exit code 1 **antes** de llegar a `wrangler deploy`, así que el deploy queda `skipped` y el código nuevo nunca sale. Producción sigue sirviendo la versión de mayo (el worker está vivo: `ai.api.vendepro.com.ar` responde 401 del middleware de auth, o sea funciona).

### Evidencia clave

Entre el último run que pasó ese paso (2026-06-06 20:45, commit `7614277`) y el primero que falló (2026-06-06 21:06, commit `0f4048e`) **no hubo ningún cambio en el repo que toque el CI**:

- `0f4048e` solo modificó `d1-stage-history-repository.ts` y su test.
- `_deploy-api.yml` no cambió (el paso de secret sync existe desde `bba0b22`, 2026-04-24, y funcionó durante mayo).
- `wrangler.jsonc` de api-ai: sin cambios desde antes de mayo.
- `package-lock.json`: la versión de wrangler no cambió en esa ventana.

**Conclusión:** la causa es externa al repo. Algo cambió del lado de Cloudflare o de los secrets de GitHub el 2026-06-06 entre las 20:45 y las 21:06. Candidatos, en orden de probabilidad:

1. **`CLOUDFLARE_API_TOKEN` rotado** con permisos insuficientes para el endpoint de secrets (el deploy de otros workers sigue funcionando, pero `secret put` usa otro endpoint de la API).
2. **`GROQ_API_KEY` (secret del repo) agregado o modificado** justo entonces — si antes estaba vacío, el paso se salteaba con el `if [ -n ... ]`; al aparecer, empezó a ejecutar `wrangler secret put` y a fallar.

### Cómo confirmar (5 minutos)

Los logs no son accesibles anónimamente (repo público pero logs requieren auth). Abrir el último run fallido y leer las líneas finales del paso "Sync app secrets to worker":

https://github.com/ezequielcorbalan/vendepro/actions/runs/28621065136

- Si dice algo tipo `Authentication error [code: 10000]` → regenerar el `CLOUDFLARE_API_TOKEN` con permiso **Workers Scripts: Edit** sobre la cuenta y actualizar el secret del repo.
- Si dice `workers.api.error.script_not_found` u ofrece crear el worker → el nombre del worker no coincide; verificar `vendepro-api-ai` en el dashboard.

### Fix aplicado en este PR

En `_deploy-api.yml`, el paso "Sync app secrets to worker" se movió **después** de `wrangler deploy`. Razones:

- El deploy deja de estar bloqueado por un paso auxiliar: el código vuelve a salir a producción aunque el sync siga roto.
- El error del sync sigue quedando visible en el run (el job sigue marcando failure), así que no se oculta el problema.
- Los secrets de worker persisten entre deploys, por lo que sincronizar después es funcionalmente equivalente a sincronizar antes.

Al mergear, el workflow se dispara solo (el reusable está en `paths`). Esperable: deploy verde, y el paso de sync o bien pasa (si la causa era transitoria) o bien muestra por fin el error real en el log.

---

## 2. Deploy api-rentals — nunca funcionó (35/35 runs fallidos)

### Síntoma

Todos los runs desde abril fallan en el paso **"Deploy"** (`wrangler deploy`). El worker no existe: `rentals.api.vendepro.com.ar` ni siquiera resuelve DNS.

### Causa raíz

`vendepro-backend/packages/api-rentals/wrangler.jsonc` tiene un placeholder que nunca se reemplazó:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "vendepro-rentals-db",
    "database_id": "REPLACE_WITH_ACTUAL_D1_ID"   // ← wrangler deploy rechaza esto
  }
]
```

El código del paquete está completo (src/ con 18 rutas, migración inicial de 310 líneas) — solo falta el aprovisionamiento.

### Fix requerido (manual, dashboard de Cloudflare)

Regla del repo: **nunca deployar desde la terminal** — todo por dashboard o GitHub Actions.

1. Crear la base D1 `vendepro-rentals-db` en el dashboard (Workers & Pages → D1). Si ya existe, solo copiar su UUID.
2. Aplicar `vendepro-backend/packages/api-rentals/migrations/0001_initial.sql` desde la consola de la DB en el dashboard.
3. Verificar que exista el bucket R2 `vendepro-rentals-docs` (el wrangler.jsonc lo referencia); crearlo si falta.
4. Reemplazar `REPLACE_WITH_ACTUAL_D1_ID` por el UUID real en `wrangler.jsonc` y commitear a main.
5. El push dispara el workflow solo. El custom domain `rentals.api.vendepro.com.ar` lo crea wrangler en el primer deploy exitoso (la zona `vendepro.com.ar` ya está en la cuenta).

**Ojo:** no tocar los recursos existentes `vendepro-mg-salt-2026` ni `reportes-mg-db`.

---

## Descartado durante la investigación

- ❌ Build/TS error — el job Tests compila y pasa en ambos workflows.
- ❌ Cambios recientes de tags/dedup — los demás paquetes deployaron bien con esos commits.
- ❌ Versión de wrangler — el lockfile no la cambió en la ventana de la rotura de api-ai.
- ❌ Worker de api-ai borrado — responde en producción.
- ❌ Smoke tests — quedan `skipped` en ambos casos; el problema es aguas arriba.
