'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface Message {
  id: number;
  senderType: string;
  senderName: string;
  body: string;
  createdAt: string;
}

interface WorkRequest {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  messages?: Message[];
}

const STATUS_LABEL: Record<string, string> = {
  pending: '대기',
  reviewing: '검토',
  working: '진행',
  done: '완료',
  cancelled: '취소',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'c-badge-warning',
  reviewing: 'c-badge-purple',
  working: 'c-badge-info',
  done: 'c-badge-success',
  cancelled: 'c-badge-gray',
};

const PRIORITY_LABEL: Record<string, string> = {
  low: '낮음',
  normal: '보통',
  high: '높음',
  urgent: '긴급',
};

const PRIORITY_BADGE: Record<string, string> = {
  low: 'c-badge-gray',
  normal: 'c-badge-gray',
  high: 'c-badge-warning',
  urgent: 'c-badge-error',
};

const STATUS_FLOW: Array<{ key: string; label: string }> = [
  { key: 'pending', label: '대기' },
  { key: 'reviewing', label: '검토' },
  { key: 'working', label: '진행' },
  { key: 'done', label: '완료' },
];

// 폴링 주기 (ms). 2초 = 거의 실시간
const POLL_INTERVAL_MS = 2000;

export default function WorkDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const [slug, setSlug] = useState<string | null>(null);
  const [workId, setWorkId] = useState<string | null>(null);
  const [request, setRequest] = useState<WorkRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // 폴링 커서 — 마지막으로 받은 메시지 시간 (ISO)
  const lastMessageTsRef = useRef<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    params.then(({ slug: paramSlug, id: paramId }) => {
      setSlug(paramSlug);
      setWorkId(paramId);
    });
  }, [params]);

  // 초기 로딩
  useEffect(() => {
    if (!slug || !workId) return;

    let cancelled = false;

    async function fetchRequest() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/admin/maintenance/${workId}?slug=${slug}`
        );
        if (!response.ok) {
          if (!cancelled) {
            setError(`작업을 불러올 수 없습니다 (${response.status})`);
          }
          return;
        }
        const data = await response.json();
        if (cancelled) return;

        setRequest(data.request);
        // 마지막 메시지 타임스탬프 저장
        const msgs = data.request?.messages || [];
        if (msgs.length > 0) {
          lastMessageTsRef.current = msgs[msgs.length - 1].createdAt;
        } else {
          // 메시지가 없으면 요청 생성 시점 기준으로 폴링 시작
          lastMessageTsRef.current = data.request?.createdAt || null;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('Failed to fetch request:', errorMsg);
        if (!cancelled) {
          setError(`작업 로딩 실패: ${errorMsg}`);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchRequest();

    return () => {
      cancelled = true;
    };
  }, [slug, workId]);

  // 새 메시지 증분 폴링
  const pollMessages = useCallback(async () => {
    if (!slug || !workId) return;
    const since = lastMessageTsRef.current;
    const url = new URL(
      `/api/admin/maintenance/${workId}/messages`,
      window.location.origin
    );
    url.searchParams.set('slug', slug);
    if (since) url.searchParams.set('since', since);

    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        setIsLive(false);
        return;
      }
      const data = await res.json();
      setIsLive(true);
      const newMsgs: Message[] = data.messages || [];
      if (newMsgs.length === 0) return;

      // 중복 제거 후 병합
      setRequest((prev) => {
        if (!prev) return prev;
        const existingIds = new Set((prev.messages || []).map((m) => m.id));
        const uniqueNew = newMsgs.filter((m) => !existingIds.has(m.id));
        if (uniqueNew.length === 0) return prev;
        lastMessageTsRef.current = uniqueNew[uniqueNew.length - 1].createdAt;
        return {
          ...prev,
          messages: [...(prev.messages || []), ...uniqueNew],
        };
      });
    } catch (err) {
      console.error('[poll] failed', err);
      setIsLive(false);
    }
  }, [slug, workId]);

  // 폴링 인터벌 + visibility 기반 pause
  useEffect(() => {
    if (!slug || !workId || loading || !request) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer !== null) return;
      timer = setInterval(() => {
        pollMessages();
      }, POLL_INTERVAL_MS);
    };

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // 포커스 복귀 시 즉시 1회 + 폴링 재개
        pollMessages();
        start();
      } else {
        stop();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    if (document.visibilityState === 'visible') {
      start();
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stop();
    };
  }, [slug, workId, loading, request, pollMessages]);

  // 새 메시지 추가 시 스크롤 맨 아래로
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [request?.messages?.length]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !slug || !workId) return;

    setSending(true);
    setMessageError(null);
    try {
      const response = await fetch(
        `/api/admin/maintenance/${workId}/messages?slug=${slug}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body: newMessage,
            senderType: 'staff',
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const msg: Message = data.message;
        setRequest((prev) => {
          if (!prev) return prev;
          const existingIds = new Set((prev.messages || []).map((m) => m.id));
          if (existingIds.has(msg.id)) return prev;
          lastMessageTsRef.current = msg.createdAt;
          return {
            ...prev,
            messages: [...(prev.messages || []), msg],
          };
        });
        setNewMessage('');
      } else {
        setMessageError(`메시지 전송 실패 (${response.status})`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to send message:', errorMsg);
      setMessageError(`전송 실패: ${errorMsg}`);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStatusChange = async (nextStatus: string) => {
    if (!slug || !workId || !request || statusBusy) return;
    if (request.status === nextStatus) return;
    setStatusBusy(true);
    try {
      const response = await fetch(`/api/admin/maintenance/${workId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, status: nextStatus }),
      });
      if (response.ok) {
        const data = await response.json();
        setRequest((prev) =>
          prev ? { ...prev, status: data.request.status } : prev
        );
      } else {
        setMessageError(`상태 변경 실패 (${response.status})`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to update status:', errorMsg);
      setMessageError(`상태 변경 실패: ${errorMsg}`);
    } finally {
      setStatusBusy(false);
    }
  };

  if (!slug || !workId) {
    return (
      <div className="c-empty">
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <div className="c-empty-text">로딩 중...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="c-empty">
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <div className="c-empty-text">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return <div className="c-alert c-alert-error">{error}</div>;
  }

  if (!request) {
    return <div className="c-alert c-alert-error">작업을 찾을 수 없습니다.</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link
          href={`/admin/${slug}/work`}
          className="btn btn-ghost btn-sm"
          style={{ paddingLeft: 0 }}
        >
          ← 목록으로
        </Link>
      </div>

      {/* 헤더 */}
      <div
        className="card"
        style={{
          border: '1px solid var(--border)',
          padding: 24,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="c-page-title">{request.title}</h1>
            {request.description && (
              <p
                className="c-page-subtitle"
                style={{
                  marginTop: 8,
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text-secondary)',
                }}
              >
                {request.description}
              </p>
            )}
          </div>
          <span
            className={`c-badge ${
              STATUS_BADGE[request.status] || 'c-badge-gray'
            }`}
          >
            {STATUS_LABEL[request.status] || request.status}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 16,
            paddingTop: 16,
            borderTop: '1px solid var(--border-light)',
          }}
        >
          <div>
            <div className="detail-label">분류</div>
            <div className="detail-value">{request.category || '—'}</div>
          </div>
          <div>
            <div className="detail-label">우선순위</div>
            <div style={{ marginTop: 4 }}>
              <span
                className={`c-badge ${
                  PRIORITY_BADGE[request.priority] || 'c-badge-gray'
                }`}
              >
                {PRIORITY_LABEL[request.priority] || request.priority}
              </span>
            </div>
          </div>
          <div>
            <div className="detail-label">등록일</div>
            <div className="detail-value">
              {new Date(request.createdAt).toLocaleDateString('ko-KR')}
            </div>
          </div>
        </div>

        {/* 상태 변경 버튼 */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 16,
            paddingTop: 16,
            borderTop: '1px solid var(--border-light)',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: 'var(--fs-sm)',
              color: 'var(--text-secondary)',
              fontWeight: 'var(--fw-semi)',
              marginRight: 4,
            }}
          >
            상태 변경:
          </span>
          {STATUS_FLOW.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`btn btn-sm ${
                request.status === s.key ? 'btn-primary' : 'btn-secondary'
              }`}
              onClick={() => handleStatusChange(s.key)}
              disabled={statusBusy || request.status === s.key}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 채팅 */}
      <div
        className="card"
        style={{
          border: '1px solid var(--border)',
          padding: 24,
        }}
      >
        <div className="card-header">
          <div>
            <div className="card-title">대화</div>
            <div className="card-subtitle">
              고객과 메시지를 주고받으세요.
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 'var(--fs-xs)',
                  color: isLive ? 'var(--success)' : 'var(--text-tertiary)',
                  fontWeight: 'var(--fw-semi)',
                }}
              >
                {isLive ? '● 실시간' : '○ 연결 중'}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            minHeight: 200,
            maxHeight: 500,
            overflowY: 'auto',
            padding: '12px 0',
          }}
        >
          {!request.messages || request.messages.length === 0 ? (
            <div className="c-empty">
              <div className="c-empty-icon">💬</div>
              <div className="c-empty-text">아직 메시지가 없습니다.</div>
            </div>
          ) : (
            request.messages.map((msg) => {
              const isStaff = msg.senderType === 'staff';
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: isStaff ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '70%',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-lg)',
                      background: isStaff
                        ? 'var(--accent-bg)'
                        : 'var(--bg-tertiary)',
                      border: `1px solid ${
                        isStaff ? 'var(--accent-light)' : 'var(--border-light)'
                      }`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        marginBottom: 4,
                        fontSize: 'var(--fs-xs)',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      <span style={{ fontWeight: 'var(--fw-semi)' }}>
                        {msg.senderName}
                      </span>
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString('ko-KR')}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--fs-base)',
                        color: 'var(--text-primary)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.body}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messageEndRef} />
        </div>

        <div
          style={{
            paddingTop: 16,
            borderTop: '1px solid var(--border-light)',
          }}
        >
          {messageError && (
            <div
              className="c-alert c-alert-error"
              style={{ marginBottom: 12 }}
            >
              {messageError}
            </div>
          )}
          <textarea
            className="form-textarea"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요... (Enter 전송, Shift+Enter 줄바꿈)"
            rows={3}
            style={{ marginBottom: 12 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSendMessage}
              disabled={sending || !newMessage.trim()}
            >
              {sending ? '전송 중...' : '전송'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
