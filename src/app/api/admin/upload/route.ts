import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/admin-session';
import crypto from 'crypto';

const ADMIN_URL = process.env.ADMIN_API_URL || '';
const API_KEY = process.env.ADMIN_API_KEY || '';
const API_SECRET = process.env.ADMIN_API_SECRET || '';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];

/**
 * POST /api/admin/upload
 *
 * 이미지 파일을 루딤링크(Laravel) API를 경유하여 Wasabi에 업로드합니다.
 * 루딤링크에 업로드 API가 없는 경우 에러를 반환합니다.
 *
 * Request: multipart/form-data { file, slug }
 * Response: { ok: true, url: string }
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const slug = formData.get('slug') as string;
    const file = formData.get('file') as File | null;

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    // 인증 확인
    const session = await verifyAdminAccess(slug);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 파일 유효성 검사
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `허용되지 않는 파일 형식입니다. (${file.type})` },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `파일 크기는 ${MAX_SIZE / 1024 / 1024}MB 이하여야 합니다.` },
        { status: 400 }
      );
    }

    // 루딤링크 API를 통해 Wasabi에 업로드
    if (!ADMIN_URL || !API_KEY || !API_SECRET) {
      return NextResponse.json(
        { error: '어드민 API 설정이 필요합니다. URL을 직접 입력해주세요.' },
        { status: 503 }
      );
    }

    // HMAC 서명 생성 (multipart이므로 빈 body로 서명)
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac('sha256', API_SECRET)
      .update(timestamp)
      .digest('hex');

    // 루딤링크로 파일 전송
    const uploadForm = new FormData();
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const blob = new Blob([fileBuffer], { type: file.type });
    uploadForm.append('file', blob, file.name);
    uploadForm.append('purpose', 'site');
    uploadForm.append('owner_type', 'organization');

    const res = await fetch(`${ADMIN_URL}/api/files/upload`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'X-Api-Key': API_KEY,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
      },
      body: uploadForm,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error('[upload] Laravel upload failed:', res.status, errData);
      return NextResponse.json(
        { error: errData.message || errData.error || `업로드 실패 (${res.status}). URL을 직접 입력해주세요.` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const url = data.url || data.data?.url || data.data?.path || '';

    if (!url) {
      return NextResponse.json(
        { error: '업로드는 성공했으나 URL을 받지 못했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, url });
  } catch (error) {
    console.error('[upload] error:', error);
    return NextResponse.json(
      { error: '업로드 중 오류가 발생했습니다. URL을 직접 입력해주세요.' },
      { status: 500 }
    );
  }
}
