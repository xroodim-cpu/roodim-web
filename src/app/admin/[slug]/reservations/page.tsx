import { db } from '@/lib/db';
import { sites, reservations as reservationsTable } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import styles from './Reservations.module.css';

interface ReservationsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ReservationsPage({ params }: ReservationsPageProps) {
  const { slug } = await params;

  const site = await db.query.sites.findFirst({
    where: eq(sites.slug, slug),
  });

  if (!site) {
    return <div>사이트를 찾을 수 없습니다.</div>;
  }

  const reservations = await db
    .select()
    .from(reservationsTable)
    .where(eq(reservationsTable.siteId, site.id))
    .orderBy((t) => t.createdAt);

  return (
    <div className={styles.reservations}>
      <div className={styles.header}>
        <h1>예약 관리</h1>
        <p className={styles.subtitle}>고객 예약을 확인하고 관리하세요.</p>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>고객명</th>
              <th>전화</th>
              <th>시술명</th>
              <th>예약일</th>
              <th>상태</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {reservations.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  예약이 없습니다.
                </td>
              </tr>
            ) : (
              reservations.map((res) => (
                <tr key={res.id}>
                  <td>{res.customerName}</td>
                  <td>{res.customerPhone}</td>
                  <td>{res.treatmentName || '—'}</td>
                  <td>{new Date(res.reservedDate).toLocaleDateString('ko-KR')}</td>
                  <td>
                    <span className={`${styles.badge} ${styles[res.status]}`}>
                      {res.status === 'pending' && '대기'}
                      {res.status === 'confirmed' && '확정'}
                      {res.status === 'cancelled' && '취소'}
                      {res.status === 'completed' && '완료'}
                    </span>
                  </td>
                  <td>
                    <button className={styles.actionBtn}>수정</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
