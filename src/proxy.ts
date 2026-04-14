import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

// Simple in-memory cache for domain -> slug mapping
const domainCache = new Map<string, { slug: string; siteType: string; useSkinRender: boolean; expires: number }>();
// Cache for slug -> siteType (main domain requests)
const slugTypeCache = new Map<string, { siteType: string; useSkinRender: boolean; expires: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute

// Shared postgres client for proxy
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

export async function proxy(request: NextRequest) {
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
      // standalone 또는 커스텀 스킨 사용 시 API 라우트로 rewrite
      if (cached.useSkinRender) {
        const url = request.nextUrl.clone();
        url.pathname = `/api/site-render/${cached.slug}${pathname === '/' ? '' : pathname}`;
        return NextResponse.rewrite(url);
      }
      const url = request.nextUrl.clone();
      url.pathname = `/${cached.slug}${pathname}`;
      return NextResponse.rewrite(url);
    }

    try {
      const rows = await sql`
        SELECT s.slug, s.site_type, s.skin_id, COALESCE(ws.is_default, true) AS skin_is_default
        FROM sites s
        LEFT JOIN web_skins ws ON s.skin_id = ws.id
        WHERE s.custom_domain = ${hostWithoutPort} AND s.status = ${'active'}
        LIMIT 1
      `;

      if (rows.length > 0) {
        const slug = rows[0].slug as string;
        const siteType = rows[0].site_type as string;
        const skinId = rows[0].skin_id as number | null;
        const skinIsDefault = rows[0].skin_is_default as boolean;
        const useSkinRender = siteType === 'standalone' || (skinId != null && !skinIsDefault);
        domainCache.set(hostWithoutPort, { slug, siteType, useSkinRender, expires: Date.now() + CACHE_TTL });

        if (useSkinRender) {
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
  // standalone 또는 커스텀 스킨 사용 사이트인 경우 API 라우트로 rewrite
  const slugMatch = pathname.match(/^\/([a-z0-9][a-z0-9-]*)(\/.*)?$/);
  if (!slugMatch) return NextResponse.next();

  const slug = slugMatch[1];
  const restPath = slugMatch[2] || '';

  // 루트 페이지 (/) 는 패스
  if (!slug || slug === '') return NextResponse.next();

  // 캐시 확인
  const cached = slugTypeCache.get(slug);
  if (cached && cached.expires > Date.now()) {
    if (cached.useSkinRender) {
      const url = request.nextUrl.clone();
      url.pathname = `/api/site-render/${slug}${restPath}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next(); // rental 등은 기존 (site) 라우트로
  }

  // DB에서 siteType + skin 상태 확인
  try {
    const rows = await sql`
      SELECT s.site_type, s.skin_id, COALESCE(ws.is_default, true) AS skin_is_default
      FROM sites s
      LEFT JOIN web_skins ws ON s.skin_id = ws.id
      WHERE s.slug = ${slug} AND s.status = ${'active'}
      LIMIT 1
    `;

    if (rows.length > 0) {
      const siteType = rows[0].site_type as string;
      const skinId = rows[0].skin_id as number | null;
      const skinIsDefault = rows[0].skin_is_default as boolean;
      const useSkinRender = siteType === 'standalone' || (skinId != null && !skinIsDefault);
      slugTypeCache.set(slug, { siteType, useSkinRender, expires: Date.now() + CACHE_TTL });

      if (useSkinRender) {
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
