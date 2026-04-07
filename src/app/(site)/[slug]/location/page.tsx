import { notFound } from 'next/navigation';
import { getSiteBySlug, getSiteConfig } from '@/lib/site';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function LocationPage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site || site.status !== 'active') notFound();

  const base = await getSiteConfig(site.id, 'base');
  const address = base.address as string;
  const phone = base.phone as string;
  const businessHours = base.business_hours as string;
  const mapUrl = base.map_url as string;
  const mapEmbed = base.map_embed as string;

  return (
    <div className="bg-gray-50 min-h-[60vh]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">오시는 길</h1>

        {/* 지도 */}
        {mapEmbed ? (
          <div
            className="rounded-xl overflow-hidden mb-6 aspect-[4/3]"
            dangerouslySetInnerHTML={{ __html: mapEmbed }}
          />
        ) : mapUrl ? (
          <div className="rounded-xl overflow-hidden mb-6 aspect-[4/3]">
            <iframe src={mapUrl} className="w-full h-full border-0" allowFullScreen loading="lazy" />
          </div>
        ) : (
          <div className="rounded-xl bg-gray-200 aspect-[4/3] flex items-center justify-center mb-6">
            <div className="text-center text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm">지도가 설정되지 않았습니다</p>
            </div>
          </div>
        )}

        {/* 정보 */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-4">
          {address && (
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-gray-400">주소</div>
                <div className="font-medium">{address}</div>
              </div>
            </div>
          )}

          {phone && (
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-gray-400">전화번호</div>
                <a href={`tel:${phone}`} className="font-medium hover:text-[var(--color-primary)] transition">{phone}</a>
              </div>
            </div>
          )}

          {businessHours && (
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-gray-400">운영시간</div>
                <div className="font-medium whitespace-pre-line">{businessHours}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
