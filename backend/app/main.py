"""The FastAPI application.

Run it with:   uvicorn app.main:app --reload
Then open:     http://localhost:8000/docs
"""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.catalogue import SOUNDS
from app.config import get_settings
from app.database import Base, engine, get_db
from app.errors import register_error_handlers
from app.ml_model import ModelService, get_model_service
from app.routers import analytics, auth, classify, events, preferences, profile
from app.schemas import SoundInfo

DESCRIPTION = """
Backend for **An Online Sensory-Support Application for Individuals with Auditory Sensitivities**.

It identifies selected environmental sounds from short recordings and compares them with each
user's own sound profile. It is a sensory-support and accessibility tool. It is **not** a medical
device and does not diagnose, treat or predict any condition.

Most endpoints need a token: log in at `POST /auth/login`, copy the `access_token`, press
**Authorize** (top right) and paste it.
"""


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)  # creates any missing tables on start-up
    yield


app = FastAPI(
    title="Sensory Support API",
    version="1.0.0",
    description=DESCRIPTION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

register_error_handlers(app)

for module in (auth, profile, preferences, events, analytics, classify):
    app.include_router(module.router)


@app.get("/health", tags=["System"], summary="Is the server, database and model working?")
def health(db: Session = Depends(get_db), model: ModelService = Depends(get_model_service)):
    try:
        db.execute(text("SELECT 1"))
        database = "ok"
    except Exception:
        database = "unavailable"
    return {"status": "ok" if database == "ok" else "degraded", "database": database, "model": model.info()}


@app.get("/sounds", response_model=list[SoundInfo], tags=["System"], summary="Sounds the app knows, and which the model can detect")
def sounds(model: ModelService = Depends(get_model_service)):
    detectable = model.detectable_sounds()
    return [SoundInfo(id=s.id, label=s.label, detectable=s.id in detectable) for s in SOUNDS]