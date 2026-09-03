import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  const isDev = process.env.NODE_ENV !== 'production';
  const isLocalHost = req.nextUrl.hostname === 'localhost' || req.nextUrl.hostname === '127.0.0.1' || req.nextUrl.hostname === '::1';
  const sessionCookie = req.cookies.get('hchps_session');
  const isAuthenticated = sessionCookie?.value === 'authenticated-secure-session-token' || isDev || isLocalHost;
  const isLoginPage = req.nextUrl.pathname === '/login';
  const isPublicFestival = req.nextUrl.pathname.startsWith('/festival') || req.nextUrl.pathname.startsWith('/api/festival') || req.nextUrl.pathname.startsWith('/api/calendar');
  const isTunnelDomain = req.nextUrl.hostname.includes('trycloudflare.com') || req.nextUrl.hostname.includes('loca.lt');

  // 외부 터널 도메인으로 루트(/) 접속 시 양재천 페스티벌 관제판으로 자동 이동
  if (isTunnelDomain && req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/festival/yangjae', req.url));
  }

  if (isPublicFestival) {
    return NextResponse.next();
  }

  if (!isAuthenticated && !isLoginPage) {
    // Redirect unauthenticated users to the login page
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isAuthenticated && isLoginPage) {
    // Redirect authenticated users away from the login page
    return NextResponse.redirect(new URL('/', req.url));
  }

  const response = NextResponse.next();
  if ((isDev || isLocalHost) && !sessionCookie) {
    response.cookies.set('hchps_session', 'authenticated-secure-session-token', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 * 10,
      path: '/',
    });
  }
  return response;
}


export default proxy;



export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};


