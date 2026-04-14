import { NextRequest, NextResponse } from 'next/server';
import { getSiteBySlug, getSiteFile } from '@/lib/site';
import { renderSiteFile } from '@/lib/template-engine';
import { db } from '@/lib/db';
import { webSkins } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ slug: string; path?: string[] }>;
}

/**
 * 파일 기반 사이트 서빙 (standalone + 커스텀 스킨 사용 사이트)
 * CSS/JS/이미지 등 에셋도 여기서 처리
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug, path } = await params;
  const pathStr = path?.join('/') || '';

  const site = await getSiteBySlug(slug);
  if (!site || site.status !== 'active') {
    return new NextResponse('Not Found', { status: 404 });
  }
  // standalone 사이트 + 커스텀(비기본) 스킨을 사용하는 사이트만 파일 기반 렌더링 허용
  // 그 외(기본 스킨 사용 partner/rental/creator)는 섹션 기반 /{slug} 라우트를 사용
  const isStandalone = site.siteType === 'standalone';
  let hasCustomSkin = false;
  if (site.skinId != null) {
    const skinRows = await db.select({ isDefault: webSkins.isDefault })
      .from(webSkins)
      .where(eq(webSkins.id, site.skinId))
      .limit(1);
    hasCustomSkin = skinRows[0] ? !skinRows[0].isDefault : false;
  }
  if (!isStandalone && !hasCustomSkin) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // 파일명 결정
  let filename: string;
  if (!pathStr) {
    filename = 'index.html';
  } else if (pathStr.includes('.')) {
    // 확장자가 있으면 그대로 사용 (style.css, main.js, images/logo.png)
    filename = pathStr;
  } else {
    // 확장자 없으면 .html 추가
    filename = `${pathStr}.html`;
  }

  // 파일 조회
  const file = await getSiteFile(site.id, filename);
  if (!file) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // CSS 파일
  if (file.fileType === 'css' && file.content) {
    return new NextResponse(file.content, {
      headers: { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
  }

  // JS 파일
  if (file.fileType === 'js' && file.content) {
    return new NextResponse(file.content, {
      headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
  }

  // 이미지 파일 (Vercel Blob URL로 redirect)
  if (file.fileType === 'image' && file.blobUrl) {
    return NextResponse.redirect(file.blobUrl);
  }

  // HTML 파일 — 템플릿 엔진으로 렌더링
  if (file.fileType === 'html') {
    const rendered = await renderSiteFile(site.id, slug, filename);
    if (!rendered) {
      return new NextResponse('Render Error', { status: 500 });
    }

    return new NextResponse(rendered, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=120',
      },
    });
  }

  // 기타 파일
  if (file.content) {
    return new NextResponse(file.content, {
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  }

  return new NextResponse('Not Found', { status: 404 });
}
