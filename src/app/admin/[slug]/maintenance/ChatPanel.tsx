'use client';

import { useState, useEffect, useRef } from 'react';
import type { MaintenanceRequest, ChatMessage } from './MaintenanceWorkspace';

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: '대기', cls: 'bg-yellow-100 text-yellow-700' },
  reviewing: { label: '검토중', cls: 'bg-blue-100 text-blue-700' },
  working: { label: '진행중', cls: 'bg-purple-100 text-purple-700' },
  done: { label: '완료', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: '취소', cls: 'bg-gray-100 text-gray-600' },
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

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 가격표 클릭 텍스트 삽입
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
    try {
      await onSend(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 엠프티 스테이트
  if (!request) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm">요청을 선택하거나 새로 신청해주세요</p>
        </div>
      </div>
    );
  }

  const st = STATUS_LABELS[request.status] || STATUS_LABELS.pending;

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <h2 className="font-semibold text-gray-800 truncate">{request.title}</h2>
        <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>
          {st.label}
        </span>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50">
        {loading ? (
          <div className="text-center text-gray-400 py-8">메시지 불러오는 중...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p className="text-sm">대화를 시작해보세요</p>
            <p className="text-xs mt-1">메시지를 입력하면 담당자에게 전달됩니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map(msg => {
              const isCustomer = msg.senderType === 'customer';
              return (
                <div key={msg.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] ${isCustomer ? 'order-2' : 'order-1'}`}>
                    {/* 발신자 이름 */}
                    <div className={`text-[11px] text-gray-400 mb-0.5 ${isCustomer ? 'text-right' : 'text-left'}`}>
                      {msg.senderName}
                    </div>
                    {/* 메시지 버블 */}
                    <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      isCustomer
                        ? 'bg-[#cc222c] text-white rounded-br-md'
                        : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
                    }`}>
                      {msg.body}
                    </div>
                    {/* 시간 */}
                    <div className={`text-[10px] text-gray-400 mt-0.5 ${isCustomer ? 'text-right' : 'text-left'}`}>
                      {formatTime(msg.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 입력창 */}
      <div className="border-t border-gray-200 bg-white p-3 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#cc222c] focus:ring-1 focus:ring-[#cc222c]/20 max-h-[120px]"
            style={{ minHeight: '40px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#cc222c] text-white flex items-center justify-center hover:bg-[#b01e27] disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
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
