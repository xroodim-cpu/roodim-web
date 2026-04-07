import { redirect } from 'next/navigation';
import { verifyAdminAccess } from '@/lib/admin-session';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AdminDashboard({ params }: PageProps) {
  const { slug } = await params;
  const session = await verifyAdminAccess(slug);
  if (!session) redirect('/admin/sso?error=unauthorized');

  const menuItems = [
    { label: '콘텐츠 관리', href: `/admin/${slug}/contents`, icon: '📝', desc: '시술, 이벤트, 스태프 등 콘텐츠 편집' },
    { label: '섹션 관리', href: `/admin/${slug}/sections`, icon: '🧩', desc: '메인 페이지 섹션 구성' },
    { label: '예약 관리', href: `/admin/${slug}/reservations`, icon: '📅', desc: '예약 확인 및 승인/거절' },
    { label: '유지보수', href: `/admin/${slug}/maintenance`, icon: '🔧', desc: '유지보수 요청 이력' },
    { label: '사이트 설정', href: `/admin/${slug}/settings`, icon: '⚙️', desc: '기본정보, 디자인, SEO 설정' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">사이트 관리</h1>
            <p className="text-sm text-gray-500">{session.name}님 ({session.role})</p>
          </div>
          <a
            href={`/${slug}`}
            target="_blank"
            className="text-sm px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            사이트 보기 ↗
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {menuItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-white rounded-xl p-6 border border-gray-200 hover:border-gray-400 hover:shadow-sm transition"
            >
              <div className="text-3xl mb-3">{item.icon}</div>
              <h2 className="font-bold mb-1">{item.label}</h2>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
