import { db } from '@/lib/db';
import { maintenanceRequests, maintenanceMessages, sites } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json(
        { error: 'slug parameter is required' },
        { status: 400 }
      );
    }

    const request = await db.query.maintenanceRequests.findFirst({
      where: eq(maintenanceRequests.id, parseInt(id)),
    });

    if (!request) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    const messages = await db
      .select()
      .from(maintenanceMessages)
      .where(eq(maintenanceMessages.maintenanceRequestId, request.id))
      .orderBy((m) => m.createdAt);

    return NextResponse.json({
      request: {
        ...request,
        messages,
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/maintenance/[id]]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status } = await req.json();

    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      );
    }

    const request = await db
      .update(maintenanceRequests)
      .set({ status, updatedAt: new Date() })
      .where(eq(maintenanceRequests.id, parseInt(id)))
      .returning();

    return NextResponse.json({
      request: request[0],
    });
  } catch (error) {
    console.error('[PUT /api/admin/maintenance/[id]]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
