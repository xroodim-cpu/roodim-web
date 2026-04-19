import { db } from '@/lib/db';
import {
  sites,
  reservations,
  maintenanceRequests,
  workboardMembers,
  workboards,
  boardPosts,
  boards,
} from '@/drizzle/schema';
import { eq, and, gte, lt, desc, inArray } from 'drizzle-orm';
import Link from 'next/link';

interface DashboardPageProps {
  params: Promise<{ slug: string }>;
}

const STATUS_LABEL: Record<string, string> = {
  pending: '대기',
  confirmed: '확정',
  cancelled: '취소',
  completed: '완료',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'c-badge-warning',
  confirmed: 'c-badge-info',
  cancelled: 'c-badge-error',
  completed: 'c-badge-success',
};

const WORK_STATUS_LABEL: Record<string, string> = {
  pending: '대기',
  reviewing: '검토 중',
  working: '진행 중',
  done: '완료',
  cancelled: '취소',
};

const WORK_STATUS_BADGE: Record<string, string> = {
  pending: 'c-badge-warning',
  reviewing: 'c-badge-info',
  working: 'c-badge-info',
  done: 'c-badge-success',
  cancelled: 'c-badge-error',
};

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { slug } = await params;

  const site = await db.query.sites.findFirst({
    where: eq(sites.slug, slug),
  });
  if (!site) {
    return (
      <div className="c-empty">
        <div className="c-empty-icon">⚠️</div>
        <div className="c-empty-text">사이트를 찾을 수 없습니다.</div>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(today);

  const weekLater = new Date(today);
  weekLater.setDate(weekLater.getDate() + 7);
  const weekLaterStr = toDateStr(weekLater);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthStartStr = toDateStr(monthStart);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const monthEndStr = toDateStr(monthEnd);

  const todayReservations = await db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.siteId, site.id),
        gte(reservations.reservedDate, todayStr),
        lt(reservations.reservedDate, toDateStr(new Date(today.getTime() + 86400000))),
      ),
    )
    .orderBy(reservations.reservedTime);

  const upcomingReservations = await db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.siteId, site.id),
        gte(reservations.reservedDate, todayStr),
        lt(reservations.reservedDate, weekLaterStr),
      ),
    )
    .orderBy(reservations.reservedDate, reservations.reservedTime);

  const monthReservations = await db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.siteId, site.id),
        gte(reservations.reservedDate, monthStartStr),
        lt(reservations.reservedDate, monthEndStr),
      ),
    );

  const pendingWork = await db
    .select()
    .from(maintenanceRequests)
    .where(
      and(
        eq(maintenanceRequests.siteId, site.id),
        inArray(maintenanceRequests.status, ['pending', 'reviewing', 'working']),
      ),
    )
    .orderBy(desc(maintenanceRequests.createdAt))
    .limit(5);

  const myWb = await db
    .select({ wbId: workboardMembers.workboardId, wbName: workboards.name })
    .from(workboardMembers)
    .innerJoin(workboards, eq(workboards.id, workboardMembers.workboardId))
    .where(eq(workboardMembers.siteId, site.id))
    .limit(3);

  let recentPosts: Array<{
    id: number;
    title: string;
    authorName: string | null;
    createdAt: Date;
    boardName: string;
  }> = [];
  if (myWb.length > 0) {
    const boardRows = await db
      .select()
      .from(boards)
      .where(eq(boards.siteId, site.id));
    const boardIds = boardRows.map((b) => b.id);
    if (boardIds.length > 0) {
      const posts = await db
        .select()
        .from(boardPosts)
        .where(inArray(boardPosts.boardId, boardIds))
        .orderBy(desc(boardPosts.createdAt))
        .limit(5);
      recentPosts = posts.map((p) => ({
        id: p.id,
        title: p.title,
        authorName: p.authorName,
        createdAt: p.createdAt,
        boardName: boardRows.find((b) => b.id === p.boardId)?.name ?? '',
      }));
    }
  }

  const pendingCount = upcomingReservations.filter((r) => r.status === 'pending').length;
  const confirmedCount = upcomingReservations.filter((r) => r.status === 'confirmed').length;

  return (
    <>
      <div className="c-page-header">
        <div>
          <h1 className="c-page-title">대시보드</h1>
          <p className="c-page-subtitle">예약과 작업을 한눈에 확인하세요.</p>
        </div>
      </div>

      {/* 상단 통계 카드 4개 — 루딤링크 .stats-grid / .stat-card 구조 */}
      <div className="stats-grid">
        <Link href={`/admin/${site.slug}/reservations`} className="stat-card">
          <div className="stat-icon red">
            <span className="material-symbols-rounded">event</span>
          </div>
          <div className="stat-info">
            <div className="stat-value">{todayReservations.length}</div>
            <div className="stat-label">오늘 예약</div>
          </div>
        </Link>

        <Link href={`/admin/${site.slug}/reservations`} className="stat-card">
          <div className="stat-icon blue">
            <span className="material-symbols-rounded">calendar_month</span>
          </div>
          <div className="stat-info">
            <div className="stat-value">{upcomingReservations.length}</div>
            <div className="stat-label">이번 주 예약</div>
          </div>
        </Link>

        <Link href={`/admin/${site.slug}/reservations`} className="stat-card">
          <div className="stat-icon green">
            <span className="material-symbols-rounded">bar_chart</span>
          </div>
          <div className="stat-info">
            <div className="stat-value">{monthReservations.length}</div>
            <div className="stat-label">이번 달 예약</div>
          </div>
        </Link>

        <Link href={`/admin/${site.slug}/work`} className="stat-card">
          <div className="stat-icon yellow">
            <span className="material-symbols-rounded">build</span>
          </div>
          <div className="stat-info">
            <div className="stat-value">{pendingWork.length}</div>
            <div className="stat-label">진행 중 작업</div>
          </div>
        </Link>
      </div>

      {/* 메인 그리드: 좌(예약 큰 카드) + 우(작업·워크보드) */}
      <div
        className="c-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)',
          gap: 'var(--sp-lg)',
          alignItems: 'start',
          marginTop: 'var(--sp-xl)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
          {/* 오늘의 예약 */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">
                  <span className="material-symbols-rounded" style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--accent)' }}>event</span>
                  오늘의 예약
                </div>
                <div className="card-subtitle">
                  {today.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
                </div>
              </div>
              <Link href={`/admin/${site.slug}/reservations`} className="btn btn-ghost btn-sm">
                전체보기
              </Link>
            </div>
            {todayReservations.length === 0 ? (
              <div className="c-empty">
                <div className="c-empty-icon">📭</div>
                <div className="c-empty-text">오늘 예약이 없습니다.</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="c-table">
                  <thead>
                    <tr>
                      <th style={{ width: 90 }}>시간</th>
                      <th>고객명</th>
                      <th>시술</th>
                      <th style={{ textAlign: 'right' }}>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayReservations.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 700, color: 'var(--accent)' }}>
                          {(r.reservedTime as unknown as string)?.slice(0, 5) || '—'}
                        </td>
                        <td>
                          <div style={{ fontWeight: 'var(--fw-semi)' }}>{r.customerName}</div>
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                            {r.customerPhone}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {r.treatmentName || '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`c-badge ${STATUS_BADGE[r.status] || 'c-badge-gray'}`}>
                            {STATUS_LABEL[r.status] || r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 다가오는 예약 */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">
                  <span className="material-symbols-rounded" style={{ verticalAlign: 'middle', marginRight: 6 }}>calendar_month</span>
                  다가오는 예약 (7일)
                </div>
                <div className="card-subtitle">
                  대기 {pendingCount}건 · 확정 {confirmedCount}건
                </div>
              </div>
            </div>
            {upcomingReservations.length === 0 ? (
              <div className="c-empty">
                <div className="c-empty-icon">🗓</div>
                <div className="c-empty-text">다가오는 예약이 없습니다.</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="c-table">
                  <thead>
                    <tr>
                      <th style={{ width: 120 }}>날짜</th>
                      <th style={{ width: 80 }}>시간</th>
                      <th>고객명</th>
                      <th>시술</th>
                      <th style={{ textAlign: 'right' }}>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingReservations.slice(0, 10).map((r) => (
                      <tr key={r.id}>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {new Date((r.reservedDate as unknown as string) + 'T00:00:00').toLocaleDateString(
                            'ko-KR',
                            { month: 'numeric', day: 'numeric', weekday: 'short' },
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {(r.reservedTime as unknown as string)?.slice(0, 5) || '—'}
                        </td>
                        <td style={{ fontWeight: 'var(--fw-semi)' }}>{r.customerName}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {r.treatmentName || '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`c-badge ${STATUS_BADGE[r.status] || 'c-badge-gray'}`}>
                            {STATUS_LABEL[r.status] || r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* 우측 영역 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
          {/* 진행 중 작업 */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">
                  <span className="material-symbols-rounded" style={{ verticalAlign: 'middle', marginRight: 6 }}>build</span>
                  진행 중 작업
                </div>
                <div className="card-subtitle">최근 5건</div>
              </div>
              <Link href={`/admin/${site.slug}/work`} className="btn btn-ghost btn-sm">
                전체보기
              </Link>
            </div>
            {pendingWork.length === 0 ? (
              <div className="c-empty">
                <div className="c-empty-text">진행 중인 작업이 없습니다.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingWork.map((w) => (
                  <div
                    key={w.id}
                    style={{
                      padding: 'var(--sp-md)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <div
                        style={{
                          fontSize: 'var(--fs-sm)',
                          fontWeight: 'var(--fw-semi)',
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {w.title}
                      </div>
                      <span className={`c-badge ${WORK_STATUS_BADGE[w.status] || 'c-badge-gray'}`}>
                        {WORK_STATUS_LABEL[w.status] || w.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                      {new Date(w.createdAt).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 워크보드 소식 */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">
                  <span className="material-symbols-rounded" style={{ verticalAlign: 'middle', marginRight: 6 }}>forum</span>
                  워크보드 소식
                </div>
                <div className="card-subtitle">{myWb[0]?.wbName ?? '파트너 공유 보드'}</div>
              </div>
              {myWb.length > 0 && (
                <Link href={`/admin/${site.slug}/workboard`} className="btn btn-ghost btn-sm">
                  전체보기
                </Link>
              )}
            </div>
            {recentPosts.length === 0 ? (
              <div className="c-empty">
                <div className="c-empty-text">최근 게시물이 없습니다.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentPosts.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: 'var(--sp-md)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 'var(--fw-semi)',
                        marginBottom: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.title}
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                      {p.boardName} · {p.authorName ?? '파트너'} ·{' '}
                      {new Date(p.createdAt).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
