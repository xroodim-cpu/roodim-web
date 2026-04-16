/**
 * 루딤웹 → 루딤링크 (Laravel/MySQL) 아웃바운드 동기화
 *
 * 사용자가 루딤웹 어드민에서 유지보수 상태/메시지를 변경하면,
 * 루딤링크 MySQL DB 에도 동일한 상태를 반영해야 한다.
 *
 * 구현 방식:
 * - Fire-and-forget (응답 속도 유지) — 실패하면 sync_status='failed' 표시 + 재시도 큐로 대체 가능
 * - HMAC 서명된 어드민 API 호출 (`adminApi` 사용)
 * - externalAdminId 가 없으면 동기화 생략 (루딤웹에서 생성된 신규 요청은 아직 MySQL 에 없음)
 */

import { adminApi } from '@/lib/admin-api';
import { db } from '@/lib/db';
import { maintenanceRequests } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

interface SyncStatusArgs {
  requestId: number;
  externalAdminId: number | null;
  status: string;
  updatedBy?: string;
}

interface SyncMessageArgs {
  siteId: string;
  externalAdminId: number | null;
  message: {
    id: number;
    body: string;
    senderType: string;
    senderName: string;
    createdAt: Date | string;
  };
}

async function markSynced(requestId: number) {
  try {
    await db
      .update(maintenanceRequests)
      .set({
        syncStatus: 'synced',
        syncedAt: new Date(),
        lastSyncError: null,
      })
      .where(eq(maintenanceRequests.id, requestId));
  } catch (e) {
    console.error('[maintenance-sync:markSynced]', e);
  }
}

async function markFailed(requestId: number, error: string) {
  try {
    await db
      .update(maintenanceRequests)
      .set({
        syncStatus: 'failed',
        lastSyncError: error.slice(0, 500),
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000),
      })
      .where(eq(maintenanceRequests.id, requestId));
  } catch (e) {
    console.error('[maintenance-sync:markFailed]', e);
  }
}

/**
 * 상태 변경을 루딤링크 로 전송
 */
export async function syncStatusToLink(args: SyncStatusArgs): Promise<void> {
  if (!args.externalAdminId) {
    // 루딤웹에서만 존재하는 요청 — 아직 MySQL 에 없음
    return;
  }

  try {
    const res = await adminApi('POST', '/api/roodim-web/maintenance/status', {
      external_admin_id: args.externalAdminId,
      status: args.status,
      updated_by: args.updatedBy || 'roodim-web',
    });

    if (res.ok) {
      await markSynced(args.requestId);
    } else {
      console.warn('[maintenance-sync:status] failed', res.error);
      await markFailed(args.requestId, res.error || 'sync failed');
    }
  } catch (e) {
    console.error('[maintenance-sync:status] exception', e);
    await markFailed(args.requestId, String(e));
  }
}

/**
 * 새 메시지를 루딤링크 로 전송
 */
export async function syncMessageToLink(args: SyncMessageArgs): Promise<void> {
  if (!args.externalAdminId) {
    return;
  }

  try {
    const res = await adminApi('POST', '/api/roodim-web/maintenance/message', {
      external_admin_id: args.externalAdminId,
      message: {
        id: args.message.id,
        body: args.message.body,
        sender_type: args.message.senderType,
        sender_name: args.message.senderName,
        created_at:
          typeof args.message.createdAt === 'string'
            ? args.message.createdAt
            : args.message.createdAt.toISOString(),
      },
    });

    if (!res.ok) {
      console.warn('[maintenance-sync:message] failed', res.error);
    }
  } catch (e) {
    console.error('[maintenance-sync:message] exception', e);
  }
}
