'use client';

import { useMemo, useState } from 'react';

interface ChartReservation {
  id: number;
  date: string;
  time: string | null;
  treatment: string | null;
  status: string;
  memo: string | null;
  adminMemo: string | null;
}

interface ChartEntry {
  phone: string;
  name: string;
  email: string | null;
  visitCount: number;
  firstVisit: string;
  lastVisit: string;
  lastStatus: string;
  reservations: ChartReservation[];
}

interface Props {
  charts: ChartEntry[];
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

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatTime(t: string | null): string {
  if (!t) return '';
  return t.slice(0, 5);
}

export default function AddressBookClient({ charts }: Props) {
  const [query, setQuery] = useState('');
  const [selectedPhone, setSelectedPhone] = useState<string | null>(
    charts[0]?.phone ?? null,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return charts;
    return charts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false),
    );
  }, [charts, query]);

  const selected = useMemo(
    () => filtered.find((c) => c.phone === selectedPhone) ?? filtered[0] ?? null,
    [filtered, selectedPhone],
  );

  return (
    <>
      <div className="c-page-header">
        <div>
          <h1 className="c-page-title">주소록</h1>
          <p className="c-page-subtitle">
            예약 고객 차트 — 홈페이지에서 예약한 고객의 방문 이력·메모를 한눈에.
          </p>
        </div>
      </div>

      {charts.length === 0 ? (
        <div className="admin-card">
          <div className="c-empty">
            <div className="c-empty-icon">📇</div>
            <div className="c-empty-text">등록된 고객이 없습니다</div>
            <p className="c-page-subtitle">
              홈페이지 예약 기능을 통해 예약이 들어오면 자동으로 주소록에 등록됩니다.
            </p>
          </div>
        </div>
      ) : (
        <div className="admin-ab-grid">
          {/* 좌측: 고객 리스트 */}
          <aside className="admin-card ab-side">
            <div className="ab-search">
              <span className="material-symbols-rounded ab-search-icon">search</span>
              <input
                type="text"
                className="form-input"
                placeholder="이름·전화·이메일 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="card-subtitle ab-count">총 {filtered.length}명</div>

            <div className="ab-list">
              {filtered.map((c) => {
                const isActive = selected?.phone === c.phone;
                return (
                  <button
                    key={c.phone}
                    type="button"
                    onClick={() => setSelectedPhone(c.phone)}
                    className={`ab-row${isActive ? ' active' : ''}`}
                  >
                    <div className="ab-row-name">{c.name}</div>
                    <div className="ab-row-phone">{c.phone}</div>
                    <div className="ab-row-meta">
                      <span className="c-badge c-badge-gray">방문 {c.visitCount}회</span>
                      <span className="cell-sub">최근 {formatDate(c.lastVisit)}</span>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="c-empty">
                  <div className="c-empty-text">검색 결과가 없습니다.</div>
                </div>
              )}
            </div>
          </aside>

          {/* 우측: 선택 고객의 차트 */}
          {selected ? (
            <section className="admin-card">
              <div className="card-header ab-detail-head">
                <div>
                  <div className="card-title">{selected.name}</div>
                  <div className="card-subtitle ab-detail-meta">
                    <span>
                      <span className="material-symbols-rounded">call</span>
                      {selected.phone}
                    </span>
                    {selected.email && (
                      <span>
                        <span className="material-symbols-rounded">mail</span>
                        {selected.email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ab-visit-total">
                  <div className="ab-visit-total-num">{selected.visitCount}</div>
                  <div className="card-subtitle">총 방문</div>
                </div>
              </div>

              <div className="ab-stat-grid">
                <div className="ab-stat-box">
                  <div className="card-subtitle">첫 방문</div>
                  <div className="ab-stat-value">{formatDate(selected.firstVisit)}</div>
                </div>
                <div className="ab-stat-box">
                  <div className="card-subtitle">최근 방문</div>
                  <div className="ab-stat-value">{formatDate(selected.lastVisit)}</div>
                </div>
              </div>

              <div className="ab-section-title">방문 이력</div>
              <ul className="c-list">
                {selected.reservations.map((r) => (
                  <li key={r.id} className="c-list-item ab-history-item">
                    <div className="ab-history-head">
                      <div className="c-list-title">
                        {formatDate(r.date)}
                        {r.time && <span className="ab-history-time">{formatTime(r.time)}</span>}
                      </div>
                      <span className={`c-badge ${STATUS_BADGE[r.status] || 'c-badge-gray'}`}>
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                    </div>
                    {r.treatment && <div className="ab-history-treat">시술: {r.treatment}</div>}
                    {r.memo && (
                      <div className="ab-history-memo ab-memo-user">
                        <strong>고객 메모:</strong> {r.memo}
                      </div>
                    )}
                    {r.adminMemo && (
                      <div className="ab-history-memo ab-memo-admin">
                        <strong>차트 메모:</strong> {r.adminMemo}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="admin-card">
              <div className="c-empty">
                <div className="c-empty-text">좌측에서 고객을 선택하세요.</div>
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
