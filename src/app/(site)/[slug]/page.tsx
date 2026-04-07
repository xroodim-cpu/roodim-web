import { notFound } from 'next/navigation';
import { getSiteBySlug, getAllSiteConfigs, getActiveSections, getContentsByType } from '@/lib/site';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function SitePage({ params }: PageProps) {
  const { slug } = await params;

  const site = await getSiteBySlug(slug);
  if (!site || site.status !== 'active') notFound();

  const configs = await getAllSiteConfigs(site.id);
  const sections = await getActiveSections(site.id);

  // 섹션별 콘텐츠 미리 로드
  const sectionData: Record<string, unknown[]> = {};
  for (const section of sections) {
    const contentType = sectionKeyToContentType(section.sectionKey);
    if (contentType) {
      sectionData[section.sectionKey] = await getContentsByType(site.id, contentType, 10);
    }
  }

  const base = configs['base'] || {};

  return (
    <>
      {/* 섹션 렌더링 */}
      {sections.map((section) => (
        <SectionRenderer
          key={section.id}
          slug={slug}
          sectionKey={section.sectionKey}
          settings={section.settings as Record<string, unknown>}
          contents={sectionData[section.sectionKey] || []}
          siteConfig={base}
        />
      ))}

      {/* 섹션이 없을 때 기본 화면 */}
      {sections.length === 0 && (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">{(base.site_name as string) || site.name}</h1>
            <p className="text-gray-500">{(base.tagline as string) || '준비 중입니다.'}</p>
          </div>
        </div>
      )}
    </>
  );
}

function sectionKeyToContentType(key: string): string | null {
  const map: Record<string, string> = {
    slide: 'slide',
    treat: 'treat',
    tips: 'tip',
    beforeafter: 'beforeafter',
    event: 'event',
  };
  return map[key] || null;
}

function SectionRenderer({
  slug,
  sectionKey,
  settings,
  contents,
  siteConfig,
}: {
  slug: string;
  sectionKey: string;
  settings: Record<string, unknown>;
  contents: unknown[];
  siteConfig: Record<string, unknown>;
}) {
  // 각 섹션 컴포넌트 (Phase 4에서 세부 구현)
  switch (sectionKey) {
    case 'slide':
      return <SlideSection settings={settings} contents={contents} />;
    case 'treat':
      return <TreatSection slug={slug} settings={settings} contents={contents} />;
    case 'event':
      return <EventSection slug={slug} settings={settings} contents={contents} />;
    case 'beforeafter':
      return <BeforeAfterSection settings={settings} contents={contents} />;
    case 'tips':
      return <TipsSection settings={settings} contents={contents} />;
    case 'map':
      return <MapSection siteConfig={siteConfig} />;
    case 'reserve_cta':
      return <ReserveCtaSection slug={slug} settings={settings} />;
    default:
      return (
        <section className="py-12 px-4" data-section={sectionKey}>
          <div className="max-w-6xl mx-auto text-center text-gray-400 text-sm">
            [{sectionKey}] 섹션 — 콘텐츠 {contents.length}개
          </div>
        </section>
      );
  }
}

/* ===== 섹션 컴포넌트들 ===== */

