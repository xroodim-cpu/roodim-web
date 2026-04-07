import crypto from 'crypto';
import { cookies } from 'next/headers';

interface AdminSession {
  site_id: string;
  slug: string;
  member_id: number;
  name: string;
  role: string;
  exp: number;
}

/**
 * 어드민 세션 검증 (Server Component / Route Handler에서 사용)
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('admin_session');
    if (!sessionCookie) return null;

    const [token, signature] = sessionCookie.value.split('.');
    if (!token || !signature) return null;

    // 서명 검증
    const expectedSig = crypto
      .createHmac('sha256', process.env.SSO_SECRET!)
      .update(token)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature))) {
      return null;
    }

    // 페이로드 파싱
    const padding = '='.repeat((4 - (token.length % 4)) % 4);
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/') + padding;
    const session: AdminSession = JSON.parse(Buffer.from(base64, 'base64').toString());

    // 만료 확인
    if (Date.now() / 1000 > session.exp) return null;

    return session;
  } catch {
    return null;
  }
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
