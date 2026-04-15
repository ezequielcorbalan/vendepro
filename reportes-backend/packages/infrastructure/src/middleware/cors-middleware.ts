import { cors } from 'hono/cors'

export const corsMiddleware = cors({
  origin: (origin) => {
    // Allow all origins in dev, restrict in prod via env
    const allowed = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://reportes-app.pages.dev',
    ]
    if (!origin || allowed.includes(origin) || origin.endsWith('.pages.dev')) {
      return origin ?? '*'
    }
    return null
  },
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
})
