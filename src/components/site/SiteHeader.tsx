'use client';

import { useState } from 'react';
import Link from 'next/link';

interface MenuItem {
  id: number;
  label: string;
  url: string | null;
  icon: string | null;
  sortOrder: number;
}

interface SiteHeaderProps {
  slug: string;
  siteName: string;
  logoUrl?: string;
  menuItems: MenuItem[];
  settings: Record<string, unknown>;
}

export default function SiteHeader({ slug, siteName, logoUrl, menuItems, settings }: SiteHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* 로고 / 사이트명 */}
          <Link href={`/${slug}`} className="flex items-center gap-2 flex-shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className="h-8 md:h-10 object-contain" />
            ) : (
              <span className="text-lg md:text-xl font-bold" style={{ color: 'var(--color-primary)' }}>
                {siteName}
              </span>
            )}
          </Link>

          {/* PC 메뉴 */}
          <nav className="hidden md:flex items-center gap-6">
            {menuItems.map(item => (
              <Link
                key={item.id}
                href={item.url || '#'}
                className="text-sm font-medium text-gray-700 hover:text-[var(--color-primary)] transition"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={`/${slug}/reserve`}
              className="px-5 py-2 rounded-full text-sm font-bold text-white transition"
              style={{ background: 'var(--color-primary)' }}
            >
              예약하기
            </Link>
          </nav>

          {/* 모바일 햄버거 */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-gray-600"
            aria-label="메뉴"
          >
            {mobileOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 모바일 메뉴 드로어 */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <nav className="max-w-6xl mx-auto px-4 py-4 space-y-1">
            {menuItems.map(item => (
              <Link
                key={item.id}
                href={item.url || '#'}
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={`/${slug}/reserve`}
              onClick={() => setMobileOpen(false)}
              className="block text-center mt-3 px-4 py-3 rounded-lg text-sm font-bold text-white"
              style={{ background: 'var(--color-primary)' }}
            >
              예약하기
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
