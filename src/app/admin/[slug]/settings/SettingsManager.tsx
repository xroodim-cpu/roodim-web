'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const TABS = [
  { key: 'base', label: '기본정보' },
  { key: 'design', label: '디자인' },
  { key: 'seo', label: 'SEO' },
  { key: 'reserve', label: '예약설정' },
  { key: 'headerfooter', label: '헤더/푸터' },
  { key: 'policy', label: '정책' },
];

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'color';
  placeholder?: string;
}

const FIELDS: Record<string, FieldDef[]> = {
  base: [
    { key: 'site_name', label: '사이트 이름', type: 'text', placeholder: '예: 루딤 뷰티' },
    { key: 'tagline', label: '태그라인', type: 'text', placeholder: '한 줄 소개' },
    { key: 'phone', label: '전화번호', type: 'text', placeholder: '02-1234-5678' },
    { key: 'address', label: '주소', type: 'text', placeholder: '서울시 강남구...' },
    { key: 'business_hours', label: '영업시간', type: 'text', placeholder: '평일 10:00-19:00' },
    { key: 'business_number', label: '사업자번호', type: 'text', placeholder: '123-45-67890' },
    { key: 'representative', label: '대표자', type: 'text', placeholder: '홍길동' },
  ],
  design: [
    { key: 'primary_color', label: '메인 컬러', type: 'color' },
    { key: 'accent_color', label: '강조 컬러', type: 'color' },
    { key: 'font', label: '폰트', type: 'text', placeholder: 'Pretendard, sans-serif' },
  ],
  seo: [
    { key: 'meta_title', label: '메타 타이틀', type: 'text', placeholder: '페이지 제목' },
    { key: 'meta_description', label: '메타 설명', type: 'textarea', placeholder: '검색 엔진에 표시될 설명' },
    { key: 'og_image', label: 'OG 이미지 URL', type: 'text', placeholder: 'https://...' },
  ],
  reserve: [
    { key: 'reserve_notice', label: '예약 안내 문구', type: 'textarea', placeholder: '예약 시 참고사항을 입력하세요' },
  ],
  headerfooter: [
    { key: 'logo_url', label: '로고 이미지 URL', type: 'text', placeholder: 'https://...' },
    { key: 'footer_text', label: '푸터 텍스트', type: 'textarea', placeholder: '하단에 표시될 텍스트' },
  ],
  policy: [
    { key: 'privacy_policy', label: '개인정보처리방침', type: 'textarea', placeholder: '개인정보처리방침 내용을 입력하세요' },
  ],
};

export default function SettingsManager({ slug }: { slug: string }) {
  const [activeTab, setActiveTab] = useState('base');
  // allConfigs stores the full config map: { base: {...}, design: {...}, ... }
  const [allConfigs, setAllConfigs] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/settings?slug=${slug}`);
      if (!res.ok) throw new Error('불러오기 실패');
      const json = await res.json();
      // json.data is { base: {...}, design: {...}, ... }
      const configs: Record<string, Record<string, string>> = {};
      for (const [section, data] of Object.entries(json.data || {})) {
        configs[section] = (data as Record<string, string>) || {};
      }
      setAllConfigs(configs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류 발생');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  // Current tab's data
  const currentData = allConfigs[activeTab] || {};

  function handleChange(key: string, value: string) {
    setAllConfigs(prev => ({
      ...prev,
      [activeTab]: { ...(prev[activeTab] || {}), [key]: value },
    }));
    setSuccess('');
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          section: activeTab,
          data: allConfigs[activeTab] || {},
        }),
      });
      if (!res.ok) throw new Error('저장 실패');
      setSuccess('설정이 저장되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류 발생');
    } finally {
      setSaving(false);
    }
  }

  const fields = FIELDS[activeTab] || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/admin/${slug}`} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-lg font-bold">사이트 설정</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setActiveTab(t.key); setSuccess(''); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                activeTab === t.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-lg border border-green-200">{success}</div>}

        {loading ? (
          <div className="text-center py-20 text-gray-400">불러오는 중...</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="space-y-5">
              {fields.map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{field.label}</label>
                  {field.type === 'color' ? (
                    <div className="flex items-center gap-3">
                      <input type="color" value={currentData[field.key] || '#000000'} onChange={e => handleChange(field.key, e.target.value)} className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5" />
                      <input type="text" value={currentData[field.key] || ''} onChange={e => handleChange(field.key, e.target.value)} placeholder="#000000" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
                    </div>
                  ) : field.type === 'textarea' ? (
                    <textarea rows={field.key === 'privacy_policy' ? 12 : 4} value={currentData[field.key] || ''} onChange={e => handleChange(field.key, e.target.value)} placeholder={field.placeholder} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none resize-y" />
                  ) : (
                    <input type="text" value={currentData[field.key] || ''} onChange={e => handleChange(field.key, e.target.value)} placeholder={field.placeholder} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none" />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
