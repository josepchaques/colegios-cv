import os
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from .core.database import Base, engine
from .api.routes import recommend, schools

Base.metadata.create_all(bind=engine)

DEBUG = os.getenv("DEBUG", "true").lower() == "true"

# Docs only available in debug/dev mode
app = FastAPI(
    title="School Recommender CV",
    description="Recomendación de colegios en la Comunitat Valenciana",
    version="1.0.0",
    docs_url="/docs" if DEBUG else None,
    redoc_url="/redoc" if DEBUG else None,
    openapi_url="/openapi.json" if DEBUG else None,
)

# In production set ALLOWED_ORIGINS=https://yourdomain.com
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    # Remove server fingerprint (uvicorn adds its own at transport level;
    # use --no-server-header in production to suppress it entirely)
    del response.headers["server"]
    return response


app.include_router(recommend.router, prefix="/api/v1", tags=["recommend"])
app.include_router(schools.router, prefix="/api/v1", tags=["schools"])


@app.get("/health")
def health():
    return {"status": "ok"}
