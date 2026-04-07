'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface MaintenanceItem {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'reviewing' | 'working' | 'done' | 'cancelled';
  requestedBy: { name?: string; phone?: string; email?: string };
  createdAt: string;
  resolvedAt: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: '대기', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  reviewing: { label: '검토중', bg: 'bg-blue-100', text: 'text-blue-700' },
  working: { label: '진행중', bg: 'bg-purple-100', text: 'text-purple-700' },
  done: { label: '완료', bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { label: '취소', bg: 'bg-gray-100', text: 'text-gray-600' },
};

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  low: { label: '낮음', bg: 'bg-gray-100', text: 'text-gray-600' },
  normal: { label: '보통', bg: 'bg-blue-50', text: 'text-blue-600' },
  high: { label: '높음', bg: 'bg-orange-100', text: 'text-orange-700' },
  urgent: { label: '긴급', bg: 'bg-red-100', text: 'text-red-700' },
};

const CATEGORY_LABELS: Record<string, string> = {
  design_change: '디자인 변경',
  content_update: '콘텐츠 수정',
  feature_add: '기능 추가',
  bug_fix: '버그 수정',
  other: '기타',
};

export default function MaintenanceList({ slug }: { slug: string }) {
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasApi, setHasApi] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/maintenance?slug=${slug}`);
      if (res.status === 404) {
        setHasApi(false);
        return;
      }
      if (!res.ok) throw new Error('불러오기 실패');
      const json = await res.json();
      setItems(json.data ?? []);
    } catch {
      setHasApi(false);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function formatDate(dt: string | null) {
    if (!dt) return '-';
    try {
      return new Date(dt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch { return dt; }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/admin/${slug}`} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-lg font-bold">유지보수 요청</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-sm text-gray-500 mb-6">유지보수 요청 이력을 확인할 수 있습니다. 처리는 루딤 어드민에서 진행됩니다.</p>

        {loading ? (
          <div className="text-center py-20 text-gray-400">불러오는 중...</div>
        ) : !hasApi ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-4xl mb-4">🔧</div>
            <h3 className="font-bold text-gray-700 mb-2">유지보수 관리</h3>
            <p className="text-sm text-gray-500 mb-1">유지보수 요청 및 이력은 루딤 어드민에서 관리됩니다.</p>
            <p className="text-sm text-gray-400">문의가 필요하시면 관리자에게 연락해 주세요.</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-gray-400">유지보수 요청이 없습니다</div>
        ) : (
          <div className="space-y-3">
            {items.map(item => {
              const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
              const priorityCfg = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.normal;
              const categoryLabel = CATEGORY_LABELS[item.category] || item.category;

              return (
                <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-medium">{item.title}</h3>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityCfg.bg} ${priorityCfg.text}`}>{priorityCfg.label}</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>{statusCfg.label}</span>
                    </div>
                  </div>
                  {item.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>}
                  <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-50 text-gray-500">{categoryLabel}</span>
                    {item.requestedBy?.name && <span>요청자: {item.requestedBy.name}</span>}
                    <span>요청일: {formatDate(item.createdAt)}</span>
                    {item.resolvedAt && <span>해결일: {formatDate(item.resolvedAt)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
