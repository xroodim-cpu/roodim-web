import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

// Simple in-memory cache for domain -> slug mapping
const domainCache = new Map<string, { slug: string; siteType: string; useSkinRender: boolean; expires: number }>();
// Cache for slug -> siteType (main domain requests)
const slugTypeCache = new Map<string, { siteType: string; useSkinRender: boolean; expires: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute

// Shared postgres client for proxy — 동시 rewrite 요청을 버틸 수 있도록 max 상향
const sql = postgres(process.env.DATABASE_URL!, {
  max: 10,
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
  const hostWithoutPortRaw = hostname.split(':')[0];
  // www.* → apex 매핑. sites.custom_domain 에는 보통 apex 만 저장되므로 lookup 시 normalize.
  const hostWithoutPort = hostWithoutPortRaw.replace(/^www\./, '');
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

  // roodim.com apex 는 org-1 회원사이트로 매핑되므로, 어드민 로그인/로그아웃
  // 진입점은 link.roodim.com 으로 308 로 보내준다. POST /logout 도 보존.
  if (
    hostWithoutPort === 'roodim.com' &&
    (pathname === '/login' || pathname === '/logout' || pathname.startsWith('/login/'))
  ) {
    const target = new URL(pathname, 'https://link.roodim.com');
    target.search = request.nextUrl.search;
    return NextResponse.redirect(target, 308);
  }

  const isMainDomain = MAIN_DOMAINS.some(d => hostWithoutPort === d) || hostWithoutPort.endsWith('.vercel.app');

  // ===== 커스텀 도메인 처리 =====
  if (!isMainDomain) {
    // pathname 에 이미 슬러그 prefix 가 있으면 제거 (template-engine 이 <base href="/{slug}/">
    // 주입하기 때문에 브라우저가 자체 도메인에 /{slug}/style.css 같은 절대 경로로 요청해 옴.
    // 이걸 그대로 /api/site-render/{slug}{pathname} 에 붙이면 슬러그가 이중으로 들어가 404.)
    const stripSlugPrefix = (slug: string, p: string): string => {
      if (p === `/${slug}` || p === `/${slug}/`) return '';
      if (p.startsWith(`/${slug}/`)) return p.substring(`/${slug}`.length);
      return p;
    };

    const cached = domainCache.get(hostWithoutPort);
    if (cached && cached.expires > Date.now()) {
      const cleanPath = stripSlugPrefix(cached.slug, pathname);
      // standalone 또는 커스텀 스킨 사용 시 API 라우트로 rewrite
      if (cached.useSkinRender) {
        const url = request.nextUrl.clone();
        url.pathname = `/api/site-render/${cached.slug}${cleanPath === '/' ? '' : cleanPath}`;
        return NextResponse.rewrite(url);
      }
      const url = request.nextUrl.clone();
      url.pathname = `/${cached.slug}${cleanPath}`;
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _skinIsDefault = rows[0].skin_is_default as boolean;
        // 기본스킨도 파일 기반 렌더링 경로를 사용해 풀 템플릿(hero/features/packages/staff/gallery 등)을
        // 그대로 보여준다. 이전에는 `!skinIsDefault` 조건으로 기본스킨을 (site)/[slug] 섹션 기반
        // React 레이아웃으로 빠뜨렸는데, 기본스킨이 단순 플레이스홀더가 아니라 완전한 치환 템플릿을
        // 포함하도록 리디자인된 이상, 모든 skinId 할당 사이트는 `/api/site-render/*` 로 흘려보낸다.
        const useSkinRender = siteType === 'standalone' || skinId != null;
        domainCache.set(hostWithoutPort, { slug, siteType, useSkinRender, expires: Date.now() + CACHE_TTL });

        const cleanPath = stripSlugPrefix(slug, pathname);
        if (useSkinRender) {
          const url = request.nextUrl.clone();
          url.pathname = `/api/site-render/${slug}${cleanPath === '/' ? '' : cleanPath}`;
          return NextResponse.rewrite(url);
        }
        const url = request.nextUrl.clone();
        url.pathname = `/${slug}${cleanPath}`;
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _skinIsDefault = rows[0].skin_is_default as boolean;
      // 기본스킨도 파일 기반 렌더링 경로를 사용 (위 커스텀 도메인 처리 주석 참조)
      const useSkinRender = siteType === 'standalone' || skinId != null;
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
