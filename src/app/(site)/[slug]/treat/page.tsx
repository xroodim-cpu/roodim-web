import { notFound } from 'next/navigation';
import { getSiteBySlug, getContentsByType } from '@/lib/site';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TreatListPage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site || site.status !== 'active') notFound();

  const treats = await getContentsByType(site.id, 'treat', 100);

  // 카테고리별 그룹핑
  const grouped: Record<string, typeof treats> = {};
  for (const t of treats) {
    const cat = (t.metaJson as { category?: string })?.category || '전체';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(t);
  }

  const categories = Object.keys(grouped);

  return (
    <div className="bg-gray-50 min-h-[60vh]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">시술 안내</h1>

        {categories.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            등록된 시술이 없습니다.
          </div>
        ) : (
          categories.map(cat => (
            <div key={cat} className="mb-10">
              {categories.length > 1 && (
                <h2 className="text-lg font-bold mb-4 pb-2 border-b border-gray-200">{cat}</h2>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {grouped[cat].map(t => {
                  const meta = t.metaJson as { price?: number; category?: string };
                  return (
                    <Link
                      key={t.id}
                      href={`/${slug}/treat/${t.slug}`}
                      className="bg-white rounded-xl overflow-hidden border border-gray-200 hover:shadow-md transition group"
                    >
                      {t.thumbUrl ? (
                        <div className="aspect-[4/3] overflow-hidden">
                          <img
                            src={t.thumbUrl}
                            alt={t.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        </div>
                      ) : (
                        <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center">
                          <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="p-4">
                        <h3 className="font-bold text-sm mb-1">{t.title}</h3>
                        {t.summary && (
                          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{t.summary}</p>
                        )}
                        {meta.price && (
                          <div className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
                            {Number(meta.price).toLocaleString()}원
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
