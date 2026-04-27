"""
Recommendation service: ranks schools for a given user profile.
Primary signal: user fit. Tie-break: objective quality.
"""
from typing import Optional, List
from sqlalchemy.orm import Session

from ..models.school import School
from ..schemas.recommendation import RecommendRequest, RecommendedSchool
from .scorer import score_school, ScoreComponents


def get_recommendations(
    db: Session,
    req: RecommendRequest,
    limit: int = 20,
) -> List[RecommendedSchool]:
    query = db.query(School)

    # Hard filters
    if req.school_types:
        query = query.filter(School.school_type.in_(req.school_types))

    schools = query.all()

    # Level filter: school must cover ALL requested levels (AND logic)
    if req.school_levels:
        requested = set(req.school_levels)
        schools = [s for s in schools if requested.issubset(set(s.levels or []))]

    results = []
    for school in schools:
        sc: ScoreComponents = score_school(
            school=school,
            user_lat=req.lat,
            user_lon=req.lon,
            monthly_salary=req.monthly_salary,
            user_prefs=req.preferences,
            weights=req.weights,
            max_distance_km=req.max_distance_km,
        )

        # Exclude schools beyond max distance
        if sc.distance == 0.0:
            continue

        results.append(
            RecommendedSchool(
                id=school.id,
                name=school.name,
                code=school.code,
                address=school.address,
                city=school.city,
                district=school.district,
                lat=school.lat,
                lon=school.lon,
                school_type=school.school_type,
                methodology=school.methodology,
                levels=school.levels or [],
                monthly_fee_min=school.monthly_fee_min,
                monthly_fee_max=school.monthly_fee_max,
                monthly_fee_avg=school.monthly_fee_avg,
                google_rating=school.google_rating,
                google_review_count=school.google_review_count,
                website=school.website,
                logo_url=school.logo_url,
                extra_activities=school.extra_activities or [],
                scores={
                    "final": sc.final,
                    "preference_match": sc.preference_match,
                    "distance": sc.distance,
                    "affordability": sc.affordability,
                    "objective_quality": sc.objective_quality,
                    "review": sc.review,
                },
                explanation=sc.explanation,
                weaknesses=sc.weaknesses,
            )
        )

    # Sort: by final score DESC, tie-break by review count (more reviews = more reliable score)
    results.sort(
        key=lambda r: (
            -r.scores["final"],
            -r.google_review_count,
        )
    )

    return results[:limit]
