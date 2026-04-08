import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { verifyHmacRequest } from '@/lib/hmac-verify';

export async function GET(req: NextRequest) {
  // HMAC 인증 (GET은 body가 없으므로 빈 문자열)
  if (!verifyHmacRequest(req.headers, '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const customerId = req.nextUrl.searchParams.get('customerId');
  const memberId = req.nextUrl.searchParams.get('memberId');

  if (!customerId && !memberId) {
    return NextResponse.json({ error: 'customerId or memberId required' }, { status: 400 });
  }

  try {
    let result;
    if (customerId) {
      result = await db.select({
        id: sites.id,
        slug: sites.slug,
        name: sites.name,
        siteType: sites.siteType,
        status: sites.status,
        createdAt: sites.createdAt,
      })
        .from(sites)
        .where(eq(sites.adminCustomerId, parseInt(customerId, 10)));
    } else {
      result = await db.select({
        id: sites.id,
        slug: sites.slug,
        name: sites.name,
        siteType: sites.siteType,
        status: sites.status,
        createdAt: sites.createdAt,
      })
        .from(sites)
        .where(eq(sites.adminMemberId, parseInt(memberId!, 10)));
    }

    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    console.error('Site lookup error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
