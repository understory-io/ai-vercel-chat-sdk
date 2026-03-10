import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isDevelopmentEnvironment } from './lib/constants';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith('/ping')) {
    return new Response('pong', { status: 200 });
  }

  // Allow /api/auth routes to pass through for NextAuth
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Allow MCP routes to pass through — they handle their own JWT auth
  if (pathname.startsWith('/api/mcp')) {
    return NextResponse.next();
  }

  // Allow OAuth discovery endpoints (both original and rewritten paths)
  if (pathname.startsWith('/.well-known/') || pathname.startsWith('/api/well-known/')) {
    return NextResponse.next();
  }

  // Check NextAuth JWT token first
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  if (token) {
    if (pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // No JWT session — for API routes with Bearer tokens, let route handlers validate
  if (pathname.startsWith('/api/')) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return NextResponse.next();
    }

    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Allow the login page for unauthenticated users
  if (pathname === '/login') {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: [
    '/',
    '/chat/:id',
    '/api/:path*',
    '/login',

    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
