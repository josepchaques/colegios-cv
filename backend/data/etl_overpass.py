"""
ETL: descarga colegios reales de la Comunitat Valenciana desde OpenStreetMap (Overpass API).
Detecta tipo de centro por nombre/tags OSM, calcula defaults razonables para el scoring.
Hace upsert por código de colegio (o nombre+coordenadas como fallback).
"""
import sys, os, json, time, re, math
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import requests
from sqlalchemy.orm import Session
from app.core.database import Base, engine, SessionLocal
from app.models.school import School

Base.metadata.create_all(bind=engine)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Bounding box Comunitat Valenciana
OVERPASS_QUERY = """
[out:json][timeout:120];
(
  node["amenity"="school"]["name"](37.8,-1.6,41.0,0.8);
  way["amenity"="school"]["name"](37.8,-1.6,41.0,0.8);
  relation["amenity"="school"]["name"](37.8,-1.6,41.0,0.8);
);
out center body;
"""

# ─── Type detection ────────────────────────────────────────────────────────────

PUBLIC_PREFIXES = re.compile(
    r"^(CEIP|C\.E\.I\.P|IES|I\.E\.S|CIPFP|CEAM|CEED|CAES|CPR|CRA|CEPA)\b",
    re.IGNORECASE,
)
PRIVATE_KEYWORDS = re.compile(
    r"\b(british|american|alemán|aleman|international|français|français|lycée|SEK|IB campus)\b",
    re.IGNORECASE,
)
CONCERTADO_KEYWORDS = re.compile(
    r"\b(salesia|jesuit|dominic|agustin|escolapi|marista|la salle|lasalle|"
    r"carmelit|ursulina|trinitari|francisc|clarisa|sagrada familia|"
    r"inmaculada|concepci|loreto|coraz[oó]n|salesiano|vicentino|"
    r"redentorista|mercedari|calasan[zc]|piarist|benedic)\b",
    re.IGNORECASE,
)
MONTESSORI_KW  = re.compile(r"\bmontessori\b", re.IGNORECASE)
WALDORF_KW     = re.compile(r"\bwaldorf\b",    re.IGNORECASE)
STEAM_KW       = re.compile(r"\b(steam|stem|sadako|maker)\b", re.IGNORECASE)

PROVINCE_CENTERS = {
    "valencia":   (39.4699, -0.3763),
    "alicante":   (38.3452, -0.4810),
    "castellon":  (39.9864, -0.0513),
}

def detect_type(name: str, tags: dict) -> str:
    osm_type = tags.get("school:type") or tags.get("operator:type") or ""
    if osm_type in ("public", "government"):
        return "public"
    if osm_type in ("private",):
        return "private"
    if osm_type in ("concertado", "semi-private"):
        return "concertado"
    n = name or ""
    if PUBLIC_PREFIXES.search(n):
        return "public"
    if PRIVATE_KEYWORDS.search(n):
        return "private"
    if CONCERTADO_KEYWORDS.search(n):
        return "concertado"
    return "concertado"   # safe default for named schools without prefix

def detect_methodology(name: str, tags: dict) -> str:
    n = name or ""
    if MONTESSORI_KW.search(n): return "montessori"
    if WALDORF_KW.search(n):    return "waldorf"
    if STEAM_KW.search(n):      return "steam"
    return "tradicional"

def detect_levels(name: str, tags: dict) -> list:
    n = (name or "").upper()
    levels = []
    if re.search(r"\bIEI\b|INFANTIL", n):
        levels.append("infantil")
    if re.search(r"\bCEIP\b|PRIMARIA", n):
        levels += ["infantil", "primaria"]
    if re.search(r"\bIES\b|SECUNDARIA|ESO", n):
        levels += ["secundaria"]
    if re.search(r"\bBACHILLERATO\b", n):
        levels.append("bachillerato")
    if re.search(r"\bCIPFP\b|\bFP\b|FORMACION PROFESIONAL", n):
        levels.append("FP")
    if not levels:
        stype = tags.get("school:type","")
        if "high" in stype:
            levels = ["secundaria", "bachillerato"]
        else:
            levels = ["infantil", "primaria"]
    return list(dict.fromkeys(levels))  # deduplicate preserving order

def zone_income_from_coords(lat: float, lon: float) -> float:
    """
    Very rough proxy: Valencia city centre → higher, periphery → lower.
    In production this would use INE census data.
    """
    dist_vlc = math.sqrt((lat - 39.4699)**2 + (lon + 0.3763)**2)
    dist_ali  = math.sqrt((lat - 38.3452)**2 + (lon + 0.4810)**2)
    dist_cas  = math.sqrt((lat - 39.9864)**2 + (lon + 0.0513)**2)
    min_dist  = min(dist_vlc, dist_ali, dist_cas)
    # Close to a capital → 0.70–0.80; far → 0.40–0.60
    return round(max(0.35, min(0.85, 0.80 - min_dist * 2.5)), 2)

def fee_defaults(school_type: str) -> dict:
    return {
        "public":     {"min": 0,   "avg": 20,  "max": 50},
        "concertado": {"min": 80,  "avg": 190, "max": 360},
        "private":    {"min": 400, "avg": 700, "max": 1400},
    }[school_type]

