import { redirect } from 'next/navigation';
import { verifyAdminAccess } from '@/lib/admin-session';
import ContentManager from './ContentManager';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ContentsPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await verifyAdminAccess(slug);
  if (!session) redirect('/admin/sso?error=unauthorized');

  return <ContentManager slug={slug} />;
}
