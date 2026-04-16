import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { boards, boardPosts } from '@/drizzle/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';

/**
 * GET /api/admin/boards/[boardId]/posts?slug=org-5&page=1&limit=20&pinned=true
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const sp = req.nextUrl.searchParams;
    const slug = sp.get('slug');
    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

    const session = await verifyAdminAccess(slug);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 게시판 소유 확인
    const [board] = await db
      .select({ id: boards.id })
      .from(boards)
      .where(and(eq(boards.id, Number(boardId)), eq(boards.siteId, session.site_id)))
      .limit(1);
    if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

    const page = Math.max(1, Number(sp.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(sp.get('limit') || 20)));
    const offset = (page - 1) * limit;
    const pinnedOnly = sp.get('pinned') === 'true';

    const conditions = [eq(boardPosts.boardId, Number(boardId))];
    if (pinnedOnly) conditions.push(eq(boardPosts.isPinned, true));

    const rows = await db
      .select()
      .from(boardPosts)
      .where(and(...conditions))
      .orderBy(desc(boardPosts.isPinned), desc(boardPosts.createdAt))
      .limit(limit)
      .offset(offset);

    // 전체 개수
    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(boardPosts)
      .where(and(...conditions));

    return NextResponse.json({
      ok: true,
      posts: rows,
      total: Number(countResult?.count || 0),
      page,
      limit,
    });
  } catch (error) {
    console.error('[GET /api/admin/boards/[boardId]/posts]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/boards/[boardId]/posts
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const body = await req.json();
    const { slug: siteSlug, title, content, authorName, authorEmail, authorPhone, isPinned, formData } = body;

    if (!siteSlug || !title) {
      return NextResponse.json({ error: 'slug and title are required' }, { status: 400 });
    }

    const session = await verifyAdminAccess(siteSlug);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 게시판 소유 확인
    const [board] = await db
      .select({ id: boards.id })
      .from(boards)
      .where(and(eq(boards.id, Number(boardId)), eq(boards.siteId, session.site_id)))
      .limit(1);
    if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

    const [row] = await db.insert(boardPosts).values({
      boardId: Number(boardId),
      siteId: session.site_id,
      title,
      content: content || '',
      authorName: authorName || session.name || '관리자',
      authorEmail: authorEmail || null,
      authorPhone: authorPhone || null,
      isPinned: isPinned === true,
      formData: formData || null,
    }).returning();

    return NextResponse.json({ ok: true, post: row });
  } catch (error) {
    console.error('[POST /api/admin/boards/[boardId]/posts]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
