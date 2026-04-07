import Link from 'next/link';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ReserveCompletePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;

  const name = sp.name ?? '';
  const date = sp.date ?? '';
  const time = sp.time ?? '';
  const treatment = sp.treatment ?? '';

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

        <h2 className="text-xl font-bold mb-2">예약이 접수되었습니다</h2>
        <p className="text-gray-500 mb-6">확인 후 연락드리겠습니다.</p>

        {/* 예약 상세 */}
        <div className="bg-gray-50 rounded-xl p-5 text-left text-sm space-y-2 mb-6">
          {name && (
            <p>
              <span className="text-gray-400 inline-block w-16">이름</span>
              <span className="font-medium text-gray-800">{name}</span>
            </p>
          )}
          {treatment && (
            <p>
              <span className="text-gray-400 inline-block w-16">시술</span>
              <span className="font-medium text-gray-800">{treatment}</span>
            </p>
          )}
          {date && (
            <p>
              <span className="text-gray-400 inline-block w-16">날짜</span>
              <span className="font-medium text-gray-800">{date}</span>
            </p>
          )}
          {time && (
            <p>
              <span className="text-gray-400 inline-block w-16">시간</span>
              <span className="font-medium text-gray-800">{time}</span>
            </p>
          )}
        </div>

        {/* 안내 문구 */}
        <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700 mb-6 text-left">
          <p className="font-medium mb-1">예약 변경/취소 안내</p>
          <p className="text-blue-600">
            예약 변경이나 취소가 필요하신 경우, 연락주시면 안내해드리겠습니다.
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
