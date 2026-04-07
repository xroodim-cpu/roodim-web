'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface ContentItem {
  id: number;
  type: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  thumbUrl: string | null;
  metaJson: Record<string, string>;
  sortOrder: number;
  isVisible: boolean;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
}

const CONTENT_TYPES = [
  { key: 'treat', label: '시술' },
  { key: 'event', label: '이벤트' },
  { key: 'staff', label: '스태프' },
  { key: 'slide', label: '슬라이드' },
  { key: 'tip', label: '팁/칼럼' },
  { key: 'beforeafter', label: '비포/애프터' },
];

const emptyForm = {
  type: 'treat',
  title: '',
  slug_content: '',
  summary: '',
  content: '',
  thumbUrl: '',
  sortOrder: 0,
  isVisible: true,
  startAt: '',
  endAt: '',
};

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim() || `content-${Date.now()}`;
}

export default function ContentManager({ slug }: { slug: string }) {
  const [activeType, setActiveType] = useState('treat');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [metaEntries, setMetaEntries] = useState<{ key: string; value: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/contents?slug=${slug}&type=${activeType}`);
      if (!res.ok) throw new Error('불러오기 실패');
      const json = await res.json();
      setItems(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류 발생');
    } finally {
      setLoading(false);
    }
  }, [slug, activeType]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function openCreate() {
    setEditId(null);
    setForm({ ...emptyForm, type: activeType });
    setMetaEntries([{ key: '', value: '' }]);
    setModalOpen(true);
  }

  function openEdit(item: ContentItem) {
    setEditId(item.id);
    setForm({
      type: item.type,
      title: item.title,
      slug_content: item.slug,
      summary: item.summary || '',
      content: item.content || '',
      thumbUrl: item.thumbUrl || '',
      sortOrder: item.sortOrder,
      isVisible: item.isVisible,
      startAt: item.startAt || '',
      endAt: item.endAt || '',
    });
    const entries = Object.entries(item.metaJson || {}).map(([key, value]) => ({ key, value: String(value) }));
    setMetaEntries(entries.length > 0 ? entries : [{ key: '', value: '' }]);
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    const meta: Record<string, string> = {};
    metaEntries.forEach(e => { if (e.key.trim()) meta[e.key.trim()] = e.value; });

    const body = {
      slug, // site slug for auth
      id: editId || undefined,
      type: form.type,
      title: form.title,
      slug_content: form.slug_content || generateSlug(form.title),
      summary: form.summary || null,
      content: form.content || null,
      thumbUrl: form.thumbUrl || null,
      metaJson: meta,
      sortOrder: form.sortOrder,
      isVisible: form.isVisible,
      startAt: form.startAt || null,
      endAt: form.endAt || null,
    };

    try {
      const res = await fetch('/api/admin/contents', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('저장 실패');
      setModalOpen(false);
      fetchItems();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류 발생');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch('/api/admin/contents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteId, slug }),
      });
      if (!res.ok) throw new Error('삭제 실패');
      setDeleteId(null);
      fetchItems();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류 발생');
    }
  }

  async function handleSort(id: number, direction: 'up' | 'down') {
    const idx = items.findIndex(i => i.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;

    const a = items[idx];
    const b = items[swapIdx];
    const reordered = [...items];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    setItems(reordered);

    // Update sort orders via PUT
    try {
      await Promise.all([
        fetch('/api/admin/contents', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: a.id, slug, sortOrder: b.sortOrder }),
        }),
        fetch('/api/admin/contents', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: b.id, slug, sortOrder: a.sortOrder }),
        }),
      ]);
    } catch { /* silent */ }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/admin/${slug}`} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-lg font-bold">콘텐츠 관리</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {CONTENT_TYPES.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveType(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                activeType === t.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">{items.length}개 항목</p>
          <button onClick={openCreate} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition">+ 새 콘텐츠</button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">{error}</div>}

        {loading ? (
          <div className="text-center py-20 text-gray-400">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-gray-400">등록된 콘텐츠가 없습니다</div>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                <div className="flex flex-col gap-1">
                  <button onClick={() => handleSort(item.id, 'up')} disabled={idx === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button onClick={() => handleSort(item.id, 'down')} disabled={idx === items.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
                {item.thumbUrl ? (
                  <img src={item.thumbUrl} alt="" className="w-14 h-14 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gray-100 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{item.title}</h3>
                    {!item.isVisible && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">숨김</span>}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{item.summary || item.slug}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(item)} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition">수정</button>
                  <button onClick={() => setDeleteId(item.id)} className="px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold text-lg">{editId ? '콘텐츠 수정' : '새 콘텐츠'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value, slug_content: editId ? p.slug_content : generateSlug(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">슬러그</label>
                <input type="text" value={form.slug_content} onChange={e => setForm(p => ({ ...p, slug_content: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">요약</label>
                <input type="text" value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                <textarea rows={5} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none resize-y" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">썸네일 URL</label>
                <input type="text" value={form.thumbUrl} onChange={e => setForm(p => ({ ...p, thumbUrl: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메타 정보 (가격, 카테고리 등)</label>
                <div className="space-y-2">
                  {metaEntries.map((entry, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="text" placeholder="키 (예: price)" value={entry.key} onChange={e => { const next = [...metaEntries]; next[i] = { ...next[i], key: e.target.value }; setMetaEntries(next); }} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
                      <input type="text" placeholder="값" value={entry.value} onChange={e => { const next = [...metaEntries]; next[i] = { ...next[i], value: e.target.value }; setMetaEntries(next); }} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
                      <button onClick={() => setMetaEntries(metaEntries.filter((_, j) => j !== i))} className="px-2 text-gray-400 hover:text-red-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                  <button onClick={() => setMetaEntries([...metaEntries, { key: '', value: '' }])} className="text-sm text-gray-500 hover:text-gray-700">+ 항목 추가</button>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">정렬 순서</label>
                  <input type="number" value={form.sortOrder} onChange={e => setForm(p => ({ ...p, sortOrder: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.isVisible} onChange={e => setForm(p => ({ ...p, isVisible: e.target.checked }))} className="w-4 h-4 rounded border-gray-300" />
                    <span className="text-sm font-medium text-gray-700">노출</span>
                  </label>
                </div>
              </div>
              {form.type === 'event' && (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                    <input type="datetime-local" value={form.startAt} onChange={e => setForm(p => ({ ...p, startAt: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                    <input type="datetime-local" value={form.endAt} onChange={e => setForm(p => ({ ...p, endAt: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition">취소</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="font-bold mb-2">콘텐츠 삭제</h3>
            <p className="text-sm text-gray-600 mb-4">이 콘텐츠를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition">취소</button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition">삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
