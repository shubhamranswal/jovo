from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.core.config import settings
from apps.api.routers import applications, career, health, jobs, resumes

app = FastAPI(
    title="Jovo API",
    version="0.1.0",
    description=(
        "AI-assisted job applications with application memory. Apply smarter. Get hired faster."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root v1 API router
api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(health.router)
api_v1_router.include_router(career.router)
api_v1_router.include_router(jobs.router)
api_v1_router.include_router(resumes.router)
api_v1_router.include_router(applications.router)

app.include_router(api_v1_router)


@app.get("/")
def root():
    return {
        "name": "Jovo API",
        "tagline": "Apply smarter. Get hired faster.",
        "version": "0.1.0",
        "docs": "/docs",
    }
