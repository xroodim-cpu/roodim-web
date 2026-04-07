'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Treatment {
  id: number;
  title: string;
  thumbUrl: string | null;
  metaJson: { category?: string; price?: number };
}

export default function ReservePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [step, setStep] = useState(1); // 1: 시술 선택, 2: 날짜/시간, 3: 연락처
  const [errorMsg, setErrorMsg] = useState('');
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [selectedTreatment, setSelectedTreatment] = useState<Treatment | null>(null);
  const [reservedDate, setReservedDate] = useState('');
  const [reservedTime, setReservedTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 시술 목록 로드
  useEffect(() => {
    fetch(`/api/contents?slug=${slug}&type=treat`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) setTreatments(data.contents);
      })
      .catch(() => {});
  }, [slug]);

  // 연락처 형식 검증
  function validatePhone(value: string): boolean {
    return /^01[016789]-?\d{3,4}-?\d{4}$/.test(value.replace(/\s/g, ''));
  }

  // 예약 제출
  async function handleSubmit() {
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('이름을 입력해주세요.');
      return;
    }
    if (!phone.trim() || !validatePhone(phone)) {
      setErrorMsg('올바른 연락처를 입력해주세요. (예: 010-1234-5678)');
      return;
    }
    if (!reservedDate) {
      setErrorMsg('날짜를 선택해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_slug: slug,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          customer_email: email.trim() || undefined,
          treatment_name: selectedTreatment?.title || '',
          reserved_date: reservedDate,
          reserved_time: reservedTime || undefined,
          memo: memo.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        const qp = new URLSearchParams({
          name: name.trim(),
          date: reservedDate,
          ...(reservedTime && { time: reservedTime }),
          ...(selectedTreatment?.title && { treatment: selectedTreatment.title }),
        });
        router.push(`/${slug}/reserve/complete?${qp.toString()}`);
      } else {
        setErrorMsg(data.error || '예약에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } catch {
      setErrorMsg('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  // 오늘 이후 날짜만 선택 가능
  const today = new Date().toISOString().split('T')[0];

  // 시간 옵션 (09:00 ~ 18:00, 30분 간격)
  const timeSlots = [];
  for (let h = 9; h <= 18; h++) {
    timeSlots.push(`${String(h).padStart(2, '0')}:00`);
    if (h < 18) timeSlots.push(`${String(h).padStart(2, '0')}:30`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <a href={`/${slug}`} className="mr-3 text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 className="text-lg font-bold">예약하기</h1>
        </div>
      </div>

      {/* 단계 표시 */}
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= s ? 'bg-[var(--color-primary,#cc222c)] text-white' : 'bg-gray-200 text-gray-400'
              }`}>
                {s}
              </div>
              <span className={`text-xs ${step >= s ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                {s === 1 ? '시술 선택' : s === 2 ? '날짜/시간' : '정보 입력'}
              </span>
              {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-[var(--color-primary,#cc222c)]' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: 시술 선택 */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-bold mb-4">시술을 선택해주세요</h2>

            {/* 시술 없이 바로 예약 */}
            <button
              onClick={() => { setSelectedTreatment(null); setStep(2); }}
              className="w-full p-4 mb-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-gray-400 transition"
            >
              시술 선택 없이 상담 예약하기
            </button>

            {/* 시술 목록 */}
            <div className="space-y-3">
              {treatments.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTreatment(t); setStep(2); }}
                  className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-[var(--color-primary,#cc222c)] hover:shadow-sm transition text-left"
                >
                  {t.thumbUrl ? (
                    <img src={t.thumbUrl} alt={t.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{t.title}</div>
                    {t.metaJson?.category && (
                      <span className="text-xs text-gray-400">{t.metaJson.category}</span>
                    )}
                    {t.metaJson?.price && (
                      <div className="text-sm font-bold mt-1" style={{ color: 'var(--color-primary, #cc222c)' }}>
                        {Number(t.metaJson.price).toLocaleString()}원
                      </div>
                    )}
                  </div>
                  <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: 날짜/시간 */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-bold mb-4">희망 날짜와 시간을 선택해주세요</h2>

            {selectedTreatment && (
              <div className="bg-white rounded-xl p-4 mb-4 border border-gray-200">
                <span className="text-xs text-gray-400">선택 시술</span>
                <div className="font-bold">{selectedTreatment.title}</div>
              </div>
            )}

            <div className="bg-white rounded-xl p-4 mb-4 border border-gray-200">
              <label className="block text-sm font-medium mb-2">
                날짜 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                min={today}
                value={reservedDate}
                onChange={e => setReservedDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#cc222c)]"
              />
            </div>

            <div className="bg-white rounded-xl p-4 mb-6 border border-gray-200">
              <label className="block text-sm font-medium mb-2">희망 시간</label>
              <div className="grid grid-cols-4 gap-2">
                {timeSlots.map(t => (
                  <button
                    key={t}
                    onClick={() => setReservedTime(reservedTime === t ? '' : t)}
                    className={`py-2 rounded-lg text-sm font-medium border transition ${
                      reservedTime === t
                        ? 'bg-[var(--color-primary,#cc222c)] text-white border-transparent'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">* 시간은 희망 시간이며, 확정은 연락 시 안내드립니다.</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-gray-300 font-medium">이전</button>
              <button
                onClick={() => { if (!reservedDate) { alert('날짜를 선택해주세요.'); return; } setStep(3); }}
                className="flex-1 py-3 rounded-xl text-white font-medium"
                style={{ background: 'var(--color-primary, #cc222c)' }}
              >
                다음
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 연락처 */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-bold mb-4">예약자 정보를 입력해주세요</h2>

            <div className="bg-white rounded-xl p-4 mb-4 border border-gray-200 space-y-4">
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
              <div>
                <label className="block text-sm font-medium mb-1">요청사항</label>
                <textarea
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  rows={3}
                  placeholder="기타 요청사항을 입력해주세요."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#cc222c)]"
                />
              </div>
            </div>

            {/* 예약 요약 */}
            <div className="bg-gray-100 rounded-xl p-4 mb-6 text-sm space-y-1">
              {selectedTreatment && <p><span className="text-gray-400">시술:</span> {selectedTreatment.title}</p>}
              <p><span className="text-gray-400">날짜:</span> {reservedDate}</p>
              {reservedTime && <p><span className="text-gray-400">시간:</span> {reservedTime}</p>}
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">
                {errorMsg}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl border border-gray-300 font-medium">이전</button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl text-white font-bold disabled:opacity-50"
                style={{ background: 'var(--color-primary, #cc222c)' }}
              >
                {submitting ? '접수 중...' : '예약하기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
