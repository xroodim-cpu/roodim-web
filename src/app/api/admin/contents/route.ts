import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { siteContents } from '@/drizzle/schema';
import { eq, and, asc } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slug = searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const type = searchParams.get('type');

  const conditions = type
    ? and(eq(siteContents.siteId, session.site_id), eq(siteContents.type, type))
    : eq(siteContents.siteId, session.site_id);

  const rows = await db
    .select()
    .from(siteContents)
    .where(conditions)
    .orderBy(asc(siteContents.sortOrder));

  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slug, type, title, summary, content, thumbUrl, metaJson, sortOrder, isVisible, startAt, endAt } = body;
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!type || !title) {
    return NextResponse.json({ error: 'type and title are required' }, { status: 400 });
  }

  // Generate a content slug from title
  const contentSlug = body.slug_content
    ?? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    ?? `content-${Date.now()}`;

  const [row] = await db
    .insert(siteContents)
    .values({
      siteId: session.site_id,
      type,
      slug: contentSlug,
      title,
      summary: summary ?? null,
      content: content ?? null,
      thumbUrl: thumbUrl ?? null,
      metaJson: metaJson ?? {},
      sortOrder: sortOrder ?? 0,
      isVisible: isVisible ?? true,
      startAt: startAt ? new Date(startAt) : null,
      endAt: endAt ? new Date(endAt) : null,
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
  if (body.type !== undefined) updates.type = body.type;
  if (body.title !== undefined) updates.title = body.title;
  if (body.summary !== undefined) updates.summary = body.summary;
  if (body.content !== undefined) updates.content = body.content;
  if (body.thumbUrl !== undefined) updates.thumbUrl = body.thumbUrl;
  if (body.metaJson !== undefined) updates.metaJson = body.metaJson;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
  if (body.isVisible !== undefined) updates.isVisible = body.isVisible;
  if (body.startAt !== undefined) updates.startAt = body.startAt ? new Date(body.startAt) : null;
  if (body.endAt !== undefined) updates.endAt = body.endAt ? new Date(body.endAt) : null;

  const [row] = await db
    .update(siteContents)
    .set(updates)
    .where(and(eq(siteContents.id, id), eq(siteContents.siteId, session.site_id)))
    .returning();

  if (!row) return NextResponse.json({ error: 'Content not found' }, { status: 404 });

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
    .delete(siteContents)
    .where(and(eq(siteContents.id, id), eq(siteContents.siteId, session.site_id)))
    .returning();

  if (!row) return NextResponse.json({ error: 'Content not found' }, { status: 404 });

  return NextResponse.json({ ok: true, data: { id: row.id } });
}
