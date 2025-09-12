import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { guestRegex, isDevelopmentEnvironment } from './lib/constants';

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

  // Get the NextAuth token to check if user has an active session
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  // Basic HTTP Authentication for team access
  // Skip Basic Auth check if:
  // 1. User has a valid NextAuth session (token exists), OR
  // 2. It's an API call from an authenticated frontend (has session cookie)
  const hasValidSession = token !== null;
  const isApiCall = pathname.startsWith('/api/');
  
  if (process.env.BASIC_AUTH_USERNAME && process.env.BASIC_AUTH_PASSWORD) {
    // For API calls, check if user has a session
    if (isApiCall && hasValidSession) {
      // User is authenticated via session, allow API access
      return NextResponse.next();
    }
    
    // For non-API routes or API routes without session, check Basic Auth
    if (!hasValidSession || !isApiCall) {
      const authorization = request.headers.get('authorization');
      
      if (!authorization) {
        return new Response('Authentication required', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Basic realm="Secure Area"',
          },
        });
      }

      const [scheme, encoded] = authorization.split(' ');
      
      if (scheme !== 'Basic' || !encoded) {
        return new Response('Invalid authentication', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Basic realm="Secure Area"',
          },
        });
      }

      const credentials = Buffer.from(encoded, 'base64').toString('utf-8');
      const [username, password] = credentials.split(':');

      if (
        username !== process.env.BASIC_AUTH_USERNAME ||
        password !== process.env.BASIC_AUTH_PASSWORD
      ) {
        return new Response('Invalid credentials', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Basic realm="Secure Area"',
          },
        });
      }
    }
  }

  if (!token) {
    const redirectUrl = encodeURIComponent(request.url);

    return NextResponse.redirect(
      new URL(`/api/auth/guest?redirectUrl=${redirectUrl}`, request.url),
    );
  }

  const isGuest = guestRegex.test(token?.email ?? '');

  if (token && !isGuest && ['/login', '/register'].includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/chat/:id',
    '/api/:path*',
    '/login',
    '/register',

    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
