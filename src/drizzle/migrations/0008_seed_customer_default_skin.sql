-- 고객웹스킨 기본 스킨 시드
-- 고객 임대사이트 생성 시 기본으로 적용될 최소 스킨 (추후 디자인 업그레이드 예정)

-- 1) 기본 고객 스킨 마스터 레코드
INSERT INTO "web_skins" (
  "slug", "name", "description", "target_type", "category",
  "is_default", "is_free", "version", "status", "file_count"
) VALUES (
  'customer-default-v1',
  '고객 기본 스킨',
  '고객 임대사이트의 기본 템플릿. 고객 어드민으로 내용 수정 가능.',
  'customer',
  'general',
  true,
  true,
  '1.0.0',
  'active',
  3
)
ON CONFLICT ("slug") DO UPDATE SET
  "target_type" = 'customer',
  "is_default" = true,
  "status" = 'active',
  "updated_at" = now();
--> statement-breakpoint

-- 2) 스킨 파일: index.html (최상위 엔트리)
INSERT INTO "web_skin_files" ("skin_id", "filename", "file_type", "content", "is_entry", "sort_order", "file_size")
SELECT
  (SELECT "id" FROM "web_skins" WHERE "slug" = 'customer-default-v1'),
  'index.html',
  'html',
  '<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{site_name}}</title>
  <meta name="description" content="{{tagline}}">
  {{#if favicon_url}}<link rel="icon" href="{{favicon_url}}">{{/if}}
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header class="site-header">
    <div class="container">
      {{#if logo_url}}<img src="{{logo_url}}" alt="{{site_name}}" class="logo">{{/if}}
      <div class="brand">
        <h1 class="site-name">{{site_name}}</h1>
        {{#if tagline}}<p class="tagline">{{tagline}}</p>{{/if}}
      </div>
    </div>
  </header>

  <main>
    <section class="hero">
      <div class="container">
        <h2>{{site_name}}에 오신 것을 환영합니다</h2>
        {{#if representative}}<p class="intro">대표: {{representative}}</p>{{/if}}
      </div>
    </section>

    <section class="info">
      <div class="container">
        <div class="info-grid">
          {{#if phone}}
          <div class="info-item">
            <strong>전화</strong>
            <a href="tel:{{phone}}">{{phone}}</a>
          </div>
          {{/if}}
          {{#if email}}
          <div class="info-item">
            <strong>이메일</strong>
            <a href="mailto:{{email}}">{{email}}</a>
          </div>
          {{/if}}
          {{#if address}}
          <div class="info-item">
            <strong>주소</strong>
            <span>{{address}}</span>
          </div>
          {{/if}}
        </div>
      </div>
    </section>

    <section class="cta">
      <div class="container">
        <p>문의 및 상담은 위 연락처로 연락주세요.</p>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container">
      <p>&copy; {{year}} {{site_name}}{{#if business_number}} · 사업자등록번호 {{business_number}}{{/if}}</p>
      <p class="footer-meta">Powered by <a href="https://roodim.com" target="_blank" rel="noopener">루딤</a></p>
    </div>
  </footer>

  <script src="/main.js"></script>
</body>
</html>',
  true,
  0,
  2000
ON CONFLICT ("skin_id", "filename") DO UPDATE SET
  "content" = EXCLUDED."content",
  "file_size" = EXCLUDED."file_size",
  "updated_at" = now();
--> statement-breakpoint

-- 3) 스킨 파일: style.css
INSERT INTO "web_skin_files" ("skin_id", "filename", "file_type", "content", "is_entry", "sort_order", "file_size")
SELECT
  (SELECT "id" FROM "web_skins" WHERE "slug" = 'customer-default-v1'),
  'style.css',
  'css',
  '*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Pretendard","Apple SD Gothic Neo",sans-serif;color:#222;line-height:1.6;background:#fff}
a{color:inherit;text-decoration:none}
.container{max-width:960px;margin:0 auto;padding:0 20px}

.site-header{padding:24px 0;border-bottom:1px solid #eee}
.site-header .container{display:flex;align-items:center;gap:16px}
.logo{width:48px;height:48px;border-radius:8px;object-fit:cover}
.site-name{font-size:20px;font-weight:700;margin:0}
.tagline{font-size:13px;color:#888;margin:4px 0 0}

.hero{padding:60px 0;background:linear-gradient(135deg,#cc222c0d,#cc222c03);text-align:center}
.hero h2{font-size:28px;font-weight:700;margin:0 0 12px}
.hero .intro{font-size:15px;color:#555;margin:0}

.info{padding:60px 0}
.info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px}
.info-item{padding:20px;border:1px solid #eee;border-radius:12px;background:#fafafa}
.info-item strong{display:block;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}
.info-item a,.info-item span{font-size:16px;color:#222;font-weight:500}
.info-item a:hover{color:#cc222c}

.cta{padding:40px 0;background:#cc222c;color:#fff;text-align:center}
.cta p{margin:0;font-size:15px}

.site-footer{padding:32px 0;text-align:center;font-size:13px;color:#888;border-top:1px solid #eee}
.site-footer p{margin:4px 0}
.footer-meta a{color:#cc222c;font-weight:500}

@media (max-width:640px){
  .hero{padding:40px 0}
  .hero h2{font-size:22px}
  .info{padding:40px 0}
}',
  false,
  1,
  1400
ON CONFLICT ("skin_id", "filename") DO UPDATE SET
  "content" = EXCLUDED."content",
  "file_size" = EXCLUDED."file_size",
  "updated_at" = now();
--> statement-breakpoint

-- 4) 스킨 파일: main.js (빈 껍데기, 추후 확장)
INSERT INTO "web_skin_files" ("skin_id", "filename", "file_type", "content", "is_entry", "sort_order", "file_size")
SELECT
  (SELECT "id" FROM "web_skins" WHERE "slug" = 'customer-default-v1'),
  'main.js',
  'js',
  '// 고객 기본 스킨 - 인터랙션 스크립트
(function(){
  // 외부 링크 새창 자동 적용
  document.querySelectorAll(''a[href^="http"]:not([href*="'' + location.hostname + ''"])'').forEach(function(a){
    a.setAttribute(''target'',''_blank'');
    a.setAttribute(''rel'',''noopener'');
  });
})();',
  false,
  2,
  200
ON CONFLICT ("skin_id", "filename") DO UPDATE SET
  "content" = EXCLUDED."content",
  "file_size" = EXCLUDED."file_size",
  "updated_at" = now();
