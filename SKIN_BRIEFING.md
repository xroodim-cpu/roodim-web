# 루딤웹 스킨 제작 작업용 — 환경/규칙/재료 브리핑

## 0) 저장소·배포 구조

**모노레포 루트**: `C:\Users\박선호\Documents\cursor\` (Windows, bash shell)

```
cursor/
├─ laravel/                      ← 루딤링크 어드민 (Laravel 12, PHP 8.2, Railway 배포)
│   └─ resources/skins/basic/    ← 기본 스킨 레퍼런스 구현 (index.html/header/footer/style.css/main.js)
├─ roodim-web/                   ← 루딤웹 (Next.js 15 App Router, Vercel 배포, PG DB)
│   ├─ src/lib/template-engine.ts      ← 치환코드 엔진 (이걸 기준으로 HTML 작성)
│   ├─ src/lib/admin-api.ts            ← Laravel 로 HMAC 호출 헬퍼
│   ├─ src/app/api/public/inquiry/     ← 문의 접수 엔드포인트
│   ├─ src/app/(site)/[slug]/page.tsx  ← 사이트 렌더 진입점
│   └─ src/drizzle/schema.ts           ← sites/web_skin_files/board* 스키마
├─ roodim-admin/laravel/         ← Railway 배포원 미러(master→main). 커밋은 반드시 양쪽 push
└─ .claude/worktrees/hardcore-davinci-1a114d/laravel/resources/skins/basic/SKIN_DEVELOPMENT.md
                                  ← 스킨 규칙 공식 매뉴얼 (이 브리핑의 원본)
