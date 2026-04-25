import json
import hashlib
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...schemas.recommendation import RecommendRequest, RecommendResponse
from ...services.recommender import get_recommendations

router = APIRouter()


def _cache_key(req: RecommendRequest) -> str:
    payload = req.model_dump_json()
    return f"recommend:{hashlib.md5(payload.encode()).hexdigest()}"


@router.post("/recommend", response_model=RecommendResponse)
def recommend(
    req: RecommendRequest,
    db: Session = Depends(get_db),
):
    results = get_recommendations(db, req, limit=req.limit)

    return RecommendResponse(
        results=results,
        total=len(results),
        query_profile={
            "lat": req.lat,
            "lon": req.lon,
            "monthly_salary": req.monthly_salary,
            "school_types": req.school_types,
            "max_distance_km": req.max_distance_km,
            "preferences": req.preferences,
            "weights": req.weights,
        },
    )
