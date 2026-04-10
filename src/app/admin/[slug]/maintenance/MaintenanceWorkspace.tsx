'use client';

import { useState, useEffect, useCallback } from 'react';
import RequestSidebar from './RequestSidebar';
import ChatPanel from './ChatPanel';
import ProductPricePanel from './ProductPricePanel';

export interface MaintenanceRequest {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'reviewing' | 'working' | 'done' | 'cancelled';
  requestedBy: { name?: string; role?: string };
  createdAt: string;
}

export interface ChatMessage {
  id: number;
  maintenanceRequestId: number;
  senderType: 'customer' | 'staff';
  senderName: string;
  body: string;
  createdAt: string;
}

export interface DesignerSchedule {
  member_id: number;
  working_days: number[];
  hours_start: string;
  hours_end: string;
  lunch_enabled: boolean;
  lunch_start: string | null;
  lunch_end: string | null;
  holiday_closed: boolean;
}

export interface ProductItem {
  id: number;
  name: string;
  description: string | null;
  price: number;
  base_price: number;
  items: unknown;
  category: string | null;
  thumbnail: string | null;
}

export interface DesignerInfo {
  id: number | null;
  name: string | null;
}

// 모바일 탭
type MobileTab = 'chat' | 'calendar' | 'price';

export default function MaintenanceWorkspace({ slug }: { slug: string }) {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [schedule, setSchedule] = useState<DesignerSchedule | null>(null);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [designer, setDesigner] = useState<DesignerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 요청 목록 로드
  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/maintenance?slug=${slug}`);
      if (!res.ok) return;
      const json = await res.json();
      setRequests(json.data ?? []);
    } catch { /* silent */ }
  }, [slug]);

  // 컨텍스트(스케줄+차단일+가격표) 로드
  const fetchContext = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/maintenance/context?slug=${slug}`);
      if (!res.ok) return;
      const json = await res.json();
      const d = json.data;
      if (d) {
        setSchedule(d.schedule);
        setBlockedDates(d.blockedDates ?? []);
        setProducts(d.products ?? []);
        setDesigner(d.designer);
      }
    } catch { /* silent */ }
  }, [slug]);

  // 초기 로드
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRequests(), fetchContext()]).finally(() => setLoading(false));
  }, [fetchRequests, fetchContext]);

  // 메시지 로드
  const fetchMessages = useCallback(async (requestId: number) => {
    setMsgLoading(true);
    try {
      const res = await fetch(`/api/admin/maintenance/${requestId}/messages?slug=${slug}`);
      if (!res.ok) return;
      const json = await res.json();
      setMessages(json.data ?? []);
    } catch { /* silent */ }
    finally { setMsgLoading(false); }
  }, [slug]);

  // 선택 변경 시 메시지 로드
  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId);
    } else {
      setMessages([]);
    }
  }, [selectedId, fetchMessages]);

  // 신청하기
  const handleCreate = async () => {
    try {
      const res = await fetch(`/api/admin/maintenance?slug=${slug}`, { method: 'POST' });
      if (!res.ok) return;
      const json = await res.json();
      if (json.data) {
        setRequests(prev => [json.data, ...prev]);
        setSelectedId(json.data.id);
        setMobileTab('chat');
      }
    } catch { /* silent */ }
  };

  // 메시지 전송
  const handleSend = async (body: string) => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/admin/maintenance/${selectedId}/messages?slug=${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: body }),
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.data) {
        setMessages(prev => [...prev, json.data]);
      }
    } catch { /* silent */ }
  };

  // 가격표 상품 클릭 → 채팅에 삽입할 텍스트 반환
  const [insertText, setInsertText] = useState('');
  const handleProductClick = (product: ProductItem) => {
    const price = product.price.toLocaleString('ko-KR');
    setInsertText(`[${product.name}] ₩${price}`);
  };

  const selectedRequest = requests.find(r => r.id === selectedId) ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)] bg-gray-50">
        <div className="text-gray-400">불러오는 중...</div>
      </div>
    );
  }

  return (
    <>
      {/* 모바일 탭 바 */}
      <div className="flex md:hidden bg-white border-b">
        <button
          onClick={() => { setSidebarOpen(true); setMobileTab('calendar'); }}
          className={`flex-1 py-3 text-sm font-medium border-b-2 ${mobileTab === 'calendar' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500'}`}
        >
          일정
        </button>
        <button
          onClick={() => { setSidebarOpen(false); setMobileTab('chat'); }}
          className={`flex-1 py-3 text-sm font-medium border-b-2 ${mobileTab === 'chat' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500'}`}
        >
          채팅
        </button>
        <button
          onClick={() => { setSidebarOpen(false); setMobileTab('price'); }}
          className={`flex-1 py-3 text-sm font-medium border-b-2 ${mobileTab === 'price' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500'}`}
        >
          가격표
        </button>
      </div>

      <div className="flex h-[calc(100vh-60px)] md:h-[calc(100vh-60px)] overflow-hidden bg-gray-50">
        {/* 사이드바 - 데스크탑 항상, 모바일 조건부 */}
        <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-full md:w-[280px] flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto`}>
          <RequestSidebar
            requests={requests}
            selectedId={selectedId}
            onSelect={(id) => { setSelectedId(id); setSidebarOpen(false); setMobileTab('chat'); }}
            onCreate={handleCreate}
            schedule={schedule}
            blockedDates={blockedDates}
            designer={designer}
          />
        </div>

        {/* 채팅 패널 */}
        <div className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`}>
          <ChatPanel
            request={selectedRequest}
            messages={messages}
            loading={msgLoading}
            onSend={handleSend}
            insertText={insertText}
            onInsertTextConsumed={() => setInsertText('')}
          />
        </div>

        {/* 가격표 패널 */}
        <div className={`${mobileTab === 'price' ? 'block' : 'hidden'} md:block w-full md:w-[320px] flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto`}>
          <ProductPricePanel
            products={products}
            onProductClick={handleProductClick}
          />
        </div>
      </div>
    </>
  );
}
