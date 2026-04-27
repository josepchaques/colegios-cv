"""
ETL de etapas educativas reales desde el WFS del ICV/GVA.
Cruza por código de centro y actualiza el campo `levels` con datos oficiales.

Capas WFS utilizadas:
  - CentrosDocentesNivel.EducacionInfantil
  - CentrosDocentesNivel.EducacionPrimaria
  - CentrosDocentesNivel.EducacionSecundariaBachillerato
  - CentrosDocentesNivel.FormacionProfesional
"""
import sys, os, csv, io, re, math
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import requests
from collections import defaultdict
from sqlalchemy.orm import Session
from app.core.database import Base, engine, SessionLocal
from app.models.school import School

Base.metadata.create_all(bind=engine)

WFS_BASE = "https://terramapas.icv.gva.es/12_Centros_wfs"

LAYER_LEVELS = {
    "ms:CentrosDocentesNivel.EducacionInfantil":              ["infantil"],
    "ms:CentrosDocentesNivel.EducacionPrimaria":              ["infantil", "primaria"],
    "ms:CentrosDocentesNivel.EducacionSecundariaBachillerato": ["secundaria", "bachillerato"],
    "ms:CentrosDocentesNivel.FormacionProfesional":           ["FP"],
}

# EducacionSecundariaBachillerato contains both ESO-only and bachillerato-only centers.
# We refine via dgenerica_cas keywords.
ONLY_SECUNDARIA = re.compile(r"EDUCACI[OÓ]N SECUNDARIA|EDUCACI[OÓ]N B[AÁ]SICA", re.I)
ONLY_BACHILLERATO = re.compile(r"BACHILLERATO", re.I)


def fetch_layer(typename: str) -> list[dict]:
    """Download a WFS layer as CSV and return list of row dicts."""
    url = (
        f"{WFS_BASE}?service=WFS&request=GetFeature&version=2.0.0"
        f"&typeNames={typename}&outputFormat=csv"
    )
    print(f"  Fetching {typename}…", end=" ", flush=True)
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    rows = list(csv.DictReader(io.StringIO(r.text)))
    print(f"{len(rows)} records")
    return rows


def build_levels_map() -> dict[str, list]:
    """Returns {codcen: [levels]} with official data from WFS."""
    levels_map: dict[str, set] = defaultdict(set)

    for typename, default_levels in LAYER_LEVELS.items():
        rows = fetch_layer(typename)
        for row in rows:
            code = (row.get("codcen") or "").strip()
            if not code:
                continue

            if typename == "ms:CentrosDocentesNivel.EducacionSecundariaBachillerato":
                desc = row.get("dgenerica_cas", "")
                if ONLY_SECUNDARIA.search(desc):
                    lvls = ["secundaria"]
                elif ONLY_BACHILLERATO.search(desc):
                    lvls = ["bachillerato"]
                else:
                    lvls = ["secundaria", "bachillerato"]
            else:
                lvls = default_levels

            levels_map[code].update(lvls)

    # Sort levels in logical order
    order = ["infantil", "primaria", "secundaria", "bachillerato", "FP"]
    return {
        code: [l for l in order if l in lvls]
        for code, lvls in levels_map.items()
    }


def run():
    print("==> Fetching official levels from GVA WFS…")
    levels_map = build_levels_map()
    print(f"  Total codes mapped: {len(levels_map)}")

    db: Session = SessionLocal()
    schools = db.query(School).all()

    updated = matched = 0
    for school in schools:
        # Extract raw code: "gva_46017778" → "46017778"
        raw = (school.code or "")
        if raw.startswith("gva_"):
            raw = raw[4:]
        else:
            continue  # OSM-only schools without GVA code — skip

        if raw not in levels_map:
            continue

        matched += 1
        new_levels = levels_map[raw]
        if new_levels != school.levels:
            school.levels = new_levels
            updated += 1

    db.commit()
    db.close()
    print(f"  Schools matched by code: {matched}")
    print(f"  Schools with updated levels: {updated}")
    print("==> Done.")


if __name__ == "__main__":
    run()
