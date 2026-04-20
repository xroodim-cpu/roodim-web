import { redirect } from 'next/navigation';
import { verifyAdminAccess } from '@/lib/admin-session';
import { adminApi } from '@/lib/admin-api';
import MemberInfoManager from './MemberInfoManager';

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface CustomerContext {
  ok: boolean;
  data?: {
    customer_id: number;
    customer_name: string;
    organization_id: number | null;
    designer_id: number | null;
    designer_name: string | null;
    contractor_id: number | null;
    contractor_name: string | null;
    contractor_organization_id: number | null;
  };
}

export default async function MemberInfoPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await verifyAdminAccess(slug);
  if (!session) redirect('/admin/sso?error=unauthorized');

  // 루딤링크(Laravel) 고객 정보 로드 — customer_id 가 있을 때만 시도
  let customer: CustomerContext['data'] | null = null;
  if (session.customer_id) {
    const res = await adminApi<CustomerContext['data']>(
      'GET',
      `/api/bridge/site-context?customer_id=${session.customer_id}`
    );
    if (res.ok && res.data) customer = res.data;
  }

  return (
    <MemberInfoManager
      slug={slug}
      session={{
        name: session.name,
        email: '', // credential.email 은 서버에서 별도 조회 필요 시 확장
        hasCredential: !!session.credential_id,
      }}
      customer={customer}
    />
  );
}