```

**DB 상 스킨 저장 위치**: Postgres `roodim_web`.`web_skin_files` (파일명·타입·내용). 사이트 단위로 커스텀 스킨을 가지면 `site_files` 가 우선, 없으면 `web_skin_files` fallback.

> **레거시 WordPress 절대 손대지 말 것** (Cloudways 레거시). 루딤웹 = Next.js + PG, 루딤링크 = Laravel + MySQL(Railway).

---

## 1) 사이트 유형 5종 — 회원스킨 vs 고객스킨 정책 차이

`roodim_web.sites.site_type` enum:

| 값 | 분류 | 설명 | 업로드 경로 | 문의 라우팅 |
|---|---|---|---|---|
| `standalone` | **회원스킨** | 일반 회원 단독 사이트 | `/user/{user_id}/site/` | 루딤 마스터 조직 문의게시판(Laravel) |
| `rental` | **회원스킨** | 임대형 회원 사이트 | `/user/{user_id}/site/` | 루딤 마스터 조직 |
| `partner` | **회원스킨** | 파트너 본인 사이트 | `/user/{user_id}/site/` | 루딤 마스터 조직 |
| `creator` | **회원스킨** | 크리에이터 본인 사이트 | `/user/{user_id}/site/` | 루딤 마스터 조직 |
| `customer` | **고객스킨** | 파트너가 **자기 고객**을 위해 제작 | `/customer/{customer_id}/site/` | `admin_organization_id` (그 고객의 담당 파트너 조직) |

**핵심 개념 차이**:
- **회원스킨**은 "나(회원)의 사이트" — 회원의 와사비 경로, 문의는 루딤 본사로.
- **고객스킨**은 "파트너가 파는 사이트" — 파트너의 고객 고유 경로, 문의는 파트너 어드민으로.

HTML 자체는 두 유형 모두 같은 치환코드/루프/include 엔진을 쓰지만, **프리셋 구성 포인트가 다름**:

| 구분 | 회원스킨 | 고객스킨 |
|---|---|---|
| 주로 강조 필드 | 본인 브랜드·포트폴리오·소개 | 고객 업종 전문성, 상담 유도, 상품 상세 |
| `{{OWNER_*}}` | 회원 본인 | 파트너가 대리 입력한 고객 대표자 |
| 패키지/상품 루프 | 선택 | 필수에 가까움 (주문/문의 전환 목표) |
| 문의 폼 | 루딤 본사 상담팀이 응대 | 파트너 본인이 응대 → 운영 테스트 필수 |
| 페이지 수 | 풍부 (about/portfolio/blog) | 단일 랜딩 + 하위 1~2개로 충분한 케이스 多 |

---

## 2) 스킨 파일 구성 (6개 기본)

| 파일 | 타입 | 역할 | 엔트리 여부 |
|---|---|---|---|
| `index.html` | html | 메인 페이지 진입점 | `is_entry=true` |
| `style.css` | css | 전역 CSS | |
| `header.html` | html | 헤더 조각 (include 대상) | |
| `footer.html` | html | 푸터 조각 (include 대상) | |
| `main.js` | js | 슬라이더·FAQ 토글 등 전역 JS | |
| `data.json` | json | 브랜드온도·컬러·메타 기본값 | |

추가 서브페이지: `about.html`, `products.html`, `portfolio.html` 등 자유 추가. 링크는 `/{slug}/about.html` 같이 slug base 로 정규화됨.

---

## 3) 치환코드 전체 카탈로그 — `{{VARIABLE}}` 형식

### 3-A. 기본 정보 (`configs.base`)
| 코드 | 출처 |
|---|---|
| `{{COMPANY_NAME}}` | base.site_name |
| `{{REPRESENTATIVE}}` | base.representative |
| `{{PHONE}}` | base.phone |
| `{{EMAIL}}` | base.email |
| `{{ADDRESS}}` | base.address |
| `{{LOGO_URL}}` | base.logo_url (자산 URL 자동 정규화) |
| `{{BUSINESS_NUMBER}}` | base.business_number |
| `{{COPYRIGHT}}` | headerfooter.copyright |

### 3-B. 대표(Owner)
| 코드 | 출처 |
|---|---|
| `{{OWNER_NAME}}` | site_admins.name |
| `{{OWNER_PHOTO}}` | siteContents 'owner_profile'.thumbUrl |
| `{{OWNER_POSITION}}` | ownerMeta.position |
| `{{OWNER_EMAIL}}` | ownerMeta.email |
| `{{OWNER_PHONE}}` | ownerMeta.phone |

### 3-C. 브랜드 온도 (`configs.design.brand_temperature`)
| 코드 | 값 |
|---|---|
| `{{BRAND_TEMPERATURE}}` | `warm` \| `cool` \| `neutral` \| `bold` |
| `{{BRAND_TEMPERATURE_LABEL}}` | 따뜻한 / 시원한 / 중립적인 / 강렬한 |

사용 패턴: 최상위 래퍼에 `data-brand-temp="{{BRAND_TEMPERATURE}}"` → CSS `[data-brand-temp="warm"] { --accent: ... }` 로 톤 분기.

### 3-D. SEO/OG (`configs.seo`)
`{{META_TITLE}}`, `{{META_DESC}}`, `{{META_KEYWORDS}}`, `{{OG_TITLE}}`, `{{OG_DESC}}`, `{{OG_IMAGE}}`, `{{FAVICON_URL}}`, `{{ROBOTS}}` (기본 `index, follow`)

### 3-E. 자산 URL 자동 정규화
`{{LOGO_URL}}` 등이 `/storage/...` 로 시작하면 `ADMIN_API_URL` prefix 자동 부착. 따라서 스킨 작성자는 절대경로/상대경로 신경 쓸 필요 없음.

---

## 4) Include — 파일 삽입

```html
<!--@include("header.html")-->
<!--@include("footer.html")-->
```

또는 별칭(페이지별 on/off 가능):
```html
<!--@header-->
<!--@footer-->
```

재귀 치환 + 최대 3단계 depth 지원.

---

## 5) 배너 영역 (Banner Areas) — `roo-banner-area` + `area_id`

루딤링크 어드민에서 area 별로 배너 아이템을 관리. 스킨은 두 방식 중 선택:

### 5-A. 번호 기반 (특정 슬롯)
```html
<div class="roo-banner-area" area_id="gallery">
  <a href="{#link_1}" target="{#target_1}">{#img_1_or_video_1}<span>{#title_1}</span></a>
  <a href="{#link_2}" target="{#target_2}">{#img_2_or_video_2}<span>{#title_2}</span></a>
  ...
</div>
```

### 5-B. 루프 (전체 반복)
```html
<div class="roo-banner-area hero" area_id="hero">
  <!--@banner_loop-->
  <div class="slide" data-num="{#num}">
    <div class="media">{#img_or_video}</div>
    <span class="type">{#displayType}</span>
    <h2>{#title}</h2>
    <p>{#text}</p>
    <div>{#html}</div>
    <a href="{#link}" target="{#target}">자세히</a>
  </div>
  <!--@end_banner_loop-->
</div>
```

**루프 변수**: `{#num}` · `{#title}` · `{#text}` · `{#img}` · `{#video}` · `{#img_or_video}` (둘 중 있는 쪽 자동 선택) · `{#link}` · `{#target}` · `{#displayType}` · `{#html}` (HTML 서식)

---

## 6) 게시판 루프

### FAQ — 루딤링크 Laravel FAQ 게시판 연동
```html
<!--@faq_loop-->
<details class="faq__item" data-num="{#faq_num}">
  <summary>Q. {#faq_title}</summary>
  <div>A. {#faq_content}</div>
  <time>{#faq_date}</time>
</details>
<!--@end_faq_loop-->
```

### 포트폴리오
```html
<!--@portfolio_loop-->
<a href="{#link}" class="portfolio__item">
  <div class="thumb">{#thumb}</div>
  <span class="cat">{#category}</span>
  <h3>{#title}</h3>
  <p>{#excerpt}</p>
</a>
<!--@end_portfolio_loop-->
```

### Q&A (로컬 커스텀)
```html
<!--@qna_loop-->
<div>{#qna_title}: {#qna_content}</div>
<!--@end_qna_loop-->
```

---

## 7) 직원(Staff) 루프

```html
<!--@staff_loop-->
<article class="staff-card">
  <img src="{{STAFF_PHOTO}}" alt="{{STAFF_NAME}}" onerror="this.closest('.staff-card__photo').classList.add('is-empty');this.remove()">
  <h3>{{STAFF_NAME}}</h3>
  <p>{{STAFF_POSITION}}</p>
  <a href="tel:{{STAFF_PHONE}}">전화</a>
  <a href="mailto:{{STAFF_EMAIL}}">이메일</a>
</article>
<!--@end_staff_loop-->
```

변수: `{{STAFF_NAME}}`, `{{STAFF_PHOTO}}`, `{{STAFF_POSITION}}`, `{{STAFF_EMAIL}}`, `{{STAFF_PHONE}}`. (루프 내부에서는 `{{}}` 표기를 그대로 사용 — 엔진이 내부적으로 `{#name}` 류와 병존 지원)

---

## 8) 패키지/상품 루프

배너 루프와 동일 치환 변수 재사용 (`area_id="packages"` 사용 관습).
```html
<div class="roo-banner-area packages" area_id="packages">
  <!--@banner_loop-->
  <article class="package-card" data-tier="{#num}">
    <div class="badge">{#displayType}</div>
    <h3>{#title}</h3>
    <div class="price">{#text}</div>
    <div class="features">{#html}</div>
    <a href="{#link}" target="{#target}" class="btn">{#title} 문의</a>
  </article>
  <!--@end_banner_loop-->
</div>
```

---

## 9) 문의 폼 — `<form class="roo-inquiry">` 중요

스킨이 직접 작성한 form 에 `class="roo-inquiry"` 부여하면 엔진이 자동으로 submit 핸들러 주입. 내부 `<label>`+control 쌍을 순회해 `<p><strong>라벨</strong>: 값</p>` 로 합쳐 `{slug, content, mode:'unified'}` 로 `/api/public/inquiry` 에 POST.

### 표준 방식 (권장) — 자체 핸들러 주입
`form.roo-inquiry` 사용 시 template-engine 이 렌더 시점에 slug 를 JS 에 하드코딩해서 주입 → 커스텀 도메인이든 slug 경로든 항상 올바른 값 전달.

```html
<form class="roo-inquiry">
  <label for="f-name">성함</label>
  <input id="f-name" name="name" required>

  <label for="f-phone">연락처</label>
  <input id="f-phone" name="phone" required>

  <label for="f-email">이메일</label>
  <input id="f-email" name="email" type="email">

  <label for="f-msg">문의 내용</label>
  <textarea id="f-msg" name="message" rows="5"></textarea>

  <p id="roo-inquiry-msg" style="display:none"></p>
  <button type="submit" class="btn btn--primary">문의 접수</button>
</form>
```

### 커스텀 JS 방식 (`openForm()` 등 스킨 자체 모달)
스킨에 독자 openForm + fetch 코드가 있다면 **fetch body 에 반드시 `slug` 포함**:
```js
fetch('/api/public/inquiry', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ slug: '<사이트 slug>', content: '<HTML>', mode: 'unified' })
})
```
slug 주입 방법 3가지:
1. 템플릿에서 서버 렌더 시 하드코딩 (`const SLUG = '{{SITE_SLUG}}';`)
2. `location.pathname.split('/')[1]` — slug 경로 접속 시에만 유효, **커스텀 도메인(ondo-ad.com 등)에서는 빈 값이 되어 실패**
3. body 에 slug 를 생략 — API 가 Host/Referer/Origin 헤더로 `sites.custom_domain` 자동 매칭해 복구 (fallback)

### 라우팅 (roodim-web `/api/public/inquiry/route.ts`)
- body.slug 없음 → Host/Referer/Origin 헤더에서 자동 복구 (`custom_domain` 컬럼 매칭, 2026-04-23 추가)
- partner/creator + `adminOrganizationId` 있음 → Laravel HMAC 호출 → 파트너 어드민 문의게시판
- 그 외 (standalone/rental/customer) → roodim-web PG `boardPosts` 에 직접 저장
- 실패 시 PG fallback 으로 데이터 손실 방지

### 커스텀 도메인 사용 시 주의
- ondo-ad.com 처럼 `custom_domain` 매핑된 사이트는 URL 경로에 slug 가 없음 → 스킨 JS 가 `location.pathname` 으로 slug 를 구하면 **실패**
- 해결: (a) 표준 `form.roo-inquiry` 사용 또는 (b) slug 를 서버 렌더에서 하드코딩 또는 (c) slug 를 body 에 넣지 않고 API fallback 에 맡기기

간이 버전(모달 자동 생성): `<!--@inquiry_form-->` 한 줄 — 기본 4개 필드 모달이 렌더됨.

---

## 10) 주의사항 10대 규칙 (엔진 동작상 하드 룰)

1. **`src=""` 금지** — 치환 결과가 빈 문자열이면 엔진이 `<img>` 를 `<span class="roo-empty" data-empty="1" hidden>` 으로 자동 교체. 스킨 CSS 에서 `.rs:has([data-empty="1"]) { display:none }` 로 섹션 통째로 숨기기 가능.
2. **상대경로 CSS/JS** — `href="style.css"`, `src="main.js"`. `<base href="/{slug}/">` 주입돼 있어 루트 절대경로는 404.
3. **Material Symbols Rounded 아이콘** — `<span class="material-symbols-rounded">icon_name</span>`.
4. **Pretendard 폰트** — `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css`.
5. **모바일 우선 반응형**.
6. **data.json 포함** — 브랜드온도·컬러 기본값 저장.
7. **`<!--@banner_loop-->`/`<!--@end_banner_loop-->` 쌍** — 반드시 같은 `roo-banner-area` 안에, 주석 형태 정확히 유지.
8. **이미지 fallback** — `onerror="this.remove()"` 또는 `this.closest(...).classList.add('is-empty');this.remove()` 패턴.
9. **copyright/BUSINESS_NUMBER 치환은 안전하게** — 없을 때 섹션 자체가 비게 되므로 래퍼 노출 조건 처리.
10. **`target="_blank"` 은 `{#target}` 으로** — 외부/내부 구분은 어드민에서 설정, 스킨은 그대로 사용.

---

## 11) 와사비 S3 업로드 경로 규칙

| 용도 | 경로 |
|---|---|
| 회원 사이트 배너/마케팅/이미지 | `/user/{user_id}/site/` |
| 고객 임대사이트 배너/마케팅/이미지 | `/customer/{customer_id}/site/` |
| 고객 자료 | `/customer/{customer_id}/file/` |

스킨 작성자는 업로드 경로를 하드코딩하지 않음. 어드민이 업로드하면 자동으로 위 경로에 저장되고, 스킨은 치환코드/루프로 URL 을 받을 뿐.

> **고룸 업로드/와사비 관련 코드는 손대지 말 것** (안정 동작 중). 스킨 작성만 진행.

---

## 12) 사이트 유형별 추천 섹션 템플릿

### 회원스킨 (standalone/partner/creator) 권장 섹션 순서
1. HERO — `<!--@banner_loop-->` 대형 슬라이더 (area_id="hero")
2. ABOUT — `{{OWNER_PHOTO}}` + `{{OWNER_NAME}}` + 인사말
3. FEATURES/SERVICES — `area_id="features"` 배너 루프
4. PORTFOLIO — `<!--@portfolio_loop-->`
5. STAFF — `<!--@staff_loop-->`
6. FAQ — `<!--@faq_loop-->`
7. CONTACT — `{{PHONE}}`/`{{EMAIL}}`/`{{ADDRESS}}` + `<form class="roo-inquiry">`
8. FOOTER include

### 고객스킨 (customer) 권장 섹션 순서 — 전환 최적화
1. HERO — 강한 한줄 헤드라인 + CTA 버튼
2. PROBLEM/SOLUTION 블록 (PAS 프레임)
3. PACKAGES — `area_id="packages"` 배너 루프 (필수)
4. TESTIMONIALS — `area_id="reviews"` 배너 루프
5. FAQ — `<!--@faq_loop-->`
6. 강한 문의 CTA — `<form class="roo-inquiry">` + 유도 문구
7. CONTACT + FOOTER

---

## 13) 참고 레퍼런스 파일 위치 (새 세션에서 첫 Read)

**필독**:
- `.claude/worktrees/hardcore-davinci-1a114d/laravel/resources/skins/basic/SKIN_DEVELOPMENT.md` — 공식 매뉴얼
- `laravel/resources/skins/basic/index.html` — 섹션 구성 레퍼런스
- `roodim-web/src/lib/template-engine.ts` — 실제 치환 동작 코드
- `roodim-web/src/app/api/public/inquiry/route.ts` — 문의 라우팅 정책

**참조용**:
- `roodim-web/src/drizzle/schema.ts` — sites/web_skin_files/board 테이블 정의
- `laravel/app/Http/Controllers/BulletinApiController.php` — Laravel 쪽 문의 수신
- `laravel/resources/skins/basic/{header,footer,style.css,main.js}.html` — 기본 스킨 전체

---

## 14) 새 채팅 첫 액션 권장 순서

1. 위 **필독 파일 4개** Read (context 채우기)
2. 작업할 사이트의 유형 확정: "이번 스킨은 회원스킨(partner) 인가 고객스킨(customer) 인가?" → 유형별 섹션 템플릿 선택
3. 기본스킨 index.html 을 시작점으로 `cp laravel/resources/skins/basic/` → 신규 스킨 디렉토리로 복사
4. 치환코드·루프·include 규칙 준수하며 HTML/CSS/JS 수정
5. 로컬 검증: `npm run dev` (roodim-web) 으로 해당 slug 렌더 확인
6. 완료 시 DB 반영은 **별도 시더/마이그레이션** 으로 (직접 운영 DB INSERT 금지)

---

## 15) 절대 규칙 (루딤 운영 메모리에서 상속)

- 운영 사이트 오류 유발 금지 — 배포 전 로컬 serve 검증 필수
- 본서버 DB 데이터 삭제/수정 금지 (스킨 seed 는 `firstOrCreate` idempotent 패턴)
- 커밋 후 반드시 `origin/master` + `roodim-admin/main` 양쪽 push (Railway 배포원)
- 배포 후 브라우저 프리뷰로 직접 버튼/링크 클릭 검증
- Cloudways 레거시 WP 절대 금지 — 루딤웹은 Next.js + PG 가 유일한 진실

---

## 16) 사용법

새 채팅에서 스킨 작업 시 다음 한 줄로 호출:

```
스킨 적용작업 시 @SKIN_BRIEFING.md 규칙대로 파일구성에 맞게 적용해줘
```

이어서 제작한 스킨 파일(index.html 등)을 첨부하면, 이 브리핑 규칙에 따라 치환코드·루프·include 점검 후 적용됩니다.
