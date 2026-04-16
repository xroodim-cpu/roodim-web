/**
 * 루딤 플랫폼 전역 공개 설정 헬퍼.
 *
 * 루딤링크(Laravel) 마스터관리 > API 탭에서 입력된 값을 Bridge API 로 받아온다.
 * 시크릿이 아닌 값만 여기서 다루고 (가비아 제휴 URL 등), 시크릿은 환경변수 그대로 둔다.
 *
 * 5분 in-memory 캐시 — 관리자가 Laravel 쪽에서 값을 바꿔도 최대 5분 내 반영.
 */

import { adminApi } from './admin-api';

interface PlatformSettingsResponse {
  ok: boolean;
  data: {
    gabia_partner_url: string;
  };
}

interface CacheEntry {
  gabiaPartnerUrl: string;
  expiresAt: number;
}

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getPlatformPublicSettings(): Promise<{ gabiaPartnerUrl: string }> {
  if (cache && cache.expiresAt > Date.now()) {
    return { gabiaPartnerUrl: cache.gabiaPartnerUrl };
  }

  const resp = await adminApi<PlatformSettingsResponse>('GET', '/api/bridge/platform-settings');
  const gabiaPartnerUrl = resp.ok && resp.data?.data?.gabia_partner_url ? resp.data.data.gabia_partner_url : '';

  cache = { gabiaPartnerUrl, expiresAt: Date.now() + CACHE_TTL_MS };
  return { gabiaPartnerUrl };
}
