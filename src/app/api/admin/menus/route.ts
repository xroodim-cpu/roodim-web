import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { siteMenuItems } from '@/drizzle/schema';
import { eq, and, asc } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';

// GET /api/admin/menus?slug=xxx[&menuType=menubar]
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slug = searchParams.get('slug');
  const menuType = searchParams.get('menuType');

  if (!slug) {
    return NextResponse.json(
      { error: 'slug is required' },
      { status: 400 }
    );
  }

  const session = await verifyAdminAccess(slug);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const whereClause = menuType
    ? and(
        eq(siteMenuItems.siteId, session.site_id),
        eq(siteMenuItems.menuType, menuType)
      )
    : eq(siteMenuItems.siteId, session.site_id);

  const rows = await db
    .select()
    .from(siteMenuItems)
    .where(whereClause)
    .orderBy(asc(siteMenuItems.menuType), asc(siteMenuItems.sortOrder));

  return NextResponse.json({ ok: true, data: rows });
}

// POST /api/admin/menus  body: { slug, menuType, label, url, sortOrder, isActive }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slug, menuType, label, url, icon, sortOrder, isActive, parentId } =
    body;

  if (!slug) {
    return NextResponse.json(
      { error: 'slug is required' },
      { status: 400 }
    );
  }

  const session = await verifyAdminAccess(slug);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!menuType || !label) {
    return NextResponse.json(
      { error: 'menuType and label are required' },
      { status: 400 }
    );
  }

  const [row] = await db
    .insert(siteMenuItems)
    .values({
      siteId: session.site_id,
      menuType,
      label,
      url: url ?? null,
      icon: icon ?? null,
      sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
      isActive: typeof isActive === 'boolean' ? isActive : true,
      parentId: parentId ?? null,
    })
    .returning();

  return NextResponse.json({ ok: true, data: row });
}

// PUT /api/admin/menus  body: { slug, id, ...fields }
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { slug, id } = body;

  if (!slug) {
    return NextResponse.json(
      { error: 'slug is required' },
      { status: 400 }
    );
  }
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const session = await verifyAdminAccess(slug);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.menuType === 'string') updates.menuType = body.menuType;
  if (typeof body.label === 'string' && body.label.trim() !== '')
    updates.label = body.label;
  if (body.url !== undefined) updates.url = body.url;
  if (body.icon !== undefined) updates.icon = body.icon;
  if (typeof body.sortOrder === 'number') updates.sortOrder = body.sortOrder;
  if (typeof body.isActive === 'boolean') updates.isActive = body.isActive;
  if (body.parentId !== undefined) updates.parentId = body.parentId;

  const [row] = await db
    .update(siteMenuItems)
    .set(updates)
    .where(
      and(
        eq(siteMenuItems.id, id),
        eq(siteMenuItems.siteId, session.site_id)
      )
    )
    .returning();

  if (!row) {
    return NextResponse.json(
      { error: 'Menu item not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, data: row });
}

// DELETE /api/admin/menus  body: { slug, id }
export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { slug, id } = body;

  if (!slug) {
    return NextResponse.json(
      { error: 'slug is required' },
      { status: 400 }
    );
  }
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const session = await verifyAdminAccess(slug);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [row] = await db
    .delete(siteMenuItems)
    .where(
      and(
        eq(siteMenuItems.id, id),
        eq(siteMenuItems.siteId, session.site_id)
      )
    )
    .returning();

  if (!row) {
    return NextResponse.json(
      { error: 'Menu item not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, data: { id: row.id } });
}
