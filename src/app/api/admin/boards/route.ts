import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { boards, boardPosts } from '@/drizzle/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';
import { ensureSystemBoards } from '@/lib/board-utils';

/**
 * GET /api/admin/boards?slug=org-5
 * 게시판 목록 + 각 게시판의 게시물 수
 */
export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('slug');
    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

    const session = await verifyAdminAccess(slug);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 시스템 게시판 자동 생성
    await ensureSystemBoards(session.site_id);

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
      .where(eq(boards.siteId, session.site_id))
      .orderBy(boards.sortOrder, boards.createdAt);

    return NextResponse.json({ ok: true, boards: rows });
  } catch (error) {
    console.error('[GET /api/admin/boards]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/boards
 * 커스텀 게시판 생성
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug: siteSlug, name, boardSlug, description } = body;

    if (!siteSlug || !name || !boardSlug) {
      return NextResponse.json({ error: 'slug, name, boardSlug are required' }, { status: 400 });
    }

    const session = await verifyAdminAccess(siteSlug);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // slug 중복 체크
    const existing = await db
      .select({ id: boards.id })
      .from(boards)
      .where(and(eq(boards.siteId, session.site_id), eq(boards.slug, boardSlug)))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: '이미 사용 중인 게시판 슬러그입니다.' }, { status: 409 });
    }

    // 최대 sortOrder 구하기
    const maxSort = await db
      .select({ max: sql<number>`COALESCE(MAX(sort_order), 0)` })
      .from(boards)
      .where(eq(boards.siteId, session.site_id));

    const [row] = await db.insert(boards).values({
      siteId: session.site_id,
      name,
      slug: boardSlug,
      boardType: 'custom',
      description: description || null,
      sortOrder: (maxSort[0]?.max ?? 0) + 1,
    }).returning();

    return NextResponse.json({ ok: true, board: row });
  } catch (error) {
    console.error('[POST /api/admin/boards]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
