/**
 * ONDO style.css + index.html 의 모든 font-size 선언 형태 전수조사
 * (px / rem / em / % / vw / var / clamp / named — 어떤 단위/형태로 쓰여있는지)
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

async function run() {
  for (const filename of ['style.css', 'index.html', 'header.html', 'footer.html']) {
    const [row] = await sql`SELECT content FROM web_skin_files WHERE skin_id = 4 AND filename = ${filename}`;
    if (!row) continue;
    const content = row.content;

    // 모든 font-size 선언 (값과 함께)
    const all = [...content.matchAll(/font-size\s*:\s*([^;\n"}]+)/gi)];
    console.log(`\n=== ${filename} — font-size 선언 ${all.length}건 ===`);

    // 값 형태별 그룹
    const groups = new Map();
    for (const m of all) {
      const val = m[1].trim();
      groups.set(val, (groups.get(val) || 0) + 1);
    }
    const sorted = [...groups.entries()].sort((a, b) => b[1] - a[1]);
    for (const [val, count] of sorted) {
      console.log(`  ${String(count).padStart(3)} × ${val}`);
    }
  }

  // style.css 일부 샘플 — 처음 2000자
  const [css] = await sql`SELECT content FROM web_skin_files WHERE skin_id = 4 AND filename = 'style.css'`;
  console.log('\n=== style.css 처음 2KB ===');
  console.log(css.content.slice(0, 2000));

  console.log('\n=== style.css 의 :root 블록 ===');
  const rootMatch = css.content.match(/:root\s*\{[\s\S]*?\}/);
  if (rootMatch) console.log(rootMatch[0]);
  else console.log('  (없음)');

  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
