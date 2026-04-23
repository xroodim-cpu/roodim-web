import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { siteFiles, sites, webSkins } from '@/drizzle/schema';
import { eq, and, asc } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';
import { getAvailableVariables } from '@/lib/template-engine';

/**
 * GET /api/admin/files?slug=X — 파일 목록 + 치환코드 목록 + 적용 중인 스킨 메타
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const files = await db.select()
    .from(siteFiles)
    .where(eq(siteFiles.siteId, session.site_id))
    .orderBy(asc(siteFiles.sortOrder), asc(siteFiles.filename));

  // content는 목록에서 제외 (너무 큼)
  const fileList = files.map(f => ({
    id: f.id,
    filename: f.filename,
    fileType: f.fileType,
    fileSize: f.fileSize,
    isEntry: f.isEntry,
    sortOrder: f.sortOrder,
    updatedAt: f.updatedAt,
  }));

  // 현재 사이트에 적용된 스킨 메타 조회 (이름 인라인 편집용)
  const [siteRow] = await db.select({ skinId: sites.skinId })
    .from(sites)
    .where(eq(sites.id, session.site_id))
    .limit(1);

  let skin: { id: number; slug: string; name: string; description: string | null } | null = null;
  if (siteRow?.skinId) {
    const [s] = await db.select({
      id: webSkins.id,
      slug: webSkins.slug,
      name: webSkins.name,
      description: webSkins.description,
    }).from(webSkins).where(eq(webSkins.id, siteRow.skinId)).limit(1);
    if (s) skin = s;
  }

  return NextResponse.json({
    ok: true,
    files: fileList,
    variables: getAvailableVariables(),
    skin,
  });
}

/**
 * POST /api/admin/files?slug=X — 새 파일 생성
 * body: { filename, fileType?, content? }
 */
export async function POST(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  let { filename } = body as { filename: string };

  if (!filename) return NextResponse.json({ error: 'filename required' }, { status: 400 });

  // 파일명 정규화
  filename = filename.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (!filename) return NextResponse.json({ error: 'invalid filename' }, { status: 400 });

  // 확장자가 없으면 .html 추가
  if (!filename.includes('.')) {
    filename = `${filename}.html`;
  }

  // 파일 타입 결정
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const fileType = ext === 'css' ? 'css' :
    ext === 'js' ? 'js' :
    ['html', 'htm'].includes(ext) ? 'html' :
    ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext) ? 'image' : 'other';

  // 중복 확인
  const existing = await db.select({ id: siteFiles.id })
    .from(siteFiles)
    .where(and(
      eq(siteFiles.siteId, session.site_id),
      eq(siteFiles.filename, filename)
    ))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ error: 'file already exists' }, { status: 409 });
  }

  // 기본 HTML 내용
  const defaultContent = fileType === 'html'
    ? `<!--@include("header.html")-->\n\n<main>\n  <h1>새 페이지</h1>\n  <p>내용을 입력하세요.</p>\n</main>\n\n<!--@include("footer.html")-->`
    : fileType === 'css' ? '/* 스타일 작성 */'
    : fileType === 'js' ? '// 스크립트 작성' : '';

  const [file] = await db.insert(siteFiles).values({
    siteId: session.site_id,
    filename,
    fileType,
    content: body.content || defaultContent,
    fileSize: (body.content || defaultContent).length,
    isEntry: filename === 'index.html',
  }).returning();

  return NextResponse.json({ ok: true, file: { id: file.id, filename: file.filename, fileType: file.fileType } }, { status: 201 });
}
