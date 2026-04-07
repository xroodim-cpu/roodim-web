import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { siteConfigs } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slug = searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db
    .select()
    .from(siteConfigs)
    .where(eq(siteConfigs.siteId, session.site_id));

  const configMap: Record<string, unknown> = {};
  for (const row of rows) {
    configMap[row.section] = row.data;
  }

  return NextResponse.json({ ok: true, data: configMap });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { slug, section, data } = body;
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  if (!section) return NextResponse.json({ error: 'section is required' }, { status: 400 });
  if (data === undefined) return NextResponse.json({ error: 'data is required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check if config exists
  const existing = await db
    .select({ id: siteConfigs.id })
    .from(siteConfigs)
    .where(and(eq(siteConfigs.siteId, session.site_id), eq(siteConfigs.section, section)))
    .limit(1);

  let row;
  if (existing[0]) {
    [row] = await db
      .update(siteConfigs)
      .set({ data, updatedAt: new Date() })
      .where(and(eq(siteConfigs.siteId, session.site_id), eq(siteConfigs.section, section)))
      .returning();
  } else {
    [row] = await db
      .insert(siteConfigs)
      .values({ siteId: session.site_id, section, data, updatedAt: new Date() })
      .returning();
  }

  return NextResponse.json({ ok: true, data: row });
}
