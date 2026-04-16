'use client';

import { useState, useEffect, FormEvent } from 'react';

interface SiteSection {
  id: number;
  sectionKey: string;
  sortOrder: number;
  isActive: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

type FormState = {
  sectionKey: string;
  sortOrder: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  sectionKey: '',
  sortOrder: '0',
  isActive: true,
};

// 널리 쓰이는 섹션 키 preset
const SECTION_KEY_PRESETS = [
  { value: 'hero', label: 'hero (메인 배너)' },
  { value: 'about', label: 'about (소개)' },
  { value: 'services', label: 'services (시술/상품)' },
  { value: 'gallery', label: 'gallery (갤러리)' },
  { value: 'reviews', label: 'reviews (후기)' },
  { value: 'contact', label: 'contact (연락처/지도)' },
  { value: 'footer', label: 'footer (푸터)' },
];

export default function SiteSectionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState<string | null>(null);
  const [sections, setSections] = useState<SiteSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formState, setFormState] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ slug: paramSlug }) => {
      setSlug(paramSlug);
    });
  }, [params]);

  useEffect(() => {
    if (!slug) return;
    fetchSections(slug);
  }, [slug]);

  async function fetchSections(siteSlug: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/sections?slug=${siteSlug}`);
      if (response.ok) {
        const data = await response.json();
        setSections(data.data || []);
      } else {
        setError(`섹션 목록 로딩 실패 (${response.status})`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to fetch sections:', errorMsg);
      setError(`섹션 목록 로딩 실패: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingId(null);
    setFormState({
      ...EMPTY_FORM,
      sortOrder: String(sections.length * 10),
    });
    setFormError(null);
    setShowModal(true);
  }

  function openEditModal(section: SiteSection) {
    setEditingId(section.id);
    setFormState({
      sectionKey: section.sectionKey,
      sortOrder: String(section.sortOrder),
      isActive: section.isActive,
    });
    setFormError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setFormState(EMPTY_FORM);
    setFormError(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!slug) return;
    if (!formState.sectionKey.trim()) {
      setFormError('섹션 키는 필수 입력입니다.');
      return;
    }

    const sortOrderValue = Number(formState.sortOrder);
    if (Number.isNaN(sortOrderValue)) {
      setFormError('정렬 순서는 숫자로 입력해주세요.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const payload: Record<string, unknown> = {
        slug,
        sectionKey: formState.sectionKey.trim(),
        sortOrder: sortOrderValue,
        isActive: formState.isActive,
      };

      let response: Response;
      if (editingId !== null) {
        payload.id = editingId;
        response = await fetch('/api/admin/sections', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch('/api/admin/sections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (response.ok) {
        await fetchSections(slug);
        closeModal();
      } else {
        const data = await response.json().catch(() => ({}));
        setFormError(data.error || `저장 실패 (${response.status})`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to save section:', errorMsg);
      setFormError(`저장 실패: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(section: SiteSection) {
    if (!slug) return;
    const ok = confirm(`"${section.sectionKey}" 섹션을 삭제하시겠습니까?`);
    if (!ok) return;

    try {
      const response = await fetch('/api/admin/sections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, id: section.id }),
      });
      if (response.ok) {
        await fetchSections(slug);
      } else {
        setError(`삭제 실패 (${response.status})`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to delete section:', errorMsg);
      setError(`삭제 실패: ${errorMsg}`);
    }
  }

  async function toggleActive(section: SiteSection) {
    if (!slug) return;
    try {
      const response = await fetch('/api/admin/sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          id: section.id,
          isActive: !section.isActive,
        }),
      });
      if (response.ok) {
        await fetchSections(slug);
      } else {
        setError(`상태 변경 실패 (${response.status})`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to toggle section:', errorMsg);
      setError(`상태 변경 실패: ${errorMsg}`);
    }
  }

  if (!slug) {
    return (
      <div className="c-empty">
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <div className="c-empty-text">로딩 중...</div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div>
          <h1 className="c-page-title">섹션 관리</h1>
          <p className="c-page-subtitle">
            홈페이지에 표시되는 섹션을 추가·정렬·활성화합니다.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateModal}
        >
          + 섹션 추가
        </button>
      </div>

      {error && (
        <div className="c-alert c-alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div
        className="card"
        style={{
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div className="c-empty">
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <div className="c-empty-text">로딩 중...</div>
          </div>
        ) : sections.length === 0 ? (
          <div className="c-empty">
            <div className="c-empty-icon">🧩</div>
            <div className="c-empty-text">
              등록된 섹션이 없습니다. &quot;+ 섹션 추가&quot; 버튼을 눌러
              추가해보세요.
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="c-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>순서</th>
                  <th>섹션 키</th>
                  <th>상태</th>
                  <th style={{ width: 160, textAlign: 'right' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => (
                  <tr key={section.id}>
                    <td style={{ color: 'var(--text-tertiary)' }}>
                      {section.sortOrder}
                    </td>
                    <td style={{ fontWeight: 'var(--fw-semi)' }}>
                      {section.sectionKey}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`c-badge ${
                          section.isActive
                            ? 'c-badge-success'
                            : 'c-badge-error'
                        }`}
                        onClick={() => toggleActive(section)}
                        style={{
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 'var(--fw-semi)',
                        }}
                      >
                        {section.isActive ? '활성' : '비활성'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          gap: 6,
                          justifyContent: 'flex-end',
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEditModal(section)}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(section)}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="slide-panel open">
          <div className="slide-panel-overlay" onClick={closeModal} />
          <div className="slide-panel-content">
            <div className="slide-panel-header">
              <div className="slide-panel-title">
                {editingId !== null ? '섹션 수정' : '섹션 추가'}
              </div>
              <button
                type="button"
                className="slide-panel-close btn-icon"
                onClick={closeModal}
                aria-label="닫기"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="slide-panel-body">
              {formError && (
                <div
                  className="c-alert c-alert-error"
                  style={{ marginBottom: 16 }}
                >
                  {formError}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="section-key" className="form-label">
                  섹션 키 *
                </label>
                <input
                  id="section-key"
                  list="section-key-list"
                  type="text"
                  className="form-input"
                  value={formState.sectionKey}
                  onChange={(e) =>
                    setFormState({ ...formState, sectionKey: e.target.value })
                  }
                  placeholder="예: hero, about, services"
                  required
                  autoFocus
                />
                <datalist id="section-key-list">
                  {SECTION_KEY_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="form-group">
                <label htmlFor="section-sort" className="form-label">
                  정렬 순서 (숫자가 작을수록 위)
                </label>
                <input
                  id="section-sort"
                  type="number"
                  className="form-input"
                  value={formState.sortOrder}
                  onChange={(e) =>
                    setFormState({ ...formState, sortOrder: e.target.value })
                  }
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 'var(--fw-semi)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formState.isActive}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        isActive: e.target.checked,
                      })
                    }
                    style={{ width: 'auto', margin: 0 }}
                  />
                  활성 상태 (사이트에 노출)
                </label>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  justifyContent: 'flex-end',
                  marginTop: 24,
                  paddingTop: 20,
                  borderTop: '1px solid var(--border)',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting
                    ? '저장 중...'
                    : editingId !== null
                      ? '수정'
                      : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
