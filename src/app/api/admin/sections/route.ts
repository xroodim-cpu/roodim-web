import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { siteSections } from '@/drizzle/schema';
import { eq, and, asc } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slug = searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db
    .select()
    .from(siteSections)
    .where(eq(siteSections.siteId, session.site_id))
    .orderBy(asc(siteSections.sortOrder));

  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slug, sectionKey, sortOrder, isActive, settings } = body;
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!sectionKey) {
    return NextResponse.json({ error: 'sectionKey is required' }, { status: 400 });
  }

  const [row] = await db
    .insert(siteSections)
    .values({
      siteId: session.site_id,
      sectionKey,
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true,
      settings: settings ?? {},
    })
    .returning();

  return NextResponse.json({ ok: true, data: row });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, slug } = body;
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.sectionKey !== undefined) updates.sectionKey = body.sectionKey;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  if (body.settings !== undefined) updates.settings = body.settings;

  const [row] = await db
    .update(siteSections)
    .set(updates)
    .where(and(eq(siteSections.id, id), eq(siteSections.siteId, session.site_id)))
    .returning();

  if (!row) return NextResponse.json({ error: 'Section not found' }, { status: 404 });

  return NextResponse.json({ ok: true, data: row });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { id, slug } = body;
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [row] = await db
    .delete(siteSections)
    .where(and(eq(siteSections.id, id), eq(siteSections.siteId, session.site_id)))
    .returning();

  if (!row) return NextResponse.json({ error: 'Section not found' }, { status: 404 });

  return NextResponse.json({ ok: true, data: { id: row.id } });
}
