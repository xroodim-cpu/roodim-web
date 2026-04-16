import { redirect } from 'next/navigation';
import { verifyAdminAccess } from '@/lib/admin-session';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AdminRoot({ params }: PageProps) {
  const { slug } = await params;
  const session = await verifyAdminAccess(slug);
  if (!session) redirect('/admin/sso?error=unauthorized');
  redirect(`/admin/${slug}/dashboard`);
}
