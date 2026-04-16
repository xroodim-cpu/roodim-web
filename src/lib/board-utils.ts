import { db } from '@/lib/db';
import { boards } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';

const SYSTEM_BOARDS = [
  {
    slug: 'inquiry',
    name: '문의게시판',
    systemKey: 'inquiry',
    description: '홈페이지 방문자 문의가 자동으로 접수됩니다.',
    sortOrder: 0,
  },
  {
    slug: 'qna',
    name: '질문답변',
    systemKey: 'qna',
    description: '자주 묻는 질문과 답변을 관리합니다.',
    sortOrder: 1,
  },
] as const;

/**
 * 시스템 게시판(문의, Q&A)이 없으면 자동 생성합니다.
 * 게시판 API 호출 시 매번 실행해도 안전합니다 (IF NOT EXISTS 패턴).
 */
export async function ensureSystemBoards(siteId: string) {
  for (const def of SYSTEM_BOARDS) {
    const existing = await db
      .select({ id: boards.id })
      .from(boards)
      .where(and(eq(boards.siteId, siteId), eq(boards.slug, def.slug)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(boards).values({
        siteId,
        slug: def.slug,
        name: def.name,
        boardType: 'system',
        systemKey: def.systemKey,
        description: def.description,
        sortOrder: def.sortOrder,
      });
    }
  }
}
