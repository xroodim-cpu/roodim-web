import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache for domain -> slug mapping
const domainCache = new Map<string, { slug: string; expires: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute

const MAIN_DOMAINS = [
  'roodim-web.vercel.app',
  'localhost',
  '127.0.0.1',
];

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const hostWithoutPort = hostname.split(':')[0];

  // Skip for main domains and all vercel.app subdomains
  if (MAIN_DOMAINS.some(d => hostWithoutPort === d) || hostWithoutPort.endsWith('.vercel.app')) {
    return NextResponse.next();
  }

  // Skip for admin, api, static paths
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Check cache first
  const cached = domainCache.get(hostWithoutPort);
  if (cached && cached.expires > Date.now()) {
    const url = request.nextUrl.clone();
    url.pathname = `/${cached.slug}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Look up domain in DB via @neondatabase/serverless (Edge-compatible)
  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`SELECT slug FROM sites WHERE custom_domain = ${hostWithoutPort} AND status = ${'active'} LIMIT 1`;

    if (rows.length > 0) {
      const slug = rows[0].slug as string;
      domainCache.set(hostWithoutPort, { slug, expires: Date.now() + CACHE_TTL });
      const url = request.nextUrl.clone();
      url.pathname = `/${slug}${pathname}`;
      return NextResponse.rewrite(url);
    }
  } catch (err) {
    console.error('Domain lookup error:', err);
  }

  // No matching custom domain found, pass through
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
