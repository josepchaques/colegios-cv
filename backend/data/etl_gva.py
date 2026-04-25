"""
ETL oficial GVA: enriquece la BD con el CSV oficial de centros docentes
(dadesobertes.gva.es). Añade ciudad, provincia, tipo oficial, teléfono,
web y corrije coordenadas. Hace upsert por proximidad + similitud de nombre.
"""
import sys, os, csv, io, re, math
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import requests
from sqlalchemy.orm import Session
from app.core.database import Base, engine, SessionLocal
from app.models.school import School

Base.metadata.create_all(bind=engine)

GVA_CSV_URL = (
    "https://dadesobertes.gva.es/dataset/68eb1d94-76d3-4305-8507-"
    "e1aab7717d0e/resource/1aa53c3a-4639-41aa-ac85-d58254c428c0/"
    "download/centros-docentes-de-la-comunitat-valenciana.csv"
)

REGIMEN_MAP = {
    "PÚB.":        "public",
    "PUB.":        "public",
    "PRIV. CONC.": "concertado",
    "CONC.":       "concertado",
    "PRIV.":       "private",
}


def parse_type(regimen):
    r = (regimen or "").strip().upper()
    for k, v in REGIMEN_MAP.items():
        if k in r:
            return v
    return "concertado"


def haversine_m(lat1, lon1, lat2, lon2):
    R = 6_371_000
    p = math.pi / 180
    a = (math.sin((lat2 - lat1) * p / 2) ** 2
         + math.cos(lat1 * p) * math.cos(lat2 * p)
         * math.sin((lon2 - lon1) * p / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))


def name_sim(a, b):
    wa = set(re.sub(r"[^\w\s]", "", (a or "").lower()).split())
    wb = set(re.sub(r"[^\w\s]", "", (b or "").lower()).split())
    if not wa or not wb:
        return 0.0
    return len(wa & wb) / len(wa | wb)


def zone_income(lat, lon):
    d = min(
        math.sqrt((lat - 39.4699) ** 2 + (lon + 0.3763) ** 2),
        math.sqrt((lat - 38.3452) ** 2 + (lon + 0.4810) ** 2),
        math.sqrt((lat - 39.9864) ** 2 + (lon + 0.0513) ** 2),
    )
    return round(max(0.35, min(0.85, 0.80 - d * 2.5)), 2)


def fee_defaults(stype):
    return {
        "public":     (0,   20,  50),
        "concertado": (80,  190, 360),
        "private":    (400, 700, 1400),
    }[stype]


def infra_default(stype):
    return {"public": 0.62, "concertado": 0.72, "private": 0.85}[stype]


def parse_row(row):
    try:
        lat = float((row.get("latitud")  or "0").replace(",", "."))
        lon = float((row.get("longitud") or "0").replace(",", "."))
    except ValueError:
        return None
    if lat == 0 or lon == 0:
        return None
    if not (38.0 <= lat <= 41.0 and -1.6 <= lon <= 0.8):
        return None

    name = (row.get("denominacion") or "").strip()
    if not name:
        return None

    stype = parse_type(row.get("regimen", ""))
    city  = (row.get("localidad") or "").strip().title() or None
    comarca = (row.get("comarca") or "").strip().title() or None
    via    = (row.get("tipo_via") or "").strip().title()
    street = (row.get("direccion") or "").strip().title()
    number = (row.get("numero") or "").strip()
    address = " ".join(filter(None, [via, street, number])) or None

    fmin, favg, fmax = fee_defaults(stype)
    return {
        "code":     f"gva_{(row.get('codigo') or '').strip()}",
        "name":     name,
        "address":  address,
        "city":     city,
        "district": comarca,
        "postal_code": (row.get("codigo_postal") or "").strip() or None,
        "lat":      round(lat, 6),
        "lon":      round(lon, 6),
        "school_type": stype,
        "phone":    (row.get("telefono") or "").strip() or None,
        "website":  (row.get("url_es") or "").strip() or None,
        "monthly_fee_min": fmin,
        "monthly_fee_avg": favg,
        "monthly_fee_max": fmax,
        "zone_income_index":    zone_income(lat, lon),
        "infrastructure_score": infra_default(stype),
        "has_bachillerato": bool(
            re.search(r"BACHILLERATO|SECUNDAR|IES\b|INSTITUT", name.upper())
        ),
        "student_teacher_ratio": 20 if stype == "public" else 16,
    }


def find_match(gva, spatial_index):
    cands = []
    for school, slat, slon in spatial_index:
        dist = haversine_m(gva["lat"], gva["lon"], slat, slon)
        if dist <= 300:
            sim = name_sim(gva["name"], school.name)
            cands.append((dist, sim, school))
    if not cands:
        return None
    cands.sort(key=lambda x: (x[0], -x[1]))
    dist, sim, best = cands[0]
    if dist <= 60 or (dist <= 300 and sim >= 0.3):
        return best
    return None


