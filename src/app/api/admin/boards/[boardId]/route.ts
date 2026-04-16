import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { boards } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';

/**
 * GET /api/admin/boards/[boardId]?slug=org-5
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const slug = req.nextUrl.searchParams.get('slug');
    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

    const session = await verifyAdminAccess(slug);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [board] = await db
      .select()
      .from(boards)
      .where(and(eq(boards.id, Number(boardId)), eq(boards.siteId, session.site_id)))
      .limit(1);

    if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

    return NextResponse.json({ ok: true, board });
  } catch (error) {
    console.error('[GET /api/admin/boards/[boardId]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/boards/[boardId]
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const body = await req.json();
    const { slug: siteSlug, name, description, isActive } = body;

    if (!siteSlug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

    const session = await verifyAdminAccess(siteSlug);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.isActive = isActive;

    const [row] = await db
      .update(boards)
      .set(updates)
      .where(and(eq(boards.id, Number(boardId)), eq(boards.siteId, session.site_id)))
      .returning();

    if (!row) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

    return NextResponse.json({ ok: true, board: row });
  } catch (error) {
    console.error('[PUT /api/admin/boards/[boardId]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/boards/[boardId]
 * 시스템 게시판 삭제 불가
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const slug = req.nextUrl.searchParams.get('slug');
    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

    const session = await verifyAdminAccess(slug);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 게시판 조회
    const [board] = await db
      .select()
      .from(boards)
      .where(and(eq(boards.id, Number(boardId)), eq(boards.siteId, session.site_id)))
      .limit(1);

    if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    if (board.boardType === 'system') {
      return NextResponse.json({ error: '시스템 게시판은 삭제할 수 없습니다.' }, { status: 403 });
    }

    await db.delete(boards).where(eq(boards.id, Number(boardId)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/admin/boards/[boardId]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
