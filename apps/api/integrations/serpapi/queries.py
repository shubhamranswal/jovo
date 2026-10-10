import re
from typing import Any

from pydantic import BaseModel, Field

from apps.api.integrations.serpapi.models import SerpApiSearchParameters


class SearchPlannerPreferences(BaseModel):
    """User preferences and parameters for planned job discovery."""

    role: str = Field(..., min_length=1, max_length=255)
    skills: list[str] = Field(default_factory=list)
    company: str | None = None
    location: str | None = None
    remote: bool | None = None
    experience_level: str | None = None
    employment_type: str | None = None
    start: int = Field(default=0, ge=0)


class SearchPlanner:
    """Plans and constructs deterministic SerpApi Google Jobs search queries

    from user career preferences without query clutter.
    """

    @classmethod
    def plan_query(cls, preferences: SearchPlannerPreferences) -> SerpApiSearchParameters:
        query_parts: list[str] = []

        clean_role = preferences.role.strip()

        # 1. Experience level inclusion if not already in role title
        if preferences.experience_level:
            level = preferences.experience_level.strip().lower()
            if level not in clean_role.lower():
                query_parts.append(preferences.experience_level.strip().title())

        # 2. Role title
        query_parts.append(clean_role)

        # 3. Specific company filter if requested
        if preferences.company:
            query_parts.append(f"at {preferences.company.strip()}")

        # 4. Top skills (filter out empty/duplicate strings)
        role_words = clean_role.split()
        valid_skills = [
            s.strip()
            for s in preferences.skills
            if s.strip() and s.strip().lower() not in clean_role.lower()
        ]
        if valid_skills:
            # If role is already multi-word, append at most 1 skill to avoid over-constraining Google search
            max_skills = 1 if len(role_words) >= 3 else 2
            query_parts.append(" ".join(valid_skills[:max_skills]))

        # 5. Remote keyword handling
        if preferences.remote is True:
            if "remote" not in clean_role.lower():
                query_parts.append("remote")

        # 6. Employment type
        if preferences.employment_type:
            emp = preferences.employment_type.strip().lower()
            if emp in ["contract", "part-time", "internship"] and emp not in clean_role.lower():
                query_parts.append(emp)

        raw_query = " ".join(query_parts)
        # Normalize whitespace
        clean_q = re.sub(r"\s+", " ", raw_query).strip()

        # Location determination
        location_param: str | None = None
        if preferences.location:
            location_param = preferences.location.strip()
        elif preferences.remote is True:
            location_param = None  # query already contains "remote"

        return SerpApiSearchParameters(
            engine="google_jobs",
            q=clean_q,
            location=location_param,
            hl="en",
            start=preferences.start,
        )

    @classmethod
    def serialize_plan_metadata(
        cls, preferences: SearchPlannerPreferences, params: SerpApiSearchParameters
    ) -> dict[str, Any]:
        return {
            "role": preferences.role,
            "skills": preferences.skills,
            "company": preferences.company,
            "location": preferences.location,
            "remote": preferences.remote,
            "query_string": params.q,
            "location_param": params.location,
            "engine": params.engine,
        }
