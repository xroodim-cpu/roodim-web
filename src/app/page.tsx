import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-gray-900">루딤웹</span>
          <Link
            href="/admin/sso"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition"
          >
            어드민 로그인
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-2xl text-center py-24">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-tight mb-6">
            임대형 사이트 플랫폼
          </h1>
          <p className="text-lg text-gray-500 mb-10 max-w-lg mx-auto leading-relaxed">
            전문적인 웹사이트를 코드 없이 운영하세요.
            <br />
            예약, 콘텐츠 관리, 커스텀 도메인까지 한 곳에서.
          </p>
          <Link
            href="/admin/sso"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition"
          >
            어드민에서 시작하기
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>

        {/* Features */}
        <div className="max-w-4xl w-full grid grid-cols-1 sm:grid-cols-3 gap-6 pb-24">
          {[
            {
              title: '사이트 관리',
              desc: '섹션, 콘텐츠, 메뉴를 직관적인 어드민에서 관리합니다.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              ),
            },
            {
              title: '예약 시스템',
              desc: '온라인 상담 예약을 받고 일정을 한눈에 관리하세요.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ),
            },
            {
              title: '커스텀 도메인',
              desc: '나만의 도메인을 연결해 브랜드 아이덴티티를 완성하세요.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              ),
            },
          ].map((f) => (
            <div
              key={f.title}
              className="border border-gray-200 rounded-xl p-6 hover:border-gray-300 transition"
            >
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 mb-4">
                {f.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6">
        <p className="text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} 루딤웹. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
