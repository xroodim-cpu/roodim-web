import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites, boards, boardPosts } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { ensureSystemBoards } from '@/lib/board-utils';
import { adminApi } from '@/lib/admin-api';

/**
 * POST /api/public/inquiry
 *
 * 공개 문의 접수 API (인증 불필요). 홈페이지 상담팝업 → 사이트별 문의게시판 (roodim-web DB).
 *
 * 두 가지 body 포맷 지원:
 *
 * 1) 통합 텍스트 모드 (신규 — 공용 치환코드 `<form class="roo-inquiry">` 및 최신
 *    `<!--@inquiry_form-->` 위젯에서 사용):
 *      { slug, content, mode: 'unified' }
 *    - `content` 는 이미 `<p><strong>라벨</strong>: 값</p>` 형태로 합쳐진 HTML
 *    - 그대로 boardPosts.content 에 저장. title 은 content 에서 자동 추출
 *
 * 2) 구조화 필드 모드 (레거시 — 하위호환):
 *      { slug, fields: { "성함": "...", "연락처": "...", ... } }
 *    - 각 필드에서 성함/연락처/이메일 키워드 매칭해 컬럼에 저장
 *    - content 는 자동 생성
 *
 * 저장 위치는 roodim-web DB (사이트별 데이터 단위). 루딤링크(Laravel) 미러는
 * 엔드포인트 미구현 + 저장 정책 단일화로 제거됨.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, fields, content, mode } = body;

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }

    const useUnified = mode === 'unified' || (typeof content === 'string' && content.trim().length > 0);
    const hasFields = fields && typeof fields === 'object' && Object.keys(fields).length > 0;

    if (!useUnified && !hasFields) {
      return NextResponse.json(
        { error: 'content(unified) 또는 fields 중 하나는 필수입니다.' },
        { status: 400 },
      );
    }

    // 사이트 조회
    const site = await db.query.sites.findFirst({
      where: eq(sites.slug, slug),
    });
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // ── partner / creator (회원 사이트) → 루딤링크(Laravel) 게시판으로 전달 ──
    // 커밋 7f029979 정책: 회원사이트(member) → 루딤 마스터 / 고객사이트(customer) → 파트너 조직
    // 라우팅은 Laravel 측 resolveTargetOrg 가 slug 기준으로 자동 결정
    if ((site.siteType === 'partner' || site.siteType === 'creator') && site.adminOrganizationId) {
      return handlePartnerInquiry(site, body, slug);
    }

    // 시스템 게시판 확보
    await ensureSystemBoards(site.id);

    // 문의게시판 찾기
    const [inquiryBoard] = await db
      .select()
      .from(boards)
      .where(and(eq(boards.siteId, site.id), eq(boards.systemKey, 'inquiry')))
      .limit(1);

    if (!inquiryBoard) {
      return NextResponse.json({ error: '문의게시판을 찾을 수 없습니다.' }, { status: 500 });
    }

    let finalTitle: string;
    let finalContent: string;
    let authorName: string;
    let authorPhone: string | null = null;
    let authorEmail: string | null = null;
    let formDataDump: Record<string, unknown> | null = null;

    if (useUnified) {
      // ── 통합 텍스트 모드 ──
      finalContent = String(content).trim();
      formDataDump = { __mode: 'unified', __rawLength: finalContent.length };

      // content 에서 선택적 파싱 — 어드민 정렬/검색용. 실패해도 저장은 진행
      const textOnly = stripHtml(finalContent);
      authorName = extractFromText(textOnly, ['성함', '이름', '담당자', '성명', 'name']) || '방문자';
      authorPhone = extractFromText(textOnly, ['연락처', '전화', '핸드폰', '휴대폰', '전화번호', 'phone']);
      authorEmail = extractFromText(textOnly, ['이메일', 'email', 'e-mail']);
      const companyName = extractFromText(textOnly, ['병원명', '회사명', '업체명', '상호', 'company']);

      // title 추출 — 첫 번째 `<p><strong>...</strong>: 값` 의 값에서 최대 50자
      const firstValueMatch = finalContent.match(/<strong>[^<]*<\/strong>\s*:\s*([^<]+)/);
      const firstValue = firstValueMatch?.[1]?.trim() || '';
      const titleSeed = [companyName, authorName].filter(Boolean).join(' / ') || firstValue.slice(0, 50);
      finalTitle = titleSeed ? `문의 — ${titleSeed}` : `상담 요청 — ${new Date().toLocaleString('ko-KR')}`;
    } else {
      // ── 구조화 필드 모드 (레거시) ──
      const fieldEntries = Object.entries(fields) as [string, string][];
      authorName = extractField(fieldEntries, ['성함', '이름', '담당자', 'name', '성명']) || '방문자';
      authorPhone = extractField(fieldEntries, ['연락처', '전화', '핸드폰', '휴대폰', 'phone', '전화번호']);
      authorEmail = extractField(fieldEntries, ['이메일', 'email', 'e-mail']);
      const companyName = extractField(fieldEntries, ['병원명', '회사명', '업체명', '상호', 'company']);

      const titleParts = [companyName, authorName].filter(Boolean);
      finalTitle = `문의 — ${titleParts.join(' / ') || '익명'}`;
      finalContent = fieldEntries
        .map(([key, val]) => `<p><strong>${escapeHtml(key)}</strong> : ${escapeHtml(String(val))}</p>`)
        .join('\n');
      formDataDump = fields;
    }

    // 게시물 생성
    const [post] = await db.insert(boardPosts).values({
      boardId: inquiryBoard.id,
      siteId: site.id,
      title: finalTitle,
      content: finalContent,
      authorName,
      authorEmail: authorEmail || null,
      authorPhone: authorPhone || null,
      formData: formDataDump,
    }).returning();

    return NextResponse.json({
      ok: true,
      message: '문의가 접수되었습니다.',
      postId: post.id,
    });
  } catch (error) {
    console.error('[POST /api/public/inquiry]', error);
    return NextResponse.json({ error: '문의 접수 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

/** fields 객체에서 키워드 매칭으로 값 추출 */
function extractField(entries: [string, string][], keywords: string[]): string | null {
  for (const [key, val] of entries) {
    const lower = key.toLowerCase();
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return String(val).trim() || null;
      }
    }
  }
  return null;
}

