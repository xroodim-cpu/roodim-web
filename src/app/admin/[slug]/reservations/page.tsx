import { db } from '@/lib/db';
import { sites, reservations as reservationsTable } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

interface ReservationsPageProps {
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

export default async function ReservationsPage({ params }: ReservationsPageProps) {
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

  const reservations = await db
    .select()
    .from(reservationsTable)
    .where(eq(reservationsTable.siteId, site.id))
    .orderBy((t) => t.createdAt);

  return (
    <>
      <div className="c-page-header">
        <div>
          <h1 className="c-page-title">예약 관리</h1>
          <p className="c-page-subtitle">고객 예약을 확인하고 관리하세요.</p>
        </div>
      </div>

      <div className="admin-card">
        {reservations.length === 0 ? (
          <div className="c-empty">
            <div className="c-empty-icon">📅</div>
            <div className="c-empty-text">예약이 없습니다.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="c-table">
              <thead>
                <tr>
                  <th>고객명</th>
                  <th>전화</th>
                  <th>시술명</th>
                  <th>예약일</th>
                  <th>상태</th>
                  <th className="cell-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((res) => (
                  <tr key={res.id}>
                    <td className="cell-strong">{res.customerName}</td>
                    <td className="cell-sub">{res.customerPhone}</td>
                    <td>{res.treatmentName || '—'}</td>
                    <td className="cell-sub">
                      {new Date(res.reservedDate).toLocaleDateString('ko-KR')}
                    </td>
                    <td>
                      <span
                        className={`c-badge ${STATUS_BADGE[res.status] || 'c-badge-gray'}`}
                      >
                        {STATUS_LABEL[res.status] || res.status}
                      </span>
                    </td>
                    <td className="cell-right">
                      <button type="button" className="btn btn-secondary btn-sm">
                        수정
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
