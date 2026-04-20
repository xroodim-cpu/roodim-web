'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Props {
  slug: string;
  session: {
    name: string;
    email: string;
    hasCredential: boolean;
  };
  customer: {
    customer_id: number;
    customer_name: string;
    organization_id: number | null;
    designer_id: number | null;
    designer_name: string | null;
    contractor_id: number | null;
    contractor_name: string | null;
  } | null;
}

export default function MemberInfoManager({ slug, session, customer }: Props) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) {
      setMsg({ type: 'err', text: '새 비밀번호와 확인이 일치하지 않습니다' });
      return;
    }
    if (next.length < 8) {
      setMsg({ type: 'err', text: '새 비밀번호는 8자 이상이어야 합니다' });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/site-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: cur, new_password: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: 'err', text: data.error || '비밀번호 변경 실패' });
      } else {
        setMsg({ type: 'ok', text: '비밀번호가 변경되었습니다' });
        setCur(''); setNext(''); setConfirm('');
      }
    } catch {
      setMsg({ type: 'err', text: '서버 오류가 발생했습니다' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>회원정보</h1>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>
        기본 정보는 루딤 링크에 저장된 고객 정보와 연동되며, 변경 시 루딤 링크에도 자동 반영됩니다.
      </p>

      {/* === 기본 정보 === */}
      <section style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14 }}>기본 정보</h3>
        <Row label="이름" value={session.name || '—'} />
        <Row label="고객사" value={customer?.customer_name || '—'} />
        <Row label="담당 계약자" value={customer?.contractor_name || '—'} />
        <Row label="유지보수 담당자" value={customer?.designer_name || '—'} />
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10, lineHeight: 1.5 }}>
          위 정보는 루딤 링크에서 관리됩니다. 변경이 필요하면 계약자에게 요청해 주세요.
        </p>
      </section>

      {/* === 비밀번호 === */}
      {session.hasCredential && (
        <section style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14 }}>로그인 정보 · 비밀번호</h3>
          <form onSubmit={submitPassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="현재 비밀번호">
              <input type="password" value={cur} onChange={e => setCur(e.target.value)} required
                     style={inputStyle} />
            </Field>
            <Field label="새 비밀번호">
              <input type="password" value={next} onChange={e => setNext(e.target.value)} minLength={8} required
                     style={inputStyle} placeholder="8자 이상" />
            </Field>
            <Field label="새 비밀번호 확인">
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                     style={inputStyle} />
            </Field>
            {msg && (
              <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 6,
                background: msg.type === 'ok' ? '#ecfdf5' : '#fef2f2',
                color: msg.type === 'ok' ? '#065f46' : '#b91c1c',
              }}>{msg.text}</div>
            )}
            <button type="submit" disabled={busy} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              {busy ? '변경 중…' : '비밀번호 변경'}
            </button>
          </form>
        </section>
      )}

      <div style={{ marginTop: 12 }}>
        <Link href={`/admin/${slug}`} style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none' }}>
          ← 관리자 홈으로
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px dashed var(--border-soft)', fontSize: 13 }}>
      <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 14,
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  outline: 'none',
};
