"""Fee Structure, Fee Schedule, Fee Component."""
from datetime import date
from pydantic import BaseModel


class FeeComponentItem(BaseModel):
    fees_category_id: str | None = None
    description: str | None = None
    amount: float
    discount: float = 0
    total: float | None = None


class FeeStructureBase(BaseModel):
    program_id: str
    student_category_id: str | None = None
    academic_year_id: str
    academic_term_id: str | None = None
    total_amount: float = 0
    receivable_account: str | None = None
    cost_center: str | None = None
    company: str | None = None


class FeeStructureCreate(FeeStructureBase):
    components: list[FeeComponentItem]


class FeeStructureResponse(FeeStructureBase):
    id: str
    components: list[FeeComponentItem] = []
    docstatus: int = 0

    class Config:
        from_attributes = True


class FeeScheduleStudentGroupItem(BaseModel):
    student_group_id: str
    total_students: int | None = None


class FeeScheduleBase(BaseModel):
    fee_structure_id: str
    posting_date: date
    due_date: date
    academic_year_id: str
    academic_term_id: str | None = None
    student_groups: list[FeeScheduleStudentGroupItem]
    send_email: bool = False


class FeeScheduleCreate(FeeScheduleBase):
    pass


class FeeScheduleResponse(FeeScheduleBase):
    id: str
    program_id: str | None = None
    total_amount: float = 0
    grand_total: float = 0
    status: str = "Draft"
    docstatus: int = 0

    class Config:
        from_attributes = True
