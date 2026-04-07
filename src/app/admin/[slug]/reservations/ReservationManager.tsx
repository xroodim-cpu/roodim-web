'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

interface Reservation {
  id: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  treatmentName: string | null;
  reservedDate: string;
  reservedTime: string | null;
  memo: string | null;
  adminMemo: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
}

const AUTO_REFRESH_MS = 30_000; // 30초
const NEW_BADGE_THRESHOLD_MS = 60 * 60 * 1000; // 1시간

const STATUS_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '대기' },
  { key: 'confirmed', label: '확정' },
  { key: 'completed', label: '완료' },
  { key: 'cancelled', label: '취소' },
];

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: '대기', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  confirmed: { label: '확정', bg: 'bg-blue-100', text: 'text-blue-700' },
  completed: { label: '완료', bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { label: '취소', bg: 'bg-red-100', text: 'text-red-700' },
};

const NEXT_STATUSES: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

function isNewReservation(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < NEW_BADGE_THRESHOLD_MS;
}

export default function ReservationManager({ slug }: { slug: string }) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [editingMemo, setEditingMemo] = useState<number | null>(null);
  const [memoText, setMemoText] = useState('');
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchReservations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const q = filter !== 'all' ? `&status=${filter}` : '';
      const res = await fetch(`/api/admin/reservations?slug=${slug}${q}`);
      if (!res.ok) throw new Error('불러오기 실패');
      const json = await res.json();
      setReservations(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류 발생');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [slug, filter]);

  // 초기 로드 + 필터 변경 시
  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  // 30초 자동 새로고침
  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      fetchReservations(true);
    }, AUTO_REFRESH_MS);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchReservations]);

  // 대기 중 예약 수
  const pendingCount = reservations.filter(r => r.status === 'pending').length;

  async function handleStatusChange(id: number, newStatus: string) {
    try {
      const res = await fetch('/api/admin/reservations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, slug, status: newStatus }),
      });
      if (!res.ok) throw new Error('상태 변경 실패');
      setReservations(prev =>
        prev.map(r => r.id === id ? { ...r, status: newStatus as Reservation['status'] } : r)
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류 발생');
    }
  }

  async function saveMemo(id: number) {
    try {
      await fetch('/api/admin/reservations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, slug, adminMemo: memoText }),
      });
      setReservations(prev =>
        prev.map(r => r.id === id ? { ...r, adminMemo: memoText } : r)
      );
      setEditingMemo(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '메모 저장 실패');
    }
  }

  function formatDateTime(date: string, time: string | null) {
    if (!date) return '-';
    const d = date.split('T')[0]; // handle ISO format
    return time ? `${d} ${time}` : d;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/admin/${slug}`} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-lg font-bold">예약 관리</h1>
          {pendingCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 text-xs font-bold text-white bg-red-500 rounded-full">
              {pendingCount}
            </span>
          )}
          <div className="flex-1" />
          <button
            onClick={() => fetchReservations(true)}
            className="text-gray-400 hover:text-gray-600 transition"
            title="새로고침"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                filter === f.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">{error}</div>}

        {loading ? (
          <div className="text-center py-20 text-gray-400">불러오는 중...</div>
        ) : reservations.length === 0 ? (
          <div className="text-center py-20 text-gray-400">예약이 없습니다</div>
        ) : (
          <div className="space-y-3">
            {reservations.map(r => {
              const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
              const nextStatuses = NEXT_STATUSES[r.status] || [];

              return (
                <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold">{r.customerName}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                        {isNewReservation(r.createdAt) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white bg-red-500 animate-pulse">
                            새 예약
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                        <span>{r.customerPhone}</span>
                        {r.treatmentName && <span>{r.treatmentName}</span>}
                        <span>{formatDateTime(r.reservedDate, r.reservedTime)}</span>
                      </div>
                    </div>
                    {nextStatuses.length > 0 && (
                      <div className="flex gap-1 flex-shrink-0">
                        {nextStatuses.map(ns => {
                          const nsCfg = STATUS_CONFIG[ns];
                          return (
                            <button
                              key={ns}
                              onClick={() => handleStatusChange(r.id, ns)}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                                ns === 'cancelled' ? 'text-red-600 border-red-200 hover:bg-red-50' : `${nsCfg.text} border-gray-200 hover:bg-gray-50`
                              }`}
                            >
                              {nsCfg.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {r.memo && (
                    <div className="text-sm bg-gray-50 rounded-lg p-3 mb-3">
                      <span className="text-gray-500 font-medium">고객 메모:</span> {r.memo}
                    </div>
                  )}

                  <div className="text-sm">
                    {editingMemo === r.id ? (
                      <div className="flex gap-2">
                        <input type="text" value={memoText} onChange={e => setMemoText(e.target.value)} placeholder="관리자 메모 입력..." className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
                        <button onClick={() => saveMemo(r.id)} className="px-3 py-2 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 transition">저장</button>
                        <button onClick={() => setEditingMemo(null)} className="px-3 py-2 bg-gray-100 text-xs rounded-lg hover:bg-gray-200 transition">취소</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingMemo(r.id); setMemoText(r.adminMemo || ''); }} className="text-gray-400 hover:text-gray-600 transition">
                        {r.adminMemo ? (
                          <span><span className="text-gray-500 font-medium">관리자 메모:</span> <span className="text-gray-600">{r.adminMemo}</span></span>
                        ) : '+ 관리자 메모 추가'}
                      </button>
                    )}
                  </div>

                  <div className="mt-3 text-xs text-gray-400">접수: {new Date(r.createdAt).toLocaleString('ko-KR')}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
