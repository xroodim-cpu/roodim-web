interface ReserveCtaSectionProps {
  slug: string;
  settings: Record<string, unknown>;
}

export default function ReserveCtaSection({ slug, settings }: ReserveCtaSectionProps) {
  return (
    <section className="relative py-20 px-4 overflow-hidden">
      {/* Gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, var(--color-primary, #cc222c) 0%, color-mix(in srgb, var(--color-primary, #cc222c), #000 25%) 100%)',
        }}
      />

      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 opacity-10 rounded-full -translate-y-1/2 translate-x-1/3 bg-white" />
      <div className="absolute bottom-0 left-0 w-48 h-48 opacity-10 rounded-full translate-y-1/3 -translate-x-1/4 bg-white" />

      <div className="relative z-10 max-w-2xl mx-auto text-center text-white">
        {/* Animated entrance via CSS */}
        <div className="cta-animate">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-3 leading-tight">
            {(settings.title as string) || '지금 예약하세요'}
          </h2>
          <p className="text-base md:text-lg opacity-90 mb-8 leading-relaxed">
            {(settings.subtitle as string) || '전문 상담을 통해 최적의 시술을 추천드립니다.'}
          </p>
          <a
            href={`/${slug}/reserve`}
            className="inline-block px-10 py-4 bg-white rounded-full font-bold text-base md:text-lg transition-all duration-300 hover:shadow-xl hover:scale-105 active:scale-100"
            style={{ color: 'var(--color-primary, #cc222c)' }}
          >
            예약하기
          </a>
        </div>
      </div>

      {/* Scroll-triggered animation */}
      <style>{`
        @keyframes ctaFadeUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .cta-animate {
          animation: ctaFadeUp 0.8s ease-out both;
          animation-timeline: view();
          animation-range: entry 0% entry 40%;
        }
        @supports not (animation-timeline: view()) {
          .cta-animate {
            animation: ctaFadeUp 0.8s ease-out 0.2s both;
          }
        }
      `}</style>
    </section>
  );
}
