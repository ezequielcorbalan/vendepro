import type { MiddlewareHandler } from 'hono'
import type { AuthService, ApiTokenRepository } from '@vendepro/core'

export interface IntegrationAuthEnv {
  Variables: {
    orgId: string
    tokenId: string
    tokenScopes: string[]
  }
}

/**
 * Middleware para la API de integración (/v1/*). Valida un JWT de integración
 * (typ: 'integration') firmado con JWT_SECRET y respaldado por un registro en
 * api_tokens. La revocación es vía DB (is_active), no vía exp del JWT.
 */
export function createIntegrationAuthMiddleware(
  authService: AuthService,
  apiTokenRepo: ApiTokenRepository,
): MiddlewareHandler<IntegrationAuthEnv> {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return c.json({ error: 'Token de integración requerido (Authorization: Bearer)' }, 401)
    }

    const payload = await authService.verifyToken(token)
    if (!payload || payload.typ !== 'integration' || !payload.tid) {
      return c.json({ error: 'Token inválido' }, 401)
    }

    const record = await apiTokenRepo.findById(payload.tid as string)
    if (!record || !record.is_active) {
      return c.json({ error: 'Token revocado o inexistente' }, 401)
    }
    if (record.org_id !== (payload.org_id as string)) {
      return c.json({ error: 'Token inválido' }, 401)
    }

    c.set('orgId', record.org_id)
    c.set('tokenId', record.id)
    c.set('tokenScopes', record.scopes)

    // best-effort: no bloquea la request si falla
    try {
      c.executionCtx.waitUntil(apiTokenRepo.touchLastUsed(record.id).catch(() => {}))
    } catch {
      // sin execution context (ej. tests): ignoramos el touch
    }

    await next()
  }
}
