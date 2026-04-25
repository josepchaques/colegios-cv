"""Unit tests for the scoring engine."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import math
from app.services.scorer import (
    distance_score,
    affordability_score,
    preference_match_score,
    bayesian_review_score,
    academic_proxy_score,
    objective_quality_score,
)


def test_distance_score_zero():
    assert distance_score(0, 10) == 1.0

def test_distance_score_beyond_max():
    assert distance_score(15, 10) == 0.0

def test_distance_score_monotonic():
    scores = [distance_score(d, 15) for d in range(0, 16)]
    assert all(scores[i] >= scores[i+1] for i in range(len(scores)-1))

def test_affordability_free():
    assert affordability_score(0, 2000) == 1.0

def test_affordability_15pct():
    # 300 / 2000 = 15% → score ≈ 0
    assert affordability_score(300, 2000) == pytest.approx(0.0, abs=0.01)

def test_affordability_high_salary():
    # 200 / 5000 = 4% → very affordable
    score = affordability_score(200, 5000)
    assert score > 0.7

def test_preference_match_identical():
    prefs = {"stem": 1.0, "sports": 0.5}
    features = {"stem": 1.0, "sports": 0.5}
    score = preference_match_score(prefs, features)
    assert score == pytest.approx(1.0, abs=0.01)

def test_preference_match_orthogonal():
    prefs = {"stem": 1.0, "arts": 0.0}
    features = {"stem": 0.0, "arts": 1.0}
    score = preference_match_score(prefs, features)
    assert score == pytest.approx(0.5, abs=0.01)

def test_preference_match_empty():
    score = preference_match_score({}, {"stem": 0.8})
    assert score == 0.5

def test_bayesian_smoothing_few_reviews():
    # With 0 reviews, should return global mean
    score_none = bayesian_review_score(0, 0)
    score_many = bayesian_review_score(5.0, 1000)
    assert score_none < score_many  # 5-star with 1000 reviews > fallback

def test_bayesian_no_bias_low_count():
    # 5 stars with 1 review should NOT score higher than 4.5 stars with 500
    score_1 = bayesian_review_score(5.0, 1)
    score_500 = bayesian_review_score(4.5, 500)
    assert score_1 < score_500

def test_academic_private_higher_than_public():
    pub = academic_proxy_score("public", 0.5, 22, False)
    priv = academic_proxy_score("private", 0.5, 22, False)
    assert priv > pub

def test_academic_bachillerato_bonus():
    without = academic_proxy_score("public", 0.5, 22, False)
    with_ = academic_proxy_score("public", 0.5, 22, True)
    assert with_ > without

def test_objective_quality_bounds():
    for a in [0.0, 0.5, 1.0]:
        for i in [0.0, 0.5, 1.0]:
            q = objective_quality_score(a, i)
            assert 0.0 <= q <= 1.0


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