/**
 * 통합 텍스트 본문(HTML 제거 후 plain)에서 `라벨: 값` 패턴을 찾아 값을 추출.
 * 여러 줄에 걸쳐 있을 수 있어서 라벨 등장 후 다음 줄바꿈까지 또는 다음 라벨 전까지를 값으로 본다.
 */
function extractFromText(text: string, keywords: string[]): string | null {
  for (const kw of keywords) {
    // 라벨 뒤에 `(직책)` 같은 부가표기가 와도 매칭되도록 `[^:\n\r]*` 허용
    //   ex) "성함(직책): 박선호 대표" → value = "박선호 대표"
    const re = new RegExp(
      `(?:^|[\\n\\r])\\s*${kw.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}[^:\\n\\r]*[:：]\\s*([^\\n\\r]+)`,
      'i',
    );
    const m = text.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

/** 매우 단순한 HTML→텍스트 변환 — 파싱용이라 정확도 < 내구성 */
function stripHtml(html: string): string {
  return html
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * partner / creator 사이트 문의 → 루딤링크(Laravel) API 로 전달.
 * Laravel API env 미설정(HMAC key 없음) 시 자동 fallback — roodim-web PG 에 저장.
 *
 * 1차: `/api/sites/{slug}/bulletins/inquiry/submit` (Laravel) 호출
 *   - 성공 시 Laravel bulletins 테이블 + 담당자 알림 발송
 *   - 실패 시 (HMAC 미설정 / 네트워크 / Laravel 에러) 2차로 넘어감
 * 2차: roodim-web DB board_posts 에 직접 저장 (데이터 손실 방지)
 *   - 나중에 Laravel env 설정되면 별도 sync 작업으로 이관 가능
 */
async function handlePartnerInquiry(
  site: { id: string; adminOrganizationId: number | null; siteType: string },
  body: Record<string, unknown>,
  slug: string,
): Promise<NextResponse> {
  const { fields, content, mode } = body;

  const useUnified = mode === 'unified' || (typeof content === 'string' && String(content).trim().length > 0);
  const hasFields = fields && typeof fields === 'object' && Object.keys(fields as object).length > 0;

  if (!useUnified && !hasFields) {
    return NextResponse.json(
      { error: 'content(unified) 또는 fields 중 하나는 필수입니다.' },
      { status: 400 },
    );
  }

  let payloadFields: Record<string, string> | undefined;
  if (hasFields) {
    payloadFields = fields as Record<string, string>;
  } else if (useUnified) {
    payloadFields = parseUnifiedToFields(String(content));
  }

  // ── 1차 시도: Laravel Bridge API ──
  const result = await adminApi<{ ok: boolean; post_id?: number; message?: string }>(
    'POST',
    `/api/sites/${encodeURIComponent(slug)}/bulletins/inquiry/submit`,
    payloadFields && Object.keys(payloadFields).length > 0
      ? { fields: payloadFields }
      : { content: String(content ?? ''), mode: 'unified' },
  );

  if (result.ok) {
    return NextResponse.json({
      ok: true,
      message: result.data?.message || '문의가 접수되었습니다.',
      postId: result.data?.post_id,
    });
  }

  // ── 2차 fallback: roodim-web PG 에 직접 저장 ──
  // Laravel API env 미설정이나 503/401 상황에서도 문의 데이터 유실 방지
  console.warn('[POST /api/public/inquiry] Laravel submit failed, falling back to PG:', result.error);

  try {
    await ensureSystemBoards(site.id);
    const [inquiryBoard] = await db
      .select()
      .from(boards)
      .where(and(eq(boards.siteId, site.id), eq(boards.systemKey, 'inquiry')))
      .limit(1);

    if (!inquiryBoard) {
      return NextResponse.json({ error: 'Fallback 실패: 문의게시판 없음' }, { status: 500 });
    }

    const entries = payloadFields ? Object.entries(payloadFields) : [];
    const authorName = extractField(entries as [string, string][], ['성함', '이름', '담당자', 'name', '성명']) || '방문자';
    const authorPhone = extractField(entries as [string, string][], ['연락처', '전화', '핸드폰', '휴대폰', 'phone', '전화번호']);
    const authorEmail = extractField(entries as [string, string][], ['이메일', 'email', 'e-mail']);
    const companyName = extractField(entries as [string, string][], ['병원명', '회사명', '업체명', '상호', 'company']);

    const finalContent = useUnified
      ? String(content).trim()
      : (entries as [string, string][])
          .map(([k, v]) => `<p><strong>${escapeHtml(k)}</strong> : ${escapeHtml(String(v))}</p>`)
          .join('\n');

    const titleSeed = [companyName, authorName].filter(Boolean).join(' / ');
    const finalTitle = titleSeed
      ? `문의 — ${titleSeed}`
      : `상담 요청 — ${new Date().toLocaleString('ko-KR')}`;

    const [post] = await db.insert(boardPosts).values({
      boardId: inquiryBoard.id,
      siteId: site.id,
      title: finalTitle,
      content: finalContent,
      authorName,
      authorEmail: authorEmail || null,
      authorPhone: authorPhone || null,
      formData: {
        __fallback: true,
        __laravel_error: result.error || 'unknown',
        fields: payloadFields || {},
      },
    }).returning();

    return NextResponse.json({
      ok: true,
      message: '문의가 접수되었습니다.',
      postId: post.id,
      __note: 'Saved to PG fallback (Laravel API env 미설정)',
    });
  } catch (e) {
    console.error('[POST /api/public/inquiry] PG fallback failed:', e);
    return NextResponse.json(
      { error: '문의 접수 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

/** unified HTML (`<p><strong>라벨</strong>: 값</p>`...) 에서 { 라벨: 값 } 객체 복원 */
function parseUnifiedToFields(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<strong>\s*([^<]+?)\s*<\/strong>\s*[:：]\s*([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const key = m[1].trim();
    const val = m[2].trim();
    if (key && val) out[key] = val;
  }
  return out;
}
