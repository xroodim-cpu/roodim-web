import { db } from '@/lib/db';
import {
  maintenanceRequests,
  maintenanceMessages,
} from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/admin-session';
import { syncStatusToLink } from '@/lib/maintenance-sync';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const VALID_STATUSES = ['pending', 'reviewing', 'working', 'done', 'cancelled'] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];
const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
type ValidPriority = (typeof VALID_PRIORITIES)[number];

function isValidStatus(v: unknown): v is ValidStatus {
  return typeof v === 'string' && (VALID_STATUSES as readonly string[]).includes(v);
}
function isValidPriority(v: unknown): v is ValidPriority {
  return typeof v === 'string' && (VALID_PRIORITIES as readonly string[]).includes(v);
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }

    const session = await verifyAdminAccess(slug);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestId = Number.parseInt(id, 10);
    if (!Number.isFinite(requestId)) {
      return NextResponse.json({ error: 'invalid id' }, { status: 400 });
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
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const messages = await db
      .select()
      .from(maintenanceMessages)
      .where(eq(maintenanceMessages.maintenanceRequestId, request.id))
      .orderBy(maintenanceMessages.createdAt);

    return NextResponse.json({
      ok: true,
      request: {
        ...request,
        messages,
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/maintenance/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await req.json();
    const slug: string | undefined = body?.slug;

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }

    const session = await verifyAdminAccess(slug);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestId = Number.parseInt(id, 10);
    if (!Number.isFinite(requestId)) {
      return NextResponse.json({ error: 'invalid id' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    let statusChanged = false;
    let nextStatus: ValidStatus | null = null;

    if (body.status !== undefined) {
      if (!isValidStatus(body.status)) {
        return NextResponse.json({ error: 'invalid status' }, { status: 400 });
      }
      updates.status = body.status;
      statusChanged = true;
      nextStatus = body.status;
      if (body.status === 'done') {
        updates.resolvedAt = new Date();
      }
    }

    if (body.priority !== undefined) {
      if (!isValidPriority(body.priority)) {
        return NextResponse.json({ error: 'invalid priority' }, { status: 400 });
      }
      updates.priority = body.priority;
    }

    if (typeof body.title === 'string' && body.title.trim() !== '') {
      updates.title = body.title.trim();
    }
    if (typeof body.description === 'string') {
      updates.description = body.description;
    }
    if (typeof body.category === 'string') {
      updates.category = body.category;
    }

    const [updated] = await db
      .update(maintenanceRequests)
      .set(updates)
      .where(
        and(
          eq(maintenanceRequests.id, requestId),
          eq(maintenanceRequests.siteId, session.site_id)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // 상태 변경 시 루딤링크 MySQL 동기화 (fire-and-forget)
    if (statusChanged && nextStatus) {
      syncStatusToLink({
        requestId: updated.id,
        externalAdminId: updated.externalAdminId,
        status: nextStatus,
        updatedBy: session.name,
      }).catch((err) => {
        console.error('[maintenance-sync:status] background error', err);
      });
    }

    return NextResponse.json({ ok: true, request: updated });
  } catch (error) {
    console.error('[PUT /api/admin/maintenance/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
