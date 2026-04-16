/**
 * Phase 4 보정 #4: 원본 skin 의 submitForm() 스텁을 `/api/public/inquiry` POST 로 교체.
 *
 * 원본 submitForm() 은 alert 만 띄우고 서버로 전송하지 않음.
 * 바꿔치기: 모달 필드(f-name, f-person, f-phone, f-visit, f-dept, f-svc, f-msg)
 *           → POST /api/public/inquiry → 문의게시판 자동 생성.
 *
 * slug 은 경로 `/org-{id}` 에서 auto-detect — skin 은 어떤 slug 로든 로드될 수 있으므로
 * window.location.pathname 에서 첫 세그먼트 사용.
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });
const SITE_ID = '1bfe08ba-e9c4-48e7-b2c5-8318aa7e3d09';

async function run() {
  const [row] = await sql`
    SELECT id, content FROM site_files
    WHERE site_id = ${SITE_ID} AND filename = 'index.html'
  `;
  if (!row) { console.log('index.html not found'); process.exit(1); }

  let html = row.content;
  const before = html.length;

  // 기존 submitForm 스텁
  const oldSubmit = `function submitForm(){
  const name=document.getElementById('f-name').value;
  const person=document.getElementById('f-person').value;
  const phone=document.getElementById('f-phone').value;
  if(!name||!person||!phone){alert('필수 항목을 모두 입력해주세요.');return}
  alert('상담 신청이 완료되었습니다.\\n담당자가 빠르게 연락드리겠습니다.');
  closeForm();
}`;

  // 신규 submitForm — /api/public/inquiry POST
  const newSubmit = `function submitForm(){
  var name=document.getElementById('f-name').value.trim();
  var person=document.getElementById('f-person').value.trim();
  var phone=document.getElementById('f-phone').value.trim();
  var msg=(document.getElementById('f-msg')||{}).value||'';
  var visitSel=document.querySelector('#f-visit button.sel');
  var deptSel=document.querySelector('#f-dept button.sel');
  var svcSel=Array.from(document.querySelectorAll('#f-svc button.sel')).map(function(b){return b.textContent.trim()});
  if(!name||!person||!phone){alert('필수 항목(병원명/성함/연락처)을 모두 입력해주세요.');return}
  var slug=(window.location.pathname.split('/').filter(function(s){return s})[0])||'';
  var fields={
    '병원명':name,
    '성함(직책)':person,
    '연락처':phone,
    '방문경로':visitSel?visitSel.textContent.trim():'',
    '진료과':deptSel?deptSel.textContent.trim():'',
    '문의서비스선택':svcSel.join(', '),
    '문의내용':msg.trim()
  };
  var btn=document.querySelector('#formOverlay button[onclick="submitForm()"]');
  if(btn){btn.disabled=true;btn.textContent='전송 중...';}
  fetch('/api/public/inquiry',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({slug:slug,fields:fields})
  }).then(function(r){return r.json().catch(function(){return{ok:false}})})
    .then(function(d){
      if(d&&d.ok){alert('상담 신청이 완료되었습니다.\\n담당자가 빠르게 연락드리겠습니다.');closeForm();}
      else{alert('전송 실패: '+(d&&d.error||'잠시 후 다시 시도해주세요.'));}
    })
    .catch(function(){alert('네트워크 오류로 전송에 실패했습니다.');})
    .finally(function(){if(btn){btn.disabled=false;btn.innerHTML='💬 상담 신청하기';}});
}`;

  if (html.indexOf(oldSubmit) < 0) {
    if (html.indexOf("fetch('/api/public/inquiry'") >= 0) {
      console.log('[=] submitForm already wired to /api/public/inquiry — skip');
    } else {
      console.log('[!] 기존 submitForm 스텁을 찾지 못했습니다 (이미 변형?).');
      console.log('    head of old pattern: "' + oldSubmit.substring(0, 60) + '..."');
    }
    await sql.end();
    return;
  }

  html = html.replace(oldSubmit, newSubmit);
  console.log('[1] submitForm() replaced with fetch-based version');
  console.log('    length', before, '→', html.length);

  await sql`UPDATE site_files SET content = ${html}, file_size = ${html.length}, updated_at = NOW() WHERE id = ${row.id}`;
  console.log('[1] saved site_files row', row.id);

  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
