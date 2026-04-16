'use client';

import { useState, useEffect, FormEvent } from 'react';

interface SiteMenuItem {
  id: number;
  menuType: string;
  label: string;
  url: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  parentId: number | null;
}

type FormState = {
  menuType: string;
  label: string;
  url: string;
  sortOrder: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  menuType: 'menubar',
  label: '',
  url: '',
  sortOrder: '0',
  isActive: true,
};

const MENU_TYPE_LABEL: Record<string, string> = {
  menubar: '상단 메뉴',
  bottom: '하단 메뉴',
};

export default function SiteMenusPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState<string | null>(null);
  const [items, setItems] = useState<SiteMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMenuType, setActiveMenuType] = useState<string>('menubar');

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
    fetchItems(slug);
  }, [slug]);

  async function fetchItems(siteSlug: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/menus?slug=${siteSlug}`);
      if (response.ok) {
        const data = await response.json();
        setItems(data.data || []);
      } else {
        setError(`메뉴 목록 로딩 실패 (${response.status})`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to fetch menu items:', errorMsg);
      setError(`메뉴 목록 로딩 실패: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingId(null);
    const filtered = items.filter((i) => i.menuType === activeMenuType);
    setFormState({
      ...EMPTY_FORM,
      menuType: activeMenuType,
      sortOrder: String(filtered.length * 10),
    });
    setFormError(null);
    setShowModal(true);
  }

  function openEditModal(item: SiteMenuItem) {
    setEditingId(item.id);
    setFormState({
      menuType: item.menuType,
      label: item.label,
      url: item.url || '',
      sortOrder: String(item.sortOrder),
      isActive: item.isActive,
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
    if (!formState.label.trim()) {
      setFormError('라벨은 필수 입력입니다.');
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
        menuType: formState.menuType,
        label: formState.label.trim(),
        url: formState.url.trim() || null,
        sortOrder: sortOrderValue,
        isActive: formState.isActive,
      };

      let response: Response;
      if (editingId !== null) {
        payload.id = editingId;
        response = await fetch('/api/admin/menus', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch('/api/admin/menus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (response.ok) {
        await fetchItems(slug);
        closeModal();
      } else {
        const data = await response.json().catch(() => ({}));
        setFormError(data.error || `저장 실패 (${response.status})`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to save menu item:', errorMsg);
      setFormError(`저장 실패: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item: SiteMenuItem) {
    if (!slug) return;
    const ok = confirm(`"${item.label}" 메뉴를 삭제하시겠습니까?`);
    if (!ok) return;

    try {
      const response = await fetch('/api/admin/menus', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, id: item.id }),
      });
      if (response.ok) {
        await fetchItems(slug);
      } else {
        setError(`삭제 실패 (${response.status})`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to delete menu item:', errorMsg);
      setError(`삭제 실패: ${errorMsg}`);
    }
  }

  async function toggleActive(item: SiteMenuItem) {
    if (!slug) return;
    try {
      const response = await fetch('/api/admin/menus', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          id: item.id,
          isActive: !item.isActive,
        }),
      });
      if (response.ok) {
        await fetchItems(slug);
      } else {
        setError(`상태 변경 실패 (${response.status})`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to toggle menu:', errorMsg);
      setError(`상태 변경 실패: ${errorMsg}`);
    }
  }

  const filteredItems = items.filter((i) => i.menuType === activeMenuType);
  const menubarCount = items.filter((i) => i.menuType === 'menubar').length;
  const bottomCount = items.filter((i) => i.menuType === 'bottom').length;

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
          <h1 className="c-page-title">메뉴 관리</h1>
          <p className="c-page-subtitle">
            사이트의 상단·하단 메뉴 항목을 관리합니다.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateModal}
        >
          + 메뉴 추가
        </button>
      </div>

      {error && (
        <div className="c-alert c-alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* 탭 */}
      <div className="pd-filter">
        <div className="pd-filter-tabs">
          <button
            type="button"
            className={`pd-ftab${
              activeMenuType === 'menubar' ? ' active' : ''
            }`}
            onClick={() => setActiveMenuType('menubar')}
          >
            상단 메뉴
            <span className="pd-ftab-count">{menubarCount}</span>
          </button>
          <button
            type="button"
            className={`pd-ftab${
              activeMenuType === 'bottom' ? ' active' : ''
            }`}
            onClick={() => setActiveMenuType('bottom')}
          >
            하단 메뉴
            <span className="pd-ftab-count">{bottomCount}</span>
          </button>
        </div>
      </div>

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
        ) : filteredItems.length === 0 ? (
          <div className="c-empty">
            <div className="c-empty-icon">📋</div>
            <div className="c-empty-text">
              {MENU_TYPE_LABEL[activeMenuType] || activeMenuType} 메뉴가
              없습니다.
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="c-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>순서</th>
                  <th>라벨</th>
                  <th>URL</th>
                  <th>상태</th>
                  <th style={{ width: 160, textAlign: 'right' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td style={{ color: 'var(--text-tertiary)' }}>
                      {item.sortOrder}
                    </td>
                    <td style={{ fontWeight: 'var(--fw-semi)' }}>
                      {item.label}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {item.url || <span style={{ color: 'var(--text-tertiary)' }}>-</span>}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`c-badge ${
                          item.isActive ? 'c-badge-success' : 'c-badge-error'
                        }`}
                        onClick={() => toggleActive(item)}
                        style={{
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 'var(--fw-semi)',
                        }}
                      >
                        {item.isActive ? '활성' : '비활성'}
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
                          onClick={() => openEditModal(item)}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(item)}
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
                {editingId !== null ? '메뉴 수정' : '메뉴 추가'}
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
                <label htmlFor="menu-type" className="form-label">
                  메뉴 유형
                </label>
                <select
                  id="menu-type"
                  className="form-select"
                  value={formState.menuType}
                  onChange={(e) =>
                    setFormState({ ...formState, menuType: e.target.value })
                  }
                >
                  <option value="menubar">상단 메뉴</option>
                  <option value="bottom">하단 메뉴</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="menu-label" className="form-label">
                  라벨 *
                </label>
                <input
                  id="menu-label"
                  type="text"
                  className="form-input"
                  value={formState.label}
                  onChange={(e) =>
                    setFormState({ ...formState, label: e.target.value })
                  }
                  placeholder="예: 홈, 시술, 후기"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="menu-url" className="form-label">
                  URL
                </label>
                <input
                  id="menu-url"
                  type="text"
                  className="form-input"
                  value={formState.url}
                  onChange={(e) =>
                    setFormState({ ...formState, url: e.target.value })
                  }
                  placeholder="예: /about, /services, https://..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="menu-sort" className="form-label">
                  정렬 순서
                </label>
                <input
                  id="menu-sort"
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
