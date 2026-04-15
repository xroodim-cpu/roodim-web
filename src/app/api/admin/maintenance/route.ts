import { db } from '@/lib/db';
import { sites, maintenanceRequests } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const status = searchParams.get('status');

    if (!slug) {
      return NextResponse.json(
        { error: 'slug parameter is required' },
        { status: 400 }
      );
    }

    // 사이트 조회
    const site = await db.query.sites.findFirst({
      where: eq(sites.slug, slug),
    });

    if (!site) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      );
    }

    // 유지보수 요청 조회
    let query = db
      .select()
      .from(maintenanceRequests)
      .where(eq(maintenanceRequests.siteId, site.id));

    if (status && status !== 'all') {
      query = db
        .select()
        .from(maintenanceRequests)
        .where(
          eq(maintenanceRequests.status, status as any)
        );
    }

    const requests = await query;

    return NextResponse.json({
      requests,
      total: requests.length,
    });
  } catch (error) {
    console.error('[GET /api/admin/maintenance]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { slug, title, description, category, priority } = await req.json();

    if (!slug || !title) {
      return NextResponse.json(
        { error: 'slug and title are required' },
        { status: 400 }
      );
    }

    // 사이트 조회
    const site = await db.query.sites.findFirst({
      where: eq(sites.slug, slug),
    });

    if (!site) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      );
    }

    // 유지보수 요청 생성
    const result = await db
      .insert(maintenanceRequests)
      .values({
        siteId: site.id,
        title,
        description: description || '',
        category: category || 'other',
        priority: priority || 'normal',
        status: 'pending',
        requestedBy: {},
        attachments: [],
      })
      .returning();

    return NextResponse.json({
      request: result[0],
    });
  } catch (error) {
    console.error('[POST /api/admin/maintenance]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
