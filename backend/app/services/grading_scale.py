"""Grading scale interval validation and display helpers."""
from app.schemas.assessment import GradingScaleIntervalItem

DEFAULT_INTERVAL_COLORS = [
    "#15803d",
    "#16a34a",
    "#65a30d",
    "#ca8a04",
    "#ea580c",
    "#dc2626",
    "#991b1b",
]


def intervals_with_max(items: list[GradingScaleIntervalItem]) -> list[GradingScaleIntervalItem]:
    """Attach max_percent from thresholds (sorted high to low)."""
    if not items:
        return []
    sorted_rows = sorted(items, key=lambda x: x.threshold, reverse=True)
    out: list[GradingScaleIntervalItem] = []
    for i, row in enumerate(sorted_rows):
        max_pct = 100.0 if i == 0 else sorted_rows[i - 1].threshold - 1
        out.append(
            GradingScaleIntervalItem(
                grade_code=row.grade_code,
                threshold=row.threshold,
                max_percent=max_pct,
                grade_description=row.grade_description,
                gpa_points=row.gpa_points,
                color=row.color,
            )
        )
    return sorted(out, key=lambda x: x.threshold, reverse=True)


def validate_intervals(items: list[GradingScaleIntervalItem]) -> tuple[bool, str | None]:
    if not items:
        return False, "Add at least one grade range."
    codes = [i.grade_code.strip() for i in items]
    if len(codes) != len(set(codes)):
        return False, "Each grade code must be unique."
    asc = sorted(items, key=lambda x: x.threshold)
    if asc[0].threshold != 0:
        return False, "Lowest range must start at 0%."
    for i in range(1, len(asc)):
        if asc[i].threshold <= asc[i - 1].threshold:
            return False, "Minimum percentages must increase for each lower grade."
        expected_min = asc[i - 1].threshold + 1
        max_prev = asc[i].threshold - 1
        if asc[i].threshold != max_prev + 1:
            return False, "Ranges must cover 0–100% with no gaps."
    with_max = intervals_with_max(items)
    top = max(with_max, key=lambda x: x.threshold)
    if top.max_percent is None or top.max_percent < 100:
        return False, "Highest grade must reach 100%."
    return True, None


def used_by_label(class_names: list[str]) -> str | None:
    if not class_names:
        return None
    names = sorted(class_names, key=lambda x: (len(x), x))
    if len(names) <= 3:
        return ", ".join(names)
    return f"{names[0]}–{names[-1]}"
