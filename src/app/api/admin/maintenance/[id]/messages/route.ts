import { db } from '@/lib/db';
import { maintenanceMessages, maintenanceRequests, sites } from '@/drizzle/schema';
import { and, eq, gt } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/admin-session';
import { syncMessageToLink } from '@/lib/maintenance-sync';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function resolveRequest(slug: string | null, rawId: string) {
  if (!slug) {
    return {
      error: NextResponse.json({ error: 'slug is required' }, { status: 400 }),
    } as const;
  }
  const requestId = Number.parseInt(rawId, 10);
  if (!Number.isFinite(requestId)) {
    return {
      error: NextResponse.json({ error: 'invalid id' }, { status: 400 }),
    } as const;
  }

  const session = await verifyAdminAccess(slug);
  if (!session) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    } as const;
  }

  const [request] = await db
    .select()
    .from(maintenanceRequests)
    .where(
      and(
        eq(maintenanceRequests.id, requestId),
        eq(maintenanceRequests.siteId, session.site_id)
      )
    )
    .limit(1);

  if (!request) {
    return {
      error: NextResponse.json({ error: 'Request not found' }, { status: 404 }),
    } as const;
  }

  return { session, request } as const;
}

/**
 * GET /api/admin/maintenance/[id]/messages?slug=xxx[&since=<ISO timestamp>]
 * 실시간 폴링: `since` 이후 생성된 메시지만 반환
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const since = searchParams.get('since');

    const resolved = await resolveRequest(slug, id);
    if ('error' in resolved) return resolved.error;

    let whereClause = eq(maintenanceMessages.maintenanceRequestId, resolved.request.id);
    if (since) {
      const sinceDate = new Date(since);
      if (!Number.isNaN(sinceDate.getTime())) {
        whereClause = and(
          eq(maintenanceMessages.maintenanceRequestId, resolved.request.id),
          gt(maintenanceMessages.createdAt, sinceDate)
        )!;
      }
    }

    const rows = await db
      .select()
      .from(maintenanceMessages)
      .where(whereClause)
      .orderBy(maintenanceMessages.createdAt);

    return NextResponse.json({
      ok: true,
      messages: rows,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[GET /api/admin/maintenance/[id]/messages]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/maintenance/[id]/messages?slug=xxx
 * body: { body, senderType?, senderName? }
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const body = await req.json();

    if (!body?.body || typeof body.body !== 'string' || !body.body.trim()) {
      return NextResponse.json({ error: 'body is required' }, { status: 400 });
    }

    const resolved = await resolveRequest(slug, id);
    if ('error' in resolved) return resolved.error;

    const [message] = await db
      .insert(maintenanceMessages)
      .values({
        maintenanceRequestId: resolved.request.id,
        body: body.body.trim(),
        senderType: body.senderType === 'customer' ? 'customer' : 'staff',
        senderName: body.senderName || resolved.session.name || 'Staff',
        attachments: [],
      })
      .returning();

    // updatedAt 터치
    await db
      .update(maintenanceRequests)
      .set({ updatedAt: new Date() })
      .where(eq(maintenanceRequests.id, resolved.request.id));

    // 루딤링크 MySQL 으로 아웃바운드 sync (fire-and-forget)
    syncMessageToLink({
      siteId: resolved.request.siteId,
      externalAdminId: resolved.request.externalAdminId,
      message,
    }).catch((err) => {
      console.error('[maintenance-sync:message] background error', err);
    });

    return NextResponse.json({ ok: true, message });
  } catch (error) {
    console.error('[POST /api/admin/maintenance/[id]/messages]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
