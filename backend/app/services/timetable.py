"""Timetable layout: period times from class settings."""
from __future__ import annotations

import json
from datetime import datetime, time, timedelta

from app.models.k12 import K12Class

DEFAULT_WEEKDAYS = [0, 1, 2, 3, 4]
DEFAULT_PERIODS = 8
DEFAULT_PERIOD_MINUTES = 45
DEFAULT_BREAK_MINUTES = 20
DEFAULT_BREAK_AFTER = 4
DEFAULT_START = time(8, 0)


def parse_weekdays(raw: str | None) -> list[int]:
    if not raw:
        return list(DEFAULT_WEEKDAYS)
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return sorted({int(x) for x in data if 0 <= int(x) <= 6})
    except (json.JSONDecodeError, TypeError, ValueError):
        pass
    return list(DEFAULT_WEEKDAYS)


def weekdays_to_json(days: list[int]) -> str:
    cleaned = sorted({int(d) for d in days if 0 <= int(d) <= 6})
    return json.dumps(cleaned if cleaned else DEFAULT_WEEKDAYS)


def class_start_time(cls: K12Class) -> time:
    return cls.timetable_start_time or DEFAULT_START


def periods_per_day(cls: K12Class) -> int:
    return cls.timetable_periods_per_day or DEFAULT_PERIODS


def period_minutes(cls: K12Class) -> int:
    return cls.timetable_period_minutes or DEFAULT_PERIOD_MINUTES


def break_minutes(cls: K12Class) -> int:
    return cls.timetable_break_minutes if cls.timetable_break_minutes is not None else DEFAULT_BREAK_MINUTES


def break_after_period(cls: K12Class) -> int:
    return cls.timetable_break_after_period if cls.timetable_break_after_period is not None else DEFAULT_BREAK_AFTER


def period_start_offset_minutes(cls: K12Class, period_index: int) -> int:
    """Minutes from school start to the start of period_index (0-based)."""
    total = 0
    p_mins = period_minutes(cls)
    b_mins = break_minutes(cls)
    b_after = break_after_period(cls)
    for p in range(period_index):
        total += p_mins
        if b_after > 0 and (p + 1) == b_after:
            total += b_mins
    return total


def period_times(cls: K12Class, period_index: int) -> tuple[time, time]:
    start = class_start_time(cls)
    base = datetime.combine(datetime.min.date(), start)
    from_dt = base + timedelta(minutes=period_start_offset_minutes(cls, period_index))
    to_dt = from_dt + timedelta(minutes=period_minutes(cls))
    return from_dt.time(), to_dt.time()


def infer_period_index(cls: K12Class, from_t: time) -> int | None:
    for p in range(periods_per_day(cls)):
        ft, _ = period_times(cls, p)
        if ft == from_t:
            return p
    return None
