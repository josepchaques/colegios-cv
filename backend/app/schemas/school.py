from typing import Optional, List
from pydantic import BaseModel


class SchoolOut(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    postal_code: Optional[str] = None
    lat: float
    lon: float
    school_type: str
    levels: List = []
    methodology: Optional[str] = None
    monthly_fee_min: float
    monthly_fee_max: float
    monthly_fee_avg: float
    google_rating: float
    google_review_count: int
    website: Optional[str] = None
    phone: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    photos: List = []
    extra_activities: List = []

    # Feature vector
    feature_stem: float
    feature_sports: float
    feature_arts: float
    feature_english: float
    feature_valencian: float
    feature_bilingual: float
    feature_montessori: float
    feature_traditional: float
    feature_religion: float
    feature_inclusion: float

    # Quality metrics
    zone_income_index: float
    student_teacher_ratio: float
    infrastructure_score: float
    has_bachillerato: bool

    class Config:
        from_attributes = True
