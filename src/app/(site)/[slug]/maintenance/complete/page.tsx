import Link from 'next/link';

const CATEGORY_LABELS: Record<string, string> = {
  design_change: '디자인 수정',
  content_update: '콘텐츠 변경',
  feature_add: '기능 추가',
  bug_fix: '오류 수정',
  other: '기타',
};

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function MaintenanceCompletePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;

  const title = sp.title ?? '';
  const category = sp.category ?? '';
  const categoryLabel = CATEGORY_LABELS[category] || category;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        {/* 체크마크 아이콘 */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: 'color-mix(in srgb, var(--color-primary, #cc222c) 15%, transparent)' }}
        >
          <svg
            className="w-8 h-8"
            style={{ color: 'var(--color-primary, #cc222c)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h2 className="text-xl font-bold mb-2">유지보수 요청이 접수되었습니다</h2>
        <p className="text-gray-500 mb-6">검토 후 연락드리겠습니다.</p>

        {/* 요청 상세 */}
        <div className="bg-gray-50 rounded-xl p-5 text-left text-sm space-y-2 mb-6">
          {title && (
            <p>
              <span className="text-gray-400 inline-block w-16">제목</span>
              <span className="font-medium text-gray-800">{title}</span>
            </p>
          )}
          {categoryLabel && (
            <p>
              <span className="text-gray-400 inline-block w-16">유형</span>
              <span className="font-medium text-gray-800">{categoryLabel}</span>
            </p>
          )}
        </div>

        {/* 안내 */}
        <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700 mb-6 text-left">
          <p className="font-medium mb-1">처리 안내</p>
          <p className="text-blue-600">
            요청하신 내용은 담당자가 검토 후 순차적으로 처리합니다. 진행 상황은 별도로 안내드리겠습니다.
          </p>
        </div>

        <Link
          href={`/${slug}`}
          className="inline-block px-8 py-3 rounded-xl text-white font-medium transition hover:opacity-90"
          style={{ background: 'var(--color-primary, #cc222c)' }}
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
