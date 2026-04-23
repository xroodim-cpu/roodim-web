import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites, webSkins } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { getAdminSession } from '@/lib/admin-session';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/skins/[id] — 스킨 메타 조회
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const skinId = parseInt(id);
  if (isNaN(skinId)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

  const [skin] = await db.select().from(webSkins).where(eq(webSkins.id, skinId)).limit(1);
  if (!skin) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    ok: true,
    skin: {
      id: skin.id,
      slug: skin.slug,
      name: skin.name,
      description: skin.description,
      version: skin.version,
      category: skin.category,
      targetType: skin.targetType,
      isFree: skin.isFree,
      status: skin.status,
      fileCount: skin.fileCount,
      updatedAt: skin.updatedAt,
    },
  });
}

/**
 * PATCH /api/skins/[id] — 스킨 이름·설명 수정
 *
 * 권한: 로그인한 어드민 세션의 사이트가 이 스킨을 적용 중인 경우만 허용
 *       (다른 사이트가 쓰는 스킨이나 마스터 스킨 임의 수정 차단)
 *
 * body: { name?: string, description?: string }
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const skinId = parseInt(id);
  if (isNaN(skinId)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

  // 1. 인증
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. 권한: 본 사이트가 이 스킨을 적용 중이어야 함
  const [site] = await db.select({ skinId: sites.skinId })
    .from(sites)
    .where(eq(sites.id, session.site_id))
    .limit(1);

  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  if (site.skinId !== skinId) {
    return NextResponse.json(
      { error: '본 사이트에 적용된 스킨만 수정할 수 있습니다.' },
      { status: 403 },
    );
  }

  // 3. body 파싱 + validation
  const body = await req.json().catch(() => ({}));
  const { name, description } = body as { name?: string; description?: string };

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof name === 'string') {
    const trimmed = name.trim();
    if (trimmed.length === 0) return NextResponse.json({ error: 'name 비어있을 수 없음' }, { status: 400 });
    if (trimmed.length > 255) return NextResponse.json({ error: 'name 255자 초과' }, { status: 400 });
    updates.name = trimmed;
  }
  if (typeof description === 'string') {
    updates.description = description;
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: 'name 또는 description 필요' }, { status: 400 });
  }

  // 4. UPDATE
  const [updated] = await db.update(webSkins)
    .set(updates)
    .where(eq(webSkins.id, skinId))
    .returning({
      id: webSkins.id,
      name: webSkins.name,
      description: webSkins.description,
      updatedAt: webSkins.updatedAt,
    });

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true, skin: updated });
}
