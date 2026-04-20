import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { siteCredentials } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { getAdminSession } from '@/lib/admin-session';

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session || !session.credential_id) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  let body: { current_password: string; new_password: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
  }

  const { current_password, new_password } = body;
  if (!current_password || !new_password) {
    return NextResponse.json({ error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요' }, { status: 400 });
  }
  if (new_password.length < 8) {
    return NextResponse.json({ error: '새 비밀번호는 8자 이상이어야 합니다' }, { status: 400 });
  }

  const [cred] = await db.select()
    .from(siteCredentials)
    .where(eq(siteCredentials.id, session.credential_id))
    .limit(1);

  if (!cred) {
    return NextResponse.json({ error: '계정 정보를 찾을 수 없습니다' }, { status: 404 });
  }

  const valid = await verifyPassword(current_password, cred.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: '현재 비밀번호가 일치하지 않습니다' }, { status: 403 });
  }

  const newHash = await hashPassword(new_password);
  await db.update(siteCredentials)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(siteCredentials.id, cred.id));

  return NextResponse.json({ ok: true });
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
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

async function hashPassword(password: string): Promise<string> {
  const iterations = 100_000;
  const salt = crypto.randomBytes(16);
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, 64, 'sha256', (err, derivedKey) => {
      if (err) { reject(err); return; }
      resolve(`$pbkdf2$${iterations}$${salt.toString('base64')}$${derivedKey.toString('base64')}`);
    });
  });
}
