import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { webSkins } from '../src/drizzle/schema';
import { inArray } from 'drizzle-orm';

/**
 * 일회용: webSkins #5, #6 (기본스킨, 이프운하 보그) targetType 을 'member' 로 변경.
 *
 * 배경: vogue 시드 시 'customer' 로 INSERT 했으나, 사용자 분류상 회원 웹스킨이 맞음.
 *       #5 (기본스킨) 도 함께 회원 분류로 통일.
 *
 * 안전 가드:
 *   - id IN (5, 6) 만 변경, 다른 스킨 무영향.
 *   - 변경 전/후 상태 출력해 검증 가능.
 */

const SKIN_IDS = [5, 6];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL 없음.');
    process.exit(1);
  }
  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);
  try {
    const before = await db.select({
      id: webSkins.id,
      name: webSkins.name,
      slug: webSkins.slug,
      targetType: webSkins.targetType,
    }).from(webSkins).where(inArray(webSkins.id, SKIN_IDS));

    console.log('\n=== Before ===');
    for (const s of before) console.log(`  #${s.id} ${s.name} (${s.slug}) targetType=${s.targetType}`);

    if (before.length === 0) {
      console.log('대상 스킨 없음.');
      return;
    }

    await db.update(webSkins)
      .set({ targetType: 'member', updatedAt: new Date() })
      .where(inArray(webSkins.id, SKIN_IDS));

    const after = await db.select({
      id: webSkins.id,
      name: webSkins.name,
      slug: webSkins.slug,
      targetType: webSkins.targetType,
    }).from(webSkins).where(inArray(webSkins.id, SKIN_IDS));

    console.log('\n=== After ===');
    for (const s of after) console.log(`  #${s.id} ${s.name} (${s.slug}) targetType=${s.targetType}`);
    console.log('\n✅ 완료.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
