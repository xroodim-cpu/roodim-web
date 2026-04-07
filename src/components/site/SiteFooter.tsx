interface SiteFooterProps {
  siteName: string;
  settings: Record<string, unknown>;
  base: Record<string, unknown>;
}

export default function SiteFooter({ siteName, settings, base }: SiteFooterProps) {
  const phone = base.phone as string;
  const address = base.address as string;
  const businessInfo = base.business_info as string;
  const copyright = (settings.copyright as string) || `${new Date().getFullYear()} ${siteName}`;

  return (
    <footer className="bg-gray-900 text-gray-400 py-10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-lg font-bold text-white mb-4">{siteName}</div>

        <div className="space-y-1 text-sm">
          {phone && (
            <p>
              <span className="text-gray-500">TEL</span>{' '}
              <a href={`tel:${phone}`} className="hover:text-white transition">{phone}</a>
            </p>
          )}
          {address && (
            <p><span className="text-gray-500">ADDRESS</span> {address}</p>
          )}
          {businessInfo && (
            <p className="text-gray-500 text-xs mt-2 whitespace-pre-line">{businessInfo}</p>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-800 text-xs text-gray-500">
          &copy; {copyright}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
