import { db } from '@/lib/db';
import { sites, reservations as reservationsTable } from '@/drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import AddressBookClient from './AddressBookClient';

interface AddressBookPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AddressBookPage({ params }: AddressBookPageProps) {
  const { slug } = await params;

  const site = await db.query.sites.findFirst({
    where: eq(sites.slug, slug),
  });

  if (!site) {
    return <div className="c-alert c-alert-error">사이트를 찾을 수 없습니다.</div>;
  }

  // 이 사이트의 전체 예약을 시간 역순으로 — 주소록은 이 목록을 전화번호로 그룹핑
  const rows = await db
    .select()
    .from(reservationsTable)
    .where(eq(reservationsTable.siteId, site.id))
    .orderBy(desc(reservationsTable.reservedDate), desc(reservationsTable.createdAt));

  // 고객 단위로 집계: phone 키로 묶고, 이름/이메일/방문수/최근·첫 방문일/대표 메모 요약
  type ChartEntry = {
    phone: string;
    name: string;
    email: string | null;
    visitCount: number;
    firstVisit: string;
    lastVisit: string;
    lastStatus: string;
    reservations: Array<{
      id: number;
      date: string;
      time: string | null;
      treatment: string | null;
      status: string;
      memo: string | null;
      adminMemo: string | null;
    }>;
  };

  const bucket = new Map<string, ChartEntry>();
  for (const r of rows) {
    const key = r.customerPhone?.trim() || `no-phone-${r.id}`;
    const dateStr = typeof r.reservedDate === 'string'
      ? r.reservedDate
      : new Date(r.reservedDate as unknown as string).toISOString().slice(0, 10);

    const entry = bucket.get(key);
    if (entry) {
      entry.visitCount += 1;
      if (dateStr > entry.lastVisit) entry.lastVisit = dateStr;
      if (dateStr < entry.firstVisit) entry.firstVisit = dateStr;
      entry.reservations.push({
        id: r.id,
        date: dateStr,
        time: r.reservedTime as unknown as string | null,
        treatment: r.treatmentName,
        status: r.status,
        memo: r.memo,
        adminMemo: r.adminMemo,
      });
    } else {
      bucket.set(key, {
        phone: r.customerPhone,
        name: r.customerName,
        email: r.customerEmail,
        visitCount: 1,
        firstVisit: dateStr,
        lastVisit: dateStr,
        lastStatus: r.status,
        reservations: [{
          id: r.id,
          date: dateStr,
          time: r.reservedTime as unknown as string | null,
          treatment: r.treatmentName,
          status: r.status,
          memo: r.memo,
          adminMemo: r.adminMemo,
        }],
      });
    }
  }

  const charts = Array.from(bucket.values()).sort((a, b) =>
    a.lastVisit < b.lastVisit ? 1 : -1,
  );

  return <AddressBookClient charts={charts} />;
}
