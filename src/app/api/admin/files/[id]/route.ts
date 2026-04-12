import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { siteFiles, sites } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { getAdminSession } from '@/lib/admin-session';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/files/[id] — 파일 내용 읽기
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const fileId = parseInt(id);
  if (isNaN(fileId)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [file] = await db.select()
    .from(siteFiles)
    .where(and(
      eq(siteFiles.id, fileId),
      eq(siteFiles.siteId, session.site_id)
    ))
    .limit(1);

  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    ok: true,
    file: {
      id: file.id,
      filename: file.filename,
      fileType: file.fileType,
      content: file.content,
      blobUrl: file.blobUrl,
      fileSize: file.fileSize,
      isEntry: file.isEntry,
      updatedAt: file.updatedAt,
    },
  });
}

/**
 * PUT /api/admin/files/[id] — 파일 내용 저장
 * body: { content }
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const fileId = parseInt(id);
  if (isNaN(fileId)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { content } = body as { content: string };

  if (content === undefined) return NextResponse.json({ error: 'content required' }, { status: 400 });

  const [updated] = await db.update(siteFiles)
    .set({
      content,
      fileSize: content.length,
      updatedAt: new Date(),
    })
    .where(and(
      eq(siteFiles.id, fileId),
      eq(siteFiles.siteId, session.site_id)
    ))
    .returning({ id: siteFiles.id, filename: siteFiles.filename });

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true, file: updated });
}

/**
 * DELETE /api/admin/files/[id] — 파일 삭제
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const fileId = parseInt(id);
  if (isNaN(fileId)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // index.html은 삭제 불가
  const [file] = await db.select({ filename: siteFiles.filename, isEntry: siteFiles.isEntry })
    .from(siteFiles)
    .where(and(
      eq(siteFiles.id, fileId),
      eq(siteFiles.siteId, session.site_id)
    ))
    .limit(1);

  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (file.isEntry) return NextResponse.json({ error: 'Cannot delete entry file' }, { status: 403 });

  await db.delete(siteFiles)
    .where(and(
      eq(siteFiles.id, fileId),
      eq(siteFiles.siteId, session.site_id)
    ));

  return NextResponse.json({ ok: true });
}
