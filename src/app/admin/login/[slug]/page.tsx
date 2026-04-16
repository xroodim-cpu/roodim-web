'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function SiteLoginPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/site-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '로그인에 실패했습니다');
        return;
      }

      router.push(`/admin/${slug}/dashboard`);
    } catch {
      setError('네트워크 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-secondary, #f5f5f7)',
        padding: '16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div
          style={{
            background: 'var(--bg-primary, #fff)',
            borderRadius: 'var(--radius-lg, 12px)',
            border: '1px solid var(--border, #e5e5e5)',
            padding: 32,
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div
              style={{
                width: 48,
                height: 48,
                background: 'var(--accent, #cc222c)',
                borderRadius: 'var(--radius-md, 8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: '#fff',
                fontWeight: 700,
                fontSize: 20,
              }}
            >
              R
            </div>
            <h1
              style={{
                fontSize: 'var(--fs-xl, 20px)',
                fontWeight: 'var(--fw-bold, 700)',
                color: 'var(--text-primary, #1a1a1a)',
                margin: 0,
              }}
            >
              사이트 관리자
            </h1>
            <p
              style={{
                fontSize: 'var(--fs-sm, 13px)',
                color: 'var(--text-tertiary, #999)',
                marginTop: 4,
              }}
            >
              {slug}
            </p>
          </div>

          {error && (
            <div
              className="c-alert c-alert-error"
              style={{ marginBottom: 16, fontSize: 'var(--fs-sm, 13px)' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                이메일
              </label>
              <input
                id="email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: 8 }}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>

        <p
          style={{
            textAlign: 'center',
            fontSize: 'var(--fs-xs, 11px)',
            color: 'var(--text-tertiary, #999)',
            marginTop: 24,
          }}
        >
          루딤웹 사이트 관리 시스템
        </p>
      </div>
    </div>
  );
}
