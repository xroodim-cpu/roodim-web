import { NextResponse } from 'next/server';

/**
 * POST /api/auth/site-logout
 * 사이트 어드민 세션 쿠키 두 종류(admin_session SSO, site_admin_session 자격증명)를 모두 제거.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('site_admin_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  res.cookies.set('admin_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
