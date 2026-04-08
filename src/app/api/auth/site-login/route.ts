import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { siteCredentials, sites } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  let body: { slug: string; email: string; password: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { slug, email, password } = body;
  if (!slug || !email || !password) {
    return NextResponse.json({ error: '이메일과 비밀번호를 입력하세요' }, { status: 400 });
  }

  try {
    // 사이트 확인
    const [site] = await db.select({ id: sites.id, name: sites.name })
      .from(sites)
      .where(eq(sites.slug, slug))
      .limit(1);

    if (!site) {
      return NextResponse.json({ error: '사이트를 찾을 수 없습니다' }, { status: 404 });
    }

    // 자격증명 확인
    const [cred] = await db.select()
      .from(siteCredentials)
      .where(and(
        eq(siteCredentials.siteId, site.id),
        eq(siteCredentials.email, email),
        eq(siteCredentials.isActive, true)
      ))
      .limit(1);

    if (!cred) {
      return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' }, { status: 401 });
    }

    // 비밀번호 검증
    const isValid = await verifyPassword(password, cred.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' }, { status: 401 });
    }

    // 마지막 로그인 시간 업데이트
    await db.update(siteCredentials)
      .set({ lastLoginAt: new Date() })
      .where(eq(siteCredentials.id, cred.id));

    // 세션 쿠키 생성 (site_admin_session)
    const sessionPayload = {
      site_id: site.id,
      slug,
      credential_id: cred.id,
      name: cred.name,
      role: 'owner',
      auth_type: 'credential',
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24시간
    };

    const payloadBase64 = Buffer.from(JSON.stringify(sessionPayload))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const signature = crypto
      .createHmac('sha256', process.env.SSO_SECRET!)
      .update(payloadBase64)
      .digest('hex');

    const cookieValue = `${payloadBase64}.${signature}`;

    const response = NextResponse.json({ ok: true, data: { slug, name: cred.name } });
    response.cookies.set('site_admin_session', cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24시간
    });

    return response;
  } catch (e) {
    console.error('Site login error:', e);
    return NextResponse.json({ error: '로그인 중 오류가 발생했습니다' }, { status: 500 });
  }
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Format: $pbkdf2$iterations$salt$derivedKey
  const parts = hash.split('$');
  if (parts.length !== 5 || parts[1] !== 'pbkdf2') return false;

  const iterations = parseInt(parts[2], 10);
  const salt = Buffer.from(parts[3], 'base64');
  const storedKey = Buffer.from(parts[4], 'base64');

  return new Promise((resolve) => {
    crypto.pbkdf2(password, salt, iterations, storedKey.length, 'sha256', (err, derivedKey) => {
      if (err) { resolve(false); return; }
      resolve(crypto.timingSafeEqual(derivedKey, storedKey));
    });
  });
}
