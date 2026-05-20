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
)
from app.core.auth import get_current_user
from app.models import User
from app.services.id_gen import new_id

router = APIRouter(prefix="/assessment", tags=["assessment"])


def _interval_item(i: GradingScaleInterval) -> GradingScaleIntervalItem:
    return GradingScaleIntervalItem(
        grade_code=i.grade_code,
        threshold=i.threshold,
        grade_description=i.grade_description,
        gpa_points=i.gpa_points,
    )


def _scale_response(gs: GradingScale, db: Session) -> GradingScaleResponse:
    intervals = (
        db.query(GradingScaleInterval)
        .filter(GradingScaleInterval.parent_id == gs.id)
        .order_by(GradingScaleInterval.threshold.desc())
        .all()
    )
    return GradingScaleResponse(
        id=gs.id,
        grading_scale_name=gs.grading_scale_name,
        description=gs.description,
        is_default=bool(gs.is_default),
        intervals=[_interval_item(i) for i in intervals],
        docstatus=gs.docstatus,
    )


def _clear_default_scales(db: Session, except_id: str | None = None) -> None:
    q = db.query(GradingScale).filter(GradingScale.is_default == True)
    if except_id:
        q = q.filter(GradingScale.id != except_id)
    for row in q.all():
        row.is_default = False


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


@router.post("/grading-scales", response_model=GradingScaleResponse)
def create_grading_scale(
    body: GradingScaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(GradingScale).filter(GradingScale.grading_scale_name == body.grading_scale_name).first():
        raise HTTPException(status_code=400, detail="Grading scale name already exists")
    gid = body.grading_scale_name.replace(" ", "-")[:30]
    if body.is_default:
        _clear_default_scales(db)
    gs = GradingScale(
        id=gid,
        grading_scale_name=body.grading_scale_name,
        description=body.description,
        is_default=body.is_default,
    )
    db.add(gs)
    for i, inv in enumerate(body.intervals):
        db.add(
            GradingScaleInterval(
                id=new_id("GSI"),
                parent_id=gid,
                grade_code=inv.grade_code,
                threshold=inv.threshold,
                grade_description=inv.grade_description,
                gpa_points=inv.gpa_points,
                idx=i,
            )
        )
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
        gs.grading_scale_name = body.grading_scale_name
    if body.description is not None:
        gs.description = body.description
    if body.is_default is not None:
        if body.is_default:
            _clear_default_scales(db, except_id=scale_id)
        gs.is_default = body.is_default
    if body.intervals is not None:
        db.query(GradingScaleInterval).filter(GradingScaleInterval.parent_id == scale_id).delete()
        for i, inv in enumerate(body.intervals):
            db.add(
                GradingScaleInterval(
                    id=new_id("GSI"),
                    parent_id=scale_id,
                    grade_code=inv.grade_code,
                    threshold=inv.threshold,
                    grade_description=inv.grade_description,
                    gpa_points=inv.gpa_points,
                    idx=i,
                )
            )
    db.commit()
    db.refresh(gs)
    return _scale_response(gs, db)


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
