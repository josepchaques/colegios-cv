"""
Core scoring engine.
Primary signal: user fit. Tie-break: objective quality.
All scores normalized to [0, 1].
"""
import math
from dataclasses import dataclass
from typing import Optional
import numpy as np

from ..core.config import get_settings

settings = get_settings()

PREFERENCE_KEYS = [
    "stem", "sports", "arts", "english", "valencian",
    "bilingual", "montessori", "traditional", "religion", "inclusion",
]

TYPE_COST_DEFAULTS = {
    "public":     {"min": 0,   "avg": 30,   "max": 60},
    "concertado": {"min": 80,  "avg": 200,  "max": 380},
    "private":    {"min": 350, "avg": 650,  "max": 1400},
}


@dataclass
class ScoreComponents:
    preference_match: float
    distance: float
    affordability: float
    academic: float
    objective_quality: float
    review: float
    final: float
    explanation: dict
    weaknesses: dict


def distance_score(distance_km: float, max_km: float = 15.0) -> float:
    """
    Logistic inverse decay. Score=1 at 0km, ~0.5 at 40% of max_km,
    approaches 0 as distance → max_km. Returns 0 beyond max_km.
    """
    if distance_km >= max_km:
        return 0.0
    k = 0.6
    d_mid = max_km * 0.4
    raw = 1.0 / (1.0 + math.exp(k * (distance_km - d_mid)))
    # Scale so score=1 at d=0
    scale = 1.0 / (1.0 + math.exp(k * (0 - d_mid)))
    return round(min(1.0, raw / scale), 4)


def affordability_score(monthly_cost_avg: float, monthly_salary: float) -> float:
    """
    Comfortable education spend: up to 15% of net salary.
    Linear penalty above threshold, zero below it.
    """
    if monthly_salary <= 0:
        return 0.5
    ratio = monthly_cost_avg / max(monthly_salary, 1)
    threshold = 0.15
    if ratio <= 0:
        return 1.0
    score = max(0.0, 1.0 - (ratio / threshold))
    return round(score, 4)


def preference_match_score(user_prefs: dict, school_features: dict) -> float:
    """
    Cosine similarity between user preference vector and school feature vector.
    Normalized to [0, 1] from [-1, 1].
    Returns 0.5 (neutral) when user has no preferences set.
    """
    u = np.array([user_prefs.get(k, 0.0) for k in PREFERENCE_KEYS], dtype=float)
    s = np.array([school_features.get(k, 0.0) for k in PREFERENCE_KEYS], dtype=float)

    u_norm = np.linalg.norm(u)
    s_norm = np.linalg.norm(s)

    if u_norm < 1e-9 or s_norm < 1e-9:
        return 0.5

    cosine = float(np.dot(u, s) / (u_norm * s_norm))
    return round((cosine + 1.0) / 2.0, 4)


def bayesian_review_score(
    rating: float,
    count: int,
    c: float = None,
    m: float = None,
) -> float:
    """
    Bayesian smoothing: avoids gaming by centres with few reviews.
    score = (n*r + C*m) / (n + C), then normalized to [0,1].
    """
    c = c or settings.bayesian_c
    m = m or settings.bayesian_m
    if count == 0 or rating == 0:
        return round(m / 5.0, 4)
    smoothed = (count * rating + c * m) / (count + c)
    return round(min(1.0, smoothed / 5.0), 4)


def academic_proxy_score(
    school_type: str,
    zone_income_index: float,
    student_teacher_ratio: float,
    has_bachillerato: bool,
) -> float:
    """
    Proxy for academic quality using available objective data.
    Higher zone income → higher correlation with academic outcomes.
    Lower student/teacher ratio → better individual attention.
    """
    type_base = {"public": 0.60, "concertado": 0.70, "private": 0.78}.get(school_type, 0.60)

    # Zone socioeconomic proxy (capped contribution)
    zone_bonus = min(0.12, zone_income_index * 0.15)

    # Staff ratio bonus: ideal ~15:1, penalty above 28:1
    ratio_penalty = max(0.0, (student_teacher_ratio - 15) / 80)
    ratio_component = max(0.0, 0.08 - ratio_penalty)

    # Bachillerato signals a complete secondary programme
    bachi_bonus = 0.04 if has_bachillerato else 0.0

    return round(min(1.0, type_base + zone_bonus + ratio_component + bachi_bonus), 4)


def objective_quality_score(academic: float, infrastructure: float) -> float:
    """
    Objective quality is always weighted heavier than subjective (reviews).
    Weights: 60% academic, 40% infrastructure.
    """
    return round(0.6 * academic + 0.4 * infrastructure, 4)


def _explain_preference(score: float) -> str:
    if score >= 0.75:
        return "Muy alto encaje con tus preferencias educativas"
    if score >= 0.55:
        return "Buen encaje con tus preferencias educativas"
    if score >= 0.40:
        return "Encaje moderado con tus preferencias"
    return "Bajo encaje con tus preferencias"


