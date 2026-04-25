from sqlalchemy import Column, Integer, String, Float, Boolean, JSON, Text
from sqlalchemy.dialects.postgresql import ARRAY
from ..core.database import Base


class School(Base):
    __tablename__ = "schools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    code = Column(String(20), unique=True, index=True)

    # Location
    address = Column(String(300))
    city = Column(String(100))
    district = Column(String(100))
    postal_code = Column(String(10))
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)

    # Classification
    school_type = Column(String(20))   # public | concertado | private
    levels = Column(JSON)              # ["infantil", "primaria", "secundaria", "bachillerato"]
    methodology = Column(String(50))   # tradicional | montessori | waldorf | steam

    # Educational features (0-1 intensity)
    feature_stem = Column(Float, default=0.0)
    feature_sports = Column(Float, default=0.0)
    feature_arts = Column(Float, default=0.0)
    feature_english = Column(Float, default=0.0)
    feature_valencian = Column(Float, default=0.0)
    feature_bilingual = Column(Float, default=0.0)
    feature_montessori = Column(Float, default=0.0)
    feature_traditional = Column(Float, default=0.0)
    feature_religion = Column(Float, default=0.0)
    feature_inclusion = Column(Float, default=0.0)

    # Cost
    monthly_fee_min = Column(Float, default=0.0)
    monthly_fee_max = Column(Float, default=0.0)
    monthly_fee_avg = Column(Float, default=0.0)

    # Academic proxy metrics
    zone_income_index = Column(Float, default=0.5)   # 0-1, INE proxy
    student_teacher_ratio = Column(Float, default=20.0)
    has_bachillerato = Column(Boolean, default=False)
    infrastructure_score = Column(Float, default=0.5) # 0-1

    # Reviews
    google_rating = Column(Float, default=0.0)
    google_review_count = Column(Integer, default=0)

    # Metadata
    website = Column(String(300))
    phone = Column(String(20))
    description = Column(Text)
    logo_url = Column(String(300))
    photos = Column(JSON, default=list)
    extra_activities = Column(JSON, default=list)
