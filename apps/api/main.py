from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.core.config import settings
from apps.api.routers import applications, career, health, jobs, resumes

app = FastAPI(
    title="JobOS API",
    version="0.1.0",
    description="Job-search operating system API. Apply anywhere. Forget nothing.",
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
        "name": "JobOS API",
        "tagline": "Apply anywhere. Forget nothing.",
        "version": "0.1.0",
        "docs": "/docs",
    }
