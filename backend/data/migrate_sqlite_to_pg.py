"""
Migrates all schools from the local SQLite file to PostgreSQL.
Run inside the Docker container:
  docker compose exec backend python data/migrate_sqlite_to_pg.py
"""
import sys, os, sqlite3, json
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import Base, engine, SessionLocal
from app.models.school import School

SQLITE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "schools_cv.db")

COLUMNS = [
    "id", "code", "name", "school_type", "lat", "lon",
    "address", "city", "province", "postal_code",
    "phone", "website", "levels", "methodology",
    "monthly_fee_avg", "monthly_fee_min", "monthly_fee_max",
    "feature_stem", "feature_sports", "feature_arts",
    "feature_english", "feature_valencian", "feature_bilingual",
    "feature_montessori", "feature_traditional", "feature_religion",
    "feature_inclusion",
    "google_rating", "google_review_count",
    "student_teacher_ratio", "has_bachillerato",
    "zone_income_index",
]

def run():
    Base.metadata.create_all(bind=engine)

    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM schools")
    rows = cur.fetchall()
    conn.close()

    print(f"Read {len(rows)} schools from SQLite")

    db = SessionLocal()
    try:
        # Truncate existing data
        db.query(School).delete()
        db.commit()

        batch = []
        for row in rows:
            d = dict(row)
            # levels is stored as JSON string in SQLite
            if isinstance(d.get("levels"), str):
                try:
                    d["levels"] = json.loads(d["levels"])
                except Exception:
                    d["levels"] = []
            # Keep only known columns
            d = {k: v for k, v in d.items() if k in COLUMNS}
            batch.append(School(**d))

            if len(batch) >= 500:
                db.bulk_save_objects(batch)
                db.commit()
                print(f"  Inserted {len(batch)} rows...")
                batch = []

        if batch:
            db.bulk_save_objects(batch)
            db.commit()
            print(f"  Inserted {len(batch)} rows...")

        total = db.query(School).count()
        print(f"Done. PostgreSQL now has {total} schools.")
    finally:
        db.close()

if __name__ == "__main__":
    run()
