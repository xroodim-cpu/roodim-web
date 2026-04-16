'use client';

import { ReactNode, useState } from 'react';
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
  subMenus?: SubMenu[];
}

const TOP_MENUS: TopMenu[] = [
  {
    key: 'dashboard',
    label: '대시보드',
    href: '/dashboard',
  },
  {
    key: 'reservations',
    label: '예약',
    href: '/reservations',
  },
  {
    key: 'work',
    label: '작업',
    href: '/work',
    subMenus: [
      { key: 'all', label: '전체', href: '/work' },
      { key: 'pending', label: '대기', href: '/work?status=pending' },
      { key: 'reviewing', label: '검토 중', href: '/work?status=reviewing' },
      { key: 'working', label: '진행 중', href: '/work?status=working' },
      { key: 'done', label: '완료', href: '/work?status=done' },
    ],
  },
  {
    key: 'services',
    label: '시술',
    href: '/services',
  },
  {
    key: 'boards',
    label: '게시판',
    href: '/boards',
  },
  {
    key: 'site',
    label: '사이트',
    href: '/site',
    subMenus: [
      { key: 'info', label: '기본정보', href: '/site' },
      { key: 'seo', label: 'SEO/마케팅', href: '/site/seo' },
      { key: 'sections', label: '섹션 관리', href: '/site/sections' },
      { key: 'menus', label: '메뉴 관리', href: '/site/menus' },
    ],
  },
];

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export default function AdminLayout({
  slug,
  siteName,
  children,
  hasWorkboard = false,
}: AdminLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);

  const allMenus: TopMenu[] = hasWorkboard
    ? [
        ...TOP_MENUS,
        {
          key: 'workboard',
          label: '워크보드',
          href: '/workboard',
        },
      ]
    : TOP_MENUS;

  // 현재 메뉴 활성화 판별 (slug 뒤의 첫 경로 segment)
  const getActiveTopKey = () => {
    const pathAfterSlug = pathname.split(`/admin/${slug}`)[1] || '/dashboard';
    const segments = pathAfterSlug.split('/').filter(Boolean);
    return segments[0] || 'dashboard';
  };

  const activeTopKey = getActiveTopKey();
  const activeTop = allMenus.find((m) => m.key === activeTopKey);
  const subMenus = activeTop?.subMenus || [];
  const hasSubMenus = subMenus.length > 0;

  // 사이드바 서브 메뉴 active 판별 (pathname + 쿼리스트링 둘 다 매칭)
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

  return (
    <>
      {/* 상단 메인 네비게이션 */}
      <nav className="topnav">
        <div className="topnav-inner">
          {hasSubMenus && (
            <button
              type="button"
              className="topnav-side-toggle"
              onClick={() => setSideOpen((v) => !v)}
              aria-label="사이드 메뉴"
            >
              <HamburgerIcon />
            </button>
          )}

          <Link
            href={`/admin/${slug}/dashboard`}
            className="topnav-brand"
          >
            <span className="user-avatar" style={{ width: 34, height: 34 }}>
              {brandInitial}
            </span>
            <span className="topnav-brand-text">{siteName}</span>
          </Link>

          <div
            className={`topnav-menu${mobileMenuOpen ? ' mobile-open' : ''}`}
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
                {menu.label}
              </Link>
            ))}
          </div>

          <div className="topnav-actions">
            <button type="button" className="btn btn-ghost btn-sm">
              프로필
            </button>
            <button
              type="button"
              className="topnav-side-toggle"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="메뉴"
            >
              <HamburgerIcon />
            </button>
          </div>
        </div>
      </nav>

      {/* 메인 레이아웃 */}
      {hasSubMenus ? (
        <div className="wb-wrap">
          <aside className={`wb-side${sideOpen ? ' open' : ''}`}>
            <div
              style={{
                fontSize: 'var(--fs-xs)',
                fontWeight: 'var(--fw-bold)',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                padding: '0 12px 12px',
                borderBottom: '1px solid var(--border)',
                marginBottom: '12px',
              }}
            >
              {activeTop?.label}
            </div>
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
      {mobileMenuOpen && (
        <div
          className="topnav-drawer-overlay show"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
