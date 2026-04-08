import crypto from 'crypto';
import { cookies } from 'next/headers';

interface AdminSession {
  site_id: string;
  slug: string;
  member_id?: number;
  credential_id?: number;
  name: string;
  role: string;
  auth_type: 'sso' | 'credential';
  exp: number;
}

/**
 * 쿠키에서 HMAC 서명된 세션 파싱
 */
function parseSessionCookie(cookieValue: string): AdminSession | null {
  try {
    const [token, signature] = cookieValue.split('.');
    if (!token || !signature) return null;

    const expectedSig = crypto
      .createHmac('sha256', process.env.SSO_SECRET!)
      .update(token)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature))) {
      return null;
    }

    const padding = '='.repeat((4 - (token.length % 4)) % 4);
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/') + padding;
    const session = JSON.parse(Buffer.from(base64, 'base64').toString());

    if (Date.now() / 1000 > session.exp) return null;

    return session;
  } catch {
    return null;
  }
}

/**
 * 어드민 세션 검증 (SSO + 고객 로그인 듀얼 지원)
 * 1. admin_session (SSO 직원 로그인) 우선 확인
 * 2. site_admin_session (고객 이메일/비밀번호 로그인) 확인
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();

  // SSO 세션 확인 (직원)
  const ssoCookie = cookieStore.get('admin_session');
  if (ssoCookie) {
    const session = parseSessionCookie(ssoCookie.value);
    if (session) {
      // 기존 SSO 세션은 auth_type이 없을 수 있으므로 기본값 설정
      return { ...session, auth_type: session.auth_type || 'sso' };
    }
  }

  // 고객 로그인 세션 확인
  const credCookie = cookieStore.get('site_admin_session');
  if (credCookie) {
    const session = parseSessionCookie(credCookie.value);
    if (session) return session;
  }

  return null;
}

/**
 * slug와 세션의 사이트가 일치하는지 확인
 */
export async function verifyAdminAccess(slug: string): Promise<AdminSession | null> {
  const session = await getAdminSession();
  if (!session) return null;
  if (session.slug !== slug) return null;
  return session;
}
