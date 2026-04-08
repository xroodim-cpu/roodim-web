import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { siteCredentials, sites } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { verifyHmacRequest } from '@/lib/hmac-verify';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const bodyText = await req.text();

  if (!verifyHmacRequest(req.headers, bodyText)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { slug: string; email: string; newPassword: string };
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { slug, email, newPassword } = body;
  if (!slug || !email || !newPassword) {
    return NextResponse.json({ error: 'slug, email, newPassword required' }, { status: 400 });
  }

  try {
    // 사이트 확인
    const [site] = await db.select({ id: sites.id })
      .from(sites)
      .where(eq(sites.slug, slug))
      .limit(1);

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // 자격증명 확인
    const [cred] = await db.select({ id: siteCredentials.id })
      .from(siteCredentials)
      .where(and(
        eq(siteCredentials.siteId, site.id),
        eq(siteCredentials.email, email)
      ))
      .limit(1);

    if (!cred) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    // 비밀번호 업데이트
    const newHash = await hashPassword(newPassword);
    await db.update(siteCredentials)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(siteCredentials.id, cred.id));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Password reset error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const iterations = 100000;
  const keyLength = 32;

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, keyLength, 'sha256', (err, derivedKey) => {
      if (err) reject(err);
      resolve(`$pbkdf2$${iterations}$${salt.toString('base64')}$${derivedKey.toString('base64')}`);
    });
  });
}
