/**
 * Phase 4: org-5 스킨 HTML 수정 스크립트
 * - 배너 영역 컨테이너 삽입 (4개 섹션)
 * - 배너 CSS + JS 인라인 삽입
 * - site_files에 커스텀 index.html 저장
 */
const postgres = require('postgres');
// env loaded via shell: set -a && source .env && set +a

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });
const SITE_ID = '1bfe08ba-e9c4-48e7-b2c5-8318aa7e3d09';

async function run() {
  // 1. 원본 HTML 읽기
  const [skinFile] = await sql`SELECT content FROM web_skin_files WHERE id = 7`;
  let html = skinFile.content;
  console.log('Original HTML length:', html.length);

  // ═══ Section #ms: 슬라이더 트랙에 배너 루프 추가 ═══
  // 기존: <div class="mst" id="sliderTrack"></div> (빈 상태)
  // 수정: banner_loop으로 슬라이드 카드 생성
  html = html.replace(
    '<div class="ms-slider"><div class="mst" id="sliderTrack"></div></div>',
    `<div class="ms-slider roo-banner-area" area_id="temperature-people"><div class="mst" id="sliderTrack"><!--@banner_loop--><div class="ms-card roo-slide" data-num="{#num}"><img src="{#img}" alt="{#title}" loading="lazy"><div class="ms-card-name">{#title}</div><div class="ms-card-text">{#text}</div></div><!--@end_banner_loop--></div></div>`
  );

  // ═══ Section #blog-focus: 차트 뒤에 블로그 배너 그리드 추가 ═══
  // 기존 #channelChart div 다음(</section> 직전)에 grid 삽입
  // blog-focus 섹션 </section> 과 criteria 사이에 <div class="div"></div> 구분선이 있음
  // 패턴: </div></section>\n<div class="div"></div>\n\n<section id="criteria"
  html = html.replace(
    /<\/div><\/section>\n<div class="div"><\/div>\n\n<section id="criteria"/,
    `</div>
<div class="roo-banner-area roo-blog-grid" area_id="blog" style="margin-top:48px">
<div class="roo-grid-adaptive">
<!--@banner_loop-->
<div class="roo-grid-item"><a href="{#link}" target="{#target}"><img src="{#img}" alt="{#title}" loading="lazy"><div class="roo-grid-caption">{#title}</div></a></div>
<!--@end_banner_loop-->
</div>
</div>
</section>
<div class="div"></div>

<section id="criteria"`
  );

  // ═══ Section #criteria: 이모지 카드를 배너 이미지 카드로 교체 ═══
  const criteriaOld = `<div class="pg sg"><div class="pc"><div class="icon">🗑️</div><h4>채널 삭제</h4><p>마케팅이 끝난 이후 모든 채널이 삭제되고 있진 않나요?</p></div><div class="pc"><div class="icon">🔄</div><h4>담당자 교체</h4><p>담당자가 자주 바뀌고 다시 내 병원을 설명한 적 있나요?</p></div><div class="pc"><div class="icon">📈</div><h4>상위노출만</h4><p>상위노출만 시켜주고 실질적인 매출이 증가하지 않았나요?</p></div><div class="pc"><div class="icon">🛡️</div><h4>의료법 대응</h4><p>의료신고 대응 문제가 원장님의 몫이 되고 있진 않나요?</p></div></div>`;

  const criteriaNew = `<div class="roo-banner-area roo-criteria-grid pg sg" area_id="criteria">
<div class="pc roo-criteria-card"><div class="roo-criteria-img"><img src="{#img_1}" alt="{#title_1}" loading="lazy"></div><h4>{#title_1}</h4><p>{#text_1}</p></div>
<div class="pc roo-criteria-card"><div class="roo-criteria-img"><img src="{#img_2}" alt="{#title_2}" loading="lazy"></div><h4>{#title_2}</h4><p>{#text_2}</p></div>
<div class="pc roo-criteria-card"><div class="roo-criteria-img"><img src="{#img_3}" alt="{#title_3}" loading="lazy"></div><h4>{#title_3}</h4><p>{#text_3}</p></div>
<div class="pc roo-criteria-card"><div class="roo-criteria-img"><img src="{#img_4}" alt="{#title_4}" loading="lazy"></div><h4>{#title_4}</h4><p>{#text_4}</p></div>
</div>`;

  html = html.replace(criteriaOld, criteriaNew);

  // ═══ Section #medical-law: 이모지 카드를 배너 이미지 카드로 교체 ═══
  const medlawOld = `<div class="pg sg" style="grid-template-columns:repeat(3,1fr)">
<div class="pc"><div class="icon">📬</div><h4>의료신고 등기 수령</h4><p>어느 날 갑자기 날아오는 "의료법 위반 통지서"<br>답답하고 화가납니다.</p></div>
<div class="pc"><div class="icon">🔍</div><h4>경쟁병원의 감시</h4><p>의료문제로 1~100까지 신고하는 경쟁병원,<br>피해갈 수 없습니다.</p></div>
<div class="pc"><div class="icon">⚠️</div><h4>대응 문제</h4><p>현재 업체의 대응 문제로 "영업정지 및 과태료"<br>고스란히 원장님의 몫입니다.</p></div>
</div>`;

  const medlawNew = `<div class="roo-banner-area roo-law-cards pg sg" area_id="medical-law" style="grid-template-columns:repeat(3,1fr)">
<div class="pc roo-law-card"><div class="roo-law-img"><img src="{#img_1}" alt="{#title_1}" loading="lazy"></div><h4>{#title_1}</h4><p>{#text_1}</p></div>
<div class="pc roo-law-card"><div class="roo-law-img"><img src="{#img_2}" alt="{#title_2}" loading="lazy"></div><h4>{#title_2}</h4><p>{#text_2}</p></div>
<div class="pc roo-law-card"><div class="roo-law-img"><img src="{#img_3}" alt="{#title_3}" loading="lazy"></div><h4>{#title_3}</h4><p>{#text_3}</p></div>
</div>`;

  html = html.replace(medlawOld, medlawNew);

  // ═══ CSS + JS 인라인 삽입 (</head> 직전) ═══
  const bannerCSS = `
<style id="roo-banner-styles">
/* ── 슬라이더 (ms section) ── */
.ms-slider { overflow: hidden; position: relative; }
.mst { display: flex; gap: 20px; animation: rooSlide 30s linear infinite; }
.ms-card { min-width: 260px; flex-shrink: 0; border-radius: 12px; overflow: hidden; background: var(--bg2); }
.ms-card img { width: 100%; aspect-ratio: 3/4; object-fit: cover; }
.ms-card-name { padding: 12px 16px 4px; font-weight: 700; font-size: 15px; }
.ms-card-text { padding: 0 16px 16px; font-size: 13px; color: var(--text2); line-height: 1.6; }
@keyframes rooSlide { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

/* ── 블로그 그리드 ── */
.roo-grid-adaptive { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.roo-grid-item { border-radius: 12px; overflow: hidden; background: var(--bg2); transition: transform .3s; }
.roo-grid-item:hover { transform: translateY(-4px); }
.roo-grid-item a { text-decoration: none; color: inherit; display: block; }
.roo-grid-item img { width: 100%; aspect-ratio: 16/10; object-fit: cover; }
.roo-grid-caption { padding: 12px 14px; font-size: 14px; font-weight: 600; color: var(--text); line-height: 1.4; }

/* ── criteria 카드 이미지 ── */
.roo-criteria-img { width: 100%; aspect-ratio: 1; border-radius: 10px; overflow: hidden; margin-bottom: 16px; }
.roo-criteria-img img { width: 100%; height: 100%; object-fit: cover; }
.roo-criteria-card .icon { display: none; }

/* ── medical-law 카드 이미지 ── */
.roo-law-img { width: 100%; aspect-ratio: 16/10; border-radius: 10px; overflow: hidden; margin-bottom: 16px; }
.roo-law-img img { width: 100%; height: 100%; object-fit: cover; }
.roo-law-card .icon { display: none; }

/* ── 반응형 ── */
@media (max-width: 1024px) {
  .roo-grid-adaptive { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 768px) {
  .roo-grid-adaptive {
    display: flex; overflow-x: auto; scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch; scrollbar-width: none; gap: 12px; padding: 0 4px;
  }
  .roo-grid-adaptive::-webkit-scrollbar { display: none; }
  .roo-grid-item { min-width: calc(85vw - 32px); scroll-snap-align: start; flex-shrink: 0; }
  .ms-card { min-width: 200px; }
  .mst { gap: 12px; }
  .roo-criteria-grid, .roo-law-cards { grid-template-columns: 1fr 1fr !important; }
}
@media (max-width: 480px) {
  .roo-criteria-grid { grid-template-columns: 1fr !important; }
  .roo-law-cards { grid-template-columns: 1fr !important; }
}

/* ── 빈 배너 area 숨김 ── */
.roo-banner-area[data-empty="1"] { display: none; }
.rs:has([data-empty="1"]) { display: none; }
</style>`;

  const bannerJS = `
<script id="roo-banner-scripts">
(function(){
  // 무한 슬라이드: 클론 방식
  var track=document.getElementById('sliderTrack');
  if(track&&track.children.length>0){
    var items=Array.from(track.children);
    items.forEach(function(el){track.appendChild(el.cloneNode(true))});
    var totalW=0;items.forEach(function(el){totalW+=el.offsetWidth+20});
    track.style.animationDuration=(totalW/40)+'s';
  }

  // 블로그 그리드: 불완전 행 숨김
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
  window.addEventListener('resize',hideIncompleteRows);
})();
</script>`;

  // </head> 직전에 CSS 삽입
  html = html.replace('</head>', bannerCSS + '\n</head>');
  // </body> 직전에 JS 삽입
  html = html.replace('</body>', bannerJS + '\n</body>');

  console.log('Modified HTML length:', html.length);
  console.log('Contains temperature-people:', html.includes('area_id="temperature-people"'));
  console.log('Contains blog area:', html.includes('area_id="blog"'));
  console.log('Contains criteria area:', html.includes('area_id="criteria"'));
  console.log('Contains medical-law area:', html.includes('area_id="medical-law"'));

  // 3. site_files에 커스텀 index.html 삽입 (org-5 전용)
  const existing = await sql`SELECT id FROM site_files WHERE site_id = ${SITE_ID} AND filename = 'index.html'`;
  if (existing.length > 0) {
    await sql`UPDATE site_files SET content = ${html}, updated_at = NOW() WHERE id = ${existing[0].id}`;
    console.log('Updated existing site_files entry:', existing[0].id);
  } else {
    const [row] = await sql`
      INSERT INTO site_files (site_id, filename, file_type, content, file_size, is_entry, sort_order, created_at, updated_at)
      VALUES (${SITE_ID}, 'index.html', 'html', ${html}, ${html.length}, true, 0, NOW(), NOW())
      RETURNING id
    `;
    console.log('Created new site_files entry:', row.id);
  }

  console.log('Done! org-5 will now use the modified HTML.');
  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
