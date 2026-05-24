"""Grading scale interval validation and display helpers."""
import re

from sqlalchemy.orm import Session

from app.models import GradingScale, GradingScaleInterval, K12Class
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


def k12_class_sort_key(cls: K12Class) -> tuple[int, str]:
    """Numeric order (Class 3 … Class 10), not lexicographic."""
    if cls.numeric_level is not None:
        return (int(cls.numeric_level), cls.name or "")
    match = re.search(r"(\d+)", cls.name or "")
    if match:
        return (int(match.group(1)), cls.name or "")
    return (9999, cls.name or "")


def k12_class_name_sort_key(name: str) -> tuple[int, str]:
    match = re.search(r"(\d+)", name or "")
    if match:
        return (int(match.group(1)), name or "")
    return (9999, name or "")


def resolve_grading_scale_for_class(db: Session, cls: K12Class) -> GradingScale | None:
    if cls.grading_scale_id:
        return db.query(GradingScale).filter(GradingScale.id == cls.grading_scale_id).first()
    return db.query(GradingScale).filter(GradingScale.is_default == True).first()


def pass_threshold_percent(db: Session, scale: GradingScale | None) -> int:
    """Minimum % required to earn the lowest passing grade on the scale."""
    if not scale:
        return 40
    rows = (
        db.query(GradingScaleInterval)
        .filter(GradingScaleInterval.parent_id == scale.id)
        .order_by(GradingScaleInterval.threshold.asc())
        .all()
    )
    if not rows:
        return 40
    passing = [r for r in rows if (r.gpa_points or 0) > 0]
    if passing:
        return int(passing[0].threshold or 0)
    if len(rows) >= 2:
        return int(rows[1].threshold or 0)
    return 40


def pass_marks_for_full(db: Session, cls: K12Class, full_marks: int) -> tuple[int, int]:
    """Return (pass_marks, pass_threshold_percent) from the class grading scale."""
    scale = resolve_grading_scale_for_class(db, cls)
    pct = pass_threshold_percent(db, scale)
    marks = max(1, round(full_marks * pct / 100))
    return marks, pct


def used_by_label(class_names: list[str]) -> str | None:
    if not class_names:
        return None
    names = sorted(class_names, key=k12_class_name_sort_key)
    if len(names) <= 3:
        return ", ".join(names)
    return f"{names[0]}–{names[-1]}"
