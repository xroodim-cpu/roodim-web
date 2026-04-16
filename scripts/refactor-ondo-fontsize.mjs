/**
 * ONDO 스킨(skin_id=4) 의 font-size 선언을 :root 의 clamp() 변수로 토큰화.
 *
 * 사용:
 *   node --env-file=.env scripts/refactor-ondo-fontsize.mjs --dry-run    # 미리보기
 *   node --env-file=.env scripts/refactor-ondo-fontsize.mjs --apply      # 실행 (백업 저장 → UPDATE)
 *
 * 대상 파일: style.css, index.html, header.html, footer.html
 * 처리:
 *   - style.css 의 :root {} 블록 안에 --fs-* 변수 추가 (이미 있으면 스킵)
 *   - <style> 블록 및 인라인 style="font-size:Xpx" 속성의 모든 Xpx → var(--fs-*)
 *   - 기존 clamp(...) 리터럴 중 매칭되는 것도 var(--fs-*) 로 치환
 *   - .25em / .35em 같은 em 값은 그대로 유지
 *
 * 백업: backup/ondo_skin_before_clamp_<ISOTS>.json (원본 content 전체)
 */
import postgres from 'postgres';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = dirname(__dirname);
const BACKUP_DIR = PROJECT_ROOT + '/backup';

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const APPLY = args.has('--apply');
if (!DRY_RUN && !APPLY) {
  console.error('사용법: --dry-run 또는 --apply 플래그 중 하나 필요.');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

// ─── 토큰 정의 ───────────────────────────────────────────────────────────────
// 최종 :root 에 삽입될 변수. 기존 스킨이 이미 쓰던 clamp() 패턴과 최대한 일치시켰다.
const FS_VARS = {
  '--fs-tiny':    'clamp(9px, 1vw, 11px)',
  '--fs-xs':      'clamp(11px, 1.2vw, 13px)',
  '--fs-sm':      'clamp(13px, 1.5vw, 15px)',
  '--fs-base':    'clamp(15px, 1.6vw, 18px)',
  '--fs-md':      'clamp(16px, 2.5vw, 24px)',
  '--fs-lg':      'clamp(22px, 3vw, 36px)',
  '--fs-xl':      'clamp(28px, 4vw, 48px)',
  '--fs-hero':    'clamp(36px, 5vw, 56px)',
  '--fs-display': 'clamp(100px, 18vw, 220px)',
};

// px 값 → 토큰 매핑
function pxToToken(px) {
  const v = Math.round(px);
  if (v <= 11) return '--fs-tiny';
  if (v <= 13) return '--fs-xs';
  if (v <= 15) return '--fs-sm';
  if (v <= 18) return '--fs-base';
  if (v <= 24) return '--fs-md';
  if (v <= 36) return '--fs-lg';
  if (v <= 48) return '--fs-xl';
  if (v <= 80) return '--fs-hero';
  return '--fs-display';
}

// 기존 clamp() 리터럴 → 토큰 매핑 (max 값 기준으로 분류)
function clampToToken(clampStr) {
  const m = clampStr.match(/clamp\s*\(\s*[^,]+,\s*[^,]+,\s*(\d+(?:\.\d+)?)px\s*\)/i);
  if (!m) return null;
  return pxToToken(Number(m[1]));
}

// ─── 치환 함수 ───────────────────────────────────────────────────────────────
/**
 * font-size 값만 토큰화. 다른 선언(color, padding 등) 은 절대 건드리지 않음.
 *
 *  - `font-size: Xpx`                → `font-size: var(--fs-토큰)`
 *  - `font-size: clamp(...)`         → `font-size: var(--fs-토큰)` (max 값으로 매핑)
 *  - `font-size: .25em` 등 em/rem/%  → 변경 없음
 *  - `font-size: var(--...)`         → 변경 없음
 */
function transformFontSizes(content, stats) {
  if (!content) return content;

  // font-size: <value> 매칭 (세미콜론/줄바꿈/닫는 따옴표/닫는 중괄호 전까지)
  // 1) CSS 내부: 세미콜론 / 줄바꿈 / 닫는 중괄호로 종료
  // 2) 인라인 style="...": 세미콜론 / 닫는 따옴표로 종료 — 위와 동일 regex 로 처리 가능
  const regex = /font-size\s*:\s*([^;\n"}']+)/gi;

  return content.replace(regex, (match, raw) => {
    const val = raw.trim();

    // 이미 var() 이면 스킵
    if (/^var\s*\(/i.test(val)) {
      stats.skipped.var++;
      return match;
    }

    // px 단일 값
    const pxMatch = val.match(/^(\d+(?:\.\d+)?)px$/i);
    if (pxMatch) {
      const token = pxToToken(Number(pxMatch[1]));
      stats.px[val] = (stats.px[val] || 0) + 1;
      return match.replace(raw, ` var(${token})`);
    }

    // clamp(...) 리터럴
    if (/^clamp\s*\(/i.test(val)) {
      const token = clampToToken(val);
      if (token) {
        stats.clamp[val] = (stats.clamp[val] || 0) + 1;
        return match.replace(raw, ` var(${token})`);
      }
      stats.skipped.clampUnmapped++;
      return match;
    }

    // em / rem / % / 기타 — 변경 없음
    stats.skipped.other++;
    return match;
  });
}

/**
 * style.css 의 기존 :root {} 블록 안에 --fs-* 변수들을 추가한다.
 * 이미 --fs-tiny 같은 변수가 있으면 전체 토큰 블록을 스킵.
 */
function injectRootVars(css, stats) {
  if (!css.includes(':root')) {
    // :root 가 없으면 파일 맨 앞에 새로 삽입
    const block = ':root{\n' + Object.entries(FS_VARS).map(([k, v]) => `  ${k}:${v};`).join('\n') + '\n}\n';
    stats.rootInjection = 'prepended-new';
    return block + css;
  }

  // 이미 --fs-tiny 가 존재하면 (재실행 케이스) 스킵
  if (/--fs-(tiny|xs|sm|base|md|lg|xl|hero|display)\b/.test(css)) {
    stats.rootInjection = 'already-present-skip';
    return css;
  }

  // 기존 :root{...} 블록 끝에 변수 추가
  return css.replace(/:root\s*\{([\s\S]*?)\}/, (m, body) => {
    const trimmed = body.trim().replace(/;\s*$/, '');
    const newVars = Object.entries(FS_VARS).map(([k, v]) => `${k}:${v}`).join(';');
    stats.rootInjection = 'appended-to-existing';
    return `:root{${trimmed};${newVars}}`;
  });
}

// ─── 실행 ───────────────────────────────────────────────────────────────────
async function run() {
  const mode = DRY_RUN ? '[DRY-RUN]' : '[APPLY]';
  console.log(`${mode} ONDO skin_id=4 font-size 리팩터 시작\n`);

  const files = await sql`SELECT id, filename, content FROM web_skin_files WHERE skin_id = 4 ORDER BY filename`;

  const backup = {};
  const updates = [];

  for (const f of files) {
    const stats = { px: {}, clamp: {}, skipped: { var: 0, clampUnmapped: 0, other: 0 }, rootInjection: null };
    let newContent = f.content;
    backup[f.filename] = f.content;

    // style.css 는 :root 변수 삽입 + font-size 치환 둘 다
    if (f.filename === 'style.css') {
      newContent = injectRootVars(newContent, stats);
      newContent = transformFontSizes(newContent, stats);
    } else if (f.filename.endsWith('.html')) {
      // HTML: <style>, 인라인 속성 모두 transformFontSizes 로 커버 (동일 regex)
      newContent = transformFontSizes(newContent, stats);
    } else {
      continue; // main.js 등 스킵
    }

    const changed = newContent !== f.content;
    const pxCount = Object.values(stats.px).reduce((s, c) => s + c, 0);
    const clampCount = Object.values(stats.clamp).reduce((s, c) => s + c, 0);

    console.log(`📄 ${f.filename}  (id=${f.id})`);
    console.log(`   변경: ${changed ? 'YES' : 'no'}  px치환=${pxCount}  clamp치환=${clampCount}  skip_var=${stats.skipped.var}  skip_em/기타=${stats.skipped.other}`);
    if (stats.rootInjection) console.log(`   :root 주입: ${stats.rootInjection}`);
    if (pxCount > 0) {
      const pxDetail = Object.entries(stats.px).sort((a, b) => b[1] - a[1]).map(([v, c]) => `${v}×${c}`).join(', ');
      console.log(`   px 분포: ${pxDetail}`);
    }
    if (clampCount > 0) {
      const clampDetail = Object.entries(stats.clamp).map(([v, c]) => `(${v})×${c}`).join(', ');
      console.log(`   clamp 분포: ${clampDetail}`);
    }
    console.log('');

    if (changed) {
      updates.push({ id: f.id, filename: f.filename, oldContent: f.content, newContent });
    }
  }

  if (DRY_RUN) {
    console.log(`\n${mode} 완료 — 변경 예정 파일 ${updates.length}개. DB 갱신 안 함.`);

    // Diff 샘플 출력 (각 파일의 첫 5개 변경 라인)
    for (const u of updates) {
      console.log(`\n━━━ ${u.filename} — 변경 라인 샘플 ━━━`);
      const oldLines = u.oldContent.split('\n');
      const newLines = u.newContent.split('\n');
      let samplesShown = 0;
      const maxLen = Math.max(oldLines.length, newLines.length);
      for (let i = 0; i < maxLen && samplesShown < 5; i++) {
        if (oldLines[i] !== newLines[i]) {
          console.log(`   - ${oldLines[i]?.trim().slice(0, 120)}`);
          console.log(`   + ${newLines[i]?.trim().slice(0, 120)}`);
          console.log();
          samplesShown++;
        }
      }
    }

    await sql.end();
    return;
  }

  // APPLY 모드 — 백업 저장 후 UPDATE
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${BACKUP_DIR}/ondo_skin_before_clamp_${ts}.json`;
  writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf-8');
  console.log(`💾 백업 저장: ${backupPath}`);

  for (const u of updates) {
    await sql`UPDATE web_skin_files SET content = ${u.newContent}, updated_at = NOW() WHERE id = ${u.id}`;
    console.log(`   ✅ UPDATE ${u.filename} (id=${u.id}) — ${u.newContent.length - u.oldContent.length >= 0 ? '+' : ''}${u.newContent.length - u.oldContent.length} bytes`);
  }

  console.log(`\n${mode} 완료 — ${updates.length}개 파일 갱신.`);
  console.log(`   롤백: UPDATE web_skin_files SET content = ?(백업 JSON) WHERE id = ?`);

  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
