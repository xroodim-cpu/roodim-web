import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites, siteConfigs, siteSections, siteCredentials } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { verifyHmacRequest } from '@/lib/hmac-verify';
import crypto from 'crypto';

// 템플릿별 기본 섹션 구성
const TEMPLATE_SECTIONS: Record<string, { key: string; order: number; settings: Record<string, string> }[]> = {
  default: [
    { key: 'slide', order: 1, settings: { title: '메인 슬라이드' } },
    { key: 'treat', order: 2, settings: { title: '시술 소개', subtitle: '전문 시술을 만나보세요' } },
    { key: 'reserve_cta', order: 3, settings: { title: '지금 예약하세요' } },
  ],
  beauty: [
    { key: 'slide', order: 1, settings: { title: '메인 슬라이드' } },
    { key: 'treat', order: 2, settings: { title: '시술 소개', subtitle: '전문 시술을 만나보세요' } },
    { key: 'beforeafter', order: 3, settings: { title: '비포/애프터' } },
    { key: 'event', order: 4, settings: { title: '이벤트' } },
    { key: 'reserve_cta', order: 5, settings: { title: '지금 예약하세요' } },
    { key: 'map', order: 6, settings: { title: '오시는 길' } },
  ],
  minimal: [
    { key: 'slide', order: 1, settings: { title: '메인 슬라이드' } },
    { key: 'treat', order: 2, settings: { title: '서비스 소개' } },
    { key: 'reserve_cta', order: 3, settings: { title: '문의하기' } },
  ],
};

interface CreateSiteBody {
  slug: string;
  name: string;
  siteType?: 'rental' | 'partner' | 'creator';
  templateId?: string;
  adminCustomerId?: number;
  adminMemberId?: number;
  adminOrganizationId?: number;
  // 로그인 자격증명
  credentialEmail?: string;
  credentialPassword?: string;
  credentialName?: string;
}

export async function POST(req: NextRequest) {
  const bodyText = await req.text();

  // HMAC 인증
  if (!verifyHmacRequest(req.headers, bodyText)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: CreateSiteBody;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { slug, name, siteType = 'rental', templateId = 'default' } = body;

  if (!slug || !name) {
    return NextResponse.json({ error: 'slug and name are required' }, { status: 400 });
  }

  // slug 중복 확인
  const existing = await db.select({ id: sites.id })
    .from(sites)
    .where(eq(sites.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ error: 'slug already exists' }, { status: 409 });
  }

  try {
    // 1. 사이트 생성
    const [site] = await db.insert(sites).values({
      slug,
      name,
      siteType,
      templateId,
      status: 'active',
      adminCustomerId: body.adminCustomerId ?? null,
      adminMemberId: body.adminMemberId ?? null,
      adminOrganizationId: body.adminOrganizationId ?? null,
    }).returning();

    // 2. 기본 설정 (base, design)
    await db.insert(siteConfigs).values([
      {
        siteId: site.id,
        section: 'base',
        data: { site_name: name },
      },
      {
        siteId: site.id,
        section: 'design',
        data: { primary_color: '#cc222c', accent_color: '#1a1a1a', font: 'Pretendard, sans-serif' },
      },
    ]);

    // 3. 템플릿 기반 기본 섹션
    const sections = TEMPLATE_SECTIONS[templateId] || TEMPLATE_SECTIONS.default;
    if (sections.length > 0) {
      await db.insert(siteSections).values(
        sections.map(s => ({
          siteId: site.id,
          sectionKey: s.key,
          sortOrder: s.order,
          isActive: true,
          settings: s.settings,
        }))
      );
    }

    // 4. 로그인 자격증명 생성 (제공된 경우)
    let credentialId: number | null = null;
    if (body.credentialEmail && body.credentialPassword) {
      const bcryptHash = await hashPassword(body.credentialPassword);
      const [cred] = await db.insert(siteCredentials).values({
        siteId: site.id,
        email: body.credentialEmail,
        passwordHash: bcryptHash,
        name: body.credentialName || name,
        adminCustomerId: body.adminCustomerId ?? null,
        adminMemberId: body.adminMemberId ?? null,
      }).returning({ id: siteCredentials.id });
      credentialId = cred.id;
    }

    return NextResponse.json({
      ok: true,
      data: {
        siteId: site.id,
        slug: site.slug,
        credentialId,
      },
    }, { status: 201 });
  } catch (e) {
    console.error('Site creation error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * bcrypt-style password hashing using Node.js crypto
 * Format: $pbkdf2-sha256$iterations$salt$hash
 */
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const iterations = 100000;
  const keyLength = 32;

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, keyLength, 'sha256', (err, derivedKey) => {
      if (err) reject(err);
      resolve(`$pbkdf2$${iterations}$${salt.toString('base64')}$${derivedKey.toString('base64')}`);
    });
  });
}
