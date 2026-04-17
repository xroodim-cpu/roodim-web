import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { sites, workboardMembers } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';
import AdminLayout from './AdminLayout';
// 루딤링크 디자인 시스템 (공통 CSS 변수 + 컴포넌트 클래스)
import '../_theme/roodim-link.css';

interface AdminLayoutProps {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children, params }: AdminLayoutProps) {
  const { slug } = await params;

  // 어드민 접근 권한 검증
  const adminInfo = await verifyAdminAccess(slug);
  if (!adminInfo) {
    redirect(`/admin/login/${slug}`);
  }

  // 사이트 정보 조회
  const site = await db.query.sites.findFirst({
    where: eq(sites.slug, slug),
  });

  if (!site) {
    redirect(`/admin/login/${slug}`);
  }

  // 워크보드 멤버십 확인 (이 사이트가 어떤 워크보드에 속해있는지)
  const membership = await db.select({ id: workboardMembers.id })
    .from(workboardMembers)
    .where(eq(workboardMembers.siteId, site.id))
    .limit(1);
  const hasWorkboard = membership.length > 0;

  return (
    <AdminLayout slug={slug} siteName={site.name} hasWorkboard={hasWorkboard}>
      {children}
    </AdminLayout>
  );
}
