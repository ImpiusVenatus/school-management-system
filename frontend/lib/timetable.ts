/** Period times from class timetable settings (matches backend). */
export type TimetableSettings = {
  weekdays: number[];
  periods_per_day: number;
  period_minutes: number;
  break_minutes: number;
  break_after_period: number;
  start_time: string;
};

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const DEFAULT_TIMETABLE_SETTINGS: TimetableSettings = {
  weekdays: [0, 1, 2, 3, 4],
  periods_per_day: 8,
  period_minutes: 45,
  break_minutes: 20,
  break_after_period: 4,
  start_time: "08:00:00",
};

function parseStartMinutes(startTime: string): number {
  const [h, m] = startTime.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

export function periodStartOffsetMinutes(settings: TimetableSettings, periodIndex: number): number {
  let total = 0;
  for (let p = 0; p < periodIndex; p++) {
    total += settings.period_minutes;
    if (settings.break_after_period > 0 && p + 1 === settings.break_after_period) {
      total += settings.break_minutes;
    }
  }
  return total;
}

export function periodTimeRange(
  settings: TimetableSettings,
  periodIndex: number
): { from: string; to: string } {
  const startMins = parseStartMinutes(settings.start_time) + periodStartOffsetMinutes(settings, periodIndex);
  const endMins = startMins + settings.period_minutes;
  const fmt = (mins: number) => {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  return { from: fmt(startMins), to: fmt(endMins) };
}

export function cellKey(day: number, period: number) {
  return `${day}-${period}`;
}
