'use client';

import { useState, useEffect } from 'react';
import styles from './WorkDetail.module.css';

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

  useEffect(() => {
    params.then(({ slug: paramSlug, id: paramId }) => {
      setSlug(paramSlug);
      setWorkId(paramId);
    });
  }, [params]);

  useEffect(() => {
    if (!slug || !workId) return;

    async function fetchRequest() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/maintenance/${workId}?slug=${slug}`);
        if (response.ok) {
          const data = await response.json();
          setRequest(data.request);
        } else {
          setError(`Failed to load work item (${response.status})`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('Failed to fetch request:', errorMsg);
        setError(`Failed to load work item: ${errorMsg}`);
      } finally {
        setLoading(false);
      }
    }

    fetchRequest();
  }, [slug, workId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !slug || !workId) return;

    setSending(true);
    setMessageError(null);
    try {
      const response = await fetch(`/api/admin/maintenance/${workId}/messages?slug=${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: newMessage,
          senderType: 'staff',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (request) {
          setRequest({
            ...request,
            messages: [...(request.messages || []), data.message],
          });
        }
        setNewMessage('');
      } else {
        setMessageError(`Failed to send message (${response.status})`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to send message:', errorMsg);
      setMessageError(`Failed to send: ${errorMsg}`);
    } finally {
      setSending(false);
    }
  };

  if (!slug || !workId) {
    return <div>로딩 중...</div>;
  }

  if (loading) {
    return <div className={styles.loading}>로딩 중...</div>;
  }

  if (error) {
    return <div className={styles.error}>⚠️ {error}</div>;
  }

  if (!request) {
    return <div className={styles.error}>작업을 찾을 수 없습니다.</div>;
  }

  return (
    <div className={styles.workDetail}>
      <div className={styles.header}>
        <div>
          <h1>{request.title}</h1>
          <p className={styles.description}>{request.description}</p>
        </div>
        <div className={styles.headerRight}>
          <span className={`${styles.badge} ${styles[request.status]}`}>
            {request.status === 'pending' && '대기'}
            {request.status === 'reviewing' && '검토'}
            {request.status === 'working' && '진행'}
            {request.status === 'done' && '완료'}
          </span>
        </div>
      </div>

      <div className={styles.meta}>
        <div className={styles.metaItem}>
          <span className={styles.label}>분류</span>
          <span>{request.category}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.label}>우선순위</span>
          <span className={`${styles.priority} ${styles[request.priority]}`}>
            {request.priority === 'low' && '낮음'}
            {request.priority === 'normal' && '보통'}
            {request.priority === 'high' && '높음'}
            {request.priority === 'urgent' && '긴급'}
          </span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.label}>등록일</span>
          <span>{new Date(request.createdAt).toLocaleDateString('ko-KR')}</span>
        </div>
      </div>

      <div className={styles.chatSection}>
        <h2>대화</h2>
        <div className={styles.messageList}>
          {(!request.messages || request.messages.length === 0) ? (
            <div className={styles.emptyMessages}>
              <p>아직 메시지가 없습니다.</p>
            </div>
          ) : (
            request.messages.map((msg) => (
              <div
                key={msg.id}
                className={`${styles.message} ${
                  msg.senderType === 'staff' ? styles.staff : styles.customer
                }`}
              >
                <div className={styles.messageHeader}>
                  <span className={styles.senderName}>{msg.senderName}</span>
                  <span className={styles.messageTime}>
                    {new Date(msg.createdAt).toLocaleTimeString('ko-KR')}
                  </span>
                </div>
                <div className={styles.messageBody}>{msg.body}</div>
              </div>
            ))
          )}
        </div>

        <div className={styles.messageInput}>
          {messageError && (
            <div style={{ padding: '10px', color: '#cc222c', background: '#ffebee', borderRadius: '4px', fontSize: '13px' }}>
              ⚠️ {messageError}
            </div>
          )}
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="메시지를 입력하세요..."
            rows={3}
          />
          <button
            onClick={handleSendMessage}
            disabled={sending || !newMessage.trim()}
            className={styles.sendBtn}
          >
            {sending ? '전송 중...' : '전송'}
          </button>
        </div>
      </div>
    </div>
  );
}
