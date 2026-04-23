import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { bannerAreas, bannerItems } from '../src/drizzle/schema';
import { eq, and } from 'drizzle-orm';

/**
 * 테스트용: 이프운하 사이트에 vogue 스킨 6개 area 의 샘플 데이터 INSERT.
 * 각 area root upsert + items 재삽입.
 */

const SITE_ID = '89fbee8b-e919-4991-a1ab-33c961a0a28c';

type Item = {
  num: number;
  title?: string;
  imgUrl?: string;
  videoUrl?: string;
  linkUrl?: string;
  linkTarget?: string;
  textContent?: string;
  htmlContent?: string;
  images?: string[];
  texts?: string[];
};

type Area = {
  areaId: string;
  areaName: string;
  areaDesc: string;
  displayType?: string;
  items: Item[];
};

const areas: Area[] = [
  // 1) HERO — 3 슬라이드, 각 슬라이드마다 img + texts[1..6]
  {
    areaId: 'hero',
    areaName: 'Hero',
    areaDesc: 'Cover slides',
    displayType: 'slide',
    items: [
      {
        num: 1,
        title: 'Cover 01',
        imgUrl: 'https://images.unsplash.com/photo-1617791160536-598cf32026fb?w=1600&q=80',
        texts: ['CREATIVE STUDIO', 'AI FIRST', 'SPRING 2026', 'EVERY BRAND', 'AT LIGHT SPEED', 'NO. 247'],
        linkUrl: '#models',
      },
      {
        num: 2,
        title: 'Cover 02',
        imgUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1600&q=80',
        texts: ['BEAUTY', 'UNDER LIGHT', 'ISSUE 02', 'FORGED', 'LEATHER', 'BAGS'],
        linkUrl: '#portfolio',
      },
      {
        num: 3,
        title: 'Cover 03',
        imgUrl: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=1600&q=80',
        texts: ['FROM SEOUL', 'TO THE WORLD', 'AI MEETS', '100 YEARS', 'OF STYLE', 'ARCHIVE'],
        linkUrl: '#packages',
      },
    ],
  },

  // 2) CINEMATIC — 3 scene
  {
    areaId: 'cinematic',
    areaName: 'Cinematic',
    areaDesc: 'Sticky scroll scenes',
    displayType: 'slide',
    items: [
      {
        num: 1,
        title: 'Beauty, reimagined with AI.',
        imgUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1600&q=80',
        texts: ['Cover Project', '10년의 광고 내공과 AI 기술을 결합해 전례 없는 뷰티 비주얼을 만듭니다.', 'View AI Models'],
        linkUrl: '#models',
      },
      {
        num: 2,
        title: 'Stories that move people.',
        imgUrl: 'https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?w=1600&q=80',
        texts: ['Motion & Story', '정지된 한 컷을 넘어, 살아 움직이는 브랜드 콘텐츠.', 'View Films'],
        linkUrl: '#portfolio',
      },
      {
        num: 3,
        title: 'Where brands meet their future.',
        imgUrl: 'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=1600&q=80',
        texts: ['Why iFUNHA', '우리가 함께 만든 결과물이 증명합니다.', 'Start Your Project'],
        linkUrl: '#packages',
      },
    ],
  },

  // 3) AI MODELS — 6 카드
  {
    areaId: 'ai_models',
    areaName: 'SIX DISTINCT AI ARCHETYPES',
    areaDesc: '브랜드의 톤에 맞는 모델을 선택하세요. 뷰티·패션·라이프스타일 영역에 최적화된 AI 모델.',
    displayType: 'grid',
    items: [
      { num: 1, title: 'Beauty Signature',  images: ['https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&q=80'], texts: ['립스틱·스킨케어·파운데이션 광고에 최적화된 클로즈업 전문 모델.'] },
      { num: 2, title: 'Fashion Statement', images: ['https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80'], texts: ['의류·액세서리 브랜드를 위한 전신 룩북 모델.'] },
      { num: 3, title: 'Lifestyle Muse',    images: ['https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600&q=80'], texts: ['일상적이고 자연스러운 무드의 라이프스타일 모델.'] },
      { num: 4, title: 'Editorial Icon',    images: ['https://images.unsplash.com/photo-1617791160536-598cf32026fb?w=600&q=80'], texts: ['하이패션 매거진 커버 스타일의 아이코닉한 모델.'] },
      { num: 5, title: 'Serene Essence',    images: ['https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80'], texts: ['차분하고 우아한 톤의 절제된 모델.'] },
      { num: 6, title: 'Bold Presence',     images: ['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80'], texts: ['임팩트 있는 비주얼을 원하는 브랜드를 위한 대담한 스타일.'] },
    ],
  },

  // 4) CRAFT / PROCESS — 4 단계
  {
    areaId: 'craft',
    areaName: 'THE CRAFT OF MAKING',
    areaDesc: '상담에서 납품까지, 투명한 4단계 프로세스.',
    displayType: 'grid',
    items: [
      { num: 1, title: 'Brief',      texts: ['브랜드의 톤, 타겟, 목표를 듣고 최적의 방향을 함께 찾아냅니다.'] },
      { num: 2, title: 'Concept',    texts: ['2~3개의 시안으로 방향성을 확정합니다.'] },
      { num: 3, title: 'Production', texts: ['확정된 컨셉을 바탕으로 본제작이 진행됩니다.'] },
      { num: 4, title: 'Delivery',   texts: ['최종 파일 전달 후에도 사후관리를 이어갑니다.'] },
    ],
  },

  // 5) PACKAGES — 4 패키지
  {
    areaId: 'packages',
    areaName: 'FOUR WAYS TO WORK',
    areaDesc: '예산과 목적에 맞춰 고를 수 있는 네 가지 패키지.',
    displayType: 'grid',
    items: [
      {
        num: 1, title: 'Starter',
        texts: ['첫 브랜드 컷을 시작하는 분께', '₩990K~', '3 Days · 5 Cuts', '문의하기 →'],
        htmlContent: '<ul><li>AI 모델 컷 5종 제작</li><li>컬러 보정 포함</li><li>1회 수정 포함</li><li>SNS 규격 자동 변환</li><li>고해상도 원본 제공</li></ul>',
        linkUrl: '#contact',
      },
      {
        num: 2, title: 'Essentials',
        texts: ['브랜드 론칭에 최적화된 구성', '₩2.49M~', '7 Days · 15 Cuts + 1 Film', '문의하기 →'],
        htmlContent: '<ul><li>AI 모델 컷 15종</li><li>숏폼 영상 1편 (15초)</li><li>3회 수정 포함</li><li>SNS·광고 규격 지원</li><li>카피라이팅 2안</li><li>전담 디렉터 매칭</li></ul>',
        linkUrl: '#contact',
      },
      {
        num: 3, title: 'Signature',
        texts: ['본격 캠페인을 준비하는 브랜드', '₩4.99M~', '14 Days · 30 Cuts + 3 Films', '문의하기 →'],
        htmlContent: '<ul><li>AI 모델 컷 30종</li><li>광고 영상 3편 (30초)</li><li>무제한 수정</li><li>브랜드 키비주얼 2안</li><li>카피라이팅 5안</li><li>론칭 전략 컨설팅</li></ul>',
        linkUrl: '#contact',
      },
      {
        num: 4, title: 'Couture',
        texts: ['맞춤형 풀 캠페인 프로젝트', 'On Request', '30+ Days · Full Campaign', 'Consult →'],
        htmlContent: '<ul><li>풀 캠페인 기획 & 제작</li><li>AI 모델 시리즈 구축</li><li>장편 영상 + 바이럴 전략</li><li>크리에이티브 디렉터 전담</li><li>브랜드 월드뷰 구축</li><li>캠페인 사후 관리 3개월</li></ul>',
        linkUrl: '#contact',
      },
    ],
  },

  // 6) FAQ head only (items 없음 — area_name/desc 만 사용)
  {
    areaId: 'faq',
    areaName: 'YOU ASKED, WE ANSWERED',
    areaDesc: '자주 묻는 질문들을 모았습니다. 더 궁금한 점은 언제든 문의해주세요.',
    displayType: 'grid',
    items: [
      { num: 1, title: 'FAQ head placeholder', textContent: '.' },
    ],
  },
];

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client);

  try {
    for (const a of areas) {
      // upsert area
      const existing = await db.select().from(bannerAreas)
        .where(and(eq(bannerAreas.siteId, SITE_ID), eq(bannerAreas.areaId, a.areaId)))
        .limit(1);

      let areaPk: number;
      if (existing.length > 0) {
        areaPk = existing[0].id;
        await db.update(bannerAreas)
          .set({ areaName: a.areaName, areaDesc: a.areaDesc, displayType: a.displayType || 'slide', updatedAt: new Date() })
          .where(eq(bannerAreas.id, areaPk));
        await db.delete(bannerItems).where(eq(bannerItems.areaId, areaPk));
        console.log(`~ area '${a.areaId}' (#${areaPk}) 갱신, items 재삽입`);
      } else {
        const [ins] = await db.insert(bannerAreas).values({
          siteId: SITE_ID,
          areaId: a.areaId,
          areaName: a.areaName,
          areaDesc: a.areaDesc,
          displayType: a.displayType || 'slide',
          isActive: true,
        }).returning();
        areaPk = ins.id;
        console.log(`+ area '${a.areaId}' (#${areaPk}) 신규 생성`);
      }

      for (const it of a.items) {
        await db.insert(bannerItems).values({
          areaId: areaPk,
          num: it.num,
          title: it.title,
          imgUrl: it.imgUrl,
          videoUrl: it.videoUrl,
          linkUrl: it.linkUrl,
          linkTarget: it.linkTarget || '_self',
          textContent: it.textContent,
          htmlContent: it.htmlContent,
          images: it.images,
          texts: it.texts,
          isActive: true,
        });
      }
      console.log(`  · ${a.items.length} items inserted`);
    }

    console.log('\n✅ 테스트 데이터 INSERT 완료.');
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
