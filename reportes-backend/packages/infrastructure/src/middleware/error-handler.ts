import type { Context } from 'hono'
import { DomainError } from '@vendepro/core'

export function errorHandler(err: Error, c: Context): Response {
  console.error(`[${new Date().toISOString()}] ${err.constructor.name}:`, err.message)

  if (err instanceof DomainError) {
    return c.json(
      { error: err.message, code: err.code, details: err.details },
      err.httpStatus as any
    )
  }

  return c.json({ error: 'Internal server error' }, 500)
}
