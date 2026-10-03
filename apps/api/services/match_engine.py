from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from apps.api.db.models import CareerProfile, Job, JobMatch


class MatchEngine:
    """Deterministic, explainable job match engine grounded in Career Evidence."""

    @classmethod
    def evaluate_match(cls, db: Session, job_id: UUID, career_profile_id: UUID) -> JobMatch:
        job = db.scalar(select(Job).where(Job.id == job_id))
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        profile = db.scalar(
            select(CareerProfile)
            .where(CareerProfile.id == career_profile_id)
            .options(
                joinedload(CareerProfile.skills),
                joinedload(CareerProfile.experiences),
                joinedload(CareerProfile.evidence),
            )
        )
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Career profile {career_profile_id} not found",
            )

        # 1. Collect candidate skills and evidence mappings
        # Map skill/technology name -> list of supporting evidence descriptions
        candidate_skills: dict[str, list[dict]] = {}

        for cps in profile.skills:
            if cps.skill:
                name = cps.skill.normalized_name.lower().strip()
                candidate_skills.setdefault(name, []).append(
                    {
                        "type": "profile_skill",
                        "proficiency": cps.proficiency,
                        "status": "user_provided",
                    }
                )

        for ev in profile.evidence:
            ev_title = ev.title.lower().strip()
            candidate_skills.setdefault(ev_title, []).append(
                {
                    "type": ev.type,
                    "evidence_id": str(ev.id),
                    "title": ev.title,
                    "status": ev.verification_state,
                    "source": ev.source_type,
                }
            )

        # 2. Evaluate requirements against candidate evidence
        job_reqs = [str(r).strip() for r in (job.normalized_requirements_json or [])]
        matched_items: list[dict] = []
        gaps: list[str] = []

        if job_reqs:
            for req in job_reqs:
                req_lower = req.lower()
                matches = [
                    ev_list
                    for sk, ev_list in candidate_skills.items()
                    if sk in req_lower or req_lower in sk
                ]
                if matches:
                    # Flatten supporting evidence
                    flat_evidence = [item for sublist in matches for item in sublist]
                    matched_items.append(
                        {
                            "requirement": req,
                            "evidence": flat_evidence,
                        }
                    )
                else:
                    gaps.append(f"MISSING EVIDENCE: {req}")

            skills_score = int((len(matched_items) / len(job_reqs)) * 100)
        else:
            # Fallback keyword match in description
            desc_lower = job.description.lower()
            matched_count = 0
            for sk, ev_list in candidate_skills.items():
                if sk in desc_lower:
                    matched_count += 1
                    matched_items.append({"requirement": sk, "evidence": ev_list})

            skills_score = min(100, matched_count * 20) if candidate_skills else 50

        # 3. Evaluate Experience Depth
        exp_count = len(profile.experiences)
        exp_score = min(100, exp_count * 25)

        # 4. Location / Remote Alignment
        pref_remote = profile.preferences_json.get("remote", True)
        if job.remote_type == "remote" or pref_remote:
            location_score = 100
        elif job.location and profile.location and profile.location.lower() in job.location.lower():
            location_score = 90
        else:
            location_score = 60

        # 5. Salary Compatibility
        salary_score = 80
        if job.salary_min and "min_salary" in profile.preferences_json:
            pref_min = profile.preferences_json["min_salary"]
            salary_score = 100 if job.salary_min >= pref_min else 50

        # Weighted calculation
        overall_score = int(
            (skills_score * 0.45)
            + (exp_score * 0.25)
            + (location_score * 0.15)
            + (salary_score * 0.15)
        )
        overall_score = max(0, min(100, overall_score))

        # Build strengths
        strengths = []
        if matched_items:
            req_names = [m["requirement"] for m in matched_items[:4]]
            strengths.append(f"Evidence-backed skills match: {', '.join(req_names)}")
        if exp_count > 0:
            strengths.append(f"Documented background across {exp_count} verified roles")
        if location_score >= 90:
            strengths.append(
                "Full remote / location preference compatibility"
                if job.remote_type == "remote"
                else f"Geographic alignment with {job.location}"
            )

        if not gaps and job_reqs:
            strengths.append("All primary requirements backed by candidate evidence")

        explanation = (
            f"Overall match of {overall_score}%: {skills_score}% skill alignment backed by "
            f"{len(matched_items)} evidence items, {exp_score}% experience depth, and "
            f"{location_score}% location fit."
        )

        component_scores = {
            "skills": skills_score,
            "experience": exp_score,
            "location": location_score,
            "salary": salary_score,
            "verified_evidence_count": len(profile.evidence),
        }

        # Save or update match
        match = db.scalar(
            select(JobMatch).where(
                JobMatch.job_id == job_id,
                JobMatch.career_profile_id == career_profile_id,
            )
        )
        if match:
            match.overall_score = overall_score
            match.component_scores_json = component_scores
            match.strengths_json = strengths
            match.gaps_json = gaps
            match.explanation = explanation
        else:
            match = JobMatch(
                job_id=job_id,
                career_profile_id=career_profile_id,
                overall_score=overall_score,
                component_scores_json=component_scores,
                strengths_json=strengths,
                gaps_json=gaps,
                explanation=explanation,
            )
            db.add(match)

        db.commit()
        db.refresh(match)
        return match
