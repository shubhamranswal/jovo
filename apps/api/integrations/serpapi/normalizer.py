import re
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from apps.api.integrations.serpapi.models import NormalizedDiscoveredJob, SerpApiJobItem
from apps.api.services.job_service import JobService


class SerpApiNormalizer:
    """Normalizes raw SerpApi Google Jobs items into JobOS domain representation."""

    @classmethod
    def parse_salary(
        cls, salary_str: str | None
    ) -> tuple[Decimal | None, Decimal | None, str | None]:
        """Extracts salary min, max, and currency if present in raw text without inventing data."""
        if not salary_str:
            return None, None, None

        currency = None
        if "$" in salary_str:
            currency = "USD"
        elif "₹" in salary_str:
            currency = "INR"
        elif "€" in salary_str:
            currency = "EUR"
        elif "£" in salary_str:
            currency = "GBP"

        # Regex to detect numbers like 120k, 150,000, 20L
        clean = salary_str.replace(",", "")
        numbers = re.findall(r"(\d+(?:\.\d+)?)\s*([kKlL])?", clean)
        if not numbers:
            return None, None, currency

        values: list[Decimal] = []
        for num_str, multiplier in numbers:
            try:
                val = Decimal(num_str)
                if multiplier.lower() == "k":
                    val *= 1000
                elif multiplier.lower() == "l":
                    val *= 100000  # Indian Lakhs
                values.append(val)
            except Exception:
                continue

        if len(values) >= 2:
            return min(values[0], values[1]), max(values[0], values[1]), currency
        elif len(values) == 1:
            return values[0], None, currency

        return None, None, currency

    @classmethod
    def extract_remote_type(cls, item: SerpApiJobItem) -> str | None:
        """Determines remote type from detected extensions or raw metadata."""
        if item.detected_extensions and item.detected_extensions.work_from_home:
            return "remote"

        text_to_check = f"{item.title} {item.location or ''} {' '.join(item.extensions)}".lower()
        if "remote" in text_to_check or "work from home" in text_to_check:
            return "remote"
        if "hybrid" in text_to_check:
            return "hybrid"
        if "on-site" in text_to_check or "onsite" in text_to_check:
            return "on-site"

        return None

    @classmethod
    def extract_employment_type(cls, item: SerpApiJobItem) -> str | None:
        """Extracts schedule or employment type."""
        if item.detected_extensions and item.detected_extensions.schedule_type:
            return item.detected_extensions.schedule_type

        for ext in item.extensions:
            ext_lower = ext.lower()
            if "full-time" in ext_lower:
                return "Full-time"
            if "part-time" in ext_lower:
                return "Part-time"
            if "contract" in ext_lower:
                return "Contract"
            if "internship" in ext_lower:
                return "Internship"

        return None

    @classmethod
    def extract_requirements(cls, item: SerpApiJobItem) -> list[str]:
        """Extracts requirement/qualification bullets from job highlights without fabricating."""
        reqs: list[str] = []
        match_keys = ["qualification", "requirement", "skills", "who you are"]
        for highlight in item.job_highlights:
            title_lower = (highlight.title or "").lower()
            if any(k in title_lower for k in match_keys):
                for line in highlight.items:
                    clean_line = line.strip()
                    if clean_line and clean_line not in reqs:
                        reqs.append(clean_line)
        return reqs

    @classmethod
    def normalize_job(
        cls,
        item: SerpApiJobItem,
        search_query: str,
        query_metadata: dict[str, Any] | None = None,
    ) -> NormalizedDiscoveredJob:
        """Normalizes a single SerpApi job item into NormalizedDiscoveredJob."""
        company = item.company_name.strip()
        title = item.title.strip()
        location = item.location.strip() if item.location else None
        description = (item.description or "").strip()

        # Deduplication fingerprint
        fingerprint = JobService.generate_fingerprint(
            company_name=company,
            title=title,
            location=location,
            description=description,
        )

        # Salary parsing
        curr_symbols = ["$", "₹", "€", "£", "/yr", "/hr"]
        salary_text = (
            item.detected_extensions.salary
            if item.detected_extensions and item.detected_extensions.salary
            else next(
                (ext for ext in item.extensions if any(c in ext for c in curr_symbols)),
                None,
            )
        )
        salary_min, salary_max, currency = cls.parse_salary(salary_text)

        # Source URLs and names
        source_urls: list[str] = []
        source_names: list[str] = []

        for apply in item.apply_options:
            if apply.link and apply.link not in source_urls:
                source_urls.append(apply.link)
            if apply.title and apply.title not in source_names:
                source_names.append(apply.title)

        if item.share_link and item.share_link not in source_urls:
            source_urls.append(item.share_link)

        if item.via:
            via_clean = item.via.strip()
            if via_clean not in source_names:
                source_names.append(via_clean)

        canonical_url = source_urls[0] if source_urls else item.share_link

        provenance = {
            "engine": "google_jobs",
            "provider": "serpapi",
            "query": search_query,
            "external_job_id": item.job_id,
            "retrieved_at": datetime.now(UTC).isoformat(),
            "via": item.via,
            "raw_extensions": item.extensions,
        }
        if query_metadata:
            provenance["query_metadata"] = query_metadata

        return NormalizedDiscoveredJob(
            title=title,
            company_name=company,
            location=location,
            remote_type=cls.extract_remote_type(item),
            employment_type=cls.extract_employment_type(item),
            salary_min=salary_min,
            salary_max=salary_max,
            currency=currency,
            description=description,
            normalized_requirements=cls.extract_requirements(item),
            source_urls=source_urls,
            source_names=source_names,
            canonical_url=canonical_url,
            external_id=item.job_id[:255] if item.job_id else None,
            posted_at=None,
            fingerprint=fingerprint,
            provenance=provenance,
        )
