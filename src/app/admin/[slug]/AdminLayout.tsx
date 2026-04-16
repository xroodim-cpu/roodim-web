'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import styles from './AdminLayout.module.css';

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
    subMenus: [
      { key: 'overview', label: '개요', href: '/dashboard' },
    ],
  },
  {
    key: 'reservations',
    label: '예약',
    href: '/reservations',
    subMenus: [
      { key: 'list', label: '예약 목록', href: '/reservations' },
    ],
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
    subMenus: [
      { key: 'list', label: '시술 목록', href: '/services' },
    ],
  },
  {
    key: 'site',
    label: '사이트',
    href: '/site',
    subMenus: [
      { key: 'info', label: '기본정보', href: '/site' },
      { key: 'sections', label: '섹션 관리', href: '/site/sections' },
      { key: 'menus', label: '메뉴 관리', href: '/site/menus' },
    ],
  },
];

export default function AdminLayout({
  slug,
  siteName,
  children,
  hasWorkboard = false,
}: AdminLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const allMenus: TopMenu[] = hasWorkboard
    ? [
        ...TOP_MENUS,
        {
          key: 'workboard',
          label: '워크보드',
          href: '/workboard',
          subMenus: [{ key: 'main', label: '워크보드', href: '/workboard' }],
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

  // 사이드바 서브 메뉴 active 판별 (pathname + 쿼리스트링 둘 다 매칭)
  const isSubActive = (subHref: string) => {
    const [hrefPath, hrefQuery] = subHref.split('?');
    const fullPath = `/admin/${slug}${hrefPath}`;
    if (pathname !== fullPath) return false;

    if (!hrefQuery) {
      // 서브 href 에 쿼리 없음: 현재 URL 에 status 같은 필터가 없을 때만 active
      // 그리고 같은 그룹에 status 쿼리를 가진 다른 sub 가 있을 때는 "기본" sub 로 인정
      return !searchParams.toString() || !searchParams.has('status');
    }

    // 서브 href 에 쿼리 있음: 모든 키·값이 정확히 일치해야 함
    const expected = new URLSearchParams(hrefQuery);
    for (const [k, v] of expected.entries()) {
      if (searchParams.get(k) !== v) return false;
    }
    return true;
  };

  return (
    <div className={styles.adminContainer}>
      {/* 상단 헤더 + 주메뉴 */}
      <header className={styles.topnav}>
        <div className={styles.topnavInner}>
          <button
            className={styles.drawerToggle}
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-label="메뉴"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <Link href={`/admin/${slug}/dashboard`} className={styles.brand}>
            <span className={styles.brandLogo}>{siteName?.charAt(0) || 'R'}</span>
            <span className={styles.brandText}>{siteName}</span>
          </Link>
          <nav className={`${styles.topMenu} ${drawerOpen ? styles.topMenuOpen : ''}`}>
            {allMenus.map((menu) => (
              <Link
                key={menu.key}
                href={`/admin/${slug}${menu.href}`}
                className={`${styles.topMenuLink} ${
                  activeTopKey === menu.key ? styles.topMenuActive : ''
                }`}
                onClick={() => setDrawerOpen(false)}
              >
                {menu.label}
              </Link>
            ))}
          </nav>
          <div className={styles.topActions}>
            <button className={styles.profileBtn} aria-label="프로필">
              프로필
            </button>
          </div>
        </div>
      </header>

      {/* 메인 컨테이너 (서브 사이드바 + 콘텐츠) */}
      <div className={styles.mainContainer}>
        {subMenus.length > 1 && (
          <aside className={styles.subSidebar}>
            <div className={styles.subSidebarHeader}>{activeTop?.label}</div>
            <nav className={styles.subNavList}>
              {subMenus.map((sub) => (
                <Link
                  key={sub.key}
                  href={`/admin/${slug}${sub.href}`}
                  className={`${styles.subNavItem} ${
                    isSubActive(sub.href) ? styles.subNavActive : ''
                  }`}
                >
                  {sub.label}
                </Link>
              ))}
            </nav>
          </aside>
        )}

        <main className={styles.mainContent}>
          <div className={styles.contentWrapper}>{children}</div>
        </main>
      </div>

      {drawerOpen && (
        <div
          className={styles.drawerOverlay}
          onClick={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}
