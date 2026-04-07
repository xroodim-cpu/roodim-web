'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function SsoPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setError('SSO 토큰이 없습니다.');
      setLoading(false);
      return;
    }

    // SSO 토큰 검증 API 호출
    fetch('/api/auth/sso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          // 세션 쿠키는 API에서 설정됨 → 어드민 대시보드로 이동
          router.replace(`/admin/${data.slug}`);
        } else {
          setError(data.error || 'SSO 인증에 실패했습니다.');
          setLoading(false);
        }
      })
      .catch(() => {
        setError('네트워크 오류가 발생했습니다.');
        setLoading(false);
      });
  }, [searchParams, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">인증 중입니다...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">인증 실패</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <p className="text-sm text-gray-400">루딤 어드민에서 다시 시도해주세요.</p>
        </div>
      </div>
    );
  }

  return null;
}
