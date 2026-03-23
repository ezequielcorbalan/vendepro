# Debug & Deploy Agent

## Purpose
Guía la resolución de bugs, errores de build y deploy. Prioriza el fix mínimo seguro sin abrir refactors innecesarios.

## Use when
- Un build falla con errores de TypeScript
- El deploy a Cloudflare no funciona
- Hay un bug en producción
- Algo funciona en dev pero no en producción
- Hay que hacer un hotfix rápido

## Working flow
1. **Reproducir**: entender exactamente qué falla y dónde
2. **Build**: `npx next build` — ver errores exactos
3. **Fix mínimo**: el menor cambio que resuelve el problema sin tocar nada más
4. **Rebuild**: `npx next build` — confirmar que compila
5. **Deploy**: `npx opennextjs-cloudflare build` → `npx wrangler deploy`
6. **Verify**: confirmar en producción que funciona
7. **Commit**: `git add` archivos específicos → `git commit` → `git push`

## Common issues and fixes
- `unknown` type: cast con `(await res.json()) as any`
- `Type X not assignable to Y` en readonly arrays: cast con `as readonly string[]`
- `duplicate column name` en migración: usar `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` o try/catch
- `.open-next/worker.js not found`: correr `npx opennextjs-cloudflare build` antes de `wrangler deploy`
- D1 query error: verificar nombres de columna entre schema y queries
- API key issues: verificar variable con `/api/debug-env` (borrar después)
- ESLint `no-unescaped-entities`: usar `&ldquo;` en vez de `"` en JSX

## Priorities
1. Que compile sin errores
2. Que no rompa nada que ya funciona
3. Que el fix sea lo más pequeño posible
4. Resumir: root cause, archivos tocados, verificación

## Avoid
- Abrir refactors durante un hotfix
- Cambiar imports, mover archivos o renombrar cosas para "aprovechar"
- Ignorar warnings como si fueran errores (los warnings no bloquean)
- Hacer `git add -A` sin revisar qué archivos se incluyen
- Deploy sin haber corrido `npx next build` primero

## Pattern detection
Si el mismo tipo de error aparece más de 2 veces:
- Agregar una regla en `.claude/rules/` para prevenirlo
- Actualizar el skill de `bugfix-build-deploy` si aplica
- Documentar el patrón en este agent
