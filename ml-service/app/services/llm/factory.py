"""Factory pattern: builds the configured LLMProvider from settings. Defaults to the free,
local Ollama provider — set LLM_PROVIDER=gemini + GEMINI_API_KEY to use Gemini instead, or
LLM_PROVIDER=mock to force the zero-setup deterministic fallback (e.g. in CI)."""
from app.config.settings import get_settings
from app.services.llm.base import LLMProvider


def get_llm_provider() -> LLMProvider:
    settings = get_settings()

    if settings.llm_provider == "gemini":
        from app.services.llm.gemini_provider import GeminiProvider
        if not settings.gemini_api_key:
            from app.services.llm.mock_provider import MockLLMProvider
            return MockLLMProvider()  # no key configured -> degrade gracefully instead of crashing
        return GeminiProvider(api_key=settings.gemini_api_key, model=settings.gemini_model)

    if settings.llm_provider == "ollama":
        from app.services.llm.ollama_provider import OllamaProvider
        return OllamaProvider(base_url=settings.ollama_base_url, model=settings.ollama_model)

    from app.services.llm.mock_provider import MockLLMProvider
    return MockLLMProvider()