def feature_defaults(school_type: str, methodology: str, name: str) -> dict:
    n = (name or "").lower()
    f = {
        "stem": 0.3, "sports": 0.5, "arts": 0.4,
        "english": 0.5, "valencian": 0.6,
        "bilingual": 0.0,
        "montessori": 0.0, "traditional": 0.8,
        "religion": 0.0, "inclusion": 0.6,
    }
    if school_type == "public":
        f["valencian"]   = 0.85
        f["traditional"] = 0.85
        f["religion"]    = 0.0
    if school_type == "private":
        f["english"]    = 0.8
        f["bilingual"]  = 0.7
        f["stem"]       = 0.6
    if CONCERTADO_KEYWORDS.search(name or ""):
        f["religion"] = 0.85
    if methodology == "montessori":
        f["montessori"]  = 1.0
        f["traditional"] = 0.0
        f["inclusion"]   = 0.9
    if methodology == "waldorf":
        f["arts"]        = 0.95
        f["montessori"]  = 0.3
        f["traditional"] = 0.0
    if methodology == "steam":
        f["stem"]  = 0.90
        f["arts"]  = 0.75
    if PRIVATE_KEYWORDS.search(name or ""):
        f["english"]   = 1.0
        f["bilingual"] = 1.0
    return f

# ─── Fetch ─────────────────────────────────────────────────────────────────────

def fetch_schools() -> list[dict]:
    print("Descargando colegios de Overpass API (OSM)…")
    headers = {"User-Agent": "SchoolRecommenderCV/1.0 (educational project)"}
    r = requests.post(
        OVERPASS_URL,
        data={"data": OVERPASS_QUERY},
        headers=headers,
        timeout=130,
    )
    if not r.ok:
        # Fallback to GET
        import urllib.parse
        params = urllib.parse.urlencode({"data": OVERPASS_QUERY})
        r = requests.get(f"{OVERPASS_URL}?{params}", headers=headers, timeout=130)
    r.raise_for_status()
    elements = r.json().get("elements", [])
    print(f"  {len(elements)} elementos OSM recibidos")
    return elements

def parse_element(el: dict):
    tags = el.get("tags", {})
    name = tags.get("name") or tags.get("name:es") or tags.get("name:ca")
    if not name:
        return None

    # Coords
    if el["type"] == "node":
        lat, lon = el["lat"], el["lon"]
    else:
        center = el.get("center", {})
        lat    = center.get("lat")
        lon    = center.get("lon")
    if not lat or not lon:
        return None

    # Filter to CV bounding box
    if not (38.0 <= lat <= 41.0 and -1.6 <= lon <= 0.8):
        return None

    osm_id = f"osm_{el['type']}_{el['id']}"
    school_type = detect_type(name, tags)
    methodology = detect_methodology(name, tags)
    levels      = detect_levels(name, tags)
    fees        = fee_defaults(school_type)
    features    = feature_defaults(school_type, methodology, name)
    zone_inc    = zone_income_from_coords(lat, lon)

    city    = (tags.get("addr:city") or tags.get("addr:town") or
               tags.get("addr:municipality") or "")
    address = " ".join(filter(None, [
        tags.get("addr:street", ""),
        tags.get("addr:housenumber", ""),
    ]))

    return {
        "code":              osm_id,
        "name":              name,
        "address":           address or None,
        "city":              city or None,
        "district":          tags.get("addr:suburb") or tags.get("addr:district") or None,
        "postal_code":       tags.get("addr:postcode") or None,
        "lat":               round(lat, 6),
        "lon":               round(lon, 6),
        "school_type":       school_type,
        "methodology":       methodology,
        "levels":            levels,
        "monthly_fee_min":   fees["min"],
        "monthly_fee_avg":   fees["avg"],
        "monthly_fee_max":   fees["max"],
        "zone_income_index": zone_inc,
        "student_teacher_ratio": 20 if school_type == "public" else 16,
        "has_bachillerato":  "bachillerato" in levels,
        "infrastructure_score": 0.65 if school_type == "public" else 0.78,
        "google_rating":     0.0,
        "google_review_count": 0,
        "website":           tags.get("website") or tags.get("contact:website") or None,
        "phone":             tags.get("phone") or tags.get("contact:phone") or None,
        "description":       None,
        "logo_url":          None,
        "photos":            [],
        "extra_activities":  [],
        **{f"feature_{k}": v for k, v in features.items()},
    }

# ─── Import ────────────────────────────────────────────────────────────────────

def run():
    elements = fetch_schools()
    rows     = []
    seen     = set()
    for el in elements:
        parsed = parse_element(el)
        if not parsed:
            continue
        key = (round(parsed["lat"], 3), round(parsed["lon"], 3), parsed["name"][:30])
        if key in seen:
            continue
        seen.add(key)
        rows.append(parsed)

    print(f"  {len(rows)} colegios únicos procesados")

    db: Session = SessionLocal()
    try:
        added   = 0
        updated = 0
        for row in rows:
            existing = db.query(School).filter(School.code == row["code"]).first()
            if existing:
                for k, v in row.items():
                    setattr(existing, k, v)
                updated += 1
            else:
                db.add(School(**row))
                added += 1

        db.commit()
        total = db.query(School).count()
        print(f"  ✓ Añadidos: {added}  |  Actualizados: {updated}  |  Total BD: {total}")
    finally:
        db.close()

if __name__ == "__main__":
    run()
