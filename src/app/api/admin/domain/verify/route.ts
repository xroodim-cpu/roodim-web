import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';
import { getDomain, isVercelApiEnabled, interpretStatus } from '@/lib/vercel-api';

/**
 * POST /api/admin/domain/verify
 * body: { slug }
 *
 * Vercel 에서 현재 도메인 검증 상태를 조회해 DB 에 반영.
 * UI 측의 2초 폴링에서 호출됨.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const slug = body?.slug;
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [current] = await db
    .select({
      customDomain: sites.customDomain,
      customDomainStatus: sites.customDomainStatus,
      customDomainVerifiedAt: sites.customDomainVerifiedAt,
    })
    .from(sites)
    .where(eq(sites.id, session.site_id))
    .limit(1);

  if (!current?.customDomain) {
    return NextResponse.json({
      ok: true,
      data: { customDomain: null, status: null, verifiedAt: null, verificationRecords: [] },
    });
  }

  if (!isVercelApiEnabled()) {
    return NextResponse.json({
      ok: true,
      data: {
        customDomain: current.customDomain,
        status: 'manual',
        verifiedAt: current.customDomainVerifiedAt,
        verificationRecords: [],
        vercelEnabled: false,
      },
    });
  }

  const vercelResp = await getDomain(current.customDomain);
  if (!vercelResp.ok) {
    // 에러 상태 저장
    await db.update(sites)
      .set({ customDomainStatus: 'error', updatedAt: new Date() })
      .where(eq(sites.id, session.site_id));
    return NextResponse.json({
      ok: true,
      data: {
        customDomain: current.customDomain,
        status: 'error',
        verifiedAt: current.customDomainVerifiedAt,
        verificationRecords: [],
        vercelEnabled: true,
        vercelError: vercelResp.error,
      },
    });
  }

  const status = interpretStatus(vercelResp.data);
  const records = vercelResp.data.verification || [];
  let verifiedAt = current.customDomainVerifiedAt;

  // 상태 변경이 있으면 DB 업데이트
  if (status !== current.customDomainStatus) {
    if (status === 'verified' && !verifiedAt) verifiedAt = new Date();
    await db.update(sites)
      .set({
        customDomainStatus: status,
        customDomainVerifiedAt: verifiedAt,
        updatedAt: new Date(),
      })
      .where(eq(sites.id, session.site_id));
  }

  return NextResponse.json({
    ok: true,
    data: {
      customDomain: current.customDomain,
      status,
      verifiedAt,
      verificationRecords: records,
      vercelEnabled: true,
    },
  });
}