function SlideSection({ settings, contents }: { settings: Record<string, unknown>; contents: unknown[] }) {
  const slides = contents as { id: number; thumbUrl: string | null; title: string; summary: string | null }[];
  if (slides.length === 0) return null;

  return (
    <section className="relative">
      <div className="overflow-hidden">
        {/* 첫 번째 슬라이드만 기본 표시 (클라이언트 슬라이더는 Phase 4) */}
        {slides[0]?.thumbUrl && (
          <div className="relative aspect-[16/7] md:aspect-[16/5]">
            <img src={slides[0].thumbUrl} alt={slides[0].title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute bottom-8 left-8 text-white">
              <h2 className="text-2xl md:text-4xl font-bold mb-2">{slides[0].title}</h2>
              {slides[0].summary && <p className="text-sm md:text-base opacity-90">{slides[0].summary}</p>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function TreatSection({ slug, settings, contents }: { slug: string; settings: Record<string, unknown>; contents: unknown[] }) {
  const treats = contents as { id: number; title: string; thumbUrl: string | null; slug: string; metaJson: { price?: number; category?: string } }[];

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {settings.title ? <h2 className="text-2xl font-bold text-center mb-8">{String(settings.title)}</h2> : null}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {treats.map(t => (
            <a key={t.id} href={`/${slug}/treat/${t.slug}`} className="group">
              <div className="aspect-square rounded-xl overflow-hidden mb-2 bg-gray-100">
                {t.thumbUrl ? (
                  <img src={t.thumbUrl} alt={t.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
              <h3 className="font-bold text-sm">{t.title}</h3>
              {t.metaJson?.price && (
                <div className="text-sm font-bold mt-0.5" style={{ color: 'var(--color-primary)' }}>
                  {Number(t.metaJson.price).toLocaleString()}원
                </div>
              )}
            </a>
          ))}
        </div>
        <div className="text-center mt-8">
          <a href={`/${slug}/treat`} className="inline-block px-6 py-2.5 border border-gray-300 rounded-full text-sm font-medium hover:bg-gray-50 transition">
            전체 보기
          </a>
        </div>
      </div>
    </section>
  );
}

function EventSection({ slug, settings, contents }: { slug: string; settings: Record<string, unknown>; contents: unknown[] }) {
  const events = contents as { id: number; title: string; thumbUrl: string | null; summary: string | null; startAt: string | null; endAt: string | null }[];

  return (
    <section className="py-12 px-4 bg-[var(--color-accent)]">
      <div className="max-w-6xl mx-auto">
        {settings.title ? <h2 className="text-2xl font-bold text-center mb-8">{String(settings.title)}</h2> : null}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map(e => (
            <div key={e.id} className="bg-white rounded-xl overflow-hidden border border-gray-200 flex">
              {e.thumbUrl && (
                <div className="w-32 flex-shrink-0">
                  <img src={e.thumbUrl} alt={e.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4 flex-1">
                <h3 className="font-bold text-sm mb-1">{e.title}</h3>
                {e.summary && <p className="text-xs text-gray-500 line-clamp-2">{e.summary}</p>}
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <a href={`/${slug}/event`} className="inline-block px-6 py-2.5 border border-gray-300 rounded-full text-sm font-medium hover:bg-white transition">
            전체 보기
          </a>
        </div>
      </div>
    </section>
  );
}

function BeforeAfterSection({ settings, contents }: { settings: Record<string, unknown>; contents: unknown[] }) {
  const items = contents as { id: number; title: string; metaJson: { before_url?: string; after_url?: string } }[];

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {settings.title ? <h2 className="text-2xl font-bold text-center mb-8">{String(settings.title)}</h2> : null}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-xl overflow-hidden border border-gray-200">
              <div className="grid grid-cols-2 gap-0.5 bg-gray-200">
                <div className="relative aspect-[4/3]">
                  {item.metaJson?.before_url ? (
                    <img src={item.metaJson.before_url} alt="Before" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">Before</div>
                  )}
                  <span className="absolute top-2 left-2 bg-gray-900/70 text-white text-xs px-2 py-0.5 rounded">Before</span>
                </div>
                <div className="relative aspect-[4/3]">
                  {item.metaJson?.after_url ? (
                    <img src={item.metaJson.after_url} alt="After" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">After</div>
                  )}
                  <span className="absolute top-2 left-2 text-white text-xs px-2 py-0.5 rounded" style={{ background: 'var(--color-primary)' }}>After</span>
                </div>
              </div>
              <div className="p-3 text-center">
                <span className="text-sm font-medium">{item.title}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TipsSection({ settings, contents }: { settings: Record<string, unknown>; contents: unknown[] }) {
  const tips = contents as { id: number; title: string; thumbUrl: string | null; summary: string | null }[];

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {settings.title ? <h2 className="text-2xl font-bold text-center mb-8">{String(settings.title)}</h2> : null}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tips.map(t => (
            <div key={t.id} className="bg-white rounded-xl overflow-hidden border border-gray-200">
              {t.thumbUrl && (
                <div className="aspect-[16/9] overflow-hidden">
                  <img src={t.thumbUrl} alt={t.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <h3 className="font-bold text-sm mb-1">{t.title}</h3>
                {t.summary && <p className="text-xs text-gray-500 line-clamp-3">{t.summary}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MapSection({ siteConfig }: { siteConfig: Record<string, unknown> }) {
  const address = siteConfig.address as string;
  const mapEmbed = siteConfig.map_embed as string;

  return (
    <section className="py-12 px-4 bg-[var(--color-accent)]">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">오시는 길</h2>
        {mapEmbed ? (
          <div className="rounded-xl overflow-hidden aspect-[16/7]" dangerouslySetInnerHTML={{ __html: mapEmbed }} />
        ) : address ? (
          <div className="text-center text-gray-600">{address}</div>
        ) : null}
      </div>
    </section>
  );
}

function ReserveCtaSection({ slug, settings }: { slug: string; settings: Record<string, unknown> }) {
  return (
    <section className="py-16 px-4 text-center" style={{ background: 'var(--color-primary)' }}>
      <div className="max-w-2xl mx-auto text-white">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">
          {(settings.title as string) || '지금 예약하세요'}
        </h2>
        <p className="opacity-90 mb-8">
          {(settings.subtitle as string) || '전문 상담을 통해 최적의 시술을 추천드립니다.'}
        </p>
        <a
          href={`/${slug}/reserve`}
          className="inline-block px-8 py-4 bg-white rounded-full font-bold text-lg transition hover:shadow-lg"
          style={{ color: 'var(--color-primary)' }}
        >
          예약하기
        </a>
      </div>
    </section>
  );
}
