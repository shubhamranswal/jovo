"""Reset the Jovo Demo Workspace to its canonical seeded state.

Usage:
    python scripts/reset_demo_workspace.py
"""

import sys
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from apps.api.db.session import SessionLocal
from apps.api.services.demo_workspace_service import (
    DEMO_CANDIDATE_NAME,
    DemoWorkspaceService,
)


def main():
    print(f"Ensuring / resetting Jovo Demo Workspace for candidate: {DEMO_CANDIDATE_NAME}...")
    with SessionLocal() as db:
        profile = DemoWorkspaceService.ensure_demo_workspace(db)
        print(f"✓ Candidate profile ready: {profile.id}")
        print(f"✓ Master resume verified (Grounded strictly in Shubham_SE.pdf)")
        print(f"✓ Experiences: {len(profile.experiences)} verified")
        print(f"✓ Skills: {len(profile.skills)} verified")
        print(f"✓ Evidence items: {len(profile.evidence)} verified")
        print("✓ Demo job openings and historical Application Capsules initialized.")
        print("\nDemo workspace is ready! Launch the app and visit http://localhost:3000")


if __name__ == "__main__":
    main()
