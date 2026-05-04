import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const USERNAME = 'ocs5298';
const PASSWORD = '34237116!a';
const COOKIE_NAME = 'hchps_session';
const COOKIE_VALUE = 'authenticated-secure-session-token';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (username === USERNAME && password === PASSWORD) {
      const response = NextResponse.json({ success: true });
      
      // Set cookie to expire in 10 years for permanent login
      response.cookies.set(COOKIE_NAME, COOKIE_VALUE, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
        path: '/',
      });

      return response;
    }

    return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Bad request' }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  
  // Clear the cookie by setting maxAge to 0
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
