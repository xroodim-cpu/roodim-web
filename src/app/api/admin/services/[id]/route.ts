import { db } from '@/lib/db';
import { sites, siteServices } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { slug, name, description, price, category, isActive, sortOrder } = await req.json();
    const { id } = await params;

    if (!slug || !id) {
      return NextResponse.json(
        { error: 'slug and id are required' },
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

    // 서비스 업데이트 (undefined = 변경 없음, null/빈값 = 덮어쓰기)
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof name === 'string' && name.trim() !== '') updates.name = name;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = price;
    if (category !== undefined) updates.category = category;
    if (typeof isActive === 'boolean') updates.isActive = isActive;
    if (typeof sortOrder === 'number') updates.sortOrder = sortOrder;

    const result = await db
      .update(siteServices)
      .set(updates)
      .where(
        and(
          eq(siteServices.id, parseInt(id)),
          eq(siteServices.siteId, site.id)
        )
      )
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      service: result[0],
    });
  } catch (error) {
    console.error('[PUT /api/admin/services/[id]]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const { id } = await params;

    if (!slug || !id) {
      return NextResponse.json(
        { error: 'slug and id are required' },
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

    // 서비스 삭제
    const result = await db
      .delete(siteServices)
      .where(
        and(
          eq(siteServices.id, parseInt(id)),
          eq(siteServices.siteId, site.id)
        )
      )
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Service deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/admin/services/[id]]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
