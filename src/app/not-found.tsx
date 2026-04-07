import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <p className="text-7xl font-bold text-gray-200 mb-4">404</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-gray-500 mb-8">
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
