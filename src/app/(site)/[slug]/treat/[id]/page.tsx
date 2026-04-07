import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { sites, siteContents } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function TreatDetailPage({ params }: PageProps) {
  const { slug, id } = await params;

  const site = await db.select()
    .from(sites)
    .where(and(eq(sites.slug, slug), eq(sites.status, 'active')))
    .limit(1);

  if (!site[0]) notFound();

  const content = await db.select()
    .from(siteContents)
    .where(and(
      eq(siteContents.siteId, site[0].id),
      eq(siteContents.type, 'treat'),
      eq(siteContents.slug, id),
      eq(siteContents.isVisible, true)
    ))
    .limit(1);

  if (!content[0]) notFound();

  const treat = content[0];
  const meta = treat.metaJson as { price?: number; category?: string; duration?: string };

  return (
    <div className="bg-gray-50 min-h-[60vh]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* 뒤로가기 */}
        <Link href={`/${slug}/treat`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          시술 목록
        </Link>

        {/* 썸네일 */}
        {treat.thumbUrl && (
          <div className="rounded-2xl overflow-hidden mb-6">
            <img src={treat.thumbUrl} alt={treat.title} className="w-full object-cover max-h-[400px]" />
          </div>
        )}

        {/* 정보 */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
          {meta.category && (
            <span className="inline-block px-3 py-1 bg-gray-100 text-gray-500 text-xs rounded-full mb-3">
              {meta.category}
            </span>
          )}
          <h1 className="text-2xl font-bold mb-3">{treat.title}</h1>

          {treat.summary && (
            <p className="text-gray-600 mb-4">{treat.summary}</p>
          )}

          <div className="flex items-center gap-6 text-sm">
            {meta.price && (
              <div>
                <span className="text-gray-400">가격</span>
                <div className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
                  {Number(meta.price).toLocaleString()}원
                </div>
              </div>
            )}
            {meta.duration && (
              <div>
                <span className="text-gray-400">소요시간</span>
                <div className="font-bold">{meta.duration}</div>
              </div>
            )}
          </div>
        </div>

        {/* 상세 내용 */}
        {treat.content && (
          <div
            className="bg-white rounded-xl p-6 border border-gray-200 prose prose-sm max-w-none mb-6"
            dangerouslySetInnerHTML={{ __html: treat.content }}
          />
        )}

        {/* 예약 CTA */}
        <Link
          href={`/${slug}/reserve`}
          className="block w-full text-center py-4 rounded-xl text-white font-bold text-lg transition hover:opacity-90"
          style={{ background: 'var(--color-primary)' }}
        >
          이 시술 예약하기
        </Link>
      </div>
    </div>
  );
}
