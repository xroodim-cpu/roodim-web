import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workboards, workboardMembers, boards, boardPosts } from '@/drizzle/schema';
import { eq, and, sql } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';

type Params = { params: Promise<{ workboardId: string }> };

/**
 * GET /api/admin/workboard/[workboardId]/boards?slug=xxx
 * 워크보드 소유 사이트의 게시판 목록
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { workboardId } = await params;
    const slug = req.nextUrl.searchParams.get('slug');
    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

    const session = await verifyAdminAccess(slug);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 멤버십 검증
    const [membership] = await db
      .select({ role: workboardMembers.role })
      .from(workboardMembers)
      .where(and(
        eq(workboardMembers.workboardId, Number(workboardId)),
        eq(workboardMembers.siteId, session.site_id),
      ))
      .limit(1);

    if (!membership) return NextResponse.json({ error: '워크보드 멤버가 아닙니다.' }, { status: 403 });

    // 워크보드의 ownerSiteId 조회
    const [wb] = await db
      .select({ ownerSiteId: workboards.ownerSiteId, name: workboards.name })
      .from(workboards)
      .where(eq(workboards.id, Number(workboardId)))
      .limit(1);

    if (!wb || !wb.ownerSiteId) return NextResponse.json({ error: '워크보드를 찾을 수 없습니다.' }, { status: 404 });

    // 소유 사이트의 게시판 목록
    const rows = await db
      .select({
        id: boards.id,
        name: boards.name,
        slug: boards.slug,
        boardType: boards.boardType,
        systemKey: boards.systemKey,
        description: boards.description,
        sortOrder: boards.sortOrder,
        isActive: boards.isActive,
        createdAt: boards.createdAt,
        postCount: sql<number>`(SELECT COUNT(*) FROM board_posts WHERE board_id = ${boards.id})`.as('post_count'),
      })
      .from(boards)
      .where(eq(boards.siteId, wb.ownerSiteId))
      .orderBy(boards.sortOrder, boards.createdAt);

    return NextResponse.json({
      ok: true,
      workboardName: wb.name,
      role: membership.role,
      boards: rows,
    });
  } catch (error) {
    console.error('[GET /api/admin/workboard/[workboardId]/boards]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
