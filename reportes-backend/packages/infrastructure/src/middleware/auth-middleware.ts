import type { MiddlewareHandler } from 'hono'
import type { AuthService } from '@reportes/core'

export interface AuthEnv {
  Variables: {
    userId: string
    userEmail: string
    userRole: string
    orgId: string
  }
}

export function createAuthMiddleware(authService: AuthService): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const payload = await authService.verifyToken(token)
    if (!payload) {
      return c.json({ error: 'Invalid or expired token' }, 401)
    }

    c.set('userId', payload.sub as string)
    c.set('userEmail', payload.email as string)
    c.set('userRole', payload.role as string)
    c.set('orgId', payload.org_id as string)

    await next()
  }
}
