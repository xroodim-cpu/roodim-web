import { redirect } from 'next/navigation';
import { verifyAdminAccess } from '@/lib/admin-session';
import SectionManager from './SectionManager';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function SectionsPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await verifyAdminAccess(slug);
  if (!session) redirect('/admin/sso?error=unauthorized');

  return <SectionManager slug={slug} />;
}
