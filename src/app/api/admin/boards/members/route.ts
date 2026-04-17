import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workboards, workboardMembers, sites } from '@/drizzle/schema';
import { eq, and, sql } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';

/**
 * GET /api/admin/boards/members?slug=org-5
 * 현재 사이트의 워크보드 멤버 목록 + 초대 가능한 사이트 목록
 */
export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('slug');
    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

    const session = await verifyAdminAccess(slug);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 현재 사이트가 소유한 워크보드 찾기 (없으면 null)
    const wb = await db.select()
      .from(workboards)
      .where(eq(workboards.ownerSiteId, session.site_id))
      .limit(1);

    if (wb.length === 0) {
      return NextResponse.json({
        ok: true,
        workboard: null,
        members: [],
        availableSites: [],
      });
    }

    const workboard = wb[0];

    // 멤버 목록
    const members = await db.select({
      id: workboardMembers.id,
      siteId: workboardMembers.siteId,
      role: workboardMembers.role,
      customerName: workboardMembers.customerName,
      adminCustomerId: workboardMembers.adminCustomerId,
      invitedAt: workboardMembers.invitedAt,
    })
      .from(workboardMembers)
      .where(eq(workboardMembers.workboardId, workboard.id))
      .orderBy(workboardMembers.invitedAt);

    // 초대 가능한 사이트 목록 (같은 조직의 다른 사이트, 아직 멤버가 아닌 것)
    const memberSiteIds = members.map(m => m.siteId);
    const allSites = await db.select({
      id: sites.id,
      name: sites.name,
      slug: sites.slug,
      adminCustomerId: sites.adminCustomerId,
    })
      .from(sites)
      .where(eq(sites.adminOrganizationId, workboard.organizationId!));

    const availableSites = allSites.filter(
      s => s.id !== session.site_id && !memberSiteIds.includes(s.id)
    );

    return NextResponse.json({
      ok: true,
      workboard: { id: workboard.id, name: workboard.name },
      members,
      availableSites,
    });
  } catch (error) {
    console.error('[GET /api/admin/boards/members]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/boards/members
 * 워크보드에 멤버 초대 (사이트 기반)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, siteId, role = 'viewer', customerName } = body;

    if (!slug || !siteId) {
      return NextResponse.json({ error: 'slug and siteId are required' }, { status: 400 });
    }

    const session = await verifyAdminAccess(slug);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 워크보드 찾기 (없으면 자동 생성)
    let wb = await db.select()
      .from(workboards)
      .where(eq(workboards.ownerSiteId, session.site_id))
      .limit(1);

    let workboardId: number;

    if (wb.length === 0) {
      // 사이트 정보 조회
      const siteInfo = await db.select({ name: sites.name, adminOrganizationId: sites.adminOrganizationId })
        .from(sites)
        .where(eq(sites.id, session.site_id))
        .limit(1);

      const siteName = siteInfo[0]?.name || slug;
      const orgId = siteInfo[0]?.adminOrganizationId;
      const wbSlug = `wb-${slug}-${Date.now()}`;

      const inserted = await db.insert(workboards).values({
        name: `${siteName} 워크보드`,
        slug: wbSlug,
        ownerSiteId: session.site_id,
        organizationId: orgId,
        ownerId: session.member_id,
        visibility: 'shared',
      }).returning({ id: workboards.id });

      workboardId = inserted[0].id;
    } else {
      workboardId = wb[0].id;
    }

    // 초대 대상 사이트의 고객 정보 조회
    const targetSite = await db.select({
      adminCustomerId: sites.adminCustomerId,
    })
      .from(sites)
      .where(eq(sites.id, siteId))
      .limit(1);

    const adminCustomerId = targetSite[0]?.adminCustomerId || null;

    // 멤버 추가
    await db.insert(workboardMembers).values({
      workboardId,
      siteId,
      role,
      customerName: customerName || null,
      adminCustomerId,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: '이미 초대된 사이트입니다.' }, { status: 409 });
    }
    console.error('[POST /api/admin/boards/members]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/boards/members
 * 워크보드 멤버 제거
 */
export async function DELETE(req: NextRequest) {
  try {
    const memberId = req.nextUrl.searchParams.get('memberId');
    const slug = req.nextUrl.searchParams.get('slug');

    if (!memberId || !slug) {
      return NextResponse.json({ error: 'memberId and slug are required' }, { status: 400 });
    }

    const session = await verifyAdminAccess(slug);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 워크보드 소유권 확인
    const wb = await db.select({ id: workboards.id })
      .from(workboards)
      .where(eq(workboards.ownerSiteId, session.site_id))
      .limit(1);

    if (wb.length === 0) {
      return NextResponse.json({ error: 'Workboard not found' }, { status: 404 });
    }

    await db.delete(workboardMembers)
      .where(
        and(
          eq(workboardMembers.id, parseInt(memberId)),
          eq(workboardMembers.workboardId, wb[0].id),
        )
      );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/admin/boards/members]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
