from typing import Protocol, runtime_checkable

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
    """Production client executing HTTP requests to SerpApi Google Jobs engine."""

    BASE_URL = "https://serpapi.com/search.json"

    def __init__(self, api_key: str | None = None, timeout: float = 15.0):
        self._api_key = api_key if api_key is not None else settings.SERPAPI_API_KEY
        self.timeout = timeout

    @property
    def api_key(self) -> str:
        if not self._api_key or not self._api_key.strip():
            raise SerpApiConfigError("SERPAPI_API_KEY is not configured in environment variables.")
        return self._api_key.strip()

    async def search_jobs(self, params: SerpApiSearchParameters) -> SerpApiRawResponse:
        key = self.api_key  # Validates key presence

        request_params = {
            "engine": params.engine,
            "q": params.q,
            "hl": params.hl,
            "start": params.start,
            "api_key": key,
        }
        if params.location:
            request_params["location"] = params.location

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(self.BASE_URL, params=request_params)
            except httpx.RequestError as exc:
                raise SerpApiHttpError(
                    status_code=503,
                    message=f"Network error communicating with SerpApi: {exc!s}",
                ) from exc

        if response.status_code != 200:
            err_msg = (
                f"SerpApi search failed with status {response.status_code}: {response.text[:200]}"
            )
            raise SerpApiHttpError(
                status_code=response.status_code,
                message=err_msg,
            )

        try:
            data = response.json()
            if isinstance(data, dict) and data.get("error"):
                raise SerpApiHttpError(
                    status_code=400,
                    message=f"SerpApi provider error: {data['error']}",
                )
            return SerpApiRawResponse.model_validate(data)
        except ValidationError as exc:
            raise SerpApiParseError(f"Failed to parse SerpApi response schema: {exc!s}") from exc
        except Exception as exc:
            if isinstance(exc, (SerpApiError, SerpApiHttpError)):
                raise
            raise SerpApiParseError(f"Invalid JSON returned from SerpApi: {exc!s}") from exc
