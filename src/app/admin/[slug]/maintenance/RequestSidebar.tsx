'use client';

import { useState, useMemo } from 'react';
import type { MaintenanceRequest, DesignerSchedule, DesignerInfo } from './MaintenanceWorkspace';

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: '대기', cls: 'bg-yellow-100 text-yellow-700' },
  reviewing: { label: '검토중', cls: 'bg-blue-100 text-blue-700' },
  working: { label: '진행중', cls: 'bg-purple-100 text-purple-700' },
  done: { label: '완료', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: '취소', cls: 'bg-gray-100 text-gray-600' },
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

  // 차단일 Set
  const blockedSet = useMemo(() => new Set(blockedDates), [blockedDates]);

  // 영업일 Set (schedule.working_days: 0=일 ~ 6=토)
  const workingDaySet = useMemo(() => {
    if (!schedule?.working_days) return new Set<number>();
    return new Set(schedule.working_days);
  }, [schedule]);

  // 날짜가 차단일인지
  const isBlocked = (dateStr: string, dayOfWeek: number) => {
    if (blockedSet.has(dateStr)) return true;
    if (schedule && !workingDaySet.has(dayOfWeek)) return true;
    return false;
  };

  // 캘린더 그리드 생성
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const startDow = firstDay.getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const prevMonthDays = new Date(calYear, calMonth, 0).getDate();

    const cells: { day: number; dateStr: string; isOther: boolean; dow: number }[] = [];

    // 이전 달
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const dt = new Date(calYear, calMonth - 1, d);
      cells.push({ day: d, dateStr: fmt(dt), isOther: true, dow: dt.getDay() });
    }
    // 이번 달
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(calYear, calMonth, d);
      cells.push({ day: d, dateStr: fmt(dt), isOther: false, dow: dt.getDay() });
    }
    // 다음 달 (6주 채우기)
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const dt = new Date(calYear, calMonth + 1, d);
      cells.push({ day: d, dateStr: fmt(dt), isOther: true, dow: dt.getDay() });
    }

    return cells;
  }, [calYear, calMonth]);

  const todayStr = fmt(today);

  // 선택된 날짜의 운영시간 정보
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
    <div className="flex flex-col h-full p-4 gap-4">
      {/* 신청하기 버튼 */}
      <button
        onClick={onCreate}
        className="w-full py-2.5 px-4 bg-[#cc222c] text-white rounded-lg text-sm font-semibold hover:bg-[#b01e27] transition flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        신청하기
      </button>

      {/* 디자이너 캘린더 */}
      {designer?.name && (
        <div className="text-xs text-gray-500 px-1">
          담당: <span className="font-medium text-gray-700">{designer.name}</span>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-3">
        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between mb-2">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-200 rounded text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-700">
            {calYear}년 {calMonth + 1}월
          </span>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-200 rounded text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-0 mb-1">
          {DAY_NAMES.map((name, i) => (
            <div key={name} className={`text-center text-[10px] font-medium py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
              {name}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-0">
          {calendarDays.map((cell, idx) => {
            const blocked = isBlocked(cell.dateStr, cell.dow);
            const isToday = cell.dateStr === todayStr;
            const isSelected = cell.dateStr === selectedDate;

            let cls = 'text-center text-xs py-1 cursor-pointer rounded transition ';
            if (cell.isOther) {
              cls += 'text-gray-300 ';
            } else if (blocked) {
              cls += 'text-gray-300 line-through ';
            } else {
              cls += 'text-gray-900 font-bold ';
              if (cell.dow === 0) cls += 'text-red-500 font-bold ';
              if (cell.dow === 6) cls += 'text-blue-500 font-bold ';
            }

            if (isToday && !cell.isOther) {
              cls += 'bg-[#cc222c] !text-white rounded-full font-bold ';
            } else if (isSelected && !cell.isOther) {
              cls += 'bg-gray-200 rounded-full ';
            } else {
              cls += 'hover:bg-gray-100 ';
            }

            return (
              <button
                key={idx}
                onClick={() => !cell.isOther && setSelectedDate(cell.dateStr)}
                className={cls}
                disabled={cell.isOther}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>

      {/* 운영시간 블록 */}
      {selectedDate && selectedDateInfo && (
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs font-medium text-gray-500 mb-1">
            {selectedDate.replace(/-/g, '.')} ({DAY_NAMES[selectedDateInfo.dow]})
          </div>
          {selectedDateInfo.blocked ? (
            <div className="text-sm text-gray-400">휴무일</div>
          ) : schedule ? (
            <div className="text-sm text-gray-700">
              <div className="font-medium">{schedule.hours_start} – {schedule.hours_end}</div>
              {schedule.lunch_enabled && schedule.lunch_start && schedule.lunch_end && (
                <div className="text-xs text-gray-400 mt-0.5">
                  점심 {schedule.lunch_start} – {schedule.lunch_end}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-400">스케줄 미설정</div>
          )}
        </div>
      )}

      {/* 요청 목록 */}
      <div className="flex-1 overflow-y-auto">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
          내 요청
        </div>
        {requests.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-4">
            아직 요청이 없습니다
          </div>
        ) : (
          <div className="space-y-1">
            {requests.map(req => {
              const st = STATUS_LABELS[req.status] || STATUS_LABELS.pending;
              const active = req.id === selectedId;
              return (
                <button
                  key={req.id}
                  onClick={() => onSelect(req.id)}
                  className={`w-full text-left p-2.5 rounded-lg text-sm transition ${
                    active
                      ? 'bg-red-50 border border-red-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-medium truncate flex-1 ${active ? 'text-[#cc222c]' : 'text-gray-700'}`}>
                      {req.title}
                    </span>
                    <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {new Date(req.createdAt).toLocaleDateString('ko-KR')}
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
