"""Fee Structure, Fee Schedule, Fee Component."""
from datetime import date
from pydantic import BaseModel, Field


class FeeComponentItem(BaseModel):
    id: str | None = None
    fees_category_id: str | None = None
    description: str | None = None
    amount: float
    discount: float = 0
    total: float | None = None
    frequency: str | None = "Monthly"
    due_day: str | None = None
    yearly_amount: float | None = None
    category_code: str | None = None
    category_name: str | None = None


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
    components: list[FeeComponentItem] = []


class FeeStructureUpdate(BaseModel):
    components: list[FeeComponentItem]


class FeeStructureResponse(FeeStructureBase):
    id: str
    components: list[FeeComponentItem] = []
    docstatus: int = 0
    class_name: str | None = None
    student_count: int = 0
    annual_total: float = 0
    monthly_total: float = 0
    updated_at: str | None = None

    class Config:
        from_attributes = True


class FeeStructureBoardItem(BaseModel):
    class_id: str
    class_name: str
    structure_id: str | None = None
    monthly_total: float = 0
    annual_total: float = 0
    student_count: int = 0
    item_count: int = 0


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


class PaymentMethodResponse(BaseModel):
    id: str
    name: str
    method_type: str
    provider: str | None = None
    fee_note: str | None = None
    is_enabled: bool = True
    sort_order: int = 0

    class Config:
        from_attributes = True


class PaymentMethodCreate(BaseModel):
    name: str
    method_type: str = "cash"
    provider: str | None = None
    fee_note: str | None = None
    is_enabled: bool = True


class PaymentMethodUpdate(BaseModel):
    name: str | None = None
    method_type: str | None = None
    provider: str | None = None
    fee_note: str | None = None
    is_enabled: bool | None = None


class FeeDiscountRuleResponse(BaseModel):
    id: str
    name: str
    discount_percent: float
    criteria_type: str
    criteria_label: str | None = None
    auto_apply: bool = True
    is_enabled: bool = True
    student_count: int = 0

    class Config:
        from_attributes = True


class FeeDiscountRuleCreate(BaseModel):
    name: str
    discount_percent: float = Field(ge=0, le=100)
    criteria_type: str = "custom"
    criteria_label: str | None = None
    auto_apply: bool = True


class FeeDiscountRuleUpdate(BaseModel):
    name: str | None = None
    discount_percent: float | None = Field(default=None, ge=0, le=100)
    criteria_type: str | None = None
    criteria_label: str | None = None
    auto_apply: bool | None = None
    is_enabled: bool | None = None


class CloneYearRequest(BaseModel):
    from_academic_year_id: str
    to_academic_year_id: str
