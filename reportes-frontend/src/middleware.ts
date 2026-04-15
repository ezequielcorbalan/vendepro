import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/terminos',
]

const PUBLIC_PREFIXES = [
  '/r/',   // public property reports
  '/t/',   // public appraisal pages
  '/v/',   // public visit forms
  '/p/',   // public prefactibilidades
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
