/**
 * site_files index.html 에서 inquiry 폼 관련 마킹을 검사한다.
 * `<!--@inquiry_form-->` 치환 위치, 기존 openForm/submitForm 함수 존재 여부,
 * API 호출 코드 등을 리포트.
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });
const SITE_ID = '1bfe08ba-e9c4-48e7-b2c5-8318aa7e3d09';

async function run() {
  const [row] = await sql`
    SELECT id, content FROM site_files
    WHERE site_id = ${SITE_ID} AND filename = 'index.html'
  `;
  if (!row) {
    console.log('not found');
    process.exit(1);
  }

  const html = row.content;
  const len = html.length;

  const checks = {
    size: len,
    inquiry_form_code: html.indexOf('<!--@inquiry_form-->'),
    api_public_inquiry: html.indexOf('/api/public/inquiry'),
    openForm_fn_def: html.indexOf('function openForm'),
    submitForm_fn_def: html.indexOf('function submitForm'),
    openForm_arrow: html.indexOf('openForm='),
    submitForm_arrow: html.indexOf('submitForm='),
    window_openForm: html.indexOf('window.openForm'),
    openForm_call: html.indexOf('openForm()'),
    submitForm_call: html.indexOf('submitForm()'),
    modal_open_class: html.indexOf('openModal'),
    form_action: (html.match(/<form[^>]*action="[^"]*"/g) || []).slice(0, 3),
    forms_count: (html.match(/<form/g) || []).length,
  };

  console.log(JSON.stringify(checks, null, 2));

  // openForm 정의 주변 컨텍스트 찍어보기
  const openFormIdx = html.search(/openForm\s*[=(]/);
  if (openFormIdx >= 0) {
    const ctx = html.substring(Math.max(0, openFormIdx - 60), openFormIdx + 400);
    console.log('\n--- openForm context ---');
    console.log(ctx);
  }

  const submitFormIdx = html.search(/submitForm\s*[=(]/);
  if (submitFormIdx >= 0) {
    const ctx = html.substring(Math.max(0, submitFormIdx - 60), submitFormIdx + 800);
    console.log('\n--- submitForm context ---');
    console.log(ctx);
  }

  await sql.end();
}

run().catch((e) => { console.error(e); process.exit(1); });
