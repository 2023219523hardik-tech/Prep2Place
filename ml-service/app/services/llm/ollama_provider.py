"""
Real Ollama client — calls a locally-running Ollama server (free, no API key needed; this is
the standard way Ollama works). Untestable in the sandbox this was built in (no internet to
install/run the Ollama binary or pull a model), but the HTTP contract is correct: Ollama's
`/api/generate` endpoint with `stream: false` returns `{"response": "...", ...}`.

Run Ollama yourself with: `ollama serve` (default port 11434), then `ollama pull llama3.1`
(or any model) and set OLLAMA_MODEL accordingly.
"""
import httpx

from app.services.llm.base import LLMProvider


class OllamaProvider(LLMProvider):
    def __init__(self, base_url: str, model: str, timeout: float = 60.0):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    async def complete(self, prompt: str, system: str | None = None) -> str:
        payload = {"model": self.model, "prompt": prompt, "stream": False}
        if system:
            payload["system"] = system

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(f"{self.base_url}/api/generate", json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("response", "")
