'use client';

import { useState, useEffect, useRef } from 'react';
import type { MaintenanceRequest, ChatMessage } from './MaintenanceWorkspace';

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: '대기', bg: 'rgba(245,166,35,0.1)', color: '#856404' },
  reviewing: { label: '검토중', bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
  working: { label: '진행중', bg: 'rgba(139,92,246,0.1)', color: '#8b5cf6' },
  done: { label: '완료', bg: 'rgba(3,178,108,0.1)', color: '#03b26c' },
  cancelled: { label: '취소', bg: '#f3f4f6', color: '#6b7280' },
};

interface Props {
  request: MaintenanceRequest | null;
  messages: ChatMessage[];
  loading: boolean;
  onSend: (body: string) => Promise<void>;
  insertText: string;
  onInsertTextConsumed: () => void;
}

export default function ChatPanel({
  request, messages, loading, onSend,
  insertText, onInsertTextConsumed,
}: Props) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (insertText) {
      setInput(prev => prev ? `${prev}\n${insertText}` : insertText);
      onInsertTextConsumed();
      textareaRef.current?.focus();
    }
  }, [insertText, onInsertTextConsumed]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    try { await onSend(text); }
    finally { setSending(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (!request) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <div style={{ textAlign: 'center', color: '#929aa6' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }}>💬</div>
          <p style={{ fontSize: '14px', fontWeight: 500 }}>진행중인 작업 채팅방이 없습니다</p>
          <p style={{ fontSize: '13px', color: '#bbc0c8', marginTop: '4px' }}>
            신청하기를 눌러 새 요청을 시작하세요.
          </p>
        </div>
      </div>
    );
  }

  const st = STATUS_LABELS[request.status] || STATUS_LABELS.pending;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      {/* 헤더 — 루딤링크 .tt-header 스타일 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '16px 20px',
        borderBottom: '1px solid #e5e7eb',
        background: '#fff',
        flexShrink: 0,
      }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1f2328', margin: 0 }}>
          {request.title}
        </h2>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          padding: '3px 10px',
          borderRadius: '6px',
          background: 'rgba(59,130,246,0.1)',
          color: '#3b82f6',
        }}>
          유지보수
        </span>
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          padding: '0 8px',
          height: '22px',
          lineHeight: '22px',
          borderRadius: '6px',
          background: st.bg,
          color: st.color,
        }}>
          {st.label}
        </span>
      </div>

      {/* 메시지 영역 — 루딤링크 .tt-msg 스타일 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#fff' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#929aa6', padding: '40px 0', fontSize: '14px' }}>
            메시지 불러오는 중...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#929aa6', padding: '40px 0' }}>
            <p style={{ fontSize: '14px', fontWeight: 500 }}>대화를 시작해보세요</p>
            <p style={{ fontSize: '13px', color: '#bbc0c8', marginTop: '4px' }}>
              메시지를 입력하면 담당자에게 전달됩니다
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.map(msg => {
              const initial = msg.senderName ? msg.senderName[0] : '?';
              const roleLabel = msg.senderType === 'staff' ? '직원' : '고객';
              const roleBg = msg.senderType === 'staff' ? '#f3f4f6' : 'rgba(204,34,44,0.08)';
              const roleColor = msg.senderType === 'staff' ? '#4b5563' : '#cc222c';

              return (
                <div key={msg.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  {/* 아바타 */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: msg.senderType === 'staff' ? '#e5e7eb' : 'rgba(204,34,44,0.1)',
                    color: msg.senderType === 'staff' ? '#4b5563' : '#cc222c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '15px',
                    flexShrink: 0,
                  }}>
                    {initial}
                  </div>
                  {/* 메시지 본문 */}
                  <div style={{
                    flex: 1,
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '14px 16px',
                  }}>
                    {/* 헤더 */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#1f2328' }}>
                        {msg.senderName}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        background: roleBg,
                        borderRadius: '4px',
                        color: roleColor,
                        fontWeight: 500,
                      }}>
                        {roleLabel}
                      </span>
                      <span style={{ fontSize: '11px', color: '#6a737d', marginLeft: 'auto' }}>
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                    {/* 콘텐츠 */}
                    <div style={{
                      fontSize: '14px',
                      lineHeight: 1.65,
                      color: '#1f2328',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {msg.body}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 입력창 — 루딤링크 .tt-composer 스타일 */}
      <div style={{
        borderTop: '1px solid #e5e7eb',
        padding: '12px 20px 16px',
        background: '#fff',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            rows={1}
            style={{
              flex: 1,
              minHeight: '40px',
              maxHeight: '120px',
              resize: 'none',
              border: '1px solid #d0d7de',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '14px',
              lineHeight: 1.6,
              outline: 'none',
              fontFamily: 'inherit',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#cc222c'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#d0d7de'; }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            style={{
              padding: '10px 20px',
              background: !input.trim() || sending ? '#e5e7eb' : '#cc222c',
              color: !input.trim() || sending ? '#999' : '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
              flexShrink: 0,
            }}
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(dt: string): string {
  try {
    const d = new Date(dt);
    return d.toLocaleString('ko-KR', {
      month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}
