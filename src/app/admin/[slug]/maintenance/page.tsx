import { redirect } from 'next/navigation';
import { verifyAdminAccess } from '@/lib/admin-session';
import MaintenanceList from './MaintenanceList';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function MaintenancePage({ params }: PageProps) {
  const { slug } = await params;
  const session = await verifyAdminAccess(slug);
  if (!session) redirect('/admin/sso?error=unauthorized');

  return <MaintenanceList slug={slug} />;
}
