'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './AdminLayout.module.css';

interface AdminLayoutProps {
  slug: string;
  siteName: string;
  children: ReactNode;
  hasWorkboard?: boolean;
}

const MENUS = [
  { key: 'dashboard', label: '대시보드', href: '/dashboard' },
  { key: 'reservations', label: '예약', href: '/reservations' },
  { key: 'work', label: '작업', href: '/work' },
  { key: 'services', label: '시술', href: '/services' },
  { key: 'site', label: '사이트', href: '/site' },
];

export default function AdminLayout({
  slug,
  siteName,
  children,
  hasWorkboard = false,
}: AdminLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 현재 메뉴 활성화 여부 판별 (slug 뒤의 경로로 판별)
  const getActiveMenu = () => {
    const pathAfterSlug = pathname.split(`/admin/${slug}`)[1] || '/dashboard';
    const segments = pathAfterSlug.split('/').filter(Boolean);
    return segments[0] || 'dashboard';
  };

  const activeMenu = getActiveMenu();

  return (
    <div className={styles.adminContainer}>
      {/* 상단 헤더 */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <button
            className={styles.sidebarToggle}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="사이드바 토글"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className={styles.logoArea}>
            <h1 className={styles.siteTitle}>{siteName}</h1>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.profileBtn}>프로필</button>
          </div>
        </div>
      </header>

      {/* 메인 컨테이너 */}
      <div className={styles.mainContainer}>
        {/* 사이드바 */}
        <aside
          className={`${styles.sidebar} ${sidebarOpen ? styles.open : styles.closed}`}
        >
          <nav className={styles.navList}>
            {MENUS.map((menu) => (
              <Link
                key={menu.key}
                href={`/admin/${slug}${menu.href}`}
                className={`${styles.navItem} ${
                  activeMenu === menu.key ? styles.active : ''
                }`}
              >
                {menu.label}
              </Link>
            ))}
            {hasWorkboard && (
              <Link
                href={`/admin/${slug}/workboard`}
                className={`${styles.navItem} ${
                  activeMenu === 'workboard' ? styles.active : ''
                }`}
              >
                워크보드
              </Link>
            )}
          </nav>
        </aside>

        {/* 메인 콘텐츠 */}
        <main className={styles.mainContent}>
          <div className={styles.contentWrapper}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
