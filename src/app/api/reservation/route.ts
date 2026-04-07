import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reservations, sites } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { adminApi } from '@/lib/admin-api';

/**
 * POST /api/reservation — 예약 접수
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { site_slug, customer_name, customer_phone, customer_email, treatment_name, reserved_date, reserved_time, memo } = body;

    // 필수값 검증
    if (!site_slug || !customer_name || !customer_phone || !reserved_date) {
      return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 });
    }

    // 사이트 확인
    const site = await db.select().from(sites).where(eq(sites.slug, site_slug)).limit(1);
    if (!site[0]) {
      return NextResponse.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 예약 저장 (Neon DB에 즉시)
    const result = await db.insert(reservations).values({
      siteId: site[0].id,
      customerName: customer_name,
      customerPhone: customer_phone,
      customerEmail: customer_email || null,
      treatmentName: treatment_name || null,
      reservedDate: reserved_date,
      reservedTime: reserved_time || null,
      memo: memo || null,
      status: 'pending',
      syncStatus: 'pending',
      syncAttempts: 0,
    }).returning({ id: reservations.id });

    const reservationId = result[0].id;

    // 어드민 동기화 시도 (논블로킹 — 실패해도 예약은 이미 저장됨)
    syncToAdmin(site[0].id, reservationId, body).catch((err) => {
      console.error(`[reservation] Background sync for #${reservationId} failed:`, err);
    });

    return NextResponse.json({
      ok: true,
      message: '예약이 접수되었습니다. 확인 후 연락드리겠습니다.',
      reservation_id: reservationId,
    });
  } catch (error) {
    console.error('Reservation error:', error);
    return NextResponse.json({ error: '예약 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * 어드민 동기화 (실패해도 예약은 유지)
 */
async function syncToAdmin(siteId: string, reservationId: number, data: Record<string, unknown>) {
  try {
    const result = await adminApi('POST', '/api/reservation/notify', {
      site_id: siteId,
      external_id: reservationId,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      treatment_name: data.treatment_name || '',
      reserved_date: data.reserved_date,
      reserved_time: data.reserved_time || '',
      memo: data.memo || '',
    });

    if (result.ok) {
      await db.update(reservations)
        .set({
          syncStatus: 'synced',
          syncedAt: new Date(),
          externalAdminId: (result.data as { admin_id?: number })?.admin_id ?? null,
        })
        .where(eq(reservations.id, reservationId));
      console.log(`[reservation] #${reservationId} synced to admin immediately`);
    } else {
      // 실패 — 1분 후 cron에서 재시도
      await db.update(reservations)
        .set({
          syncAttempts: 1,
          lastSyncError: result.error || 'Unknown error',
          nextRetryAt: new Date(Date.now() + 60_000),
        })
        .where(eq(reservations.id, reservationId));
      console.warn(`[reservation] #${reservationId} immediate sync failed: ${result.error} — will retry via cron`);
    }
  } catch (error) {
    await db.update(reservations)
      .set({
        syncAttempts: 1,
        lastSyncError: String(error),
        nextRetryAt: new Date(Date.now() + 60_000),
      })
      .where(eq(reservations.id, reservationId));
    console.error(`[reservation] #${reservationId} immediate sync exception — will retry via cron:`, error);
  }
}
