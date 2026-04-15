import { db } from '@/lib/db';
import { maintenanceMessages } from '@/drizzle/schema';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { body, senderType, senderName } = await req.json();

    if (!body) {
      return NextResponse.json(
        { error: 'body is required' },
        { status: 400 }
      );
    }

    const message = await db
      .insert(maintenanceMessages)
      .values({
        maintenanceRequestId: parseInt(id),
        body,
        senderType: senderType || 'staff',
        senderName: senderName || 'Staff',
        attachments: [],
      })
      .returning();

    return NextResponse.json({
      message: message[0],
    });
  } catch (error) {
    console.error('[POST /api/admin/maintenance/[id]/messages]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
