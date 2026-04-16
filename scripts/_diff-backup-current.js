/**
 * 백업 (skin_backup_split_20260416) vs 현재 (header+index+footer 합성) 비교.
 *  - <style> 내용 diff
 *  - <script> 내용 diff (개수/각각 길이)
 *  - body 구조 (각 섹션 존재 여부)
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });
const SITE_ID = '1bfe08ba-e9c4-48e7-b2c5-8318aa7e3d09';

(async () => {
  const [b] = await sql`SELECT data FROM site_configs WHERE site_id=${SITE_ID} AND section='skin_backup_split_20260416'`;
  const bData = typeof b.data === 'string' ? JSON.parse(b.data) : b.data;
  const backupIndex = bData.index_html;
  console.log('백업 index.html 길이:', backupIndex?.length);

  const files = await sql`SELECT filename, content FROM web_skin_files WHERE skin_id=4 AND filename IN ('index.html','header.html','footer.html')`;
  const byName = Object.fromEntries(files.map(f => [f.filename, f.content]));

  // 현재 합성 (include 치환 전): header + sections + footer
  const currentFull = byName['header.html'] + byName['index.html'].replace('<!--@header-->','').replace('<!--@footer-->','') + byName['footer.html'];

  // ── 1) <style> 길이 비교
  const bStyleM = backupIndex.match(/<style\b[\s\S]*?<\/style>/);
  const cStyleM = currentFull.match(/<style\b[\s\S]*?<\/style>/);
  console.log('\n[<style>]');
  console.log('  백업 :', bStyleM ? bStyleM[0].length + 'b' : '없음');
  console.log('  현재 :', cStyleM ? cStyleM[0].length + 'b' : '없음');
  console.log('  동일 여부:', bStyleM && cStyleM && bStyleM[0] === cStyleM[0] ? '완전일치 ✓' : '다름 ✗');

  // ── 2) <script> 개수 + 길이
  const bScripts = [...backupIndex.matchAll(/<script\b[\s\S]*?<\/script>/g)].map(m => m[0]);
  const cScripts = [...currentFull.matchAll(/<script\b[\s\S]*?<\/script>/g)].map(m => m[0]);
  console.log('\n[<script>]');
  console.log('  백업 :', bScripts.length, '개 길이=', bScripts.map(s => s.length));
  console.log('  현재 :', cScripts.length, '개 길이=', cScripts.map(s => s.length));
  for (let i = 0; i < Math.max(bScripts.length, cScripts.length); i++) {
    const be = bScripts[i] || '';
    const ce = cScripts[i] || '';
    console.log(`  script[${i}] ${be.length}b → ${ce.length}b  ${be === ce ? '동일 ✓' : '다름 ✗'}`);
    if (be && ce && be !== ce) {
      // 첫 차이 지점
      let off = 0;
      while (off < Math.min(be.length, ce.length) && be[off] === ce[off]) off++;
      console.log(`    첫 차이 offset=${off}:  백업="${be.slice(off, off+80).replace(/\n/g,'\n')}" vs 현재="${ce.slice(off, off+80).replace(/\n/g,'\n')}"`);
    }
  }

  // ── 3) @keyframes 개수 비교
  const bKey = [...(bStyleM?.[0]||'').matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  const cKey = [...(cStyleM?.[0]||'').matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  console.log('\n[@keyframes]');
  console.log('  백업 :', bKey);
  console.log('  현재 :', cKey);

  // ── 4) sliderTrack / ms-slider 관련 CSS rule 확인
  const sliderCssB = (bStyleM?.[0]||'').match(/\.ms-slider[\s\S]*?\}[^\{]*?\}/g) || [];
  const sliderCssC = (cStyleM?.[0]||'').match(/\.ms-slider[\s\S]*?\}[^\{]*?\}/g) || [];
  console.log('\n[.ms-slider CSS rules count]');
  console.log('  백업 :', sliderCssB.length);
  console.log('  현재 :', cStyleM?.[0].split('.ms-slider').length - 1);

  // ── 5) body open 근처 영역
  console.log('\n[<body> 직후 500b]');
  const bBodyOpen = backupIndex.match(/<body\b[^>]*>/);
  console.log('  백업:', backupIndex.slice(bBodyOpen.index + bBodyOpen[0].length, bBodyOpen.index + bBodyOpen[0].length + 500).replace(/\n/g,'\n'));

  await sql.end();
})().catch(e => { console.error(e); process.exit(1); });
