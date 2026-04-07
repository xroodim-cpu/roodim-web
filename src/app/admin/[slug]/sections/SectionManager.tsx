'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Section {
  id: number;
  sectionKey: string;
  sortOrder: number;
  isActive: boolean;
  settings: Record<string, unknown>;
}

const AVAILABLE_SECTIONS = [
  { key: 'slide', label: '슬라이드', desc: '메인 슬라이드 배너' },
  { key: 'treat', label: '시술 소개', desc: '시술/서비스 목록' },
  { key: 'event', label: '이벤트', desc: '진행 중인 이벤트' },
  { key: 'beforeafter', label: '비포/애프터', desc: '시술 전후 비교' },
  { key: 'tips', label: '팁/칼럼', desc: '뷰티 팁 및 칼럼' },
  { key: 'map', label: '지도/오시는 길', desc: '위치 안내' },
  { key: 'reserve_cta', label: '예약 CTA', desc: '예약 유도 배너' },
];

export default function SectionManager({ slug }: { slug: string }) {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const fetchSections = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/sections?slug=${slug}`);
      if (!res.ok) throw new Error('불러오기 실패');
      const json = await res.json();
      setSections(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류 발생');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetchSections(); }, [fetchSections]);

  async function handleToggle(id: number, currentActive: boolean) {
    try {
      await fetch('/api/admin/sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, slug, isActive: !currentActive }),
      });
      setSections(prev => prev.map(s => s.id === id ? { ...s, isActive: !currentActive } : s));
    } catch { /* silent */ }
  }

  async function handleMove(id: number, direction: 'up' | 'down') {
    const idx = sections.findIndex(s => s.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sections.length) return;

    const a = sections[idx];
    const b = sections[swapIdx];
    const reordered = [...sections];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    setSections(reordered);

    try {
      await Promise.all([
        fetch('/api/admin/sections', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: a.id, slug, sortOrder: b.sortOrder }),
        }),
        fetch('/api/admin/sections', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: b.id, slug, sortOrder: a.sortOrder }),
        }),
      ]);
    } catch { /* silent */ }
  }

  function startEdit(section: Section) {
    setEditingId(section.id);
    setEditTitle(String(section.settings?.title || ''));
    setEditSubtitle(String(section.settings?.subtitle || ''));
  }

  async function saveEdit() {
    if (!editingId) return;
    const section = sections.find(s => s.id === editingId);
    if (!section) return;

    const newSettings = { ...section.settings, title: editTitle, subtitle: editSubtitle };
    try {
      await fetch('/api/admin/sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, slug, settings: newSettings }),
      });
      setSections(prev =>
        prev.map(s => s.id === editingId ? { ...s, settings: newSettings } : s)
      );
      setEditingId(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '저장 실패');
    }
  }

  async function handleAdd(sectionKey: string) {
    try {
      const maxSort = sections.reduce((max, s) => Math.max(max, s.sortOrder), 0);
      const res = await fetch('/api/admin/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, sectionKey, sortOrder: maxSort + 1 }),
      });
      if (!res.ok) throw new Error('추가 실패');
      setShowAdd(false);
      fetchSections();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류 발생');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('이 섹션을 삭제하시겠습니까?')) return;
    try {
      await fetch('/api/admin/sections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, slug }),
      });
      fetchSections();
    } catch { /* silent */ }
  }

  const usedKeys = new Set(sections.map(s => s.sectionKey));
  const availableToAdd = AVAILABLE_SECTIONS.filter(s => !usedKeys.has(s.key));
  const labelMap = Object.fromEntries(AVAILABLE_SECTIONS.map(s => [s.key, s.label]));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/admin/${slug}`} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-lg font-bold">섹션 관리</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">메인 페이지 섹션 구성 및 순서를 관리합니다.</p>
          {availableToAdd.length > 0 && (
            <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition">+ 섹션 추가</button>
          )}
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">{error}</div>}

        {showAdd && availableToAdd.length > 0 && (
          <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">추가 가능한 섹션</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availableToAdd.map(s => (
                <button key={s.key} onClick={() => handleAdd(s.key)} className="text-left p-3 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition">
                  <p className="font-medium text-sm">{s.label}</p>
                  <p className="text-xs text-gray-500">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400">불러오는 중...</div>
        ) : sections.length === 0 ? (
          <div className="text-center py-20 text-gray-400">등록된 섹션이 없습니다</div>
        ) : (
          <div className="space-y-2">
            {sections.map((section, idx) => (
              <div key={section.id} className={`bg-white rounded-xl border p-4 transition ${section.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
                {editingId === section.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">섹션 제목</label>
                      <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">부제목</label>
                      <input type="text" value={editSubtitle} onChange={e => setEditSubtitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition">저장</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition">취소</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => handleMove(section.id, 'up')} disabled={idx === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      </button>
                      <button onClick={() => handleMove(section.id, 'down')} disabled={idx === sections.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{labelMap[section.sectionKey] || section.sectionKey}</span>
                        {!section.isActive && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">비활성</span>}
                      </div>
                      <p className="font-medium mt-1">{String(section.settings?.title || '') || '(제목 없음)'}</p>
                      {section.settings?.subtitle ? <p className="text-sm text-gray-500">{String(section.settings.subtitle)}</p> : null}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => handleToggle(section.id, section.isActive)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${section.isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${section.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                      <button onClick={() => startEdit(section)} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition">수정</button>
                      <button onClick={() => handleDelete(section.id)} className="px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">삭제</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
