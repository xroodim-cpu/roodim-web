import { db } from '@/lib/db';
import { sites, reservations, maintenanceRequests } from '@/drizzle/schema';
import { eq, and, gte } from 'drizzle-orm';
import styles from './Dashboard.module.css';

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

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { slug } = await params;

  // 사이트 조회
  const site = await db.query.sites.findFirst({
    where: eq(sites.slug, slug),
  });

  if (!site) {
    return <div>사이트를 찾을 수 없습니다.</div>;
  }

  const stats = await getDashboardStats(site.id);

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h1>대시보드</h1>
        <p className={styles.subtitle}>사이트 운영 현황을 한눈에 확인하세요.</p>
      </div>

      {/* 통계 카드 */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📅</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{stats.totalReservations}</div>
            <div className={styles.statLabel}>오늘의 예약</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>🔧</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{stats.pendingWork}</div>
            <div className={styles.statLabel}>미처리 작업</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>👥</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>126</div>
            <div className={styles.statLabel}>이번 달 방문자</div>
          </div>
        </div>
      </div>

      {/* 최근 활동 */}
      <div className={styles.recentActivitySection}>
        <h2>최근 활동</h2>
        <div className={styles.activityList}>
          {stats.recentActivities.length === 0 ? (
            <div className={styles.emptyState}>
              <p>최근 활동이 없습니다.</p>
            </div>
          ) : (
            stats.recentActivities.map((activity) => (
              <div key={activity.id} className={styles.activityItem}>
                <div className={styles.activityIcon}>📌</div>
                <div className={styles.activityContent}>
                  <div className={styles.activityTitle}>{activity.title}</div>
                  <div className={styles.activityDate}>
                    {new Date(activity.date).toLocaleDateString('ko-KR')}
                  </div>
                </div>
                <div className={styles.activityStatus}>{activity.status}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
