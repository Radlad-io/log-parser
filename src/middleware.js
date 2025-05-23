import { NextResponse } from 'next/server';

export function middleware(request) {
  // Only protect the /upload route
  if (request.nextUrl.pathname === '/upload') {
    const pswd = request.cookies.get('pswd');
    const expectedPassword = process.env.UPLOAD_PASSWORD;

    // If no password is set in environment, block all access
    if (!expectedPassword) {
      return new NextResponse(JSON.stringify({ error: 'Upload route not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // If no password cookie or wrong password, redirect to home
    if (!pswd || pswd.value !== expectedPassword) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/upload',
}; 