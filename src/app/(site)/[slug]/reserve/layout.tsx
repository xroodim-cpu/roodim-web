import { getSiteBySlug, getAllSiteConfigs } from '@/lib/site';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: LayoutProps) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return {};
  const configs = await getAllSiteConfigs(site.id);
  const base = configs['base'] || {};
  const siteName = (base.site_name as string) || site.name;
  return {
    title: `예약 | ${siteName}`,
    description: `${siteName} 온라인 예약 페이지입니다.`,
  };
}

export default function ReserveLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
