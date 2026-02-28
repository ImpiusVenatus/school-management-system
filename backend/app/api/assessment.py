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
    rows = db.query(GradingScale).all()
    result = []
    for r in rows:
        intervals = db.query(GradingScaleInterval).filter(GradingScaleInterval.parent_id == r.id).order_by(GradingScaleInterval.threshold.desc()).all()
        result.append(GradingScaleResponse(
            id=r.id,
            grading_scale_name=r.grading_scale_name,
            description=r.description,
            intervals=[GradingScaleIntervalItem(grade_code=i.grade_code, threshold=i.threshold, grade_description=i.grade_description) for i in intervals],
            docstatus=r.docstatus,
        ))
    return result


@router.post("/grading-scales", response_model=GradingScaleResponse)
def create_grading_scale(
    body: GradingScaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(GradingScale).filter(GradingScale.grading_scale_name == body.grading_scale_name).first():
        raise HTTPException(status_code=400, detail="Grading scale name already exists")
    gid = body.grading_scale_name.replace(" ", "-")[:30]
    gs = GradingScale(id=gid, grading_scale_name=body.grading_scale_name, description=body.description)
    db.add(gs)
    for i, inv in enumerate(body.intervals):
        db.add(GradingScaleInterval(id=new_id("GSI"), parent_id=gid, grade_code=inv.grade_code, threshold=inv.threshold, grade_description=inv.grade_description, idx=i))
    db.commit()
    db.refresh(gs)
    intervals = db.query(GradingScaleInterval).filter(GradingScaleInterval.parent_id == gid).all()
    return GradingScaleResponse(id=gs.id, grading_scale_name=gs.grading_scale_name, description=gs.description, intervals=[GradingScaleIntervalItem(grade_code=i.grade_code, threshold=i.threshold, grade_description=i.grade_description) for i in intervals], docstatus=gs.docstatus)


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
