from typing import Any

import httpx

from apps.api.core.config import settings
from apps.api.integrations.llm.protocol import LLMMessage, LLMProviderProtocol, LLMResponse


class GeminiProvider(LLMProviderProtocol):
    """Google Gemini LLM provider calling the official v1beta generateContent endpoint."""

    BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

    def __init__(self, api_key: str | None = None, model: str | None = None, timeout: float = 30.0):
        self._api_key = api_key if api_key is not None else settings.GEMINI_API_KEY
        self.default_model = model or settings.LLM_MODEL or "gemini-2.5-flash"
        self.timeout = timeout

    async def generate(
        self,
        messages: list[LLMMessage],
        temperature: float = 0.2,
        model: str | None = None,
    ) -> LLMResponse:
        active_model = model or self.default_model

        if not self._api_key or not self._api_key.strip():
            raise RuntimeError("GEMINI_API_KEY is not configured in environment variables.")

        # Separate system instruction from conversation contents
        system_instructions: list[str] = []
        contents: list[dict[str, Any]] = []

        for msg in messages:
            if msg.role == "system":
                system_instructions.append(msg.content)
            else:
                gemini_role = "user" if msg.role == "user" else "model"
                contents.append({"role": gemini_role, "parts": [{"text": msg.content}]})

        request_body: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
            },
        }
        if system_instructions:
            combined_sys = "\n\n".join(system_instructions)
            request_body["systemInstruction"] = {"parts": [{"text": combined_sys}]}

        url = f"{self.BASE_URL}/{active_model}:generateContent"
        params = {"key": self._api_key.strip()}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, params=params, json=request_body)

        if resp.status_code != 200:
            raise RuntimeError(f"Gemini API returned HTTP {resp.status_code}: {resp.text[:300]}")

        data = resp.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise RuntimeError("Gemini returned no candidates.")

        first_cand = candidates[0]
        parts = first_cand.get("content", {}).get("parts", [])
        text_content = "".join(p.get("text", "") for p in parts)

        return LLMResponse(
            content=text_content.strip(),
            model=active_model,
            finish_reason=first_cand.get("finishReason", "stop"),
        )
