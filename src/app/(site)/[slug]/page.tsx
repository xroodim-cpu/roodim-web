import { notFound } from 'next/navigation';
import { getSiteBySlug, getAllSiteConfigs, getActiveSections, getContentsByType } from '@/lib/site';
import SlideSection from '@/components/site/sections/SlideSection';
import TreatSection from '@/components/site/sections/TreatSection';
import ReserveCtaSection from '@/components/site/sections/ReserveCtaSection';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return {};
  const configs = await getAllSiteConfigs(site.id);
  const seo = configs['seo'] || {};
  const base = configs['base'] || {};
  return {
    title: (seo.meta_title as string) || (base.site_name as string) || site.name,
    description: (seo.meta_description as string) || (base.tagline as string) || '',
    openGraph: {
      title: (seo.meta_title as string) || site.name,
      description: (seo.meta_description as string) || '',
      images: seo.og_image ? [{ url: seo.og_image as string }] : [],
    },
  };
}

export default async function SitePage({ params }: PageProps) {
  const { slug } = await params;

  const site = await getSiteBySlug(slug);
  if (!site) notFound();

  // 웹서비스 구독 만료(30일 경과) → 사이트 차단
  if (site.status === 'suspended') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">사이트 이용이 중단되었습니다</h1>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">웹서비스 구독이 만료되어 홈페이지가 차단되었습니다.<br />담당자에게 결제 확인을 요청해주세요.</p>
          <p className="text-xs text-gray-400">문의: 루딤 고객센터</p>
        </div>
      </div>
    );
  }

  if (site.status !== 'active') notFound();

  // configs + sections 병렬
  const [configs, sections] = await Promise.all([
    getAllSiteConfigs(site.id),
    getActiveSections(site.id),
  ]);

  // 섹션별 콘텐츠 병렬 로드 (기존 for-await 직렬 → Promise.all 병렬)
  const sectionData: Record<string, unknown[]> = {};
  const sectionFetches = sections
    .map((section) => {
      const contentType = sectionKeyToContentType(section.sectionKey);
      if (!contentType) return null;
      return getContentsByType(site.id, contentType, 10).then((rows) => {
        sectionData[section.sectionKey] = rows;
      });
    })
    .filter((p): p is Promise<void> => p !== null);
  await Promise.all(sectionFetches);

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

/* ===== Inline sections (simpler, kept here) ===== */

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
