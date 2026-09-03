import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const LANDING_HOST_RE = /^([a-z0-9][a-z0-9-]{1,60}[a-z0-9])\.landings\.vendepro\.com\.ar$/i

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/terminos',
  // Recuperar contraseña: por definición el usuario no tiene sesión acá. Sin
  // esto el middleware lo manda a /login y encima descarta el ?token= del mail.
  '/forgot-password',
  '/reset-password',
]

const PUBLIC_PREFIXES = [
  '/design-system', // galería + previews del design system (sin datos)
  '/r/',   // public property reports
  '/t/',   // public appraisal pages
  '/v/',   // public visit forms
  '/f/',   // fichas de tasación que completa el propietario
  '/p/',   // public prefactibilidades
  '/l/',   // landings públicas
  '/a/',   // landings públicas de perfil de agente (/a/[org]/[slug])
  '/u/',   // baja de emails de marketing (unsubscribe)
  '/_next',
  '/favicon',
  '/logo',
  '/api/',
]

/**
 * ¿El JWT de la cookie sigue vigente? Lee el `exp` sin verificar la firma: el
 * middleware no tiene el secret (lo tienen las APIs, que validan de verdad en
 * cada request). Alcanza para no mandar al dashboard a alguien con la sesión
 * vencida, que rebotaría de vuelta al login apenas la primera llamada dé 401.
 */
function hasLiveSession(token: string | undefined): boolean {
  if (!token) return false
  const payload = token.split('.')[1]
  if (!payload) return false
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    // Sin `exp` el token no vence (los de integración se emiten así).
    if (typeof claims.exp !== 'number') return true
    return claims.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

function isPublic(pathname: string): boolean {
  if (pathname === '/') return true
  if (PUBLIC_PATHS.includes(pathname)) return true
  return PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

export function middleware(request: NextRequest) {
  // === Landing subdomain rewrite ===
  const host = request.headers.get('host')?.toLowerCase() ?? ''
  const landingMatch = host.match(LANDING_HOST_RE)
  if (landingMatch) {
    const slug = landingMatch[1]
    const url = request.nextUrl.clone()
    if (!url.pathname.startsWith('/l/')) {
      url.pathname = `/l/${slug}`
    }
    return NextResponse.rewrite(url)
  }

  const { pathname } = request.nextUrl

  // Ya logueado: el formulario de login no tiene nada que ofrecerle. Va antes
  // del chequeo de rutas públicas porque /login es una de ellas.
  if (pathname === '/login' && hasLiveSession(request.cookies.get('vendepro_token')?.value)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (isPublic(pathname)) {
    return NextResponse.next()
  }

  // Check for auth token in cookie (set on login)
  const token = request.cookies.get('vendepro_token')?.value

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
