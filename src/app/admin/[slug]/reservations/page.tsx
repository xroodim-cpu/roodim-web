import { redirect } from 'next/navigation';
import { verifyAdminAccess } from '@/lib/admin-session';
import ReservationManager from './ReservationManager';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ReservationsPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await verifyAdminAccess(slug);
  if (!session) redirect('/admin/sso?error=unauthorized');

  return <ReservationManager slug={slug} />;
}
