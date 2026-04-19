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
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
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
        <div className="card">
          <div className="c-empty">
            <div className="c-empty-icon">📇</div>
            <div className="c-empty-text">등록된 고객이 없습니다</div>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginTop: 6 }}>
              홈페이지 예약 기능을 통해 예약이 들어오면 자동으로 주소록에 등록됩니다.
            </p>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 360px) 1fr',
            gap: 'var(--sp-lg)',
            alignItems: 'start',
          }}
        >
          {/* 좌측: 고객 리스트 */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: 'var(--sp-md)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ position: 'relative' }}>
                <span
                  className="material-symbols-rounded"
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 18,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  search
                </span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="이름·전화·이메일 검색"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ width: '100%', paddingLeft: 34 }}
                />
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-tertiary)',
                }}
              >
                총 {filtered.length}명
              </div>
            </div>
            <div
              style={{
                maxHeight: 'calc(100vh - 280px)',
                overflowY: 'auto',
              }}
            >
              {filtered.map((c) => {
                const isActive = selected?.phone === c.phone;
                return (
                  <button
                    key={c.phone}
                    type="button"
                    onClick={() => setSelectedPhone(c.phone)}
                    className={isActive ? 'ab-row active' : 'ab-row'}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: 'var(--sp-md) var(--sp-lg)',
                      border: 'none',
                      background: isActive ? 'var(--bg-secondary)' : 'transparent',
                      borderLeft: isActive
                        ? '3px solid var(--accent)'
                        : '3px solid transparent',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 'var(--fw-semi)',
                        color: 'var(--text-primary)',
                        marginBottom: 4,
                      }}
                    >
                      {c.name}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--fs-xs)',
                        color: 'var(--text-tertiary)',
                        marginBottom: 6,
                      }}
                    >
                      {c.phone}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="c-badge c-badge-gray">방문 {c.visitCount}회</span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                        최근 {formatDate(c.lastVisit)}
                      </span>
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
          </div>

          {/* 우측: 선택 고객의 차트 */}
          {selected ? (
            <div className="card">
              <div
                className="card-header"
                style={{ alignItems: 'flex-start' }}
              >
                <div>
                  <div className="card-title">{selected.name}</div>
                  <div className="card-subtitle" style={{ marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>
                      <span className="material-symbols-rounded" style={{ verticalAlign: 'middle', fontSize: 16, marginRight: 4 }}>call</span>
                      {selected.phone}
                    </span>
                    {selected.email && (
                      <span>
                        <span className="material-symbols-rounded" style={{ verticalAlign: 'middle', fontSize: 16, marginRight: 4 }}>mail</span>
                        {selected.email}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: 'var(--fs-2xl)',
                      fontWeight: 'var(--fw-black)',
                      color: 'var(--accent)',
                      lineHeight: 1,
                    }}
                  >
                    {selected.visitCount}
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                    총 방문
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--sp-md)',
                  marginBottom: 'var(--sp-lg)',
                }}
              >
                <div
                  style={{
                    padding: 'var(--sp-md)',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                    첫 방문
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semi)' }}>
                    {formatDate(selected.firstVisit)}
                  </div>
                </div>
                <div
                  style={{
                    padding: 'var(--sp-md)',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                    최근 방문
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semi)' }}>
                    {formatDate(selected.lastVisit)}
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 'var(--fw-semi)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--sp-sm)',
                }}
              >
                방문 이력
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selected.reservations.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      padding: 'var(--sp-md)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semi)' }}>
                        {formatDate(r.date)}
                        {r.time && (
                          <span
                            style={{
                              marginLeft: 8,
                              color: 'var(--text-tertiary)',
                              fontWeight: 'var(--fw-normal)',
                            }}
                          >
                            {formatTime(r.time)}
                          </span>
                        )}
                      </div>
                      <span className={`c-badge ${STATUS_BADGE[r.status] || 'c-badge-gray'}`}>
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                    </div>
                    {r.treatment && (
                      <div
                        style={{
                          fontSize: 'var(--fs-sm)',
                          color: 'var(--text-secondary)',
                          marginBottom: 4,
                        }}
                      >
                        시술: {r.treatment}
                      </div>
                    )}
                    {r.memo && (
                      <div
                        style={{
                          fontSize: 'var(--fs-xs)',
                          color: 'var(--text-tertiary)',
                          marginTop: 6,
                          padding: 8,
                          background: 'var(--bg-secondary)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <strong>고객 메모:</strong> {r.memo}
                      </div>
                    )}
                    {r.adminMemo && (
                      <div
                        style={{
                          fontSize: 'var(--fs-xs)',
                          color: 'var(--text-tertiary)',
                          marginTop: 6,
                          padding: 8,
                          background: '#fffbeb',
                          borderRadius: 'var(--radius-sm)',
                          borderLeft: '3px solid #fbbf24',
                        }}
                      >
                        <strong>차트 메모:</strong> {r.adminMemo}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="c-empty">
                <div className="c-empty-text">좌측에서 고객을 선택하세요.</div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
