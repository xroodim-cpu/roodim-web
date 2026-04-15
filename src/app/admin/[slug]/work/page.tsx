'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './Work.module.css';

interface MaintenanceRequest {
  id: number;
  title: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState<string | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    // params를 resolve
    params.then(({ slug: paramSlug }) => {
      setSlug(paramSlug);
    });
  }, [params]);

  useEffect(() => {
    if (!slug) return;

    async function fetchRequests() {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/admin/maintenance?slug=${slug}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setRequests(data.requests || []);
        } else {
          setError(`Failed to load work items (${response.status})`);
          setRequests([]);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('Failed to fetch requests:', errorMsg);
        setError(`Failed to load work items: ${errorMsg}`);
        setRequests([]);
      } finally {
        setLoading(false);
      }
    }

    fetchRequests();
  }, [slug]);

  const filteredRequests = requests.filter(
    (req) => statusFilter === 'all' || req.status === statusFilter
  );

  if (!slug) {
    return <div>로딩 중...</div>;
  }

  return (
    <div className={styles.work}>
      <div className={styles.header}>
        <h1>작업</h1>
        <p className={styles.subtitle}>유지보수 요청과 채팅을 관리하세요.</p>
      </div>

      {/* 필터 */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <button
            className={`${styles.filterBtn} ${statusFilter === 'all' ? styles.active : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            전체 ({requests.length})
          </button>
          <button
            className={`${styles.filterBtn} ${statusFilter === 'pending' ? styles.active : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            대기 ({requests.filter((r) => r.status === 'pending').length})
          </button>
          <button
            className={`${styles.filterBtn} ${statusFilter === 'reviewing' ? styles.active : ''}`}
            onClick={() => setStatusFilter('reviewing')}
          >
            검토 중 ({requests.filter((r) => r.status === 'reviewing').length})
          </button>
          <button
            className={`${styles.filterBtn} ${statusFilter === 'working' ? styles.active : ''}`}
            onClick={() => setStatusFilter('working')}
          >
            진행 중 ({requests.filter((r) => r.status === 'working').length})
          </button>
          <button
            className={`${styles.filterBtn} ${statusFilter === 'done' ? styles.active : ''}`}
            onClick={() => setStatusFilter('done')}
          >
            완료 ({requests.filter((r) => r.status === 'done').length})
          </button>
        </div>
      </div>

      {/* 요청 목록 */}
      <div className={styles.requestList}>
        {error ? (
          <div style={{ padding: '20px', color: '#cc222c', textAlign: 'center', background: '#ffebee', borderRadius: '8px' }}>
            ⚠️ {error}
          </div>
        ) : loading ? (
          <div className={styles.loading}>로딩 중...</div>
        ) : filteredRequests.length === 0 ? (
          <div className={styles.emptyState}>
            <p>작업이 없습니다.</p>
          </div>
        ) : (
          filteredRequests.map((request) => (
            <Link
              key={request.id}
              href={`/admin/${slug}/work/${request.id}`}
              className={styles.requestCard}
            >
              <div className={styles.requestHeader}>
                <h3 className={styles.requestTitle}>{request.title}</h3>
                <span className={`${styles.badge} ${styles[request.status]}`}>
                  {request.status === 'pending' && '대기'}
                  {request.status === 'reviewing' && '검토'}
                  {request.status === 'working' && '진행'}
                  {request.status === 'done' && '완료'}
                </span>
              </div>
              <div className={styles.requestMeta}>
                <span className={styles.category}>{request.category}</span>
                <span className={`${styles.priority} ${styles[request.priority]}`}>
                  {request.priority === 'low' && '낮음'}
                  {request.priority === 'normal' && '보통'}
                  {request.priority === 'high' && '높음'}
                  {request.priority === 'urgent' && '긴급'}
                </span>
              </div>
              <div className={styles.requestDate}>
                {new Date(request.createdAt).toLocaleDateString('ko-KR')}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
