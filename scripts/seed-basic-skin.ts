import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { webSkins, webSkinFiles } from '../src/drizzle/schema';
import { eq } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);

const BASIC_INDEX_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{SITE_NAME}}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>

<!-- 헤더 -->
<header class="header">
    <div class="container">
        <a href="/" class="logo">{{SITE_NAME}}</a>
        <nav class="nav">
            <a href="#about">소개</a>
            <a href="#services">서비스</a>
            <a href="#contact">문의</a>
        </nav>
    </div>
</header>

<!-- 히어로 -->
<section class="hero">
    <div class="container">
        <h1>{{SITE_NAME}}</h1>
        <p>고객의 아름다움을 위한 최선의 선택</p>
        <a href="#contact" class="btn-primary">상담 예약</a>
    </div>
</section>

<!-- 소개 -->
<section id="about" class="section">
    <div class="container">
        <h2 class="section-title">소개</h2>
        <p class="section-desc">
            안녕하세요, {{SITE_NAME}}입니다.<br>
            고객 한 분 한 분께 최상의 서비스를 제공하기 위해 노력하고 있습니다.
        </p>
    </div>
</section>

<!-- 서비스 -->
<section id="services" class="section section-alt">
    <div class="container">
        <h2 class="section-title">서비스</h2>
        <div class="card-grid">
            <div class="card">
                <div class="card-icon">✦</div>
                <h3>서비스 1</h3>
                <p>서비스 설명을 입력하세요.</p>
            </div>
            <div class="card">
                <div class="card-icon">✦</div>
                <h3>서비스 2</h3>
                <p>서비스 설명을 입력하세요.</p>
            </div>
            <div class="card">
                <div class="card-icon">✦</div>
                <h3>서비스 3</h3>
                <p>서비스 설명을 입력하세요.</p>
            </div>
        </div>
    </div>
</section>

<!-- 문의 -->
<section id="contact" class="section">
    <div class="container">
        <h2 class="section-title">오시는 길</h2>
        <div class="contact-info">
            <p><strong>전화:</strong> {{PHONE}}</p>
            <p><strong>주소:</strong> {{ADDRESS}}</p>
        </div>
    </div>
</section>

<!-- 푸터 -->
<footer class="footer">
    <div class="container">
        <p>&copy; {{SITE_NAME}}. All rights reserved.</p>
    </div>
</footer>

</body>
</html>`;

const BASIC_STYLE_CSS = `/* === 베이직스킨 === */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
:root {
    --primary: #cc222c;
    --primary-dark: #a51b23;
    --dark: #1a1a1a;
    --gray: #666;
    --light: #f8f8f8;
    --white: #fff;
    --radius: 10px;
    --max-w: 1100px;
}
body { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif; color: var(--dark); line-height: 1.7; }
a { text-decoration: none; color: inherit; }
.container { max-width: var(--max-w); margin: 0 auto; padding: 0 20px; }

/* 헤더 */
.header { position: sticky; top: 0; background: var(--white); border-bottom: 1px solid #eee; z-index: 100; }
.header .container { display: flex; align-items: center; justify-content: space-between; height: 64px; }
.logo { font-size: 20px; font-weight: 800; color: var(--primary); }
.nav { display: flex; gap: 28px; }
.nav a { font-size: 15px; font-weight: 500; color: var(--gray); transition: color 0.2s; }
.nav a:hover { color: var(--primary); }

/* 히어로 */
.hero {
    background: linear-gradient(135deg, var(--dark) 0%, #333 100%);
    color: var(--white); text-align: center; padding: 100px 20px;
}
.hero h1 { font-size: 42px; font-weight: 800; margin-bottom: 14px; }
.hero p { font-size: 18px; opacity: 0.85; margin-bottom: 32px; }
.btn-primary {
    display: inline-block; padding: 14px 36px; background: var(--primary); color: var(--white);
    border-radius: var(--radius); font-size: 16px; font-weight: 600; transition: background 0.2s;
}
.btn-primary:hover { background: var(--primary-dark); }

/* 섹션 */
.section { padding: 80px 0; }
.section-alt { background: var(--light); }
.section-title { font-size: 28px; font-weight: 700; text-align: center; margin-bottom: 16px; }
.section-desc { text-align: center; color: var(--gray); font-size: 16px; max-width: 600px; margin: 0 auto; }

/* 카드 그리드 */
.card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; margin-top: 40px; }
.card {
    background: var(--white); border-radius: var(--radius); padding: 32px 24px;
    text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.06); transition: transform 0.2s;
}
.card:hover { transform: translateY(-4px); }
.card-icon { font-size: 32px; margin-bottom: 16px; color: var(--primary); }
.card h3 { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
.card p { font-size: 14px; color: var(--gray); }

/* 문의 */
.contact-info { text-align: center; margin-top: 24px; color: var(--gray); font-size: 16px; }
.contact-info p { margin-bottom: 8px; }

/* 푸터 */
.footer { background: var(--dark); color: rgba(255,255,255,0.5); text-align: center; padding: 32px 20px; font-size: 13px; }

/* 반응형 */
@media (max-width: 768px) {
    .hero { padding: 60px 20px; }
    .hero h1 { font-size: 28px; }
    .nav { gap: 16px; }
    .nav a { font-size: 13px; }
    .section { padding: 50px 0; }
}`;

async function seed() {
  console.log('🌱 Seeding basic skin...');

  // 기존 basic 스킨이 있는지 확인
  const existing = await db.select().from(webSkins).where(eq(webSkins.slug, 'basic'));

  let skinId: number;

  if (existing.length > 0) {
    skinId = existing[0].id;
    console.log(`  ✓ Basic skin already exists (id=${skinId}), updating files...`);
    // 기존 파일 삭제 후 재삽입
    await db.delete(webSkinFiles).where(eq(webSkinFiles.skinId, skinId));
  } else {
    // 새로 생성
    const [skin] = await db.insert(webSkins).values({
      slug: 'basic',
      name: '베이직스킨',
      description: '깔끔하고 심플한 기본 웹사이트 템플릿. 모든 회원에게 무료 제공됩니다.',
      version: '1.0.0',
      category: 'general',
      isDefault: true,
      isFree: true,
      fileCount: 2,
      status: 'active',
    }).returning();
    skinId = skin.id;
    console.log(`  ✓ Created basic skin (id=${skinId})`);
  }

  // 파일 삽입
  await db.insert(webSkinFiles).values([
    {
      skinId,
      filename: 'index.html',
      fileType: 'html',
      content: BASIC_INDEX_HTML,
      fileSize: Buffer.byteLength(BASIC_INDEX_HTML, 'utf8'),
      isEntry: true,
      sortOrder: 0,
    },
    {
      skinId,
      filename: 'style.css',
      fileType: 'css',
      content: BASIC_STYLE_CSS,
      fileSize: Buffer.byteLength(BASIC_STYLE_CSS, 'utf8'),
      isEntry: false,
      sortOrder: 1,
    },
  ]);

  console.log(`  ✓ Inserted 2 skin files (index.html, style.css)`);
  console.log('✅ Basic skin seeding complete!');

  await client.end();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
