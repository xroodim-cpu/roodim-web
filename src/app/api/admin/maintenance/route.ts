import { db } from '@/lib/db';
import { maintenanceRequests } from '@/drizzle/schema';
import { and, eq, desc } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/admin-session';

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const status = searchParams.get('status');

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }

    const session = await verifyAdminAccess(slug);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let whereClause = eq(maintenanceRequests.siteId, session.site_id);
    if (status && status !== 'all' && isValidStatus(status)) {
      whereClause = and(
        eq(maintenanceRequests.siteId, session.site_id),
        eq(maintenanceRequests.status, status)
      )!;
    }

    const rows = await db
      .select()
      .from(maintenanceRequests)
      .where(whereClause)
      .orderBy(desc(maintenanceRequests.createdAt));

    return NextResponse.json({
      ok: true,
      requests: rows,
      total: rows.length,
    });
  } catch (error) {
    console.error('[GET /api/admin/maintenance]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, title, description, category, priority } = body;

    if (!slug || !title) {
      return NextResponse.json(
        { error: 'slug and title are required' },
        { status: 400 }
      );
    }

    const session = await verifyAdminAccess(slug);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const priorityValue = isValidPriority(priority) ? priority : 'normal';

    const [row] = await db
      .insert(maintenanceRequests)
      .values({
        siteId: session.site_id,
        title: String(title).trim(),
        description: typeof description === 'string' ? description : '',
        category: typeof category === 'string' ? category : 'other',
        priority: priorityValue,
        status: 'pending',
        requestedBy: { name: session.name, auth_type: session.auth_type },
        attachments: [],
      })
      .returning();

    return NextResponse.json({ ok: true, request: row });
  } catch (error) {
    console.error('[POST /api/admin/maintenance]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
