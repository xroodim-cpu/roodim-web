'use client';

import { useState, useEffect, FormEvent } from 'react';
import styles from './Services.module.css';

interface Service {
  id: number;
  name: string;
  description: string | null;
  price: number | null;
  category: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

type FormState = {
  name: string;
  description: string;
  price: string;
  category: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  price: '',
  category: '',
  isActive: true,
};

export default function ServicesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
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
    fetchServices(slug);
  }, [slug]);

  async function fetchServices(siteSlug: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/services?slug=${siteSlug}`);
      if (response.ok) {
        const data = await response.json();
        setServices(data.services || []);
      } else {
        setError(`시술 목록을 불러올 수 없습니다 (${response.status})`);
        setServices([]);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to fetch services:', errorMsg);
      setError(`시술 목록 로딩 실패: ${errorMsg}`);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingId(null);
    setFormState(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  }

  function openEditModal(service: Service) {
    setEditingId(service.id);
    setFormState({
      name: service.name,
      description: service.description || '',
      price: service.price !== null ? String(service.price) : '',
      category: service.category || '',
      isActive: service.isActive,
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
    if (!formState.name.trim()) {
      setFormError('시술명은 필수 입력입니다.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const priceValue = formState.price.trim() === '' ? null : Number(formState.price);
      if (priceValue !== null && Number.isNaN(priceValue)) {
        setFormError('가격은 숫자로 입력해주세요.');
        setSubmitting(false);
        return;
      }

      const payload = {
        slug,
        name: formState.name.trim(),
        description: formState.description.trim() || null,
        price: priceValue,
        category: formState.category.trim() || null,
        isActive: formState.isActive,
      };

      let response: Response;
      if (editingId !== null) {
        response = await fetch(`/api/admin/services/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch('/api/admin/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (response.ok) {
        await fetchServices(slug);
        closeModal();
      } else {
        const data = await response.json().catch(() => ({}));
        setFormError(
          data.error || `저장 실패 (${response.status})`
        );
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to save service:', errorMsg);
      setFormError(`저장 실패: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(service: Service) {
    if (!slug) return;
    const ok = confirm(`"${service.name}" 시술을 삭제하시겠습니까?`);
    if (!ok) return;

    try {
      const response = await fetch(
        `/api/admin/services/${service.id}?slug=${slug}`,
        { method: 'DELETE' }
      );
      if (response.ok) {
        await fetchServices(slug);
      } else {
        setError(`삭제 실패 (${response.status})`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to delete service:', errorMsg);
      setError(`삭제 실패: ${errorMsg}`);
    }
  }

  async function toggleActive(service: Service) {
    if (!slug) return;
    try {
      const response = await fetch(`/api/admin/services/${service.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          isActive: !service.isActive,
        }),
      });
      if (response.ok) {
        await fetchServices(slug);
      } else {
        setError(`상태 변경 실패 (${response.status})`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to toggle service:', errorMsg);
      setError(`상태 변경 실패: ${errorMsg}`);
    }
  }

  if (!slug) {
    return <div className={styles.loading}>로딩 중...</div>;
  }

  return (
    <div className={styles.servicesPage}>
      <div className={styles.header}>
        <h1>시술 관리</h1>
        <button className={styles.addBtn} onClick={openCreateModal}>
          + 시술 추가
        </button>
      </div>

      {error && <div className={styles.error}>⚠️ {error}</div>}

      {loading ? (
        <div className={styles.loading}>로딩 중...</div>
      ) : services.length === 0 ? (
        <div className={styles.emptyState}>
          <p>등록된 시술이 없습니다. &quot;+ 시술 추가&quot; 버튼을 눌러 추가해보세요.</p>
        </div>
      ) : (
        <div className={styles.servicesTable}>
          <div className={styles.tableWrapper}>
            <table>
              <thead>
                <tr>
                  <th>시술명</th>
                  <th>분류</th>
                  <th>가격</th>
                  <th>설명</th>
                  <th>상태</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service.id}>
                    <td className={styles.serviceName}>{service.name}</td>
                    <td>
                      {service.category ? (
                        <span className={styles.category}>{service.category}</span>
                      ) : (
                        <span style={{ color: '#999' }}>-</span>
                      )}
                    </td>
                    <td className={styles.price}>
                      {service.price !== null
                        ? `${service.price.toLocaleString('ko-KR')}원`
                        : '-'}
                    </td>
                    <td style={{ maxWidth: '300px', color: '#666' }}>
                      {service.description || <span style={{ color: '#999' }}>-</span>}
                    </td>
                    <td>
                      <button
                        className={`${styles.badge} ${
                          service.isActive ? styles.badgeActive : styles.badgeInactive
                        }`}
                        onClick={() => toggleActive(service)}
                        style={{ border: 'none', cursor: 'pointer' }}
                      >
                        {service.isActive ? '활성' : '비활성'}
                      </button>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          className={styles.editBtn}
                          onClick={() => openEditModal(service)}
                        >
                          수정
                        </button>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDelete(service)}
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
        </div>
      )}

      {showModal && (
        <div
          className={styles.modal}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>{editingId !== null ? '시술 수정' : '시술 추가'}</h2>
            </div>

            <form onSubmit={handleSubmit}>
              {formError && <div className={styles.error}>⚠️ {formError}</div>}

              <div className={styles.formGroup}>
                <label htmlFor="service-name">시술명 *</label>
                <input
                  id="service-name"
                  type="text"
                  value={formState.name}
                  onChange={(e) =>
                    setFormState({ ...formState, name: e.target.value })
                  }
                  placeholder="예: 디자인 머리 시술"
                  required
                  autoFocus
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="service-category">분류</label>
                <input
                  id="service-category"
                  type="text"
                  value={formState.category}
                  onChange={(e) =>
                    setFormState({ ...formState, category: e.target.value })
                  }
                  placeholder="예: 커트, 파마, 염색"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="service-price">가격 (원)</label>
                <input
                  id="service-price"
                  type="number"
                  min="0"
                  step="1000"
                  value={formState.price}
                  onChange={(e) =>
                    setFormState({ ...formState, price: e.target.value })
                  }
                  placeholder="예: 50000"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="service-description">설명</label>
                <textarea
                  id="service-description"
                  value={formState.description}
                  onChange={(e) =>
                    setFormState({ ...formState, description: e.target.value })
                  }
                  placeholder="시술 설명을 입력하세요..."
                  rows={4}
                />
              </div>

              <div className={styles.formGroup}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formState.isActive}
                    onChange={(e) =>
                      setFormState({ ...formState, isActive: e.target.checked })
                    }
                    style={{ width: 'auto', margin: 0 }}
                  />
                  활성 상태 (고객에게 노출)
                </label>
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={closeModal}
                  disabled={submitting}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={submitting}
                >
                  {submitting ? '저장 중...' : editingId !== null ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
