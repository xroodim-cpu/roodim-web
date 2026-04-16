import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { boards, boardPosts } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';

type Params = { params: Promise<{ boardId: string; postId: string }> };

/**
 * GET /api/admin/boards/[boardId]/posts/[postId]?slug=org-5
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { boardId, postId } = await params;
    const slug = req.nextUrl.searchParams.get('slug');
    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

    const session = await verifyAdminAccess(slug);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [post] = await db
      .select()
      .from(boardPosts)
      .where(and(
        eq(boardPosts.id, Number(postId)),
        eq(boardPosts.boardId, Number(boardId)),
        eq(boardPosts.siteId, session.site_id),
      ))
      .limit(1);

    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    // 조회수 증가
    await db
      .update(boardPosts)
      .set({ viewCount: post.viewCount + 1 })
      .where(eq(boardPosts.id, Number(postId)));

    return NextResponse.json({ ok: true, post: { ...post, viewCount: post.viewCount + 1 } });
  } catch (error) {
    console.error('[GET /api/admin/boards/[boardId]/posts/[postId]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/boards/[boardId]/posts/[postId]
 *
 * body: { slug, title?, content?, authorName?, isPinned?, isVisible?, replyContent? }
 *
 * `replyContent` 가 포함되면 문의게시판 답변으로 처리 —
 *   - 첫 답변(기존 replied_at 이 null) 일 때만 replied_at 세팅
 *   - replied_by 는 현재 어드민 세션의 name 으로 항상 업데이트
 *   - 공개 사이트엔 노출되지 않음 (방문자 비노출 정책)
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { boardId, postId } = await params;
    const body = await req.json();
    const { slug: siteSlug, title, content, authorName, isPinned, isVisible, replyContent } = body;

    if (!siteSlug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

    const session = await verifyAdminAccess(siteSlug);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (authorName !== undefined) updates.authorName = authorName;
    if (isPinned !== undefined) updates.isPinned = isPinned;
    if (isVisible !== undefined) updates.isVisible = isVisible;

    // 답변 처리 — replyContent 가 명시적으로 포함될 때만
    if (replyContent !== undefined) {
      updates.replyContent = replyContent;
      updates.repliedBy = session.name || 'admin';
      // 첫 답변일 때만 repliedAt 세팅 (기존 레코드 조회)
      const [existing] = await db
        .select({ repliedAt: boardPosts.repliedAt })
        .from(boardPosts)
        .where(and(
          eq(boardPosts.id, Number(postId)),
          eq(boardPosts.boardId, Number(boardId)),
          eq(boardPosts.siteId, session.site_id),
        ))
        .limit(1);
      if (existing && !existing.repliedAt) {
        updates.repliedAt = new Date();
      }
    }

    const [row] = await db
      .update(boardPosts)
      .set(updates)
      .where(and(
        eq(boardPosts.id, Number(postId)),
        eq(boardPosts.boardId, Number(boardId)),
        eq(boardPosts.siteId, session.site_id),
      ))
      .returning();

    if (!row) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    return NextResponse.json({ ok: true, post: row });
  } catch (error) {
    console.error('[PUT /api/admin/boards/[boardId]/posts/[postId]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/boards/[boardId]/posts/[postId]?slug=org-5
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { boardId, postId } = await params;
    const slug = req.nextUrl.searchParams.get('slug');
    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

    const session = await verifyAdminAccess(slug);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [post] = await db
      .select({ id: boardPosts.id })
      .from(boardPosts)
      .where(and(
        eq(boardPosts.id, Number(postId)),
        eq(boardPosts.boardId, Number(boardId)),
        eq(boardPosts.siteId, session.site_id),
      ))
      .limit(1);

    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    await db.delete(boardPosts).where(eq(boardPosts.id, Number(postId)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/admin/boards/[boardId]/posts/[postId]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
