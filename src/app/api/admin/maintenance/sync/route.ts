/**
 * POST/GET /api/admin/maintenance/sync?slug=xxx
 *
 * 루딤링크 (Laravel/MySQL) → 루딤웹 (Postgres) 인바운드 동기화
 *
 * 동작:
 * 1. slug → sites.admin_organization_id 조회
 * 2. roodim_sync_logs 에서 마지막 sync 시간 조회
 * 3. 루딤링크 API 호출 (`GET /api/roodim-web/maintenance/list?org=X&since=<ISO>`)
 *    - HMAC 서명된 `adminApi` 사용
 * 4. 돌려받은 maintenance_requests 를 Postgres 에 upsert (external_admin_id 매핑)
 * 5. 각 요청의 메시지도 upsert
 * 6. 새 sync log 저장
 *
 * 루딤링크 API 미구현 또는 장애 시:
 * - 예외를 삼키지 말고 syncStatus='failed' 로 기록
 * - 클라이언트는 폴링/수동 재시도로 회복
 */
import { db } from '@/lib/db';
import {
  sites,
  maintenanceRequests,
  maintenanceMessages,
  roodimSyncLogs,
} from '@/drizzle/schema';
import { and, desc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/admin-session';
import { adminApi } from '@/lib/admin-api';

interface RemoteRequest {
  id: number; // roodim-link 의 maintenance_requests.id
  title: string;
  description?: string | null;
  category?: string | null;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  status?: 'pending' | 'reviewing' | 'working' | 'done' | 'cancelled';
  created_at?: string;
  updated_at?: string;
  resolved_at?: string | null;
  messages?: Array<{
    id: number;
    sender_type: 'customer' | 'staff';
    sender_name: string;
    body: string;
    created_at: string;
  }>;
}

interface RemoteListResponse {
  ok?: boolean;
  requests?: RemoteRequest[];
  error?: string;
}

async function runSync(slug: string) {
  const site = await db.query.sites.findFirst({
    where: eq(sites.slug, slug),
  });

  if (!site) {
    return { status: 404, body: { error: 'Site not found' } };
  }

  if (!site.adminOrganizationId) {
    return {
      status: 200,
      body: {
        ok: true,
        skipped: true,
        reason: 'site has no admin_organization_id — 루딤링크 연동 대상이 아님',
      },
    };
  }

  // 마지막 sync 시간
  const lastLog = await db
    .select()
    .from(roodimSyncLogs)
    .where(
      and(
        eq(roodimSyncLogs.siteId, site.id),
        eq(roodimSyncLogs.entityType, 'maintenance_sync'),
        eq(roodimSyncLogs.status, 'synced')
      )
    )
    .orderBy(desc(roodimSyncLogs.syncedAt))
    .limit(1);

  const since = lastLog[0]?.syncedAt || new Date(0);
  const syncStartTime = new Date();

  const result = {
    requestsSynced: 0,
    messagesSynced: 0,
    errors: [] as string[],
  };

  // 루딤링크 호출 — 변경 데이터 pull
  let remote: RemoteListResponse = {};
  try {
    const res = await adminApi<RemoteListResponse>(
      'GET',
      `/api/roodim-web/maintenance/list?org=${site.adminOrganizationId}&since=${encodeURIComponent(
        since.toISOString()
      )}`
    );
    if (!res.ok) {
      result.errors.push(`로딩 실패: ${res.error || 'unknown'}`);
      await db.insert(roodimSyncLogs).values({
        siteId: site.id,
        entityType: 'maintenance_sync',
        action: 'pull',
        status: 'failed',
        errorMessage: res.error || 'unknown',
        syncedAt: syncStartTime,
      });
      return {
        status: 200,
        body: {
          ok: false,
          ...result,
          lastSyncTime: since,
          message: '루딤링크 API 응답 실패. sync_status=failed 로 기록됨.',
        },
      };
    }
    remote = res.data || {};
  } catch (e) {
    const err = String(e);
    result.errors.push(err);
    await db.insert(roodimSyncLogs).values({
      siteId: site.id,
      entityType: 'maintenance_sync',
      action: 'pull',
      status: 'failed',
      errorMessage: err.slice(0, 500),
      syncedAt: syncStartTime,
    });
    return {
      status: 200,
      body: {
        ok: false,
        ...result,
        lastSyncTime: since,
        message: '루딤링크 호출 예외. sync_status=failed 로 기록됨.',
      },
    };
  }

  const remoteRequests = remote.requests || [];

  for (const r of remoteRequests) {
    try {
      const existing = await db.query.maintenanceRequests.findFirst({
        where: and(
          eq(maintenanceRequests.siteId, site.id),
          eq(maintenanceRequests.externalAdminId, r.id)
        ),
      });

      let localRequestId: number;

      if (existing) {
        // 업데이트
        const [updated] = await db
          .update(maintenanceRequests)
          .set({
            title: r.title,
            description: r.description || '',
            category: r.category || 'other',
            priority: r.priority || 'normal',
            status: r.status || 'pending',
            resolvedAt: r.resolved_at ? new Date(r.resolved_at) : null,
            syncStatus: 'synced',
            syncedAt: syncStartTime,
            updatedAt: r.updated_at ? new Date(r.updated_at) : new Date(),
          })
          .where(eq(maintenanceRequests.id, existing.id))
          .returning();
        localRequestId = updated.id;
      } else {
        // 신규 insert
        const [created] = await db
          .insert(maintenanceRequests)
          .values({
            siteId: site.id,
            title: r.title,
            description: r.description || '',
            category: r.category || 'other',
            priority: r.priority || 'normal',
            status: r.status || 'pending',
            requestedBy: {},
            attachments: [],
            externalAdminId: r.id,
            syncStatus: 'synced',
            syncedAt: syncStartTime,
            resolvedAt: r.resolved_at ? new Date(r.resolved_at) : null,
            createdAt: r.created_at ? new Date(r.created_at) : undefined,
            updatedAt: r.updated_at ? new Date(r.updated_at) : undefined,
          })
          .returning();
        localRequestId = created.id;
      }

      result.requestsSynced += 1;

      // 메시지 upsert (external id 기반)
      if (r.messages && r.messages.length > 0) {
        for (const m of r.messages) {
          try {
            // 중복 방지: 같은 (request_id, created_at, body) 조합이 이미 있으면 skip
            const existingMsgs = await db
              .select()
              .from(maintenanceMessages)
              .where(eq(maintenanceMessages.maintenanceRequestId, localRequestId));
            const dup = existingMsgs.some(
              (em) =>
                em.body === m.body &&
                em.senderName === m.sender_name &&
                Math.abs(
                  new Date(em.createdAt).getTime() -
                    new Date(m.created_at).getTime()
                ) < 1000
            );
            if (dup) continue;

            await db.insert(maintenanceMessages).values({
              maintenanceRequestId: localRequestId,
              senderType: m.sender_type,
              senderName: m.sender_name,
              body: m.body,
              attachments: [],
              createdAt: new Date(m.created_at),
            });
            result.messagesSynced += 1;
          } catch (e) {
            result.errors.push(`message ${m.id}: ${String(e)}`);
          }
        }
      }
    } catch (e) {
      result.errors.push(`request ${r.id}: ${String(e)}`);
    }
  }

  // 성공 로그 기록
  await db.insert(roodimSyncLogs).values({
    siteId: site.id,
    entityType: 'maintenance_sync',
    action: 'pull',
    status: 'synced',
    errorMessage: result.errors.length > 0 ? result.errors.join('; ').slice(0, 500) : null,
    syncedAt: syncStartTime,
  });

  return {
    status: 200,
    body: {
      ok: true,
      siteId: site.id,
      lastSyncTime: since,
      ...result,
    },
  };
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }

  const session = await verifyAdminAccess(slug);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { status, body } = await runSync(slug);
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error('[POST /api/admin/maintenance/sync]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET 도 동일 처리 (편의성)
export const GET = POST;
