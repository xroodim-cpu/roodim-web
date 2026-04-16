'use client';

import { useState, useEffect, FormEvent } from 'react';

interface BaseInfo {
  title: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  businessHours: string;
}

const EMPTY_INFO: BaseInfo = {
  title: '',
  description: '',
  phone: '',
  email: '',
  address: '',
  businessHours: '',
};

export default function SiteInfoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState<string | null>(null);
  const [info, setInfo] = useState<BaseInfo>(EMPTY_INFO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ slug: paramSlug }) => {
      setSlug(paramSlug);
    });
  }, [params]);

  useEffect(() => {
    if (!slug) return;
    loadInfo(slug);
  }, [slug]);

  async function loadInfo(siteSlug: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/settings?slug=${siteSlug}`);
      if (response.ok) {
        const data = await response.json();
        const base = (data.data?.base || {}) as Partial<BaseInfo>;
        setInfo({
          title: base.title || '',
          description: base.description || '',
          phone: base.phone || '',
          email: base.email || '',
          address: base.address || '',
          businessHours: base.businessHours || '',
        });
      } else {
        setError(`기본정보 로딩 실패 (${response.status})`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to load site info:', errorMsg);
      setError(`기본정보 로딩 실패: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!slug) return;

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          section: 'base',
          data: info,
        }),
      });

      if (response.ok) {
        setSuccessMsg('기본정보가 저장되었습니다.');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || `저장 실패 (${response.status})`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to save site info:', errorMsg);
      setError(`저장 실패: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  }

  if (!slug || loading) {
    return (
      <div className="c-empty">
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <div className="c-empty-text">로딩 중...</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="c-page-title">기본정보</h1>
        <p className="c-page-subtitle">
          사이트 제목, 연락처, 영업시간 등 공통 정보를 관리합니다.
        </p>
      </div>

      {error && (
        <div className="c-alert c-alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div className="c-alert c-alert-success" style={{ marginBottom: 16 }}>
          {successMsg}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="card"
        style={{
          border: '1px solid var(--border)',
          padding: 24,
          maxWidth: 720,
        }}
      >
        <div className="form-group">
          <label htmlFor="site-title" className="form-label">
            사이트 제목
          </label>
          <input
            id="site-title"
            type="text"
            className="form-input"
            value={info.title}
            onChange={(e) => setInfo({ ...info, title: e.target.value })}
            placeholder="예: 루딤 뷰티 살롱"
          />
        </div>

        <div className="form-group">
          <label htmlFor="site-description" className="form-label">
            사이트 소개
          </label>
          <textarea
            id="site-description"
            className="form-textarea"
            value={info.description}
            onChange={(e) =>
              setInfo({ ...info, description: e.target.value })
            }
            placeholder="사이트를 간단히 소개하는 문구를 입력하세요."
            rows={4}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          <div className="form-group">
            <label htmlFor="site-phone" className="form-label">
              전화번호
            </label>
            <input
              id="site-phone"
              type="tel"
              className="form-input"
              value={info.phone}
              onChange={(e) => setInfo({ ...info, phone: e.target.value })}
              placeholder="예: 02-1234-5678"
            />
          </div>

          <div className="form-group">
            <label htmlFor="site-email" className="form-label">
              이메일
            </label>
            <input
              id="site-email"
              type="email"
              className="form-input"
              value={info.email}
              onChange={(e) => setInfo({ ...info, email: e.target.value })}
              placeholder="예: contact@example.com"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="site-address" className="form-label">
            주소
          </label>
          <input
            id="site-address"
            type="text"
            className="form-input"
            value={info.address}
            onChange={(e) => setInfo({ ...info, address: e.target.value })}
            placeholder="예: 서울특별시 강남구 테헤란로 123"
          />
        </div>

        <div className="form-group">
          <label htmlFor="site-hours" className="form-label">
            영업시간
          </label>
          <textarea
            id="site-hours"
            className="form-textarea"
            value={info.businessHours}
            onChange={(e) =>
              setInfo({ ...info, businessHours: e.target.value })
            }
            placeholder="예: 평일 10:00 - 20:00 / 주말 11:00 - 19:00"
            rows={3}
          />
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'flex-end',
            marginTop: 16,
            paddingTop: 20,
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </div>
  );
}
