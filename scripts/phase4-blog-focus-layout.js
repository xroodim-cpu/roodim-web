/**
 * blog-focus 섹션 레이아웃/애니메이션 개선.
 *
 * 대상: web_skin_files (skin_id=4 = 시즈닝데이 커스텀 스킨 ONDO) / index.html
 *
 * 변경:
 *  [1] CSS: .roo-blog-grid 스코프로 2~4열 반응형(1280/1024/768) + 페이드업 상태 클래스
 *  [2] JS:  hideIncompleteRows → layoutBlogGrid 로 확장
 *           - 불완전 행 숨김
 *           - 줄(row) × 아이템(col) 기반 transition-delay 스태거
 *           - 모바일은 가로 슬라이드라 아이템 순차 delay 만 적용
 *  [3] IO:  기존 IntersectionObserver 셀렉터에 `.roo-blog-grid .roo-grid-item` 추가
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

const SKIN_ID = 4;

async function run() {
  const [row] = await sql`
    SELECT id, content FROM web_skin_files
    WHERE skin_id = ${SKIN_ID} AND filename = 'index.html'
  `;
  if (!row) { console.log('[!] web_skin_files(skin_id=4, index.html) not found'); process.exit(1); }

  let html = row.content;
  const before = html.length;

  // [1] CSS 덧붙이기 — .roo-grid-caption 다음 줄에 blog-grid 전용 블록 삽입
  const cssAnchor = `.roo-grid-caption { padding: 12px 14px; font-size: 14px; font-weight: 600; color: var(--text); line-height: 1.4; }`;
  const cssAppend = `
/* [BLOG-FADEUP] 블로그 그리드 2~4열 + 아이템 페이드업 (blog-focus 섹션 전용) */
.roo-blog-grid .roo-grid-item{opacity:0;transform:translateY(30px);transition:opacity .75s cubic-bezier(.16,1,.3,1),transform .75s cubic-bezier(.16,1,.3,1);will-change:opacity,transform}
.roo-blog-grid .roo-grid-item.v{opacity:1;transform:translateY(0)}
@media (max-width:1279px){.roo-blog-grid .roo-grid-adaptive{grid-template-columns:repeat(3,1fr)}}
@media (max-width:1023px) and (min-width:768px){.roo-blog-grid .roo-grid-adaptive{grid-template-columns:repeat(2,1fr)}}`;
  if (html.indexOf('[BLOG-FADEUP]') >= 0) {
    console.log('[=] [BLOG-FADEUP] CSS already present — skip css inject');
  } else if (html.indexOf(cssAnchor) < 0) {
    console.log('[!] CSS anchor not found — aborting'); process.exit(1);
  } else {
    html = html.replace(cssAnchor, cssAnchor + cssAppend);
    console.log('[1] CSS injected after .roo-grid-caption');
  }

  // [2] JS hideIncompleteRows → layoutBlogGrid 교체
  const oldJs = `  // 블로그 그리드: 불완전 행 숨김
  function hideIncompleteRows(){
    document.querySelectorAll('.roo-grid-adaptive').forEach(function(grid){
      if(window.innerWidth<768)return; // 모바일은 스크롤이므로 skip
      var items=Array.from(grid.querySelectorAll('.roo-grid-item'));
      var style=getComputedStyle(grid);
      var cols=style.gridTemplateColumns.split(' ').length;
      var remainder=items.length%cols;
      items.forEach(function(el){el.style.display=''});
      if(remainder>0){
        for(var i=items.length-remainder;i<items.length;i++){
          items[i].style.display='none';
        }
      }
    });
  }
  hideIncompleteRows();
  window.addEventListener('resize',hideIncompleteRows);`;

  const newJs = `  // 블로그 그리드: 불완전 행 숨김 + 페이드업 스태거 delay
  function layoutBlogGrid(){
    document.querySelectorAll('.roo-grid-adaptive').forEach(function(grid){
      var items=Array.from(grid.querySelectorAll('.roo-grid-item'));
      items.forEach(function(el){el.style.display='';el.style.transitionDelay=''});
      if(window.innerWidth<768){
        // 모바일: peek slide — 순차 delay 만 (인스타 쓰레드 스크롤 시 자연스러운 cascade)
        items.forEach(function(el,i){el.style.transitionDelay=(i*80)+'ms'});
        return;
      }
      var cols=getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      var rem=items.length%cols;
      var shown=rem>0?items.length-rem:items.length;
      items.forEach(function(el,i){
        if(i>=shown){el.style.display='none';return;}
        var row=Math.floor(i/cols), col=i%cols;
        el.style.transitionDelay=(row*180+col*80)+'ms';
      });
    });
  }
  layoutBlogGrid();
  window.addEventListener('resize',layoutBlogGrid);`;

  if (html.indexOf('function layoutBlogGrid') >= 0) {
    console.log('[=] layoutBlogGrid already present — skip js replace');
  } else if (html.indexOf(oldJs) < 0) {
    console.log('[!] old hideIncompleteRows block not found'); process.exit(1);
  } else {
    html = html.replace(oldJs, newJs);
    console.log('[2] hideIncompleteRows → layoutBlogGrid 교체');
  }

  // [3] IO 셀렉터 확장
  const oldIo = `document.querySelectorAll('.rv,.rl,.rr,.rs,.sg').forEach(el=>obs.observe(el));`;
  const newIo = `document.querySelectorAll('.rv,.rl,.rr,.rs,.sg,.roo-blog-grid .roo-grid-item').forEach(el=>obs.observe(el));`;
  if (html.indexOf(newIo) >= 0) {
    console.log('[=] IO selector already extended — skip');
  } else if (html.indexOf(oldIo) < 0) {
    console.log('[!] old IO selector not found'); process.exit(1);
  } else {
    html = html.replace(oldIo, newIo);
    console.log('[3] IntersectionObserver 셀렉터에 .roo-blog-grid .roo-grid-item 추가');
  }

  if (html.length === before) {
    console.log('[=] no changes — file unchanged');
    await sql.end(); return;
  }

  await sql`
    UPDATE web_skin_files
    SET content = ${html}, file_size = ${html.length}, updated_at = NOW()
    WHERE id = ${row.id}
  `;
  console.log('[ok] web_skin_files.id=' + row.id + ' saved (' + before + ' → ' + html.length + ' bytes)');
  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
