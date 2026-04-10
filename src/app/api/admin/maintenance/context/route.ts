import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { verifyAdminAccess } from '@/lib/admin-session';
import { adminApi } from '@/lib/admin-api';

interface SiteContextData {
  ok: boolean;
  data: {
    customer_id: number;
    customer_name: string;
    organization_id: number;
    designer_id: number | null;
    designer_name: string | null;
    contractor_id: number | null;
    contractor_name: string | null;
    contractor_organization_id: number | null;
  };
}

interface ScheduleData {
  ok: boolean;
  data: {
    member_id: number;
    working_days: number[];
    hours_start: string;
    hours_end: string;
    lunch_enabled: boolean;
    lunch_start: string | null;
    lunch_end: string | null;
    holiday_closed: boolean;
  } | null;
}

interface BlockedDatesData {
  ok: boolean;
  blocked_dates: string[];
}

interface ProductItem {
  id: number;
  name: string;
  description: string | null;
  price: number;
  base_price: number;
  items: unknown;
  category: string | null;
  thumbnail: string | null;
}

interface ProductsData {
  ok: boolean;
  products: ProductItem[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slug = searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  const session = await verifyAdminAccess(slug);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // site의 adminCustomerId 조회
  const [site] = await db
    .select({ adminCustomerId: sites.adminCustomerId })
    .from(sites)
    .where(eq(sites.id, session.site_id));

  if (!site?.adminCustomerId) {
    return NextResponse.json({
      ok: true,
      data: { schedule: null, blockedDates: [], products: [], designer: null },
    });
  }

  // 1. 사이트 컨텍스트 (디자이너/계약자 정보)
  const ctxResult = await adminApi<SiteContextData>(
    'GET',
    `/api/bridge/site-context?customer_id=${site.adminCustomerId}`
  );

  const ctxData = ctxResult.data;
  const designerId = (ctxData as SiteContextData | undefined)?.data?.designer_id;
  const contractorOrgId = (ctxData as SiteContextData | undefined)?.data?.contractor_organization_id;

  // 2. 디자이너 스케줄 + 차단일 + 가격표 동시 호출
  const [scheduleResult, blockedResult, productsResult] = await Promise.all([
    designerId
      ? adminApi<ScheduleData>('GET', `/api/bridge/designer/${designerId}/schedule`)
      : Promise.resolve({ ok: true, data: null }),
    designerId && contractorOrgId
      ? adminApi<BlockedDatesData>('GET', `/api/bridge/designer/${designerId}/blocked-dates?org_id=${contractorOrgId}&days=180`)
      : Promise.resolve({ ok: true, data: null }),
    contractorOrgId
      ? adminApi<ProductsData>('GET', `/api/bridge/products?org_id=${contractorOrgId}&type=maintenance`)
      : Promise.resolve({ ok: true, data: null }),
  ]);

  const scheduleData = scheduleResult.data as ScheduleData | null;
  const blockedData = blockedResult.data as BlockedDatesData | null;
  const productsData = productsResult.data as ProductsData | null;

  return NextResponse.json({
    ok: true,
    data: {
      designer: ctxData ? {
        id: (ctxData as SiteContextData).data?.designer_id,
        name: (ctxData as SiteContextData).data?.designer_name,
      } : null,
      schedule: scheduleData?.data ?? null,
      blockedDates: blockedData?.blocked_dates ?? [],
      products: productsData?.products ?? [],
    },
  });
}
