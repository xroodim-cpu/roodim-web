'use client';

import { useState, useMemo } from 'react';
import type { MaintenanceRequest, DesignerSchedule, DesignerInfo } from './MaintenanceWorkspace';

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: '대기', bg: 'rgba(245,166,35,0.1)', color: '#856404' },
  reviewing: { label: '검토중', bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
  working: { label: '진행중', bg: 'rgba(139,92,246,0.1)', color: '#8b5cf6' },
  done: { label: '완료', bg: 'rgba(3,178,108,0.1)', color: '#03b26c' },
  cancelled: { label: '취소', bg: '#f3f4f6', color: '#6b7280' },
};

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

interface Props {
  requests: MaintenanceRequest[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
  schedule: DesignerSchedule | null;
  blockedDates: string[];
  designer: DesignerInfo | null;
}

export default function RequestSidebar({
  requests, selectedId, onSelect, onCreate,
  schedule, blockedDates, designer,
}: Props) {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const blockedSet = useMemo(() => new Set(blockedDates), [blockedDates]);
  const workingDaySet = useMemo(() => {
    if (!schedule?.working_days) return new Set<number>();
    return new Set(schedule.working_days);
  }, [schedule]);

  const isBlocked = (dateStr: string, dayOfWeek: number) => {
    if (blockedSet.has(dateStr)) return true;
    if (schedule && !workingDaySet.has(dayOfWeek)) return true;
    return false;
  };

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const startDow = firstDay.getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const prevMonthDays = new Date(calYear, calMonth, 0).getDate();
    const cells: { day: number; dateStr: string; isOther: boolean; dow: number }[] = [];

    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const dt = new Date(calYear, calMonth - 1, d);
      cells.push({ day: d, dateStr: fmt(dt), isOther: true, dow: dt.getDay() });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(calYear, calMonth, d);
      cells.push({ day: d, dateStr: fmt(dt), isOther: false, dow: dt.getDay() });
    }
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const dt = new Date(calYear, calMonth + 1, d);
      cells.push({ day: d, dateStr: fmt(dt), isOther: true, dow: dt.getDay() });
    }
    return cells;
  }, [calYear, calMonth]);

  const todayStr = fmt(today);

  const selectedDateInfo = useMemo(() => {
    if (!selectedDate) return null;
    const dt = new Date(selectedDate + 'T00:00:00');
    const dow = dt.getDay();
    const blocked = isBlocked(selectedDate, dow);
    return { blocked, dow };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, blockedSet, workingDaySet, schedule]);

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px', gap: '0' }}>
      {/* 신청하기 버튼 — 루딤링크 .wc-create-btn 스타일 (pill, outlined) */}
      <button
        onClick={onCreate}
        style={{
          width: '100%',
          height: '44px',
          padding: '0 20px',
          border: '1px solid #e7eaef',
          borderRadius: '999px',
          background: '#fff',
          fontWeight: 600,
          fontSize: '14px',
          color: '#222',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        <span style={{ fontSize: '18px', color: '#cc222c' }}>+</span>
        신청하기
      </button>

      {/* 디자이너 정보 */}
      {designer?.name && (
        <div style={{ fontSize: '12px', color: '#929aa6', padding: '12px 4px 0', fontWeight: 500 }}>
          담당: <span style={{ color: '#222', fontWeight: 600 }}>{designer.name}</span>
        </div>
      )}

      {/* 미니 캘린더 — 루딤링크 .wc-mini 스타일 */}
      <div style={{ marginTop: '20px' }}>
        {/* 월 네비게이션 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#222' }}>
            {calYear}년 {calMonth + 1}월
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={prevMonth} style={{ ...navBtnStyle }}>‹</button>
            <button onClick={nextMonth} style={{ ...navBtnStyle }}>›</button>
          </div>
        </div>

        {/* 요일 헤더 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0 }}>
          {DAY_NAMES.map((name, i) => (
            <div key={name} style={{
              textAlign: 'center',
              height: '22px',
              lineHeight: '22px',
              fontSize: '13px',
              fontWeight: 500,
              color: i === 0 ? '#f35656' : i === 6 ? '#4a90e2' : '#bbc0c8',
            }}>
              {name}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0 }}>
          {calendarDays.map((cell, idx) => {
            const blocked = isBlocked(cell.dateStr, cell.dow);
            const isToday = cell.dateStr === todayStr && !cell.isOther;
            const isSelected = cell.dateStr === selectedDate && !cell.isOther;

            let color = '#222';
            let fontWeight = 500;
            let bg = 'transparent';
            let textDecoration = 'none';

            if (cell.isOther) {
              color = '#bbc0c8';
            } else if (blocked) {
              color = '#bbc0c8';
              textDecoration = 'line-through';
            } else {
              fontWeight = 700;
              if (cell.dow === 0) color = '#f35656';
              else if (cell.dow === 6) color = '#4a90e2';
            }

            if (isToday) {
              bg = '#222';
              color = '#fff';
              fontWeight = 700;
            } else if (isSelected) {
              bg = 'rgba(0,0,0,0.06)';
            }

            return (
              <button
                key={idx}
                onClick={() => !cell.isOther && setSelectedDate(cell.dateStr)}
                disabled={cell.isOther}
                style={{
                  height: '28px',
                  width: '100%',
                  borderRadius: '50%',
                  background: bg,
                  fontSize: '13px',
                  fontWeight,
                  color,
                  textDecoration,
                  border: 'none',
                  cursor: cell.isOther ? 'default' : 'pointer',
                  transition: 'background 0.12s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>

      {/* 운영시간 블록 */}
      {selectedDate && selectedDateInfo && (
        <div style={{ marginTop: '12px', padding: '10px 12px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#929aa6', marginBottom: '4px' }}>
            {selectedDate.replace(/-/g, '.')} ({DAY_NAMES[selectedDateInfo.dow]})
          </div>
          {selectedDateInfo.blocked ? (
            <div style={{ fontSize: '13px', color: '#bbc0c8' }}>휴무일</div>
          ) : schedule ? (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#222' }}>
                {schedule.hours_start} – {schedule.hours_end}
              </div>
              {schedule.lunch_enabled && schedule.lunch_start && schedule.lunch_end && (
                <div style={{ fontSize: '11px', color: '#929aa6', marginTop: '2px' }}>
                  점심 {schedule.lunch_start} – {schedule.lunch_end}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#bbc0c8' }}>스케줄 미설정</div>
          )}
        </div>
      )}

      {/* 내 캘린더 섹션 */}
      <div style={{ marginTop: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#929aa6', marginBottom: '8px', letterSpacing: '-0.01em' }}>
          작업 채팅방
        </div>
      </div>

      {/* 요청 목록 — 루딤링크 .wc-chatroom-item 스타일 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {requests.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#929aa6', textAlign: 'center', padding: '20px 0' }}>
            진행중인 작업이 없습니다
          </div>
        ) : (
          <div>
            {requests.map(req => {
              const st = STATUS_LABELS[req.status] || STATUS_LABELS.pending;
              const active = req.id === selectedId;
              return (
                <button
                  key={req.id}
                  onClick={() => onSelect(req.id)}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    padding: '10px 8px',
                    borderRadius: '10px',
                    background: active ? 'rgba(0,0,0,0.06)' : 'transparent',
                    cursor: 'pointer',
                    width: '100%',
                    border: 'none',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                    alignItems: 'center',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* 아바타 */}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#3b82f6',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '14px',
                    flexShrink: 0,
                  }}>
                    유
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#1f2328',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}>
                        {req.title}
                      </span>
                      <span style={{
                        flexShrink: 0,
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '0 8px',
                        height: '22px',
                        lineHeight: '22px',
                        borderRadius: '6px',
                        background: st.bg,
                        color: st.color,
                        letterSpacing: '-0.01em',
                      }}>
                        {st.label}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6a737d',
                      marginTop: '2px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {new Date(req.createdAt).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

const navBtnStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '16px',
  fontWeight: 600,
  color: '#929aa6',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.12s',
};
