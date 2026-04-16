import { db } from '@/lib/db';
import { sites, reservations, maintenanceRequests } from '@/drizzle/schema';
import { eq, and, gte } from 'drizzle-orm';

interface DashboardPageProps {
  params: Promise<{ slug: string }>;
}

async function getDashboardStats(siteId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 오늘 예약 수
  const todayReservations = await db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.siteId, siteId),
        gte(reservations.reservedDate, today.toISOString().split('T')[0])
      )
    );

  // 미처리 작업 수
  const pendingWork = await db
    .select()
    .from(maintenanceRequests)
    .where(
      and(
        eq(maintenanceRequests.siteId, siteId),
        eq(maintenanceRequests.status, 'pending')
      )
    );

  // 최근 활동
  const recentReservations = await db
    .select()
    .from(reservations)
    .where(eq(reservations.siteId, siteId))
    .orderBy((t) => t.createdAt)
    .limit(5);

  return {
    totalReservations: todayReservations.length,
    pendingWork: pendingWork.length,
    recentActivities: recentReservations.map((r) => ({
      id: r.id,
      type: 'reservation',
      title: `${r.customerName} 님 예약`,
      date: r.reservedDate,
      status: r.status,
    })),
  };
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

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { slug } = await params;

  // 사이트 조회
  const site = await db.query.sites.findFirst({
    where: eq(sites.slug, slug),
  });

  if (!site) {
    return (
      <div className="c-alert c-alert-error">사이트를 찾을 수 없습니다.</div>
    );
  }

  const stats = await getDashboardStats(site.id);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="c-page-title">대시보드</h1>
        <p className="c-page-subtitle">
          사이트 운영 현황을 한눈에 확인하세요.
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon red">
            <span style={{ fontSize: 22 }}>📅</span>
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalReservations}</div>
            <div className="stat-label">오늘의 예약</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon yellow">
            <span style={{ fontSize: 22 }}>🔧</span>
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.pendingWork}</div>
            <div className="stat-label">미처리 작업</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <span style={{ fontSize: 22 }}>👥</span>
          </div>
          <div className="stat-info">
            <div className="stat-value">126</div>
            <div className="stat-label">이번 달 방문자</div>
          </div>
        </div>
      </div>

      {/* 최근 활동 */}
      <div
        className="card"
        style={{
          border: '1px solid var(--border)',
          padding: 20,
        }}
      >
        <div className="card-header">
          <div>
            <div className="card-title">최근 활동</div>
            <div className="card-subtitle">최근 5건의 예약</div>
          </div>
        </div>
        {stats.recentActivities.length === 0 ? (
          <div className="c-empty">
            <div className="c-empty-icon">📭</div>
            <div className="c-empty-text">최근 활동이 없습니다.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="c-table">
              <thead>
                <tr>
                  <th>내용</th>
                  <th>날짜</th>
                  <th style={{ textAlign: 'right' }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentActivities.map((activity) => (
                  <tr key={activity.id}>
                    <td style={{ fontWeight: 'var(--fw-semi)' }}>
                      {activity.title}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {new Date(activity.date).toLocaleDateString('ko-KR')}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span
                        className={`c-badge ${
                          STATUS_BADGE[activity.status] || 'c-badge-gray'
                        }`}
                      >
                        {STATUS_LABEL[activity.status] || activity.status}
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
  );
}
