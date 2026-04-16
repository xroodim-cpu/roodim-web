import { db } from '@/lib/db';
import { sites, siteServices } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

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

    // 서비스 목록 조회 (활성 순, 정렬 순서)
    const services = await db
      .select()
      .from(siteServices)
      .where(eq(siteServices.siteId, site.id))
      .orderBy((t) => [t.sortOrder, t.createdAt]);

    return NextResponse.json({
      services,
      total: services.length,
    });
  } catch (error) {
    console.error('[GET /api/admin/services]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { slug, name, description, price, category, isActive, sortOrder } = await req.json();

    if (!slug || !name) {
      return NextResponse.json(
        { error: 'slug and name are required' },
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

    // 서비스 생성
    const result = await db
      .insert(siteServices)
      .values({
        siteId: site.id,
        name,
        description: description ?? null,
        price: price ?? null,
        category: category ?? null,
        isActive: typeof isActive === 'boolean' ? isActive : true,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
      })
      .returning();

    return NextResponse.json({
      service: result[0],
    });
  } catch (error) {
    console.error('[POST /api/admin/services]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
