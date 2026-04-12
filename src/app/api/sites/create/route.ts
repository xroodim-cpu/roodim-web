import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites, siteConfigs, siteSections, siteCredentials, siteFiles } from '@/drizzle/schema';
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
  siteType?: 'standalone' | 'rental' | 'partner' | 'creator';
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

    // 4. standalone 사이트: 기본 파일 세트 생성
    if (siteType === 'standalone') {
      await db.insert(siteFiles).values(getDefaultSiteFiles(site.id, name));
    }

    // 5. 로그인 자격증명 생성 (제공된 경우)
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

/**
 * standalone 사이트 기본 파일 세트
 */
function getDefaultSiteFiles(siteId: string, siteName: string) {
  return [
    {
      siteId,
      filename: 'index.html',
      fileType: 'html',
      isEntry: true,
      sortOrder: 0,
      content: `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{COMPANY_NAME}}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
<!--@include("header.html")-->

<main>
    <section class="hero">
        <h1>{{COMPANY_NAME}}</h1>
        <p>환영합니다. 최고의 서비스를 제공합니다.</p>
    </section>

    <section class="staff-section">
        <h2>팀 소개</h2>
        <div class="staff-grid">
            <!--@staff_loop-->
            <div class="staff-card">
                <img src="{{STAFF_PHOTO}}" alt="{{STAFF_NAME}}" class="staff-photo">
                <h3>{{STAFF_NAME}}</h3>
                <p>{{STAFF_POSITION}}</p>
            </div>
            <!--@end_staff_loop-->
        </div>
    </section>
</main>

<!--@include("footer.html")-->
<script src="main.js"></script>
</body>
</html>`,
      fileSize: 0,
    },
    {
      siteId,
      filename: 'header.html',
      fileType: 'html',
      isEntry: false,
      sortOrder: 1,
      content: `<header class="site-header">
    <div class="header-inner">
        <a href="{{SITE_URL}}" class="logo">
            {{COMPANY_NAME}}
        </a>
        <nav class="main-nav">
            <a href="{{SITE_URL}}">홈</a>
            <a href="{{SITE_URL}}/about">소개</a>
            <a href="{{SITE_URL}}/contact">문의</a>
        </nav>
    </div>
</header>`,
      fileSize: 0,
    },
    {
      siteId,
      filename: 'footer.html',
      fileType: 'html',
      isEntry: false,
      sortOrder: 2,
      content: `<footer class="site-footer">
    <div class="footer-inner">
        <p>{{COMPANY_NAME}} | {{REPRESENTATIVE}}</p>
        <p>{{ADDRESS}}</p>
        <p>TEL: {{PHONE}} | EMAIL: {{EMAIL}}</p>
        <p>사업자등록번호: {{BUSINESS_NUMBER}}</p>
        <p class="copyright">{{COPYRIGHT}}</p>
    </div>
</footer>`,
      fileSize: 0,
    },
    {
      siteId,
      filename: 'style.css',
      fileType: 'css',
      isEntry: false,
      sortOrder: 3,
      content: `/* ${siteName} 스타일시트 */
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: 'Pretendard Variable', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #333;
    line-height: 1.6;
}
a { color: inherit; text-decoration: none; }

/* 헤더 */
.site-header {
    position: sticky; top: 0; z-index: 100;
    background: #fff; border-bottom: 1px solid #eee;
}
.header-inner {
    max-width: 1200px; margin: 0 auto;
    padding: 16px 24px;
    display: flex; justify-content: space-between; align-items: center;
}
.logo { font-size: 20px; font-weight: 800; color: #111; }
.main-nav { display: flex; gap: 24px; }
.main-nav a { font-size: 15px; font-weight: 500; color: #555; transition: color 0.2s; }
.main-nav a:hover { color: #111; }

/* 히어로 */
.hero {
    text-align: center; padding: 80px 24px;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}
.hero h1 { font-size: 36px; font-weight: 800; margin-bottom: 12px; }
.hero p { font-size: 18px; color: #666; }

/* 직원 섹션 */
.staff-section { padding: 60px 24px; max-width: 1200px; margin: 0 auto; }
.staff-section h2 { text-align: center; font-size: 24px; margin-bottom: 32px; }
.staff-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 24px;
}
.staff-card { text-align: center; padding: 24px; }
.staff-photo {
    width: 120px; height: 120px; border-radius: 50%;
    object-fit: cover; margin-bottom: 12px;
}
.staff-card h3 { font-size: 16px; font-weight: 700; }
.staff-card p { font-size: 14px; color: #888; }

/* 푸터 */
.site-footer {
    background: #1a1a1a; color: #aaa; padding: 40px 24px;
    text-align: center; font-size: 14px; line-height: 1.8;
}
.footer-inner { max-width: 1200px; margin: 0 auto; }
.copyright { margin-top: 16px; color: #666; }

/* 반응형 */
@media (max-width: 768px) {
    .hero { padding: 48px 16px; }
    .hero h1 { font-size: 28px; }
    .main-nav { gap: 16px; }
    .main-nav a { font-size: 14px; }
    .staff-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
}`,
      fileSize: 0,
    },
    {
      siteId,
      filename: 'main.js',
      fileType: 'js',
      isEntry: false,
      sortOrder: 4,
      content: `// ${siteName} 스크립트
document.addEventListener('DOMContentLoaded', function() {
    console.log('Site loaded');
});`,
      fileSize: 0,
    },
  ];
}
