import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { maintenanceMessages, maintenanceRequests } from '@/drizzle/schema';
import { eq, and, asc } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { searchParams } = request.nextUrl;
  const slug = searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const requestId = parseInt(id, 10);
  if (isNaN(requestId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  // 요청이 이 사이트 소속인지 확인
  const [req] = await db
    .select({ id: maintenanceRequests.id })
    .from(maintenanceRequests)
    .where(and(
      eq(maintenanceRequests.id, requestId),
      eq(maintenanceRequests.siteId, session.site_id),
    ));

  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const messages = await db
    .select()
    .from(maintenanceMessages)
    .where(eq(maintenanceMessages.maintenanceRequestId, requestId))
    .orderBy(asc(maintenanceMessages.createdAt));

  return NextResponse.json({ ok: true, data: messages });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { searchParams } = request.nextUrl;
  const slug = searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const requestId = parseInt(id, 10);
  if (isNaN(requestId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  // 요청이 이 사이트 소속인지 확인
  const [req] = await db
    .select({ id: maintenanceRequests.id })
    .from(maintenanceRequests)
    .where(and(
      eq(maintenanceRequests.id, requestId),
      eq(maintenanceRequests.siteId, session.site_id),
    ));

  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const { message } = body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  // senderType: SSO=staff, credential=customer
  const senderType = session.auth_type === 'sso' ? 'staff' : 'customer';

  const [msg] = await db
    .insert(maintenanceMessages)
    .values({
      maintenanceRequestId: requestId,
      senderType,
      senderName: session.name,
      body: message.trim(),
    })
    .returning();

  return NextResponse.json({ ok: true, data: msg });
}
