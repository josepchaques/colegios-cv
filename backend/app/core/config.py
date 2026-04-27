from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "School Recommender CV"
    debug: bool = False

    database_url: str = "postgresql://postgres:postgres@localhost:5432/schools_cv"
    redis_url: str = "redis://redis:6379/0"

    # Scoring defaults
    default_max_distance_km: float = 15.0
    score_tie_threshold: float = 0.03

    # Bayesian review smoothing
    bayesian_c: float = 10.0
    bayesian_m: float = 3.8  # global mean rating (out of 5)

    # Default weight presets
    default_weights: dict = {
        "user_fit": 0.35,
        "distance": 0.25,
        "cost": 0.20,
        "quality": 0.15,
        "reviews": 0.05,
    }

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
