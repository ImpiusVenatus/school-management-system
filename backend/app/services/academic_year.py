"""Academic year naming and date ranges from school cycle settings."""
from datetime import date


def year_range_for_start_month(start_month: int, label_end_year: int) -> tuple[date, date]:
    """e.g. start_month=4, label_end_year=2027 → Apr 1 2026 – Mar 31 2027."""
    from calendar import monthrange

    if start_month == 1:
        y = label_end_year - 1
        return date(y, 1, 1), date(y, 12, 31)
    start_year = label_end_year - 1
    end_month = start_month - 1
    end_year = label_end_year
    if end_month < 1:
        end_month = 12
        end_year = label_end_year - 1
    last_day = monthrange(end_year, end_month)[1]
    return date(start_year, start_month, 1), date(end_year, end_month, last_day)


def suggest_ay_name(start_month: int, ref: date | None = None) -> str:
    ref = ref or date.today()
    if start_month == 1:
        return f"AY {ref.year}"
    if ref.month >= start_month:
        y1, y2 = ref.year, ref.year + 1
    else:
        y1, y2 = ref.year - 1, ref.year
    return f"AY {y1}–{str(y2)[-2:]}"


def parse_label_end_year(academic_year_name: str, fallback: int | None = None) -> int:
    import re
    m = re.search(r"(\d{4})\s*[-–]\s*(\d{2,4})", academic_year_name)
    if m:
        y2 = m.group(2)
        return int(y2) if len(y2) == 4 else 2000 + int(y2)
    m2 = re.search(r"(\d{4})", academic_year_name)
    if m2:
        return int(m2.group(1))
    return fallback or date.today().year
