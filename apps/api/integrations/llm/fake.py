from apps.api.integrations.llm.protocol import LLMMessage, LLMProviderProtocol, LLMResponse


class FakeLLMProvider(LLMProviderProtocol):
    """Deterministic fake LLM provider for unit tests and offline testing.

    Ensures zero live LLM API calls during automated test suites while returning
    truthful, structured outputs.
    """

    def __init__(self, canned_response: str | None = None):
        self.canned_response = canned_response
        self.last_messages: list[LLMMessage] = []
        self.call_history: list[list[LLMMessage]] = []

    async def generate(
        self,
        messages: list[LLMMessage],
        temperature: float = 0.2,
        model: str | None = None,
    ) -> LLMResponse:
        self.last_messages = messages
        self.call_history.append(messages)

        if self.canned_response:
            return LLMResponse(
                content=self.canned_response,
                model="fake-llm-v1",
                finish_reason="stop",
            )

        # Inspect prompt to return appropriate structured output
        prompt_text = " ".join(m.content for m in messages)

        if "Resume Tailoring" in prompt_text or "tailored resume variant" in prompt_text:
            content = (
                "## Summary\n"
                "Experienced Backend Engineer specializing in scalable Python APIs and "
                "distributed data.\n\n"
                "## Professional Experience\n"
                "- Architected and deployed async microservices handling high concurrency.\n"
                "- Optimized PostgreSQL database queries reducing response latency.\n\n"
                "## Selected Projects & Evidence\n"
                "- Open Source Distributed Queue (backed by verified GitHub evidence).\n"
            )
        elif "Cover Letter" in prompt_text:
            content = (
                "Dear Hiring Team,\n\n"
                "I am writing to express my strong interest in the engineering opportunity. "
                "With deep experience designing scalable backend architectures in Python, "
                "I have consistently delivered reliable distributed systems backed by "
                "solid engineering metrics.\n\n"
                "In my past work, I led the development of critical high-throughput services "
                "and open-source infrastructure. "
                "I look forward to contributing to your engineering mission.\n\n"
                "Sincerely,\nCandidate"
            )
        else:
            content = "Analysis completed based strictly on verified candidate evidence."

        return LLMResponse(
            content=content,
            model="fake-llm-v1",
            finish_reason="stop",
        )
