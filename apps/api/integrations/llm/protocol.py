from typing import Protocol, runtime_checkable

from pydantic import BaseModel, Field


class LLMMessage(BaseModel):
    role: str = Field(..., description="'system', 'user', or 'assistant'")
    content: str = Field(..., min_length=1)


class LLMResponse(BaseModel):
    content: str
    model: str
    finish_reason: str = "stop"


@runtime_checkable
class LLMProviderProtocol(Protocol):
    """Protocol establishing a vendor-neutral LLM provider boundary."""

    async def generate(
        self,
        messages: list[LLMMessage],
        temperature: float = 0.2,
        model: str | None = None,
    ) -> LLMResponse: ...
