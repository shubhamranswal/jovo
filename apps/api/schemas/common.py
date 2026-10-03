from typing import Any, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.1.0"
    environment: str = "development"


class PaginatedResponse[T](BaseModel):
    items: list[T]
    total: int
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


class SuccessMessageResponse(BaseModel):
    success: bool = True
    message: str
    id: UUID | None = None


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
