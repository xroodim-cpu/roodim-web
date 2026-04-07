import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reservations } from '@/drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slug = searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const status = searchParams.get('status');

  const conditions = status
    ? and(
        eq(reservations.siteId, session.site_id),
        eq(reservations.status, status as 'pending' | 'confirmed' | 'cancelled' | 'completed'),
      )
    : eq(reservations.siteId, session.site_id);

  const rows = await db
    .select()
    .from(reservations)
    .where(conditions)
    .orderBy(desc(reservations.createdAt));

  return NextResponse.json({ ok: true, data: rows });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, slug, status, adminMemo } = body;
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) updates.status = status;
  if (adminMemo !== undefined) updates.adminMemo = adminMemo;

  const [row] = await db
    .update(reservations)
    .set(updates)
    .where(and(eq(reservations.id, id), eq(reservations.siteId, session.site_id)))
    .returning();

  if (!row) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });

  return NextResponse.json({ ok: true, data: row });
}
