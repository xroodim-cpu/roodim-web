import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { db } from '@/lib/db';
import { sites, boards, boardPosts } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { ensureSystemBoards } from '@/lib/board-utils';
import { adminApi } from '@/lib/admin-api';

/**
 * POST /api/public/inquiry
 *
 * 공개 문의 접수 API (인증 불필요)
 * 홈페이지 문의 팝업 → 문의게시판에 "항목명 : 입력값" 형식으로 저장
 *
 * Body: { slug: "org-5", fields: { "병원명": "호재한의원", "성함(직책)": "대표원장 손호재", ... } }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, fields } = body;

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }
    if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'fields is required (object with key-value pairs)' }, { status: 400 });
    }

    // 사이트 조회
    const site = await db.query.sites.findFirst({
      where: eq(sites.slug, slug),
    });
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
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

    // 필드에서 주요 정보 추출
    const fieldEntries = Object.entries(fields) as [string, string][];
    const authorName = extractField(fieldEntries, ['성함', '이름', '담당자', 'name', '성명']) || '방문자';
    const authorPhone = extractField(fieldEntries, ['연락처', '전화', '핸드폰', '휴대폰', 'phone', '전화번호']);
    const authorEmail = extractField(fieldEntries, ['이메일', 'email', 'e-mail']);
    const companyName = extractField(fieldEntries, ['병원명', '회사명', '업체명', '상호', 'company']);

    // 제목 생성
    const titleParts = [companyName, authorName].filter(Boolean);
    const title = `문의 — ${titleParts.join(' / ') || '익명'}`;

    // 내용: "항목명 : 입력값" 형식 HTML
    const contentHtml = fieldEntries
      .map(([key, val]) => `<p><strong>${escapeHtml(key)}</strong> : ${escapeHtml(String(val))}</p>`)
      .join('\n');

    // 게시물 생성
    const [post] = await db.insert(boardPosts).values({
      boardId: inquiryBoard.id,
      siteId: site.id,
      title,
      content: contentHtml,
      authorName,
      authorEmail: authorEmail || null,
      authorPhone: authorPhone || null,
      formData: fields,
    }).returning();

    // 루딤링크(Laravel 어드민) 에도 미러링 — 응답 후 background 실행.
    //
    // [NOTE] Next.js 16 의 `after()` 를 사용. Vercel 서버리스 함수는 응답 반환 시
    // 일반 Promise 를 종료시키므로 fire-and-forget (단순 .catch) 패턴은
    // 미러링 요청을 중도 취소한다. `after()` 는 Vercel 이 응답 후에도 실행을 보장.
    after(async () => {
      const result = await adminApi(
        'POST',
        `/api/sites/${encodeURIComponent(slug)}/bulletins/inquiry/submit`,
        { fields }
      );
      if (!result.ok) {
        console.warn('[inquiry mirror → laravel] failed:', result.error, 'slug=', slug);
      }
    });

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

/**
 * 필드 목록에서 키워드 매칭으로 값 추출
 */
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
