from typing import Any, Protocol, runtime_checkable

import httpx
from pydantic import ValidationError

from apps.api.core.config import settings
from apps.api.integrations.serpapi.models import SerpApiRawResponse, SerpApiSearchParameters


class SerpApiError(Exception):
    """Base exception for SerpApi integration."""

    pass


class SerpApiConfigError(SerpApiError):
    """Raised when SerpApi API key is not configured."""

    pass


class SerpApiHttpError(SerpApiError):
    """Raised when SerpApi returns an HTTP error code."""

    def __init__(self, status_code: int, message: str):
        super().__init__(f"SerpApi HTTP {status_code}: {message}")
        self.status_code = status_code
        self.message = message


class SerpApiParseError(SerpApiError):
    """Raised when SerpApi response cannot be parsed into expected schema."""

    pass


@runtime_checkable
class SerpApiClientProtocol(Protocol):
    """Protocol enabling clean dependency injection and test fakes for SerpApi."""

    async def search_jobs(self, params: SerpApiSearchParameters) -> SerpApiRawResponse: ...


class SerpApiClient(SerpApiClientProtocol):
    """Production client executing HTTP requests to SerpApi Google Jobs engine

    with server-side failover support for quota/auth/rate-limit conditions.
    """

    BASE_URL = "https://serpapi.com/search.json"

    def __init__(
        self,
        api_key: str | None = None,
        fallback_api_key: str | None = None,
        timeout: float = 15.0,
    ):
        self._primary_api_key = api_key if api_key is not None else settings.SERPAPI_API_KEY
        if fallback_api_key is not None:
            self._fallback_api_key = fallback_api_key
        elif api_key is not None and not api_key.strip():
            self._fallback_api_key = ""
        else:
            self._fallback_api_key = settings.SERPAPI_FALLBACK_API_KEY
        self.timeout = timeout

    @property
    def primary_api_key(self) -> str:
        return (self._primary_api_key or "").strip()

    @property
    def fallback_api_key(self) -> str:
        return (self._fallback_api_key or "").strip()

    @property
    def api_key(self) -> str:
        key = self.primary_api_key or self.fallback_api_key
        if not key:
            raise SerpApiConfigError("SERPAPI_API_KEY is not configured in environment variables.")
        return key

    @staticmethod
    def _is_failover_condition(status_code: int, error_text: str) -> bool:
        """Determines if failure is auth, quota, or rate-limit error warranting failover."""
        if status_code in (401, 403, 429):
            return True
        lower_err = error_text.lower()
        quota_keywords = (
            "run out of searches",
            "searches limit reached",
            "monthly search limit",
            "quota",
            "invalid api key",
            "unauthorized",
            "payment required",
            "account has run out",
            "exceeded",
        )
        return any(kw in lower_err for kw in quota_keywords)

    async def _execute_request(
        self,
        client: httpx.AsyncClient,
        key: str,
        params: SerpApiSearchParameters,
    ) -> tuple[int, dict[str, Any] | None, str]:
        request_params = {
            "engine": params.engine,
            "q": params.q,
            "hl": params.hl,
            "start": params.start,
            "api_key": key,
        }
        if params.location:
            request_params["location"] = params.location

        try:
            response = await client.get(self.BASE_URL, params=request_params)
        except httpx.RequestError as exc:
            raise SerpApiHttpError(
                status_code=503,
                message=f"Network error communicating with SerpApi: {exc!s}",
            ) from exc

        body_text = response.text
        data = None
        try:
            data = response.json()
        except Exception:
            pass

        return response.status_code, data, body_text

    async def search_jobs(self, params: SerpApiSearchParameters) -> SerpApiRawResponse:
        primary_key = self.primary_api_key
        fallback_key = self.fallback_api_key

        if not primary_key and not fallback_key:
            raise SerpApiConfigError("SERPAPI_API_KEY is not configured in environment variables.")

        initial_key = primary_key or fallback_key
        has_distinct_fallback = bool(fallback_key and fallback_key != initial_key)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            status_code, data, body_text = await self._execute_request(client, initial_key, params)

            error_message = ""
            if isinstance(data, dict) and data.get("error"):
                error_message = str(data["error"])
            elif status_code != 200:
                error_message = body_text[:200]

            is_error = status_code != 200 or bool(error_message)

            # Check if failover to secondary key is warranted
            if (
                is_error
                and has_distinct_fallback
                and self._is_failover_condition(status_code, error_message)
            ):
                status_code, data, body_text = await self._execute_request(
                    client, fallback_key, params
                )
                error_message = ""
                if isinstance(data, dict) and data.get("error"):
                    error_message = str(data["error"])
                elif status_code != 200:
                    error_message = body_text[:200]
                is_error = status_code != 200 or bool(error_message)

            if is_error:
                clean_msg = error_message
                for k in (primary_key, fallback_key):
                    if k and len(k) > 4:
                        clean_msg = clean_msg.replace(k, "[REDACTED_API_KEY]")
                actual_status = status_code if status_code != 200 else 400
                raise SerpApiHttpError(
                    status_code=actual_status,
                    message=f"SerpApi search failed with status {actual_status}: {clean_msg}",
                )

        if not isinstance(data, dict):
            raise SerpApiParseError("Invalid JSON returned from SerpApi")

        try:
            return SerpApiRawResponse.model_validate(data)
        except ValidationError as exc:
            raise SerpApiParseError(f"Failed to parse SerpApi response schema: {exc!s}") from exc
