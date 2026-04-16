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
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { boardId, postId } = await params;
    const body = await req.json();
    const { slug: siteSlug, title, content, authorName, isPinned, isVisible } = body;

    if (!siteSlug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

    const session = await verifyAdminAccess(siteSlug);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (authorName !== undefined) updates.authorName = authorName;
    if (isPinned !== undefined) updates.isPinned = isPinned;
    if (isVisible !== undefined) updates.isVisible = isVisible;

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
