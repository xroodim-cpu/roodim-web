import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';

// Domain format validation
function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  const pattern = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.[a-zA-Z0-9-]{1,63})*\.[a-zA-Z]{2,}$/;
  return pattern.test(domain);
}

/**
 * GET /api/admin/domain?slug=xxx
 * Returns the current custom domain for the site
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slug = searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db
    .select({ customDomain: sites.customDomain })
    .from(sites)
    .where(eq(sites.id, session.site_id))
    .limit(1);

  const site = rows[0];
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  return NextResponse.json({
    ok: true,
    data: {
      customDomain: site.customDomain || null,
      dnsInstructions: {
        type: 'CNAME',
        name: site.customDomain || '(your-domain.com)',
        value: 'roodim-web.vercel.app',
        note: 'DNS 설정 후 반영까지 최대 48시간이 소요될 수 있습니다.',
      },
    },
  });
}

/**
 * PUT /api/admin/domain
 * body: { slug, domain }
 * Updates the custom domain for the site
 */
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { slug, domain } = body;

  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Allow clearing the domain
  const cleanDomain = domain ? domain.trim().toLowerCase() : null;

  if (cleanDomain && !isValidDomain(cleanDomain)) {
    return NextResponse.json(
      { error: '올바른 도메인 형식이 아닙니다. (예: example.com)' },
      { status: 400 },
    );
  }

  // Check if domain is already taken by another site
  if (cleanDomain) {
    const existing = await db
      .select({ id: sites.id })
      .from(sites)
      .where(eq(sites.customDomain, cleanDomain))
      .limit(1);

    if (existing.length > 0 && existing[0].id !== session.site_id) {
      return NextResponse.json(
        { error: '이미 다른 사이트에서 사용 중인 도메인입니다.' },
        { status: 409 },
      );
    }
  }

  const [updated] = await db
    .update(sites)
    .set({ customDomain: cleanDomain, updatedAt: new Date() })
    .where(eq(sites.id, session.site_id))
    .returning({ customDomain: sites.customDomain });

  return NextResponse.json({
    ok: true,
    data: {
      customDomain: updated.customDomain,
      dnsInstructions: {
        type: 'CNAME',
        name: cleanDomain || '(your-domain.com)',
        value: 'roodim-web.vercel.app',
        note: 'DNS 설정 후 반영까지 최대 48시간이 소요될 수 있습니다.',
      },
    },
  });
}
