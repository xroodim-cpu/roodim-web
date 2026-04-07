import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reservations, maintenanceRequests } from '@/drizzle/schema';
import { eq, and, lte, sql } from 'drizzle-orm';
import { adminApi } from '@/lib/admin-api';

/**
 * GET /api/sync — Vercel Cron: 실패한 동기화 재시도
 * vercel.json에서 1분 간격으로 호출
 */
export async function GET(req: Request) {
  // Vercel Cron 인증 (선택)
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  let syncedReservations = 0;
  let syncedMaintenance = 0;

  // === 예약 동기화 재시도 ===
  const pendingReservations = await db.select()
    .from(reservations)
    .where(and(
      eq(reservations.syncStatus, 'pending'),
      lte(reservations.nextRetryAt, now)
    ))
    .limit(20);

  for (const r of pendingReservations) {
    try {
      const result = await adminApi('POST', '/api/reservation/notify', {
        site_id: r.siteId,
        external_id: r.id,
        customer_name: r.customerName,
        customer_phone: r.customerPhone,
        treatment_name: r.treatmentName || '',
        reserved_date: r.reservedDate,
        reserved_time: r.reservedTime || '',
        memo: r.memo || '',
      });

      if (result.ok) {
        await db.update(reservations)
          .set({
            syncStatus: 'synced',
            syncedAt: new Date(),
            externalAdminId: (result.data as { admin_id?: number })?.admin_id ?? null,
          })
          .where(eq(reservations.id, r.id));
        syncedReservations++;
      } else {
        const attempts = r.syncAttempts + 1;
        await db.update(reservations)
          .set({
            syncAttempts: attempts,
            lastSyncError: result.error || 'Unknown',
            syncStatus: attempts >= 5 ? 'failed' : 'pending',
            nextRetryAt: getNextRetry(attempts),
          })
          .where(eq(reservations.id, r.id));
      }
    } catch (error) {
      const attempts = r.syncAttempts + 1;
      await db.update(reservations)
        .set({
          syncAttempts: attempts,
          lastSyncError: String(error),
          syncStatus: attempts >= 5 ? 'failed' : 'pending',
          nextRetryAt: getNextRetry(attempts),
        })
        .where(eq(reservations.id, r.id));
    }
  }

  // === 유지보수 동기화 재시도 ===
  const pendingMaintenance = await db.select()
    .from(maintenanceRequests)
    .where(and(
      eq(maintenanceRequests.syncStatus, 'pending'),
      lte(maintenanceRequests.nextRetryAt, now)
    ))
    .limit(20);

  for (const m of pendingMaintenance) {
    try {
      const result = await adminApi('POST', '/api/maintenance/sync', {
        site_id: m.siteId,
        external_id: m.id,
        title: m.title,
        description: m.description,
        category: m.category,
        priority: m.priority,
        requested_by: m.requestedBy,
      });

      if (result.ok) {
        await db.update(maintenanceRequests)
          .set({
            syncStatus: 'synced',
            syncedAt: new Date(),
            externalAdminId: (result.data as { admin_id?: number })?.admin_id ?? null,
          })
          .where(eq(maintenanceRequests.id, m.id));
        syncedMaintenance++;
      } else {
        const attempts = m.syncAttempts + 1;
        await db.update(maintenanceRequests)
          .set({
            syncAttempts: attempts,
            lastSyncError: result.error || 'Unknown',
            syncStatus: attempts >= 5 ? 'failed' : 'pending',
            nextRetryAt: getNextRetry(attempts),
          })
          .where(eq(maintenanceRequests.id, m.id));
      }
    } catch (error) {
      const attempts = m.syncAttempts + 1;
      await db.update(maintenanceRequests)
        .set({
          syncAttempts: attempts,
          lastSyncError: String(error),
          syncStatus: attempts >= 5 ? 'failed' : 'pending',
          nextRetryAt: getNextRetry(attempts),
        })
        .where(eq(maintenanceRequests.id, m.id));
    }
  }

  return NextResponse.json({
    ok: true,
    synced: { reservations: syncedReservations, maintenance: syncedMaintenance },
    pending: { reservations: pendingReservations.length, maintenance: pendingMaintenance.length },
  });
}

/**
 * 지수 백오프 재시도 간격
 * 1차: 1분, 2차: 5분, 3차: 30분, 4차: 2시간, 5차: 12시간
 */
function getNextRetry(attempts: number): Date {
  const delays = [60, 300, 1800, 7200, 43200]; // 초
  const delay = delays[Math.min(attempts - 1, delays.length - 1)] * 1000;
  return new Date(Date.now() + delay);
}
