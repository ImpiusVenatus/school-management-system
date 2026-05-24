"""Assessment: Grading Scale, Assessment Plan, Assessment Result (get_grade, mark_assessment_result)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    GradingScale,
    GradingScaleInterval,
    AssessmentPlan,
    AssessmentPlanCriteria,
    AssessmentResult,
    AssessmentResultDetail,
    K12Class,
)
from app.schemas.assessment import (
    GradingScaleCreate,
    GradingScaleUpdate,
    GradingScaleResponse,
    AssessmentPlanCreate,
    AssessmentPlanResponse,
    AssessmentResultCreate,
    AssessmentResultResponse,
    GradingScaleIntervalItem,
    GradingScaleCalculationRules,
    AssignedClassItem,
    ClassAssignmentUpdate,
    rules_to_json,
    rules_from_json,
    DEFAULT_CALCULATION_RULES,
)
from app.core.auth import get_current_user
from app.models import User
from app.services.id_gen import new_id
from app.services.grading_scale import (
    DEFAULT_INTERVAL_COLORS,
    intervals_with_max,
    k12_class_sort_key,
    validate_intervals,
    used_by_label,
)

router = APIRouter(prefix="/assessment", tags=["assessment"])


def _interval_item(i: GradingScaleInterval) -> GradingScaleIntervalItem:
    return GradingScaleIntervalItem(
        grade_code=i.grade_code,
        threshold=i.threshold,
        grade_description=i.grade_description,
        gpa_points=i.gpa_points,
        color=i.color,
    )


def _editor_name(user: User | None) -> str | None:
    if not user:
        return None
    return user.full_name or user.email or user.id


def _assigned_classes(db: Session, gs: GradingScale) -> list[AssignedClassItem]:
    if gs.is_default:
        rows = db.query(K12Class).filter(K12Class.grading_scale_id.is_(None)).all()
        uses_default = True
    else:
        rows = db.query(K12Class).filter(K12Class.grading_scale_id == gs.id).all()
        uses_default = False
    rows.sort(key=k12_class_sort_key)
    return [
        AssignedClassItem(
            id=r.id,
            name=r.name,
            academic_year_id=r.academic_year_id,
            uses_default=uses_default,
        )
        for r in rows
    ]


def _scale_response(gs: GradingScale, db: Session, *, include_classes: bool = True) -> GradingScaleResponse:
    interval_rows = (
        db.query(GradingScaleInterval)
        .filter(GradingScaleInterval.parent_id == gs.id)
        .order_by(GradingScaleInterval.threshold.desc())
        .all()
    )
    raw_intervals = [_interval_item(i) for i in interval_rows]
    intervals = intervals_with_max(raw_intervals)
    gpas = [i.gpa_points for i in intervals if i.gpa_points is not None]
    assigned = _assigned_classes(db, gs) if include_classes else []
    valid, msg = validate_intervals(raw_intervals)
    label_names = [c.name for c in assigned] if assigned else []
    return GradingScaleResponse(
        id=gs.id,
        grading_scale_name=gs.grading_scale_name,
        description=gs.description,
        is_default=bool(gs.is_default),
        intervals=intervals,
        calculation_rules=rules_from_json(gs.calculation_rules),
        docstatus=gs.docstatus,
        range_count=len(intervals),
        gpa_min=min(gpas) if gpas else None,
        gpa_max=max(gpas) if gpas else None,
        class_count=len(assigned),
        used_by_label=used_by_label(label_names),
        updated_at=gs.updated_at,
        updated_by_name=gs.updated_by_name,
        assigned_classes=assigned,
        intervals_valid=valid,
        intervals_validation_message=msg,
    )


def _clear_default_scales(db: Session, except_id: str | None = None) -> None:
    q = db.query(GradingScale).filter(GradingScale.is_default == True)
    if except_id:
        q = q.filter(GradingScale.id != except_id)
    for row in q.all():
        row.is_default = False


def _persist_intervals(db: Session, scale_id: str, items: list[GradingScaleIntervalItem]) -> None:
    valid, msg = validate_intervals(items)
    if not valid:
        raise HTTPException(status_code=400, detail=msg or "Invalid grade ranges")
    db.query(GradingScaleInterval).filter(GradingScaleInterval.parent_id == scale_id).delete()
    sorted_items = sorted(items, key=lambda x: x.threshold, reverse=True)
    for i, inv in enumerate(sorted_items):
        color = inv.color or DEFAULT_INTERVAL_COLORS[i % len(DEFAULT_INTERVAL_COLORS)]
        db.add(
            GradingScaleInterval(
                id=new_id("GSI"),
                parent_id=scale_id,
                grade_code=inv.grade_code.strip(),
                threshold=inv.threshold,
                grade_description=inv.grade_description,
                gpa_points=inv.gpa_points,
                color=color,
                idx=i,
            )
        )


def _touch_scale(gs: GradingScale, user: User | None) -> None:
    gs.updated_by_name = _editor_name(user)


@router.get("/grade")
def get_grade(
    grading_scale_id: str,
    percentage: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return grade code for given percentage from grading scale intervals."""
    rows = db.query(GradingScaleInterval).filter(GradingScaleInterval.parent_id == grading_scale_id).order_by(GradingScaleInterval.threshold.desc()).all()
    grade = ""
    for r in rows:
        if percentage >= (r.threshold or 0):
            grade = r.grade_code
            break
    return {"grade": grade}


