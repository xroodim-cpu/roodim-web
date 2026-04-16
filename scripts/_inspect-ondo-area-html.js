/**
 * 각 area_id="N" 블록의 실제 HTML 추출 → 루프 방식 vs 고정 슬롯 방식 확인.
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

async function run() {
  const [row] = await sql`SELECT content FROM web_skin_files WHERE skin_id = 4 AND filename = 'index.html'`;
  const html = row.content;

  // 각 area_id 블록 추출
  // banner-area div 시작부터 다음 banner-area 또는 </section> 까지
  const areaRegex = /(<div[^>]*roo-banner-area[^>]*area_id="(\d+)"[^>]*>)([\s\S]*?)(<\/div>\s*(?=<\/section>|<section|<div class="pg)|(?=<div[^>]*roo-banner-area))/g;

  for (const m of html.matchAll(areaRegex)) {
    const openTag = m[1];
    const areaId = m[2];
    const inner = m[3];
    // area 블록 닫는 </div> 까지 포함
    const fullBlock = (openTag + inner + '</div>').replace(/\n\s*\n/g, '\n');

    const hasLoop = /<!--@banner_loop-->/.test(inner);
    const fixedImgs = [...inner.matchAll(/\{#img_(\d+)\}/g)].map(x => Number(x[1]));
    const fixedTexts = [...inner.matchAll(/\{#text_(\d+)\}/g)].map(x => Number(x[1]));
    const loopVars = [...inner.matchAll(/\{#(img|text|link|title|num|target|video|html)\}/g)].map(x => x[1]);

    console.log('\n' + '═'.repeat(70));
    console.log(`area_id="${areaId}"  패턴: ${hasLoop ? '루프' : ''}${hasLoop && fixedImgs.length ? ' + ' : ''}${fixedImgs.length ? '고정(' + [...new Set(fixedImgs)].sort((a,b)=>a-b).join(',') + '번)' : ''}`);
    console.log('═'.repeat(70));
    console.log(fullBlock.trim());
  }

  await sql.end();
}
run().catch(e => { console.error(e); process.exit(1); });
