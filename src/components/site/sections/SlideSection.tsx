'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Slide {
  id: number;
  thumbUrl: string | null;
  title: string;
  summary: string | null;
}

interface SlideSectionProps {
  settings: Record<string, unknown>;
  contents: unknown[];
}

export default function SlideSection({ settings, contents }: SlideSectionProps) {
  const slides = contents as Slide[];
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const count = slides.length;

  const goTo = useCallback(
    (index: number) => {
      setCurrent((index + count) % count);
    },
    [count],
  );

  const next = useCallback(() => goTo(current + 1), [current, goTo]);

  // Auto-play
  useEffect(() => {
    if (count <= 1 || isPaused) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [count, isPaused, next]);

  // Swipe handlers
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchMove(e: React.TouchEvent) {
    touchEndX.current = e.touches[0].clientX;
  }

  function handleTouchEnd() {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;
    if (diff > threshold) {
      goTo(current + 1);
    } else if (diff < -threshold) {
      goTo(current - 1);
    }
  }

  if (count === 0) return null;

  return (
    <section
      className="relative overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        ref={containerRef}
        className="relative aspect-[16/7] md:aspect-[16/5]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
            style={{ opacity: i === current ? 1 : 0, zIndex: i === current ? 1 : 0 }}
            aria-hidden={i !== current}
          >
            {slide.thumbUrl && (
              <img
                src={slide.thumbUrl}
                alt={slide.title}
                className="w-full h-full object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
                draggable={false}
              />
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

            {/* Text overlay */}
            <div
              className="absolute bottom-6 left-6 right-6 md:bottom-10 md:left-10 md:right-10 text-white transition-all duration-700"
              style={{
                opacity: i === current ? 1 : 0,
                transform: i === current ? 'translateY(0)' : 'translateY(16px)',
              }}
            >
              <h2 className="text-xl md:text-3xl lg:text-4xl font-bold mb-1 md:mb-2 drop-shadow-md">
                {slide.title}
              </h2>
              {slide.summary && (
                <p className="text-sm md:text-base opacity-90 line-clamp-2 drop-shadow-sm max-w-xl">
                  {slide.summary}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Dots navigation */}
      {count > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`슬라이드 ${i + 1}`}
              className="group p-1"
            >
              <span
                className="block rounded-full transition-all duration-300"
                style={{
                  width: i === current ? 24 : 8,
                  height: 8,
                  background: i === current ? 'var(--color-primary, #cc222c)' : 'rgba(255,255,255,0.5)',
                }}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
