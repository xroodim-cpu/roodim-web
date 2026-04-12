import { NextRequest, NextResponse } from 'next/server';
import { getSiteBySlug } from '@/lib/site';
import { renderSiteFile } from '@/lib/template-engine';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * 파일 기반 사이트 메인페이지 (/{slug} → index.html)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  const site = await getSiteBySlug(slug);
  if (!site || site.status !== 'active' || site.siteType !== 'standalone') {
    return new NextResponse('Not Found', { status: 404 });
  }

  const rendered = await renderSiteFile(site.id, slug, 'index.html');
  if (!rendered) {
    return new NextResponse('Not Found', { status: 404 });
  }

  return new NextResponse(rendered, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=120',
    },
  });
}
