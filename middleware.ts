import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isDevelopmentEnvironment } from './lib/constants';
import { validateApiKeyFromDb } from './lib/db/middleware-queries';

async function hashApiKeyInMiddleware(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

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

  // No JWT session. For API routes, try API key authentication.
  if (pathname.startsWith('/api/')) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const apiKeyPlaintext = authHeader.slice(7);
      const keyHash = await hashApiKeyInMiddleware(apiKeyPlaintext);

      const apiKeyRecord = await validateApiKeyFromDb(keyHash);
      if (apiKeyRecord) {
        // Pass user identity to route handlers via headers.
        // Safe: Next.js middleware rewrites headers before they reach handlers.
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-api-key-user-id', apiKeyRecord.userId);
        requestHeaders.set('x-api-key-id', apiKeyRecord.id);

        return NextResponse.next({
          request: { headers: requestHeaders },
        });
      }

      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // No auth at all on API routes
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
