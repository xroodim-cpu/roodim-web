'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const CATEGORIES = [
  { value: 'design_change', label: '디자인 수정' },
  { value: 'content_update', label: '콘텐츠 변경' },
  { value: 'feature_add', label: '기능 추가' },
  { value: 'bug_fix', label: '오류 수정' },
  { value: 'other', label: '기타' },
];

export default function MaintenancePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('content_update');
  const [priority, setPriority] = useState('normal');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  function validatePhone(value: string): boolean {
    return /^01[016789]-?\d{3,4}-?\d{4}$/.test(value.replace(/\s/g, ''));
  }

  async function handleSubmit() {
    setErrorMsg('');

    if (!title.trim()) {
      setErrorMsg('제목을 입력해주세요.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('상세 내용을 입력해주세요.');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('이름을 입력해주세요.');
      return;
    }
    if (!phone.trim() || !validatePhone(phone)) {
      setErrorMsg('올바른 연락처를 입력해주세요. (예: 010-1234-5678)');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_slug: slug,
          title: title.trim(),
          description: description.trim(),
          category,
          priority,
          requested_by: { name: name.trim(), phone: phone.trim(), email: email.trim() || undefined },
        }),
      });

      const data = await res.json();
      if (data.ok) {
        const qp = new URLSearchParams({
          title: title.trim(),
          category,
        });
        router.push(`/${slug}/maintenance/complete?${qp.toString()}`);
      } else {
        setErrorMsg(data.error || '요청 접수에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } catch {
      setErrorMsg('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-gray-50 min-h-[60vh]">
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-xl font-bold mb-6">유지보수 요청</h1>

        <div className="bg-white rounded-xl p-5 border border-gray-200 space-y-5">
          {/* 카테고리 */}
          <div>
            <label className="block text-sm font-medium mb-2">요청 유형</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    category === cat.value
                      ? 'bg-[var(--color-primary,#cc222c)] text-white border-transparent'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* 우선순위 */}
          <div>
            <label className="block text-sm font-medium mb-2">긴급도</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#cc222c)]"
            >
              <option value="low">낮음 (여유 있음)</option>
              <option value="normal">보통</option>
              <option value="high">높음 (빠른 처리 필요)</option>
              <option value="urgent">긴급</option>
            </select>
          </div>

          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium mb-1">제목 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="수정/추가하고 싶은 내용을 간략히 적어주세요"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#cc222c)]"
            />
          </div>

          {/* 내용 */}
          <div>
            <label className="block text-sm font-medium mb-1">상세 내용 <span className="text-red-500">*</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={5}
              placeholder="자세한 내용을 적어주세요. 스크린샷이나 참고 이미지가 있으면 더 좋습니다."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#cc222c)]"
            />
          </div>

          {/* 연락처 */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold mb-3">요청자 정보</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">이름 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#cc222c)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">연락처 <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#cc222c)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#cc222c)]"
                />
              </div>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">
            {errorMsg}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full mt-4 py-3.5 rounded-xl text-white font-bold disabled:opacity-50 transition"
          style={{ background: 'var(--color-primary, #cc222c)' }}
        >
          {submitting ? '접수 중...' : '유지보수 요청하기'}
        </button>
      </div>
    </div>
  );
}
