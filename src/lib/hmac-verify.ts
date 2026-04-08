import crypto from 'crypto';

const API_KEY = process.env.ADMIN_API_KEY!;
const API_SECRET = process.env.ADMIN_API_SECRET!;
const MAX_AGE_SECONDS = 300; // 5분

/**
 * Laravel 어드민에서 보낸 HMAC 서명 요청 검증
 * admin-api.ts의 서명 방식과 동일: HMAC(timestamp + body)
 */
export function verifyHmacRequest(headers: Headers, body: string): boolean {
  const apiKey = headers.get('x-api-key');
  const timestamp = headers.get('x-timestamp');
  const signature = headers.get('x-signature');

  if (!apiKey || !timestamp || !signature) return false;
  if (apiKey !== API_KEY) return false;

  // 타임스탬프 유효성 (5분 이내)
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_AGE_SECONDS) return false;

  // HMAC 검증
  const expectedSig = crypto
    .createHmac('sha256', API_SECRET)
    .update(timestamp + body)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSig),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}
