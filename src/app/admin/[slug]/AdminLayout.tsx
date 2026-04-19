'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface AdminLayoutProps {
  slug: string;
  siteName: string;
  children: ReactNode;
  hasWorkboard?: boolean;
}

interface SubMenu {
  key: string;
  label: string;
  href: string;
}

interface TopMenu {
  key: string;
  label: string;
  href: string;
  icon: string;
  subMenus?: SubMenu[];
}

// 고객 어드민 5대 핵심 메뉴 — 루딤링크 상단 네비와 동일 구조 (아이콘 + 텍스트)
const TOP_MENUS: TopMenu[] = [
  { key: 'dashboard', label: '대시보드', href: '/dashboard', icon: 'dashboard' },
  { key: 'reservations', label: '예약', href: '/reservations', icon: 'event_note' },
  {
    key: 'work',
    label: '작업',
    href: '/work',
    icon: 'task_alt',
    subMenus: [
      { key: 'all', label: '전체', href: '/work' },
      { key: 'pending', label: '대기', href: '/work?status=pending' },
      { key: 'reviewing', label: '검토 중', href: '/work?status=reviewing' },
      { key: 'working', label: '진행 중', href: '/work?status=working' },
      { key: 'done', label: '완료', href: '/work?status=done' },
    ],
  },
  { key: 'address-book', label: '주소록', href: '/address-book', icon: 'contacts' },
];

export default function AdminLayout({
  slug,
  siteName,
  children,
  hasWorkboard = false,
}: AdminLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [profileOpen, setProfileOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const allMenus: TopMenu[] = hasWorkboard
    ? [
        ...TOP_MENUS,
        { key: 'workboard', label: '워크보드', href: '/workboard', icon: 'forum' },
      ]
    : TOP_MENUS;

  const getActiveTopKey = () => {
    const pathAfterSlug = pathname.split(`/admin/${slug}`)[1] || '/dashboard';
    const segments = pathAfterSlug.split('/').filter(Boolean);
    return segments[0] || 'dashboard';
  };

  const activeTopKey = getActiveTopKey();
  const activeTop = allMenus.find((m) => m.key === activeTopKey);
  const subMenus = activeTop?.subMenus || [];
  const hasSubMenus = subMenus.length > 0;

  const isSubActive = (subHref: string) => {
    const [hrefPath, hrefQuery] = subHref.split('?');
    const fullPath = `/admin/${slug}${hrefPath}`;
    if (pathname !== fullPath) return false;
    if (!hrefQuery) {
      return !searchParams.toString() || !searchParams.has('status');
    }
    const expected = new URLSearchParams(hrefQuery);
    for (const [k, v] of expected.entries()) {
      if (searchParams.get(k) !== v) return false;
    }
    return true;
  };

  const brandInitial = (siteName?.charAt(0) || 'R').toUpperCase();

  // body 에 roodim-admin 클래스 주입 — 루딤링크 테마 적용 (globals.css 에서 정의)
  useEffect(() => {
    document.body.classList.add('roodim-admin');
    document.documentElement.setAttribute('data-theme', 'light');
    return () => {
      document.body.classList.remove('roodim-admin');
    };
  }, []);

  return (
    <div className="roodim-admin-root">
      {/* ===== 상단 네비게이션 — 루딤링크 app.blade 구조 그대로 ===== */}
      <nav className="topnav">
        <div className="topnav-inner">
          {/* 모바일 좌측 토글 */}
          <button
            className="topnav-side-toggle"
            type="button"
            onClick={() => setSideOpen((v) => !v)}
            aria-label="메뉴"
          >
            <span className="material-symbols-rounded">menu</span>
          </button>

          {/* 브랜드 로고 + 사이트명 */}
          <Link href={`/admin/${slug}/dashboard`} className="topnav-brand">
            <span
              className="topnav-brand-text"
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 800,
                color: '#fff',
                background: 'var(--accent)',
                flexShrink: 0,
              }}
            >
              {brandInitial}
            </span>
            <span className="topnav-brand-text">{siteName}</span>
          </Link>

          {/* 중앙 메뉴 */}
          <div
            className={`topnav-menu${mobileMenuOpen ? ' mobile-open' : ''}`}
            id="topnavMenu"
          >
            {allMenus.map((menu) => (
              <Link
                key={menu.key}
                href={`/admin/${slug}${menu.href}`}
                className={`topnav-link${
                  activeTopKey === menu.key ? ' active' : ''
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="material-symbols-rounded">{menu.icon}</span>
                <span>{menu.label}</span>
              </Link>
            ))}
          </div>

          {/* 우측 액션 */}
          <div className="topnav-actions">
            <button
              className="topnav-icon-btn"
              type="button"
              aria-label="알림"
            >
              <span className="material-symbols-rounded">notifications</span>
            </button>

            <div style={{ position: 'relative' }}>
              <button
                className="topnav-profile-btn"
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                aria-label="프로필 메뉴"
              >
                <div className="user-avatar">{brandInitial}</div>
              </button>
              {profileOpen && (
                <div
                  className="topnav-popup"
                  style={{ display: 'block', width: 260 }}
                >
                  <div
                    className="topnav-popup-header"
                    style={{
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 2,
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 16 }}>
                      {siteName}
                    </span>
                    <span
                      style={{ fontSize: 14, color: 'var(--text-tertiary)' }}
                    >
                      {slug}
                    </span>
                  </div>
                  <Link
                    href={`/admin/${slug}/dashboard`}
                    className="topnav-popup-item"
                    onClick={() => setProfileOpen(false)}
                  >
                    <span className="material-symbols-rounded">dashboard</span>
                    대시보드
                  </Link>
                  <a
                    href={`/admin/login/${slug}`}
                    className="topnav-popup-item"
                    onClick={async (e) => {
                      e.preventDefault();
                      await fetch('/api/auth/site-logout', { method: 'POST' });
                      window.location.href = `/admin/login/${slug}`;
                    }}
                  >
                    <span className="material-symbols-rounded">logout</span>
                    로그아웃
                  </a>
                </div>
              )}
            </div>

            <button
              className="topnav-icon-btn topnav-side-toggle"
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="모바일 메뉴"
              style={{ display: 'none' }}
            >
              <span className="material-symbols-rounded">more_vert</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ===== 메인 레이아웃 — 루딤링크 .wb-wrap 구조 ===== */}
      {hasSubMenus ? (
        <div className="wb-wrap">
          <aside className={`wb-side${sideOpen ? ' open' : ''}`}>
            <div className="pd-side-title">{activeTop?.label}</div>
            <div className="pd-side-group">
              {subMenus.map((sub) => (
                <Link
                  key={sub.key}
                  href={`/admin/${slug}${sub.href}`}
                  className={`pd-side-group-label${
                    isSubActive(sub.href) ? ' active' : ''
                  }`}
                  onClick={() => setSideOpen(false)}
                >
                  {sub.label}
                </Link>
              ))}
            </div>
          </aside>
          <main className="wb-main" style={{ paddingTop: 24 }}>
            {children}
          </main>
        </div>
      ) : (
        <main
          className="wb-main"
          style={{
            paddingTop: 24,
            minHeight: 'calc(100vh - var(--header-height, 60px))',
          }}
        >
          {children}
        </main>
      )}

      {/* 모바일 오버레이 */}
      {sideOpen && (
        <div
          className="wb-side-overlay show"
          onClick={() => setSideOpen(false)}
        />
      )}
      {profileOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1,
          }}
          onClick={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
}
