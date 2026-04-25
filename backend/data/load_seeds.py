"""Load seed data into the database."""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import SessionLocal, Base, engine
from app.models.school import School

Base.metadata.create_all(bind=engine)

SEED_FILE = os.path.join(os.path.dirname(__file__), "seeds", "schools_valencia.json")


def load():
    db = SessionLocal()
    try:
        count = db.query(School).count()
        if count > 0:
            print(f"Seeds already loaded ({count} schools). Skipping.")
            return

        with open(SEED_FILE) as f:
            data = json.load(f)

        for item in data:
            school = School(**item)
            db.add(school)

        db.commit()
        print(f"Loaded {len(data)} schools.")
    finally:
        db.close()


if __name__ == "__main__":
    load()
