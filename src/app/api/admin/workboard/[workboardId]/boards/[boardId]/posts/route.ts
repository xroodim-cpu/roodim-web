import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workboards, workboardMembers, boards, boardPosts } from '@/drizzle/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';

type Params = { params: Promise<{ workboardId: string; boardId: string }> };

/**
 * 워크보드 멤버십 + 보드 소유권 검증 헬퍼
 */
async function verifyWorkboardBoardAccess(
  slug: string,
  workboardId: number,
  boardId: number,
) {
  const session = await verifyAdminAccess(slug);
  if (!session) return null;

  // 멤버십 검증
  const [membership] = await db
    .select({ role: workboardMembers.role })
    .from(workboardMembers)
    .where(and(
      eq(workboardMembers.workboardId, workboardId),
      eq(workboardMembers.siteId, session.site_id),
    ))
    .limit(1);

  if (!membership) return null;

  // 워크보드 ownerSiteId
  const [wb] = await db
    .select({ ownerSiteId: workboards.ownerSiteId })
    .from(workboards)
    .where(eq(workboards.id, workboardId))
    .limit(1);

  if (!wb || !wb.ownerSiteId) return null;

  // 보드가 워크보드 소유 사이트에 속하는지 검증
  const [board] = await db
    .select({ id: boards.id, siteId: boards.siteId })
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.siteId, wb.ownerSiteId)))
    .limit(1);

  if (!board) return null;

  return { session, role: membership.role, ownerSiteId: wb.ownerSiteId };
}

/**
 * GET /api/admin/workboard/[workboardId]/boards/[boardId]/posts?slug=xxx
 * 워크보드 게시판의 글 목록 (페이지네이션)
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { workboardId, boardId } = await params;
    const slug = req.nextUrl.searchParams.get('slug');
    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

    const access = await verifyWorkboardBoardAccess(slug, Number(workboardId), Number(boardId));
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const page = Number(req.nextUrl.searchParams.get('page') || '1');
    const limit = 20;
    const offset = (page - 1) * limit;

    const [posts, countResult] = await Promise.all([
      db
        .select({
          id: boardPosts.id,
          title: boardPosts.title,
          content: boardPosts.content,
          authorName: boardPosts.authorName,
          authorEmail: boardPosts.authorEmail,
          isVisible: boardPosts.isVisible,
          isPinned: boardPosts.isPinned,
          viewCount: boardPosts.viewCount,
          replyContent: boardPosts.replyContent,
          repliedAt: boardPosts.repliedAt,
          repliedBy: boardPosts.repliedBy,
          createdAt: boardPosts.createdAt,
          updatedAt: boardPosts.updatedAt,
        })
        .from(boardPosts)
        .where(eq(boardPosts.boardId, Number(boardId)))
        .orderBy(desc(boardPosts.isPinned), desc(boardPosts.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(boardPosts)
        .where(eq(boardPosts.boardId, Number(boardId))),
    ]);

    return NextResponse.json({
      ok: true,
      role: access.role,
      posts,
      pagination: {
        page,
        limit,
        total: countResult[0]?.count ?? 0,
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/workboard/.../posts]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/workboard/[workboardId]/boards/[boardId]/posts
 * 워크보드 게시판에 글 작성 (editor 역할만 가능)
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { workboardId, boardId } = await params;
    const body = await req.json();
    const { slug, title, content, authorName } = body;

    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

    const access = await verifyWorkboardBoardAccess(slug, Number(workboardId), Number(boardId));
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    if (access.role !== 'editor') {
      return NextResponse.json({ error: '글 작성 권한이 없습니다. (editor 역할 필요)' }, { status: 403 });
    }

    const [post] = await db.insert(boardPosts).values({
      boardId: Number(boardId),
      siteId: access.ownerSiteId,
      title,
      content: content || '',
      authorName: authorName || access.session.name || '워크보드 멤버',
    }).returning();

    return NextResponse.json({ ok: true, post });
  } catch (error) {
    console.error('[POST /api/admin/workboard/.../posts]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