def _explain_distance(score: float, distance_km: float) -> str:
    mins = int(distance_km * 3.5)  # ~3.5 min/km in urban traffic
    if distance_km < 1:
        return f"A {int(distance_km*1000)}m — caminando"
    if distance_km < 3:
        return f"A {distance_km:.1f} km ({mins} min en coche)"
    if score > 0.5:
        return f"A {distance_km:.1f} km ({mins} min en coche)"
    return f"A {distance_km:.1f} km — algo lejos"


def _explain_affordability(score: float, monthly_cost: float, salary: float) -> str:
    pct = round((monthly_cost / max(salary, 1)) * 100, 1)
    if monthly_cost <= 30:
        return "Centro público — coste prácticamente nulo"
    if score >= 0.75:
        return f"Coste muy asumible ({pct}% de tu salario)"
    if score >= 0.40:
        return f"Coste asumible ({pct}% de tu salario)"
    return f"Coste elevado para tu salario ({pct}%)"


def _explain_quality(score: float) -> str:
    if score >= 0.78:
        return "Alta calidad académica estimada en la zona"
    if score >= 0.65:
        return "Buena calidad académica"
    return "Calidad académica media"


def _explain_reviews(score: float, count: int) -> str:
    if count < 5:
        return "Pocas reseñas disponibles (estimación estadística)"
    if score >= 0.78:
        return "Valoración muy positiva de las familias"
    if score >= 0.65:
        return "Valoración positiva de las familias"
    return "Valoración mixta de las familias"


def _build_weaknesses(
    p_score: float,
    d_score: float,
    a_score: float,
    obj_q: float,
    rev: float,
    dist_km: float,
    monthly_cost: float,
    monthly_salary: float,
    review_count: int,
    user_prefs: dict,
) -> dict:
    w = {}

    if p_score < 0.45 and any(v > 0 for v in user_prefs.values()):
        w["preference_match"] = "Pocas de tus prioridades educativas están presentes en este centro"

    if d_score < 0.45:
        mins = int(dist_km * 3.5)
        w["distance"] = f"Lejos de tu ubicación: {dist_km:.1f} km (~{mins} min en coche)"

    if a_score < 0.45:
        pct = round((monthly_cost / max(monthly_salary, 1)) * 100, 1)
        w["affordability"] = f"Coste elevado para tu salario: {pct}% (recomendado <15%)"

    if obj_q < 0.62:
        w["objective_quality"] = (
            "Calidad académica estimada baja — dato proxy basado en tipo de centro y zona "
            "(sin datos reales del Ministerio de Educación)"
        )

    if rev < 0.50:
        if review_count < 5:
            w["reviews"] = (
                "Sin valoraciones de Google — la puntuación es una estimación estadística, "
                "no refleja opiniones reales de familias"
            )
        else:
            w["reviews"] = f"Valoración baja en Google ({review_count} reseñas)"

    return w


def score_school(
    school,
    user_lat: float,
    user_lon: float,
    monthly_salary: float,
    user_prefs: dict,
    weights: Optional[dict] = None,
    max_distance_km: float = 15.0,
) -> ScoreComponents:
    """
    Main scoring function. Returns all component scores + final weighted score.
    """
    from geopy.distance import geodesic

    w = weights or settings.default_weights

    # Normalize weights to sum=1
    total_w = sum(w.values())
    w = {k: v / total_w for k, v in w.items()}

    dist_km = geodesic((user_lat, user_lon), (school.lat, school.lon)).km

    # Feature vector from school model
    school_features = {k: getattr(school, f"feature_{k}", 0.0) for k in PREFERENCE_KEYS}

    # Component scores
    d_score = distance_score(dist_km, max_distance_km)
    a_score = affordability_score(school.monthly_fee_avg, monthly_salary)
    p_score = preference_match_score(user_prefs, school_features)
    acad = academic_proxy_score(
        school.school_type,
        school.zone_income_index,
        school.student_teacher_ratio,
        school.has_bachillerato,
    )
    obj_q = objective_quality_score(acad, school.infrastructure_score)
    rev = bayesian_review_score(school.google_rating, school.google_review_count)

    final = round(
        w["user_fit"] * p_score
        + w["distance"] * d_score
        + w["cost"] * a_score
        + w["quality"] * obj_q
        + w["reviews"] * rev,
        4,
    )

    explanation = {
        "preference_match": _explain_preference(p_score),
        "distance": _explain_distance(d_score, dist_km),
        "cost": _explain_affordability(a_score, school.monthly_fee_avg, monthly_salary),
        "quality": _explain_quality(obj_q),
        "reviews": _explain_reviews(rev, school.google_review_count),
    }

    weaknesses = _build_weaknesses(
        p_score, d_score, a_score, obj_q, rev,
        dist_km, school.monthly_fee_avg, monthly_salary,
        school.google_review_count, user_prefs,
    )

    return ScoreComponents(
        preference_match=p_score,
        distance=d_score,
        affordability=a_score,
        academic=acad,
        objective_quality=obj_q,
        review=rev,
        final=final,
        explanation=explanation,
        weaknesses=weaknesses,
    )
