import { notFound } from 'next/navigation';
import { getSiteBySlug, getAllSiteConfigs, getMenuItems } from '@/lib/site';
import SiteHeader from '@/components/site/SiteHeader';
import SiteFooter from '@/components/site/SiteFooter';
import SiteBottomNav from '@/components/site/SiteBottomNav';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function SiteLayout({ children, params }: LayoutProps) {
  const { slug } = await params;

  const site = await getSiteBySlug(slug);
  if (!site || site.status !== 'active') notFound();

  // 4개 쿼리를 병렬 실행 (직렬이면 4xRTT, 병렬이면 1xRTT)
  const [configs, menuItems, bottomItems] = await Promise.all([
    getAllSiteConfigs(site.id),
    getMenuItems(site.id, 'menubar'),
    getMenuItems(site.id, 'bottom'),
  ]);
  const base = configs['base'] || {};
  const design = configs['design'] || {};
  const headerFooter = configs['headerfooter'] || {};

  return (
    <div
      style={{
        '--color-primary': (design.primary_color as string) || '#cc222c',
        '--color-secondary': (design.secondary_color as string) || '#1a1a1a',
        '--color-accent': (design.accent_color as string) || '#f5f5f5',
        '--color-bg': (design.bg_color as string) || '#ffffff',
        '--color-text': (design.text_color as string) || '#1a1a1a',
      } as React.CSSProperties}
      className="min-h-screen flex flex-col"
    >
      <SiteHeader
        slug={slug}
        siteName={(base.site_name as string) || site.name}
        logoUrl={base.logo_url as string}
        menuItems={menuItems}
        settings={headerFooter}
      />

      <main className="flex-1">
        {children}
      </main>

      <SiteFooter
        siteName={(base.site_name as string) || site.name}
        settings={headerFooter}
        base={base}
      />

      {bottomItems.length > 0 && (
        <SiteBottomNav slug={slug} items={bottomItems} />
      )}
    </div>
  );
}
