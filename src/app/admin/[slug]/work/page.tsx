'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface MaintenanceRequest {
  id: number;
  title: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: '대기',
  reviewing: '검토',
  working: '진행',
  done: '완료',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'c-badge-warning',
  reviewing: 'c-badge-purple',
  working: 'c-badge-info',
  done: 'c-badge-success',
};

const PRIORITY_LABEL: Record<string, string> = {
  low: '낮음',
  normal: '보통',
  high: '높음',
  urgent: '긴급',
};

const PRIORITY_BADGE: Record<string, string> = {
  low: 'c-badge-gray',
  normal: 'c-badge-gray',
  high: 'c-badge-warning',
  urgent: 'c-badge-error',
};

export default function WorkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const searchParams = useSearchParams();
  const [slug, setSlug] = useState<string | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // URL 쿼리스트링 기반 필터 (사이드바 서브메뉴와 동기화)
  const statusFilter = searchParams.get('status') || 'all';

  useEffect(() => {
    params.then(({ slug: paramSlug }) => {
      setSlug(paramSlug);
    });
  }, [params]);

  const fetchRequests = async (siteSlug: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/admin/maintenance?slug=${siteSlug}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      } else {
        setError(`작업 목록을 불러올 수 없습니다 (${response.status})`);
        setRequests([]);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to fetch requests:', errorMsg);
      setError(`작업 목록 로딩 실패: ${errorMsg}`);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async (siteSlug: string) => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch(`/api/admin/maintenance/sync?slug=${siteSlug}`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setSyncError(
          data.message || data.error || `동기화 실패 (${res.status})`
        );
      }
      return data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to sync:', errorMsg);
      setSyncError(`동기화 실패: ${errorMsg}`);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!slug) return;

    // 백그라운드에서 루딤링크 → 루딤웹 pull (실패 무시)
    triggerSync(slug).finally(() => {
      if (slug) fetchRequests(slug);
    });
  }, [slug]);

  const filteredRequests = requests.filter(
    (req) => statusFilter === 'all' || req.status === statusFilter
  );

  if (!slug) {
    return (
      <div className="c-empty">
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <div className="c-empty-text">로딩 중...</div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          gap: 16,
        }}
      >
        <div>
          <h1 className="c-page-title">작업</h1>
          <p className="c-page-subtitle">
            유지보수 요청과 채팅을 관리하세요.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={async () => {
            if (!slug) return;
            await triggerSync(slug);
            await fetchRequests(slug);
          }}
          disabled={syncing}
        >
          {syncing ? '동기화 중...' : '↻ 동기화'}
        </button>
      </div>

      {error && (
        <div className="c-alert c-alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}
      {syncError && (
        <div
          className="c-alert c-alert-warning"
          style={{ marginBottom: 16, fontSize: 'var(--fs-sm)' }}
        >
          {syncError}
        </div>
      )}

      <div
        className="card"
        style={{
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div className="c-empty">
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <div className="c-empty-text">로딩 중...</div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="c-empty">
            <div className="c-empty-icon">✅</div>
            <div className="c-empty-text">작업이 없습니다.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="c-table">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>분류</th>
                  <th>우선순위</th>
                  <th>상태</th>
                  <th>생성일</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr
                    key={request.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      window.location.href = `/admin/${slug}/work/${request.id}`;
                    }}
                  >
                    <td style={{ fontWeight: 'var(--fw-semi)' }}>
                      <Link
                        href={`/admin/${slug}/work/${request.id}`}
                        style={{
                          color: 'var(--text-primary)',
                          textDecoration: 'none',
                        }}
                      >
                        {request.title}
                      </Link>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {request.category || '—'}
                    </td>
                    <td>
                      <span
                        className={`c-badge ${
                          PRIORITY_BADGE[request.priority] || 'c-badge-gray'
                        }`}
                      >
                        {PRIORITY_LABEL[request.priority] || request.priority}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`c-badge ${
                          STATUS_BADGE[request.status] || 'c-badge-gray'
                        }`}
                      >
                        {STATUS_LABEL[request.status] || request.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {new Date(request.createdAt).toLocaleDateString('ko-KR')}
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
