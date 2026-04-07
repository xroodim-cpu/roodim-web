import crypto from 'crypto';

const ADMIN_URL = process.env.ADMIN_API_URL!;
const API_KEY = process.env.ADMIN_API_KEY!;
const API_SECRET = process.env.ADMIN_API_SECRET!;

/**
 * 루딤 어드민 API 호출 (HMAC 서명 인증)
 */
export async function adminApi<T = unknown>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyStr = body ? JSON.stringify(body) : '';
    const signature = crypto
      .createHmac('sha256', API_SECRET)
      .update(timestamp + bodyStr)
      .digest('hex');

    const res = await fetch(`${ADMIN_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Api-Key': API_KEY,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
      },
      body: method === 'POST' ? bodyStr : undefined,
    });

    const data = await res.json();

    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }

    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}
