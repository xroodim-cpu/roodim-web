import { NextRequest, NextResponse } from 'next/server';
import { getSiteBySlug, getSiteFile } from '@/lib/site';
import { renderSiteFile } from '@/lib/template-engine';

interface RouteParams {
  params: Promise<{ slug: string; path?: string[] }>;
}

/**
 * 파일 기반 사이트 서빙 (standalone + 커스텀 스킨 사용 사이트)
 * CSS/JS/이미지 등 에셋도 여기서 처리
 *
 * 권한/허용 판정은 이미 src/proxy.ts 에서 수행된 후 rewrite로 진입하므로
 * 여기서는 useSkinRender 재검증을 하지 않는다 (쿼리 1건 절감).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug, path } = await params;
  const pathStr = path?.join('/') || '';

  const site = await getSiteBySlug(slug);
  if (!site || site.status !== 'active') {
    return new NextResponse('Not Found', { status: 404 });
  }

  // 어드민 미리보기 — ?preview_skin=N 으로 적용중 스킨 대신 해당 스킨 파일 렌더링
  const previewSkinIdRaw = request.nextUrl.searchParams.get('preview_skin');
  const previewSkinId = previewSkinIdRaw ? parseInt(previewSkinIdRaw, 10) : undefined;
  const previewSkinIdSafe = previewSkinId && Number.isFinite(previewSkinId) ? previewSkinId : undefined;

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
  const file = await getSiteFile(site.id, filename, previewSkinIdSafe);
  if (!file) {
    // Vercel 로그에서 누락 추적
    console.warn('[site-render][404]', { slug, siteId: site.id, filename });
    return new NextResponse('Not Found', { status: 404 });
  }

  // CSS 파일 — fileType 뿐 아니라 확장자로도 감지 (저장 시 fileType 정규화 불일치 방어)
  const isCss = file.fileType === 'css' || /\.css$/i.test(filename);
  if (isCss && file.content) {
    return new NextResponse(file.content, {
      headers: { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
  }

  // JS 파일 — 동일한 이중 감지
  const isJs = file.fileType === 'js' || /\.m?js$/i.test(filename);
  if (isJs && file.content) {
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
    const rendered = await renderSiteFile(site.id, slug, filename, previewSkinIdSafe);
    if (!rendered) {
      return new NextResponse('Render Error', { status: 500 });
    }

    return new NextResponse(rendered, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // 미리보기는 캐시하지 않음 — 스킨 변경 즉시 반영
        'Cache-Control': previewSkinIdSafe
          ? 'no-store'
          : 'public, max-age=60, s-maxage=120',
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
