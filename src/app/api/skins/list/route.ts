import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { webSkins, orgSkinPurchases } from '@/drizzle/schema';
import { eq, or, and } from 'drizzle-orm';

// GET /api/skins/list?organizationId=123
// 무료 스킨 + 해당 조직이 구매한 스킨 반환
export async function GET(request: NextRequest) {
  try {
    const organizationId = request.nextUrl.searchParams.get('organizationId');

    // 무료 + 활성 스킨
    const freeSkins = await db.select().from(webSkins)
      .where(and(eq(webSkins.isFree, true), eq(webSkins.status, 'active')));

    let purchasedSkins: typeof freeSkins = [];
    if (organizationId) {
      // 구매한 스킨
      const purchases = await db.select({ skinId: orgSkinPurchases.skinId })
        .from(orgSkinPurchases)
        .where(eq(orgSkinPurchases.organizationId, parseInt(organizationId)));

      if (purchases.length > 0) {
        const skinIds = purchases.map(p => p.skinId);
        purchasedSkins = await db.select().from(webSkins)
          .where(and(
            eq(webSkins.status, 'active'),
            // skinId in purchased list
            or(...skinIds.map(id => eq(webSkins.id, id)))
          ));
      }
    }

    // 합치고 중복 제거
    const allSkins = [...freeSkins];
    for (const ps of purchasedSkins) {
      if (!allSkins.find(s => s.id === ps.id)) {
        allSkins.push(ps);
      }
    }

    return NextResponse.json({ skins: allSkins });
  } catch (error) {
    console.error('Skins list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
