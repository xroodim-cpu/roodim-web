import { notFound } from 'next/navigation';
import { getSiteBySlug, getAllSiteConfigs, getContentsByType } from '@/lib/site';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return {};
  const configs = await getAllSiteConfigs(site.id);
  const base = configs['base'] || {};
  const siteName = (base.site_name as string) || site.name;
  return {
    title: `이벤트 | ${siteName}`,
    description: `${siteName}의 이벤트 페이지입니다.`,
  };
}

export default async function EventPage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site || site.status !== 'active') notFound();

  const events = await getContentsByType(site.id, 'event', 50);
  const now = new Date();

  // 진행중 / 종료 분리
  const active = events.filter(e => !e.endAt || new Date(e.endAt) >= now);
  const ended = events.filter(e => e.endAt && new Date(e.endAt) < now);

  return (
    <div className="bg-gray-50 min-h-[60vh]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">이벤트</h1>

        {events.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            현재 진행 중인 이벤트가 없습니다.
          </div>
        ) : (
          <>
            {/* 진행중 */}
            {active.length > 0 && (
              <div className="space-y-4 mb-10">
                {active.map(e => (
                  <div key={e.id} className="bg-white rounded-xl overflow-hidden border border-gray-200 flex flex-col sm:flex-row">
                    {e.thumbUrl && (
                      <div className="sm:w-60 flex-shrink-0">
                        <img src={e.thumbUrl} alt={e.title} className="w-full h-48 sm:h-full object-cover" />
                      </div>
                    )}
                    <div className="p-5 flex-1">
                      <span className="inline-block px-2 py-0.5 text-xs font-bold rounded-full text-white mb-2"
                        style={{ background: 'var(--color-primary)' }}>
                        진행중
                      </span>
                      <h3 className="text-lg font-bold mb-2">{e.title}</h3>
                      {e.summary && <p className="text-sm text-gray-500 mb-3">{e.summary}</p>}
                      {(e.startAt || e.endAt) && (
                        <p className="text-xs text-gray-400">
                          {e.startAt && new Date(e.startAt).toLocaleDateString('ko-KR')}
                          {e.startAt && e.endAt && ' ~ '}
                          {e.endAt && new Date(e.endAt).toLocaleDateString('ko-KR')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 종료 */}
            {ended.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-4 text-gray-400">종료된 이벤트</h2>
                <div className="space-y-3 opacity-60">
                  {ended.map(e => (
                    <div key={e.id} className="bg-white rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-3">
                        <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-500">종료</span>
                        <span className="font-medium text-sm">{e.title}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
