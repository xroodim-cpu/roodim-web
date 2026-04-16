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

export default async function ReservationsPage({
  params,
}: ReservationsPageProps) {
  const { slug } = await params;

  const site = await db.query.sites.findFirst({
    where: eq(sites.slug, slug),
  });

  if (!site) {
    return (
      <div className="c-alert c-alert-error">사이트를 찾을 수 없습니다.</div>
    );
  }

  const reservations = await db
    .select()
    .from(reservationsTable)
    .where(eq(reservationsTable.siteId, site.id))
    .orderBy((t) => t.createdAt);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="c-page-title">예약 관리</h1>
        <p className="c-page-subtitle">고객 예약을 확인하고 관리하세요.</p>
      </div>

      <div
        className="card"
        style={{
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
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
                  <th style={{ textAlign: 'right', width: 100 }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((res) => (
                  <tr key={res.id}>
                    <td style={{ fontWeight: 'var(--fw-semi)' }}>
                      {res.customerName}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {res.customerPhone}
                    </td>
                    <td>{res.treatmentName || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {new Date(res.reservedDate).toLocaleDateString('ko-KR')}
                    </td>
                    <td>
                      <span
                        className={`c-badge ${
                          STATUS_BADGE[res.status] || 'c-badge-gray'
                        }`}
                      >
                        {STATUS_LABEL[res.status] || res.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                      >
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
    </div>
  );
}
