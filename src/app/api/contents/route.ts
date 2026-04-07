import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites, siteContents } from '@/drizzle/schema';
import { eq, and, asc, desc } from 'drizzle-orm';

/**
 * GET /api/contents?slug=xxx&type=treat&limit=50
 * 사이트 콘텐츠 조회 (공개 API)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const type = searchParams.get('type');
    const limit = Math.min(Number(searchParams.get('limit') || '50'), 100);

    if (!slug || !type) {
      return NextResponse.json({ error: 'slug와 type은 필수입니다.' }, { status: 400 });
    }

    // 사이트 확인
    const site = await db.select({ id: sites.id })
      .from(sites)
      .where(and(eq(sites.slug, slug), eq(sites.status, 'active')))
      .limit(1);

    if (!site[0]) {
      return NextResponse.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 콘텐츠 조회
    const contents = await db.select({
      id: siteContents.id,
      type: siteContents.type,
      slug: siteContents.slug,
      title: siteContents.title,
      summary: siteContents.summary,
      thumbUrl: siteContents.thumbUrl,
      metaJson: siteContents.metaJson,
      sortOrder: siteContents.sortOrder,
    })
      .from(siteContents)
      .where(and(
        eq(siteContents.siteId, site[0].id),
        eq(siteContents.type, type),
        eq(siteContents.isVisible, true)
      ))
      .orderBy(asc(siteContents.sortOrder), desc(siteContents.createdAt))
      .limit(limit);

    return NextResponse.json({ ok: true, contents });
  } catch (error) {
    console.error('Contents API error:', error);
    return NextResponse.json({ error: '콘텐츠 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
