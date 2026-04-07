import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { maintenanceRequests } from '@/drizzle/schema';
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
        eq(maintenanceRequests.siteId, session.site_id),
        eq(maintenanceRequests.status, status as 'pending' | 'reviewing' | 'working' | 'done' | 'cancelled'),
      )
    : eq(maintenanceRequests.siteId, session.site_id);

  const rows = await db
    .select()
    .from(maintenanceRequests)
    .where(conditions)
    .orderBy(desc(maintenanceRequests.createdAt));

  return NextResponse.json({ ok: true, data: rows });
}
