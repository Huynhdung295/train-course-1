import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/((?!_next|api|favicon|public|robots|sitemap).*)'],
};

const PUBLIC_ROUTES = ['/login', '/register', '/'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Extract tenant from subdomain or first path segment
  const hostname = request.headers.get('host') ?? '';
  const tenantSlug = hostname.split('.')[0];

  // Allow public routes without auth
  if (PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '?'))) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const sessionToken = request.cookies.get('nexus-session')?.value;
  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Forward tenant to downstream headers
  const response = NextResponse.next();
  response.headers.set('x-tenant-id', tenantSlug);
  response.headers.set('x-pathname', pathname);
  return response;
}
