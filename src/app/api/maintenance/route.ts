import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { maintenanceRequests, sites } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { adminApi } from '@/lib/admin-api';

/**
 * POST /api/maintenance — 유지보수 요청 접수
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { site_slug, title, description, category, priority, requested_by } = body;

    // 필수값 검증
    if (!site_slug || !title || !description || !requested_by?.name || !requested_by?.phone) {
      return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 });
    }

    // 사이트 확인
    const site = await db.select().from(sites).where(eq(sites.slug, site_slug)).limit(1);
    if (!site[0]) {
      return NextResponse.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 유지보수 요청 저장
    const result = await db.insert(maintenanceRequests).values({
      siteId: site[0].id,
      title,
      description,
      category: category || 'other',
      priority: priority || 'normal',
      requestedBy: requested_by,
      attachments: [],
      syncStatus: 'pending',
      syncAttempts: 0,
    }).returning({ id: maintenanceRequests.id });

    const requestId = result[0].id;

    // 어드민 동기화 시도 (논블로킹 — 실패해도 요청은 이미 저장됨)
    syncToAdmin(site[0].id, requestId, body).catch((err) => {
      console.error(`[maintenance] Background sync for #${requestId} failed:`, err);
    });

    return NextResponse.json({
      ok: true,
      message: '유지보수 요청이 접수되었습니다.',
      request_id: requestId,
    });
  } catch (error) {
    console.error('Maintenance request error:', error);
    return NextResponse.json({ error: '요청 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * 어드민 동기화 (실패해도 요청은 유지)
 */
async function syncToAdmin(siteId: string, requestId: number, data: Record<string, unknown>) {
  try {
    const result = await adminApi('POST', '/api/maintenance/sync', {
      site_id: siteId,
      external_id: requestId,
      title: data.title,
      description: data.description,
      category: data.category || 'other',
      priority: data.priority || 'normal',
      requested_by: data.requested_by,
    });

    if (result.ok) {
      await db.update(maintenanceRequests)
        .set({
          syncStatus: 'synced',
          syncedAt: new Date(),
          externalAdminId: (result.data as { admin_id?: number })?.admin_id ?? null,
        })
        .where(eq(maintenanceRequests.id, requestId));
      console.log(`[maintenance] #${requestId} synced to admin immediately`);
    } else {
      await db.update(maintenanceRequests)
        .set({
          syncAttempts: 1,
          lastSyncError: result.error || 'Unknown error',
          nextRetryAt: new Date(Date.now() + 60_000),
        })
        .where(eq(maintenanceRequests.id, requestId));
      console.warn(`[maintenance] #${requestId} immediate sync failed: ${result.error} — will retry via cron`);
    }
  } catch (error) {
    await db.update(maintenanceRequests)
      .set({
        syncAttempts: 1,
        lastSyncError: String(error),
        nextRetryAt: new Date(Date.now() + 60_000),
      })
      .where(eq(maintenanceRequests.id, requestId));
    console.error(`[maintenance] #${requestId} immediate sync exception — will retry via cron:`, error);
  }
}
