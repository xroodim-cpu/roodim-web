# 루딤웹 고객 어드민 - Phase 1 구현 완료 (2026-04-15)

## 📋 개요
루딤웹에 고객(rental_sites 소유자)을 위한 전용 어드민 인터페이스 구현.
- 라우트: `/admin/[slug]/` (동적 라우팅으로 사이트별 격리)
- 인증: SSO + credential 기반 dual 지원
- 메뉴: 대시보드, 예약, 작업, 시술, 사이트, 워크보드(조건부)

## ✅ Phase 1 완성 항목

### 1. 데이터베이스 스키마 (Drizzle)
- `site_services`: 시술/상품 관리
- `site_info`: 사이트 기본정보
- `workboards`: 협업 보드
- `workboard_members`: 보드 멤버 초대
- `roodim_sync_logs`: 동기화 로그

**마이그레이션**: `src/drizzle/migrations/0002_stiff_vargas.sql`

### 2. 공통 레이아웃 컴포넌트
**파일**: `src/app/admin/[slug]/AdminLayout.tsx` + `.module.css`
- Sidebar: 240px (카카오스타일 기준, --accent: #cc222c)
- Top Header: 60px (로고, 프로필 버튼)
- 반응형: 768px 이하에서 사이드바 토글
- 활성 메뉴 표시 (좌측 border-left + highlight)

### 3. 메뉴별 페이지

#### 3.1 대시보드 (`/admin/[slug]/dashboard`)
- 통계 카드 3개: 오늘의 예약, 미처리 작업, 방문자
- 최근 활동 리스트
- **데이터**: Postgres에서 직접 조회 (reservations, maintenanceRequests)

#### 3.2 예약 관리 (`/admin/[slug]/reservations`)
- 테이블 뷰: 고객명, 전화, 시술명, 예약일, 상태
- 상태 배지: pending(노란색), confirmed(파란색), cancelled(빨간색), completed(녹색)
- 수정 버튼

#### 3.3 작업 관리 (`/admin/[slug]/work`)
- 필터 바: 상태별 (전체, 대기, 검토, 진행, 완료)
- 카드형 목록: 제목, 분류, 우선순위, 생성일
- 클릭하면 상세 페이지로 이동

#### 3.4 작업 상세 (`/admin/[slug]/work/[id]`)
- 헤더: 제목, 설명, 상태 배지
- 메타정보: 분류, 우선순위, 등록일
- 채팅: 메시지 스레드 + 입력창
- 메시지 타입: customer(좌측), staff(우측, #cc222c 배경)

#### 3.5 시술 / 사이트 (`/services`, `/site`)
- Placeholder (준비 중)
- Phase 2에서 구현

### 4. API 엔드포인트

```
GET/POST /api/admin/maintenance
  - 유지보수 요청 조회/생성
  - Query: ?slug=xxx&status=pending (필터링)

GET/PUT /api/admin/maintenance/[id]
  - 단일 요청 상세 조회
  - 상태 업데이트 (pending→reviewing→working→done)

POST /api/admin/maintenance/[id]/messages
  - 메시지 생성

GET /api/admin/maintenance/sync
  - MySQL↔Postgres 동기화 엔드포인트 (구조만 완성)
  - TODO: roodim-link API 호출 로직
```

## 🔧 기술 스택

| 레이어 | 기술 |
|-------|------|
| Frontend | React 18 + Next.js 15 (App Router) |
| Styling | CSS Modules |
| Database | Postgres (Railway) |
| ORM | Drizzle ORM |
| Auth | HMAC-signed session cookies (admin-session.ts) |
| Build | Vercel (production) / Local dev (port 3000/3003) |

## 🧪 테스트 (로컬)

### 1. 개발 서버 시작
```bash
npm run dev
# http://localhost:3000
```

### 2. 어드민 진입
- URL: `/admin/[slug]/dashboard`
- 인증: `admin_session` 또는 `site_admin_session` 쿠키 필요
- 테스트용: SSO 로그인 후 쿠키 확인

### 3. 주요 테스트 항목
- [ ] 네비게이션: 각 메뉴 클릭시 정상 이동
- [ ] 활성 상태: 현재 페이지 메뉴 highlight
- [ ] 데이터 로딩: Dashboard 통계 값 표시
- [ ] 필터링: Work 리스트에서 상태 필터 동작
- [ ] 채팅: Work detail에서 메시지 입력/전송 동작

## 📝 주요 파일 구조

```
src/
├── app/admin/[slug]/
│   ├── layout.tsx (인증 체크 + 레이아웃)
│   ├── AdminLayout.tsx (공통 UI)
│   ├── AdminLayout.module.css
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── Dashboard.module.css
│   ├── reservations/
│   │   ├── page.tsx
│   │   └── Reservations.module.css
│   ├── work/
│   │   ├── page.tsx (목록)
│   │   ├── [id]/
│   │   │   ├── page.tsx (상세)
│   │   │   └── WorkDetail.module.css
│   │   └── Work.module.css
│   ├── services/ (placeholder)
│   └── site/ (placeholder)
├── app/api/admin/
│   └── maintenance/
│       ├── route.ts (GET/POST)
│       ├── [id]/
│       │   ├── route.ts (GET/PUT)
│       │   └── messages/route.ts (POST)
│       └── sync/route.ts (동기화 구조)
└── drizzle/
    ├── schema.ts (5개 새 테이블 정의)
    └── migrations/0002_stiff_vargas.sql
```

## 🚀 Phase 2 로드맵

### Priority 1 (핵심)
- [ ] WebSocket 통합 (Socket.io 또는 Supabase Realtime)
- [ ] MySQL→Postgres 풀-기반 동기화 (roodim-link API 호출)
- [ ] Services 페이지 (CRUD)
- [ ] Site 페이지 (기본정보, 섹션, 메뉴 탭)

### Priority 2 (협업)
- [ ] Workboard 조건부 표시 (멤버 존재시)
- [ ] 실시간 알림 (배지, 사운드)
- [ ] 메시지 파일 첨부

### Priority 3 (최적화)
- [ ] 다크모드 지원
- [ ] 다국어 지원
- [ ] 모바일 최적화

## ⚠️ 알려진 제한사항

1. **동기화**: `sync` 엔드포인트는 구조만 완성, 실제 MySQL 호출 로직 필요
2. **WebSocket**: 폴링 방식이 기본값 (실시간 아님)
3. **권한**: 모든 사이트 관리자가 같은 수준의 접근권 (역할 기반 제어 미미)
4. **워크보드**: UI만 준비, 데이터 연동 미완성

## 📚 참고 자료

- **디자인**: `feedback_design.md` (카카오스타일, #cc222c)
- **절대규칙**: `feedback_button_test.md`, `feedback_browser_verify.md`
- **기존 어드민**: `resources/views/rental-sites/` (roodim-link Laravel)
- **스키마**: `src/drizzle/schema.ts` (현재 Postgres 상태)

---

**작업일**: 2026-04-15
**담당**: Claude Opus 4.6 (AI Assistant)
**커밋**: 51c274e (마지막 sync 엔드포인트) / 410ca64 (work detail) / 76f5660 (초기 Phase 1)
