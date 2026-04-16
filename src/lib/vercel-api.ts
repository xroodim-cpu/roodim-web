/**
 * Vercel Domains API v9/v10 클라이언트
 *
 * 환경변수:
 *   VERCEL_API_TOKEN   — Vercel Dashboard → Account Settings → Tokens
 *   VERCEL_PROJECT_ID  — Vercel Project → Settings → General → Project ID
 *   VERCEL_TEAM_ID     — (선택) Team 아래 프로젝트면 필수, 개인이면 생략
 *
 * 환경변수 미설정 시 isEnabled() === false — 호출부에서 수동 CNAME 플로우로 폴백.
 *
 * 문서: https://vercel.com/docs/rest-api/endpoints/projects#add-a-domain-to-a-project
 */

const BASE = 'https://api.vercel.com';

function getConfig() {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID; // optional
  return { token, projectId, teamId };
}

export function isVercelApiEnabled(): boolean {
  const { token, projectId } = getConfig();
  return !!token && !!projectId;
}

function buildQuery(teamId?: string): string {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
}

type Envelope<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

export interface VerificationRecord {
  type: 'CNAME' | 'A' | 'TXT' | 'AAAA';
  domain?: string;
  value: string;
  reason?: string;
}

export interface DomainInfo {
  name: string;
  verified: boolean;
  verification?: VerificationRecord[];
  apexName?: string;
  projectId?: string;
  createdAt?: number;
  updatedAt?: number;
  redirect?: string | null;
}

/**
 * 프로젝트에 도메인 등록
 * POST /v10/projects/:projectId/domains?teamId=...
 */
export async function addDomain(domain: string): Promise<Envelope<DomainInfo>> {
  const { token, projectId, teamId } = getConfig();
  if (!token || !projectId) return { ok: false, error: 'Vercel API not configured' };

  try {
    const res = await fetch(`${BASE}/v10/projects/${encodeURIComponent(projectId)}/domains${buildQuery(teamId)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    });

    const json = await res.json();

    if (!res.ok) {
      // 409 = already added (to this or another project). 둘 다 사용자에게 메시지 노출.
      const msg = json?.error?.message || `Vercel API ${res.status}`;
      return { ok: false, error: msg, status: res.status };
    }

    return { ok: true, data: json as DomainInfo };
  } catch (e) {
    return { ok: false, error: `Vercel API fetch failed: ${String(e)}` };
  }
}

/**
 * 도메인 검증 상태 조회
 * GET /v9/projects/:projectId/domains/:domain?teamId=...
 */
export async function getDomain(domain: string): Promise<Envelope<DomainInfo>> {
  const { token, projectId, teamId } = getConfig();
  if (!token || !projectId) return { ok: false, error: 'Vercel API not configured' };

  try {
    const res = await fetch(
      `${BASE}/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}${buildQuery(teamId)}`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      },
    );

    const json = await res.json();
    if (!res.ok) {
      const msg = json?.error?.message || `Vercel API ${res.status}`;
      return { ok: false, error: msg, status: res.status };
    }

    return { ok: true, data: json as DomainInfo };
  } catch (e) {
    return { ok: false, error: `Vercel API fetch failed: ${String(e)}` };
  }
}

/**
 * 프로젝트에서 도메인 제거
 * DELETE /v9/projects/:projectId/domains/:domain?teamId=...
 */
export async function removeDomain(domain: string): Promise<Envelope<{ removed: true }>> {
  const { token, projectId, teamId } = getConfig();
  if (!token || !projectId) return { ok: false, error: 'Vercel API not configured' };

  try {
    const res = await fetch(
      `${BASE}/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}${buildQuery(teamId)}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      },
    );

    // 404 (이미 없음) 는 성공으로 취급
    if (res.status === 404) return { ok: true, data: { removed: true } };

    if (!res.ok) {
      let msg = `Vercel API ${res.status}`;
      try {
        const json = await res.json();
        msg = json?.error?.message || msg;
      } catch { /* ignore */ }
      return { ok: false, error: msg, status: res.status };
    }

    return { ok: true, data: { removed: true } };
  } catch (e) {
    return { ok: false, error: `Vercel API fetch failed: ${String(e)}` };
  }
}

/**
 * 상태 해석 헬퍼 — Vercel 응답의 verified + verification[] 을 앱 내부 상태로 매핑
 *
 *  - verified === true                         → 'verified'   (✅ 연결 완료, SSL 자동 발급됨)
 *  - verified === false && verification 존재   → 'pending'    (⏳ DNS 전파 대기, 레코드 추가 필요)
 *  - 그 외 (에러)                              → 'error'
 */
export function interpretStatus(info: DomainInfo | null | undefined): 'verified' | 'pending' | 'error' {
  if (!info) return 'error';
  if (info.verified) return 'verified';
  if (info.verification && info.verification.length > 0) return 'pending';
  // verified 가 false 인데 verification 도 없다면 — 도메인은 등록됐으나 추가 체크 필요
  return 'pending';
}