def apply_features(school):
    stype = school.school_type
    name  = (school.name or "").lower()
    if stype == "public":
        if school.feature_valencian < 0.5:
            school.feature_valencian  = 0.85
        if school.feature_traditional < 0.5:
            school.feature_traditional = 0.85
        school.feature_religion = 0.0
    if stype == "private":
        if school.feature_english   < 0.5: school.feature_english   = 0.75
        if school.feature_bilingual < 0.3: school.feature_bilingual = 0.65
    if re.search(r"salesian|jesuit|agustin|lasalle|marista|dominic|calasan|escolapi|concepci", name):
        if school.feature_religion < 0.5:
            school.feature_religion = 0.85


def run():
    print("Descargando CSV oficial de la GVA…")
    r = requests.get(
        GVA_CSV_URL,
        headers={"User-Agent": "SchoolRecommenderCV/1.0"},
        timeout=60,
    )
    r.raise_for_status()
    content = r.content.decode("utf-8-sig", errors="replace")
    reader  = csv.DictReader(io.StringIO(content), delimiter=";")
    gva_raw = list(reader)
    print(f"  {len(gva_raw)} filas en el CSV")

    gva_list = [d for row in gva_raw if (d := parse_row(row))]
    print(f"  {len(gva_list)} centros válidos")

    db = SessionLocal()
    try:
        all_schools   = db.query(School).all()
        spatial_index = [(s, s.lat, s.lon) for s in all_schools]
        print(f"  {len(all_schools)} colegios en BD")

        enriched = 0
        inserted = 0

        for gva in gva_list:
            match = find_match(gva, spatial_index)

            if match:
                if not match.city        and gva.get("city"):       match.city        = gva["city"]
                if not match.district    and gva.get("district"):   match.district    = gva["district"]
                if not match.phone       and gva.get("phone"):      match.phone       = gva["phone"]
                if not match.website     and gva.get("website"):    match.website     = gva["website"]
                if not match.address     and gva.get("address"):    match.address     = gva["address"]
                if not match.postal_code and gva.get("postal_code"):match.postal_code = gva["postal_code"]
                match.school_type          = gva["school_type"]
                match.monthly_fee_min      = gva["monthly_fee_min"]
                match.monthly_fee_avg      = gva["monthly_fee_avg"]
                match.monthly_fee_max      = gva["monthly_fee_max"]
                match.zone_income_index    = gva["zone_income_index"]
                match.infrastructure_score = gva["infrastructure_score"]
                match.has_bachillerato     = gva["has_bachillerato"]
                apply_features(match)
                enriched += 1
            else:
                stype = gva["school_type"]
                s = School(
                    code         = gva["code"],
                    name         = gva["name"],
                    address      = gva.get("address"),
                    city         = gva.get("city"),
                    district     = gva.get("district"),
                    postal_code  = gva.get("postal_code"),
                    lat          = gva["lat"],
                    lon          = gva["lon"],
                    school_type  = stype,
                    levels       = [],
                    methodology  = "tradicional",
                    monthly_fee_min       = gva["monthly_fee_min"],
                    monthly_fee_avg       = gva["monthly_fee_avg"],
                    monthly_fee_max       = gva["monthly_fee_max"],
                    zone_income_index     = gva["zone_income_index"],
                    student_teacher_ratio = gva["student_teacher_ratio"],
                    has_bachillerato      = gva["has_bachillerato"],
                    infrastructure_score  = gva["infrastructure_score"],
                    phone   = gva.get("phone"),
                    website = gva.get("website"),
                    google_rating       = 0.0,
                    google_review_count = 0,
                    feature_stem        = 0.3,
                    feature_sports      = 0.5,
                    feature_arts        = 0.4,
                    feature_english     = 0.5 if stype == "public" else 0.72,
                    feature_valencian   = 0.85 if stype == "public" else 0.5,
                    feature_bilingual   = 0.0 if stype == "public" else 0.6,
                    feature_montessori  = 0.0,
                    feature_traditional = 0.85,
                    feature_religion    = 0.8 if stype == "concertado" else 0.0,
                    feature_inclusion   = 0.6,
                    photos              = [],
                    extra_activities    = [],
                )
                db.add(s)
                spatial_index.append((s, s.lat, s.lon))
                inserted += 1

            if (enriched + inserted) % 500 == 0 and (enriched + inserted) > 0:
                db.commit()
                print(f"  … {enriched} enriquecidos, {inserted} nuevos insertados")

        db.commit()

        total        = db.query(School).count()
        without_city = db.query(School).filter(
            (School.city == None) | (School.city == "")
        ).count()
        with_city    = total - without_city

        print(f"\n  Enriquecidos (match OSM→GVA): {enriched}")
        print(f"  Nuevos centros GVA:           {inserted}")
        print(f"  Total en BD:                  {total}")
        print(f"  Con ciudad:                   {with_city}  ({round(with_city/total*100)}%)")
        print(f"  Sin ciudad:                   {without_city}")

    finally:
        db.close()


if __name__ == "__main__":
    run()
