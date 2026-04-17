import crypto from 'crypto';
import { db } from './db';
import { usedSsoTokens, siteAdmins } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';

const SSO_SECRET = process.env.SSO_SECRET!;

interface SsoPayload {
  jti: string;
  member_id?: number;
  member_name?: string;
  customer_id?: number;       // 고객 SSO 일 때
  customer_name?: string;     // 고객 SSO 일 때
  auth_type?: 'sso' | 'customer';
  site_slug: string;
  role: string;
  issued_at: number;
  exp: number;
  nonce: string;
}

/**
 * SSO 토큰 검증 (HMAC + 만료 + 1회용)
 */
export async function verifySsoToken(token: string): Promise<SsoPayload | null> {
  try {
    const [payloadBase64, signature] = token.split('.');
    if (!payloadBase64 || !signature) return null;

    // HMAC 검증
    const expectedSig = crypto
      .createHmac('sha256', SSO_SECRET)
      .update(payloadBase64)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature))) {
      return null;
    }

    // 페이로드 파싱
    const padding = '='.repeat((4 - (payloadBase64.length % 4)) % 4);
    const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/') + padding;
    const payload: SsoPayload = JSON.parse(Buffer.from(base64, 'base64').toString());

    // 만료 확인 (5분)
    if (Date.now() / 1000 > payload.exp) return null;

    // jti 중복 확인 (1회용)
    const used = await db.select()
      .from(usedSsoTokens)
      .where(eq(usedSsoTokens.jti, payload.jti))
      .limit(1);

    if (used.length > 0) return null;

    // jti 사용 기록
    await db.insert(usedSsoTokens).values({
      jti: payload.jti,
      expiresAt: new Date(payload.exp * 1000),
    });

    return payload;
  } catch {
    return null;
  }
}

/**
 * SSO 로그인 후 사이트 관리자 세션 생성/갱신
 */
export async function upsertSiteAdmin(
  siteId: string,
  memberId: number,
  name: string,
  role: string
) {
  const existing = await db.select()
    .from(siteAdmins)
    .where(and(
      eq(siteAdmins.siteId, siteId),
      eq(siteAdmins.adminMemberId, memberId)
    ))
    .limit(1);

  if (existing.length > 0) {
    await db.update(siteAdmins)
      .set({ lastLoginAt: new Date(), name })
      .where(eq(siteAdmins.id, existing[0].id));
    return existing[0].id;
  }

  const result = await db.insert(siteAdmins).values({
    siteId,
    adminMemberId: memberId,
    name,
    role: role as 'owner' | 'editor',
  }).returning({ id: siteAdmins.id });

  return result[0].id;
}
