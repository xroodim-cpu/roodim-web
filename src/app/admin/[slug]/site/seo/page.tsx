'use client';

import { useState, useEffect, FormEvent, useRef } from 'react';

interface SeoData {
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  og_title: string;
  og_description: string;
  og_image: string;
  favicon_url: string;
  sns_share_image: string;
}

const EMPTY_SEO: SeoData = {
  meta_title: '',
  meta_description: '',
  meta_keywords: '',
  og_title: '',
  og_description: '',
  og_image: '',
  favicon_url: '',
  sns_share_image: '',
};

export default function SeoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState<string | null>(null);
  const [seo, setSeo] = useState<SeoData>(EMPTY_SEO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ slug: paramSlug }) => setSlug(paramSlug));
  }, [params]);

  useEffect(() => {
    if (!slug) return;
    loadSeo(slug);
  }, [slug]);

  async function loadSeo(siteSlug: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/settings?slug=${siteSlug}`);
      if (response.ok) {
        const data = await response.json();
        const saved = (data.data?.seo || {}) as Partial<SeoData>;
        setSeo({
          meta_title: saved.meta_title || '',
          meta_description: saved.meta_description || '',
          meta_keywords: saved.meta_keywords || '',
          og_title: saved.og_title || '',
          og_description: saved.og_description || '',
          og_image: saved.og_image || '',
          favicon_url: saved.favicon_url || '',
          sns_share_image: saved.sns_share_image || '',
        });
      } else {
        setError(`SEO 설정 로딩 실패 (${response.status})`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`SEO 설정 로딩 실패: ${msg}`);
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
        body: JSON.stringify({ slug, section: 'seo', data: seo }),
      });

      if (response.ok) {
        setSuccessMsg('SEO 설정이 저장되었습니다.');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || `저장 실패 (${response.status})`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`저장 실패: ${msg}`);
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
        <h1 className="c-page-title">SEO / 마케팅</h1>
        <p className="c-page-subtitle">
          검색엔진 최적화 및 SNS 공유 설정을 관리합니다. 설정된 값은 스킨에서
          치환코드로 사용할 수 있습니다.
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
        style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        {/* 기본 메타 태그 */}
        <div
          className="card"
          style={{ border: '1px solid var(--border)', padding: 24 }}
        >
          <h2
            style={{
              fontSize: 'var(--fs-lg)',
              fontWeight: 'var(--fw-bold)',
              color: 'var(--text-primary)',
              margin: '0 0 16px',
            }}
          >
            기본 메타 태그
          </h2>
          <p
            style={{
              fontSize: 'var(--fs-xs)',
              color: 'var(--text-tertiary)',
              marginBottom: 20,
            }}
          >
            치환코드: {'{{META_TITLE}}'}, {'{{META_DESC}}'}, {'{{META_KEYWORDS}}'}
          </p>

          <div className="form-group">
            <label htmlFor="meta-title" className="form-label">
              메타 타이틀
            </label>
            <input
              id="meta-title"
              type="text"
              className="form-input"
              value={seo.meta_title}
              onChange={(e) => setSeo({ ...seo, meta_title: e.target.value })}
              placeholder="페이지 제목 (검색결과에 표시)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="meta-desc" className="form-label">
              메타 설명
            </label>
            <textarea
              id="meta-desc"
              className="form-textarea"
              value={seo.meta_description}
              onChange={(e) =>
                setSeo({ ...seo, meta_description: e.target.value })
              }
              placeholder="사이트 설명 (검색결과 하단에 표시, 150자 이내 권장)"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="meta-keywords" className="form-label">
              메타 키워드
            </label>
            <input
              id="meta-keywords"
              type="text"
              className="form-input"
              value={seo.meta_keywords}
              onChange={(e) =>
                setSeo({ ...seo, meta_keywords: e.target.value })
              }
              placeholder="키워드1, 키워드2, 키워드3 (쉼표로 구분)"
            />
          </div>
        </div>

        {/* SNS 공유 (Open Graph) */}
        <div
          className="card"
          style={{ border: '1px solid var(--border)', padding: 24 }}
        >
          <h2
            style={{
              fontSize: 'var(--fs-lg)',
              fontWeight: 'var(--fw-bold)',
              color: 'var(--text-primary)',
              margin: '0 0 16px',
            }}
          >
            SNS 공유 설정 (Open Graph)
          </h2>
          <p
            style={{
              fontSize: 'var(--fs-xs)',
              color: 'var(--text-tertiary)',
              marginBottom: 20,
            }}
          >
            치환코드: {'{{OG_TITLE}}'}, {'{{OG_DESC}}'}, {'{{OG_IMAGE}}'},{' '}
            {'{{SNS_SHARE_IMAGE}}'}
          </p>

          <div className="form-group">
            <label htmlFor="og-title" className="form-label">
              OG 타이틀
            </label>
            <input
              id="og-title"
              type="text"
              className="form-input"
              value={seo.og_title}
              onChange={(e) => setSeo({ ...seo, og_title: e.target.value })}
              placeholder="비워두면 메타 타이틀을 사용합니다"
            />
          </div>

          <div className="form-group">
            <label htmlFor="og-desc" className="form-label">
              OG 설명
            </label>
            <textarea
              id="og-desc"
              className="form-textarea"
              value={seo.og_description}
              onChange={(e) =>
                setSeo({ ...seo, og_description: e.target.value })
              }
              placeholder="비워두면 메타 설명을 사용합니다"
              rows={2}
            />
          </div>

          <ImageUploadField
            label="OG 이미지 (SNS 공유 이미지)"
            value={seo.og_image}
            slug={slug}
            onChange={(url) => setSeo({ ...seo, og_image: url })}
            hint="권장: 1200×630px, 5MB 이하"
          />

          <ImageUploadField
            label="SNS 공유 이미지 (별도 설정)"
            value={seo.sns_share_image}
            slug={slug}
            onChange={(url) => setSeo({ ...seo, sns_share_image: url })}
            hint="비워두면 OG 이미지를 사용합니다"
          />
        </div>

        {/* 파비콘 */}
        <div
          className="card"
          style={{ border: '1px solid var(--border)', padding: 24 }}
        >
          <h2
            style={{
              fontSize: 'var(--fs-lg)',
              fontWeight: 'var(--fw-bold)',
              color: 'var(--text-primary)',
              margin: '0 0 16px',
            }}
          >
            파비콘
          </h2>
          <p
            style={{
              fontSize: 'var(--fs-xs)',
              color: 'var(--text-tertiary)',
              marginBottom: 20,
            }}
          >
            치환코드: {'{{FAVICON_URL}}'}
          </p>

          <ImageUploadField
            label="파비콘 이미지"
            value={seo.favicon_url}
            slug={slug}
            onChange={(url) => setSeo({ ...seo, favicon_url: url })}
            hint="권장: 32×32px 또는 64×64px, PNG/ICO 형식"
            small
          />
        </div>

        {/* 저장 */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'flex-end',
            paddingTop: 8,
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

/* ── 이미지 업로드 필드 컴포넌트 ── */

function ImageUploadField({
  label,
  value,
  slug,
  onChange,
  hint,
  small,
}: {
  label: string;
  value: string;
  slug: string;
  onChange: (url: string) => void;
  hint?: string;
  small?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 유효성 검사
    if (!file.type.startsWith('image/')) {
      setUploadError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('slug', slug);

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        onChange(data.url);
      } else {
        setUploadError(data.error || '업로드 실패');
      }
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : '업로드 중 오류 발생'
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const previewSize = small ? 48 : 120;

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {hint && (
        <p
          style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--text-tertiary)',
            margin: '-4px 0 8px',
          }}
        >
          {hint}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        {/* 미리보기 */}
        <div
          style={{
            width: previewSize,
            height: previewSize,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {value ? (
            <img
              src={value}
              alt="미리보기"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <span
              style={{
                fontSize: small ? 'var(--fs-xs)' : 'var(--fs-sm)',
                color: 'var(--text-tertiary)',
              }}
            >
              없음
            </span>
          )}
        </div>

        {/* 입력 + 업로드 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="text"
            className="form-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="이미지 URL을 입력하거나 파일을 업로드하세요"
            style={{ fontSize: 'var(--fs-xs)' }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? '업로드 중...' : '파일 선택'}
            </button>
            {value && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onChange('')}
                style={{ color: 'var(--text-tertiary)' }}
              >
                제거
              </button>
            )}
          </div>
          {uploadError && (
            <span
              style={{
                fontSize: 'var(--fs-xs)',
                color: 'var(--status-error-text)',
              }}
            >
              {uploadError}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
