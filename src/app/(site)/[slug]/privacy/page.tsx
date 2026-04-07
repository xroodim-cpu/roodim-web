import { notFound } from 'next/navigation';
import { getSiteBySlug, getSiteConfig } from '@/lib/site';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PrivacyPage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site || site.status !== 'active') notFound();

  const policy = await getSiteConfig(site.id, 'policy');
  const privacyHtml = policy.privacy as string;

  return (
    <div className="bg-gray-50 min-h-[60vh]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">개인정보 처리방침</h1>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          {privacyHtml ? (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: privacyHtml }}
            />
          ) : (
            <p className="text-gray-400 text-center py-10">개인정보 처리방침이 등록되지 않았습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
