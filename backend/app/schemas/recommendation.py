from typing import Optional, List, Dict
from pydantic import BaseModel, Field, model_validator


class WeightsInput(BaseModel):
    user_fit: float = Field(0.35, ge=0, le=1)
    distance: float = Field(0.25, ge=0, le=1)
    cost: float = Field(0.20, ge=0, le=1)
    quality: float = Field(0.15, ge=0, le=1)
    reviews: float = Field(0.05, ge=0, le=1)

    @model_validator(mode="after")
    def weights_positive(self):
        total = self.user_fit + self.distance + self.cost + self.quality + self.reviews
        if total <= 0:
            raise ValueError("At least one weight must be > 0")
        return self


class UserPreferences(BaseModel):
    stem: float = Field(0.0, ge=0, le=1)
    sports: float = Field(0.0, ge=0, le=1)
    arts: float = Field(0.0, ge=0, le=1)
    english: float = Field(0.0, ge=0, le=1)
    valencian: float = Field(0.0, ge=0, le=1)
    bilingual: float = Field(0.0, ge=0, le=1)
    montessori: float = Field(0.0, ge=0, le=1)
    traditional: float = Field(0.0, ge=0, le=1)
    religion: float = Field(0.0, ge=0, le=1)
    inclusion: float = Field(0.0, ge=0, le=1)


class RecommendRequest(BaseModel):
    lat: float = Field(..., ge=39.0, le=40.5)
    lon: float = Field(..., ge=-1.5, le=0.5)
    monthly_salary: float = Field(..., gt=0)
    school_types: Optional[List[str]] = None
    school_levels: Optional[List[str]] = None
    preferences: Dict = Field(default_factory=dict)
    weights: Optional[Dict] = None
    max_distance_km: float = Field(15.0, gt=0, le=50)
    limit: int = Field(20, ge=1, le=50)


class ScoreBreakdown(BaseModel):
    final: float
    preference_match: float
    distance: float
    affordability: float
    objective_quality: float
    review: float


class RecommendedSchool(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    lat: float
    lon: float
    school_type: str
    methodology: Optional[str] = None
    levels: List[str] = []
    monthly_fee_min: float
    monthly_fee_max: float
    monthly_fee_avg: float
    google_rating: float
    google_review_count: int
    website: Optional[str] = None
    logo_url: Optional[str] = None
    extra_activities: List[str] = []
    scores: Dict
    explanation: Dict
    weaknesses: Dict


class RecommendResponse(BaseModel):
    results: List[RecommendedSchool]
    total: int
    query_profile: Dict
