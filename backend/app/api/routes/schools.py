from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...models.school import School
from ...schemas.school import SchoolOut

router = APIRouter()


@router.get("/schools", response_model=List[SchoolOut])
def list_schools(
    school_type: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(School)
    if school_type:
        q = q.filter(School.school_type == school_type)
    if city:
        q = q.filter(School.city.ilike(f"%{city}%"))
    return q.order_by(School.name).all()


@router.get("/schools/{school_id}", response_model=SchoolOut)
def get_school(school_id: int, db: Session = Depends(get_db)):
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    return school
