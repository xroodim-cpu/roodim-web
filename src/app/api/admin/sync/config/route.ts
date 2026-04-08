import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites, siteConfigs } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { verifyHmacRequest } from '@/lib/hmac-verify';

const VALID_SECTIONS = ['base', 'seo', 'headerfooter', 'products', 'policy', 'design', 'reserve', 'domain'];

/**
 * POST /api/admin/sync/config
 * HMAC 인증으로 어드민에서 사이트 설정을 동기화
 */
export async function POST(req: NextRequest) {
  const bodyText = await req.text();

  // HMAC 인증
  if (!verifyHmacRequest(req.headers, bodyText)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { slug: string; section: string; data: Record<string, unknown> };
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { slug, section, data } = body;

  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  if (!section) return NextResponse.json({ error: 'section is required' }, { status: 400 });
  if (data === undefined) return NextResponse.json({ error: 'data is required' }, { status: 400 });
  if (!VALID_SECTIONS.includes(section)) {
    return NextResponse.json({ error: `Invalid section: ${section}` }, { status: 400 });
  }

  try {
    // slug로 사이트 조회
    const [site] = await db
      .select({ id: sites.id })
      .from(sites)
      .where(eq(sites.slug, slug))
      .limit(1);

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // site_configs upsert
    const existing = await db
      .select({ id: siteConfigs.id })
      .from(siteConfigs)
      .where(and(eq(siteConfigs.siteId, site.id), eq(siteConfigs.section, section)))
      .limit(1);

    let row;
    if (existing[0]) {
      [row] = await db
        .update(siteConfigs)
        .set({ data, updatedAt: new Date() })
        .where(and(eq(siteConfigs.siteId, site.id), eq(siteConfigs.section, section)))
        .returning();
    } else {
      [row] = await db
        .insert(siteConfigs)
        .values({ siteId: site.id, section, data, updatedAt: new Date() })
        .returning();
    }

    return NextResponse.json({ ok: true, section, updatedAt: row.updatedAt });
  } catch (e) {
    console.error('Sync config error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/admin/sync/config?slug=xxx&section=base
 * HMAC 인증으로 사이트 설정 조회
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const slug = searchParams.get('slug');

  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  // HMAC 인증 (GET은 body가 없으므로 빈 문자열)
  if (!verifyHmacRequest(req.headers, '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // slug로 사이트 조회
    const [site] = await db
      .select({ id: sites.id })
      .from(sites)
      .where(eq(sites.slug, slug))
      .limit(1);

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const section = searchParams.get('section');

    if (section) {
      // 특정 섹션만 조회
      const rows = await db
        .select()
        .from(siteConfigs)
        .where(and(eq(siteConfigs.siteId, site.id), eq(siteConfigs.section, section)))
        .limit(1);

      return NextResponse.json({
        ok: true,
        data: rows[0]?.data ?? null,
      });
    }

    // 전체 섹션 조회
    const rows = await db
      .select()
      .from(siteConfigs)
      .where(eq(siteConfigs.siteId, site.id));

    const configMap: Record<string, unknown> = {};
    for (const row of rows) {
      configMap[row.section] = row.data;
    }

    return NextResponse.json({ ok: true, data: configMap });
  } catch (e) {
    console.error('Get config error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
