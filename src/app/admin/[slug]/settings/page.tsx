import { redirect } from 'next/navigation';
import { verifyAdminAccess } from '@/lib/admin-session';
import SettingsManager from './SettingsManager';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function SettingsPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await verifyAdminAccess(slug);
  if (!session) redirect('/admin/sso?error=unauthorized');

  return <SettingsManager slug={slug} />;
}
