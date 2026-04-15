import { type NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Public routes — no auth needed
  if (path === '/' || path === '/terminos' || path.startsWith('/r/') || path.startsWith('/v/') || path.startsWith('/t/') || path.startsWith('/p/') || path === '/login' || path.startsWith('/api/auth/') || path.startsWith('/api/extract') || path.startsWith('/api/photo/') || path.startsWith('/api/visit-forms') || path.startsWith('/api/debug')) {
    // If logged in and on login or landing page, redirect to dashboard
    if ((path === '/login' || path === '/') && request.cookies.get('reportes_session')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // Protected routes — require session cookie
  const session = request.cookies.get('reportes_session')
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.png|logo-footer.png|images).*)',
  ],
}
