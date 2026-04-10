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

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/maintenance?slug=${slug}`);
      if (!res.ok) return;
      const json = await res.json();
      setRequests(json.data ?? []);
    } catch { /* silent */ }
  }, [slug]);

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

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRequests(), fetchContext()]).finally(() => setLoading(false));
  }, [fetchRequests, fetchContext]);

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

  useEffect(() => {
    if (selectedId) fetchMessages(selectedId);
    else setMessages([]);
  }, [selectedId, fetchMessages]);

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
      if (json.data) setMessages(prev => [...prev, json.data]);
    } catch { /* silent */ }
  };

  const [insertText, setInsertText] = useState('');
  const handleProductClick = (product: ProductItem) => {
    const price = product.price.toLocaleString('ko-KR');
    setInsertText(`[${product.name}] ₩${price}`);
  };

  const selectedRequest = requests.find(r => r.id === selectedId) ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 60px)', background: '#f5f5f5' }}>
        <div style={{ color: '#999' }}>불러오는 중...</div>
      </div>
    );
  }

  return (
    <>
      {/* 모바일 탭 바 — 루딤링크 topnav 스타일 */}
      <div className="flex md:hidden" style={{ background: '#fff', borderBottom: '1px solid #e8e8e8' }}>
        {(['calendar', 'chat', 'price'] as MobileTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => { setSidebarOpen(tab === 'calendar'); setMobileTab(tab); }}
            className="flex-1 py-3 text-center transition-all"
            style={{
              fontSize: '14px',
              fontWeight: mobileTab === tab ? 700 : 500,
              color: mobileTab === tab ? '#cc222c' : '#666',
              background: mobileTab === tab ? 'rgba(204,34,44,0.08)' : 'transparent',
              borderRadius: '10px',
              margin: '6px 4px',
            }}
          >
            {tab === 'calendar' ? '일정' : tab === 'chat' ? '채팅' : '가격표'}
          </button>
        ))}
      </div>

      <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 60px)', background: '#f5f5f5' }}>
        {/* 사이드바 */}
        <div
          className={`${sidebarOpen ? 'block' : 'hidden'} md:block flex-shrink-0 overflow-y-auto`}
          style={{
            width: sidebarOpen ? '100%' : '270px',
            maxWidth: '270px',
            background: '#fff',
            borderRight: '1px solid #f1f2f6',
          }}
        >
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
        <div
          className={`${mobileTab === 'price' ? 'block' : 'hidden'} md:block flex-shrink-0 overflow-y-auto`}
          style={{
            width: mobileTab === 'price' ? '100%' : '320px',
            maxWidth: '320px',
            background: '#fff',
            borderLeft: '1px solid #f1f2f6',
          }}
        >
          <ProductPricePanel products={products} onProductClick={handleProductClick} />
        </div>
      </div>
    </>
  );
}