@router.get("/grading-scales", response_model=list[GradingScaleResponse])
def list_grading_scales(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(GradingScale).order_by(GradingScale.is_default.desc(), GradingScale.grading_scale_name).all()
    return [_scale_response(r, db) for r in rows]


@router.get("/grading-scales/{scale_id}", response_model=GradingScaleResponse)
def get_grading_scale(
    scale_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gs = db.query(GradingScale).filter(GradingScale.id == scale_id).first()
    if not gs:
        raise HTTPException(status_code=404, detail="Grading scale not found")
    return _scale_response(gs, db)


@router.post("/grading-scales", response_model=GradingScaleResponse)
def create_grading_scale(
    body: GradingScaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    name = body.grading_scale_name.strip()
    if db.query(GradingScale).filter(GradingScale.grading_scale_name == name).first():
        raise HTTPException(status_code=400, detail="Grading scale name already exists")
    gid = new_id("GSC")
    if body.is_default:
        _clear_default_scales(db)
    rules = body.calculation_rules or DEFAULT_CALCULATION_RULES
    gs = GradingScale(
        id=gid,
        grading_scale_name=name,
        description=body.description,
        is_default=body.is_default,
        calculation_rules=rules_to_json(rules),
        updated_by_name=_editor_name(current_user),
    )
    db.add(gs)
    _persist_intervals(db, gid, body.intervals)
    db.commit()
    db.refresh(gs)
    return _scale_response(gs, db)


@router.patch("/grading-scales/{scale_id}", response_model=GradingScaleResponse)
def update_grading_scale(
    scale_id: str,
    body: GradingScaleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gs = db.query(GradingScale).filter(GradingScale.id == scale_id).first()
    if not gs:
        raise HTTPException(status_code=404, detail="Grading scale not found")
    if body.grading_scale_name is not None:
        new_name = body.grading_scale_name.strip()
        existing = (
            db.query(GradingScale)
            .filter(GradingScale.grading_scale_name == new_name, GradingScale.id != scale_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Grading scale name already exists")
        gs.grading_scale_name = new_name
    if body.description is not None:
        gs.description = body.description
    if body.is_default is not None:
        if body.is_default:
            _clear_default_scales(db, except_id=scale_id)
        gs.is_default = body.is_default
    if body.calculation_rules is not None:
        gs.calculation_rules = rules_to_json(body.calculation_rules)
    if body.intervals is not None:
        _persist_intervals(db, scale_id, body.intervals)
    _touch_scale(gs, current_user)
    db.commit()
    db.refresh(gs)
    return _scale_response(gs, db)


@router.post("/grading-scales/{scale_id}/duplicate", response_model=GradingScaleResponse)
def duplicate_grading_scale(
    scale_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gs = db.query(GradingScale).filter(GradingScale.id == scale_id).first()
    if not gs:
        raise HTTPException(status_code=404, detail="Grading scale not found")
    base_name = f"Copy of {gs.grading_scale_name}"
    name = base_name
    n = 1
    while db.query(GradingScale).filter(GradingScale.grading_scale_name == name).first():
        n += 1
        name = f"{base_name} ({n})"
    intervals = (
        db.query(GradingScaleInterval)
        .filter(GradingScaleInterval.parent_id == scale_id)
        .order_by(GradingScaleInterval.threshold.desc())
        .all()
    )
    body = GradingScaleCreate(
        grading_scale_name=name,
        description=gs.description,
        is_default=False,
        intervals=[_interval_item(i) for i in intervals],
        calculation_rules=rules_from_json(gs.calculation_rules),
    )
    return create_grading_scale(body, db, current_user)


@router.delete("/grading-scales/{scale_id}", status_code=204)
def delete_grading_scale(
    scale_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gs = db.query(GradingScale).filter(GradingScale.id == scale_id).first()
    if not gs:
        raise HTTPException(status_code=404, detail="Grading scale not found")
    if gs.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete the default grade scale")
    if db.query(K12Class).filter(K12Class.grading_scale_id == scale_id).first():
        raise HTTPException(status_code=400, detail="Remove class assignments before deleting this scale")
    if db.query(AssessmentPlan).filter(AssessmentPlan.grading_scale_id == scale_id).first():
        raise HTTPException(status_code=400, detail="This scale is used by assessment plans")
    db.delete(gs)
    db.commit()


@router.put("/grading-scales/{scale_id}/classes", response_model=GradingScaleResponse)
def assign_grading_scale_classes(
    scale_id: str,
    body: ClassAssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gs = db.query(GradingScale).filter(GradingScale.id == scale_id).first()
    if not gs:
        raise HTTPException(status_code=404, detail="Grading scale not found")
    class_ids = set(body.class_ids)
    if gs.is_default:
        db.query(K12Class).filter(K12Class.grading_scale_id.isnot(None)).filter(
            K12Class.id.in_(class_ids)
        ).update({K12Class.grading_scale_id: None}, synchronize_session=False)
        for cid in class_ids:
            row = db.query(K12Class).filter(K12Class.id == cid).first()
            if row:
                row.grading_scale_id = None
    else:
        stale = db.query(K12Class).filter(K12Class.grading_scale_id == scale_id)
        if class_ids:
            stale = stale.filter(~K12Class.id.in_(class_ids))
        stale.update({K12Class.grading_scale_id: None}, synchronize_session=False)
        if class_ids:
            db.query(K12Class).filter(K12Class.id.in_(class_ids)).update(
                {K12Class.grading_scale_id: scale_id}, synchronize_session=False
            )
    _touch_scale(gs, current_user)
    db.commit()
    db.refresh(gs)
    return _scale_response(gs, db)


@router.get("/grading-scales/classes/available")
def list_classes_for_assignment(
    academic_year_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(K12Class)
    if academic_year_id:
        q = q.filter(K12Class.academic_year_id == academic_year_id)
    rows = q.all()
    rows.sort(key=k12_class_sort_key)
    return [
        {
            "id": r.id,
            "name": r.name,
            "academic_year_id": r.academic_year_id,
            "grading_scale_id": r.grading_scale_id,
        }
        for r in rows
    ]


@router.get("/plans", response_model=list[AssessmentPlanResponse])
def list_assessment_plans(
    db: Session = Depends(get_db),
    student_group_id: str | None = None,
    course_id: str | None = None,
    current_user: User = Depends(get_current_user),
):
    q = db.query(AssessmentPlan)
    if student_group_id:
        q = q.filter(AssessmentPlan.student_group_id == student_group_id)
    if course_id:
        q = q.filter(AssessmentPlan.course_id == course_id)
    rows = q.all()
    return [
        AssessmentPlanResponse(
            id=r.id,
            student_group_id=r.student_group_id,
            assessment_name=r.assessment_name,
            assessment_group_id=r.assessment_group_id,
            grading_scale_id=r.grading_scale_id,
            course_id=r.course_id,
            academic_year_id=r.academic_year_id,
            academic_term_id=r.academic_term_id,
            schedule_date=r.schedule_date,
            room_id=r.room_id,
            examiner_id=r.examiner_id,
            from_time=r.from_time,
            to_time=r.to_time,
            supervisor_id=r.supervisor_id,
            maximum_assessment_score=r.maximum_assessment_score,
            docstatus=r.docstatus,
        )
        for r in rows
    ]


@router.post("/plans", response_model=AssessmentPlanResponse)
def create_assessment_plan(
    body: AssessmentPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(AssessmentPlan).filter(AssessmentPlan.assessment_name == body.assessment_name).first():
        raise HTTPException(status_code=400, detail="Assessment plan name exists")
    pid = body.assessment_name.replace(" ", "-")[:40]
    plan = AssessmentPlan(
        id=pid,
        student_group_id=body.student_group_id,
        assessment_name=body.assessment_name,
        assessment_group_id=body.assessment_group_id,
        grading_scale_id=body.grading_scale_id,
        course_id=body.course_id,
        academic_year_id=body.academic_year_id,
        academic_term_id=body.academic_term_id,
        schedule_date=body.schedule_date,
        room_id=body.room_id,
        examiner_id=body.examiner_id,
        from_time=body.from_time,
        to_time=body.to_time,
        supervisor_id=body.supervisor_id,
        maximum_assessment_score=body.maximum_assessment_score,
    )
    db.add(plan)
    for i, c in enumerate(body.assessment_criteria):
        db.add(AssessmentPlanCriteria(
            id=new_id("APC"), parent_id=pid, assessment_criteria_id=c.assessment_criteria_id,
            maximum_score=c.maximum_score, idx=i,
        ))
    db.commit()
    db.refresh(plan)
    return AssessmentPlanResponse(
        id=plan.id,
        student_group_id=plan.student_group_id,
        assessment_name=plan.assessment_name,
        assessment_group_id=plan.assessment_group_id,
        grading_scale_id=plan.grading_scale_id,
        course_id=plan.course_id,
        academic_year_id=plan.academic_year_id,
        academic_term_id=plan.academic_term_id,
        schedule_date=plan.schedule_date,
        room_id=plan.room_id,
        examiner_id=plan.examiner_id,
        from_time=plan.from_time,
        to_time=plan.to_time,
        supervisor_id=plan.supervisor_id,
        maximum_assessment_score=plan.maximum_assessment_score,
        docstatus=plan.docstatus,
    )


@router.get("/plans/{plan_id}/criteria", response_model=list[dict])
def get_assessment_plan_criteria(
    plan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(AssessmentPlanCriteria).filter(AssessmentPlanCriteria.parent_id == plan_id).order_by(AssessmentPlanCriteria.idx).all()
    return [{"assessment_criteria_id": r.assessment_criteria_id, "maximum_score": r.maximum_score} for r in rows]


@router.get("/results")
def get_result(
    student_id: str,
    assessment_plan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return submitted result for student and assessment plan."""
    r = db.query(AssessmentResult).filter(
        AssessmentResult.student_id == student_id,
        AssessmentResult.assessment_plan_id == assessment_plan_id,
        AssessmentResult.docstatus != 2,
    ).first()
    if not r:
        return None
    details = db.query(AssessmentResultDetail).filter(AssessmentResultDetail.parent_id == r.id).all()
    return {
        "id": r.id,
        "total_score": r.total_score,
        "grade": r.grade,
        "comment": r.comment,
        "docstatus": r.docstatus,
        "details": [{"assessment_criteria_id": d.assessment_criteria_id, "score": d.score, "grade": d.grade} for d in details],
    }


@router.post("/results", response_model=AssessmentResultResponse)
def mark_assessment_result(
    body: AssessmentResultCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = db.query(AssessmentPlan).filter(AssessmentPlan.id == body.assessment_plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Assessment plan not found")
    from app.models import Student
    student = db.query(Student).filter(Student.id == body.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    total = sum(d.score for d in body.details)
    max_score = plan.maximum_assessment_score or 100
    pct = (total / max_score * 100) if max_score else 0
    grade = ""
    for inv in db.query(GradingScaleInterval).filter(GradingScaleInterval.parent_id == plan.grading_scale_id).order_by(GradingScaleInterval.threshold.desc()).all():
        if pct >= (inv.threshold or 0):
            grade = inv.grade_code
            break
    rid = new_id("RES")
    res = AssessmentResult(
        id=rid,
        assessment_plan_id=body.assessment_plan_id,
        student_id=body.student_id,
        student_name=student.student_name,
        student_group_id=plan.student_group_id,
        assessment_group_id=plan.assessment_group_id,
        grading_scale_id=plan.grading_scale_id,
        maximum_score=max_score,
        total_score=total,
        grade=grade,
        comment=body.comment,
        docstatus=1,
    )
    db.add(res)
    for i, d in enumerate(body.details):
        db.add(AssessmentResultDetail(id=new_id("ARD"), parent_id=rid, assessment_criteria_id=d.assessment_criteria_id, maximum_score=d.maximum_score, score=d.score, grade=d.grade, idx=i))
    db.commit()
    db.refresh(res)
    details = db.query(AssessmentResultDetail).filter(AssessmentResultDetail.parent_id == rid).all()
    return AssessmentResultResponse(
        id=res.id,
        assessment_plan_id=res.assessment_plan_id,
        student_id=res.student_id,
        student_name=res.student_name,
        details=[{"assessment_criteria_id": d.assessment_criteria_id, "maximum_score": d.maximum_score, "score": d.score, "grade": d.grade} for d in details],
        total_score=res.total_score,
        grade=res.grade,
        maximum_score=res.maximum_score,
        comment=res.comment,
        docstatus=res.docstatus,
    )
