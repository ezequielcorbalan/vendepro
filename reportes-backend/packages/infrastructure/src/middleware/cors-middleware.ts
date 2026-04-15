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
    ]

    if (
      allowed.includes(origin) ||
      origin.endsWith('.vendepro.com.ar') ||   // any subdomain
      origin.endsWith('.pages.dev')             // CF Pages preview deployments
    ) {
      return origin
    }

    return null
  },
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
})
