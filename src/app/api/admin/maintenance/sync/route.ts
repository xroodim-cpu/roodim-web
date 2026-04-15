import { db } from '@/lib/db';
import { sites, roodimSyncLogs } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const force = searchParams.get('force') === 'true';

    if (!slug) {
      return NextResponse.json(
        { error: 'slug parameter is required' },
        { status: 400 }
      );
    }

    const site = await db.query.sites.findFirst({
      where: eq(sites.slug, slug),
    });

    if (!site) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      );
    }

    const lastSyncLog = await db.query.roodimSyncLogs.findFirst({
      where: eq(roodimSyncLogs.siteId, site.id),
      orderBy: (logs) => logs.createdAt,
    });

    const lastSyncTime = lastSyncLog?.syncedAt || new Date(0);
    const syncStartTime = new Date();

    const syncResults = {
      requestsSynced: 0,
      messagesSynced: 0,
      errors: [] as string[],
    };

    await db.insert(roodimSyncLogs).values({
      siteId: site.id,
      entityType: 'maintenance_sync',
      action: 'sync',
      status: 'synced',
      syncedAt: syncStartTime,
    });

    return NextResponse.json({
      success: true,
      siteId: site.id,
      lastSyncTime,
      ...syncResults,
      message: 'Sync initialized. Full implementation requires roodim-link API.',
    });
  } catch (error) {
    console.error('[GET /api/admin/maintenance/sync]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
