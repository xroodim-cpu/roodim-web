'use client';

import { useRef } from 'react';

interface Treat {
  id: number;
  title: string;
  thumbUrl: string | null;
  slug: string;
  metaJson: { price?: number; category?: string };
}

interface TreatSectionProps {
  slug: string;
  settings: Record<string, unknown>;
  contents: unknown[];
}

export default function TreatSection({ slug, settings, contents }: TreatSectionProps) {
  const treats = contents as Treat[];
  const scrollRef = useRef<HTMLDivElement>(null);

  if (treats.length === 0) return null;

  return (
    <section className="py-10 md:py-14">
      <div className="max-w-6xl mx-auto">
        {settings.title ? (
          <h2 className="text-xl md:text-2xl font-bold text-center mb-2 px-4">
            {String(settings.title)}
          </h2>
        ) : null}
        {settings.subtitle ? (
          <p className="text-sm text-gray-500 text-center mb-6 px-4">
            {String(settings.subtitle)}
          </p>
        ) : null}
        {!settings.subtitle && settings.title ? <div className="mb-6" /> : null}

        {/* Mobile: horizontal scroll / Desktop: grid */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth px-4 pb-2 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:pb-0 scrollbar-hide"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {treats.map((t) => (
            <a
              key={t.id}
              href={`/${slug}/treat/${t.slug}`}
              className="flex-shrink-0 w-[45vw] snap-start md:w-auto group"
            >
              <div className="aspect-square rounded-xl overflow-hidden mb-2 bg-gray-100 relative">
                {t.thumbUrl ? (
                  <img
                    src={t.thumbUrl}
                    alt={t.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 rounded-xl" />
              </div>
              <h3 className="font-bold text-sm group-hover:text-[var(--color-primary)] transition-colors duration-200 line-clamp-1">
                {t.title}
              </h3>
              {t.metaJson?.category && (
                <span className="text-xs text-gray-400">{t.metaJson.category}</span>
              )}
              {t.metaJson?.price != null && t.metaJson.price > 0 && (
                <div
                  className="text-sm font-bold mt-0.5"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {Number(t.metaJson.price).toLocaleString()}원
                </div>
              )}
            </a>
          ))}
        </div>

        <div className="text-center mt-8 px-4">
          <a
            href={`/${slug}/treat`}
            className="inline-block px-8 py-2.5 border border-gray-300 rounded-full text-sm font-medium hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all duration-300"
          >
            전체 보기
          </a>
        </div>
      </div>

      {/* Hide scrollbar utility */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
}
