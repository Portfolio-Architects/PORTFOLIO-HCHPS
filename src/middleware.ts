import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const sessionCookie = req.cookies.get('hchps_session');
  const isAuthenticated = sessionCookie?.value === 'authenticated-secure-session-token';
  const isLoginPage = req.nextUrl.pathname === '/login';

  if (!isAuthenticated && !isLoginPage) {
    // Redirect unauthenticated users to the login page
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isAuthenticated && isLoginPage) {
    // Redirect authenticated users away from the login page
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Protect all paths EXCEPT:
     * - _next/static (Static chunks)
     * - _next/image (Image optimization)
     * - favicon.ico (Favicon)
     * - api/auth (Auth API route used for logging in)
     * - sw.js, manifest.json, *.png, *.svg (PWA and static assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth|sw\\.js|manifest\\.json|.*\\.png|.*\\.svg).*)',
  ],
};
