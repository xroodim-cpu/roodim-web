import { NextRequest, NextResponse } from 'next/server';
import { getSiteBySlug, getSiteFile } from '@/lib/site';
import { renderSiteFile } from '@/lib/template-engine';

interface RouteParams {
  params: Promise<{ slug: string; path?: string[] }>;
}

/**
 * 파일 기반 사이트 (standalone) 서빙
 * CSS/JS/이미지 등 에셋도 여기서 처리
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug, path } = await params;
  const pathStr = path?.join('/') || '';

  const site = await getSiteBySlug(slug);
  if (!site || site.status !== 'active' || site.siteType !== 'standalone') {
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
