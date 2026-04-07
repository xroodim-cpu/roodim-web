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

  // Transform to a section-keyed map for convenience
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

  // Upsert: insert or update on conflict
  const [row] = await db
    .insert(siteConfigs)
    .values({
      siteId: session.site_id,
      section,
      data,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [siteConfigs.siteId, siteConfigs.section],
      set: {
        data,
        updatedAt: new Date(),
      },
    })
    .returning();

  return NextResponse.json({ ok: true, data: row });
}
