from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.core.config import settings
from apps.api.db.models import Application, Job, User
from apps.api.db.session import get_db
from apps.api.services.demo_workspace_service import (
    DEMO_CANDIDATE_EMAIL,
    DemoWorkspaceService,
)

router = APIRouter(prefix="/demo", tags=["Demo Workspace"])


@router.get("/status")
def get_demo_status():
    """Returns whether the server is operating in Demo Workspace mode."""
    return {
        "demo_mode": settings.DEMO_MODE,
        "workspace_name": "Demo Workspace" if settings.DEMO_MODE else "Production Workspace",
        "candidate": "Shubham Singh Ranswal" if settings.DEMO_MODE else None,
    }


@router.post("/reset")
def reset_demo_workspace(db: Session = Depends(get_db)):
    """Resets the demo workspace applications and jobs back to canonical state.

    Only permitted when DEMO_MODE=true. Never deletes non-demo records.
    """
    if not settings.DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo workspace reset is only permitted when DEMO_MODE=true.",
        )

    # 1. Locate demo candidate user
    user = db.scalar(select(User).where(User.email == DEMO_CANDIDATE_EMAIL))
    if user:
        # Find all applications linked to demo jobs and reset them
        for spec in [
            {"id": "DEMO-JOB-GO-01", "status": "Saved"},
            {"id": "DEMO-JOB-SEC-02", "status": "Offer"},
            {"id": "DEMO-JOB-AI-03", "status": "Interviewing"},
            {"id": "DEMO-JOB-SYS-04", "status": "Applied"},
            {"id": "DEMO-JOB-LEG-05", "status": "Rejected"},
        ]:
            job = db.scalar(select(Job).where(Job.external_id == spec["id"]))
            if job:
                app = db.scalar(
                    select(Application).where(
                        Application.user_id == user.id, Application.job_id == job.id
                    )
                )
                if app:
                    app.status = spec["status"]

        db.commit()

    # 2. Re-ensure all components
    profile = DemoWorkspaceService.ensure_demo_workspace(db)

    return {
        "status": "reset_completed",
        "workspace": "Demo Workspace",
        "profile_id": str(profile.id),
        "candidate": "Shubham Singh Ranswal",
        "message": "Demo workspace reset to canonical state successfully.",
    }
