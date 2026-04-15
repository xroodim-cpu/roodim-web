'use client';

import type { DesignerSchedule, DesignerInfo } from './MaintenanceWorkspace';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

interface Props {
  schedule: DesignerSchedule | null;
  blockedDates: string[];
  designer: DesignerInfo | null;
  onClose: () => void;
}

export default function SettingsPopup({ schedule, blockedDates, designer, onClose }: Props) {
  const workingDaySet = new Set(schedule?.working_days ?? []);

  // 앞으로 30일 이내의 차단일만 표시
  const upcomingBlocked = blockedDates
    .filter(d => {
      const dt = new Date(d);
      const now = new Date();
      const diff = (dt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 30;
    })
    .sort()
    .slice(0, 10);

  return (
    <div className="wc-modal-overlay is-open" onClick={onClose}>
      <div className="wc-modal wc-schedule-modal" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="wc-modal-head">
          <h3 className="wc-modal-title">운영시간 · 휴일 설정</h3>
          <button className="wc-modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 담당 디자이너 */}
        {designer?.name && (
          <div className="wc-form-group">
            <label className="wc-label">담당 디자이너</label>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--wc-text-primary)' }}>
              {designer.name}
            </div>
          </div>
        )}

        {/* 운영 요일 */}
        <div className="wc-form-group">
          <label className="wc-label">운영 요일</label>
          {schedule ? (
            <div className="wc-dow-picker">
              {DAY_NAMES.map((name, i) => (
                <div
                  key={i}
                  className={`wc-dow-btn${workingDaySet.has(i) ? ' is-active' : ''}`}
                  style={{ cursor: 'default' }}
                >
                  {name}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--wc-text-muted)' }}>스케줄 미설정</div>
          )}
        </div>

        {/* 운영 시간 */}
        {schedule && (
          <div className="wc-form-group">
            <label className="wc-label">운영 시간</label>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--wc-text-primary)' }}>
              {schedule.hours_start} – {schedule.hours_end}
            </div>
            {schedule.lunch_enabled && schedule.lunch_start && schedule.lunch_end && (
              <div style={{ fontSize: '13px', color: 'var(--wc-text-muted)', marginTop: '4px' }}>
                점심시간: {schedule.lunch_start} – {schedule.lunch_end}
              </div>
            )}
          </div>
        )}

        {/* 예정 휴무일 */}
        <div className="wc-form-group">
          <label className="wc-label">예정 휴무일 (30일 이내)</label>
          {upcomingBlocked.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--wc-text-muted)' }}>
              예정된 휴무일이 없습니다
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {upcomingBlocked.map(d => {
                const dt = new Date(d + 'T00:00:00');
                const dow = DAY_NAMES[dt.getDay()];
                return (
                  <span key={d} style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    background: 'rgba(243,86,86,0.08)',
                    color: '#dc2626',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}>
                    {d.replace(/-/g, '.')} ({dow})
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="wc-modal-foot">
          <div />
          <button className="wc-btn wc-btn-secondary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
