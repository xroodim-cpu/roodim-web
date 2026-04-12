import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

// Simple in-memory cache for domain -> slug mapping
const domainCache = new Map<string, { slug: string; siteType: string; expires: number }>();
// Cache for slug -> siteType (main domain requests)
const slugTypeCache = new Map<string, { siteType: string; expires: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute

// Shared postgres client for middleware
const sql = postgres(process.env.DATABASE_URL!, {
  max: 3,
  idle_timeout: 20,
  connect_timeout: 10,
});

const MAIN_DOMAINS = [
  'roodim-web.vercel.app',
  'localhost',
  '127.0.0.1',
];

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const hostWithoutPort = hostname.split(':')[0];
  const { pathname } = request.nextUrl;

  // Skip for admin, api, static paths
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const isMainDomain = MAIN_DOMAINS.some(d => hostWithoutPort === d) || hostWithoutPort.endsWith('.vercel.app');

  // ===== 커스텀 도메인 처리 =====
  if (!isMainDomain) {
    const cached = domainCache.get(hostWithoutPort);
    if (cached && cached.expires > Date.now()) {
      // standalone 사이트면 API 라우트로 rewrite
      if (cached.siteType === 'standalone') {
        const url = request.nextUrl.clone();
        url.pathname = `/api/site-render/${cached.slug}${pathname === '/' ? '' : pathname}`;
        return NextResponse.rewrite(url);
      }
      const url = request.nextUrl.clone();
      url.pathname = `/${cached.slug}${pathname}`;
      return NextResponse.rewrite(url);
    }

    try {
      const rows = await sql`SELECT slug, site_type FROM sites WHERE custom_domain = ${hostWithoutPort} AND status = ${'active'} LIMIT 1`;

      if (rows.length > 0) {
        const slug = rows[0].slug as string;
        const siteType = rows[0].site_type as string;
        domainCache.set(hostWithoutPort, { slug, siteType, expires: Date.now() + CACHE_TTL });

        if (siteType === 'standalone') {
          const url = request.nextUrl.clone();
          url.pathname = `/api/site-render/${slug}${pathname === '/' ? '' : pathname}`;
          return NextResponse.rewrite(url);
        }
        const url = request.nextUrl.clone();
        url.pathname = `/${slug}${pathname}`;
        return NextResponse.rewrite(url);
      }
    } catch (err) {
      console.error('Domain lookup error:', err);
    }
    return NextResponse.next();
  }

  // ===== 메인 도메인: /{slug}/... 형태 처리 =====
  // standalone 사이트인 경우 API 라우트로 rewrite
  const slugMatch = pathname.match(/^\/([a-z0-9][a-z0-9-]*)(\/.*)?$/);
  if (!slugMatch) return NextResponse.next();

  const slug = slugMatch[1];
  const restPath = slugMatch[2] || '';

  // 루트 페이지 (/) 는 패스
  if (!slug || slug === '') return NextResponse.next();

  // 캐시 확인
  const cached = slugTypeCache.get(slug);
  if (cached && cached.expires > Date.now()) {
    if (cached.siteType === 'standalone') {
      const url = request.nextUrl.clone();
      url.pathname = `/api/site-render/${slug}${restPath}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next(); // rental 등은 기존 (site) 라우트로
  }

  // DB에서 siteType 확인
  try {
    const rows = await sql`SELECT site_type FROM sites WHERE slug = ${slug} AND status = ${'active'} LIMIT 1`;

    if (rows.length > 0) {
      const siteType = rows[0].site_type as string;
      slugTypeCache.set(slug, { siteType, expires: Date.now() + CACHE_TTL });

      if (siteType === 'standalone') {
        const url = request.nextUrl.clone();
        url.pathname = `/api/site-render/${slug}${restPath}`;
        return NextResponse.rewrite(url);
      }
    }
  } catch (err) {
    console.error('Slug type lookup error:', err);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
