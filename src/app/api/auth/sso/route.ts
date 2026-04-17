import { NextRequest, NextResponse } from 'next/server';
import { verifySsoToken, upsertSiteAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { sites } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * POST /api/auth/sso — SSO 토큰 검증 + 세션 생성
 */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'SSO 토큰이 없습니다.' }, { status: 400 });
    }

    // 토큰 검증 (HMAC + 만료 + 1회용)
    const payload = await verifySsoToken(token);
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않거나 만료된 토큰입니다.' }, { status: 401 });
    }

    // 사이트 확인
    const site = await db.select()
      .from(sites)
      .where(eq(sites.slug, payload.site_slug))
      .limit(1);

    if (!site[0]) {
      return NextResponse.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 고객 SSO vs 멤버 SSO 분기
    const isCustomer = payload.auth_type === 'customer';

    if (!isCustomer) {
      // 멤버 SSO: 사이트 관리자 세션 생성/갱신
      await upsertSiteAdmin(site[0].id, payload.member_id!, payload.member_name!, payload.role);
    }

    // 세션 토큰 생성 (간단한 서명 기반)
    const sessionData = JSON.stringify({
      site_id: site[0].id,
      slug: payload.site_slug,
      member_id: isCustomer ? undefined : payload.member_id,
      customer_id: isCustomer ? payload.customer_id : undefined,
      name: isCustomer ? payload.customer_name : payload.member_name,
      role: payload.role,
      auth_type: payload.auth_type || 'sso',
      exp: Math.floor(Date.now() / 1000) + 86400, // 24시간
    });

    const sessionToken = Buffer.from(sessionData).toString('base64url');
    const sessionSig = crypto
      .createHmac('sha256', process.env.SSO_SECRET!)
      .update(sessionToken)
      .digest('hex');

    const response = NextResponse.json({
      ok: true,
      slug: payload.site_slug,
    });

    // HttpOnly 세션 쿠키 설정
    response.cookies.set('admin_session', `${sessionToken}.${sessionSig}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/admin',
      maxAge: 86400, // 24시간
    });

    return response;
  } catch (error) {
    console.error('SSO error:', error);
    return NextResponse.json({ error: 'SSO 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
