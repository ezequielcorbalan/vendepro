import { cors } from 'hono/cors'

export const corsMiddleware = cors({
  origin: (origin) => {
    if (!origin) return '*'

    const allowed = [
      'http://localhost:3000',
      'http://localhost:3001',
      // Production
      'https://vendepro.com.ar',
      'https://www.vendepro.com.ar',
      'https://app.vendepro.com.ar',
      'https://landings.vendepro.com.ar',
    ]

    if (
      allowed.includes(origin) ||
      origin.endsWith('.api.vendepro.com.ar') || // *.api.vendepro.com.ar
      origin.endsWith('.pages.dev') ||           // CF Pages preview deployments
      /^https:\/\/[a-z0-9-]+\.landings\.vendepro\.com\.ar$/i.test(origin) // wildcard landing subdomains (SaaS future)
    ) {
      return origin
    }

    return null
  },
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
})
