import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const LANDING_HOST_RE = /^([a-z0-9][a-z0-9-]{1,60}[a-z0-9])\.landings\.vendepro\.com\.ar$/i

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/terminos',
]

const PUBLIC_PREFIXES = [
  '/r/',   // public property reports
  '/t/',   // public appraisal pages
  '/v/',   // public visit forms
  '/p/',   // public prefactibilidades
  '/l/',   // landings públicas
  '/_next',
  '/favicon',
  '/logo',
  '/api/',
]

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
