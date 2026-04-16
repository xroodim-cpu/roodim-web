import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';
import {
  addDomain,
  getDomain,
  removeDomain,
  isVercelApiEnabled,
  interpretStatus,
  type VerificationRecord,
} from '@/lib/vercel-api';

// Domain format validation
function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  const pattern = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.[a-zA-Z0-9-]{1,63})*\.[a-zA-Z]{2,}$/;
  return pattern.test(domain);
}

/** 수동 CNAME 플로우 폴백 값 */
function manualRecords(domain: string | null): VerificationRecord[] {
  return [
    {
      type: 'CNAME',
      domain: domain || '(your-domain.com)',
      value: 'cname.vercel-dns.com',
    },
  ];
}

/**
 * GET /api/admin/domain?slug=xxx
 * 현재 도메인 + Vercel 검증 상태 반환.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slug = searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db
    .select({
      customDomain: sites.customDomain,
      customDomainStatus: sites.customDomainStatus,
      customDomainVerifiedAt: sites.customDomainVerifiedAt,
    })
    .from(sites)
    .where(eq(sites.id, session.site_id))
    .limit(1);

  const site = rows[0];
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  // Vercel API 가 비활성이면 manual 상태로 응답
  if (!isVercelApiEnabled()) {
    return NextResponse.json({
      ok: true,
      data: {
        customDomain: site.customDomain || null,
        status: site.customDomain ? 'manual' : null,
        verifiedAt: site.customDomainVerifiedAt,
        verificationRecords: manualRecords(site.customDomain),
        vercelEnabled: false,
      },
    });
  }

  // 도메인 없으면 바로 반환
  if (!site.customDomain) {
    return NextResponse.json({
      ok: true,
      data: {
        customDomain: null,
        status: null,
        verifiedAt: null,
        verificationRecords: [],
        vercelEnabled: true,
      },
    });
  }

  // Vercel 에서 현재 검증 상태 조회 (pending / error 면 verification 레코드 동봉)
  const vercelResp = await getDomain(site.customDomain);
  let status = site.customDomainStatus || 'pending';
  let records: VerificationRecord[] = [];
  let verifiedAt = site.customDomainVerifiedAt;

  if (vercelResp.ok) {
    status = interpretStatus(vercelResp.data);
    records = vercelResp.data.verification || [];
    if (status === 'verified' && !verifiedAt) {
      verifiedAt = new Date();
      // DB 갱신 — fire-and-forget 은 안 씀, 응답 일관성을 위해 await
      await db.update(sites)
        .set({ customDomainStatus: 'verified', customDomainVerifiedAt: verifiedAt, updatedAt: new Date() })
        .where(eq(sites.id, session.site_id));
    } else if (status !== site.customDomainStatus) {
      // 상태 변경된 경우만 DB 갱신
      await db.update(sites)
        .set({ customDomainStatus: status, updatedAt: new Date() })
        .where(eq(sites.id, session.site_id));
    }
  } else {
    status = 'error';
  }

  return NextResponse.json({
    ok: true,
    data: {
      customDomain: site.customDomain,
      status,
      verifiedAt,
      verificationRecords: records,
      vercelEnabled: true,
      vercelError: vercelResp.ok ? undefined : vercelResp.error,
    },
  });
}

/**
 * PUT /api/admin/domain
 * body: { slug, domain }
 * 커스텀 도메인 설정 — 저장 시 Vercel 프로젝트에 자동 등록.
 */
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { slug, domain } = body;

  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 빈 문자열 → 해제
  const cleanDomain = domain ? domain.trim().toLowerCase() : null;

  if (cleanDomain && !isValidDomain(cleanDomain)) {
    return NextResponse.json(
      { error: '올바른 도메인 형식이 아닙니다. (예: example.com)' },
      { status: 400 },
    );
  }

  // 다른 사이트가 점유 중인지 검사
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

  // 현재 도메인 조회 — 변경되면 기존 도메인은 Vercel 에서 제거
  const [current] = await db
    .select({ customDomain: sites.customDomain })
    .from(sites)
    .where(eq(sites.id, session.site_id))
    .limit(1);

  const oldDomain = current?.customDomain || null;

  // Vercel API 비활성 — DB 만 저장하고 manual 플로우 반환
  if (!isVercelApiEnabled()) {
    await db.update(sites)
      .set({
        customDomain: cleanDomain,
        customDomainStatus: cleanDomain ? 'manual' : null,
        customDomainVerifiedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(sites.id, session.site_id));

    return NextResponse.json({
      ok: true,
      data: {
        customDomain: cleanDomain,
        status: cleanDomain ? 'manual' : null,
        verifiedAt: null,
        verificationRecords: manualRecords(cleanDomain),
        vercelEnabled: false,
      },
    });
  }

  // 기존 도메인이 바뀌었다면 Vercel 에서 제거 (best-effort)
  if (oldDomain && oldDomain !== cleanDomain) {
    const r = await removeDomain(oldDomain);
    if (!r.ok) {
      console.warn('[domain PUT] remove old domain failed:', oldDomain, r.error);
    }
  }

  let status: 'pending' | 'verified' | 'error' | 'manual' | null = null;
  let records: VerificationRecord[] = [];
  let verifiedAt: Date | null = null;
  let vercelError: string | undefined;

  if (cleanDomain) {
    const added = await addDomain(cleanDomain);
    if (added.ok) {
      status = interpretStatus(added.data);
      records = added.data.verification || [];
      if (status === 'verified') verifiedAt = new Date();
    } else {
      // Vercel 이 에러를 반환 — 상태는 error 로 저장하되 DB 는 갱신해 사용자가 재시도 가능
      status = 'error';
      vercelError = added.error;
      console.warn('[domain PUT] Vercel addDomain failed:', cleanDomain, added.error);
    }
  }

  await db.update(sites)
    .set({
      customDomain: cleanDomain,
      customDomainStatus: status,
      customDomainVerifiedAt: verifiedAt,
      updatedAt: new Date(),
    })
    .where(eq(sites.id, session.site_id));

  return NextResponse.json({
    ok: true,
    data: {
      customDomain: cleanDomain,
      status,
      verifiedAt,
      verificationRecords: records,
      vercelEnabled: true,
      vercelError,
    },
  });
}
