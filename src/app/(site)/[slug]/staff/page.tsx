import { notFound } from 'next/navigation';
import { getSiteBySlug, getContentsByType } from '@/lib/site';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function StaffPage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site || site.status !== 'active') notFound();

  const staffList = await getContentsByType(site.id, 'staff', 50);

  return (
    <div className="bg-gray-50 min-h-[60vh]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">의료진 소개</h1>

        {staffList.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            등록된 의료진 정보가 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {staffList.map(s => {
              const meta = s.metaJson as { role?: string; career?: string[] };
              return (
                <div key={s.id} className="bg-white rounded-xl overflow-hidden border border-gray-200 text-center">
                  {s.thumbUrl ? (
                    <div className="aspect-square overflow-hidden">
                      <img src={s.thumbUrl} alt={s.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-square bg-gray-100 flex items-center justify-center">
                      <svg className="w-20 h-20 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  <div className="p-5">
                    {meta.role && (
                      <span className="text-xs text-gray-400">{meta.role}</span>
                    )}
                    <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                    {s.summary && (
                      <p className="text-sm text-gray-500 mb-3">{s.summary}</p>
                    )}
                    {meta.career && meta.career.length > 0 && (
                      <ul className="text-xs text-gray-400 space-y-1 text-left">
                        {meta.career.map((c, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-gray-300">-</span>
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
