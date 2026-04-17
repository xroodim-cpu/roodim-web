import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workboards, workboardMembers, sites } from '@/drizzle/schema';
import { eq, sql } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';

/**
 * GET /api/admin/workboard?slug=xxx
 * 현재 사이트가 멤버로 속한 워크보드 목록
 */
export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('slug');
    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

    const session = await verifyAdminAccess(slug);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await db
      .select({
        id: workboards.id,
        name: workboards.name,
        slug: workboards.slug,
        ownerSiteId: workboards.ownerSiteId,
        visibility: workboards.visibility,
        role: workboardMembers.role,
        ownerSiteName: sql<string>`(SELECT name FROM sites WHERE id = ${workboards.ownerSiteId})`.as('owner_site_name'),
        createdAt: workboards.createdAt,
      })
      .from(workboardMembers)
      .innerJoin(workboards, eq(workboardMembers.workboardId, workboards.id))
      .where(eq(workboardMembers.siteId, session.site_id));

    return NextResponse.json({ ok: true, workboards: rows });
  } catch (error) {
    console.error('[GET /api/admin/workboard]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
